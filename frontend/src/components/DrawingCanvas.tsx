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
   * Called when the local user draws a stroke point.
   * opcode 0x01 = new stroke begin, 0x02 = continue stroke.
   * color is the current ink hex string.
   * The parent packs these into an 8-byte binary ArrayBuffer and emits via socket.
   */
  onStroke?: (x: number, y: number, opcode: 0x01 | 0x02, color: string) => void;
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
  peerStrokeRef?: MutableRefObject<((buffer: ArrayBuffer) => void) | null>;
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
  // The parent decodes the incoming 8-byte ArrayBuffer and calls this
  // with the full stroke context to draw on the local canvas.
  useEffect(() => {
    if (!peerStrokeRef) return;
    peerStrokeRef.current = (buffer: ArrayBuffer) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;

      const view = new DataView(buffer);
      const opcode = view.getUint8(0);
      const x = view.getUint16(1, false);
      const y = view.getUint16(3, false);
      const r = view.getUint8(5);
      const g = view.getUint8(6);
      const b = view.getUint8(7);
      const color = `rgb(${r},${g},${b})`;

      const pixelRatio = window.devicePixelRatio || 1;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.strokeStyle = color;
      context.lineWidth = 7; // peer uses mid brush; local brush size doesn't affect peer render
      context.lineCap = "round";
      context.lineJoin = "round";

      if (opcode === 0x01) {
        // New stroke — begin a fresh path at this point
        context.beginPath();
        context.moveTo(x, y);
      } else {
        // Continue existing stroke
        context.lineTo(x, y);
        context.stroke();
      }
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

    // Opcode 0x01 — signals the peer to beginPath at this coordinate
    onStroke?.(point.x, point.y, 0x01, color);
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

    // Opcode 0x02 — signals the peer to lineTo and stroke at this coordinate
    onStroke?.(point.x, point.y, 0x02, color);
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
