import { useState } from 'react'

interface ImageViewerProps {
  isOpen: boolean
  onClose: () => void
  images?: string[]
}

const DEFAULT_IMAGES: { label: string; gradient: string }[] = [
  { label: 'Abstract 1', gradient: 'linear-gradient(135deg, #7c5cfc, #5c3cfc)' },
  { label: 'Abstract 2', gradient: 'linear-gradient(135deg, #ff4d6a, #ff6b4a)' },
  { label: 'Abstract 3', gradient: 'linear-gradient(135deg, #4ade80, #22d3ee)' },
  { label: 'Abstract 4', gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)' },
]

export default function ImageViewer({ isOpen, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const goNext = () => setCurrentIndex((i) => (i + 1) % DEFAULT_IMAGES.length)
  const goPrev = () => setCurrentIndex((i) => (i - 1 + DEFAULT_IMAGES.length) % DEFAULT_IMAGES.length)

  if (!isOpen) return null

  const image = DEFAULT_IMAGES[currentIndex]

  return (
    <div className="image-viewer-overlay" onClick={onClose}>
      <div className="image-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="image-viewer-header">
          <span className="image-viewer-label">{image.label}</span>
          <button className="image-viewer-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="image-viewer-body">
          <button className="image-nav-btn prev" onClick={goPrev}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="image-display" style={{ background: image.gradient }}>
            <div className="image-placeholder-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          </div>

          <button className="image-nav-btn next" onClick={goNext}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="image-viewer-footer">
          <div className="image-dots">
            {DEFAULT_IMAGES.map((_, i) => (
              <button
                key={i}
                className={`image-dot ${i === currentIndex ? 'active' : ''}`}
                onClick={() => setCurrentIndex(i)}
              />
            ))}
          </div>
          <span className="image-counter">{currentIndex + 1} / {DEFAULT_IMAGES.length}</span>
        </div>
      </div>
    </div>
  )
}
