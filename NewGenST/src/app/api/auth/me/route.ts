import { NextResponse } from "next/server";
import { garantirDadosIniciais } from "@/lib/seed-estoque";
import {
  criarTokenSessao,
  NOME_COOKIE_SESSAO,
  obterOpcoesCookieSessao,
  obterUsuarioAutenticado,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await garantirDadosIniciais();
    const usuario = await obterUsuarioAutenticado();

    if (!usuario) {
      return NextResponse.json({
        autenticado: false,
        usuario: null,
        token: null,
      });
    }

    const tokenRenovado = criarTokenSessao(usuario.id);
    const opcoesCookie = await obterOpcoesCookieSessao();

    const resposta = NextResponse.json({
      autenticado: true,
      usuario,
      token: tokenRenovado,
    });
    resposta.cookies.set(NOME_COOKIE_SESSAO, tokenRenovado, opcoesCookie);
    return resposta;
  } catch (error) {
    console.error("Erro em GET /api/auth/me:", error);
    return NextResponse.json(
      { autenticado: false, usuario: null, token: null },
      { status: 500 }
    );
  }
}
