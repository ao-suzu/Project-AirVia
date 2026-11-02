let currentSsid = '';
        let currentPass = '';
        let currentStatus = 'running';
        let currentLang = 'ja';

        const i18n = {
            ja: {
                guestQrTitle: 'Guest QR-CODE',
                step1Tag: 'STEP 1',
                step1Name: 'Wi-Fi接続',
                step2Tag: 'STEP 2',
                step2Name: 'ゲスト用ページを開く',
                step2Note: '※ http:// でアクセス',
                portalPreviewTitle: '参加者ポータル画面の確認',
                portalPreviewSub: 'スマホ参加者が見るトップページをこのPCでプレビューします',
                btnOpen: '開く ↗',
                infoTitle: 'Information',
                lblIp: 'IPアドレス',
                lblPort: 'ポート',
                lblSsid: 'ネットワーク名 (SSID)',
                menuEdit: '設定変更',
                menuRestart: '再起動',
                appsTitle: 'アプリ一覧',
                btnShutdown: 'シャットダウン',
                aboutTitle: 'このアプリについて',
                aboutDesc: 'AirVia(エアーヴィア) は、Windowsモバイルホットスポット機能を応用して作成されました。このアプリの裏でモバイルホットスポットで起動することによってWindows PCを親機としたローカルネットワークを構築します。オフライン環境下でも強制的に機能を立ち上げることができるため、インターネット環境がない場所でも実行可能です。',
                statusRunning: '稼働中',
                statusStopped: '停止中',
                optLight: 'ライトモード',
                optDark: 'ダークモード',
                promptSsid: '新しいWi-Fiホットスポット名 (SSID):',
                promptPass: '新しいWi-Fiパスワード (8文字以上):',
                alertPass: 'パスワードは8文字以上で指定してください',
                alertConfigFail: '設定更新に失敗しました: ',
                confirmRestart: 'ホットスポットを再起動しますか？',
                confirmStop: 'ホットスポットを停止しますか？',
                confirmShutdown: 'サーバーとホットスポットを終了しますか？\n（接続中の全クライアントが切断されます）',
                shutdownTitle: 'サーバーを終了しました',
                shutdownSub: 'このウィンドウを閉じてください。'
            },
            en: {
                guestQrTitle: 'Guest QR-CODE',
                step1Tag: 'STEP 1',
                step1Name: 'Connect Wi-Fi',
                step2Tag: 'STEP 2',
                step2Name: 'Open Guest Page',
                step2Note: '※ Access via http://',
                portalPreviewTitle: 'Guest Portal Preview',
                portalPreviewSub: 'Preview the guest portal top page on this PC',
                btnOpen: 'Open ↗',
                infoTitle: 'Information',
                lblIp: 'IP Address',
                lblPort: 'Port',
                lblSsid: 'Network Name (SSID)',
                menuEdit: 'Edit Settings',
                menuRestart: 'Restart',
                appsTitle: 'Apps',
                btnShutdown: 'Shutdown',
                aboutTitle: 'About AirVia',
                aboutDesc: 'AirVia is built utilizing the Windows Mobile Hotspot functionality. By launching the mobile hotspot in the background, it creates a local network with this Windows PC as the host. Because it can forcefully initialize without internet access, it operates reliably even in fully offline environments.',
                statusRunning: 'Running',
                statusStopped: 'Stopped',
                optLight: 'Light Mode',
                optDark: 'Dark Mode',
                promptSsid: 'New Wi-Fi Hotspot Name (SSID):',
                promptPass: 'New Wi-Fi Password (8+ characters):',
                alertPass: 'Password must be at least 8 characters',
                alertConfigFail: 'Configuration update failed: ',
                confirmRestart: 'Restart the mobile hotspot?',
                confirmStop: 'Stop the mobile hotspot?',
                confirmShutdown: 'Shutdown server and mobile hotspot?\n(All connected clients will be disconnected)',
                shutdownTitle: 'Server has been shut down',
                shutdownSub: 'Please close this window.'
            }
        };

        function onLangChange(lang) {
            currentLang = lang;
            localStorage.setItem('airvia_lang', lang);
            const select = document.getElementById('lang-select');
            if (select) select.value = lang;

            const t = i18n[lang] || i18n.ja;
            const setTxt = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            };

            setTxt('t-guest-qr-title', t.guestQrTitle);
            setTxt('t-step1-tag', t.step1Tag);
            setTxt('t-step1-name', t.step1Name);
            setTxt('t-step2-tag', t.step2Tag);
            setTxt('t-step2-name', t.step2Name);
            setTxt('t-step2-note', t.step2Note);
            setTxt('t-portal-preview-title', t.portalPreviewTitle);
            setTxt('t-portal-preview-sub', t.portalPreviewSub);
            setTxt('t-portal-preview-btn', t.btnOpen);
            setTxt('t-info-title', t.infoTitle);
            setTxt('t-lbl-ip', t.lblIp);
            setTxt('t-lbl-port', t.lblPort);
            setTxt('t-lbl-ssid', t.lblSsid);
            setTxt('t-menu-edit', t.menuEdit);
            setTxt('t-menu-restart', t.menuRestart);
            setTxt('t-apps-title', t.appsTitle);
            setTxt('t-btn-shutdown', t.btnShutdown);
            setTxt('t-about-title', t.aboutTitle);
            setTxt('t-about-desc', t.aboutDesc);

            for (let i = 1; i <= 4; i++) {
                setTxt(`t-app-arrow-${i}`, t.btnOpen);
            }

            const optLight = document.getElementById('optgroup-light');
            if (optLight) optLight.label = t.optLight;
            const optDark = document.getElementById('optgroup-dark');
            if (optDark) optDark.label = t.optDark;

            const statusText = document.getElementById('status-text');
            if (statusText) {
                statusText.textContent = (currentStatus === 'running') ? t.statusRunning : t.statusStopped;
            }
        }

        function onThemeChange(theme) {
            if (theme === 'cherry') {
                document.documentElement.removeAttribute('data-theme');
            } else {
                document.documentElement.setAttribute('data-theme', theme);
            }
            localStorage.setItem('airvia_theme', theme);
            const select = document.getElementById('theme-select');
            if (select) select.value = theme;
        }

        // Initialize saved theme & language
        const savedTheme = localStorage.getItem('airvia_theme') || 'cherry';
        onThemeChange(savedTheme);

        const savedLang = localStorage.getItem('airvia_lang') || 'ja';
        onLangChange(savedLang);

        // Hotspot More Menu Handlers
        function toggleHotspotMenu(event) {
            event.stopPropagation();
            const menu = document.getElementById('hotspot-menu-popover');
            if (menu) menu.classList.toggle('active');
        }

        document.addEventListener('click', () => {
            const menu = document.getElementById('hotspot-menu-popover');
            if (menu) menu.classList.remove('active');
        });

        function handleMenuEdit() {
            const menu = document.getElementById('hotspot-menu-popover');
            if (menu) menu.classList.remove('active');
            changeHotspotConfig();
        }

        function handleMenuRestart() {
            const menu = document.getElementById('hotspot-menu-popover');
            if (menu) menu.classList.remove('active');
            restartHotspot();
        }

        async function loadAdminInfo(force = false) {
            try {
                const url = force ? '/api/admin/info?force=true' : '/api/admin/info';
                const res = await fetch(url);
                const data = await res.json();
                if (data.success) {
                    currentSsid = data.ssid;
                    currentPass = data.password;
                    currentStatus = data.status;

                    document.getElementById('wifi-ssid').textContent = data.ssid;
                    document.getElementById('wifi-pass').textContent = data.password;
                    document.getElementById('info-ssid').textContent = data.ssid;
                    document.getElementById('host-ip').textContent = data.network.primaryIp;
                    document.getElementById('portal-url').textContent = data.urls.portal || data.network.portalUrl;

                    document.getElementById('wifi-qr-img').src = data.qrCodes.wifi;
                    document.getElementById('portal-qr-img').src = data.qrCodes.portal;

                    const statusBadge = document.getElementById('status-badge');
                    const statusText = document.getElementById('status-text');
                    const t = i18n[currentLang] || i18n.ja;

                    if (data.status === 'running') {
                        statusText.textContent = t.statusRunning;
                        statusBadge.style.color = 'var(--status-text)';
                        statusBadge.style.background = 'var(--status-bg)';
                    } else {
                        statusText.textContent = t.statusStopped;
                        statusBadge.style.color = 'var(--danger-text)';
                        statusBadge.style.background = 'var(--danger-bg)';
                    }
                }
            } catch (err) {
                console.error('Failed to load admin info:', err);
            }
        }

        async function changeHotspotConfig() {
            const t = i18n[currentLang] || i18n.ja;
            const newSsid = prompt(t.promptSsid, currentSsid);
            if (!newSsid) return;

            const newPass = prompt(t.promptPass, currentPass);
            if (!newPass || newPass.length < 8) {
                alert(t.alertPass);
                return;
            }

            try {
                const res = await fetch('/api/admin/hotspot/configure', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ssid: newSsid, password: newPass })
                });
                const result = await res.json();
                if (result.success) {
                    loadAdminInfo(true);
                } else {
                    alert(t.alertConfigFail + (result.message || ''));
                }
            } catch (e) {
                alert('Error: ' + e.message);
            }
        }

        async function restartHotspot() {
            const t = i18n[currentLang] || i18n.ja;
            if (!confirm(t.confirmRestart)) return;
            await fetch('/api/admin/hotspot/start', { method: 'POST' });
            setTimeout(() => loadAdminInfo(true), 2000);
        }

        async function stopHotspot() {
            const t = i18n[currentLang] || i18n.ja;
            if (!confirm(t.confirmStop)) return;
            await fetch('/api/admin/hotspot/stop', { method: 'POST' });
            loadAdminInfo(true);
        }

        async function exitServer() {
            const t = i18n[currentLang] || i18n.ja;
            if (!confirm(t.confirmShutdown)) return;
            try {
                await fetch('/exit', { method: 'POST' });
            } catch (e) {}

            document.body.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;color:var(--text-primary);background:var(--bg-page);padding:24px;">
                    <h2 style="font-size:22px;font-weight:700;margin-bottom:8px;">${t.shutdownTitle}</h2>
                    <p style="color:var(--text-secondary);font-size:14px;">${t.shutdownSub}</p>
                </div>
            `;
            window.close();
        }

        loadAdminInfo();
