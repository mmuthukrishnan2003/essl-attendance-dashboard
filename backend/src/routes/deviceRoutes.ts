import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { DEVICES } from '../config';
import { syncAllDevices } from '../services/deviceSyncService';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const rows = await query('SELECT * FROM devices ORDER BY id ASC');
    if (rows.length === 0) {
      // Seed default 4 devices if none in DB
      for (const d of DEVICES) {
        await query(
          `INSERT INTO devices (id, ip_address, port, device_name, device_model, attendance_type, is_active, last_status)
           VALUES (?, ?, ?, ?, 'eSSL F18 + F12', 'BOTH', 1, 'ONLINE')`,
          [d.id, d.ip, d.port, d.name]
        );
      }
      const seeded = await query('SELECT * FROM devices ORDER BY id ASC');
      return res.json(seeded);
    }
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/sync', async (req: Request, res: Response) => {
  try {
    const results = await syncAllDevices();
    return res.json({
      success: true,
      message: 'Device synchronization completed across 4 eSSL terminals',
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
