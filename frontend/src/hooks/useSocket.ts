/**
 * useSocket — Socket.io client hook
 */

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// ── Connection Config ─────────────────────────────────────────────────────────
const DEFAULT_SOCKET_URL = import.meta.env.VITE_SOCKET_URL?.trim() || "http://localhost:3000";
const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN?.trim() || "duo-console-secret-2025";

export { DEFAULT_SOCKET_URL, AUTH_TOKEN as DEFAULT_AUTH_TOKEN };

export interface ChatPayload {
  cipher: string;
  iv?: string;
  ts: number;
}

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

  // ── Preserve Latest Callback References Without Reconnecting ───────────────
  const handlersRef = useRef({
    onChatMsg,
    onMediaShare,
    onBinaryStroke,
    onCanvasClear,
    onPeerStatus,
    onRoomFull,
    onAuthError,
    onReaction,
    onTypingState,
  });

  // Keep callback refs fresh on every render
  useEffect(() => {
    handlersRef.current = {
      onChatMsg,
      onMediaShare,
      onBinaryStroke,
      onCanvasClear,
      onPeerStatus,
      onRoomFull,
      onAuthError,
      onReaction,
      onTypingState,
    };
  });

  useEffect(() => {
    // Resolve the actual URL: prefer explicit prop or default env string
    const resolvedUrl = serverUrl.trim() || DEFAULT_SOCKET_URL;

    if (!resolvedUrl) return;

    const socket = io(resolvedUrl, {
      auth: { token: AUTH_TOKEN },
      transports: ["polling", "websocket"],
      extraHeaders: {
        "ngrok-skip-browser-warning": "true",
      },
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // ── Bind Handlers to Mutable Ref Callbacks ────────────────────────────────
    socket.on("chat_msg", (data) => handlersRef.current.onChatMsg(data));
    socket.on("media_share", (data) => handlersRef.current.onMediaShare(data));
    socket.on("binary_stroke", (data) => handlersRef.current.onBinaryStroke(data));
    socket.on("canvas_clear", () => handlersRef.current.onCanvasClear());
    
    socket.on("peer_status", (statusData: any) => {
      const isOnline = statusData === "online" || statusData?.connected === 2 || statusData === 2;
      handlersRef.current.onPeerStatus({ connected: isOnline ? 2 : 1 });
    });

    socket.on("room_full", () => handlersRef.current.onRoomFull());
    socket.on("reaction", (data) => handlersRef.current.onReaction(data));
    socket.on("typing_state", (data) => handlersRef.current.onTypingState(data));

    // Join default room upon establishing connection
    socket.on("connect", () => {
      console.log("[Socket] Connected successfully to:", resolvedUrl);
      socket.emit("join_room", "duo-main");
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection Error:", err.message);
      handlersRef.current.onAuthError(err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl]);

  // ── Emitters ──────────────────────────────────────────────────────────────
  const joinRoom = useCallback((roomId: string) => {
    socketRef.current?.emit("join_room", roomId);
  }, []);

  const sendChatMsg = useCallback((payload: ChatPayload) => {
    socketRef.current?.emit("chat_msg", payload);
  }, []);

  const sendMediaShare = useCallback((payload: MediaPayload) => {
    socketRef.current?.emit("media_share", payload);
  }, []);

  const sendBinaryStroke = useCallback(
    (x: number, y: number, opcode: 0x01 | 0x02, color: string) => {
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);

      const hex = color.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;

      view.setUint8(0, opcode);
      view.setUint16(1, Math.round(x), false);
      view.setUint16(3, Math.round(y), false);
      view.setUint8(5, r);
      view.setUint8(6, g);
      view.setUint8(7, b);

      socketRef.current?.emit("binary_stroke", buffer);
    },
    []
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