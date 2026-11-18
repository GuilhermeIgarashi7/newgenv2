import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { operadores } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { garantirDadosIniciais } from "@/lib/seed-estoque";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await garantirDadosIniciais();
    const lista = await db
      .select()
      .from(operadores)
      .orderBy(asc(operadores.nome));
    return NextResponse.json({ operadores: lista });
  } catch (error) {
    console.error("Erro em GET /api/operadores:", error);
    return NextResponse.json(
      { error: "Erro ao listar operadores." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const nome = String(body.nome ?? "").trim();
    const cargo = String(body.cargo ?? "Almoxarife").trim() || "Almoxarife";

    if (!nome) {
      return NextResponse.json(
        { error: "Informe o nome do operador." },
        { status: 400 }
      );
    }

    const existentes = await db.select().from(operadores);
    const codigoAcesso =
      String(body.codigoAcesso ?? "").trim() ||
      `OP-${101 + existentes.length}`;

    const [novo] = await db
      .insert(operadores)
      .values({
        nome,
        cargo,
        codigoAcesso,
        ativo: true,
      })
      .returning();

    return NextResponse.json({ operador: novo }, { status: 201 });
  } catch (error) {
    console.error("Erro em POST /api/operadores:", error);
    return NextResponse.json(
      { error: "Erro ao cadastrar operador." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    const ativo = Boolean(body.ativo);

    const [atualizado] = await db
      .update(operadores)
      .set({ ativo })
      .where(eq(operadores.id, id))
      .returning();

    return NextResponse.json({ operador: atualizado });
  } catch (error) {
    console.error("Erro em PATCH /api/operadores:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar operador." },
      { status: 500 }
    );
  }
}
