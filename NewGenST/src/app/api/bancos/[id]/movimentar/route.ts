import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bancosItens, itensIndividuais, movimentacoes } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  extrairCodigosBarrasInseridos,
  ordenarPorCodigoIndividual,
} from "@/lib/estoque-domain";

export const dynamic = "force-dynamic";

type ContextParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: ContextParams) {
  try {
    const { id } = await context.params;
    const bancoId = Number(id);
    const body = await request.json();

    const tipo = body.tipo === "BAIXA" ? "BAIXA" : "ENTRADA";
    const observacao = String(body.observacao ?? "").trim();
    const operador = String(body.operador ?? "Operador Padrão").trim();

    const resultado = await db.transaction(async (tx) => {
      const [banco] = await tx
        .select()
        .from(bancosItens)
        .where(eq(bancosItens.id, bancoId));

      if (!banco) {
        throw new Error("Produto não encontrado.");
      }

      if (tipo === "ENTRADA") {
        let codigos: string[] = [];

        if (Array.isArray(body.codigosIndividuais)) {
          codigos = body.codigosIndividuais
            .map((c: unknown) => String(c ?? "").trim())
            .filter(Boolean);
        } else if (typeof body.codigoIndividual === "string") {
          codigos = extrairCodigosBarrasInseridos(body.codigoIndividual);
        }

        if (codigos.length === 0) {
          throw new Error(
            "Informe ou leia ao menos um código de barras individual do item."
          );
        }

        // Valida duplicados no mesmo envio
        const vistos = new Set<string>();
        for (const cod of codigos) {
          const upper = cod.toUpperCase();
          if (vistos.has(upper)) {
            throw new Error(
              `O código de barras "${cod}" foi informado duplicado na mesma entrada.`
            );
          }
          vistos.add(upper);
        }

        // Verifica se algum código já está disponível em estoque
        const ativosGerais = await tx
          .select()
          .from(itensIndividuais)
          .where(eq(itensIndividuais.status, "DISPONIVEL"));

        const codigosJaAtivos = new Set(
          ativosGerais.map((i) => i.codigoIndividual.toUpperCase())
        );

        for (const cod of codigos) {
          if (codigosJaAtivos.has(cod.toUpperCase())) {
            throw new Error(
              `O código individual "${cod}" já consta como disponível no estoque.`
            );
          }
        }

        const qtdPorItem =
          Number(body.quantidadePorItem) > 0
            ? Number(body.quantidadePorItem)
            : 1;
        const lote = String(body.lote ?? "").trim();
        const dataFabricacao = String(body.dataFabricacao ?? "").trim();
        const dataValidade = String(body.dataValidade ?? "").trim();
        const localizacao = String(body.localizacao ?? "").trim();

        const novosRegistros = codigos.map((codigo) => ({
          bancoItemId: bancoId,
          codigoIndividual: codigo,
          quantidade: qtdPorItem,
          lote,
          dataFabricacao,
          dataValidade,
          localizacao,
          status: "DISPONIVEL",
          observacao: observacao || "Entrada por código de barras individual",
        }));

        const inseridos = await tx
          .insert(itensIndividuais)
          .values(novosRegistros)
          .returning();

        const qtdTotalEntrada = Number(
          (inseridos.length * qtdPorItem).toFixed(4)
        );
        const novoSaldo = Number(
          (banco.quantidade + qtdTotalEntrada).toFixed(4)
        );

        await tx
          .update(bancosItens)
          .set({
            quantidade: novoSaldo,
            sequencialAtual: banco.sequencialAtual + inseridos.length,
            atualizadoEm: new Date(),
          })
          .where(eq(bancosItens.id, bancoId));

        const refCodigos =
          inseridos.length <= 4
            ? inseridos.map((i) => i.codigoIndividual).join(", ")
            : `${inseridos
                .slice(0, 4)
                .map((i) => i.codigoIndividual)
                .join(", ")} (+${inseridos.length - 4})`;

        await tx.insert(movimentacoes).values({
          bancoItemId: bancoId,
          itemIndividualId: inseridos.length === 1 ? inseridos[0].id : null,
          codigoIndividualRef: refCodigos,
          tipo: "ENTRADA",
          quantidade: qtdTotalEntrada,
          saldoApos: novoSaldo,
          observacao:
            observacao || `Entrada de ${inseridos.length} código(s) individual(is)`,
          operador,
        });

        return {
          novoSaldo,
          codigosAfetados: inseridos.map((i) => i.codigoIndividual),
        };
      }

      // ===== OPERAÇÃO DE BAIXA =====
      const itensIdsSelecionados: number[] = Array.isArray(body.itensIds)
        ? body.itensIds
            .map(Number)
            .filter((n: number) => !Number.isNaN(n) && n > 0)
        : [];

      let codigosBaixa: string[] = [];
      if (Array.isArray(body.codigosBaixa)) {
        codigosBaixa = body.codigosBaixa
          .map((c: unknown) => String(c ?? "").trim())
          .filter(Boolean);
      } else if (typeof body.codigoIndividual === "string") {
        codigosBaixa = extrairCodigosBarrasInseridos(body.codigoIndividual);
      }

      const disponiveisDoProduto = await tx
        .select()
        .from(itensIndividuais)
        .where(
          and(
            eq(itensIndividuais.bancoItemId, bancoId),
            eq(itensIndividuais.status, "DISPONIVEL")
          )
        );

      let alvos = [] as typeof disponiveisDoProduto;

      if (itensIdsSelecionados.length > 0) {
        const setIds = new Set(itensIdsSelecionados);
        alvos = disponiveisDoProduto.filter((i) => setIds.has(i.id));
      } else if (codigosBaixa.length > 0) {
        const mapaDisp = new Map(
          disponiveisDoProduto.map((i) => [
            i.codigoIndividual.toUpperCase(),
            i,
          ])
        );
        for (const cod of codigosBaixa) {
          const achado = mapaDisp.get(cod.toUpperCase());
          if (!achado) {
            throw new Error(
              `O código individual "${cod}" não está disponível neste produto.`
            );
          }
          if (!alvos.some((a) => a.id === achado.id)) {
            alvos.push(achado);
          }
        }
      } else {
        throw new Error(
          "Selecione ou informe o código de barras individual do item para dar baixa."
        );
      }

      if (alvos.length === 0) {
        throw new Error(
          "Nenhum dos códigos individuais informados está disponível para baixa."
        );
      }

      const qtdTotalBaixa = Number(
        alvos.reduce((acc, a) => acc + a.quantidade, 0).toFixed(4)
      );
      const novoSaldo = Math.max(
        0,
        Number((banco.quantidade - qtdTotalBaixa).toFixed(4))
      );

      await tx
        .update(itensIndividuais)
        .set({
          status: "BAIXADO",
          baixadoEm: new Date(),
          observacao: observacao
            ? `Baixa: ${observacao}`
            : "Baixa registrada por código individual",
        })
        .where(
          inArray(
            itensIndividuais.id,
            alvos.map((a) => a.id)
          )
        );

      await tx
        .update(bancosItens)
        .set({
          quantidade: novoSaldo,
          atualizadoEm: new Date(),
        })
        .where(eq(bancosItens.id, bancoId));

      const ordenados = ordenarPorCodigoIndividual(alvos, "asc");
      const refCodigos =
        ordenados.length <= 5
          ? ordenados.map((a) => a.codigoIndividual).join(", ")
          : `${ordenados
              .slice(0, 5)
              .map((a) => a.codigoIndividual)
              .join(", ")} (+${ordenados.length - 5})`;

      await tx.insert(movimentacoes).values({
        bancoItemId: bancoId,
        itemIndividualId: ordenados.length === 1 ? ordenados[0].id : null,
        codigoIndividualRef: refCodigos,
        tipo: "BAIXA",
        quantidade: qtdTotalBaixa,
        saldoApos: novoSaldo,
        observacao: observacao || "Baixa por código de barras individual",
        operador,
      });

      return {
        novoSaldo,
        codigosAfetados: ordenados.map((a) => a.codigoIndividual),
      };
    });

    return NextResponse.json(resultado);
  } catch (error) {
    const mensagem =
      error instanceof Error
        ? error.message
        : "Erro ao registrar movimentação.";
    return NextResponse.json({ error: mensagem }, { status: 400 });
  }
}
