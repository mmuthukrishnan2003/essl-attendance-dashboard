import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { PORT } from './config';
import { initDatabase } from './db/connection';
import { ensureDefaultUsers } from './services/authService';
import { initLiveWatcher } from './services/liveSyncService';

import authRoutes from './routes/authRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import employeeRoutes from './routes/employeeRoutes';
import shiftRoutes from './routes/shiftRoutes';
import deviceRoutes from './routes/deviceRoutes';
import settingRoutes from './routes/settingRoutes';

const app = express();

// Middlewares
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/settings', settingRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve frontend Angular production build if built
const candidateDistDirs = [
  path.resolve(__dirname, '../../frontend/dist/frontend/browser'),
  path.resolve(__dirname, '../../frontend/dist/frontend'),
  path.resolve(__dirname, '../public'),
];

let staticDir: string | null = null;
for (const dir of candidateDistDirs) {
  if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'index.html'))) {
    staticDir = dir;
    break;
  }
}

if (staticDir) {
  console.log(`📂 Serving static frontend assets from: ${staticDir}`);
  app.use(express.static(staticDir));
  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(staticDir!, 'index.html'));
    }
  });
}

async function startServer() {
  try {
    await initDatabase();
    await ensureDefaultUsers();
    await initLiveWatcher();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Centizen eSSL Attendance Server (Node + Express) running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

export { app, startServer };

if (require.main === module) {
  startServer();
}
