import { Check, Crop, RefreshCw, RotateCcw, RotateCw } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };

interface PerspectiveCropProps {
  imageSrc: string;
  onConfirm: (croppedBlob: Blob, dataUrl: string) => void;
  onRetake: () => void;
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------
function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i];
  }
  return x;
}

function computeHomography(src: Point[], dst: Point[]): number[][] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dx);
    b.push(dy);
  }
  const h = gaussianElimination(A, b);
  return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
}

function applyH(H: number[][], x: number, y: number): Point {
  const w = H[2][0] * x + H[2][1] * y + H[2][2];
  return { x: (H[0][0] * x + H[0][1] * y + H[0][2]) / w, y: (H[1][0] * x + H[1][1] * y + H[1][2]) / w };
}

function dist(a: Point, b: Point) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function warpPerspective(src: HTMLCanvasElement, corners: Point[]): HTMLCanvasElement {
  const outW = Math.round(Math.max(dist(corners[0], corners[1]), dist(corners[3], corners[2])));
  const outH = Math.round(Math.max(dist(corners[0], corners[3]), dist(corners[1], corners[2])));
  const scale = Math.min(1, 1600 / outW);
  const dstW = Math.round(outW * scale);
  const dstH = Math.round(outH * scale);

  const out = document.createElement("canvas");
  out.width = dstW;
  out.height = dstH;
  const ctx = out.getContext("2d")!;

  const dstCorners: Point[] = [
    { x: 0, y: 0 }, { x: dstW, y: 0 }, { x: dstW, y: dstH }, { x: 0, y: dstH },
  ];
  const srcCorners = corners.map((p) => ({ x: p.x * scale, y: p.y * scale }));

  const scaledSrc = document.createElement("canvas");
  scaledSrc.width = Math.round(src.width * scale);
  scaledSrc.height = Math.round(src.height * scale);
  scaledSrc.getContext("2d")!.drawImage(src, 0, 0, scaledSrc.width, scaledSrc.height);

  const H_inv = computeHomography(dstCorners, srcCorners);
  const srcCtx = scaledSrc.getContext("2d")!;
  const srcData = srcCtx.getImageData(0, 0, scaledSrc.width, scaledSrc.height);
  const outData = ctx.createImageData(dstW, dstH);

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const { x: sx, y: sy } = applyH(H_inv, x, y);
      const sx0 = Math.round(sx);
      const sy0 = Math.round(sy);
      if (sx0 < 0 || sx0 >= scaledSrc.width || sy0 < 0 || sy0 >= scaledSrc.height) continue;
      const si = (sy0 * scaledSrc.width + sx0) * 4;
      const di = (y * dstW + x) * 4;
      outData.data[di] = srcData.data[si];
      outData.data[di + 1] = srcData.data[si + 1];
      outData.data[di + 2] = srcData.data[si + 2];
      outData.data[di + 3] = srcData.data[si + 3];
    }
  }
  ctx.putImageData(outData, 0, 0);
  return out;
}

/** Rotate an image data URL 90° in given direction, returns new data URL */
function rotateImageDataUrl(src: string, direction: "left" | "right"): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalHeight;
      c.height = img.naturalWidth;
      const ctx = c.getContext("2d")!;
      if (direction === "right") {
        ctx.translate(c.width, 0);
        ctx.rotate(Math.PI / 2);
      } else {
        ctx.translate(0, c.height);
        ctx.rotate(-Math.PI / 2);
      }
      ctx.drawImage(img, 0, 0);
      resolve(c.toDataURL("image/jpeg", 0.95));
    };
    img.onerror = reject;
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// HANDLE size: large enough to grab comfortably on mobile
// ---------------------------------------------------------------------------
const HANDLE_R = 24; // px — visual radius
const HIT_R = 36;   // px — hit radius (larger than visual for easier touch)

const CORNER_LABELS = ["TL", "TR", "BR", "BL"];
const CORNER_COLORS = ["#3B82F6", "#3B82F6", "#3B82F6", "#3B82F6"];

