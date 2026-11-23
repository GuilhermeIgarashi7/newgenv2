"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  calcularDuracaoUso,
  extrairCodigosBarrasInseridos,
  formatarDataHoraBR,
  obterDataHoraLocalInput,
} from "@/lib/estoque-domain";
import { apiFetch } from "@/lib/client-api";
import type {
  BancoItemResumo,
  FuncaoConfirmarAlteracao,
  RetiradaDispositivoDetalhe,
} from "@/types/estoque";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  CheckSquare,
  Clock,
  MapPin,
  RefreshCw,
  ScanBarcode,
  Search,
  Square,
  Timer,
  User,
} from "lucide-react";

interface AbaRetiradasProps {
  bancos: BancoItemResumo[];
  operadorAtivo: string;
  confirmarAlteracao: FuncaoConfirmarAlteracao;
  onAtualizarEstoqueGeral: () => Promise<void>;
  onAbrirBancoDireto: (bancoId: number) => void;
  onNotificar: (msg: string, tipo?: "sucesso" | "erro") => void;
}

export default function AbaRetiradas({
  bancos,
  operadorAtivo,
  confirmarAlteracao,
  onAtualizarEstoqueGeral,
  onAbrirBancoDireto,
  onNotificar,
}: AbaRetiradasProps) {
  const [subAba, setSubAba] = useState<"EM_USO" | "DEVOLVIDO">("EM_USO");
  const [apenasMinhas, setApenasMinhas] = useState(false);
  const [retiradas, setRetiradas] = useState<RetiradaDispositivoDetalhe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");

  // Modal de Nova Retirada
  const [modalRetiradaAberto, setModalRetiradaAberto] = useState(false);
  const [bancoEscolhidoId, setBancoEscolhidoId] = useState<string>("");
  const [itensIdsRetirada, setItensIdsRetirada] = useState<number[]>([]);
  const [codigoBipRetirada, setCodigoBipRetirada] = useState("");
  const [destinoUso, setDestinoUso] = useState("");
  const [dataHoraRetirada, setDataHoraRetirada] = useState(() =>
    obterDataHoraLocalInput()
  );
  const [previsaoDevolucao, setPrevisaoDevolucao] = useState("");
  const [obsRetirada, setObsRetirada] = useState("");
  const [erroModalRetirada, setErroModalRetirada] = useState("");
  const [salvandoOperacao, setSalvandoOperacao] = useState(false);

  // Modal de Devolução
  const [retiradaParaDevolver, setRetiradaParaDevolver] =
    useState<RetiradaDispositivoDetalhe | null>(null);
  const [dataHoraDevolucao, setDataHoraDevolucao] = useState(() =>
    obterDataHoraLocalInput()
  );
  const [localDevolucao, setLocalDevolucao] = useState("");
  const [condicaoDevolucao, setCondicaoDevolucao] = useState("Perfeito estado");
  const [obsDevolucao, setObsDevolucao] = useState("");

  const carregarRetiradas = useCallback(async () => {
    setCarregando(true);
    try {
      const resp = await apiFetch("/api/retiradas");
      if (resp.ok) {
        const json = await resp.json();
        setRetiradas(json.retiradas || []);
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarRetiradas();
  }, [carregarRetiradas]);

  const emUsoLista = useMemo(
    () => retiradas.filter((r) => r.status === "EM_USO"),
    [retiradas]
  );
  const devolvidosLista = useMemo(
    () => retiradas.filter((r) => r.status === "DEVOLVIDO"),
    [retiradas]
  );

  const listaVisivel = useMemo(() => {
    let base = subAba === "EM_USO" ? emUsoLista : devolvidosLista;
    if (apenasMinhas) {
      base = base.filter(
        (r) =>
          r.responsavelRetirada.toLowerCase() === operadorAtivo.toLowerCase()
      );
    }
    const t = busca.trim().toLowerCase();
    if (!t) return base;
    return base.filter(
      (r) =>
        r.codigoIndividual.toLowerCase().includes(t) ||
        (r.nomeBanco || "").toLowerCase().includes(t) ||
        r.responsavelRetirada.toLowerCase().includes(t) ||
        r.destinoUso.toLowerCase().includes(t) ||
        r.localArmazenamentoDevolucao.toLowerCase().includes(t)
    );
  }, [subAba, emUsoLista, devolvidosLista, busca, apenasMinhas, operadorAtivo]);

  // Ação inteligente ao bipar código na barra superior
  const acaoRapidaPorCodigo = (codigoBruto: string) => {
    const cod = codigoBruto.trim();
    if (!cod) return;
    const upper = cod.toUpperCase();

    // 1. Verifica se está EM_USO -> abre devolução imediata!
    const emUsoAchado = emUsoLista.find(
      (r) => r.codigoIndividual.toUpperCase() === upper
    );
    if (emUsoAchado) {
      abrirModalDevolucao(emUsoAchado);
      setBusca("");
      return;
    }

    // 2. Verifica se está DISPONIVEL em algum banco -> abre retirada imediata já marcado!
    for (const b of bancos) {
      const disp = (b.codigosDisponiveisPreview || []).find(
        (c) => c.codigoIndividual.toUpperCase() === upper
      );
      if (disp) {
        setBancoEscolhidoId(String(b.id));
        setItensIdsRetirada([disp.id]);
        setDataHoraRetirada(obterDataHoraLocalInput());
        setDestinoUso("");
        setPrevisaoDevolucao("");
        setObsRetirada("");
        setModalRetiradaAberto(true);
        setBusca("");
        return;
      }
    }

    onNotificar(
      `Código "${cod}" não encontrado como disponível nem em uso no momento.`,
      "erro"
    );
  };

  const abrirModalNovaRetirada = () => {
    const primeiroComSaldo =
      bancos.find((b) => (b.codigosDisponiveisPreview || []).length > 0) ||
      bancos[0];
    setBancoEscolhidoId(primeiroComSaldo ? String(primeiroComSaldo.id) : "");
    const dispInicial = primeiroComSaldo?.codigosDisponiveisPreview || [];
    setItensIdsRetirada(dispInicial.length === 1 ? [dispInicial[0].id] : []);
    setCodigoBipRetirada("");
    setDestinoUso("");
    setDataHoraRetirada(obterDataHoraLocalInput());
    setPrevisaoDevolucao("");
    setObsRetirada("");
    setErroModalRetirada("");
    setModalRetiradaAberto(true);
  };

  const bancoSelecionadoModal = useMemo(
    () =>
      bancos.find((b) => String(b.id) === bancoEscolhidoId) ||
      bancos[0] ||
      null,
    [bancos, bancoEscolhidoId]
  );

  const disponiveisNoModal = useMemo(
    () => bancoSelecionadoModal?.codigosDisponiveisPreview || [],
    [bancoSelecionadoModal]
  );

  const biparDentroDoModalRetirada = (codigoTexto: string) => {
    const limpo = codigoTexto.trim();
    if (!limpo) return;
    const upper = limpo.toUpperCase();

    // Procura inclusive em todos os bancos caso o código pertença a outro produto
    for (const b of bancos) {
      const item = (b.codigosDisponiveisPreview || []).find(
        (c) => c.codigoIndividual.toUpperCase() === upper
      );
      if (item) {
        if (String(b.id) !== bancoEscolhidoId) {
          setBancoEscolhidoId(String(b.id));
          setItensIdsRetirada([item.id]);
        } else if (!itensIdsRetirada.includes(item.id)) {
          setItensIdsRetirada((prev) => [...prev, item.id]);
        }
        setCodigoBipRetirada("");
        return;
      }
    }

    onNotificar(
      `O código "${limpo}" não está disponível para retirada.`,
      "erro"
    );
  };

  const handleConfirmarRetirada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bancoSelecionadoModal || salvandoOperacao) return;
    setErroModalRetirada("");

    const respLimpo = operadorAtivo;
    const destLimpo = destinoUso.trim();

    if (!destLimpo) {
      const msg = "Informe onde o dispositivo ficará (setor/local).";
      setErroModalRetirada(msg);
      onNotificar(msg, "erro");
      return;
    }

    // Inclui também códigos digitados no campo de bip caso o usuário não tenha clicado em "+"
    const todosDisponiveisGerais = bancos.flatMap(
      (b) => b.codigosDisponiveisPreview || []
    );
    const idsFinais = new Set<number>(itensIdsRetirada);

    if (codigoBipRetirada.trim()) {
      const digitados = extrairCodigosBarrasInseridos(codigoBipRetirada);
      for (const cod of digitados) {
        const achado = todosDisponiveisGerais.find(
          (d) => d.codigoIndividual.toUpperCase() === cod.toUpperCase()
        );
        if (!achado) {
          const msg = `O código individual "${cod}" não está disponível na base.`;
          setErroModalRetirada(msg);
          onNotificar(msg, "erro");
          return;
        }
        idsFinais.add(achado.id);
      }
    }

    const itensMarcados = todosDisponiveisGerais.filter((d) =>
      idsFinais.has(d.id)
    );

    if (itensMarcados.length === 0) {
      const msg =
        "Marque ao menos um código disponível na lista abaixo antes de confirmar.";
      setErroModalRetirada(msg);
      onNotificar(msg, "erro");
      return;
    }

    const dataRetObj = dataHoraRetirada
      ? new Date(dataHoraRetirada)
      : new Date();

    const codigosResumo =
      itensMarcados.length <= 4
        ? itensMarcados.map((i) => i.codigoIndividual).join(", ")
        : `${itensMarcados
            .slice(0, 4)
            .map((i) => i.codigoIndividual)
            .join(", ")} (+${itensMarcados.length - 4})`;

    const ok = await confirmarAlteracao({
      categoriaOperacao: "RETIRADA DE DISPOSITIVO",
      tituloAcao: `Registrar retirada de ${itensMarcados.length} item(ns)`,
      descricao:
        "Guarda a data e hora exatas da retirada e atualiza em tempo real onde o dispositivo está.",
      bancoItemId: bancoSelecionadoModal.id,
      textoBotaoConfirmar: "Confirmar Retirada",
      variante: "roxo",
      resumoDados: [
        { rotulo: "Dispositivo / Produto", valor: bancoSelecionadoModal.nome },
        { rotulo: "Código(s) Individual(is)", valor: codigosResumo },
        { rotulo: "Retirado por", valor: respLimpo },
        { rotulo: "Local / Destino", valor: destLimpo },
        {
          rotulo: "Data e Hora da Retirada",
          valor: formatarDataHoraBR(dataRetObj),
        },
      ],
    });

    if (!ok) return;

    setSalvandoOperacao(true);
    try {
      const resp = await apiFetch("/api/retiradas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bancoItemId: bancoSelecionadoModal.id,
          itensIds: itensMarcados.map((i) => i.id),
          responsavelRetirada: respLimpo,
          destinoUso: destLimpo,
          dataHoraRetirada: dataRetObj.toISOString(),
          previsaoDevolucao: previsaoDevolucao
            ? new Date(previsaoDevolucao).toISOString()
            : null,
          observacao: obsRetirada.trim(),
          operador: operadorAtivo,
        }),
      });

      const json = await resp.json();
      if (!resp.ok) {
        const msg = json.error || "Erro ao registrar retirada.";
        setErroModalRetirada(msg);
        onNotificar(msg, "erro");
        return;
      }

      setModalRetiradaAberto(false);
      setCodigoBipRetirada("");
      setErroModalRetirada("");
      await Promise.all([carregarRetiradas(), onAtualizarEstoqueGeral()]);
      setSubAba("EM_USO");
      onNotificar(
        `Retirada registrada às ${dataRetObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}!`
      );
    } finally {
      setSalvandoOperacao(false);
    }
  };

  const abrirModalDevolucao = (registro: RetiradaDispositivoDetalhe) => {
    setRetiradaParaDevolver(registro);
    setDataHoraDevolucao(obterDataHoraLocalInput());
    setLocalDevolucao("");
    setCondicaoDevolucao("Perfeito estado");
    setObsDevolucao("");
  };

  const handleConfirmarDevolucao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retiradaParaDevolver || salvandoOperacao) return;

    const dataDevObj = dataHoraDevolucao
      ? new Date(dataHoraDevolucao)
      : new Date();

    const duracao = calcularDuracaoUso(
      retiradaParaDevolver.dataHoraRetirada,
      dataDevObj
    );

    const ok = await confirmarAlteracao({
      categoriaOperacao: "DEVOLUÇÃO DE DISPOSITIVO",
      tituloAcao: `Confirmar devolução de ${retiradaParaDevolver.codigoIndividual}`,
      descricao:
        "Registra a data e hora exatas da devolução e retorna o dispositivo para o estoque disponível.",
      bancoItemId: retiradaParaDevolver.bancoItemId,
      textoBotaoConfirmar: "Confirmar Devolução",
      variante: "roxo",
      resumoDados: [
        {
          rotulo: "Dispositivo",
          valor: `${retiradaParaDevolver.nomeBanco} (${retiradaParaDevolver.codigoIndividual})`,
        },
        {
          rotulo: "Estava em / Com",
          valor: `${retiradaParaDevolver.destinoUso} · ${retiradaParaDevolver.responsavelRetirada}`,
        },
        {
          rotulo: "Retirado em",
          valor: formatarDataHoraBR(retiradaParaDevolver.dataHoraRetirada),
        },
        {
          rotulo: "Devolvido em",
          valor: `${formatarDataHoraBR(dataDevObj)} (Uso: ${duracao})`,
        },
        {
          rotulo: "Guardado em",
          valor: localDevolucao.trim() || "Disponível na base",
        },
      ],
    });

    if (!ok) return;

    setSalvandoOperacao(true);
    try {
      const resp = await apiFetch("/api/retiradas/devolver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retiradaIds: [retiradaParaDevolver.id],
          dataHoraDevolucao: dataDevObj.toISOString(),
          localArmazenamentoDevolucao: localDevolucao.trim(),
          condicaoDevolucao: condicaoDevolucao.trim(),
          observacao: obsDevolucao.trim(),
          operador: operadorAtivo,
        }),
      });

      const json = await resp.json();
      if (!resp.ok) {
        onNotificar(json.error || "Erro ao registrar devolução.", "erro");
        return;
      }

      setRetiradaParaDevolver(null);
      await Promise.all([carregarRetiradas(), onAtualizarEstoqueGeral()]);
      onNotificar(
        `Devolução de ${retiradaParaDevolver.codigoIndividual} registrada com data e hora!`
      );
    } finally {
      setSalvandoOperacao(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho do Painel de Rastreamento */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#f6f3ff] flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#c084fc]" />
            Onde Estão os Dispositivos
          </h2>
          <p className="text-xs text-[#b5a4d9]">
            Controle de data e hora de retirada, localização atual e horário de
            devolução.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={carregarRetiradas}
            className="p-2.5 rounded-xl bg-[#2a1e47] hover:bg-[#38285c] border border-[#493478] text-[#d8b4fe] cursor-pointer"
            title="Atualizar lista"
          >
            <RefreshCw
              className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`}
            />
          </button>

          <button
            type="button"
            onClick={abrirModalNovaRetirada}
            className="rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] shadow-md shadow-[#7c3aed]/25 text-white font-bold py-2.5 px-3.5 text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>Nova Retirada</span>
          </button>
        </div>
      </div>

      {/* Barra Inteligente: Busca + Bipar Código p/ Retirar ou Devolver */}
      <div className="flex gap-2">
        <div className="campo-estoque flex-1 flex items-center gap-2">
          <Search className="h-4 w-4 text-[#c084fc] shrink-0" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && busca.trim()) {
                e.preventDefault();
                acaoRapidaPorCodigo(busca);
              }
            }}
            placeholder="Buscar local, responsável ou bipar código individual (Enter)"
          />
        </div>

        {busca.trim() && (
          <button
            type="button"
            onClick={() => acaoRapidaPorCodigo(busca)}
            className="px-3.5 rounded-xl bg-[#2f1e56] hover:bg-[#3e2870] border border-[#c084fc]/45 text-xs font-bold text-[#e9d5ff] flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Se estiver disponível abre Retirada; se estiver fora abre Devolução"
          >
            <ScanBarcode className="h-4 w-4 text-[#d8b4fe]" />
            <span>Bipar</span>
          </button>
        )}
      </div>

      {/* Abas: Em Uso Agora vs Histórico de Devolvidos + Filtro Minhas Retiradas */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#211738] border border-[#3a2961] p-1.5">
          <button
            type="button"
            onClick={() => setSubAba("EM_USO")}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              subAba === "EM_USO"
                ? "bg-[#7c3aed] text-white shadow-sm"
                : "text-[#b5a4d9] hover:text-white"
            }`}
          >
            <ArrowUpRight className="h-4 w-4 shrink-0" />
            <span>Em Uso Agora ({emUsoLista.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubAba("DEVOLVIDO")}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              subAba === "DEVOLVIDO"
                ? "bg-[#7c3aed] text-white shadow-sm"
                : "text-[#b5a4d9] hover:text-white"
            }`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Devolvidos ({devolvidosLista.length})</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-[#b5a4d9]">
            Logado como:{" "}
            <strong className="text-[#f6f3ff]">{operadorAtivo}</strong>
          </span>
          <button
            type="button"
            onClick={() => setApenasMinhas((v) => !v)}
            className={`px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
              apenasMinhas
                ? "bg-[#7c3aed] border-[#c084fc] text-white"
                : "bg-[#211738] border-[#3a2961] text-[#d8b4fe] hover:border-[#c084fc]/50"
            }`}
          >
            {apenasMinhas
              ? "✓ Mostrando minhas retiradas"
              : "Filtrar minhas retiradas"}
          </button>
        </div>
      </div>

      {/* Listagem */}
      {carregando ? (
        <div className="rounded-2xl bg-[#211738] border border-[#3a2961] p-8 text-center text-sm text-[#b5a4d9]">
          Carregando rastreamento de dispositivos...
        </div>
      ) : listaVisivel.length === 0 ? (
        <div className="rounded-2xl bg-[#211738] border border-[#3a2961] p-8 text-center space-y-2.5">
          <p className="text-sm text-[#b5a4d9]">
            {subAba === "EM_USO"
              ? "Nenhum dispositivo retirado no momento — todos estão na base."
              : "Nenhuma devolução encontrada para este filtro."}
          </p>
          {subAba === "EM_USO" && (
            <button
              type="button"
              onClick={abrirModalNovaRetirada}
              className="text-xs font-bold text-[#d8b4fe] hover:underline cursor-pointer"
            >
              + Registrar retirada de dispositivo agora
            </button>
          )}
        </div>
      ) : subAba === "EM_USO" ? (
        /* LISTA DE DISPOSITIVOS ATUALMENTE FORA / RETIRADOS */
        <div className="space-y-3">
          {listaVisivel.map((r) => {
            const atrasado =
              r.previsaoDevolucao &&
              new Date(r.previsaoDevolucao).getTime() < Date.now();

            return (
              <article
                key={r.id}
                className={`rounded-2xl bg-[#211738] border p-4 space-y-3 transition-colors ${
                  atrasado ? "border-[#fb7185]/70" : "border-[#4c357d]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-[#2f1e56] border border-[#c084fc]/50 text-[#e9d5ff]">
                        {r.codigoIndividual}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAbrirBancoDireto(r.bancoItemId)}
                        className="text-sm font-bold text-[#f6f3ff] hover:text-[#d8b4fe] cursor-pointer"
                      >
                        {r.nomeBanco}
                      </button>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                      atrasado
                        ? "bg-[#9f1239]/30 text-[#fb7185] border border-[#fb7185]/40"
                        : "bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/35"
                    }`}
                  >
                    {atrasado ? "⚠ Devolução Atrasada" : "● Em Uso Externo"}
                  </span>
                </div>

                {/* Bloco de Destaque: Onde está + Com quem + Data/Hora Retirada */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-xl bg-[#140e22] border border-[#3a2961] p-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-[#b5a4d9] flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-[#c084fc]" />
                      Onde o dispositivo está agora
                    </span>
                    <strong className="block text-sm text-[#f6f3ff]">
                      {r.destinoUso}
                    </strong>
                    <span className="text-[#d8b4fe] flex items-center gap-1.5 flex-wrap">
                      <User className="h-3 w-3" />
                      Responsável: <strong>{r.responsavelRetirada}</strong>
                      {r.responsavelRetirada.toLowerCase() ===
                        operadorAtivo.toLowerCase() && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#7c3aed] text-white">
                          VOCÊ
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="space-y-1 sm:text-right">
                    <span className="text-[10px] uppercase tracking-wider text-[#b5a4d9] inline-flex items-center gap-1 sm:justify-end">
                      <Clock className="h-3 w-3 text-[#fbbf24]" />
                      Data e Hora da Retirada
                    </span>
                    <strong className="block text-sm font-mono text-[#fbbf24]">
                      {formatarDataHoraBR(r.dataHoraRetirada)}
                    </strong>
                    <span className="text-[#b5a4d9] inline-flex items-center gap-1 sm:justify-end">
                      <Timer className="h-3 w-3 text-[#c084fc]" />
                      Tempo fora:{" "}
                      <strong className="text-[#e9d5ff]">
                        {calcularDuracaoUso(r.dataHoraRetirada)}
                      </strong>
                    </span>
                  </div>
                </div>

                {r.previsaoDevolucao && (
                  <p className="text-[11px] text-[#b5a4d9]">
                    Previsão de retorno:{" "}
                    <strong
                      className={atrasado ? "text-[#fb7185]" : "text-[#f6f3ff]"}
                    >
                      {formatarDataHoraBR(r.previsaoDevolucao)}
                    </strong>
                  </p>
                )}

                {r.observacao && (
                  <p className="text-xs text-[#b5a4d9]">Obs.: {r.observacao}</p>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-[11px] text-[#b5a4d9]/80">
                    Liberado por: {r.operadorRetirada}
                  </span>

                  <button
                    type="button"
                    onClick={() => abrirModalDevolucao(r)}
                    className="rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold py-2 px-4 text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <ArrowDownLeft className="h-4 w-4" />
                    <span>Registrar Devolução</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* HISTÓRICO COMPLETO COM DATA/HORA DE RETIRADA E DATA/HORA DE DEVOLUÇÃO */
        <div className="space-y-3">
          {listaVisivel.map((r) => (
            <article
              key={r.id}
              className="rounded-2xl bg-[#211738] border border-[#3a2961] p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-[#2a1e47] border border-[#4c357d] text-[#e9d5ff]">
                    {r.codigoIndividual}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAbrirBancoDireto(r.bancoItemId)}
                    className="text-sm font-bold text-[#f6f3ff] hover:text-[#d8b4fe] cursor-pointer"
                  >
                    {r.nomeBanco}
                  </button>
                </div>

                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#7c3aed]/25 border border-[#c084fc]/40 text-[#d8b4fe] font-bold">
                  ⏱ Duração:{" "}
                  {calcularDuracaoUso(r.dataHoraRetirada, r.dataHoraDevolucao)}
                </span>
              </div>

              {/* Linha do tempo Retirada -> Devolução */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl bg-[#140e22] border border-[#3a2961] p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#fbbf24] flex items-center gap-1">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Retirada Registrada
                  </span>
                  <strong className="block font-mono text-sm text-[#f6f3ff]">
                    {formatarDataHoraBR(r.dataHoraRetirada)}
                  </strong>
                  <p className="text-[#b5a4d9]">
                    Resp.:{" "}
                    <strong className="text-white">
                      {r.responsavelRetirada}
                    </strong>
                  </p>
                  <p className="text-[#b5a4d9]">
                    Destino:{" "}
                    <strong className="text-white">{r.destinoUso}</strong>
                  </p>
                </div>

                <div className="rounded-xl bg-[#1a1130] border border-[#4c357d] p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#d8b4fe] flex items-center gap-1">
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                    Devolução Registrada
                  </span>
                  <strong className="block font-mono text-sm text-[#e9d5ff]">
                    {formatarDataHoraBR(r.dataHoraDevolucao)}
                  </strong>
                  <p className="text-[#b5a4d9]">
                    Guardado em:{" "}
                    <strong className="text-white">
                      {r.localArmazenamentoDevolucao || "Base"}
                    </strong>
                  </p>
                  <p className="text-[#b5a4d9]">
                    Condição:{" "}
                    <strong className="text-white">
                      {r.condicaoDevolucao || "OK"}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#b5a4d9]/80">
                <span>
                  Saída: {r.operadorRetirada} · Retorno:{" "}
                  {r.operadorDevolucao || "—"}
                </span>
                {r.observacao && <span>Obs.: {r.observacao}</span>}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* MODAL NOVA RETIRADA COM DATA E HORA */}
      {modalRetiradaAberto && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-[#090510]/80 backdrop-blur-xs p-0 sm:p-4">
          <form
            onSubmit={handleConfirmarRetirada}
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-[#211738] border border-[#3a2961] p-5 space-y-3.5 max-h-[92vh] overflow-y-auto shadow-2xl"
          >
            <div>
              <h3 className="text-base font-bold text-[#f6f3ff]">
                Registrar Retirada de Dispositivo / Produto
              </h3>
              <p className="text-xs text-[#b5a4d9]">
                Guarda quem retirou, para onde foi e a data e hora exatas da
                saída.
              </p>
            </div>

            {erroModalRetirada && (
              <div className="rounded-xl bg-[#381328] border border-[#fb7185]/50 px-3.5 py-2.5 text-xs font-semibold text-[#fecdd3]">
                {erroModalRetirada}
              </div>
            )}

            {/* Seleção do Produto + Bip rápido */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Produto / Modelo
                </label>
                <div className="campo-estoque">
                  <select
                    value={bancoEscolhidoId}
                    onChange={(e) => {
                      const novoId = e.target.value;
                      setBancoEscolhidoId(novoId);
                      const bancoNovo = bancos.find(
                        (b) => String(b.id) === novoId
                      );
                      const disp = bancoNovo?.codigosDisponiveisPreview || [];
                      setItensIdsRetirada(
                        disp.length === 1 ? [disp[0].id] : []
                      );
                      setErroModalRetirada("");
                    }}
                  >
                    {bancos.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.nome} ({b.itensDisponiveisCount} disp.)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Bipar código individual
                </label>
                <div className="flex gap-1.5">
                  <div className="campo-estoque flex-1">
                    <input
                      type="text"
                      value={codigoBipRetirada}
                      onChange={(e) => setCodigoBipRetirada(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && codigoBipRetirada.trim()) {
                          e.preventDefault();
                          biparDentroDoModalRetirada(codigoBipRetirada);
                        }
                      }}
                      placeholder="Bipe e tecle Enter"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => biparDentroDoModalRetirada(codigoBipRetirada)}
                    disabled={!codigoBipRetirada.trim()}
                    className="px-3 rounded-xl bg-[#38285c] hover:bg-[#493478] disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de códigos disponíveis para marcar */}
            <div className="space-y-1.5">
              <span className="block text-xs text-[#b5a4d9]">
                Dispositivos disponíveis na base (
                <strong className="text-[#d8b4fe]">
                  {itensIdsRetirada.length} selecionado(s)
                </strong>
                ):
              </span>
              <div className="rounded-xl bg-[#140e22] border border-[#3a2961] max-h-36 overflow-y-auto divide-y divide-[#3a2961]">
                {disponiveisNoModal.length === 0 ? (
                  <p className="p-3.5 text-xs text-center text-[#b5a4d9]">
                    Nenhum código disponível para retirada neste produto.
                  </p>
                ) : (
                  disponiveisNoModal.map((disp) => {
                    const marcado = itensIdsRetirada.includes(disp.id);
                    return (
                      <button
                        key={disp.id}
                        type="button"
                        onClick={() =>
                          setItensIdsRetirada((prev) =>
                            prev.includes(disp.id)
                              ? prev.filter((x) => x !== disp.id)
                              : [...prev, disp.id]
                          )
                        }
                        className={`w-full px-3.5 py-2 flex items-center justify-between gap-2 text-left text-xs cursor-pointer ${
                          marcado ? "bg-[#2e1c57]" : "hover:bg-[#23183b]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {marcado ? (
                            <CheckSquare className="h-4 w-4 text-[#d8b4fe]" />
                          ) : (
                            <Square className="h-4 w-4 text-[#b5a4d9]" />
                          )}
                          <span className="font-mono font-bold text-[#f6f3ff]">
                            {disp.codigoIndividual}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#b5a4d9] truncate">
                          {disp.localizacao || "Na base"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Responsável Automático (Usuário Logado) e Destino */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Responsável (usuário logado)
                </span>
                <div className="rounded-xl bg-[#2a1b4a] border border-[#c084fc]/60 px-3.5 py-2.5 flex items-center gap-2 text-sm font-bold text-[#f6f3ff]">
                  <User className="h-4 w-4 text-[#d8b4fe] shrink-0" />
                  <span className="truncate">{operadorAtivo}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Onde vai ficar / Destino *
                </label>
                <div className="campo-estoque">
                  <input
                    type="text"
                    required
                    value={destinoUso}
                    onChange={(e) => setDestinoUso(e.target.value)}
                    placeholder="Ex.: Expedição · Doca 02"
                  />
                </div>
              </div>
            </div>

            {/* Data e Hora Exatas da Retirada + Previsão */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] uppercase tracking-wider text-[#b5a4d9]">
                    Data e Hora da Retirada *
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDataHoraRetirada(obterDataHoraLocalInput())
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
                    value={dataHoraRetirada}
                    onChange={(e) => setDataHoraRetirada(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Previsão de Devolução (opcional)
                </label>
                <div className="campo-estoque">
                  <input
                    type="datetime-local"
                    value={previsaoDevolucao}
                    onChange={(e) => setPrevisaoDevolucao(e.target.value)}
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
                  value={obsRetirada}
                  onChange={(e) => setObsRetirada(e.target.value)}
                  placeholder="Ex.: Turno da tarde / Ordem de serviço #204"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setModalRetiradaAberto(false)}
                className="rounded-xl bg-[#38285c] hover:bg-[#493478] text-white py-3 text-sm font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white py-3 text-sm font-bold cursor-pointer"
              >
                Registrar Retirada
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DEVOLUÇÃO COM DATA E HORA */}
      {retiradaParaDevolver && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-[#090510]/80 backdrop-blur-xs p-0 sm:p-4">
          <form
            onSubmit={handleConfirmarDevolucao}
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-[#211738] border border-[#3a2961] p-5 space-y-3.5 shadow-2xl"
          >
            <div>
              <h3 className="text-base font-bold text-[#f6f3ff]">
                Registrar Devolução de Dispositivo
              </h3>
              <p className="text-xs text-[#b5a4d9]">
                {retiradaParaDevolver.nomeBanco} · Código{" "}
                <strong className="font-mono text-[#e9d5ff]">
                  {retiradaParaDevolver.codigoIndividual}
                </strong>
              </p>
            </div>

            <div className="rounded-xl bg-[#140e22] border border-[#3a2961] p-3 text-xs space-y-1">
              <p className="text-[#b5a4d9]">
                Estava em:{" "}
                <strong className="text-white">
                  {retiradaParaDevolver.destinoUso}
                </strong>{" "}
                ({retiradaParaDevolver.responsavelRetirada})
              </p>
              <p className="text-[#b5a4d9]">
                Retirado em:{" "}
                <strong className="font-mono text-[#fbbf24]">
                  {formatarDataHoraBR(retiradaParaDevolver.dataHoraRetirada)}
                </strong>
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] uppercase tracking-wider text-[#b5a4d9]">
                  Data e Hora da Devolução *
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setDataHoraDevolucao(obterDataHoraLocalInput())
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
                  value={dataHoraDevolucao}
                  onChange={(e) => setDataHoraDevolucao(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#b5a4d9] mb-1">
                  Onde foi guardado na base
                </label>
                <div className="campo-estoque">
                  <input
                    type="text"
                    value={localDevolucao}
                    onChange={(e) => setLocalDevolucao(e.target.value)}
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
                    value={condicaoDevolucao}
                    onChange={(e) => setCondicaoDevolucao(e.target.value)}
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
                  value={obsDevolucao}
                  onChange={(e) => setObsDevolucao(e.target.value)}
                  placeholder="Ex.: Entregue com cabo e carregador"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRetiradaParaDevolver(null)}
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
    </div>
  );
}
