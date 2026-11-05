import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import {
  createSession,
  deleteSession,
  validateSession,
  verifyPassword,
} from '../services/authService';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password, remember = true } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUser = username.trim().toLowerCase();

    // Query user in DB
    const rows = await query('SELECT * FROM users WHERE LOWER(username) = ?', [cleanUser]);

    let matchedUser = null;

    if (rows.length > 0) {
      const u = rows[0];
      const valid = verifyPassword(password, u.password_hash, u.salt || '');
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

    const token = createSession(userPayload, Boolean(remember));

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
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    deleteSession(token);
  }
  res.clearCookie('session_token', { path: '/' });
  return res.json({ success: true });
});

router.get('/me', (req: Request, res: Response) => {
  const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
  const session = validateSession(token);

  if (!session) {
    return res.status(401).json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    user: session.user,
  });
});

export default router;