export function PerspectiveCrop({ imageSrc: initialSrc, onConfirm, onRetake }: PerspectiveCropProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [processing, setProcessing] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [corners, setCorners] = useState<Point[]>([]);
  const [imgRect, setImgRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragging = useRef<number | null>(null);

  const initCorners = useCallback(() => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;
    const ir = img.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    const x = ir.left - cr.left;
    const y = ir.top - cr.top;
    const w = ir.width;
    const h = ir.height;
    setImgRect({ x, y, w, h });
    const padX = w * 0.05;
    const padY = h * 0.05;
    setCorners([
      { x: x + padX,       y: y + padY },
      { x: x + w - padX,   y: y + padY },
      { x: x + w - padX,   y: y + h - padY },
      { x: x + padX,       y: y + h - padY },
    ]);
  }, []);

  useEffect(() => {
    window.addEventListener("resize", initCorners);
    return () => window.removeEventListener("resize", initCorners);
  }, [initCorners]);

  // Draw overlay canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || corners.length < 4) return;
    const cr = container.getBoundingClientRect();
    canvas.width = cr.width;
    canvas.height = cr.height;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dark mask outside selection
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Dashed border
    ctx.strokeStyle = "#3B82F6";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Corner L-brackets (CamScanner style) + circle handle
    corners.forEach((p, i) => {
      // Shadow
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 8;

      // White outer circle
      ctx.beginPath();
      ctx.arc(p.x, p.y, HANDLE_R, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.shadowBlur = 0;

      // Blue ring
      ctx.strokeStyle = CORNER_COLORS[i];
      ctx.lineWidth = 3;
      ctx.stroke();

      // Blue inner dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = CORNER_COLORS[i];
      ctx.fill();

      // Corner L-bracket marks
      const armLen = 18;
      ctx.strokeStyle = "#3B82F6";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      const dx = i === 0 || i === 3 ? -armLen : armLen;
      const dy = i === 0 || i === 1 ? -armLen : armLen;
      ctx.moveTo(p.x + dx, p.y);
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(p.x, p.y + dy);
      ctx.stroke();

      // Corner index hint
      void CORNER_LABELS[i]; // unused but keeps the array
    });
  }, [corners]);

  function getPos(e: React.PointerEvent): Point {
    const cr = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - cr.left, y: e.clientY - cr.top };
  }

  function findClosestCorner(pos: Point): number | null {
    for (let i = 0; i < corners.length; i++) {
      if (dist(corners[i], pos) < HIT_R) return i;
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const pos = getPos(e);
    const idx = findClosestCorner(pos);
    if (idx !== null) {
      dragging.current = idx;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragging.current === null || !imgRect) return;
    const pos = getPos(e);
    const clamped: Point = {
      x: Math.max(imgRect.x - HANDLE_R, Math.min(imgRect.x + imgRect.w + HANDLE_R, pos.x)),
      y: Math.max(imgRect.y - HANDLE_R, Math.min(imgRect.y + imgRect.h + HANDLE_R, pos.y)),
    };
    setCorners((prev) => prev.map((p, i) => (i === dragging.current ? clamped : p)));
  }

  function onPointerUp() { dragging.current = null; }

  async function handleRotate(dir: "left" | "right") {
    if (rotating || processing) return;
    setRotating(true);
    try {
      const rotated = await rotateImageDataUrl(currentSrc, dir);
      setCurrentSrc(rotated);
      // Re-init corners after image re-renders
      setTimeout(initCorners, 80);
    } finally {
      setRotating(false);
    }
  }

  function handleResetCorners() {
    initCorners();
  }

  async function handleConfirm() {
    if (!imgRect || corners.length < 4) return;
    setProcessing(true);
    try {
      const img = new Image();
      img.src = currentSrc;
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });

      const srcCanvas = document.createElement("canvas");
      srcCanvas.width = img.naturalWidth;
      srcCanvas.height = img.naturalHeight;
      srcCanvas.getContext("2d")!.drawImage(img, 0, 0);

      const scaleX = img.naturalWidth / imgRect.w;
      const scaleY = img.naturalHeight / imgRect.h;
      const srcCorners = corners.map((p) => ({
        x: (p.x - imgRect.x) * scaleX,
        y: (p.y - imgRect.y) * scaleY,
      }));

      const result = await new Promise<HTMLCanvasElement>((res) =>
        setTimeout(() => res(warpPerspective(srcCanvas, srcCorners)), 0)
      );

      result.toBlob(
        (blob) => {
          if (!blob) { setProcessing(false); return; }
          onConfirm(blob, result.toDataURL("image/jpeg", 0.92));
        },
        "image/jpeg", 0.92
      );
    } catch (err) {
      console.error("Perspective error:", err);
      setProcessing(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-black select-none overflow-hidden">
      {/* ── FIXED HEADER ─ not absolute, so image area starts below it ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/90 border-b border-white/10 flex-shrink-0">
        <div>
          <p className="text-white font-semibold text-sm leading-none">Ajustar bordas</p>
          <p className="text-white/50 text-xs mt-0.5">Arraste os 4 cantos até as bordas do documento</p>
        </div>
        <button
          onClick={handleResetCorners}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white/70 text-xs font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Resetar
        </button>
      </div>

      {/* ── IMAGE + OVERLAY ── flex-1 so it fills between header and toolbar ── */}
      <div
        ref={containerRef}
        className="flex-1 relative"
        style={{ touchAction: "none", minHeight: 0 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          ref={imgRef}
          src={currentSrc}
          alt="Capturado"
          className="w-full h-full object-contain"
          onLoad={initCorners}
          draggable={false}
          style={{ display: "block" }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "none" }}
        />
        {rotating && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* ── CamScanner-style BOTTOM TOOLBAR ── */}
      <div className="flex-shrink-0 bg-black border-t border-white/10">
        {/* Action buttons row */}
        <div className="flex items-center px-3 py-3 gap-2">
          {/* Retomar */}
          <button
            onClick={onRetake}
            disabled={processing || rotating}
            className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border border-white/20 text-white/70 hover:bg-white/10 transition-colors disabled:opacity-40 min-w-[64px]"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="text-[11px] font-medium">Repetir</span>
          </button>

          {/* Girar esquerda */}
          <button
            onClick={() => handleRotate("left")}
            disabled={processing || rotating}
            className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border border-white/20 text-white/70 hover:bg-white/10 transition-colors disabled:opacity-40 min-w-[64px]"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="text-[11px] font-medium">Esquerda</span>
          </button>

          {/* Girar direita */}
          <button
            onClick={() => handleRotate("right")}
            disabled={processing || rotating}
            className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border border-white/20 text-white/70 hover:bg-white/10 transition-colors disabled:opacity-40 min-w-[64px]"
          >
            <RotateCw className="w-5 h-5" />
            <span className="text-[11px] font-medium">Direita</span>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Confirmar corte — big blue button */}
          <button
            onClick={handleConfirm}
            disabled={processing || rotating}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-bold text-sm transition-colors disabled:opacity-50 shadow-lg shadow-blue-900/40"
          >
            {processing ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Crop className="w-5 h-5" />
            )}
            <span>{processing ? "Processando…" : "Cortar"}</span>
            {!processing && <Check className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
