import type { MutableRefObject } from 'react'
import DrawingCanvas from './DrawingCanvas'

interface SidebarProps {
  id?: string
  isOpen: boolean
  onClose: () => void
  onStroke?: (x: number, y: number, opcode: 0x01 | 0x02, color: string) => void
  onClear?: () => void
  clearRef?: MutableRefObject<(() => void) | null>
  peerStrokeRef?: MutableRefObject<((buffer: ArrayBuffer) => void) | null>
  onExportSnapshot?: (file: File) => void
}

export default function Sidebar({
  id,
  isOpen,
  onClose,
  onStroke,
  onClear,
  clearRef,
  peerStrokeRef,
  onExportSnapshot,
}: SidebarProps) {
  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        id={id}
        className={`sidebar ${isOpen ? 'open' : ''}`}
        aria-label="Drawing canvas panel"
        aria-hidden={!isOpen}
      >
        <div className="sidebar-header">
          <div className="panel-heading brutal-heading" style={{ flex: 1, border: 'none', marginBottom: 0 }}>
            <span>DOODLE DAMAGE</span>
            <strong>canvas</strong>
          </div>
          <button
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close canvas panel"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <DrawingCanvas
          onStroke={onStroke}
          onClear={onClear}
          clearRef={clearRef}
          peerStrokeRef={peerStrokeRef}
          onExportSnapshot={onExportSnapshot}
        />
      </aside>
    </>
  )
}
