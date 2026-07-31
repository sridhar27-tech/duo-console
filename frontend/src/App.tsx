import { useState } from "react";
import ConnectScreen from "./components/ConnectScreen";
import ChatInterface from "./components/ChatInterface";
import "./App.css";

// ── Auto-connect shortcut ─────────────────────────────────────────────────────
// When both VITE_SOCKET_URL and VITE_DEFAULT_PSK are set in the environment,
// skip the connect screen entirely and jump straight into the chat session.
// Useful for the host machine where both values are already known.
// The guest should leave VITE_DEFAULT_PSK empty so they always see the form.
const ENV_URL = import.meta.env.VITE_SOCKET_URL?.trim() || "";
const ENV_PSK = import.meta.env.VITE_DEFAULT_PSK?.trim() || "";
const AUTO_CONNECT = Boolean(ENV_URL && ENV_PSK);

export default function App() {
  const [connectionString, setConnectionString] = useState(
    AUTO_CONNECT ? ENV_URL : "",
  );
  const [psk, setPsk] = useState(AUTO_CONNECT ? ENV_PSK : "");

  const handleConnect = (url: string, key: string) => {
    setConnectionString(url);
    setPsk(key);
  };

  if (!connectionString || !psk) {
    return <ConnectScreen onConnect={handleConnect} />;
  }

  return <ChatInterface connectionString={connectionString} psk={psk} />;
}
