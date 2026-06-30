import { useState } from "react";
import ConnectScreen from "./components/ConnectScreen";
import ChatInterface from "./components/ChatInterface";
import "./App.css";

export default function App() {
  const [connectionString, setConnectionString] = useState("");
  const [psk, setPsk] = useState("");

  const handleConnect = (url: string, key: string) => {
    setConnectionString(url);
    setPsk(key);
  };

  if (!connectionString || !psk) {
    return <ConnectScreen onConnect={handleConnect} />;
  }

  return <ChatInterface connectionString={connectionString} psk={psk} />;
}
