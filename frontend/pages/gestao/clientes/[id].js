// frontend/pages/dashboard/clientes/[id].tsx


import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
// Removido DashboardLayout
// Cliente HTTP simples (mesmo de clientes.js)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const api = {
  get: async (url, config = {}) => {
    const params = config.params ? `?${new URLSearchParams(config.params).toString()}` : "";
    const res = await fetch(`${API_BASE}${url}${params}`, {
      method: "GET",
      headers: config.headers || {}
    });
    if (config.responseType === "blob") {
      return { data: await res.blob(), headers: { 'content-type': res.headers.get('content-type') || '' } };
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return { data: await res.json() };
    }
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  },
  post: async (url, body, config = {}) => {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = config.headers || {};
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      headers,
      body: isFormData ? body : JSON.stringify(body)
    });
    return { data: await res.json() };
  },
  patch: async (url, body, config = {}) => {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = config.headers || {};
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API_BASE}${url}`, {
      method: "PATCH",
      headers,
      body: isFormData ? body : JSON.stringify(body)
    });
    return { data: await res.json() };
  },
  put: async (url, body, config = {}) => {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = config.headers || {};
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API_BASE}${url}`, {
      method: "PUT",
      headers,
      body: isFormData ? body : JSON.stringify(body)
    });
    return { data: await res.json() };
  },
  delete: async (url, config = {}) => {
    const res = await fetch(`${API_BASE}${url}`, {
      method: "DELETE",
      headers: config.headers || {}
    });
    return { data: await res.json() };
  }
};
// Helper para obter empresaId a partir do localStorage.userData
function getEmpresaId() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('userData');
    if (!raw) return null;
    const ud = JSON.parse(raw);
    return ud?.EmpresaId || ud?.empresaId || null;
  } catch (_) {
    return null;
  }
}
// Mapeia o objeto cliente do front para o formato esperado pelo backend (snake_case)
function mapClienteToBackend(c) {
  return {
    tipo_inscricao: c.tipo_inscricao ?? c.tipoInscricao ?? null,
    cpf_cnpj: c.cpf_cnpj ?? c.cnpjCpf ?? null,
    razao_social: c.razao_social ?? c.nome ?? null,
    responsavel_legal: c.responsavel_legal ?? c.responsavelLegal ?? null,
    data_inicio: c.data_inicio ?? c.dataInicio ?? null,
    data_fim: c.data_fim ?? c.dataFim ?? null,
    data_nascimento: c.data_nascimento ?? c.dataNascimento ?? null,
    apelido: c.apelido ?? null,
    tipo: c.tipo ?? null,
    sistema: c.sistema ?? null,
    base: c.base ?? null,
    codigo: c.codigo ?? null,
    status: c.status ?? null,
    telefone: c.telefone ?? null,
    email_principal: c.email_principal ?? c.email ?? null,
    rua: c.rua ?? null,
    complemento: c.complemento ?? null,
    bairro: c.bairro ?? null,
    cidade: c.cidade ?? null,
    estado: c.estado ?? null,
    cep: c.cep ?? null,
    pais: c.pais ?? null,
    observacoes: c.observacoes ?? c.observacao ?? null,
  };
}
import Link from "next/link";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Select from "react-select";
import PrincipalSidebar from "@/components/onety/principal/PrincipalSidebar";
import MultiResponsaveisModal from "@/components/gestao/MultiResponsaveisModal";
import { Users } from "lucide-react";
import pageStyles from "../../../styles/gestao/ClienteDetalhes.module.css";

function aplicarMascaraCnpjCpf(valor, tipo) {
  let apenasNumeros = valor.replace(/\D/g, "");
  if (tipo === "CNPJ") {
    apenasNumeros = apenasNumeros.slice(0, 14);
    // 00.000.000/0000-00
    return apenasNumeros
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5");
  }
  if (tipo === "CPF") {
    apenasNumeros = apenasNumeros.slice(0, 11);
    // 000.000.000-00
    return apenasNumeros
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
  }
  return valor;
}

// tipos removidos (JS)

