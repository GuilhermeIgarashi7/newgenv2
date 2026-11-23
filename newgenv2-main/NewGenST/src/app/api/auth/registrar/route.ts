import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { operadores } from "@/db/schema";
import { garantirDadosIniciais } from "@/lib/seed-estoque";
import {
  criarTokenSessao,
  gerarHashSenha,
  NOME_COOKIE_SESSAO,
  obterOpcoesCookieSessao,
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

    const nome = String(body.nome ?? "").trim();
    const senha = String(body.senha ?? "");
    const cargo = String(body.cargo ?? "Operador").trim() || "Operador";

    if (!nome) {
      return NextResponse.json(
        { error: "Informe o nome do usuário." },
        { status: 400 }
      );
    }

    if (senha.length < 3) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 3 caracteres." },
        { status: 400 }
      );
    }

    const existentes = await db.select().from(operadores);
    const chaveNova = normalizarIdentificador(nome);

    if (existentes.some((e) => normalizarIdentificador(e.nome) === chaveNova)) {
      return NextResponse.json(
        { error: `Já existe um usuário cadastrado com o nome "${nome}".` },
        { status: 400 }
      );
    }

    let numCodigo = 101 + existentes.length;
    const codigosUsados = new Set(
      existentes.map((e) => e.codigoAcesso.toUpperCase())
    );
    let codigoAcesso = `OP-${numCodigo}`;
    while (codigosUsados.has(codigoAcesso.toUpperCase())) {
      numCodigo++;
      codigoAcesso = `OP-${numCodigo}`;
    }

    const [novo] = await db
      .insert(operadores)
      .values({
        nome,
        senhaHash: gerarHashSenha(senha),
        cargo,
        codigoAcesso,
        ativo: true,
      })
      .returning();

    const token = criarTokenSessao(novo.id);
    const opcoesCookie = await obterOpcoesCookieSessao();
    const usuario = {
      id: novo.id,
      nome: novo.nome,
      cargo: novo.cargo,
      codigoAcesso: novo.codigoAcesso,
    };

    const resposta = NextResponse.json({ usuario, token }, { status: 201 });
    resposta.cookies.set(NOME_COOKIE_SESSAO, token, opcoesCookie);
    return resposta;
  } catch (error) {
    console.error("Erro em POST /api/auth/registrar:", error);
    return NextResponse.json(
      { error: "Erro ao criar conta de usuário." },
      { status: 500 }
    );
  }
}
