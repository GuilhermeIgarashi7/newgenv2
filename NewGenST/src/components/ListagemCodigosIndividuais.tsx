"use client";

import React, { useMemo, useState } from "react";
import {
  extrairCodigosBarrasInseridos,
  ordenarPorCodigoIndividual,
  STATUS_CONFIG,
} from "@/lib/estoque-domain";
import type {
  BancoItemResumo,
  FuncaoConfirmarAlteracao,
  ItemIndividualDetalhe,
  MovimentacaoDetalhe,
} from "@/types/estoque";
import CampoEntradaCodigosBarras from "./CampoEntradaCodigosBarras";
import {
  ArrowDownAZ,
  ArrowLeft,
  ArrowUpZA,
  Calendar,
  CheckSquare,
  Edit3,
  History,
  MapPin,
  MinusCircle,
  PlusCircle,
  ScanBarcode,
  Search,
  Square,
} from "lucide-react";

interface ListagemCodigosIndividuaisProps {
  banco: BancoItemResumo;
  itens: ItemIndividualDetalhe[];
  movimentacoes: MovimentacaoDetalhe[];
  operadorAtivo: string;
  confirmarAlteracao: FuncaoConfirmarAlteracao;
  onRecarregarBanco: () => Promise<void>;
  onAbrirEdicaoBanco: (banco: BancoItemResumo) => void;
  onVoltar: () => void;
  onNotificar: (mensagem: string, tipo?: "sucesso" | "erro") => void;
}

