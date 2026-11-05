import ZKLib from 'node-zklib';
import { DEVICES } from '../config';
import { query } from '../db/connection';
import { broadcastMessage } from './liveSyncService';

interface SyncResult {
  ip: string;
  name: string;
  status: 'SUCCESS' | 'OFFLINE' | 'ERROR';
  newPunches: number;
  error?: string;
}

export async function syncSingleDevice(ip: string, port: number = 4370, deviceName: string = ''): Promise<SyncResult> {
  const result: SyncResult = {
    ip,
    name: deviceName || ip,
    status: 'OFFLINE',
    newPunches: 0,
  };

  let zk: any = null;
  try {
    zk = new ZKLib(ip, port, 4000, 4000);
    await zk.createSocket();
    result.status = 'SUCCESS';

    const logs = await zk.getAttendances();
    if (logs && logs.data && Array.isArray(logs.data)) {
      let inserted = 0;
      for (const log of logs.data) {
        const empCode = String(log.deviceUserId || log.userId || '').trim();
        const recordTime = log.recordTime;
        if (!empCode || !recordTime) continue;

        const tsStr = new Date(recordTime).toISOString().replace('T', ' ').substring(0, 19);

        try {
          const existing = await query(
            'SELECT id FROM attendance_punches WHERE emp_code = ? AND timestamp = ?',
            [empCode, tsStr]
          );

          if (existing.length === 0) {
            await query(
              'INSERT INTO attendance_punches (emp_code, timestamp, device_ip, punch_type, verify_type) VALUES (?, ?, ?, 0, 1)',
              [empCode, tsStr, ip]
            );
            inserted++;
          }
        } catch {
          // ignore duplicate constraint
        }
      }

      result.newPunches = inserted;
      if (inserted > 0) {
        broadcastMessage({
          type: 'new_punches',
          count: inserted,
          device: deviceName,
          timestamp: new Date().toISOString(),
        });
      }
    }

    try {
      await zk.disconnect();
    } catch {}

    // Update devices table
    await query(
      'UPDATE devices SET last_status = ?, last_sync_time = ?, last_error = NULL WHERE ip_address = ?',
      ['ONLINE', new Date().toISOString().replace('T', ' ').substring(0, 19), ip]
    );

    return result;
  } catch (err: any) {
    result.status = 'ERROR';
    result.error = err.message || String(err);

    try {
      if (zk) await zk.disconnect();
    } catch {}

    try {
      await query(
        'UPDATE devices SET last_status = ?, last_error = ? WHERE ip_address = ?',
        ['OFFLINE', result.error, ip]
      );
    } catch {}

    return result;
  }
}

export async function syncAllDevices(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const d of DEVICES) {
    const res = await syncSingleDevice(d.ip, d.port, d.name);
    results.push(res);
  }
  return results;
}

let syncInterval: NodeJS.Timeout | null = null;

export function startBackgroundDeviceSync(intervalMs: number = 10000) {
  if (syncInterval) clearInterval(syncInterval);
  // Initial sync
  setTimeout(() => syncAllDevices().catch(() => {}), 2000);
  // Periodic sync
  syncInterval = setInterval(() => {
    syncAllDevices().catch(() => {});
  }, intervalMs);
}
