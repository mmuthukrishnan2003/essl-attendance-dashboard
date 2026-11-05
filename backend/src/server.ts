import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { PORT, ALT_PORT, DEVICES } from './config';
import { initDatabase } from './db/connection';
import { ensureDefaultUsers } from './services/authService';
import { initLiveWatcher } from './services/liveSyncService';
import { startBackgroundDeviceSync } from './services/deviceSyncService';

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
  res.json({ status: 'ok', stack: 'Node.js + Express + Angular 20', time: new Date().toISOString() });
});

// Serve frontend Angular production build
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
  console.log(`📂 Serving static Angular frontend from: ${staticDir}`);
  app.use(express.static(staticDir));
  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(staticDir!, 'index.html'));
    }
  });
}

async function startServer() {
  try {
    console.log('='.repeat(75));
    console.log('  Centizen eSSL Biometric Attendance Management System (Node + Angular)');
    console.log('  Primary Portal URL : http://0.0.0.0:' + PORT);
    console.log('  Alternative URL    : http://0.0.0.0:' + ALT_PORT);
    console.log('  Connecting to 4 eSSL Devices: ' + DEVICES.map(d => d.ip).join(', '));
    console.log('='.repeat(75));

    await initDatabase();
    await ensureDefaultUsers();
    await initLiveWatcher();
    startBackgroundDeviceSync();

    // Primary Server
    const server1 = http.createServer(app);
    server1.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 [Node + Angular] Primary server active on http://0.0.0.0:${PORT}`);
    });

    // Optional Port 80
    if (ALT_PORT && ALT_PORT !== PORT) {
      try {
        const server80 = http.createServer(app);
        server80.listen(ALT_PORT, '0.0.0.0', () => {
          console.log(`🚀 [Node + Angular] HTTP alternative active on http://0.0.0.0:${ALT_PORT}`);
        });
        server80.on('error', (err: any) => {
          console.log(`ℹ️ Note on Port ${ALT_PORT}: ${err.message || err} (Requires root/admin permissions)`);
        });
      } catch (e: any) {
        console.log(`ℹ️ Note on Port ${ALT_PORT}: ${e.message || e}`);
      }
    }
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

export { app, startServer };

if (require.main === module) {
  startServer();
}
