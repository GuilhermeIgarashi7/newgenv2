"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatarDataHoraBR } from "@/lib/estoque-domain";
import type { BancoItemResumo, CodigoIndividualResumo } from "@/types/estoque";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  FolderOpen,
  MapPin,
  MinusCircle,
  PlusCircle,
  ScanBarcode,
  Search,
  X,
} from "lucide-react";

interface ModalScannerCodigoProps {
  aberto: boolean;
  bancos: BancoItemResumo[];
  onFechar: () => void;
  onAbrirBanco: (banco: BancoItemResumo) => void;
  onRetirarDiretoCodigo: (
    banco: BancoItemResumo,
    item: CodigoIndividualResumo
  ) => void;
  onDevolverDiretoCodigo: (
    banco: BancoItemResumo,
    item: CodigoIndividualResumo
  ) => void;
  onDarBaixaDiretaCodigo: (
    banco: BancoItemResumo,
    item: CodigoIndividualResumo
  ) => void;
  onAbrirEntradaComCodigo: (banco: BancoItemResumo, codigo: string) => void;
  onCriarNovoProdutoComCodigo: (codigo: string) => void;
}

export default function ModalScannerCodigo({
  aberto,
  bancos,
  onFechar,
  onAbrirBanco,
  onRetirarDiretoCodigo,
  onDevolverDiretoCodigo,
  onDarBaixaDiretaCodigo,
  onAbrirEntradaComCodigo,
  onCriarNovoProdutoComCodigo,
}: ModalScannerCodigoProps) {
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [produtoEscolhidoId, setProdutoEscolhidoId] = useState<string>("");
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [erroCamera, setErroCamera] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const pararCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraAtiva(false);
  };

  useEffect(() => {
    if (!aberto) {
      pararCamera();
      setCodigoDigitado("");
      setErroCamera("");
    }
  }, [aberto]);

  const iniciarCamera = async () => {
    setErroCamera("");
    if (cameraAtiva) {
      pararCamera();
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setErroCamera("Câmera indisponível neste dispositivo.");
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
              const res = await detector.detect(videoRef.current);
              if (res.length > 0 && res[0].rawValue) {
                setCodigoDigitado(res[0].rawValue.trim());
                pararCamera();
                return;
              }
            }
          } catch {
            // continua
          }
          if (streamRef.current) {
            setTimeout(loop, 400);
          }
        };
        setTimeout(loop, 450);
      } else {
        setErroCamera(
          "Decodificação automática indisponível neste navegador. Digite ou use leitor USB/Bluetooth."
        );
      }
    } catch {
      setErroCamera("Permissão de câmera negada ou câmera não encontrada.");
    }
  };

  const resultadoBusca = useMemo(() => {
    const limpo = codigoDigitado.trim();
    if (!limpo) return null;
    const upper = limpo.toUpperCase();

    // 1. Verifica se está RETIRADO em uso externo
    for (const b of bancos) {
      const itemRetirado = (b.codigosRetiradosPreview || []).find(
        (c) => c.codigoIndividual.toUpperCase() === upper
      );
      if (itemRetirado) {
        return {
          tipo: "ITEM_RETIRADO" as const,
          banco: b,
          item: itemRetirado,
        };
      }
    }

    // 2. Verifica se está DISPONIVEL na base
    for (const b of bancos) {
      const itemAtivo = (b.codigosDisponiveisPreview || []).find(
        (c) => c.codigoIndividual.toUpperCase() === upper
      );
      if (itemAtivo) {
        return {
          tipo: "ITEM_DISPONIVEL" as const,
          banco: b,
          item: itemAtivo,
        };
      }
    }

    // 3. Verifica referência geral do produto
    const bancoRef = bancos.find(
      (b) => (b.codigoBarras || "").toUpperCase() === upper
    );
    if (bancoRef) {
      return {
        tipo: "PRODUTO_REFERENCIA" as const,
        banco: bancoRef,
      };
    }

    return {
      tipo: "CODIGO_NOVO" as const,
      codigo: limpo,
    };
  }, [codigoDigitado, bancos]);

  if (!aberto) return null;

  const bancoSelecionadoParaEntrada =
    bancos.find((b) => String(b.id) === produtoEscolhidoId) || bancos[0];

  const exemplosRapidos = [
    ...bancos
      .flatMap((b) =>
        (b.codigosRetiradosPreview || []).slice(0, 1).map((c) => ({
          codigo: c.codigoIndividual,
          tag: "Em uso",
        }))
      )
      .slice(0, 2),
    ...bancos
      .flatMap((b) =>
        (b.codigosDisponiveisPreview || []).slice(0, 1).map((c) => ({
          codigo: c.codigoIndividual,
          tag: "Na base",
        }))
      )
      .slice(0, 2),
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-[#090510]/80 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-[#211738] border border-[#3a2961] p-5 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-[#341f61] text-[#d8b4fe] flex items-center justify-center">
              <ScanBarcode className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#f6f3ff]">
                Leitor Rápido NewGenST
              </h3>
              <p className="text-[11px] text-[#b5a4d9]">
                Localize onde o dispositivo está, retire ou devolva na hora
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            className="h-8 w-8 rounded-lg bg-[#2a1e47] text-[#b5a4d9] hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Campo de leitura + botão câmera */}
        <div className="flex gap-2">
          <div className="campo-estoque flex-1 flex items-center gap-2">
            <Search className="h-4 w-4 text-[#c084fc]" />
            <input
              type="text"
              autoFocus
              value={codigoDigitado}
              onChange={(e) => setCodigoDigitado(e.target.value)}
              placeholder="Ex.: ZBR-TC21-9041 ou 7891234500101"
            />
          </div>

          <button
            type="button"
            onClick={iniciarCamera}
            className={`px-3 rounded-xl border text-xs font-semibold flex items-center gap-1 cursor-pointer ${
              cameraAtiva
                ? "bg-[#9f1239] border-[#fb7185]/40 text-white"
                : "bg-[#2a1e47] hover:bg-[#38285c] border-[#3a2961] text-[#f6f3ff]"
            }`}
            title="Usar câmera"
          >
            {cameraAtiva ? (
              <CameraOff className="h-4 w-4" />
            ) : (
              <Camera className="h-4 w-4 text-[#d8b4fe]" />
            )}
          </button>
        </div>

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
          </div>
        )}

        {erroCamera && (
          <p className="text-[11px] text-[#fbbf24]">{erroCamera}</p>
        )}

        {/* Sugestões rápidas */}
        {!codigoDigitado.trim() && exemplosRapidos.length > 0 && (
          <div className="space-y-1.5">
            <span className="block text-[10px] uppercase tracking-wider text-[#b5a4d9]">
              Testar leitura rápida de dispositivo:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {exemplosRapidos.map((ex) => (
                <button
                  key={ex.codigo}
                  type="button"
                  onClick={() => setCodigoDigitado(ex.codigo)}
                  className="px-2.5 py-1 rounded-lg bg-[#2a1e47] hover:bg-[#38285c] border border-[#493478] text-[11px] font-mono text-[#e9d5ff] cursor-pointer"
                >
                  {ex.codigo}{" "}
                  <span className="text-[#c084fc]">({ex.tag})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CASO 1: DISPOSITIVO ATUALMENTE RETIRADO / FORA DA BASE */}
        {resultadoBusca?.tipo === "ITEM_RETIRADO" && (
          <div className="rounded-xl bg-[#271a47] border border-[#fbbf24]/50 p-3.5 space-y-3">
            <div className="space-y-1 text-xs">
              <span className="text-[10px] font-mono uppercase text-[#fbbf24] font-bold">
                ● DISPOSITIVO RETIRADO / EM USO EXTERNO
              </span>
              <h4 className="text-sm font-bold text-white">
                {resultadoBusca.banco.nome} ({resultadoBusca.item.codigoIndividual})
              </h4>
              <p className="text-[#f6f3ff] flex items-center gap-1 pt-0.5">
                <MapPin className="h-3.5 w-3.5 text-[#fbbf24] shrink-0" />
                Onde está:{" "}
                <strong>{resultadoBusca.item.destinoAtual || "Em campo"}</strong>
              </p>
              <p className="text-[#d8b4fe]">
                Responsável:{" "}
                <strong>{resultadoBusca.item.portadorAtual || "—"}</strong>
              </p>
              <p className="font-mono text-[11px] text-[#fbbf24] flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Retirado em: {formatarDataHoraBR(resultadoBusca.item.retiradoEm)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onFechar();
                  onDevolverDiretoCodigo(
                    resultadoBusca.banco,
                    resultadoBusca.item
                  );
                }}
                className="rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold py-2.5 px-3 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowDownLeft className="h-4 w-4" />
                Devolver Agora
              </button>

              <button
                type="button"
                onClick={() => {
                  onFechar();
                  onAbrirBanco(resultadoBusca.banco);
                }}
                className="rounded-xl bg-[#38285c] hover:bg-[#493478] text-white font-bold py-2.5 px-3 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FolderOpen className="h-4 w-4 text-[#d8b4fe]" />
                Abrir Produto
              </button>
            </div>
          </div>
        )}

        {/* CASO 2: DISPOSITIVO DISPONÍVEL NA BASE */}
        {resultadoBusca?.tipo === "ITEM_DISPONIVEL" && (
          <div className="rounded-xl bg-[#2a1b4a] border border-[#c084fc]/60 p-3.5 space-y-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-[#d8b4fe] shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="text-[10px] font-mono uppercase text-[#d8b4fe] font-bold">
                  DISPONÍVEL NA BASE
                </span>
                <h4 className="text-sm font-bold text-white mt-0.5">
                  {resultadoBusca.banco.nome}
                </h4>
                <p className="text-[#e9d5ff] font-mono mt-0.5">
                  Código: {resultadoBusca.item.codigoIndividual}
                </p>
                {resultadoBusca.item.localizacao && (
                  <p className="text-[#b5a4d9] mt-0.5">
                    Local: {resultadoBusca.item.localizacao}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  onFechar();
                  onRetirarDiretoCodigo(
                    resultadoBusca.banco,
                    resultadoBusca.item
                  );
                }}
                className="rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold py-2.5 px-2 text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                Retirar
              </button>

              <button
                type="button"
                onClick={() => {
                  onFechar();
                  onDarBaixaDiretaCodigo(
                    resultadoBusca.banco,
                    resultadoBusca.item
                  );
                }}
                className="rounded-xl bg-[#9f1239] hover:bg-[#be123c] text-white font-bold py-2.5 px-2 text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <MinusCircle className="h-3.5 w-3.5" />
                Baixa
              </button>

              <button
                type="button"
                onClick={() => {
                  onFechar();
                  onAbrirBanco(resultadoBusca.banco);
                }}
                className="rounded-xl bg-[#38285c] hover:bg-[#493478] text-white font-bold py-2.5 px-2 text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <FolderOpen className="h-3.5 w-3.5 text-[#d8b4fe]" />
                Abrir
              </button>
            </div>
          </div>
        )}

        {/* CASO 3: REFERÊNCIA DO PRODUTO */}
        {resultadoBusca?.tipo === "PRODUTO_REFERENCIA" && (
          <div className="rounded-xl bg-[#160f26] border border-[#3a2961] p-3.5 space-y-3">
            <div className="text-xs">
              <span className="text-[10px] font-mono uppercase text-[#c084fc]">
                PRODUTO LOCALIZADO PELA REFERÊNCIA
              </span>
              <h4 className="text-sm font-bold text-white mt-0.5">
                {resultadoBusca.banco.nome}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => {
                onFechar();
                onAbrirBanco(resultadoBusca.banco);
              }}
              className="w-full rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold py-2.5 text-xs cursor-pointer"
            >
              Abrir Códigos deste Produto
            </button>
          </div>
        )}

        {/* CASO 4: CÓDIGO NOVO */}
        {resultadoBusca?.tipo === "CODIGO_NOVO" && (
          <div className="rounded-xl bg-[#160f26] border border-[#fbbf24]/40 p-3.5 space-y-3">
            <div className="text-xs">
              <span className="text-[10px] font-mono uppercase text-[#fbbf24] font-bold">
                CÓDIGO AINDA NÃO CADASTRADO
              </span>
              <p className="text-[#e2d8f7] mt-1">
                Deseja dar <strong>+ Entrada</strong> deste código individual (
                <strong className="font-mono text-white">
                  {resultadoBusca.codigo}
                </strong>
                ) em um produto existente ou criar um novo produto?
              </p>
            </div>

            {bancos.length > 0 && (
              <div className="space-y-2">
                <div className="campo-estoque">
                  <select
                    value={produtoEscolhidoId || String(bancos[0]?.id ?? "")}
                    onChange={(e) => setProdutoEscolhidoId(e.target.value)}
                  >
                    {bancos.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.nome} ({b.quantidade} {b.unidade})
                      </option>
                    ))}
                  </select>
                </div>

                {bancoSelecionadoParaEntrada && (
                  <button
                    type="button"
                    onClick={() => {
                      const cod = resultadoBusca.codigo;
                      onFechar();
                      onAbrirEntradaComCodigo(bancoSelecionadoParaEntrada, cod);
                    }}
                    className="w-full rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold py-2.5 px-3 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PlusCircle className="h-4 w-4" />+ Dar Entrada em &ldquo;
                    {bancoSelecionadoParaEntrada.nome}&rdquo;
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const cod = resultadoBusca.codigo;
                onFechar();
                onCriarNovoProdutoComCodigo(cod);
              }}
              className="w-full rounded-xl bg-[#38285c] hover:bg-[#493478] border border-[#4c357d] text-white font-semibold py-2.5 px-3 text-xs cursor-pointer"
            >
              + Cadastrar Novo Produto com este Código Inicial
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
