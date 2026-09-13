@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %*
if errorlevel 1 (
  echo.
  echo Khong the khoi dong. Xem thong bao loi phia tren.
  pause
  exit /b 1
)
exit /b 0
