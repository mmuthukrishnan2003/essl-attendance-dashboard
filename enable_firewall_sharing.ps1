# Run this script in PowerShell as Administrator to allow office LAN sharing:
New-NetFirewallRule -DisplayName "Centizen Attendance Portal" -Direction Inbound -LocalPort 80,8881 -Protocol TCP -Action Allow -Profile Any
Write-Host "Centizen Attendance Portal Firewall Rules Added Successfully!" -ForegroundColor Green
Write-Host "Office colleagues can now access: http://centizen.AttendancePortal.com or http://172.17.0.38" -ForegroundColor Cyan
Pause

