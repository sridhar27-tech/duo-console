/**
 * useSocket — Socket.io client hook
 *
 * Establishes a single authenticated Socket.io connection per session.
 * The AUTH_TOKEN must match the server-side constant exactly — the server's
 * io.use() middleware validates it during the handshake and drops the
 * connection if it's wrong or missing.
 *
 * Transport order: polling → websocket
 * Polling first lets the initial HTTP handshake complete through the Ngrok
 * proxy without hitting the browser-warning interstitial (suppressed by the
 * ngrok-skip-browser-warning header). Socket.io then upgrades to a raw
 * WebSocket connection for all subsequent traffic.
 *
 * Binary canvas strokes are packed into an 8-byte ArrayBuffer:
 *   Byte 0      → Opcode (0x01 = beginPath, 0x02 = lineTo)
 *   Bytes 1–2   → X (Uint16, big-endian)
 *   Bytes 3–4   → Y (Uint16, big-endian)
 *   Bytes 5–7   → R, G, B (Uint8 each)
 */

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// ── Connection Config ─────────────────────────────────────────────────────────
// VITE_SOCKET_URL is set in frontend/.env for both local dev and production.
// Falls back to localhost:3000 so the server works without an .env file.
const DEFAULT_SOCKET_URL = import.meta.env.VITE_SOCKET_URL?.trim() || "http://localhost:3000";

// Pre-shared token — must match AUTH_TOKEN in duo-console-core/server.js.
const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN?.trim() || "duo-console-secret-2025";

// ── Exported constants — used by ConnectScreen to pre-fill the URL field ─────
export { DEFAULT_SOCKET_URL, AUTH_TOKEN as DEFAULT_AUTH_TOKEN };

export interface ChatPayload {
  cipher: string; // AES-encrypted message text
  iv?: string;    // (optional) IV if you switch to AES-GCM later
  ts: number;     // timestamp for ordering
}

// Updated payload to support structured direct CDN image distribution
export interface MediaPayload {
  msgId: string;
  mediaUrl: string;
  timestamp: number;
}

export interface ReactionPayload {
  msgId: number;
  emoji: string;
}

export interface TypingStatePayload {
  isTyping: boolean;
}

export interface PeerStatus {
  connected: number;
}

interface UseSocketOptions {
  serverUrl: string;
  onChatMsg: (payload: ChatPayload) => void;
  onMediaShare: (payload: MediaPayload) => void;
  onBinaryStroke: (buffer: ArrayBuffer) => void;
  onCanvasClear: () => void;
  onPeerStatus: (status: PeerStatus) => void;
  onRoomFull: () => void;
  onAuthError: (reason: string) => void;
  onReaction: (payload: ReactionPayload) => void;
  onTypingState: (payload: TypingStatePayload) => void;
}

export function useSocket({
  serverUrl,
  onChatMsg,
  onMediaShare,
  onBinaryStroke,
  onCanvasClear,
  onPeerStatus,
  onRoomFull,
  onAuthError,
  onReaction,
  onTypingState,
}: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!serverUrl) return;

    // Resolve the actual URL: prefer the explicit prop (user-pasted Ngrok URL),
    // fall back to the env-configured default so localhost dev needs no input.
    const resolvedUrl = serverUrl.trim() || DEFAULT_SOCKET_URL;

    const socket = io(resolvedUrl, {
      // Gate 1: auth token validated by io.use() middleware on the server
      auth: { token: AUTH_TOKEN },

      // Transport order: polling first, then upgrade to websocket.
      // This is required over Ngrok — the initial HTTP polling request carries
      // the ngrok-skip-browser-warning header which suppresses the interstitial
      // warning page. A direct websocket-only connection skips that header
      // entirely and lands on the warning page instead of the server.
      transports: ["polling", "websocket"],

      // Suppress the Ngrok browser-warning interstitial on the polling request.
      // Ngrok checks for this header on every HTTP request through the tunnel.
      extraHeaders: {
        "ngrok-skip-browser-warning": "true",
      },

      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
    });

    socketRef.current = socket;

    // ── Incoming events ──────────────────────────────────────────────────────
    socket.on("chat_msg", onChatMsg);
    socket.on("media_share", onMediaShare);
    socket.on("binary_stroke", onBinaryStroke);
    socket.on("canvas_clear", onCanvasClear);
    socket.on("peer_status", (statusData: any) => {
      // Formats the server layout ping to match what your React layout expects
      // If server emits string "online", connected count is evaluated as 2
      const isOnline = statusData === "online";
      onPeerStatus({ connected: isOnline ? 2 : 1 });
    });
    socket.on("room_full", onRoomFull);
    socket.on("reaction", onReaction);
    socket.on("typing_state", onTypingState);

    // Join the default room immediately on connect so relay events have context
    socket.on("connect", () => {
      socket.emit("join_room", "duo-main");
    });

    // Handle auth rejection from the server middleware
    socket.on("connect_error", (err) => {
      onAuthError(err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // Re-connect if the URL changes (new Ngrok URL pasted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl]);

  // ── Emitters ──────────────────────────────────────────────────────────────

  // ── Step 3: Dynamic Room Router Hook ──
  // Triggers the server routing switchboard to place the client inside an isolated room.
  const joinRoom = useCallback((roomId: string) => {
    socketRef.current?.emit("join_room", roomId);
  }, []);

  const sendChatMsg = useCallback((payload: ChatPayload) => {
    socketRef.current?.emit("chat_msg", payload);
  }, []);

  const sendMediaShare = useCallback((payload: MediaPayload) => {
    socketRef.current?.emit("media_share", payload);
  }, []);

  /**
   * Pack a stroke point into an 8-byte ArrayBuffer and emit as binary_stroke.
   *
   * Layout:
   *   Byte 0      → Opcode: 0x01 = beginPath (new stroke), 0x02 = lineTo (continue)
   *   Bytes 1–2   → X (Uint16, big-endian)
   *   Bytes 3–4   → Y (Uint16, big-endian)
   *   Byte  5     → R (0–255)
   *   Byte  6     → G (0–255)
   *   Byte  7     → B (0–255)
   *
   * Color is included on every packet so the receiver always has full context.
   */
  const sendBinaryStroke = useCallback(
    (x: number, y: number, opcode: 0x01 | 0x02, color: string) => {
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);

      // Parse hex color (#rrggbb) into R, G, B bytes
      const hex = color.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      view.setUint8(0, opcode);
      view.setUint16(1, Math.round(x), false);
      view.setUint16(3, Math.round(y), false);
      view.setUint8(5, r);
      view.setUint8(6, g);
      view.setUint8(7, b);

      socketRef.current?.emit("binary_stroke", buffer);
    },
    [],
  );

  const sendCanvasClear = useCallback(() => {
    socketRef.current?.emit("canvas_clear");
  }, []);

  const sendReaction = useCallback((payload: ReactionPayload) => {
    socketRef.current?.emit("reaction", payload);
  }, []);

  const sendTypingState = useCallback((isTyping: boolean) => {
    socketRef.current?.emit("typing_state", { isTyping });
  }, []);

  return { 
    joinRoom,
    sendChatMsg, 
    sendMediaShare, 
    sendBinaryStroke, 
    sendCanvasClear, 
    sendReaction,
    sendTypingState,
  };
}