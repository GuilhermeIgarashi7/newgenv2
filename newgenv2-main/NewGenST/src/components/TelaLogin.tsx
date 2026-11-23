"use client";

import React, { useState } from "react";
import type { UsuarioSessao } from "@/types/estoque";
import {
  salvarTokenSessaoCliente,
  salvarUsuarioSessaoCliente,
} from "@/lib/client-api";
import {
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  ShieldCheck,
  User,
  UserPlus,
  Briefcase,
} from "lucide-react";

interface TelaLoginProps {
  onAutenticado: (usuario: UsuarioSessao) => void;
}

const CONTAS_EXEMPLO = [
  { nome: "Carlos Mendes", cargo: "Supervisor", senhaPadrao: "1234" },
  { nome: "Ana Paula Rocha", cargo: "Conferente", senhaPadrao: "1234" },
  { nome: "Marcos Vinícius", cargo: "Almoxarifado", senhaPadrao: "1234" },
];

export default function TelaLogin({ onAutenticado }: TelaLoginProps) {
  const [modo, setModo] = useState<"LOGIN" | "CADASTRO">("LOGIN");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [cargo, setCargo] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    if (!nome.trim() || !senha) {
      setErro("Preencha o nome do usuário e a senha.");
      return;
    }

    setCarregando(true);
    try {
      const rota =
        modo === "LOGIN" ? "/api/auth/login" : "/api/auth/registrar";
      const payload =
        modo === "LOGIN"
          ? { nome: nome.trim(), senha }
          : {
              nome: nome.trim(),
              senha,
              cargo: cargo.trim() || "Operador",
            };

      const resp = await fetch(rota, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await resp.json();
      if (!resp.ok) {
        setErro(json.error || "Não foi possível autenticar.");
        return;
      }

      if (json.token) {
        salvarTokenSessaoCliente(json.token);
      }
      if (json.usuario) {
        salvarUsuarioSessaoCliente(json.usuario);
      }
      onAutenticado(json.usuario);
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#120d1d] text-[#f6f3ff] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Brilho decorativo de fundo */}
      <div className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-[#7c3aed]/25 blur-3xl" />

      <div className="w-full max-w-md space-y-5 relative z-10">
        {/* Identidade NewGenST */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] shadow-lg shadow-[#7c3aed]/35 flex items-center justify-center text-2xl">
            📦
          </div>
          <h1 className="text-2xl font-extrabold tracking-wide bg-gradient-to-r from-[#ffffff] via-[#e9d5ff] to-[#c084fc] bg-clip-text text-transparent">
            NewGenST
          </h1>
          <p className="text-xs text-[#b5a4d9] max-w-xs mx-auto leading-relaxed">
            Entre com seu <strong>nome e senha</strong>. Toda retirada de
            produto ou dispositivo ficará registrada automaticamente sob sua
            responsabilidade.
          </p>
        </div>

        {/* Card de Login / Cadastro */}
        <div className="rounded-2xl bg-[#211738] border border-[#3a2961] p-5 sm:p-6 shadow-2xl space-y-4">
          {/* Alternador Entrar vs Criar Conta */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#140e22] border border-[#3a2961] p-1">
            <button
              type="button"
              onClick={() => {
                setModo("LOGIN");
                setErro("");
              }}
              className={`py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                modo === "LOGIN"
                  ? "bg-[#7c3aed] text-white shadow-sm"
                  : "text-[#b5a4d9] hover:text-white"
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Entrar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setModo("CADASTRO");
                setErro("");
              }}
              className={`py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                modo === "CADASTRO"
                  ? "bg-[#7c3aed] text-white shadow-sm"
                  : "text-[#b5a4d9] hover:text-white"
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Criar Usuário</span>
            </button>
          </div>

          {erro && (
            <div className="rounded-xl bg-[#381328] border border-[#fb7185]/50 px-3.5 py-2.5 text-xs font-semibold text-[#fecdd3]">
              {erro}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="inputLoginNome"
                className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1.5"
              >
                Nome do usuário *
              </label>
              <div className="campo-estoque flex items-center gap-2.5">
                <User className="h-4 w-4 text-[#c084fc] shrink-0" />
                <input
                  id="inputLoginNome"
                  type="text"
                  autoFocus
                  required
                  autoComplete="username"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Carlos Mendes ou seu nome"
                />
              </div>
            </div>

            {modo === "CADASTRO" && (
              <div>
                <label
                  htmlFor="inputLoginCargo"
                  className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1.5"
                >
                  Cargo / Setor (opcional)
                </label>
                <div className="campo-estoque flex items-center gap-2.5">
                  <Briefcase className="h-4 w-4 text-[#c084fc] shrink-0" />
                  <input
                    id="inputLoginCargo"
                    type="text"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    placeholder="Ex.: Técnico de Campo, Expedição..."
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="inputLoginSenha"
                className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1.5"
              >
                Senha *
              </label>
              <div className="campo-estoque flex items-center gap-2.5">
                <KeyRound className="h-4 w-4 text-[#c084fc] shrink-0" />
                <input
                  id="inputLoginSenha"
                  type={mostrarSenha ? "text" : "password"}
                  required
                  autoComplete={
                    modo === "LOGIN" ? "current-password" : "new-password"
                  }
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder={
                    modo === "LOGIN"
                      ? "Digite sua senha"
                      : "Crie uma senha (mín. 3 dígitos)"
                  }
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="text-[#b5a4d9] hover:text-white cursor-pointer"
                  title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarSenha ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] disabled:opacity-60 shadow-lg shadow-[#7c3aed]/25 text-white font-bold py-3.5 px-4 text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors mt-2"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>
                {carregando
                  ? "Autenticando..."
                  : modo === "LOGIN"
                    ? "Entrar no NewGenST"
                    : "Cadastrar e Entrar"}
              </span>
            </button>
          </form>

          {/* Dica rápida de contas iniciais para teste imediato */}
          {modo === "LOGIN" && (
            <div className="pt-3 border-t border-[#3a2961] space-y-2">
              <span className="block text-[10px] uppercase tracking-wider text-[#b5a4d9]">
                Acesso rápido de demonstração (senha padrão:{" "}
                <strong className="font-mono text-[#e9d5ff]">1234</strong>):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CONTAS_EXEMPLO.map((c) => (
                  <button
                    key={c.nome}
                    type="button"
                    onClick={() => {
                      setNome(c.nome);
                      setSenha(c.senhaPadrao);
                      setErro("");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#2a1e47] hover:bg-[#38285c] border border-[#493478] text-[11px] text-[#e9d5ff] cursor-pointer transition-colors"
                  >
                    {c.nome}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
