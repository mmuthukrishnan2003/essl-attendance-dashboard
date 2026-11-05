"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const authService_1 = require("../services/authService");
const router = (0, express_1.Router)();
router.post('/login', async (req, res) => {
    try {
        const { username, password, remember = true } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        const cleanUser = username.trim().toLowerCase();
        // Query user in DB
        const rows = await (0, connection_1.query)('SELECT * FROM users WHERE LOWER(username) = ?', [cleanUser]);
        let matchedUser = null;
        if (rows.length > 0) {
            const u = rows[0];
            const valid = (0, authService_1.verifyPassword)(password, u.password_hash, u.salt || '');
            if (valid) {
                matchedUser = u;
            }
        }
        // Direct fallback for hr / hr or admin / admin if DB doesn't have it yet
        if (!matchedUser) {
            if ((cleanUser === 'hr' && password === 'hr') || (cleanUser === 'admin' && password === 'admin')) {
                matchedUser = {
                    id: cleanUser === 'hr' ? 1 : 2,
                    username: cleanUser,
                    full_name: 'Centizen Administrator',
                    email: `${cleanUser}@centizen.com`,
                    role: 'Administrator',
                    is_active: 1,
                };
            }
        }
        if (!matchedUser) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const userPayload = {
            id: matchedUser.id,
            username: matchedUser.username,
            fullName: matchedUser.full_name || 'Administrator',
            email: matchedUser.email || '',
            role: matchedUser.role || 'Administrator',
        };
        const token = (0, authService_1.createSession)(userPayload, Boolean(remember));
        const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        res.cookie('session_token', token, {
            maxAge,
            httpOnly: false,
            sameSite: 'lax',
            path: '/',
        });
        return res.json({
            success: true,
            token,
            user: userPayload,
        });
    }
    catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/logout', (req, res) => {
    const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
    if (token) {
        (0, authService_1.deleteSession)(token);
    }
    res.clearCookie('session_token', { path: '/' });
    return res.json({ success: true });
});
router.get('/me', (req, res) => {
    const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
    const session = (0, authService_1.validateSession)(token);
    if (!session) {
        return res.status(401).json({ authenticated: false });
    }
    return res.json({
        authenticated: true,
        user: session.user,
    });
});
exports.default = router;