export default function ListagemCodigosIndividuais({
  banco,
  itens,
  movimentacoes,
  operadorAtivo,
  confirmarAlteracao,
  onRecarregarBanco,
  onAbrirEdicaoBanco,
  onVoltar,
  onNotificar,
}: ListagemCodigosIndividuaisProps) {
  const [buscaCodigo, setBuscaCodigo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<
    "DISPONIVEL" | "BAIXADO" | "TODOS"
  >("DISPONIVEL");
  const [ordemDirecao, setOrdemDirecao] = useState<"asc" | "desc">("asc");
  const [selecionadosIds, setSelecionadosIds] = useState<number[]>([]);

  // Modal de Entrada (inserção de 1 ou mais códigos de barras individuais reais)
  const [modalEntradaAberto, setModalEntradaAberto] = useState(false);
  const [codigosEntradaLista, setCodigosEntradaLista] = useState<string[]>([]);
  const [codigoEntradaDigitando, setCodigoEntradaDigitando] = useState("");
  const [qtdPorCodigoEntrada, setQtdPorCodigoEntrada] = useState("1");
  const [loteEntrada, setLoteEntrada] = useState("");
  const [validadeEntrada, setValidadeEntrada] = useState("");
  const [localizacaoEntrada, setLocalizacaoEntrada] = useState("");
  const [obsEntrada, setObsEntrada] = useState("");

  // Modal de Baixa (leitura/digitação do código individual ou seleção na lista)
  const [modalBaixaAberto, setModalBaixaAberto] = useState(false);
  const [codigoBipBaixa, setCodigoBipBaixa] = useState("");
  const [obsBaixa, setObsBaixa] = useState("");

  // Modal de Edição de Exemplar Individual
  const [itemEditando, setItemEditando] =
    useState<ItemIndividualDetalhe | null>(null);
  const [editCodigoInd, setEditCodigoInd] = useState("");
  const [editLoteInd, setEditLoteInd] = useState("");
  const [editValidadeInd, setEditValidadeInd] = useState("");
  const [editLocalInd, setEditLocalInd] = useState("");
  const [editObsInd, setEditObsInd] = useState("");

  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  const statusInfo = STATUS_CONFIG[banco.statusEstoque];

  const itensDisponiveis = useMemo(
    () =>
      ordenarPorCodigoIndividual(
        itens.filter((i) => i.status === "DISPONIVEL"),
        "asc"
      ),
    [itens]
  );

  const contadores = useMemo(() => {
    const disp = itens.filter((i) => i.status === "DISPONIVEL").length;
    const baix = itens.filter((i) => i.status === "BAIXADO").length;
    return { disp, baix, todos: itens.length };
  }, [itens]);

  const itensFiltradosEOrdenados = useMemo(() => {
    const termo = buscaCodigo.trim().toLowerCase();
    const filtrados = itens.filter((item) => {
      if (filtroStatus !== "TODOS" && item.status !== filtroStatus) {
        return false;
      }
      if (!termo) return true;
      return (
        item.codigoIndividual.toLowerCase().includes(termo) ||
        item.lote.toLowerCase().includes(termo) ||
        item.localizacao.toLowerCase().includes(termo) ||
        item.observacao.toLowerCase().includes(termo)
      );
    });
    return ordenarPorCodigoIndividual(filtrados, ordemDirecao);
  }, [itens, buscaCodigo, filtroStatus, ordemDirecao]);

  const toggleSelecao = (id: number) => {
    setSelecionadosIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selecionarTodosVisiveisDisponiveis = () => {
    const idsVisiveisDisp = itensFiltradosEOrdenados
      .filter((i) => i.status === "DISPONIVEL")
      .map((i) => i.id);

    const todosJaMarcados =
      idsVisiveisDisp.length > 0 &&
      idsVisiveisDisp.every((id) => selecionadosIds.includes(id));

    if (todosJaMarcados) {
      setSelecionadosIds([]);
    } else {
      setSelecionadosIds(idsVisiveisDisp);
    }
  };

  const handleConfirmarEntrada = async (e: React.FormEvent) => {
    e.preventDefault();

    const pendentes = extrairCodigosBarrasInseridos(codigoEntradaDigitando);
    const mapaUnico = new Map<string, string>();
    for (const c of [...codigosEntradaLista, ...pendentes]) {
      if (!mapaUnico.has(c.toUpperCase())) {
        mapaUnico.set(c.toUpperCase(), c);
      }
    }
    const todosCodigos = Array.from(mapaUnico.values());

    if (todosCodigos.length === 0) {
      onNotificar(
        "Informe ou bipe ao menos um código de barras individual do item.",
        "erro"
      );
      return;
    }

    const qtdPorItem = Number(qtdPorCodigoEntrada) || 1;
    if (qtdPorItem <= 0) {
      onNotificar("A quantidade por item deve ser maior que zero.", "erro");
      return;
    }

    const qtdTotal = Number((todosCodigos.length * qtdPorItem).toFixed(4));
    const resumoCodigos =
      todosCodigos.length <= 4
        ? todosCodigos.join(", ")
        : `${todosCodigos.slice(0, 4).join(", ")} (+${todosCodigos.length - 4})`;

    const confirmado = await confirmarAlteracao({
      categoriaOperacao: "ENTRADA DE ITEM(NS)",
      tituloAcao: `Registrar entrada em "${banco.nome}"`,
      descricao:
        "Os códigos de barras individuais informados serão gravados como disponíveis neste produto.",
      bancoItemId: banco.id,
      textoBotaoConfirmar: "+ Confirmar Entrada",
      variante: "roxo",
      resumoDados: [
        { rotulo: "Produto", valor: banco.nome },
        {
          rotulo: "Códigos Inseridos",
          valor: `${todosCodigos.length} item(ns): ${resumoCodigos}`,
        },
        { rotulo: "Total Adicionado", valor: `+${qtdTotal} ${banco.unidade}` },
        ...(loteEntrada.trim()
          ? [{ rotulo: "Lote", valor: loteEntrada.trim() }]
          : []),
        ...(validadeEntrada
          ? [{ rotulo: "Validade", valor: formatarDataBR(validadeEntrada) }]
          : []),
      ],
    });

    if (!confirmado) return;

    const resp = await fetch(`/api/bancos/${banco.id}/movimentar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "ENTRADA",
        codigosIndividuais: todosCodigos,
        quantidadePorItem: qtdPorItem,
        lote: loteEntrada.trim(),
        dataValidade: validadeEntrada,
        localizacao: localizacaoEntrada.trim(),
        observacao: obsEntrada.trim(),
        operador: operadorAtivo,
      }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      onNotificar(json.error || "Erro ao registrar entrada.", "erro");
      return;
    }

    setModalEntradaAberto(false);
    setCodigosEntradaLista([]);
    setCodigoEntradaDigitando("");
    setQtdPorCodigoEntrada("1");
    setObsEntrada("");
    await onRecarregarBanco();
    onNotificar(
      `Entrada registrada! ${todosCodigos.length} código(s) individual(is) adicionado(s).`
    );
  };

  const biparCodigoParaBaixa = (texto: string) => {
    const codigosLidos = extrairCodigosBarrasInseridos(texto);
    if (codigosLidos.length === 0) return;

    const novosIds = new Set(selecionadosIds);
    const naoEncontrados: string[] = [];

    for (const lido of codigosLidos) {
      const achado = itensDisponiveis.find(
        (i) => i.codigoIndividual.toUpperCase() === lido.toUpperCase()
      );
      if (achado) {
        novosIds.add(achado.id);
      } else {
        naoEncontrados.push(lido);
      }
    }

    setSelecionadosIds(Array.from(novosIds));
    setCodigoBipBaixa("");

    if (naoEncontrados.length > 0) {
      onNotificar(
        `Código não encontrado disponível neste produto: ${naoEncontrados.join(", ")}`,
        "erro"
      );
    }
  };

  const abrirBaixaIndividualRapida = async (item: ItemIndividualDetalhe) => {
    const confirmado = await confirmarAlteracao({
      categoriaOperacao: "BAIXA DE ITEM INDIVIDUAL",
      tituloAcao: `Dar baixa no código ${item.codigoIndividual}`,
      descricao:
        "O item físico será marcado como BAIXADO e descontado do saldo deste produto.",
      bancoItemId: banco.id,
      textoBotaoConfirmar: "− Confirmar Baixa",
      variante: "vermelho",
      resumoDados: [
        { rotulo: "Produto", valor: banco.nome },
        { rotulo: "Código de Barras do Item", valor: item.codigoIndividual },
        { rotulo: "Quantidade", valor: `−${item.quantidade} ${banco.unidade}` },
        ...(item.lote ? [{ rotulo: "Lote", valor: item.lote }] : []),
      ],
    });

    if (!confirmado) return;

    const resp = await fetch(`/api/bancos/${banco.id}/movimentar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "BAIXA",
        itensIds: [item.id],
        observacao: `Baixa individual do código ${item.codigoIndividual}`,
        operador: operadorAtivo,
      }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      onNotificar(json.error || "Erro ao realizar baixa.", "erro");
      return;
    }

    setSelecionadosIds((prev) => prev.filter((id) => id !== item.id));
    await onRecarregarBanco();
    onNotificar(`Código ${item.codigoIndividual} baixado com sucesso!`);
  };

  const handleConfirmarModalBaixa = async (e: React.FormEvent) => {
    e.preventDefault();

    let idsFinais = [...selecionadosIds];
    if (codigoBipBaixa.trim()) {
      const digitados = extrairCodigosBarrasInseridos(codigoBipBaixa);
      for (const cod of digitados) {
        const achado = itensDisponiveis.find(
          (i) => i.codigoIndividual.toUpperCase() === cod.toUpperCase()
        );
        if (!achado) {
          onNotificar(
            `O código individual "${cod}" não está disponível neste produto.`,
            "erro"
          );
          return;
        }
        if (!idsFinais.includes(achado.id)) {
          idsFinais.push(achado.id);
        }
      }
    }

    const itensSel = itensDisponiveis.filter((i) => idsFinais.includes(i.id));
    if (itensSel.length === 0) {
      onNotificar(
        "Bipe ou marque ao menos um código de barras individual para dar baixa.",
        "erro"
      );
      return;
    }

    const qtdTotal = Number(
      itensSel.reduce((acc, i) => acc + i.quantidade, 0).toFixed(4)
    );
    const listaCodigos = itensSel
      .map((i) => i.codigoIndividual)
      .slice(0, 5)
      .join(", ");

    const confirmado = await confirmarAlteracao({
      categoriaOperacao: "BAIXA DE ESTOQUE",
      tituloAcao: `Confirmar baixa de ${itensSel.length} item(ns)`,
      descricao:
        "Os códigos de barras individuais selecionados terão saída registrada.",
      bancoItemId: banco.id,
      textoBotaoConfirmar: "− Confirmar Baixa",
      variante: "vermelho",
      resumoDados: [
        { rotulo: "Produto", valor: banco.nome },
        {
          rotulo: "Códigos Individuais",
          valor:
            listaCodigos +
            (itensSel.length > 5 ? ` (+${itensSel.length - 5})` : ""),
        },
        { rotulo: "Total da Baixa", valor: `−${qtdTotal} ${banco.unidade}` },
        ...(obsBaixa.trim()
          ? [{ rotulo: "Observação", valor: obsBaixa.trim() }]
          : []),
      ],
    });

    if (!confirmado) return;

    const resp = await fetch(`/api/bancos/${banco.id}/movimentar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "BAIXA",
        itensIds: idsFinais,
        observacao: obsBaixa.trim(),
        operador: operadorAtivo,
      }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      onNotificar(json.error || "Erro ao realizar baixa.", "erro");
      return;
    }

    setSelecionadosIds([]);
    setCodigoBipBaixa("");
    setModalBaixaAberto(false);
    setObsBaixa("");
    await onRecarregarBanco();
    onNotificar(`Baixa concluída para ${itensSel.length} código(s)!`);
  };

  const abrirEdicaoItemIndividual = (item: ItemIndividualDetalhe) => {
    setItemEditando(item);
    setEditCodigoInd(item.codigoIndividual);
    setEditLoteInd(item.lote);
    setEditValidadeInd(item.dataValidade);
    setEditLocalInd(item.localizacao);
    setEditObsInd(item.observacao);
  };

  const handleSalvarItemIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemEditando) return;

    const novoCod = editCodigoInd.trim();
    if (!novoCod) {
      onNotificar(
        "O código de barras individual não pode ficar vazio.",
        "erro"
      );
      return;
    }

    const confirmado = await confirmarAlteracao({
      categoriaOperacao: "EDIÇÃO DE ITEM INDIVIDUAL",
      tituloAcao: `Atualizar código ${itemEditando.codigoIndividual}`,
      descricao:
        "Salva as alterações de código de barras individual, lote, validade ou localização deste item.",
      bancoItemId: banco.id,
      textoBotaoConfirmar: "Salvar Alteração",
      variante: "roxo",
      resumoDados: [
        {
          rotulo: "Código Individual",
          valor:
            novoCod !== itemEditando.codigoIndividual
              ? `${itemEditando.codigoIndividual} → ${novoCod}`
              : novoCod,
        },
        { rotulo: "Lote", valor: editLoteInd.trim() || "—" },
        {
          rotulo: "Validade",
          valor: editValidadeInd ? formatarDataBR(editValidadeInd) : "—",
        },
        { rotulo: "Localização", valor: editLocalInd.trim() || "—" },
      ],
    });

    if (!confirmado) return;

    const resp = await fetch(`/api/itens-individuais/${itemEditando.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigoIndividual: novoCod,
        lote: editLoteInd.trim(),
        dataValidade: editValidadeInd,
        localizacao: editLocalInd.trim(),
        observacao: editObsInd.trim(),
      }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      onNotificar(json.error || "Erro ao atualizar código individual.", "erro");
      return;
    }

    setItemEditando(null);
    await onRecarregarBanco();
    onNotificar(`Item ${novoCod} atualizado com sucesso!`);
  };

  return (
    <div className="space-y-4">
      {/* Topo de retorno direto */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onVoltar}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#211738] hover:bg-[#2c1f4a] border border-[#3a2961] text-xs font-semibold text-[#f6f3ff] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-[#d8b4fe]" />
          Voltar aos produtos
        </button>

        <span className="text-xs font-mono text-[#b5a4d9]">
          {banco.codigoBanco}
        </span>
      </div>

      {/* Resumo do Produto */}
      <section className="rounded-2xl bg-[#211738] border border-[#3a2961] p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div className="h-14 w-14 rounded-xl border border-[#3a2961] bg-[#140e22] flex items-center justify-center overflow-hidden text-2xl shrink-0">
            {banco.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={banco.foto}
                alt={banco.nome}
                className="h-full w-full object-cover"
              />
            ) : (
              "📦"
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-[#f6f3ff] truncate">
                {banco.nome}
              </h2>
              <span className={`badge-status badge-${statusInfo.classe}`}>
                {statusInfo.texto}
              </span>
            </div>

            {banco.codigoBarras && (
              <p className="font-mono text-xs text-[#b5a4d9] mt-0.5">
                Ref. geral: {banco.codigoBarras}
              </p>
            )}
          </div>
        </div>

        {/* Indicadores */}
        <div className="grid grid-cols-3 gap-2.5 mt-4 pt-3.5 border-t border-[#3a2961]">
          <div className="rounded-xl bg-[#140e22] border border-[#3a2961] p-2.5">
            <span className="block text-[10px] uppercase tracking-wider text-[#b5a4d9]">
              Saldo Atual
            </span>
            <strong
              className={`text-base font-bold ${
                banco.statusEstoque === "CRITICO"
                  ? "text-[#fb7185]"
                  : banco.statusEstoque === "BAIXO"
                    ? "text-[#fbbf24]"
                    : "text-[#d8b4fe]"
              }`}
            >
              {banco.quantidade} {banco.unidade}
            </strong>
          </div>

          <div className="rounded-xl bg-[#140e22] border border-[#3a2961] p-2.5">
            <span className="block text-[10px] uppercase tracking-wider text-[#b5a4d9]">
              Itens Ativos
            </span>
            <strong className="text-base font-bold text-[#f6f3ff]">
              {contadores.disp} cód.
            </strong>
          </div>

          <div className="rounded-xl bg-[#140e22] border border-[#3a2961] p-2.5">
            <span className="block text-[10px] uppercase tracking-wider text-[#b5a4d9]">
              Estoque Mín.
            </span>
            <strong className="text-base font-bold text-[#f6f3ff]">
              {banco.estoqueMinimo} {banco.unidade}
            </strong>
          </div>
        </div>

        {/* Botões diretos */}
        <div className="grid grid-cols-3 gap-2 mt-3.5">
          <button
            type="button"
            onClick={() => setModalEntradaAberto(true)}
            className="rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold py-2.5 px-2 text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span>+ Entrada</span>
          </button>

          <button
            type="button"
            onClick={() => setModalBaixaAberto(true)}
            className="rounded-xl bg-[#9f1239] hover:bg-[#be123c] text-white font-bold py-2.5 px-2 text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <MinusCircle className="h-4 w-4 shrink-0" />
            <span>
              {selecionadosIds.length > 0
                ? `− Baixa (${selecionadosIds.length})`
                : "− Baixa"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onAbrirEdicaoBanco(banco)}
            className="rounded-xl bg-[#38285c] hover:bg-[#493478] text-white font-bold py-2.5 px-2 text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Edit3 className="h-4 w-4 shrink-0" />
            <span>✎ Editar</span>
          </button>
        </div>
      </section>

      {/* Listagem dos Códigos de Barras Individuais */}
      <section className="rounded-2xl bg-[#211738] border border-[#3a2961] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#f6f3ff] flex items-center gap-1.5">
              <ScanBarcode className="h-4 w-4 text-[#c084fc]" />
              Códigos de Barras Individuais deste Produto
            </h3>
            <p className="text-xs text-[#b5a4d9]">
              Listagem organizada pelos códigos próprios de cada item físico.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setOrdemDirecao((d) => (d === "asc" ? "desc" : "asc"))
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a1e47] hover:bg-[#38285c] border border-[#493478] text-xs font-semibold text-[#e9d5ff] cursor-pointer"
          >
            {ordemDirecao === "asc" ? (
              <>
                <ArrowDownAZ className="h-3.5 w-3.5 text-[#c084fc]" />
                Crescente
              </>
            ) : (
              <>
                <ArrowUpZA className="h-3.5 w-3.5 text-[#c084fc]" />
                Decrescente
              </>
            )}
          </button>
        </div>

        {/* Busca rápida por código individual */}
        <div className="campo-estoque flex items-center gap-2">
          <Search className="h-4 w-4 text-[#c084fc] shrink-0" />
          <input
            type="search"
            value={buscaCodigo}
            onChange={(e) => setBuscaCodigo(e.target.value)}
            placeholder="Filtrar ou bipar código individual, lote ou localização..."
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl bg-[#140e22] border border-[#3a2961] p-1 gap-1">
            {(
              [
                ["DISPONIVEL", `Disponíveis (${contadores.disp})`],
                ["BAIXADO", `Baixados (${contadores.baix})`],
                ["TODOS", `Todos (${contadores.todos})`],
              ] as const
            ).map(([chave, rotulo]) => (
              <button
                key={chave}
                type="button"
                onClick={() => setFiltroStatus(chave)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  filtroStatus === chave
                    ? "bg-[#7c3aed] text-white"
                    : "text-[#b5a4d9] hover:text-white"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>

          {filtroStatus !== "BAIXADO" && contadores.disp > 0 && (
            <button
              type="button"
              onClick={selecionarTodosVisiveisDisponiveis}
              className="text-xs text-[#b5a4d9] hover:text-[#d8b4fe] font-medium cursor-pointer"
            >
              {selecionadosIds.length > 0
                ? `Limpar seleção (${selecionadosIds.length})`
                : "Selecionar visíveis"}
            </button>
          )}
        </div>

        {/* Itens */}
        {itensFiltradosEOrdenados.length === 0 ? (
          <div className="rounded-xl bg-[#140e22] border border-dashed border-[#3a2961] py-8 px-4 text-center space-y-2">
            <p className="text-sm text-[#b5a4d9]">
              Nenhum código de barras individual encontrado neste filtro.
            </p>
            <button
              type="button"
              onClick={() => setModalEntradaAberto(true)}
              className="text-xs font-bold text-[#d8b4fe] hover:underline cursor-pointer"
            >
              + Inserir novo código de barras individual
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {itensFiltradosEOrdenados.map((item, idx) => {
              const disponivel = item.status === "DISPONIVEL";
              const marcado = selecionadosIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    marcado
                      ? "bg-[#2e1c57] border-[#c084fc]/70"
                      : disponivel
                        ? "bg-[#140e22] border-[#3a2961] hover:border-[#533a8a]"
                        : "bg-[#140e22]/60 border-[#2b1f47] opacity-75"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {disponivel ? (
                        <button
                          type="button"
                          onClick={() => toggleSelecao(item.id)}
                          className="mt-0.5 text-[#d8b4fe] cursor-pointer shrink-0"
                          title="Selecionar código"
                        >
                          {marcado ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4 text-[#b5a4d9]" />
                          )}
                        </button>
                      ) : (
                        <span className="mt-0.5 text-xs font-mono text-[#b5a4d9] px-1">
                          #{idx + 1}
                        </span>
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold px-2.5 py-0.5 rounded-md bg-[#2a1e47] border border-[#4c357d] text-[#e9d5ff]">
                            {item.codigoIndividual}
                          </span>

                          <span className="text-xs font-semibold text-[#f6f3ff]">
                            {item.quantidade} {banco.unidade}
                          </span>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              disponivel
                                ? "bg-[#7c3aed]/25 text-[#d8b4fe]"
                                : "bg-[#9f1239]/25 text-[#fb7185]"
                            }`}
                          >
                            {disponivel ? "Disponível" : "Baixado"}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-[#b5a4d9]">
                          {item.lote && (
                            <span className="font-mono">
                              Lote:{" "}
                              <strong className="text-[#f6f3ff]">
                                {item.lote}
                              </strong>
                            </span>
                          )}

                          {item.dataValidade && (
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                item.statusValidade === "VENCIDO"
                                  ? "text-[#fb7185]"
                                  : item.statusValidade === "VENCENDO"
                                    ? "text-[#fbbf24]"
                                    : "text-[#b5a4d9]"
                              }`}
                            >
                              <Calendar className="h-3 w-3" />
                              Val: {formatarDataBR(item.dataValidade)}
                              {item.statusValidade === "VENCIDO" &&
                                " (VENCIDO)"}
                              {item.statusValidade === "VENCENDO" &&
                                item.diasParaVencer !== null &&
                                ` (${item.diasParaVencer}d)`}
                            </span>
                          )}

                          {item.localizacao && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {item.localizacao}
                            </span>
                          )}
                        </div>

                        {item.observacao && (
                          <p className="text-[11px] text-[#b5a4d9]/80 mt-1">
                            Obs.: {item.observacao}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => abrirEdicaoItemIndividual(item)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#2a1e47] hover:bg-[#3b2a63] text-xs font-semibold text-[#f6f3ff] cursor-pointer"
                        title="Editar código de barras / lote / validade"
                      >
                        ✎
                      </button>

                      {disponivel && (
                        <button
                          type="button"
                          onClick={() => abrirBaixaIndividualRapida(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#9f1239] hover:bg-[#be123c] text-xs font-bold text-white cursor-pointer"
                          title={`Dar baixa no código ${item.codigoIndividual}`}
                        >
                          − Baixa
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Histórico deste Produto */}
      <section className="rounded-2xl bg-[#211738] border border-[#3a2961] p-4">
        <button
          type="button"
          onClick={() => setMostrarHistorico((v) => !v)}
          className="w-full flex items-center justify-between text-left cursor-pointer"
        >
          <span className="inline-flex items-center gap-2 text-sm font-bold text-[#f6f3ff]">
            <History className="h-4 w-4 text-[#c084fc]" />
            Histórico de Entradas e Baixas ({movimentacoes.length})
          </span>
          <span className="text-xs text-[#d8b4fe] font-semibold">
            {mostrarHistorico ? "Ocultar ▲" : "Exibir ▼"}
          </span>
        </button>

        {mostrarHistorico && (
          <div className="mt-3 pt-3 border-t border-[#3a2961] space-y-2">
            {movimentacoes.length === 0 ? (
              <p className="text-xs text-[#b5a4d9]">
                Nenhuma movimentação registrada ainda.
              </p>
            ) : (
              movimentacoes.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl bg-[#140e22] border border-[#3a2961] p-2.5 text-xs flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          m.tipo === "ENTRADA"
                            ? "bg-[#7c3aed]/25 text-[#d8b4fe]"
                            : "bg-[#9f1239]/25 text-[#fb7185]"
                        }`}
                      >
                        {m.tipo}
                      </span>
                      <span className="font-mono text-[#f6f3ff] font-semibold">
                        {m.codigoIndividualRef || "—"}
                      </span>
                    </div>
                    {m.observacao && (
                      <p className="text-[#b5a4d9] mt-1">{m.observacao}</p>
                    )}
                    <p className="text-[11px] text-[#b5a4d9]/75 mt-0.5">
                      Por {m.operador} ·{" "}
                      {new Date(m.data).toLocaleString("pt-BR")}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <strong
                      className={
                        m.tipo === "ENTRADA"
                          ? "text-[#d8b4fe]"
                          : "text-[#fb7185]"
                      }
                    >
                      {m.tipo === "ENTRADA" ? "+" : "−"}
                      {m.quantidade} {banco.unidade}
                    </strong>
                    <span className="block text-[11px] text-[#b5a4d9]">
                      Saldo: {m.saldoApos}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* MODAL ENTRADA */}
      {modalEntradaAberto && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-[#090510]/80 backdrop-blur-xs p-0 sm:p-4">
          <form
            onSubmit={handleConfirmarEntrada}
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-[#211738] border border-[#3a2961] p-5 space-y-3.5 max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div>
              <h3 className="text-base font-bold text-[#f6f3ff]">
                Registrar entrada — {banco.nome}
              </h3>
              <p className="text-xs text-[#b5a4d9]">
                Insira ou bipe o código de barras que já vem em cada item.
              </p>
            </div>

            <CampoEntradaCodigosBarras
              autoFocus
              codigos={codigosEntradaLista}
              onChangeCodigos={setCodigosEntradaLista}
              valorDigitando={codigoEntradaDigitando}
              onChangeValorDigitando={setCodigoEntradaDigitando}
              rotulo="Código(s) de barras individual(is) *"
              placeholder="Bipe ou digite o código do item (Enter adiciona vários)"
              ajuda="Pode inserir apenas 1 código e confirmar direto, ou bipar vários seguidos teclando Enter."
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Qtd. por código ({banco.unidade})
                </label>
                <div className="campo-estoque">
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    required
                    value={qtdPorCodigoEntrada}
                    onChange={(e) => setQtdPorCodigoEntrada(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Localização (opcional)
                </label>
                <div className="campo-estoque">
                  <input
                    type="text"
                    value={localizacaoEntrada}
                    onChange={(e) => setLocalizacaoEntrada(e.target.value)}
                    placeholder="Ex.: Prat. A2"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Lote {banco.controlaLote ? "(recomendado)" : "(opcional)"}
                </label>
                <div className="campo-estoque">
                  <input
                    type="text"
                    value={loteEntrada}
                    onChange={(e) => setLoteEntrada(e.target.value)}
                    placeholder="Ex.: LT-2026-B1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Validade (opcional)
                </label>
                <div className="campo-estoque">
                  <input
                    type="date"
                    value={validadeEntrada}
                    onChange={(e) => setValidadeEntrada(e.target.value)}
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
                  value={obsEntrada}
                  onChange={(e) => setObsEntrada(e.target.value)}
                  placeholder="Ex.: Nota fiscal 4512"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setModalEntradaAberto(false)}
                className="rounded-xl bg-[#38285c] hover:bg-[#493478] text-white py-3 text-sm font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white py-3 text-sm font-bold cursor-pointer"
              >
                + Registrar Entrada
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL BAIXA */}
      {modalBaixaAberto && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-[#090510]/80 backdrop-blur-xs p-0 sm:p-4">
          <form
            onSubmit={handleConfirmarModalBaixa}
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-[#211738] border border-[#3a2961] p-5 space-y-3.5 max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div>
              <h3 className="text-base font-bold text-[#f6f3ff]">
                Registrar baixa — {banco.nome}
              </h3>
              <p className="text-xs text-[#b5a4d9]">
                Bipe o código de barras do item que está saindo ou marque abaixo.
              </p>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                Bipar / digitar código individual do item
              </label>
              <div className="flex gap-2">
                <div className="campo-estoque flex-1 flex items-center gap-2">
                  <ScanBarcode className="h-4 w-4 text-[#fb7185] shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    value={codigoBipBaixa}
                    onChange={(e) => setCodigoBipBaixa(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && codigoBipBaixa.trim()) {
                        e.preventDefault();
                        biparCodigoParaBaixa(codigoBipBaixa);
                      }
                    }}
                    placeholder="Bipe o código do item e tecle Enter"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => biparCodigoParaBaixa(codigoBipBaixa)}
                  disabled={!codigoBipBaixa.trim()}
                  className="px-3.5 rounded-xl bg-[#38285c] hover:bg-[#493478] disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
                >
                  Marcar
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#b5a4d9]">
                <span>
                  Disponíveis ({itensDisponiveis.length}) · Selecionados:{" "}
                  <strong className="text-[#fb7185]">
                    {selecionadosIds.length}
                  </strong>
                </span>
              </div>

              <div className="rounded-xl bg-[#140e22] border border-[#3a2961] max-h-48 overflow-y-auto divide-y divide-[#3a2961]">
                {itensDisponiveis.length === 0 ? (
                  <p className="p-4 text-xs text-center text-[#b5a4d9]">
                    Nenhum item disponível neste produto.
                  </p>
                ) : (
                  itensDisponiveis.map((disp) => {
                    const sel = selecionadosIds.includes(disp.id);
                    return (
                      <button
                        key={disp.id}
                        type="button"
                        onClick={() => toggleSelecao(disp.id)}
                        className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left text-xs cursor-pointer ${
                          sel ? "bg-[#3b1934]" : "hover:bg-[#23183b]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {sel ? (
                            <CheckSquare className="h-4 w-4 text-[#fb7185] shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-[#b5a4d9] shrink-0" />
                          )}
                          <span className="font-mono font-bold text-[#f6f3ff]">
                            {disp.codigoIndividual}
                          </span>
                          {disp.lote && (
                            <span className="text-[11px] text-[#b5a4d9]">
                              Lote: {disp.lote}
                            </span>
                          )}
                        </div>
                        <span className="text-[#b5a4d9]">
                          {disp.quantidade} {banco.unidade}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                Observação (opcional)
              </label>
              <div className="campo-estoque">
                <input
                  type="text"
                  value={obsBaixa}
                  onChange={(e) => setObsBaixa(e.target.value)}
                  placeholder="Ex.: Saída para produção / venda"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setModalBaixaAberto(false)}
                className="rounded-xl bg-[#38285c] hover:bg-[#493478] text-white py-3 text-sm font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#9f1239] hover:bg-[#be123c] text-white py-3 text-sm font-bold cursor-pointer"
              >
                − Confirmar Baixa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL EDIÇÃO DE CÓDIGO INDIVIDUAL */}
      {itemEditando && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-[#090510]/80 backdrop-blur-xs p-0 sm:p-4">
          <form
            onSubmit={handleSalvarItemIndividual}
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-[#211738] border border-[#3a2961] p-5 space-y-3.5 shadow-2xl"
          >
            <h3 className="text-base font-bold text-[#f6f3ff]">
              Editar Código de Barras Individual
            </h3>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                Código de Barras Individual do Item
              </label>
              <div className="campo-estoque">
                <input
                  type="text"
                  required
                  value={editCodigoInd}
                  onChange={(e) => setEditCodigoInd(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Lote
                </label>
                <div className="campo-estoque">
                  <input
                    type="text"
                    value={editLoteInd}
                    onChange={(e) => setEditLoteInd(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Data de Validade
                </label>
                <div className="campo-estoque">
                  <input
                    type="date"
                    value={editValidadeInd}
                    onChange={(e) => setEditValidadeInd(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                Localização
              </label>
              <div className="campo-estoque">
                <input
                  type="text"
                  value={editLocalInd}
                  onChange={(e) => setEditLocalInd(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                Observação
              </label>
              <div className="campo-estoque">
                <input
                  type="text"
                  value={editObsInd}
                  onChange={(e) => setEditObsInd(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemEditando(null)}
                className="rounded-xl bg-[#38285c] hover:bg-[#493478] text-white py-3 text-sm font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white py-3 text-sm font-bold cursor-pointer"
              >
                Salvar Alteração
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function formatarDataBR(iso: string): string {
  const p = iso.split("-");
  if (p.length !== 3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
}
