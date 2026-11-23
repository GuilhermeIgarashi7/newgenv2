import {
  pgTable,
  serial,
  varchar,
  text,
  doublePrecision,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Cadastro de cada Produto / Modelo de Dispositivo
 */
export const bancosItens = pgTable("bancos_itens", {
  id: serial("id").primaryKey(),
  codigoBanco: varchar("codigo_banco", { length: 64 }).notNull().unique(),
  prefixoCodigo: varchar("prefixo_codigo", { length: 24 }).notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  codigoBarras: varchar("codigo_barras", { length: 100 }).default("").notNull(),
  foto: text("foto").default("").notNull(),
  unidade: varchar("unidade", { length: 20 }).default("un").notNull(),
  estoqueMinimo: doublePrecision("estoque_minimo").default(0).notNull(),
  controlaLote: boolean("controla_lote").default(false).notNull(),
  quantidade: doublePrecision("quantidade").default(0).notNull(),
  sequencialAtual: integer("sequencial_atual").default(0).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

/**
 * Registros unitários organizados pelos códigos de barras individuais de cada item/dispositivo.
 * Status possíveis: DISPONIVEL | RETIRADO | BAIXADO
 */
export const itensIndividuais = pgTable("itens_individuais", {
  id: serial("id").primaryKey(),
  bancoItemId: integer("banco_item_id")
    .notNull()
    .references(() => bancosItens.id, { onDelete: "cascade" }),
  codigoIndividual: varchar("codigo_individual", { length: 100 }).notNull(),
  quantidade: doublePrecision("quantidade").default(1).notNull(),
  lote: varchar("lote", { length: 100 }).default("").notNull(),
  dataFabricacao: varchar("data_fabricacao", { length: 20 }).default("").notNull(),
  dataValidade: varchar("data_validade", { length: 20 }).default("").notNull(),
  localizacao: varchar("localizacao", { length: 120 }).default("").notNull(),
  status: varchar("status", { length: 24 }).default("DISPONIVEL").notNull(), // DISPONIVEL | RETIRADO | BAIXADO
  portadorAtual: varchar("portador_atual", { length: 140 }).default("").notNull(),
  destinoAtual: varchar("destino_atual", { length: 180 }).default("").notNull(),
  retiradoEm: timestamp("retirado_em"),
  devolvidoEm: timestamp("devolvido_em"),
  observacao: text("observacao").default("").notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  baixadoEm: timestamp("baixado_em"),
});

/**
 * Controle completo de Retiradas e Devoluções (data/hora exata de saída, onde o dispositivo está,
 * responsável pela retirada e data/hora exata da devolução).
 */
export const retiradasDispositivos = pgTable("retiradas_dispositivos", {
  id: serial("id").primaryKey(),
  bancoItemId: integer("banco_item_id")
    .notNull()
    .references(() => bancosItens.id, { onDelete: "cascade" }),
  itemIndividualId: integer("item_individual_id")
    .notNull()
    .references(() => itensIndividuais.id, { onDelete: "cascade" }),
  codigoIndividual: varchar("codigo_individual", { length: 100 }).notNull(),
  responsavelRetirada: varchar("responsavel_retirada", { length: 140 }).notNull(),
  destinoUso: varchar("destino_uso", { length: 180 }).notNull(),
  dataHoraRetirada: timestamp("data_hora_retirada").defaultNow().notNull(),
  previsaoDevolucao: timestamp("previsao_devolucao"),
  dataHoraDevolucao: timestamp("data_hora_devolucao"),
  localArmazenamentoDevolucao: varchar("local_armazenamento_devolucao", {
    length: 120,
  })
    .default("")
    .notNull(),
  condicaoDevolucao: varchar("condicao_devolucao", { length: 120 })
    .default("")
    .notNull(),
  observacao: text("observacao").default("").notNull(),
  operadorRetirada: varchar("operador_retirada", { length: 100 })
    .default("Operador Padrão")
    .notNull(),
  operadorDevolucao: varchar("operador_devolucao", { length: 100 })
    .default("")
    .notNull(),
  status: varchar("status", { length: 24 }).default("EM_USO").notNull(), // EM_USO | DEVOLVIDO
});

/**
 * Histórico geral de movimentações (ENTRADA | RETIRADA | DEVOLUCAO | BAIXA)
 */
export const movimentacoes = pgTable("movimentacoes", {
  id: serial("id").primaryKey(),
  bancoItemId: integer("banco_item_id")
    .notNull()
    .references(() => bancosItens.id, { onDelete: "cascade" }),
  itemIndividualId: integer("item_individual_id"),
  codigoIndividualRef: varchar("codigo_individual_ref", { length: 140 })
    .default("")
    .notNull(),
  tipo: varchar("tipo", { length: 24 }).notNull(), // ENTRADA | RETIRADA | DEVOLUCAO | BAIXA
  quantidade: doublePrecision("quantidade").notNull(),
  saldoApos: doublePrecision("saldo_apos").notNull(),
  observacao: text("observacao").default("").notNull(),
  operador: varchar("operador", { length: 100 })
    .default("Operador Padrão")
    .notNull(),
  data: timestamp("data").defaultNow().notNull(),
});

/**
 * Auditoria de confirmações de alterações
 */
export const confirmacoesEtapas = pgTable("confirmacoes_etapas", {
  id: serial("id").primaryKey(),
  etapaOrigem: varchar("etapa_origem", { length: 80 }).notNull(),
  etapaDestino: varchar("etapa_destino", { length: 80 }).notNull(),
  acao: varchar("acao", { length: 180 }).notNull(),
  detalhes: text("detalhes").default("").notNull(),
  bancoItemId: integer("banco_item_id"),
  operador: varchar("operador", { length: 100 })
    .default("Operador Padrão")
    .notNull(),
  confirmadoEm: timestamp("confirmado_em").defaultNow().notNull(),
});

/**
 * Operadores/usuários responsáveis pelas confirmações e movimentações
 */
export const operadores = pgTable("operadores", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 120 }).notNull(),
  senhaHash: varchar("senha_hash", { length: 255 }).default("").notNull(),
  cargo: varchar("cargo", { length: 80 }).default("Almoxarife").notNull(),
  codigoAcesso: varchar("codigo_acesso", { length: 40 }).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export type BancoItem = typeof bancosItens.$inferSelect;
export type NovoBancoItem = typeof bancosItens.$inferInsert;
export type ItemIndividual = typeof itensIndividuais.$inferSelect;
export type RetiradaDispositivoRegistro =
  typeof retiradasDispositivos.$inferSelect;
export type MovimentacaoRegistro = typeof movimentacoes.$inferSelect;
export type ConfirmacaoEtapaRegistro = typeof confirmacoesEtapas.$inferSelect;
export type OperadorRegistro = typeof operadores.$inferSelect;
