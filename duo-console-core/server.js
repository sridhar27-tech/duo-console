/**
 * Duo Console — Local Relay Server
 *
 * Socket.io stateful relay with:
 *  - Gate 1: Handshake token authentication (io.use middleware)
 *  - Binary protocol for canvas strokes (binary_stroke)
 *  - JSON protocol for chat messages (chat_msg) and media (media_share)
 *  - Two-client room enforcement
 */

"use strict";

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// ─── Security Constant ────────────────────────────────────────────────────────
// Pre-shared auth token. Both clients must send this inside the
// Socket.io handshake auth object: { auth: { token: AUTH_TOKEN } }
const AUTH_TOKEN = "duo-console-secret-2025";

// ─── Server Initialization ────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    // Allow Vercel + localhost origins. Tighten this to your Vercel URL in prod.
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ─── Gate 1: Middleware Hook — Handshake Token Authentication ─────────────────
// io.use() intercepts every incoming connection handshake before the socket
// joins any room. Unauthorized clients are dropped here before they can
// read or write any data.
io.use((socket, next) => {
  // Extract the token from handshake auth (preferred) or query params fallback
  const token =
    socket.handshake.auth?.token || socket.handshake.query?.token;

  if (token === AUTH_TOKEN) {
    // Token matches — authorize the connection
    next();
  } else {
    // Token missing, wrong, or corrupted — drop the socket immediately
    next(new Error("Authentication failed: Invalid security token"));
  }
});

// ─── Connection Handler ───────────────────────────────────────────────────────
const ROOM = "duo-room";
const MAX_CLIENTS = 2;

io.on("connection", (socket) => {
  const room = io.sockets.adapter.rooms.get(ROOM);
  const clientCount = room ? room.size : 0;

  if (clientCount >= MAX_CLIENTS) {
    console.log(`[server] Connection refused — room full (${socket.id})`);
    socket.emit("room_full");
    socket.disconnect(true);
    return;
  }

  socket.join(ROOM);
  console.log(`[server] Client connected: ${socket.id}`);

  // Notify both clients that the peer has joined
  io.to(ROOM).emit("peer_status", {
    connected: io.sockets.adapter.rooms.get(ROOM)?.size ?? 0,
  });

  // ── Chat Message Relay (JSON / AES ciphertext passthrough) ──────────────────
  // The server is zero-knowledge: it relays the ciphertext blob without
  // decrypting. Only clients with the matching PSK can decrypt.
  socket.on("chat_msg", (payload) => {
    // Broadcast to the other client in the room only
    socket.to(ROOM).emit("chat_msg", payload);
  });

  // ── Media Share Relay (Cloudinary URL, also AES-encrypted) ──────────────────
  socket.on("media_share", (payload) => {
    socket.to(ROOM).emit("media_share", payload);
  });

  // ── Binary Canvas Stroke Relay ───────────────────────────────────────────────
  // Payload is a raw ArrayBuffer following the 5-byte spec:
  //   Byte 0      → Opcode (0x01 = draw stroke)
  //   Bytes 1–2   → X coordinate (Uint16, big-endian)
  //   Bytes 3–4   → Y coordinate (Uint16, big-endian)
  socket.on("binary_stroke", (buffer) => {
    socket.to(ROOM).emit("binary_stroke", buffer);
  });

  // ── Canvas Clear Relay ───────────────────────────────────────────────────────
  socket.on("canvas_clear", () => {
    socket.to(ROOM).emit("canvas_clear");
  });

  // ── Disconnect ───────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`[server] Client disconnected: ${socket.id}`);
    io.to(ROOM).emit("peer_status", {
      connected: io.sockets.adapter.rooms.get(ROOM)?.size ?? 0,
    });
  });
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", clients: io.sockets.adapter.rooms.get(ROOM)?.size ?? 0 });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
  console.log(`[server] Auth token gate active`);
});
