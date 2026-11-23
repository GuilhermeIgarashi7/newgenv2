import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  bancosItens,
  itensIndividuais,
  movimentacoes,
  retiradasDispositivos,
} from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { garantirDadosIniciais } from "@/lib/seed-estoque";
import { extrairCodigosBarrasInseridos } from "@/lib/estoque-domain";
import { obterUsuarioAutenticado } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await garantirDadosIniciais();

    const filtroStatus =
      request.nextUrl.searchParams.get("status")?.toUpperCase() ?? "TODAS";

    const todosBancos = await db.select().from(bancosItens);
    const mapaBancos = new Map(todosBancos.map((b) => [b.id, b]));

    const registros = await db
      .select()
      .from(retiradasDispositivos)
      .orderBy(desc(retiradasDispositivos.dataHoraRetirada))
      .limit(200);

    const enriquecidos = registros.map((r) => {
      const banco = mapaBancos.get(r.bancoItemId);
      return {
        ...r,
        nomeBanco: banco?.nome ?? "Produto removido",
        codigoBanco: banco?.codigoBanco ?? "—",
        unidade: banco?.unidade ?? "un",
        fotoBanco: banco?.foto ?? "",
      };
    });

    const filtrados =
      filtroStatus === "EM_USO" || filtroStatus === "DEVOLVIDO"
        ? enriquecidos.filter((r) => r.status === filtroStatus)
        : enriquecidos;

    const totalEmUso = enriquecidos.filter((r) => r.status === "EM_USO").length;
    const totalDevolvidos = enriquecidos.filter(
      (r) => r.status === "DEVOLVIDO"
    ).length;

    return NextResponse.json({
      retiradas: filtrados,
      contagem: {
        emUso: totalEmUso,
        devolvidos: totalDevolvidos,
        total: enriquecidos.length,
      },
    });
  } catch (error) {
    console.error("Erro em GET /api/retiradas:", error);
    return NextResponse.json(
      { error: "Falha ao carregar o controle de retiradas e devoluções." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await garantirDadosIniciais();
    const body = await request.json();

    const nomeFallback = String(
      body.operador ?? body.responsavelRetirada ?? ""
    ).trim();
    const usuarioLogado = await obterUsuarioAutenticado(nomeFallback);
    if (!usuarioLogado) {
      return NextResponse.json(
        { error: "Sessão expirada. Entre novamente com seu nome e senha." },
        { status: 401 }
      );
    }

    // O responsável pela retirada é automaticamente o usuário autenticado!
    const responsavelRetirada = usuarioLogado.nome;
    const operador = usuarioLogado.nome;
    const destinoUso = String(body.destinoUso ?? "").trim();
    const observacao = String(body.observacao ?? "").trim();

    if (!destinoUso) {
      return NextResponse.json(
        {
          error:
            "Informe para onde o dispositivo está indo (setor, equipe, sala ou cliente).",
        },
        { status: 400 }
      );
    }

    const dataHoraRetirada = body.dataHoraRetirada
      ? new Date(body.dataHoraRetirada)
      : new Date();
    if (Number.isNaN(dataHoraRetirada.getTime())) {
      return NextResponse.json(
        { error: "Data e hora de retirada inválidas." },
        { status: 400 }
      );
    }

    const previsaoDevolucao = body.previsaoDevolucao
      ? new Date(body.previsaoDevolucao)
      : null;

    const bancoItemIdFiltro = body.bancoItemId
      ? Number(body.bancoItemId)
      : null;

    const itensIds: number[] = Array.isArray(body.itensIds)
      ? body.itensIds
          .map(Number)
          .filter((n: number) => !Number.isNaN(n) && n > 0)
      : [];

    let codigosIndividuais: string[] = [];
    if (Array.isArray(body.codigosIndividuais)) {
      codigosIndividuais = body.codigosIndividuais
        .map((c: unknown) => String(c ?? "").trim())
        .filter(Boolean);
    } else if (typeof body.codigoIndividual === "string") {
      codigosIndividuais = extrairCodigosBarrasInseridos(body.codigoIndividual);
    }

    const resultado = await db.transaction(async (tx) => {
      const todosDisponiveis = await tx
        .select()
        .from(itensIndividuais)
        .where(eq(itensIndividuais.status, "DISPONIVEL"));

      const selecionadosMap = new Map<
        number,
        (typeof todosDisponiveis)[number]
      >();

      if (itensIds.length > 0) {
        const setIds = new Set(itensIds);
        for (const item of todosDisponiveis) {
          if (setIds.has(item.id)) {
            selecionadosMap.set(item.id, item);
          }
        }
      }

      if (codigosIndividuais.length > 0) {
        for (const cod of codigosIndividuais) {
          const upper = cod.toUpperCase();
          const achadoPreferencial = bancoItemIdFiltro
            ? todosDisponiveis.find(
                (i) =>
                  i.bancoItemId === bancoItemIdFiltro &&
                  i.codigoIndividual.toUpperCase() === upper
              )
            : null;
          const achado =
            achadoPreferencial ||
            todosDisponiveis.find(
              (i) => i.codigoIndividual.toUpperCase() === upper
            );

          if (!achado) {
            throw new Error(
              `O código individual "${cod}" não está disponível para retirada (pode já estar retirado ou baixado).`
            );
          }
          selecionadosMap.set(achado.id, achado);
        }
      }

      const alvos = Array.from(selecionadosMap.values());
      if (alvos.length === 0) {
        throw new Error(
          "Selecione ou bipe ao menos um dispositivo/item disponível para registrar a retirada."
        );
      }

      // Agrupa por bancoItemId para atualizar o saldo disponível de cada produto corretamente
      const porBanco = new Map<number, typeof alvos>();
      for (const item of alvos) {
        const lista = porBanco.get(item.bancoItemId) ?? [];
        lista.push(item);
        porBanco.set(item.bancoItemId, lista);
      }

      const retiradasCriadas = [];

      for (const [bId, itensDoBanco] of porBanco.entries()) {
        const [banco] = await tx
          .select()
          .from(bancosItens)
          .where(eq(bancosItens.id, bId));

        if (!banco) continue;

        const qtdRetirada = Number(
          itensDoBanco.reduce((acc, i) => acc + i.quantidade, 0).toFixed(4)
        );
        const novoSaldoDisponivel = Math.max(
          0,
          Number((banco.quantidade - qtdRetirada).toFixed(4))
        );

        await tx
          .update(itensIndividuais)
          .set({
            status: "RETIRADO",
            portadorAtual: responsavelRetirada,
            destinoAtual: destinoUso,
            retiradoEm: dataHoraRetirada,
            localizacao: `Em uso: ${destinoUso}`,
            observacao: observacao
              ? `Retirado (${responsavelRetirada}): ${observacao}`
              : `Retirado por ${responsavelRetirada} → ${destinoUso}`,
          })
          .where(
            inArray(
              itensIndividuais.id,
              itensDoBanco.map((i) => i.id)
            )
          );

        const inseridas = await tx
          .insert(retiradasDispositivos)
          .values(
            itensDoBanco.map((item) => ({
              bancoItemId: bId,
              itemIndividualId: item.id,
              codigoIndividual: item.codigoIndividual,
              responsavelRetirada,
              destinoUso,
              dataHoraRetirada,
              previsaoDevolucao:
                previsaoDevolucao && !Number.isNaN(previsaoDevolucao.getTime())
                  ? previsaoDevolucao
                  : null,
              observacao,
              operadorRetirada: operador,
              status: "EM_USO",
            }))
          )
          .returning();

        retiradasCriadas.push(...inseridas);

        await tx
          .update(bancosItens)
          .set({
            quantidade: novoSaldoDisponivel,
            atualizadoEm: new Date(),
          })
          .where(eq(bancosItens.id, bId));

        const refCodigos =
          itensDoBanco.length <= 4
            ? itensDoBanco.map((i) => i.codigoIndividual).join(", ")
            : `${itensDoBanco
                .slice(0, 4)
                .map((i) => i.codigoIndividual)
                .join(", ")} (+${itensDoBanco.length - 4})`;

        await tx.insert(movimentacoes).values({
          bancoItemId: bId,
          itemIndividualId:
            itensDoBanco.length === 1 ? itensDoBanco[0].id : null,
          codigoIndividualRef: refCodigos,
          tipo: "RETIRADA",
          quantidade: qtdRetirada,
          saldoApos: novoSaldoDisponivel,
          observacao: `Retirada p/ ${destinoUso} (Resp.: ${responsavelRetirada})${observacao ? ` — ${observacao}` : ""}`,
          operador,
          data: dataHoraRetirada,
        });
      }

      return {
        retiradas: retiradasCriadas,
        codigosRetirados: alvos.map((a) => a.codigoIndividual),
      };
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    const mensagem =
      error instanceof Error
        ? error.message
        : "Erro ao registrar retirada do dispositivo.";
    return NextResponse.json({ error: mensagem }, { status: 400 });
  }
}
