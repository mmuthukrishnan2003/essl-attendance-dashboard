import { Router, Request, Response } from 'express';
import { query } from '../db/connection';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const rows = await query('SELECT * FROM settings');
    const settingsMap: Record<string, string> = {};
    for (const r of rows) {
      settingsMap[r.key] = r.value;
    }
    return res.json(settingsMap);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'Key is required' });
    }

    const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value || '');
    const existing = await query('SELECT key FROM settings WHERE key = ?', [key]);

    if (existing.length === 0) {
      await query('INSERT INTO settings (key, value) VALUES (?, ?)', [key, valStr]);
    } else {
      await query('UPDATE settings SET value = ? WHERE key = ?', [valStr, key]);
    }

    return res.json({ success: true, key, value: valStr });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

