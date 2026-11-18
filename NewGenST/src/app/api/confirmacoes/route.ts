import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  bancosItens,
  confirmacoesEtapas,
  itensIndividuais,
  movimentacoes,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { garantirDadosIniciais } from "@/lib/seed-estoque";
import { calcularStatusValidade } from "@/lib/estoque-domain";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await garantirDadosIniciais();

    const confirmacoes = await db
      .select()
      .from(confirmacoesEtapas)
      .orderBy(desc(confirmacoesEtapas.confirmadoEm))
      .limit(80);

    const todosBancos = await db.select().from(bancosItens);
    const mapaBancos = new Map(todosBancos.map((b) => [b.id, b]));

    const movs = await db
      .select()
      .from(movimentacoes)
      .orderBy(desc(movimentacoes.data))
      .limit(80);

    const movimentacoesEnriquecidas = movs.map((m) => {
      const banco = mapaBancos.get(m.bancoItemId);
      return {
        ...m,
        nomeBanco: banco?.nome ?? "Banco removido",
        codigoBanco: banco?.codigoBanco ?? "—",
        unidade: banco?.unidade ?? "un",
      };
    });

    const disponiveis = await db
      .select()
      .from(itensIndividuais)
      .where(eq(itensIndividuais.status, "DISPONIVEL"));

    const alertasValidade = disponiveis
      .map((item) => {
        const info = calcularStatusValidade(item.dataValidade);
        const banco = mapaBancos.get(item.bancoItemId);
        return {
          ...item,
          nomeBanco: banco?.nome ?? "—",
          codigoBanco: banco?.codigoBanco ?? "—",
          unidade: banco?.unidade ?? "un",
          statusValidade: info.status,
          diasRestantes: info.diasRestantes,
        };
      })
      .filter(
        (i) => i.statusValidade === "VENCENDO" || i.statusValidade === "VENCIDO"
      )
      .sort((a, b) => (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999));

    return NextResponse.json({
      confirmacoes,
      movimentacoes: movimentacoesEnriquecidas,
      alertasValidade,
    });
  } catch (error) {
    console.error("Erro em GET /api/confirmacoes:", error);
    return NextResponse.json(
      { error: "Falha ao carregar relatórios e confirmações." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const etapaOrigem = String(body.etapaOrigem ?? "INICIO").trim();
    const etapaDestino = String(body.etapaDestino ?? "INICIO").trim();
    const acao = String(body.acao ?? "Confirmação de etapa").trim();
    const detalhes = String(body.detalhes ?? "").trim();
    const bancoItemId = body.bancoItemId ? Number(body.bancoItemId) : null;
    const operador =
      String(body.operador ?? "Operador Padrão").trim() || "Operador Padrão";

    const [confirmacao] = await db
      .insert(confirmacoesEtapas)
      .values({
        etapaOrigem,
        etapaDestino,
        acao,
        detalhes,
        bancoItemId:
          bancoItemId && !Number.isNaN(bancoItemId) ? bancoItemId : null,
        operador,
      })
      .returning();

    return NextResponse.json({ confirmacao }, { status: 201 });
  } catch (error) {
    console.error("Erro em POST /api/confirmacoes:", error);
    return NextResponse.json(
      { error: "Erro ao registrar confirmação de etapa." },
      { status: 500 }
    );
  }
}
