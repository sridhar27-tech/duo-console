import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
  type DragEvent,
} from "react";

interface ImageItem {
  id: string;
  label: string;
  url: string; // Base64 or ObjectURL
  originalSize?: string;
  compressedSize?: string;
  ratio?: string;
}

interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_GALLERY: ImageItem[] = [
  {
    id: "abstract-1",
    label: "Warm Correspondence",
    url: "linear-gradient(135deg, #e65100, #bf360c)",
    originalSize: "2.4 MB",
    compressedSize: "68 KB",
    ratio: "-97%",
  },
  {
    id: "abstract-2",
    label: "Wax Seal",
    url: "linear-gradient(135deg, #d84315, #880e4f)",
    originalSize: "1.8 MB",
    compressedSize: "52 KB",
    ratio: "-97%",
  },
  {
    id: "abstract-3",
    label: "Midnight Sketch",
    url: "linear-gradient(135deg, #37474f, #1a1614)",
    originalSize: "3.1 MB",
    compressedSize: "84 KB",
    ratio: "-97%",
  },
];

export default function ImageViewer({ isOpen, onClose }: ImageViewerProps) {
  const [gallery, setGallery] = useState<ImageItem[]>(DEFAULT_GALLERY);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDrawing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const goNext = useCallback(
    () => setCurrentIndex((i) => (i + 1) % gallery.length),
    [gallery.length],
  );
  const goPrev = useCallback(
    () => setCurrentIndex((i) => (i - 1 + gallery.length) % gallery.length),
    [gallery.length],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, gallery, goNext, goPrev, onClose]);

  if (!isOpen) return null;

  // Processing pipeline
  const processImage = (file: File) => {
    const originalSizeKb = (file.size / 1024).toFixed(1);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Downscaling logic (Max 600px axis)
        const maxAxis = 600;
        if (width > maxAxis || height > maxAxis) {
          if (width > height) {
            height = Math.round((height * maxAxis) / width);
            width = maxAxis;
          } else {
            width = Math.round((width * maxAxis) / height);
            height = maxAxis;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Fill with white background first (for JPEGs transparent handling)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Compression: JPEG at 50% quality
        canvas.toBlob(
          (blob) => {
            if (!blob) return;
            const compressedSizeKb = (blob.size / 1024).toFixed(1);
            const ratioPercent = Math.round(
              ((blob.size - file.size) / file.size) * 100,
            );

            const blobUrl = URL.createObjectURL(blob);
            const newImage: ImageItem = {
              id: `uploaded-${Date.now()}`,
              label:
                file.name.substring(0, file.name.lastIndexOf(".")) || file.name,
              url: blobUrl,
              originalSize: `${originalSizeKb} KB`,
              compressedSize: `${compressedSizeKb} KB`,
              ratio: `${ratioPercent}%`,
            };

            setGallery((prev) => [newImage, ...prev]);
            setCurrentIndex(0); // Focus on new upload
          },
          "image/jpeg",
          0.5,
        );
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImage(e.target.files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDrawing(true);
  };

  const handleDragLeave = () => {
    setIsDrawing(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDrawing(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImage(e.dataTransfer.files[0]);
    }
  };

  const activeItem = gallery[currentIndex];
  const isGradient = activeItem.url.startsWith("linear-gradient");

  return (
    <div className="image-viewer-overlay" onClick={onClose}>
      <div className="image-viewer-v2" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="image-viewer-header">
          <div className="image-header-title-wrap">
            <span className="image-viewer-subtitle-v2">PORTFOLIO</span>
            <span className="image-viewer-label-v2">{activeItem.label}</span>
          </div>
          <button
            className="image-viewer-close-v2"
            onClick={onClose}
            aria-label="Close panel"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="image-viewer-body-v2">
          {/* Main Display and Nav */}
          <div
            className={`image-display-section ${isDragging ? "drag-active" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <button
              className="image-nav-btn-v2 prev"
              onClick={goPrev}
              aria-label="Previous image"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <div className="image-viewport-wrapper">
              {isGradient ? (
                <div
                  className="image-display-v2 gradient"
                  style={{ background: activeItem.url }}
                >
                  <div className="gradient-badge">Theme Sample</div>
                  <div className="image-placeholder-icon">
                    <svg
                      width="56"
                      height="56"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth="1.25"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </div>
                </div>
              ) : (
                <img
                  className="image-display-v2 file-image"
                  src={activeItem.url}
                  alt={activeItem.label}
                />
              )}
            </div>

            <button
              className="image-nav-btn-v2 next"
              onClick={goNext}
              aria-label="Next image"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Stats & Pipeline details */}
          <div className="image-stats-sidebar">
            <h4 className="stats-title">Optimization Pipeline</h4>

            <div className="stats-metric-box">
              <div className="metric-row">
                <span className="metric-label">Raw Buffer:</span>
                <span className="metric-value original">
                  {activeItem.originalSize || "N/A"}
                </span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Optimized JPEG (50%):</span>
                <span className="metric-value compressed">
                  {activeItem.compressedSize || "N/A"}
                </span>
              </div>
              <div className="metric-row highlight">
                <span className="metric-label">Space Saved:</span>
                <span className="metric-value ratio">
                  {activeItem.ratio || "0%"}
                </span>
              </div>
            </div>

            <div className="image-upload-trigger-area">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                style={{ display: "none" }}
              />
              <button
                className="upload-deck-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload & Optimize
              </button>
              <p className="upload-tip-text">
                Or drag and drop image file directly here.
              </p>
            </div>
          </div>
        </div>

        {/* Thumbnail Carousel Footer */}
        <div className="image-viewer-footer-v2">
          <div className="thumbnail-scroller">
            {gallery.map((item, i) => {
              const isItemGradient = item.url.startsWith("linear-gradient");
              return (
                <button
                  key={item.id}
                  className={`thumb-button ${i === currentIndex ? "active" : ""}`}
                  onClick={() => setCurrentIndex(i)}
                  title={item.label}
                  style={isItemGradient ? { background: item.url } : undefined}
                >
                  {!isItemGradient && <img src={item.url} alt="" />}
                </button>
              );
            })}
          </div>
          <span className="image-counter-v2">
            {currentIndex + 1} of {gallery.length}
          </span>
        </div>
      </div>
    </div>
  );
}
