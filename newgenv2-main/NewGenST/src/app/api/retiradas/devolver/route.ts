import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  bancosItens,
  itensIndividuais,
  movimentacoes,
  retiradasDispositivos,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { garantirDadosIniciais } from "@/lib/seed-estoque";
import { extrairCodigosBarrasInseridos } from "@/lib/estoque-domain";
import { obterUsuarioAutenticado } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await garantirDadosIniciais();
    const body = await request.json();
    const usuarioLogado = await obterUsuarioAutenticado(
      String(body.operador ?? "").trim()
    );
    if (!usuarioLogado) {
      return NextResponse.json(
        { error: "Sessão expirada. Entre novamente com seu nome e senha." },
        { status: 401 }
      );
    }

    const dataHoraDevolucao = body.dataHoraDevolucao
      ? new Date(body.dataHoraDevolucao)
      : new Date();
    if (Number.isNaN(dataHoraDevolucao.getTime())) {
      return NextResponse.json(
        { error: "Data e hora de devolução inválidas." },
        { status: 400 }
      );
    }

    const localArmazenamento = String(
      body.localArmazenamentoDevolucao ?? ""
    ).trim();
    const condicaoDevolucao =
      String(body.condicaoDevolucao ?? "").trim() || "Perfeito estado";
    const observacao = String(body.observacao ?? "").trim();
    const operador = usuarioLogado.nome;

    const retiradaIds: number[] = Array.isArray(body.retiradaIds)
      ? body.retiradaIds
          .map(Number)
          .filter((n: number) => !Number.isNaN(n) && n > 0)
      : [];

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
      // Busca todos os itens atualmente com status RETIRADO
      const itensRetirados = await tx
        .select()
        .from(itensIndividuais)
        .where(eq(itensIndividuais.status, "RETIRADO"));

      const retiradasEmAberto = await tx
        .select()
        .from(retiradasDispositivos)
        .where(eq(retiradasDispositivos.status, "EM_USO"));

      const itensMap = new Map<number, (typeof itensRetirados)[number]>();

      if (retiradaIds.length > 0) {
        const setRetIds = new Set(retiradaIds);
        const retsEscolhidas = retiradasEmAberto.filter((r) =>
          setRetIds.has(r.id)
        );
        const itemIdsDasRets = new Set(
          retsEscolhidas.map((r) => r.itemIndividualId)
        );
        for (const item of itensRetirados) {
          if (itemIdsDasRets.has(item.id)) {
            itensMap.set(item.id, item);
          }
        }
      }

      if (itensIds.length > 0) {
        const setItens = new Set(itensIds);
        for (const item of itensRetirados) {
          if (setItens.has(item.id)) {
            itensMap.set(item.id, item);
          }
        }
      }

      if (codigosIndividuais.length > 0) {
        const porCodigo = new Map(
          itensRetirados.map((i) => [i.codigoIndividual.toUpperCase(), i])
        );
        for (const cod of codigosIndividuais) {
          const achado = porCodigo.get(cod.toUpperCase());
          if (!achado) {
            throw new Error(
              `O código individual "${cod}" não consta como retirado no momento.`
            );
          }
          itensMap.set(achado.id, achado);
        }
      }

      const alvos = Array.from(itensMap.values());
      if (alvos.length === 0) {
        throw new Error(
          "Selecione ou bipe ao menos um dispositivo retirado para registrar a devolução."
        );
      }

      const idsAlvos = alvos.map((a) => a.id);

      // Finaliza os registros abertos em retiradas_dispositivos
      await tx
        .update(retiradasDispositivos)
        .set({
          status: "DEVOLVIDO",
          dataHoraDevolucao,
          localArmazenamentoDevolucao:
            localArmazenamento || "Devolvido à base",
          condicaoDevolucao,
          operadorDevolucao: operador,
          observacao: observacao
            ? `${observacao}`
            : "Devolução registrada com sucesso",
        })
        .where(
          and(
            eq(retiradasDispositivos.status, "EM_USO"),
            inArray(retiradasDispositivos.itemIndividualId, idsAlvos)
          )
        );

      // Agrupa por bancoItemId para restaurar o saldo disponível em cada produto
      const porBanco = new Map<number, typeof alvos>();
      for (const item of alvos) {
        const lista = porBanco.get(item.bancoItemId) ?? [];
        lista.push(item);
        porBanco.set(item.bancoItemId, lista);
      }

      for (const [bId, itensDoBanco] of porBanco.entries()) {
        const [banco] = await tx
          .select()
          .from(bancosItens)
          .where(eq(bancosItens.id, bId));

        if (!banco) continue;

        const qtdDevolvida = Number(
          itensDoBanco.reduce((acc, i) => acc + i.quantidade, 0).toFixed(4)
        );
        const novoSaldo = Number((banco.quantidade + qtdDevolvida).toFixed(4));

        for (const item of itensDoBanco) {
          const novaLoc = localArmazenamento || "Disponível na base";
          await tx
            .update(itensIndividuais)
            .set({
              status: "DISPONIVEL",
              portadorAtual: "",
              destinoAtual: "",
              devolvidoEm: dataHoraDevolucao,
              localizacao: novaLoc,
              observacao: `Devolvido (${condicaoDevolucao})${observacao ? ` — ${observacao}` : ""}`,
            })
            .where(eq(itensIndividuais.id, item.id));
        }

        await tx
          .update(bancosItens)
          .set({
            quantidade: novoSaldo,
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
          tipo: "DEVOLUCAO",
          quantidade: qtdDevolvida,
          saldoApos: novoSaldo,
          observacao: `Devolvido (${condicaoDevolucao})${localArmazenamento ? ` → Guardado em: ${localArmazenamento}` : ""}${observacao ? ` — ${observacao}` : ""}`,
          operador,
          data: dataHoraDevolucao,
        });
      }

      return {
        codigosDevolvidos: alvos.map((a) => a.codigoIndividual),
      };
    });

    return NextResponse.json(resultado);
  } catch (error) {
    const mensagem =
      error instanceof Error
        ? error.message
        : "Erro ao registrar devolução do dispositivo.";
    return NextResponse.json({ error: mensagem }, { status: 400 });
  }
}
