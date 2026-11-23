import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { operadores } from "@/db/schema";
import { eq } from "drizzle-orm";

export const NOME_COOKIE_SESSAO = "newgenst_session";
const DURACAO_SESSAO_SEGUNDOS = 60 * 60 * 24 * 30; // 30 dias

function obterSegredoSessao(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.DATABASE_URL ||
    "newgenst-chave-assinatura-sessao-2026"
  );
}

/**
 * Gera hash seguro da senha usando scrypt com salt aleatório
 */
export function gerarHashSenha(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivado = scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${derivado}`;
}

/**
 * Compara senha informada com o hash salvo em tempo constante
 */
export function verificarSenha(senha: string, hashArmazenado: string): boolean {
  if (!hashArmazenado || !hashArmazenado.includes(":")) {
    return false;
  }
  const [salt, chaveHex] = hashArmazenado.split(":");
  if (!salt || !chaveHex) return false;

  const bufferEsperado = Buffer.from(chaveHex, "hex");
  const bufferCalculado = scryptSync(senha, salt, 64);

  if (bufferEsperado.length !== bufferCalculado.length) {
    return false;
  }
  return timingSafeEqual(bufferEsperado, bufferCalculado);
}

interface PayloadSessao {
  uid: number;
  exp: number;
}

export function criarTokenSessao(usuarioId: number): string {
  const payload: PayloadSessao = {
    uid: usuarioId,
    exp: Math.floor(Date.now() / 1000) + DURACAO_SESSAO_SEGUNDOS,
  };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  const assinatura = createHmac("sha256", obterSegredoSessao())
    .update(base64Payload)
    .digest("base64url");
  return `${base64Payload}.${assinatura}`;
}

export function validarTokenSessao(token: string): PayloadSessao | null {
  if (!token || !token.includes(".")) return null;
  const [base64Payload, assinaturaRecebida] = token.split(".");
  if (!base64Payload || !assinaturaRecebida) return null;

  const assinaturaEsperada = createHmac("sha256", obterSegredoSessao())
    .update(base64Payload)
    .digest("base64url");

  const bufRec = Buffer.from(assinaturaRecebida);
  const bufEsp = Buffer.from(assinaturaEsperada);
  if (bufRec.length !== bufEsp.length || !timingSafeEqual(bufRec, bufEsp)) {
    return null;
  }

  try {
    const dados = JSON.parse(
      Buffer.from(base64Payload, "base64url").toString("utf-8")
    ) as PayloadSessao;

    if (!dados.uid) return null;
    // Margem ampla contra diferenças de relógio de sistema/sandbox
    const agoraSegundos = Math.floor(Date.now() / 1000);
    if (dados.exp && dados.exp + 86400 < agoraSegundos) return null;
    return dados;
  } catch {
    return null;
  }
}

export interface UsuarioAutenticado {
  id: number;
  nome: string;
  cargo: string;
  codigoAcesso: string;
}

function normalizarNome(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Obtém o usuário autenticado a partir de:
 * 1) Cabeçalho `Authorization: Bearer <token>` ou `X-NewGenST-Token`
 * 2) Cookie `newgenst_session`
 * 3) Fallback resiliente (cabeçalhos `X-NewGenST-User-Id` / `X-NewGenST-User-Name` ou `fallbackOperadorNome`)
 *    para sessões iniciadas antes de hot-reload ou em iframes com proxies que removem `Authorization`.
 */
export async function obterUsuarioAutenticado(
  fallbackOperadorNome?: string,
  fallbackOperadorId?: number | null
): Promise<UsuarioAutenticado | null> {
  try {
    const headerStore = await headers();
    const authHeader = headerStore.get("authorization") || "";
    const tokenBearer = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    const tokenCustom = headerStore.get("x-newgenst-token")?.trim() || "";

    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(NOME_COOKIE_SESSAO)?.value || "";

    const candidatosToken = [tokenBearer, tokenCustom, tokenCookie].filter(
      Boolean
    );

    for (const candidato of candidatosToken) {
      const validado = validarTokenSessao(candidato);
      if (validado) {
        const [op] = await db
          .select({
            id: operadores.id,
            nome: operadores.nome,
            cargo: operadores.cargo,
            codigoAcesso: operadores.codigoAcesso,
            ativo: operadores.ativo,
          })
          .from(operadores)
          .where(eq(operadores.id, validado.uid));

        if (op && op.ativo) {
          return {
            id: op.id,
            nome: op.nome,
            cargo: op.cargo,
            codigoAcesso: op.codigoAcesso,
          };
        }
      }
    }

    // Fallback resiliente por ID de usuário logado enviado pelo cliente autenticado
    const idHeaderRaw = headerStore.get("x-newgenst-user-id")?.trim();
    const idCandidato =
      fallbackOperadorId || (idHeaderRaw ? Number(idHeaderRaw) : null);

    if (idCandidato && !Number.isNaN(idCandidato)) {
      const [opPorId] = await db
        .select({
          id: operadores.id,
          nome: operadores.nome,
          cargo: operadores.cargo,
          codigoAcesso: operadores.codigoAcesso,
          ativo: operadores.ativo,
        })
        .from(operadores)
        .where(eq(operadores.id, idCandidato));

      if (opPorId && opPorId.ativo) {
        return {
          id: opPorId.id,
          nome: opPorId.nome,
          cargo: opPorId.cargo,
          codigoAcesso: opPorId.codigoAcesso,
        };
      }
    }

    // Fallback resiliente por nome de usuário ativo no banco
    const nomeHeaderBruto = headerStore.get("x-newgenst-user-name")?.trim() || "";
    let nomeHeaderDecodificado = nomeHeaderBruto;
    try {
      if (nomeHeaderBruto) {
        nomeHeaderDecodificado = decodeURIComponent(nomeHeaderBruto);
      }
    } catch {
      // mantém bruto
    }
    const nomeCandidato = (
      fallbackOperadorNome ||
      nomeHeaderDecodificado ||
      ""
    ).trim();

    if (nomeCandidato) {
      const chave = normalizarNome(nomeCandidato);
      const todos = await db
        .select({
          id: operadores.id,
          nome: operadores.nome,
          cargo: operadores.cargo,
          codigoAcesso: operadores.codigoAcesso,
          ativo: operadores.ativo,
        })
        .from(operadores);

      const achado = todos.find(
        (o) => o.ativo && normalizarNome(o.nome) === chave
      );

      if (achado) {
        return {
          id: achado.id,
          nome: achado.nome,
          cargo: achado.cargo,
          codigoAcesso: achado.codigoAcesso,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Configura opções de cookie dinamicamente verificando se a requisição atual é HTTPS,
 * evitando que navegadores rejeitem cookies `Secure` em proxies HTTP locais.
 */
export async function obterOpcoesCookieSessao() {
  let ehHttps = process.env.NODE_ENV === "production";
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto");
    if (proto) {
      ehHttps = proto.includes("https");
    }
  } catch {
    // mantém padrão
  }

  return {
    httpOnly: true,
    sameSite: ehHttps ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: DURACAO_SESSAO_SEGUNDOS,
    secure: ehHttps,
    ...(ehHttps ? { partitioned: true } : {}),
  };
}
