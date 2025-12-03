@echo off
REM Restart all Betti platform services using PM2 (Windows)

echo Restarting all Betti platform services...
echo.

pm2 restart ecosystem.config.js

echo.
echo All services restarted!
echo Run 'pm2 status' to check status
echo Run 'pm2 logs' to view logs
