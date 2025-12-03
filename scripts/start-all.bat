@echo off
REM Start all Betti platform services using PM2 (Windows)

echo Starting all Betti platform services...
echo.

pm2 start ecosystem.config.js

echo.
echo All services started!
echo Run 'pm2 status' to check status
echo Run 'pm2 logs' to view logs
