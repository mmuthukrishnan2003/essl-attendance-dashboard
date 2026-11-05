"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.isUsingPostgres = isUsingPostgres;
exports.query = query;
const pg_1 = require("pg");
const sqlite3_1 = __importDefault(require("sqlite3"));
const config_1 = require("../config");
let pgPool = null;
let sqliteDb = null;
let usingPostgres = false;
async function initDatabase() {
    // Try connecting to PostgreSQL
    try {
        const pool = new pg_1.Pool({
            connectionString: config_1.DATABASE_URL,
            connectionTimeoutMillis: 3000,
            idleTimeoutMillis: 10000,
        });
        const client = await pool.connect();
        client.release();
        pgPool = pool;
        usingPostgres = true;
        console.log('✅ Connected to PostgreSQL database at 172.16.3.100');
        return;
    }
    catch (err) {
        console.warn('⚠️ Could not connect to PostgreSQL:', err.message || err);
        console.log('🔄 Falling back to SQLite database at:', config_1.SQLITE_DB_PATH);
    }
    // Fallback to SQLite
    return new Promise((resolve, reject) => {
        sqliteDb = new sqlite3_1.default.Database(config_1.SQLITE_DB_PATH, (err) => {
            if (err) {
                console.error('❌ Failed to open SQLite database:', err);
                reject(err);
            }
            else {
                console.log('✅ Connected to SQLite database');
                usingPostgres = false;
                resolve();
            }
        });
    });
}
function isUsingPostgres() {
    return usingPostgres;
}
async function query(sql, params = []) {
    if (usingPostgres && pgPool) {
        try {
            // Convert ? placeholders to $1, $2, etc. for PostgreSQL
            let paramIndex = 1;
            const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
            const res = await pgPool.query(pgSql, params);
            return res.rows;
        }
        catch (e) {
            console.error('PostgreSQL query error, attempting SQLite fallback...', e);
            if (sqliteDb) {
                return querySqlite(sql, params);
            }
            throw e;
        }
    }
    else if (sqliteDb) {
        return querySqlite(sql, params);
    }
    else {
        throw new Error('Database not initialized');
    }
}
function querySqlite(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (!sqliteDb)
            return reject(new Error('SQLite DB is null'));
        const trimmed = sql.trim().toUpperCase();
        if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
            sqliteDb.all(sql, params, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        }
        else {
            sqliteDb.run(sql, params, function (err) {
                if (err)
                    reject(err);
                else
                    resolve([{ lastID: this.lastID, changes: this.changes }]);
            });
        }
    });
}
