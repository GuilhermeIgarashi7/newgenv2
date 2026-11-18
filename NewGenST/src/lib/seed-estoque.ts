import { db } from "@/db";
import {
  bancosItens,
  itensIndividuais,
  movimentacoes,
  confirmacoesEtapas,
  operadores,
} from "@/db/schema";
import { count, sql } from "drizzle-orm";

function somarDiasDataISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

let seedEmAndamento: Promise<void> | null = null;
let tabelasVerificadas = false;

async function garantirEstruturaTabelas(): Promise<void> {
  if (tabelasVerificadas) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bancos_itens (
      id SERIAL PRIMARY KEY,
      codigo_banco VARCHAR(64) NOT NULL UNIQUE,
      prefixo_codigo VARCHAR(24) NOT NULL,
      nome VARCHAR(255) NOT NULL,
      codigo_barras VARCHAR(100) NOT NULL DEFAULT '',
      foto TEXT NOT NULL DEFAULT '',
      unidade VARCHAR(20) NOT NULL DEFAULT 'un',
      estoque_minimo DOUBLE PRECISION NOT NULL DEFAULT 0,
      controla_lote BOOLEAN NOT NULL DEFAULT false,
      quantidade DOUBLE PRECISION NOT NULL DEFAULT 0,
      sequencial_atual INTEGER NOT NULL DEFAULT 0,
      criado_em TIMESTAMP NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMP NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS itens_individuais (
      id SERIAL PRIMARY KEY,
      banco_item_id INTEGER NOT NULL REFERENCES bancos_itens(id) ON DELETE CASCADE,
      codigo_individual VARCHAR(100) NOT NULL,
      quantidade DOUBLE PRECISION NOT NULL DEFAULT 1,
      lote VARCHAR(100) NOT NULL DEFAULT '',
      data_fabricacao VARCHAR(20) NOT NULL DEFAULT '',
      data_validade VARCHAR(20) NOT NULL DEFAULT '',
      localizacao VARCHAR(120) NOT NULL DEFAULT '',
      status VARCHAR(24) NOT NULL DEFAULT 'DISPONIVEL',
      observacao TEXT NOT NULL DEFAULT '',
      criado_em TIMESTAMP NOT NULL DEFAULT now(),
      baixado_em TIMESTAMP
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS movimentacoes (
      id SERIAL PRIMARY KEY,
      banco_item_id INTEGER NOT NULL REFERENCES bancos_itens(id) ON DELETE CASCADE,
      item_individual_id INTEGER,
      codigo_individual_ref VARCHAR(140) NOT NULL DEFAULT '',
      tipo VARCHAR(24) NOT NULL,
      quantidade DOUBLE PRECISION NOT NULL,
      saldo_apos DOUBLE PRECISION NOT NULL,
      observacao TEXT NOT NULL DEFAULT '',
      operador VARCHAR(100) NOT NULL DEFAULT 'Operador Padrão',
      data TIMESTAMP NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS confirmacoes_etapas (
      id SERIAL PRIMARY KEY,
      etapa_origem VARCHAR(80) NOT NULL,
      etapa_destino VARCHAR(80) NOT NULL,
      acao VARCHAR(180) NOT NULL,
      detalhes TEXT NOT NULL DEFAULT '',
      banco_item_id INTEGER,
      operador VARCHAR(100) NOT NULL DEFAULT 'Operador Padrão',
      confirmado_em TIMESTAMP NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS operadores (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(120) NOT NULL,
      cargo VARCHAR(80) NOT NULL DEFAULT 'Almoxarife',
      codigo_acesso VARCHAR(40) NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT true,
      criado_em TIMESTAMP NOT NULL DEFAULT now()
    );
  `);

  tabelasVerificadas = true;
}

export async function garantirDadosIniciais(): Promise<void> {
  if (seedEmAndamento) {
    return seedEmAndamento;
  }

  seedEmAndamento = (async () => {
    try {
      await garantirEstruturaTabelas();

      const [{ totalOp }] = await db
        .select({ totalOp: count() })
        .from(operadores);

      if (totalOp === 0) {
        await db.insert(operadores).values([
          {
            nome: "Carlos Mendes",
            cargo: "Supervisor de Estoque",
            codigoAcesso: "OP-101",
            ativo: true,
          },
          {
            nome: "Ana Paula Rocha",
            cargo: "Conferente de Lotes",
            codigoAcesso: "OP-102",
            ativo: true,
          },
          {
            nome: "Marcos Vinícius",
            cargo: "Auxiliar de Almoxarifado",
            codigoAcesso: "OP-103",
            ativo: true,
          },
        ]);
      }

      const [{ totalBancos }] = await db
        .select({ totalBancos: count() })
        .from(bancosItens);

      if (totalBancos > 0) {
        return;
      }

      // 1. Arroz Tipo 1 — 5kg (EM ESTOQUE - cada pacote tem seu código de barras individual próprio)
      const codigosArroz = [
        "7891234500101",
        "7891234500102",
        "7891234500103",
        "7891234500104",
        "7891234500105",
        "7891234500106",
      ];

      const [arroz] = await db
        .insert(bancosItens)
        .values({
          codigoBanco: "BD-ARR-001",
          prefixoCodigo: "ARR",
          nome: "Arroz Tipo 1 — 5kg",
          codigoBarras: "7891234500000",
          foto: "",
          unidade: "pct",
          estoqueMinimo: 2,
          controlaLote: true,
          quantidade: codigosArroz.length,
          sequencialAtual: codigosArroz.length,
        })
        .returning();

      await db.insert(itensIndividuais).values(
        codigosArroz.map((codigo, idx) => ({
          bancoItemId: arroz.id,
          codigoIndividual: codigo,
          quantidade: 1,
          lote: idx < 3 ? "LT-2026-A1" : "LT-2026-A2",
          dataFabricacao: somarDiasDataISO(-45),
          dataValidade: idx < 3 ? somarDiasDataISO(120) : somarDiasDataISO(180),
          localizacao: "Corredor A · Prat. 01",
          status: "DISPONIVEL",
          observacao: "Código de barras individual lido na entrada",
        }))
      );

      await db.insert(movimentacoes).values({
        bancoItemId: arroz.id,
        codigoIndividualRef: `${codigosArroz[0]} (+${codigosArroz.length - 1})`,
        tipo: "ENTRADA",
        quantidade: codigosArroz.length,
        saldoApos: codigosArroz.length,
        observacao: "Entrada inicial com códigos de barras individuais dos itens",
        operador: "Carlos Mendes",
      });

      // 2. Leite Integral UHT — 1L (BAIXO - 5 caixas, mínimo 3; 2 caixas vencendo em breve)
      const codigosLeite = [
        "7896051100201",
        "7896051100202",
        "7896051100203",
        "7896051100204",
        "7896051100205",
      ];

      const [leite] = await db
        .insert(bancosItens)
        .values({
          codigoBanco: "BD-LEI-002",
          prefixoCodigo: "LEI",
          nome: "Leite Integral UHT — 1L",
          codigoBarras: "7896051100000",
          foto: "",
          unidade: "cx",
          estoqueMinimo: 3,
          controlaLote: true,
          quantidade: codigosLeite.length,
          sequencialAtual: codigosLeite.length,
        })
        .returning();

      await db.insert(itensIndividuais).values(
        codigosLeite.map((codigo, idx) => {
          const vencendoLogo = idx < 2;
          return {
            bancoItemId: leite.id,
            codigoIndividual: codigo,
            quantidade: 1,
            lote: vencendoLogo ? "LT-2026-URG" : "LT-2026-NOV",
            dataFabricacao: somarDiasDataISO(-80),
            dataValidade: vencendoLogo
              ? somarDiasDataISO(11)
              : somarDiasDataISO(75),
            localizacao: "Câmara Seca · Prat. 03",
            status: "DISPONIVEL",
            observacao: vencendoLogo
              ? "Priorizar saída (vencimento próximo)"
              : "Lote regular",
          };
        })
      );

      await db.insert(movimentacoes).values({
        bancoItemId: leite.id,
        codigoIndividualRef: `${codigosLeite[0]} (+${codigosLeite.length - 1})`,
        tipo: "ENTRADA",
        quantidade: codigosLeite.length,
        saldoApos: codigosLeite.length,
        observacao: "Leitura individual dos códigos de barras de cada caixa",
        operador: "Ana Paula Rocha",
      });

      // 3. Óleo de Soja Refinado — 900ml (CRÍTICO - 3 unidades, mínimo 4)
      const codigosOleo = [
        "7891107000301",
        "7891107000302",
        "7891107000303",
      ];

      const [oleo] = await db
        .insert(bancosItens)
        .values({
          codigoBanco: "BD-OLE-003",
          prefixoCodigo: "OLE",
          nome: "Óleo de Soja Refinado — 900ml",
          codigoBarras: "7891107000000",
          foto: "",
          unidade: "un",
          estoqueMinimo: 4,
          controlaLote: false,
          quantidade: codigosOleo.length,
          sequencialAtual: codigosOleo.length,
        })
        .returning();

      await db.insert(itensIndividuais).values(
        codigosOleo.map((codigo) => ({
          bancoItemId: oleo.id,
          codigoIndividual: codigo,
          quantidade: 1,
          lote: "",
          dataFabricacao: "",
          dataValidade: "",
          localizacao: "Corredor B · Prat. 02",
          status: "DISPONIVEL",
          observacao: "Reposição necessária em breve",
        }))
      );

      await db.insert(movimentacoes).values({
        bancoItemId: oleo.id,
        codigoIndividualRef: codigosOleo.join(", "),
        tipo: "ENTRADA",
        quantidade: codigosOleo.length,
        saldoApos: codigosOleo.length,
        observacao: "Entrada com códigos de barras individuais",
        operador: "Carlos Mendes",
      });

      await db.insert(confirmacoesEtapas).values([
        {
          etapaOrigem: "NewGenST",
          etapaDestino: "ENTRADA INICIAL",
          acao: "Carga inicial de produtos com códigos de barras individuais",
          detalhes:
            "Produtos cadastrados com leitura dos códigos individuais de cada unidade física.",
          bancoItemId: arroz.id,
          operador: "Carlos Mendes",
        },
      ]);
    } finally {
      seedEmAndamento = null;
    }
  })();

  return seedEmAndamento;
}
