#!/bin/bash
# Stop all Betti platform services using PM2

echo "🛑 Stopping all Betti platform services..."

# Stop all apps
pm2 stop ecosystem.config.js

echo ""
echo "✅ All services stopped!"
echo "Run 'npm run pm2:status' to verify"
