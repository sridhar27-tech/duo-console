// duo-console-core/server.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// 1. Production-Ready CORS Configuration
const ALLOWED_ORIGINS = [
  "http://localhost:5173", 
  // "https://your-app-name.vercel.app" // <- Uncomment and paste your Vercel deployment URL here later
];

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 2. Token Synchronization (must match AUTH_TOKEN in useSocket.ts)
const AUTH_TOKEN = "duo-console-secret-2025";

// 3. Security Gate: Handshake Middleware
io.use((socket, next) => {
  const clientToken = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (clientToken === AUTH_TOKEN) {
    return next();
  }

  const authError = new Error('Authentication failed: Invalid security token');
  authError.data = { details: 'Your frontend token does not match the server configuration.' };
  return next(authError);
});

// Helper: Get active user count in a specific room
function getRoomUserCount(roomId) {
  const room = io.sockets.adapter.rooms.get(roomId);
  return room ? room.size : 0;
}

// 4. Main Connection and Relay Matrix
io.on('connection', (socket) => {
  console.log(`[AUTHED] Client connected: ${socket.id}`);
  
  // Track current room membership for cleanup on unexpected disconnect
  let activeRoomId = null;

  // --- DYNAMIC ROOM ROUTING & CAPACITY ENFORCEMENT ---
  socket.on('join_room', (roomId) => {
    if (!roomId || typeof roomId !== 'string') {
      console.log(`[ROOM REJECT] Invalid roomId received from ${socket.id}`);
      return;
    }

    // Step out of any existing room before moving to a new chat lane
    if (activeRoomId) {
      socket.leave(activeRoomId);
      console.log(`[ROOM LEAVE] Client ${socket.id} left room: ${activeRoomId}`);
      
      // Notify remaining peer in old room of status change
      socket.to(activeRoomId).emit('peer_status', 'waiting'); 
    }

    // Capacity Check: Enforce strict 1-on-1 private chat limits
    const occupantsCount = getRoomUserCount(roomId);
    if (occupantsCount >= 2) {
      console.log(`[ROOM FULL] Connection refused for ${socket.id} on room: ${roomId}`);
      socket.emit('room_full', { roomId });
      return;
    }

    // Accept client into the isolated room
    socket.join(roomId);
    activeRoomId = roomId;
    console.log(`[ROOM JOIN] Client ${socket.id} successfully joined room: ${roomId}`);
    
    // Acknowledge connection status back to client
    socket.emit('room_joined_status', { success: true, roomId });

    // Broadcast updated peer status to the channel
    const newOccupantsCount = getRoomUserCount(roomId);
    if (newOccupantsCount === 2) {
      // Both users are connected — signal green light
      io.to(roomId).emit('peer_status', 'online');
    } else {
      // Only one user is connected — signal orange wait light
      socket.emit('peer_status', 'waiting');
    }
  });

  // --- CHAT MESSAGE RELAY (Low-Frequency encrypted text) ---
  socket.on('chat_msg', (payload) => {
    if (!activeRoomId) return;
    // Broadcast the payload containing ciphertext, timestamp, and msgId to the peer
    socket.to(activeRoomId).emit('chat_msg', payload);
  });

  // --- WHITEBOARD RELAY (High-Frequency raw 5-byte binary protocol) ---
  socket.on('binary_stroke', (buffer) => {
    if (!activeRoomId) return;
    // Bypass parsing. Forward the raw binary ArrayBuffer directly to the peer
    socket.to(activeRoomId).emit('binary_stroke', buffer);
  });

  // --- CANVAS CLEAR RELAY ---
  socket.on('canvas_clear', () => {
    if (!activeRoomId) return;
    socket.to(activeRoomId).emit('canvas_clear');
  });

  // --- REACTION RELAY ---
  socket.on('reaction', (payload) => {
    if (!activeRoomId) return;
    // Relay target msgId and chosen emoji
    socket.to(activeRoomId).emit('reaction', payload);
  });

  // --- MEDIA SHARE URL RELAY (Cloudinary payloads) ---
  socket.on('media_share', (payload) => {
    if (!activeRoomId) return;
    socket.to(activeRoomId).emit('media_share', payload);
  });

  // --- TEARDOWN ON DISCONNECT ---
  socket.on('disconnect', () => {
    console.log(`[DISCONNECT] Client disconnected: ${socket.id}`);
    if (activeRoomId) {
      // Inform the remaining peer in the chat that their counterpart has left
      socket.to(activeRoomId).emit('peer_status', 'waiting');
    }
  });
});

// 5. Port Binding
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`  DUO CONSOLE CORE RUNNING ON PORT ${PORT}      `);
  console.log(`  Security Token: "${AUTH_TOKEN}"                `);
  console.log(`=================================================\n`);
});