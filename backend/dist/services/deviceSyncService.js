"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncSingleDevice = syncSingleDevice;
exports.syncAllDevices = syncAllDevices;
exports.startBackgroundDeviceSync = startBackgroundDeviceSync;
const node_zklib_1 = __importDefault(require("node-zklib"));
const config_1 = require("../config");
const connection_1 = require("../db/connection");
const liveSyncService_1 = require("./liveSyncService");
async function syncSingleDevice(ip, port = 4370, deviceName = '') {
    const result = {
        ip,
        name: deviceName || ip,
        status: 'OFFLINE',
        newPunches: 0,
    };
    let zk = null;
    try {
        zk = new node_zklib_1.default(ip, port, 4000, 4000);
        await zk.createSocket();
        result.status = 'SUCCESS';
        const logs = await zk.getAttendances();
        if (logs && logs.data && Array.isArray(logs.data)) {
            let inserted = 0;
            for (const log of logs.data) {
                const empCode = String(log.deviceUserId || log.userId || '').trim();
                const recordTime = log.recordTime;
                if (!empCode || !recordTime)
                    continue;
                const tsStr = new Date(recordTime).toISOString().replace('T', ' ').substring(0, 19);
                try {
                    const existing = await (0, connection_1.query)('SELECT id FROM attendance_punches WHERE emp_code = ? AND timestamp = ?', [empCode, tsStr]);
                    if (existing.length === 0) {
                        await (0, connection_1.query)('INSERT INTO attendance_punches (emp_code, timestamp, device_ip, punch_type, verify_type) VALUES (?, ?, ?, 0, 1)', [empCode, tsStr, ip]);
                        inserted++;
                    }
                }
                catch {
                    // ignore duplicate constraint
                }
            }
            result.newPunches = inserted;
            if (inserted > 0) {
                (0, liveSyncService_1.broadcastMessage)({
                    type: 'new_punches',
                    count: inserted,
                    device: deviceName,
                    timestamp: new Date().toISOString(),
                });
            }
        }
        try {
            await zk.disconnect();
        }
        catch { }
        // Update devices table
        await (0, connection_1.query)('UPDATE devices SET last_status = ?, last_sync_time = ?, last_error = NULL WHERE ip_address = ?', ['ONLINE', new Date().toISOString().replace('T', ' ').substring(0, 19), ip]);
        return result;
    }
    catch (err) {
        result.status = 'ERROR';
        result.error = err.message || String(err);
        try {
            if (zk)
                await zk.disconnect();
        }
        catch { }
        try {
            await (0, connection_1.query)('UPDATE devices SET last_status = ?, last_error = ? WHERE ip_address = ?', ['OFFLINE', result.error, ip]);
        }
        catch { }
        return result;
    }
}
async function syncAllDevices() {
    const results = [];
    for (const d of config_1.DEVICES) {
        const res = await syncSingleDevice(d.ip, d.port, d.name);
        results.push(res);
    }
    return results;
}
let syncInterval = null;
function startBackgroundDeviceSync(intervalMs = 10000) {
    if (syncInterval)
        clearInterval(syncInterval);
    // Initial sync
    setTimeout(() => syncAllDevices().catch(() => { }), 2000);
    // Periodic sync
    syncInterval = setInterval(() => {
        syncAllDevices().catch(() => { });
    }, intervalMs);
}
