import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import DrawingCanvas from "./DrawingCanvas";

interface Message {
  id: number;
  sender: "left" | "right";
  text: string;
  time: string;
}

interface ChatInterfaceProps {
  connectionString: string;
}

const imageCards = [
  {
    title: "Snack treaty",
    tag: "truce no. 01",
    caption: "When the argument ends because fries arrived.",
    colors: ["#ff4fb8", "#ffe45e"],
  },
  {
    title: "Midnight nonsense",
    tag: "voice note energy",
    caption: "Half confession, half meme dump, fully unserious.",
    colors: ["#2bf6ff", "#111111"],
  },
  {
    title: "Tiny fight museum",
    tag: "dramatic archive",
    caption: "Receipts preserved with zero historical neutrality.",
    colors: ["#ff6b35", "#8cff00"],
  },
  {
    title: "Doodle pact",
    tag: "best chaos",
    caption: "You draw something ugly. They make it worse. Perfect.",
    colors: ["#7b61ff", "#ffd166"],
  },
];

const starterMessages: Message[] = [
  {
    id: 1,
    sender: "left",
    text: "Connection accepted. Don’t make the console boring.",
    time: "now",
  },
  {
    id: 2,
    sender: "right",
    text: "Impossible. I brought snacks and terrible sketches.",
    time: "now",
  },
];

export default function ChatInterface({
  connectionString,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [message, setMessage] = useState("");
  const [activeSender, setActiveSender] = useState<"left" | "right">("right");
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [activeCard, setActiveCard] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    const text = message.trim();
    if (!text) return;

    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        sender: activeSender,
        text,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
    setMessage("");
    setActiveSender((sender) => (sender === "left" ? "right" : "left"));
  };

  const handleMessageKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const previousCard = () => {
    setActiveCard(
      (index) => (index - 1 + imageCards.length) % imageCards.length,
    );
  };

  const nextCard = () => {
    setActiveCard((index) => (index + 1) % imageCards.length);
  };

  const card = imageCards[activeCard];

  return (
    <main className={`console-page ${canvasOpen ? "canvas-is-open" : ""}`}>
      <header className="console-topbar">
        <div className="brand-lockup" aria-label="Duo Console">
          <span className="brand-tile brand-a">✦</span>
          <span className="brand-tile brand-b">✧</span>
          <div>
            <p>Duo console</p>
            <span></span>
          </div>
        </div>

        <div className="connection-chip" title={connectionString}>
          <span className="chip-dot" />
          <span>{connectionString}</span>
        </div>

        <button
          className="canvas-toggle"
          type="button"
          onClick={() => setCanvasOpen((open) => !open)}
        >
          {canvasOpen ? "Hide canvas" : "Open canvas"}
        </button>
      </header>

      <section className="console-grid">
        <section className="chat-panel" aria-label="Chat interface">
          <div className="panel-heading brutal-heading">
            <span>CHAT PIT</span>
            <strong>{messages.length} notes</strong>
          </div>

          <div className="chat-feed">
            {messages.map((item) => (
              <article key={item.id} className={`chat-bubble ${item.sender}`}>
                <div className="bubble-meta">
                  <span>{item.sender === "left" ? "Lane A" : "Lane B"}</span>
                  <time>{item.time}</time>
                </div>
                <p>{item.text}</p>
              </article>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <footer className="message-composer">
            <div className="sender-switch" aria-label="Choose message lane">
              <button
                type="button"
                className={activeSender === "left" ? "active" : ""}
                onClick={() => setActiveSender("left")}
              >
                Lane A
              </button>
              <button
                type="button"
                className={activeSender === "right" ? "active" : ""}
                onClick={() => setActiveSender("right")}
              >
                Lane B
              </button>
            </div>
            <div className="composer-row">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleMessageKeyDown}
                placeholder="Type chaos here..."
                rows={2}
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

        <aside className="image-card-panel" aria-label="Image cards">
          <div className="panel-heading brutal-heading">
            <span>IMAGE CARDS</span>
            <strong>
              {activeCard + 1}/{imageCards.length}
            </strong>
          </div>

          <article
            className="friend-card"
            style={{
              background: `linear-gradient(135deg, ${card.colors[0]}, ${card.colors[1]})`,
            }}
          >
            <span className="friend-card-tag">{card.tag}</span>
            <h2>{card.title}</h2>
            <p>{card.caption}</p>
            <div className="card-chaos-lines" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </article>

          <div className="card-controls">
            <button
              type="button"
              onClick={previousCard}
              aria-label="Previous image card"
            >
              ←
            </button>
            <div className="card-dots" aria-hidden="true">
              {imageCards.map((item, index) => (
                <span
                  key={item.title}
                  className={index === activeCard ? "active" : ""}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={nextCard}
              aria-label="Next image card"
            >
              →
            </button>
          </div>
        </aside>

        <aside className="canvas-panel" aria-label="Drawing canvas">
          <div className="panel-heading brutal-heading">
            <span>DOODLE DAMAGE</span>
            <strong>toggle panel</strong>
          </div>
          <DrawingCanvas />
        </aside>
      </section>
    </main>
  );
}
