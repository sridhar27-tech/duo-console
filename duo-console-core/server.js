// duo-console-core/server.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// ── 1. Dynamic CORS ───────────────────────────────────────────────────────────
// Allows any localhost port, Vite preview port, Ngrok free/custom domains,
// and any Vercel deployment URL. The fallback callback(null, true) catches
// requests with no Origin header (curl, Postman, mobile apps).
const NGROK_ORIGIN_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$|^https:\/\/.*\.(ngrok-free\.app|ngrok\.io|ngrok\.dev|vercel\.app)$/;

function corsOriginHandler(origin, callback) {
  if (!origin || NGROK_ORIGIN_PATTERN.test(origin)) {
    callback(null, true);
  } else {
    // Log the rejected origin so it's easy to diagnose and whitelist
    console.warn(`[CORS REJECTED] Origin blocked: ${origin}`);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  }
}

// ── 2. Socket.IO Server ───────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Keep-alive tuning — prevents Ngrok from dropping idle WebSocket connections.
  // Ngrok terminates tunnels that are silent for >55s, so we ping every 10s.
  pingInterval: 10000,  // Send a ping every 10 s
  pingTimeout:  20000,  // Wait up to 20 s for a pong before considering dead
  // Allow binary ArrayBuffer payloads to pass through without coercion
  maxHttpBufferSize: 1e6, // 1 MB max per message
});

// ── 3. Token Synchronization (must match AUTH_TOKEN in useSocket.ts) ──────────
const AUTH_TOKEN = process.env.AUTH_TOKEN || "duo-console-secret-2025";

// ── 4. Health & Status Endpoints ─────────────────────────────────────────────

/**
 * GET /health
 * Lightweight liveness probe — used by curl, uptime monitors, and the
 * frontend to verify the tunnel is alive before attempting a socket connect.
 * Returns 200 with a JSON payload.
 */
app.get('/health', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    status:    'active',
    uptime:    process.uptime(),
    timestamp: new Date().toISOString(),
    version:   '1.0.0',
  });
});

/**
 * GET /status
 * Extended diagnostic endpoint — includes per-room occupancy so both
 * clients can verify they are in the same room before exchanging messages.
 */
app.get('/status', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const rooms = {};
  for (const [roomId, socketSet] of io.sockets.adapter.rooms.entries()) {
    // Skip the per-socket rooms Socket.IO creates automatically
    if (io.sockets.sockets.has(roomId)) continue;
    rooms[roomId] = socketSet.size;
  }

  res.json({
    status:          'active',
    uptime:          process.uptime(),
    timestamp:       new Date().toISOString(),
    connectedSockets: io.sockets.sockets.size,
    rooms,
  });
});

// ── 5. Security Gate: Handshake Middleware ────────────────────────────────────
io.use((socket, next) => {
  const clientToken =
    socket.handshake.auth?.token || socket.handshake.query?.token;

  if (clientToken === AUTH_TOKEN) {
    return next();
  }

  const authError = new Error('Authentication failed: Invalid security token');
  authError.data = {
    details: 'Your frontend token does not match the server configuration.',
  };
  return next(authError);
});

// ── Helper: Get active user count in a specific room ─────────────────────────
function getRoomUserCount(roomId) {
  const room = io.sockets.adapter.rooms.get(roomId);
  return room ? room.size : 0;
}

// ── 6. Main Connection and Relay Matrix ───────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[AUTHED] Client connected: ${socket.id}`);

  // Track current room membership for cleanup on unexpected disconnect
  let activeRoomId = null;

  // ── DYNAMIC ROOM ROUTING & CAPACITY ENFORCEMENT ──────────────────────────
  socket.on('join_room', (roomId) => {
    if (!roomId || typeof roomId !== 'string') {
      console.log(`[ROOM REJECT] Invalid roomId from ${socket.id}`);
      return;
    }

    // Leave any existing room before joining a new one
    if (activeRoomId) {
      socket.leave(activeRoomId);
      console.log(`[ROOM LEAVE] ${socket.id} left room: ${activeRoomId}`);
      socket.to(activeRoomId).emit('peer_status', 'waiting');
    }

    // Capacity check — strict 1-on-1 private session
    const occupantsCount = getRoomUserCount(roomId);
    if (occupantsCount >= 2) {
      console.log(`[ROOM FULL] Refused ${socket.id} on room: ${roomId}`);
      socket.emit('room_full', { roomId });
      return;
    }

    socket.join(roomId);
    activeRoomId = roomId;
    console.log(`[ROOM JOIN] ${socket.id} joined room: ${roomId}`);

    socket.emit('room_joined_status', { success: true, roomId });

    const newCount = getRoomUserCount(roomId);
    if (newCount === 2) {
      io.to(roomId).emit('peer_status', 'online');
    } else {
      socket.emit('peer_status', 'waiting');
    }
  });

  // ── CHAT MESSAGE RELAY ────────────────────────────────────────────────────
  socket.on('chat_msg', (payload) => {
    if (!activeRoomId) return;
    socket.to(activeRoomId).emit('chat_msg', payload);
  });

  // ── WHITEBOARD RELAY (raw 8-byte binary protocol) ─────────────────────────
  socket.on('binary_stroke', (buffer) => {
    if (!activeRoomId) return;
    socket.to(activeRoomId).emit('binary_stroke', buffer);
  });

  // ── CANVAS CLEAR RELAY ────────────────────────────────────────────────────
  socket.on('canvas_clear', () => {
    if (!activeRoomId) return;
    socket.to(activeRoomId).emit('canvas_clear');
  });

  // ── REACTION RELAY ────────────────────────────────────────────────────────
  socket.on('reaction', (payload) => {
    if (!activeRoomId) return;
    socket.to(activeRoomId).emit('reaction', payload);
  });

  // ── MEDIA SHARE URL RELAY (Cloudinary payloads) ───────────────────────────
  socket.on('media_share', (payload) => {
    if (!activeRoomId) return;
    socket.to(activeRoomId).emit('media_share', payload);
  });

  // ── TYPING STATE RELAY ────────────────────────────────────────────────────
  socket.on('typing_state', (payload) => {
    if (!activeRoomId) return;
    socket.to(activeRoomId).emit('typing_state', payload);
  });

  // ── TEARDOWN ON DISCONNECT ────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[DISCONNECT] ${socket.id} — reason: ${reason}`);
    if (activeRoomId) {
      socket.to(activeRoomId).emit('peer_status', 'waiting');
    }
  });
});

// ── 7. Port Binding ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n================================================`);
  console.log(`  DUO CONSOLE CORE  —  port ${PORT}`);
  console.log(`  Auth token: "${AUTH_TOKEN}"`);
  console.log(`  Health:     http://localhost:${PORT}/health`);
  console.log(`  Status:     http://localhost:${PORT}/status`);
  console.log(`================================================\n`);
});
