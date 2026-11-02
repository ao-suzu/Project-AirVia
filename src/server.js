const express = require('express');
const path = require('path');
const { exec } = require('child_process');

const HotspotManager = require('./core/hotspot');
const NetworkManager = require('./core/network');

const photosRouter = require('../apps/photos/router');
const bingoModule = require('../apps/bingo/router');

const PORT = 3000;
const SSID = 'AirVia_Local';
const PASSWORD = 'airviapass123';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Core instances
const hotspotManager = new HotspotManager({ ssid: SSID, password: PASSWORD, port: PORT });
const networkManager = new NetworkManager(PORT);

// Uploads static directory (immutable cache for uploaded media)
app.use('/uploads/photos', express.static(path.join(__dirname, '../uploads/photos'), {
    maxAge: '1d',
    immutable: true
}));

// App Routers
app.use('/apps/photos', photosRouter);
app.use('/apps/bingo', bingoModule.router);

// BINGO backward compatibility routes (for existing index.html and checker)
app.get('/api/bingo-numbers', bingoModule.apiNumbersHandler);
app.post('/save-number', bingoModule.saveNumberHandler);
app.post('/reset-json', bingoModule.resetHandler);

// Admin Dashboard static files
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// Admin API
app.get('/api/admin/info', async (req, res) => {
    // キャッシュを活用して高速応答（?force=true の場合のみPowerShellを同期実行）
    const force = req.query.force === 'true';
    await hotspotManager.getCurrentConfig(force);
    const currentSsid = hotspotManager.ssid;
    const currentPass = hotspotManager.password;

    const networkInfo = networkManager.getNetworkInfo(true);

    // QRコード生成（キャッシュ利用 + 並列実行で0ms応答）
    const [wifiQr, portalQr, photosQr, bingoCheckerQr] = await Promise.all([
        networkManager.generateWifiQrCode(currentSsid, currentPass),
        networkManager.generateUrlQrCode(networkInfo.portalUrl),
        networkManager.generateUrlQrCode(`http://${networkInfo.primaryIp}:${PORT}/apps/photos`),
        networkManager.generateUrlQrCode(`http://${networkInfo.primaryIp}:${PORT}/apps/bingo/bingo_checker.html`)
    ]);

    res.json({
        success: true,
        ssid: currentSsid,
        password: currentPass,
        status: hotspotManager.status,
        network: networkInfo,
        qrCodes: {
            wifi: wifiQr,
            portal: portalQr,
            photos: photosQr,
            bingoChecker: bingoCheckerQr
        },
        urls: {
            portal: networkInfo.portalUrl,
            photos: `http://${networkInfo.primaryIp}:${PORT}/apps/photos`,
            bingoChecker: `http://${networkInfo.primaryIp}:${PORT}/apps/bingo/bingo_checker.html`
        }
    });
});

app.post('/api/admin/hotspot/configure', async (req, res) => {
    const { ssid, password } = req.body;
    if (!ssid || !password) {
        return res.status(400).json({ success: false, message: 'SSIDとパスワードが必要です' });
    }
    const success = await hotspotManager.configureHotspot(ssid, password);
    res.json({ success, ssid: hotspotManager.ssid, password: hotspotManager.password });
});

app.post('/api/admin/hotspot/start', async (req, res) => {
    await hotspotManager.startHotspot();
    res.json({ success: true, status: hotspotManager.status });
});

app.post('/api/admin/hotspot/stop', async (req, res) => {
    await hotspotManager.stopHotspot();
    res.json({ success: true, status: hotspotManager.status });
});

// Server shutdown API (stops hotspot and server process)
app.post('/exit', async (req, res) => {
    res.json({ success: true, message: 'Shutting down server and hotspot...' });
    console.log('\n🛑 Shutdown requested from UI. Stopping hotspot and server...');
    try {
        await hotspotManager.stopHotspot();
    } catch (err) {
        console.error('Error stopping hotspot:', err.message);
    }
    setTimeout(() => {
        console.log('Server process exited.');
        process.exit(0);
    }, 800);
});

// Explicit participant portal routes
app.get(['/', '/portal', '/index.html'], (req, res) => {
    const portalFile = path.resolve(__dirname, '../public/portal/index.html');
    res.sendFile(portalFile);
});

// Participant Portal static files
app.use(express.static(path.resolve(__dirname, '../public/portal')));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[Server Error]:', err);
    res.status(500).send(`<h3>Server Error:</h3><pre>${err.message}</pre>`);
});

// Server Start
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n========================================`);
    console.log(`🚀 Project-AirVia Server running on port ${PORT}`);
    console.log(`💻 Admin Dashboard: http://localhost:${PORT}/admin`);

    // ホットスポットとファイアウォールの初期化
    try {
        console.log(`📡 Initializing Windows Mobile Hotspot (${SSID})...`);
        await hotspotManager.initAndStart();
    } catch (err) {
        console.error('Hotspot init error:', err.message);
    }

    // IPアドレスとURLの案内
    setTimeout(() => {
        const netInfo = networkManager.getNetworkInfo(true);
        console.log(`📱 Portal URL: ${netInfo.portalUrl}`);
        console.log(`📶 Hotspot SSID: ${SSID} | Password: ${PASSWORD}`);
        console.log(`========================================\n`);

        // 管理画面を自動で開く
        exec(`start http://localhost:${PORT}/admin`, { windowsHide: true });
    }, 2000);
});

