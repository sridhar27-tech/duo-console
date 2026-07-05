// duo-console-core/server.js

// 1. Dependency Imports
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// 2. Application and Server Initialization
const app = express();
const server = http.createServer(app);

// 3. Socket.io Configuration with CORS Protection
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"], // Add production Vercel URL here later
    methods: ["GET", "POST"]
  }
});

// 4. Security Gate: Define Pre-Shared Authentication Token
const AUTH_TOKEN = "your_secure_pre_shared_token_here"; // Keep this identical on frontend

// 5. Connection Handshake Security Gate Middleware
io.use((socket, next) => {
  // Extract token from the handshake auth object or query fallback
  const clientToken = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (clientToken === AUTH_TOKEN) {
    // Valid token: Pass connection to the main listener pool
    return next();
  }

  // Invalid token: Refuse connection at the front door
  const authError = new Error('Authentication failed: Invalid security token');
  authError.data = { details: 'Token missing or mismatched.' };
  return next(authError);
});

// 6. Main Connection Listener Pool (Placeholder for Steps 3, 4, & 5)
io.on('connection', (socket) => {
  console.log(`Security clearance granted: Client authenticated (${socket.id})`);

  // --- STEP 3: DYNAMIC ROOM ROUTING HANDLER ---
  socket.on('join_room', (roomId) => {
    // Basic structural validation of the incoming string
    if (!roomId || typeof roomId !== 'string') {
      console.log(`Rejected join_room event from ${socket.id}: Invalid Room ID format.`);
      return;
    }

    // Optional Clean-up: Leave previous rooms to guarantee strict one-chat view isolation
    // We filter out the socket's automatic personal room (which matches its own ID)
    const currentRooms = Array.from(socket.rooms);
    currentRooms.forEach((room) => {
      if (room !== socket.id) {
        socket.leave(room);
        console.log(`Client ${socket.id} evacuated room lane: [${room}]`);
      }
    });

    // Bind the socket instance to the requested isolated room channel
    socket.join(roomId);
    console.log(`Client ${socket.id} successfully joined room lane: [${roomId}]`);
    
    // Acknowledge the operation back to the client frontend for view sync
    socket.emit('room_joined_status', { success: true, roomId });
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`Client disconnected from session pool (${socket.id})`);
  });
});

// 7. Local Port Binding Listener
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  Relay server active and listening on port ${PORT} `);
  console.log(`===============================================`);
});