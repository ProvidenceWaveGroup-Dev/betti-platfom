#!/bin/bash
# Start all Betti platform services using PM2

echo "🚀 Starting all Betti platform services..."

# Start all apps defined in ecosystem.config.js
pm2 start ecosystem.config.js

echo ""
echo "✅ All services started!"
echo "Run 'npm run pm2:status' to check status"
echo "Run 'npm run pm2:logs' to view logs"
