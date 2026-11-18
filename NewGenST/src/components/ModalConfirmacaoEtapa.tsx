"use client";

import React, { useState } from "react";
import type { ParametrosConfirmacaoAlteracao } from "@/types/estoque";
import { AlertTriangle, CheckCircle2, ShieldCheck, X } from "lucide-react";

interface ModalConfirmacaoEtapaProps {
  dados: ParametrosConfirmacaoAlteracao | null;
  operadorAtivo: string;
  salvando: boolean;
  onConfirmar: (observacaoExtra: string) => void;
  onCancelar: () => void;
}

export default function ModalConfirmacaoEtapa({
  dados,
  operadorAtivo,
  salvando,
  onConfirmar,
  onCancelar,
}: ModalConfirmacaoEtapaProps) {
  const [observacaoExtra, setObservacaoExtra] = useState("");

  if (!dados) return null;

  const corBotao =
    dados.variante === "vermelho"
      ? "bg-[#9f1239] hover:bg-[#be123c] text-white"
      : dados.variante === "amarelo"
        ? "bg-[#b45309] hover:bg-[#d97706] text-white"
        : "bg-[#7c3aed] hover:bg-[#8b5cf6] text-white";

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const obs = observacaoExtra.trim();
    setObservacaoExtra("");
    onConfirmar(obs);
  };

  const handleCancel = () => {
    setObservacaoExtra("");
    onCancelar();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#090510]/80 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-confirmacao-alteracao"
    >
      <form
        onSubmit={handleConfirm}
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-[#211738] border border-[#3a2961] shadow-2xl overflow-hidden"
      >
        {/* Cabeçalho roxo NewGenST */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-[#191129] border-b border-[#3a2961]">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#2f1d54] text-[#d8b4fe]">
              {dados.variante === "vermelho" ? (
                <AlertTriangle className="h-4 w-4 text-[#fb7185]" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
            </span>
            <div>
              <span className="block text-[10px] font-mono uppercase tracking-wider text-[#c084fc]">
                NewGenST · {dados.categoriaOperacao}
              </span>
              <h3
                id="titulo-confirmacao-alteracao"
                className="text-sm font-bold text-[#f6f3ff]"
              >
                Confirmar Alteração
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            disabled={salvando}
            className="h-8 w-8 rounded-lg bg-[#2a1e47] hover:bg-[#38285c] flex items-center justify-center text-[#b5a4d9] hover:text-white cursor-pointer"
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Resumo objetivo da operação */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <h4 className="text-base font-bold text-[#f6f3ff] mb-1">
              {dados.tituloAcao}
            </h4>
            <p className="text-xs sm:text-sm text-[#b5a4d9] leading-relaxed">
              {dados.descricao}
            </p>
          </div>

          {dados.resumoDados && dados.resumoDados.length > 0 && (
            <div className="rounded-xl bg-[#160f26] border border-[#3a2961] divide-y divide-[#3a2961]">
              {dados.resumoDados.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 px-3.5 py-2 text-xs"
                >
                  <span className="text-[#b5a4d9] uppercase tracking-wider font-medium shrink-0">
                    {item.rotulo}
                  </span>
                  <span className="text-[#f6f3ff] font-semibold text-right break-all">
                    {item.valor}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div>
            <label
              htmlFor="inputNotaConfirmacao"
              className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1.5"
            >
              Observação adicional (opcional)
            </label>
            <div className="campo-estoque">
              <input
                id="inputNotaConfirmacao"
                type="text"
                value={observacaoExtra}
                onChange={(e) => setObservacaoExtra(e.target.value)}
                placeholder="Ex.: Conferido na expedição"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#b5a4d9]">
            <span>
              Operador:{" "}
              <strong className="text-[#f6f3ff]">{operadorAtivo}</strong>
            </span>
          </div>
        </div>

        {/* Botões */}
        <div className="grid grid-cols-2 gap-2.5 p-4 bg-[#191129] border-t border-[#3a2961]">
          <button
            type="button"
            onClick={handleCancel}
            disabled={salvando}
            className="rounded-xl bg-[#38285c] hover:bg-[#493478] text-[#f6f3ff] font-semibold py-3 px-4 text-sm cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className={`rounded-xl font-bold py-3 px-4 text-sm cursor-pointer transition-colors flex items-center justify-center gap-2 ${corBotao}`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              {salvando
                ? "Salvando..."
                : dados.textoBotaoConfirmar || "Confirmar"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
