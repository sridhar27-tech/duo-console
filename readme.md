# Duo Console

Duo Console is a two-party, real-time communication system built for low-latency text messaging and synchronized canvas drawing over secure local tunnels. A globally accessible static frontend connects to a local Node.js relay server via Socket.io over an Ngrok-exposed WebSocket pipeline.

---

## Architecture

```
+──────────────────────+                     +───────────────+                     +─────────────────────+
|   Vercel Frontend    | ──(Dynamic Input)──►|  Ngrok Cloud  | ──(Secure Tunnel)──►| Local Laptop Server |
| (Girlfriend's Client)|                     |    Proxy      |                     |     (Host Node)     |
+──────────────────────+                     +───────────────+                     +─────────────────────+
                                                     ▲
                                                     │ (Direct HTTPS Upload)
                                                     ▼
                                            +────────────────+
                                            |   Cloudinary   |
                                            | Media Bucket   |
                                            +────────────────+
```

**Stack:**
- **Backend:** Node.js + Express + Socket.io v4
- **Frontend:** React 19 + TypeScript + Vite
- **Tunnel:** Ngrok (ephemeral HTTPS/WSS bridge)
- **Encryption:** CryptoJS AES (symmetric)
- **Hosting:** Vercel (static frontend)

---

## Features

### 1. Secure Connection Screen

The entry point before the session starts. Both users must supply two inputs:

- **Ngrok URL** — the ephemeral server address for that session (e.g. `https://abc123.ngrok-free.app`)
- **Pre-Shared Key (PSK)** — a symmetric encryption key both parties agree on before connecting

The app holds at this screen until both fields are filled and submitted. No connection is attempted prematurely.

---

### 2. End-to-End Encrypted Chat

Real-time text messaging with AES encryption on every payload.

- Messages are **encrypted with the PSK on the sender's device** before leaving the browser using CryptoJS AES.
- The server only routes ciphertext blobs — it never sees plaintext.
- If a peer provides the wrong PSK, received messages are silently discarded (decryption returns `null`).
- Each message carries a millisecond timestamp used for ordering and as a unique ID.
- Messages are sent on `Enter` key or via the Send button. `Shift+Enter` creates a newline.
- Sent messages appear on the right (`Lane B`), received messages on the left (`Lane A`), with a formatted timestamp on each bubble.

---

### 3. Emoji Reactions

Each chat message can receive emoji reactions from either party.

- Click the `+` button on any message to open the reaction picker.
- Available reactions: 👍 ❤️ 😂 😮 🔥
- Reactions are synced to the peer in real time over the `reaction` socket event.
- Reaction counts are displayed on the bubble. Multiple reactions from both sides stack and accumulate.

---

### 4. Real-Time Collaborative Drawing Canvas

A shared whiteboard that streams drawing strokes to the peer in real time using a **binary protocol** for minimal overhead.

#### Binary Stroke Protocol

Canvas coordinates are packed into a **5-byte `ArrayBuffer`** per stroke point and emitted on the `binary_stroke` channel:

| Byte(s) | Size    | Content              |
|---------|---------|----------------------|
| 0       | 1 byte  | Opcode (`0x01` = draw stroke) |
| 1–2     | 2 bytes | X coordinate (Uint16, big-endian) |
| 3–4     | 2 bytes | Y coordinate (Uint16, big-endian) |

This reduces per-packet size by up to 80% versus JSON, enabling sub-millisecond stroke feedback without client-side throttling.

#### Canvas Features

- **Color palette:** 5 ink colors — black, pink, cyan, yellow, green
- **Brush sizes:** 3px, 7px, 12px
- **Mouse and touch input** both supported
- **Canvas resize with snapshot preservation** — resizing the window or sidebar does not wipe existing strokes; existing content is redrawn to the new dimensions
- **Peer stroke rendering** — incoming binary strokes from the peer are decoded and painted directly onto the local canvas without triggering React re-renders
- **Clear canvas** — wipes local canvas and emits `canvas_clear` to sync the peer's canvas
- The canvas lives in a **slide-in sidebar panel** toggled from the top bar

---

### 5. Image Upload and Optimization Pipeline

A local client-side image compression and gallery viewer, accessible via the "Images" button in the top bar.

#### Compression Pipeline (runs entirely in the browser)

1. **Intercept** — file reader pauses transmission before any network request
2. **Rasterize** — raw file is drawn onto a hidden in-memory HTML5 canvas
3. **Downscale** — dimensions are scaled to a maximum 600px on the longest axis while preserving aspect ratio
4. **Compress** — canvas exports a JPEG blob at 50% quality, typically reducing multi-megabyte source files to 50–100 KB

#### Gallery Features

