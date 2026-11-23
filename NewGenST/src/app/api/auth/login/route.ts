import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { operadores } from "@/db/schema";
import { garantirDadosIniciais } from "@/lib/seed-estoque";
import {
  criarTokenSessao,
  NOME_COOKIE_SESSAO,
  obterOpcoesCookieSessao,
  verificarSenha,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

function normalizarIdentificador(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    await garantirDadosIniciais();
    const body = await request.json();

    const nomeInformado = String(body.nome ?? "").trim();
    const senhaInformada = String(body.senha ?? "");

    if (!nomeInformado || !senhaInformada) {
      return NextResponse.json(
        { error: "Informe o nome de usuário e a senha." },
        { status: 400 }
      );
    }

    const todosOperadores = await db.select().from(operadores);
    const chaveBusca = normalizarIdentificador(nomeInformado);

    const candidato = todosOperadores.find(
      (op) =>
        normalizarIdentificador(op.nome) === chaveBusca ||
        op.codigoAcesso.trim().toLowerCase() === nomeInformado.toLowerCase()
    );

    if (!candidato || !verificarSenha(senhaInformada, candidato.senhaHash)) {
      return NextResponse.json(
        { error: "Nome de usuário ou senha incorretos." },
        { status: 401 }
      );
    }

    if (!candidato.ativo) {
      return NextResponse.json(
        { error: "Este usuário está desativado no sistema." },
        { status: 403 }
      );
    }

    const token = criarTokenSessao(candidato.id);
    const opcoesCookie = await obterOpcoesCookieSessao();
    const usuario = {
      id: candidato.id,
      nome: candidato.nome,
      cargo: candidato.cargo,
      codigoAcesso: candidato.codigoAcesso,
    };

    const resposta = NextResponse.json({ usuario, token });
    resposta.cookies.set(NOME_COOKIE_SESSAO, token, opcoesCookie);
    return resposta;
  } catch (error) {
    console.error("Erro em POST /api/auth/login:", error);
    return NextResponse.json(
      { error: "Erro interno ao realizar login." },
      { status: 500 }
    );
  }
}
