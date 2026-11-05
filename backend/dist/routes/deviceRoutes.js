"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const config_1 = require("../config");
const deviceSyncService_1 = require("../services/deviceSyncService");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const rows = await (0, connection_1.query)('SELECT * FROM devices ORDER BY id ASC');
        if (rows.length === 0) {
            // Seed default 4 devices if none in DB
            for (const d of config_1.DEVICES) {
                await (0, connection_1.query)(`INSERT INTO devices (id, ip_address, port, device_name, device_model, attendance_type, is_active, last_status)
           VALUES (?, ?, ?, ?, 'eSSL F18 + F12', 'BOTH', 1, 'ONLINE')`, [d.id, d.ip, d.port, d.name]);
            }
            const seeded = await (0, connection_1.query)('SELECT * FROM devices ORDER BY id ASC');
            return res.json(seeded);
        }
        return res.json(rows);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.post('/sync', async (req, res) => {
    try {
        const results = await (0, deviceSyncService_1.syncAllDevices)();
        return res.json({
            success: true,
            message: 'Device synchronization completed across 4 eSSL terminals',
            timestamp: new Date().toISOString(),
            results,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