- Uploaded images are prepended to the gallery and focused immediately
- Compression stats are shown for each image: raw buffer size, optimized size, and percentage saved
- **Drag and drop** upload support — drag an image file directly onto the display area
- **Keyboard navigation** — `←` / `→` arrows cycle through gallery images; `Escape` closes the viewer
- **Thumbnail carousel** at the bottom for quick image switching
- Placeholder gradient swatches are included by default as demo items

---

### 6. Three-Layer Security Model

#### Gate 1 — Handshake Token Validation (Server)

The Socket.io server runs an `io.use()` middleware that checks an `AUTH_TOKEN` sent in the WebSocket handshake's `auth` object. Connections that don't match the expected token are dropped immediately with an authentication error before reaching any event handlers.

#### Gate 2 — End-to-End AES Encryption (Client)

Text messages and media URLs are AES-encrypted on the sender's device using CryptoJS before hitting the socket. The relay server forwards ciphertext only. Even if traffic is intercepted at the Ngrok proxy or any intermediate network point, the content is unreadable without the PSK.

```
encrypt(plaintext, psk) → base64 ciphertext  →  network  →  decrypt(ciphertext, psk) → plaintext
```

#### Gate 3 — Boss Mode / Emergency Clear (Client)

Pressing `Escape` (while the image viewer is not open) toggles **Boss Mode**:

- The entire message feed is hidden from the DOM
- The drawing canvas is wiped
- A neutral decoy screen is displayed ("Module 4: Spatial Vector Processing Controls")
- Pressing `Escape` again restores the full interface

Messages are preserved in memory — only the visual display is cleared.

---

### 7. Peer Presence Indicator

The top bar shows a live connection status dot:

- **Green (acid)** — peer is online (2 clients connected to the room)
- **Orange** — waiting for the peer to connect

The indicator updates in real time via the `peer_status` socket event.

---

### 8. Error and Room States

- **Auth failure** — if the server rejects the handshake token, a "connection refused" screen is shown with the server's error message and a Retry button that reloads the page.
- **Room full** — if a third client attempts to connect, a "room full" screen is shown. The server enforces a two-client maximum per room.

---

### 9. Socket Infrastructure

The `useSocket` hook manages the full socket lifecycle:

- Single authenticated Socket.io connection per session, created when `serverUrl` is set
- Transport locked to `websocket` (no polling fallback)
- **Auto-reconnect** — up to 5 attempts with a 1500ms delay between each
- Reconnects automatically when a new Ngrok URL is pasted (dependency on `serverUrl`)
- Graceful cleanup on unmount: socket is disconnected and the ref is cleared

**Socket events handled:**

| Event | Direction | Description |
|---|---|---|
| `chat_msg` | Inbound | Encrypted text message |
| `media_share` | Inbound | Encrypted Cloudinary media URL |
| `binary_stroke` | Bidirectional | 5-byte canvas stroke coordinate |
| `canvas_clear` | Bidirectional | Wipe canvas command |
| `peer_status` | Inbound | Number of connected clients in room |
| `room_full` | Inbound | Third-client rejection signal |
| `reaction` | Bidirectional | Emoji reaction on a message ID |
| `connect_error` | Inbound | Auth or connection failure |

---

## Project Structure

```
Duo-Console/
├── duo-console-core/
│   └── server.js          # Node.js Socket.io relay server
└── frontend/
    └── src/
        ├── App.tsx                        # Root — routes ConnectScreen ↔ ChatInterface
        ├── components/
        │   ├── ConnectScreen.tsx          # URL + PSK entry form
        │   ├── ChatInterface.tsx          # Main session shell, message state, boss mode
        │   ├── Sidebar.tsx                # Slide-in panel wrapper for drawing canvas
        │   ├── DrawingCanvas.tsx          # HTML5 canvas, stroke handlers, binary emit
        │   └── ImageViewer.tsx            # Image gallery, compression pipeline, upload
        ├── hooks/
        │   └── useSocket.ts               # Socket.io client lifecycle + all emitters
        └── utils/
            └── crypto.ts                  # AES encrypt/decrypt wrappers (CryptoJS)
```

---

## Getting Started

### 1. Start the relay server

```bash
cd duo-console-core
npm install
node server.js
```

Server binds to port `3000`.

### 2. Expose the server via Ngrok

```bash
ngrok http 3000
```

Copy the generated HTTPS forwarding URL (e.g. `https://abc123.ngrok-free.app`).

### 3. Start the frontend (development)

```bash
cd frontend
npm install
npm run dev
```

Open the Vite dev URL in both browsers. Paste the Ngrok URL and your shared PSK, then click Connect.

### 4. Build for production

```bash
cd frontend
npm run build
```

Deploy the `dist/` folder to Vercel or any static host.

---

## Environment Notes

- The `AUTH_TOKEN` in `server.js` and `useSocket.ts` must match exactly. Update both before deploying.
- Add your Vercel production URL to the `cors.origin` array in `server.js` before going live.
- Ngrok URLs are ephemeral — a new URL is generated each session. Both users need the current day's URL.
