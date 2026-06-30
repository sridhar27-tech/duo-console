import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
  type MutableRefObject,
} from "react";

const inkColors = ["#111111", "#ff4fb8", "#2bf6ff", "#ffe45e", "#8cff00"];
const brushSizes = [3, 7, 12];

interface DrawingCanvasProps {
  /**
   * Called with (x, y) CSS-space coordinates whenever the local user draws
   * a stroke point. The parent packs these into a 5-byte binary ArrayBuffer
   * and emits them via socket.emit("binary_stroke").
   */
  onStroke?: (x: number, y: number) => void;
  /**
   * Called when the local user clicks Clear — parent should emit
   * socket.emit("canvas_clear") to sync the peer's canvas.
   */
  onClear?: () => void;
  /**
   * A ref callback so the parent can imperatively trigger a local clear
   * (e.g. on incoming canvas_clear event or on Escape boss trigger).
   */
  clearRef?: MutableRefObject<(() => void) | null>;
  /**
   * A ref the parent sets so it can push an incoming peer stroke (x, y)
   * directly onto this canvas without re-renders.
   */
  peerStrokeRef?: MutableRefObject<((x: number, y: number) => void) | null>;
}

export default function DrawingCanvas({
  onStroke,
  onClear,
  clearRef,
  peerStrokeRef,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const resizeCanvasRef = useRef<() => void>(() => {});
  const [color, setColor] = useState(inkColors[0]);
  const [brushSize, setBrushSize] = useState(7);

  // ── Canvas resize with snapshot preservation ──────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const context = canvas.getContext("2d");
      if (!context) return;

      const { width, height } = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      const nextWidth = Math.round(width * pixelRatio);
      const nextHeight = Math.round(height * pixelRatio);

      if (!nextWidth || !nextHeight) return;
      if (canvas.width === nextWidth && canvas.height === nextHeight) return;

      const snapshot = document.createElement("canvas");
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.getContext("2d")?.drawImage(canvas, 0, 0);

      canvas.width = nextWidth;
      canvas.height = nextHeight;

      context.setTransform(1, 0, 0, 1, 0, 0);
      if (snapshot.width && snapshot.height) {
        context.drawImage(
          snapshot,
          0,
          0,
          snapshot.width,
          snapshot.height,
          0,
          0,
          nextWidth,
          nextHeight,
        );
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.lineCap = "round";
      context.lineJoin = "round";
    };

    resizeCanvasRef.current = resizeCanvas;
    resizeCanvas();

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    window.addEventListener("resize", resizeCanvas);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  // ── Expose imperative clear to parent (for boss trigger + peer clear) ──────
  useEffect(() => {
    if (!clearRef) return;
    clearRef.current = () => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      const pixelRatio = window.devicePixelRatio || 1;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };
  }, [clearRef]);

  // ── Expose peer stroke painter to parent ──────────────────────────────────
  // The parent decodes the incoming 5-byte ArrayBuffer and calls this
  // with the x/y CSS-space coordinates to draw on the local canvas.
  useEffect(() => {
    if (!peerStrokeRef) return;
    peerStrokeRef.current = (x: number, y: number) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      const pixelRatio = window.devicePixelRatio || 1;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.lineTo(x, y);
      context.stroke();
    };
  }, [peerStrokeRef]);

  // ── Pointer helpers ───────────────────────────────────────────────────────
  const getPoint = (
    event: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in event) {
      const touch = event.touches[0];
      if (!touch) return null;
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  // ── Drawing handlers ──────────────────────────────────────────────────────
  const startDrawing = (
    event: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>,
  ) => {
    event.preventDefault();
    resizeCanvasRef.current();
    const point = getPoint(event);
    const context = canvasRef.current?.getContext("2d");
    if (!point || !context) return;

    drawingRef.current = true;
    const pixelRatio = window.devicePixelRatio || 1;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = brushSize;
    context.moveTo(point.x, point.y);
  };

  const draw = (
    event: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>,
  ) => {
    event.preventDefault();
    if (!drawingRef.current) return;

    const point = getPoint(event);
    const context = canvasRef.current?.getContext("2d");
    if (!point || !context) return;

    context.lineTo(point.x, point.y);
    context.stroke();

    // Emit binary stroke to peer via parent callback
    onStroke?.(point.x, point.y);
  };

  const stopDrawing = () => {
    drawingRef.current = false;
  };

  // ── Local + remote clear ──────────────────────────────────────────────────
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const pixelRatio = window.devicePixelRatio || 1;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    // Notify peer
    onClear?.();
  };

  return (
    <div className="doodle-board">
      <div className="doodle-toolbar">
        <div className="tool-group" aria-label="Brush colors">
          {inkColors.map((ink) => (
            <button
              key={ink}
              type="button"
              className={`ink-swatch ${color === ink ? "active" : ""}`}
              style={{ backgroundColor: ink }}
              onClick={() => setColor(ink)}
              aria-label={`Use color ${ink}`}
            />
          ))}
        </div>

        <div className="tool-group brush-group" aria-label="Brush sizes">
          {brushSizes.map((size) => (
            <button
              key={size}
              type="button"
              className={brushSize === size ? "active" : ""}
              onClick={() => setBrushSize(size)}
            >
              {size}px
            </button>
          ))}
        </div>

        <button className="clear-doodle" type="button" onClick={clearCanvas}>
          Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="friend-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
    </div>
  );
}
