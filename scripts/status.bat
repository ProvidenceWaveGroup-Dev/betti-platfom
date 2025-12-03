@echo off
REM Show status of all Betti platform services (Windows)

echo ===================================
echo  Betti Platform Service Status
echo ===================================
echo.

pm2 status

echo.
echo Quick Commands:
echo   View logs:    pm2 logs
echo   Monitor:      pm2 monit
echo   Restart all:  pm2 restart ecosystem.config.js
echo   Stop all:     pm2 stop ecosystem.config.js
