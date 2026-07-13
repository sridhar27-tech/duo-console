import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import Sidebar from "./Sidebar";
import ImageViewer from "./ImageViewer";
import { useSocket, type ChatPayload } from "../hooks/useSocket";
import { encryptAES, decryptAES } from "../utils/crypto";

interface Message {
  id: number;
  sender: "me" | "peer";
  text: string;
  time: string;
  reactions: Record<string, number>; // emoji → count
}

interface ChatInterfaceProps {
  connectionString: string;
  psk: string;
}

export default function ChatInterface({
  connectionString,
  psk,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [roomFull, setRoomFull] = useState(false);
  const [activeReactionId, setActiveReactionId] = useState<number | null>(null);

  // Gate 3: Boss trigger — tracks whether the feed is wiped from view
  const [bossMode, setBossMode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const canvasClearRef = useRef<(() => void) | null>(null);
  const peerStrokeRef = useRef<((x: number, y: number) => void) | null>(null);

  // ── Scroll to bottom when new messages arrive ──────────────────────────────
  useEffect(() => {
    if (!bossMode) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, bossMode]);

  // ── Incoming chat message handler ──────────────────────────────────────────
  const handleIncomingChat = useCallback(
    (payload: ChatPayload) => {
      const plaintext = decryptAES(payload.cipher, psk);
      if (!plaintext) return; // wrong key or tampered payload — silently discard

      setMessages((current) => [
        ...current,
        {
          id: payload.ts,
          sender: "peer",
          text: plaintext,
          reactions: {},
          time: new Date(payload.ts).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    },
    [psk],
  );

  // ── Incoming reaction from peer ────────────────────────────────────────────
  const handleIncomingReaction = useCallback(
    (payload: { msgId: number; emoji: string }) => {
      setMessages((current) =>
        current.map((msg) =>
          msg.id === payload.msgId
            ? {
                ...msg,
                reactions: {
                  ...msg.reactions,
                  [payload.emoji]: (msg.reactions[payload.emoji] ?? 0) + 1,
                },
              }
            : msg,
        ),
      );
    },
    [],
  );

  // ── Incoming binary stroke — decode 5-byte buffer and paint on canvas ──────
  const handleBinaryStroke = useCallback((buffer: ArrayBuffer) => {
    const view = new DataView(buffer);
    const opcode = view.getUint8(0);
    if (opcode !== 0x01) return;
    const x = view.getUint16(1, false); // big-endian
    const y = view.getUint16(3, false);
    peerStrokeRef.current?.(x, y);
  }, []);

  // ── Socket hook ────────────────────────────────────────────────────────────
  const { sendChatMsg, sendBinaryStroke, sendCanvasClear, sendReaction } = useSocket({
    serverUrl: connectionString,
    onChatMsg: handleIncomingChat,
    onMediaShare: () => {},
    onBinaryStroke: handleBinaryStroke,
    onCanvasClear: () => {
      canvasClearRef.current?.();
    },
    onPeerStatus: ({ connected }) => setPeerOnline(connected >= 2),
    onRoomFull: () => setRoomFull(true),
    onAuthError: (reason) => setAuthError(reason),
    onReaction: handleIncomingReaction,
  });

  // ── Gate 3: Escape key boss trigger ────────────────────────────────────────
  // Instantly clears the visible message feed and wipes the canvas
  // when Escape is pressed — leaves a blank, uninformative screen.
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !imageViewerOpen) {
        setBossMode((prev) => {
          const next = !prev;
          if (next) {
            // Wipe canvas visual immediately
            canvasClearRef.current?.();
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [imageViewerOpen]);

  // ── Send a message ─────────────────────────────────────────────────────────
  const sendMessage = () => {
    const text = message.trim();
    if (!text) return;

    const ts = Date.now();
    const cipher = encryptAES(text, psk);

    // Optimistic local append (sender = "me")
    setMessages((current) => [
      ...current,
      {
        id: ts,
        sender: "me",
        text,
        reactions: {},
        time: new Date(ts).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

    // Emit encrypted ciphertext — server routes it without decrypting
    sendChatMsg({ cipher, ts });
    setMessage("");
  };

  // ── React to a message ─────────────────────────────────────────────────────
  const handleReact = useCallback(
    (msgId: number, emoji: string) => {
      // Apply locally
      setMessages((current) =>
        current.map((msg) =>
          msg.id === msgId
            ? {
                ...msg,
                reactions: {
                  ...msg.reactions,
                  [emoji]: (msg.reactions[emoji] ?? 0) + 1,
                },
              }
            : msg,
        ),
      );
      // Sync to peer
      sendReaction({ msgId, emoji });
      setActiveReactionId(null);
    },
    [sendReaction],
  );

  const handleMessageKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  // ── Render guards ──────────────────────────────────────────────────────────
  if (authError) {
    return (
      <main className="connect-stage">
        <div className="connect-card">
          <h1>connection refused</h1>
          <p style={{ fontWeight: 900, color: "var(--orange)" }}>{authError}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (roomFull) {
    return (
      <main className="connect-stage">
        <div className="connect-card">
          <h1>room full</h1>
          <p style={{ fontWeight: 900 }}>
            Only two clients allowed at a time.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="console-page">
        <header className="console-topbar">
          <div className="brand-lockup" aria-label="Duo Console">
            <span className="brand-tile brand-a">✦</span>
            <span className="brand-tile brand-b">✧</span>
            <div>
              <p>Duo console</p>
              <span>System Log Index</span>
            </div>
          </div>

          <div className="connection-chip" title={connectionString}>
            <span
              className="chip-dot"
              style={{ background: peerOnline ? "var(--acid)" : "var(--orange)" }}
              title={peerOnline ? "Peer online" : "Waiting for peer"}
            />
            <span>{connectionString}</span>
          </div>

          <div className="topbar-actions">
            <button
              className="canvas-toggle"
              type="button"
              onClick={() => setImageViewerOpen(true)}
            >
              Images
            </button>
            <button
              className="canvas-toggle"
              type="button"
              onClick={() => setCanvasOpen((open) => !open)}
              aria-expanded={canvasOpen}
              aria-controls="canvas-sidebar"
            >
              {canvasOpen ? "Hide canvas" : "Open canvas"}
            </button>
          </div>
        </header>

        {/* Gate 3: Boss trigger overlay */}
        {bossMode && (
          <div
            className="boss-overlay"
            role="status"
            aria-label="Display cleared"
          >
            <p>Module 4: Spatial Vector Processing Controls</p>
            <span className="boss-hint">Press Esc to restore</span>
          </div>
        )}

        {!bossMode && (
          <section className="console-grid">
            {/* ── Chat Panel ── */}
            <section className="chat-panel" aria-label="Chat interface">
              <div className="panel-heading brutal-heading">
                <span>CHAT PIT</span>
                <strong>{messages.length} notes</strong>
              </div>

              <div className="chat-feed">
                {messages.length === 0 && (
                  <p className="chat-empty">
                    Waiting for transmission…
                  </p>
                )}
                {messages.map((item) => (
                  <article
                    key={item.id}
                    className={`chat-bubble ${item.sender === "me" ? "right" : "left"}`}
                  >
                    <div className="bubble-meta">
                      <span>{item.sender === "me" ? "Lane B" : "Lane A"}</span>
                      <time>{item.time}</time>
                    </div>
                    <p>{item.text}</p>

                    {/* ── Reactions row ── */}
                    <div className="reaction-row">
                      {Object.entries(item.reactions).map(([emoji, count]) => (
                        <span key={emoji} className="reaction-chip">
                          {emoji} {count > 1 && <strong>{count}</strong>}
                        </span>
                      ))}
                      <button
                        className="reaction-trigger"
                        type="button"
                        aria-label="Add reaction"
                        onClick={() =>
                          setActiveReactionId(
                            activeReactionId === item.id ? null : item.id,
                          )
                        }
                      >
                        +
                      </button>
                      {activeReactionId === item.id && (
                        <div className="reaction-picker" role="toolbar" aria-label="Pick a reaction">
                          {["👍", "❤️", "😂", "😮", "🔥"].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="reaction-option"
                              onClick={() => handleReact(item.id, emoji)}
                              aria-label={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <footer className="message-composer">
                <div className="composer-row">
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={handleMessageKeyDown}
                    placeholder="Type chaos here… (Enter to send)"
                    rows={2}
                    aria-label="Message input"
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={!message.trim()}
                  >
                    Send
                  </button>
                </div>
              </footer>
            </section>
          </section>
        )}
      </main>

      {/* ── Canvas Sidebar ── */}
      <Sidebar
        id="canvas-sidebar"
        isOpen={canvasOpen}
        onClose={() => setCanvasOpen(false)}
        onStroke={sendBinaryStroke}
        onClear={sendCanvasClear}
        clearRef={canvasClearRef}
        peerStrokeRef={peerStrokeRef}
      />

      <ImageViewer
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
      />
    </>
  );
}
