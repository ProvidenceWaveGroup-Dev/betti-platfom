#!/bin/bash
# Restart all Betti platform services using PM2

echo "🔄 Restarting all Betti platform services..."

# Restart all apps
pm2 restart ecosystem.config.js

echo ""
echo "✅ All services restarted!"
echo "Run 'npm run pm2:status' to check status"
echo "Run 'npm run pm2:logs' to view logs"
