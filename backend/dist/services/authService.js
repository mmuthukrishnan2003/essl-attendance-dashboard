"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSessions = loadSessions;
exports.saveSessions = saveSessions;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.createSession = createSession;
exports.validateSession = validateSession;
exports.deleteSession = deleteSession;
exports.ensureDefaultUsers = ensureDefaultUsers;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
const connection_1 = require("../db/connection");
const activeSessions = new Map();
function loadSessions() {
    try {
        if (fs_1.default.existsSync(config_1.SESSIONS_FILE)) {
            const raw = fs_1.default.readFileSync(config_1.SESSIONS_FILE, 'utf-8');
            const data = JSON.parse(raw);
            const now = Date.now();
            for (const [token, sess] of Object.entries(data)) {
                if (sess.expiresAt > now) {
                    activeSessions.set(token, sess);
                }
            }
        }
    }
    catch (err) {
        console.error('Failed to load sessions from file:', err);
    }
}
function saveSessions() {
    try {
        const data = {};
        for (const [token, sess] of activeSessions.entries()) {
            data[token] = sess;
        }
        fs_1.default.writeFileSync(config_1.SESSIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('Failed to save sessions to file:', err);
    }
}
function hashPassword(password, salt) {
    const chosenSalt = salt || crypto_1.default.randomBytes(16).toString('hex');
    const hash = crypto_1.default.createHash('sha256').update(chosenSalt + password, 'utf-8').digest('hex');
    return { hash, salt: chosenSalt };
}
function verifyPassword(password, storedHash, salt) {
    if (!storedHash)
        return false;
    const hash = crypto_1.default.createHash('sha256').update((salt || '') + password, 'utf-8').digest('hex');
    if (hash === storedHash)
        return true;
    if (password === storedHash)
        return true;
    return false;
}
function createSession(user, remember = true) {
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const durationMs = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const expiresAt = Date.now() + durationMs;
    const session = {
        token,
        user,
        expiresAt
    };
    activeSessions.set(token, session);
    saveSessions();
    return token;
}
function validateSession(token) {
    if (!token)
        return null;
    const session = activeSessions.get(token);
    if (!session)
        return null;
    if (session.expiresAt < Date.now()) {
        activeSessions.delete(token);
        saveSessions();
        return null;
    }
    return session;
}
function deleteSession(token) {
    if (activeSessions.has(token)) {
        activeSessions.delete(token);
        saveSessions();
    }
}
async function ensureDefaultUsers() {
    try {
        // 1. Check HR user
        const hrRows = await (0, connection_1.query)('SELECT * FROM users WHERE username = ?', ['hr']);
        if (hrRows.length === 0) {
            const { hash, salt } = hashPassword('hr');
            await (0, connection_1.query)('INSERT INTO users (username, password_hash, salt, full_name, email, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)', ['hr', hash, salt, 'Centizen Administrator', 'hr@centizen.com', 'Administrator', 1]);
            console.log('✅ Created default user: hr / hr');
        }
        else {
            const hr = hrRows[0];
            if (!verifyPassword('hr', hr.password_hash, hr.salt || '')) {
                const { hash, salt } = hashPassword('hr');
                await (0, connection_1.query)('UPDATE users SET password_hash = ?, salt = ?, full_name = ?, role = ? WHERE username = ?', [hash, salt, 'Centizen Administrator', 'Administrator', 'hr']);
                console.log('✅ Reset hr password to default');
            }
        }
        // 2. Check admin user
        const adminRows = await (0, connection_1.query)('SELECT * FROM users WHERE username = ?', ['admin']);
        if (adminRows.length === 0) {
            const { hash, salt } = hashPassword('admin');
            await (0, connection_1.query)('INSERT INTO users (username, password_hash, salt, full_name, email, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)', ['admin', hash, salt, 'Centizen Administrator', 'admin@centizen.com', 'Administrator', 1]);
            console.log('✅ Created fallback user: admin / admin');
        }
    }
    catch (err) {
        console.warn('Notice: Could not check default users in DB (table might not exist yet):', err);
    }
}
// Load sessions upon module initialization
loadSessions();
