"use client";

import React, { useEffect, useState } from "react";
import {
  calcularDuracaoUso,
  formatarDataHoraBR,
} from "@/lib/estoque-domain";
import { apiFetch } from "@/lib/client-api";
import type {
  AlertaValidadeItem,
  ConfirmacaoAlteracaoDetalhe,
  MovimentacaoDetalhe,
  RetiradaDispositivoDetalhe,
} from "@/types/estoque";
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarClock,
  History,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

interface AbaRelatoriosProps {
  onAbrirBancoDireto: (bancoId: number) => void;
}

export default function AbaRelatorios({
  onAbrirBancoDireto,
}: AbaRelatoriosProps) {
  const [subAba, setSubAba] = useState<
    "RETIRADAS" | "MOVIMENTACOES" | "VALIDADES" | "CONFIRMACOES"
  >("RETIRADAS");
  const [carregando, setCarregando] = useState(true);
  const [confirmacoes, setConfirmacoes] = useState<
    ConfirmacaoAlteracaoDetalhe[]
  >([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoDetalhe[]>([]);
  const [retiradas, setRetiradas] = useState<RetiradaDispositivoDetalhe[]>([]);
  const [alertasValidade, setAlertasValidade] = useState<AlertaValidadeItem[]>(
    []
  );

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const resp = await apiFetch("/api/confirmacoes");
      if (resp.ok) {
        const json = await resp.json();
        setConfirmacoes(json.confirmacoes || []);
        setMovimentacoes(json.movimentacoes || []);
        setRetiradas(json.retiradas || []);
        setAlertasValidade(json.alertasValidade || []);
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#f6f3ff]">
            Relatórios NewGenST
          </h2>
          <p className="text-xs text-[#b5a4d9]">
            Histórico de retiradas e devoluções com data/hora, movimentações e
            auditoria.
          </p>
        </div>

        <button
          type="button"
          onClick={carregarDados}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2a1e47] hover:bg-[#38285c] border border-[#493478] text-xs font-semibold text-[#e9d5ff] cursor-pointer"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 text-[#c084fc] ${carregando ? "animate-spin" : ""}`}
          />
          Atualizar
        </button>
      </div>

      {/* Sub-abas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-2xl bg-[#211738] border border-[#3a2961] p-1.5">
        <button
          type="button"
          onClick={() => setSubAba("RETIRADAS")}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            subAba === "RETIRADAS"
              ? "bg-[#7c3aed] text-white"
              : "text-[#b5a4d9] hover:text-white"
          }`}
        >
          <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Retiradas ({retiradas.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubAba("MOVIMENTACOES")}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            subAba === "MOVIMENTACOES"
              ? "bg-[#7c3aed] text-white"
              : "text-[#b5a4d9] hover:text-white"
          }`}
        >
          <History className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Movimentos ({movimentacoes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubAba("VALIDADES")}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            subAba === "VALIDADES"
              ? "bg-[#7c3aed] text-white"
              : "text-[#b5a4d9] hover:text-white"
          }`}
        >
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Vencendo ({alertasValidade.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubAba("CONFIRMACOES")}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            subAba === "CONFIRMACOES"
              ? "bg-[#7c3aed] text-white"
              : "text-[#b5a4d9] hover:text-white"
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Auditoria ({confirmacoes.length})</span>
        </button>
      </div>

      {carregando ? (
        <div className="rounded-2xl bg-[#211738] border border-[#3a2961] p-8 text-center text-sm text-[#b5a4d9]">
          Carregando registros...
        </div>
      ) : subAba === "RETIRADAS" ? (
        <div className="space-y-2.5">
          {retiradas.length === 0 ? (
            <div className="rounded-2xl bg-[#211738] border border-[#3a2961] p-8 text-center text-sm text-[#b5a4d9]">
              Nenhuma retirada de dispositivo registrada ainda.
            </div>
          ) : (
            retiradas.map((r) => {
              const emUso = r.status === "EM_USO";
              return (
                <article
                  key={r.id}
                  className="rounded-2xl bg-[#211738] border border-[#3a2961] p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          emUso
                            ? "bg-[#fbbf24]/20 text-[#fbbf24]"
                            : "bg-[#7c3aed]/25 text-[#d8b4fe]"
                        }`}
                      >
                        {emUso ? "● Em Uso Agora" : "✓ Devolvido"}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#e9d5ff]">
                        {r.codigoIndividual}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAbrirBancoDireto(r.bancoItemId)}
                        className="text-sm font-bold text-[#f6f3ff] hover:text-[#d8b4fe] cursor-pointer"
                      >
                        {r.nomeBanco}
                      </button>
                    </div>

                    <span className="text-[11px] font-mono text-[#d8b4fe]">
                      {emUso ? "Fora há: " : "Uso: "}
                      {calcularDuracaoUso(
                        r.dataHoraRetirada,
                        r.dataHoraDevolucao
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs rounded-xl bg-[#140e22] border border-[#3a2961] p-3">
                    <div>
                      <span className="block text-[10px] uppercase text-[#b5a4d9]">
                        Retirada
                      </span>
                      <strong className="font-mono text-[#fbbf24]">
                        {formatarDataHoraBR(r.dataHoraRetirada)}
                      </strong>
                      <p className="text-[#b5a4d9] mt-0.5">
                        {r.responsavelRetirada} →{" "}
                        <strong className="text-white">{r.destinoUso}</strong>
                      </p>
                    </div>

                    <div>
                      <span className="block text-[10px] uppercase text-[#b5a4d9]">
                        Devolução
                      </span>
                      {r.dataHoraDevolucao ? (
                        <>
                          <strong className="font-mono text-[#e9d5ff]">
                            {formatarDataHoraBR(r.dataHoraDevolucao)}
                          </strong>
                          <p className="text-[#b5a4d9] mt-0.5">
                            {r.localArmazenamentoDevolucao || "Base"} (
                            {r.condicaoDevolucao || "OK"})
                          </p>
                        </>
                      ) : (
                        <strong className="text-[#fbbf24]">
                          Aguardando devolução
                        </strong>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      ) : subAba === "MOVIMENTACOES" ? (
        <div className="space-y-2.5">
          {movimentacoes.length === 0 ? (
            <div className="rounded-2xl bg-[#211738] border border-[#3a2961] p-8 text-center text-sm text-[#b5a4d9]">
              Nenhuma movimentação registrada.
            </div>
          ) : (
            movimentacoes.map((m) => {
              const ehEntradaOuDev =
                m.tipo === "ENTRADA" || m.tipo === "DEVOLUCAO";
              const corTipo =
                m.tipo === "RETIRADA"
                  ? "bg-[#fbbf24]/20 text-[#fbbf24]"
                  : m.tipo === "DEVOLUCAO"
                    ? "bg-[#7c3aed]/35 text-[#f3e8ff]"
                    : m.tipo === "ENTRADA"
                      ? "bg-[#7c3aed]/20 text-[#d8b4fe]"
                      : "bg-[#9f1239]/25 text-[#fb7185]";

              return (
                <article
                  key={m.id}
                  className="rounded-2xl bg-[#211738] border border-[#3a2961] p-4 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${corTipo}`}
                      >
                        {m.tipo}
                      </span>
                      <strong className="text-sm text-[#f6f3ff] truncate">
                        {m.nomeBanco}
                      </strong>
                    </div>

                    {m.codigoIndividualRef && (
                      <p className="text-xs font-mono text-[#d8b4fe]">
                        Código(s): {m.codigoIndividualRef}
                      </p>
                    )}

                    {m.observacao && (
                      <p className="text-xs text-[#b5a4d9]">{m.observacao}</p>
                    )}

                    <p className="text-[11px] font-mono text-[#b5a4d9]/75">
                      {formatarDataHoraBR(m.data)} · Op.: {m.operador}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <strong
                      className={`text-sm font-bold ${
                        ehEntradaOuDev ? "text-[#d8b4fe]" : "text-[#fbbf24]"
                      }`}
                    >
                      {ehEntradaOuDev ? "+" : "−"}
                      {m.quantidade} {m.unidade}
                    </strong>
                    <span className="block text-xs text-[#b5a4d9]">
                      Base: {m.saldoApos} {m.unidade}
                    </span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      ) : subAba === "VALIDADES" ? (
        <div className="space-y-2.5">
          {alertasValidade.length === 0 ? (
            <div className="rounded-2xl bg-[#211738] border border-[#3a2961] p-8 text-center text-sm text-[#b5a4d9]">
              Nenhum item com lote próximo do vencimento nos próximos 30 dias.
            </div>
          ) : (
            alertasValidade.map((alerta) => (
              <article
                key={alerta.id}
                className="rounded-2xl bg-[#211738] border border-[#fbbf24]/40 p-4 flex items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertTriangle
                      className={`h-4 w-4 ${
                        alerta.statusValidade === "VENCIDO"
                          ? "text-[#fb7185]"
                          : "text-[#fbbf24]"
                      }`}
                    />
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#2a1e47] text-[#e9d5ff]">
                      {alerta.codigoIndividual}
                    </span>
                    <strong className="text-sm text-[#f6f3ff]">
                      {alerta.nomeBanco}
                    </strong>
                  </div>

                  <p className="text-xs text-[#b5a4d9]">
                    {alerta.lote ? `Lote: ${alerta.lote} · ` : ""}Validade:{" "}
                    <strong className="text-white">{alerta.dataValidade}</strong>{" "}
                    (
                    {alerta.statusValidade === "VENCIDO"
                      ? "VENCIDO"
                      : `vence em ${alerta.diasRestantes} dia(s)`}
                    )
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onAbrirBancoDireto(alerta.bancoItemId)}
                  className="px-3 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-xs font-bold text-white shrink-0 cursor-pointer"
                >
                  Abrir Produto
                </button>
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {confirmacoes.length === 0 ? (
            <div className="rounded-2xl bg-[#211738] border border-[#3a2961] p-8 text-center text-sm text-[#b5a4d9]">
              Nenhuma confirmação registrada ainda.
            </div>
          ) : (
            confirmacoes.map((c) => (
              <article
                key={c.id}
                className="rounded-2xl bg-[#211738] border border-[#3a2961] p-4 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#341f61] text-[#d8b4fe] text-[10px] font-mono font-bold uppercase">
                    {c.etapaDestino || "ALTERAÇÃO"}
                  </span>

                  <span className="text-[11px] font-mono text-[#b5a4d9]">
                    {formatarDataHoraBR(c.confirmadoEm)}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-[#f6f3ff]">{c.acao}</h3>

                {c.detalhes && (
                  <p className="text-xs text-[#b5a4d9] leading-relaxed">
                    {c.detalhes}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1 text-[11px] text-[#b5a4d9]">
                  <span>
                    Confirmado por:{" "}
                    <strong className="text-[#f6f3ff]">{c.operador}</strong>
                  </span>
                  {c.bancoItemId && (
                    <button
                      type="button"
                      onClick={() => onAbrirBancoDireto(c.bancoItemId!)}
                      className="text-[#d8b4fe] hover:underline font-semibold cursor-pointer"
                    >
                      Ver Produto →
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
