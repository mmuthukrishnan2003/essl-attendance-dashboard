@echo off
setlocal EnableDelayedExpansion
title Configure Domain local.getzenbasket.com

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ===========================================================================
    echo   Centizen Attendance Portal - Domain Configuration
    echo ===========================================================================
    echo.
    echo Requesting Administrator privileges to update hosts file...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~dpnx0\"\" ELEVATED' -Verb RunAs" 2>nul
    exit /b
)

cls
echo ===========================================================================
echo   Centizen Attendance Portal - Domain Configuration
echo ===========================================================================
echo.
echo Domain : local.getzenbasket.com
echo IP     : 172.17.0.38
echo.

set "HOSTS_FILE=%SystemRoot%\System32\drivers\etc\hosts"

:: Check if entry already exists
findstr /C:"local.getzenbasket.com" "%HOSTS_FILE%" >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] local.getzenbasket.com is already configured in %HOSTS_FILE%!
) else (
    echo [*] Adding "172.17.0.38  local.getzenbasket.com" to hosts file...
    echo. >> "%HOSTS_FILE%"
    echo 172.17.0.38    local.getzenbasket.com >> "%HOSTS_FILE%"
    echo [SUCCESS] Domain local.getzenbasket.com successfully added to hosts file!
)

echo.
echo You can now access:
echo   - Secure Portal: https://local.getzenbasket.com:8881
echo   - Standard HTTP: http://local.getzenbasket.com
echo.
echo Press any key to close...
pause >nul
