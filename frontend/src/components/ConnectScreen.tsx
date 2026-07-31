import { useState, type FormEvent } from "react";
import { DEFAULT_SOCKET_URL } from "../hooks/useSocket";

interface ConnectScreenProps {
  onConnect: (connectionString: string, psk: string) => void;
}

export default function ConnectScreen({ onConnect }: ConnectScreenProps) {
  // Pre-fill the URL from VITE_SOCKET_URL so the host only needs to share the PSK.
  // The field remains editable — paste a new Ngrok URL at any time.
  const [url, setUrl] = useState(DEFAULT_SOCKET_URL);
  const [psk, setPsk] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedUrl = url.trim();
    const trimmedPsk = psk.trim();
    if (trimmedUrl && trimmedPsk) onConnect(trimmedUrl, trimmedPsk);
  };

  const ready = url.trim() && psk.trim();

  // True when the field still holds the env-configured default (not localhost)
  const urlIsFromEnv =
    DEFAULT_SOCKET_URL !== "http://localhost:3000" &&
    url.trim() === DEFAULT_SOCKET_URL;

  return (
    <main className="connect-stage">
      <form className="connect-card" onSubmit={handleSubmit}>
        <h1>duo console</h1>

        <label className="connect-label" htmlFor="url-input">
          Server URL
          {urlIsFromEnv && (
            <span className="connect-label-hint" aria-label="Pre-filled from environment">
              ⚡ from env
            </span>
          )}
        </label>
        <input
          id="url-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…ngrok-free.app"
          autoComplete="off"
          // Only auto-focus the URL field if it isn't already filled
          autoFocus={!urlIsFromEnv}
        />

        <label className="connect-label" htmlFor="psk-input">
          Pre-Shared Key (PSK)
        </label>
        <input
          id="psk-input"
          type="password"
          value={psk}
          onChange={(e) => setPsk(e.target.value)}
          placeholder="shared encryption key"
          autoComplete="off"
          // Auto-focus PSK when URL is already filled — saves a click for the host
          autoFocus={urlIsFromEnv}
        />

        <button type="submit" disabled={!ready}>
          Connect →
        </button>
      </form>
    </main>
  );
}
