import { useState } from "react";
import ConnectScreen from "./components/ConnectScreen";
import ChatInterface from "./components/ChatInterface";
import "./App.css";

export default function App() {
  const [connectionString, setConnectionString] = useState("");

  if (!connectionString) {
    return <ConnectScreen onConnect={setConnectionString} />;
  }

  return <ChatInterface connectionString={connectionString} />;
}
