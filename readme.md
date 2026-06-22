# Spatial Vector Processing (SVP)

Spatial Vector Processing (SVP) is a high-performance, two-party socket programming architecture built for low-latency text communication and real-time canvas synchronization over secure local tunnels. Designed to bypass network restrictions with a zero-cloud backend footprint, the system connects a globally accessible static frontend with a local Node.js relay server using Socket.io over a persistent TCP pipeline.

---

## Architecture Overview

The system implements a stateful Client-Server topology utilizing a hybrid local-cloud infrastructure. The backend server runs locally on a host machine, exposed to the WAN via an encrypted tunnel, while the static frontend interface is hosted on a CDN.

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

### Components and Logic Justifications

* **Socket.io Relay Server (Local Host):** Built on Node.js, this stateful layer handles connection persistence, heartbeat monitoring, and client multiplexing. Socket.io runs over the TCP stack, guaranteeing that packets are delivered in exact chronological order. If a connection drops temporarily due to network migration, Socket.io buffers outbound packets in memory and flushes them immediately upon re-connection.
* **Ngrok Tunneling Proxy:** Exposes the local Node.js server port to the public internet via an ephemeral, randomized URL. It manages automated TLS/SSL termination, transforming unencrypted local traffic into a secure HTTPS/WSS stream. This satisfies the browser's Mixed-Content blocking policies when connecting from a cloud-hosted frontend.
* **Vercel Static Hosting:** Deploys the uncompiled frontend interface. This grants the remote client a permanent access point without requiring any local developer environment setup.
* **Cloudinary Media API:** Offloads binary image transmission from the stateful socket architecture to an asynchronous HTTPS asset bucket, preventing Head-of-Line blocking within the real-time pipe.

---

## Hybrid Protocol Specifications

To ensure maximum throughput under strict or throttled network conditions, the system isolates high-frequency drawing actions from low-frequency messaging actions.

```
                  +─── [ JSON String Data ] ─────► Text Messages & Cloudinary Links
                  │                                (High Security / Low Frequency)
[ Data Router ] ──+
                  │
                  └─── [ Binary ArrayBuffer ] ───► Live Canvas Drawing Coordinates
                                                   (Low Latency / High Frequency)

```

### 1. High-Frequency Vector Stream (Binary)

Canvas coordinates are packed frame-for-frame into a custom, raw 5-byte memory allocation block (`ArrayBuffer`) and emitted over a dedicated `binary_stroke` channel:

* **Byte 0 (1 Byte):** Opcode Operational Identifier (`0x01` identifies drawing data).
* **Bytes 1-2 (2 Bytes / Uint16):** X-coordinate value (supports displays up to 65,535 pixels).
* **Bytes 3-4 (2 Bytes / Uint16):** Y-coordinate value.

*Justification:* Standard JSON representation of coordinates (`{"x":1024,"y":768}`) requires 25 to 40 bytes. Serializing directly to a raw bitstream downsizes individual packet sizes by up to 80%. This removes serialization lag, eliminating the need for client-side throttling and enabling sub-millisecond drawing feedback.

### 2. Low-Frequency Messaging Stream (JSON)

Text messages and Cloudinary media links are structured into standard stringified JSON blocks and emitted over the `chat_msg` and `media_share` channels. This occurs intermittently, making the minimal framing overhead negligible.

---

## Cryptographic and Security Gates

Absolute exclusivity is maintained via three independent authentication and security layers:

* **Gate 1: Handshake Token Validation:** During the initialization of the WebSocket protocol, the client must pass a hardcoded authorization token inside the connection handshake metadata. If this token does not match the server's environment variable, the Node.js backend drops the socket instantly via `socket.disconnect(true)`.
* **Gate 2: End-to-End Encryption (E2EE):** Text payloads and Cloudinary link strings are encrypted on the client device using symmetric **AES-GCM** via the CryptoJS library before hitting the network. The server only routes ciphertext string payloads. If the data is captured via an intermediary router or packet sniffer, it renders as unreadable cryptographic garbage.
* **Gate 3: Self-Clearing Local Caches:** A hardware-level keypress event listener monitors the active window. Pressing the `Escape` key immediately flushes the visible text message arrays from DOM memory and clears the canvas vector canvas space, acting as an instant manual clean utility.

---

## Image Optimization Pipeline

To maintain socket lane integrity, high-resolution smartphone imagery undergoes automated client-side downscaling and compression prior to upload:

1. **Interception:** A file reader event pauses transmission before any network request occurs.
2. **Rasterization:** The raw file is drawn to an invisible, memory-isolated HTML5 canvas layout.
3. **Downscaling:** The logic scales the image dimensions to a strict maximum 600-pixel axis boundary while preserving the aspect ratio.
4. **Compression:** The canvas exports the data as a compressed JPEG blob set to a 50% quality matrix (`image/jpeg`, 0.5), shrinking multi-megabyte source files down to light 50KB to 100KB packets before cloud transport.

---

## Walkthrough: System Launch Sequence

### Step 1: Initialize Local Host Server

Navigate to the directory containing your backend code and start the Node.js application:

```bash
npm install express socket.io
node server.js

```

The application will start, listening for local data traffic on port 3000.

### Step 2: Establish the WAN Bridge

Open a secondary terminal window and initialize the Ngrok tunneling instance to expose your local port:

```bash
ngrok http 3000

```

Locate the forwarding line in the status output interface and copy the generated secure URL (e.g., `https://abcdef123.ngrok-free.app`). Leave this terminal running to maintain the live bridge.

### Step 3: Access the Frontend Portal

1. Open the Vercel-deployed static URL on both devices.
2. Paste the active day's Ngrok URL string into the initialization input bar at the top of the interface.
3. Input your matching Pre-Shared Key (PSK) if prompted by your specific configuration.
4. Click Connect.

### Step 4: Verification of Secure Link

The terminal interface log view will display a green system diagnostic line reading `Tunnel established successfully.` You can now exchange end-to-end encrypted text messages, transmit compressed media elements, and draw on the canvas space in real time with absolute pixel fluidity. Closing the terminal windows on your host laptop instantly destroys the tunnel and drops the application entirely offline.