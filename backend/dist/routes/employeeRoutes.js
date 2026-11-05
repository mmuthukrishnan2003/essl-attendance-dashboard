"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const rows = await (0, connection_1.query)('SELECT * FROM employees ORDER BY LOWER(name) ASC');
        return res.json(rows);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const { emp_code, name, department, designation, email, phone, shift_code, shift_name, shift_start, shift_end } = req.body;
        if (!emp_code || !name) {
            return res.status(400).json({ error: 'emp_code and name are required' });
        }
        await (0, connection_1.query)(`INSERT INTO employees (emp_code, name, department, designation, email, phone, shift_code, shift_name, shift_start, shift_end, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, [emp_code, name, department || 'General', designation || 'Staff', email || '', phone || '', shift_code || 'SHIFT_9_6', shift_name || 'Standard Shift (09:00 AM - 06:00 PM)', shift_start || '09:00', shift_end || '18:00']);
        return res.json({ success: true, message: 'Employee added successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { name, department, designation, email, phone, shift_code, shift_name, shift_start, shift_end, is_active } = req.body;
        await (0, connection_1.query)(`UPDATE employees SET name = ?, department = ?, designation = ?, email = ?, phone = ?, shift_code = ?, shift_name = ?, shift_start = ?, shift_end = ?, is_active = ?
       WHERE id = ?`, [name, department, designation, email, phone, shift_code, shift_name, shift_start, shift_end, is_active !== undefined ? is_active : 1, id]);
        return res.json({ success: true, message: 'Employee updated successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await (0, connection_1.query)('DELETE FROM employees WHERE id = ?', [id]);
        return res.json({ success: true, message: 'Employee removed successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
