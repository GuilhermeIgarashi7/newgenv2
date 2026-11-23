"use client";

import React, { useState } from "react";
import { apiFetch } from "@/lib/client-api";
import type {
  FuncaoConfirmarAlteracao,
  OperadorDetalhe,
  UsuarioSessao,
} from "@/types/estoque";
import {
  CheckCircle2,
  KeyRound,
  LogOut,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

interface AbaUsuariosProps {
  operadores: OperadorDetalhe[];
  usuarioLogado: UsuarioSessao;
  confirmarAlteracao: FuncaoConfirmarAlteracao;
  onLogout: () => Promise<void>;
  onRecarregarOperadores: () => Promise<void>;
  onNotificar: (msg: string, tipo?: "sucesso" | "erro") => void;
}

export default function AbaUsuarios({
  operadores,
  usuarioLogado,
  confirmarAlteracao,
  onLogout,
  onRecarregarOperadores,
  onNotificar,
}: AbaUsuariosProps) {
  const [nomeNovo, setNomeNovo] = useState("");
  const [senhaNovaConta, setSenhaNovaConta] = useState("");
  const [cargoNovo, setCargoNovo] = useState("Operador");

  const [alterandoMinhaSenha, setAlterandoMinhaSenha] = useState(false);
  const [minhaNovaSenha, setMinhaNovaSenha] = useState("");

  const handleCadastrarOperador = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = nomeNovo.trim();
    if (!nomeLimpo) {
      onNotificar("Informe o nome do usuário.", "erro");
      return;
    }
    if (senhaNovaConta.length < 3) {
      onNotificar("A senha deve ter pelo menos 3 caracteres.", "erro");
      return;
    }

    const confirmado = await confirmarAlteracao({
      categoriaOperacao: "CADASTRO DE USUÁRIO",
      tituloAcao: `Cadastrar usuário "${nomeLimpo}"`,
      descricao:
        "Cria uma nova conta com nome e senha. Quando este usuário entrar e retirar um produto, ele aparecerá automaticamente como responsável.",
      textoBotaoConfirmar: "Cadastrar Usuário",
      variante: "roxo",
      resumoDados: [
        { rotulo: "Nome de Login", valor: nomeLimpo },
        { rotulo: "Cargo / Setor", valor: cargoNovo.trim() || "Operador" },
      ],
    });

    if (!confirmado) return;

    const resp = await apiFetch("/api/operadores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: nomeLimpo,
        senha: senhaNovaConta,
        cargo: cargoNovo.trim() || "Operador",
      }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      onNotificar(json.error || "Erro ao cadastrar usuário.", "erro");
      return;
    }

    setNomeNovo("");
    setSenhaNovaConta("");
    await onRecarregarOperadores();
    onNotificar(
      `Usuário "${nomeLimpo}" cadastrado! Para entrar com ele, clique em Trocar Usuário.`
    );
  };

  const handleSalvarMinhaNovaSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (minhaNovaSenha.length < 3) {
      onNotificar("A nova senha deve ter pelo menos 3 caracteres.", "erro");
      return;
    }

    const resp = await apiFetch("/api/operadores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: usuarioLogado.id,
        novaSenha: minhaNovaSenha,
      }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      onNotificar(json.error || "Erro ao alterar senha.", "erro");
      return;
    }

    setMinhaNovaSenha("");
    setAlterandoMinhaSenha(false);
    onNotificar("Sua senha foi atualizada com sucesso!");
  };

  return (
    <div className="space-y-4">
      {/* Cartão da Sessão Atual */}
      <section className="rounded-2xl bg-gradient-to-br from-[#2f1d56] to-[#1e1336] border border-[#c084fc]/60 p-4 sm:p-5 space-y-3 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 rounded-2xl bg-[#7c3aed] text-white flex items-center justify-center shadow-md">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#d8b4fe] font-bold">
                SESSÃO AUTENTICADA · RESPONSÁVEL ATIVO
              </span>
              <h2 className="text-lg font-bold text-white">
                {usuarioLogado.nome}
              </h2>
              <p className="text-xs text-[#e9d5ff]/85">
                {usuarioLogado.cargo} · Código {usuarioLogado.codigoAcesso}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAlterandoMinhaSenha((v) => !v)}
              className="px-3 py-2 rounded-xl bg-[#2a1e47] hover:bg-[#38285c] border border-[#4c357d] text-xs font-semibold text-[#e9d5ff] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="h-3.5 w-3.5 text-[#c084fc]" />
              <span>Alterar Senha</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-2 rounded-xl bg-[#9f1239] hover:bg-[#be123c] text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Trocar Usuário / Sair</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-[#d8b4fe] bg-[#140e22]/70 rounded-xl px-3.5 py-2.5 border border-[#3a2961]">
          Qualquer produto ou dispositivo retirado nesta sessão terá{" "}
          <strong className="text-white">{usuarioLogado.nome}</strong> gravado
          automaticamente como responsável.
        </p>

        {alterandoMinhaSenha && (
          <form
            onSubmit={handleSalvarMinhaNovaSenha}
            className="rounded-xl bg-[#140e22] border border-[#4c357d] p-3.5 flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5"
          >
            <div className="flex-1">
              <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                Nova senha para {usuarioLogado.nome}
              </label>
              <div className="campo-estoque">
                <input
                  type="password"
                  required
                  minLength={3}
                  value={minhaNovaSenha}
                  onChange={(e) => setMinhaNovaSenha(e.target.value)}
                  placeholder="Digite a nova senha"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-4 py-3 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-xs font-bold text-white cursor-pointer"
            >
              Salvar Nova Senha
            </button>
          </form>
        )}
      </section>

      {/* Formulário para cadastrar novo usuário com nome e senha */}
      <form
        onSubmit={handleCadastrarOperador}
        className="rounded-2xl bg-[#211738] border border-[#3a2961] p-4 sm:p-5 space-y-3.5"
      >
        <h3 className="text-sm font-bold text-[#f6f3ff] flex items-center gap-1.5">
          <UserPlus className="h-4 w-4 text-[#c084fc]" />
          Cadastrar Novo Usuário (Nome e Senha)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
              Nome do usuário *
            </label>
            <div className="campo-estoque">
              <input
                type="text"
                required
                value={nomeNovo}
                onChange={(e) => setNomeNovo(e.target.value)}
                placeholder="Ex.: Juliana Costa"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
              Senha de acesso *
            </label>
            <div className="campo-estoque">
              <input
                type="password"
                required
                minLength={3}
                value={senhaNovaConta}
                onChange={(e) => setSenhaNovaConta(e.target.value)}
                placeholder="Mín. 3 caracteres"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
              Cargo / Setor
            </label>
            <div className="campo-estoque">
              <input
                type="text"
                value={cargoNovo}
                onChange={(e) => setCargoNovo(e.target.value)}
                placeholder="Ex.: Técnico / Expedição"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-sm font-bold text-white cursor-pointer"
        >
          + Criar Conta de Usuário
        </button>
      </form>

      {/* Lista de usuários registrados */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-bold text-[#f6f3ff] flex items-center gap-2 px-1">
          <Users className="h-4 w-4 text-[#c084fc]" />
          Usuários Cadastrados no NewGenST ({operadores.length})
        </h3>

        {operadores.map((op) => {
          const ehAtual = op.id === usuarioLogado.id;
          return (
            <div
              key={op.id}
              className={`rounded-2xl border p-4 flex items-center justify-between gap-3 transition-colors ${
                ehAtual
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

              {ehAtual ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#d8b4fe]">
                  <CheckCircle2 className="h-4 w-4" />
                  Logado agora
                </span>
              ) : (
                <span className="text-[11px] text-[#b5a4d9] font-mono">
                  Protegido por senha
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
