import { useState, type FormEvent } from 'react'

interface ConnectScreenProps {
  onConnect: (username: string) => void
}

export default function ConnectScreen({ onConnect }: ConnectScreenProps) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (value.trim()) onConnect(value.trim())
  }

  return (
    <div className="connect-screen">
      <div className="connect-content">
        <div className="connect-brand">
          <div className="connect-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="url(#logo-grad)" />
              <path d="M16 24l6 6 10-12" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="48" y2="48">
                  <stop stopColor="#7c5cfc" />
                  <stop offset="1" stopColor="#5c3cfc" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="connect-title">Duo Console</h1>
          <p className="connect-subtitle">Enter your name to start chatting</p>
        </div>
        <form className="connect-form" onSubmit={handleSubmit}>
          <div className="connect-input-wrap">
            <input
              className="connect-input"
              type="text"
              placeholder="Your name..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              maxLength={32}
            />
          </div>
          <button className="connect-btn" type="submit" disabled={!value.trim()}>
            Connect
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
