import { db } from "@/db";
import {
  bancosItens,
  itensIndividuais,
  retiradasDispositivos,
  movimentacoes,
  confirmacoesEtapas,
  operadores,
} from "@/db/schema";
import { count, eq, sql } from "drizzle-orm";
import { gerarHashSenha } from "./auth";

function somarDiasDataISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function subtrairHoras(horas: number): Date {
  return new Date(Date.now() - horas * 60 * 60 * 1000);
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
      portador_atual VARCHAR(140) NOT NULL DEFAULT '',
      destino_atual VARCHAR(180) NOT NULL DEFAULT '',
      retirado_em TIMESTAMP,
      devolvido_em TIMESTAMP,
      observacao TEXT NOT NULL DEFAULT '',
      criado_em TIMESTAMP NOT NULL DEFAULT now(),
      baixado_em TIMESTAMP
    );
  `);

  // Garante colunas novas caso a tabela já existisse de versão anterior
  await db.execute(sql`
    ALTER TABLE itens_individuais
      ADD COLUMN IF NOT EXISTS portador_atual VARCHAR(140) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS destino_atual VARCHAR(180) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS retirado_em TIMESTAMP,
      ADD COLUMN IF NOT EXISTS devolvido_em TIMESTAMP;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS retiradas_dispositivos (
      id SERIAL PRIMARY KEY,
      banco_item_id INTEGER NOT NULL REFERENCES bancos_itens(id) ON DELETE CASCADE,
      item_individual_id INTEGER NOT NULL REFERENCES itens_individuais(id) ON DELETE CASCADE,
      codigo_individual VARCHAR(100) NOT NULL,
      responsavel_retirada VARCHAR(140) NOT NULL,
      destino_uso VARCHAR(180) NOT NULL,
      data_hora_retirada TIMESTAMP NOT NULL DEFAULT now(),
      previsao_devolucao TIMESTAMP,
      data_hora_devolucao TIMESTAMP,
      local_armazenamento_devolucao VARCHAR(120) NOT NULL DEFAULT '',
      condicao_devolucao VARCHAR(120) NOT NULL DEFAULT '',
      observacao TEXT NOT NULL DEFAULT '',
      operador_retirada VARCHAR(100) NOT NULL DEFAULT 'Operador Padrão',
      operador_devolucao VARCHAR(100) NOT NULL DEFAULT '',
      status VARCHAR(24) NOT NULL DEFAULT 'EM_USO'
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
      senha_hash VARCHAR(255) NOT NULL DEFAULT '',
      cargo VARCHAR(80) NOT NULL DEFAULT 'Almoxarife',
      codigo_acesso VARCHAR(40) NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT true,
      criado_em TIMESTAMP NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    ALTER TABLE operadores
      ADD COLUMN IF NOT EXISTS senha_hash VARCHAR(255) NOT NULL DEFAULT '';
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
        const hashPadrao = gerarHashSenha("1234");
        await db.insert(operadores).values([
          {
            nome: "Carlos Mendes",
            senhaHash: hashPadrao,
            cargo: "Supervisor de Estoque",
            codigoAcesso: "OP-101",
            ativo: true,
          },
          {
            nome: "Ana Paula Rocha",
            senhaHash: hashPadrao,
            cargo: "Conferente de Dispositivos",
            codigoAcesso: "OP-102",
            ativo: true,
          },
          {
            nome: "Marcos Vinícius",
            senhaHash: hashPadrao,
            cargo: "Auxiliar de Almoxarifado",
            codigoAcesso: "OP-103",
            ativo: true,
          },
        ]);
      } else {
        // Garante que usuários pré-existentes sem senha tenham a senha inicial "1234"
        const semSenha = await db
          .select()
          .from(operadores)
          .where(eq(operadores.senhaHash, ""));
        if (semSenha.length > 0) {
          const hashPadrao = gerarHashSenha("1234");
          for (const op of semSenha) {
            await db
              .update(operadores)
              .set({ senhaHash: hashPadrao })
              .where(eq(operadores.id, op.id));
          }
        }
      }

      const [{ totalBancos }] = await db
        .select({ totalBancos: count() })
        .from(bancosItens);

      if (totalBancos === 0) {
        // 1. Arroz Tipo 1 — 5kg
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
            dataValidade:
              idx < 3 ? somarDiasDataISO(120) : somarDiasDataISO(180),
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
          observacao:
            "Entrada inicial com códigos de barras individuais dos itens",
          operador: "Carlos Mendes",
        });

        // 2. Leite Integral UHT — 1L
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
      }

      // Garante exemplos iniciais apenas quando o banco de produtos estiver totalmente vazio
      const [{ totalRetiradas }] = await db
        .select({ totalRetiradas: count() })
        .from(retiradasDispositivos);

      if (totalBancos === 0 && totalRetiradas === 0) {
        const [coletorBanco] = await db
          .insert(bancosItens)
          .values({
            codigoBanco: "BD-ZBR-004",
            prefixoCodigo: "ZBR",
            nome: "Coletor de Dados Zebra TC21",
            codigoBarras: "7899001200000",
            foto: "",
            unidade: "un",
            estoqueMinimo: 1,
            controlaLote: false,
            quantidade: 2, // 4 dispositivos totais, mas 2 estão retirados em campo neste momento!
            sequencialAtual: 4,
          })
          .returning();

        const dataRetiradaAtiva1 = subtrairHoras(3.5);
        const dataRetiradaAtiva2 = subtrairHoras(1.25);
        const dataRetiradaDevolvida = subtrairHoras(26);
        const dataDevolucaoConcluida = subtrairHoras(20.5);

        const [disp1, disp2, disp3] = await db
          .insert(itensIndividuais)
          .values([
            {
              bancoItemId: coletorBanco.id,
              codigoIndividual: "ZBR-TC21-9041",
              quantidade: 1,
              localizacao: "Em uso: Expedição — Doca 02",
              status: "RETIRADO",
              portadorAtual: "Lucas Almeida",
              destinoAtual: "Expedição — Doca 02",
              retiradoEm: dataRetiradaAtiva1,
              observacao: "Retirado para conferência de carga",
            },
            {
              bancoItemId: coletorBanco.id,
              codigoIndividual: "ZBR-TC21-9042",
              quantidade: 1,
              localizacao: "Em uso: Equipe Externa · Viatura 04",
              status: "RETIRADO",
              portadorAtual: "Fernanda Lima",
              destinoAtual: "Equipe Externa · Viatura 04",
              retiradoEm: dataRetiradaAtiva2,
              observacao: "Inventário na unidade filial",
            },
            {
              bancoItemId: coletorBanco.id,
              codigoIndividual: "ZBR-TC21-9043",
              quantidade: 1,
              localizacao: "Armário Técnico · Baia 03",
              status: "DISPONIVEL",
              devolvidoEm: dataDevolucaoConcluida,
              observacao: "Devolvido carregado e higienizado",
            },
            {
              bancoItemId: coletorBanco.id,
              codigoIndividual: "ZBR-TC21-9044",
              quantidade: 1,
              localizacao: "Armário Técnico · Baia 04",
              status: "DISPONIVEL",
              observacao: "Disponível na base",
            },
          ])
          .returning();

        await db.insert(retiradasDispositivos).values([
          {
            bancoItemId: coletorBanco.id,
            itemIndividualId: disp1.id,
            codigoIndividual: "ZBR-TC21-9041",
            responsavelRetirada: "Lucas Almeida",
            destinoUso: "Expedição — Doca 02",
            dataHoraRetirada: dataRetiradaAtiva1,
            previsaoDevolucao: new Date(Date.now() + 4 * 60 * 60 * 1000),
            observacao: "Conferência de romaneio turno tarde",
            operadorRetirada: "Carlos Mendes",
            status: "EM_USO",
          },
          {
            bancoItemId: coletorBanco.id,
            itemIndividualId: disp2.id,
            codigoIndividual: "ZBR-TC21-9042",
            responsavelRetirada: "Fernanda Lima",
            destinoUso: "Equipe Externa · Viatura 04",
            dataHoraRetirada: dataRetiradaAtiva2,
            previsaoDevolucao: new Date(Date.now() + 6 * 60 * 60 * 1000),
            observacao: "Vistoria técnica externa",
            operadorRetirada: "Ana Paula Rocha",
            status: "EM_USO",
          },
          {
            bancoItemId: coletorBanco.id,
            itemIndividualId: disp3.id,
            codigoIndividual: "ZBR-TC21-9043",
            responsavelRetirada: "Roberto Nunes",
            destinoUso: "Recebimento — Galpão B",
            dataHoraRetirada: dataRetiradaDevolvida,
            dataHoraDevolucao: dataDevolucaoConcluida,
            localArmazenamentoDevolucao: "Armário Técnico · Baia 03",
            condicaoDevolucao: "Perfeito estado (100% bateria)",
            observacao: "Uso concluído no turno anterior",
            operadorRetirada: "Carlos Mendes",
            operadorDevolucao: "Ana Paula Rocha",
            status: "DEVOLVIDO",
          },
        ]);

        await db.insert(movimentacoes).values([
          {
            bancoItemId: coletorBanco.id,
            codigoIndividualRef: "ZBR-TC21-9041 (+3)",
            tipo: "ENTRADA",
            quantidade: 4,
            saldoApos: 4,
            observacao: "Cadastro inicial dos coletores de dados",
            operador: "Carlos Mendes",
            data: subtrairHoras(48),
          },
          {
            bancoItemId: coletorBanco.id,
            itemIndividualId: disp3.id,
            codigoIndividualRef: "ZBR-TC21-9043",
            tipo: "RETIRADA",
            quantidade: 1,
            saldoApos: 3,
            observacao: "Retirado por Roberto Nunes → Recebimento — Galpão B",
            operador: "Carlos Mendes",
            data: dataRetiradaDevolvida,
          },
          {
            bancoItemId: coletorBanco.id,
            itemIndividualId: disp3.id,
            codigoIndividualRef: "ZBR-TC21-9043",
            tipo: "DEVOLUCAO",
            quantidade: 1,
            saldoApos: 4,
            observacao:
              "Devolvido por Roberto Nunes → Armário Técnico · Baia 03",
            operador: "Ana Paula Rocha",
            data: dataDevolucaoConcluida,
          },
          {
            bancoItemId: coletorBanco.id,
            itemIndividualId: disp1.id,
            codigoIndividualRef: "ZBR-TC21-9041",
            tipo: "RETIRADA",
            quantidade: 1,
            saldoApos: 3,
            observacao: "Retirado por Lucas Almeida → Expedição — Doca 02",
            operador: "Carlos Mendes",
            data: dataRetiradaAtiva1,
          },
          {
            bancoItemId: coletorBanco.id,
            itemIndividualId: disp2.id,
            codigoIndividualRef: "ZBR-TC21-9042",
            tipo: "RETIRADA",
            quantidade: 1,
            saldoApos: 2,
            observacao:
              "Retirado por Fernanda Lima → Equipe Externa · Viatura 04",
            operador: "Ana Paula Rocha",
            data: dataRetiradaAtiva2,
          },
        ]);

        await db.insert(confirmacoesEtapas).values({
          etapaOrigem: "NewGenST",
          etapaDestino: "CONTROLE DE DISPOSITIVOS",
          acao: "Ativação do rastreamento de retiradas e devoluções com data e hora",
          detalhes:
            "Coletores Zebra TC21 registrados com histórico de retirada, localização atual e devolução.",
          bancoItemId: coletorBanco.id,
          operador: "Carlos Mendes",
        });
      }
    } finally {
      seedEmAndamento = null;
    }
  })();

  return seedEmAndamento;
}
