const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const dataFilePath = path.join(__dirname, 'bingo_numbers.json');

let bingoData = { calledNumbers: [], history: [] };

function loadData() {
    try {
        if (fs.existsSync(dataFilePath)) {
            bingoData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
        }
    } catch (e) {
        bingoData = { calledNumbers: [], history: [] };
        saveData();
    }
}

function saveData(callback) {
    fs.writeFile(dataFilePath, JSON.stringify(bingoData), () => {
        if (callback) callback();
    });
}

loadData();

// ハンドラ定義（ルート内と外部エクスポートで共有）
const apiNumbersHandler = (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.json(bingoData);
};

const saveNumberHandler = (req, res) => {
    const { number } = req.body;
    if (typeof number === 'number' && !bingoData.calledNumbers.includes(number)) {
        bingoData.calledNumbers.push(number);
        bingoData.history.push({ number, timestamp: new Date().toISOString() });
        saveData();
    }
    res.json({ success: true, calledNumbers: bingoData.calledNumbers });
};

const resetHandler = (req, res) => {
    bingoData = { calledNumbers: [], history: [] };
    saveData(() => {
        res.json({ success: true });
    });
};

// BINGO API Routes
router.get('/api/bingo-numbers', apiNumbersHandler);
router.post('/save-number', saveNumberHandler);
router.post('/reset-json', resetHandler);

// 静的ファイル提供
router.use('/', express.static(path.join(__dirname)));

module.exports = {
    router,
    getBingoData: () => bingoData,
    saveNumberHandler,
    resetHandler,
    apiNumbersHandler
};

