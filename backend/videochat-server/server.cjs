require('dotenv').config();
const WebSocket = require('ws');
const https = require('https');
const path = require('path');
const fs = require('fs');

const PORT = process.env.VIDEO_PORT || 8080;

// Check if certificates exist, otherwise use HTTP for development
let server;
const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  server = https.createServer(options);
  console.log('Using HTTPS with SSL certificates');
} else {
  const http = require('http');
  server = http.createServer();
  console.warn('SSL certificates not found. Using HTTP (not suitable for production)');
  console.warn('WebRTC requires HTTPS for camera access on remote devices');
}

const wss = new WebSocket.Server({ server });

const rooms = new Map();

// Heartbeat interval to detect stale connections
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

function heartbeat() {
  this.isAlive = true;
}

// Ping all clients periodically
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('Terminating stale connection');
      handleClientDisconnect(ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

wss.on('connection', (ws) => {
  console.log('Video chat client connected');

  // Setup heartbeat
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data.type);

      switch (data.type) {
        case 'join-room':
          handleJoinRoom(ws, data);
          break;
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          handleSignalingMessage(ws, data);
          break;
        case 'leave-room':
          handleLeaveRoom(ws, data);
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log('Video chat client disconnected');
    handleClientDisconnect(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleJoinRoom(ws, data) {
  const { roomId, userId } = data;

  if (!roomId || !userId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room ID and User ID required' }));
    return;
  }

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }

  const room = rooms.get(roomId);

  if (room.size >= 2) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
    return;
  }

  ws.roomId = roomId;
  ws.userId = userId;
  room.set(userId, ws);

  ws.send(JSON.stringify({
    type: 'joined-room',
    roomId,
    userId,
    participants: Array.from(room.keys()).filter(id => id !== userId)
  }));

  room.forEach((client, clientId) => {
    if (clientId !== userId && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'user-joined',
        userId
      }));
    }
  });

  console.log(`User ${userId} joined room ${roomId}. Room size: ${room.size}`);
}

function handleSignalingMessage(ws, data) {
  const { roomId } = data;

  if (!roomId || !ws.roomId || ws.roomId !== roomId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid room' }));
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    return;
  }

  // Broadcast to all other clients in the room
  room.forEach((client, clientId) => {
    if (clientId !== ws.userId && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        ...data,
        fromUserId: ws.userId
      }));
    }
  });
}

function handleLeaveRoom(ws, data) {
  if (ws.roomId && ws.userId) {
    const room = rooms.get(ws.roomId);
    if (room) {
      room.delete(ws.userId);

      room.forEach((client, clientId) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'user-left',
            userId: ws.userId
          }));
        }
      });

      if (room.size === 0) {
        rooms.delete(ws.roomId);
      }

      console.log(`User ${ws.userId} left room ${ws.roomId}`);
    }
  }

  ws.roomId = null;
  ws.userId = null;
}

function handleClientDisconnect(ws) {
  handleLeaveRoom(ws, {});
}

// Graceful shutdown handler
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down WebRTC signaling server...`);

  // Close all WebSocket connections
  wss.clients.forEach((client) => {
    try {
      client.close(1000, 'Server shutting down');
    } catch (e) {
      // Ignore errors on close
    }
  });

  // Close WebSocket server
  wss.close(() => {
    console.log('📡 WebSocket server closed');
  });

  // Close HTTP/HTTPS server
  server.close(() => {
    console.log('🔌 HTTP/HTTPS server closed');
    console.log('👋 Goodbye!');
    process.exit(0);
  });

  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('⚠️ Forcing shutdown after timeout');
    process.exit(1);
  }, 5000);
}

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`📹 WebRTC signaling server running on port ${PORT}`);
    console.log(`🔒 Protocol: ${fs.existsSync(certPath) && fs.existsSync(keyPath) ? 'HTTPS' : 'HTTP'}`);
    console.log(`💻 Access from other devices: ${fs.existsSync(certPath) && fs.existsSync(keyPath) ? 'https' : 'http'}://[YOUR_IP]:${PORT}`);

    // Signal to PM2 that app is ready
    if (process.send) {
      process.send('ready');
    }
  });

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { server, wss, rooms };