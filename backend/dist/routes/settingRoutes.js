"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const rows = await (0, connection_1.query)('SELECT * FROM settings');
        const settingsMap = {};
        for (const r of rows) {
            settingsMap[r.key] = r.value;
        }
        return res.json(settingsMap);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key) {
            return res.status(400).json({ error: 'Key is required' });
        }
        const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value || '');
        const existing = await (0, connection_1.query)('SELECT key FROM settings WHERE key = ?', [key]);
        if (existing.length === 0) {
            await (0, connection_1.query)('INSERT INTO settings (key, value) VALUES (?, ?)', [key, valStr]);
        }
        else {
            await (0, connection_1.query)('UPDATE settings SET value = ? WHERE key = ?', [valStr, key]);
        }
        return res.json({ success: true, key, value: valStr });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
