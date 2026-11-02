const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const uploadDir = path.join(__dirname, '../../uploads/photos');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multerストレージ設定（オリジナル拡張子を保持してユニーク名で保存）
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_');
        const filename = `${Date.now()}_${base}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 30 * 1024 * 1024 }, // 1ファイル30MBまで
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|heic|mp4|mov/;
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        if (allowedTypes.test(ext) || file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('対応していないファイル形式です (画像・動画のみ)'));
        }
    }
});

let cachedPhotoList = null;
let lastCacheTime = 0;
const PHOTO_CACHE_TTL = 3000; // 3秒間インメモリキャッシュ

async function getPhotoList() {
    const now = Date.now();
    if (cachedPhotoList && (now - lastCacheTime < PHOTO_CACHE_TTL)) {
        return cachedPhotoList;
    }

    const files = await fs.promises.readdir(uploadDir);
    const validFiles = files.filter(f => !f.startsWith('.'));
    const photoList = await Promise.all(validFiles.map(async (filename) => {
        const filePath = path.join(uploadDir, filename);
        const stats = await fs.promises.stat(filePath);
        return {
            filename,
            url: `/uploads/photos/${encodeURIComponent(filename)}`,
            size: stats.size,
            createdAt: stats.mtime
        };
    }));

    photoList.sort((a, b) => b.createdAt - a.createdAt);
    cachedPhotoList = photoList;
    lastCacheTime = now;
    return photoList;
}

// 写真一覧API
router.get('/api/list', async (req, res) => {
    try {
        const photoList = await getPhotoList();
        res.json({ success: true, count: photoList.length, photos: photoList });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 写真アップロードAPI (複数枚OK)
router.post('/api/upload', upload.array('photos', 20), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: 'ファイルが選択されていません' });
    }
    // アップロード成功時はキャッシュを即時無効化
    cachedPhotoList = null;

    const uploaded = req.files.map(f => ({
        filename: f.filename,
        url: `/uploads/photos/${encodeURIComponent(f.filename)}`,
        size: f.size
    }));
    res.json({ success: true, message: `${uploaded.length} 件アップロードしました`, files: uploaded });
});

// 静的ページ配信
router.use('/', express.static(path.join(__dirname, 'public')));

module.exports = router;

