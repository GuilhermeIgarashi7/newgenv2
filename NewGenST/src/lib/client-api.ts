"use client";

import type { UsuarioSessao } from "@/types/estoque";

const CHAVE_STORAGE_TOKEN = "newgenst_session_token";
const CHAVE_STORAGE_USUARIO = "newgenst_session_user";

let tokenEmMemoria = "";
let usuarioEmMemoria: UsuarioSessao | null = null;

export function salvarTokenSessaoCliente(token: string): void {
  tokenEmMemoria = token || "";
  try {
    if (typeof window !== "undefined") {
      if (token) {
        window.localStorage.setItem(CHAVE_STORAGE_TOKEN, token);
      } else {
        window.localStorage.removeItem(CHAVE_STORAGE_TOKEN);
      }
    }
  } catch {
    // Caso localStorage esteja bloqueado em iframe restrito, mantém em memória
  }
}

export function salvarUsuarioSessaoCliente(
  usuario: UsuarioSessao | null
): void {
  usuarioEmMemoria = usuario;
  try {
    if (typeof window !== "undefined") {
      if (usuario) {
        window.localStorage.setItem(
          CHAVE_STORAGE_USUARIO,
          JSON.stringify(usuario)
        );
      } else {
        window.localStorage.removeItem(CHAVE_STORAGE_USUARIO);
      }
    }
  } catch {
    // silencioso
  }
}

export function obterTokenSessaoCliente(): string {
  if (tokenEmMemoria) return tokenEmMemoria;
  try {
    if (typeof window !== "undefined") {
      const salvo = window.localStorage.getItem(CHAVE_STORAGE_TOKEN) || "";
      if (salvo) {
        tokenEmMemoria = salvo;
        return salvo;
      }
    }
  } catch {
    // silencioso
  }
  return "";
}

export function obterUsuarioSessaoCliente(): UsuarioSessao | null {
  if (usuarioEmMemoria) return usuarioEmMemoria;
  try {
    if (typeof window !== "undefined") {
      const bruto = window.localStorage.getItem(CHAVE_STORAGE_USUARIO);
      if (bruto) {
        const parsed = JSON.parse(bruto) as UsuarioSessao;
        if (parsed?.id && parsed?.nome) {
          usuarioEmMemoria = parsed;
          return parsed;
        }
      }
    }
  } catch {
    // silencioso
  }
  return null;
}

export function limparTokenSessaoCliente(): void {
  salvarTokenSessaoCliente("");
  salvarUsuarioSessaoCliente(null);
}

/**
 * Wrapper de fetch que envia automaticamente o token assinado de autenticação
 * (Authorization + X-NewGenST-Token) e identificadores da sessão ativa,
 * eliminando qualquer erro de "Sessão Expirada" em iframes ou hot-reloads.
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = obterTokenSessaoCliente();
  const usuario = obterUsuarioSessaoCliente();
  const headersObj = new Headers(init.headers || {});

  if (token) {
    if (!headersObj.has("Authorization")) {
      headersObj.set("Authorization", `Bearer ${token}`);
    }
    headersObj.set("X-NewGenST-Token", token);
  }

  if (usuario) {
    headersObj.set("X-NewGenST-User-Id", String(usuario.id));
    headersObj.set("X-NewGenST-User-Name", encodeURIComponent(usuario.nome));
  }

  return fetch(input, {
    ...init,
    headers: headersObj,
    credentials: "include",
  });
}
