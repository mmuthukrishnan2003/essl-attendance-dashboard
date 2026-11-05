import { Response } from 'express';
import { query } from '../db/connection';

interface SseClient {
  id: string;
  res: Response;
}

const clients: Map<string, SseClient> = new Map();
let lastSyncTimestamp: string = new Date().toISOString();
let lastPunchId: number = 0;
let pollTimer: NodeJS.Timeout | null = null;

export function addSseClient(id: string, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`);

  clients.set(id, { id, res });
  console.log(`📡 SSE client connected: ${id}. Active clients: ${clients.size}`);

  res.on('close', () => {
    clients.delete(id);
    console.log(`📡 SSE client disconnected: ${id}. Active clients: ${clients.size}`);
  });
}

export function broadcastMessage(data: any) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients.values()) {
    try {
      client.res.write(payload);
    } catch (err) {
      clients.delete(client.id);
    }
  }
}

export async function initLiveWatcher() {
  try {
    const maxRow = await query('SELECT MAX(id) as max_id FROM attendance_punches');
    if (maxRow && maxRow[0] && maxRow[0].max_id) {
      lastPunchId = Number(maxRow[0].max_id);
    }
  } catch (err) {
    console.warn('Could not initialize last punch ID:', err);
  }

  // Poll database every 1 second for newly registered punches
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      if (clients.size === 0) return;

      const newPunches = await query(
        'SELECT * FROM attendance_punches WHERE id > ? ORDER BY id ASC LIMIT 50',
        [lastPunchId]
      );

      if (newPunches && newPunches.length > 0) {
        for (const p of newPunches) {
          if (p.id > lastPunchId) {
            lastPunchId = p.id;
          }
        }
        lastSyncTimestamp = new Date().toISOString();
        broadcastMessage({
          type: 'new_punches',
          count: newPunches.length,
          latest: newPunches[newPunches.length - 1],
          timestamp: lastSyncTimestamp,
        });
      }
    } catch {
      // Ignore polling errors
    }
  }, 1000);
}

export function getLiveStatus() {
  return {
    status: 'connected',
    connected_clients: clients.size,
    last_sync: lastSyncTimestamp,
    last_punch_id: lastPunchId,
  };
}

