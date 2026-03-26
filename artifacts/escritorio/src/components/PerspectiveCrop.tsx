import { Check, RotateCcw } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };

interface PerspectiveCropProps {
  imageSrc: string;
  onConfirm: (croppedBlob: Blob, dataUrl: string) => void;
  onRetake: () => void;
}

// ---------------------------------------------------------------------------
// Math helpers – compute homography and warp perspective on a canvas
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

/** Warp perspective at reduced scale for speed, returns canvas */
function warpPerspective(
  src: HTMLCanvasElement,
  corners: Point[], // TL, TR, BR, BL in src px
): HTMLCanvasElement {
  const outW = Math.round(Math.max(dist(corners[0], corners[1]), dist(corners[3], corners[2])));
  const outH = Math.round(Math.max(dist(corners[0], corners[3]), dist(corners[1], corners[2])));

  // Work at max 1600px wide to keep transform fast
  const scale = Math.min(1, 1600 / outW);
  const dstW = Math.round(outW * scale);
  const dstH = Math.round(outH * scale);

  const out = document.createElement("canvas");
  out.width = dstW;
  out.height = dstH;
  const ctx = out.getContext("2d")!;

  const dstCorners: Point[] = [
    { x: 0, y: 0 },
    { x: dstW, y: 0 },
    { x: dstW, y: dstH },
    { x: 0, y: dstH },
  ];

  const srcCorners = corners.map((p) => ({ x: p.x * scale, y: p.y * scale }));

  // Scale source canvas
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const HANDLE_RADIUS = 22; // px on screen

export function PerspectiveCrop({ imageSrc, onConfirm, onRetake }: PerspectiveCropProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [processing, setProcessing] = useState(false);

  // corners in container-relative px: TL, TR, BR, BL
  const [corners, setCorners] = useState<Point[]>([]);
  const [imgRect, setImgRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragging = useRef<number | null>(null);

  // init corners when image loads
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
    const pad = Math.min(w, h) * 0.08;
    setCorners([
      { x: x + pad, y: y + pad },
      { x: x + w - pad, y: y + pad },
      { x: x + w - pad, y: y + h - pad },
      { x: x + pad, y: y + h - pad },
    ]);
  }, []);

  useEffect(() => {
    window.addEventListener("resize", initCorners);
    return () => window.removeEventListener("resize", initCorners);
  }, [initCorners]);

  // Draw the overlay on a canvas that covers the container
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || corners.length < 4) return;
    const cr = container.getBoundingClientRect();
    canvas.width = cr.width;
    canvas.height = cr.height;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dim outside polygon
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

    // Border
    ctx.strokeStyle = "#4F9EFF";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Handles
    corners.forEach((p, i) => {
      // Outer circle
      ctx.beginPath();
      ctx.arc(p.x, p.y, HANDLE_RADIUS / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "#4F9EFF";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#4F9EFF";
      ctx.fill();
    });
  }, [corners]);

  // Pointer events
  function getPos(e: React.PointerEvent | React.TouchEvent): Point {
    const cr = containerRef.current!.getBoundingClientRect();
    const src = "touches" in e ? (e as React.TouchEvent).touches[0] : (e as React.PointerEvent);
    return { x: src.clientX - cr.left, y: src.clientY - cr.top };
  }

  function findClosestCorner(pos: Point): number | null {
    for (let i = 0; i < corners.length; i++) {
      if (dist(corners[i], pos) < HANDLE_RADIUS) return i;
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent) {
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
    // Clamp inside image bounds
    const clamped: Point = {
      x: Math.max(imgRect.x, Math.min(imgRect.x + imgRect.w, pos.x)),
      y: Math.max(imgRect.y, Math.min(imgRect.y + imgRect.h, pos.y)),
    };
    setCorners((prev) => prev.map((p, i) => (i === dragging.current ? clamped : p)));
  }

  function onPointerUp() {
    dragging.current = null;
  }

  async function handleConfirm() {
    if (!imgRect || corners.length < 4) return;
    setProcessing(true);

    try {
      // Load full image into canvas
      const img = new Image();
      img.src = imageSrc;
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });

      const srcCanvas = document.createElement("canvas");
      srcCanvas.width = img.naturalWidth;
      srcCanvas.height = img.naturalHeight;
      srcCanvas.getContext("2d")!.drawImage(img, 0, 0);

      // Scale corners from container space → image pixel space
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
          if (!blob) return;
          onConfirm(blob, result.toDataURL("image/jpeg", 0.92));
        },
        "image/jpeg",
        0.92
      );
    } catch (err) {
      console.error("Perspective error:", err);
      setProcessing(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-black select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <p className="text-white font-semibold text-sm">Ajustar bordas</p>
        <p className="text-white/60 text-xs">Arraste os cantos para encaixar no documento</p>
      </div>

      {/* Image + overlay */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ touchAction: "none" }}
      >
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Capturado"
          className="w-full h-full object-contain"
          onLoad={initCorners}
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "none" }}
        />
      </div>

      {/* Processing overlay */}
      {processing && (
        <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-white font-semibold">Aplicando correção de perspectiva...</p>
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center gap-3 px-5 py-4 bg-black">
        <button
          onClick={onRetake}
          disabled={processing}
          className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/30 text-white/80 font-semibold text-sm hover:bg-white/10 transition-colors disabled:opacity-40"
        >
          <RotateCcw className="w-4 h-4" />
          Repetir
        </button>
        <button
          onClick={handleConfirm}
          disabled={processing}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm transition-colors disabled:opacity-50"
        >
          <Check className="w-5 h-5" />
          Confirmar corte
        </button>
      </div>
    </div>
  );
}
