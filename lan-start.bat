@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$c = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue;" ^
  "if ($c) { Write-Host '每日一枚已经在运行。' } else {" ^
  "  $env:PYTHONIOENCODING = 'utf-8';" ^
  "  Start-Process python -ArgumentList '-u','dailystamp.py','serve','--lan','--no-browser' -WindowStyle Hidden -RedirectStandardOutput serve.log -RedirectStandardError serve.err.log;" ^
  "  Start-Sleep -Seconds 2; Write-Host '每日一枚已在后台启动。' }" ^
  "Write-Host '';" ^
  "Write-Host ('本机打开:  http://127.0.0.1:8765/');" ^
  "Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp,Manual -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { Write-Host ('同一 WiFi 下其他设备打开:  http://' + $_.IPAddress + ':8765/') }"
echo.
echo 关闭请双击 lan-stop.bat
pause
