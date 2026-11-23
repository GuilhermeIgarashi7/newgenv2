"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  STATUS_CONFIG,
  UNIDADES_DISPONIVEIS,
  calcularDuracaoUso,
  extrairCodigosBarrasInseridos,
  formatarDataHoraBR,
  obterDataHoraLocalInput,
} from "@/lib/estoque-domain";
import {
  apiFetch,
  limparTokenSessaoCliente,
  obterUsuarioSessaoCliente,
  salvarTokenSessaoCliente,
  salvarUsuarioSessaoCliente,
} from "@/lib/client-api";
import type {
  BancoItemResumo,
  CodigoIndividualResumo,
  ItemIndividualDetalhe,
  MovimentacaoDetalhe,
  OperadorDetalhe,
  ParametrosConfirmacaoAlteracao,
  ResumoGeralEstoque,
  UsuarioSessao,
} from "@/types/estoque";
import ModalConfirmacaoEtapa from "./ModalConfirmacaoEtapa";
import ListagemCodigosIndividuais from "./ListagemCodigosIndividuais";
import ModalScannerCodigo from "./ModalScannerCodigo";
import CampoEntradaCodigosBarras from "./CampoEntradaCodigosBarras";
import AbaRetiradas from "./AbaRetiradas";
import AbaRelatorios from "./AbaRelatorios";
import AbaUsuarios from "./AbaUsuarios";
import TelaLogin from "./TelaLogin";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  CheckSquare,
  FolderOpen,
  LogOut,
  MapPin,
  ScanBarcode,
  Search,
  Square,
  Upload,
  User,
} from "lucide-react";

type AbaNavegacao =
  | "inicio"
  | "retiradas"
  | "produtos"
  | "relatorios"
  | "usuarios";
type TelaConteudo = "LISTA" | "CADASTRO" | "DETALHE";

