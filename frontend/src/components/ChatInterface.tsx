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
import { useAudioFX } from "../hooks/useAudioFX";
import {
  type ThemeId,
  nextTheme,
  applyTheme,
  setCRTMode,
  loadPreferences,
  savePreferences,
  THEMES,
} from "../utils/themeConfig";

// ── Pulling Cloudinary Config Safe from Vite Environment ────────────────────
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "duo_console_preset";

interface Message {
  id: number;
  sender: "me" | "peer";
  text: string;
  time: string;
  mediaUrl?: string;
  reactions: Record<string, number>;
}

interface ChatInterfaceProps {
  connectionString: string;
  psk: string;
}

const SPINNER_FRAMES = ["/", "—", "\\", "|"] as const;

function TerminalSpinner() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 200);
    return () => clearInterval(id);
  }, []);
  return <span className="typing-spinner" aria-hidden="true">{SPINNER_FRAMES[frame]}</span>;
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

  // Gate 3: Boss trigger
  const [bossMode, setBossMode] = useState(false);

  // Typing indicator
  const [peerIsTyping, setPeerIsTyping] = useState(false);

  // ── Theme / SFX / CRT — loaded from localStorage on mount ─────────────────
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => loadPreferences().sfxEnabled);
  const [theme, setTheme] = useState<ThemeId>(() => loadPreferences().theme);
  const [crtEnabled, setCrtEnabled] = useState<boolean>(() => loadPreferences().crtEnabled);

  // Apply persisted theme + CRT on first render
  useEffect(() => {
    applyTheme(theme);
    setCRTMode(crtEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Audio FX — muted flag driven by sfxEnabled state ──────────────────────
  const { playKeyclick, playReceive, playTransmit, playHandshake, playBossAlarm } =
    useAudioFX(!sfxEnabled);

  const chatFeedRef = useRef<HTMLDivElement>(null);
  const canvasClearRef = useRef<(() => void) | null>(null);
  const peerStrokeRef = useRef<((buffer: ArrayBuffer) => void) | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingEmittedRef = useRef(false);

  useEffect(() => {
    if (!bossMode && chatFeedRef.current) {
      chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight;
    }
  }, [messages, bossMode]);

  // ── Incoming chat message handler ─────────────────────────────────────────
  const handleIncomingChat = useCallback(
    (payload: ChatPayload) => {
      const plaintext = decryptAES(payload.cipher, psk);
      if (!plaintext) return;

      playReceive();

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
    [psk, playReceive],
  );

  const handleIncomingMedia = useCallback(
    (payload: { msgId: string; mediaUrl: string; timestamp: number }) => {
      setMessages((current) => [
        ...current,
        {
          id: payload.timestamp,
          sender: "peer",
          text: "[Shared Image]",
          mediaUrl: payload.mediaUrl,
          reactions: {},
          time: new Date(payload.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    },
    []
  );

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

  const handleBinaryStroke = useCallback((buffer: ArrayBuffer) => {
    peerStrokeRef.current?.(buffer);
  }, []);

  // ── Socket hook ───────────────────────────────────────────────────────────
  const { sendChatMsg, sendBinaryStroke, sendCanvasClear, sendReaction, sendMediaShare, sendTypingState } = useSocket({
    serverUrl: connectionString,
    onChatMsg: handleIncomingChat,
    onMediaShare: handleIncomingMedia,
    onBinaryStroke: handleBinaryStroke,
    onCanvasClear: () => { canvasClearRef.current?.(); },
    onPeerStatus: ({ connected }) => {
      const online = connected >= 2;
      if (online && !peerOnline) playHandshake();
      setPeerOnline(online);
    },
    onRoomFull: () => setRoomFull(true),
    onAuthError: (reason) => setAuthError(reason),
    onReaction: handleIncomingReaction,
    onTypingState: ({ isTyping }) => setPeerIsTyping(isTyping),
  });

  const handleMediaUploadAndShare = async (compressedFile: File) => {
    if (!CLOUD_NAME) {
      console.error("Cloudinary Cloud Name is missing in .env config!");
      return;
    }
    const formData = new FormData();
    formData.append("file", compressedFile);
    formData.append("upload_preset", UPLOAD_PRESET);
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      );
      if (!response.ok) throw new Error(`CDN upload failed: ${response.status}`);
      const uploadData = await response.json();
      const secureUrl = uploadData.secure_url;
      const ts = Date.now();
      const msgId = `media-${Math.random().toString(36).substr(2, 9)}`;
      setMessages((current) => [
        ...current,
        {
          id: ts,
          sender: "me",
          text: "[Shared Image]",
          mediaUrl: secureUrl,
          reactions: {},
          time: new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      sendMediaShare?.({ msgId, mediaUrl: secureUrl, timestamp: ts });
    } catch (err) {
      console.error("Cloudinary network drop:", err);
      alert("Failed to transit compiled image. Verification dropped.");
    }
  };

  // ── Gate 3: Escape — boss alarm ───────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !imageViewerOpen) {
        setBossMode((prev) => {
          const next = !prev;
          if (next) {
            canvasClearRef.current?.();
            playBossAlarm();
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [imageViewerOpen, playBossAlarm]);

  // ── Debounced typing state + keyclick ─────────────────────────────────────
  const handleTypingChange = useCallback(
    (value: string) => {
      setMessage(value);

      if (value.length > message.length) playKeyclick();

      if (!value) {
        if (isTypingEmittedRef.current) {
          sendTypingState(false);
          isTypingEmittedRef.current = false;
        }
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        return;
      }
      if (!isTypingEmittedRef.current) {
        sendTypingState(true);
        isTypingEmittedRef.current = true;
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        sendTypingState(false);
        isTypingEmittedRef.current = false;
      }, 1500);
    },
    [sendTypingState, message, playKeyclick],
  );

  // ── Send message + transmit beep ──────────────────────────────────────────
  const sendMessage = () => {
    const text = message.trim();
    if (!text) return;
    const ts = Date.now();
    const cipher = encryptAES(text, psk);
    setMessages((current) => [
      ...current,
      {
        id: ts,
        sender: "me",
        text,
        reactions: {},
        time: new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    sendChatMsg({ cipher, ts });
    setMessage("");
    playTransmit();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (isTypingEmittedRef.current) {
      sendTypingState(false);
      isTypingEmittedRef.current = false;
    }
  };

  const handleReact = useCallback(
    (msgId: number, emoji: string) => {
      setMessages((current) =>
        current.map((msg) =>
          msg.id === msgId
            ? { ...msg, reactions: { ...msg.reactions, [emoji]: (msg.reactions[emoji] ?? 0) + 1 } }
            : msg,
        ),
      );
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

  // ── Theme / SFX / CRT toggle handlers ────────────────────────────────────
  const handleThemeCycle = useCallback(() => {
    const next = nextTheme(theme);
    setTheme(next);
    applyTheme(next);
    savePreferences(next, sfxEnabled, crtEnabled);
  }, [theme, sfxEnabled, crtEnabled]);

  const handleSfxToggle = useCallback(() => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    savePreferences(theme, next, crtEnabled);
  }, [sfxEnabled, theme, crtEnabled]);

  const handleCrtToggle = useCallback(() => {
    const next = !crtEnabled;
    setCrtEnabled(next);
    setCRTMode(next);
    savePreferences(theme, sfxEnabled, next);
  }, [crtEnabled, theme, sfxEnabled]);

  if (authError) {
    return (
      <main className="connect-stage">
        <div className="connect-card">
          <h1>connection refused</h1>
          <p style={{ fontWeight: 900, color: "var(--orange)" }}>{authError}</p>
          <button type="button" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </main>
    );
  }

  if (roomFull) {
    return (
      <main className="connect-stage">
        <div className="connect-card">
          <h1>room full</h1>
          <p style={{ fontWeight: 900 }}>Only two clients allowed at a time.</p>
          <button type="button" onClick={() => window.location.reload()}>Try again</button>
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
            {/* ── System control bar ── */}
            <div className="control-bar" role="toolbar" aria-label="Display and audio controls">
              <button
                className="ctrl-btn"
                type="button"
                onClick={handleThemeCycle}
                title="Cycle colour theme"
                aria-label={`Current theme: ${THEMES.find(t => t.id === theme)?.label}. Click to cycle.`}
              >
                THEME: {THEMES.find(t => t.id === theme)?.label}
              </button>
              <button
                className={`ctrl-btn ${crtEnabled ? "active" : "inactive"}`}
                type="button"
                onClick={handleCrtToggle}
                title="Toggle CRT scanline overlay"
                aria-pressed={crtEnabled}
              >
                CRT: {crtEnabled ? "ON" : "OFF"}
              </button>
              <button
                className={`ctrl-btn ${sfxEnabled ? "active" : "inactive"}`}
                type="button"
                onClick={handleSfxToggle}
                title="Toggle sound effects"
                aria-pressed={sfxEnabled}
              >
                SFX: {sfxEnabled ? "ON" : "OFF"}
              </button>
            </div>

            <button className="canvas-toggle" type="button" onClick={() => setImageViewerOpen(true)}>
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

        {bossMode && (
          <div className="boss-overlay" role="status" aria-label="Display cleared">
            <p>Module 4: Spatial Vector Processing Controls</p>
            <span className="boss-hint">Press Esc to restore</span>
          </div>
        )}

        {!bossMode && (
          <section className="console-grid">
            <section className="chat-panel" aria-label="Chat interface">
              <div className="panel-heading brutal-heading">
                <span>CHAT PIT</span>
                <strong>{messages.length} notes</strong>
              </div>

              <div className="chat-feed" ref={chatFeedRef}>
                {messages.length === 0 && (
                  <p className="chat-empty">Waiting for transmission…</p>
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
                    {item.mediaUrl ? (
                      <div className="chat-media-attachment">
                        <img
                          src={item.mediaUrl}
                          alt="Encrypted CDN Asset"
                          className="chat-embedded-image"
                          style={{ maxWidth: "100%", borderRadius: "4px", border: "2px solid var(--fg)" }}
                        />
                      </div>
                    ) : (
                      <p>{item.text}</p>
                    )}
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
                          setActiveReactionId(activeReactionId === item.id ? null : item.id)
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
              </div>

              <footer className="message-composer">
                {peerIsTyping && (
                  <div className="typing-indicator" role="status" aria-live="polite">
                    <span className="typing-text">typing</span>
                    <TerminalSpinner />
                  </div>
                )}
                <div className="composer-row">
                  <textarea
                    value={message}
                    onChange={(event) => handleTypingChange(event.target.value)}
                    onKeyDown={handleMessageKeyDown}
                    placeholder="Type chaos here… (Enter to send)"
                    rows={2}
                    aria-label="Message input"
                  />
                  <button type="button" onClick={sendMessage} disabled={!message.trim()}>
                    Send
                  </button>
                </div>
              </footer>
            </section>
          </section>
        )}
      </main>

      <Sidebar
        id="canvas-sidebar"
        isOpen={canvasOpen}
        onClose={() => setCanvasOpen(false)}
        onStroke={sendBinaryStroke}
        onClear={sendCanvasClear}
        clearRef={canvasClearRef}
        peerStrokeRef={peerStrokeRef}
        onExportSnapshot={handleMediaUploadAndShare}
      />

      <ImageViewer
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        onShare={handleMediaUploadAndShare}
      />
    </>
  );
}
