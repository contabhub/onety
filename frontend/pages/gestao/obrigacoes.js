import React, { useEffect, useState } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import NovaObrigacaoModal from "../../components/gestao/NovaObrigacaoModal";
import LocalTabs from "../../components/gestao/LocalTabs";
import BatchActionsFilters from "../../components/gestao/BatchActionsFilters";
import ProrrogarTarefasFilters from "../../components/gestao/ProrrogarTarefasFilters";
import styles from "../../styles/gestao/ObrigacoesPage.module.css";
import { hasPermissao, getPermissoes } from "../../utils/gestao/permissoes";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FaSearch, FaUpload } from "react-icons/fa";
import Select from "react-select";

// Base da API
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

// Helpers para token e empresa
const getToken = () => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
};

const getEmpresaId = () => {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("userData");
    if (raw) {
      const u = JSON.parse(raw);
      return (
        u?.EmpresaId || u?.empresaId || u?.empresa_id || u?.companyId || u?.company_id || ""
      );
    }
  } catch {}
  return sessionStorage.getItem("empresaId") || "";
};

export default function ObrigacoesPage() {
  const [obrigacoes, setObrigacoes] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarModalProrrogar, setMostrarModalProrrogar] = useState(false);
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState("");
  const [departamentoSelecionado, setDepartamentoSelecionado] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState("listagem");
  const [loading, setLoading] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [mostrarModalConfirmacao, setMostrarModalConfirmacao] = useState(false);
  const [idsParaExcluir, setIdsParaExcluir] = useState([]);
  const [isLight, setIsLight] = useState(false);
  const [mostrarModalImportar, setMostrarModalImportar] = useState(false);
  const [arquivoImportacao, setArquivoImportacao] = useState(null);
  const [importando, setImportando] = useState(false);

  // Evitar hydration mismatch: calcular permissões apenas no cliente
  const [isMounted, setIsMounted] = useState(false);
  const [canExcluir, setCanExcluir] = useState(false);
  const [canCriar, setCanCriar] = useState(false);
  const [isSuper, setIsSuper] = useState(false);

  // Função para verificar se é superadmin
  const isSuperadmin = () => {
    const permissoes = getPermissoes();
    return permissoes.adm && Array.isArray(permissoes.adm) && permissoes.adm.includes("superadmin");
  };

  // Tabs para obrigações (determinísticas no SSR; adiciona aba condicional após mount)
  const obrigacoesTabs = [
    { name: "Listagem", id: "listagem" },
    ...(isMounted && canExcluir ? [{ name: "Ações em Lote", id: "acoes" }] : []),
    { name: "Prorrogar Tarefas", id: "prorrogar" }
  ];

  const handleTabChange = (tabId) => {
    setAbaAtiva(tabId);
    setResultadosBusca([]);
    setSelectedIds([]);
  };

  // Gerar lista única de departamentos a partir das obrigações carregadas
  const departamentosUnicos = Array.from(new Set(obrigacoes.map(ob => ob.departamentoNome))).filter(Boolean);
  const departamentosOptions = departamentosUnicos.map(dep => ({ value: dep, label: dep }));

  // Filtra obrigações pelo nome e departamento (multi)
  const obrigacoesFiltradas = obrigacoes.filter((ob) =>
    ob.nome.toLowerCase().includes(filtro.toLowerCase()) &&
    (departamentoSelecionado.length === 0 || departamentoSelecionado.includes(ob.departamentoNome))
  );

  // Paginação
  const totalPaginas = Math.max(1, Math.ceil(obrigacoesFiltradas.length / itensPorPagina));
  const paginaInicio = Math.max(1, pagina - 2);
  const paginaFim = Math.min(totalPaginas, paginaInicio + 4);
  const obrigacoesPaginadas = obrigacoesFiltradas.slice(
    (pagina - 1) * itensPorPagina,
    pagina * itensPorPagina
  );

  useEffect(() => {
    buscarObrigacoes();
  }, []);

  // Calcular permissões no cliente após montar
  useEffect(() => {
    setIsMounted(true);
    setCanExcluir(hasPermissao("obrigacoes", "excluir"));
    setCanCriar(hasPermissao("obrigacoes", "criar"));
    setIsSuper(isSuperadmin());
  }, []);

  // Detectar tema atual e reagir a mudanças
  useEffect(() => {
    if (typeof document === "undefined") return;
    const getTheme = () => document.documentElement.getAttribute("data-theme") === "light";
    setIsLight(getTheme());
    const handleChange = (e) => {
      const detail = (e && e.detail) || {};
      if (detail && (detail.theme === "light" || detail.theme === "dark")) {
        setIsLight(detail.theme === "light");
      } else {
        setIsLight(getTheme());
      }
    };
    window.addEventListener("titan-theme-change", handleChange);
    return () => window.removeEventListener("titan-theme-change", handleChange);
  }, []);

  const buscarObrigacoes = async () => {
    try {
      const empresaId = getEmpresaId();
      if (!empresaId) {
        console.error("Empresa não encontrada. A empresaId não está no sessionStorage.");
        return;
      }
      const token = getToken();
      const res = await fetch(`${BASE_URL}/gestao/obrigacoes/empresa/${empresaId}` , {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const normalize = (o) => ({
        ...o,
        acaoQtdDias: o.acaoQtdDias ?? o.acao_qtd_dias ?? null,
        metaQtdDias: o.metaQtdDias ?? o.meta_qtd_dias ?? null,
        vencimentoDia: o.vencimentoDia ?? o.vencimento_dia ?? null,
        fatoGerador: o.fatoGerador ?? o.fato_gerador ?? null,
      });
      const list = Array.isArray(data) ? data.map(normalize) : [];
      setObrigacoes(list);
    } catch (error) {
      console.error("Erro ao buscar obrigações:", error);
    }
  };

  // Ao mudar quantidade de itens por página, volte para página 1
  useEffect(() => {
    setPagina(1);
  }, [itensPorPagina, filtro]);

  const handleBuscaAvancada = async (filters) => {
    setLoading(true);
    try {
      const token = getToken();
      const empresaId = getEmpresaId();
      
      // Construir query params
      const params = new URLSearchParams();
      params.append("empresaId", empresaId || "");
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "") {
          params.append(key, String(value));
        }
      });

      console.log("🔍 Busca Avançada - Parâmetros:", {
        empresaId,
        filters,
        queryString: params.toString()
      });

      const res = await fetch(`${BASE_URL}/gestao/obrigacoes/buscar-avancada?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      console.log("📊 Resultados da busca:", data);
      
      setResultadosBusca(data || []);
      setSelectedIds([]);
    } catch (error) {
      console.error("❌ Erro na busca avançada:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirEmLote = async (ids) => {
    // Mostrar modal de confirmação primeiro
    setIdsParaExcluir(ids);
    setMostrarModalConfirmacao(true);
  };

  const handleUpdateResponsavelExclusivo = async (ids, novoResponsavelId) => {
    try {
      const token = getToken();
      let response;
      
      if (resultadosBusca[0]?.assunto) {
        // Atualização em lote de tarefas
        response = await fetch(`${BASE_URL}/gestao/tarefas/atualizar-responsavel-em-lote`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ids, responsavelId: novoResponsavelId })
        });
      } else {
        // Atualização em lote de obrigações_clientes
        response = await fetch(`${BASE_URL}/gestao/obrigacoes/atualizar-responsavel-em-lote`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ids, responsavelId: novoResponsavelId })
        });
      }
      
      // Recarregar dados
      await buscarObrigacoes();
      setResultadosBusca([]);
      setSelectedIds([]);
      const data = await response.json().catch(() => ({}));
      toast.success(data.message || "Responsável exclusivo atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar responsável exclusivo:", error);
      toast.error("Erro ao atualizar responsável exclusivo. Tente novamente.");
    }
  };

  const confirmarExclusao = async () => {
    try {
      const token = getToken();
      let response;
      if (resultadosBusca[0]?.assunto) {
        // Exclusão em lote de tarefas
        response = await fetch(`${BASE_URL}/gestao/tarefas/excluir-em-lote`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ids: idsParaExcluir })
        });
      } else {
        // Exclusão em lote de obrigações
        response = await fetch(`${BASE_URL}/gestao/obrigacoes/excluir-em-lote`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ids: idsParaExcluir })
        });
      }
      // Recarregar dados
      await buscarObrigacoes();
      setResultadosBusca([]);
      setSelectedIds([]);
      const data = await response.json().catch(() => ({}));
      toast.success(data.message || "Itens excluídos com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir em lote:", error);
      toast.error("Erro ao excluir itens. Tente novamente.");
    } finally {
      setMostrarModalConfirmacao(false);
      setIdsParaExcluir([]);
    }
  };

  const cancelarExclusao = () => {
    setMostrarModalConfirmacao(false);
    setIdsParaExcluir([]);
  };

  const handleProrrogarTarefas = async (filtros) => {
    try {
      const token = getToken();
      const empresaId = getEmpresaId();
      
      if (!empresaId) {
        toast.error("Empresa não encontrada");
        return;
      }

      if (selectedIds.length === 0) {
        toast.error("Por favor, selecione pelo menos uma tarefa para prorrogar.");
        return;
      }

      console.log("🔍 [Prorrogar] Aplicando filtros:", filtros);
      console.log("🔍 [Prorrogar] IDs selecionados:", selectedIds);
      
      const response = await fetch(`${BASE_URL}/gestao/obrigacoes/prorrogar-tarefas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          empresaId,
          obrigacaoId: filtros.obrigacaoId,
          alterarAcao: filtros.alterarAcao,
          alterarMeta: filtros.alterarMeta,
          alterarVencimento: filtros.alterarVencimento,
          novaAcao: filtros.novaAcao,
          novaMeta: filtros.novaMeta,
          novoVencimento: filtros.novoVencimento,
          motivo: filtros.motivo,
          idsSelecionados: selectedIds
        })
      });
      
      const data = await response.json().catch(() => ({}));
      toast.success(data.message || "Tarefas prorrogadas com sucesso!");
      
      // Recarregar dados
      if (abaAtiva === "prorrogar") {
        await handleBuscarObrigacoes(filtros);
      } else if (abaAtiva === "listagem") {
        await buscarObrigacoes();
      }
      
      setSelectedIds([]);
    } catch (error) {
      console.error("❌ Erro ao prorrogar tarefas:", error);
      toast.error("Erro ao prorrogar tarefas. Tente novamente.");
    }
  };

  const handleBuscarObrigacoes = async (filtros) => {
    setBuscando(true);
    try {
      const token = getToken();
      const empresaId = getEmpresaId();
      
      if (!empresaId) {
        toast.error("Empresa não encontrada");
        return;
      }

      console.log("🔍 [Buscar] Aplicando filtros:", filtros);
      
      const response = await fetch(`${BASE_URL}/gestao/obrigacoes/buscar-por-filtros`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ empresaId, ...filtros })
      });
      const data = await response.json().catch(() => ([]));
      
      setResultadosBusca(data || []);
      setSelectedIds([]);
      toast.success(`${(data?.length || 0)} obrigação(ões) encontrada(s)`);
    } catch (error) {
      console.error("❌ Erro ao buscar obrigações:", error);
      toast.error("Erro ao buscar obrigações. Tente novamente.");
      setResultadosBusca([]);
    } finally {
      setBuscando(false);
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(resultadosBusca.map(item => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectItem = (id, checked) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(itemId => itemId !== id));
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      // Verificar se é um arquivo Excel
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv' // .csv
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast.error("Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV.");
        return;
      }
      
      setArquivoImportacao(file);
    }
  };

  const handleImportarPlanilha = async () => {
    if (!arquivoImportacao) {
      toast.error("Por favor, selecione um arquivo para importar.");
      return;
    }

    setImportando(true);
    try {
      const token = getToken();
      const empresaId = getEmpresaId();
      
      if (!empresaId) {
        toast.error("Empresa não encontrada.");
        return;
      }

      const formData = new FormData();
      formData.append('file', arquivoImportacao);
      formData.append('empresaId', empresaId);

      const response = await fetch(`${BASE_URL}/gestao/obrigacoes/importar-planilha`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await response.json().catch(() => ({}));

      toast.success(data.message || "Obrigações importadas com sucesso!");
      
      // Recarregar as obrigações
      await buscarObrigacoes();
      
      // Fechar modal e limpar arquivo
      setMostrarModalImportar(false);
      setArquivoImportacao(null);
      
    } catch (error) {
      console.error("Erro ao importar planilha:", error);
      toast.error("Erro ao importar planilha. Tente novamente.");
    } finally {
      setImportando(false);
    }
  };

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.container}>
        {/* Tabs de navegação */}
        <LocalTabs 
          active={abaAtiva} 
          tabs={obrigacoesTabs}
          onTabChange={handleTabChange}
        />

        {abaAtiva === "listagem" ? (
          <>
            <div className={styles.header}>
              <div className={styles.headerActions}>
                {canCriar && (
                  <button
                    onClick={() => setMostrarModal(true)}
                    className={styles.buttonNova}
                  >
                    + Nova
                  </button>
                )}
                {isSuper && (
                  <button
                    onClick={() => setMostrarModalImportar(true)}
                    className={`${styles.buttonImportar} ${styles.buttonPrimary}`}
                  >
                    <FaUpload size={14} />
                    Importar Planilha
                  </button>
                )}
              </div>
            </div>



            <div className={styles.searchWrapper}>
              <div className={styles.searchBarLeft}>
                <FaSearch className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Buscar por Nome"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className={styles.filterInput}
                />
              </div>
              <div className={styles.departmentSelectWrap}>
                <Select
                  isMulti
                  options={departamentosOptions}
                  value={departamentoSelecionado.map(dep => ({ value: dep, label: dep }))}
                  onChange={selected => setDepartamentoSelecionado(selected.map(opt => opt.value))}
                  placeholder="Filtrar por departamento(s)"
                  className="react-select-container"
                  classNamePrefix="react-select"
                  menuPlacement="auto"
                />
              </div>
            </div>

            <div className={styles.scrollWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>#</th>
                    <th className={styles.th}>Nome</th>
                    <th className={styles.th}>Departamento</th>
                    <th className={styles.th}>Frequência</th>
                    <th className={styles.th}>Ação (qtd dias)</th>
                    <th className={styles.th}>Meta (qtd dias)</th>
                    <th className={styles.th}>Dia Vencimento</th>
                    <th className={styles.th}>Fato Gerador</th>
                    <th className={styles.th}>Órgão</th>
                    <th className={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {obrigacoesPaginadas.map((ob, idx) => (
                    <tr
                      key={ob.id}
                      className={`${idx % 2 === 0 ? '' : styles.tableRowAlt} ${styles.clickableRow}`}
                    >
                      <td className={styles.td}>{(pagina - 1) * itensPorPagina + idx + 1}</td>
                      <td className={styles.td}>
                        <span
                          className={styles.linkSpan}
                          onClick={() => window.open(`/gestao/obrigacoes/${ob.id}`, '_blank')}
                        >
                          {ob.nome}
                        </span>
                      </td>

                      <td className={styles.td}>{ob.departamentoNome}</td>

                      <td className={styles.td}>{ob.frequencia}</td>
                      <td className={styles.td}>{ob.acaoQtdDias}</td>
                      <td className={styles.td}>{ob.metaQtdDias}</td>
                      <td className={styles.td}>{ob.vencimentoDia}</td>
                      <td className={styles.td}>{ob.fatoGerador}</td>
                      <td className={styles.td}>{ob.orgao}</td>
                      <td className={styles.td}>Ativo</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* PAGINAÇÃO COM SETAS */}
              <div className={styles.pagination}>
                <span>
                  Mostrando {(pagina - 1) * itensPorPagina + 1}
                  {" - "}
                  {Math.min(pagina * itensPorPagina, obrigacoesFiltradas.length)} de {obrigacoesFiltradas.length}
                </span>
                <div className={styles.paginationButtons}>
                  <select
                    value={itensPorPagina}
                    onChange={(e) => setItensPorPagina(Number(e.target.value))}
                    className={styles.paginationSelect}
                    style={{ marginRight: 16 }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <button
                    className={styles.paginationArrow}
                    onClick={() => setPagina(1)}
                    disabled={pagina === 1}
                    aria-label="Primeira página"
                  >
                    {"<<"}
                  </button>
                  <button
                    className={styles.paginationArrow}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={pagina === 1}
                    aria-label="Página anterior"
                  >
                    {"<"}
                  </button>
                  {Array.from({ length: paginaFim - paginaInicio + 1 }, (_, i) => paginaInicio + i).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPagina(p)}
                      className={p === pagina ? styles.paginationButtonActive : styles.paginationArrow}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    className={styles.paginationArrow}
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    disabled={pagina === totalPaginas}
                    aria-label="Próxima página"
                  >
                    {">"}
                  </button>
                  <button
                    className={styles.paginationArrow}
                    onClick={() => setPagina(totalPaginas)}
                    disabled={pagina === totalPaginas}
                    aria-label="Última página"
                  >
                    {">>"}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : abaAtiva === "prorrogar" ? (
          <>
            <div className={styles.header}>
              <h2 className={styles.sectionTitle}>
                Prorrogar Tarefas
              </h2>
            </div>

            <ProrrogarTarefasFilters
              onProrrogar={handleProrrogarTarefas}
              onBuscar={handleBuscarObrigacoes}
              loading={loading}
              buscando={buscando}
            />

            {/* Resultados da Busca */}
            {resultadosBusca.length > 0 && (
              <div className={styles.resultsCard}>
                <div className={styles.resultsHeader}>
                  <h3 className={styles.resultsTitle}>
                    Resultados da Busca ({resultadosBusca.length} obrigação(ões))
                  </h3>
                </div>

                <div className={styles.scrollWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={`${styles.th} ${styles.thCheckbox}`}>
                          <input
                            type="checkbox"
                            checked={selectedIds.length === resultadosBusca.length}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className={styles.checkbox}
                          />
                        </th>
                        <th className={styles.th}>#</th>
                        <th className={styles.th}>Departamento</th>
                        <th className={styles.th}>Status</th>
                        <th className={styles.th}>Ação</th>
                        <th className={styles.th}>Meta</th>
                        <th className={styles.th}>Venc</th>
                        <th className={styles.th}>Obrigação</th>
                        <th className={styles.th}>Competência</th>
                        <th className={styles.th}>Cliente</th>
                        <th className={styles.th}>Conclusão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadosBusca.map((ob, idx) => (
                        <tr
                          key={ob.id}
                          className={idx % 2 === 0 ? undefined : styles.tableRowAlt}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className={styles.td}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(ob.id)}
                              onChange={(e) => handleSelectItem(ob.id, e.target.checked)}
                              style={{ margin: 0 }}
                            />
                          </td>
                          <td className={styles.td}>{idx + 1}</td>
                          <td className={styles.td}>{ob.departamentoNome || ob.departamento}</td>
                          <td className={styles.td}>
                            <span className={`${styles.statusBadge} ${ob.status === 'concluida' ? styles.statusSuccess : ob.status === 'cancelada' ? styles.statusDanger : styles.statusWarning}`}>
                              {ob.status === "concluida" ? "Concluída" : 
                               ob.status === "cancelada" ? "Cancelada" : 
                               ob.status === "pendente" ? "Pendente" : 
                               ob.status || "Pendente"}
                            </span>
                          </td>
                          <td className={styles.td}>
                            {ob.acao ? new Date(ob.acao).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className={styles.td}>
                            {ob.meta ? new Date(ob.meta).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className={styles.td}>
                            {ob.vencimento ? new Date(ob.vencimento).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className={styles.td}>
                            <span
                              className={styles.linkSpan}
                              onClick={() => window.open(`/dashboard/obrigacoes/${ob.id}/atividades`, '_blank')}
                            >
                              {ob.nome || ob.assunto}
                            </span>
                          </td>
                          <td className={styles.td}>
                            {ob.mes_referencia && ob.ano_referencia ? 
                              (() => {
                                const meses = [
                                  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
                                  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"
                                ];
                                const mesIndex = ob.mes_referencia - 1;
                                return `${meses[mesIndex]}/${ob.ano_referencia}`;
                              })() : 
                              (ob.competencia || '-')
                            }
                          </td>
                          <td className={styles.td}>
                            {ob.clienteNome ? (
                              <div>
                                <div className={styles.clientName}>
                                  {ob.clienteNome}
                                </div>
                                <div className={styles.clientSub}>
                                  {ob.clienteId || ob.clienteDocumento}
                                </div>
                              </div>
                            ) : (
                              "N/A"
                            )}
                          </td>
                          <td className={styles.td}>
                            {ob.status === "concluida" && ob.dataBaixa ? 
                              new Date(ob.dataBaixa).toLocaleDateString('pt-BR') : 
                              ''
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className={styles.header}>
              <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "600", color: "#1e293b" }}>
              </h2>
            </div>

            <BatchActionsFilters
              onSearch={handleBuscaAvancada}
              onDelete={handleExcluirEmLote}
              onUpdateResponsavelExclusivo={handleUpdateResponsavelExclusivo}
              loading={loading}
              selectedIds={selectedIds}
            />

            {loading && (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}>
                  <div className={styles.loadingSpinnerIcon} />
                  <span className={styles.loadingText}>Carregando resultados...</span>
                </div>
              </div>
            )}

            {!loading && resultadosBusca.length > 0 && (
              <div className={styles.scrollWrapper}>
                <div className={styles.searchResultsHeader}>
                  <div className={styles.searchResultsCount}>
                    <strong>{resultadosBusca.length}</strong> resultado(s) encontrado(s)
                  </div>
                  <div className={styles.selectAllContainer}>
                    <label className={styles.selectAllLabel}>
                      <input
                        type="checkbox"
                        checked={selectedIds.length === resultadosBusca.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className={styles.selectAllCheckbox}
                      />
                      Selecionar Todos
                    </label>
                  </div>
                </div>

                {/* Tabela dinâmica conforme tipoTarefa */}
                {resultadosBusca[0]?.assunto ? (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={`${styles.th} ${styles.thCheckbox}`}></th>
                        <th className={styles.th}>#</th>
                        <th className={styles.th}>ID</th>
                        <th className={styles.th}>Assunto</th>
                        <th className={styles.th}>Cliente</th>
                        <th className={styles.th}>Departamento</th>
                        <th className={styles.th}>Status</th>
                        <th className={styles.th}>Datas</th>
                        <th className={styles.th}>Responsável</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadosBusca.map((ob, idx) => (
                        <tr
                          key={ob.id}
                          className={idx % 2 === 0 ? undefined : styles.tableRowAlt}
                        >
                          <td className={styles.td}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(ob.id)}
                              onChange={(e) => handleSelectItem(ob.id, e.target.checked)}
                            />
                          </td>
                          <td className={styles.td}>{idx + 1}</td>
                          <td className={styles.td}>{ob.id}</td>
                          <td className={styles.td}>
                            <span
                              className={styles.linkSpan}
                              onClick={() => window.open(`/tarefas/${ob.id}/atividades`, '_blank')}
                            >
                              {ob.assunto}
                            </span>
                          </td>
                          <td className={styles.td}>{ob.cliente_nome || ob.clienteNome || '-'}</td>
                          <td className={styles.td}>{ob.departamento || ob.departamentoNome || '-'}</td>
                          <td className={styles.td}>{ob.status ? ob.status.charAt(0).toUpperCase() + ob.status.slice(1) : '-'}</td>
                          <td className={styles.td}>
                            <div>
                              <div><span className={styles.dateLabel}>A:</span> {ob.dataAcao ? new Date(ob.dataAcao).toLocaleDateString() : '-'}</div>
                              <div><span className={styles.dateLabel}>M:</span> {ob.dataMeta ? new Date(ob.dataMeta).toLocaleDateString() : '-'}</div>
                              <div><span className={styles.dateLabel}>P:</span> {ob.dataPrazo ? new Date(ob.dataPrazo).toLocaleDateString() : '-'}</div>
                            </div>
                          </td>
                          <td className={styles.td}>{ob.responsavelNome || ob.responsavel || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={`${styles.th} ${styles.thCheckbox}`}></th>
                        <th className={styles.th}>#</th>
                        <th className={styles.th}>Cliente</th>
                        <th className={styles.th}>Departamento</th>
                        <th className={styles.th}>Nome da Obrigação</th>
                        <th className={styles.th}>Frequência</th>
                        <th className={styles.th}>Data da Ação</th>
                        <th className={styles.th}>Data da Meta</th>
                        <th className={styles.th}>Data do Prazo</th>
                        <th className={styles.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadosBusca.map((ob, idx) => (
                        <tr
                          key={ob.id}
                          className={idx % 2 === 0 ? undefined : styles.tableRowAlt}
                        >
                          <td className={styles.td}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(ob.id)}
                              onChange={(e) => handleSelectItem(ob.id, e.target.checked)}
                            />
                          </td>
                          <td className={styles.td}>{idx + 1}</td>
                          <td className={styles.td}>
                            <div>
                              <div className={styles.clientName}>{ob.clienteNome}</div>
                              <div className={styles.clientDoc}>
                                {ob.clienteCnpj ? ob.clienteCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : ""}
                              </div>
                            </div>
                          </td>
                          <td className={styles.td}>{ob.departamentoNome}</td>
                          <td className={styles.td}>
                            <span
                              className={styles.linkSpan}
                              onClick={() => window.open(`/dashboard/obrigacoes/${ob.id}/atividades`, '_blank')}
                            >
                              {ob.obrigacaoNome || ob.nome}
                            </span>
                          </td>
                          <td className={styles.td}>{ob.frequencia}</td>
                          <td className={styles.td}>
                            {ob.acao ? new Date(ob.acao).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className={styles.td}>
                            {ob.meta ? new Date(ob.meta).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className={styles.td}>
                            {ob.vencimento ? new Date(ob.vencimento).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className={styles.td}>
                            {ob.status ? ob.status.charAt(0).toUpperCase() + ob.status.slice(1) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {!loading && resultadosBusca.length === 0 && (
              <div className={styles.noResultsContainer}>
                Nenhum resultado encontrado. Use os filtros acima para buscar obrigações.
              </div>
            )}
          </>
        )}

        {mostrarModal && (
          <NovaObrigacaoModal
            onClose={() => {
              setMostrarModal(false);
              buscarObrigacoes();
            }}
          />
        )}

        {/* Modal de Prorrogação de Tarefas */}
        {mostrarModalProrrogar && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} ${styles.modalContentLg}`}>
              {/* Header */}
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>Prorrogar Tarefas</h2>
                <button
                  onClick={() => setMostrarModalProrrogar(false)}
                  className={styles.modalCloseButton}
                >
                  ×
                </button>
              </div>

              {/* Filtros */}
              <div className={styles.modalBodyPadded}>
                <div className={styles.grid3}>
                  {/* Tipo de Tarefa */}
                  <div>
                    <label className={styles.formLabelSmall}>
                      Por Tipo Tarefa:
                    </label>
                    <select 
                      className={styles.modalSelect}
                      defaultValue="obrigacoes"
                    >
                      <option value="obrigacoes">Obrigações</option>
                    </select>
                  </div>

                  {/* Departamento */}
                  <div>
                    <label className={styles.formLabelSmall}>
                      Por Departamento:
                    </label>
                    <input
                      type="text"
                      className={styles.modalInput}
                      placeholder="Todos + tarefas das quais estou envolvido"
                      defaultValue="Todos + tarefas das quais estou envolvido"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className={styles.formLabelSmall}>
                      Por Status:
                    </label>
                    <select 
                      className={styles.modalSelect}
                      defaultValue="aberto"
                    >
                      <option value="aberto">Aberto</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="concluido">Concluído</option>
                    </select>
                  </div>
                </div>

                <div className={styles.grid2}>
                  {/* Obrigações */}
                  <div>
                    <label className={styles.formLabelSmall}>
                      Por Obrigações: *
                    </label>
                    <select 
                      className={styles.modalSelect}
                      defaultValue=""
                    >
                      <option value="">Selecione...</option>
                      <option value="todas">Todas</option>
                      <option value="especificas">Específicas</option>
                    </select>
                  </div>

                  {/* Cliente */}
                  <div>
                    <label className={styles.formLabelSmall}>
                      Por Cliente:
                    </label>
                    <div className={styles.inlineGroup}>
                      <input
                        type="text"
                        className={styles.modalInput}
                        placeholder="Digite e aperte enter para pesquisar..."
                        data-flex="1"
                      />
                      <button className={`${styles.modalButton} ${styles.modalButtonIcon}`}>
                        <FaSearch size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.grid3}>
                  {/* Competência */}
                  <div>
                    <label className={styles.formLabelSmall}>
                      Por Competência: *
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        type="text"
                        className={styles.modalInput}
                        value="agosto de 2025"
                        readOnly
                      />
                      <button 
                        className={`${styles.modalButton} ${styles.modalButtonIcon} ${styles.inputIconRight}`}
                      >
                        📅
                      </button>
                    </div>
                  </div>

                  {/* Competência Final */}
                  <div>
                    <label className={styles.formLabelSmall}>
                      Por Competência Final:
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        type="text"
                        className={styles.modalInput}
                        value="agosto de 2025"
                        readOnly
                      />
                      <button 
                        className={`${styles.modalButton} ${styles.modalButtonIcon} ${styles.inputIconRight}`}
                      >
                        📅
                      </button>
                    </div>
                    <div className={styles.textRight}>
                      <button className={styles.modalLink}>
                        <span className={styles.closeGlyph}>×</span>
                        limpar
                      </button>
                    </div>
                  </div>

                  {/* Dias para Prorrogar */}
                  <div>
                    <label className={styles.formLabelSmall}>
                      Dias para Prorrogar: *
                    </label>
                    <input
                      type="number"
                      className={styles.modalInput}
                      placeholder="0"
                      min="1"
                      defaultValue="30"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className={styles.modalFooter}>
                <button
                  onClick={() => setMostrarModalProrrogar(false)}
                  className={`${styles.modalButton} ${styles.modalButtonCancel}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleProrrogarTarefas({})}
                  className={`${styles.modalButton} ${styles.modalButtonConfirm}`}
                  style={{ 
                    backgroundColor: "var(--titan-success)",
                    borderColor: "var(--titan-success)"
                  }}
                >
                  <span style={{ marginRight: "var(--titan-spacing-xs)" }}>⏰</span>
                  Prorrogar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Exclusão */}
        {mostrarModalConfirmacao && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              {/* Header */}
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>
                  {resultadosBusca[0]?.assunto ? "Excluindo Tarefas" : "Excluindo Obrigações"}
                </h2>
                <button
                  onClick={cancelarExclusao}
                  className={styles.modalCloseButton}
                >
                  ×
                </button>
              </div>

              {/* Warning Message */}
              <div className={`${styles.modalWarning} ${resultadosBusca[0]?.assunto ? styles.modalWarningTarefa : ''}`}>
                {resultadosBusca[0]?.assunto ? (
                  <p className={styles.modalWarningText}>
                    ⚠️ Ao excluir uma tarefa principal, <b>todas as subtarefas vinculadas</b> também serão excluídas automaticamente.<br /><br />
                    Além disso, serão removidos:
                    <ul>
                      <li>Atividades e andamentos da tarefa e subtarefas</li>
                      <li>Anexos, arquivos e histórico de monitoramento</li>
                      <li>Notificações e registros de e-mail/WhatsApp</li>
                      <li>Todo o vínculo com processos e subprocessos</li>
                    </ul>
                    <b>Esta ação não pode ser desfeita.</b>
                  </p>
                ) : (
                  <p className={styles.modalWarningText}>
                    ⚠️ A exclusão de obrigações não pode ser revertida, realmente deseja continuar?
                  </p>
                )}
              </div>

              {/* Consequences */}
              <div className={styles.sectionBlock}>
                <h3 className={styles.sectionSubtitle}>
                  Essa ação fará com que você perca:
                </h3>
                <ul className={styles.ul}
                >
                  {resultadosBusca[0]?.assunto ? (
                    <>
                      <li>Subtarefas vinculadas à tarefa principal</li>
                      <li>Todos os registros e andamentos das tarefas</li>
                      <li>Arquivos anexados, e-mails enviados e histórico de notificações</li>
                    </>
                  ) : (
                    <>
                      <li>Registros e andamentos feitos por usuários;</li>
                      <li>O status da obrigação, se estava concluída ou aberta, se estava em dia ou atrasada;</li>
                      <li>Arquivos anexados, emails enviados e o histórico de monitoramento, como leitura do email e anexos, etc.</li>
                    </>
                  )}
                </ul>
              </div>

              {/* Action Buttons */}
              <div className={styles.modalFooter}>
                <button
                  onClick={cancelarExclusao}
                  className={`${styles.modalButton} ${styles.modalButtonCancel}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarExclusao}
                  className={`${styles.modalButton} ${styles.modalButtonConfirm}`}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Importação de Planilha */}
        {mostrarModalImportar && (
          <div className={styles.modalOverlay} style={{ background: isLight ? "rgba(0,0,0,0.35)" : undefined, zIndex: 2000 }}>
            <div className={styles.modalContent} style={{ background: isLight ? "rgba(255,255,255,0.98)" : undefined, border: isLight ? "1px solid rgba(0,0,0,0.08)" : undefined }}>
              {/* Header */}
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>Importar Obrigações via Planilha</h2>
                <button
                  onClick={() => {
                    setMostrarModalImportar(false);
                    setArquivoImportacao(null);
                  }}
                  className={styles.modalCloseButton}
                >
                  ×
                </button>
              </div>

              {/* Content */}
              <div style={{ padding: "var(--titan-spacing-lg)" }}>
                <div style={{ marginBottom: "var(--titan-spacing-lg)" }}>
                  <p style={{
                    margin: "0 0 var(--titan-spacing-md) 0",
                    fontSize: "var(--titan-font-size-base)",
                    color: "var(--titan-text-med)",
                    lineHeight: "var(--titan-line-height-relaxed)"
                  }}>
                    Selecione um arquivo Excel (.xlsx, .xls) ou CSV contendo as obrigações para importar.
                  </p>
                  
                  <div style={{
                    padding: "var(--titan-spacing-md)",
                    background: "var(--titan-base-05)",
                    borderRadius: "var(--titan-radius-sm)",
                    border: "1px solid var(--titan-stroke)",
                    marginBottom: "var(--titan-spacing-md)"
                  }}>
                    <h4 style={{
                      margin: "0 0 var(--titan-spacing-sm) 0",
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-semibold)",
                      color: "var(--titan-text-high)"
                    }}>
                      📋 Formato esperado da planilha:
                    </h4>
                    <ul style={{
                      margin: 0,
                      paddingLeft: "20px",
                      fontSize: "var(--titan-font-size-sm)",
                      color: "var(--titan-text-med)",
                      lineHeight: "var(--titan-line-height-relaxed)"
                    }}>
                      <li>Nome da obrigação</li>
                      <li>Departamento</li>
                      <li>Frequência (mensal, trimestral, etc.)</li>
                      <li>Quantidade de dias para ação</li>
                      <li>Quantidade de dias para meta</li>
                      <li>Dia do vencimento</li>
                      <li>Fato gerador</li>
                      <li>Órgão responsável</li>
                    </ul>
                  </div>
                </div>

                <div style={{ marginBottom: "var(--titan-spacing-lg)" }}>
                  <label style={{
                    display: "block",
                    marginBottom: "var(--titan-spacing-xs)",
                    fontSize: "var(--titan-font-size-sm)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    color: "var(--titan-text-high)"
                  }}>
                    Arquivo:
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    style={{
                      width: "100%",
                      padding: "var(--titan-spacing-sm)",
                      border: "1px solid var(--titan-stroke)",
                      borderRadius: "var(--titan-radius-sm)",
                      background: "var(--titan-input-bg)",
                      color: "var(--titan-text-high)",
                      fontSize: "var(--titan-font-size-sm)"
                    }}
                  />
                  {arquivoImportacao && (
                    <div style={{
                      marginTop: "var(--titan-spacing-xs)",
                      padding: "var(--titan-spacing-xs)",
                      background: "var(--titan-success-light)",
                      borderRadius: "var(--titan-radius-sm)",
                      fontSize: "var(--titan-font-size-xs)",
                      color: "var(--titan-success-dark)"
                    }}>
                      ✅ Arquivo selecionado: {arquivoImportacao.name}
                    </div>
                  )}
                </div>

                {importando && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--titan-spacing-sm)",
                    padding: "var(--titan-spacing-md)",
                    background: "var(--titan-base-05)",
                    borderRadius: "var(--titan-radius-sm)",
                    marginBottom: "var(--titan-spacing-lg)"
                  }}>
                    <div style={{
                      width: "20px",
                      height: "20px",
                      border: "2px solid var(--titan-primary)",
                      borderTop: "2px solid transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite"
                    }} />
                    <span style={{
                      fontSize: "var(--titan-font-size-sm)",
                      color: "var(--titan-text-med)"
                    }}>
                      Importando obrigações...
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className={styles.modalFooter}>
                <button
                  onClick={() => {
                    setMostrarModalImportar(false);
                    setArquivoImportacao(null);
                  }}
                  className={`${styles.modalButton} ${styles.modalButtonCancel}`}
                  disabled={importando}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportarPlanilha}
                  className={`${styles.modalButton} ${styles.modalButtonConfirm}`}
                  disabled={!arquivoImportacao || importando}
                  style={{ 
                    backgroundColor: "var(--titan-primary)",
                    borderColor: "var(--titan-primary)",
                    opacity: (!arquivoImportacao || importando) ? 0.5 : 1
                  }}
                >
                  <FaUpload size={14} style={{ marginRight: "var(--titan-spacing-xs)" }} />
                  {importando ? "Importando..." : "Importar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
