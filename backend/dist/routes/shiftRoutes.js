"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const rows = await (0, connection_1.query)('SELECT * FROM shifts ORDER BY id ASC');
        return res.json(rows);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const { name, code, start_time, end_time, is_night_shift, description } = req.body;
        if (!name || !code) {
            return res.status(400).json({ error: 'Name and code are required' });
        }
        await (0, connection_1.query)(`INSERT INTO shifts (name, code, start_time, end_time, is_night_shift, description, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`, [name, code, start_time || '09:00', end_time || '18:00', is_night_shift ? 1 : 0, description || '']);
        return res.json({ success: true, message: 'Shift created successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { name, code, start_time, end_time, is_night_shift, description, is_active } = req.body;
        await (0, connection_1.query)(`UPDATE shifts SET name = ?, code = ?, start_time = ?, end_time = ?, is_night_shift = ?, description = ?, is_active = ?
       WHERE id = ?`, [name, code, start_time, end_time, is_night_shift ? 1 : 0, description, is_active !== undefined ? is_active : 1, id]);
        return res.json({ success: true, message: 'Shift updated successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await (0, connection_1.query)('DELETE FROM shifts WHERE id = ?', [id]);
        return res.json({ success: true, message: 'Shift deleted successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
