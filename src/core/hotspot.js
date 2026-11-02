const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * PowerShellスクリプトを安全にBase64エンコードして実行するヘルパー
 */
function runPowerShell(script) {
    return new Promise((resolve) => {
        // プログレスバー出力を抑制
        const wrappedScript = `$ProgressPreference = 'SilentlyContinue';\n` + script;
        const buffer = Buffer.from(wrappedScript, 'utf16le');
        const encoded = buffer.toString('base64');
        exec(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, { windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                // 一般的な警告レベルのエラーは抑制しつつ結果を返す
                return resolve({ success: false, error: error.message });
            }
            try {
                const trimmed = stdout.trim();
                const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0]);
                    return resolve(data);
                }
                resolve({ success: true, raw: trimmed });
            } catch (e) {
                resolve({ success: true, raw: stdout.trim() });
            }
        });
    });
}

/**
 * 接続プロファイルからTetheringManagerを取得するPowerShell共通スクリプト
 */
function buildProfileScript(targetSsid) {
    return `
        Add-Type -AssemblyName System.Runtime.WindowsRuntime;
        $c = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]::GetConnectionProfiles() | Where-Object { $_.ProfileName -like ('*' + '${targetSsid}' + '*') } | Select-Object -First 1;
        if (-not $c) {
            $c = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]::GetInternetConnectionProfile();
        }
        if (-not $c) {
            $c = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]::GetConnectionProfiles() | Select-Object -First 1;
        }
    `;
}

class HotspotManager {
    constructor(options = {}) {
        this.desiredSsid = options.ssid || 'AirVia_Local';
        this.desiredPassword = options.password || 'airviapass123';
        this.port = options.port || 3000;
        
        // 実際のWindows設定値
        this.ssid = this.desiredSsid;
        this.password = this.desiredPassword;
        this.status = 'stopped'; // 'stopped' | 'starting' | 'running' | 'error'

        // 高速化用インメモリキャッシュ
        this.lastConfigFetchTime = 0;
        this.cachedConfigResult = null;
        this.configCacheTtl = 15000; // 15秒間はキャッシュを使用しPowerShell起動を抑制
    }

    /**
     * Windowsファイアウォールに受信許可ルールを追加
     */
    async setupFirewall() {
        return new Promise((resolve) => {
            const ruleName = `AirVia_Server_Port_${this.port}`;
            // netsh でファイアウォール許可ルールを追加（軽快かつプログレスXMLが出ない）
            exec(`netsh advfirewall firewall show rule name="${ruleName}"`, { windowsHide: true }, (err, stdout) => {
                if (stdout && stdout.includes(ruleName)) {
                    return resolve(true);
                }
                exec(`netsh advfirewall firewall add rule name="${ruleName}" dir=in action=allow protocol=TCP localport=${this.port}`, { windowsHide: true }, () => {
                    resolve(true);
                });
            });
        });
    }

    /**
     * オフライン時でもテザリングマネージャが生成できるよう、ローカルWi-Fiプロファイルを作成・登録する（BINGO互換方式）
     */
    async ensureWifiProfile() {
        return new Promise((resolve) => {
            exec('netsh wlan show profiles', { windowsHide: true }, (error, stdout) => {
                if (stdout && stdout.includes(this.desiredSsid)) {
                    return resolve(true);
                }

                console.log(`[Wi-Fi Profile] Creating fallback profile '${this.desiredSsid}'...`);
                const xmlContent = `<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
    <name>${this.desiredSsid}</name>
    <SSIDConfig><SSID><name>${this.desiredSsid}</name></SSID></SSIDConfig>
    <connectionType>ESS</connectionType>
    <connectionMode>manual</connectionMode>
    <MSM>
        <security>
            <authEncryption>
                <authentication>WPA2PSK</authentication>
                <encryption>AES</encryption>
                <useOneX>false</useOneX>
            </authEncryption>
            <sharedKey>
                <keyType>passPhrase</keyType>
                <protected>false</protected>
                <keyMaterial>${this.desiredPassword}</keyMaterial>
            </sharedKey>
        </security>
    </MSM>
</WLANProfile>`.trim();

                const tempPath = path.join(process.env.TEMP || os.tmpdir(), `airvia_${Date.now()}.xml`);
                try {
                    fs.writeFileSync(tempPath, xmlContent, 'utf8');
                    exec(`netsh wlan add profile filename="${tempPath}"`, { windowsHide: true }, () => {
                        try { fs.unlinkSync(tempPath); } catch (e) { }
                        resolve(true);
                    });
                } catch (err) {
                    resolve(false);
                }
            });
        });
    }

