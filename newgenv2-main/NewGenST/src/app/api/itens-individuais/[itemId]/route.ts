import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { itensIndividuais } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";

export const dynamic = "force-dynamic";

type ContextParams = { params: Promise<{ itemId: string }> };

export async function PATCH(request: NextRequest, context: ContextParams) {
  try {
    const { itemId } = await context.params;
    const id = Number(itemId);
    const body = await request.json();

    const [existente] = await db
      .select()
      .from(itensIndividuais)
      .where(eq(itensIndividuais.id, id));

    if (!existente) {
      return NextResponse.json(
        { error: "Registro individual não encontrado." },
        { status: 404 }
      );
    }

    const novoCodigo = String(
      body.codigoIndividual ?? existente.codigoIndividual
    ).trim();

    if (!novoCodigo) {
      return NextResponse.json(
        { error: "O código individual não pode ficar em branco." },
        { status: 400 }
      );
    }

    // Verifica unicidade do código individual no mesmo banco de dados do item
    const [conflito] = await db
      .select()
      .from(itensIndividuais)
      .where(
        and(
          eq(itensIndividuais.bancoItemId, existente.bancoItemId),
          ne(itensIndividuais.id, id)
        )
      )
      .then((lista) =>
        lista.filter(
          (item) =>
            item.codigoIndividual.toUpperCase() === novoCodigo.toUpperCase()
        )
      );

    if (conflito) {
      return NextResponse.json(
        {
          error: `Já existe outro item com o código individual "${novoCodigo}" neste banco de dados.`,
        },
        { status: 400 }
      );
    }

    const [atualizado] = await db
      .update(itensIndividuais)
      .set({
        codigoIndividual: novoCodigo,
        lote: String(body.lote ?? existente.lote).trim(),
        dataValidade: String(body.dataValidade ?? existente.dataValidade).trim(),
        localizacao: String(body.localizacao ?? existente.localizacao).trim(),
        observacao: String(body.observacao ?? existente.observacao).trim(),
      })
      .where(eq(itensIndividuais.id, id))
      .returning();

    return NextResponse.json({ item: atualizado });
  } catch (error) {
    console.error("Erro em PATCH /api/itens-individuais/[itemId]:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar registro individual." },
      { status: 500 }
    );
  }
}
