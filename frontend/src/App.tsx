import { useState } from 'react'
import ConnectScreen from './components/ConnectScreen'
import ChatInterface from './components/ChatInterface'
import './App.css'

export default function App() {
  const [connected, setConnected] = useState(false)
  const [username, setUsername] = useState('')

  const handleConnect = (name: string) => {
    setUsername(name)
    setConnected(true)
  }

  if (!connected) {
    return <ConnectScreen onConnect={handleConnect} />
  }

  return <ChatInterface username={username} />
}
