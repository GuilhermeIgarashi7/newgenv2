"use client";

import React, { useState } from "react";
import type {
  FuncaoConfirmarAlteracao,
  OperadorDetalhe,
} from "@/types/estoque";
import { CheckCircle2, UserCheck, UserPlus, Users } from "lucide-react";

interface AbaUsuariosProps {
  operadores: OperadorDetalhe[];
  operadorAtivo: string;
  confirmarAlteracao: FuncaoConfirmarAlteracao;
  onSelecionarOperador: (nome: string) => void;
  onRecarregarOperadores: () => Promise<void>;
  onNotificar: (msg: string, tipo?: "sucesso" | "erro") => void;
}

export default function AbaUsuarios({
  operadores,
  operadorAtivo,
  confirmarAlteracao,
  onSelecionarOperador,
  onRecarregarOperadores,
  onNotificar,
}: AbaUsuariosProps) {
  const [nomeNovo, setNomeNovo] = useState("");
  const [cargoNovo, setCargoNovo] = useState("Almoxarife");

  const handleTrocarOperador = (op: OperadorDetalhe) => {
    if (op.nome === operadorAtivo) return;
    onSelecionarOperador(op.nome);
    onNotificar(`Operador ativo alterado para ${op.nome}.`);
  };

  const handleCadastrarOperador = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = nomeNovo.trim();
    if (!nomeLimpo) {
      onNotificar("Informe o nome do operador.", "erro");
      return;
    }

    const confirmado = await confirmarAlteracao({
      categoriaOperacao: "CADASTRO DE OPERADOR",
      tituloAcao: "Cadastrar novo operador no NewGenST",
      descricao:
        "Registra um novo operador responsável pelas movimentações de estoque.",
      textoBotaoConfirmar: "Cadastrar Operador",
      variante: "roxo",
      resumoDados: [
        { rotulo: "Nome", valor: nomeLimpo },
        { rotulo: "Cargo", valor: cargoNovo.trim() || "Almoxarife" },
      ],
    });

    if (!confirmado) return;

    const resp = await fetch("/api/operadores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: nomeLimpo,
        cargo: cargoNovo.trim() || "Almoxarife",
      }),
    });

    if (!resp.ok) {
      onNotificar("Erro ao cadastrar operador.", "erro");
      return;
    }

    setNomeNovo("");
    await onRecarregarOperadores();
    onSelecionarOperador(nomeLimpo);
    onNotificar(`Operador ${nomeLimpo} cadastrado e selecionado!`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#f6f3ff] flex items-center gap-2">
          <Users className="h-5 w-5 text-[#c084fc]" />
          Operadores NewGenST
        </h2>
        <p className="text-xs text-[#b5a4d9]">
          Selecione o operador responsável pelas entradas e baixas atuais.
        </p>
      </div>

      {/* Lista de operadores */}
      <div className="space-y-2.5">
        {operadores.map((op) => {
          const selecionado = op.nome === operadorAtivo;
          return (
            <div
              key={op.id}
              className={`rounded-2xl border p-4 flex items-center justify-between gap-3 transition-colors ${
                selecionado
                  ? "bg-[#311d59] border-[#c084fc]"
                  : "bg-[#211738] border-[#3a2961]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl bg-[#2a1e47] border border-[#493478] flex items-center justify-center text-[#d8b4fe]">
                  <UserCheck className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm text-[#f6f3ff]">
                      {op.nome}
                    </strong>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#2a1e47] text-[#d8b4fe]">
                      {op.codigoAcesso}
                    </span>
                  </div>
                  <span className="text-xs text-[#b5a4d9]">{op.cargo}</span>
                </div>
              </div>

              {selecionado ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#d8b4fe]">
                  <CheckCircle2 className="h-4 w-4" />
                  Em uso
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleTrocarOperador(op)}
                  className="px-3.5 py-2 rounded-xl bg-[#38285c] hover:bg-[#493478] text-xs font-bold text-white cursor-pointer"
                >
                  Selecionar
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Formulário de novo operador */}
      <form
        onSubmit={handleCadastrarOperador}
        className="rounded-2xl bg-[#211738] border border-[#3a2961] p-4 space-y-3"
      >
        <h3 className="text-sm font-bold text-[#f6f3ff] flex items-center gap-1.5">
          <UserPlus className="h-4 w-4 text-[#c084fc]" />
          Adicionar Novo Operador
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
              Nome completo
            </label>
            <div className="campo-estoque">
              <input
                type="text"
                value={nomeNovo}
                onChange={(e) => setNomeNovo(e.target.value)}
                placeholder="Ex.: Juliana Costa"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
              Cargo / Função
            </label>
            <div className="campo-estoque">
              <input
                type="text"
                value={cargoNovo}
                onChange={(e) => setCargoNovo(e.target.value)}
                placeholder="Ex.: Conferente de Estoque"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-sm font-bold text-white cursor-pointer"
        >
          + Cadastrar Operador
        </button>
      </form>
    </div>
  );
}
