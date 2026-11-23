import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { operadores } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { garantirDadosIniciais } from "@/lib/seed-estoque";
import { gerarHashSenha, obterUsuarioAutenticado } from "@/lib/auth";

export const dynamic = "force-dynamic";

function normalizarIdentificador(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export async function GET() {
  try {
    await garantirDadosIniciais();
    const lista = await db
      .select({
        id: operadores.id,
        nome: operadores.nome,
        cargo: operadores.cargo,
        codigoAcesso: operadores.codigoAcesso,
        ativo: operadores.ativo,
        criadoEm: operadores.criadoEm,
      })
      .from(operadores)
      .orderBy(asc(operadores.nome));

    return NextResponse.json({ operadores: lista });
  } catch (error) {
    console.error("Erro em GET /api/operadores:", error);
    return NextResponse.json(
      { error: "Erro ao listar usuários." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const usuarioLogado = await obterUsuarioAutenticado();
    if (!usuarioLogado) {
      return NextResponse.json(
        { error: "Faça login para cadastrar novos usuários." },
        { status: 401 }
      );
    }

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
    const chave = normalizarIdentificador(nome);

    if (existentes.some((e) => normalizarIdentificador(e.nome) === chave)) {
      return NextResponse.json(
        { error: `Já existe um usuário com o nome "${nome}".` },
        { status: 400 }
      );
    }

    let numCodigo = 101 + existentes.length;
    const usados = new Set(
      existentes.map((e) => e.codigoAcesso.toUpperCase())
    );
    let codigoAcesso = `OP-${numCodigo}`;
    while (usados.has(codigoAcesso.toUpperCase())) {
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
      .returning({
        id: operadores.id,
        nome: operadores.nome,
        cargo: operadores.cargo,
        codigoAcesso: operadores.codigoAcesso,
        ativo: operadores.ativo,
        criadoEm: operadores.criadoEm,
      });

    return NextResponse.json({ operador: novo }, { status: 201 });
  } catch (error) {
    console.error("Erro em POST /api/operadores:", error);
    return NextResponse.json(
      { error: "Erro ao cadastrar usuário." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const usuarioLogado = await obterUsuarioAutenticado();
    if (!usuarioLogado) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const id = Number(body.id || usuarioLogado.id);

    const camposAtualizar: Partial<typeof operadores.$inferInsert> = {};

    if (typeof body.ativo === "boolean") {
      camposAtualizar.ativo = body.ativo;
    }

    if (typeof body.novaSenha === "string" && body.novaSenha.length > 0) {
      if (body.novaSenha.length < 3) {
        return NextResponse.json(
          { error: "A nova senha deve ter pelo menos 3 caracteres." },
          { status: 400 }
        );
      }
      camposAtualizar.senhaHash = gerarHashSenha(body.novaSenha);
    }

    const [atualizado] = await db
      .update(operadores)
      .set(camposAtualizar)
      .where(eq(operadores.id, id))
      .returning({
        id: operadores.id,
        nome: operadores.nome,
        cargo: operadores.cargo,
        codigoAcesso: operadores.codigoAcesso,
        ativo: operadores.ativo,
        criadoEm: operadores.criadoEm,
      });

    return NextResponse.json({ operador: atualizado });
  } catch (error) {
    console.error("Erro em PATCH /api/operadores:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar usuário." },
      { status: 500 }
    );
  }
}
