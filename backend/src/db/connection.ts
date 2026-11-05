import { Pool } from 'pg';
import sqlite3 from 'sqlite3';
import { DATABASE_URL, SQLITE_DB_PATH } from '../config';

let pgPool: Pool | null = null;
let sqliteDb: sqlite3.Database | null = null;
let usingPostgres = false;

export async function initDatabase(): Promise<void> {
  // Try connecting to PostgreSQL
  try {
    const pool = new Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
    });

    const client = await pool.connect();
    client.release();
    pgPool = pool;
    usingPostgres = true;
    console.log('✅ Connected to PostgreSQL database at 172.16.3.100');
    return;
  } catch (err: any) {
    console.warn('⚠️ Could not connect to PostgreSQL:', err.message || err);
    console.log('🔄 Falling back to SQLite database at:', SQLITE_DB_PATH);
  }

  // Fallback to SQLite
  return new Promise((resolve, reject) => {
    sqliteDb = new sqlite3.Database(SQLITE_DB_PATH, (err) => {
      if (err) {
        console.error('❌ Failed to open SQLite database:', err);
        reject(err);
      } else {
        console.log('✅ Connected to SQLite database');
        usingPostgres = false;
        resolve();
      }
    });
  });
}

export function isUsingPostgres(): boolean {
  return usingPostgres;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (usingPostgres && pgPool) {
    try {
      // Convert ? placeholders to $1, $2, etc. for PostgreSQL
      let paramIndex = 1;
      const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
      const res = await pgPool.query(pgSql, params);
      return res.rows as T[];
    } catch (e) {
      console.error('PostgreSQL query error, attempting SQLite fallback...', e);
      if (sqliteDb) {
        return querySqlite<T>(sql, params);
      }
      throw e;
    }
  } else if (sqliteDb) {
    return querySqlite<T>(sql, params);
  } else {
    throw new Error('Database not initialized');
  }
}

function querySqlite<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    if (!sqliteDb) return reject(new Error('SQLite DB is null'));
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    } else {
      sqliteDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve([{ lastID: this.lastID, changes: this.changes } as unknown as T]);
      });
    }
  });
}

