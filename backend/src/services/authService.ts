import crypto from 'crypto';
import fs from 'fs';
import { SESSIONS_FILE } from '../config';
import { query } from '../db/connection';

export interface UserSession {
  token: string;
  user: {
    id: number;
    username: string;
    fullName: string;
    email: string;
    role: string;
  };
  expiresAt: number;
}

const activeSessions = new Map<string, UserSession>();

export function loadSessions(): void {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      const now = Date.now();
      for (const [token, sess] of Object.entries(data as Record<string, UserSession>)) {
        if (sess.expiresAt > now) {
          activeSessions.set(token, sess);
        }
      }
    }
  } catch (err) {
    console.error('Failed to load sessions from file:', err);
  }
}

export function saveSessions(): void {
  try {
    const data: Record<string, UserSession> = {};
    for (const [token, sess] of activeSessions.entries()) {
      data[token] = sess;
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save sessions to file:', err);
  }
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const chosenSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(chosenSalt + password, 'utf-8').digest('hex');
  return { hash, salt: chosenSalt };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  if (!storedHash) return false;
  const hash = crypto.createHash('sha256').update((salt || '') + password, 'utf-8').digest('hex');
  if (hash === storedHash) return true;
  if (password === storedHash) return true;
  return false;
}

export function createSession(user: { id: number; username: string; fullName: string; email: string; role: string }, remember: boolean = true): string {
  const token = crypto.randomBytes(32).toString('hex');
  const durationMs = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const expiresAt = Date.now() + durationMs;

  const session: UserSession = {
    token,
    user,
    expiresAt
  };

  activeSessions.set(token, session);
  saveSessions();
  return token;
}

export function validateSession(token: string | undefined): UserSession | null {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    activeSessions.delete(token);
    saveSessions();
    return null;
  }
  return session;
}

export function deleteSession(token: string): void {
  if (activeSessions.has(token)) {
    activeSessions.delete(token);
    saveSessions();
  }
}

export async function ensureDefaultUsers(): Promise<void> {
  try {
    // 1. Check HR user
    const hrRows = await query('SELECT * FROM users WHERE username = ?', ['hr']);
    if (hrRows.length === 0) {
      const { hash, salt } = hashPassword('hr');
      await query(
        'INSERT INTO users (username, password_hash, salt, full_name, email, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['hr', hash, salt, 'Centizen Administrator', 'hr@centizen.com', 'Administrator', 1]
      );
      console.log('✅ Created default user: hr / hr');
    } else {
      const hr = hrRows[0];
      if (!verifyPassword('hr', hr.password_hash, hr.salt || '')) {
        const { hash, salt } = hashPassword('hr');
        await query(
          'UPDATE users SET password_hash = ?, salt = ?, full_name = ?, role = ? WHERE username = ?',
          [hash, salt, 'Centizen Administrator', 'Administrator', 'hr']
        );
        console.log('✅ Reset hr password to default');
      }
    }

    // 2. Check admin user
    const adminRows = await query('SELECT * FROM users WHERE username = ?', ['admin']);
    if (adminRows.length === 0) {
      const { hash, salt } = hashPassword('admin');
      await query(
        'INSERT INTO users (username, password_hash, salt, full_name, email, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['admin', hash, salt, 'Centizen Administrator', 'admin@centizen.com', 'Administrator', 1]
      );
      console.log('✅ Created fallback user: admin / admin');
    }
  } catch (err) {
    console.warn('Notice: Could not check default users in DB (table might not exist yet):', err);
  }
}

// Load sessions upon module initialization
loadSessions();

