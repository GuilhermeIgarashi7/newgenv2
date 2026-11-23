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
 * - Acima do dobro do mínimo = OK / EM ESTOQUE (roxo)
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
 * Gera uma sigla curta apenas para identificar internamente o banco do produto (ex.: BD-COL-001).
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
 * Extrai um ou múltiplos códigos de barras individuais digitados, lidos no leitor ou colados.
 */
export function extrairCodigosBarrasInseridos(textoBruto: string): string[] {
  return textoBruto
    .split(/[\r\n,;]+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Ordena a listagem do produto pelos códigos de barras individuais de cada item/dispositivo.
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

/**
 * Retorna a data e hora local atual no formato aceito pelo input `datetime-local` (YYYY-MM-DDTHH:mm)
 */
export function obterDataHoraLocalInput(dataBase: Date = new Date()): string {
  const ano = dataBase.getFullYear();
  const mes = String(dataBase.getMonth() + 1).padStart(2, "0");
  const dia = String(dataBase.getDate()).padStart(2, "0");
  const hora = String(dataBase.getHours()).padStart(2, "0");
  const min = String(dataBase.getMinutes()).padStart(2, "0");
  return `${ano}-${mes}-${dia}T${hora}:${min}`;
}

/**
 * Formata data e hora legível em pt-BR (ex.: "18/11/2026 às 14:35")
 */
export function formatarDataHoraBR(valor?: string | Date | null): string {
  if (!valor) return "—";
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  const data = d.toLocaleDateString("pt-BR");
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} às ${hora}`;
}

/**
 * Calcula o tempo decorrido entre a retirada e a devolução (ou momento atual se ainda estiver fora)
 */
export function calcularDuracaoUso(
  inicioISO: string | Date,
  fimISO?: string | Date | null
): string {
  const inicio = inicioISO instanceof Date ? inicioISO : new Date(inicioISO);
  const fim = fimISO
    ? fimISO instanceof Date
      ? fimISO
      : new Date(fimISO)
    : new Date();

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    return "—";
  }

  const diffMs = Math.max(0, fim.getTime() - inicio.getTime());
  const totalMinutos = Math.floor(diffMs / 60000);

  if (totalMinutos < 1) return "menos de 1 min";
  if (totalMinutos < 60) return `${totalMinutos} min`;

  const horas = Math.floor(totalMinutos / 60);
  const minutosResto = totalMinutos % 60;

  if (horas < 24) {
    return minutosResto > 0 ? `${horas}h ${minutosResto}min` : `${horas}h`;
  }

  const dias = Math.floor(horas / 24);
  const horasResto = horas % 24;
  return horasResto > 0 ? `${dias}d ${horasResto}h` : `${dias}d`;
}
