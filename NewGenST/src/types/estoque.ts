import type { StatusEstoque, StatusValidade } from "@/lib/estoque-domain";

export interface CodigoIndividualResumo {
  id: number;
  codigoIndividual: string;
  quantidade: number;
  lote: string;
  dataValidade: string;
  localizacao: string;
  status: "DISPONIVEL" | "RETIRADO" | "BAIXADO" | string;
  portadorAtual?: string;
  destinoAtual?: string;
  retiradoEm?: string | null;
  devolvidoEm?: string | null;
}

export interface BancoItemResumo {
  id: number;
  codigoBanco: string;
  prefixoCodigo: string;
  nome: string;
  codigoBarras: string;
  foto: string;
  unidade: string;
  estoqueMinimo: number;
  controlaLote: boolean;
  quantidade: number;
  sequencialAtual: number;
  criadoEm: string;
  atualizadoEm: string;
  statusEstoque: StatusEstoque;
  itensDisponiveisCount: number;
  itensRetiradosCount?: number;
  itensBaixadosCount?: number;
  totalRegistrosCount?: number;
  lotesAtivos?: string[];
  vencendoCount: number;
  vencidosCount?: number;
  primeiroCodigoAtivo?: string | null;
  ultimoCodigoAtivo?: string | null;
  codigosDisponiveisPreview?: CodigoIndividualResumo[];
  codigosRetiradosPreview?: CodigoIndividualResumo[];
  codigosEncontradosNaBusca?: string[];
}

export interface ResumoGeralEstoque {
  totalBancos: number;
  totalCodigosAtivos: number;
  totalRetiradosAgora: number;
  estoqueBaixoOuCritico: number;
  vencendoLote: number;
}

export interface ItemIndividualDetalhe {
  id: number;
  bancoItemId: number;
  codigoIndividual: string;
  quantidade: number;
  lote: string;
  dataFabricacao: string;
  dataValidade: string;
  localizacao: string;
  status: "DISPONIVEL" | "RETIRADO" | "BAIXADO" | string;
  portadorAtual: string;
  destinoAtual: string;
  retiradoEm: string | null;
  devolvidoEm: string | null;
  observacao: string;
  criadoEm: string;
  baixadoEm: string | null;
  statusValidade: StatusValidade;
  diasParaVencer: number | null;
}

export interface RetiradaDispositivoDetalhe {
  id: number;
  bancoItemId: number;
  itemIndividualId: number;
  codigoIndividual: string;
  responsavelRetirada: string;
  destinoUso: string;
  dataHoraRetirada: string;
  previsaoDevolucao: string | null;
  dataHoraDevolucao: string | null;
  localArmazenamentoDevolucao: string;
  condicaoDevolucao: string;
  observacao: string;
  operadorRetirada: string;
  operadorDevolucao: string;
  status: "EM_USO" | "DEVOLVIDO" | string;
  nomeBanco?: string;
  codigoBanco?: string;
  unidade?: string;
  fotoBanco?: string;
}

export interface MovimentacaoDetalhe {
  id: number;
  bancoItemId: number;
  itemIndividualId: number | null;
  codigoIndividualRef: string;
  tipo: "ENTRADA" | "RETIRADA" | "DEVOLUCAO" | "BAIXA" | string;
  quantidade: number;
  saldoApos: number;
  observacao: string;
  operador: string;
  data: string;
  nomeBanco?: string;
  codigoBanco?: string;
  unidade?: string;
}

export interface ConfirmacaoAlteracaoDetalhe {
  id: number;
  etapaOrigem: string;
  etapaDestino: string;
  acao: string;
  detalhes: string;
  bancoItemId: number | null;
  operador: string;
  confirmadoEm: string;
}

export interface AlertaValidadeItem extends ItemIndividualDetalhe {
  nomeBanco: string;
  codigoBanco: string;
  unidade: string;
  diasRestantes: number | null;
}

export interface OperadorDetalhe {
  id: number;
  nome: string;
  cargo: string;
  codigoAcesso: string;
  ativo: boolean;
  criadoEm: string;
}

export interface UsuarioSessao {
  id: number;
  nome: string;
  cargo: string;
  codigoAcesso: string;
}

export interface ResumoCampoConfirmacao {
  rotulo: string;
  valor: string;
}

export interface ParametrosConfirmacaoAlteracao {
  categoriaOperacao: string;
  tituloAcao: string;
  descricao: string;
  resumoDados?: ResumoCampoConfirmacao[];
  bancoItemId?: number | null;
  textoBotaoConfirmar?: string;
  variante?: "roxo" | "verde" | "amarelo" | "vermelho";
}

export type FuncaoConfirmarAlteracao = (
  params: ParametrosConfirmacaoAlteracao
) => Promise<boolean>;
