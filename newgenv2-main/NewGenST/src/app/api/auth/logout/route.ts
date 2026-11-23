import { NextResponse } from "next/server";
import { NOME_COOKIE_SESSAO, obterOpcoesCookieSessao } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const opcoesCookie = await obterOpcoesCookieSessao();
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set(NOME_COOKIE_SESSAO, "", {
    ...opcoesCookie,
    maxAge: 0,
  });
  return resposta;
}
