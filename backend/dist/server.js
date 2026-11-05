"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const config_1 = require("./config");
const connection_1 = require("./db/connection");
const authService_1 = require("./services/authService");
const liveSyncService_1 = require("./services/liveSyncService");
const deviceSyncService_1 = require("./services/deviceSyncService");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const attendanceRoutes_1 = __importDefault(require("./routes/attendanceRoutes"));
const employeeRoutes_1 = __importDefault(require("./routes/employeeRoutes"));
const shiftRoutes_1 = __importDefault(require("./routes/shiftRoutes"));
const deviceRoutes_1 = __importDefault(require("./routes/deviceRoutes"));
const settingRoutes_1 = __importDefault(require("./routes/settingRoutes"));
const app = (0, express_1.default)();
exports.app = app;
// Middlewares
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
// API Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/attendance', attendanceRoutes_1.default);
app.use('/api/employees', employeeRoutes_1.default);
app.use('/api/shifts', shiftRoutes_1.default);
app.use('/api/devices', deviceRoutes_1.default);
app.use('/api/settings', settingRoutes_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', stack: 'Node.js + Express + Angular 20', time: new Date().toISOString() });
});
// Serve frontend Angular production build
const candidateDistDirs = [
    path_1.default.resolve(__dirname, '../../public'),
    path_1.default.resolve(__dirname, '../public'),
    path_1.default.resolve(__dirname, '../../frontend/dist/frontend/browser'),
    path_1.default.resolve(__dirname, '../../frontend/dist/frontend'),
    path_1.default.resolve(process.cwd(), 'public'),
    path_1.default.resolve(process.cwd(), 'frontend/dist/frontend/browser'),
];
let staticDir = null;
for (const dir of candidateDistDirs) {
    if (fs_1.default.existsSync(dir) && fs_1.default.existsSync(path_1.default.join(dir, 'index.html'))) {
        staticDir = dir;
        break;
    }
}
if (staticDir) {
    console.log(`📂 Serving static Angular frontend from: ${staticDir}`);
    app.use(express_1.default.static(staticDir));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path_1.default.join(staticDir, 'index.html'));
        }
    });
}
async function startServer() {
    try {
        console.log('='.repeat(75));
        console.log('  Centizen eSSL Biometric Attendance Management System (Node + Angular)');
        console.log('  Primary Portal URL : http://0.0.0.0:' + config_1.PORT);
        console.log('  Alternative URL    : http://0.0.0.0:' + config_1.ALT_PORT);
        console.log('  Connecting to 4 eSSL Devices: ' + config_1.DEVICES.map(d => d.ip).join(', '));
        console.log('='.repeat(75));
        await (0, connection_1.initDatabase)();
        await (0, authService_1.ensureDefaultUsers)();
        await (0, liveSyncService_1.initLiveWatcher)();
        (0, deviceSyncService_1.startBackgroundDeviceSync)();
        // Primary Server
        const server1 = http_1.default.createServer(app);
        server1.listen(config_1.PORT, '0.0.0.0', () => {
            console.log(`🚀 [Node + Angular] Primary server active on http://0.0.0.0:${config_1.PORT}`);
        });
        // Optional Port 80
        if (config_1.ALT_PORT && config_1.ALT_PORT !== config_1.PORT) {
            try {
                const server80 = http_1.default.createServer(app);
                server80.listen(config_1.ALT_PORT, '0.0.0.0', () => {
                    console.log(`🚀 [Node + Angular] HTTP alternative active on http://0.0.0.0:${config_1.ALT_PORT}`);
                });
                server80.on('error', (err) => {
                    console.log(`ℹ️ Note on Port ${config_1.ALT_PORT}: ${err.message || err} (Requires root/admin permissions)`);
                });
            }
            catch (e) {
                console.log(`ℹ️ Note on Port ${config_1.ALT_PORT}: ${e.message || e}`);
            }
        }
    }
    catch (err) {
        console.error('Fatal error starting server:', err);
        process.exit(1);
    }
}
if (require.main === module) {
    startServer();
}
