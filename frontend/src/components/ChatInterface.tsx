import { useState, useRef, useEffect } from 'react'
import Sidebar from './Sidebar'
import ImageViewer from './ImageViewer'

interface Message {
  id: number
  text: string
  sender: 'user' | 'other'
  time: string
}

interface ChatInterfaceProps {
  username: string
}

const WELCOME_MESSAGE: Message = {
  id: 0,
  text: 'Welcome to Duo Console. Start typing a message below.',
  sender: 'other',
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
}

export default function ChatInterface({ username }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    if (!input.trim()) return
    const userMsg: Message = {
      id: Date.now(),
      text: input.trim(),
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    setTimeout(() => {
      const reply: Message = {
        id: Date.now() + 1,
        text: `Echo: ${userMsg.text}`,
        sender: 'other',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, reply])
    }, 600)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chat-layout">
      <header className="chat-header">
        <div className="chat-header-left">
          <button
            className="header-btn"
            onClick={() => setSidebarOpen(true)}
            title="Toggle Drawing Canvas"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
            <span className="header-btn-label">Draw</span>
          </button>
        </div>

        <div className="chat-header-center">
          <span className="chat-status-dot" />
          <span className="chat-username">{username}</span>
        </div>

        <div className="chat-header-right">
          <button
            className="header-btn"
            onClick={() => setImageViewerOpen(true)}
            title="View Images"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="header-btn-label">Images</span>
          </button>
        </div>
      </header>

      <main className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            <div className="message-bubble">
              <div className="message-sender">{msg.sender === 'user' ? username : 'Duo'}</div>
              <div className="message-text">{msg.text}</div>
              <div className="message-time">{msg.time}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer className="chat-input-bar">
        <div className="chat-input-wrap">
          <textarea
            className="chat-input"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            className="send-btn"
            onClick={sendMessage}
            disabled={!input.trim()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </footer>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <ImageViewer isOpen={imageViewerOpen} onClose={() => setImageViewerOpen(false)} />
    </div>
  )
}
