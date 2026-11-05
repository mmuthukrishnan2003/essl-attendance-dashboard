#!/usr/bin/env bash
# Centizen eSSL Attendance Dashboard - Node + Angular Launcher for Linux
echo "======================================================================"
echo "  Centizen eSSL Attendance Management System (Node.js + Angular 20)"
echo "  4 Biometric Devices: 172.16.0.4, 172.16.0.20, 172.16.0.5, 172.16.0.44"
echo "  Port: 4370 (ZKTeco Protocol)"
echo "======================================================================"
echo ""

# Ensure backend dependencies are installed
if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend node_modules..."
    cd backend && npm install --production && cd ..
fi

echo "Starting Application Server on ports 8881 & 80..."
echo "  [LAN / Web URL] http://attendance.office.centizen.com"
echo "  [LAN Port 8881] http://172.17.0.38:8881"
echo ""

node backend/dist/server.js