    /**
     * Windowsホットスポットの現在の設定（SSID, パスワード, 稼働状況）を取得
     * force = true で明示的にPowerShellを実行し、通常時はキャッシュから即座に返す
     */
    async getCurrentConfig(force = false) {
        const now = Date.now();
        if (!force && this.cachedConfigResult && (now - this.lastConfigFetchTime < this.configCacheTtl)) {
            return this.cachedConfigResult;
        }

        const script = `
            ${buildProfileScript(this.desiredSsid)}
            if ($c) {
                $mgr = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]::CreateFromConnectionProfile($c);
                $cfg = $mgr.GetCurrentAccessPointConfiguration();
                [PSCustomObject]@{
                    Success = $true;
                    Ssid = $cfg.Ssid;
                    Passphrase = $cfg.Passphrase;
                    OperationalState = $mgr.TetheringOperationalState.ToString();
                } | ConvertTo-Json -Compress;
            } else {
                [PSCustomObject]@{ Success = $false; Error = "NoConnectionProfile"; } | ConvertTo-Json -Compress;
            }
        `;
        const result = await runPowerShell(script);
        if (result && result.Ssid) {
            this.ssid = result.Ssid;
            this.password = result.Passphrase || this.password;
            this.status = (result.OperationalState === 'On') ? 'running' : 'stopped';
            console.log(`[Hotspot Config] Windows Hotspot SSID: '${this.ssid}', State: ${result.OperationalState}`);
        }
        this.lastConfigFetchTime = Date.now();
        this.cachedConfigResult = result;
        return result;
    }

    /**
     * Windowsホットスポット親機のSSIDとパスワードを更新
     */
    async configureHotspot(targetSsid, targetPassword) {
        console.log(`[Hotspot Config] Setting Windows Hotspot to '${targetSsid}'...`);
        const script = `
            ${buildProfileScript(this.desiredSsid)}
            if ($c) {
                $mgr = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]::CreateFromConnectionProfile($c);
                $cfg = $mgr.GetCurrentAccessPointConfiguration();
                $cfg.Ssid = '${targetSsid}';
                $cfg.Passphrase = '${targetPassword}';
                $op = $mgr.ConfigureAccessPointAsync($cfg);
                
                $timeout = 0;
                while ($op.Status -eq [Windows.Foundation.AsyncStatus]::Started -and $timeout -lt 60) {
                    Start-Sleep -Milliseconds 100;
                    $timeout++;
                }
                
                $newCfg = $mgr.GetCurrentAccessPointConfiguration();
                [PSCustomObject]@{
                    Success = $true;
                    Ssid = $newCfg.Ssid;
                    Passphrase = $newCfg.Passphrase;
                } | ConvertTo-Json -Compress;
            } else {
                [PSCustomObject]@{ Success = $false; Error = "NoProfile"; } | ConvertTo-Json -Compress;
            }
        `;
        const result = await runPowerShell(script);
        if (result && result.Success && result.Ssid) {
            this.ssid = result.Ssid;
            this.password = result.Passphrase;
            this.cachedConfigResult = null; // キャッシュ無効化
            console.log(`[Hotspot Config] Successfully configured: SSID='${this.ssid}'`);
            return true;
        }
        return false;
    }

    /**
     * Windowsモバイルホットスポットを開始する（BINGO実績方式＋フォールバック）
     */
    async startHotspot() {
        this.status = 'starting';
        console.log(`[Hotspot] Launching Windows Mobile Hotspot...`);

        // BINGOで確実に動いていたコマンドチェーン
        const script = `
            ${buildProfileScript(this.desiredSsid)}
            if ($c) {
                $mgr = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]::CreateFromConnectionProfile($c);
                if ($mgr.TetheringOperationalState -ne [Windows.Networking.NetworkOperators.TetheringOperationalState]::On) {
                    $mgr.StartTetheringAsync() | Out-Null;
                    Start-Sleep -Seconds 2;
                }
                [PSCustomObject]@{
                    Success = $true;
                    OperationalState = $mgr.TetheringOperationalState.ToString();
                } | ConvertTo-Json -Compress;
            } else {
                [PSCustomObject]@{ Success = $false; Error = "NoConnectionProfile"; } | ConvertTo-Json -Compress;
            }
        `;

        const result = await runPowerShell(script);
        this.status = 'running';
        this.cachedConfigResult = null; // キャッシュ無効化
        console.log('[Hotspot] Hotspot started (result:', result, ')');
        return result;
    }

    /**
     * Windowsモバイルホットスポットを停止する
     */
    async stopHotspot() {
        console.log('[Hotspot] Stopping Windows Mobile Hotspot...');
        const script = `
            ${buildProfileScript(this.desiredSsid)}
            if ($c) {
                $mgr = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]::CreateFromConnectionProfile($c);
                $mgr.StopTetheringAsync() | Out-Null;
                [PSCustomObject]@{
                    Success = $true;
                    OperationalState = $mgr.TetheringOperationalState.ToString();
                } | ConvertTo-Json -Compress;
            }
        `;
        const res = await runPowerShell(script);
        this.status = 'stopped';
        this.cachedConfigResult = null; // キャッシュ無効化
        console.log('[Hotspot] Hotspot stopped.');
        return res;
    }

    /**
     * 初期化と起動を安全・確実に行う
     */
    async initAndStart() {
        // 1. ファイアウォール許可
        await this.setupFirewall();

        // 2. Wi-Fiプロファイルの確認・作成（BINGO互換）
        await this.ensureWifiProfile();

        // 3. 現在のWindows設定を取得
        await this.getCurrentConfig();

        // 4. 必要に応じてSSIDを書き換え
        if (this.ssid !== this.desiredSsid) {
            await this.configureHotspot(this.desiredSsid, this.desiredPassword);
            await this.getCurrentConfig();
        }

        // 5. ホットスポットを開始
        await this.startHotspot();

        return {
            ssid: this.ssid,
            password: this.password,
            status: this.status
        };
    }
}

module.exports = HotspotManager;
