import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const PORT = parseInt(process.env.PORT || '8881', 10);
export const ALT_PORT = parseInt(process.env.ALT_PORT || '80', 10);

export const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://essl:essl@172.16.3.100:5432/essl_attendance?options=-csearch_path%3Dattendance';

export const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || 
  path.resolve(__dirname, '../../attendance.db');

export const SESSIONS_FILE = path.resolve(__dirname, '../../sessions.json');

export const DEVICES = [
  { id: 1, name: 'Door 1', ip: '172.16.0.44', port: 4370 },
  { id: 2, name: 'Door 2', ip: '172.16.0.20', port: 4370 },
  { id: 3, name: 'Door 3', ip: '172.16.0.5',  port: 4370 },
  { id: 4, name: 'Door 4', ip: '172.16.0.4',  port: 4370 },
];

export const OFFICE_START = '09:00:00';
export const OFFICE_END = '19:00:00';
export const LATE_CUTOFF = '09:05:00';
