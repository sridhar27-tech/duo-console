import { useState, type FormEvent } from "react";

interface ConnectScreenProps {
  onConnect: (connectionString: string, psk: string) => void;
}

export default function ConnectScreen({ onConnect }: ConnectScreenProps) {
  const [url, setUrl] = useState("");
  const [psk, setPsk] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedUrl = url.trim();
    const trimmedPsk = psk.trim();
    if (trimmedUrl && trimmedPsk) onConnect(trimmedUrl, trimmedPsk);
  };

  const ready = url.trim() && psk.trim();

  return (
    <main className="connect-stage">
      <form className="connect-card" onSubmit={handleSubmit}>
        <h1>duo console</h1>

        <label className="connect-label" htmlFor="url-input">
          Ngrok URL
        </label>
        <input
          id="url-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…ngrok-free.app"
          autoComplete="off"
          autoFocus
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
        />

        <button type="submit" disabled={!ready}>
          Connect →
        </button>
      </form>
    </main>
  );
}