export default function ClienteDetalhes() {
  const router = useRouter();
  const { id } = router.query;
  const [cliente, setCliente] = useState({});
  const [abaAtiva, setAbaAtiva] = useState(0);
  const [enquetes, setEnquetes] = useState([]);
  const [respostasSelecionadas, setRespostasSelecionadas] = useState([]);
  const [obrigacoesCliente, setObrigacoesCliente] = useState([]);
  const [todosDepartamentos, setTodosDepartamentos] = useState([]);
  const [carregandoPerfil, setCarregandoPerfil] = useState(false);
  const [carregandoEnquetes, setCarregandoEnquetes] = useState(false);
  const [carregandoDepartamentos, setCarregandoDepartamentos] = useState(false);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [clienteExcluir, setClienteExcluir] = useState(null); // Armazena o cliente a ser excluído
  const [grupos, setGrupos] = useState([]); //Buscar Grupos
  const [doresOptions, setDoresOptions] = useState([]);
  const [solucoesOptions, setSolucoesOptions] = useState([]);
  const [mapaDoresSolucoes, setMapaDoresSolucoes] = useState({});

  // Estados para a aba de Pesquisa de Satisfação
  const [pesquisasSatisfacao, setPesquisasSatisfacao] = useState([]);
  const [carregandoPesquisas, setCarregandoPesquisas] = useState(false);
  const [filtroPeriodoPesquisa, setFiltroPeriodoPesquisa] = useState("todos");

  // Estados para o modal de pesquisa manual
  const [modalPesquisaManual, setModalPesquisaManual] = useState(false);
  const [enviandoPesquisa, setEnviandoPesquisa] = useState(false);
  const [pesquisaManual, setPesquisaManual] = useState({
    dataEnvio: "",
    dataResposta: "",
    nota: "",
    comentario: "",
    status: "respondido"
  });

  // Estados para a aba de Responsáveis
  const [usuariosPorDepartamento, setUsuariosPorDepartamento] = useState({});
  const [responsaveisAtuais, setResponsaveisAtuais] = useState({});
  const [carregandoResponsaveis, setCarregandoResponsaveis] = useState(false);

  // Estados para filtros da aba de responsáveis
  const [filtroDepartamentoResponsaveis, setFiltroDepartamentoResponsaveis] = useState("");
  const [filtroResponsavelVinculado, setFiltroResponsavelVinculado] = useState("");
  const [filtroCargoResponsavel, setFiltroCargoResponsavel] = useState("");
  const [apenasObrigacoesSemResponsavel, setApenasObrigacoesSemResponsavel] = useState(false);
  const [responsavelSelecionado, setResponsavelSelecionado] = useState("");
  const [responsaveisCarteira, setResponsaveisCarteira] = useState([]);

  // Estados para modal de responsável individual
  const [modalResponsavelIndividual, setModalResponsavelIndividual] = useState(false);
  const [obrigacaoSelecionada, setObrigacaoSelecionada] = useState(null);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState([]);
  const [responsavelIndividualSelecionado, setResponsavelIndividualSelecionado] = useState("");

  // Estados para modal de múltiplos responsáveis
  const [modalMultiResponsaveis, setModalMultiResponsaveis] = useState(false);
  const [clienteMultiResponsaveis, setClienteMultiResponsaveis] = useState(null);
  const [multiResponsaveis, setMultiResponsaveis] = useState({});

  // Estados para modal de replicar perfil
  const [modalReplicarPerfil, setModalReplicarPerfil] = useState(false);
  const [clientesDisponiveis, setClientesDisponiveis] = useState([]);
  const [clientesSelecionados, setClientesSelecionados] = useState([]);
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [replicandoPerfil, setReplicandoPerfil] = useState(false);
  const [particularidadesCliente, setParticularidadesCliente] = useState([]);
  const [carregandoParticularidades, setCarregandoParticularidades] = useState(false);
  const [pesquisaClientes, setPesquisaClientes] = useState("");

  // Estados para a aba de Gerar Tarefas
  const [filtrosGerarTarefas, setFiltrosGerarTarefas] = useState({
    departamento: "Todos",
    anoCalendario: new Date().getFullYear().toString(),
    vencimentoAPartir: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][new Date().getMonth()],
    competenciaAte: "Dezembro"
  });
  const [obrigacoesParaGerar, setObrigacoesParaGerar] = useState([]);
  const [obrigacoesSelecionadas, setObrigacoesSelecionadas] = useState([]);

  const [carregandoObrigacoesGerar, setCarregandoObrigacoesGerar] = useState(false);
  const [atualizandoObrigacoes, setAtualizandoObrigacoes] = useState(false);
  const [filtroAtualizado, setFiltroAtualizado] = useState(false);
  const [debounceTimeout, setDebounceTimeout] = useState(null);
  
  // ✅ NOVO: Estado para controlar o loading da geração de tarefas
  const [gerandoTarefas, setGerandoTarefas] = useState(false);

  // Estados para campos adicionais
  const [modalCamposAdicionais, setModalCamposAdicionais] = useState(false);
  const [camposAdicionais, setCamposAdicionais] = useState([]);
  const [valoresCamposAdicionais, setValoresCamposAdicionais] = useState({});
  const [carregandoCamposAdicionais, setCarregandoCamposAdicionais] = useState(false);
  const [salvandoCamposAdicionais, setSalvandoCamposAdicionais] = useState(false);
  const [novoCampoNome, setNovoCampoNome] = useState("");
  const [isLight, setIsLight] = useState(false);



  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: 38,
      borderRadius: 6,
      borderColor: "var(--onity-color-border)",
      fontSize: 13,
      backgroundColor: "var(--onity-color-surface)",
      color: "var(--onity-color-text)",
      outline: "none",
      boxShadow: "none",
      ...(state.isFocused ? { 
        borderColor: "var(--onity-color-primary-hover)",
        boxShadow: "var(--onity-elev-low)"
      } : {}),
    }),
    placeholder: (base) => ({
      ...base,
      color: "var(--onity-color-text)",
      opacity: 0.6,
      opacity: 1,
      fontWeight: 400,
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: "var(--onity-color-primary)",
      margin: 0,
      border: "1px solid var(--onity-color-primary-hover)",
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: "white",
      fontWeight: 500,
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: "white",
      ":hover": {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        color: "white",
      }
    }),
    valueContainer: (base) => ({
      ...base,
      flexWrap: "nowrap",
      gap: 4,
      color: "var(--onity-color-text)",
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? "var(--onity-color-primary)"
        : state.isFocused
          ? "var(--onity-color-bg)"
          : "var(--onity-color-surface)",
      color: state.isSelected ? "white" : "var(--onity-color-text)",
      cursor: "pointer",
      boxShadow: "none",
      outline: "none",
      border: "none",
      padding: "8px 12px",
      transition: "background-color 0.2s ease",
    }),
    menu: (base) => ({
      ...base,
      zIndex: 9999,
      backgroundColor: "var(--onity-color-surface)",
      border: "1px solid var(--onity-color-border)",
      borderRadius: "6px",
      boxShadow: "var(--onity-elev-high)",
    }),
    menuList: (base) => ({
      ...base,
      boxShadow: "none",
      outline: "none",
      padding: "4px 0",
    }),
  };

  // Detecta o tema atual e reage a mudanças globais (para modais locais desta página)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const getTheme = () => document.documentElement.getAttribute("data-theme") === "light";
    setIsLight(getTheme());
    const handleChange = (e) => {
      const detail = e && e.detail ? e.detail : {};
      if (detail && (detail.theme === "light" || detail.theme === "dark")) {
        setIsLight(detail.theme === "light");
      } else {
        setIsLight(getTheme());
      }
    };
    window.addEventListener("titan-theme-change", handleChange);
    return () => window.removeEventListener("titan-theme-change", handleChange);
  }, []);

  // Estados para paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [ordenacao, setOrdenacao] = useState('mais_recente');

  // Funções auxiliares para classificação
  const getClassificacaoColor = (classificacao) => {
    switch (classificacao) {
      case 'promotor':
      case 'sala_verde':
        return '#10b981'; // verde
      case 'passivo':
      case 'sala_amarela':
        return '#f59e0b'; // amarelo
      case 'detrator':
      case 'sala_vermelha':
        return '#ef4444'; // vermelho
      default:
        return '#6b7280'; // cinza
    }
  };

  const getClassificacaoLabel = (classificacao) => {
    switch (classificacao) {
      case 'promotor':
      case 'sala_verde':
        return 'Sala Verde';
      case 'passivo':
      case 'sala_amarela':
        return 'Sala Amarela';
      case 'detrator':
      case 'sala_vermelha':
        return 'Sala Vermelha';
      default:
        return 'Sem resposta';
    }
  };

  useEffect(() => {
    const fetchCliente = async () => {
      if (!id) return;
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      try {
        const res = await api.get(`/gestao/clientes/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCliente(res.data);
      } catch (err) {
        console.error("Erro ao carregar cliente:", err);
      }
    };
    fetchCliente();
  }, [id]);

  // Carregar campos adicionais quando o cliente for carregado
  useEffect(() => {
    if (cliente?.empresaId) {
      buscarCamposAdicionais();
      buscarValoresCamposAdicionais();
    }
  }, [cliente?.empresaId]);

  // Função de Exclusão
  const excluirCliente = async () => {
    const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
    if (!token || !clienteExcluir?.id) return;

    try {
      await api.delete(`/gestao/clientes/${clienteExcluir.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Cliente excluído com sucesso!");
      router.push("/dashboard/clientes");
    } catch (error) {
      console.error("Erro ao excluir cliente:", error);
      toast.error("Erro ao excluir cliente.");
    } finally {
      setModalVisivel(false);
    }
  };

  useEffect(() => {
    const fetchGrupos = async () => {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      const empresaId = sessionStorage.getItem("empresaId");
      if (!token || !empresaId) return;
      try {
        const res = await api.get("/gestao/clientes/grupos/todos", {
          params: { empresaId },
          headers: { Authorization: `Bearer ${token}` },
        });
        setGrupos(res.data.grupos || []);
      } catch (err) {
        console.error("Erro ao buscar grupos:", err);
      }
    };
    fetchGrupos();
  }, []);

  useEffect(() => {
    if (!cliente?.id) return;
    async function fetchGruposDoCliente() {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      const res = await api.get(`/gestao/clientes/${cliente.id}/grupos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Salva só os IDs dos grupos vinculados
      const gruposArray = Array.isArray(res.data)
        ? res.data
        : (res.data && Array.isArray(res.data.grupos))
          ? res.data.grupos
          : (res.data && Array.isArray(res.data.data))
            ? res.data.data
            : [];
      setCliente((c) => ({
        ...c,
        grupoIds: gruposArray.map((g) => g.id),
      }));
    }
    fetchGruposDoCliente();
  }, [cliente?.id]);



  useEffect(() => {
    const fetchObrigacoes = async () => {
      if (!id) return;
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      try {
        const res = await api.get(`/gestao/obrigacoes/cliente/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setObrigacoesCliente(res.data);
      } catch (err) {
        console.error("Erro ao buscar obrigações do cliente:", err);
      }
    };
    if (abaAtiva === 3) fetchObrigacoes();
  }, [abaAtiva, id]);

  useEffect(() => {
    const carregarRespostasSelecionadas = async () => {
      if (!id) return;
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      try {
        const res = await api.get(`/gestao/enquete/respostas-cliente/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { empresaId: getEmpresaId() }
        });
        setRespostasSelecionadas(res.data);
      } catch (err) {
        if (err.response?.status === 404) {
          setRespostasSelecionadas([]); // Nenhuma resposta salva ainda
        } else {
          console.error("Erro ao buscar respostas do cliente:", err);
        }
      }
    };
    if (abaAtiva === 3) carregarRespostasSelecionadas();
  }, [abaAtiva, id]);


  // 1. MANTENHA ESTE useEffect para ENQUETES
  useEffect(() => {
    const fetchEnquetes = async () => {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      setCarregandoEnquetes(true);
      try {
        const res = await api.get("/gestao/enquete/arvore", {
          headers: { Authorization: `Bearer ${token}` },
          params: { empresaId: getEmpresaId() }
        });
        setEnquetes(res.data);
      } catch (err) {
        console.error("Erro ao carregar enquetes:", err);
      } finally {
        setCarregandoEnquetes(false);
      }
    };
    if (abaAtiva === 3) fetchEnquetes();
  }, [abaAtiva]);

  // useEffect para Pesquisas de Satisfação
  useEffect(() => {
    const fetchPesquisasSatisfacao = async () => {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      if (!token || !id) return;

      setCarregandoPesquisas(true);
      try {
        const res = await api.get(`/gestao/pesquisa/cliente/${id}?periodo=${filtroPeriodoPesquisa}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const lista = Array.isArray(res.data)
          ? res.data
          : (res.data && Array.isArray(res.data.data))
            ? res.data.data
            : [];
        setPesquisasSatisfacao(lista);
      } catch (err) {
        console.error("Erro ao buscar pesquisas de satisfação:", err);
        toast.error("Erro ao carregar pesquisas de satisfação");
      } finally {
        setCarregandoPesquisas(false);
      }
    };
    if (abaAtiva === 2) fetchPesquisasSatisfacao();
  }, [abaAtiva, id, filtroPeriodoPesquisa]);

  // 2. MANTENHA ESTE useEffect para DEPARTAMENTOS + OBRIGAÇÕES
  useEffect(() => {
    const fetchDepartamentosEObrigacoes = async () => {
      if (!id) return;
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      setCarregandoDepartamentos(true);

      try {
        const res = await api.get(`/gestao/obrigacoes/cliente/${id}/com-departamentos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTodosDepartamentos(res.data.departamentos);
        
        // ✅ NOVO: Buscar responsáveis globais para cada obrigação
        const obrigacoesComResponsaveisGlobais = await Promise.all(
          res.data.obrigacoes.map(async (obrigacao) => {
            try {
              const responsaveisGlobais = await buscarResponsaveisGlobais(obrigacao.id);
              return {
                ...obrigacao,
                responsaveisGlobais: responsaveisGlobais
              };
            } catch (err) {
              console.log(`Erro ao buscar responsáveis globais para obrigação ${obrigacao.id}:`, err);
              return {
                ...obrigacao,
                responsaveisGlobais: []
              };
            }
          })
        );
        
        setObrigacoesCliente(obrigacoesComResponsaveisGlobais);
      } catch (err) {
        console.error("Erro ao buscar departamentos e obrigações:", err);
      } finally {
        setCarregandoDepartamentos(false);
      }
    };

    if (abaAtiva === 3) fetchDepartamentosEObrigacoes();
  }, [abaAtiva, id]);

  useEffect(() => {
    console.log("Departamentos:", todosDepartamentos);
    console.log("Obrigações do cliente:", obrigacoesCliente);
  }, [todosDepartamentos, obrigacoesCliente]);

  // Calcula o estado geral de carregamento do perfil
  useEffect(() => {
    setCarregandoPerfil(carregandoEnquetes || carregandoDepartamentos);
  }, [carregandoEnquetes, carregandoDepartamentos]);

  useEffect(() => {
    api.get("/gestao/clientes/dores").then(res => {
      setDoresOptions(res.data.map((d) => ({ value: d, label: d })));
    });
    api.get("/gestao/clientes/solucoes").then(res => {
      setSolucoesOptions(res.data.map((s) => ({ value: s, label: s })));
    });
    api.get("/gestao/clientes/mapa-dores-solucoes").then(res => {
      setMapaDoresSolucoes(res.data);
    });
  }, []);

  // Filtra as soluções possíveis conforme as dores selecionadas
  const doresSelecionadas = cliente?.dores || [];
  const solucoesPossiveis = Array.from(new Set(
    doresSelecionadas.flatMap((dor) => mapaDoresSolucoes[dor] || [])
  ));
  const solucoesOptionsFiltradas = solucoesOptions.filter(opt => solucoesPossiveis.includes(opt.value));
  // Remove soluções incompatíveis do cliente.solucoes
  useEffect(() => {
    if (!cliente?.solucoes) return;
    const novasSolucoes = (cliente.solucoes).filter((s) => solucoesPossiveis.includes(s));
    if (novasSolucoes.length !== (cliente.solucoes?.length || 0)) {
      setCliente((c) => ({ ...c, solucoes: novasSolucoes }));
    }
    // eslint-disable-next-line
  }, [JSON.stringify(doresSelecionadas), JSON.stringify(mapaDoresSolucoes)]);

  // Funções para a aba de Responsáveis
  const buscarUsuariosPorDepartamento = async (departamentoId) => {
    if (usuariosPorDepartamento[departamentoId]) return; // Já carregado

    const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
    try {
      const res = await api.get(`/gestao/departamentos/${departamentoId}/usuarios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsuariosPorDepartamento(prev => ({
        ...prev,
        [departamentoId]: res.data
      }));
    } catch (err) {
      console.error("Erro ao buscar usuários do departamento:", err);
    }
  };

  const buscarResponsaveisAtuais = async () => {
    if (!cliente?.id || obrigacoesCliente.length === 0) return;

    setCarregandoResponsaveis(true);
    const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;

    try {
      const responsaveis = {};
      const multiResponsaveisTemp = {};

      // ✅ NOVO: Buscar responsável atual, múltiplos responsáveis e responsáveis globais para cada obrigação
      for (const obrigacao of obrigacoesCliente) {
        try {
          // Buscar responsável individual
          const resIndividual = await api.get(`/gestao/obrigacoes/${obrigacao.id}/clientes/${cliente.id}/responsavel-fixo`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resIndividual.data) {
            responsaveis[obrigacao.id] = resIndividual.data;
          }

          // Buscar múltiplos responsáveis
          const resMulti = await api.get(`/gestao/obrigacoes/${obrigacao.id}/clientes/${cliente.id}/responsaveis`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resMulti.data && resMulti.data.length > 0) {
            // ✅ NOVO: Remover duplicatas baseado em usuarioId
            const responsaveisUnicos = resMulti.data.filter((resp, index, array) => {
              return array.findIndex(r => r.usuarioId === resp.usuarioId) === index;
            });
            console.log(`🔍 Responsáveis para obrigação ${obrigacao.id}:`, {
              originais: resMulti.data,
              unicos: responsaveisUnicos
            });
            multiResponsaveisTemp[obrigacao.id] = responsaveisUnicos;
          }

          // ✅ NOVO: Buscar responsáveis globais
          const responsaveisGlobais = await buscarResponsaveisGlobais(obrigacao.id);
          if (responsaveisGlobais.length > 0) {
            // Adicionar responsáveis globais à obrigação
            obrigacao.responsaveisGlobais = responsaveisGlobais;
          }
        } catch (err) {
          // Se não encontrar responsável, continua
          console.log(`Nenhum responsável encontrado para obrigação ${obrigacao.id}`);
        }
      }

      setResponsaveisAtuais(responsaveis);
      setMultiResponsaveis(multiResponsaveisTemp);
    } catch (err) {
      console.error("Erro ao buscar responsáveis atuais:", err);
    } finally {
      setCarregandoResponsaveis(false);
    }
  };

  const salvarResponsavel = async (obrigacaoId, usuarioId) => {
    const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
    if (!token || !cliente?.id) return;

    try {
      if (usuarioId === "remover" || usuarioId === null) {
        // Remover responsável
        await api.delete(`/gestao/obrigacoes/${obrigacaoId}/clientes/${cliente.id}/responsavel-fixo`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else if (usuarioId && typeof usuarioId === "number") {
        // Definir responsável
        await api.post(`/gestao/obrigacoes/${obrigacaoId}/clientes/${cliente.id}/responsavel-fixo`,
          { usuarioId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      // Atualizar estado local
      setResponsaveisAtuais(prev => ({
        ...prev,
        [obrigacaoId]: usuarioId && typeof usuarioId === "number" ?
          usuariosPorDepartamento[obrigacoesCliente.find(o => o.id === obrigacaoId)?.departamentoId]?.find(u => u.id === usuarioId) :
          null
      }));

      toast.success(usuarioId === "remover" || usuarioId === null ? "Responsável removido com sucesso!" : "Responsável atualizado com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar responsável:", err);
      toast.error("Erro ao salvar responsável.");
    }
  };

  // useEffect para carregar dados da aba de responsáveis
  useEffect(() => {
    if (abaAtiva === 4 && obrigacoesCliente.length > 0) {
      // Buscar usuários de todos os departamentos das obrigações
      const departamentosUnicos = [...new Set(obrigacoesCliente.map(o => o.departamentoId))];
      departamentosUnicos.forEach(depId => buscarUsuariosPorDepartamento(depId));

      // Buscar responsáveis atuais (incluindo múltiplos responsáveis)
      buscarResponsaveisAtuais();
    }
  }, [abaAtiva, obrigacoesCliente]);

  // Funções para a aba de Gerar Tarefas
  const buscarObrigacoesParaGerar = async () => {
    if (!cliente?.id) return;

    setCarregandoObrigacoesGerar(true);
    const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;

    try {
      const params = new URLSearchParams();
      params.append("clienteId", cliente.id.toString());
      params.append("ano", filtrosGerarTarefas.anoCalendario);

      if (filtrosGerarTarefas.departamento !== "Todos") {
        const departamentoId = typeof filtrosGerarTarefas.departamento === "number"
          ? filtrosGerarTarefas.departamento.toString()
          : filtrosGerarTarefas.departamento;
        params.append("departamentoId", departamentoId);
      }

      const res = await api.get(`/gestao/obrigacoes/para-gerar-tarefas?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // ✅ NOVO: Buscar responsáveis globais para cada obrigação
      if (res.data && res.data.length > 0) {
        const obrigacoesComResponsaveisGlobais = await Promise.all(
          res.data.map(async (obrigacao) => {
            try {
              const responsaveisGlobais = await buscarResponsaveisGlobais(obrigacao.id);
              return {
                ...obrigacao,
                responsaveisGlobais: responsaveisGlobais
              };
            } catch (err) {
              console.log(`Erro ao buscar responsáveis globais para obrigação ${obrigacao.id}:`, err);
              return {
                ...obrigacao,
                responsaveisGlobais: []
              };
            }
          })
        );

        setObrigacoesParaGerar(obrigacoesComResponsaveisGlobais);
        setObrigacoesSelecionadas([]);

        // Buscar responsáveis múltiplos para as obrigações encontradas
        const multiResponsaveisTemp = {};
        
        for (const obrigacao of obrigacoesComResponsaveisGlobais) {
          try {
            const resMulti = await api.get(`/gestao/obrigacoes/${obrigacao.id}/clientes/${cliente.id}/responsaveis`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (resMulti.data && resMulti.data.length > 0) {
              multiResponsaveisTemp[obrigacao.id] = resMulti.data;
            }
          } catch (err) {
            // Se não encontrar responsáveis, continua
            console.log(`Nenhum responsável múltiplo encontrado para obrigação ${obrigacao.id}`);
          }
        }
        
        setMultiResponsaveis(multiResponsaveisTemp);
      } else {
        setObrigacoesParaGerar([]);
        setObrigacoesSelecionadas([]);
      }
    } catch (err) {
      console.error("Erro ao buscar obrigações para gerar:", err);
    } finally {
      setCarregandoObrigacoesGerar(false);
    }
  };

  // Função para atualizar filtro de forma controlada
  const atualizarFiltroDepartamento = (novoDepartamento) => {
    // Evitar atualizações desnecessárias
    if (filtrosGerarTarefas.departamento === novoDepartamento) {
      return;
    }

    // Limpar timeout anterior se existir
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    setFiltrosGerarTarefas(prev => ({
      ...prev,
      departamento: novoDepartamento
    }));

    // Resetar para primeira página ao mudar filtros
    setPaginaAtual(1);

    // Debounce para evitar muitas chamadas seguidas
    const timeout = setTimeout(() => {
      setFiltroAtualizado(true);
    }, 300);

    setDebounceTimeout(timeout);
  };

  const gerarTarefas = async () => {
    // ✅ NOVO: Filtrar apenas obrigações com responsável (individual ou global)
    const obrigacoesComResponsavel = obrigacoesSelecionadas.filter(id => {
      const obrigacao = obrigacoesParaGerar.find(o => o.id === id);
      return obrigacao && verificarSeObrigacaoTemResponsavel(obrigacao);
    });

    if (obrigacoesComResponsavel.length === 0) {
      toast.error("Selecione pelo menos uma obrigação com responsável para gerar tarefas.");
      return;
    }

    const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
    if (!token || !cliente?.id) return;

    // ✅ NOVO: Ativar loading state
    setGerandoTarefas(true);

    try {
      await api.post("/api/obrigacoes/gerar-tarefas", {
        clienteId: cliente.id,
        obrigacaoIds: obrigacoesComResponsavel, // Usar apenas as com responsável
        ano: parseInt(filtrosGerarTarefas.anoCalendario),
        vencimentoAPartir: filtrosGerarTarefas.vencimentoAPartir,
        mesReferenciaAte: filtrosGerarTarefas.competenciaAte
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success("Tarefas geradas com sucesso!");
      setObrigacoesSelecionadas([]);

      // Recarregar obrigações
      await buscarObrigacoesParaGerar();
    } catch (err) {
      console.error("Erro ao gerar tarefas:", err);
      toast.error("Erro ao gerar tarefas.");
    } finally {
      // ✅ NOVO: Sempre desativar loading state
      setGerandoTarefas(false);
    }
  };

  const handleSelectAllObrigacoes = (checked) => {
    if (checked) {
      // ✅ NOVO: Selecionar apenas obrigações com responsável (individual ou global)
      const obrigacoesComResponsavel = obrigacoesParaGerar
        .filter(o => verificarSeObrigacaoTemResponsavel(o))
        .map(o => o.id);
      setObrigacoesSelecionadas(obrigacoesComResponsavel);
    } else {
      setObrigacoesSelecionadas([]);
    }
  };

  const handleSelectObrigacao = (obrigacaoId, checked) => {
    if (checked) {
      setObrigacoesSelecionadas(prev => [...prev, obrigacaoId]);
    } else {
      setObrigacoesSelecionadas(prev => prev.filter(id => id !== obrigacaoId));
    }
  };

  // Funções para a nova lógica de responsáveis
  const aplicarResponsavelDepartamento = async (usuarioId) => {
    if (!filtroDepartamentoResponsaveis) {
      toast.error("Selecione um departamento primeiro.");
      return;
    }

    const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
    if (!token || !cliente?.id) return;

    try {
      await api.post(`/gestao/clientes/${cliente.id}/responsaveis-departamento`, {
        departamentoId: parseInt(filtroDepartamentoResponsaveis),
        usuarioId: usuarioId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success("Responsável aplicado com sucesso!");

      // Recarregar responsáveis
      await buscarResponsaveisAtuais();
    } catch (err) {
      console.error("Erro ao aplicar responsável:", err);
      toast.error("Erro ao aplicar responsável.");
    }
  };

  const removerResponsavelCarteira = (usuarioId) => {
    setResponsaveisCarteira(prev => prev.filter(r => r.id !== usuarioId));
  };

  const adicionarResponsavelCarteira = () => {
    if (!responsavelSelecionado) return;

    const usuario = responsaveisCarteira.find(u => u.id.toString() === responsavelSelecionado);
    if (usuario) {
      // O usuário já está na carteira (que agora é filtrada por departamento)
      // Então não precisamos adicionar novamente, apenas aplicar
      aplicarResponsavelDepartamento(usuario.id);
      setResponsavelSelecionado("");
    }
  };

  // Funções para modal de responsável individual
  const abrirModalResponsavelIndividual = async (obrigacaoId, obrigacaoNome, departamentoId) => {
    setObrigacaoSelecionada({ id: obrigacaoId, nome: obrigacaoNome });
    setResponsavelIndividualSelecionado("");

    // Buscar usuários do departamento da obrigação
    const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
    if (!token) return;

    try {
      const res = await api.get(`/gestao/usuarios/departamento/${departamentoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsuariosDisponiveis(res.data || []);
      setModalResponsavelIndividual(true);
    } catch (err) {
      console.error("Erro ao carregar usuários do departamento:", err);
      toast.error("Erro ao carregar usuários do departamento.");
    }
  };

  const fecharModalResponsavelIndividual = () => {
    setModalResponsavelIndividual(false);
    setObrigacaoSelecionada(null);
    setResponsavelIndividualSelecionado("");
    setUsuariosDisponiveis([]);
  };

  // Função para buscar múltiplos responsáveis
  const buscarMultiResponsaveis = async (obrigacaoId) => {
    if (!cliente?.id) return;
    
    try {
      const res = await api.get(`/gestao/obrigacoes/${obrigacaoId}/clientes/${cliente.id}/responsaveis`);
      
      // ✅ NOVO: Remover duplicatas baseado em usuarioId
      const responsaveisUnicos = (res.data || []).filter((resp, index, array) => {
        return array.findIndex(r => r.usuarioId === resp.usuarioId) === index;
      });
      
      console.log(`🔍 MultiResponsaveis para obrigação ${obrigacaoId}:`, {
        originais: res.data,
        unicos: responsaveisUnicos
      });
      
      setMultiResponsaveis(prev => ({
        ...prev,
        [obrigacaoId]: responsaveisUnicos
      }));
    } catch (error) {
      console.error("Erro ao buscar múltiplos responsáveis:", error);
    }
  };

  // Função para abrir modal de múltiplos responsáveis
  const abrirModalMultiResponsaveis = (obrigacaoId, obrigacaoNome) => {
    setClienteMultiResponsaveis({
      id: cliente?.id,
      nome: cliente?.razao_social || cliente?.nome,
      obrigacaoId,
      obrigacaoNome
    });
    setModalMultiResponsaveis(true);
    buscarMultiResponsaveis(obrigacaoId);
  };

  // Funções para modal de replicar perfil
  const abrirModalReplicarPerfil = async () => {
    setModalReplicarPerfil(true);
    setClientesSelecionados([]);
    setCarregandoClientes(true);
    setCarregandoParticularidades(true);
    
    try {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      const empresaId = sessionStorage.getItem("empresaId");
      
      if (!token || !empresaId || !cliente?.id) return;
      
      // Buscar particularidades do cliente da tabela cliente_respostas
      const resParticularidades = await api.get(`/gestao/clientes/${cliente.id}/particularidades`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      console.log("Particularidades do cliente:", resParticularidades.data);
      setParticularidadesCliente(resParticularidades.data || []);
      
      // Buscar TODOS os clientes (sem paginação)
      const res = await api.get(`/gestao/clientes/todos/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Debug: log da estrutura da resposta
      console.log("Resposta da API /gestao/clientes/todos:", res.data);
      
      // Verificar se res.data é um array e tratar adequadamente
      let clientesArray = [];
      if (Array.isArray(res.data)) {
        clientesArray = res.data;
      } else if (res.data && Array.isArray(res.data.clientes)) {
        clientesArray = res.data.clientes;
      } else if (res.data && Array.isArray(res.data.data)) {
        clientesArray = res.data.data;
      } else {
        console.warn("Estrutura inesperada da resposta:", res.data);
        clientesArray = [];
      }
      
      // Filtrar o cliente atual da lista
      const clientesFiltrados = clientesArray.filter((c) => c && (c.clienteId || c.id) !== cliente?.id);
      
      console.log("🔍 Clientes filtrados:", clientesFiltrados);
      console.log("🔍 Estrutura do primeiro cliente:", clientesFiltrados[0]);
      
      setClientesDisponiveis(clientesFiltrados);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      toast.error("Erro ao carregar dados para replicação");
      setClientesDisponiveis([]);
      setParticularidadesCliente([]);
    } finally {
      setCarregandoClientes(false);
      setCarregandoParticularidades(false);
    }
  };

  const replicarPerfil = async () => {
    if (clientesSelecionados.length === 0) {
      toast.error("Selecione pelo menos um cliente para replicar o perfil");
      return;
    }

    setReplicandoPerfil(true);
    
    try {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      if (!token || !cliente?.id) return;

      // Preparar dados para replicar - usar as particularidades reais
      const particularidadesMapeadas = particularidadesCliente.map(p => p.respostaId || p.id);
      
      const dadosParaReplicar = {
        clienteOrigemId: cliente.id,
        clienteDestinoIds: clientesSelecionados,
        particularidades: particularidadesMapeadas, // IDs das respostas/particularidades
        grupoIds: cliente.grupoIds || []
      };

      console.log("🔍 Dados para replicar:", dadosParaReplicar);
      console.log("🔍 Clientes selecionados:", clientesSelecionados);
      console.log("🔍 Particularidades originais:", particularidadesCliente);
      console.log("🔍 Particularidades mapeadas:", particularidadesMapeadas);
      console.log("🔍 Grupo IDs:", cliente.grupoIds);

      await api.post("/gestao/clientes/replicar-perfil", dadosParaReplicar, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success(`Perfil replicado com sucesso para ${clientesSelecionados.length} cliente(s)!`);
      setModalReplicarPerfil(false);
      setClientesSelecionados([]);
    } catch (err) {
      console.error("Erro ao replicar perfil:", err);
      toast.error("Erro ao replicar perfil");
    } finally {
      setReplicandoPerfil(false);
    }
  };

  const salvarResponsavelIndividual = async () => {
    if (!responsavelIndividualSelecionado || !obrigacaoSelecionada) return;

    const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
    if (!token || !cliente?.id) return;

    try {
      await api.post(`/gestao/obrigacoes/${obrigacaoSelecionada.id}/clientes/${cliente.id}/responsavel-fixo`,
        { usuarioId: parseInt(responsavelIndividualSelecionado) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Atualizar estado local
      const usuario = usuariosDisponiveis.find(u => u.id.toString() === responsavelIndividualSelecionado);
      if (usuario) {
        setResponsaveisAtuais(prev => ({
          ...prev,
          [obrigacaoSelecionada.id]: usuario
        }));
      }

      toast.success("Responsável adicionado com sucesso!");
      fecharModalResponsavelIndividual();
    } catch (err) {
      console.error("Erro ao adicionar responsável:", err);
      toast.error("Erro ao adicionar responsável.");
    }
  };



  // Computed values para filtros
  const obrigacoesFiltradas = useMemo(() => {
    let filtradas = obrigacoesCliente;

    // Filtro por departamento
    if (filtroDepartamentoResponsaveis) {
      filtradas = filtradas.filter(o => o.departamentoId === parseInt(filtroDepartamentoResponsaveis));
    }

    // Filtro por responsável vinculado
    if (filtroResponsavelVinculado === "com") {
      filtradas = filtradas.filter(o => responsaveisAtuais[o.id]);
    } else if (filtroResponsavelVinculado === "sem") {
      filtradas = filtradas.filter(o => !responsaveisAtuais[o.id]);
    }

    // Filtro por cargo do responsável
    if (filtroCargoResponsavel) {
      filtradas = filtradas.filter(o => {
        const responsavel = responsaveisAtuais[o.id];
        return responsavel && responsavel.cargoNome === filtroCargoResponsavel;
      });
    }

    // Filtro apenas obrigações sem responsável
    if (apenasObrigacoesSemResponsavel) {
      filtradas = filtradas.filter(o => !responsaveisAtuais[o.id]);
    }

    return filtradas;
  }, [obrigacoesCliente, filtroDepartamentoResponsaveis, filtroResponsavelVinculado, filtroCargoResponsavel, apenasObrigacoesSemResponsavel, responsaveisAtuais]);

  const usuariosDepartamentoFiltrado = useMemo(() => {
    if (!filtroDepartamentoResponsaveis) return [];
    const departamentoId = parseInt(filtroDepartamentoResponsaveis);
    return usuariosPorDepartamento[departamentoId] || [];
  }, [filtroDepartamentoResponsaveis, usuariosPorDepartamento]);



  const cargosResponsaveis = useMemo(() => {
    const cargos = new Set();
    Object.values(responsaveisAtuais).forEach(responsavel => {
      if (responsavel?.cargoNome) {
        cargos.add(responsavel.cargoNome);
      }
    });
    return Array.from(cargos);
  }, [responsaveisAtuais]);

  // useEffect para carregar dados da aba de gerar tarefas
  useEffect(() => {
    if (abaAtiva === 5 && cliente?.id) {
      buscarObrigacoesParaGerar();
    } else if (abaAtiva !== 5) {
      // Limpar estados quando sair da aba
      setObrigacoesParaGerar([]);
      setObrigacoesSelecionadas([]);
      setFiltroAtualizado(false);
      // Não limpar multiResponsaveis aqui para não afetar a aba de Responsáveis
    }
  }, [abaAtiva, cliente?.id]);

  // useEffect para monitorar mudanças no filtro e aplicar automaticamente
  useEffect(() => {
    if (filtroAtualizado && abaAtiva === 5 && cliente?.id) {
      buscarObrigacoesParaGerar();
      setFiltroAtualizado(false);
    }
  }, [filtroAtualizado, abaAtiva, cliente?.id]);

  // Cleanup do timeout quando componente for desmontado
  useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [debounceTimeout]);

  // useEffect para carregar dados da aba de responsáveis
  useEffect(() => {
    if (abaAtiva === 4) {
      buscarResponsaveisAtuais();
    }
  }, [abaAtiva, cliente?.id]);

  // useEffect para carregar usuários quando filtrar por departamento
  useEffect(() => {
    if (abaAtiva === 4 && filtroDepartamentoResponsaveis) {
      const carregarUsuariosDepartamento = async () => {
        const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
        if (!token || !cliente?.id) return;

        try {
          const departamentoId = parseInt(filtroDepartamentoResponsaveis);
          const res = await api.get(`/gestao/usuarios/departamento/${departamentoId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setResponsaveisCarteira(res.data || []);
        } catch (err) {
          console.error("Erro ao carregar usuários do departamento:", err);
          setResponsaveisCarteira([]);
        }
      };
      carregarUsuariosDepartamento();
    } else if (abaAtiva === 4 && !filtroDepartamentoResponsaveis) {
      // Se não há filtro, limpa a lista
      setResponsaveisCarteira([]);
    }
  }, [abaAtiva, filtroDepartamentoResponsaveis, cliente?.id]);

  // Função para enviar pesquisa para o cliente
  const enviarPesquisaCliente = async () => {
    try {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      if (!token || !id) return;

      setEnviandoPesquisa(true);
      const res = await api.post('/gestao/pesquisa/gerar-para-cliente', {
        clienteId: id
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.ok) {
        toast.success("Pesquisa enviada com sucesso!");
        // Recarrega as pesquisas
        const resPesquisas = await api.get(`/gestao/pesquisa/cliente/${id}?periodo=${filtroPeriodoPesquisa}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const lista = Array.isArray(resPesquisas.data)
          ? resPesquisas.data
          : (resPesquisas.data && Array.isArray(resPesquisas.data.data))
            ? resPesquisas.data.data
            : [];
        setPesquisasSatisfacao(lista);
      }
    } catch (err) {
      console.error("Erro ao enviar pesquisa:", err);
      if (err.response?.data?.error) {
        toast.error(err.response.data.error);
      } else {
        toast.error("Erro ao enviar pesquisa");
      }
    } finally {
      setEnviandoPesquisa(false);
    }
  };

  // Função para salvar pesquisa manual
  const salvarPesquisaManual = async () => {
    try {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      if (!token || !id) return;

      // Validações com toasts
      if (!pesquisaManual.dataEnvio && !pesquisaManual.dataResposta) {
        toast.error("Data de envio ou data de resposta é obrigatória");
        return;
      }

      if (!pesquisaManual.nota || pesquisaManual.nota.trim() === "") {
        toast.error("A nota é obrigatória");
        return;
      }

      if (pesquisaManual.dataEnvio && pesquisaManual.dataResposta) {
        const dataEnvio = new Date(pesquisaManual.dataEnvio);
        const dataResposta = new Date(pesquisaManual.dataResposta);
        if (dataEnvio > dataResposta) {
          toast.error("A data de envio não pode ser posterior à data de resposta");
          return;
        }
      }

      if (pesquisaManual.nota && (parseInt(pesquisaManual.nota) < 0 || parseInt(pesquisaManual.nota) > 10)) {
        toast.error("A nota deve estar entre 0 e 10");
        return;
      }

      setEnviandoPesquisa(true);

      // Determina a classificação NPS baseada na nota
      let nps_classificacao = 'sem_resposta';
      if (pesquisaManual.nota) {
        const nota = parseInt(pesquisaManual.nota);
        if (nota >= 7) nps_classificacao = 'promotor'; // Sala verde a partir de nota 7
        else if (nota === 5 || nota === 6) nps_classificacao = 'passivo'; // Sala amarela: notas 5 e 6
        else if (nota >= 0 && nota <= 4) nps_classificacao = 'detrator'; // Sala vermelha: notas 0 a 4
      }

      // Se não tem data de envio, usa a data de resposta
      const dataEnvio = pesquisaManual.dataEnvio || pesquisaManual.dataResposta;

      // Se status é respondido mas não tem data de resposta, usa data de envio
      const dataResposta = pesquisaManual.status === "respondido" && !pesquisaManual.dataResposta 
        ? dataEnvio 
        : pesquisaManual.dataResposta || null;

      const payload = {
        clienteId: id,
        dataEnvio: dataEnvio,
        dataResposta: dataResposta,
        nota: pesquisaManual.nota ? parseInt(pesquisaManual.nota) : null,
        comentario: pesquisaManual.comentario || null,
        status: pesquisaManual.status,
        nps_classificacao
      };

      const res = await api.post('/gestao/pesquisa/manual', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.ok) {
        toast.success("Pesquisa salva com sucesso!");
        setModalPesquisaManual(false);
        setPesquisaManual({
          dataEnvio: "",
          dataResposta: "",
          nota: "",
          comentario: "",
          status: "respondido"
        });
        
        // Recarrega as pesquisas
        const resPesquisas = await api.get(`/gestao/pesquisa/cliente/${id}?periodo=${filtroPeriodoPesquisa}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const lista = Array.isArray(resPesquisas.data)
          ? resPesquisas.data
          : (resPesquisas.data && Array.isArray(resPesquisas.data.data))
            ? resPesquisas.data.data
            : [];
        setPesquisasSatisfacao(lista);
      }
    } catch (err) {
      console.error("Erro ao salvar pesquisa manual:", err);
      if (err.response?.data?.error) {
        toast.error(err.response.data.error);
      } else {
        toast.error("Erro ao salvar pesquisa");
      }
    } finally {
      setEnviandoPesquisa(false);
    }
  };

  // ✅ NOVO: Função para buscar responsáveis fixos globais de uma obrigação
  const buscarResponsaveisGlobais = async (obrigacaoId) => {
    const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
    try {
      const res = await api.get(`/gestao/obrigacoes/${obrigacaoId}/responsaveis-fixos-globais`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`Responsáveis globais para obrigação ${obrigacaoId}:`, res.data);
      return res.data || [];
    } catch (err) {
      console.log(`Nenhum responsável global encontrado para obrigação ${obrigacaoId}:`, err);
      return [];
    }
  };

  // ✅ NOVO: Função para verificar se uma obrigação tem responsável (individual ou global)
  const verificarSeObrigacaoTemResponsavel = (obrigacao) => {
    // Verificar se tem responsável individual
    if (obrigacao.responsavelNome) {
      return true;
    }
    
    // Verificar se tem responsável global
    if (obrigacao.responsaveisGlobais && obrigacao.responsaveisGlobais.length > 0) {
      return true;
    }
    
    return false;
  };

  // ✅ NOVO: Função para obter nome do responsável (individual ou global)
  const obterNomeResponsavel = (obrigacao) => {
    // Priorizar responsável individual
    if (obrigacao.responsavelNome) {
      return obrigacao.responsavelNome;
    }
    
    // Se não tem individual, usar o primeiro responsável global
    if (obrigacao.responsaveisGlobais && obrigacao.responsaveisGlobais.length > 0) {
      const responsavelGlobal = obrigacao.responsaveisGlobais[0];
      return `${responsavelGlobal.nome} (Global)`;
    }
    
    return null;
  };

  // =====================================================
  // 📋 FUNÇÕES PARA CAMPOS ADICIONAIS
  // =====================================================

  // Buscar campos adicionais da empresa
  const buscarCamposAdicionais = async () => {
    if (!cliente?.empresaId) return;
    
    setCarregandoCamposAdicionais(true);
    try {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      const res = await api.get(`/gestao/campos-adicionais/${cliente.empresaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCamposAdicionais(res.data);
    } catch (error) {
      console.error("❌ Erro ao buscar campos adicionais:", error);
      toast.error("Erro ao buscar campos adicionais.");
    } finally {
      setCarregandoCamposAdicionais(false);
    }
  };

  // Buscar valores dos campos adicionais do cliente
  const buscarValoresCamposAdicionais = async () => {
    if (!id) return;
    
    try {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      const res = await api.get(`/gestao/campos-adicionais/cliente/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Converter array para objeto com chave sendo o campoAdicionalId
      const valoresObj = {};
      res.data.forEach((item) => {
        valoresObj[item.campoAdicionalId] = item.valor || "";
      });
      setValoresCamposAdicionais(valoresObj);
    } catch (error) {
      console.error("❌ Erro ao buscar valores dos campos:", error);
    }
  };

  // Abrir modal de campos adicionais
  const abrirModalCamposAdicionais = async () => {
    setModalCamposAdicionais(true);
    await buscarCamposAdicionais();
    await buscarValoresCamposAdicionais();
  };

  // Fechar modal de campos adicionais
  const fecharModalCamposAdicionais = () => {
    setModalCamposAdicionais(false);
    setNovoCampoNome("");
  };

  // Criar novo campo adicional
  const criarNovoCampo = async () => {
    if (!novoCampoNome.trim()) {
      toast.error("Nome do campo é obrigatório.");
      return;
    }
    
    if (!cliente?.empresaId) {
      toast.error("Empresa não encontrada no cliente.");
      return;
    }
    
    try {
    const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      await api.post("/api/campos-adicionais", {
        empresaId: cliente.empresaId,
        nome: novoCampoNome.trim(),
        tipo: "texto",
        obrigatorio: false,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      toast.success("Campo adicional criado com sucesso!");
      setNovoCampoNome("");
      await buscarCamposAdicionais();
    } catch (error) {
      console.error("❌ Erro ao criar campo adicional:", error);
      
      // Type-safe error message extraction
      let errorMessage = "Erro ao criar campo adicional";
      if (error && typeof error === 'object') {
        if ('response' in error && error.response && typeof error.response === 'object' && 
            'data' in error.response && error.response.data && typeof error.response.data === 'object' &&
            'error' in error.response.data) {
          errorMessage += `: ${error.response.data.error}`;
        } else if ('message' in error && typeof error.message === 'string') {
          errorMessage += `: ${error.message}`;
        }
      }
      
      toast.error(errorMessage);
    }
  };

  // Salvar valores dos campos adicionais
  const salvarValoresCamposAdicionais = async () => {
    if (!id) return;
    
    setSalvandoCamposAdicionais(true);
    try {
    const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      const campos = Object.entries(valoresCamposAdicionais).map(([campoAdicionalId, valor]) => ({
        campoAdicionalId: parseInt(campoAdicionalId),
        valor: valor || "",
      }));
      
      await api.post(`/gestao/campos-adicionais/cliente/${id}`, {
        campos,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      toast.success("Campos adicionais salvos com sucesso!");
      fecharModalCamposAdicionais();
    } catch (error) {
      console.error("❌ Erro ao salvar campos adicionais:", error);
      toast.error("Erro ao salvar campos adicionais.");
    } finally {
      setSalvandoCamposAdicionais(false);
    }
  };

  // Excluir campo adicional
  const excluirCampoAdicional = async (campoId) => {
    if (!confirm("Tem certeza que deseja excluir este campo? Esta ação não pode ser desfeita.")) return;
    
    try {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      await api.delete(`/gestao/campos-adicionais/${campoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      toast.success("Campo adicional excluído com sucesso!");
      await buscarCamposAdicionais();
    } catch (error) {
      console.error("❌ Erro ao excluir campo adicional:", error);
      toast.error("Erro ao excluir campo adicional.");
    }
  };

  // Aplicar máscara baseada no tipo do campo
  const aplicarMascaraCampo = (valor, tipo) => {
    if (tipo === "cnpj") {
      return aplicarMascaraCnpjCpf(valor, "CNPJ");
    } else if (tipo === "cpf") {
      return aplicarMascaraCnpjCpf(valor, "CPF");
    } else if (tipo === "telefone") {
      // Máscara simples para telefone
      const apenasNumeros = valor.replace(/\D/g, "");
      if (apenasNumeros.length <= 10) {
        return apenasNumeros.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
      } else {
        return apenasNumeros.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
      }
    }
    return valor;
  };

  
  const abas = [
    "Info",
    "Contatos",
    "Pesquisa de Satisfação",
    "Perfil",
    "Responsáveis",
    "Gerar Tarefas",
  ];

  return (
    <>
      <PrincipalSidebar />
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .css-12jo7m5-MultiValue {
          margin-right: 6px !important;
          margin-bottom: 0 !important;
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
      `}</style>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        toastClassName="custom-toast"
        closeButton={false}
      />
      <div className={pageStyles.container}>
        {/* Nome do Cliente */}
        <div className={pageStyles.headerCard}>
          <h1 className={pageStyles.title}>
            {cliente?.razao_social || cliente?.nome || "Carregando..."}
          </h1>
          <p className={pageStyles.subtitle}>
            ID: {cliente?.id} • {cliente?.tipo_inscricao}: {cliente?.cpf_cnpj}
          </p>
        </div>

        <div className={pageStyles.tabsContainer}>
          {abas.map((tab, i) => (
            <div
              key={i}
              onClick={() => setAbaAtiva(i)}
              className={i === abaAtiva ? `${pageStyles.tab} ${pageStyles.activeTab}` : pageStyles.tab}
            >
              {`${i + 1}. ${tab}`}
            </div>
          ))}
        </div>

        {/* Modal de Confirmação de Exclusão */}
        {modalVisivel && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}>
            <div style={{
              background: "rgba(11, 11, 17, 0.95)",
              borderRadius: "var(--titan-radius-lg)",
              maxWidth: "500px",
              width: "90%",
              padding: "var(--titan-spacing-xl)",
              boxShadow: "var(--titan-shadow-lg)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}>
              <h3 style={{
                margin: "0 0 var(--titan-spacing-lg) 0",
                fontSize: "var(--titan-font-size-lg)",
                fontWeight: "var(--titan-font-weight-semibold)",
                color: "var(--titan-text-high)",
                textAlign: "center"
              }}>
                Tem certeza que deseja excluir este cliente?
              </h3>
              <div style={{ 
                display: "flex", 
                gap: "var(--titan-spacing-md)",
                justifyContent: "center"
              }}>
                <button
                  style={{
                    padding: "var(--titan-spacing-sm) var(--titan-spacing-lg)",
                    background: "rgba(255, 255, 255, 0.15)",
                    color: "var(--titan-text-high)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "var(--titan-radius-sm)",
                    fontSize: "var(--titan-font-size-sm)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    cursor: "pointer",
                    transition: "all var(--titan-transition-fast)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--titan-input-bg)";
                    e.currentTarget.style.borderColor = "var(--titan-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                  }}
                  onClick={() => setModalVisivel(false)}
                >
                  Cancelar
                </button>
                <button
                  style={{
                    padding: "var(--titan-spacing-sm) var(--titan-spacing-lg)",
                    background: "var(--titan-error)",
                    color: "white",
                    border: "none",
                    borderRadius: "var(--titan-radius-sm)",
                    fontSize: "var(--titan-font-size-sm)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    cursor: "pointer",
                    transition: "all var(--titan-transition-fast)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.02)";
                    e.currentTarget.style.boxShadow = "var(--titan-glow-error)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  onClick={excluirCliente}
                >
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Responsável Individual */}
        {modalResponsavelIndividual && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}>
            <div style={{
              background: "rgba(11, 11, 17, 0.95)",
              borderRadius: "var(--titan-radius-lg)",
              maxWidth: "500px",
              width: "90%",
              padding: "var(--titan-spacing-xl)",
              boxShadow: "var(--titan-shadow-lg)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}>
              <h3 style={{
                margin: "0 0 var(--titan-spacing-lg) 0",
                fontSize: "var(--titan-font-size-lg)",
                fontWeight: "var(--titan-font-weight-semibold)",
                color: "var(--titan-text-high)",
                textAlign: "center"
              }}>
                Adicionar Responsável Individual
              </h3>
              <p style={{ 
                marginBottom: "var(--titan-spacing-lg)", 
                color: "var(--titan-text-med)",
                textAlign: "center"
              }}>
                Selecione um responsável para: <strong>{obrigacaoSelecionada?.nome}</strong>
              </p>

              <div style={{ marginBottom: "var(--titan-spacing-lg)" }}>
                <label style={{ 
                  display: "block", 
                  marginBottom: "var(--titan-spacing-sm)", 
                  fontWeight: "500",
                  color: "var(--titan-text-high)"
                }}>
                  Responsável:
                </label>
                <select
                  value={responsavelIndividualSelecionado}
                  onChange={(e) => setResponsavelIndividualSelecionado(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                    borderRadius: "var(--titan-radius-sm)",
                    border: "1px solid var(--titan-stroke)",
                    fontSize: "var(--titan-font-size-sm)",
                    background: "var(--titan-input-bg)",
                    color: "var(--titan-text-high)",
                    outline: "none"
                  }}
                >
                  <option value="">Selecione um responsável...</option>
                  {usuariosDisponiveis.map(usuario => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.nome} ({usuario.cargoNome || "Sem cargo"})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ 
                display: "flex", 
                gap: "var(--titan-spacing-md)",
                justifyContent: "center",
                marginTop: "var(--titan-spacing-lg)"
              }}>
                <button
                  style={{
                    padding: "var(--titan-spacing-sm) var(--titan-spacing-lg)",
                    background: "rgba(255, 255, 255, 0.15)",
                    color: "var(--titan-text-high)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "var(--titan-radius-sm)",
                    fontSize: "var(--titan-font-size-sm)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    cursor: "pointer",
                    transition: "all var(--titan-transition-fast)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--titan-input-bg)";
                    e.currentTarget.style.borderColor = "var(--titan-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                  }}
                  onClick={fecharModalResponsavelIndividual}
                >
                  Cancelar
                </button>
                <button
                  style={{
                    padding: "var(--titan-spacing-sm) var(--titan-spacing-lg)",
                    background: responsavelIndividualSelecionado ? "var(--titan-primary)" : "var(--titan-text-low)",
                    color: "white",
                    border: "none",
                    borderRadius: "var(--titan-radius-sm)",
                    fontSize: "var(--titan-font-size-sm)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    cursor: responsavelIndividualSelecionado ? "pointer" : "not-allowed",
                    transition: "all var(--titan-transition-fast)",
                    opacity: responsavelIndividualSelecionado ? 1 : 0.5
                  }}
                  onMouseEnter={(e) => {
                    if (responsavelIndividualSelecionado) {
                      e.currentTarget.style.transform = "scale(1.02)";
                      e.currentTarget.style.boxShadow = "var(--titan-glow-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (responsavelIndividualSelecionado) {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "none";
                    }
                  }}
                  onClick={salvarResponsavelIndividual}
                  disabled={!responsavelIndividualSelecionado}
                >
                  Adicionar Responsável
                </button>
              </div>
            </div>
          </div>
        )}


        <>
          {abaAtiva === 0 && (
            <div className={`${pageStyles.card} ${pageStyles.pLg}`}>
              <div className={pageStyles.grid12}>
                <div className={pageStyles.colSpan3}>
                  <label className={pageStyles.label}>Id</label>
                  <input value={cliente.id || ""} readOnly className={pageStyles.input} />
                </div>

                <div className={pageStyles.colSpan5}>
                  <label className={pageStyles.label}>CNPJ/CPF/CEI</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      className={pageStyles.input}
                      style={{ width: "30%" }}
                      value={cliente.tipo_inscricao || ""}
                      onChange={(e) => {
                        const tipo = e.target.value;
                        setCliente((c) => ({
                          ...c,
                          tipo_inscricao: tipo,
                          cpf_cnpj: "", // Limpa sempre que troca o tipo
                        }));
                      }}
                    >
                      <option value="">Selecione...</option>
                      <option value="CNPJ">CNPJ</option>
                      <option value="CPF">CPF</option>
                      <option value="CEI">CEI</option>
                    </select>
                    <input
                      value={cliente.cpf_cnpj || ""}
                      onChange={(e) => {
                        const tipo = cliente.tipo_inscricao; // "CNPJ", "CPF" ou "CEI"
                        let novoValor = e.target.value;
                        if (tipo === "CNPJ" || tipo === "CPF") {
                          novoValor = aplicarMascaraCnpjCpf(novoValor, tipo);
                        }
                        setCliente({ ...cliente, cpf_cnpj: novoValor });
                      }}
                      className={pageStyles.input}
                      style={{ width: "70%" }}
                      placeholder={
                        cliente.tipo_inscricao === "CNPJ"
                          ? "00.000.000/0000-00"
                          : cliente.tipo_inscricao === "CPF"
                            ? "000.000.000-00"
                            : ""
                      }
                    />

                  </div>
                </div>

                <div className={pageStyles.colSpan4} style={{ marginLeft: "-25px" }}>
                  <label className={pageStyles.label}>Responsável Legal</label>
                  <input
                    value={cliente.responsavel_legal || ""}
                    onChange={(e) =>
                      setCliente({ ...cliente, responsavel_legal: e.target.value })
                    }
                    className={pageStyles.input}
                  />
                </div>

                <div className={pageStyles.colSpan3}>
                  <label className={pageStyles.label}>Tipo</label>
                  <select
                    className={pageStyles.input}
                    value={cliente.tipo || ""}
                    onChange={(e) => setCliente({ ...cliente, tipo: e.target.value })}
                  >
                    <option value="Fixo">Fixo</option>
                    <option value="Eventual">Eventual</option>
                  </select>
                </div>

                <div className={pageStyles.colSpan3}>
                  <label className={pageStyles.label}>Sistema</label>
                  <input
                    value={cliente.sistema || ""}
                    onChange={(e) => setCliente({ ...cliente, sistema: e.target.value })}
                    className={pageStyles.input}
                    placeholder="Sistema"
                  />
                </div>

                <div className={pageStyles.colSpan3}>
                  <label className={pageStyles.label}>Base</label>
                  <input
                    value={cliente.base || ""}
                    onChange={(e) => setCliente({ ...cliente, base: e.target.value })}
                    className={pageStyles.input}
                    placeholder="Base"
                  />
                </div>

                <div className={pageStyles.colSpan3}>
                  <label className={pageStyles.label}>Código</label>
                  <input
                    value={cliente.codigo || ""}
                    onChange={(e) => setCliente({ ...cliente, codigo: e.target.value })}
                    className={pageStyles.input}
                    placeholder="Código"
                  />
                </div>

                <div className={pageStyles.colSpan5}>
                  <label className={pageStyles.label}>Nome</label>
                  <input
                    value={cliente.razao_social || ""}
                    onChange={(e) => setCliente({ ...cliente, razao_social: e.target.value })}
                    className={pageStyles.input}
                  />
                </div>

                <div className={pageStyles.colSpan4}>
                  <label className={pageStyles.label}>Apelido</label>
                  <input
                    value={cliente.apelido || ""}
                    onChange={(e) => setCliente({ ...cliente, apelido: e.target.value })}
                    className={pageStyles.input}
                  />
                </div>

                <div className={pageStyles.colSpan3}>
                  <label className={pageStyles.label}>Grupos</label>
                  <Select
                    instanceId="cliente-grupos-select"
                    isMulti
                    options={grupos.map(grupo => ({
                      value: grupo.id,
                      label: grupo.nome
                    }))}
                    value={(cliente.grupoIds || []).map((id) => {
                      const grupo = grupos.find((g) => g.id === id);
                      return grupo ? { value: grupo.id, label: grupo.nome } : null;
                    }).filter(Boolean)}
                    onChange={selected => {
                      setCliente({
                        ...cliente,
                        grupoIds: selected.map(opt => opt.value)
                      });
                    }}
                    placeholder="Selecione..."
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        minHeight: 38,
                        borderRadius: 6,
                        borderColor: "var(--onity-color-border)",
                        fontSize: 13,
                        backgroundColor: "var(--onity-color-surface)",
                        color: "var(--onity-color-text)",
                        outline: "none",
                        boxShadow: "none",
                        ...(state.isFocused ? { 
                          borderColor: "var(--onity-color-primary-hover)",
                          boxShadow: "var(--onity-elev-low)"
                        } : {}),
                      }),
                      placeholder: (base) => ({
                        ...base,
                        color: "var(--onity-color-text)",
                        opacity: 0.6,
                        opacity: 1,
                        fontWeight: 400,
                      }),
                      multiValue: (base) => ({
                        ...base,
                        backgroundColor: "var(--onity-color-primary)",
                        margin: 0,
                        border: "1px solid var(--onity-color-primary-hover)",
                      }),
                      multiValueLabel: (base) => ({
                        ...base,
                        color: "white",
                        fontWeight: 500,
                      }),
                      multiValueRemove: (base) => ({
                        ...base,
                        color: "white",
                        ":hover": {
                          backgroundColor: "rgba(255, 255, 255, 0.2)",
                          color: "white",
                        }
                      }),
                      valueContainer: (base) => ({
                        ...base,
                        flexWrap: "nowrap",
                        gap: 4,
                        color: "var(--onity-color-text)",
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? "var(--onity-color-primary)"
                          : state.isFocused
                            ? "var(--onity-color-bg)"
                            : "var(--onity-color-surface)",
                        color: state.isSelected ? "white" : "var(--onity-color-text)",
                        cursor: "pointer",
                        boxShadow: "none",
                        outline: "none",
                        border: "none",
                        padding: "8px 12px",
                        transition: "background-color 0.2s ease",
                      }),
                      menu: (base) => ({
                        ...base,
                        zIndex: 9999,
                        backgroundColor: "var(--onity-color-surface)",
                        border: "1px solid var(--onity-color-border)",
                        borderRadius: "6px",
                        boxShadow: "var(--onity-elev-high)",
                      }),
                      menuList: (base) => ({
                        ...base,
                        boxShadow: "none",
                        outline: "none",
                        padding: "4px 0",
                      }),
                    }}
                    menuPlacement="auto"
                  />
                  {/* CSS global para garantir chips lado a lado */}

                </div>


                <div className={pageStyles.colSpan3}>
                  <label className={pageStyles.label}>Dores do cliente</label>
                  <Select
                    instanceId="cliente-dores-select"
                    isMulti
                    options={doresOptions}
                    value={(cliente.dores || []).map((d) => ({ value: d, label: d }))}
                    onChange={selected => setCliente({ ...cliente, dores: selected.map((opt) => opt.value) })}
                    placeholder="Selecione as dores"
                    styles={selectStyles}
                  />
                </div>
                <div className={pageStyles.colSpan3}>
                  <label className={pageStyles.label}>Soluções oferecidas</label>
                  <Select
                    instanceId="cliente-solucoes-select"
                    isMulti
                    options={solucoesOptionsFiltradas}
                    value={(cliente.solucoes || []).map((s) => ({ value: s, label: s }))}
                    onChange={(selected) => setCliente({ ...cliente, solucoes: selected.map(opt => opt.value) })}
                    placeholder="Selecione as soluções"
                    styles={selectStyles}
                  />
                </div>

                <div className={pageStyles.colSpan3}>
                  <label className={pageStyles.label}>Data Início</label>
                  <input
                    type="date"
                    value={
                      cliente.data_inicio
                        ? new Date(cliente.data_inicio).toISOString().slice(0, 10)
                        : ""
                    }
                    onChange={(e) =>
                      setCliente({ ...cliente, data_inicio: e.target.value })
                    }
                    className={pageStyles.input}
                  />
                </div>

                <div className={pageStyles.colSpan3}>
                  <label className={pageStyles.label}>Data Fim</label>
                  <input
                    type="date"
                    value={
                      cliente.data_fim
                        ? new Date(cliente.data_fim).toISOString().slice(0, 10)
                        : ""
                    }
                    onChange={(e) => setCliente({ ...cliente, data_fim: e.target.value })}
                    className={pageStyles.input}
                  />
                </div>

                <div className={pageStyles.colSpan3}>
                  <label className={pageStyles.label}>Nascimento</label>
                  <input
                    type="date"
                    value={
                      cliente.data_nascimento
                        ? new Date(cliente.data_nascimento).toISOString().slice(0, 10)
                        : ""
                    }
                    onChange={(e) =>
                      setCliente({ ...cliente, data_nascimento: e.target.value })
                    }
                    className={pageStyles.input}
                  />
                </div>

                <div className={pageStyles.colSpan3}>
                  <label className={pageStyles.label}>Status</label>
                  <input
                    value={cliente.status || ""}
                    onChange={(e) => setCliente({ ...cliente, status: e.target.value })}
                    className={pageStyles.input}
                  />
                </div>

                <div className={pageStyles.colSpan12}>
                  <label className={pageStyles.label}>Observação</label>
                  <textarea
                    rows={Math.max(2, (cliente.observacoes || "").split('\n').length)}
                    className={pageStyles.textarea}
                    value={cliente.observacoes || ""}
                    onChange={(e) => setCliente({ ...cliente, observacoes: e.target.value })}
                  />
                </div>

                {/* Campos Adicionais integrados */}
                {camposAdicionais.map((campo, index) => (
                  <div key={campo.id} className={pageStyles.colSpan6} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label className={pageStyles.label}>{campo.nome}</label>
                    <input
                      type="text"
                      value={valoresCamposAdicionais[campo.id] || ""}
                      onChange={(e) => {
                        setValoresCamposAdicionais(prev => ({
                          ...prev,
                          [campo.id]: e.target.value
                        }));
                      }}
                      className={pageStyles.input}
                      placeholder={`Digite ${campo.nome.toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>

              <div className={pageStyles.actionsRow}>
                <button
                  className={pageStyles.btnPrimary}
                  onClick={async (e) => {
                    e.preventDefault();
                    try {
                      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
                      if (!token || !cliente.id) return;

                      // 1. Atualiza os dados do cliente
                      await api.patch(`/gestao/clientes/${cliente.id}`, {
                        ...mapClienteToBackend(cliente),
                        dores: cliente.dores || [],
                        solucoes: cliente.solucoes || [],
                      }, {
                        headers: { Authorization: `Bearer ${token}` },
                      });

                      // 2. Atualiza vínculos de grupos, se houver
                      if (cliente.grupoIds && cliente.grupoIds.length > 0) {
                        await api.post(
                          `/gestao/clientes/vincular-grupos`,
                          {
                            clienteId: cliente.id,
                            grupoIds: cliente.grupoIds,
                          },
                          {
                            headers: { Authorization: `Bearer ${token}` },
                          }
                        );
                      } else {
                        // Se não tem grupos, limpa os vínculos
                        await api.post(
                          `/gestao/clientes/vincular-grupos`,
                          {
                            clienteId: cliente.id,
                            grupoIds: [],
                          },
                          {
                            headers: { Authorization: `Bearer ${token}` },
                          }
                        );
                      }

                      toast.success("Cliente salvo com sucesso!");
                    } catch (error) {
                      console.error("Erro ao salvar cliente:", error);
                      toast.error("Erro ao salvar cliente.");
                    }
                  }}
                >
                  Salvar
                </button>


                <button
                  className={pageStyles.btnDanger}
                  onClick={() => {
                    setClienteExcluir(cliente); // Armazena o cliente a ser excluído
                    setModalVisivel(true); // Abre o modal de confirmação
                  }}
                >
                  Excluir
                </button>

                <button
                  className={pageStyles.btnPrimary}
                  onClick={abrirModalCamposAdicionais}
                >
                  Campo Adicional
                </button>

                {camposAdicionais.length > 0 && (
                  <button
                    onClick={salvarValoresCamposAdicionais}
                    disabled={salvandoCamposAdicionais}
                    className={pageStyles.btnSmallPrimary}
                  >
                    {salvandoCamposAdicionais ? (
                      <>
                        <div style={{ width: "16px", height: "16px" }}>
                    <svg className={pageStyles.spinner} width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </div>
                        Salvando...
                      </>
                    ) : (
                      "Salvar Campos"
                    )}
                  </button>
                )}
              </div>


            </div>
          )}

          {abaAtiva === 1 && (
            <div className={`${pageStyles.card} ${pageStyles.pLg}`}>
              <div className={`${pageStyles.grid12} ${pageStyles.mbLg}`}>
                <div className={pageStyles.colSpan6}>
                  <label className={pageStyles.label}>Telefone</label>
                  <input
                    type="tel"
                    value={cliente.telefone_comercial || cliente.telefone || ""}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, ""); // só números
                      if (val.length > 11) val = val.slice(0, 11); // máximo 11 dígitos
                      // máscara (00) 00000-0000
                      if (val.length > 6) {
                        val = val.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
                      } else if (val.length > 2) {
                        val = val.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
                      } else if (val.length > 0) {
                        val = val.replace(/^(\d*)/, "($1");
                      }
                      setCliente({ ...cliente, telefone_comercial: val, telefone: val });
                    }}
                    className={pageStyles.input}
                    placeholder="(00) 000000-0000"
                    maxLength={15}
                  />
                </div>
                <div className={pageStyles.colSpan6}>
                  <label className={pageStyles.label}>Email</label>
                  <input
                    type="email"
                    value={cliente.email_principal || cliente.email || ""}
                    onChange={(e) => setCliente({ ...cliente, email_principal: e.target.value, email: e.target.value })}
                    className={pageStyles.input}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className={pageStyles.colSpan12}>
                </div>
              </div>
              <div className={pageStyles.grid12}>
                <div className={pageStyles.colSpan4}>
                  <label className={pageStyles.label}>Rua</label>
                  <input
                    value={cliente.rua || ""}
                    onChange={(e) => setCliente({ ...cliente, rua: e.target.value })}
                    className={pageStyles.input}
                    placeholder="Rua Exemplo"
                  />
                </div>
                <div className={pageStyles.colSpan4}>
                  <label className={pageStyles.label}>Complemento</label>
                  <input
                    value={cliente.complemento || ""}
                    onChange={(e) => setCliente({ ...cliente, complemento: e.target.value })}
                    className={pageStyles.input}
                    placeholder="Apto, sala, etc."
                  />
                </div>
                <div className={pageStyles.colSpan4}>
                  <label className={pageStyles.label}>Bairro</label>
                  <input
                    value={cliente.bairro || ""}
                    onChange={(e) => setCliente({ ...cliente, bairro: e.target.value })}
                    className={pageStyles.input}
                    placeholder="Bairro"
                  />
                </div>
                <div className={pageStyles.colSpan4}>
                  <label className={pageStyles.label}>Cidade</label>
                  <input
                    value={cliente.cidade || ""}
                    onChange={(e) => setCliente({ ...cliente, cidade: e.target.value })}
                    className={pageStyles.input}
                    placeholder="Cidade"
                  />
                </div>
                <div className={pageStyles.colSpan4}>
                  <label className={pageStyles.label}>Estado</label>
                  <input
                    value={cliente.estado || ""}
                    onChange={(e) => setCliente({ ...cliente, estado: e.target.value })}
                    className={pageStyles.input}
                    placeholder="Estado"
                  />
                </div>
                <div className={pageStyles.colSpan4}>
                  <label className={pageStyles.label}>CEP</label>
                  <input
                    value={cliente.cep || ""}
                    onChange={(e) => setCliente({ ...cliente, cep: e.target.value })}
                    className={pageStyles.input}
                    placeholder="00000-000"
                  />
                </div>
                <div className={pageStyles.colSpan4}>
                  <label className={pageStyles.label}>País</label>
                  <input
                    value={cliente.pais || ""}
                    onChange={(e) => setCliente({ ...cliente, pais: e.target.value })}
                    className={pageStyles.input}
                    placeholder="País"
                  />
                </div>
              </div>
              <div className={pageStyles.mbMd}>
                <button
                  className={pageStyles.btnPrimary}
                  onClick={async (e) => {
                    e.preventDefault();
                    try {
                      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
                      if (!token || !cliente.id) return;

                      // Realiza o PATCH para salvar as alterações
                      await api.patch(`/gestao/clientes/${cliente.id}`, mapClienteToBackend(cliente), {
                        headers: { Authorization: `Bearer ${token}` },
                      });


                      toast.success("Contatos e endereço atualizados com sucesso!");
                    } catch (error) {
                      console.error("Erro ao atualizar contatos e endereço:", error);
                      toast.error("Erro ao atualizar contatos e endereço.");
                    }
                  }}
                >
                  Salvar
                </button>
              </div>
            </div>
          )}

          {abaAtiva === 2 && (
            <div className={`${pageStyles.card} ${pageStyles.pLg}`}>
              <div className={pageStyles.mbLg}>
                <h2 className={pageStyles.title}>Pesquisas de Satisfação</h2>
                <p className={pageStyles.subtitle}>Histórico das pesquisas de satisfação enviadas para este cliente.</p>
              </div>

              {/* Filtros e Botões de Ação */}
              <div className={`${pageStyles.cardSm} ${pageStyles.pMd} ${pageStyles.mbMd}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {/* Filtros */}
                <div style={{ display: "flex", gap: 16 }}>
                  <div>
                    <label className={pageStyles.label}>Período</label>
                    <select
                      value={filtroPeriodoPesquisa}
                      onChange={(e) => setFiltroPeriodoPesquisa(e.target.value)}
                      className={pageStyles.input}
                    >
                      <option value="todos">Todos os períodos</option>
                      <option value="3m">Últimos 3 meses</option>
                      <option value="6m">Últimos 6 meses</option>
                      <option value="1a">Último ano</option>
                    </select>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={enviarPesquisaCliente}
                    disabled={enviandoPesquisa}
                    style={{
                      padding: "10px 16px",
                      background: "var(--onity-color-primary)",
                      color: "var(--onity-color-primary-contrast)",
                      border: "1px solid var(--onity-color-border)",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: enviandoPesquisa ? "not-allowed" : "pointer",
                      opacity: enviandoPesquisa ? 0.6 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      if (!enviandoPesquisa) {
                        e.currentTarget.style.background = "var(--onity-color-primary-hover)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!enviandoPesquisa) {
                        e.currentTarget.style.background = "var(--onity-color-primary)";
                      }
                    }}
                  >
                    {enviandoPesquisa ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={pageStyles.spinner}>
                          <path d="M21 12a9 9 0 11-6.219-8.56" />
                        </svg>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 2L11 13" />
                          <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                        </svg>
                        Enviar Pesquisa
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setModalPesquisaManual(true)}
                    style={{
                      padding: "10px 16px",
                      background: "var(--onity-color-primary)",
                      color: "var(--onity-color-primary-contrast)",
                      border: "1px solid var(--onity-color-border)",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.filter = "";
                      e.currentTarget.style.background = "var(--onity-color-primary-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = "";
                      e.currentTarget.style.background = "var(--onity-color-primary)";
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Adicionar Manualmente
                  </button>
                </div>
              </div>

              {/* Controles de Ordenação e Paginação */}
              <div className={pageStyles.controlsBar}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px"
                }}>
                  <label className={pageStyles.label}>
                    Ordenar por:
                  </label>
                  <select
                    value={ordenacao}
                    onChange={(e) => {
                      setOrdenacao(e.target.value);
                      setPaginaAtual(1); // Volta para primeira página
                    }}
                    className={pageStyles.input}
                  >
                    <option value="mais_recente">Mais recente primeiro</option>
                    <option value="mais_antiga">Mais antiga primeiro</option>
                  </select>
                </div>
                
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: "var(--titan-text-med)"
                }}>
                  <span>
                    {Math.min((paginaAtual - 1) * itensPorPagina + 1, pesquisasSatisfacao.length)} - {Math.min(paginaAtual * itensPorPagina, pesquisasSatisfacao.length)} de {pesquisasSatisfacao.length}
                  </span>
                </div>
              </div>

              {carregandoPesquisas ? (
                <div className={pageStyles.loadingState}>
                  <div className={pageStyles.spinner} style={{ margin: "0 auto 16px", width: "32px", height: "32px" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  Carregando pesquisas...
                </div>
              ) : pesquisasSatisfacao.length === 0 ? (
                <div className={pageStyles.emptyState}>
                  Nenhuma pesquisa encontrada
                </div>
              ) : (
                <>
                  {/* Tabela com ordenação e paginação */}
                  <div className={pageStyles.tableWrap}>
                    <table className={pageStyles.table}>
                      <thead>
                        <tr className={pageStyles.theadRow}>
                          <th className={pageStyles.th}>#</th>
                          <th className={pageStyles.th}>Data Envio</th>
                          <th className={pageStyles.th}>Data Resposta</th>
                          <th className={pageStyles.th}>Nota</th>
                          <th className={pageStyles.th}>Classificação</th>
                          <th className={pageStyles.th}>Status</th>
                          <th className={pageStyles.th}>Comentário</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pesquisasSatisfacao
                          .sort((a, b) => {
                            const dataA = new Date(a.dataResposta || a.dataEnvio);
                            const dataB = new Date(b.dataResposta || b.dataEnvio);
                            return ordenacao === 'mais_recente' 
                              ? dataB.getTime() - dataA.getTime()
                              : dataA.getTime() - dataB.getTime();
                          })
                          .slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina)
                          .map((pesquisa, index) => {
                            const dataEnvio = pesquisa.dataEnvio ? new Date(pesquisa.dataEnvio).toLocaleDateString('pt-BR') : '-';
                            const dataResposta = pesquisa.dataResposta ? new Date(pesquisa.dataResposta).toLocaleDateString('pt-BR') : '-';
                            
                            return (
                              <tr key={pesquisa.id} className={pageStyles.rowDivider}>
                                <td className={pageStyles.td} style={{ opacity: 0.8 }}>
                                  {pesquisa.id}
                                </td>
                                <td className={pageStyles.td}>
                                  {dataEnvio}
                                </td>
                                <td className={pageStyles.td}>
                                  {dataResposta}
                                </td>
                                <td className={pageStyles.td} style={{ fontWeight: 500 }}>
                                  {pesquisa.nota ? `${pesquisa.nota}/10` : '-'}
                                </td>
                                <td className={pageStyles.td}>
                                  <span className={pageStyles.badge} style={{ background: getClassificacaoColor(pesquisa.nps_classificacao) }}>
                                    {getClassificacaoLabel(pesquisa.nps_classificacao)}
                                  </span>
                                </td>
                                <td className={pageStyles.td}>
                                  <span className={pesquisa.status === 'respondido' ? pageStyles.badgeSuccess : pageStyles.badgeWarn}>
                                    {pesquisa.status === 'respondido' ? 'Respondido' : 'Enviado'}
                                  </span>
                                </td>
                                <td className={pageStyles.td} style={{ opacity: 0.8, maxWidth: 200 }}>
                                  {pesquisa.comentario || 'Sem comentário'}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Paginação */}
                  {pesquisasSatisfacao.length > itensPorPagina && (
                    <div className={pageStyles.pagination}>
                      <button
                        onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                        disabled={paginaAtual === 1}
                        className={pageStyles.pageBtn}
                      >
                        Anterior
                      </button>
                      
                      {Array.from({ length: Math.ceil(pesquisasSatisfacao.length / itensPorPagina) }, (_, i) => i + 1)
                        .filter(page => {
                          const totalPages = Math.ceil(pesquisasSatisfacao.length / itensPorPagina);
                          if (totalPages <= 7) return true;
                          if (page === 1 || page === totalPages) return true;
                          if (page >= paginaAtual - 1 && page <= paginaAtual + 1) return true;
                          return false;
                        })
                        .map((page, index, array) => {
                          if (index > 0 && page - array[index - 1] > 1) {
                            return (
                              <span key={`ellipsis-${page}`} className={pageStyles.ellipsis}>
                                ...
                              </span>
                            );
                          }
                          return (
                            <button
                              key={page}
                              onClick={() => setPaginaAtual(page)}
                              className={`${pageStyles.pageBtn} ${pageStyles[page === paginaAtual ? 'pageBtnActive' : '']}`}
                            >
                              {page}
                            </button>
                          );
                        })}
                      
                      <button
                        onClick={() => setPaginaAtual(Math.min(Math.ceil(pesquisasSatisfacao.length / itensPorPagina), paginaAtual + 1))}
                        disabled={paginaAtual === Math.ceil(pesquisasSatisfacao.length / itensPorPagina)}
                        className={pageStyles.pageBtn}
                      >
                        Próxima
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Resumo */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                  marginBottom: "24px"
                }}>
                <div style={{
                  padding: "16px",
                  backgroundColor: "var(--onity-color-surface)",
                  borderRadius: "8px",
                  border: "1px solid var(--onity-color-border)",
                  boxShadow: "var(--onity-elev-low)"
                }}>
                  <div style={{ fontSize: "24px", fontWeight: "600", color: "var(--onity-color-text)" }}>
                    {pesquisasSatisfacao.length}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--onity-color-text)", opacity: 0.8 }}>
                    Total de Pesquisas
                  </div>
                </div>
                
                <div style={{
                  padding: "16px",
                  backgroundColor: "var(--onity-color-surface)",
                  borderRadius: "8px",
                  border: "1px solid var(--onity-color-border)",
                  boxShadow: "var(--onity-elev-low)"
                }}>
                  <div style={{ fontSize: "24px", fontWeight: "600", color: "var(--onity-color-text)" }}>
                    {pesquisasSatisfacao.filter(p => p.status === 'respondido').length}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--onity-color-text)", opacity: 0.8 }}>
                    Respondidas
                  </div>
                </div>
                
                <div style={{
                  padding: "16px",
                  backgroundColor: "var(--onity-color-surface)",
                  borderRadius: "8px",
                  border: "1px solid var(--onity-color-border)",
                  boxShadow: "var(--onity-elev-low)"
                }}>
                  <div style={{ fontSize: "24px", fontWeight: "600", color: "var(--onity-color-text)" }}>
                    {pesquisasSatisfacao.filter(p => p.nota && p.nota >= 8).length}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--onity-color-text)", opacity: 0.8 }}>
                    Satisfeitos (8+)
                  </div>
                </div>
                
                <div style={{
                  padding: "16px",
                  backgroundColor: "var(--onity-color-surface)",
                  borderRadius: "8px",
                  border: "1px solid var(--onity-color-border)",
                  boxShadow: "var(--onity-elev-low)"
                }}>
                  <div style={{ fontSize: "24px", fontWeight: "600", color: "var(--onity-color-text)" }}>
                    {(() => {
                      const notas = pesquisasSatisfacao.map(p => p.nota).filter(n => n !== null);
                      return notas.length > 0 ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : "0.0";
                    })()}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--onity-color-text)", opacity: 0.8 }}>
                    Média das Notas
                  </div>
                </div>
              </div>

              {/* Gráfico de Evolução do Relacionamento */}
              <div style={{
                marginTop: "32px",
                padding: "24px",
                backgroundColor: "var(--titan-card-bg)",
                borderRadius: "12px",
                border: "1px solid var(--titan-stroke)",
                boxShadow: "var(--titan-shadow-md)"
              }}>
                <h3 style={{
                  margin: "0 0 20px 0",
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "var(--titan-text-high)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3v18h18"/>
                    <path d="m9 9 3 3 3-3"/>
                    <path d="m9 15 3-3 3 3"/>
                  </svg>
                  Evolução do Relacionamento
                </h3>
                
                {/* Gráfico de Linha */}
                <div style={{
                  height: "200px",
                  marginBottom: "20px",
                  position: "relative"
                }}>
                  {pesquisasSatisfacao.length > 0 ? (
                    <div style={{
                      width: "100%",
                      height: "150px",
                      position: "relative",
                      padding: "20px 0"
                    }}>
                      <svg
                        width="100%"
                        height="100%"
                        style={{
                          overflow: "visible"
                        }}
                      >
                        {/* Grade de fundo */}
                        <defs>
                          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                        
                        {/* Linhas de grade horizontais */}
                        {[0, 25, 50, 75, 100].map((y, index) => (
                          <line
                            key={index}
                            x1="0"
                            y1={`${y}%`}
                            x2="100%"
                            y2={`${y}%`}
                            stroke="#e2e8f0"
                            strokeWidth="1"
                          />
                        ))}
                        
                        {/* Labels do eixo Y */}
                        {[10, 7.5, 5, 2.5, 0].map((value, index) => (
                          <text
                            key={index}
                            x="5"
                            y={`${index * 25}%`}
                            fontSize="10"
                            fill="#94a3b8"
                            textAnchor="start"
                            dominantBaseline="middle"
                          >
                            {value}
                          </text>
                        ))}
                        
                                                 {/* Pontos e linha do gráfico */}
                         {pesquisasSatisfacao
                           .slice(-6)
                           .sort((a, b) => {
                             // Ordena por data de resposta ou envio, do mais antigo para o mais recente
                             const dataA = new Date(a.dataResposta || a.dataEnvio);
                             const dataB = new Date(b.dataResposta || b.dataEnvio);
                             return dataA.getTime() - dataB.getTime();
                           })
                           .map((pesquisa, index) => {
                           const nota = pesquisa.nota || 0;
                           
                           // Tratamento melhorado das datas
                           let dataFormatada = "N/A";
                           try {
                             const dataString = pesquisa.dataResposta || pesquisa.dataEnvio;
                             if (dataString) {
                               const data = new Date(dataString);
                               if (!isNaN(data.getTime())) {
                                 dataFormatada = data.toLocaleDateString('pt-BR', { 
                                   day: '2-digit', 
                                   month: '2-digit' 
                                 });
                               }
                             }
                           } catch (error) {
                             console.error("Erro ao formatar data:", error);
                           }
                           
                           // Calcula posição X (distribuída uniformemente)
                           const x = ((index + 1) / Math.min(pesquisasSatisfacao.length, 6)) * 80 + 10; // 10% margem, 80% área útil
                           
                           // Calcula posição Y (nota de 0-10 para 0-100%)
                           const y = 100 - (nota / 10) * 100;
                           
                           return (
                             <g key={index}>
                               {/* Linha conectando pontos */}
                               {index > 0 && (() => {
                                 const pesquisasOrdenadas = pesquisasSatisfacao
                                   .slice(-6)
                                   .sort((a, b) => {
                                     const dataA = new Date(a.dataResposta || a.dataEnvio);
                                     const dataB = new Date(b.dataResposta || b.dataEnvio);
                                     return dataA.getTime() - dataB.getTime();
                                   });
                                 
                                 const prevPesquisa = pesquisasOrdenadas[index - 1];
                                 const prevNota = prevPesquisa?.nota || 0;
                                 const prevX = (index / Math.min(pesquisasSatisfacao.length, 6)) * 80 + 10;
                                 const prevY = 100 - (prevNota / 10) * 100;
                                 
                                 return (
                                   <line
                                     x1={`${prevX}%`}
                                     y1={`${prevY}%`}
                                     x2={`${x}%`}
                                     y2={`${y}%`}
                                     stroke="#3b82f6"
                                     strokeWidth="2"
                                     strokeLinecap="round"
                                   />
                                 );
                               })()}
                               
                               {/* Ponto do gráfico */}
                               <circle
                                 cx={`${x}%`}
                                 cy={`${y}%`}
                                 r="4"
                                 fill={nota >= 7 ? "#10b981" : nota >= 5 ? "#3b82f6" : "#ef4444"}
                                 stroke="white"
                                 strokeWidth="2"
                               />
                               
                               {/* Tooltip com data */}
                               <text
                                 x={`${x}%`}
                                 y="95%"
                                 fontSize="10"
                                 fill="#64748b"
                                 textAnchor="middle"
                                 dominantBaseline="middle"
                               >
                                 {dataFormatada}
                               </text>
                               
                               {/* Valor da nota */}
                               <text
                                 x={`${x}%`}
                                 y={`${Math.max(y - 8, 5)}%`}
                                 fontSize="10"
                                 fill="#1e293b"
                                 textAnchor="middle"
                                 dominantBaseline="middle"
                                 fontWeight="600"
                               >
                                 {nota}
                               </text>
                             </g>
                           );
                         })}
                      </svg>
                    </div>
                  ) : (
                    <div style={{
                      height: "150px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#94a3b8",
                      fontSize: "14px"
                    }}>
                      Sem dados suficientes para gerar gráfico
                    </div>
                  )}
                </div>

                {/* Avisos e Insights */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                  gap: "16px",
                  marginTop: "20px"
                }}>
                  {/* Tendência */}
                  {pesquisasSatisfacao.length >= 2 && (() => {
                    const pesquisasOrdenadas = pesquisasSatisfacao
                      .sort((a, b) => {
                        const dataA = new Date(a.dataResposta || a.dataEnvio);
                        const dataB = new Date(b.dataResposta || b.dataEnvio);
                        return dataA.getTime() - dataB.getTime();
                      });
                    const ultimasOrdenadas = pesquisasOrdenadas.slice(-2);
                    const primeiraNota = ultimasOrdenadas[0]?.nota || 0;
                    const ultimaNota = ultimasOrdenadas[1]?.nota || 0;
                    const tendencia = ultimaNota > primeiraNota ? "melhorando" : ultimaNota < primeiraNota ? "piorando" : "estável";
                    
                    return (
                      <div style={{
                        padding: "16px",
                        backgroundColor: tendencia === "melhorando" ? "rgba(16, 185, 129, 0.1)" : 
                                      tendencia === "piorando" ? "rgba(239, 68, 68, 0.1)" : "rgba(59, 130, 246, 0.1)",
                        borderRadius: "8px",
                        border: `1px solid ${
                          tendencia === "melhorando" ? "var(--titan-success)" : 
                          tendencia === "piorando" ? "var(--titan-error)" : "var(--titan-primary)"
                        }`
                      }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "8px"
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            {tendencia === "melhorando" ? (
                              <path d="M7 14l3-3 2 2 7-7"/>
                            ) : tendencia === "piorando" ? (
                              <path d="M7 14l3-3 2 2 7-7" transform="rotate(180 12 12)"/>
                            ) : (
                              <path d="M5 12h14"/>
                            )}
                          </svg>
                          <span style={{
                            fontWeight: "600",
                            fontSize: "14px",
                            color: "var(--titan-text-high)"
                          }}>
                            Tendência: {tendencia.charAt(0).toUpperCase() + tendencia.slice(1)}
                          </span>
                        </div>
                        <span style={{
                          fontSize: "12px",
                          color: "var(--titan-text-med)"
                        }}>
                          Última nota: {ultimaNota}/10 | Anterior: {primeiraNota}/10
                        </span>
                      </div>
                    );
                  })()}

                  {/* Classificação Geral */}
                  {pesquisasSatisfacao.length > 0 && (() => {
                    const notas = pesquisasSatisfacao.map(p => p.nota).filter(n => n !== null);
                    const media = notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
                    const classificacao = media >= 8 ? "Excelente" : media >= 6 ? "Bom" : "Precisa Melhorar";
                    const cor = media >= 8 ? "#10b981" : media >= 6 ? "#3b82f6" : "#ef4444";
                    
                    return (
                      <div style={{
                        padding: "16px",
                        backgroundColor: cor === "#10b981" ? "rgba(16, 185, 129, 0.1)" : 
                                      cor === "#3b82f6" ? "rgba(59, 130, 246, 0.1)" : "rgba(239, 68, 68, 0.1)",
                        borderRadius: "8px",
                        border: `1px solid ${cor}`
                      }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "8px"
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            {media >= 8 ? (
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            ) : media >= 6 ? (
                              <path d="M3 3h18v18H3z"/>
                            ) : (
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            )}
                          </svg>
                          <span style={{
                            fontWeight: "600",
                            fontSize: "14px",
                            color: "var(--titan-text-high)"
                          }}>
                            {classificacao}
                          </span>
                        </div>
                        <span style={{
                          fontSize: "12px",
                          color: "var(--titan-text-med)"
                        }}>
                          Média: {media.toFixed(1)}/10 ({notas.length} pesquisas)
                        </span>
                      </div>
                    );
                  })()}

                  {/* Recomendação */}
                  {pesquisasSatisfacao.length > 0 && (() => {
                    const pesquisasOrdenadasRec = pesquisasSatisfacao
                      .sort((a, b) => {
                        const dataA = new Date(a.dataResposta || a.dataEnvio);
                        const dataB = new Date(b.dataResposta || b.dataEnvio);
                        return dataA.getTime() - dataB.getTime();
                      });
                                         const ultimaPesquisaRec = pesquisasOrdenadasRec[pesquisasOrdenadasRec.length - 1];
                     const diasDesdeUltimaRec = ultimaPesquisaRec ? 
                       Math.floor((new Date().getTime() - new Date(ultimaPesquisaRec.dataResposta || ultimaPesquisaRec.dataEnvio).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    
                    let recomendacao = "";
                    let icone = "";
                    let cor = "";
                    
                                         if (diasDesdeUltimaRec > 90) {
                       recomendacao = "Enviar nova pesquisa";
                       icone = "📧";
                       cor = "#ef4444";
                     } else if (diasDesdeUltimaRec > 60) {
                       recomendacao = "Considerar nova pesquisa";
                       icone = "⏰";
                       cor = "#f59e0b";
                     } else {
                       recomendacao = "Relacionamento atualizado";
                       icone = "✅";
                       cor = "#10b981";
                     }
                    
                    return (
                      <div style={{
                        padding: "16px",
                        backgroundColor: cor === "#ef4444" ? "rgba(239, 68, 68, 0.1)" : 
                                      cor === "#f59e0b" ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)",
                        borderRadius: "8px",
                        border: `1px solid ${cor}`
                      }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "8px"
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            {diasDesdeUltimaRec > 90 ? (
                              <>
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                <polyline points="22,6 12,13 2,6"/>
                              </>
                            ) : diasDesdeUltimaRec > 60 ? (
                              <>
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12,6 12,12 16,14"/>
                              </>
                            ) : (
                              <path d="M20 6L9 17l-5-5"/>
                            )}
                          </svg>
                          <span style={{
                            fontWeight: "600",
                            fontSize: "14px",
                            color: "var(--titan-text-high)"
                          }}>
                            {recomendacao}
                          </span>
                        </div>
                        <span style={{
                          fontSize: "12px",
                          color: "var(--titan-text-med)"
                        }}>
                          {diasDesdeUltimaRec > 0 ? `${diasDesdeUltimaRec} dias desde última pesquisa` : "Pesquisa recente"}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {abaAtiva === 3 && (
            carregandoPerfil ? (
              <div style={{
                padding: 40,
                fontSize: 16,
                textAlign: "center",
                color: "#6b7280"
              }}>
                Carregando perfil do cliente...
              </div>
            ) : (
              <div
                className={`${pageStyles.flexPainel} ${pageStyles.perfilContainer}`}
                style={{
                  background: "var(--titan-card-bg)",
                  padding: 32,
                  borderRadius: 12,
                  border: "1px solid var(--titan-stroke)",
                  boxShadow: "var(--titan-shadow-md)",
                  display: "grid",
                  gridTemplateColumns: "1.3fr 1fr", // <<-- Mais espaço p/ obrigações
                  gap: 24,
                  fontFamily: "Roboto, sans-serif",
                  height: "600px",
                  maxWidth: "100vw",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                {/* ENQUETES */}
                <div
                  className={pageStyles.perfilEnquetes}
                  style={{
                    minWidth: 0,
                    background: "transparent",
                    borderRadius: 8,
                    padding: 20,
                    border: "none",
                    overflow: "auto",
                  }}
                >
                  <div style={{
                    marginBottom: 20,
                    paddingBottom: 12,
                    borderBottom: "2px solid #6b7280",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#6b7280"
                      }} />
                      <h3 style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: "var(--titan-text-high)",
                        margin: 0
                      }}>
                        Perfil do Cliente
                      </h3>
                    </div>
                    
                    <button
                      onClick={abrirModalReplicarPerfil}
                      style={{
                        padding: "8px 16px",
                        background: "var(--titan-primary)",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--titan-primary-hover)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--titan-primary)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8l-5-5z"/>
                        <path d="M14 2v6h6"/>
                        <path d="M16 13H8"/>
                        <path d="M16 17H8"/>
                        <path d="M10 9H8"/>
                      </svg>
                      Replicar Perfil
                    </button>
                  </div>

                  {enquetes.map((grupo) => (
                    <div
                      key={grupo.id}
                      style={{
                        marginBottom: 28,
                        background: "rgba(107, 114, 128, 0.1)",
                        borderRadius: 10,
                        padding: 20,
                        border: "1px solid rgba(107, 114, 128, 0.2)",
                      }}
                    >
                      <div style={{
                        fontWeight: 600,
                        marginBottom: 18,
                        fontSize: 16,
                        color: "#6b7280",
                        paddingBottom: 8,
                        borderBottom: "1px solid rgba(107, 114, 128, 0.3)"
                      }}>
                        {grupo.classificacao} - {grupo.titulo}
                      </div>

                      {grupo.filhos.map((pergunta) => (
                        <div
                          key={pergunta.id}
                          style={{
                            marginBottom: 24,
                            background: "rgba(107, 114, 128, 0.05)",
                            borderRadius: 8,
                            padding: 16,
                            border: "1px solid rgba(107, 114, 128, 0.15)"
                          }}
                        >
                          <div style={{
                            fontWeight: 500,
                            marginBottom: 12,
                            fontSize: 14,
                            color: "var(--titan-text-high)",
                            lineHeight: "1.4"
                          }}>
                            {pergunta.classificacao} - {pergunta.texto}
                          </div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {pergunta.filhos.map((resp) => {
                              const isSelected = respostasSelecionadas.includes(resp.id);

                              return (
                                <div
                                  key={resp.id}
                                  onClick={async () => {
                                    const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
                                    let novasRespostas = [];

                                    if (pergunta.tipoResposta === "UNICA") {
                                      if (isSelected) {
                                        novasRespostas = respostasSelecionadas.filter(
                                          (rId) => rId !== resp.id
                                        );
                                      } else {
                                        novasRespostas = respostasSelecionadas.filter(
                                          (rId) =>
                                            !pergunta.filhos.some((f) => f.id === rId)
                                        );
                                        novasRespostas.push(resp.id);
                                      }
                                    } else {
                                      novasRespostas = isSelected
                                        ? respostasSelecionadas.filter(
                                          (rId) => rId !== resp.id
                                        )
                                        : [...respostasSelecionadas, resp.id];
                                    }

                                    setRespostasSelecionadas(novasRespostas);

                                    try {
                                      await api.post(
                                        `/gestao/enquete/respostas-cliente/${id}?empresaId=${getEmpresaId()}`,
                                        { respostaIds: novasRespostas },
                                        {
                                          headers: {
                                            Authorization: `Bearer ${token}`,
                                          },
                                        }
                                      );

                                      if (abaAtiva === 3) {
                                        setAtualizandoObrigacoes(true);
                                        try {
                                          const res = await api.get(`/gestao/obrigacoes/cliente/${id}/com-departamentos`, {
                                            headers: { Authorization: `Bearer ${token}` },
                                          });
                                          setTodosDepartamentos(res.data.departamentos);
                                          setObrigacoesCliente(res.data.obrigacoes);
                                        } finally {
                                          setAtualizandoObrigacoes(false);
                                        }
                                      }
                                    } catch (err) {
                                      console.error("Erro ao salvar resposta:", err);
                                      toast.error("Erro ao salvar resposta");
                                      setRespostasSelecionadas(respostasSelecionadas);
                                    }
                                  }}
                                  style={{
                                    background: "rgba(107, 114, 128, 0.08)",
                                    color: "var(--titan-text-high)",
                                    padding: "10px 14px",
                                    borderRadius: 8,
                                    fontSize: 13,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    cursor: "pointer",
                                    border: `1px solid ${isSelected ? "#6b7280" : "rgba(107, 114, 128, 0.2)"}`,
                                    transition: "all 0.2s ease",
                                    fontWeight: isSelected ? 500 : 400,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 16,
                                      height: 16,
                                      borderRadius: "50%",
                                      border: "2px solid",
                                      borderColor: isSelected ? "#6b7280" : "rgba(107, 114, 128, 0.4)",
                                      backgroundColor: "rgba(255, 255, 255, 0.9)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center"
                                    }}
                                  >
                                    {isSelected && (
                                      <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="#6b7280"
                                        strokeWidth="5"
                                      >
                                        <polyline points="20,6 9,17 4,12"></polyline>
                                      </svg>
                                    )}
                                  </div>
                                  <span style={{ fontSize: 13 }}>
                                    {resp.classificacao} - {resp.particularidade}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* OBRIGAÇÕES POR DEPARTAMENTO */}
                <div
                  className="col-obrigacoes perfil-obrigacoes"
                  style={{
                    minWidth: 0,
                    background: "transparent",
                    borderRadius: 8,
                    padding: 20,
                    border: "none",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      marginBottom: 20,
                      paddingBottom: 12,
                      borderBottom: "2px solid #6b7280",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#6b7280",
                      }}
                    />
                    <h3
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: "var(--titan-text-high)",
                        margin: 0,
                      }}
                    >
                      Obrigações por Departamento
                    </h3>
                    {atualizandoObrigacoes && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          color: "#6b7280",
                          fontWeight: 500,
                          marginLeft: "auto",
                        }}
                      >
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            border: "2px solid #6b7280",
                            borderTop: "2px solid transparent",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                        Atualizando...
                      </div>
                    )}
                  </div>

                        <div
        style={{
          background: "var(--onity-color-surface)",
          borderRadius: "var(--onity-radius-m)",
          border: "1px solid var(--onity-color-border)",
          overflowX: "auto",
          width: "100%",
          minWidth: 0,
        }}
      >
        <table
          style={{
            minWidth: 750,
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "var(--onity-type-body-size)",
          }}
        >
          <thead>
            <tr style={{
              background: "var(--onity-color-bg)",
              borderBottom: "2px solid var(--onity-color-border)"
            }}>
              {todosDepartamentos.map((dept, i) => (
                <th
                  key={i}
                  style={{
                    padding: "var(--onity-space-m) var(--onity-space-l)",
                    textAlign: "left",
                    fontSize: "var(--onity-type-body-size)",
                    fontWeight: 600,
                    color: "var(--onity-color-text)",
                    borderRight: i < todosDepartamentos.length - 1 ? "1px solid var(--onity-color-border)" : "none"
                  }}
                >
                  {dept.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {todosDepartamentos.map((dept, i) => {
                const obrigacoes = obrigacoesCliente.filter(
                  (o) => String(o.departamentoId) === String(dept.id)
                );

                return (
                  <td
                    key={i}
                    style={{
                      verticalAlign: "top",
                      padding: "var(--onity-space-l)",
                      borderRight: i < todosDepartamentos.length - 1 ? "1px solid var(--onity-color-border)" : "none",
                      background: "var(--onity-color-surface)"
                    }}
                  >
                                {obrigacoes.length === 0 ? (
                                  <div style={{
                                    textAlign: "center",
                                    padding: "var(--onity-space-xl)",
                                    color: "var(--onity-color-text)", opacity: 0.6,
                                    fontSize: "var(--onity-type-body-size)",
                                    fontStyle: "italic"
                                  }}>
                                    Nenhuma obrigação
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--onity-space-m)" }}>
                                    {obrigacoes.map((ob) => (
                                      <div
                                        key={ob.id}
                                        style={{
                                          background: "var(--onity-color-surface)",
                                          padding: "var(--onity-space-m) var(--onity-space-l)",
                                          borderRadius: "var(--onity-radius-xs)",
                                          border: "1px solid var(--onity-color-border)",
                                          transition: "all 120ms ease",
                                          cursor: "pointer"
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background = "var(--onity-color-bg)";
                                          e.currentTarget.style.borderColor = "var(--onity-color-primary)";
                                          e.currentTarget.style.boxShadow = "var(--onity-elev-low)";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background = "var(--onity-color-surface)";
                                          e.currentTarget.style.borderColor = "var(--onity-color-border)";
                                          e.currentTarget.style.boxShadow = "none";
                                        }}
                                        onClick={() => window.open(`/dashboard/obrigacoes/${ob.id}`, "_blank")}
                                      >
                                        <div
                                          style={{
                                            fontWeight: 600,
                                            color: "var(--onity-color-text)",
                                            fontSize: "var(--onity-type-body-size)",
                                            marginBottom: "var(--onity-space-xs)",
                                            transition: "color 120ms ease"
                                          }}
                                        >
                                          {ob.nome}
                                        </div>
                                        <div style={{
                                          fontSize: "var(--onity-type-caption-size)",
                                          color: "var(--onity-color-text)", opacity: 0.8,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "var(--onity-space-xs)"
                                        }}>
                                          <span style={{
                                            padding: "2px var(--onity-space-s)",
                                            background: "var(--onity-color-success)",
                                            borderRadius: "var(--onity-radius-xs)",
                                            fontSize: "var(--onity-type-caption-size)",
                                            color: "var(--onity-color-primary-contrast)",
                                            fontWeight: 500
                                          }}>
                                            {ob.frequencia}
                                          </span>
                                          <span style={{ color: "var(--onity-color-text)", opacity: 0.6 }}>•</span>
                                          <span>{ob.vencimentoTipo} dia {ob.vencimentoDia}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}

          {abaAtiva === 4 && (
            <div className={`${pageStyles.card} ${pageStyles.pLg}`}>
              <div style={{ marginBottom: "var(--titan-spacing-xl)" }}>
                <h2 style={{ fontSize: "var(--titan-font-size-lg)", fontWeight: "var(--titan-font-weight-semibold)", color: "var(--titan-text-high)", marginBottom: "var(--titan-spacing-sm)" }}>
                  Responsáveis por Obrigação
                </h2>
                <p style={{ fontSize: "var(--titan-font-size-sm)", color: "var(--titan-text-med)" }}>
                  Vincule responsáveis específicos para cada obrigação deste cliente.
                  Filtre por departamento para atribuir responsáveis em massa.
                </p>
              </div>

              {carregandoResponsaveis ? (
                <div style={{ textAlign: "center", padding: "var(--titan-spacing-xl)" }}>
                  <div style={{ fontSize: "var(--titan-font-size-base)", color: "var(--titan-text-med)" }}>Carregando responsáveis...</div>
                </div>
              ) : obrigacoesCliente.length === 0 ? (
                <div style={{ textAlign: "center", padding: "var(--titan-spacing-xl)" }}>
                  <div style={{ fontSize: "var(--titan-font-size-base)", color: "var(--titan-text-med)" }}>
                    Nenhuma obrigação vinculada a este cliente.
                  </div>
                  <div style={{ fontSize: "var(--titan-font-size-sm)", color: "var(--titan-text-low)", marginTop: "var(--titan-spacing-sm)" }}>
                    As obrigações aparecerão aqui após serem geradas na aba "Gerar Tarefas".
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "var(--titan-spacing-xl)" }}>
                  {/* Coluna Principal - Tabela de Obrigações */}
                  <div>
                    {/* Filtros */}
                    <div className={`${pageStyles.cardSm} ${pageStyles.pMd} ${pageStyles.mbLg}`} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                      <div>
                        <label className={pageStyles.label}>Por Departamento</label>
                        <select
                          value={filtroDepartamentoResponsaveis}
                          onChange={(e) => setFiltroDepartamentoResponsaveis(e.target.value)}
                          className={pageStyles.input}
                        >
                          <option value="">Todos os Departamentos</option>
                          {todosDepartamentos.map(dept => (
                            <option key={dept.id} value={dept.id}>
                              {dept.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={pageStyles.label}>Por Responsável Vinculado</label>
                        <select
                          value={filtroResponsavelVinculado}
                          onChange={(e) => setFiltroResponsavelVinculado(e.target.value)}
                          className={pageStyles.input}
                        >
                          <option value="">Todos</option>
                          <option value="com">Com Responsável</option>
                          <option value="sem">Sem Responsável</option>
                        </select>
                      </div>

                      <div>
                        <label className={pageStyles.label}>Por Cargo do Responsável</label>
                        <select
                          value={filtroCargoResponsavel}
                          onChange={(e) => setFiltroCargoResponsavel(e.target.value)}
                          className={pageStyles.input}
                        >
                          <option value="">Todos</option>
                          {cargosResponsaveis.map(cargo => (
                            <option key={cargo} value={cargo}>
                              {cargo}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Checkbox para apenas obrigações sem responsáveis */}
                    <div className={`${pageStyles.cardSm} ${pageStyles.pMd} ${pageStyles.mbMd}`}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--titan-spacing-sm)" }}>
                        <input
                          type="checkbox"
                          checked={apenasObrigacoesSemResponsavel}
                          onChange={(e) => setApenasObrigacoesSemResponsavel(e.target.checked)}
                          style={{ transform: "scale(1.2)" }}
                        />
                        <label className={pageStyles.label}>
                          apenas obrigações sem responsáveis
                        </label>
                      </div>
                    </div>

                    {/* Informação de registros */}
                    <div style={{
                      marginBottom: "var(--titan-spacing-lg)",
                      fontSize: "var(--titan-font-size-sm)",
                      color: "var(--titan-text-med)"
                    }}>
                      Mostrando de 1 até {obrigacoesFiltradas.length} de {obrigacoesFiltradas.length} registros
                    </div>

                    {/* Tabela de Obrigações */}
                    <div style={{
                      border: "1px solid var(--titan-stroke)",
                      borderRadius: "var(--titan-radius-sm)",
                      overflow: "hidden"
                    }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "var(--titan-base-10)" }}>
                            <th style={{
                              padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                              textAlign: "left",
                              fontSize: "var(--titan-font-size-sm)",
                              fontWeight: "var(--titan-font-weight-semibold)",
                              color: "var(--titan-text-high)",
                              borderBottom: "1px solid var(--titan-stroke)"
                            }}>
                              #
                            </th>
                            <th style={{
                              padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                              textAlign: "left",
                              fontSize: "var(--titan-font-size-sm)",
                              fontWeight: "var(--titan-font-weight-semibold)",
                              color: "var(--titan-text-high)",
                              borderBottom: "1px solid var(--titan-stroke)"
                            }}>
                              Departamento
                            </th>
                            <th style={{
                              padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                              textAlign: "left",
                              fontSize: "var(--titan-font-size-sm)",
                              fontWeight: "var(--titan-font-weight-semibold)",
                              color: "var(--titan-text-high)",
                              borderBottom: "1px solid var(--titan-stroke)"
                            }}>
                              Obrigações & Cargos
                            </th>
                            <th style={{
                              padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                              textAlign: "left",
                              fontSize: "var(--titan-font-size-sm)",
                              fontWeight: "var(--titan-font-weight-semibold)",
                              color: "var(--titan-text-high)",
                              borderBottom: "1px solid var(--titan-stroke)"
                            }}>
                              Responsáveis vinculados
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {obrigacoesFiltradas.map((obrigacao, index) => {
                            const responsavelAtual = responsaveisAtuais[obrigacao.id];
                            const departamento = todosDepartamentos.find(d => d.id === obrigacao.departamentoId);

                            return (
                              <tr
                                key={obrigacao.id}
                                style={{
                                  background: index % 2 === 0 ? "var(--titan-card-bg)" : "var(--titan-base-10)",
                                  borderBottom: "1px solid var(--titan-stroke)"
                                }}
                              >
                                <td style={{
                                  padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                                  fontSize: "var(--titan-font-size-sm)",
                                  color: "var(--titan-text-high)"
                                }}>
                                  {index + 1}
                                </td>
                                <td style={{
                                  padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                                  fontSize: "var(--titan-font-size-sm)",
                                  color: "var(--titan-text-high)"
                                }}>
                                  {departamento?.nome || "N/A"}
                                </td>
                                <td style={{
                                  padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                                  fontSize: "var(--titan-font-size-sm)",
                                  color: "var(--titan-text-high)"
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "var(--titan-spacing-sm)" }}>
                                    {obrigacao.nome}
                                    <span style={{ fontSize: "var(--titan-font-size-xs)", color: "var(--titan-text-med)" }}>🔗</span>
                                  </div>
                                  <div style={{
                                    display: "flex",
                                    gap: "var(--titan-spacing-xs)",
                                    marginTop: "var(--titan-spacing-xs)",
                                    flexWrap: "wrap"
                                  }}>
                                    <span style={{
                                      padding: "2px var(--titan-spacing-sm)",
                                      background: "var(--titan-input-bg)",
                                      borderRadius: "var(--titan-radius-sm)",
                                      fontSize: "var(--titan-font-size-xs)",
                                      color: "var(--titan-text-med)"
                                    }}>
                                      {departamento?.nome}
                                    </span>
                                    <span style={{
                                      padding: "2px var(--titan-spacing-sm)",
                                      background: "var(--titan-input-bg)",
                                      borderRadius: "var(--titan-radius-sm)",
                                      fontSize: "var(--titan-font-size-xs)",
                                      color: "var(--titan-text-med)"
                                    }}>
                                      {obrigacao.frequencia}
                                    </span>
                                  </div>
                                </td>
                                <td style={{
                                  padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                                  fontSize: "var(--titan-font-size-sm)",
                                  color: "var(--titan-text-high)"
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: "var(--titan-spacing-sm)" }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: "var(--titan-spacing-xs)", flex: 1 }}>
                                      {/* ✅ NOVO: Responsáveis individuais */}
                                      {multiResponsaveis[obrigacao.id] && multiResponsaveis[obrigacao.id].length > 0 && (
                                        <div style={{ display: "flex", flexDirection: 'column', gap: "var(--titan-spacing-xs)" }}>
                                          {multiResponsaveis[obrigacao.id].map((resp, idx) => (
                                            <div key={`individual-${obrigacao.id}-${resp.id || resp.usuarioId || 'unknown'}-${idx}`} style={{ 
                                              display: 'inline-block',
                                              background: 'rgba(123, 77, 255, 0.3)', 
                                              color: 'var(--titan-text-high)',
                                              padding: '4px var(--titan-spacing-sm)', 
                                              borderRadius: 'var(--titan-radius-md)',
                                              fontSize: 'var(--titan-font-size-xs)',
                                              fontWeight: 'var(--titan-font-weight-medium)',
                                              border: '1px solid rgba(123, 77, 255, 0.5)'
                                            }}>
                                              {resp.nome}{resp.departamentoNome ? ` - ${resp.departamentoNome}` : ""}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {/* ✅ NOVO: Responsáveis globais */}
                                      {(!multiResponsaveis[obrigacao.id] || multiResponsaveis[obrigacao.id].length === 0) && obrigacao.responsaveisGlobais && obrigacao.responsaveisGlobais.length > 0 && (
                                        <div style={{ display: "flex", flexDirection: 'column', gap: "var(--titan-spacing-xs)" }}>
                                          {obrigacao.responsaveisGlobais.map((resp, idx) => (
                                            <div key={`global-${obrigacao.id}-${resp.usuarioId || resp.id || 'unknown'}-${idx}`} style={{ 
                                              display: 'inline-block',
                                              background: 'rgba(34, 197, 94, 0.3)', 
                                              color: 'var(--titan-text-high)',
                                              padding: '4px var(--titan-spacing-sm)', 
                                              borderRadius: 'var(--titan-radius-md)',
                                              fontSize: 'var(--titan-font-size-xs)',
                                              fontWeight: 'var(--titan-font-weight-medium)',
                                              border: '1px solid rgba(34, 197, 94, 0.5)'
                                            }}>
                                              {resp.nome}{resp.departamentoNome ? ` - ${resp.departamentoNome}` : ""} (Global)
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {/* ✅ NOVO: Sem responsável (individual ou global) */}
                                      {(!multiResponsaveis[obrigacao.id] || multiResponsaveis[obrigacao.id].length === 0) && (!obrigacao.responsaveisGlobais || obrigacao.responsaveisGlobais.length === 0) && (
                                        <span style={{ color: 'var(--titan-text-low)', fontSize: 'var(--titan-font-size-sm)' }}>Sem responsável</span>
                                      )}
                                    </div>
                                    
                                    {/* ✅ NOVO: Botões de ação - ocultar quando há responsáveis globais */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "var(--titan-spacing-xs)" }}>
                                      {/* ✅ NOVO: Botão de remover responsável individual */}
                                      {responsavelAtual && (
                                        <button
                                          onClick={() => salvarResponsavel(obrigacao.id, null)}
                                          style={{
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            color: "var(--titan-error)",
                                            fontSize: "var(--titan-font-size-sm)",
                                            padding: "var(--titan-spacing-xs)",
                                            borderRadius: "var(--titan-radius-sm)"
                                          }}
                                          title="Remover responsável"
                                        >
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                          </svg>
                                        </button>
                                      )}
                                      
                                                                            {/* ✅ NOVO: Botão de múltiplos responsáveis - só mostrar quando NÃO há responsáveis globais */}
                                      {(!obrigacao.responsaveisGlobais || obrigacao.responsaveisGlobais.length === 0) && (
                                        <button
                                          onClick={() => abrirModalMultiResponsaveis(obrigacao.id, obrigacao.nome)}
                                          style={{
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            color: "var(--titan-success)",
                                            fontSize: "var(--titan-font-size-sm)",
                                            padding: "var(--titan-spacing-xs)",
                                            borderRadius: "var(--titan-radius-sm)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center"
                                          }}
                                          title="Gerenciar múltiplos responsáveis"
                                        >
                                          <Users size={14} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Barra Lateral - Responsáveis na carteira */}
                  <div className={`${pageStyles.cardSm} ${pageStyles.pMd}`} style={{ height: "fit-content" }}>
                    <div style={{ marginBottom: "var(--titan-spacing-xl)" }}>
                      <h3 style={{
                        fontSize: "var(--titan-font-size-base)",
                        fontWeight: "var(--titan-font-weight-semibold)",
                        color: "var(--titan-text-high)",
                        marginBottom: "var(--titan-spacing-sm)"
                      }}>
                        Responsáveis na carteira*
                      </h3>
                      <p style={{
                        fontSize: "var(--titan-font-size-xs)",
                        color: "var(--titan-text-med)",
                        marginBottom: "var(--titan-spacing-lg)"
                      }}>
                        Clique no [+] para adicionar o usuário à todas as obrigações com o mesmo departamento.
                      </p>
                    </div>

                    {/* Informação sobre usuários */}
                    <div style={{
                      marginBottom: "var(--titan-spacing-md)",
                      fontSize: "var(--titan-font-size-xs)",
                      color: "var(--titan-text-med)",
                      textAlign: "center"
                    }}>
                      {!filtroDepartamentoResponsaveis
                        ? "Selecione um departamento para ver os usuários"
                        : responsaveisCarteira.length > 0
                          ? `${responsaveisCarteira.length} usuário(s) no departamento`
                          : "Nenhum usuário encontrado no departamento"
                      }
                    </div>

                    {/* Dropdown para selecionar responsável */}
                    <div style={{ marginBottom: "var(--titan-spacing-xl)" }}>
                      <div style={{
                        display: "flex",
                        gap: "var(--titan-spacing-sm)",
                        alignItems: "center"
                      }}>
                        <select
                          value={responsavelSelecionado}
                          onChange={(e) => setResponsavelSelecionado(e.target.value)}
                          style={{
                            flex: 1,
                            padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                            borderRadius: "var(--titan-radius-sm)",
                            border: "1px solid var(--titan-stroke)",
                            fontSize: "var(--titan-font-size-sm)",
                            background: "var(--titan-input-bg)",
                            color: "var(--titan-text-high)",
                            minWidth: "202px",
                            maxWidth: "250px",
                            width: "100%"
                          }}
                        >
                          <option value="">Selecione...</option>
                          {responsaveisCarteira.map(usuario => (
                            <option key={usuario.id} value={usuario.id}>
                              {usuario.nome} ({usuario.cargoNome || "Sem cargo"})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={adicionarResponsavelCarteira}
                          disabled={!responsavelSelecionado}
                          style={{
                            padding: "var(--titan-spacing-sm)",
                            width: "32px",
                            height: "32px",
                            background: responsavelSelecionado ? "var(--titan-success)" : "var(--titan-text-low)",
                            color: "white",
                            border: "none",
                            borderRadius: "var(--titan-radius-sm)",
                            cursor: responsavelSelecionado ? "pointer" : "not-allowed",
                            fontSize: "var(--titan-font-size-sm)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                          title="Adicionar à carteira"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Lista de responsáveis */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--titan-spacing-md)" }}>
                      {responsaveisCarteira.map(responsavel => (
                        <div
                          key={responsavel.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--titan-spacing-sm)",
                            padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                            background: "var(--titan-card-bg)",
                            borderRadius: "var(--titan-radius-sm)",
                            border: "1px solid var(--titan-stroke)"
                          }}
                        >
                          <button
                            onClick={() => aplicarResponsavelDepartamento(responsavel.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--titan-success)",
                              fontSize: "var(--titan-font-size-sm)",
                              width: "24px",
                              height: "24px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                            title="Adicionar a todas as obrigações do departamento"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                          </button>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "var(--titan-font-size-sm)", fontWeight: "var(--titan-font-weight-medium)", color: "var(--titan-text-high)" }}>
                              {responsavel.nome}
                            </div>
                            <div style={{
                              padding: "2px var(--titan-spacing-sm)",
                              background: "var(--titan-input-bg)",
                              borderRadius: "var(--titan-radius-sm)",
                              fontSize: "var(--titan-font-size-xs)",
                              color: "var(--titan-text-med)",
                              display: "inline-block",
                              marginTop: 2
                            }}>
                              {responsavel.cargoNome || "Sem cargo"}
                            </div>
                          </div>
                          <button
                            onClick={() => removerResponsavelCarteira(responsavel.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--titan-error)",
                              fontSize: "var(--titan-font-size-sm)"
                            }}
                            title="Remover da carteira"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>



                    {/* Caixa de informação */}
                    <div style={{
                      marginTop: "var(--titan-spacing-lg)",
                      padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                      background: "var(--titan-primary)",
                      borderRadius: "var(--titan-radius-sm)",
                      border: "1px solid var(--titan-primary-hover)"
                    }}>
                      <div style={{ fontSize: "var(--titan-font-size-xs)", color: "white" }}>
                        Clique no [+] para adicionar o usuário à todas as obrigações com mesmo cargo.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {abaAtiva === 5 && (
            <div className={`${pageStyles.card} ${pageStyles.pLg}`}>
              <div className={pageStyles.mbLg}>
                <h2 style={{ fontSize: "var(--titan-font-size-lg)", fontWeight: "var(--titan-font-weight-semibold)", color: "var(--titan-text-high)", marginBottom: "var(--titan-spacing-sm)" }}>
                  Gerar Tarefas
                </h2>
                <p style={{ fontSize: "var(--titan-font-size-sm)", color: "var(--titan-text-med)" }}>
                  Selecione as obrigações para gerar tarefas para este cliente.
                  Você pode filtrar por departamento e ano.
                </p>
              </div>

              {/* Filtros */}
              <div style={{ display: "flex", gap: "var(--titan-spacing-lg)", marginBottom: "var(--titan-spacing-lg)" }}>
                <div style={{ flex: 1 }}>
                  <label className={pageStyles.label}>
                    Ano-Calendário *
                  </label>
                  <select
                    value={filtrosGerarTarefas.anoCalendario}
                    onChange={(e) => {
                      setFiltrosGerarTarefas(prev => ({
                      ...prev,
                      anoCalendario: e.target.value
                      }));
                      setPaginaAtual(1); // Resetar para primeira página ao mudar ano
                    }}
                    className={pageStyles.input}
                    style={{ width: "100%" }}
                  >
                    {[2023, 2024, 2025, 2026].map((ano) => (
                      <option key={ano} value={ano}>
                        {ano}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1, marginLeft: "1px" }}>
                  <label className={pageStyles.label}>
                    Vencimento a partir *
                  </label>
                  <select
                    value={filtrosGerarTarefas.vencimentoAPartir}
                    onChange={(e) => setFiltrosGerarTarefas(prev => ({
                      ...prev,
                      vencimentoAPartir: e.target.value
                    }))}
                    className={pageStyles.input}
                    style={{ width: "100%" }}
                  >
                    {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map(mes => (
                        <option key={mes} value={mes}>{mes}</option>
                      ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className={pageStyles.label}>
                    Competência até *
                  </label>
                  <select
                    value={filtrosGerarTarefas.competenciaAte}
                    onChange={(e) => setFiltrosGerarTarefas(prev => ({
                      ...prev,
                      competenciaAte: e.target.value
                    }))}
                    className={pageStyles.input}
                    style={{ width: "100%" }}
                  >
                    {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map(mes => (
                        <option key={mes} value={mes}>{mes}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* ✅ NOVO: Aviso proeminente quando estiver gerando tarefas */}
              {gerandoTarefas && (
                <div style={{
                  marginBottom: "var(--titan-spacing-lg)",
                  padding: "var(--titan-spacing-lg) var(--titan-spacing-xl)",
                  background: "linear-gradient(135deg, var(--titan-primary) 0%, var(--titan-primary-hover) 100%)",
                  borderRadius: "var(--titan-radius-md)",
                  border: "2px solid var(--titan-primary-hover)",
                  boxShadow: "var(--titan-shadow-lg)",
                  textAlign: "center",
                  animation: "pulse 2s ease-in-out infinite"
                }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "var(--titan-spacing-md)",
                    color: "white",
                    fontSize: "var(--titan-font-size-lg)",
                    fontWeight: "var(--titan-font-weight-semibold)"
                  }}>
                    <svg 
                      width="24" 
                      height="24" 
                      viewBox="0 0 24 24" 
                      fill="none"
                      style={{ animation: "spin 1s linear infinite" }}
                    >
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    <span>GERANDO TAREFAS EM ANDAMENTO...</span>
                  </div>
                  <div style={{
                    marginTop: "var(--titan-spacing-sm)",
                    fontSize: "var(--titan-font-size-sm)",
                    opacity: 0.9,
                    fontWeight: "var(--titan-font-weight-medium)"
                  }}>
                    Por favor, aguarde. Esta operação pode levar alguns minutos dependendo da quantidade de tarefas.
                  </div>
                </div>
              )}

              {/* Botão Gerar Tarefas */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--titan-spacing-xl)" }}>
                <button
                  className={pageStyles.btnPrimary}
                  style={{ padding: "var(--titan-spacing-sm) var(--titan-spacing-xl)" }}
                  onMouseEnter={(e) => {
                    if (obrigacoesSelecionadas.length > 0 && !carregandoObrigacoesGerar && !gerandoTarefas) {
                      e.currentTarget.style.background = "var(--titan-primary-hover)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "var(--titan-glow-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--titan-primary)";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  onClick={gerarTarefas}
                  disabled={obrigacoesSelecionadas.length === 0 || carregandoObrigacoesGerar || gerandoTarefas}
                >
                  {gerandoTarefas ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none"
                        style={{ animation: "spin 1s linear infinite" }}
                      >
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                        <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                      </svg>
                      Gerando Tarefas...
                    </div>
                  ) : (
                    "Gerar Tarefas"
                  )}
                </button>
              </div>

              {/* Aviso de Atenção */}
              <div className={pageStyles.alertWarn}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--titan-spacing-md)", fontSize: "var(--titan-font-size-sm)", color: "white" }}>
                  <span style={{ fontSize: "var(--titan-font-size-lg)", color: "white" }}></span>
                  <div style={{ color: "white" }}>
                    <strong style={{ color: "white" }}>ATENÇÃO!</strong> Você selecionou o ano {filtrosGerarTarefas.anoCalendario},
                    então só serão geradas as tarefas com <strong style={{ color: "white" }}>competência</strong> dentro do ano.
                    Obrigações do ano de {parseInt(filtrosGerarTarefas.anoCalendario) - 1} ou anos anteriores,
                    que vencem em {filtrosGerarTarefas.anoCalendario} não serão geradas,
                    lembre-se de gerar os anos anteriores conforme suas entregas ainda pendentes.
                  </div>
                </div>
              </div>

              {/* Opções */}
              <div className={pageStyles.toolbar}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--titan-spacing-md)" }}>
                  <span className={pageStyles.label}>resultados por página</span>
                  <select 
                    value={itensPorPagina}
                    onChange={(e) => {
                      setItensPorPagina(parseInt(e.target.value));
                      setPaginaAtual(1); // Volta para primeira página ao mudar itens por página
                    }}
                    className={pageStyles.input}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "var(--titan-spacing-md)" }}>
                  <span className={pageStyles.label}>Filtrar por departamento:</span>
                  <select
                    value={filtrosGerarTarefas.departamento}
                    onChange={(e) => {
                      const newValue = e.target.value === "Todos" ? "Todos" : parseInt(e.target.value);
                      atualizarFiltroDepartamento(newValue);
                    }}
                    disabled={carregandoObrigacoesGerar}
                    className={pageStyles.input}
                  >
                    <option value="Todos">Todos os departamentos</option>
                    {todosDepartamentos.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.nome}
                      </option>
                    ))}
                  </select>
                  {carregandoObrigacoesGerar && (
                    <div style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      border: "2px solid var(--titan-primary)",
                      borderTop: "2px solid transparent",
                      animation: "spin 1s linear infinite"
                    }} />
                  )}
                </div>
              </div>

              {/* Tabela de Obrigações */}
              {carregandoObrigacoesGerar ? (
                <div style={{ textAlign: "center", padding: "var(--titan-spacing-xl)" }}>
                  <div style={{ fontSize: "var(--titan-font-size-base)", color: "var(--titan-text-med)" }}>Carregando obrigações...</div>
                </div>
              ) : (
                <div style={{
                  border: "1px solid var(--titan-stroke)",
                  borderRadius: "var(--titan-radius-sm)",
                  overflow: "hidden"
                }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--titan-base-10)" }}>
                        <th style={{
                          padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                          textAlign: "left",
                          fontSize: "var(--titan-font-size-sm)",
                          fontWeight: "var(--titan-font-weight-semibold)",
                          color: "var(--titan-text-high)",
                          borderBottom: "1px solid var(--titan-stroke)"
                        }}>
                          <input
                            type="checkbox"
                            checked={obrigacoesSelecionadas.length === obrigacoesParaGerar.length && obrigacoesParaGerar.length > 0}
                            onChange={(e) => handleSelectAllObrigacoes(e.target.checked)}
                            style={{ transform: "scale(1.2)" }}
                          />
                        </th>
                        <th style={{
                          padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                          textAlign: "left",
                          fontSize: "var(--titan-font-size-sm)",
                          fontWeight: "var(--titan-font-weight-semibold)",
                          color: "var(--titan-text-high)",
                          borderBottom: "1px solid var(--titan-stroke)"
                        }}>
                          Departamento
                        </th>
                        <th style={{
                          padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                          textAlign: "left",
                          fontSize: "var(--titan-font-size-sm)",
                          fontWeight: "var(--titan-font-weight-semibold)",
                          color: "var(--titan-text-high)",
                          borderBottom: "1px solid var(--titan-stroke)"
                        }}>
                          Obrigações
                        </th>
                        <th style={{
                          padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                          textAlign: "left",
                          fontSize: "var(--titan-font-size-sm)",
                          fontWeight: "var(--titan-font-weight-semibold)",
                          color: "var(--titan-text-high)",
                          borderBottom: "1px solid var(--titan-stroke)"
                        }}>
                          Responsáveis
                        </th>
                        <th style={{
                          padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                          textAlign: "left",
                          fontSize: "var(--titan-font-size-sm)",
                          fontWeight: "var(--titan-font-weight-semibold)",
                          color: "var(--titan-text-high)",
                          borderBottom: "1px solid var(--titan-stroke)"
                        }}>
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                          {obrigacoesParaGerar
                            .slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina)
                            .map((obrigacao, index) => (
                        <tr
                          key={obrigacao.id}
                          style={{
                                background: index % 2 === 0 ? "var(--titan-card-bg)" : "var(--titan-base-10)",
                            cursor: verificarSeObrigacaoTemResponsavel(obrigacao) ? "pointer" : "not-allowed",
                            opacity: verificarSeObrigacaoTemResponsavel(obrigacao) ? 1 : 0.6
                          }}
                          onClick={() => {
                            if (verificarSeObrigacaoTemResponsavel(obrigacao)) {
                              handleSelectObrigacao(obrigacao.id, !obrigacoesSelecionadas.includes(obrigacao.id));
                            }
                          }}
                        >
                          <td style={{
                                padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                                borderBottom: "1px solid var(--titan-stroke)"
                          }}>
                            <input
                              type="checkbox"
                              checked={obrigacoesSelecionadas.includes(obrigacao.id)}
                              disabled={!verificarSeObrigacaoTemResponsavel(obrigacao)}
                              onChange={() => {
                                if (verificarSeObrigacaoTemResponsavel(obrigacao)) {
                                  handleSelectObrigacao(obrigacao.id, !obrigacoesSelecionadas.includes(obrigacao.id));
                                }
                              }}
                              style={{
                                transform: "scale(1.2)",
                                opacity: verificarSeObrigacaoTemResponsavel(obrigacao) ? 1 : 0.5
                              }}
                            />
                          </td>
                          <td style={{
                                padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                                borderBottom: "1px solid var(--titan-stroke)",
                                fontSize: "var(--titan-font-size-sm)",
                                color: "var(--titan-text-high)"
                          }}>
                            {obrigacao.departamentoNome}
                          </td>
                          <td style={{
                                padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                                borderBottom: "1px solid var(--titan-stroke)",
                                fontSize: "var(--titan-font-size-sm)",
                                color: "var(--titan-text-high)"
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "var(--titan-spacing-sm)" }}>
                              {obrigacao.nome}
                                  <span style={{ fontSize: "var(--titan-font-size-xs)", color: "var(--titan-text-med)" }}>🔗</span>
                            </div>
                          </td>
                          <td style={{
                                padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                                borderBottom: "1px solid var(--titan-stroke)",
                                fontSize: "var(--titan-font-size-sm)",
                                color: "var(--titan-text-high)"
                          }}>
                            {(() => {
                              // ✅ NOVO: Verificar responsáveis individuais e globais
                              const responsaveisIndividuais = multiResponsaveis[obrigacao.id] || [];
                              const responsaveisGlobais = obrigacao.responsaveisGlobais || [];
                              const temResponsaveisIndividuais = responsaveisIndividuais.length > 0;
                              const temResponsaveisGlobais = responsaveisGlobais.length > 0;
                              
                              // ✅ NOVO: Mostrar responsáveis individuais primeiro, depois globais
                              if (temResponsaveisIndividuais) {
                                return (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--titan-spacing-xs)" }}>
                                    {responsaveisIndividuais.map((resp, idx) => (
                                      <div key={`individual-${obrigacao.id}-${resp.id || resp.usuarioId || 'unknown'}-${idx}`} style={{ 
                                        display: 'inline-block',
                                        background: 'rgba(123, 77, 255, 0.3)', 
                                        color: 'var(--titan-text-high)',
                                        padding: '4px var(--titan-spacing-sm)', 
                                        borderRadius: 'var(--titan-radius-md)',
                                        fontSize: 'var(--titan-font-size-xs)',
                                        fontWeight: 'var(--titan-font-weight-medium)',
                                        border: '1px solid rgba(123, 77, 255, 0.5)'
                                      }}>
                                        {resp.nome}{resp.departamentoNome ? ` - ${resp.departamentoNome}` : ""}
                                      </div>
                                    ))}
                                  </div>
                                );
                              } else if (temResponsaveisGlobais) {
                                return (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--titan-spacing-xs)" }}>
                                    {responsaveisGlobais.map((resp, idx) => (
                                      <div key={`global-${obrigacao.id}-${resp.usuarioId || resp.id || 'unknown'}-${idx}`} style={{ 
                                        display: 'inline-block',
                                        background: 'rgba(34, 197, 94, 0.3)', 
                                        color: 'var(--titan-text-high)',
                                        padding: '4px var(--titan-spacing-sm)', 
                                        borderRadius: 'var(--titan-radius-md)',
                                        fontSize: 'var(--titan-font-size-xs)',
                                        fontWeight: 'var(--titan-font-weight-medium)',
                                        border: '1px solid rgba(34, 197, 94, 0.5)'
                                      }}>
                                        {resp.nome}{resp.departamentoNome ? ` - ${resp.departamentoNome}` : ""} (Global)
                                      </div>
                                    ))}
                                  </div>
                                );
                              } else {
                                return (
                                  <span style={{ color: "var(--titan-text-low)", fontSize: 'var(--titan-font-size-sm)' }}>Sem responsável</span>
                                );
                              }
                            })()}
                          </td>
                          <td style={{
                                padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                                borderBottom: "1px solid var(--titan-stroke)",
                                fontSize: "var(--titan-font-size-sm)",
                                color: "var(--titan-text-high)"
                          }}>
                            {(() => {
                              // ✅ NOVO: Verificar se tem responsável (individual ou global)
                              const temResponsavel = verificarSeObrigacaoTemResponsavel(obrigacao);
                              
                              if (temResponsavel) {
                                return (
                                  <span style={{
                                    padding: "4px var(--titan-spacing-sm)",
                                    borderRadius: "var(--titan-radius-sm)",
                                    background: "var(--titan-success)",
                                    color: "var(--titan-base-00)",
                                    fontSize: "var(--titan-font-size-xs)",
                                    fontWeight: "var(--titan-font-weight-medium)"
                                  }}>
                                    Ativo
                                  </span>
                                );
                              } else {
                                return (
                                  <div style={{
                                    padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                                    background: "var(--titan-error)",
                                    borderRadius: "var(--titan-radius-sm)",
                                    border: "1px solid var(--titan-error)",
                                    fontSize: "var(--titan-font-size-xs)",
                                    color: "white",
                                    maxWidth: "300px"
                                  }}>
                                    Tarefas não serão geradas pois a obrigação não possui nenhum responsável vinculado.
                                  </div>
                                );
                              }
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Botões de Seleção em Lote */}
              {obrigacoesParaGerar.length > 0 && (
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "var(--titan-spacing-md)",
                  marginTop: "var(--titan-spacing-lg)",
                  padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                  background: "var(--titan-base-10)",
                  borderRadius: "var(--titan-radius-sm)",
                  border: "1px solid var(--titan-stroke)"
                }}>
                  <div style={{ display: "flex", gap: "var(--titan-spacing-sm)" }}>
                    {filtrosGerarTarefas.departamento !== "Todos" && (
                      <button
                        style={{
                            padding: "var(--titan-spacing-sm) var(--titan-spacing-lg)",
                            background: "var(--titan-primary)",
                            color: "white",
                            border: "none",
                            borderRadius: "var(--titan-radius-sm)",
                            fontSize: "var(--titan-font-size-sm)",
                            fontWeight: "var(--titan-font-weight-medium)",
                            cursor: "pointer",
                            transition: "all var(--titan-transition-fast)"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.02)";
                            e.currentTarget.style.boxShadow = "var(--titan-glow-primary)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                            e.currentTarget.style.boxShadow = "none";
                        }}
                        onClick={() => {
                          const obrigacoesDoDepartamento = obrigacoesParaGerar
                            .filter(o => {
                              const departamentoId = typeof filtrosGerarTarefas.departamento === "number"
                                ? filtrosGerarTarefas.departamento
                                : parseInt(filtrosGerarTarefas.departamento);
                              return o.departamentoId === departamentoId && verificarSeObrigacaoTemResponsavel(o);
                            })
                            .map(o => o.id);

                          setObrigacoesSelecionadas(obrigacoesDoDepartamento);
                        }}
                      >
                        Selecionar Todas do Departamento
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "var(--titan-spacing-md)" }}>
                    <button
                      style={{
                        padding: "var(--titan-spacing-sm) var(--titan-spacing-lg)",
                        background: "var(--titan-primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "var(--titan-radius-sm)",
                        fontSize: "var(--titan-font-size-sm)",
                        fontWeight: "var(--titan-font-weight-medium)",
                        cursor: "pointer",
                        transition: "all var(--titan-transition-fast)"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.02)";
                        e.currentTarget.style.boxShadow = "var(--titan-glow-primary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      onClick={() => handleSelectAllObrigacoes(true)}
                    >
                      Selecionar Todos (com responsável)
                    </button>
                    <button
                      style={{
                        padding: "var(--titan-spacing-sm) var(--titan-spacing-lg)",
                        background: "var(--titan-primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "var(--titan-radius-sm)",
                        fontSize: "var(--titan-font-size-sm)",
                        fontWeight: "var(--titan-font-weight-medium)",
                        cursor: "pointer",
                        transition: "all var(--titan-transition-fast)"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.02)";
                        e.currentTarget.style.boxShadow = "var(--titan-glow-primary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      onClick={() => handleSelectAllObrigacoes(false)}
                    >
                      Limpar Todos
                    </button>
                  </div>
                </div>
              )}

              {/* Paginação */}
              {obrigacoesParaGerar.length > 0 && (
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "var(--titan-spacing-lg)",
                  padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                  background: "var(--titan-base-10)",
                  borderRadius: "var(--titan-radius-sm)",
                  border: "1px solid var(--titan-stroke)"
                }}>
                  <span style={{ fontSize: "var(--titan-font-size-sm)", color: "var(--titan-text-med)" }}>
                    Mostrando de {Math.min((paginaAtual - 1) * itensPorPagina + 1, obrigacoesParaGerar.length)} até {Math.min(paginaAtual * itensPorPagina, obrigacoesParaGerar.length)} de {obrigacoesParaGerar.length} registros
                  </span>
                  <div style={{ display: "flex", gap: "var(--titan-spacing-sm)" }}>
                    <button 
                      onClick={() => setPaginaAtual(Math.max(1, paginaAtual - 1))}
                      disabled={paginaAtual === 1}
                      style={{
                        padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                        border: "1px solid var(--titan-stroke)",
                        background: paginaAtual === 1 ? "var(--titan-text-low)" : "var(--titan-input-bg)",
                        borderRadius: "var(--titan-radius-sm)",
                        fontSize: "var(--titan-font-size-sm)",
                        color: paginaAtual === 1 ? "var(--titan-text-low)" : "var(--titan-text-high)",
                        cursor: paginaAtual === 1 ? "not-allowed" : "pointer",
                        transition: "all var(--titan-transition-fast)",
                        opacity: paginaAtual === 1 ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (paginaAtual !== 1) {
                          e.currentTarget.style.background = "var(--titan-base-10)";
                          e.currentTarget.style.borderColor = "var(--titan-primary)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (paginaAtual !== 1) {
                          e.currentTarget.style.background = "var(--titan-input-bg)";
                          e.currentTarget.style.borderColor = "var(--titan-stroke)";
                        }
                      }}
                    >
                      Anterior
                    </button>
                    
                    {Array.from({ length: Math.ceil(obrigacoesParaGerar.length / itensPorPagina) }, (_, i) => i + 1)
                      .filter(page => {
                        const totalPages = Math.ceil(obrigacoesParaGerar.length / itensPorPagina);
                        if (totalPages <= 7) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (page >= paginaAtual - 1 && page <= paginaAtual + 1) return true;
                        return false;
                      })
                      .map((page, index, array) => {
                        if (index > 0 && page - array[index - 1] > 1) {
                          return (
                            <span key={`ellipsis-${page}`} style={{ padding: "8px", color: "var(--titan-text-low)" }}>
                              ...
                            </span>
                          );
                        }
                        return (
                          <button
                            key={page}
                            onClick={() => setPaginaAtual(page)}
                            style={{
                              padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                              border: "1px solid var(--titan-stroke)",
                              borderRadius: "var(--titan-radius-sm)",
                              background: page === paginaAtual ? "var(--titan-primary)" : "var(--titan-input-bg)",
                              color: page === paginaAtual ? "white" : "var(--titan-text-high)",
                              cursor: "pointer",
                              fontSize: "var(--titan-font-size-sm)",
                              fontWeight: page === paginaAtual ? "600" : "400",
                              transition: "all var(--titan-transition-fast)"
                            }}
                            onMouseEnter={(e) => {
                              if (page !== paginaAtual) {
                                e.currentTarget.style.background = "var(--titan-base-10)";
                                e.currentTarget.style.borderColor = "var(--titan-primary)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (page !== paginaAtual) {
                                e.currentTarget.style.background = "var(--titan-input-bg)";
                                e.currentTarget.style.borderColor = "var(--titan-stroke)";
                              }
                            }}
                          >
                            {page}
                    </button>
                        );
                      })}
                    
                    <button 
                      onClick={() => setPaginaAtual(Math.min(Math.ceil(obrigacoesParaGerar.length / itensPorPagina), paginaAtual + 1))}
                      disabled={paginaAtual === Math.ceil(obrigacoesParaGerar.length / itensPorPagina)}
                      style={{
                        padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                        border: "1px solid var(--titan-stroke)",
                        borderRadius: "var(--titan-radius-sm)",
                        background: paginaAtual === Math.ceil(obrigacoesParaGerar.length / itensPorPagina) ? "var(--titan-text-low)" : "var(--titan-input-bg)",
                        color: paginaAtual === Math.ceil(obrigacoesParaGerar.length / itensPorPagina) ? "var(--titan-text-low)" : "var(--titan-text-high)",
                        cursor: paginaAtual === Math.ceil(obrigacoesParaGerar.length / itensPorPagina) ? "not-allowed" : "pointer",
                        fontSize: "var(--titan-font-size-sm)",
                        transition: "all var(--titan-transition-fast)",
                        opacity: paginaAtual === Math.ceil(obrigacoesParaGerar.length / itensPorPagina) ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (paginaAtual !== Math.ceil(obrigacoesParaGerar.length / itensPorPagina)) {
                          e.currentTarget.style.background = "var(--titan-base-10)";
                          e.currentTarget.style.borderColor = "var(--titan-primary)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (paginaAtual !== Math.ceil(obrigacoesParaGerar.length / itensPorPagina)) {
                          e.currentTarget.style.background = "var(--titan-input-bg)";
                          e.currentTarget.style.borderColor = "var(--titan-stroke)";
                        }
                      }}
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}


            </div>
          )}
        </>

        {/* Modal de Múltiplos Responsáveis */}
        {modalMultiResponsaveis && clienteMultiResponsaveis && (
          <MultiResponsaveisModal
            isOpen={modalMultiResponsaveis}
            onClose={() => setModalMultiResponsaveis(false)}
            obrigacaoId={clienteMultiResponsaveis.obrigacaoId}
            clienteId={clienteMultiResponsaveis.id}
            obrigacaoNome={clienteMultiResponsaveis.obrigacaoNome}
            clienteNome={clienteMultiResponsaveis.nome}
            onSuccess={() => {
              // Atualizar múltiplos responsáveis para a obrigação específica
              if (clienteMultiResponsaveis) {
                buscarMultiResponsaveis(clienteMultiResponsaveis.obrigacaoId);
              }
              // Não fechar o modal automaticamente - deixar o usuário fechar manualmente
            }}
          />
        )}

        {/* Modal de Replicar Perfil */}
        {modalReplicarPerfil && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}>
            <div style={{
              background: "rgba(11, 11, 17, 0.95)",
              borderRadius: "var(--titan-radius-lg)",
              maxWidth: "900px",
              width: "90%",
              padding: "var(--titan-spacing-xl)",
              boxShadow: "var(--titan-shadow-lg)",
              maxHeight: "90vh",
              overflowY: "auto",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}>
              {/* Header */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--titan-spacing-xl)",
                paddingBottom: "var(--titan-spacing-lg)",
                borderBottom: "1px solid var(--titan-stroke)"
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: "var(--titan-font-size-xl)",
                  fontWeight: "var(--titan-font-weight-semibold)",
                  color: "var(--titan-text-high)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--titan-spacing-sm)"
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8l-5-5z"/>
                    <path d="M14 2v6h6"/>
                    <path d="M16 13H8"/>
                    <path d="M16 17H8"/>
                    <path d="M10 9H8"/>
                  </svg>
                  Replicando Perfil
                </h2>
                <button
                  onClick={() => {
                    setModalReplicarPerfil(false);
                    setClientesSelecionados([]);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    color: "var(--titan-text-med)",
                    padding: "4px",
                    borderRadius: "var(--titan-radius-sm)",
                    transition: "all var(--titan-transition-fast)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--titan-input-bg)";
                    e.currentTarget.style.color = "var(--titan-text-high)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none";
                    e.currentTarget.style.color = "var(--titan-text-med)";
                  }}
                >
                  ×
                </button>
              </div>

              {/* Conteúdo */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--titan-spacing-xl)",
                marginBottom: "var(--titan-spacing-xl)"
              }}>
                {/* Coluna Esquerda - Particularidades */}
                <div>
                  <h3 style={{
                    margin: "0 0 var(--titan-spacing-lg) 0",
                    fontSize: "var(--titan-font-size-lg)",
                    fontWeight: "var(--titan-font-weight-semibold)",
                    color: "var(--titan-text-high)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--titan-spacing-sm)"
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4"/>
                      <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
                    </svg>
                    Particularidades
                  </h3>
                  
                                     <div style={{
                     background: "var(--titan-base-10)",
                     borderRadius: "var(--titan-radius-md)",
                     padding: "var(--titan-spacing-lg)",
                     border: "1px solid var(--titan-stroke)"
                   }}>
                     {carregandoParticularidades ? (
                       <div style={{
                         textAlign: "center",
                         padding: "var(--titan-spacing-xl)",
                         color: "var(--titan-text-med)"
                       }}>
                         <div style={{
                           width: "24px",
                           height: "24px",
                           borderRadius: "50%",
                           border: "2px solid var(--titan-primary)",
                           borderTop: "2px solid transparent",
                           animation: "spin 1s linear infinite",
                           margin: "0 auto var(--titan-spacing-md) auto"
                         }} />
                         Carregando particularidades...
                       </div>
                     ) : particularidadesCliente.length > 0 ? (
                       <div style={{ display: "flex", flexDirection: "column", gap: "var(--titan-spacing-md)" }}>
                         {particularidadesCliente.map((part, index) => (
                           <div key={index} style={{
                             background: "var(--titan-card-bg)",
                             padding: "var(--titan-spacing-md)",
                             borderRadius: "var(--titan-radius-sm)",
                             border: "1px solid var(--titan-stroke)"
                           }}>
                             <div style={{
                               fontSize: "var(--titan-font-size-sm)",
                               fontWeight: "var(--titan-font-weight-medium)",
                               color: "var(--titan-text-high)",
                               marginBottom: "var(--titan-spacing-xs)"
                             }}>
                               {part.perguntaNome || part.perguntaClassificacao || `Pergunta ${part.perguntaId}`}
                             </div>
                             <div style={{
                               fontSize: "var(--titan-font-size-xs)",
                               color: "var(--titan-text-med)"
                             }}>
                               {part.respostaNome || part.respostaClassificacao || part.respostaDescricao || `Resposta ${part.respostaId}`}
                             </div>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div style={{
                         textAlign: "center",
                         padding: "var(--titan-spacing-xl)",
                         color: "var(--titan-text-low)",
                         fontStyle: "italic"
                       }}>
                         Este cliente não possui particularidades definidas
                       </div>
                     )}

                     {/* Grupos */}
                     {cliente?.grupoIds && cliente.grupoIds.length > 0 && (
                       <div style={{ marginTop: "var(--titan-spacing-lg)", paddingTop: "var(--titan-spacing-lg)", borderTop: "1px solid var(--titan-stroke)" }}>
                         <h4 style={{
                           margin: "0 0 var(--titan-spacing-sm) 0",
                           fontSize: "var(--titan-font-size-sm)",
                           fontWeight: "var(--titan-font-weight-semibold)",
                           color: "var(--titan-text-high)"
                         }}>
                           Grupos:
                         </h4>
                         <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--titan-spacing-xs)" }}>
                           {cliente.grupoIds.map((grupoId) => {
                             const grupo = grupos.find(g => g.id === grupoId);
                             return grupo ? (
                               <span key={grupo.id} style={{
                                 background: "var(--titan-warning)",
                                 color: "white",
                                 padding: "4px var(--titan-spacing-sm)",
                                 borderRadius: "var(--titan-radius-sm)",
                                 fontSize: "var(--titan-font-size-xs)",
                                 fontWeight: "var(--titan-font-weight-medium)"
                               }}>
                                 {grupo.nome}
                               </span>
                             ) : null;
                           })}
                         </div>
                       </div>
                     )}
                   </div>
                </div>

                {/* Coluna Direita - Seleção de Clientes */}
                <div>
                  <h3 style={{
                    margin: "0 0 var(--titan-spacing-lg) 0",
                    fontSize: "var(--titan-font-size-lg)",
                    fontWeight: "var(--titan-font-weight-semibold)",
                    color: "var(--titan-text-high)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--titan-spacing-sm)"
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    Clientes ({clientesDisponiveis.length})
                  </h3>

                  {/* Campo de Pesquisa */}
                  <div style={{
                    marginBottom: "var(--titan-spacing-md)",
                    position: "relative"
                  }}>
                    <input
                      type="text"
                      placeholder="Pesquisar clientes..."
                      value={pesquisaClientes}
                      onChange={(e) => setPesquisaClientes(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                        background: "var(--titan-input-bg)",
                        border: "1px solid var(--titan-stroke)",
                        borderRadius: "var(--titan-radius-sm)",
                        color: "var(--titan-text-high)",
                        fontSize: "var(--titan-font-size-sm)"
                      }}
                    />
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      style={{
                        position: "absolute",
                        right: "var(--titan-spacing-sm)",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--titan-text-med)"
                      }}
                    >
                      <circle cx="11" cy="11" r="8"/>
                      <path d="m21 21-4.35-4.35"/>
                    </svg>
                  </div>

                  {/* Botões de Seleção */}
                  <div style={{
                    display: "flex",
                    gap: "var(--titan-spacing-sm)",
                    marginBottom: "var(--titan-spacing-md)"
                  }}>
                    <button
                      onClick={() => {
                        const clientesFiltrados = clientesDisponiveis.filter(c => 
                          (c.razao_social || c.nome)?.toLowerCase().includes(pesquisaClientes.toLowerCase()) ||
                          (c.cpf_cnpj && c.cpf_cnpj.includes(pesquisaClientes))
                        );
                        setClientesSelecionados(clientesFiltrados.map(c => c.clienteId || c.id));
                      }}
                      style={{
                        padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                        background: "var(--titan-primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "var(--titan-radius-sm)",
                        fontSize: "var(--titan-font-size-xs)",
                        fontWeight: "var(--titan-font-weight-medium)",
                        cursor: "pointer",
                        transition: "all var(--titan-transition-fast)"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.02)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      Selecionar Todos
                    </button>
                    <button
                      onClick={() => setClientesSelecionados([])}
                      style={{
                        padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                        background: "var(--titan-base-10)",
                        color: "var(--titan-text-high)",
                        border: "1px solid var(--titan-stroke)",
                        borderRadius: "var(--titan-radius-sm)",
                        fontSize: "var(--titan-font-size-xs)",
                        fontWeight: "var(--titan-font-weight-medium)",
                        cursor: "pointer",
                        transition: "all var(--titan-transition-fast)"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--titan-input-bg)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--titan-base-10)";
                      }}
                    >
                      Limpar Seleção
                    </button>
                  </div>

                  {carregandoClientes ? (
                    <div style={{
                      textAlign: "center",
                      padding: "var(--titan-spacing-xl)",
                      color: "var(--titan-text-med)"
                    }}>
                      <div style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        border: "2px solid var(--titan-primary)",
                        borderTop: "2px solid transparent",
                        animation: "spin 1s linear infinite",
                        margin: "0 auto var(--titan-spacing-md) auto"
                      }} />
                      Carregando clientes...
                    </div>
                  ) : (
                    <div style={{
                      background: "var(--titan-base-10)",
                      borderRadius: "var(--titan-radius-md)",
                      padding: "var(--titan-spacing-lg)",
                      border: "1px solid var(--titan-stroke)",
                      maxHeight: "400px",
                      overflowY: "auto"
                    }}>
                      {clientesDisponiveis.length === 0 ? (
                        <div style={{
                          textAlign: "center",
                          padding: "var(--titan-spacing-lg)",
                          color: "var(--titan-text-low)",
                          fontStyle: "italic"
                        }}>
                          Nenhum cliente disponível para replicar
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--titan-spacing-sm)" }}>
                    {clientesDisponiveis
                            .filter(cliente => 
                              (cliente.razao_social || cliente.nome)?.toLowerCase().includes(pesquisaClientes.toLowerCase()) ||
                              (cliente.cpf_cnpj && cliente.cpf_cnpj.includes(pesquisaClientes))
                            )
                            .map((clienteDestino) => (
                            <div
                              key={clienteDestino.clienteId || clienteDestino.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--titan-spacing-sm)",
                                padding: "var(--titan-spacing-sm)",
                                borderRadius: "var(--titan-radius-sm)",
                                background: clientesSelecionados.includes(clienteDestino.clienteId || clienteDestino.id) 
                                  ? "var(--titan-primary)" 
                                  : "transparent",
                                border: `1px solid ${clientesSelecionados.includes(clienteDestino.clienteId || clienteDestino.id) 
                                  ? "var(--titan-primary)" 
                                  : "var(--titan-stroke)"}`,
                                cursor: "pointer",
                                transition: "all var(--titan-transition-fast)"
                              }}
                              onClick={() => {
                                const clienteId = clienteDestino.clienteId || clienteDestino.id;
                                if (clientesSelecionados.includes(clienteId)) {
                                  setClientesSelecionados(prev => 
                                    prev.filter(id => id !== clienteId)
                                  );
                                } else {
                                  setClientesSelecionados(prev => [...prev, clienteId]);
                                }
                              }}
                              onMouseEnter={(e) => {
                                const clienteId = clienteDestino.clienteId || clienteDestino.id;
                                if (!clientesSelecionados.includes(clienteId)) {
                                  e.currentTarget.style.background = "var(--titan-base-10)";
                                  e.currentTarget.style.borderColor = "var(--titan-primary)";
                                }
                              }}
                              onMouseLeave={(e) => {
                                const clienteId = clienteDestino.clienteId || clienteDestino.id;
                                if (!clientesSelecionados.includes(clienteId)) {
                                  e.currentTarget.style.background = "transparent";
                                  e.currentTarget.style.borderColor = "var(--titan-stroke)";
                                }
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={clientesSelecionados.includes(clienteDestino.clienteId || clienteDestino.id)}
                                onChange={() => {}} // Controlado pelo onClick do div
                                style={{ transform: "scale(1.2)" }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  fontSize: "var(--titan-font-size-sm)",
                                  fontWeight: "var(--titan-font-weight-medium)",
                                  color: clientesSelecionados.includes(clienteDestino.clienteId || clienteDestino.id) 
                                    ? "white" 
                                    : "var(--titan-text-high)"
                                }}>
                                  {clienteDestino.razao_social || clienteDestino.nome}
                                </div>
                                <div style={{
                                  fontSize: "var(--titan-font-size-xs)",
                                  color: clientesSelecionados.includes(clienteDestino.clienteId || clienteDestino.id) 
                                    ? "rgba(255, 255, 255, 0.8)" 
                                    : "var(--titan-text-med)"
                                }}>
                                  {clienteDestino.tipo_inscricao || 'N/A'}: {clienteDestino.cpf_cnpj || 'N/A'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Contador de selecionados */}
                  {clientesSelecionados.length > 0 && (
                    <div style={{
                      marginTop: "var(--titan-spacing-md)",
                      padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                      background: "var(--titan-info-bg)",
                      border: "1px solid var(--titan-info-border)",
                      borderRadius: "var(--titan-radius-sm)",
                      fontSize: "var(--titan-font-size-sm)",
                      color: "var(--titan-info-text)",
                      textAlign: "center"
                    }}>
                      {clientesSelecionados.length} cliente(s) selecionado(s)
                    </div>
                  )}
                </div>
              </div>

              {/* Botões */}
              <div style={{
                display: "flex",
                gap: "var(--titan-spacing-sm)",
                justifyContent: "flex-end",
                paddingTop: "var(--titan-spacing-lg)",
                borderTop: "1px solid var(--titan-stroke)"
              }}>
                <button
                  onClick={() => {
                    setModalReplicarPerfil(false);
                    setClientesSelecionados([]);
                  }}
                  style={{
                    padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                    background: "rgba(255, 255, 255, 0.15)",
                    color: "var(--titan-text-high)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "var(--titan-radius-sm)",
                    fontSize: "var(--titan-font-size-sm)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    cursor: "pointer",
                    transition: "all var(--titan-transition-fast)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--titan-input-bg)";
                    e.currentTarget.style.borderColor = "var(--titan-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                  }}
                  disabled={replicandoPerfil}
                >
                  Fechar
                </button>
                <button
                  onClick={replicarPerfil}
                  disabled={replicandoPerfil || clientesSelecionados.length === 0}
                  style={{
                    padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                    background: clientesSelecionados.length === 0 ? "var(--titan-text-low)" : "var(--titan-success)",
                    color: "white",
                    border: "none",
                    borderRadius: "var(--titan-radius-sm)",
                    fontSize: "var(--titan-font-size-sm)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    cursor: (replicandoPerfil || clientesSelecionados.length === 0) ? "not-allowed" : "pointer",
                    transition: "all var(--titan-transition-fast)",
                    opacity: (replicandoPerfil || clientesSelecionados.length === 0) ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!replicandoPerfil && clientesSelecionados.length > 0) {
                      e.currentTarget.style.transform = "scale(1.02)";
                      e.currentTarget.style.boxShadow = "var(--titan-glow-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!replicandoPerfil && clientesSelecionados.length > 0) {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "none";
                    }
                  }}
                >
                  {replicandoPerfil ? (
                    <span style={{ display: "flex", alignItems: "center", gap: "var(--titan-spacing-sm)" }}>
                      <div style={{ width: "16px", height: "16px" }}>
                      <svg className={pageStyles.spinner} width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </div>
                      Replicando...
                    </span>
                  ) : (
                    "Replicar"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Pesquisa Manual */}
        {modalPesquisaManual && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: isLight ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.5)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}>
            <div style={{
              background: isLight ? "rgba(255, 255, 255, 0.98)" : "rgba(11, 11, 17, 0.6)",
              borderRadius: "var(--titan-radius-lg)",
              maxWidth: "600px",
              width: "90%",
              padding: "var(--titan-spacing-lg)",
              boxShadow: "var(--titan-shadow-lg)",
              maxHeight: "90vh",
              overflowY: "auto",
              border: isLight ? "1px solid rgba(0, 0, 0, 0.08)" : "1px solid rgba(255, 255, 255, 0.1)",
            }}>
              {/* Header */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--titan-spacing-lg)"
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: "var(--titan-font-size-xl)",
                  fontWeight: "var(--titan-font-weight-semibold)",
                  color: "var(--titan-text-high)"
                }}>
                  Adicionar Pesquisa Manualmente
                </h2>
                <button
                  onClick={() => {
                    setModalPesquisaManual(false);
                    setPesquisaManual({
                      dataEnvio: "",
                      dataResposta: "",
                      nota: "",
                      comentario: "",
                      status: "respondido"
                    });
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    color: "var(--titan-text-med)",
                    padding: "4px",
                    borderRadius: "var(--titan-radius-sm)",
                    transition: "all var(--titan-transition-fast)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--titan-input-bg)";
                    e.currentTarget.style.color = "var(--titan-text-high)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none";
                    e.currentTarget.style.color = "var(--titan-text-med)";
                  }}
                >
                  ×
                </button>
              </div>

              {/* Conteúdo */}
              <div style={{ marginBottom: "var(--titan-spacing-lg)" }}>
                <p style={{
                  margin: "0 0 var(--titan-spacing-md) 0",
                  fontSize: "var(--titan-font-size-base)",
                  color: "var(--titan-text-high)",
                  lineHeight: "1.6"
                }}>
                  Adicione uma pesquisa de satisfação manualmente para este cliente.
                </p>

                <div style={{
                  background: "var(--titan-info-bg)",
                  border: "1px solid var(--titan-info-border)",
                  borderRadius: "var(--titan-radius-md)",
                  padding: "var(--titan-spacing-md)",
                  marginBottom: "var(--titan-spacing-md)"
                }}>
                  <h3 style={{
                    margin: "0 0 var(--titan-spacing-sm) 0",
                    fontSize: "var(--titan-font-size-sm)",
                    fontWeight: "var(--titan-font-weight-semibold)",
                    color: "var(--titan-info-text)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--titan-spacing-sm)"
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14,2 14,8 20,8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10,9 9,9 8,9" />
                    </svg>
                    Campos Obrigatórios:
                  </h3>
                  <ul style={{
                    margin: 0,
                    paddingLeft: "20px",
                    color: "var(--titan-info-text)",
                    fontSize: "var(--titan-font-size-sm)",
                    lineHeight: "1.6"
                  }}>
                    <li>Data de envio <strong>OU</strong> data de resposta</li>
                    <li>Nota de 0 a 10</li>
                    <li>Status da pesquisa</li>
                  </ul>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "var(--titan-spacing-md)",
                  marginBottom: "var(--titan-spacing-md)"
                }}>
                  <div>
                    <label style={{
                      display: "block",
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-medium)",
                      marginBottom: "var(--titan-spacing-xs)",
                      color: "var(--titan-text-high)"
                    }}>
                      Data de Envio
                    </label>
                    <input
                      type="date"
                      value={pesquisaManual.dataEnvio}
                      onChange={(e) => setPesquisaManual({
                        ...pesquisaManual,
                        dataEnvio: e.target.value
                      })}
                      style={{
                        width: "100%",
                        padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                        borderRadius: "var(--titan-radius-sm)",
                        border: "1px solid var(--titan-stroke)",
                        fontSize: "var(--titan-font-size-sm)",
                        backgroundColor: "var(--titan-input-bg)",
                        color: "var(--titan-text-high)",
                        outline: "none",
                        transition: "border-color var(--titan-transition-fast)"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: "block",
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-medium)",
                      marginBottom: "var(--titan-spacing-xs)",
                      color: "var(--titan-text-high)"
                    }}>
                      Data de Resposta
                    </label>
                    <input
                      type="date"
                      value={pesquisaManual.dataResposta}
                      onChange={(e) => setPesquisaManual({
                        ...pesquisaManual,
                        dataResposta: e.target.value
                      })}
                      style={{
                        width: "100%",
                        padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                        borderRadius: "var(--titan-radius-sm)",
                        border: "1px solid var(--titan-stroke)",
                        fontSize: "var(--titan-font-size-sm)",
                        backgroundColor: "var(--titan-input-bg)",
                        color: "var(--titan-text-high)",
                        outline: "none",
                        transition: "border-color var(--titan-transition-fast)"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: "block",
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-medium)",
                      marginBottom: "var(--titan-spacing-xs)",
                      color: "var(--titan-text-high)"
                    }}>
                      Nota *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={pesquisaManual.nota}
                      onChange={(e) => setPesquisaManual({
                        ...pesquisaManual,
                        nota: e.target.value
                      })}
                      placeholder="0-10"
                      required
                      style={{
                        width: "100%",
                        padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                        borderRadius: "var(--titan-radius-sm)",
                        border: "1px solid var(--titan-stroke)",
                        fontSize: "var(--titan-font-size-sm)",
                        backgroundColor: "var(--titan-input-bg)",
                        color: "var(--titan-text-high)",
                        outline: "none",
                        transition: "border-color var(--titan-transition-fast)"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: "block",
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-medium)",
                      marginBottom: "var(--titan-spacing-xs)",
                      color: "var(--titan-text-high)"
                    }}>
                      Status
                    </label>
                    <select
                      value={pesquisaManual.status}
                      onChange={(e) => setPesquisaManual({
                        ...pesquisaManual,
                        status: e.target.value
                      })}
                      style={{
                        width: "100%",
                        padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                        borderRadius: "var(--titan-radius-sm)",
                        border: "1px solid var(--titan-stroke)",
                        fontSize: "var(--titan-font-size-sm)",
                        backgroundColor: "var(--titan-input-bg)",
                        color: "var(--titan-text-high)",
                        outline: "none",
                        transition: "border-color var(--titan-transition-fast)"
                      }}
                    >
                      <option value="respondido">Respondido</option>
                      <option value="enviado">Enviado</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: "var(--titan-spacing-md)" }}>
                  <label style={{
                    display: "block",
                    fontSize: "var(--titan-font-size-sm)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    marginBottom: "var(--titan-spacing-xs)",
                    color: "var(--titan-text-high)"
                  }}>
                    Comentário
                  </label>
                  <textarea
                    rows={4}
                    value={pesquisaManual.comentario}
                    onChange={(e) => setPesquisaManual({
                      ...pesquisaManual,
                      comentario: e.target.value
                    })}
                    placeholder="Comentário do cliente (opcional)"
                    style={{
                      width: "100%",
                      padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                      borderRadius: "var(--titan-radius-sm)",
                      border: "1px solid var(--titan-stroke)",
                      fontSize: "var(--titan-font-size-sm)",
                      backgroundColor: "var(--titan-input-bg)",
                      color: "var(--titan-text-high)",
                      outline: "none",
                      resize: "vertical",
                      minHeight: "80px",
                      transition: "border-color var(--titan-transition-fast)"
                    }}
                  />
                </div>
              </div>

              {/* Botões */}
              <div style={{
                display: "flex",
                gap: "var(--titan-spacing-sm)",
                justifyContent: "flex-end",
                marginBottom: "var(--titan-spacing-lg)"
              }}>
                <button
                  onClick={() => {
                    setModalPesquisaManual(false);
                    setPesquisaManual({
                      dataEnvio: "",
                      dataResposta: "",
                      nota: "",
                      comentario: "",
                      status: "respondido"
                    });
                  }}
                  style={{
                    padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                    background: "rgba(255, 255, 255, 0.15)",
                    color: "var(--titan-text-high)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "var(--titan-radius-sm)",
                    fontSize: "var(--titan-font-size-sm)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    cursor: "pointer",
                    transition: "all var(--titan-transition-fast)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--titan-input-bg)";
                    e.currentTarget.style.borderColor = "var(--titan-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                  }}
                  disabled={enviandoPesquisa}
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarPesquisaManual}
                  disabled={enviandoPesquisa}
                  style={{
                    padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                    background: "var(--titan-primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "var(--titan-radius-sm)",
                    fontSize: "var(--titan-font-size-sm)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    cursor: enviandoPesquisa ? "not-allowed" : "pointer",
                    transition: "all var(--titan-transition-fast)",
                    opacity: enviandoPesquisa ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!enviandoPesquisa) {
                      e.currentTarget.style.background = "var(--titan-primary-hover)";
                      e.currentTarget.style.transform = "scale(1.02)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!enviandoPesquisa) {
                      e.currentTarget.style.background = "var(--titan-primary)";
                      e.currentTarget.style.transform = "scale(1)";
                    }
                  }}
                >
                  {enviandoPesquisa ? (
                    <span style={{ display: "flex", alignItems: "center", gap: "var(--titan-spacing-sm)" }}>
                      <div style={{ width: "16px", height: "16px" }}>
                        <svg className={pageStyles.spinner} width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </div>
                      Salvando...
                    </span>
                  ) : (
                    "Salvar Pesquisa"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Campos Adicionais */}
        {modalCamposAdicionais && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}>
            <div style={{
              background: "var(--titan-card-bg)",
              borderRadius: "var(--titan-radius-lg)",
              maxWidth: "800px",
              width: "90%",
              maxHeight: "90vh",
              overflow: "hidden",
              border: "1px solid var(--titan-stroke)",
              boxShadow: "var(--titan-shadow-xl)",
            }}>
              {/* Header do Modal */}
              <div style={{
                padding: "var(--titan-spacing-lg)",
                borderBottom: "1px solid var(--titan-stroke)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "var(--titan-text-high)",
                }}>
                  Campo Adicional
                </h2>
                <button
                  onClick={fecharModalCamposAdicionais}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--titan-text-low)",
                    cursor: "pointer",
                    fontSize: "20px",
                    padding: "4px",
                    borderRadius: "4px",
                    transition: "color 0.2s ease",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--titan-text-high)"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--titan-text-low)"}
                >
                  ×
                </button>
              </div>

              {/* Conteúdo do Modal */}
              <div style={{
                padding: "var(--titan-spacing-lg)",
                maxHeight: "calc(90vh - 120px)",
                overflowY: "auto",
              }}>
                {/* Seção para criar novo campo */}
                <div style={{
                  marginBottom: "var(--titan-spacing-lg)",
                  padding: "var(--titan-spacing-md)",
                  background: "var(--titan-base-01)",
                  borderRadius: "var(--titan-radius-md)",
                  border: "1px solid var(--titan-stroke)",
                }}>
                  <h3 style={{
                    margin: "0 0 var(--titan-spacing-md) 0",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "var(--titan-text-high)",
                  }}>
                    Novo Campo
                  </h3>
                  
                  <div style={{
                    display: "flex",
                    gap: "var(--titan-spacing-md)",
                    alignItems: "end",
                  }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Nome</label>
                      <input
                        type="text"
                        placeholder="Nome do campo adicional"
                        value={novoCampoNome}
                        onChange={(e) => setNovoCampoNome(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    
                    <button
                      onClick={criarNovoCampo}
                      disabled={!novoCampoNome.trim()}
                      style={{
                        ...btnStyleGreen,
                        opacity: !novoCampoNome.trim() ? 0.5 : 1,
                        cursor: !novoCampoNome.trim() ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 20px",
                      }}
                    >
                      <span>+</span>
                      Adicionar
                    </button>
                  </div>
                </div>

                {/* Lista de campos existentes */}
                <div>
                  <h3 style={{
                    margin: "0 0 var(--titan-spacing-md) 0",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "var(--titan-text-high)",
                  }}>
                    Campos Existentes
                  </h3>
                  
                  {carregandoCamposAdicionais ? (
                    <div style={{
                      textAlign: "center",
                      padding: "var(--titan-spacing-lg)",
                      color: "var(--titan-text-low)",
                    }}>
                      Carregando campos...
                    </div>
                  ) : camposAdicionais.length === 0 ? (
                    <div style={{
                      textAlign: "center",
                      padding: "var(--titan-spacing-lg)",
                      color: "var(--titan-text-low)",
                      background: "var(--titan-base-01)",
                      borderRadius: "var(--titan-radius-md)",
                      border: "1px solid var(--titan-stroke)",
                    }}>
                      Nenhum campo adicional encontrado
                    </div>
                  ) : (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--titan-spacing-md)",
                    }}>
                      {camposAdicionais.map((campo, index) => (
                        <div key={campo.id} style={{
                          display: "grid",
                          gridTemplateColumns: "auto 1fr auto auto",
                          gap: "var(--titan-spacing-md)",
                          alignItems: "center",
                          padding: "var(--titan-spacing-md)",
                          background: "var(--titan-base-01)",
                          borderRadius: "var(--titan-radius-md)",
                          border: "1px solid var(--titan-stroke)",
                        }}>
                          <span style={{
                            color: "var(--titan-text-low)",
                            fontSize: "14px",
                            fontWeight: "500",
                          }}>
                            {index + 1}
                          </span>
                          
                          <div style={{
                            fontSize: "14px",
                            fontWeight: "500",
                            color: "var(--titan-text-high)",
                          }}>
                            {campo.nome}
                          </div>
                          
                          <input
                            type="text"
                            placeholder={`Conteúdo do campo ${campo.nome}`}
                            value={valoresCamposAdicionais[campo.id] || ""}
                            onChange={(e) => {
                              setValoresCamposAdicionais(prev => ({
                                ...prev,
                                [campo.id]: e.target.value
                              }));
                            }}
                            style={{
                              ...inputStyle,
                              minWidth: "200px",
                            }}
                          />
                          
                          <button
                            onClick={() => excluirCampoAdicional(campo.id)}
                            style={{
                              background: "#ef4444",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              padding: "6px 8px",
                              cursor: "pointer",
                              fontSize: "12px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "32px",
                              height: "32px",
                            }}
                            title="Excluir campo"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3,6 5,6 21,6"></polyline>
                              <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer do Modal */}
              <div style={{
                padding: "var(--titan-spacing-lg)",
                borderTop: "1px solid var(--titan-stroke)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "var(--titan-spacing-md)",
              }}>
                <button
                  onClick={fecharModalCamposAdicionais}
                  style={{
                    padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                    background: "var(--titan-base-01)",
                    color: "var(--titan-text-high)",
                    border: "1px solid var(--titan-stroke)",
                    borderRadius: "var(--titan-radius-md)",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    transition: "all 0.2s ease",
                  }}
                >
                  Fechar
                </button>
                
                <button
                  onClick={salvarValoresCamposAdicionais}
                  disabled={salvandoCamposAdicionais}
                  style={{
                    padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                    background: "var(--titan-primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "var(--titan-radius-md)",
                    cursor: salvandoCamposAdicionais ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    transition: "all 0.2s ease",
                    opacity: salvandoCamposAdicionais ? 0.7 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {salvandoCamposAdicionais ? (
                    <>
                      <div style={{ width: "16px", height: "16px" }}>
                        <svg className={pageStyles.spinner} width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </div>
                      Salvando...
                    </>
                  ) : (
                    "Salvar"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 4,
  color: "var(--titan-text-high)",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid var(--titan-stroke)",
  fontSize: 13,
  backgroundColor: "var(--titan-input-bg)",
  color: "var(--titan-text-high)",
  outline: "none",            // Para garantir que não tenha outline padrão
  boxShadow: "none",          // Para não conflitar
  transition: "box-shadow 0.2s, border-color 0.2s", // Suaviza a animação
};

const btnStyleGreen = {
  backgroundColor: "#1976D2",
  color: "white",
  padding: "8px 16px",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const btnStyleRed = {
  backgroundColor: "#ef4444",
  color: "white",
  padding: "8px 16px",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const btnStyleBlue = {
  backgroundColor: "#3b82f6",
  color: "white",
  padding: "8px 16px",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

// Estilos personalizados para o Toastify
const toastStyles = `
  .custom-toast {
    background-color: #1a1a1a !important;
    color: #ffffff !important;
    border: 1px solid #333333 !important;
    border-radius: 8px !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
  }
  
  .custom-toast .Toastify__toast-body {
    color: #ffffff !important;
    font-family: inherit !important;
    font-weight: 500 !important;
  }
  
  .custom-toast .Toastify__progress-bar {
    background-color: var(--titan-primary) !important;
  }
  
  .custom-toast .Toastify__close-button {
    color: #888888 !important;
  }
  
  .custom-toast .Toastify__close-button:hover {
    color: #ffffff !important;
  }
  
  /* Estilos para os ícones dos toasts */
  .custom-toast .Toastify__toast-icon {
    margin-right: 12px !important;
  }
  
  .custom-toast .Toastify__toast-icon svg {
    width: 20px !important;
    height: 20px !important;
  }
  
  /* Sobrescrever cores específicas dos tipos de toast */
  .Toastify__toast--success.custom-toast {
    background-color: #1a1a1a !important;
    border-left: 4px solid #10b981 !important;
  }
  
  .Toastify__toast--success.custom-toast .Toastify__toast-icon {
    color: #10b981 !important;
  }
  
  .Toastify__toast--error.custom-toast {
    background-color: #1a1a1a !important;
    border-left: 4px solid #ef4444 !important;
  }
  
  .Toastify__toast--error.custom-toast .Toastify__toast-icon {
    color: #ef4444 !important;
  }
  
  .Toastify__toast--warning.custom-toast {
    background-color: #1a1a1a !important;
    border-left: 4px solid #f59e0b !important;
  }
  
  .Toastify__toast--warning.custom-toast .Toastify__toast-icon {
    color: #f59e0b !important;
  }
  
  .Toastify__toast--info.custom-toast {
    background-color: #1a1a1a !important;
    border-left: 4px solid #3b82f6 !important;
  }
  
  .Toastify__toast--info.custom-toast .Toastify__toast-icon {
    color: #3b82f6 !important;
  }
`;

// Injetar os estilos do toast
if (typeof document !== 'undefined') {
  const toastStyleElement = document.createElement('style');
  toastStyleElement.textContent = toastStyles;
  document.head.appendChild(toastStyleElement);
}

