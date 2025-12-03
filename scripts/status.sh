#!/bin/bash
# Show status of all Betti platform services

echo "📊 Betti Platform Service Status"
echo "================================"
echo ""

# Show PM2 status with detailed info
pm2 status

echo ""
echo "📈 Memory Usage:"
pm2 jlist | grep -E '"name"|"memory"|"cpu"' || pm2 list

echo ""
echo "💡 Quick Commands:"
echo "  View logs:    pm2 logs"
echo "  Monitor:      pm2 monit"
echo "  Restart all:  npm run pm2:restart"
echo "  Stop all:     npm run pm2:stop"
