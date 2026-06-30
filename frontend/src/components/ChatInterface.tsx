import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import DrawingCanvas from "./DrawingCanvas";
import ImageViewer from "./ImageViewer";
import { useSocket, type ChatPayload } from "../hooks/useSocket";
import { encryptAES, decryptAES } from "../utils/crypto";

interface Message {
  id: number;
  sender: "me" | "peer";
  text: string;
  time: string;
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
          time: new Date(payload.ts).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    },
    [psk],
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
  const { sendChatMsg, sendBinaryStroke, sendCanvasClear } = useSocket({
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
      <main className={`console-page ${canvasOpen ? "canvas-is-open" : ""}`}>
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

            {/* ── Canvas Panel ── */}
            <aside className="canvas-panel" aria-label="Drawing canvas">
              <div className="panel-heading brutal-heading">
                <span>DOODLE DAMAGE</span>
                <strong>toggle panel</strong>
              </div>
              <DrawingCanvas
                onStroke={sendBinaryStroke}
                onClear={sendCanvasClear}
                clearRef={canvasClearRef}
                peerStrokeRef={peerStrokeRef}
              />
            </aside>
          </section>
        )}
      </main>

      <ImageViewer
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
      />
    </>
  );
}
