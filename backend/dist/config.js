"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LATE_CUTOFF = exports.OFFICE_END = exports.OFFICE_START = exports.DEVICES = exports.SESSIONS_FILE = exports.SQLITE_DB_PATH = exports.DATABASE_URL = exports.ALT_PORT = exports.PORT = void 0;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.PORT = parseInt(process.env.PORT || '8881', 10);
exports.ALT_PORT = parseInt(process.env.ALT_PORT || '80', 10);
exports.DATABASE_URL = process.env.DATABASE_URL ||
    'postgresql://essl:essl@172.16.3.100:5432/essl_attendance?options=-csearch_path%3Dattendance';
exports.SQLITE_DB_PATH = process.env.SQLITE_DB_PATH ||
    path_1.default.resolve(__dirname, '../../attendance.db');
exports.SESSIONS_FILE = path_1.default.resolve(__dirname, '../../sessions.json');
exports.DEVICES = [
    { id: 1, name: 'Door 1', ip: '172.16.0.44', port: 4370 },
    { id: 2, name: 'Door 2', ip: '172.16.0.20', port: 4370 },
    { id: 3, name: 'Door 3', ip: '172.16.0.5', port: 4370 },
    { id: 4, name: 'Door 4', ip: '172.16.0.4', port: 4370 },
];
exports.OFFICE_START = '09:00:00';
exports.OFFICE_END = '19:00:00';
exports.LATE_CUTOFF = '09:05:00';
