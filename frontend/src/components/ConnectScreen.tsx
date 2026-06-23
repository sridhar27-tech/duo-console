import { useState, type FormEvent } from "react";

interface ConnectScreenProps {
  onConnect: (connectionString: string) => void;
}

export default function ConnectScreen({ onConnect }: ConnectScreenProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onConnect(trimmed);
  };

  return (
    <main className="connect-stage" aria-labelledby="connect-title">
      <div className="connect-noise" aria-hidden="true" />
      <section className="connect-poster">
        <div className="connect-badge-row" aria-hidden="true">
          <span>BESTIE</span>
          <span className="badge-vs">×</span>
          <span>RIVAL</span>
          <span className="badge-chaos">CHAOS LINE</span>
        </div>

        <div className="connect-mark" aria-hidden="true">
          <span className="mark-half mark-a">✦</span>
          <span className="mark-half mark-b">✧</span>
        </div>

        <div className="connect-copy">
          <p className="connect-kicker">Paste the secret tunnel</p>
          <h1 id="connect-title">Duo console</h1>
          <p className="connect-text">
            One string, one button, one noisy room for messages, doodles, and
            image cards.
          </p>
        </div>

        <form className="connection-form" onSubmit={handleSubmit}>
          <label htmlFor="connection-string">Connection string</label>
          <div className="connection-field">
            <input
              id="connection-string"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="wss://your-tunnel-or-local-line"
              autoComplete="off"
              autoFocus
            />
            <button type="submit" disabled={!value.trim()}>
              Connect
            </button>
          </div>
          <p className="connect-helper">
            UI only for now. This just opens the console and keeps the string
            visible as a badge.
          </p>
        </form>
      </section>
    </main>
  );
}
