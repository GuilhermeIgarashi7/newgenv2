import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  bancosItens,
  confirmacoesEtapas,
  itensIndividuais,
  movimentacoes,
  retiradasDispositivos,
} from "@/db/schema";
import { desc, inArray } from "drizzle-orm";
import { garantirDadosIniciais } from "@/lib/seed-estoque";
import { calcularStatusValidade } from "@/lib/estoque-domain";
import { obterUsuarioAutenticado } from "@/lib/auth";

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
      .limit(100);

    const movimentacoesEnriquecidas = movs.map((m) => {
      const banco = mapaBancos.get(m.bancoItemId);
      return {
        ...m,
        nomeBanco: banco?.nome ?? "Produto removido",
        codigoBanco: banco?.codigoBanco ?? "—",
        unidade: banco?.unidade ?? "un",
      };
    });

    const retiradasRaw = await db
      .select()
      .from(retiradasDispositivos)
      .orderBy(desc(retiradasDispositivos.dataHoraRetirada))
      .limit(120);

    const retiradasEnriquecidas = retiradasRaw.map((r) => {
      const banco = mapaBancos.get(r.bancoItemId);
      return {
        ...r,
        nomeBanco: banco?.nome ?? "Produto removido",
        codigoBanco: banco?.codigoBanco ?? "—",
        unidade: banco?.unidade ?? "un",
      };
    });

    const ativos = await db
      .select()
      .from(itensIndividuais)
      .where(inArray(itensIndividuais.status, ["DISPONIVEL", "RETIRADO"]));

    const alertasValidade = ativos
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
      retiradas: retiradasEnriquecidas,
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
    const usuarioLogado = await obterUsuarioAutenticado(
      String(body.operador ?? "").trim()
    );
    if (!usuarioLogado) {
      return NextResponse.json(
        { error: "Sessão expirada. Faça login novamente." },
        { status: 401 }
      );
    }

    const etapaOrigem = String(body.etapaOrigem ?? "NewGenST").trim();
    const etapaDestino = String(body.etapaDestino ?? "OPERACAO").trim();
    const acao = String(body.acao ?? "Confirmação de operação").trim();
    const detalhes = String(body.detalhes ?? "").trim();
    const bancoItemId = body.bancoItemId ? Number(body.bancoItemId) : null;
    const operador = usuarioLogado.nome;

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
      { error: "Erro ao registrar confirmação." },
      { status: 500 }
    );
  }
}
