"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import PrincipalSidebar from "../../../components/onety/principal/PrincipalSidebar";
import ReactSelect from "react-select";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from "../../../styles/gestao/ObrigacoesPage.module.css";
import { Settings, Users, X, Plus, Trash2, User } from "lucide-react";
import EmailTemplateModal from "../../../components/gestao/EmailTemplateModal";
import MultiResponsaveisModal from "../../../components/gestao/MultiResponsaveisModal";

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

// Removido: injeção de estilos globais inline (migrado para globals.css)

function formatarCnpjCpf(cnpjCpf) {
    if (!cnpjCpf) return "";
    
    // Remove todos os caracteres não numéricos
    const numeros = cnpjCpf.replace(/\D/g, "");
    
    // Verifica se é CPF (11 dígitos) ou CNPJ (14 dígitos)
    if (numeros.length === 11) {
        // Formata CPF: 000.000.000-00
        return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (numeros.length === 14) {
        // Formata CNPJ: 00.000.000/0000-00
        return numeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    
    // Se não for nem CPF nem CNPJ, retorna o valor original
    return cnpjCpf;
}

const tipoOptions = [
  { value: "E", label: "E" },
  { value: "OU", label: "OU" },
  { value: "EXCETO", label: "EXCETO" },
];

export default function ObrigacaoDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const obrigacaoId = Number(id);
  const [usuario, setUsuario] = useState(null);

  // Carregar dados do usuário do localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const userData = localStorage.getItem("userData");
        if (userData) {
          setUsuario(JSON.parse(userData));
        }
      } catch (err) {
        console.error("Erro ao carregar dados do usuário:", err);
      }
    }
  }, []);

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("info"); // O valor inicial está como "info"
  const [obrigacao, setObrigacao] = useState(null);
  const [mesFim, setMesFim] = useState(new Date().getMonth() + 1);
  const [particularidades, setParticularidades] = useState([]);
  const [vinculados, setVinculados] = useState([]);
  const [clientes, setClientes] = useState([]); // sempre array
  const [isLoadingClientes, setIsLoadingClientes] = useState(false);
  const [isUpdatingVinculos, setIsUpdatingVinculos] = useState(false);
  const [selectedParticularidade, setSelectedParticularidade] =
    useState(null);
  const [atividades, setAtividades] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("Checklist");
  const [tipoCancelamento, setTipoCancelamento] = useState("Com justificativa");
  const [tipoVinculo, setTipoVinculo] = useState(tipoOptions[0]);
  const [mesReferencia, setMesReferencia] = useState(new Date().getMonth() + 1);
  const [anoReferencia, setAnoReferencia] = useState(new Date().getFullYear());
  const [trimestreInicio, setTrimestreInicio] = useState(1); // Trimestre de início
  const [mesInicioTrimestre, setMesInicioTrimestre] = useState(1); // Mês dentro do trimestre
  const [vencimento, setVencimento] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [departamentos, setDepartamentos] = useState([]);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
  const [emailTemplateModalAberto, setEmailTemplateModalAberto] = useState(false);
  const [atividadeConfigurando, setAtividadeConfigurando] = useState(null);
  const [tituloDocumento, setTituloDocumento] = useState("");
  const [edicao, setEdicao] = useState({
    acaoQtdDias: obrigacao?.acaoQtdDias || "",
    acaoTipoDias: obrigacao?.acaoTipoDias || "Dias úteis",
    metaQtdDias: obrigacao?.metaQtdDias || "",
    metaTipoDias: obrigacao?.metaTipoDias || "Dias úteis",
    vencimentoTipo: obrigacao?.vencimentoTipo || "Antecipar",
    vencimentoDia: obrigacao?.vencimentoDia || "",
  });
  const [salvando, setSalvando] = useState(false);
  const [pdfLayoutId, setPdfLayoutId] = useState(null);
  const [pdfLayoutNome, setPdfLayoutNome] = useState("");
  const [modalModeloAberto, setModalModeloAberto] = useState(false);
  const [modelosPdf, setModelosPdf] = useState([]);
  const [modalGerenciarPdf, setModalGerenciarPdf] = useState(false);
  const [modelosVinculados, setModelosVinculados] = useState([]);
  const [loadingModelosVinculados, setLoadingModelosVinculados] = useState(false);
  const [atividadeIdGerenciar, setAtividadeIdGerenciar] = useState(null);
  // Novo estado para modelo selecionado
  const [modeloSelecionado, setModeloSelecionado] = useState("");
  // Tema
  const [isLight, setIsLight] = useState(false);
  // Flag para recursos exclusivos de empresa franqueadora
  const [empresaEhFranqueadora, setEmpresaEhFranqueadora] = useState(false);

  // Detectar se é franqueadora (mesma lógica usada na visao-geral.tsx)
  useEffect(() => {
    // Sinais locais (usuário/obrigação) já podem responder rápido
    const sinalLocal = !!(
      obrigacao?.empresaEhFranqueadora ||
      obrigacao?.empresa?.ehFranqueadora ||
      obrigacao?.ehFranqueadora ||
      obrigacao?.tipoEmpresa === "Franqueadora" ||
      obrigacao?.isFranqueadora ||
      usuario?.empresaEhFranqueadora ||
      usuario?.empresa?.ehFranqueadora ||
      usuario?.ehFranqueadora ||
      usuario?.tipoEmpresa === "Franqueadora" ||
      usuario?.isFranqueadora
    );
    if (sinalLocal) {
      setEmpresaEhFranqueadora(true);
    }

    const empresaIdSessao = getEmpresaId();
    if (!empresaIdSessao) return;

    // Consulta usada em visao-geral.tsx para confirmar flag
    const token = getToken();
    fetch(`${BASE_URL}/gestao/pesquisa/franqueadora/estatisticas/${empresaIdSessao}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => setEmpresaEhFranqueadora(!!data?.isFranqueadora))
      .catch(() => {
        // mantém o sinal local se houver; caso contrário, false
        setEmpresaEhFranqueadora((prev) => prev || false);
      });
  }, [obrigacao?.empresaId, usuario]);

  const isFranqueadora = empresaEhFranqueadora;
  
  // Estados para múltiplos responsáveis
  const [modalMultiResponsaveis, setModalMultiResponsaveis] = useState(false);
  const [clienteMultiResponsaveis, setClienteMultiResponsaveis] = useState(null);
  
  // ✅ NOVO: Estados para múltiplos responsáveis globais
  const [modalMultiResponsaveisGlobais, setModalMultiResponsaveisGlobais] = useState(false);
  
  // ✅ NOVO: Estado para controlar atualização automática dos múltiplos responsáveis
  const [multiResponsaveisUpdateTrigger, setMultiResponsaveisUpdateTrigger] = useState(0);
  const [clienteIdParaAtualizar, setClienteIdParaAtualizar] = useState(null);
  
  // ✅ NOVO: Estado para armazenar todos os responsáveis de uma vez
  const [todosResponsaveis, setTodosResponsaveis] = useState({
    globais: [],
    porCliente: {}
  });
  
  // ✅ NOVO: Estados para paginação dos responsáveis
  const [itensPorPaginaResponsaveis, setItensPorPaginaResponsaveis] = useState(10);
  const [paginaResponsaveis, setPaginaResponsaveis] = useState(1);
  
  // ✅ NOVO: Estados para filtro e ordenação dos responsáveis
  const [filtroResponsaveis, setFiltroResponsaveis] = useState("");
  const [ordenacaoResponsaveis, setOrdenacaoResponsaveis] = useState("nome");

  // ✅ NOVO: Estados para seleção de clientes
  const [clientesSelecionados, setClientesSelecionados] = useState(new Set());
  const [selecionarTodos, setSelecionarTodos] = useState(false);
  const [itensPorPaginaClientes, setItensPorPaginaClientes] = useState(10);
  const [paginaClientes, setPaginaClientes] = useState(1);
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");

  // Estados para atualização de tarefas
  const [modalAtualizarTarefas, setModalAtualizarTarefas] = useState(false);
  const [dadosAtualizacao, setDadosAtualizacao] = useState(null);
  const [carregandoVerificacao, setCarregandoVerificacao] = useState(false);

  // Sempre que mudar a obrigacao, atualiza os campos!
  useEffect(() => {
    if (obrigacao) {
      setEdicao({
        acaoQtdDias: obrigacao.acaoQtdDias || "",
        acaoTipoDias: obrigacao.acaoTipoDias || "Dias úteis",
        metaQtdDias: obrigacao.metaQtdDias || "",
        metaTipoDias: obrigacao.metaTipoDias || "Dias úteis",
        vencimentoTipo: obrigacao.vencimentoTipo || "Antecipar",
        vencimentoDia: obrigacao.vencimentoDia || "",
      });
    }
  }, [obrigacao]);

  // ✅ NOVO: useEffect para selecionar automaticamente todos os clientes quando carregar
  useEffect(() => {
    if (clientes.length > 0) {
      // ✅ NOVO: Selecionar apenas clientes com responsáveis
      const clientesComResponsavel = clientes.filter(cliente => {
        const responsaveisIndividuais = todosResponsaveis.porCliente[cliente.id] || [];
        const responsaveisGlobais = todosResponsaveis.globais || [];
        return responsaveisIndividuais.length > 0 || responsaveisGlobais.length > 0;
      });
      
      if (clientesComResponsavel.length > 0) {
        const todosIds = clientesComResponsavel.map(cliente => cliente.id);
        setClientesSelecionados(new Set(todosIds));
        setSelecionarTodos(true);
        
        if (clientesComResponsavel.length < clientes.length) {
          console.log(`Selecionados ${clientesComResponsavel.length} de ${clientes.length} clientes (apenas os que possuem responsáveis)`);
        }
      } else {
        setClientesSelecionados(new Set());
        setSelecionarTodos(false);
      }
    }
  }, [clientes, todosResponsaveis]);

  // ✅ NOVO: Função para buscar todos os responsáveis de uma vez
  const fetchTodosResponsaveis = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacaoId}/responsaveis-todos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const resData = await res.json();
      
      // ✅ NOVO: Garantir que não há duplicatas nos dados recebidos
      const dadosLimpos = {
        globais: Array.isArray(resData.globais) ? resData.globais : [],
        porCliente: {}
      };
      
      // Limpar responsáveis por cliente
      if (resData.porCliente && typeof resData.porCliente === 'object') {
        Object.keys(resData.porCliente).forEach(clienteId => {
          const responsaveis = resData.porCliente[clienteId];
          if (Array.isArray(responsaveis)) {
            // Remover duplicatas baseado em ID único
            const responsaveisUnicos = responsaveis.filter((resp, index, array) => {
              if (resp.id) {
                return array.findIndex(r => r.id === resp.id) === index;
              }
              // Se não tem ID, usar índice para garantir unicidade
              return true;
            });
            dadosLimpos.porCliente[clienteId] = responsaveisUnicos;
          }
        });
      }
      
      setTodosResponsaveis(dadosLimpos);
    } catch (error) {
      setTodosResponsaveis({ globais: [], porCliente: {} });
    }
  };

  // Função para verificar e atualizar tarefas dos clientes
  const verificarEAtualizarTarefas = async () => {
    if (!obrigacaoId) {
      toast.error("ID da obrigação não encontrado.");
      return;
    }

    setCarregandoVerificacao(true);
    try {
      // Primeiro, verificar quais tarefas podem ser atualizadas
      const token = getToken();
      const response = await fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacaoId}/verificar-atualizacao-tarefas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.podeAtualizar) {
        setDadosAtualizacao(data);
        setModalAtualizarTarefas(true);
      } else {
        toast.info("Não há tarefas que possam ser atualizadas. Todas as tarefas já foram modificadas ou não há atividades base para replicar.");
      }
    } catch (error) {
      console.error("Erro ao verificar atualizações:", error);
      toast.error("Erro ao verificar se há tarefas para atualizar.");
    } finally {
      setCarregandoVerificacao(false);
    }
  };

  // Função para confirmar e executar a atualização
  const confirmarAtualizacaoTarefas = async () => {
    if (!obrigacaoId || !dadosAtualizacao) return;

    setIsLoading(true);
    try {
      const token = getToken();
      const response = await fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacaoId}/atualizar-tarefas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      toast.success(data.mensagem || "Tarefas atualizadas com sucesso!");
      
      setModalAtualizarTarefas(false);
      setDadosAtualizacao(null);
      
      // Opcional: recarregar dados se necessário
      // fetchAtividades();
    } catch (error) {
      console.error("Erro ao atualizar tarefas:", error);
      toast.error("Erro ao atualizar tarefas dos clientes.");
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ NOVO: useEffect para resetar página quando mudar itens por página
  useEffect(() => {
    setPaginaClientes(1);
  }, [itensPorPaginaClientes]);

  // ✅ NOVO: useEffect para resetar página quando mudar filtros
  useEffect(() => {
    setPaginaClientes(1);
  }, [filtroResponsavel, filtroCliente]);

  // ✅ NOVO: Função para forçar atualização dos múltiplos responsáveis
  // Esta função é chamada quando o modal de múltiplos responsáveis é fechado
  // após uma operação de sucesso (adicionar/remover responsável)
  const triggerMultiResponsaveisUpdate = (clienteId) => {
    setClienteIdParaAtualizar(clienteId);
    setMultiResponsaveisUpdateTrigger(prev => prev + 1);
    // ✅ NOVO: Recarregar todos os responsáveis
    fetchTodosResponsaveis();
  };

  // ✅ NOVO: Função para selecionar todos os clientes filtrados
  const toggleSelecionarTodosFiltrados = () => {
    if (selecionarTodos) {
      // Desmarcar todos
      setClientesSelecionados(new Set());
      setSelecionarTodos(false);
    } else {
      // ✅ NOVO: Marcar apenas clientes filtrados que possuem responsáveis
      const clientesFiltradosComResponsavel = clientesFiltrados.filter(cliente => clienteTemResponsavel(cliente.id));
      if (clientesFiltradosComResponsavel.length === 0) {
        toast.error("Nenhum cliente filtrado possui responsável vinculado. Não é possível gerar tarefas.");
        return;
      }
      
      const todosIds = clientesFiltradosComResponsavel.map(cliente => cliente.id);
      setClientesSelecionados(new Set(todosIds));
      setSelecionarTodos(true);
      
      if (clientesFiltradosComResponsavel.length < clientesFiltrados.length) {
        toast.info(`Selecionados ${clientesFiltradosComResponsavel.length} de ${clientesFiltrados.length} clientes filtrados (apenas os que possuem responsáveis)`);
      }
    }
  };

  // ✅ NOVO: Funções para paginação dos responsáveis
  const handleItemsPerPageChangeResponsaveis = (e) => {
    setItensPorPaginaResponsaveis(Number(e.target.value));
    setPaginaResponsaveis(1); // Reset para primeira página
  };



  // ✅ NOVO: Funções de navegação por setinhas
  const irParaPaginaAnterior = () => {
    if (paginaResponsaveis > 1) {
      setPaginaResponsaveis(paginaResponsaveis - 1);
    }
  };

  const irParaProximaPagina = () => {
    const totalPaginas = Math.ceil(clientesFiltrados.length / itensPorPaginaResponsaveis);
    if (paginaResponsaveis < totalPaginas) {
      setPaginaResponsaveis(paginaResponsaveis + 1);
    }
  };

  // ✅ NOVO: Filtros aplicados aos clientes
  const clientesFiltrados = React.useMemo(() => {
    const base = Array.isArray(clientes)
      ? clientes
      : (clientes && Array.isArray(clientes.clientes))
        ? clientes.clientes
        : [];
    let clientesProcessados = [...base];

    // Filtro por nome/CNPJ do cliente
    if (filtroCliente) {
      clientesProcessados = clientesProcessados.filter(cliente =>
        (cliente.nome || "").toLowerCase().includes(filtroCliente.toLowerCase()) ||
        (cliente.cnpjCpf && cliente.cnpjCpf.includes(filtroCliente))
      );
    }

    // Filtro por responsável
    if (filtroResponsavel) {
      clientesProcessados = clientesProcessados.filter(cliente => {
        const responsaveisIndividuais = todosResponsaveis.porCliente[cliente.id] || [];
        const responsaveisGlobais = todosResponsaveis.globais || [];
        const responsaveis = responsaveisIndividuais.length > 0 ? responsaveisIndividuais : responsaveisGlobais;
        return responsaveis.some(resp => (resp.nome || "").toLowerCase().includes(filtroResponsavel.toLowerCase()));
      });
    }

    return clientesProcessados;
  }, [clientes, filtroCliente, filtroResponsavel, todosResponsaveis]);

  // ✅ NOVO: Variáveis de paginação para clientes (agora usando filtros)
  const totalPaginasClientes = Math.max(1, Math.ceil(clientesFiltrados.length / itensPorPaginaClientes));
  const paginaInicioClientes = Math.max(1, paginaClientes - 2);
  const paginaFimClientes = Math.min(totalPaginasClientes, paginaInicioClientes + 4);
  const clientesPaginados = clientesFiltrados.slice(
    (paginaClientes - 1) * itensPorPaginaClientes,
    paginaClientes * itensPorPaginaClientes
  );

  // ✅ NOVO: useEffect para atualizar seleção quando filtros mudarem
  useEffect(() => {
    // Se "selecionar todos" estava ativo, atualizar para os clientes filtrados COM RESPONSÁVEIS
    if (selecionarTodos) {
      const clientesFiltradosComResponsavel = clientesFiltrados.filter(cliente => clienteTemResponsavel(cliente.id));
      const todosIds = clientesFiltradosComResponsavel.map(cliente => cliente.id);
      setClientesSelecionados(new Set(todosIds));
    }
  }, [filtroResponsavel, filtroCliente, clientesFiltrados, selecionarTodos]);

  // ✅ NOVO: useEffect para resetar mês de início quando trimestre mudar
  useEffect(() => {
    setMesInicioTrimestre(1);
  }, [trimestreInicio]);



  // ✅ NOVO: Resetar página quando filtro ou ordenação mudar
  React.useEffect(() => {
    setPaginaResponsaveis(1);
  }, [filtroResponsaveis, ordenacaoResponsaveis]);

  async function salvarConfiguracaoDatas() {
    setSalvando(true);
    try {
      const token = getToken();
      await fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacao.id}/datas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(edicao)
      });
      toast.success("Datas atualizadas com sucesso!");
      // Atualiza o state local se quiser que os campos reflitam o que está no back, exemplo:
      // await fetchObrigacao();
    } catch (e) {
      toast.error("Erro ao salvar as datas!");
    } finally {
      setSalvando(false);
    }
  }

  const fatoGeradorOptionsAnual = [
    { value: "", label: "Selecione..." },
    { value: "6 anos anteriores", label: "6 anos anteriores" },
    { value: "5 anos anteriores", label: "5 anos anteriores" },
    { value: "4 anos anteriores", label: "4 anos anteriores" },
    { value: "3 anos anteriores", label: "3 anos anteriores" },
    { value: "2 anos anteriores", label: "2 anos anteriores" },
    { value: "Ano anterior", label: "Ano anterior" },
    { value: "Mesmo ano", label: "Mesmo ano" },
    { value: "Próximo ano", label: "Próximo ano" },
  ];

  const fatoGeradorOptionsMensal = [
    { value: "", label: "Selecione..." },
    { value: "Mês anterior", label: "Mês anterior" },
    { value: "Mesmo mês", label: "Mesmo mês" },
    { value: "Próximo mês", label: "Próximo mês" },
  ];


  const abrirModalEditar = (atividade) => {
    setAtividadeSelecionada(atividade);
    setPdfLayoutId(atividade.pdf_layout_id || null);
    setPdfLayoutNome(atividade.pdf_layout_nome || "");
    
    // ✅ NOVO: Carregar modelos PDF se a atividade for do tipo PDF Layout
    if (atividade.tipo === "PDF Layout") {
      const token = getToken();
      fetch(`${BASE_URL}/gestao/pdf-layouts/modelos`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setModelosPdf(data || []))
        .catch(() => setModelosPdf([]));
    }
    
    setModalEditarAberto(true);
  };

  const salvarEdicaoAtividade = async () => {
    try {
      // ✅ NOVO: Preparar dados da atividade com pdfLayoutId atualizado
      const dadosAtualizados = {
        ...atividadeSelecionada,
        pdf_layout_id: atividadeSelecionada.tipo === "PDF Layout" ? pdfLayoutId : null,
      };
      const token = getToken();
      await fetch(`${BASE_URL}/gestao/obrigacoes/atividades/${atividadeSelecionada.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(dadosAtualizados)
      });
      toast.success("Atividade atualizada com sucesso!");
      fetchAtividades();
      setModalEditarAberto(false);
      setAtividadeSelecionada(null);
      setPdfLayoutId(null);
      setPdfLayoutNome("");
    } catch (error) {
      toast.error("Erro ao atualizar atividade.");
    }
  };

  const excluirAtividade = async (id) => {
    if (!confirm("Tem certeza que deseja excluir esta atividade?")) return;
    try {
      const token = getToken();
      await fetch(`${BASE_URL}/gestao/obrigacoes/atividades/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Atividade excluída com sucesso!");
      fetchAtividades();
    } catch (error) {
      toast.error("Erro ao excluir atividade.");
    }
  };

  const fetchDepartamentos = async () => {
    const token = getToken();
    const empresaParaDepartamentos = obrigacao?.empresa_id || obrigacao?.empresaId;
    const res = await fetch(`${BASE_URL}/gestao/departamentos/${empresaParaDepartamentos}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const lista = Array.isArray(data)
      ? data
      : (Array.isArray(data?.departamentos) ? data.departamentos : (Array.isArray(data?.data) ? data.data : []));
    setDepartamentos(lista);
  };

  const salvarObrigacao = async () => {
    setIsSaving(true);
    try {
      const token = getToken();
      await fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacaoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(obrigacao)
      });
      toast.success("Obrigação salva com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar obrigação.");
    } finally {
      setIsSaving(false);
    }
  };

  const excluirObrigacao = async () => {
    if (!confirm("Tem certeza que deseja excluir?")) return;
    try {
      const token = getToken();
      await fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacaoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Obrigação excluída com sucesso!");
      router.push("/dashboard/obrigacoes");
    } catch (err) {
      toast.error("Erro ao excluir obrigação.");
    }
  };

  const desativarObrigacao = async () => {
    try {
      const token = getToken();
      await fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacaoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
        ...obrigacao,
        status: "Inativo",
        })
      });
      toast.success("Obrigação desativada.");
      setObrigacao((prev) => ({ ...prev, status: "Inativo" }));
    } catch (err) {
      toast.error("Erro ao desativar.");
    }
  };

  const fetchAtividades = async () => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacaoId}/atividades`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const lista = Array.isArray(data)
      ? data
      : (Array.isArray(data?.atividades) ? data.atividades : (Array.isArray(data?.data) ? data.data : []));
    setAtividades(lista);
  };

  // ✅ NOVO: Funções para gerenciar seleção de clientes
  // ✅ NOVO: Função para verificar se um cliente tem responsável
  const clienteTemResponsavel = (clienteId) => {
    const responsaveisIndividuais = todosResponsaveis.porCliente[clienteId] || [];
    const responsaveisGlobais = todosResponsaveis.globais || [];
    return responsaveisIndividuais.length > 0 || responsaveisGlobais.length > 0;
  };

  // ✅ NOVO: Função para calcular meses baseado no trimestre
  const calcularMesesTrimestre = (trimestre) => {
    const trimestres = {
      1: { inicio: 1, fim: 3 },   // Jan-Mar
      2: { inicio: 4, fim: 6 },   // Abr-Jun
      3: { inicio: 7, fim: 9 },   // Jul-Set
      4: { inicio: 10, fim: 12 }  // Out-Dez
    };
    return trimestres[trimestre] || { inicio: 1, fim: 3 };
  };

  // ✅ NOVO: Função para calcular mês de início real baseado no trimestre e mês selecionado
  const calcularMesInicioReal = () => {
    const trimestre = calcularMesesTrimestre(trimestreInicio);
    return trimestre.inicio + (mesInicioTrimestre - 1);
  };

  const toggleClienteSelecionado = (clienteId) => {
    // ✅ NOVO: Verificar se o cliente tem responsável antes de permitir seleção
    if (!clienteTemResponsavel(clienteId)) {
      toast.error("Este cliente não possui responsável vinculado. Não é possível gerar tarefas.");
      return;
    }

    const novosSelecionados = new Set(clientesSelecionados);
    if (novosSelecionados.has(clienteId)) {
      novosSelecionados.delete(clienteId);
    } else {
      novosSelecionados.add(clienteId);
    }
    setClientesSelecionados(novosSelecionados);
    
    // Atualizar estado de "selecionar todos"
    if (novosSelecionados.size === clientes.length) {
      setSelecionarTodos(true);
    } else if (novosSelecionados.size === 0) {
      setSelecionarTodos(false);
    } else {
      setSelecionarTodos(false);
    }
  };

  const toggleSelecionarTodos = () => {
    if (selecionarTodos) {
      setClientesSelecionados(new Set());
      setSelecionarTodos(false);
    } else {
      // ✅ NOVO: Selecionar apenas clientes com responsáveis
      const clientesComResponsavel = clientes.filter(c => clienteTemResponsavel(c.id));
      if (clientesComResponsavel.length === 0) {
        toast.error("Nenhum cliente possui responsável vinculado. Não é possível gerar tarefas.");
        return;
      }
      
      const todosIds = clientesComResponsavel.map(c => c.id);
      setClientesSelecionados(new Set(todosIds));
      setSelecionarTodos(true);
      
      if (clientesComResponsavel.length < clientes.length) {
        toast.info(`Selecionados ${clientesComResponsavel.length} de ${clientes.length} clientes (apenas os que possuem responsáveis)`);
      }
    }
  };

  const gerarObrigacoes = async () => {
    // Validação diferente para obrigações anuais vs trimestrais vs outras frequências
    if (obrigacao?.frequencia === "Anual") {
      if (!anoReferencia) {
        toast.error("Preencha o ano.");
        return;
      }
    } else if (obrigacao?.frequencia === "Trimestral" || obrigacao?.frequencia === "Trimestral 2 Cotas" || obrigacao?.frequencia === "Trimestral 3 Cotas") {
      if (!anoReferencia || !trimestreInicio || !mesInicioTrimestre) {
        toast.error("Preencha o ano, trimestre e mês de início.");
        return;
      }
    } else {
      if (!mesReferencia || !anoReferencia || !mesFim) {
        toast.error("Preencha todos os campos.");
        return;
      }
    }
    
    if (clientesSelecionados.size === 0) {
      toast.error("Selecione pelo menos um cliente para gerar tarefas.");
      return;
    }
    
    // ✅ NOVO: Validar se todos os clientes selecionados possuem responsáveis
    const clientesSemResponsavel = Array.from(clientesSelecionados).filter(clienteId => !clienteTemResponsavel(clienteId));
    if (clientesSemResponsavel.length > 0) {
      toast.error(`${clientesSemResponsavel.length} cliente(s) selecionado(s) não possuem responsáveis vinculados. Remova-os da seleção para continuar.`);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // ✅ NOVO: Converter Set para Array e enviar todos os clientes selecionados de uma vez
      const clienteIds = Array.from(clientesSelecionados);
      
      // Chamada da API para gerar tarefas para todos os clientes selecionados
      const payload = obrigacao?.frequencia === "Anual" 
        ? {
            ano: anoReferencia,
            mesInicio: (() => {
              // Converter o mês do campo diaSemana para número
              const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                           "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
              return meses.indexOf(obrigacao?.diaSemana) + 1;
            })(),
            mesFim: (() => {
              // Para obrigações anuais, mesFim = mesInicio
              const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                           "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
              return meses.indexOf(obrigacao?.diaSemana) + 1;
            })(),
            clienteIds, // Array de IDs dos clientes selecionados
          }
        : (obrigacao?.frequencia === "Trimestral" || obrigacao?.frequencia === "Trimestral 2 Cotas" || obrigacao?.frequencia === "Trimestral 3 Cotas")
        ? {
            ano: anoReferencia,
            mesInicio: calcularMesInicioReal(),
            mesFim: 12, // Sempre até dezembro para gerar todos os trimestres subsequentes
            clienteIds, // Array de IDs dos clientes selecionados
          }
        : obrigacao?.frequencia === "Semanal"
        ? {
            ano: anoReferencia,
            mesInicio: mesReferencia,
            mesFim: mesFim,
            diaSemana: obrigacao?.diaSemana, // ✅ NOVO: Incluir diaSemana para obrigações semanais
            clienteIds, // Array de IDs dos clientes selecionados
          }
        : {
            ano: anoReferencia,
            mesInicio: mesReferencia,
            mesFim: mesFim,
            clienteIds, // Array de IDs dos clientes selecionados
          };

      const token = getToken();
      const response = await fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacaoId}/gerar-atividades`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const responseData = await response.json();

      // ✅ NOVO: Usar as informações retornadas pela API
      if (responseData.ok) {
        toast.success(responseData.mensagem);
        console.log("📊 Resumo da geração:", {
          selecionados: responseData.clientesSelecionados,
          elegiveis: responseData.clientesElegiveis,
          tarefasGeradas: responseData.tarefasGeradas
        });
      }
      
      // Resetar seleções após sucesso
      setClientesSelecionados(new Set());
      setSelecionarTodos(false);
    } catch (err) {
      console.error("Erro ao gerar obrigações:", err);
      toast.error("Erro ao gerar obrigações.");
    } finally {
      setIsLoading(false);
    }
  };


  const adicionarAtividade = async () => {
    // Validação específica para eContador (mantém obrigatório)
    if (tipo === "Integração: eContador" && (!pdfLayoutId || !tituloDocumento)) {
      toast.error("Preencha o Título do Documento e selecione um modelo PDF Layout.");
      return;
    }
    
    // Validação para Onvio (apenas título é obrigatório)
    if (tipo === "Integração: Onvio" && !tituloDocumento) {
      toast.error("Preencha o Título do Documento.");
      return;
    }

    // Validação para Alterdata (PDF obrigatório)
    if (tipo === "Integração: Drive" && !pdfLayoutId) {
      toast.error("Selecione um modelo PDF Layout para a Integração: Drive.");
      return;
    }
    
    const atividadeData = {
      texto,
      descricao,
      tipo,
      tipoCancelamento,
      ordem: atividades.length + 1,
    };
    
    if (tipo === "PDF Layout") {
      atividadeData.pdf_layout_id = pdfLayoutId;
    } else if (tipo === "Integração: eContador") {
      atividadeData.titulo_documento = tituloDocumento;
      atividadeData.pdf_layout_id = pdfLayoutId;
    } else if (tipo === "Integração: Onvio") {
      atividadeData.titulo_documento = tituloDocumento;
      // PDF Layout é opcional para Onvio
      if (pdfLayoutId) {
        atividadeData.pdf_layout_id = pdfLayoutId;
      }
    } else if (tipo === "Integração: Drive") {
      atividadeData.titulo_documento = tituloDocumento;
      atividadeData.pdf_layout_id = pdfLayoutId;
    }
    
    const token = getToken();
    await fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacaoId}/atividades`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(atividadeData)
    });
    setModalAberto(false);
    setTexto("");
    setDescricao("");
    setPdfLayoutId(null);
    setPdfLayoutNome("");
    setTituloDocumento("");
    fetchAtividades();
    toast.success("Atividade adicionada com sucesso!");
  };

  const trocarOrdem = async (atividadeId, direcao) => {
    const indexAtual = atividades.findIndex((a) => a.id === atividadeId);
    const novoIndex = direcao === "up" ? indexAtual - 1 : indexAtual + 1;

    if (novoIndex < 0 || novoIndex >= atividades.length) return;

    const atual = atividades[indexAtual];
    const alvo = atividades[novoIndex];

    const token = getToken();
    await fetch(`${BASE_URL}/gestao/obrigacoes/atividades/${atual.id}/ordem`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ novaOrdem: alvo.ordem })
    });
    await fetch(`${BASE_URL}/gestao/obrigacoes/atividades/${alvo.id}/ordem`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ novaOrdem: atual.ordem })
    });

    fetchAtividades();
  };

  useEffect(() => {
    if (!obrigacaoId) return;
    fetchObrigacao();
    fetchParticularidades();
    fetchVinculados();
    fetchClientes();
    fetchAtividades();
    // ✅ NOVO: Buscar todos os responsáveis de uma vez
    fetchTodosResponsaveis();
  }, [obrigacaoId]);

  // ✅ NOVO: Resetar seleções quando clientes mudarem
  useEffect(() => {
    if (clientes.length > 0) {
      // Por padrão, selecionar todos os clientes
      const todosIds = clientes.map(c => c.id);
      setClientesSelecionados(new Set(todosIds));
      setSelecionarTodos(true);
    } else {
      setClientesSelecionados(new Set());
      setSelecionarTodos(false);
    }
  }, [clientes]);

  const fetchClientes = async () => {
    setIsLoadingClientes(true);
    try {
      const token = getToken();
      const res = await fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacaoId}/clientes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const lista = Array.isArray(data)
        ? data
        : (Array.isArray(data?.clientes) ? data.clientes : (Array.isArray(data?.data) ? data.data : []));
      setClientes(lista);
    } catch (err) {
      toast.error("Erro ao carregar clientes.");
      setClientes([]);
    } finally {
      setIsLoadingClientes(false);
    }
  };

  const fetchObrigacao = async () => {
    const token = getToken();
    const response = await fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacaoId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    const normalize = (o) => ({
      ...o,
      empresaId: o.empresaId ?? o.empresa_id ?? null,
      departamentoId: o.departamentoId ?? o.departamento_id ?? null,
      diaSemana: o.diaSemana ?? o.dia_semana ?? "",
      fatoGerador: o.fatoGerador ?? o.fato_gerador ?? "",
      usarRelatorio: o.usarRelatorio ?? o.usar_relatorio ?? false,
      geraMulta: o.geraMulta ?? o.gera_multa ?? false,
      reenviarEmail: o.reenviarEmail ?? o.reenviar_email ?? false,
      acaoQtdDias: o.acaoQtdDias ?? o.acao_qtd_dias ?? null,
      metaQtdDias: o.metaQtdDias ?? o.meta_qtd_dias ?? null,
      metaTipoDias: o.metaTipoDias ?? o.meta_tipo_dias ?? null,
      vencimentoTipo: o.vencimentoTipo ?? o.vencimento_tipo ?? null,
      vencimentoDia: o.vencimentoDia ?? o.vencimento_dia ?? null,
    });
    setObrigacao(normalize(data));
  };

  useEffect(() => {
    if (obrigacaoId) {
      fetchObrigacao();
    }
  }, [obrigacaoId]);

  // Detectar tema atual e reagir a mudanças
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const getTheme = () => document.documentElement.getAttribute('data-theme') === 'light';
    setIsLight(getTheme());
    const handleChange = (e) => {
      const detail = (e && e.detail) || {};
      if (detail && (detail.theme === 'light' || detail.theme === 'dark')) {
        setIsLight(detail.theme === 'light');
      } else {
        setIsLight(getTheme());
      }
    };
    window.addEventListener('titan-theme-change', handleChange);
    return () => window.removeEventListener('titan-theme-change', handleChange);
  }, []);

  useEffect(() => {
    if (obrigacao?.empresa_id || obrigacao?.empresaId) {
      fetchDepartamentos();
    }
  }, [obrigacao]);

  const fetchParticularidades = async () => {
    const token = getToken();
    const empresaId = getEmpresaId();
    const response = await fetch(`${BASE_URL}/gestao/enquete/particularidades`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Empresa-Id': String(empresaId || '') }
    });
    const data = await response.json();
    const lista = Array.isArray(data)
      ? data
      : (Array.isArray(data?.particularidades) ? data.particularidades : (Array.isArray(data?.data) ? data.data : []));
    setParticularidades(lista);
  };

  const fetchVinculados = async () => {
    const token = getToken();
    const response = await fetch(
      `${BASE_URL}/gestao/obrigacoes/${obrigacaoId}/particularidades`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    const lista = Array.isArray(data)
      ? data
      : (Array.isArray(data?.particularidades) ? data.particularidades : (Array.isArray(data?.data) ? data.data : []));
    setVinculados(lista);
  };

  const adicionarVinculo = async () => {
    if (!selectedParticularidade) return;
    setIsUpdatingVinculos(true);
    try {
      const token = getToken();
      await fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacaoId}/particularidades`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
        tipo: tipoVinculo.value,
        particularidadeId: selectedParticularidade.value,
        })
      });
      setSelectedParticularidade(null);
      await fetchVinculados();
      // ✅ Atualizar clientes automaticamente após adicionar particularidade
      await fetchClientes();
      toast.success("Particularidade vinculada com sucesso!");
    } catch (error) {
      toast.error("Erro ao vincular particularidade.");
    } finally {
      setIsUpdatingVinculos(false);
    }
  };

  const removerVinculo = async (vinculoId) => {
    setIsUpdatingVinculos(true);
    try {
      const token = getToken();
      await fetch(`${BASE_URL}/gestao/obrigacoes/particularidades/${vinculoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchVinculados();
      // ✅ Atualizar clientes automaticamente após remover particularidade
      await fetchClientes();
      toast.success("Particularidade removida com sucesso!");
    } catch (error) {
      toast.error("Erro ao remover particularidade.");
    } finally {
      setIsUpdatingVinculos(false);
    }
  };

  const exportarParaExcel = () => {
    if (clientes.length === 0) {
      toast.error("Não há clientes para exportar.");
      return;
    }
    try {
      // Importar XLSX dinamicamente
      import('xlsx').then((XLSX) => {
        // Criar dados para o Excel
        const dados = [
          ['#', 'Nome do Cliente', 'CNPJ/CPF'], // Cabeçalho
          ...clientes.map((cliente, index) => [
            index + 1,
            cliente.nome,
            cliente.cnpjCpf
          ])
        ];

        // Criar workbook e worksheet
        const ws = XLSX.utils.aoa_to_sheet(dados);
        
        // Ajustar largura das colunas
        ws['!cols'] = [
          { width: 5 },  // #
          { width: 50 }, // Nome do Cliente
          { width: 20 }  // CNPJ/CPF
        ];

        // Criar workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

        // Gerar arquivo XLSX
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Download do arquivo
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `clientes_obrigacao_${obrigacao?.nome || 'obrigacao'}_${new Date().toISOString().split('T')[0]}.xlsx`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Exportação realizada com sucesso!");
      }).catch((error) => {
        console.error("Erro ao importar XLSX:", error);
        toast.error("Erro ao exportar dados.");
      });
    } catch (error) {
      toast.error("Erro ao exportar dados.");
    }
  };

  const th = {
    padding: 8,
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    fontWeight: 500,
  };

  // Helper para estilos do ReactSelect usando tokens onity
  const reactSelectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: 35,
      maxHeight: 35,
      borderRadius: 'var(--onity-radius-xs)',
      fontSize: 'var(--onity-type-body-size)',
      outline: "none",
      boxShadow: "none",
      borderColor: "var(--onity-color-border)",
      backgroundColor: "var(--onity-color-surface)",
      ...(state.isFocused ? { 
        borderColor: "var(--onity-color-primary)",
        boxShadow: "0 0 0 3px rgba(68, 84, 100, 0.15)"
      } : {}),
    }),
    placeholder: (base) => ({
      ...base,
      color: "var(--onity-color-text)",
      opacity: 0.6,
      fontWeight: 400,
      fontSize: "var(--onity-type-body-size)",
    }),
    singleValue: (base) => ({
      ...base,
      color: "var(--onity-color-text)",
      fontWeight: 500,
      fontSize: "var(--onity-type-body-size)",
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? "var(--onity-color-primary)"
        : state.isFocused
        ? "var(--onity-color-bg)"
        : "var(--onity-color-surface)",
      color: state.isSelected ? "var(--onity-color-primary-contrast)" : "var(--onity-color-text)",
      cursor: "pointer",
      boxShadow: "none",
      outline: "none",
      border: "none",
      fontSize: "var(--onity-type-body-size)",
    }),
    menu: (base) => ({
      ...base,
      zIndex: 9999,
      backgroundColor: "var(--onity-color-surface)",
      border: "1px solid var(--onity-color-border)",
      borderRadius: "var(--onity-radius-xs)",
      boxShadow: "var(--onity-elev-low)",
    }),
    menuList: (base) => ({
      ...base,
      boxShadow: "none",
      outline: "none",
      backgroundColor: "var(--onity-color-bg)",
    }),
  };

  // Função para selecionar modelo PDF Layout
  const selecionarModelo = (modelo) => {
    setPdfLayoutId(modelo.id);
    setPdfLayoutNome(modelo.nome);
    setModalModeloAberto(false);
  };

  // Buscar modelos PDF Layout automaticamente ao selecionar o tipo
  useEffect(() => {
    if (tipo === "PDF Layout" || tipo === "Integração: eContador" || tipo === "Integração: Onvio" || tipo === "Integração: Drive") {
      const token = getToken();
      fetch(`${BASE_URL}/gestao/pdf-layouts/modelos`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          const lista = Array.isArray(data)
            ? data
            : (Array.isArray(data?.modelos) ? data.modelos : (Array.isArray(data?.data) ? data.data : []));
          setModelosPdf(lista);
        })
        .catch(() => {
          setModelosPdf([]);
          toast.error("Erro ao buscar modelos de PDF Layout");
        });
    }
  }, [tipo]);

  // Função para abrir modal de gerenciamento
  const abrirModalGerenciarPdf = (atividadeId) => {
    if (atividadeId == null) { // só bloqueia se for null ou undefined
      toast.error("Atividade inválida para gerenciar PDF Layout.");
      return;
    }
    setAtividadeIdGerenciar(atividadeId);
    setModalGerenciarPdf(true);
    carregarModelosVinculados(atividadeId);
  };

  const carregarModelosVinculados = async (atividadeId) => {
    setLoadingModelosVinculados(true);
    try {
      const token = getToken();
      const res = await fetch(`${BASE_URL}/gestao/obrigacoes/atividades/${atividadeId}/pdf-layouts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setModelosVinculados(Array.isArray(data) ? data : []);
    } catch (err) {
      setModelosVinculados([]);
    } finally {
      setLoadingModelosVinculados(false);
    }
  };

  const desvincularModelo = async (atividadeId, layoutId) => {
    const token = getToken();
    await fetch(`${BASE_URL}/gestao/obrigacoes/atividades/${atividadeId}/pdf-layouts/${layoutId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    carregarModelosVinculados(atividadeId);
  };

  const vincularModelo = async (atividadeId, layoutId) => {
    if (atividadeId == null) { // só bloqueia se for null ou undefined
      toast.error("Atividade inválida para vincular modelo.");
      return;
    }
    try {
      const token = getToken();
      await fetch(`${BASE_URL}/gestao/obrigacoes/atividades/${atividadeId}/pdf-layouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pdf_layout_id: layoutId })
      });
      carregarModelosVinculados(atividadeId);
    } catch (err) {
      // Handle errors appropriately
      toast.error("Atividade não encontrada para vincular modelo.");
    }
  };

  // Função para abrir modal de múltiplos responsáveis
  const abrirModalMultiResponsaveis = (cliente) => {
    setClienteMultiResponsaveis(cliente);
    setModalMultiResponsaveis(true);
  };

  useEffect(() => {
    if (modalGerenciarPdf) {
      const token = getToken();
      fetch(`${BASE_URL}/gestao/pdf-layouts/modelos`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          const lista = Array.isArray(data)
            ? data
            : (Array.isArray(data?.modelos) ? data.modelos : (Array.isArray(data?.data) ? data.data : []));
          setModelosPdf(lista);
        })
        .catch(() => setModelosPdf([]));
    }
  }, [modalGerenciarPdf]);

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.containerDetail}>
        {obrigacao ? (
          <>
            <h2 className={styles.pageTitle}>{obrigacao.nome}</h2>

            <div className={styles.tabs}>
              {[
                "Info",
                ...(obrigacao?.frequencia !== "Esporádica" ? ["Perfil", "Datas", "Atividades", "Responsáveis", "Gerar Tarefas"] : ["Atividades", "Responsáveis"]),
              ].map((tabLabel, index) => {
                // Remove acentos e espaços para gerar tabKey padronizado
                const tabKey = tabLabel
                  .toLowerCase()
                  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                  .replace(/\s/g, '');
                return (
                  <div
                    key={tabKey}
                    onClick={() => setActiveTab(tabKey)}
                    className={`${styles.tab} ${activeTab === tabKey ? styles.tabActive : ""}`}
                  >
                    {`${index + 1}. ${tabLabel}`}
                  </div>
                );
              })}
            </div>


            {activeTab === "info" && (
              <div className={styles.card}>
                <div className={`${styles.formRow} ${styles.formRow2}`}>
                  <div>
                    <label className={styles.formLabel}>Nome</label>
                    <input
                      value={obrigacao?.nome ?? ""}
                      onChange={(e) =>
                        setObrigacao({ ...obrigacao, nome: e.target.value })
                      }
                      className={styles.input}
                    />

                    <label className={styles.formLabel}>Departamento</label>
                    <select
                      value={obrigacao?.departamentoId || ""}
                      onChange={(e) =>
                        setObrigacao({
                          ...obrigacao,
                          departamentoId: e.target.value,
                        })
                      }
                      className={styles.select}
                    >
                      <option value="">Selecione...</option>
                      {departamentos.map((dep) => (
                        <option key={dep.id} value={dep.id}>
                          {dep.nome}
                        </option>
                      ))}
                    </select>

                    <label className={styles.formLabel}>Status</label>
                    <select
                      value={obrigacao?.status || "Ativo"}
                      onChange={(e) =>
                        setObrigacao({ ...obrigacao, status: e.target.value })
                      }
                      className={styles.select}
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                    </select>

                    <label className={styles.formLabel}>Alias Validação</label>
                    <input
                      value={obrigacao?.aliasValidacao ?? ""}
                      onChange={(e) =>
                        setObrigacao({
                          ...obrigacao,
                          aliasValidacao: e.target.value,
                        })
                      }
                      className={styles.input}
                    />

                    <label className={styles.formLabel}>Órgão</label>
                    <select
                      value={obrigacao?.orgao || ""}
                      onChange={(e) =>
                        setObrigacao({ ...obrigacao, orgao: e.target.value })
                      }
                      className={styles.select}
                    >
                      <option value="">Selecione...</option>
                      <option value="Receita Federal">Receita Federal</option>
                      <option value="Estadual">Estadual</option>
                      <option value="Municipal">Municipal</option>
                      <option value="Empresa">Empresa</option>
                    </select>
                  </div>

                  <div>
                    <label className={styles.formLabel}>Frequência</label>
                    <select
                      value={obrigacao?.frequencia ?? ""}
                      onChange={(e) =>
                        setObrigacao({
                          ...obrigacao,
                          frequencia: e.target.value,
                        })
                      }
                      className={styles.select}
                    >
                      <option value="">Selecione...</option>
                      <option value="Diário">Diário</option>
                      <option value="Semanal">Semanal</option>
                      <option value="Mensal">Mensal</option>
                      <option value="Bimestral">Bimestral</option>
                      <option value="Trimestral">Trimestral</option>
                      <option value="Quadrimestral">Quadrimestral</option>
                      <option value="Semestral">Semestral</option>
                      <option value="Anual">Anual</option>
                      <option value="Esporádica">Esporádica</option>
                    </select>

                    {/* Campo Dia da Semana - aparece apenas para frequência Semanal */}
                    {obrigacao?.frequencia === "Semanal" && (
                      <label className={styles.formLabel}>Dia da Semana</label>
                    )}
                    {obrigacao?.frequencia === "Semanal" && (
                      <select
                        value={obrigacao?.diaSemana ?? ""}
                        onChange={(e) =>
                          setObrigacao({
                            ...obrigacao,
                            diaSemana: e.target.value,
                          })
                        }
                        className={styles.select}
                      >
                        <option value="">Selecione...</option>
                        <option value="Segunda">Segunda-feira</option>
                        <option value="Terça">Terça-feira</option>
                        <option value="Quarta">Quarta-feira</option>
                        <option value="Quinta">Quinta-feira</option>
                        <option value="Sexta">Sexta-feira</option>
                        <option value="Sábado">Sábado</option>
                        <option value="Domingo">Domingo</option>
                      </select>
                    )}

                    {/* Campo Mês do Ano - aparece apenas para frequência Anual */}
                    {obrigacao?.frequencia === "Anual" && (
                      <label className={styles.formLabel}>Mês do Ano</label>
                    )}
                    {obrigacao?.frequencia === "Anual" && (
                      <select
                        value={obrigacao?.diaSemana ?? ""}
                        onChange={(e) =>
                          setObrigacao({
                            ...obrigacao,
                            diaSemana: e.target.value,
                          })
                        }
                        className={styles.select}
                      >
                        <option value="">Selecione...</option>
                        <option value="Janeiro">Janeiro</option>
                        <option value="Fevereiro">Fevereiro</option>
                        <option value="Março">Março</option>
                        <option value="Abril">Abril</option>
                        <option value="Maio">Maio</option>
                        <option value="Junho">Junho</option>
                        <option value="Julho">Julho</option>
                        <option value="Agosto">Agosto</option>
                        <option value="Setembro">Setembro</option>
                        <option value="Outubro">Outubro</option>
                        <option value="Novembro">Novembro</option>
                        <option value="Dezembro">Dezembro</option>
                      </select>
                    )}

                    {/* Campo Fato Gerador - aparece apenas para frequências que precisam dele */}
                    {obrigacao?.frequencia && 
                     !["Bimestral", "Trimestral", "Trimestral 2 Cotas", "Trimestral 3 Cotas", "Semanal"].includes(obrigacao.frequencia) && (
                      <label className={styles.formLabel}>Fato Gerador</label>
                    )}
                    {obrigacao?.frequencia && 
                     !["Bimestral", "Trimestral", "Trimestral 2 Cotas", "Trimestral 3 Cotas", "Semanal"].includes(obrigacao.frequencia) && (
                      <select
                        value={obrigacao?.fatoGerador ?? ""}
                        onChange={(e) =>
                          setObrigacao({
                            ...obrigacao,
                            fatoGerador: e.target.value,
                          })
                        }
                        className={styles.select}
                      >
                        {(obrigacao?.frequencia === "Anual"
                          ? fatoGeradorOptionsAnual
                          : fatoGeradorOptionsMensal
                        ).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className={styles.mt}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={obrigacao?.usarRelatorio ?? false}
                      onChange={(e) =>
                        setObrigacao({
                          ...obrigacao,
                          usarRelatorio: e.target.checked,
                        })
                      }
                      className={styles.checkbox}
                    />
                    <span className={styles.checkboxLabelText}>Utilizar no Relatório de Avaliação</span>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={obrigacao?.geraMulta ?? false}
                      onChange={(e) =>
                        setObrigacao({
                          ...obrigacao,
                          geraMulta: e.target.checked,
                        })
                      }
                      className={styles.checkbox}
                    />
                    <span className={styles.checkboxLabelText}>Gera Multa</span>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={obrigacao?.reenviarEmail ?? false}
                      onChange={(e) =>
                        setObrigacao({
                          ...obrigacao,
                          reenviarEmail: e.target.checked,
                        })
                      }
                      className={styles.checkbox}
                    />
                    <span className={styles.checkboxLabelText}>Re-enviar e-mail com anexo não lido</span>
                  </label>
                </div>

                {/* BOTÕES */}
                <div className={`${styles.flex} ${styles.gapMd} ${styles.mt}`}>
                  <button
                    onClick={salvarObrigacao}
                    disabled={isSaving}
                    className={`${styles.btn} ${styles.btnPrimary} ${isSaving ? styles.btnDisabled : ""}`}
                  >
                    {isSaving ? "Salvando..." : "Salvar"}
                  </button>

                  <button
                    onClick={() =>
                      alert("Copiar lógica ainda não implementada")
                    }
                    className={`${styles.btn} ${styles.btnNeutral}`}
                  >
                    Copiar
                  </button>

                  <button
                    onClick={excluirObrigacao}
                    className={`${styles.btn} ${styles.btnDanger}`}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )}

            {activeTab === "perfil" && obrigacao?.frequencia !== "Esporádica" && (
              <div className={`${styles.card} ${styles.perfilCard}`}>
                {/* LADO ESQUERDO - VINCULAÇÃO */}
                <div className={styles.perfilLeft}>
                  <div className={`${styles.alert} ${styles.alertInfo} ${styles.perfilAlertInfo}`}>
                    <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gapSm}`}>
                    <strong>ℹ️ Escolha as particularidades</strong> para definir
                    os clientes que devem entregar essa Obrigação.
                      {isUpdatingVinculos && (
                        <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gapSm} ${styles.perfilAlertInfoText}`}>
                          <div className={styles.spinner} />
                          Atualizando...
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.perfilGrid}>
                    <ReactSelect
                      value={tipoVinculo}
                      onChange={setTipoVinculo}
                      options={tipoOptions}
                      styles={{
                        ...reactSelectStyles,
                        control: (base, state) => ({
                          ...reactSelectStyles.control(base, state),
                          width: 80,
                        }),
                      }}
                    />
                    <ReactSelect
                      value={selectedParticularidade}
                      onChange={setSelectedParticularidade}
                      options={particularidades.map((p) => ({
                        value: p.id,
                        label: p.nome,
                      }))}
                      placeholder="Selecione..."
                      styles={reactSelectStyles}
                    />
                    <button
                      onClick={adicionarVinculo}
                      disabled={isUpdatingVinculos}
                      className={`${styles.btn} ${styles.btnSuccess} ${styles.btnIcon} ${styles.perfilButtonAdd} ${isUpdatingVinculos ? styles.btnDisabled : ""}`}
                    >
                      +
                    </button>
                  </div>

                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Tipo</th>
                        <th className={styles.th}>Nome</th>
                        <th className={styles.th}>Descrição</th>
                        <th className={styles.th}>Categoria</th>
                        <th className={styles.th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(vinculados) && vinculados.map((v) => (
                        <tr key={v.id}>
                          <td className={styles.td}>{v.tipo}</td>
                          <td className={styles.td}>{v.nome}</td>
                          <td className={styles.td}>{v.descricao}</td>
                          <td className={styles.td}>{v.categoria}</td>
                          <td className={styles.td}>
                            <button
                              onClick={() => removerVinculo(v.id)}
                              className={`${styles.btn} ${styles.btnDanger} ${styles.perfilButtonRemove}`}
                            >
                              ✖
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* LADO DIREITO - CLIENTES RELACIONADOS */}
                <div className={styles.perfilRight}>
                  <div className={`${styles.flex} ${styles.itemsCenter} ${styles.justifyBetween} ${styles.perfilHeader}`}>
                    <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gapSm}`}>
                      <span className={styles.perfilHeaderTitle}>Relação de clientes</span>
                      <span className={`${styles.badge} ${styles.perfilHeaderBadge}`}>
                        {clientes.length} cliente{clientes.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    {clientes.length > 0 && (
                      <button
                        onClick={() => exportarParaExcel()}
                        className={`${styles.btn} ${styles.btnSuccess} ${styles.btnSmall}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7,10 12,15 17,10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Exportar Excel
                      </button>
                    )}
                  </div>

                  <div className={styles.clientsList}>
                    {isUpdatingVinculos ? (
                      <div className={styles.loadingContainer}>
                        <div className={styles.loadingSpinner}>
                          <div className={styles.spinner} />
                        </div>
                        <div className={styles.emptyStateText}>
                          Atualizando lista de clientes...
                        </div>
                      </div>
                    ) : clientes.length === 0 ? (
                      <div className={styles.emptyState}>
                        <div className={styles.emptyStateText}>
                          Nenhum cliente vinculado
                        </div>
                        <div className={styles.emptyStateSubtext}>
                          Adicione particularidades para ver os clientes elegíveis
                        </div>
                      </div>
                    ) : (
                      <table className={styles.clientsTable}>
                        <thead>
                          <tr>
                            <th className={styles.th}>#</th>
                            <th className={styles.th}>Nome</th>
                            <th className={styles.th}>CNPJ/CPF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientes.map((c, i) => (
                            <tr
                              key={c.id}
                              className={styles.clientsTableRow}
                            >
                              <td className={styles.td}>{i + 1}</td>
                              <td
                                className={`${styles.td} ${styles.clientsTableLink}`}
                                onClick={() =>
                                  window.open(
                                    `/dashboard/clientes/${c.id}`,
                                    "_blank"
                                  )
                                }
                              >
                                {c.nome}
                              </td>
                              <td className={styles.td}>{formatarCnpjCpf(c.cnpjCpf)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "datas" && obrigacao?.frequencia !== "Esporádica" && (
              <div className={styles.card}>
                <h3 className={`${styles.pageTitle} ${styles.datasTitle}`}>
                  Configuração de Datas
                </h3>

                {/* Campos principais */}
                <div className={`${styles.flex} ${styles.gapLg} ${styles.datasFieldsContainer}`}>
                  {/* Ação */}
                  <div>
                    <label className={styles.formLabel}>
                      Ação *
                    </label>
                    <div className={`${styles.flex} ${styles.gapSm}`}>
                      <select
                        value={edicao.acaoTipoDias}
                        className={styles.select}
                        onChange={e => setEdicao(v => ({ ...v, acaoTipoDias: e.target.value }))}
                      >
                        <option value="Dias úteis">Dias úteis</option>
                        <option value="Dias corridos">Dias corridos</option>
                      </select>
                      <input
                        value={edicao.acaoQtdDias}
                        className={`${styles.input} ${styles.datasInputWidth}`}
                        type="number"
                        min={0}
                        onChange={e => setEdicao(v => ({ ...v, acaoQtdDias: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Meta */}
                  <div>
                    <label className={styles.formLabel}>
                      Meta *
                    </label>
                    <div className={`${styles.flex} ${styles.gapSm}`}>
                      <select
                        value={edicao.metaTipoDias}
                        className={styles.select}
                        onChange={e => setEdicao(v => ({ ...v, metaTipoDias: e.target.value }))}
                      >
                        <option value="Dias úteis">Dias úteis</option>
                        <option value="Dias corridos">Dias corridos</option>
                      </select>
                      <input
                        value={edicao.metaQtdDias}
                        className={`${styles.input} ${styles.datasInputWidth}`}
                        type="number"
                        min={0}
                        onChange={e => setEdicao(v => ({ ...v, metaQtdDias: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Vencimento */}
                  <div>
                    <label className={styles.formLabel}>
                      Vencimento *
                    </label>
                    <div className={`${styles.flex} ${styles.gapSm}`}>
                      <select
                        value={edicao.vencimentoTipo}
                        className={styles.select}
                        onChange={e => setEdicao(v => ({ ...v, vencimentoTipo: e.target.value }))}
                      >
                        <option value="Antecipar">Antecipar</option>
                        <option value="Postergar">Postergar</option>
                      </select>
                      <input
                        value={edicao.vencimentoDia}
                        className={`${styles.input} ${styles.datasInputWidth}`}
                        type="number"
                        min={0}
                        onChange={e => setEdicao(v => ({ ...v, vencimentoDia: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <button
                  className={`${styles.btn} ${styles.btnPrimary} ${styles.datasButtonSave} ${salvando ? styles.btnDisabled : ""}`}
                  disabled={salvando}
                  onClick={salvarConfiguracaoDatas}
                >
                  {salvando ? "Salvando..." : "Salvar Datas"}
                </button>

                {/* Tabela de clientes */}
                <div className={styles.mt}>
                  <h4 className={styles.datasTableTitle}>Relação de clientes</h4>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>#</th>
                        <th className={styles.th}>Cliente</th>
                        <th className={styles.th}>Dia Meta</th>
                        <th className={styles.th}>Dia Vencimento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className={`${styles.td} ${styles.datasTableEmpty}`}
                          >
                            Nenhum cliente vinculado a esta obrigação.
                          </td>
                        </tr>
                      ) : (
                        clientes.map((c, i) => (
                          <tr
                            key={c.id}
                            className={styles.clientsTableRow}
                          >
                            <td className={styles.td}>{i + 1}</td>
                            <td className={styles.td}>
                              <a
                                href={`/dashboard/clientes/${c.id}`}
                                target="_blank"
                                className={styles.link}
                              >
                                {c.nome}
                              </a>
                              <br />
                              <span className={styles.datasTableCnpj}>
                                {formatarCnpjCpf(c.cnpjCpf)}
                              </span>
                            </td>
                            <td className={styles.td}>{`${edicao.metaQtdDias} - ${edicao.metaTipoDias}`}</td>
                            <td className={styles.td}>{`${edicao.vencimentoDia} - ${edicao.vencimentoTipo}`}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "atividades" && (
              <div className={styles.card}>
                              <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter} ${styles.atividadesHeader}`}>
                <h3 className={`${styles.pageTitle} ${styles.datasTitle} ${styles.pageTitleNoMargin}`}>
                  Atividades vinculadas à obrigação
                </h3>
                <div className={`${styles.flex} ${styles.atividadesHeaderButtons}`}>
                  <button
                    onClick={verificarEAtualizarTarefas}
                    disabled={carregandoVerificacao || isLoading}
                    className={`${styles.btn} ${styles.btnWarning} ${(carregandoVerificacao || isLoading) ? styles.btnDisabled : ""}`}
                    title="Atualizar tarefas dos clientes com as mudanças nas atividades"
                  >
                    {carregandoVerificacao ? (
                      "Verificando..."
                    ) : (
                      <>
                        <svg 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          xmlns="http://www.w3.org/2000/svg"
                          className={styles.atividadesButtonIcon}
                        >
                          <path 
                            d="M4 12a8 8 0 018-8V2.5" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          />
                          <path 
                            d="M12 4v4l3-3" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          />
                          <path 
                            d="M20 12a8 8 0 01-8 8v1.5" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          />
                          <path 
                            d="M12 20v-4l-3 3" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          />
                        </svg>
                        Atualizar Tarefas
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setModalAberto(true)}
                    className={`${styles.btn} ${styles.btnSuccess}`}
                  >
                    + Atividade
                  </button>
                </div>
              </div>

                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>ID</th>
                      <th className={styles.th}>Tipo</th>
                      <th className={styles.th}>Texto</th>
                      <th className={styles.th}>Descrição</th>
                      <th className={styles.th}>Tipo de Cancelamento</th>
                      <th className={styles.th}>Mover</th>
                      <th className={styles.th}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atividades.map((a, i) => (
                      <tr key={a.id}>
                        <td className={styles.td}>{i + 1}</td>
                        <td className={styles.td}>{a.tipo}</td>
                        <td className={styles.td}>
                          <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gapSm}`}>
                            {/* Ícone de engrenagem para atividades de e-mail */}
                            {a.tipo === "Enviar e-mail" && (
                              <button
                                onClick={() => {
                                  setAtividadeConfigurando(a);
                                  setEmailTemplateModalAberto(true);
                                }}
                                title="Configurar template de e-mail"
                                className={`${styles.btnIconSmall} ${styles.btnIconSecondary}`}
                              >
                                <Settings size={14} />
                              </button>
                            )}
                            {/* Ícone de engrenagem para atividades PDF Layout */}
                            {(a.tipo === "PDF Layout" || a.tipo === "Integração: eContador" || a.tipo === "Integração: Onvio" || a.tipo === "Integração: Drive") && (
                              <button
                                onClick={() => abrirModalGerenciarPdf(a.id)}
                                title="Gerenciar PDFs Layout"
                                className={`${styles.btnIconSmall} ${styles.btnIconWarning}`}
                              >
                                <Settings size={14} />
                              </button>
                            )}
                            <span>{a.texto}</span>
                          </div>
                        </td>
                        <td
                          className={`${styles.td} ${styles.atividadesDescriptionCell}`}
                        >
                          {a.descricao}
                        </td>
                        <td className={styles.td}>{a.tipo_cancelamento}</td>
                        <td className={styles.td}>
                          <button
                            onClick={() => trocarOrdem(a.id, "up")}
                            title="Subir"
                            className={styles.btnIconOnly}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 48 48"
                            >
                              <path
                                fill="none"
                                stroke="var(--onity-color-text)"
                                strokeOpacity="0.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="4"
                                d="m13 30l12-12l12 12"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => trocarOrdem(a.id, "down")}
                            title="Descer"
                            className={`${styles.btnIconOnly} ${styles.atividadesButtonMove}`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 48 48"
                            >
                              <path
                                fill="none"
                                stroke="var(--onity-color-text)"
                                strokeOpacity="0.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="4"
                                d="M36 18L24 30L12 18"
                              />
                            </svg>
                          </button>
                        </td>

                        <td className={styles.td}>
                          <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gapSm}`}>
                          <button
                            onClick={() => abrirModalEditar(a)}
                            title="Editar"
                            className={styles.btnIconOnly}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                            >
                              <path
                                fill="none"
                                stroke="var(--onity-color-text)"
                                strokeOpacity="0.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="m14.304 4.844l2.852 2.852M7 7H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4.5m2.409-9.91a2.017 2.017 0 0 1 0 2.853l-6.844 6.844L8 14l.713-3.565l6.844-6.844a2.015 2.015 0 0 1 2.852 0Z"
                              />
                            </svg>
                          </button>

                          <button
                            onClick={() => excluirAtividade(a.id)}
                            title="Excluir"
                            className={styles.btnIconOnly}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                            >
                              <path
                                fill="var(--onity-color-error)"
                                d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"
                              />
                            </svg>
                          </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* MODAL NOVA ATIVIDADE */}
                {modalAberto && (
                  <div className={`${styles.modalOverlay} ${isLight ? styles.modalOverlayLight : ''} ${styles.modalOverlayZIndex}`}>
                    <div className={`${styles.modalBox} ${isLight ? styles.modalContentLight : ''}`}>
                      <h3>Nova Atividade</h3>

                      <label>Tipo:</label>
                      <select
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value)}
                        className={styles.modalInputStyle}
                      >
                        <option value="Checklist">Checklist</option>
                        <option value="Enviar e-mail">Enviar e-mail</option>
                        <option value="Anexos sem validação">Anexos sem validação</option>
                        <option value="PDF Layout">PDF Layout</option>
                        <option value="Integração: eContador">Integração: eContador</option>
                        <option value="Integração: Onvio">Integração: Onvio</option>
                        {isFranqueadora && (
                          <option value="Integração: Drive">Integração: Drive</option>
                        )}
                      </select>

                      <label className={styles.formLabel}>Texto: {tipo === "Integração: Onvio" && <span className={styles.modalLabelOptional}></span>}</label>
                      <input
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        className={styles.input}
                        required={tipo !== "Integração: Onvio"}
                      />

                      <label className={styles.formLabel}>Descrição: {tipo === "Integração: Onvio" && <span className={styles.modalLabelOptional}>(opcional)</span>}</label>
                      <textarea
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        className={`${styles.input} ${styles.textarea}`}
                        required={tipo !== "Integração: Onvio"}
                      />

                      <label className={styles.formLabel}>Tipo de Cancelamento:</label>
                      <select
                        value={tipoCancelamento}
                        onChange={(e) => setTipoCancelamento(e.target.value)}
                        className={styles.select}
                      >
                        <option>Com justificativa</option>
                        <option>Sem justificativa</option>
                        <option>Sem cancelamento</option>
                      </select>

                      {/* Campos para Integração: eContador (obrigatórios) */}
                      {tipo === "Integração: eContador" && (
                        <>
                          <label className={styles.formLabel}>Título do Documento:</label>
                          <input
                            value={tituloDocumento}
                            onChange={(e) => setTituloDocumento(e.target.value)}
                            placeholder="Título do documento para match no eContador"
                            className={styles.input}
                            required
                          />
                          <label className={`${styles.formLabel} ${styles.modalMarginTop}`}>Validação Secundária (PDF Layout):</label>
                          <select
                            value={pdfLayoutId || ""}
                            onChange={(e) => {
                              const selectedModelo = modelosPdf.find((modelo) => modelo.id === Number(e.target.value));
                              if (selectedModelo) {
                                setPdfLayoutId(selectedModelo.id);
                                setPdfLayoutNome(selectedModelo.nome);
                              } else {
                                setPdfLayoutId(null);
                                setPdfLayoutNome("");
                              }
                            }}
                            className={styles.select}
                            required
                          >
                            {Array.isArray(modelosPdf) && modelosPdf.length === 0 && (
                              <option value="">Nenhum modelo PDF cadastrado</option>
                            )}
                            {Array.isArray(modelosPdf) && modelosPdf.map((modelo) => (
                              <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>
                            ))}
                          </select>
                        </>
                      )}

                      {/* Campos para Integração: Onvio (título obrigatório, PDF opcional) */}
                      {tipo === "Integração: Onvio" && (
                        <>
                          <label>Título do Documento: </label>
                          <input
                            value={tituloDocumento}
                            onChange={(e) => setTituloDocumento(e.target.value)}
                            placeholder="Caminho do documento (ex: Fiscal/DAS/Guia DAS)"
                            className={styles.modalInputStyle}
                            required
                          />
                          <label className={`${styles.formLabel} ${styles.modalMarginTop}`}>Validação Secundária (PDF Layout): <span className={styles.modalLabelOptional}>(opcional)</span></label>
                          <select
                            value={pdfLayoutId || ""}
                            onChange={(e) => {
                              const selectedModelo = modelosPdf.find((modelo) => modelo.id === Number(e.target.value));
                              if (selectedModelo) {
                                setPdfLayoutId(selectedModelo.id);
                                setPdfLayoutNome(selectedModelo.nome);
                              } else {
                                setPdfLayoutId(null);
                                setPdfLayoutNome("");
                              }
                            }}
                            className={styles.modalInputStyle}
                          >
                            <option value="">Selecione um modelo (opcional)</option>
                            {Array.isArray(modelosPdf) && modelosPdf.map((modelo) => (
                              <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>
                            ))}
                          </select>
                        </>
                      )}

                      {/* Campos para Integração: Drive (título obrigatório, PDF obrigatório) */}
                      {tipo === "Integração: Drive" && (
                        <>
                          <label>Título do Documento: <span className={styles.modalLabelRequired}></span></label>
                          <input
                            value={tituloDocumento}
                            onChange={(e) => setTituloDocumento(e.target.value)}
                            placeholder="Nome exato do documento no Drive (ex: balancete, DRE, balanço)"
                            className={styles.modalInputStyle}
                            required
                          />
                          <div className={styles.modalDriveAviso}>
                            <strong>Importante:</strong> O nome informado deve corresponder <strong>exatamente</strong> ao nome do arquivo no Google Drive. 
                            A busca será feita por correspondência de texto, então se você colocar "balancete", 
                            o arquivo no Drive deve conter a palavra "balancete" no nome.
                          </div>
                        </>
                      )}

                      {(tipo === "PDF Layout" || tipo === "Integração: Drive") && (
                        <div className={styles.modalMarginTop}>
                          <label>Modelo PDF{tipo === "Integração: Drive" ? " (obrigatório)" : ""}:</label>
                          <select
                            value={pdfLayoutId || ""}
                            onChange={(e) => {
                              const selectedModelo = modelosPdf.find((modelo) => modelo.id === Number(e.target.value));
                              if (selectedModelo) {
                                setPdfLayoutId(selectedModelo.id);
                                setPdfLayoutNome(selectedModelo.nome);
                              } else {
                                setPdfLayoutId(null);
                                setPdfLayoutNome("");
                              }
                            }}
                            className={styles.modalInputStyle}
                            required={tipo === "Integração: Drive"}
                          >
                            <option value="">Selecione um modelo</option>
                            {Array.isArray(modelosPdf) && modelosPdf.map((modelo) => (
                              <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>
                            ))}
                          </select>
                          {pdfLayoutNome && (
                            <span className={styles.modalPdfLayoutNome}>{pdfLayoutNome}</span>
                          )}
                        </div>
                      )}

                      <div className={styles.modalActions}>
                        <button
                          onClick={adicionarAtividade}
                          className={`${styles.btn} ${styles.btnPrimary}`}
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setModalAberto(false)}
                          className={`${styles.btn} ${styles.btnNeutral}`}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* MODAL EDITAR ATIVIDADE */}
                {modalEditarAberto && atividadeSelecionada && (
                  <div className={`${styles.modalOverlay} ${isLight ? styles.modalOverlayLight : ''} ${styles.modalOverlayZIndex}`}>
                    <div className={`${styles.modalBox} ${isLight ? styles.modalContentLight : ''}`}>
                      <h3>Editar Atividade</h3>

                      <label>Tipo:</label>
                      <select
                        value={atividadeSelecionada.tipo || ""}
                        onChange={(e) => setAtividadeSelecionada({...atividadeSelecionada, tipo: e.target.value})}
                        className={styles.modalInputStyle}
                      >
                        <option value="Checklist">Checklist</option>
                        <option value="Enviar e-mail">Enviar e-mail</option>
                        <option value="Anexos sem validação">Anexos sem validação</option>
                        <option value="PDF Layout">PDF Layout</option>
                        <option value="Integração: eContador">Integração: eContador</option>
                        <option value="Integração: Onvio">Integração: Onvio</option>
                        {isFranqueadora && (
                          <option value="Integração: Drive">Integração: Drive</option>
                        )}
                      </select>

                      <label className={styles.formLabel}>Texto:</label>
                      <input
                        value={atividadeSelecionada.texto || ""}
                        onChange={(e) => setAtividadeSelecionada({...atividadeSelecionada, texto: e.target.value})}
                        className={styles.input}
                      />

                      <label className={styles.formLabel}>Descrição:</label>
                      <textarea
                        value={atividadeSelecionada.descricao || ""}
                        onChange={(e) => setAtividadeSelecionada({...atividadeSelecionada, descricao: e.target.value})}
                        className={`${styles.input} ${styles.textarea}`}
                      />

                      <label className={styles.formLabel}>Tipo de Cancelamento:</label>
                      <select
                        value={atividadeSelecionada.tipoCancelamento || ""}
                        onChange={(e) => setAtividadeSelecionada({...atividadeSelecionada, tipoCancelamento: e.target.value})}
                        className={styles.select}
                      >
                        <option>Com justificativa</option>
                        <option>Sem justificativa</option>
                        <option>Sem cancelamento</option>
                      </select>

                      {/* Campos para Integração: eContador */}
                      {atividadeSelecionada.tipo === "Integração: eContador" && (
                        <>
                          <label>Título do Documento:</label>
                          <input
                            value={atividadeSelecionada.titulo_documento || ""}
                            onChange={(e) => setAtividadeSelecionada({...atividadeSelecionada, titulo_documento: e.target.value})}
                            placeholder="Título do documento para match no eContador"
                            className={styles.modalInputStyle}
                          />
                        </>
                      )}

                      {/* Campos para Integração: Onvio */}
                      {atividadeSelecionada.tipo === "Integração: Onvio" && (
                        <>
                          <label>Título do Documento:</label>
                          <input
                            value={atividadeSelecionada.titulo_documento || ""}
                            onChange={(e) => setAtividadeSelecionada({...atividadeSelecionada, titulo_documento: e.target.value})}
                            placeholder="Caminho do documento (ex: Fiscal/DAS/Guia DAS)"
                            className={styles.modalInputStyle}
                          />
                        </>
                      )}

                      {/* Campos para Integração: Drive */}
                      {atividadeSelecionada.tipo === "Integração: Drive" && (
                        <>
                          <label>Título do Documento: <span className={styles.modalLabelRequired}>(obrigatório)</span></label>
                          <input
                            value={atividadeSelecionada.titulo_documento || ""}
                            onChange={(e) => setAtividadeSelecionada({...atividadeSelecionada, titulo_documento: e.target.value})}
                            placeholder="Nome exato do documento no Drive (ex: balancete, DRE, balanço)"
                            className={styles.modalInputStyle}
                          />
                          <div className={styles.modalDriveAviso}>
                            <strong>Importante:</strong> O nome informado deve corresponder <strong>exatamente</strong> ao nome do arquivo no Google Drive. 
                            A busca será feita por correspondência de texto, então se você colocar "balancete", 
                            o arquivo no Drive deve conter a palavra "balancete" no nome.
                          </div>
                        </>
                      )}

                      {/* PDF Layout para qualquer tipo que suporte */}
                      {(atividadeSelecionada.tipo === "PDF Layout" || 
                        atividadeSelecionada.tipo === "Integração: eContador" || 
                        atividadeSelecionada.tipo === "Integração: Onvio" ||
                        atividadeSelecionada.tipo === "Integração: Drive") && (
                        <div className={styles.modalMarginTop}>
                          <label>Modelo PDF Layout{atividadeSelecionada.tipo === "Integração: Drive" ? " (obrigatório)" : ""}:</label>
                          <select
                            value={pdfLayoutId || ""}
                            onChange={(e) => {
                              const selectedModelo = modelosPdf.find((modelo) => modelo.id === Number(e.target.value));
                              if (selectedModelo) {
                                setPdfLayoutId(selectedModelo.id);
                                setPdfLayoutNome(selectedModelo.nome);
                              } else {
                                setPdfLayoutId(null);
                                setPdfLayoutNome("");
                              }
                            }}
                            className={styles.modalInputStyle}
                          >
                            <option value="">
                              {atividadeSelecionada.tipo === "Integração: Onvio" ? "Selecione um modelo (opcional)" : "Selecione um modelo"}
                            </option>
                            {Array.isArray(modelosPdf) && modelosPdf.map((modelo) => (
                              <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>
                            ))}
                          </select>
                          {pdfLayoutNome && (
                            <span className={styles.modalPdfLayoutNome}>{pdfLayoutNome}</span>
                          )}
                        </div>
                      )}

                      <div className={styles.modalActions}>
                        <button
                          onClick={salvarEdicaoAtividade}
                          className={`${styles.btn} ${styles.btnPrimary}`}
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => {
                            setModalEditarAberto(false);
                            setAtividadeSelecionada(null);
                            setPdfLayoutId(null);
                            setPdfLayoutNome("");
                          }}
                          className={`${styles.btn} ${styles.btnNeutral}`}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "responsaveis" && (
              <div className={styles.card}>
                {/* ✅ NOVO: Filtros e controles */}
                <div className={styles.responsaveisFiltersContainer}>
                  <div className={styles.responsaveisFiltersLeft}>
                    <input
                      type="text"
                      placeholder="Filtrar por cliente ou CNPJ/CPF..."
                      value={filtroResponsaveis}
                      onChange={(e) => setFiltroResponsaveis(e.target.value)}
                      className={styles.responsaveisFilterInput}
                    />
                    <select
                      value={ordenacaoResponsaveis}
                      onChange={(e) => setOrdenacaoResponsaveis(e.target.value)}
                      className={styles.responsaveisFilterSelect}
                    >
                      <option value="responsavel">Com Responsável Primeiro</option>
                      <option value="sem-responsavel">Sem Responsável Primeiro</option>
                    </select>
                  </div>
                </div>

                {/* TABELA DE CLIENTES E RESPONSÁVEIS */}
                <div className={styles.responsaveisTableContainer}>
                  <table className={styles.table}>
                    <thead className={styles.tableHeaderRow}>
                      <tr>
                        <th className={styles.th}>ID</th>
                        <th className={styles.th}>Cliente</th>
                        <th className={styles.th}>CNPJ/CPF</th>
                        <th className={styles.th}>Responsáveis</th>
                        <th className={styles.th}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={5} className={`${styles.td} ${styles.responsaveisTableEmpty}`}>
                            {filtroResponsaveis ? "Nenhum cliente encontrado com o filtro aplicado." : "Nenhum cliente vinculado a esta obrigação."}
                          </td>
                        </tr>
                      ) : (
                        clientesFiltrados
                          .slice((paginaResponsaveis - 1) * itensPorPaginaResponsaveis, paginaResponsaveis * itensPorPaginaResponsaveis)
                          .map((c, i) => (
                            <ClienteResponsavelRow 
                              key={c.id} 
                              cliente={c} 
                              obrigacaoId={obrigacaoId} 
                              index={(paginaResponsaveis - 1) * itensPorPaginaResponsaveis + i} 
                              onUpdateCliente={(updatedCliente) => {
                                setClientes(clientesAntigos => Array.isArray(clientesAntigos)
                                  ? clientesAntigos.map(cl => cl.id === updatedCliente.id ? updatedCliente : cl)
                                  : []);
                              }}
                              onMultiResponsaveis={abrirModalMultiResponsaveis}
                              updateTrigger={multiResponsaveisUpdateTrigger}
                              clienteIdParaAtualizar={clienteIdParaAtualizar}
                              todosResponsaveis={todosResponsaveis}
                            />
                          ))
                      )}
                    </tbody>
                  </table>
                  
                  {/* ✅ NOVO: Paginação dos responsáveis */}
                  {clientesFiltrados.length > 0 && (
                    <div className={styles.pagination}>
                      <div>
                        <span className={styles.paginationInfo}>
                          Mostrando {(paginaResponsaveis - 1) * itensPorPaginaResponsaveis + 1}
                          {" - "}
                          {Math.min(paginaResponsaveis * itensPorPaginaResponsaveis, clientesFiltrados.length)} de {clientesFiltrados.length}
                          {filtroResponsaveis && ` (filtrados de ${clientes.length})`}
                        </span>
                      </div>
                      <div className={styles.paginationControls}>
                        {/* Primeira página */}
                        <button
                          onClick={() => setPaginaResponsaveis(1)}
                          disabled={paginaResponsaveis === 1}
                          className={styles.paginationButton}
                          title="Primeira página"
                        >
                          {"<<"}
                        </button>
                        
                        {/* Página anterior */}
                        <button
                          onClick={irParaPaginaAnterior}
                          disabled={paginaResponsaveis <= 1}
                          className={styles.paginationButton}
                          title="Página anterior"
                        >
                          {"<"}
                        </button>
                        
                        {/* Números das páginas */}
                        {(() => {
                          const totalPaginas = Math.ceil(clientesFiltrados.length / itensPorPaginaResponsaveis);
                          const paginaInicio = Math.max(1, paginaResponsaveis - 2);
                          const paginaFim = Math.min(totalPaginas, paginaInicio + 4);
                          
                          return Array.from({ length: paginaFim - paginaInicio + 1 }, (_, i) => paginaInicio + i).map((p) => (
                            <button
                              key={p}
                              onClick={() => setPaginaResponsaveis(p)}
                              className={`${styles.paginationButton} ${p === paginaResponsaveis ? styles.paginationButtonActive : ''}`}
                            >
                              {p}
                            </button>
                          ));
                        })()}
                        
                        {/* Próxima página */}
                        <button
                          onClick={irParaProximaPagina}
                          disabled={paginaResponsaveis >= Math.ceil(clientesFiltrados.length / itensPorPaginaResponsaveis)}
                          className={styles.paginationButton}
                          title="Próxima página"
                        >
                          {">"}
                        </button>
                        
                        {/* Última página */}
                        <button
                          onClick={() => setPaginaResponsaveis(Math.ceil(clientesFiltrados.length / itensPorPaginaResponsaveis))}
                          disabled={paginaResponsaveis >= Math.ceil(clientesFiltrados.length / itensPorPaginaResponsaveis)}
                          className={styles.paginationButton}
                          title="Última página"
                        >
                          {">>"}
                        </button>
                        
                        {/* Seletor de itens por página */}
                        <select
                          value={itensPorPaginaResponsaveis}
                          onChange={handleItemsPerPageChangeResponsaveis}
                          className={styles.paginationSelect}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "gerartarefas" && obrigacao?.frequencia !== "Esporádica" && (
              <div className={styles.card}>
                <h3 className={`${styles.pageTitle} ${styles.datasTitle} ${styles.pageTitleNoMargin}`}>
                  Gerar Tarefas
                </h3>
                <div className={`${styles.flex} ${styles.gapMd} ${styles.gerarTarefasFieldsContainer}`}>
                  <div className={styles.flex1}>
                    <label className={styles.formLabel}>
                      <strong>Ano-Calendário *</strong>
                    </label>
                    <select
                      value={anoReferencia}
                      onChange={(e) => setAnoReferencia(Number(e.target.value))}
                      className={styles.select}
                    >
                      {[2023, 2024, 2025, 2026].map((ano) => (
                        <option key={ano} value={ano}>
                          {ano}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Campos diferentes para obrigações anuais vs trimestrais vs outras frequências */}
                  {obrigacao?.frequencia === "Anual" ? (
                    <div className={styles.flex1}>
                      <label className={styles.formLabel}>
                        <strong>Mês de Vencimento</strong>
                        <span 
                          className={styles.gerarTarefasHint}
                          title="Para obrigações anuais, o mês de vencimento já está definido na configuração da obrigação."
                        >
                        </span>
                      </label>
                      <div className={`${styles.select} ${styles.gerarTarefasSelectDisabled}`}>
                        {obrigacao?.diaSemana || "Não definido"}
                      </div>
                    </div>
                  ) : (obrigacao?.frequencia === "Trimestral" || obrigacao?.frequencia === "Trimestral 2 Cotas" || obrigacao?.frequencia === "Trimestral 3 Cotas") ? (
                    <>
                      <div className={styles.flex1}>
                        <label className={styles.formLabel}>
                          <strong>Trimestre de Início *</strong>
                          <span 
                            className={styles.gerarTarefasHint}
                            title="Selecione o trimestre para começar a gerar as tarefas."
                          >
                            i
                          </span>
                        </label>
                        <select
                          value={trimestreInicio}
                          onChange={(e) => setTrimestreInicio(Number(e.target.value))}
                          className={styles.select}
                        >
                          <option value={1}>1º Trimestre (Jan-Mar)</option>
                          <option value={2}>2º Trimestre (Abr-Jun)</option>
                          <option value={3}>3º Trimestre (Jul-Set)</option>
                          <option value={4}>4º Trimestre (Out-Dez)</option>
                        </select>
                      </div>
                      <div className={styles.flex1}>
                        <label className={styles.formLabel}>
                          <strong>Gerar a partir de *</strong>
                          <span 
                            className={styles.gerarTarefasHint}
                            title="Selecione o mês dentro do trimestre para começar a gerar as tarefas."
                          >
                            i
                          </span>
                        </label>
                        <select
                          value={mesInicioTrimestre}
                          onChange={(e) => setMesInicioTrimestre(Number(e.target.value))}
                          className={styles.select}
                        >
                          {(() => {
                            const trimestre = calcularMesesTrimestre(trimestreInicio);
                            const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                                               "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                            return Array.from({ length: trimestre.fim - trimestre.inicio + 1 }, (_, i) => {
                              const mesNumero = trimestre.inicio + i;
                              return (
                                <option key={mesNumero} value={i + 1}>
                                  {nomesMeses[mesNumero - 1]}
                                </option>
                              );
                            });
                          })()}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.flex1}>
                        <label className={styles.formLabel}>
                          <strong>Vencimento a partir *</strong>
                        </label>
                        <select
                          value={mesReferencia}
                          onChange={(e) => setMesReferencia(Number(e.target.value))}
                          className={styles.select}
                        >
                          {[
                            "Janeiro",
                            "Fevereiro",
                            "Março",
                            "Abril",
                            "Maio",
                            "Junho",
                            "Julho",
                            "Agosto",
                            "Setembro",
                            "Outubro",
                            "Novembro",
                            "Dezembro",
                          ].map((mes, i) => (
                            <option key={i} value={i + 1}>
                              {mes}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.flex1}>
                        <label className={styles.formLabel}>
                          <strong>Competência até *</strong>
                        </label>
                        <select
                          value={mesFim}
                          onChange={(e) => setMesFim(Number(e.target.value))}
                          className={styles.select}
                        >
                          {[
                            "Janeiro",
                            "Fevereiro",
                            "Março",
                            "Abril",
                            "Maio",
                            "Junho",
                            "Julho",
                            "Agosto",
                            "Setembro",
                            "Outubro",
                            "Novembro",
                            "Dezembro",
                          ].map((mes, i) => (
                            <option key={i} value={i + 1}>
                              {mes}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  <div className={`${styles.flex} ${styles.itemsCenter}`}>
                    <button
                      onClick={gerarObrigacoes}
                      disabled={isLoading || clientesSelecionados.size === 0}
                      className={`${styles.btn} ${styles.btnPrimary} ${styles.gerarTarefasButton} ${(isLoading || clientesSelecionados.size === 0) ? styles.btnDisabled : ""}`}
                    >
                      {isLoading ? (
                        <>
                          <span>Gerando tarefas...</span>
                          <div className={styles.spinner} />
                        </>
                      ) : (
                        `⚙ Gerar Tarefas (${clientesSelecionados.size} cliente${clientesSelecionados.size !== 1 ? 's' : ''})`
                      )}
                    </button>
                  </div>
                </div>

                {/* ✅ NOVO: Aviso movido para cá - entre datas e seleção de clientes */}
                <div className={`${styles.alert} ${styles.alertWarning} ${styles.gerarTarefasAviso} ${styles.gerarTarefasAvisoWarning}`}>
                  {obrigacao?.frequencia === "Anual" ? (
                    <>
                      ⚠️ <strong>ATENÇÃO!</strong> Para obrigações anuais, será gerada apenas uma tarefa por cliente no ano <strong>{anoReferencia}</strong> com vencimento no mês de <strong>{obrigacao?.diaSemana || "Não definido"}</strong> (já configurado na obrigação).
                    </>
                  ) : (obrigacao?.frequencia === "Trimestral" || obrigacao?.frequencia === "Trimestral 2 Cotas" || obrigacao?.frequencia === "Trimestral 3 Cotas") ? (
                    <>
                      ⚠️ <strong>ATENÇÃO!</strong> Serão geradas tarefas para o <strong>{trimestreInicio}º trimestre</strong> de <strong>{anoReferencia}</strong> a partir de <strong>{(() => {
                        const trimestre = calcularMesesTrimestre(trimestreInicio);
                        const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                                           "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                        return nomesMeses[calcularMesInicioReal() - 1];
                      })()}</strong>. <br />
                      <strong>Período:</strong> {(() => {
                        const trimestre = calcularMesesTrimestre(trimestreInicio);
                        const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                                           "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                        return `${nomesMeses[calcularMesInicioReal() - 1]} a ${nomesMeses[trimestre.fim - 1]}`;
                      })()} de {anoReferencia}.
                    </>
                  ) : (
                    <>
                      ⚠️ <strong>ATENÇÃO!</strong> Você selecionou o ano{" "}
                      <strong>{anoReferencia}</strong>, então só serão geradas as
                      tarefas com <strong>competência</strong> dentro do ano. <br />
                      Obrigações do ano de <strong>{anoReferencia - 1}</strong> ou
                      anteriores, que vencem em <strong>{anoReferencia}</strong>,
                      não serão geradas.
                    </>
                  )}
                </div>

                {/* ✅ NOVO: Lista de clientes selecionáveis */}
                <div className={styles.gerarTarefasClientesContainer}>
                  {/* ✅ NOVO: Header com contador mais visível */}
                  <div className={styles.gerarTarefasClientesHeader}>
                    <div className={styles.gerarTarefasClientesHeaderLeft}>
                      <input
                        type="checkbox"
                        checked={selecionarTodos}
                        onChange={toggleSelecionarTodosFiltrados}
                        className={styles.checkbox}
                      />
                      <label className={`${styles.formLabel} ${styles.gerarTarefasLabelCheckbox}`}>
                        Selecionar Todos os Clientes Filtrados ({clientesFiltrados.length})
                      </label>
                    </div>
                    
                    {/* ✅ NOVO: Contador e filtros */}
                    <div className={styles.gerarTarefasClientesHeaderRight}>
                      <div className={styles.gerarTarefasContador}>
                        {clientesSelecionados.size} de {clientesFiltrados.length} selecionado{clientesSelecionados.size !== 1 ? 's' : ''}
                      </div>

                      {/* ✅ NOVO: Filtro por responsável */}
                      <div className={styles.gerarTarefasFilterWrapper}>
                        <select
                          value={filtroResponsavel}
                          onChange={(e) => setFiltroResponsavel(e.target.value)}
                          className={styles.gerarTarefasFilterSelect}
                        >
                          <option value="">Todos os responsáveis</option>
                          {(() => {
                            const todosResponsaveisUnicos = new Set();
                            Object.values(todosResponsaveis.porCliente).forEach((respArray) => {
                              respArray.forEach((resp) => {
                                if (resp.nome && typeof resp.nome === 'string') {
                                  todosResponsaveisUnicos.add(resp.nome);
                                }
                              });
                            });
                            if (Array.isArray(todosResponsaveis.globais)) {
                              todosResponsaveis.globais.forEach((resp) => {
                                if (resp.nome && typeof resp.nome === 'string') {
                                  todosResponsaveisUnicos.add(resp.nome);
                                }
                              });
                            }
                            return Array.from(todosResponsaveisUnicos).sort();
                          })().map((nome) => (
                            <option key={nome} value={nome}>{nome}</option>
                          ))}
                        </select>
                      </div>

                      {/* ✅ NOVO: Filtro por cliente */}
                      <div className={styles.gerarTarefasFilterWrapper}>
                        <input
                          type="text"
                          placeholder="Buscar por cliente..."
                          value={filtroCliente}
                          onChange={(e) => setFiltroCliente(e.target.value)}
                          className={styles.gerarTarefasFilterInput}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Lista de clientes com altura dinâmica */}
                  <div 
                    className={styles.gerarTarefasClientesListDynamic}
                    style={{
                      height: (() => {
                        // Se não há clientes, altura mínima
                        if (clientesFiltrados.length === 0) return 200;
                        
                        // Calcula quantos clientes estão na página atual
                        const clientesNaPagina = Math.min(itensPorPaginaClientes, clientesFiltrados.length);
                        
                        // Altura estimada por cliente (incluindo responsáveis e espaçamento)
                        const alturaPorCliente = 120;
                        
                        // Altura mínima para poucos registros
                        const alturaMinima = 200;
                        
                        // Altura máxima para muitos registros
                        const alturaMaxima = 600;
                        
                        // Calcula altura baseada no número de clientes na página atual
                        const alturaCalculada = Math.max(alturaMinima, clientesNaPagina * alturaPorCliente);
                        
                        // Retorna altura limitada ao máximo
                        return Math.min(alturaCalculada, alturaMaxima);
                      })()
                    }}
                  >
                    {clientesFiltrados.length === 0 ? (
                      <div className={styles.gerarTarefasClientesListEmpty}>
                        {filtroCliente || filtroResponsavel ? "Nenhum cliente encontrado com os filtros aplicados." : "Nenhum cliente vinculado a esta obrigação."}
                      </div>
                    ) : (
                      <div className={styles.gerarTarefasClientesListContent}>
                        {clientesPaginados.map((cliente) => {
                          // ✅ NOVO: Obter responsáveis do cliente usando dados já carregados
                          const responsaveisIndividuais = todosResponsaveis.porCliente[cliente.id] || [];
                          const responsaveisGlobais = todosResponsaveis.globais || [];
                          const responsaveis = responsaveisIndividuais.length > 0 ? responsaveisIndividuais : responsaveisGlobais;
                          
                          return (
                            <div
                              key={cliente.id}
                              className={`${styles.gerarTarefasClienteItemDynamic} ${responsaveis.length > 0 ? styles.gerarTarefasClienteItemDynamicEnabled : styles.gerarTarefasClienteItemDynamicDisabled} ${clientesSelecionados.has(cliente.id) ? styles.gerarTarefasClienteItemDynamicSelected : ''}`}
                              onClick={() => responsaveis.length > 0 && toggleClienteSelecionado(cliente.id)}
                            >
                              <input
                                type="checkbox"
                                checked={clientesSelecionados.has(cliente.id)}
                                onChange={() => responsaveis.length > 0 && toggleClienteSelecionado(cliente.id)}
                                className={`${styles.checkbox} ${responsaveis.length === 0 ? styles.gerarTarefasCheckboxDisabled : ''}`}
                                disabled={responsaveis.length === 0}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className={styles.gerarTarefasClienteInfoDynamic}>
                                <div className={styles.gerarTarefasClienteNomeText}>
                                  {cliente.nome}
                                </div>
                                <div className={styles.gerarTarefasClienteCnpjText}>
                                  {formatarCnpjCpf(cliente.cnpjCpf)}
                                </div>
                                
                                {/* ✅ NOVO: Mostrar responsáveis ou mensagem de sem responsável */}
                                {responsaveis.length > 0 ? (
                                  <div className={styles.gerarTarefasResponsaveisSection}>
                                    <div className={styles.gerarTarefasResponsaveisLabelText}>
                                      Responsáveis:
                                    </div>
                                    <div className={styles.gerarTarefasResponsaveisList}>
                                      {responsaveis.map((resp, idx) => {
                                        const isIndividual = resp.clienteId !== undefined && resp.clienteId !== null;
                                        const label = isIndividual ? 'Individual' : 'Global';
                                        
                                        return (
                                          <div 
                                            key={`${cliente.id}-${resp.id || 'global'}-${idx}`} 
                                            className={`${styles.gerarTarefasResponsavelBadge} ${isIndividual ? styles.gerarTarefasResponsavelBadgeIndividual : styles.gerarTarefasResponsavelBadgeGlobal}`}
                                          >
                                            <span className={styles.gerarTarefasResponsavelBadgeLabel}>
                                              {label}:
                                            </span>
                                            {resp.nome}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className={styles.gerarTarefasSemResponsavelText}>
                                    <span className={styles.gerarTarefasSemResponsavelIcon}></span>
                                    Sem responsável - não pode ser selecionado
                                  </div>
                                )}
                                
                                {/* ✅ NOVO: Mostrar quando não há responsável */}
                                {responsaveis.length === 0 && (
                                  <div className={styles.gerarTarefasSemResponsavelDefinido}>
                                    Sem responsável definido
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}


                  </div>

                  {/* ✅ NOVO: Paginação dos clientes - agora separada da lista */}
                  {clientes.length > 0 && (
                    <div className={styles.gerarTarefasPagination}>
                      <span className={styles.gerarTarefasPaginationInfo}>
                        Mostrando {(paginaClientes - 1) * itensPorPaginaClientes + 1}
                        {" - "}
                        {Math.min(paginaClientes * itensPorPaginaClientes, clientesFiltrados.length)} de {clientesFiltrados.length}
                      </span>
                      <div className={styles.gerarTarefasPaginationControls}>
                        <select
                          value={itensPorPaginaClientes}
                          onChange={(e) => setItensPorPaginaClientes(Number(e.target.value))}
                          className={styles.gerarTarefasPaginationSelect}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                        <button
                          onClick={() => setPaginaClientes(1)}
                          disabled={paginaClientes === 1}
                          className={styles.gerarTarefasPaginationButton}
                          aria-label="Primeira página"
                        >
                          {"<<"}
                        </button>
                        <button
                          onClick={() => setPaginaClientes((p) => Math.max(1, p - 1))}
                          disabled={paginaClientes === 1}
                          className={styles.gerarTarefasPaginationButton}
                          aria-label="Página anterior"
                        >
                          {"<"}
                        </button>
                        {Array.from({ length: paginaFimClientes - paginaInicioClientes + 1 }, (_, i) => paginaInicioClientes + i).map((p) => (
                          <button
                            key={p}
                            onClick={() => setPaginaClientes(p)}
                            className={`${styles.gerarTarefasPaginationButton} ${p === paginaClientes ? styles.gerarTarefasPaginationButtonActive : ''}`}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          onClick={() => setPaginaClientes((p) => Math.min(totalPaginasClientes, p + 1))}
                          disabled={paginaClientes === totalPaginasClientes}
                          className={styles.gerarTarefasPaginationButton}
                          aria-label="Próxima página"
                        >
                          {">"}
                        </button>
                        <button
                          onClick={() => setPaginaClientes(totalPaginasClientes)}
                          disabled={paginaClientes === totalPaginasClientes}
                          className={styles.gerarTarefasPaginationButton}
                          aria-label="Última página"
                        >
                          {">>"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>


              </div>
            )}

            {activeTab !== "info" &&
              activeTab !== "perfil" &&
              activeTab !== "atividades" &&
              activeTab !== "gerartarefas" &&
              activeTab !== "datas" &&
              activeTab !== "responsaveis" && (
                <div className={styles.constructionMessage}>Em construção...</div>
              )}
          </>
        ) : (
          <p>Carregando...</p>
        )}
      </div>

      {/* Modal de Configuração de Template de E-mail */}
      {emailTemplateModalAberto && atividadeConfigurando && (
        <EmailTemplateModal
          isOpen={emailTemplateModalAberto}
          onClose={() => {
            setEmailTemplateModalAberto(false);
            setAtividadeConfigurando(null);
          }}
          atividadeId={atividadeConfigurando.id}
          obrigacaoClienteId={obrigacaoId}
        />
      )}

      {/* Modal de Seleção de Modelo PDF Layout */}
      {modalModeloAberto && (
        <div className={styles.modalModeloOverlay}>
          <div className={styles.modalModeloBox}>
            <h3>Selecionar Modelo PDF Layout</h3>
            <ul className={styles.modalModeloList}>
              {modelosPdf.map((modelo) => (
                <li 
                  key={modelo.id} 
                  className={`${styles.modalModeloListItem} ${pdfLayoutId === modelo.id ? styles.modalModeloListItemSelected : ''}`}
                  onClick={() => selecionarModelo(modelo)}
                >
                  {modelo.nome}
                </li>
              ))}
            </ul>
            <button onClick={() => setModalModeloAberto(false)} className={`${styles.btn} ${styles.btnNeutral}`}>Fechar</button>
          </div>
        </div>
      )}

      {/* Modal de gerenciamento */}
      {modalGerenciarPdf && (
        <div className={styles.modalGerenciarPdfOverlay}>
          <div className={styles.modalGerenciarPdfBox}>
            {/* Header */}
            <div className={styles.modalGerenciarPdfHeader}>
              <div className={styles.modalGerenciarPdfHeaderLeft}>
                <Settings size={24} className={styles.modalGerenciarPdfHeaderIcon} />
                <h2 className={styles.modalGerenciarPdfHeaderTitle}>Gerenciando PDFs Layout</h2>
              </div>
              <button 
                onClick={() => setModalGerenciarPdf(false)} 
                className={styles.modalGerenciarPdfCloseButton}
                title="Fechar"
              >
                ×
              </button>
            </div>
            {/* Conteúdo */}
            <div className={styles.modalGerenciarPdfContent}>
              <label className={styles.modalGerenciarPdfLabel}>Modelo vinculado</label>
              <div className={styles.modalGerenciarPdfModelosContainer}>
                {loadingModelosVinculados ? (
                  <div className={styles.modalGerenciarPdfLoading}>Carregando...</div>
                ) : modelosVinculados.length === 0 ? (
                  <div className={styles.modalGerenciarPdfEmpty}>Nenhum modelo vinculado.</div>
                ) : (
                  <table className={styles.modalGerenciarPdfTable}>
                    <thead>
                      <tr className={styles.modalGerenciarPdfTableHeader}>
                        <th className={`${styles.modalGerenciarPdfTableHeaderCell} ${styles.modalGerenciarPdfTableHeaderCellNumber}`}>#</th>
                        <th className={styles.modalGerenciarPdfTableHeaderCell}>Modelo</th>
                        <th className={styles.modalGerenciarPdfTableHeaderCellAction}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelosVinculados.map((modelo, idx) => (
                        <tr key={modelo.id} className={styles.modalGerenciarPdfTableRow}>
                          <td className={styles.modalGerenciarPdfTableCell}>{idx + 1}</td>
                          <td className={styles.modalGerenciarPdfTableCell}>
                            <a 
                              href={`/dashboard/pdf-layout/${modelo.id}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className={styles.modalGerenciarPdfLink}
                            >
                              {modelo.nome} <span className={styles.modalGerenciarPdfLinkIcon}>↗</span>
                            </a>
                          </td>
                          <td className={styles.modalGerenciarPdfTableCell}>
                            <button
                              onClick={async () => {
                                if (atividadeIdGerenciar !== null && modelosVinculados.length > 0) {
                                  try {
                                    await desvincularModelo(atividadeIdGerenciar, modelo.id);
                                  } catch (err) {
                                    if (err?.response?.status === 404) {
                                      toast.error("Atividade não encontrada para desvincular modelo.");
                                    }
                                  }
                                }
                              }}
                              className={styles.modalGerenciarPdfRemoveButton}
                              title="Remover modelo"
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className={styles.modalGerenciarPdfFormRow}>
                <select
                  className={styles.modalGerenciarPdfSelect}
                  value={modeloSelecionado}
                  onChange={e => setModeloSelecionado(e.target.value)}
                >
                  <option value="">Adicionar novo modelo...</option>
                  {modelosPdf.filter(m => !modelosVinculados.some(v => v.id === m.id)).map((modelo) => (
                    <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>
                  ))}
                </select>
                <button
                  className={styles.modalGerenciarPdfAddButton}
                  title="Adicionar modelo"
                  onClick={async () => {
                    if (atividadeIdGerenciar !== null && modeloSelecionado) {
                      await vincularModelo(atividadeIdGerenciar, Number(modeloSelecionado));
                      setModeloSelecionado("");
                    }
                  }}
                  disabled={!modeloSelecionado}
                >
                  +
                </button>
              </div>
            </div>
            {/* Footer */}
            <div className={styles.modalGerenciarPdfFooter}>
              <button
                onClick={() => setModalGerenciarPdf(false)}
                className={styles.modalGerenciarPdfFooterButton}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .loader {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #10b981;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>

      {/* Modal de Múltiplos Responsáveis */}
      {modalMultiResponsaveis && clienteMultiResponsaveis && (
        <MultiResponsaveisModal
          isOpen={modalMultiResponsaveis}
          onClose={() => {
            setModalMultiResponsaveis(false);
            setClienteMultiResponsaveis(null);
          }}
          obrigacaoId={obrigacaoId}
          clienteId={clienteMultiResponsaveis.id}
          obrigacaoNome={obrigacao?.nome || ""}
          clienteNome={clienteMultiResponsaveis.nome}
          onSuccess={() => {
            // ✅ NOVO: Recarregar todos os responsáveis
            fetchTodosResponsaveis();
          }}
        />
      )}

      {/* Modal de Múltiplos Responsáveis Globais */}
      {modalMultiResponsaveisGlobais && (
        <MultiResponsaveisGlobaisModal
          isOpen={modalMultiResponsaveisGlobais}
          onClose={() => {
            setModalMultiResponsaveisGlobais(false);
          }}
          obrigacaoId={obrigacaoId}
          obrigacaoNome={obrigacao?.nome || ""}
          onSuccess={() => {
            // Recarregar todos os responsáveis e clientes
            fetchTodosResponsaveis();
            fetchClientes();
          }}
        />
      )}

      {/* Modal de Atualização de Tarefas */}
      {modalAtualizarTarefas && dadosAtualizacao && (
        <div className={styles.modalAtualizarTarefasOverlay}>
          <div className={styles.modalAtualizarTarefasBox}>
            {/* Header */}
            <div className={styles.modalAtualizarTarefasHeader}>
              <div>
                <h2 className={styles.modalAtualizarTarefasTitle}>
                  <div className={styles.modalAtualizarTarefasTitleWrapper}>
                    <svg 
                      width="20" 
                      height="20" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path 
                        d="M4 12a8 8 0 018-8V2.5" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                      <path 
                        d="M12 4v4l3-3" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                      <path 
                        d="M20 12a8 8 0 01-8 8v1.5" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                      <path 
                        d="M12 20v-4l-3 3" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                    Atualizar Tarefas dos Clientes
                  </div>
                </h2>
                <p className={styles.modalAtualizarTarefasSubtitle}>
                  Aplicar mudanças das atividades base para as tarefas dos clientes
                </p>
              </div>
              <button
                onClick={() => setModalAtualizarTarefas(false)}
                className={styles.modalAtualizarTarefasCloseButton}
              >
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo */}
            <div className={styles.modalAtualizarTarefasContent}>
              <div className={`${styles.alert} ${styles.alertWarning} ${styles.modalAtualizarTarefasAlertWarning}`}>
                <strong>⚠️ ATENÇÃO:</strong> Esta operação irá atualizar apenas as tarefas que ainda não foram modificadas pelos usuários (não concluídas, não canceladas, sem alterações).
              </div>

              {dadosAtualizacao.resumo && (
                <div className={styles.modalAtualizarTarefasResumo}>
                  <h4 className={styles.modalAtualizarTarefasResumoTitle}>
                    <div className={styles.modalAtualizarTarefasResumoTitleIcon}>
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path 
                          d="M3 3v18h18" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                        <path 
                          d="M18 17l-5-5-5 5" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                        <path 
                          d="M7 17l5-5 5 5" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </svg>
                      Resumo da Atualização
                    </div>
                  </h4>
                  <div className={styles.modalAtualizarTarefasResumoList}>
                    <div className={styles.modalAtualizarTarefasResumoItem}>
                      • <strong>{dadosAtualizacao.resumo.clientesAfetados || 0}</strong> clientes terão tarefas atualizadas
                    </div>
                    <div className={styles.modalAtualizarTarefasResumoItem}>
                      • <strong>{dadosAtualizacao.resumo.tarefasAtualizaveis || 0}</strong> tarefas serão atualizadas
                    </div>
                    <div className={styles.modalAtualizarTarefasResumoItem}>
                      • <strong>{dadosAtualizacao.resumo.tarefasIgnoradas || 0}</strong> tarefas já modificadas serão mantidas
                    </div>
                  </div>
                </div>
              )}

              {dadosAtualizacao.mudancas && dadosAtualizacao.mudancas.length > 0 && (
                <div className={styles.modalAtualizarTarefasMudancas}>
                  <h4 className={styles.modalAtualizarTarefasMudancasTitle}>
                    <div className={styles.modalAtualizarTarefasMudancasTitleIcon}>
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path 
                          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                      Mudanças Detectadas nas Atividades
                    </div>
                  </h4>
                  <div className={styles.modalAtualizarTarefasMudancasList}>
                    {dadosAtualizacao.mudancas.map((mudanca, index) => (
                      <div key={index} className={styles.modalAtualizarTarefasMudancaItem}>
                        <strong>{mudanca.tipo}:</strong> {mudanca.descricao}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`${styles.alert} ${styles.alertInfo} ${styles.modalAtualizarTarefasAlertInfo}`}>
                <strong>Dica:</strong> As tarefas que já foram iniciadas, concluídas ou canceladas pelos usuários não serão afetadas por esta atualização.
              </div>
            </div>

            {/* Footer */}
            <div className={styles.modalAtualizarTarefasFooter}>
              <button
                onClick={() => setModalAtualizarTarefas(false)}
                disabled={isLoading}
                className={`${styles.btn} ${styles.btnNeutral}`}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAtualizacaoTarefas}
                disabled={isLoading}
                className={`${styles.btn} ${styles.btnWarning} ${isLoading ? styles.modalAtualizarTarefasButtonLoading : ''}`}
              >
                {isLoading ? "Atualizando..." : "Confirmar Atualização"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}




// COMPONENTE: Linha de Cliente + Responsável
function ClienteResponsavelRow({ 
  cliente, 
  obrigacaoId, 
  index, 
  onUpdateCliente, 
  onMultiResponsaveis,
  updateTrigger,
  clienteIdParaAtualizar,
  todosResponsaveis
}) {
  // cliente.responsavel já vem resolvido (individual > global > null)
  const [usuarios, setUsuarios] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    fetchUsuarios();
    // eslint-disable-next-line
  }, [cliente.id, obrigacaoId]);

  // ✅ NOVO: useEffect para reagir ao trigger de atualização
  React.useEffect(() => {
    if (updateTrigger > 0 && clienteIdParaAtualizar === cliente.id) {
      setLoading(true);
      // Simular loading por um tempo para mostrar feedback visual
      setTimeout(() => setLoading(false), 500);
    }
  }, [updateTrigger, clienteIdParaAtualizar, cliente.id]);

  // ✅ NOVO: Função para obter responsáveis do cliente usando dados já carregados
  const getResponsaveisDoCliente = () => {
    const responsaveisIndividuais = todosResponsaveis.porCliente[cliente.id] || [];
    const responsaveisGlobais = todosResponsaveis.globais || [];
    
    // Se há responsáveis individuais, usar apenas eles
    // Se não há individuais, usar os globais
    const responsaveis = responsaveisIndividuais.length > 0 ? responsaveisIndividuais : responsaveisGlobais;
    
    // ✅ NOVO: Remover duplicatas baseado em ID único
    const responsaveisUnicos = responsaveis.filter((resp, index, array) => {
      // Se tem ID, verificar se é único
      if (resp.id) {
        return array.findIndex(r => r.id === resp.id) === index;
      }
      // Se não tem ID, usar índice para garantir unicidade
      return true;
    });
    
    return responsaveisUnicos;
  };

  async function fetchUsuarios() {
    try {
      const token = getToken();
      const res = await fetch(`${BASE_URL}/usuarios`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const lista = Array.isArray(data)
        ? data
        : (Array.isArray(data?.usuarios) ? data.usuarios : (Array.isArray(data?.data) ? data.data : []));
      setUsuarios(lista);
    } catch {
      setUsuarios([]);
    }
  }

  return (
    <tr className={index % 2 === 1 ? styles.tableRowAlt : undefined}>
      <td className={styles.td}>{index + 1}</td>
      <td className={styles.td}>{cliente.nome}</td>
      <td className={styles.td}>{cliente.cnpjCpf}</td>
      <td className={styles.td}>
          <div className={styles.clienteResponsavelRowContainer}>
            {/* ✅ NOVO: Indicador de carregamento */}
            {loading && (
              <div className={styles.clienteResponsavelRowLoading}>
                <div className={styles.clienteResponsavelRowSpinner} />
                Atualizando...
              </div>
            )}
            
            {/* Responsáveis */}
            {getResponsaveisDoCliente().length > 0 && (
              <div className={styles.clienteResponsaveisList}>
                {getResponsaveisDoCliente().map((resp, idx) => {
                  // Verificar se é responsável individual ou global
                  const isIndividual = resp.clienteId !== undefined && resp.clienteId !== null;
                  const label = isIndividual ? 'Individual' : 'Global';
                  
                  // ✅ NOVO: Criar chave única combinando cliente ID, responsável ID, tipo e índice
                  const uniqueKey = `cliente-${cliente.id}-resp-${resp.usuarioId || resp.id || 'global'}-${resp.tipo || 'unknown'}-${idx}`;
                  
                  return (
                    <div 
                      key={uniqueKey} 
                      className={`${styles.clienteResponsavelBadge} ${isIndividual ? styles.clienteResponsavelBadgeIndividual : styles.clienteResponsavelBadgeGlobal}`}
                    >
                      <span className={styles.clienteResponsavelBadgeLabel}>
                        {label}:
                      </span>
                      {resp.nome}{resp.departamentoNome ? ` - ${resp.departamentoNome}` : ""}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Sem responsável */}
            {getResponsaveisDoCliente().length === 0 && !loading && (
              <span className={styles.clienteResponsavelSem}>Sem responsável</span>
            )}
          </div>
      </td>
      <td className={styles.td}>
        <button 
          onClick={() => onMultiResponsaveis(cliente)}
          className={`${styles.buttonSalvar} ${styles.clienteResponsavelMultiButton}`}
        >
          <Users size={14} />
          Múltiplos
        </button>
      </td>
    </tr>
  );
}

// CSS para animações do spinner
const spinnerStyles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes dash {
    0% { stroke-dashoffset: 31.416; }
    50% { stroke-dashoffset: 0; }
    100% { stroke-dashoffset: -31.416; }
  }
`;

// Adiciona os estilos ao head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = spinnerStyles;
  document.head.appendChild(styleElement);
}

// COMPONENTE: Responsáveis Fixos Globais Múltiplos
const GlobalMultiResponsaveis = ({ obrigacaoId, onUpdateGlobal, todosResponsaveis }) => {
  const [loading, setLoading] = React.useState(false);

  // ✅ NOVO: Usar dados já carregados
  const responsaveis = todosResponsaveis.globais || [];

  return (
    <div className={styles.globalMultiResponsaveisContainer}>
      {loading ? (
        <div className={styles.globalMultiResponsaveisLoading}>
          <div className={styles.clienteResponsavelRowSpinner} />
          Carregando responsáveis globais...
        </div>
      ) : responsaveis.length === 0 ? (
        <div className={styles.globalMultiResponsaveisEmpty}>
          Nenhum responsável fixo global definido
        </div>
      ) : (
        <div className={styles.globalMultiResponsaveisList}>
          {responsaveis.map((resp, idx) => {
            // ✅ NOVO: Criar chave única para responsáveis globais
            const uniqueKey = `global-resp-${resp.id || 'no-id'}-${idx}`;
            
            return (
              <div key={uniqueKey} className={styles.globalMultiResponsaveisBadge}>
                {resp.nome}{resp.departamentoNome ? ` - ${resp.departamentoNome}` : ""}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// COMPONENTE: Modal para Múltiplos Responsáveis Globais
const MultiResponsaveisGlobaisModal = ({ 
  isOpen, 
  onClose, 
  obrigacaoId, 
  obrigacaoNome, 
  onSuccess 
}) => {
  const [responsaveis, setResponsaveis] = React.useState([]);
  const [usuarios, setUsuarios] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedUsuarioId, setSelectedUsuarioId] = React.useState(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [messageType, setMessageType] = React.useState("success");

  React.useEffect(() => {
    if (isOpen) {
      carregarDados();
    }
  }, [isOpen, obrigacaoId]);

  React.useEffect(() => {
    if (!isOpen) {
      setResponsaveis([]);
      setUsuarios([]);
      setSelectedUsuarioId(null);
      setSearchTerm("");
      setMessage("");
    }
  }, [isOpen]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const [responsaveisRes, usuariosRes] = await Promise.all([
        fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacaoId}/responsaveis-fixos-globais`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${BASE_URL}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      const responsaveisData = await responsaveisRes.json();
      const usuariosData = await usuariosRes.json();
      setResponsaveis(Array.isArray(responsaveisData) ? responsaveisData : []);
      const listaUsuarios = Array.isArray(usuariosData)
        ? usuariosData
        : (Array.isArray(usuariosData?.usuarios) ? usuariosData.usuarios : (Array.isArray(usuariosData?.data) ? usuariosData.data : []));
      setUsuarios(listaUsuarios);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setMessage("Erro ao carregar dados");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const adicionarResponsavel = async () => {
    if (!selectedUsuarioId) return;
    
    setLoading(true);
    try {
      const token = getToken();
      await fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacaoId}/responsaveis-fixos-globais`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ usuarioId: selectedUsuarioId })
      });
      
      setSelectedUsuarioId(null);
      setSearchTerm("");
      await carregarDados();
      setMessage("Responsável global adicionado com sucesso!");
      setMessageType("success");
      setTimeout(() => setMessage(""), 3000);
      onSuccess();
    } catch (error) {
      console.error("Erro ao adicionar responsável global:", error);
      setMessage(error.response?.data?.error || "Erro ao adicionar responsável global");
      setMessageType("error");
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setLoading(false);
    }
  };

  const removerResponsavel = async (responsavelId) => {
    if (!window.confirm("Tem certeza que deseja remover este responsável global?")) return;
    
    setLoading(true);
    try {
      const token = getToken();
      await fetch(`${BASE_URL}/gestao/obrigacoes/${obrigacaoId}/responsaveis-fixos-globais/${responsavelId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage("Responsável global removido com sucesso!");
      setMessageType("success");
      carregarDados();
      onSuccess();
    } catch (error) {
      setMessage(error.response?.data?.error || "Erro ao remover responsável global");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const usuariosDisponiveis = usuarios.filter(usuario => 
    !responsaveis.some(resp => resp.usuarioId === usuario.id)
  );

  const usuariosFiltrados = usuariosDisponiveis.filter(usuario => {
    const searchLower = searchTerm.toLowerCase();
    return (
      usuario.nome.toLowerCase().includes(searchLower) ||
      usuario.email.toLowerCase().includes(searchLower) ||
      (usuario.departamentoNome && usuario.departamentoNome.toLowerCase().includes(searchLower))
    );
  });

  if (!isOpen) return null;

  return (
    <div className={styles.modalMultiResponsaveisGlobaisOverlay}>
      <div className={styles.modalMultiResponsaveisGlobaisBox}>
        {/* Header */}
        <div className={styles.modalMultiResponsaveisGlobaisHeader}>
          <div>
            <h2 className={styles.modalMultiResponsaveisGlobaisTitle}>
              Responsáveis Fixos Globais
            </h2>
            <p className={styles.modalMultiResponsaveisGlobaisSubtitle}>
              {obrigacaoNome} - Aplicado a todos os clientes
            </p>
          </div>
          <button
            onClick={onClose}
            className={styles.modalMultiResponsaveisGlobaisCloseButton}
          >
            <X size={20} />
          </button>
        </div>

        {/* Mensagem */}
        {message && (
          <div className={`${styles.modalMultiResponsaveisGlobaisMessage} ${messageType === "success" ? styles.modalMultiResponsaveisGlobaisMessageSuccess : styles.modalMultiResponsaveisGlobaisMessageError}`}>
            {message}
          </div>
        )}

        {/* Adicionar Responsável */}
        <div className={styles.modalMultiResponsaveisGlobaisForm}>
          <h3 className={styles.modalMultiResponsaveisGlobaisFormTitle}>
            Adicionar Responsável Global
          </h3>
          
          <div className={styles.modalMultiResponsaveisGlobaisFormRow}>
            <div className={styles.modalMultiResponsaveisGlobaisSearchWrapper}>
              <label className={styles.modalMultiResponsaveisGlobaisSearchLabel}>
                Selecionar Usuário
              </label>
              <input
                type="text"
                placeholder="Digite para pesquisar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.modalMultiResponsaveisGlobaisSearchInput}
                disabled={loading}
              />
              {searchTerm && (
                <div className={styles.modalMultiResponsaveisGlobaisSearchDropdown}>
                  {usuariosFiltrados.map(usuario => (
                    <div
                      key={usuario.id}
                      onClick={() => {
                        setSelectedUsuarioId(usuario.id);
                        setSearchTerm(`${usuario.nome} (${usuario.email})${usuario.departamentoNome ? ` - ${usuario.departamentoNome}` : ""}`);
                        setTimeout(() => {
                          const input = document.querySelector('input[type="text"]');
                          if (input) input.blur();
                        }, 100);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      className={styles.modalMultiResponsaveisGlobaisSearchItem}
                    >
                      {usuario.nome} ({usuario.email}){usuario.departamentoNome ? ` - ${usuario.departamentoNome}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={adicionarResponsavel}
              disabled={!selectedUsuarioId || loading}
              className={styles.modalMultiResponsaveisGlobaisAddButton}
            >
              <Plus size={16} />
              {loading ? "Adicionando..." : "Adicionar"}
            </button>
          </div>
        </div>

        {/* Lista de Responsáveis */}
        <div>
          <h3 className={styles.modalMultiResponsaveisGlobaisListTitle}>
            Responsáveis Globais Atuais ({responsaveis.length})
          </h3>
          
          {loading ? (
            <div className={styles.modalMultiResponsaveisGlobaisLoading}>
              Carregando...
            </div>
          ) : responsaveis.length === 0 ? (
            <div className={styles.modalMultiResponsaveisGlobaisEmpty}>
              <User size={48} className={styles.modalMultiResponsaveisGlobaisEmptyIcon} />
              <p className={styles.modalMultiResponsaveisGlobaisEmptyText}>
                Nenhum responsável global vinculado
              </p>
              <p className={styles.modalMultiResponsaveisGlobaisEmptySubtext}>
                Adicione responsáveis globais usando o formulário acima
              </p>
            </div>
          ) : (
            <div className={styles.modalMultiResponsaveisGlobaisList}>
              {responsaveis.map((responsavel) => (
                <div
                  key={responsavel.id}
                  className={styles.modalMultiResponsaveisGlobaisItem}
                >
                  <div>
                    <div className={styles.modalMultiResponsaveisGlobaisItemName}>
                      {responsavel.nome}
                    </div>
                    <div className={styles.modalMultiResponsaveisGlobaisItemEmail}>
                      {responsavel.email}
                      {responsavel.departamentoNome && ` • ${responsavel.departamentoNome}`}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => removerResponsavel(responsavel.usuarioId)}
                    disabled={loading}
                    className={styles.modalMultiResponsaveisGlobaisRemoveButton}
                    title="Remover responsável global"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalMultiResponsaveisGlobaisFooter}>
          <button
            onClick={onClose}
            className={styles.modalMultiResponsaveisGlobaisFooterButton}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};