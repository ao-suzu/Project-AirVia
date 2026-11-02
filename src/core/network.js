const os = require('os');
const QRCode = require('qrcode');

class NetworkManager {
    constructor(port = 3000) {
        this.port = port;
        this.qrCache = new Map(); // QRコード生成結果のインメモリキャッシュ
    }

    /**
     * 利用可能なIPv4アドレスの一覧を取得し、ホットスポットIP（192.168.137.1）を最優先にする
     */
    getNetworkInfo(isHotspotActive = true) {
        const interfaces = os.networkInterfaces();
        const candidates = [];

        // 仮想アダプタ名（WSL, VMware, VirtualBox等）の判定パターン
        const virtualPattern = /vEthernet|WSL|VMware|VirtualBox|Loopback|Npcap/i;

        for (const name of Object.keys(interfaces)) {
            const isVirtual = virtualPattern.test(name);
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    candidates.push({
                        interface: name,
                        address: iface.address,
                        isHotspot: iface.address.startsWith('192.168.137.'),
                        isVirtual
                    });
                }
            }
        }

        // 1. ホットスポット用インターフェースが既に見つかっていればそれを使用
        let hotspotIp = null;
        const hotspotCandidate = candidates.find(c => c.isHotspot);
        if (hotspotCandidate) {
            hotspotIp = hotspotCandidate.address;
        } else if (isHotspotActive) {
            // Windowsモバイルホットスポット親機の標準IPアドレス
            hotspotIp = '192.168.137.1';
        }

        // 2. Wi-Fiまたは物理LANのIPも検出（補助用）
        let localIp = '127.0.0.1';
        const physicalCandidate = candidates.find(c => !c.isVirtual && !c.isHotspot && /wi-fi|wlan|wireless|イーサネット|ethernet/i.test(c.interface))
            || candidates.find(c => !c.isVirtual && !c.isHotspot);
        if (physicalCandidate) {
            localIp = physicalCandidate.address;
        }

        // スマホはホットスポットWi-Fiに接続するため、ホットスポットIPが最優先！
        const primaryIp = hotspotIp || localIp;

        return {
            primaryIp,
            hotspotIp: hotspotIp || '192.168.137.1',
            localIp,
            allInterfaces: candidates,
            portalUrl: `http://${primaryIp}:${this.port}`,
            adminUrl: `http://localhost:${this.port}/admin`
        };
    }

    /**
     * Wi-Fi接続用のQRコード（DataURL形式）を生成
     * スマホカメラでスキャンすると自動でWi-Fi接続画面が出る形式
     */
    async generateWifiQrCode(ssid, password) {
        // Wi-Fi接続QR規格: WIFI:S:<SSID>;T:WPA;P:<PASSWORD>;;
        const wifiString = `WIFI:S:${ssid};T:WPA;P:${password};;`;
        if (this.qrCache.has(wifiString)) {
            return this.qrCache.get(wifiString);
        }
        try {
            const dataUrl = await QRCode.toDataURL(wifiString, {
                errorCorrectionLevel: 'M',
                margin: 2,
                width: 280,
                color: {
                    dark: '#1e293b',
                    light: '#ffffff'
                }
            });
            this.qrCache.set(wifiString, dataUrl);
            return dataUrl;
        } catch (err) {
            console.error('[QRCode] Failed to generate Wi-Fi QR:', err);
            return null;
        }
    }

    /**
     * ポータルURLのQRコード（DataURL形式）を生成
     */
    async generateUrlQrCode(url) {
        if (this.qrCache.has(url)) {
            return this.qrCache.get(url);
        }
        try {
            const dataUrl = await QRCode.toDataURL(url, {
                errorCorrectionLevel: 'M',
                margin: 2,
                width: 280,
                color: {
                    dark: '#0f172a',
                    light: '#ffffff'
                }
            });
            this.qrCache.set(url, dataUrl);
            return dataUrl;
        } catch (err) {
            console.error('[QRCode] Failed to generate URL QR:', err);
            return null;
        }
    }
}

module.exports = NetworkManager;
