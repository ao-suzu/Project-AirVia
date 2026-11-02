const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const uploadDir = path.join(__dirname, '../../uploads/files');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multerストレージ設定（あらゆるファイル形式に対応、日本語文字化け防止）
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Multerのlatin1文字化け対策
        let originalName = file.originalname;
        try {
            originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        } catch (e) { }

        const ext = path.extname(originalName);
        const base = path.basename(originalName, ext).replace(/[\\/:*?"<>|]/g, '_');
        const filename = `${Date.now()}_${base}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 1ファイル500MBまで
});

let cachedFileList = null;
let lastCacheTime = 0;
const FILE_CACHE_TTL = 3000; // 3秒間インメモリキャッシュ

async function getFileList() {
    const now = Date.now();
    if (cachedFileList && (now - lastCacheTime < FILE_CACHE_TTL)) {
        return cachedFileList;
    }

    const files = await fs.promises.readdir(uploadDir);
    const validFiles = files.filter(f => !f.startsWith('.') && f !== '.gitkeep');
    const fileList = await Promise.all(validFiles.map(async (filename) => {
        const filePath = path.join(uploadDir, filename);
        const stats = await fs.promises.stat(filePath);

        // 表示用ファイル名（先頭のタイムスタンププレフィックス "1793615616472_" を除去）
        const match = filename.match(/^\d+_(.+)$/);
        const displayName = match ? match[1] : filename;
        const ext = path.extname(displayName).toLowerCase().replace('.', '');

        return {
            filename,
            displayName,
            url: `/uploads/files/${encodeURIComponent(filename)}`,
            downloadUrl: `/apps/files/api/download/${encodeURIComponent(filename)}`,
            size: stats.size,
            ext: ext || 'file',
            createdAt: stats.mtime
        };
    }));

    fileList.sort((a, b) => b.createdAt - a.createdAt);
    cachedFileList = fileList;
    lastCacheTime = now;
    return fileList;
}

// ファイル一覧API
router.get('/api/list', async (req, res) => {
    try {
        const list = await getFileList();
        res.json({ success: true, count: list.length, files: list });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ファイルアップロードAPI (複数可、上限20ファイル)
router.post('/api/upload', upload.array('files', 20), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: 'ファイルが選択されていません' });
    }
    // キャッシュ無効化
    cachedFileList = null;

    const uploaded = req.files.map(f => {
        let originalName = f.originalname;
        try {
            originalName = Buffer.from(f.originalname, 'latin1').toString('utf8');
        } catch (e) { }

        return {
            filename: f.filename,
            displayName: originalName,
            size: f.size
        };
    });

    res.json({
        success: true,
        message: `${uploaded.length} 件のファイルを共有しました`,
        files: uploaded
    });
});

// ファイル削除API
router.post('/api/delete', async (req, res) => {
    try {
        const { filename } = req.body;
        if (!filename) {
            return res.status(400).json({ success: false, message: 'ファイル名が指定されていません' });
        }

        const safeFilename = path.basename(filename);
        const filePath = path.join(uploadDir, safeFilename);

        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
            cachedFileList = null; // キャッシュ破棄
            return res.json({ success: true, message: 'ファイルを削除しました' });
        } else {
            return res.status(404).json({ success: false, message: 'ファイルが見つかりません' });
        }
    } catch (err) {
        console.error('[Files Delete Error]:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ファイルダウンロード用（元のファイル名で安全に保存させる）
router.get('/api/download/:filename', (req, res) => {
    const rawFilename = req.params.filename;
    // ディレクトリトラバーサル防止
    const safeFilename = path.basename(rawFilename);
    const filePath = path.join(uploadDir, safeFilename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }

    const match = safeFilename.match(/^\d+_(.+)$/);
    const originalName = match ? match[1] : safeFilename;

    res.download(filePath, originalName);
});

// 静的ページ配信
router.use('/', express.static(path.join(__dirname, 'public')));

module.exports = router;

