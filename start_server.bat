@echo off
title Centizen eSSL Attendance Management System
cd /d "%~dp0"
echo ======================================================================
echo   Centizen eSSL Attendance Management System
echo   4 Biometric Devices: 172.16.0.4, 172.16.0.20, 172.16.0.5, 172.16.0.44
echo   Port: 4370 (ZKTeco Protocol)
echo ======================================================================
echo.
echo Starting Application Server for Local and Office Network Access:
echo   [OFFICIAL LAN URL]  http://172.17.0.38:8881
echo   - http://172.17.0.38 (Port 80)
echo   - http://centizen.AttendancePortal.com:8881
echo   - http://centizen.AttendancePortal.com
echo   - http://localhost:8881
echo.
echo Press Ctrl+C to stop the server.
echo.
python run.py
pause