export default function EstoqueApp() {
  const [abaAtiva, setAbaAtiva] = useState<AbaNavegacao>("inicio");
  const [telaConteudo, setTelaConteudo] = useState<TelaConteudo>("LISTA");

  // Dados do PostgreSQL
  const [bancos, setBancos] = useState<BancoItemResumo[]>([]);
  const [resumo, setResumo] = useState<ResumoGeralEstoque>({
    totalBancos: 0,
    totalCodigosAtivos: 0,
    totalRetiradosAgora: 0,
    estoqueBaixoOuCritico: 0,
    vencendoLote: 0,
  });
  const [carregandoInicial, setCarregandoInicial] = useState(true);

  // Autenticação e Operadores
  const [usuarioLogado, setUsuarioLogado] = useState<UsuarioSessao | null>(
    null
  );
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [operadores, setOperadores] = useState<OperadorDetalhe[]>([]);
  const operadorAtivo = usuarioLogado?.nome ?? "";

  // Busca e filtros rápidos
  const [buscaGeral, setBuscaGeral] = useState("");
  const [filtroAlertaRapido, setFiltroAlertaRapido] = useState<
    "TODOS" | "BAIXO" | "VENCENDO" | "EM_USO"
  >("TODOS");

  // Produto aberto na tela de Listagem de Códigos Individuais
  const [bancoSelecionado, setBancoSelecionado] =
    useState<BancoItemResumo | null>(null);
  const [itensBancoAberto, setItensBancoAberto] = useState<
    ItemIndividualDetalhe[]
  >([]);
  const [movimentacoesBancoAberto, setMovimentacoesBancoAberto] = useState<
    MovimentacaoDetalhe[]
  >([]);

  // Formulário de Novo / Editar Produto
  const [bancoEmEdicao, setBancoEmEdicao] = useState<BancoItemResumo | null>(
    null
  );
  const [formNome, setFormNome] = useState("");
  const [formCodigoBarrasRef, setFormCodigoBarrasRef] = useState("");
  const [formFoto, setFormFoto] = useState("");
  const [formUnidade, setFormUnidade] = useState("un");
  const [formEstoqueMinimo, setFormEstoqueMinimo] = useState("0");
  const [formControlaLote, setFormControlaLote] = useState(false);

  // Códigos de barras individuais iniciais
  const [codigosIniciaisLista, setCodigosIniciaisLista] = useState<string[]>(
    []
  );
  const [codigoInicialDigitando, setCodigoInicialDigitando] = useState("");
  const [qtdPorItemInicial, setQtdPorItemInicial] = useState("1");
  const [formLoteInicial, setFormLoteInicial] = useState("");
  const [formValidadeInicial, setFormValidadeInicial] = useState("");
  const [formLocalizacaoInicial, setFormLocalizacaoInicial] = useState("");

  const inputFotoCameraRef = useRef<HTMLInputElement | null>(null);
  const inputFotoArquivoRef = useRef<HTMLInputElement | null>(null);

  // Modal rápido de Entrada / Baixa nos cards da tela inicial
  const [movRapidoModal, setMovRapidoModal] = useState<{
    banco: BancoItemResumo;
    tipo: "ENTRADA" | "BAIXA";
  } | null>(null);
  const [codigosMovEntradaLista, setCodigosMovEntradaLista] = useState<
    string[]
  >([]);
  const [codigoMovEntradaDigitando, setCodigoMovEntradaDigitando] =
    useState("");
  const [qtdPorItemMovRapido, setQtdPorItemMovRapido] = useState("1");
  const [loteMovRapido, setLoteMovRapido] = useState("");
  const [validadeMovRapido, setValidadeMovRapido] = useState("");
  const [localMovRapido, setLocalMovRapido] = useState("");
  const [obsMovRapido, setObsMovRapido] = useState("");
  const [idsSelecionadosBaixaRapida, setIdsSelecionadosBaixaRapida] = useState<
    number[]
  >([]);
  const [codigoBipBaixaRapida, setCodigoBipBaixaRapida] = useState("");

  // Modal rápido de RETIRADA DE DISPOSITIVO (Data/Hora + Onde ficará + Responsável automático)
  const [retiradaRapidaModal, setRetiradaRapidaModal] =
    useState<BancoItemResumo | null>(null);
  const [idsRetiradaRapida, setIdsRetiradaRapida] = useState<number[]>([]);
  const [destinoRetiradaRapida, setDestinoRetiradaRapida] = useState("");
  const [dataHoraRetiradaRapida, setDataHoraRetiradaRapida] = useState(() =>
    obterDataHoraLocalInput()
  );
  const [previsaoRetiradaRapida, setPrevisaoRetiradaRapida] = useState("");
  const [obsRetiradaRapida, setObsRetiradaRapida] = useState("");
  const [erroRetiradaRapida, setErroRetiradaRapida] = useState("");
  const [salvandoAcaoRapida, setSalvandoAcaoRapida] = useState(false);

  // Modal rápido de DEVOLUÇÃO DE DISPOSITIVO (Data/Hora de devolução + Onde guardou)
  const [devolucaoRapidaModal, setDevolucaoRapidaModal] = useState<{
    banco: BancoItemResumo;
    itemInicial?: CodigoIndividualResumo;
  } | null>(null);
  const [idsDevolucaoRapida, setIdsDevolucaoRapida] = useState<number[]>([]);
  const [dataHoraDevolucaoRapida, setDataHoraDevolucaoRapida] = useState(() =>
    obterDataHoraLocalInput()
  );
  const [localDevolucaoRapida, setLocalDevolucaoRapida] = useState("");
  const [condicaoDevolucaoRapida, setCondicaoDevolucaoRapida] =
    useState("Perfeito estado");
  const [obsDevolucaoRapida, setObsDevolucaoRapida] = useState("");

  // Leitor de código de barras no cabeçalho
  const [scannerAberto, setScannerAberto] = useState(false);

  // Toast de feedback
  const [notificacao, setNotificacao] = useState<{
    texto: string;
    tipo: "sucesso" | "erro";
  } | null>(null);

  const notificar = useCallback(
    (texto: string, tipo: "sucesso" | "erro" = "sucesso") => {
      setNotificacao({ texto, tipo });
    },
    []
  );

  useEffect(() => {
    if (!notificacao) return;
    const t = setTimeout(() => setNotificacao(null), 4200);
    return () => clearTimeout(t);
  }, [notificacao]);

  // =========================================================================
  // FUNÇÃO DE CONFIRMAÇÃO DE ALTERAÇÃO
  // =========================================================================
  const [pedidoConfirmacao, setPedidoConfirmacao] =
    useState<ParametrosConfirmacaoAlteracao | null>(null);
  const [salvandoConfirmacao, setSalvandoConfirmacao] = useState(false);
  const resolverConfirmacaoRef = useRef<((ok: boolean) => void) | null>(null);

  const confirmarAlteracao = useCallback(
    (params: ParametrosConfirmacaoAlteracao): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        resolverConfirmacaoRef.current = resolve;
        setPedidoConfirmacao(params);
      });
    },
    []
  );

  const concluirConfirmacaoModal = async (observacaoExtra: string) => {
    if (!pedidoConfirmacao) return;
    setSalvandoConfirmacao(true);

    try {
      const resumoTexto = (pedidoConfirmacao.resumoDados || [])
        .map((r) => `${r.rotulo}: ${r.valor}`)
        .join(" | ");
      const detalhesCompletos = [
        resumoTexto,
        observacaoExtra ? `Obs.: ${observacaoExtra}` : "",
      ]
        .filter(Boolean)
        .join(" — ");

      try {
        await apiFetch("/api/confirmacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            etapaOrigem: "NewGenST",
            etapaDestino: pedidoConfirmacao.categoriaOperacao,
            acao: pedidoConfirmacao.tituloAcao,
            detalhes: detalhesCompletos || pedidoConfirmacao.descricao,
            bancoItemId: pedidoConfirmacao.bancoItemId ?? null,
            operador: operadorAtivo,
          }),
        });
      } catch {
        // Não bloqueia a gravação principal caso o log de auditoria falhe
      }

      const resolver = resolverConfirmacaoRef.current;
      resolverConfirmacaoRef.current = null;
      setPedidoConfirmacao(null);
      resolver?.(true);
    } finally {
      setSalvandoConfirmacao(false);
    }
  };

  const cancelarConfirmacaoModal = () => {
    const resolver = resolverConfirmacaoRef.current;
    resolverConfirmacaoRef.current = null;
    setPedidoConfirmacao(null);
    resolver?.(false);
  };

  // =========================================================================
  // CARREGAMENTO DO BANCO POSTGRESQL
  // =========================================================================
  const carregarBancos = useCallback(async (): Promise<BancoItemResumo[]> => {
    try {
      const resp = await apiFetch("/api/bancos");
      if (!resp.ok) throw new Error("Erro ao carregar estoque.");
      const json = await resp.json();
      const lista: BancoItemResumo[] = json.bancos || [];
      setBancos(lista);
      if (json.resumo) setResumo(json.resumo);
      return lista;
    } catch (e) {
      notificar(
        e instanceof Error ? e.message : "Erro ao carregar estoque.",
        "erro"
      );
      return [];
    } finally {
      setCarregandoInicial(false);
    }
  }, [notificar]);

  const carregarOperadores = useCallback(async () => {
    try {
      const resp = await apiFetch("/api/operadores");
      if (!resp.ok) return;
      const json = await resp.json();
      const lista: OperadorDetalhe[] = json.operadores || [];
      setOperadores(lista);
    } catch {
      // silencioso
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      limparTokenSessaoCliente();
      setUsuarioLogado(null);
      setAbaAtiva("inicio");
      setTelaConteudo("LISTA");
    }
  }, []);

  const abrirDetalhesProdutoDireto = useCallback(
    async (bancoId: number) => {
      const resp = await apiFetch(`/api/bancos/${bancoId}`);
      if (!resp.ok) {
        notificar("Não foi possível abrir os itens deste produto.", "erro");
        return;
      }
      const json = await resp.json();
      setBancoSelecionado(json.banco);
      setItensBancoAberto(json.itensIndividuais || []);
      setMovimentacoesBancoAberto(json.movimentacoes || []);
      setAbaAtiva("inicio");
      setTelaConteudo("DETALHE");
      await carregarBancos();
    },
    [carregarBancos, notificar]
  );

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const resp = await apiFetch("/api/auth/me");
        if (resp.ok) {
          const json = await resp.json();
          if (ativo && json.autenticado && json.usuario) {
            if (json.token) {
              salvarTokenSessaoCliente(json.token);
            }
            salvarUsuarioSessaoCliente(json.usuario);
            setUsuarioLogado(json.usuario);
            await Promise.all([carregarBancos(), carregarOperadores()]);
            return;
          }
        }

        // Restaura sessão salva localmente no navegador caso o cookie tenha sido limpo pelo iframe
        const usuarioCache = obterUsuarioSessaoCliente();
        if (ativo && usuarioCache) {
          setUsuarioLogado(usuarioCache);
          await Promise.all([carregarBancos(), carregarOperadores()]);
        }
      } finally {
        if (ativo) setVerificandoSessao(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [carregarBancos, carregarOperadores]);

  // =========================================================================
  // NAVEGAÇÃO DIRETA
  // =========================================================================
  const abrirNovoProduto = (codigoIndividualInicial?: string) => {
    setBancoEmEdicao(null);
    setFormNome("");
    setFormCodigoBarrasRef("");
    setFormFoto("");
    setFormUnidade("un");
    setFormEstoqueMinimo("0");
    setFormControlaLote(false);
    setCodigosIniciaisLista(
      codigoIndividualInicial ? [codigoIndividualInicial] : []
    );
    setCodigoInicialDigitando("");
    setQtdPorItemInicial("1");
    setFormLoteInicial("");
    setFormValidadeInicial("");
    setFormLocalizacaoInicial("");
    setAbaAtiva("inicio");
    setTelaConteudo("CADASTRO");
    window.scrollTo(0, 0);
  };

  const abrirEdicaoProduto = (b: BancoItemResumo) => {
    setBancoEmEdicao(b);
    setFormNome(b.nome);
    setFormCodigoBarrasRef(b.codigoBarras || "");
    setFormFoto(b.foto || "");
    setFormUnidade(b.unidade);
    setFormEstoqueMinimo(String(b.estoqueMinimo));
    setFormControlaLote(b.controlaLote);
    setCodigosIniciaisLista([]);
    setCodigoInicialDigitando("");
    setAbaAtiva("inicio");
    setTelaConteudo("CADASTRO");
    window.scrollTo(0, 0);
  };

  const onFotoSelecionada = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      if (typeof leitor.result === "string") {
        setFormFoto(leitor.result);
      }
    };
    leitor.readAsDataURL(arquivo);
  };

  // =========================================================================
  // SALVAR / EXCLUIR PRODUTO
  // =========================================================================
  const handleSalvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = formNome.trim();
    if (!nomeLimpo) {
      notificar("Informe o nome do produto ou dispositivo.", "erro");
      return;
    }

    const minNum = Math.max(0, Number(formEstoqueMinimo) || 0);

    if (bancoEmEdicao) {
      const ok = await confirmarAlteracao({
        categoriaOperacao: "EDIÇÃO DE PRODUTO",
        tituloAcao: `Salvar alterações em "${nomeLimpo}"`,
        descricao:
          "Atualiza os dados cadastrais mantendo todos os códigos individuais e históricos de retirada.",
        bancoItemId: bancoEmEdicao.id,
        textoBotaoConfirmar: "Salvar Alterações",
        variante: "roxo",
        resumoDados: [
          { rotulo: "Produto", valor: nomeLimpo },
          {
            rotulo: "Unidade / Estoque Mín.",
            valor: `${formUnidade} · Mínimo: ${minNum}`,
          },
          {
            rotulo: "Controla Lote",
            valor: formControlaLote ? "Sim" : "Não",
          },
        ],
      });

      if (!ok) return;

      const resp = await apiFetch(`/api/bancos/${bancoEmEdicao.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nomeLimpo,
          codigoBarras: formCodigoBarrasRef.trim(),
          foto: formFoto,
          unidade: formUnidade,
          estoqueMinimo: minNum,
          controlaLote: formControlaLote,
        }),
      });

      const json = await resp.json();
      if (!resp.ok) {
        notificar(json.error || "Erro ao salvar produto.", "erro");
        return;
      }

      const voltandoParaDetalhe = bancoSelecionado?.id === bancoEmEdicao.id;
      setBancoEmEdicao(null);
      await carregarBancos();

      if (voltandoParaDetalhe) {
        await abrirDetalhesProdutoDireto(json.banco.id);
      } else {
        setTelaConteudo("LISTA");
      }
      notificar("Produto atualizado com sucesso!");
      return;
    }

    const pendentes = extrairCodigosBarrasInseridos(codigoInicialDigitando);
    const mapaUnico = new Map<string, string>();
    for (const c of [...codigosIniciaisLista, ...pendentes]) {
      if (!mapaUnico.has(c.toUpperCase())) {
        mapaUnico.set(c.toUpperCase(), c);
      }
    }
    const todosCodigosIniciais = Array.from(mapaUnico.values());
    const qtdPorItem =
      Number(qtdPorItemInicial) > 0 ? Number(qtdPorItemInicial) : 1;
    const saldoInicialPrevisto = Number(
      (todosCodigosIniciais.length * qtdPorItem).toFixed(4)
    );

    const ok = await confirmarAlteracao({
      categoriaOperacao: "NOVO PRODUTO",
      tituloAcao: `Cadastrar "${nomeLimpo}"`,
      descricao:
        todosCodigosIniciais.length > 0
          ? "Cria o cadastro e registra os códigos de barras individuais informados."
          : "Cria o cadastro. Você poderá inserir os códigos individuais em + Entrada.",
      textoBotaoConfirmar: "Cadastrar Produto",
      variante: "roxo",
      resumoDados: [
        { rotulo: "Nome", valor: nomeLimpo },
        {
          rotulo: "Unidade / Mínimo",
          valor: `${formUnidade} · Mínimo: ${minNum}`,
        },
        {
          rotulo: "Itens Iniciais",
          valor:
            todosCodigosIniciais.length > 0
              ? `${todosCodigosIniciais.length} código(s) (${saldoInicialPrevisto} ${formUnidade})`
              : "0 (adicionar depois)",
        },
      ],
    });

    if (!ok) return;

    const resp = await apiFetch("/api/bancos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: nomeLimpo,
        codigoBarras: formCodigoBarrasRef.trim(),
        foto: formFoto,
        unidade: formUnidade,
        estoqueMinimo: minNum,
        controlaLote: formControlaLote,
        codigosIniciais: todosCodigosIniciais,
        quantidadePorItem: qtdPorItem,
        loteInicial: formLoteInicial.trim(),
        validadeInicial: formValidadeInicial,
        localizacaoInicial: formLocalizacaoInicial.trim(),
        operador: operadorAtivo,
      }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      notificar(json.error || "Erro ao cadastrar produto.", "erro");
      return;
    }

    await carregarBancos();
    setTelaConteudo("LISTA");
    notificar("Produto cadastrado com sucesso!");
  };

  const handleExcluirProduto = async () => {
    if (!bancoEmEdicao) return;

    const ok = await confirmarAlteracao({
      categoriaOperacao: "EXCLUSÃO DE PRODUTO",
      tituloAcao: `Excluir "${bancoEmEdicao.nome}"?`,
      descricao:
        "Remove permanentemente este produto e todos os seus códigos individuais registrados.",
      bancoItemId: bancoEmEdicao.id,
      textoBotaoConfirmar: "Excluir Produto",
      variante: "vermelho",
      resumoDados: [
        { rotulo: "Produto", valor: bancoEmEdicao.nome },
        {
          rotulo: "Saldo Atual",
          valor: `${bancoEmEdicao.quantidade} ${bancoEmEdicao.unidade}`,
        },
      ],
    });

    if (!ok) return;

    const resp = await apiFetch(`/api/bancos/${bancoEmEdicao.id}`, {
      method: "DELETE",
    });

    if (!resp.ok) {
      notificar("Erro ao excluir produto.", "erro");
      return;
    }

    if (bancoSelecionado?.id === bancoEmEdicao.id) {
      setBancoSelecionado(null);
    }
    setBancoEmEdicao(null);
    await carregarBancos();
    setTelaConteudo("LISTA");
    notificar("Produto excluído com sucesso.");
  };

  // =========================================================================
  // RETIRADA RÁPIDA E DEVOLUÇÃO RÁPIDA NOS CARDS / LEITOR
  // =========================================================================
  const abrirModalRetiradaCard = (
    banco: BancoItemResumo,
    itemPreSelecionado?: CodigoIndividualResumo
  ) => {
    const disponiveis = banco.codigosDisponiveisPreview || [];
    setRetiradaRapidaModal(banco);
    setIdsRetiradaRapida(
      itemPreSelecionado
        ? [itemPreSelecionado.id]
        : disponiveis.length === 1
          ? [disponiveis[0].id]
          : []
    );
    setDestinoRetiradaRapida("");
    setDataHoraRetiradaRapida(obterDataHoraLocalInput());
    setPrevisaoRetiradaRapida("");
    setObsRetiradaRapida("");
    setErroRetiradaRapida("");
  };

  const handleConfirmarRetiradaRapida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retiradaRapidaModal || salvandoAcaoRapida) return;
    setErroRetiradaRapida("");

    const disponiveis = retiradaRapidaModal.codigosDisponiveisPreview || [];
    const selecionados = disponiveis.filter((d) =>
      idsRetiradaRapida.includes(d.id)
    );

    if (selecionados.length === 0) {
      const msg =
        "Toque em ao menos um código individual disponível na lista acima.";
      setErroRetiradaRapida(msg);
      notificar(msg, "erro");
      return;
    }
    if (!destinoRetiradaRapida.trim()) {
      const msg = "Informe para onde o dispositivo vai.";
      setErroRetiradaRapida(msg);
      notificar(msg, "erro");
      return;
    }

    const dataObj = dataHoraRetiradaRapida
      ? new Date(dataHoraRetiradaRapida)
      : new Date();

    const ok = await confirmarAlteracao({
      categoriaOperacao: "RETIRADA DE DISPOSITIVO",
      tituloAcao: `Retirar ${selecionados.length} unidade(s) de "${retiradaRapidaModal.nome}"`,
      descricao:
        "Salva a data e hora exatas da retirada com você registrado automaticamente como responsável.",
      bancoItemId: retiradaRapidaModal.id,
      textoBotaoConfirmar: "Confirmar Retirada",
      variante: "roxo",
      resumoDados: [
        {
          rotulo: "Código(s)",
          valor: selecionados.map((s) => s.codigoIndividual).join(", "),
        },
        { rotulo: "Responsável (Logado)", valor: operadorAtivo },
        { rotulo: "Onde ficará", valor: destinoRetiradaRapida.trim() },
        {
          rotulo: "Data e Hora da Retirada",
          valor: formatarDataHoraBR(dataObj),
        },
      ],
    });

    if (!ok) return;

    setSalvandoAcaoRapida(true);
    try {
      const resp = await apiFetch("/api/retiradas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bancoItemId: retiradaRapidaModal.id,
          itensIds: selecionados.map((s) => s.id),
          responsavelRetirada: operadorAtivo,
          destinoUso: destinoRetiradaRapida.trim(),
          dataHoraRetirada: dataObj.toISOString(),
          previsaoDevolucao: previsaoRetiradaRapida
            ? new Date(previsaoRetiradaRapida).toISOString()
            : null,
          observacao: obsRetiradaRapida.trim(),
          operador: operadorAtivo,
        }),
      });

      const json = await resp.json();
      if (!resp.ok) {
        const msg = json.error || "Erro ao registrar retirada.";
        setErroRetiradaRapida(msg);
        notificar(msg, "erro");
        return;
      }

      const bId = retiradaRapidaModal.id;
      setRetiradaRapidaModal(null);
      setErroRetiradaRapida("");
      await carregarBancos();
      if (bancoSelecionado?.id === bId) {
        await abrirDetalhesProdutoDireto(bId);
      }
      notificar(`Retirada salva em ${formatarDataHoraBR(dataObj)}!`);
    } finally {
      setSalvandoAcaoRapida(false);
    }
  };

  const abrirModalDevolucaoCard = (
    banco: BancoItemResumo,
    itemPreSelecionado?: CodigoIndividualResumo
  ) => {
    const retirados = banco.codigosRetiradosPreview || [];
    setDevolucaoRapidaModal({ banco, itemInicial: itemPreSelecionado });
    setIdsDevolucaoRapida(
      itemPreSelecionado
        ? [itemPreSelecionado.id]
        : retirados.length === 1
          ? [retirados[0].id]
          : []
    );
    setDataHoraDevolucaoRapida(obterDataHoraLocalInput());
    setLocalDevolucaoRapida("");
    setCondicaoDevolucaoRapida("Perfeito estado");
    setObsDevolucaoRapida("");
  };

  const handleConfirmarDevolucaoRapida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devolucaoRapidaModal) return;

    const retirados = devolucaoRapidaModal.banco.codigosRetiradosPreview || [];
    const selecionados = retirados.filter((r) =>
      idsDevolucaoRapida.includes(r.id)
    );

    if (selecionados.length === 0) {
      notificar("Marque ao menos um dispositivo retirado para devolver.", "erro");
      return;
    }

    const dataDevObj = dataHoraDevolucaoRapida
      ? new Date(dataHoraDevolucaoRapida)
      : new Date();

    const ok = await confirmarAlteracao({
      categoriaOperacao: "DEVOLUÇÃO DE DISPOSITIVO",
      tituloAcao: `Devolver ${selecionados.length} unidade(s) de "${devolucaoRapidaModal.banco.nome}"`,
      descricao:
        "Registra a data e hora exatas da devolução e retorna o dispositivo para disponível na base.",
      bancoItemId: devolucaoRapidaModal.banco.id,
      textoBotaoConfirmar: "Confirmar Devolução",
      variante: "roxo",
      resumoDados: [
        {
          rotulo: "Código(s) Devolvido(s)",
          valor: selecionados.map((s) => s.codigoIndividual).join(", "),
        },
        {
          rotulo: "Data e Hora da Devolução",
          valor: formatarDataHoraBR(dataDevObj),
        },
        {
          rotulo: "Guardado em",
          valor: localDevolucaoRapida.trim() || "Disponível na base",
        },
      ],
    });

    if (!ok) return;

    const resp = await apiFetch("/api/retiradas/devolver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itensIds: selecionados.map((s) => s.id),
        dataHoraDevolucao: dataDevObj.toISOString(),
        localArmazenamentoDevolucao: localDevolucaoRapida.trim(),
        condicaoDevolucao: condicaoDevolucaoRapida.trim(),
        observacao: obsDevolucaoRapida.trim(),
        operador: operadorAtivo,
      }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      notificar(json.error || "Erro ao registrar devolução.", "erro");
      return;
    }

    const bId = devolucaoRapidaModal.banco.id;
    setDevolucaoRapidaModal(null);
    await carregarBancos();
    if (bancoSelecionado?.id === bId) {
      await abrirDetalhesProdutoDireto(bId);
    }
    notificar(`Devolução registrada em ${formatarDataHoraBR(dataDevObj)}!`);
  };

  // =========================================================================
  // MODAL RÁPIDO DE ENTRADA / BAIXA DEFINITIVA
  // =========================================================================
  const abrirModalMovimentoRapido = (
    banco: BancoItemResumo,
    tipo: "ENTRADA" | "BAIXA",
    codigoPreenchido?: string
  ) => {
    setMovRapidoModal({ banco, tipo });
    setCodigosMovEntradaLista(codigoPreenchido ? [codigoPreenchido] : []);
    setCodigoMovEntradaDigitando("");
    setQtdPorItemMovRapido("1");
    setLoteMovRapido("");
    setValidadeMovRapido("");
    setLocalMovRapido("");
    setObsMovRapido("");
    setIdsSelecionadosBaixaRapida([]);
    setCodigoBipBaixaRapida("");
  };

  const biparCodigoBaixaRapida = (texto: string) => {
    if (!movRapidoModal) return;
    const disponiveis = movRapidoModal.banco.codigosDisponiveisPreview || [];
    const lidos = extrairCodigosBarrasInseridos(texto);
    if (lidos.length === 0) return;

    const conjunto = new Set(idsSelecionadosBaixaRapida);
    const faltantes: string[] = [];

    for (const cod of lidos) {
      const achado = disponiveis.find(
        (d) => d.codigoIndividual.toUpperCase() === cod.toUpperCase()
      );
      if (achado) {
        conjunto.add(achado.id);
      } else {
        faltantes.push(cod);
      }
    }

    setIdsSelecionadosBaixaRapida(Array.from(conjunto));
    setCodigoBipBaixaRapida("");

    if (faltantes.length > 0) {
      notificar(
        `Código não encontrado disponível na base: ${faltantes.join(", ")}`,
        "erro"
      );
    }
  };

  const handleConfirmarMovimentoRapido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movRapidoModal) return;
    const { banco, tipo } = movRapidoModal;

    if (tipo === "ENTRADA") {
      const pendentes = extrairCodigosBarrasInseridos(
        codigoMovEntradaDigitando
      );
      const mapa = new Map<string, string>();
      for (const c of [...codigosMovEntradaLista, ...pendentes]) {
        if (!mapa.has(c.toUpperCase())) {
          mapa.set(c.toUpperCase(), c);
        }
      }
      const todosCodigos = Array.from(mapa.values());

      if (todosCodigos.length === 0) {
        notificar(
          "Insira ou bipe o código de barras individual do item.",
          "erro"
        );
        return;
      }

      const qtdPorItem =
        Number(qtdPorItemMovRapido) > 0 ? Number(qtdPorItemMovRapido) : 1;
      const qtdTotal = Number((todosCodigos.length * qtdPorItem).toFixed(4));
      const preview =
        todosCodigos.length <= 4
          ? todosCodigos.join(", ")
          : `${todosCodigos.slice(0, 4).join(", ")} (+${todosCodigos.length - 4})`;

      const ok = await confirmarAlteracao({
        categoriaOperacao: "ENTRADA DE ESTOQUE",
        tituloAcao: `Confirmar entrada em "${banco.nome}"`,
        descricao:
          "Os códigos de barras individuais informados serão adicionados ao estoque deste produto.",
        bancoItemId: banco.id,
        textoBotaoConfirmar: "+ Confirmar Entrada",
        variante: "roxo",
        resumoDados: [
          { rotulo: "Produto", valor: banco.nome },
          {
            rotulo: "Código(s) do(s) Item(ns)",
            valor: `${todosCodigos.length} código(s): ${preview}`,
          },
          { rotulo: "Quantidade Total", valor: `+${qtdTotal} ${banco.unidade}` },
        ],
      });

      if (!ok) return;

      const resp = await apiFetch(`/api/bancos/${banco.id}/movimentar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "ENTRADA",
          codigosIndividuais: todosCodigos,
          quantidadePorItem: qtdPorItem,
          lote: loteMovRapido.trim(),
          dataValidade: validadeMovRapido,
          localizacao: localMovRapido.trim(),
          observacao: obsMovRapido.trim(),
          operador: operadorAtivo,
        }),
      });

      const json = await resp.json();
      if (!resp.ok) {
        notificar(json.error || "Falha ao registrar entrada.", "erro");
        return;
      }

      setMovRapidoModal(null);
      await carregarBancos();
      if (bancoSelecionado?.id === banco.id) {
        await abrirDetalhesProdutoDireto(banco.id);
      }
      notificar(
        `Entrada registrada! ${todosCodigos.length} código(s) adicionado(s).`
      );
      return;
    }

    // BAIXA DEFINITIVA
    const disponiveis = banco.codigosDisponiveisPreview || [];
    const idsFinais = [...idsSelecionadosBaixaRapida];

    if (codigoBipBaixaRapida.trim()) {
      const digitados = extrairCodigosBarrasInseridos(codigoBipBaixaRapida);
      for (const cod of digitados) {
        const achado = disponiveis.find(
          (d) => d.codigoIndividual.toUpperCase() === cod.toUpperCase()
        );
        if (!achado) {
          notificar(
            `O código individual "${cod}" não está disponível na base.`,
            "erro"
          );
          return;
        }
        if (!idsFinais.includes(achado.id)) {
          idsFinais.push(achado.id);
        }
      }
    }

    const itensAlvo = disponiveis.filter((d) => idsFinais.includes(d.id));
    if (itensAlvo.length === 0) {
      notificar(
        "Bipe ou selecione ao menos um código individual para dar baixa.",
        "erro"
      );
      return;
    }

    const qtdTotalBaixa = Number(
      itensAlvo.reduce((acc, i) => acc + i.quantidade, 0).toFixed(4)
    );
    const codigosTexto = itensAlvo
      .slice(0, 4)
      .map((i) => i.codigoIndividual)
      .join(", ");

    const ok = await confirmarAlteracao({
      categoriaOperacao: "BAIXA DEFINITIVA",
      tituloAcao: `Confirmar baixa definitiva em "${banco.nome}"`,
      descricao:
        "Os códigos selecionados serão baixados permanentemente do estoque.",
      bancoItemId: banco.id,
      textoBotaoConfirmar: "− Confirmar Baixa",
      variante: "vermelho",
      resumoDados: [
        { rotulo: "Produto", valor: banco.nome },
        { rotulo: "Código(s) Baixado(s)", valor: codigosTexto },
        { rotulo: "Total da Baixa", valor: `−${qtdTotalBaixa} ${banco.unidade}` },
      ],
    });

    if (!ok) return;

    const resp = await apiFetch(`/api/bancos/${banco.id}/movimentar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "BAIXA",
        itensIds: idsFinais,
        observacao: obsMovRapido.trim(),
        operador: operadorAtivo,
      }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      notificar(json.error || "Erro ao registrar baixa.", "erro");
      return;
    }

    setMovRapidoModal(null);
    await carregarBancos();
    if (bancoSelecionado?.id === banco.id) {
      await abrirDetalhesProdutoDireto(banco.id);
    }
    notificar(`Baixa concluída para ${itensAlvo.length} código(s)!`);
  };

  const darBaixaDiretaPeloScanner = async (
    banco: BancoItemResumo,
    item: CodigoIndividualResumo
  ) => {
    const ok = await confirmarAlteracao({
      categoriaOperacao: "BAIXA VIA LEITOR",
      tituloAcao: `Dar baixa definitiva no código ${item.codigoIndividual}`,
      descricao: `Confirma a baixa permanente do item "${banco.nome}".`,
      bancoItemId: banco.id,
      textoBotaoConfirmar: "− Confirmar Baixa",
      variante: "vermelho",
      resumoDados: [
        { rotulo: "Produto", valor: banco.nome },
        { rotulo: "Código Individual", valor: item.codigoIndividual },
      ],
    });

    if (!ok) return;

    const resp = await apiFetch(`/api/bancos/${banco.id}/movimentar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "BAIXA",
        itensIds: [item.id],
        observacao: "Baixa rápida via leitor",
        operador: operadorAtivo,
      }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      notificar(json.error || "Erro ao realizar baixa.", "erro");
      return;
    }

    await carregarBancos();
    if (bancoSelecionado?.id === banco.id) {
      await abrirDetalhesProdutoDireto(banco.id);
    }
    notificar(`Código ${item.codigoIndividual} baixado com sucesso!`);
  };

  // Filtragem de produtos (inclui busca por quem está com o dispositivo ou onde está!)
  const bancosFiltrados = useMemo(() => {
    const t = buscaGeral.trim().toLowerCase();

    return bancos.filter((b) => {
      if (filtroAlertaRapido === "BAIXO" && b.statusEstoque === "OK") {
        return false;
      }
      if (filtroAlertaRapido === "VENCENDO" && b.vencendoCount === 0) {
        return false;
      }
      if (
        filtroAlertaRapido === "EM_USO" &&
        (b.itensRetiradosCount || 0) === 0
      ) {
        return false;
      }

      if (!t) return true;

      const bateuProduto =
        b.nome.toLowerCase().includes(t) ||
        b.codigoBanco.toLowerCase().includes(t) ||
        (b.codigoBarras || "").toLowerCase().includes(t);

      const bateuDisponivel = (b.codigosDisponiveisPreview || []).some((c) =>
        c.codigoIndividual.toLowerCase().includes(t)
      );

      const bateuRetirado = (b.codigosRetiradosPreview || []).some(
        (r) =>
          r.codigoIndividual.toLowerCase().includes(t) ||
          (r.portadorAtual || "").toLowerCase().includes(t) ||
          (r.destinoAtual || "").toLowerCase().includes(t)
      );

      return bateuProduto || bateuDisponivel || bateuRetirado;
    });
  }, [bancos, buscaGeral, filtroAlertaRapido]);

  const renderCardProduto = (b: BancoItemResumo) => {
    const status = STATUS_CONFIG[b.statusEstoque];
    const retiradosPreview = b.codigosRetiradosPreview || [];
    const qtdRetirados = b.itensRetiradosCount || 0;

    return (
      <article
        key={b.id}
        className="rounded-2xl bg-[#211738] border border-[#3a2961] p-4 space-y-3 hover:border-[#5b3fa3] transition-colors shadow-sm"
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => abrirDetalhesProdutoDireto(b.id)}
            className="h-12 w-12 rounded-xl border border-[#3a2961] bg-[#140e22] flex items-center justify-center overflow-hidden text-xl shrink-0 cursor-pointer"
            title="Abrir códigos individuais deste produto"
          >
            {b.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.foto}
                alt={b.nome}
                className="h-full w-full object-cover"
              />
            ) : (
              "📦"
            )}
          </button>

          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => abrirDetalhesProdutoDireto(b.id)}
              className="text-left group cursor-pointer max-w-full"
            >
              <h3 className="text-base font-bold text-[#f6f3ff] group-hover:text-[#d8b4fe] truncate">
                {b.nome}
              </h3>
            </button>

            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className="font-mono text-xs text-[#b5a4d9]">
                {b.itensDisponiveisCount} na base
              </span>
              {qtdRetirados > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#fbbf24]/20 text-[#fbbf24]">
                  ● {qtdRetirados} retirado(s) em uso
                </span>
              )}
              {b.vencendoCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#fb7185]/15 text-[#fb7185]">
                  📅 {b.vencendoCount} vencendo
                </span>
              )}
            </div>
          </div>

          <span className={`badge-status badge-${status.classe}`}>
            {status.texto}
          </span>
        </div>

        {/* Resumo imediato de ONDE estão os dispositivos retirados deste modelo! */}
        {retiradosPreview.length > 0 && (
          <div className="rounded-xl bg-[#18102b] border border-[#fbbf24]/35 px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#fbbf24] font-bold">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Onde estão os dispositivos retirados agora:
              </span>
              <button
                type="button"
                onClick={() => abrirModalDevolucaoCard(b)}
                className="text-[#d8b4fe] hover:underline cursor-pointer normal-case font-semibold text-[11px]"
              >
                ↩ Registrar devolução
              </button>
            </div>
            <div className="space-y-1">
              {retiradosPreview.slice(0, 2).map((ret) => (
                <div
                  key={ret.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <span className="text-[#f6f3ff]">
                    <strong className="font-mono text-[#e9d5ff]">
                      {ret.codigoIndividual}
                    </strong>{" "}
                    → {ret.destinoAtual} ({ret.portadorAtual})
                  </span>
                  {ret.retiradoEm && (
                    <span className="font-mono text-[11px] text-[#b5a4d9]">
                      há {calcularDuracaoUso(ret.retiradoEm)}
                    </span>
                  )}
                </div>
              ))}
              {retiradosPreview.length > 2 && (
                <span className="block text-[11px] text-[#b5a4d9]">
                  + {retiradosPreview.length - 2} outro(s) em uso externo
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#b5a4d9] pt-1 border-t border-[#3a2961]/75">
          <span>
            Disponível na base:{" "}
            <strong
              className={
                b.statusEstoque === "CRITICO"
                  ? "text-[#fb7185]"
                  : b.statusEstoque === "BAIXO"
                    ? "text-[#fbbf24]"
                    : "text-[#f6f3ff]"
              }
            >
              {b.quantidade} {b.unidade}
            </strong>
          </span>

          <button
            type="button"
            onClick={() => abrirEdicaoProduto(b)}
            className="text-xs font-semibold text-[#b5a4d9] hover:text-[#e9d5ff] cursor-pointer"
          >
            ✎ Editar cadastro
          </button>
        </div>

        {/* Botões diretos incluindo Retirar e Devolver */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => abrirDetalhesProdutoDireto(b.id)}
            className="rounded-xl bg-[#2f1e56] hover:bg-[#3e2870] border border-[#c084fc]/40 text-[#e9d5ff] font-bold py-2.5 px-2 text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <FolderOpen className="h-3.5 w-3.5 text-[#d8b4fe] shrink-0" />
            <span>Códigos</span>
          </button>

          <button
            type="button"
            onClick={() => abrirModalRetiradaCard(b)}
            className="rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold py-2.5 px-2 text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
            <span>Retirar</span>
          </button>

          {qtdRetirados > 0 ? (
            <button
              type="button"
              onClick={() => abrirModalDevolucaoCard(b)}
              className="rounded-xl bg-[#5b21b6] hover:bg-[#6d28d9] border border-[#d8b4fe]/45 text-white font-bold py-2.5 px-2 text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <ArrowDownLeft className="h-3.5 w-3.5 text-[#fbbf24] shrink-0" />
              <span>Devolver ({qtdRetirados})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => abrirModalMovimentoRapido(b, "ENTRADA")}
              className="rounded-xl bg-[#38285c] hover:bg-[#493478] text-white font-bold py-2.5 px-2 text-xs cursor-pointer transition-colors"
            >
              + Entrada
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              abrirModalMovimentoRapido(
                b,
                qtdRetirados > 0 ? "ENTRADA" : "BAIXA"
              )
            }
            className={`rounded-xl text-white font-bold py-2.5 px-2 text-xs cursor-pointer transition-colors ${
              qtdRetirados > 0
                ? "bg-[#38285c] hover:bg-[#493478]"
                : "bg-[#9f1239] hover:bg-[#be123c]"
            }`}
          >
            {qtdRetirados > 0 ? "+ Entrada" : "− Baixa"}
          </button>
        </div>
      </article>
    );
  };

  if (verificandoSessao) {
    return (
      <div className="min-h-screen bg-[#120d1d] text-[#f6f3ff] flex flex-col items-center justify-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] flex items-center justify-center text-2xl animate-pulse">
          📦
        </div>
        <p className="text-xs font-semibold text-[#b5a4d9]">
          Verificando sessão no NewGenST...
        </p>
      </div>
    );
  }

  if (!usuarioLogado) {
    return (
      <TelaLogin
        onAutenticado={async (usuario) => {
          salvarUsuarioSessaoCliente(usuario);
          setUsuarioLogado(usuario);
          setCarregandoInicial(true);
          await Promise.all([carregarBancos(), carregarOperadores()]);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-[#120d1d] text-[#f6f3ff]">
      {/* CABEÇALHO ROXO COM O NOME NewGenST */}
      <header className="sticky top-0 z-30 bg-[#191129]/95 backdrop-blur-md border-b border-[#3a2961] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setAbaAtiva("inicio");
              setTelaConteudo("LISTA");
            }}
            className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] shadow-md shadow-[#7c3aed]/25 flex items-center justify-center text-lg shrink-0 cursor-pointer"
            title="NewGenST — Início"
          >
            📦
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold tracking-wide bg-gradient-to-r from-[#ffffff] via-[#e9d5ff] to-[#c084fc] bg-clip-text text-transparent">
                NewGenST
              </h1>
              <span
                className="h-2 w-2 rounded-full bg-[#c084fc] shadow-[0_0_8px_#c084fc]"
                title="Online"
              />
            </div>
            <p className="text-[11px] text-[#b5a4d9] truncate">
              Logado:{" "}
              <strong className="text-[#f6f3ff]">{usuarioLogado.nome}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={() => setScannerAberto(true)}
            className="h-9 px-3 rounded-xl bg-[#2f1e56] hover:bg-[#3f2973] border border-[#c084fc]/35 text-[#e9d5ff] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Ler código de barras individual"
          >
            <ScanBarcode className="h-4 w-4 text-[#d8b4fe]" />
            <span className="hidden sm:inline">Ler Código</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="h-9 px-2.5 rounded-xl bg-[#2a1e47] hover:bg-[#9f1239] border border-[#3a2961] hover:border-[#fb7185]/40 text-[#b5a4d9] hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            title="Sair / Trocar de usuário"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* TOAST ROXO (sempre acima de todos os modais) */}
      {notificacao && (
        <div className="fixed top-16 right-4 left-4 sm:left-auto sm:w-96 z-[90]">
          <div
            className={`rounded-xl px-4 py-3 border shadow-xl flex items-center justify-between gap-3 text-xs font-semibold ${
              notificacao.tipo === "erro"
                ? "bg-[#381328] border-[#fb7185]/50 text-[#fecdd3]"
                : "bg-[#2b1852] border-[#c084fc]/60 text-[#f3e8ff]"
            }`}
          >
            <span>{notificacao.texto}</span>
            <button
              type="button"
              onClick={() => setNotificacao(null)}
              className="text-white/75 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* CONTEÚDO CENTRAL */}
      <main className="max-w-2xl mx-auto p-4">
        {abaAtiva === "inicio" || abaAtiva === "produtos" ? (
          <>
            {telaConteudo === "LISTA" && (
              <div className="space-y-4">
                {/* Busca por produto, código individual, quem retirou ou onde está */}
                <div className="campo-estoque flex items-center gap-2">
                  <Search className="h-4 w-4 text-[#c084fc] shrink-0" />
                  <input
                    type="search"
                    value={buscaGeral}
                    onChange={(e) => setBuscaGeral(e.target.value)}
                    placeholder="Buscar produto, código, responsável ou local onde está..."
                  />
                </div>

                {/* Cabeçalho da seção */}
                <div className="flex items-center justify-between gap-2.5">
                  <h2 className="text-base sm:text-lg font-bold text-[#f6f3ff]">
                    {abaAtiva === "inicio"
                      ? "Visão geral & dispositivos"
                      : "Todos os produtos"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => abrirNovoProduto()}
                    className="rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] shadow-md shadow-[#7c3aed]/25 text-white font-bold py-2.5 px-3.5 text-xs sm:text-sm whitespace-nowrap cursor-pointer transition-colors"
                  >
                    + Novo produto
                  </button>
                </div>

                {/* 4 Cards de Resumo (incluindo Em Uso / Retirados!) */}
                {abaAtiva === "inicio" && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setFiltroAlertaRapido("TODOS")}
                      className={`text-left rounded-2xl bg-[#211738] border p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                        filtroAlertaRapido === "TODOS"
                          ? "border-[#c084fc]"
                          : "border-[#3a2961] hover:border-[#533a8a]"
                      }`}
                    >
                      <span className="h-9 w-9 rounded-xl bg-[#311f59] flex items-center justify-center text-lg shrink-0">
                        💼
                      </span>
                      <div className="min-w-0">
                        <small className="block text-[10px] uppercase tracking-wider text-[#b5a4d9] truncate">
                          Na Base Agora
                        </small>
                        <strong className="text-lg font-bold text-[#f6f3ff]">
                          {resumo.totalCodigosAtivos}{" "}
                          <span className="text-[11px] font-normal text-[#d8b4fe]">
                            ({resumo.totalBancos} prod.)
                          </span>
                        </strong>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAbaAtiva("retiradas")}
                      className="text-left rounded-2xl bg-[#211738] border border-[#3a2961] hover:border-[#fbbf24] p-3.5 flex items-center gap-3 cursor-pointer transition-colors"
                    >
                      <span className="h-9 w-9 rounded-xl bg-[#311f59] flex items-center justify-center text-lg shrink-0">
                        📍
                      </span>
                      <div className="min-w-0">
                        <small className="block text-[10px] uppercase tracking-wider text-[#b5a4d9] truncate">
                          Retirados / Em Uso
                        </small>
                        <strong className="text-lg font-bold text-[#fbbf24]">
                          {resumo.totalRetiradosAgora}{" "}
                          <span className="text-[11px] font-normal text-[#d8b4fe]">
                            ver locais →
                          </span>
                        </strong>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setFiltroAlertaRapido((f) =>
                          f === "BAIXO" ? "TODOS" : "BAIXO"
                        )
                      }
                      className={`text-left rounded-2xl bg-[#211738] border p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                        filtroAlertaRapido === "BAIXO"
                          ? "border-[#fbbf24]"
                          : "border-[#3a2961] hover:border-[#533a8a]"
                      }`}
                    >
                      <span className="h-9 w-9 rounded-xl bg-[#311f59] flex items-center justify-center text-lg text-[#fbbf24] shrink-0">
                        ⚠
                      </span>
                      <div>
                        <small className="block text-[10px] uppercase tracking-wider text-[#b5a4d9]">
                          Estoque baixo
                        </small>
                        <strong className="text-lg font-bold text-[#fbbf24]">
                          {resumo.estoqueBaixoOuCritico}
                        </strong>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setFiltroAlertaRapido((f) =>
                          f === "VENCENDO" ? "TODOS" : "VENCENDO"
                        )
                      }
                      className={`text-left rounded-2xl bg-[#211738] border p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                        filtroAlertaRapido === "VENCENDO"
                          ? "border-[#fb7185]"
                          : "border-[#3a2961] hover:border-[#533a8a]"
                      }`}
                    >
                      <span className="h-9 w-9 rounded-xl bg-[#311f59] flex items-center justify-center text-lg text-[#fb7185] shrink-0">
                        📅
                      </span>
                      <div>
                        <small className="block text-[10px] uppercase tracking-wider text-[#b5a4d9]">
                          Vencendo lote
                        </small>
                        <strong className="text-lg font-bold text-[#fb7185]">
                          {resumo.vencendoLote}
                        </strong>
                      </div>
                    </button>
                  </div>
                )}

                {filtroAlertaRapido !== "TODOS" && (
                  <div className="flex items-center justify-between text-xs bg-[#211738] border border-[#3a2961] rounded-xl px-3.5 py-2">
                    <span className="text-[#b5a4d9]">
                      Filtro ativo:{" "}
                      <strong className="text-white">
                        {filtroAlertaRapido === "BAIXO"
                          ? "Apenas estoque baixo/crítico"
                          : filtroAlertaRapido === "EM_USO"
                            ? "Com dispositivos retirados em uso"
                            : "Apenas itens com lote vencendo"}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiltroAlertaRapido("TODOS")}
                      className="text-[#d8b4fe] font-bold hover:underline cursor-pointer"
                    >
                      Mostrar todos
                    </button>
                  </div>
                )}

                {/* Lista de Produtos */}
                {carregandoInicial ? (
                  <p className="text-center text-sm text-[#b5a4d9] py-10">
                    Carregando produtos no NewGenST...
                  </p>
                ) : bancosFiltrados.length === 0 ? (
                  <div className="rounded-2xl bg-[#211738] border border-[#3a2961] p-8 text-center space-y-2">
                    <p className="text-sm text-[#b5a4d9]">
                      Nenhum produto encontrado.
                    </p>
                    {buscaGeral.trim() && (
                      <button
                        type="button"
                        onClick={() => abrirNovoProduto(buscaGeral.trim())}
                        className="text-xs font-bold text-[#d8b4fe] hover:underline cursor-pointer"
                      >
                        + Cadastrar novo produto usando &ldquo;
                        {buscaGeral.trim()}&rdquo;
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bancosFiltrados.map(renderCardProduto)}
                  </div>
                )}
              </div>
            )}

            {/* TELA 2: CADASTRO / EDIÇÃO DE PRODUTO */}
            {telaConteudo === "CADASTRO" && (
              <form
                onSubmit={handleSalvarProduto}
                className="space-y-4 rounded-2xl bg-[#211738] border border-[#3a2961] p-5 shadow-lg"
              >
                <h2 className="text-lg font-bold text-[#f6f3ff]">
                  {bancoEmEdicao ? "Editar produto" : "Novo produto / dispositivo"}
                </h2>

                <div>
                  <label
                    htmlFor="inputNome"
                    className="block text-xs uppercase tracking-wider text-[#b5a4d9] mb-1.5"
                  >
                    Nome do produto ou dispositivo *
                  </label>
                  <div className="campo-estoque">
                    <input
                      id="inputNome"
                      type="text"
                      required
                      value={formNome}
                      onChange={(e) => setFormNome(e.target.value)}
                      placeholder="Ex.: Coletor Zebra TC21 ou Arroz Tipo 1"
                    />
                  </div>
                </div>

                {/* Foto */}
                <div>
                  <span className="block text-xs uppercase tracking-wider text-[#b5a4d9] mb-1.5">
                    Foto (opcional)
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => inputFotoCameraRef.current?.click()}
                      className="rounded-xl bg-[#2a1e47] hover:bg-[#38285c] border border-dashed border-[#5c4294] p-3.5 text-center font-bold text-xs text-[#f6f3ff] cursor-pointer flex flex-col items-center gap-1 transition-colors"
                    >
                      <Camera className="h-5 w-5 text-[#c084fc]" />
                      <span>Tirar foto</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => inputFotoArquivoRef.current?.click()}
                      className="rounded-xl bg-[#2a1e47] hover:bg-[#38285c] border border-dashed border-[#5c4294] p-3.5 text-center font-bold text-xs text-[#f6f3ff] cursor-pointer flex flex-col items-center gap-1 transition-colors"
                    >
                      <Upload className="h-5 w-5 text-[#c084fc]" />
                      <span>Enviar do dispositivo</span>
                    </button>
                  </div>

                  <input
                    ref={inputFotoCameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={onFotoSelecionada}
                    className="hidden"
                  />
                  <input
                    ref={inputFotoArquivoRef}
                    type="file"
                    accept="image/*"
                    onChange={onFotoSelecionada}
                    className="hidden"
                  />

                  {formFoto && (
                    <div className="flex items-center gap-3 mt-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={formFoto}
                        alt="Foto do produto"
                        className="h-16 w-16 rounded-xl object-cover border border-[#3a2961]"
                      />
                      <button
                        type="button"
                        onClick={() => setFormFoto("")}
                        className="text-xs font-bold text-[#fb7185] hover:underline cursor-pointer"
                      >
                        Remover foto
                      </button>
                    </div>
                  )}
                </div>

                {/* Unidade e Estoque Mínimo */}
                <div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="selectUnidade"
                        className="block text-xs uppercase tracking-wider text-[#b5a4d9] mb-1.5"
                      >
                        Unidade
                      </label>
                      <div className="campo-estoque">
                        <select
                          id="selectUnidade"
                          value={formUnidade}
                          onChange={(e) => setFormUnidade(e.target.value)}
                        >
                          {UNIDADES_DISPONIVEIS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="inputEstoqueMinimo"
                        className="block text-xs uppercase tracking-wider text-[#b5a4d9] mb-1.5"
                      >
                        Estoque mínimo na base
                      </label>
                      <div className="campo-estoque">
                        <input
                          id="inputEstoqueMinimo"
                          type="number"
                          min="0"
                          step="any"
                          value={formEstoqueMinimo}
                          onChange={(e) => setFormEstoqueMinimo(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toggle Controlar por Lote */}
                <div className="rounded-xl bg-[#140e22] border border-[#3a2961] p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <strong className="block text-sm text-[#f6f3ff]">
                      Controlar por lote de fabricação
                    </strong>
                    <span className="text-xs text-[#b5a4d9]">
                      Ative se precisar rastrear lotes e validade.
                    </span>
                  </div>

                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={formControlaLote}
                      onChange={(e) => setFormControlaLote(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                {/* Código de referência geral opcional */}
                <div>
                  <label
                    htmlFor="inputCodigoRef"
                    className="block text-xs uppercase tracking-wider text-[#b5a4d9] mb-1.5"
                  >
                    Código de referência geral (opcional)
                  </label>
                  <div className="campo-estoque">
                    <input
                      id="inputCodigoRef"
                      type="text"
                      value={formCodigoBarrasRef}
                      onChange={(e) => setFormCodigoBarrasRef(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                {/* Códigos individuais iniciais */}
                {!bancoEmEdicao && (
                  <div className="rounded-xl bg-[#140e22] border border-[#3a2961] p-4 space-y-3.5">
                    <CampoEntradaCodigosBarras
                      codigos={codigosIniciaisLista}
                      onChangeCodigos={setCodigosIniciaisLista}
                      valorDigitando={codigoInicialDigitando}
                      onChangeValorDigitando={setCodigoInicialDigitando}
                      rotulo="Códigos individuais iniciais dos itens/dispositivos (opcional)"
                      placeholder="Bipe ou digite o código do item"
                      ajuda="Insira o código de barras ou número de patrimônio que já vem em cada dispositivo."
                    />

                    {(codigosIniciaisLista.length > 0 ||
                      codigoInicialDigitando.trim() !== "") && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                            Qtd. por código ({formUnidade})
                          </label>
                          <div className="campo-estoque">
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={qtdPorItemInicial}
                              onChange={(e) =>
                                setQtdPorItemInicial(e.target.value)
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                            Localização inicial na base
                          </label>
                          <div className="campo-estoque">
                            <input
                              type="text"
                              value={formLocalizacaoInicial}
                              onChange={(e) =>
                                setFormLocalizacaoInicial(e.target.value)
                              }
                              placeholder="Ex.: Armário Técnico · Baia 01"
                            />
                          </div>
                        </div>

                        {formControlaLote && (
                          <>
                            <div>
                              <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                                Lote inicial
                              </label>
                              <div className="campo-estoque">
                                <input
                                  type="text"
                                  value={formLoteInicial}
                                  onChange={(e) =>
                                    setFormLoteInicial(e.target.value)
                                  }
                                  placeholder="Ex.: LT-2026-01"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                                Validade
                              </label>
                              <div className="campo-estoque">
                                <input
                                  type="date"
                                  value={formValidadeInicial}
                                  onChange={(e) =>
                                    setFormValidadeInicial(e.target.value)
                                  }
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        bancoEmEdicao &&
                        bancoSelecionado?.id === bancoEmEdicao.id
                      ) {
                        setTelaConteudo("DETALHE");
                      } else {
                        setTelaConteudo("LISTA");
                      }
                      setBancoEmEdicao(null);
                    }}
                    className="rounded-xl bg-[#38285c] hover:bg-[#493478] text-white py-3.5 text-sm font-semibold cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white py-3.5 text-sm font-bold cursor-pointer transition-colors"
                  >
                    {bancoEmEdicao ? "Salvar alterações" : "Cadastrar produto"}
                  </button>
                </div>

                {bancoEmEdicao && (
                  <button
                    type="button"
                    onClick={handleExcluirProduto}
                    className="w-full py-2 text-sm font-bold text-[#fb7185] hover:underline cursor-pointer"
                  >
                    Excluir produto
                  </button>
                )}
              </form>
            )}

            {/* TELA 3: LISTAGEM ORGANIZADA PELOS CÓDIGOS INDIVIDUAIS */}
            {telaConteudo === "DETALHE" && bancoSelecionado && (
              <ListagemCodigosIndividuais
                banco={bancoSelecionado}
                itens={itensBancoAberto}
                movimentacoes={movimentacoesBancoAberto}
                operadorAtivo={operadorAtivo}
                confirmarAlteracao={confirmarAlteracao}
                onRecarregarBanco={async () => {
                  await abrirDetalhesProdutoDireto(bancoSelecionado.id);
                }}
                onAbrirEdicaoBanco={abrirEdicaoProduto}
                onVoltar={() => setTelaConteudo("LISTA")}
                onNotificar={notificar}
              />
            )}
          </>
        ) : abaAtiva === "retiradas" ? (
          <AbaRetiradas
            bancos={bancos}
            operadorAtivo={operadorAtivo}
            confirmarAlteracao={confirmarAlteracao}
            onAtualizarEstoqueGeral={async () => {
              await carregarBancos();
            }}
            onAbrirBancoDireto={abrirDetalhesProdutoDireto}
            onNotificar={notificar}
          />
        ) : abaAtiva === "relatorios" ? (
          <AbaRelatorios onAbrirBancoDireto={abrirDetalhesProdutoDireto} />
        ) : (
          <AbaUsuarios
            operadores={operadores}
            usuarioLogado={usuarioLogado}
            confirmarAlteracao={confirmarAlteracao}
            onLogout={handleLogout}
            onRecarregarOperadores={carregarOperadores}
            onNotificar={notificar}
          />
        )}
      </main>

      {/* MODAL RÁPIDO DE RETIRADA DE DISPOSITIVO */}
      {retiradaRapidaModal && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-[#090510]/80 backdrop-blur-xs p-0 sm:p-4">
          <form
            onSubmit={handleConfirmarRetiradaRapida}
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-[#211738] border border-[#3a2961] p-5 space-y-3.5 max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div>
              <h3 className="text-base font-bold text-[#f6f3ff]">
                Registrar Retirada — {retiradaRapidaModal.nome}
              </h3>
              <p className="text-xs text-[#b5a4d9]">
                Você ({usuarioLogado.nome}) será registrado automaticamente como
                responsável por esta retirada.
              </p>
            </div>

            {erroRetiradaRapida && (
              <div className="rounded-xl bg-[#381328] border border-[#fb7185]/50 px-3.5 py-2.5 text-xs font-semibold text-[#fecdd3]">
                {erroRetiradaRapida}
              </div>
            )}

            <div className="space-y-1.5">
              <span className="block text-xs text-[#b5a4d9]">
                Selecione o(s) código(s) disponível(is) (
                <strong className="text-[#d8b4fe]">
                  {idsRetiradaRapida.length} marcado(s)
                </strong>
                ):
              </span>
              <div className="rounded-xl bg-[#140e22] border border-[#3a2961] max-h-36 overflow-y-auto divide-y divide-[#3a2961]">
                {(retiradaRapidaModal.codigosDisponiveisPreview || [])
                  .length === 0 ? (
                  <p className="p-3 text-xs text-center text-[#b5a4d9]">
                    Nenhuma unidade disponível na base no momento.
                  </p>
                ) : (
                  (retiradaRapidaModal.codigosDisponiveisPreview || []).map(
                    (disp) => {
                      const sel = idsRetiradaRapida.includes(disp.id);
                      return (
                        <button
                          key={disp.id}
                          type="button"
                          onClick={() =>
                            setIdsRetiradaRapida((prev) =>
                              prev.includes(disp.id)
                                ? prev.filter((x) => x !== disp.id)
                                : [...prev, disp.id]
                            )
                          }
                          className={`w-full px-3.5 py-2 flex items-center justify-between text-left text-xs cursor-pointer ${
                            sel ? "bg-[#2e1c57]" : "hover:bg-[#23183b]"
                          }`}
                        >
                          <span className="flex items-center gap-2 font-mono font-bold text-[#f6f3ff]">
                            {sel ? (
                              <CheckSquare className="h-4 w-4 text-[#d8b4fe]" />
                            ) : (
                              <Square className="h-4 w-4 text-[#b5a4d9]" />
                            )}
                            {disp.codigoIndividual}
                          </span>
                          <span className="text-[#b5a4d9]">
                            {disp.localizacao || "Na base"}
                          </span>
                        </button>
                      );
                    }
                  )
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Responsável (usuário logado)
                </span>
                <div className="rounded-xl bg-[#2a1b4a] border border-[#c084fc]/60 px-3.5 py-2.5 flex items-center gap-2 text-sm font-bold text-[#f6f3ff]">
                  <User className="h-4 w-4 text-[#d8b4fe] shrink-0" />
                  <span className="truncate">{usuarioLogado.nome}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Onde o dispositivo ficará *
                </label>
                <div className="campo-estoque">
                  <input
                    type="text"
                    required
                    value={destinoRetiradaRapida}
                    onChange={(e) => setDestinoRetiradaRapida(e.target.value)}
                    placeholder="Ex.: Expedição · Doca 02"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] uppercase tracking-wider text-[#b5a4d9]">
                    Data e Hora da Retirada *
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDataHoraRetiradaRapida(obterDataHoraLocalInput())
                    }
                    className="text-[10px] font-bold text-[#d8b4fe] hover:underline cursor-pointer"
                  >
                    Agora
                  </button>
                </div>
                <div className="campo-estoque">
                  <input
                    type="datetime-local"
                    required
                    value={dataHoraRetiradaRapida}
                    onChange={(e) => setDataHoraRetiradaRapida(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Previsão de Devolução
                </label>
                <div className="campo-estoque">
                  <input
                    type="datetime-local"
                    value={previsaoRetiradaRapida}
                    onChange={(e) => setPrevisaoRetiradaRapida(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                Observação (opcional)
              </label>
              <div className="campo-estoque">
                <input
                  type="text"
                  value={obsRetiradaRapida}
                  onChange={(e) => setObsRetiradaRapida(e.target.value)}
                  placeholder="Ex.: Uso no turno noturno"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRetiradaRapidaModal(null)}
                className="rounded-xl bg-[#38285c] hover:bg-[#493478] text-white py-3 text-sm font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white py-3 text-sm font-bold cursor-pointer"
              >
                Confirmar Retirada
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL RÁPIDO DE DEVOLUÇÃO DE DISPOSITIVO */}
      {devolucaoRapidaModal && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-[#090510]/80 backdrop-blur-xs p-0 sm:p-4">
          <form
            onSubmit={handleConfirmarDevolucaoRapida}
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-[#211738] border border-[#3a2961] p-5 space-y-3.5 max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div>
              <h3 className="text-base font-bold text-[#f6f3ff]">
                Registrar Devolução — {devolucaoRapidaModal.banco.nome}
              </h3>
              <p className="text-xs text-[#b5a4d9]">
                Guarda a data e hora exatas em que o dispositivo foi devolvido.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs text-[#b5a4d9]">
                Dispositivos atualmente retirados (
                <strong className="text-[#d8b4fe]">
                  {idsDevolucaoRapida.length} marcado(s)
                </strong>
                ):
              </span>
              <div className="rounded-xl bg-[#140e22] border border-[#3a2961] max-h-40 overflow-y-auto divide-y divide-[#3a2961]">
                {(devolucaoRapidaModal.banco.codigosRetiradosPreview || []).map(
                  (ret) => {
                    const sel = idsDevolucaoRapida.includes(ret.id);
                    return (
                      <button
                        key={ret.id}
                        type="button"
                        onClick={() =>
                          setIdsDevolucaoRapida((prev) =>
                            prev.includes(ret.id)
                              ? prev.filter((x) => x !== ret.id)
                              : [...prev, ret.id]
                          )
                        }
                        className={`w-full px-3.5 py-2.5 flex flex-col gap-0.5 text-left text-xs cursor-pointer ${
                          sel ? "bg-[#2e1c57]" : "hover:bg-[#23183b]"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="flex items-center gap-2 font-mono font-bold text-[#f6f3ff]">
                            {sel ? (
                              <CheckSquare className="h-4 w-4 text-[#d8b4fe]" />
                            ) : (
                              <Square className="h-4 w-4 text-[#b5a4d9]" />
                            )}
                            {ret.codigoIndividual}
                          </span>
                          <span className="text-[11px] font-mono text-[#fbbf24]">
                            Saída: {formatarDataHoraBR(ret.retiradoEm)}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#b5a4d9] pl-6">
                          Com {ret.portadorAtual} em {ret.destinoAtual}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] uppercase tracking-wider text-[#b5a4d9]">
                  Data e Hora da Devolução *
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setDataHoraDevolucaoRapida(obterDataHoraLocalInput())
                  }
                  className="text-[10px] font-bold text-[#d8b4fe] hover:underline cursor-pointer"
                >
                  Usar Agora
                </button>
              </div>
              <div className="campo-estoque">
                <input
                  type="datetime-local"
                  required
                  value={dataHoraDevolucaoRapida}
                  onChange={(e) => setDataHoraDevolucaoRapida(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Local guardado na base
                </label>
                <div className="campo-estoque">
                  <input
                    type="text"
                    value={localDevolucaoRapida}
                    onChange={(e) => setLocalDevolucaoRapida(e.target.value)}
                    placeholder="Ex.: Armário · Baia 01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Condição na devolução
                </label>
                <div className="campo-estoque">
                  <select
                    value={condicaoDevolucaoRapida}
                    onChange={(e) => setCondicaoDevolucaoRapida(e.target.value)}
                  >
                    <option value="Perfeito estado">Perfeito estado</option>
                    <option value="Carregando bateria">
                      Carregando bateria
                    </option>
                    <option value="Necessita revisão/limpeza">
                      Necessita revisão/limpeza
                    </option>
                    <option value="Com avaria">Com avaria</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                Observação (opcional)
              </label>
              <div className="campo-estoque">
                <input
                  type="text"
                  value={obsDevolucaoRapida}
                  onChange={(e) => setObsDevolucaoRapida(e.target.value)}
                  placeholder="Ex.: Entregue higienizado"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDevolucaoRapidaModal(null)}
                className="rounded-xl bg-[#38285c] hover:bg-[#493478] text-white py-3 text-sm font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white py-3 text-sm font-bold cursor-pointer"
              >
                Confirmar Devolução
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL RÁPIDO DE ENTRADA / BAIXA DEFINITIVA */}
      {movRapidoModal && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-[#090510]/80 backdrop-blur-xs p-0 sm:p-4">
          <form
            onSubmit={handleConfirmarMovimentoRapido}
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-[#211738] border border-[#3a2961] p-5 space-y-3.5 max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div>
              <h3 className="text-base font-bold text-[#f6f3ff]">
                {movRapidoModal.tipo === "ENTRADA"
                  ? "Registrar entrada"
                  : "Registrar baixa definitiva"}
              </h3>
              <p className="text-xs text-[#b5a4d9]">
                {movRapidoModal.banco.nome} — saldo na base:{" "}
                {movRapidoModal.banco.quantidade} {movRapidoModal.banco.unidade}
              </p>
            </div>

            {movRapidoModal.tipo === "ENTRADA" ? (
              <>
                <CampoEntradaCodigosBarras
                  autoFocus
                  codigos={codigosMovEntradaLista}
                  onChangeCodigos={setCodigosMovEntradaLista}
                  valorDigitando={codigoMovEntradaDigitando}
                  onChangeValorDigitando={setCodigoMovEntradaDigitando}
                  rotulo="Código(s) de barras individual(is) do item *"
                  placeholder="Bipe ou digite o código individual do item"
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                      Qtd. por código ({movRapidoModal.banco.unidade})
                    </label>
                    <div className="campo-estoque">
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        required
                        value={qtdPorItemMovRapido}
                        onChange={(e) => setQtdPorItemMovRapido(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                      Localização na base
                    </label>
                    <div className="campo-estoque">
                      <input
                        type="text"
                        value={localMovRapido}
                        onChange={(e) => setLocalMovRapido(e.target.value)}
                        placeholder="Ex.: Prat. 01"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                    Bipar ou digitar código individual
                  </label>
                  <div className="flex gap-2">
                    <div className="campo-estoque flex-1 flex items-center gap-2">
                      <ScanBarcode className="h-4 w-4 text-[#fb7185] shrink-0" />
                      <input
                        type="text"
                        autoFocus
                        value={codigoBipBaixaRapida}
                        onChange={(e) => setCodigoBipBaixaRapida(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            codigoBipBaixaRapida.trim()
                          ) {
                            e.preventDefault();
                            biparCodigoBaixaRapida(codigoBipBaixaRapida);
                          }
                        }}
                        placeholder="Bipe o código e tecle Enter"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        biparCodigoBaixaRapida(codigoBipBaixaRapida)
                      }
                      disabled={!codigoBipBaixaRapida.trim()}
                      className="px-3.5 rounded-xl bg-[#38285c] hover:bg-[#493478] disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
                    >
                      Marcar
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-[#140e22] border border-[#3a2961] max-h-44 overflow-y-auto divide-y divide-[#3a2961]">
                  {(movRapidoModal.banco.codigosDisponiveisPreview || []).map(
                    (disp) => {
                      const sel = idsSelecionadosBaixaRapida.includes(disp.id);
                      return (
                        <button
                          key={disp.id}
                          type="button"
                          onClick={() =>
                            setIdsSelecionadosBaixaRapida((prev) =>
                              prev.includes(disp.id)
                                ? prev.filter((x) => x !== disp.id)
                                : [...prev, disp.id]
                            )
                          }
                          className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left text-xs cursor-pointer ${
                            sel ? "bg-[#3b1934]" : "hover:bg-[#23183b]"
                          }`}
                        >
                          <span className="flex items-center gap-2 font-mono font-bold text-[#f6f3ff]">
                            {sel ? (
                              <CheckSquare className="h-4 w-4 text-[#fb7185]" />
                            ) : (
                              <Square className="h-4 w-4 text-[#b5a4d9]" />
                            )}
                            {disp.codigoIndividual}
                          </span>
                          <span className="text-[#b5a4d9]">
                            {disp.quantidade} {movRapidoModal.banco.unidade}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                Observação (opcional)
              </label>
              <div className="campo-estoque">
                <input
                  type="text"
                  value={obsMovRapido}
                  onChange={(e) => setObsMovRapido(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMovRapidoModal(null)}
                className="rounded-xl bg-[#38285c] hover:bg-[#493478] text-white py-3 text-sm font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`rounded-xl text-white py-3 text-sm font-bold cursor-pointer ${
                  movRapidoModal.tipo === "ENTRADA"
                    ? "bg-[#7c3aed] hover:bg-[#8b5cf6]"
                    : "bg-[#9f1239] hover:bg-[#be123c]"
                }`}
              >
                {movRapidoModal.tipo === "ENTRADA"
                  ? "+ Confirmar entrada"
                  : "− Confirmar baixa"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LEITOR RÁPIDO DO CABEÇALHO */}
      <ModalScannerCodigo
        aberto={scannerAberto}
        bancos={bancos}
        onFechar={() => setScannerAberto(false)}
        onAbrirBanco={(b) => abrirDetalhesProdutoDireto(b.id)}
        onRetirarDiretoCodigo={(b, item) => abrirModalRetiradaCard(b, item)}
        onDevolverDiretoCodigo={(b, item) => abrirModalDevolucaoCard(b, item)}
        onDarBaixaDiretaCodigo={darBaixaDiretaPeloScanner}
        onAbrirEntradaComCodigo={(b, cod) =>
          abrirModalMovimentoRapido(b, "ENTRADA", cod)
        }
        onCriarNovoProdutoComCodigo={(cod) => abrirNovoProduto(cod)}
      />

      {/* MODAL DE CONFIRMAÇÃO DE ALTERAÇÃO */}
      <ModalConfirmacaoEtapa
        dados={pedidoConfirmacao}
        operadorAtivo={operadorAtivo}
        salvando={salvandoConfirmacao}
        onConfirmar={concluirConfirmacaoModal}
        onCancelar={cancelarConfirmacaoModal}
      />

      {/* NAVEGAÇÃO INFERIOR ROXA (5 ABAS INCLUINDO RETIRADAS / ONDE ESTÃO) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 bg-[#191129]/95 backdrop-blur-md border-t border-[#3a2961]">
        <button
          type="button"
          onClick={() => {
            setAbaAtiva("inicio");
            setTelaConteudo("LISTA");
          }}
          className={`py-2.5 flex flex-col items-center gap-1 text-[11px] cursor-pointer transition-colors ${
            abaAtiva === "inicio"
              ? "text-[#d8b4fe] font-bold"
              : "text-[#b5a4d9] hover:text-white"
          }`}
        >
          <span className="text-lg leading-none">⌂</span>
          <span>Início</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva("retiradas")}
          className={`py-2.5 flex flex-col items-center gap-1 text-[11px] cursor-pointer transition-colors relative ${
            abaAtiva === "retiradas"
              ? "text-[#d8b4fe] font-bold"
              : "text-[#b5a4d9] hover:text-white"
          }`}
        >
          <span className="text-lg leading-none">⇄</span>
          <span>Retiradas</span>
          {resumo.totalRetiradosAgora > 0 && (
            <span className="absolute top-1.5 right-3 sm:right-6 min-w-4 h-4 px-1 rounded-full bg-[#fbbf24] text-[#120d1d] text-[10px] font-extrabold flex items-center justify-center">
              {resumo.totalRetiradosAgora}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setAbaAtiva("produtos");
            setTelaConteudo("LISTA");
          }}
          className={`py-2.5 flex flex-col items-center gap-1 text-[11px] cursor-pointer transition-colors ${
            abaAtiva === "produtos"
              ? "text-[#d8b4fe] font-bold"
              : "text-[#b5a4d9] hover:text-white"
          }`}
        >
          <span className="text-lg leading-none">▣</span>
          <span>Produtos</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva("relatorios")}
          className={`py-2.5 flex flex-col items-center gap-1 text-[11px] cursor-pointer transition-colors ${
            abaAtiva === "relatorios"
              ? "text-[#d8b4fe] font-bold"
              : "text-[#b5a4d9] hover:text-white"
          }`}
        >
          <span className="text-lg leading-none">📊</span>
          <span>Relatórios</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva("usuarios")}
          className={`py-2.5 flex flex-col items-center gap-1 text-[11px] cursor-pointer transition-colors ${
            abaAtiva === "usuarios"
              ? "text-[#d8b4fe] font-bold"
              : "text-[#b5a4d9] hover:text-white"
          }`}
        >
          <span className="text-lg leading-none">👥</span>
          <span>Usuários</span>
        </button>
      </nav>
    </div>
  );
}
