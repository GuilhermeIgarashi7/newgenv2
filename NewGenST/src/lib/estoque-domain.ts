export type StatusEstoque = "OK" | "BAIXO" | "CRITICO";

export const UNIDADES_DISPONIVEIS = [
  "un",
  "cx",
  "kg",
  "g",
  "L",
  "ml",
  "pct",
  "fardo",
] as const;

export const STATUS_CONFIG: Record<
  StatusEstoque,
  { texto: string; classe: "ok" | "baixo" | "critico" }
> = {
  OK: { texto: "EM ESTOQUE", classe: "ok" },
  BAIXO: { texto: "BAIXO", classe: "baixo" },
  CRITICO: { texto: "CRÍTICO", classe: "critico" },
};

/**
 * Regra de status do estoque:
 * - Saldo zero, ou no mínimo ou abaixo = CRÍTICO (vermelho)
 * - Até o dobro do mínimo = BAIXO (amarelo)
 * - Acima do dobro do mínimo = OK / EM ESTOQUE (verde)
 */
export function calcularStatusEstoque(
  quantidade: number,
  estoqueMinimo: number
): StatusEstoque {
  const qtd = Number(quantidade) || 0;
  const min = Number(estoqueMinimo) || 0;

  if (qtd <= 0) {
    return "CRITICO";
  }
  if (min > 0) {
    if (qtd <= min) return "CRITICO";
    if (qtd <= min * 2) return "BAIXO";
  }
  return "OK";
}

export type StatusValidade = "SEM_VALIDADE" | "EM_DIA" | "VENCENDO" | "VENCIDO";

export function calcularStatusValidade(
  dataValidade?: string | null,
  diasAlerta = 30
): { status: StatusValidade; diasRestantes: number | null } {
  if (!dataValidade || !dataValidade.trim()) {
    return { status: "SEM_VALIDADE", diasRestantes: null };
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const partes = dataValidade.split("-").map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) {
    return { status: "SEM_VALIDADE", diasRestantes: null };
  }

  const alvo = new Date(partes[0], partes[1] - 1, partes[2]);
  alvo.setHours(0, 0, 0, 0);

  const diffMs = alvo.getTime() - hoje.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diasRestantes < 0) {
    return { status: "VENCIDO", diasRestantes };
  }
  if (diasRestantes <= diasAlerta) {
    return { status: "VENCENDO", diasRestantes };
  }
  return { status: "EM_DIA", diasRestantes };
}

/**
 * Gera uma sigla curta apenas para identificar internamente o banco do produto (ex.: BD-ARR-001).
 * Os itens individuais NÃO usam geração automática — cada item usa o código de barras inserido pelo usuário.
 */
export function gerarSiglaBanco(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .toUpperCase();

  if (!limpo) return "PRD";

  const palavras = limpo.split(/\s+/).filter(Boolean);
  if (palavras[0].length >= 3) {
    return palavras[0].slice(0, 4);
  }
  const combinado = palavras.join("").slice(0, 4);
  return combinado.padEnd(3, "X");
}

/**
 * Extrai um ou múltiplos códigos de barras individuais digitados, lidos no leitor ou colados
 * (separados por quebra de linha, vírgula ou ponto-e-vírgula), preservando a ordem e sem vazios.
 */
export function extrairCodigosBarrasInseridos(textoBruto: string): string[] {
  return textoBruto
    .split(/[\r\n,;]+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Ordena a listagem do produto pelos códigos de barras individuais de cada item
 * (ordenação numérica/alfanumérica natural).
 */
export function ordenarPorCodigoIndividual<
  T extends { codigoIndividual: string }
>(itens: T[], direcao: "asc" | "desc" = "asc"): T[] {
  return [...itens].sort((a, b) => {
    const cmp = a.codigoIndividual.localeCompare(b.codigoIndividual, "pt-BR", {
      numeric: true,
      sensitivity: "base",
    });
    return direcao === "asc" ? cmp : -cmp;
  });
}
