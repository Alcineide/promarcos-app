import { Camera, Check, ChevronLeft, FlipHorizontal, Image, RotateCcw, Scan, Trash2, Upload, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface CapturedPage {
  id: string;
  dataUrl: string;
  blob: Blob;
  fileName: string;
}

interface DocumentScannerProps {
  tipoDcumento: string;
  clienteNome: string;
  onUpload: (pages: CapturedPage[]) => Promise<void>;
  onClose: () => void;
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

type ScanStep = "camera" | "review" | "uploading" | "done";

export function DocumentScanner({ tipoDcumento, clienteNome, onUpload, onClose }: DocumentScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<ScanStep>("camera");
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [flash, setFlash] = useState(false);
  const [uploading, setUploading] = useState(false);

  const startCamera = useCallback(async (mode: "environment" | "user") => {
    setCameraError(null);
    setCameraReady(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraReady(true);
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
        setCameraError("Permissão de câmera negada. Clique no ícone de câmera na barra do navegador para liberar o acesso.");
      } else if (msg.includes("NotFoundError")) {
        setCameraError("Câmera não encontrada neste dispositivo.");
      } else {
        setCameraError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
      }
    }
  }, []);

  useEffect(() => {
    if (step === "camera") {
      startCamera(facingMode);
    }
    return () => {
      if (step !== "camera") {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [step, facingMode, startCamera]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  function flipCamera() {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  }

  function captureFrame() {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d")!;

    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Flash effect
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const ts = Date.now();
        const safeName = clienteNome.replace(/\s+/g, "_").replace(/[^\w_]/g, "").substring(0, 40);
        const fileName = `${safeName}_${tipoDcumento.replace(/\s+/g, "_")}_${ts}_p${pages.length + 1}.jpg`;
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        setPages(prev => [...prev, { id: makeId(), dataUrl, blob, fileName }]);
      },
      "image/jpeg",
      0.92
    );
  }

  function removePage(id: string) {
    setPages(prev => prev.filter(p => p.id !== id));
  }

  async function handleSend() {
    if (pages.length === 0) return;
    setUploading(true);
    try {
      await onUpload(pages);
      setStep("done");
    } catch {
      // error handled by caller
    } finally {
      setUploading(false);
    }
  }

  function goToReview() {
    if (pages.length === 0) return;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStep("review");
  }

  function goBackToCamera() {
    setStep("camera");
  }

  // ---- STEP: DONE ----
  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-10 px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground mb-1">Enviado com sucesso!</h3>
          <p className="text-muted-foreground text-sm">
            {pages.length} página{pages.length !== 1 ? "s" : ""} de <strong>{tipoDcumento}</strong> salvas no Promarcos
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-8 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors"
        >
          Concluir
        </button>
      </div>
    );
  }

  // ---- STEP: REVIEW ----
  if (step === "review") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button onClick={goBackToCamera} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex-1">
            <p className="font-semibold text-foreground text-sm">{tipoDcumento}</p>
            <p className="text-xs text-muted-foreground">{pages.length} página{pages.length !== 1 ? "s" : ""} capturada{pages.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={goBackToCamera} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
            <Camera className="w-3.5 h-3.5" />
            + Adicionar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
              <Scan className="w-12 h-12 opacity-30" />
              <p className="text-sm">Nenhuma página. Volte e escaneie documentos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {pages.map((page, idx) => (
                <div key={page.id} className="relative rounded-xl overflow-hidden border border-border shadow-sm aspect-[3/4] bg-muted">
                  <img src={page.dataUrl} alt={`Página ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs font-semibold px-2 py-0.5 rounded-md">
                    Pág. {idx + 1}
                  </div>
                  <button
                    onClick={() => removePage(page.id)}
                    className="absolute top-1 right-1 w-7 h-7 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-4 border-t border-border">
          <button
            onClick={handleSend}
            disabled={pages.length === 0 || uploading}
            className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Enviar {pages.length} página{pages.length !== 1 ? "s" : ""} ao Promarcos
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ---- STEP: CAMERA (default) ----
  return (
    <div className="flex flex-col h-full bg-black relative overflow-hidden">
      {/* Flash overlay */}
      {flash && <div className="absolute inset-0 bg-white z-50 opacity-80 pointer-events-none" />}

      {/* Canvas (hidden, used for capture) */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera error state */}
      {cameraError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <Camera className="w-16 h-16 text-white/30" />
          <p className="text-white/70 text-sm">{cameraError}</p>
          <button
            onClick={() => startCamera(facingMode)}
            className="px-4 py-2 bg-white/20 text-white rounded-xl text-sm font-semibold hover:bg-white/30 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {/* Live video */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="flex-1 w-full h-full object-cover"
            style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
          />

          {/* Document frame guide overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative" style={{ width: "75%", aspectRatio: "0.707" }}>
              {/* Corner marks */}
              {[
                "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-lg",
                "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-lg",
                "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-lg",
                "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-lg",
              ].map((cls, i) => (
                <div key={i} className={`absolute w-8 h-8 border-white ${cls}`} />
              ))}
              {/* Dim overlay outside the frame */}
              <div className="absolute inset-0 rounded-lg ring-[2000px] ring-black/50" />
            </div>
          </div>

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-3 pb-3 bg-gradient-to-b from-black/60 to-transparent">
            <button onClick={onClose} className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="text-center">
              <p className="text-white font-semibold text-sm">{tipoDcumento}</p>
              <p className="text-white/70 text-xs">{clienteNome}</p>
            </div>
            <button onClick={flipCamera} className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors">
              <FlipHorizontal className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Bottom bar */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-4 bg-gradient-to-t from-black/70 to-transparent">
            <p className="text-center text-white/70 text-xs mb-4">
              Posicione o documento dentro das marcas e toque em Escanear
            </p>
            <div className="flex items-center justify-between">
              {/* Thumbnails / gallery link */}
              <div className="w-16 flex items-center justify-center">
                {pages.length > 0 ? (
                  <button
                    onClick={goToReview}
                    className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-white shadow-lg"
                  >
                    <img src={pages[pages.length - 1].dataUrl} alt="preview" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 right-0 bg-primary text-white text-xs font-bold px-1.5 py-0.5 rounded-tl-md">
                      {pages.length}
                    </div>
                  </button>
                ) : (
                  <div className="w-14 h-14 rounded-xl border-2 border-white/30 flex items-center justify-center">
                    <Image className="w-6 h-6 text-white/40" />
                  </div>
                )}
              </div>

              {/* Shutter button */}
              <button
                onClick={captureFrame}
                disabled={!cameraReady}
                className="w-20 h-20 rounded-full bg-white disabled:opacity-40 flex items-center justify-center shadow-xl active:scale-95 transition-transform"
              >
                <div className="w-16 h-16 rounded-full border-4 border-gray-300 bg-white flex items-center justify-center">
                  <Scan className="w-7 h-7 text-primary" />
                </div>
              </button>

              {/* Review / done */}
              <div className="w-16 flex flex-col items-center justify-center">
                {pages.length > 0 ? (
                  <button
                    onClick={goToReview}
                    className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
                  >
                    <Check className="w-6 h-6" />
                    <span className="text-xs font-semibold">Revisar</span>
                  </button>
                ) : (
                  <div className="w-14" />
                )}
              </div>
            </div>
          </div>

          {/* Loading indicator */}
          {!cameraReady && !cameraError && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <p className="text-white text-sm">Iniciando câmera...</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
