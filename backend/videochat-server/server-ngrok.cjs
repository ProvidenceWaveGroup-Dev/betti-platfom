require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = process.env.VIDEO_PORT || 8080;

// HTTP server for ngrok (ngrok provides the HTTPS layer)
const server = http.createServer((req, res) => {
  // Serve static files from public directory if it exists
  const publicDir = path.join(__dirname, 'public');

  if (fs.existsSync(publicDir)) {
    const filePath = path.join(publicDir, req.url === '/' ? 'index.html' : req.url);
    const extname = path.extname(filePath);

    let contentType = 'text/html';
    switch (extname) {
      case '.js':
        contentType = 'text/javascript';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.json':
        contentType = 'application/json';
        break;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('File not found');
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Server error');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  } else {
    // No public directory - just respond with status
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'video-chat-signaling',
      message: 'WebSocket signaling server running. Connect via WebSocket.'
    }));
  }
});

const wss = new WebSocket.Server({ server });

const rooms = new Map();

wss.on('connection', (ws) => {
  console.log('Video chat client connected (ngrok mode)');

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
  const { roomId, targetUserId } = data;

  if (!roomId || !ws.roomId || ws.roomId !== roomId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid room' }));
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    return;
  }

  // If targetUserId specified, send to that user only
  if (targetUserId) {
    const targetClient = room.get(targetUserId);
    if (targetClient && targetClient.readyState === WebSocket.OPEN) {
      targetClient.send(JSON.stringify({
        ...data,
        fromUserId: ws.userId
      }));
    }
  } else {
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

  // Close HTTP server
  server.close(() => {
    console.log('🔌 HTTP server closed');
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
    console.log(`📹 WebRTC signaling server (ngrok-ready) running on port ${PORT}`);
    console.log(`🌐 HTTP server (ngrok provides HTTPS)`);
    console.log(`🔗 Use with ngrok: ngrok http --url=halibut-saved-gannet.ngrok-free.app ${PORT}`);
    console.log(`💻 Local access: http://localhost:${PORT}`);

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
