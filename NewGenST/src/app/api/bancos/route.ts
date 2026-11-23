import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bancosItens, itensIndividuais, movimentacoes } from "@/db/schema";
import { asc, inArray } from "drizzle-orm";
import { garantirDadosIniciais } from "@/lib/seed-estoque";
import { obterUsuarioAutenticado } from "@/lib/auth";
import {
  calcularStatusEstoque,
  calcularStatusValidade,
  extrairCodigosBarrasInseridos,
  gerarSiglaBanco,
  ordenarPorCodigoIndividual,
} from "@/lib/estoque-domain";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await garantirDadosIniciais();

    const termo =
      request.nextUrl.searchParams.get("termo")?.trim().toLowerCase() ?? "";

    const todosBancos = await db
      .select()
      .from(bancosItens)
      .orderBy(asc(bancosItens.nome));

    const todosItens = await db.select().from(itensIndividuais);

    const itensPorBanco = new Map<number, typeof todosItens>();
    for (const item of todosItens) {
      const lista = itensPorBanco.get(item.bancoItemId) ?? [];
      lista.push(item);
      itensPorBanco.set(item.bancoItemId, lista);
    }

    const enriquecidos = todosBancos.map((banco) => {
      const itens = ordenarPorCodigoIndividual(
        itensPorBanco.get(banco.id) ?? [],
        "asc"
      );
      const disponiveis = itens.filter((i) => i.status === "DISPONIVEL");
      const retirados = itens.filter((i) => i.status === "RETIRADO");
      const baixados = itens.filter((i) => i.status === "BAIXADO");

      const lotesSet = new Set(
        disponiveis.map((i) => i.lote.trim()).filter(Boolean)
      );

      let vencendoCount = 0;
      let vencidosCount = 0;
      for (const disp of [...disponiveis, ...retirados]) {
        const val = calcularStatusValidade(disp.dataValidade);
        if (val.status === "VENCENDO") vencendoCount++;
        if (val.status === "VENCIDO") vencidosCount++;
      }

      const status = calcularStatusEstoque(
        banco.quantidade,
        banco.estoqueMinimo
      );

      const codigosEncontradosNaBusca = termo
        ? itens
            .filter(
              (i) =>
                i.codigoIndividual.toLowerCase().includes(termo) ||
                i.portadorAtual.toLowerCase().includes(termo) ||
                i.destinoAtual.toLowerCase().includes(termo)
            )
            .map((i) => i.codigoIndividual)
        : [];

      return {
        ...banco,
        statusEstoque: status,
        itensDisponiveisCount: disponiveis.length,
        itensRetiradosCount: retirados.length,
        itensBaixadosCount: baixados.length,
        totalRegistrosCount: itens.length,
        lotesAtivos: Array.from(lotesSet),
        vencendoCount: vencendoCount + vencidosCount,
        vencidosCount,
        primeiroCodigoAtivo: disponiveis[0]?.codigoIndividual ?? null,
        ultimoCodigoAtivo:
          disponiveis[disponiveis.length - 1]?.codigoIndividual ?? null,
        codigosDisponiveisPreview: disponiveis.map((d) => ({
          id: d.id,
          codigoIndividual: d.codigoIndividual,
          quantidade: d.quantidade,
          lote: d.lote,
          dataValidade: d.dataValidade,
          localizacao: d.localizacao,
          status: d.status,
          devolvidoEm: d.devolvidoEm ? d.devolvidoEm.toISOString() : null,
        })),
        codigosRetiradosPreview: retirados.map((r) => ({
          id: r.id,
          codigoIndividual: r.codigoIndividual,
          quantidade: r.quantidade,
          lote: r.lote,
          dataValidade: r.dataValidade,
          localizacao: r.localizacao,
          status: r.status,
          portadorAtual: r.portadorAtual,
          destinoAtual: r.destinoAtual,
          retiradoEm: r.retiradoEm ? r.retiradoEm.toISOString() : null,
        })),
        codigosEncontradosNaBusca,
        textosBusca: itens.flatMap((i) => [
          i.codigoIndividual.toLowerCase(),
          i.portadorAtual.toLowerCase(),
          i.destinoAtual.toLowerCase(),
        ]),
      };
    });

    const filtrados = termo
      ? enriquecidos.filter(
          (b) =>
            b.nome.toLowerCase().includes(termo) ||
            b.codigoBanco.toLowerCase().includes(termo) ||
            (b.codigoBarras || "").toLowerCase().includes(termo) ||
            b.textosBusca.some((txt) => txt && txt.includes(termo))
        )
      : enriquecidos;

    const resposta = filtrados.map(
      ({ textosBusca: _ignorar, ...resto }) => resto
    );

    const totalAlertasEstoque = enriquecidos.filter(
      (b) => b.statusEstoque !== "OK"
    ).length;
    const totalVencendoGeral = enriquecidos.reduce(
      (acc, b) => acc + b.vencendoCount,
      0
    );
    const totalCodigosAtivosGeral = enriquecidos.reduce(
      (acc, b) => acc + b.itensDisponiveisCount,
      0
    );
    const totalRetiradosAgora = enriquecidos.reduce(
      (acc, b) => acc + b.itensRetiradosCount,
      0
    );

    return NextResponse.json({
      bancos: resposta,
      resumo: {
        totalBancos: enriquecidos.length,
        totalCodigosAtivos: totalCodigosAtivosGeral,
        totalRetiradosAgora,
        estoqueBaixoOuCritico: totalAlertasEstoque,
        vencendoLote: totalVencendoGeral,
      },
    });
  } catch (error) {
    console.error("Erro em GET /api/bancos:", error);
    return NextResponse.json(
      { error: "Falha ao carregar os produtos do estoque." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await garantirDadosIniciais();
    const body = await request.json();
    const usuarioLogado = await obterUsuarioAutenticado(
      String(body.operador ?? "").trim()
    );
    if (!usuarioLogado) {
      return NextResponse.json(
        { error: "Faça login com seu nome e senha para continuar." },
        { status: 401 }
      );
    }

    const nome = String(body.nome ?? "").trim();
    if (!nome) {
      return NextResponse.json(
        { error: "Informe o nome do produto ou dispositivo." },
        { status: 400 }
      );
    }

    const codigoBarras = String(body.codigoBarras ?? "").trim();
    const foto = String(body.foto ?? "");
    const unidade = String(body.unidade ?? "un").trim() || "un";
    const estoqueMinimo = Math.max(0, Number(body.estoqueMinimo) || 0);
    const controlaLote = Boolean(body.controlaLote);
    const loteInicial = String(body.loteInicial ?? "").trim();
    const validadeInicial = String(body.validadeInicial ?? "").trim();
    const localizacaoInicial = String(body.localizacaoInicial ?? "").trim();
    const operador = usuarioLogado.nome;

    let codigosIniciais: string[] = [];
    if (Array.isArray(body.codigosIniciais)) {
      codigosIniciais = body.codigosIniciais
        .map((c: unknown) => String(c ?? "").trim())
        .filter(Boolean);
    } else if (typeof body.codigosIniciaisTexto === "string") {
      codigosIniciais = extrairCodigosBarrasInseridos(
        body.codigosIniciaisTexto
      );
    }

    const vistosNoEnvio = new Set<string>();
    for (const cod of codigosIniciais) {
      const chave = cod.toUpperCase();
      if (vistosNoEnvio.has(chave)) {
        return NextResponse.json(
          {
            error: `O código individual "${cod}" foi informado mais de uma vez na mesma lista.`,
          },
          { status: 400 }
        );
      }
      vistosNoEnvio.add(chave);
    }

    const qtdPorItem = Math.max(
      0.0001,
      Number(body.quantidadePorItem) > 0 ? Number(body.quantidadePorItem) : 1
    );

    const sigla = gerarSiglaBanco(nome);

    const resultado = await db.transaction(async (tx) => {
      if (codigosIniciais.length > 0) {
        const ativosNoEstoque = await tx
          .select()
          .from(itensIndividuais)
          .where(
            inArray(itensIndividuais.status, ["DISPONIVEL", "RETIRADO"])
          );

        const mapaAtivos = new Set(
          ativosNoEstoque.map((i) => i.codigoIndividual.toUpperCase())
        );

        for (const cod of codigosIniciais) {
          if (mapaAtivos.has(cod.toUpperCase())) {
            throw new Error(
              `O código individual "${cod}" já está ativo (disponível ou retirado em uso).`
            );
          }
        }
      }

      const existentes = await tx.select().from(bancosItens);
      let contadorBanco = existentes.length + 1;
      let codigoBanco = `BD-${sigla}-${String(contadorBanco).padStart(3, "0")}`;
      const codigosUsados = new Set(
        existentes.map((e) => e.codigoBanco.toUpperCase())
      );
      while (codigosUsados.has(codigoBanco.toUpperCase())) {
        contadorBanco++;
        codigoBanco = `BD-${sigla}-${String(contadorBanco).padStart(3, "0")}`;
      }

      const saldoInicialTotal = Number(
        (codigosIniciais.length * qtdPorItem).toFixed(4)
      );

      const [novoBanco] = await tx
        .insert(bancosItens)
        .values({
          codigoBanco,
          prefixoCodigo: sigla,
          nome,
          codigoBarras,
          foto,
          unidade,
          estoqueMinimo,
          controlaLote,
          quantidade: saldoInicialTotal,
          sequencialAtual: codigosIniciais.length,
        })
        .returning();

      if (codigosIniciais.length > 0) {
        const registros = codigosIniciais.map((codigo) => ({
          bancoItemId: novoBanco.id,
          codigoIndividual: codigo,
          quantidade: qtdPorItem,
          lote: loteInicial,
          dataFabricacao: "",
          dataValidade: validadeInicial,
          localizacao: localizacaoInicial,
          status: "DISPONIVEL",
          observacao: "Código individual inserido no cadastro inicial",
        }));

        await tx.insert(itensIndividuais).values(registros);

        const refCodigos =
          codigosIniciais.length <= 4
            ? codigosIniciais.join(", ")
            : `${codigosIniciais.slice(0, 4).join(", ")} (+${codigosIniciais.length - 4})`;

        await tx.insert(movimentacoes).values({
          bancoItemId: novoBanco.id,
          codigoIndividualRef: refCodigos,
          tipo: "ENTRADA",
          quantidade: saldoInicialTotal,
          saldoApos: saldoInicialTotal,
          observacao: "Saldo inicial com códigos de barras individuais",
          operador,
        });
      }

      return novoBanco;
    });

    return NextResponse.json({ banco: resultado }, { status: 201 });
  } catch (error) {
    console.error("Erro em POST /api/bancos:", error);
    const mensagem =
      error instanceof Error ? error.message : "Erro ao cadastrar o produto.";
    return NextResponse.json({ error: mensagem }, { status: 400 });
  }
}
