"use client";

import React, { useEffect, useRef, useState } from "react";
import { extrairCodigosBarrasInseridos } from "@/lib/estoque-domain";
import { Camera, CameraOff, Plus, ScanBarcode, Trash2, X } from "lucide-react";

interface BarcodeDetectorResult {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: {
      formats?: string[];
    }) => BarcodeDetectorInstance;
  }
}

interface CampoEntradaCodigosBarrasProps {
  codigos: string[];
  onChangeCodigos: (novos: string[]) => void;
  valorDigitando: string;
  onChangeValorDigitando: (valor: string) => void;
  rotulo?: string;
  placeholder?: string;
  ajuda?: string;
  autoFocus?: boolean;
}

export default function CampoEntradaCodigosBarras({
  codigos,
  onChangeCodigos,
  valorDigitando,
  onChangeValorDigitando,
  rotulo = "Código(s) de barras individual(is) do item",
  placeholder = "Bipe ou digite o código individual do item e tecle Enter",
  ajuda = "Cada item físico usa seu próprio código de barras. Tecle Enter ou toque em + para inserir vários códigos de uma vez.",
  autoFocus = false,
}: CampoEntradaCodigosBarrasProps) {
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [erroCamera, setErroCamera] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const adicionarCodigos = (texto: string) => {
    const extraidos = extrairCodigosBarrasInseridos(texto);
    if (extraidos.length === 0) return;

    const existentesUpper = new Set(codigos.map((c) => c.toUpperCase()));
    const novos = [...codigos];

    for (const item of extraidos) {
      if (!existentesUpper.has(item.toUpperCase())) {
        existentesUpper.add(item.toUpperCase());
        novos.push(item);
      }
    }

    onChangeCodigos(novos);
    onChangeValorDigitando("");
    inputRef.current?.focus();
  };

  const removerCodigo = (codigoRemover: string) => {
    onChangeCodigos(codigos.filter((c) => c !== codigoRemover));
  };

  const pararCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraAtiva(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const iniciarLeituraCamera = async () => {
    setErroCamera("");
    if (cameraAtiva) {
      pararCamera();
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setErroCamera(
        "Câmera indisponível neste navegador. Digite ou use leitor USB/Bluetooth."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraAtiva(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 80);

      if (typeof window !== "undefined" && window.BarcodeDetector) {
        const detector = new window.BarcodeDetector({
          formats: [
            "ean_13",
            "ean_8",
            "code_128",
            "code_39",
            "upc_a",
            "upc_e",
            "itf",
            "qr_code",
          ],
        });

        const loop = async () => {
          if (!streamRef.current || !videoRef.current) return;
          try {
            if (videoRef.current.readyState >= 2) {
              const resultados = await detector.detect(videoRef.current);
              if (resultados.length > 0 && resultados[0].rawValue) {
                adicionarCodigos(resultados[0].rawValue);
              }
            }
          } catch {
            // continua tentando próximo frame
          }
          if (streamRef.current) {
            setTimeout(loop, 450);
          }
        };
        setTimeout(loop, 500);
      } else {
        setErroCamera(
          "Este navegador não possui decodificação automática de vídeo (BarcodeDetector). Use Chrome no celular ou digite/bipe com leitor."
        );
      }
    } catch {
      setErroCamera(
        "Não foi possível acessar a câmera. Verifique a permissão ou digite o código."
      );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9]">
          {rotulo}
        </label>
        {codigos.length > 0 && (
          <span className="text-[11px] font-mono font-bold text-[#d8b4fe]">
            {codigos.length} código(s) na lista
          </span>
        )}
      </div>

      {/* Linha de leitura / digitação */}
      <div className="flex items-stretch gap-2">
        <div className="campo-estoque flex-1 flex items-center gap-2">
          <ScanBarcode className="h-4 w-4 text-[#c084fc] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            autoFocus={autoFocus}
            value={valorDigitando}
            onChange={(e) => onChangeValorDigitando(e.target.value)}
            onPaste={(e) => {
              const colado = e.clipboardData.getData("text");
              if (/[\r\n,;]/.test(colado)) {
                e.preventDefault();
                adicionarCodigos(colado);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (valorDigitando.trim()) {
                  e.preventDefault();
                  adicionarCodigos(valorDigitando);
                }
              }
            }}
            placeholder={placeholder}
          />
        </div>

        <button
          type="button"
          onClick={() => adicionarCodigos(valorDigitando)}
          disabled={!valorDigitando.trim()}
          className="px-3.5 rounded-xl bg-[#7c3aed] disabled:bg-[#2a1e47] disabled:text-[#7865a3] hover:bg-[#8b5cf6] text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          title="Adicionar código à lista"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Inserir</span>
        </button>

        <button
          type="button"
          onClick={iniciarLeituraCamera}
          className={`px-3 rounded-xl border text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0 ${
            cameraAtiva
              ? "bg-[#9f1239] border-[#fb7185]/40 text-white"
              : "bg-[#2a1e47] hover:bg-[#38285c] border-[#3a2961] text-[#f6f3ff]"
          }`}
          title="Ler código de barras com a câmera"
        >
          {cameraAtiva ? (
            <CameraOff className="h-4 w-4" />
          ) : (
            <Camera className="h-4 w-4 text-[#d8b4fe]" />
          )}
        </button>
      </div>

      {/* Visor de câmera quando ativo */}
      {cameraAtiva && (
        <div className="relative rounded-xl overflow-hidden border border-[#c084fc]/60 bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full h-44 object-cover"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-4/5 h-16 border-2 border-[#c084fc]/85 rounded-lg relative">
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#d8b4fe] animate-pulse" />
            </div>
          </div>
          <button
            type="button"
            onClick={pararCamera}
            className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-[#120d1d]/85 text-white text-xs flex items-center gap-1 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" /> Fechar câmera
          </button>
        </div>
      )}

      {erroCamera && (
        <p className="text-[11px] text-[#fbbf24]">{erroCamera}</p>
      )}

      {/* Lista de códigos já escaneados / inseridos */}
      {codigos.length > 0 && (
        <div className="rounded-xl bg-[#140e22] border border-[#3a2961] p-2.5 space-y-2 max-h-40 overflow-y-auto">
          <div className="flex items-center justify-between text-[11px] text-[#b5a4d9] px-1">
            <span>Códigos individuais prontos para gravação:</span>
            <button
              type="button"
              onClick={() => onChangeCodigos([])}
              className="inline-flex items-center gap-1 text-[#fb7185] hover:underline cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
              Limpar lista
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {codigos.map((cod, idx) => (
              <span
                key={cod}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2a1e47] border border-[#4c357d] text-xs font-mono text-[#e9d5ff]"
              >
                <span className="text-[10px] text-[#b5a4d9]">#{idx + 1}</span>
                <strong>{cod}</strong>
                <button
                  type="button"
                  onClick={() => removerCodigo(cod)}
                  className="text-[#b5a4d9] hover:text-[#fb7185] cursor-pointer ml-0.5"
                  title="Remover código"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {ajuda && (
        <p className="text-[11px] text-[#b5a4d9] leading-relaxed">{ajuda}</p>
      )}
    </div>
  );
}
