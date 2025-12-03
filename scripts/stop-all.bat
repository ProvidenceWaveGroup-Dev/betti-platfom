@echo off
REM Stop all Betti platform services using PM2 (Windows)

echo Stopping all Betti platform services...
echo.

pm2 stop ecosystem.config.js

echo.
echo All services stopped!
echo Run 'pm2 status' to verify
