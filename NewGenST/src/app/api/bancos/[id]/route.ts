import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bancosItens, itensIndividuais, movimentacoes } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  calcularStatusEstoque,
  calcularStatusValidade,
  ordenarPorCodigoIndividual,
} from "@/lib/estoque-domain";

export const dynamic = "force-dynamic";

type ContextParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: ContextParams) {
  try {
    const { id } = await context.params;
    const bancoId = Number(id);

    if (!bancoId || Number.isNaN(bancoId)) {
      return NextResponse.json(
        { error: "ID do banco de dados inválido." },
        { status: 400 }
      );
    }

    const [banco] = await db
      .select()
      .from(bancosItens)
      .where(eq(bancosItens.id, bancoId));

    if (!banco) {
      return NextResponse.json(
        { error: "Banco de dados do item não encontrado." },
        { status: 404 }
      );
    }

    const itensBrutos = await db
      .select()
      .from(itensIndividuais)
      .where(eq(itensIndividuais.bancoItemId, bancoId));

    // Organiza estritamente pelos códigos individuais conforme o fluxograma
    const itensOrdenados = ordenarPorCodigoIndividual(itensBrutos, "asc").map(
      (item) => {
        const infoValidade = calcularStatusValidade(item.dataValidade);
        return {
          ...item,
          statusValidade: infoValidade.status,
          diasParaVencer: infoValidade.diasRestantes,
        };
      }
    );

    const historico = await db
      .select()
      .from(movimentacoes)
      .where(eq(movimentacoes.bancoItemId, bancoId))
      .orderBy(desc(movimentacoes.data))
      .limit(60);

    const disponiveis = itensOrdenados.filter((i) => i.status === "DISPONIVEL");
    const vencendoCount = disponiveis.filter(
      (i) => i.statusValidade === "VENCENDO" || i.statusValidade === "VENCIDO"
    ).length;

    return NextResponse.json({
      banco: {
        ...banco,
        statusEstoque: calcularStatusEstoque(
          banco.quantidade,
          banco.estoqueMinimo
        ),
        itensDisponiveisCount: disponiveis.length,
        vencendoCount,
      },
      itensIndividuais: itensOrdenados,
      movimentacoes: historico,
    });
  } catch (error) {
    console.error("Erro em GET /api/bancos/[id]:", error);
    return NextResponse.json(
      { error: "Falha ao abrir o banco de dados do item." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: ContextParams) {
  try {
    const { id } = await context.params;
    const bancoId = Number(id);
    const body = await request.json();

    const nome = String(body.nome ?? "").trim();
    if (!nome) {
      return NextResponse.json(
        { error: "O nome do item não pode ficar vazio." },
        { status: 400 }
      );
    }

    const [atual] = await db
      .select()
      .from(bancosItens)
      .where(eq(bancosItens.id, bancoId));

    if (!atual) {
      return NextResponse.json(
        { error: "Banco de dados não encontrado." },
        { status: 404 }
      );
    }

    const prefixoLimpo =
      String(body.prefixoCodigo ?? atual.prefixoCodigo)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 8) || atual.prefixoCodigo;

    const [atualizado] = await db
      .update(bancosItens)
      .set({
        nome,
        codigoBarras: String(body.codigoBarras ?? "").trim(),
        foto: String(body.foto ?? ""),
        unidade: String(body.unidade ?? atual.unidade).trim() || "un",
        estoqueMinimo: Math.max(0, Number(body.estoqueMinimo) || 0),
        controlaLote: Boolean(body.controlaLote),
        prefixoCodigo: prefixoLimpo,
        atualizadoEm: new Date(),
      })
      .where(eq(bancosItens.id, bancoId))
      .returning();

    return NextResponse.json({ banco: atualizado });
  } catch (error) {
    console.error("Erro em PUT /api/bancos/[id]:", error);
    return NextResponse.json(
      { error: "Erro ao salvar alterações do banco de dados do item." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: ContextParams) {
  try {
    const { id } = await context.params;
    const bancoId = Number(id);

    const [excluido] = await db
      .delete(bancosItens)
      .where(eq(bancosItens.id, bancoId))
      .returning();

    if (!excluido) {
      return NextResponse.json(
        { error: "Banco de dados não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, excluido });
  } catch (error) {
    console.error("Erro em DELETE /api/bancos/[id]:", error);
    return NextResponse.json(
      { error: "Erro ao excluir o banco de dados do item." },
      { status: 500 }
    );
  }
}
