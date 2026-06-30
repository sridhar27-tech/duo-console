---
inclusion: auto
---

# Socket.io Patterns — Duo Console

This project uses **Socket.io 4.x** for real-time bidirectional communication between two clients through a local Node.js relay server.

---

## Authentication Middleware (Gate 1)

Every connection must pass the `AUTH_TOKEN` through the Socket.io handshake before joining the room. This is enforced via `io.use()` on the server — the **first and only gate** before a socket can read or write any data.

```js
// server: duo-console-core/server.js
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (token === AUTH_TOKEN) {
    next();                                          // authorized ✓
  } else {
    next(new Error("Authentication failed: Invalid security token")); // dropped ✗
  }
});
```

```ts
// client: frontend/src/hooks/useSocket.ts
const socket = io(serverUrl, {
  auth: { token: AUTH_TOKEN },   // matched against server AUTH_TOKEN
  transports: ["websocket"],
});
```

---

## Event Channels

| Channel | Direction | Payload | Purpose |
|---|---|---|---|
| `chat_msg` | client → server → peer | `{ cipher: string, ts: number }` | AES-encrypted text message |
| `media_share` | client → server → peer | `{ cipher: string, ts: number }` | AES-encrypted Cloudinary URL |
| `binary_stroke` | client → server → peer | `ArrayBuffer` (5 bytes) | Raw canvas coordinate |
| `canvas_clear` | client → server → peer | — | Wipe peer's canvas |
| `peer_status` | server → clients | `{ connected: number }` | Connection count update |
| `room_full` | server → client | — | Third client rejected |

---

## Binary Stroke Protocol (5-byte ArrayBuffer)

Canvas drawing coordinates bypass JSON serialization entirely. Each stroke point is packed into a fixed 5-byte `ArrayBuffer` before `socket.emit("binary_stroke", buffer)`:

```
Byte 0       → Opcode: 0x01 (identifies drawing data)
Bytes 1–2    → X coordinate (Uint16, big-endian, max 65,535px)
Bytes 3–4    → Y coordinate (Uint16, big-endian, max 65,535px)
```

This shrinks per-point payload from ~25–40 bytes (JSON) down to **5 bytes** — an ~80% reduction that eliminates serialization lag and allows sub-millisecond drawing feedback without throttling.

```ts
// Packing (useSocket.ts)
const buffer = new ArrayBuffer(5);
const view = new DataView(buffer);
view.setUint8(0, 0x01);
view.setUint16(1, Math.round(x), false);
view.setUint16(3, Math.round(y), false);
socket.emit("binary_stroke", buffer);
```

---

## Room Enforcement

The server enforces a two-client maximum on the single `"duo-room"`. A third connection attempt receives `room_full` and is disconnected immediately.

---

## Security Model Summary

- **Gate 1 (Connection level):** `io.use()` token validation — enforced before joining the room
- **Gate 2 (Data level):** AES encryption via CryptoJS — server is zero-knowledge, only routes ciphertext
- **Gate 3 (UI level):** Escape key boss trigger — instantly clears the visible feed and canvas

---

## Key Files

- `duo-console-core/server.js` — Express + Socket.io server with auth middleware
- `frontend/src/hooks/useSocket.ts` — Client socket hook, binary packer, event subscriptions
- `frontend/src/utils/crypto.ts` — AES encrypt/decrypt helpers (CryptoJS)
- `frontend/src/components/ChatInterface.tsx` — Connects socket, Escape trigger, chat UI
- `frontend/src/components/DrawingCanvas.tsx` — Canvas with `onStroke` / `onClear` callbacks
