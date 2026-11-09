#!/usr/bin/env bash
# ==============================================================================
# Centizen eSSL Attendance Dashboard - Ubuntu Auto-Start Setup Script
# ==============================================================================
set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="$APP_DIR/venv/bin/python"
VENV_PIP="$APP_DIR/venv/bin/pip"
SERVICE_NAME="essl-attendance.service"
SERVICE_DEST="/etc/systemd/system/$SERVICE_NAME"

echo "============================================================"
echo "  Setting up eSSL Attendance Systemd Service on Ubuntu"
echo "  Directory: $APP_DIR"
echo "============================================================"

# 1. Check virtual environment
if [ ! -f "$VENV_PYTHON" ]; then
    echo "[!] Virtualenv python not found at $VENV_PYTHON"
    echo "    Creating virtual environment..."
    python3 -m venv "$APP_DIR/venv"
fi

# 2. Install / ensure required dependencies including psycopg
echo "[*] Ensuring all dependencies (including psycopg[binary]) are installed..."
"$VENV_PIP" install -U pip
"$VENV_PIP" install -r "$APP_DIR/requirements.txt"
"$VENV_PIP" install "psycopg[binary]>=3.1.0"

# 3. Create service file with dynamic paths
echo "[*] Generating $SERVICE_DEST ..."
sudo tee "$SERVICE_DEST" > /dev/null <<EOF
[Unit]
Description=Centizen eSSL Biometric Attendance Management System
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=$VENV_PYTHON run.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=essl-attendance

[Install]
WantedBy=multi-user.target
EOF

# 4. Reload systemd, enable service to start on boot, and start it immediately
echo "[*] Reloading systemd daemon..."
sudo systemctl daemon-reload

echo "[*] Enabling service on system boot..."
sudo systemctl enable "$SERVICE_NAME"

echo "[*] Starting $SERVICE_NAME..."
sudo systemctl restart "$SERVICE_NAME"

echo "============================================================"
echo "  SUCCESS! Service is now ACTIVE and set to AUTO-START on reboot."
echo "============================================================"
sudo systemctl status "$SERVICE_NAME" --no-pager
