@echo off
setlocal EnableDelayedExpansion
title Centizen Attendance Portal - Office LAN Sharing

:: Test if already running as Administrator
net session >nul 2>&1
if %errorlevel% == 0 (
    goto :RUN_CONFIG
)

:: If not admin, try to elevate using PowerShell calling cmd.exe
echo ===========================================================================
echo   Centizen Attendance Portal - Windows Firewall LAN Sharing
echo ===========================================================================
echo.
echo [INFO] Requesting Administrator permission...
echo Please click "Yes" on the Windows prompt...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~dpnx0\"\" ELEVATED' -Verb RunAs" 2>nul
if %errorlevel% == 0 exit /b

:: If PowerShell elevation failed, show clear instructions
cls
echo ===========================================================================
echo   ADMINISTRATOR PRIVILEGES REQUIRED
echo ===========================================================================
echo.
echo Windows requires Administrator rights to open ports in Windows Firewall.
echo.
echo PLEASE DO THIS:
echo   1. Close this window.
echo   2. Right-click on "enable_firewall_sharing.bat" in File Explorer.
echo   3. Click "Run as administrator".
echo   4. Click "Yes" when Windows asks for permission.
echo.
echo ===========================================================================
echo Press any key to exit...
pause >nul
exit /b

:RUN_CONFIG
cls
echo ===========================================================================
echo   Centizen Attendance Portal - Enabling Office LAN Sharing
echo ===========================================================================
echo.
echo Adding Windows Firewall Inbound Rules for Ports 80 and 8881...
echo.

netsh advfirewall firewall delete rule name="Centizen Attendance Portal" >nul 2>&1
netsh advfirewall firewall add rule name="Centizen Attendance Portal" dir=in action=allow protocol=TCP localport=80,8881 profile=any

echo.
if %errorlevel% == 0 (
    echo ===========================================================================
    echo   [SUCCESS] WINDOWS FIREWALL HAS OPENED PORTS 80 AND 8881!
    echo ===========================================================================
    echo.
    echo Your office colleagues can now open in their browser:
    echo.
    echo   - http://centizen.AttendancePortal.com       (Standard Port 80)
    echo   - http://centizen.AttendancePortal.com:8881  (Port 8881)
    echo   - http://172.17.0.38
    echo.
) else (
    echo [ERROR] Could not add firewall rule. Please right-click this file and choose "Run as administrator".
)

echo.
echo Press any key to close this window...
pause >nul
