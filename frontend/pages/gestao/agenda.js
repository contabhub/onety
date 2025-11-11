"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import ptBrLocale from "@fullcalendar/core/locales-all";
import Select from "react-select";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FaFileExcel, FaFilePdf, FaImage, FaFilter } from "react-icons/fa";
import PrincipalSidebar from "@/components/onety/principal/PrincipalSidebar";
import styles from "../../styles/gestao/Agenda.module.css";

// Estilos personalizados para o Toastify (tema escuro)
const toastStyles = `
  .custom-toast {
    background-color: var(--titan-base-00) !important;
    color: var(--titan-text-high) !important;
    border: 1px solid var(--titan-stroke) !important;
    border-radius: var(--titan-radius-sm) !important;
    box-shadow: var(--titan-shadow-lg) !important;
  }
  
  .custom-toast .Toastify__toast-body {
    color: var(--titan-text-high) !important;
    font-family: inherit !important;
    font-weight: var(--titan-font-weight-medium) !important;
  }
  
  .custom-toast .Toastify__progress-bar {
    background-color: var(--titan-primary) !important;
  }
  
  .custom-toast .Toastify__close-button {
    color: var(--titan-text-low) !important;
  }
  
  .custom-toast .Toastify__close-button:hover {
    color: var(--titan-text-high) !important;
  }
  
  .Toastify__toast--success.custom-toast {
    background-color: var(--titan-base-00) !important;
    border-left: 4px solid var(--titan-success) !important;
  }
  
  .Toastify__toast--error.custom-toast {
    background-color: var(--titan-base-00) !important;
    border-left: 4px solid var(--titan-error) !important;
  }
  
  .Toastify__toast--warning.custom-toast {
    background-color: var(--titan-base-00) !important;
    border-left: 4px solid var(--titan-warning) !important;
  }
  
  .Toastify__toast--info.custom-toast {
    background-color: var(--titan-base-00) !important;
    border-left: 4px solid var(--titan-primary) !important;
  }
`;

// Injetar os estilos do toast
if (typeof document !== 'undefined') {
  const toastStyleElement = document.createElement('style');
  toastStyleElement.textContent = toastStyles;
  document.head.appendChild(toastStyleElement);
}

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

const resolveUrl = (path) => {
  if (!path) return BASE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  if (!BASE_URL) return path;
  return path.startsWith("/") ? `${BASE_URL}${path}` : `${BASE_URL}/${path}`;
};

const fetchJson = async (path, options = {}) => {
  const { headers, ...rest } = options;
  const response = await fetch(resolveUrl(path), {
    method: "GET",
    ...rest,
    headers: {
      ...(headers || {})
    }
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(`Erro ao buscar ${path}: ${response.status}`);
    error.response = {
      status: response.status,
      data
    };
    throw error;
  }

  return data;
};

const getAuthInfo = () => {
  if (typeof window === "undefined") {
    return { token: null, empresaId: null, userData: null };
  }

  const token = localStorage.getItem("token");
  let empresaId =
    localStorage.getItem("empresaId") ||
    localStorage.getItem("EmpresaId") ||
    null;

  let userData = null;
  const rawUserData = localStorage.getItem("userData");
  if (rawUserData) {
    try {
      userData = JSON.parse(rawUserData);
      if (!empresaId) {
        empresaId =
          userData?.EmpresaId ??
          userData?.empresaId ??
          userData?.empresa?.id ??
          null;
      }
    } catch (error) {
      console.error("Erro ao parsear userData:", error);
    }
  }

  return { token, empresaId, userData };
};

export default function Agenda() {
  const calendarRef = useRef(null);
  const [isClient, setIsClient] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tarefas, setTarefas] = useState([]);
  const [obrigacoes, setObrigacoes] = useState([]);
  const [tipoData, setTipoData] = useState("acao");
  const [tipoDataObrigacao, setTipoDataObrigacao] = useState("vencimento");
  const [tipoItem, setTipoItem] = useState("ambos");
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [eventosModal, setEventosModal] = useState([]);
  const [tituloModal, setTituloModal] = useState("");
  const [dataModal, setDataModal] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "id",
    direction: "asc"
  });
  const [abaAtiva, setAbaAtiva] = useState("solicitacoes");
  const [departamentos, setDepartamentos] = useState([]);
  const [departamentoSelecionado, setDepartamentoSelecionado] = useState("");
  const [itensPorPagina, setItensPorPagina] = useState(10);
  
  // Estados para filtro de grupos
  const [gruposDisponiveis, setGruposDisponiveis] = useState([]);
  const [gruposSelecionados, setGruposSelecionados] = useState([]);
  const [clientesPorGrupo, setClientesPorGrupo] = useState([]);
  
  // Novos filtros
  const [filtroObrigacao, setFiltroObrigacao] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtrosAplicados, setFiltrosAplicados] = useState(false);
  const [obrigacoesList, setObrigacoesList] = useState([]);
  const [responsaveisList, setResponsaveisList] = useState([]);
  const [clientesList, setClientesList] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [carregandoObrigacoes, setCarregandoObrigacoes] = useState(false);
  const [carregandoResponsaveis, setCarregandoResponsaveis] = useState(false);
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  

  const router = useRouter();
  const searchParams = useSearchParams();
  const departamentoFiltro = searchParams?.get("departamento") || null;

  // ✅ Controlar se o componente está montado no cliente
  useEffect(() => {
    setIsClient(true);
  }, []);

  const renderizarEvento = (info) => {
    const quantidade = info.event.extendedProps.quantidade || 1;
    const temMultiplos = quantidade > 1;
    
    return {
      html: `
        <div style="
          background: ${info.event.backgroundColor};
          border: 1px solid ${info.event.borderColor};
          border-radius: 8px;
          padding: 6px 8px;
          text-align: left;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          font-family: 'Roboto', sans-serif;
          cursor: pointer;
          transition: transform 0.2s ease-in-out;
          position: relative;
        "
        onmouseover="this.style.transform='scale(1.02)';"
        onmouseout="this.style.transform='scale(1)';"
        >
          <div style="font-weight: 600; font-size: 12px; color: #1a1a1a; line-height: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${info.event.title.split("\n")[0]}
          </div>
          <div style="font-size: 10px; color: #1a1a1a; margin-top: 2px; line-height: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${info.event.title.split("\n")[1] ?? ""}
          </div>
          ${temMultiplos ? `
            <div style="
              position: absolute;
              top: -6px;
              right: -6px;
              background: #ef4444;
              color: white;
              border-radius: 50%;
              width: 23px;
              height: 23px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: bold;
              border: 2px solid white;
              box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            ">
              ${quantidade}
            </div>
          ` : ''}
        </div>
      `
    };
  };

  useEffect(() => {
    // ✅ Só executar quando o componente estiver montado no cliente
    if (!isClient) return;
    
    const { token, empresaId } = getAuthInfo();


    setCarregando(true);

    const promises = [];

    // Carregar tarefas
    if (tipoItem === "tarefas" || tipoItem === "ambos") {
      promises.push(
        fetchJson(`/gestao/tarefas/todas/${empresaId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((data) => {
            const tarefasData = Array.isArray(data) ? data : data?.data || [];
            setTarefas(tarefasData);
            return tarefasData;
          })
          .catch((err) => {
            console.error("Erro ao carregar tarefas:", err);
            setTarefas([]);
            return [];
          })
      );
    } else {
      setTarefas([]);
    }

    // Carregar obrigações
    if (tipoItem === "obrigacoes" || tipoItem === "ambos") {
      promises.push(
        fetchJson(`/gestao/obrigacoes/empresa/${empresaId}/todas`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((data) => {
            const obrigacoesData = Array.isArray(data) ? data : data?.data || [];
            setObrigacoes(obrigacoesData);
            return obrigacoesData;
          })
          .catch((err) => {
            console.error("Erro ao carregar obrigações:", err);
            setObrigacoes([]);
            return [];
          })
      );
    } else {
      setObrigacoes([]);
    }

    // Aguardar todas as requisições terminarem
    Promise.all(promises).finally(() => {
      setCarregando(false);
    });
  }, [isClient, router, tipoItem, tipoData, tipoDataObrigacao]);

  // Construir lista de clientes a partir das tarefas/obrigações carregadas
  useEffect(() => {
    if (!isClient) return;
    setCarregandoClientes(true);
    try {
      const nomesClientes = new Set();
      (tarefas || []).forEach((t) => {
        const nome = t.cliente_nome || t.clienteNome || t.nomeCliente;
        if (nome && String(nome).trim() !== "") nomesClientes.add(String(nome));
      });
      (obrigacoes || []).forEach((o) => {
        const nome = o.cliente_nome || o.clienteNome || o.nomeCliente;
        if (nome && String(nome).trim() !== "") nomesClientes.add(String(nome));
      });
      const listaOrdenada = Array.from(nomesClientes).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      setClientesList(listaOrdenada);
    } finally {
      setCarregandoClientes(false);
    }
  }, [isClient, tarefas, obrigacoes]);

  const getCorStatus = (item, isObrigacao = false) => {
    let dataReferencia;
    
    if (isObrigacao) {
      // Para obrigações, usar a data de referência se fornecida, senão usar a data baseada no tipo selecionado
      if (item.dataReferencia) {
        dataReferencia = new Date(item.dataReferencia);
      } else {
        // Usar a data baseada no tipo selecionado para obrigações
        if (tipoDataObrigacao === "vencimento") {
          const dataVencimento = item.vencimento || item.data_vencimento;
          if (!dataVencimento) return "#888"; // Se não tem data, retorna cinza
          dataReferencia = new Date(dataVencimento);
        } else if (tipoDataObrigacao === "acao") {
          // Usar o campo 'acao' se preenchido, senão usar 'dataAcao' calculado
          const dataAcao = item.acao || item.dataAcao;
          if (!dataAcao) return "#888"; // Se não tem data de ação, retorna cinza
          dataReferencia = new Date(dataAcao);
        } else if (tipoDataObrigacao === "meta") {
          // Usar o campo 'meta' se preenchido, senão usar 'dataMeta' calculado
          const dataMeta = item.meta || item.dataMeta;
          if (!dataMeta) return "#888"; // Se não tem data de meta, retorna cinza
          dataReferencia = new Date(dataMeta);
        } else {
          // Fallback para vencimento
          const dataVencimento = item.vencimento || item.data_vencimento;
          if (!dataVencimento) return "#888";
          dataReferencia = new Date(dataVencimento);
        }
      }
    } else {
      // Para tarefas, usar a data de referência se fornecida, senão usar a data baseada no tipo selecionado
      if (item.dataReferencia) {
        dataReferencia = new Date(item.dataReferencia);
      } else {
        dataReferencia = new Date(item[`data${tipoData.charAt(0).toUpperCase() + tipoData.slice(1)}`]);
      }
    }
    
    const hoje = new Date();
    const dif = dataReferencia.getTime() - hoje.getTime();

    if (isObrigacao && item.status === "concluida") return "#4ade80"; // Verde concluida (sem acento)
    if (!isObrigacao && item.status === "concluída") return "#4ade80"; // Verde concluída (com acento para tarefas)
    if (dif < -86400000) return "#dc2626"; // Atrasada
    if (dif < 0) return "#fe8320"; // Vence hoje
    if (dif < 86400000 * 15) return "#facc15"; // Novo amarelo mais forte
    return "#888"; // Fora do programado
  };

  // Filtrar tarefas e obrigações pelo departamento, se houver filtro
  let tarefasFiltradas = departamentoFiltro
    ? tarefas.filter(t => t.departamento === departamentoFiltro)
    : tarefas;
  let obrigacoesFiltradas = departamentoFiltro
    ? obrigacoes.filter(o => o.departamento_nome === departamentoFiltro || o.departamento === departamentoFiltro)
    : obrigacoes;

  // Filtrar por grupos se houver grupos selecionados
  if (gruposSelecionados.length > 0 && clientesPorGrupo.length > 0) {
    tarefasFiltradas = tarefasFiltradas.filter(t => {
      const clienteId = t.clienteId || t.idCliente || t.cliente_id || t.id;
      return clientesPorGrupo.includes(clienteId);
    });
    
    obrigacoesFiltradas = obrigacoesFiltradas.filter(o => {
      const clienteId = o.clienteId || o.idCliente || o.cliente_id || o.id;
      return clientesPorGrupo.includes(clienteId);
    });
  }

  // Função para agrupar eventos
  const agruparEventos = (eventos) => {
    const grupos = {};
    
    eventos.forEach(evento => {
      // Agrupar por data, título e status
      const tituloPrincipal = evento.title.split("\n")[0];
      
      // Determinar o status do evento baseado na cor
      let status = "pendente";
      if (evento.backgroundColor === "#4ade80") {
        status = "concluido";
      }
      
      // Criar chave única que inclui status
      const chave = `${evento.date}-${tituloPrincipal}-${status}`;
      
      if (!grupos[chave]) {
        grupos[chave] = [];
      }
      grupos[chave].push(evento);
    });

    return Object.values(grupos).map(grupo => {
      const primeiro = grupo[0];
      const tituloPrincipal = primeiro.title.split("\n")[0];
      
      // Determinar o status do grupo
      let status = "pendente";
      if (primeiro.backgroundColor === "#4ade80") {
        status = "concluido";
      }
      
      return {
        title: primeiro.title,
        date: primeiro.date,
        backgroundColor: primeiro.backgroundColor,
        borderColor: primeiro.borderColor,
        textColor: primeiro.textColor,
        extendedProps: {
          id: grupo.length === 1 ? primeiro.extendedProps.id : `grupo-${primeiro.date}-${tituloPrincipal.replace(/\s+/g, '-')}-${status}`,
          tipo: primeiro.extendedProps.tipo,
          quantidade: grupo.length,
          items: grupo,
          originalDate: primeiro.extendedProps.originalDate, // Preservar a data original
          status: status // Adicionar status ao grupo
        }
      };
    });
  };











  const legenda = [
    { cor: "#4ade80", texto: "Concluída" },
    { cor: "#fe8320", texto: "Vence Hoje" },
    { cor: "#dc2626", texto: "Atrasada" },
    { cor: "#facc15", texto: "Vence em até 15 dias" },
    { cor: "#888", texto: "Fora do programado" },
  ];

  const abrirModal = (info) => {
    const eventosModal = info.event.extendedProps.items || [info.event];
    
    // Mapear os eventos para incluir os dados originais das tarefas/obrigações
    const eventosComDados = eventosModal.map((evento) => {
      const tipo = evento.extendedProps.tipo;
      const id = evento.extendedProps.id;
      
      // ✅ Encontrar os dados originais baseado no tipo e ID
      // Usar os dados filtrados se os filtros estiverem aplicados
      let dadosOriginais = null;
      
      if (tipo === "tarefa") {
        // ✅ Usar tarefasFiltradas se filtros estiverem aplicados, senão usar tarefas
        const listaTarefas = filtrosAplicados ? tarefasFiltradas : tarefas;
        dadosOriginais = listaTarefas.find(t => t.id == id);
      } else if (tipo === "obrigacao") {
        // ✅ Usar obrigacoesFiltradas se filtros estiverem aplicados, senão usar obrigacoes
        const listaObrigacoes = filtrosAplicados ? obrigacoesFiltradas : obrigacoes;
        dadosOriginais = listaObrigacoes.find(o => o.id == id);
      }
      
      return {
        ...evento,
        dadosOriginais
      };
    });
    
    setEventosModal(eventosComDados);
    setTituloModal(info.event.title);
    // Usar a data original do evento (sem processamento do FullCalendar)
    const dataEvento = info.event.extendedProps.originalDate || info.event.date || info.event.startStr;
    setDataModal(dataEvento);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEventosModal([]);
    setTituloModal("");
    setDataModal("");
    setSearchTerm("");
    setPaginaAtual(1);
    setAbaAtiva("solicitacoes");
  };

  // Função para ordenação
  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setPaginaAtual(1);
  };

  // Função para capitalizar
  const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  // Função para filtrar tarefas por texto
  const filtroTexto = (t) => {
    const termo = searchTerm.toLowerCase();
    if (!termo) return true; // Se não há termo de busca, retorna tudo
    
    // ✅ Usar dados originais se disponível, senão usar dados do evento
    const dados = t.dadosOriginais || t;
    
    return (
      String(dados.id || t.extendedProps?.id || '').includes(termo) ||
      (dados.assunto?.toLowerCase().includes(termo)) ||
      (dados.nome?.toLowerCase().includes(termo)) ||
      (dados.nomeObrigacao?.toLowerCase().includes(termo)) ||
      (dados.cliente_nome?.toLowerCase().includes(termo)) ||
      (dados.status?.toLowerCase().includes(termo)) ||
      (dados.departamento?.toLowerCase().includes(termo)) ||
      (dados.departamento_nome?.toLowerCase().includes(termo)) ||
      // ✅ Buscar também no título do evento
      (t.title?.toLowerCase().includes(termo)) ||
      // ✅ Buscar no responsável
      (dados.responsavel?.toLowerCase().includes(termo)) ||
      (dados.responsavel_nome?.toLowerCase().includes(termo))
    );
  };

  // Função para aplicar filtros avançados
  const aplicarFiltrosAvancados = (item) => {
    // Filtro por obrigação
    if (filtroObrigacao) {
      const obrigacaoNome = item.obrigacao_nome || item.nomeObrigacao || item.nome || '';
      if (!obrigacaoNome.toLowerCase().includes(filtroObrigacao.toLowerCase())) {
        return false;
      }
    }

    // Filtro por status
    if (filtroStatus && item.status) {
      if (filtroStatus === "pendente" && item.status.toLowerCase() !== "pendente") {
        return false;
      }
      if (filtroStatus === "concluido" && (item.status.toLowerCase() !== "concluído" && item.status.toLowerCase() !== "concluida")) {
        return false;
      }
    }

    // Filtro por responsável
    if (filtroResponsavel) {
      let responsavelNome = '';
      if (item.responsaveis && item.responsaveis.length > 0) {
        // Para obrigações com array de responsáveis
        const nomesResponsaveis = item.responsaveis.map((resp) => resp.responsavelNome || resp.nome).filter(Boolean);
        responsavelNome = nomesResponsaveis.join(', ');
      } else {
        // Para tarefas ou obrigações com responsável único
        responsavelNome = item.responsavel_nome || item.responsavel || item.responsavelNome || '';
      }
      
      if (!responsavelNome.toLowerCase().includes(filtroResponsavel.toLowerCase())) {
        return false;
      }
    }

    // Filtro por cliente (igualdade exata para consistência)
    if (filtroCliente) {
      const clienteNome = item.cliente_nome || item.clienteNome || item.nomeCliente || '';
      if (!clienteNome || clienteNome.toLowerCase() !== filtroCliente.toLowerCase()) {
        return false;
      }
    }

    return true;
  };

  // Aplicar filtros avançados se estiverem ativos
  if (filtrosAplicados) {
    tarefasFiltradas = tarefasFiltradas.filter(aplicarFiltrosAvancados);
    obrigacoesFiltradas = obrigacoesFiltradas.filter(aplicarFiltrosAvancados);
  }

  // Criar eventos APÓS aplicar os filtros
  const eventosTarefas = tarefasFiltradas.map((t) => {
    // Usar apenas o tipo de data selecionado
    const dataCampo = `data${tipoData.charAt(0).toUpperCase() + tipoData.slice(1)}`;
    const data = t[dataCampo];
    
    if (!data) return null; // Não criar evento se não tiver a data selecionada
    
    const corStatus = getCorStatus({ ...t, dataReferencia: data }, false);
    return {
      title: `${t.assunto}\n${t.responsavel ?? ""}`,
      date: data?.split("T")[0],
      backgroundColor: corStatus,
      borderColor: corStatus,
      textColor: "#ffffff",
      extendedProps: { 
        id: t.id, 
        tipo: "tarefa",
        originalDate: data?.split("T")[0],
        dataTipo: tipoData
      },
    };
  }).filter(Boolean);

  const eventosObrigacoes = obrigacoesFiltradas.map((o) => {
    // Usar apenas o tipo de data selecionado para obrigações
    let data;
    if (tipoDataObrigacao === "vencimento") {
      data = o.vencimento || o.data_vencimento;
    } else if (tipoDataObrigacao === "acao") {
      // Usar o campo 'acao' se preenchido, senão usar 'dataAcao' calculado
      data = o.acao || o.dataAcao;
    } else if (tipoDataObrigacao === "meta") {
      // Usar o campo 'meta' se preenchido, senão usar 'dataMeta' calculado
      data = o.meta || o.dataMeta;
    }
    
    if (!data) return null; // Não criar evento se não tiver a data selecionada
    
    const corStatus = getCorStatus({ ...o, dataReferencia: data }, true);
    return {
      title: `${o.nomeObrigacao}\n${o.cliente_nome ?? ""}`,
      date: data?.split("T")[0],
      backgroundColor: corStatus,
      borderColor: corStatus,
      textColor: "#ffffff",
      extendedProps: { 
        id: o.id, 
        tipo: "obrigacao",
        originalDate: data?.split("T")[0],
        dataTipo: tipoDataObrigacao
      },
    };
  }).filter(Boolean);

  // Filtrar eventos baseado no tipoItem selecionado
  let eventos = [];
  if (tipoItem === "tarefas") {
    eventos = eventosTarefas;
  } else if (tipoItem === "obrigacoes") {
    eventos = eventosObrigacoes;
  } else {
    eventos = [...eventosTarefas, ...eventosObrigacoes];
  }

  // Agrupar eventos
  const eventosAgrupados = agruparEventos(eventos);

  // Função para exportar agenda em Excel
  const exportarParaExcel = () => {
    try {
      import('xlsx').then((XLSX) => {
        // Obter dados reais das tarefas e obrigações
        const dados = [
          ['Data', 'Tipo', 'Título', 'Cliente', 'Status', 'Departamento', 'Responsável', 'Obrigação'], // Cabeçalho
        ];

        // Obter mês atual do calendário de forma segura
        const calendarApi = calendarRef.current?.getApi();
        const currentDate = calendarApi?.getDate() || new Date();
        const currentMonth = new Date(currentDate).getMonth();
        const currentYear = new Date(currentDate).getFullYear();

        // Array para armazenar todos os dados antes de ordenar
        const dadosParaOrdenar = [];

        // Processar eventos agrupados para obter dados reais
        eventosAgrupados.forEach(evento => {
          // Filtrar por mês selecionado
          const eventoDate = new Date(evento.date);
          if (eventoDate.getMonth() === currentMonth && eventoDate.getFullYear() === currentYear) {
            evento.extendedProps.items.forEach((item) => {
              const tipo = item.extendedProps.tipo;
              const id = item.extendedProps.id;
              
              // Encontrar dados originais
              let dadosOriginais = null;
      if (tipo === "tarefa") {
        dadosOriginais = tarefas.find(t => t.id == id);
      } else if (tipo === "obrigacao") {
        dadosOriginais = obrigacoes.find(o => o.id == id);
      }
      
              if (dadosOriginais) {
                // Aplicar filtros avançados se estiverem ativos
                if (showAdvancedFilters) {
                  if (!aplicarFiltrosAvancados(dadosOriginais)) {
                    return; // Pular este item se não passar nos filtros
                  }
                }



                // Obter responsável correto
                let responsavel = 'N/A';
                if (tipo === "tarefa") {
                  responsavel = dadosOriginais.responsavel_nome || dadosOriginais.responsavel || dadosOriginais.responsavelNome || 'N/A';
                } else if (tipo === "obrigacao") {
                  // Para obrigações, os responsáveis estão em um array
                  if (dadosOriginais.responsaveis && dadosOriginais.responsaveis.length > 0) {
                    const nomesResponsaveis = dadosOriginais.responsaveis.map((resp) => resp.responsavelNome || resp.nome).filter(Boolean);
                    responsavel = nomesResponsaveis.join(', ');
                  } else {
                    responsavel = dadosOriginais.responsavelNome || dadosOriginais.responsavel_nome || dadosOriginais.responsavel || 'N/A';
                  }
                }

                // Obter obrigação correta
                let obrigacao = 'N/A';
                if (tipo === "tarefa") {
                  obrigacao = dadosOriginais.obrigacao_nome || dadosOriginais.nomeObrigacao || 'N/A';
                } else if (tipo === "obrigacao") {
                  obrigacao = dadosOriginais.nomeObrigacao || dadosOriginais.nome || 'N/A';
                }

                // Corrigir problema de fuso horário criando data local
                const [ano, mes, dia] = evento.date.split('-');
                const dataLocal = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
                
                dadosParaOrdenar.push({
                  data: dataLocal,
                  tipo: tipo === 'tarefa' ? 'Tarefa' : 'Obrigação',
                  titulo: dadosOriginais.assunto || dadosOriginais.nome || dadosOriginais.nomeObrigacao || 'N/A',
                  cliente: dadosOriginais.cliente_nome || 'N/A',
                  status: dadosOriginais.status || 'N/A',
                  departamento: dadosOriginais.departamento || dadosOriginais.departamento_nome || 'N/A',
                  responsavel: responsavel,
                  obrigacao: obrigacao
                });
              }
            });
          }
        });

        // Ordenar por data
        dadosParaOrdenar.sort((a, b) => a.data.getTime() - b.data.getTime());

        // Converter para array de arrays após ordenação
        dadosParaOrdenar.forEach(item => {
          dados.push([
            item.data.toLocaleDateString('pt-BR'),
            item.tipo,
            item.titulo,
            item.cliente,
            item.status,
            item.departamento,
            item.responsavel,
            item.obrigacao
          ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(dados);
        ws['!cols'] = [
          { width: 12 }, // Data
          { width: 10 }, // Tipo
          { width: 40 }, // Título
          { width: 25 }, // Cliente
          { width: 12 }, // Status
          { width: 15 }, // Departamento
          { width: 20 }, // Responsável
          { width: 25 }  // Obrigação
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Agenda');

        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `agenda_${new Date().toISOString().split('T')[0]}.xlsx`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("✅ Agenda exportada para Excel com sucesso!");
      }).catch((error) => {
        console.error("Erro ao importar XLSX:", error);
        toast.error("❌ Erro ao exportar agenda.");
      });
    } catch (error) {
      toast.error("❌ Erro ao exportar agenda.");
    }
  };

  // Função para exportar agenda em PDF
  const exportarParaPDF = () => {
    try {
      import('jspdf').then(({ default: jsPDF }) => {
        import('jspdf-autotable').then(({ default: autoTable }) => {
          const doc = new jsPDF();
          
          // Título
          doc.setFontSize(18);
          doc.text('Agenda de Processos e Obrigações', 14, 22);
          
          doc.setFontSize(12);
          doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 32);

          // Obter dados reais das tarefas e obrigações
          const dados = [];

          // Obter mês atual do calendário de forma segura
          const calendarApi = calendarRef.current?.getApi();
          const currentDate = calendarApi?.getDate() || new Date();
          const currentMonth = new Date(currentDate).getMonth();
          const currentYear = new Date(currentDate).getFullYear();

          // Processar eventos agrupados para obter dados reais
          eventosAgrupados.forEach(evento => {
            // Filtrar por mês selecionado
            const eventoDate = new Date(evento.date);
            if (eventoDate.getMonth() === currentMonth && eventoDate.getFullYear() === currentYear) {
            evento.extendedProps.items.forEach((item) => {
                const tipo = item.extendedProps.tipo;
                const id = item.extendedProps.id;
                
                // Encontrar dados originais
              let dadosOriginais = null;
                if (tipo === "tarefa") {
                  dadosOriginais = tarefas.find(t => t.id == id);
                } else if (tipo === "obrigacao") {
                  dadosOriginais = obrigacoes.find(o => o.id == id);
                }

                if (dadosOriginais) {
                  // Para PDF, sempre incluir todos os dados (não aplicar filtros avançados)
                  // Aplicar filtros avançados apenas se estiverem ativos E se for Excel
                  // if (showAdvancedFilters) {
                  //   if (!aplicarFiltrosAvancados(dadosOriginais)) {
                  //     return; // Pular este item se não passar nos filtros
                  //   }
                  // }



                  // Obter responsável correto
                  let responsavel = 'N/A';
                  if (tipo === "tarefa") {
                    responsavel = dadosOriginais.responsavel_nome || dadosOriginais.responsavel || dadosOriginais.responsavelNome || 'N/A';
                  } else if (tipo === "obrigacao") {
                    // Para obrigações, os responsáveis estão em um array
                    if (dadosOriginais.responsaveis && dadosOriginais.responsaveis.length > 0) {
                    const nomesResponsaveis = dadosOriginais.responsaveis.map((resp) => resp.responsavelNome || resp.nome).filter(Boolean);
                      responsavel = nomesResponsaveis.join(', ');
                    } else {
                      responsavel = dadosOriginais.responsavelNome || dadosOriginais.responsavel_nome || dadosOriginais.responsavel || 'N/A';
                    }
                  }

                  // Obter obrigação correta
                  let obrigacao = 'N/A';
                  if (tipo === "tarefa") {
                    obrigacao = dadosOriginais.obrigacao_nome || dadosOriginais.nomeObrigacao || 'N/A';
                  } else if (tipo === "obrigacao") {
                    obrigacao = dadosOriginais.nomeObrigacao || dadosOriginais.nome || 'N/A';
                  }

                  // Corrigir problema de fuso horário criando data local
                  const [ano, mes, dia] = evento.date.split('-');
                  const dataLocal = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
                  
                  dados.push([
                    dataLocal.toLocaleDateString('pt-BR'),
                    tipo === 'tarefa' ? 'Tarefa' : 'Obrigação',
                    dadosOriginais.assunto || dadosOriginais.nome || dadosOriginais.nomeObrigacao || 'N/A',
                    dadosOriginais.cliente_nome || 'N/A',
                    dadosOriginais.status || 'N/A',
                    dadosOriginais.departamento || dadosOriginais.departamento_nome || 'N/A',
                    responsavel,
                    obrigacao
                  ]);
                }
              });
            }
          });

          autoTable(doc, {
            head: [['Data', 'Tipo', 'Título', 'Cliente', 'Status', 'Departamento', 'Responsável', 'Obrigação']],
            body: dados,
            startY: 40,
            styles: {
              fontSize: 8,
              cellPadding: 2
            },
            headStyles: {
              fillColor: [25, 118, 210],
              textColor: 255
            }
          });

          doc.save(`agenda_${new Date().toISOString().split('T')[0]}.pdf`);
          toast.success("Agenda exportada para PDF com sucesso!");
        });
      }).catch((error) => {
        console.error("Erro ao gerar PDF:", error);
        toast.error("Erro ao exportar agenda para PDF.");
      });
    } catch (error) {
      toast.error("Erro ao exportar agenda para PDF.");
    }
  };

  // Função para exportar agenda como PNG
  const exportarParaPNG = () => {
    try {
      const calendarElement = document.querySelector('.fc');
      if (!calendarElement) {
        toast.error("Elemento do calendário não encontrado.");
        return;
      }

      import('html2canvas').then(({ default: html2canvas }) => {
        html2canvas(calendarElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: true
        }).then(canvas => {
          const link = document.createElement('a');
          link.download = `agenda_${new Date().toISOString().split('T')[0]}.png`;
          link.href = canvas.toDataURL();
          link.click();
          toast.success("Agenda exportada como PNG com sucesso!");
        });
      }).catch((error) => {
        console.error("Erro ao gerar PNG:", error);
        toast.error("Erro ao exportar agenda como PNG.");
      });
    } catch (error) {
      toast.error("Erro ao exportar agenda como PNG.");
    }
  };

  // Carregar dados para filtros
  useEffect(() => {
    // ✅ Só executar quando o componente estiver montado no cliente
    if (!isClient) return;
    
    const carregarDadosFiltros = async () => {
      const { token, empresaId } = getAuthInfo();

      if (!token || !empresaId) return;

      try {
        // Carregar obrigações
        setCarregandoObrigacoes(true);
        const obrigacoesDataRaw = await fetchJson(`/gestao/obrigacoes/empresa/${empresaId}/todas`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const obrigacoesData = Array.isArray(obrigacoesDataRaw)
          ? obrigacoesDataRaw
          : obrigacoesDataRaw?.data || [];

        // Filtrar obrigações por departamento se um departamento estiver selecionado
        let obrigacoesFiltradas = obrigacoesData;
        if (departamentoSelecionado && departamentoSelecionado !== "") {
          obrigacoesFiltradas = obrigacoesData.filter((obrigacao) => 
            obrigacao.departamento_nome === departamentoSelecionado
          );
        }
        
        // Remover duplicatas baseado no nome da obrigação
        const obrigacoesUnicas = obrigacoesFiltradas.filter((obrigacao, index, self) => {
          const nomeObrigacao = obrigacao.nomeObrigacao || obrigacao.nome;
          return self.findIndex((o) => (o.nomeObrigacao || o.nome) === nomeObrigacao) === index;
        });
        
        setObrigacoesList(obrigacoesUnicas);

        // Carregar responsáveis (usuários) com informações de departamento
        setCarregandoResponsaveis(true);
        const usuariosDataRaw = await fetchJson(`/usuarios`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const usuariosData = Array.isArray(usuariosDataRaw)
          ? usuariosDataRaw
          : usuariosDataRaw?.data || [];
        
        // Filtrar responsáveis por departamento se um departamento estiver selecionado
        let responsaveisFiltrados = usuariosData;
        if (departamentoSelecionado && departamentoSelecionado !== "") {
          responsaveisFiltrados = usuariosData.filter((usuario) => 
            usuario.departamentoNome === departamentoSelecionado
          );
        }
        setResponsaveisList(responsaveisFiltrados);
      } catch (error) {
        console.error("Erro ao carregar dados para filtros:", error);
        setObrigacoesList([]);
        setResponsaveisList([]);
      } finally {
        setCarregandoObrigacoes(false);
        setCarregandoResponsaveis(false);
      }
    };

    carregarDadosFiltros();
  }, [isClient, departamentoSelecionado]); // Recarregar quando mudar departamento

  // Carregar grupos disponíveis
  useEffect(() => {
    const carregarGrupos = async () => {
      const { token, empresaId } = getAuthInfo();

      if (!token || !empresaId) return;

      try {
        const data = await fetchJson(`/gestao/clientes/grupos/todos?empresaId=${empresaId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const grupos = Array.isArray(data?.grupos)
          ? data.grupos
          : Array.isArray(data)
            ? data
            : data?.data?.grupos || [];

        const gruposNormalizados = grupos.map((g) => ({
          id: g.id,
          nome: g.nome
        }));
        
        setGruposDisponiveis(gruposNormalizados);
      } catch (error) {
        console.error("Erro ao carregar grupos:", error);
        setGruposDisponiveis([]);
      }
    };

    carregarGrupos();
  }, [isClient]);

  // Limpar filtros quando mudar departamento
  useEffect(() => {
    
    if (departamentoSelecionado) {
      setFiltroObrigacao("");
      setFiltroResponsavel("");
      setFiltroStatus("");
      setFiltrosAplicados(false);
    }
  }, [departamentoSelecionado]);

  // Função para aplicar filtros
  const aplicarFiltros = () => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    
    if (filtroObrigacao) {
      params.set("obrigacao", filtroObrigacao);
    } else {
      params.delete("obrigacao");
    }
    
    if (filtroStatus) {
      params.set("status", filtroStatus);
    } else {
      params.delete("status");
    }
    
    if (filtroResponsavel) {
      params.set("responsavel", filtroResponsavel);
    } else {
      params.delete("responsavel");
    }
    
    if (filtroCliente) {
      params.set("cliente", filtroCliente);
    } else {
      params.delete("cliente");
    }
    
    const novaUrl = `${window.location.pathname}?${params.toString()}`;
    router.push(novaUrl);
    setFiltrosAplicados(true);
  };

  // Função para limpar todos os filtros
  const limparTodosFiltros = () => {
    setFiltroObrigacao("");
    setFiltroStatus("");
    setFiltroResponsavel("");
    setFiltroCliente("");
    setFiltrosAplicados(false);
    
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.delete("obrigacao");
    params.delete("status");
    params.delete("responsavel");
    params.delete("cliente");
    
    const novaUrl = `${window.location.pathname}?${params.toString()}`;
    router.push(novaUrl);
  };

  // Carregar departamentos
  useEffect(() => {
    // ✅ Só executar quando o componente estiver montado no cliente
    if (!isClient) return;
    
    const token = sessionStorage.getItem("token");
    const empresaId = sessionStorage.getItem("empresaId");

    if (!token || !empresaId) return;

    fetchJson(`/gestao/departamentos/empresa/${empresaId}/nomes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((data) => {
        const departamentosData = Array.isArray(data) ? data : data?.data || [];
        setDepartamentos(departamentosData);
      })
      .catch((err) => {
        console.error("Erro ao carregar departamentos:", err);
      });
  }, [isClient]);

  // Sincronizar departamento selecionado com query string
  useEffect(() => {
    // ✅ Só executar quando o componente estiver montado no cliente
    if (!isClient) return;
    
    if (departamentoFiltro) {
      setDepartamentoSelecionado(departamentoFiltro);
    }
  }, [isClient, departamentoFiltro]);

  // Sincronizar grupos selecionados com query string
  useEffect(() => {
    // ✅ Só executar quando o componente estiver montado no cliente
    if (!isClient) return;
    
    const gruposFiltro = searchParams?.get("grupos");
    if (gruposFiltro) {
      const grupos = gruposFiltro.split(',').map(id => parseInt(id));
      setGruposSelecionados(grupos);
      buscarClientesPorGrupo(grupos);
    }
  }, [isClient, searchParams]);

  // Carregar filtros da URL
  useEffect(() => {
    // ✅ Só executar quando o componente estiver montado no cliente
    if (!isClient) return;
    
    const obrigacaoFiltro = searchParams?.get("obrigacao");
    const statusFiltro = searchParams?.get("status");
    const responsavelFiltro = searchParams?.get("responsavel");
    const clienteFiltro = searchParams?.get("cliente");
    
    // Definir filtros da URL
    if (obrigacaoFiltro) {
      setFiltroObrigacao(obrigacaoFiltro);
    }
    
    if (statusFiltro) {
      setFiltroStatus(statusFiltro);
    }
    
    if (responsavelFiltro) {
      setFiltroResponsavel(responsavelFiltro);
    }
    
    if (clienteFiltro) {
      setFiltroCliente(clienteFiltro);
    }
    
    // Definir filtrosAplicados como true se houver qualquer filtro na URL
    if (obrigacaoFiltro || statusFiltro || responsavelFiltro || clienteFiltro) {
      setFiltrosAplicados(true);
    } else {
      setFiltrosAplicados(false);
    }
  }, [isClient, searchParams]);

  // Função para atualizar filtro de departamento
  const atualizarFiltroDepartamento = (departamento) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    
    if (departamento && departamento !== "Todos") {
      params.set("departamento", departamento);
    } else {
      params.delete("departamento");
    }
    
    const novaUrl = `${window.location.pathname}?${params.toString()}`;
    router.push(novaUrl);
  };

  // Resetar página quando mudar busca ou aba
  useEffect(() => {
    setPaginaAtual(1);
  }, [searchTerm, abaAtiva]);

  // Resetar página quando mudar itens por página
  useEffect(() => {
    setPaginaAtual(1);
  }, [itensPorPagina]);

  // Sincronizar filtros de data quando mudar tipoItem
  useEffect(() => {
    if (tipoItem === "ambos") {
      // Quando mudar para "ambos", sincronizar os filtros
      if (tipoData === "prazo") {
        setTipoDataObrigacao("vencimento");
      } else {
        setTipoDataObrigacao(tipoData);
      }
    }
  }, [tipoItem, tipoData]);

  // Estilos para tabela
  const th = {
    padding: "var(--titan-spacing-sm)",
    fontWeight: "var(--titan-font-weight-medium)",
    color: "var(--titan-text-low)",
    textAlign: "left",
    backgroundColor: "var(--titan-card-bg)",
    borderBottom: "1px solid var(--titan-stroke)",
  };

  const td = {
    padding: "var(--titan-spacing-sm)",
    color: "var(--titan-text-med)",
    fontSize: "var(--titan-font-size-xs)",
    borderBottom: "1px solid var(--titan-stroke)",
  };

  // Função para atualizar filtro de grupo
  const atualizarFiltroGrupo = (grupos) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    
    if (grupos.length > 0) {
      params.set("grupos", grupos.join(','));
    } else {
      params.delete("grupos");
    }
    
    const novaUrl = `${window.location.pathname}?${params.toString()}`;
    router.push(novaUrl);
  };

  // Função para buscar clientes por grupo
  const buscarClientesPorGrupo = async (grupos) => {
    if (grupos.length === 0) {
      setClientesPorGrupo([]);
      return;
    }

    const token = sessionStorage.getItem("token");
    if (!token) return;

    try {
      const resArr = await Promise.all(
        grupos.map(async (grupoId) => {
          try {
            const data = await fetchJson(`/gestao/clientes/grupo/${grupoId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (Array.isArray(data?.clientes)) return data.clientes;
            if (Array.isArray(data)) return data;
            if (Array.isArray(data?.data?.clientes)) return data.data.clientes;
            return [];
          } catch (error) {
            console.error(`Erro ao buscar clientes do grupo ${grupoId}:`, error);
            return [];
          }
        })
      );
      
      const todosClientes = resArr.flat();
      const clientesUnicos = todosClientes.filter((cli, index, self) => 
        self.findIndex(c => c.id === cli.id) === index
      );
      
      setClientesPorGrupo(clientesUnicos.map((c) => c.id));
    } catch (error) {
      console.error("Erro ao buscar clientes por grupo:", error);
      setClientesPorGrupo([]);
    }
  };

  const solicitacoes = eventosModal.filter((t) => t.extendedProps.tipo === "tarefa");
  const obrigacoesModal = eventosModal.filter((t) => t.extendedProps.tipo === "obrigacao");
  const tarefasBaseModal = abaAtiva === "solicitacoes" ? solicitacoes : obrigacoesModal;
  const tarefasTextoModal = tarefasBaseModal.filter(filtroTexto);
  const tarefasFiltradasModal = tarefasTextoModal;
  const tarefasOrdenadasModal = [...tarefasFiltradasModal];

  if (sortConfig.key) {
    const { key, direction } = sortConfig;
    tarefasOrdenadasModal.sort((a, b) => {
      const aValue = a[key] ?? "";
      const bValue = b[key] ?? "";

      const result =
        typeof aValue === "number" && typeof bValue === "number"
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue), "pt-BR", { numeric: true });

      return direction === "asc" ? result : -result;
    });
  }

  const totalPaginasModal = Math.max(1, Math.ceil(tarefasFiltradasModal.length / itensPorPagina));
  const paginaAtualAjustada = Math.min(paginaAtual, totalPaginasModal);
  const tarefasVisiveisModal = tarefasOrdenadasModal.slice(
    (paginaAtualAjustada - 1) * itensPorPagina,
    paginaAtualAjustada * itensPorPagina
  );
  const paginaInicioModal =
    tarefasFiltradasModal.length === 0 ? 0 : (paginaAtualAjustada - 1) * itensPorPagina + 1;
  const paginaFimModal = Math.min(paginaAtualAjustada * itensPorPagina, tarefasFiltradasModal.length);

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.layoutRoot}>
        <div className={styles.layoutContent}>
          <main className={styles.mainContent}>
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
            
            <div className={styles.pageContent}>
        <h1 style={{ 
          fontSize: "var(--titan-font-size-2xl)", 
          fontWeight: "var(--titan-font-weight-semibold)", 
          marginBottom: "var(--titan-spacing-lg)",
          color: "var(--titan-text-high)"
        }}>
          Agenda de Processos e Obrigações
        </h1>

        {/* ✅ Não renderizar conteúdo dinâmico até estar montado no cliente */}
        {!isClient ? (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "var(--titan-spacing-xl)",
            backgroundColor: "var(--titan-card-bg)",
            borderRadius: "var(--titan-radius-md)",
            border: "1px solid var(--titan-stroke)",
            marginBottom: "var(--titan-spacing-lg)",
            backdropFilter: "blur(10px)"
          }}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--titan-spacing-sm)"
            }}>
              <div style={{
                width: "32px",
                height: "32px",
                border: "3px solid var(--titan-stroke)",
                borderTop: "3px solid var(--titan-primary)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite"
              }}></div>
              <span style={{ 
                color: "var(--titan-text-med)", 
                fontSize: "var(--titan-font-size-sm)" 
              }}>
                Inicializando...
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Indicador de carregamento */}
            {carregando && (
              <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "var(--titan-spacing-xl)",
                backgroundColor: "var(--titan-card-bg)",
                borderRadius: "var(--titan-radius-md)",
                border: "1px solid var(--titan-stroke)",
                marginBottom: "var(--titan-spacing-lg)",
                backdropFilter: "blur(10px)"
              }}>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "var(--titan-spacing-sm)"
                }}>
                  <div style={{
                    width: "32px",
                    height: "32px",
                    border: "3px solid var(--titan-stroke)",
                    borderTop: "3px solid var(--titan-primary)",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }}></div>
                  <span style={{ 
                    color: "var(--titan-text-med)", 
                    fontSize: "var(--titan-font-size-sm)" 
                  }}>
                    Carregando eventos...
                  </span>
                </div>
              </div>
            )}

            <div style={{ marginBottom: "var(--titan-spacing-md)", display: "flex", gap: "var(--titan-spacing-md)", alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <label style={{ 
                  marginRight: "var(--titan-spacing-sm)",
                  color: "var(--titan-text-med)",
                  fontSize: "var(--titan-font-size-sm)"
                }}>
                  Tipo de tarefa:
                </label>
                <select
                  value={tipoItem}
                    onChange={(e) => {
                      const novoValor = e.target.value;
                    setTipoItem(novoValor);
                  }}
                  style={{ 
                    padding: "var(--titan-spacing-sm)", 
                    borderRadius: "var(--titan-radius-sm)", 
                    border: "1px solid var(--titan-stroke)",
                    backgroundColor: "var(--titan-input-bg)",
                    color: "var(--titan-text-high)",
                    fontSize: "var(--titan-font-size-sm)"
                  }}
                >
                  <option value="ambos">Processos e Obrigações</option>
                  <option value="tarefas">Apenas Processos</option>
                  <option value="obrigacoes">Apenas Obrigações</option>
                </select>
              </div>

              {/* Filtro por tipo de data para tarefas */}
              {tipoItem === "tarefas" && (
                <div>
                  <label style={{ 
                    marginRight: "var(--titan-spacing-sm)",
                    color: "var(--titan-text-med)",
                    fontSize: "var(--titan-font-size-sm)"
                  }}>
                    Tarefas por data:
                  </label>
                  <select
                    value={tipoData}
                  onChange={(e) => setTipoData(e.target.value)}
                    style={{ 
                      padding: "var(--titan-spacing-sm)", 
                      borderRadius: "var(--titan-radius-sm)", 
                      border: "1px solid var(--titan-stroke)",
                      backgroundColor: "var(--titan-input-bg)",
                      color: "var(--titan-text-high)",
                      fontSize: "var(--titan-font-size-sm)"
                    }}
                  >
                    <option value="acao">Ação</option>
                    <option value="meta">Meta</option>
                    <option value="prazo">Prazo</option>
                  </select>
                </div>
              )}

              {/* Filtro por tipo de data para obrigações */}
              {tipoItem === "obrigacoes" && (
                <div>
                  <label style={{ 
                    marginRight: "var(--titan-spacing-sm)",
                    color: "var(--titan-text-med)",
                    fontSize: "var(--titan-font-size-sm)"
                  }}>
                    Obrigações por data:
                  </label>
                  <select
                    value={tipoDataObrigacao}
                  onChange={(e) => setTipoDataObrigacao(e.target.value)}
                    style={{ 
                      padding: "var(--titan-spacing-sm)", 
                      borderRadius: "var(--titan-radius-sm)", 
                      border: "1px solid var(--titan-stroke)",
                      backgroundColor: "var(--titan-input-bg)",
                      color: "var(--titan-text-high)",
                      fontSize: "var(--titan-font-size-sm)"
                    }}
                  >
                    <option value="acao">Ação</option>
                    <option value="meta">Meta</option>
                    <option value="vencimento">Vencimento</option>
                  </select>
                </div>
              )}

              {/* Filtro por tipo de data para ambos */}
              {tipoItem === "ambos" && (
                <div>
                  <label style={{ 
                    marginRight: "var(--titan-spacing-sm)",
                    color: "var(--titan-text-med)",
                    fontSize: "var(--titan-font-size-sm)"
                  }}>
                    Por data:
                  </label>
                  <select
                    value={tipoData}
                    onChange={(e) => {
                      const novoValor = e.target.value;
                      setTipoData(novoValor);
                      // Para obrigações, mapear "prazo" para "vencimento"
                      if (novoValor === "prazo") {
                        setTipoDataObrigacao("vencimento");
                      } else {
                        setTipoDataObrigacao(novoValor);
                      }
                    }}
                    style={{ 
                      padding: "var(--titan-spacing-sm)", 
                      borderRadius: "var(--titan-radius-sm)", 
                      border: "1px solid var(--titan-stroke)",
                      backgroundColor: "var(--titan-input-bg)",
                      color: "var(--titan-text-high)",
                      fontSize: "var(--titan-font-size-sm)"
                    }}
                  >
                    <option value="acao">Ação</option>
                    <option value="meta">Meta</option>
                    <option value="prazo">Vencimento</option>
                  </select>
                </div>
              )}

              {/* Filtro por departamento */}
              <div>
                <label style={{ 
                  marginRight: "var(--titan-spacing-sm)",
                  color: "var(--titan-text-med)",
                  fontSize: "var(--titan-font-size-sm)"
                }}>
                  Departamento:
                </label>
                <select
                  value={departamentoSelecionado}
                  onChange={(e) => {
                    const departamento = e.target.value;
                    setDepartamentoSelecionado(departamento);
                    atualizarFiltroDepartamento(departamento);
                  }}
                  style={{ 
                    padding: "var(--titan-spacing-sm)", 
                    borderRadius: "var(--titan-radius-sm)", 
                    border: "1px solid var(--titan-stroke)",
                    backgroundColor: "var(--titan-input-bg)",
                    color: "var(--titan-text-high)",
                    fontSize: "var(--titan-font-size-sm)"
                  }}
                >
                  <option value="">Todos os departamentos</option>
                  {departamentos.map((dept) => (
                    <option key={dept.id} value={dept.nome}>
                      {dept.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por grupo */}
              <div>
                <label style={{ 
                  marginRight: "var(--titan-spacing-sm)",
                  color: "var(--titan-text-med)",
                  fontSize: "var(--titan-font-size-sm)"
                }}>
                  Grupos:
                </label>
                <select
                  value={gruposSelecionados.length === 0 ? "" : gruposSelecionados.join(',')}
                  onChange={(e) => {
                    const valor = e.target.value;
                    if (valor === "") {
                      setGruposSelecionados([]);
                      setClientesPorGrupo([]);
                      atualizarFiltroGrupo([]);
                    } else {
                      const grupos = valor.split(',').map(id => parseInt(id));
                      setGruposSelecionados(grupos);
                      buscarClientesPorGrupo(grupos);
                      atualizarFiltroGrupo(grupos);
                    }
                  }}
                  style={{ 
                    padding: "var(--titan-spacing-sm)", 
                    borderRadius: "var(--titan-radius-sm)", 
                    border: "1px solid var(--titan-stroke)",
                    backgroundColor: "var(--titan-input-bg)",
                    color: "var(--titan-text-high)",
                    fontSize: "var(--titan-font-size-sm)",
                    minWidth: "200px"
                  }}
                >
                  <option value="">Todos os grupos</option>
                  {gruposDisponiveis.map((grupo) => (
                    <option key={grupo.id} value={grupo.id}>
                      {grupo.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botão para mostrar/ocultar filtros avançados */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                style={{
                  padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                  backgroundColor: showAdvancedFilters 
                    ? "var(--titan-primary)" 
                    : filtrosAplicados 
                      ? "var(--titan-success)" 
                      : "var(--titan-card-bg)",
                  color: showAdvancedFilters || filtrosAplicados 
                    ? "var(--titan-text-high)" 
                    : "var(--titan-text-med)",
                  border: "1px solid var(--titan-stroke)",
                  borderRadius: "var(--titan-radius-sm)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--titan-spacing-xs)",
                  fontSize: "var(--titan-font-size-sm)",
                  transition: "all var(--titan-transition-fast)"
                }}
              >
                <FaFilter size={14} />
                Filtros Avançados
                {filtrosAplicados && (
                  <span style={{ 
                    marginLeft: "var(--titan-spacing-xs)", 
                    fontSize: "var(--titan-font-size-xs)",
                    backgroundColor: "rgba(255,255,255,0.1)",
                    padding: "2px 6px",
                    borderRadius: "var(--titan-radius-sm)"
                  }}>
                    Ativos
                  </span>
                )}
              </button>
            </div>

            {/* Filtros Avançados */}
            {showAdvancedFilters && (
              <div style={{
                marginBottom: "var(--titan-spacing-md)",
                padding: "var(--titan-spacing-lg)",
                backgroundColor: "var(--titan-card-bg)",
                borderRadius: "var(--titan-radius-md)",
                border: "1px solid var(--titan-stroke)",
                display: "flex",
                gap: "var(--titan-spacing-lg)",
                alignItems: "flex-start",
                flexWrap: "wrap",
                backdropFilter: "blur(10px)"
              }}>
                {/* Filtro por Obrigação */}
                <div style={{ flex: "1", minWidth: "280px" }}>
                  <label style={{ 
                    display: "block", 
                    marginBottom: "var(--titan-spacing-sm)", 
                    fontSize: "var(--titan-font-size-sm)", 
                    fontWeight: "var(--titan-font-weight-medium)",
                    color: "var(--titan-text-med)"
                  }}>
                    Obrigação:
                    {departamentoSelecionado && (
                      <span style={{ 
                        marginLeft: "var(--titan-spacing-xs)", 
                        fontSize: "var(--titan-font-size-xs)", 
                        color: "var(--titan-text-high)",
                        fontWeight: "var(--titan-font-weight-medium)"
                      }}>
                        (filtrado por {departamentoSelecionado})
                      </span>
                    )}
                  </label>
                  <select
                    value={filtroObrigacao}
                    onChange={(e) => setFiltroObrigacao(e.target.value)}
                    style={{ 
                      padding: "var(--titan-spacing-sm) var(--titan-spacing-md)", 
                      borderRadius: "var(--titan-radius-sm)", 
                      border: "1px solid var(--titan-stroke)", 
                      fontSize: "var(--titan-font-size-sm)",
                      width: "100%",
                      backgroundColor: "var(--titan-input-bg)",
                      color: "var(--titan-text-high)",
                      cursor: "pointer",
                      outline: "none",
                      transition: "all var(--titan-transition-fast)"
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--titan-primary)";
                      e.target.style.boxShadow = "var(--titan-glow-primary)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "var(--titan-stroke)";
                      e.target.style.boxShadow = "none";
                    }}
                  >
                    <option value="">Todas as obrigações</option>
                    {carregandoObrigacoes ? (
                      <option value="" disabled>Carregando obrigações...</option>
                    ) : (
                      obrigacoesList.map((obrigacao) => (
                        <option key={obrigacao.id} value={obrigacao.nomeObrigacao || obrigacao.nome}>
                          {obrigacao.nomeObrigacao || obrigacao.nome}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Filtro por Status */}
                <div style={{ flex: "0 0 auto", minWidth: "180px" }}>
                  <label style={{ 
                    display: "block", 
                    marginBottom: "var(--titan-spacing-sm)", 
                    fontSize: "var(--titan-font-size-sm)", 
                    fontWeight: "var(--titan-font-weight-medium)",
                    color: "var(--titan-text-med)"
                  }}>
                    Status:
                  </label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    style={{ 
                      padding: "var(--titan-spacing-sm) var(--titan-spacing-md)", 
                      borderRadius: "var(--titan-radius-sm)", 
                      border: "1px solid var(--titan-stroke)", 
                      fontSize: "var(--titan-font-size-sm)",
                      width: "100%",
                      backgroundColor: "var(--titan-input-bg)",
                      color: "var(--titan-text-high)",
                      cursor: "pointer",
                      outline: "none",
                      transition: "all var(--titan-transition-fast)"
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--titan-primary)";
                      e.target.style.boxShadow = "var(--titan-glow-primary)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "var(--titan-stroke)";
                      e.target.style.boxShadow = "none";
                    }}
                  >
                    <option value="">Todos os status</option>
                    <option value="pendente">Em Aberto</option>
                    <option value="concluido">Concluído</option>
                  </select>
                </div>

                {/* Filtro por Responsável */}
                <div style={{ flex: "1", minWidth: "250px" }}>
                  <label style={{ 
                    display: "block", 
                    marginBottom: "var(--titan-spacing-sm)", 
                    fontSize: "var(--titan-font-size-sm)", 
                    fontWeight: "var(--titan-font-weight-medium)",
                    color: "var(--titan-text-med)"
                  }}>
                    Responsável:
                    {departamentoSelecionado && (
                      <span style={{ 
                        marginLeft: "var(--titan-spacing-xs)", 
                        fontSize: "var(--titan-font-size-xs)", 
                        color: "var(--titan-text-high)",
                        fontWeight: "var(--titan-font-weight-medium)"
                      }}>
                        (filtrado por {departamentoSelecionado})
                      </span>
                    )}
                  </label>
                  <Select
                    isClearable
                    options={carregandoResponsaveis ? [] : responsaveisList.map((u) => ({ value: u.nome, label: u.nome }))}
                    value={filtroResponsavel ? { value: filtroResponsavel, label: filtroResponsavel } : null}
                    onChange={(opt) => setFiltroResponsavel(opt?.value || "")}
                    placeholder="Todos os responsáveis"
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                    menuPosition="fixed"
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        minHeight: 36,
                        borderRadius: 8,
                        backgroundColor: "var(--titan-input-bg)",
                        borderColor: state.isFocused ? "var(--titan-primary)" : "var(--titan-stroke)",
                        boxShadow: state.isFocused ? "var(--titan-glow-primary)" : "none",
                        color: "var(--titan-text-high)",
                      }),
                      menuPortal: (base) => ({ ...base, zIndex: 9999999 }),
                      menu: (base) => ({
                        ...base,
                        zIndex: 9999999,
                        backgroundColor: "#0B0B11",
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? "rgba(0,128,255,0.2)"
                          : state.isFocused
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(255,255,255,0.04)",
                        color: "#E6E9F0",
                        cursor: "pointer",
                      }),
                      singleValue: (base) => ({ ...base, color: "#E6E9F0" }),
                      placeholder: (base) => ({ ...base, color: "#6F7384" }),
                      input: (base) => ({ ...base, color: "#E6E9F0" }),
                    }}
                    isLoading={carregandoResponsaveis}
                    noOptionsMessage={() => carregandoResponsaveis ? "Carregando..." : "Nenhum responsável encontrado"}
                  />
                </div>

                {/* Filtro por Cliente */}
                <div style={{ flex: "1", minWidth: "250px" }}>
                  <label style={{ 
                    display: "block", 
                    marginBottom: "var(--titan-spacing-sm)", 
                    fontSize: "var(--titan-font-size-sm)", 
                    fontWeight: "var(--titan-font-weight-medium)",
                    color: "var(--titan-text-med)"
                  }}>
                    Cliente:
                  </label>
                  <Select
                    isClearable
                    options={carregandoClientes ? [] : clientesList.map((n) => ({ value: n, label: n }))}
                    value={filtroCliente ? { value: filtroCliente, label: filtroCliente } : null}
                    onChange={(opt) => setFiltroCliente(opt?.value || "")}
                    placeholder="Todos os clientes"
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                    menuPosition="fixed"
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        minHeight: 36,
                        borderRadius: 8,
                        backgroundColor: "var(--titan-input-bg)",
                        borderColor: state.isFocused ? "var(--titan-primary)" : "var(--titan-stroke)",
                        boxShadow: state.isFocused ? "var(--titan-glow-primary)" : "none",
                        color: "var(--titan-text-high)",
                      }),
                      menuPortal: (base) => ({ ...base, zIndex: 9999999 }),
                      menu: (base) => ({
                        ...base,
                        zIndex: 9999999,
                        backgroundColor: "#0B0B11",
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? "rgba(0,128,255,0.2)"
                          : state.isFocused
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(255,255,255,0.04)",
                        color: "#E6E9F0",
                        cursor: "pointer",
                      }),
                      singleValue: (base) => ({ ...base, color: "#E6E9F0" }),
                      placeholder: (base) => ({ ...base, color: "#6F7384" }),
                      input: (base) => ({ ...base, color: "#E6E9F0" }),
                    }}
                    isLoading={carregandoClientes}
                    noOptionsMessage={() => carregandoClientes ? "Carregando..." : "Nenhum cliente encontrado"}
                  />
                </div>

                {/* Botões de ação dos filtros */}
                <div style={{ 
                  display: "flex", 
                  gap: "var(--titan-spacing-sm)", 
                  flex: "0 0 auto",
                  alignSelf: "flex-end"
                }}>
                  <button
                    onClick={aplicarFiltros}
                    style={{
                      padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                      backgroundColor: "var(--titan-primary)",
                      color: "var(--titan-text-high)",
                      border: "none",
                      borderRadius: "var(--titan-radius-sm)",
                      cursor: "pointer",
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-medium)",
                      transition: "all var(--titan-transition-fast)"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "var(--titan-primary-hover)"}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "var(--titan-primary)"}
                  >
                    Aplicar Filtros
                  </button>
                  
                  <button
                    onClick={limparTodosFiltros}
                    style={{
                      padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                      backgroundColor: "var(--titan-text-low)",
                      color: "var(--titan-text-high)",
                      border: "none",
                      borderRadius: "var(--titan-radius-sm)",
                      cursor: "pointer",
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-medium)",
                      transition: "all var(--titan-transition-fast)"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "var(--titan-text-med)"}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "var(--titan-text-low)"}
                  >
                    Limpar Filtros
                  </button>
                </div>
              </div>
            )}

            {/* Botões de Exportação - Mesma linha do calendário */}
            {!carregando && (
              <div style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "var(--titan-spacing-sm)",
                marginBottom: "var(--titan-spacing-md)",
                padding: "var(--titan-spacing-sm) 0"
              }}>
                <button
                  onClick={exportarParaExcel}
                  style={{
                    padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                    backgroundColor: "var(--titan-primary)",
                    color: "var(--titan-text-high)",
                    border: "none",
                    borderRadius: "var(--titan-radius-sm)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--titan-spacing-xs)",
                    fontSize: "var(--titan-font-size-sm)",
                    transition: "all var(--titan-transition-fast)"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "var(--titan-primary-hover)"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "var(--titan-primary)"}
                  title="Exportar para Excel"
                >
                  <FaFileExcel size={14} />
                  Excel
                </button>
                
                <button
                  onClick={exportarParaPDF}
                  style={{
                    padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                    backgroundColor: "var(--titan-primary)",
                    color: "var(--titan-text-high)",
                    border: "none",
                    borderRadius: "var(--titan-radius-sm)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--titan-spacing-xs)",
                    fontSize: "var(--titan-font-size-sm)",
                    transition: "all var(--titan-transition-fast)"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "var(--titan-primary-hover)"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "var(--titan-primary)"}
                  title="Exportar para PDF"
                >
                  <FaFilePdf size={14} />
                  PDF
                </button>
                
                <button
                  onClick={exportarParaPNG}
                  style={{
                    padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                    backgroundColor: "var(--titan-primary)",
                    color: "var(--titan-text-high)",
                    border: "none",
                    borderRadius: "var(--titan-radius-sm)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--titan-spacing-xs)",
                    fontSize: "var(--titan-font-size-sm)",
                    transition: "all var(--titan-transition-fast)"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "var(--titan-primary-hover)"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "var(--titan-primary)"}
                  title="Exportar como PNG"
                >
                  <FaImage size={14} />
                  PNG
                </button>
              </div>
            )}

            {!carregando && (
              <FullCalendar
                key={`calendar-${filtrosAplicados}-${eventosAgrupados.length}`}
                ref={calendarRef}
                plugins={[dayGridPlugin]}
                initialView="dayGridMonth"
                locale="pt-br"
                events={eventosAgrupados}
                eventContent={renderizarEvento}
                eventClick={(info) => {
                  abrirModal(info);
                }}
                height="auto"
                headerToolbar={{
                  start: "prev,next today",
                  center: "title",
                  end: ""
                }}
                showNonCurrentDates={false}
                datesSet={(dateInfo) => {
                  setCurrentDate(dateInfo.start);
                }}
              />
            )}

            <style jsx global>{`
              .fc-day-other {
                visibility: hidden;
              }
              
              /* Estilização do FullCalendar para tema escuro */
              .fc {
                color: var(--titan-text-high) !important;
              }
              
              /* Números das datas */
              .fc-daygrid-day-number {
                color: var(--titan-text-high) !important;
                font-weight: var(--titan-font-weight-medium) !important;
              }
              
              /* Textos dos dias da semana */
              .fc-col-header-cell {
                color: var(--titan-text-high) !important;
                font-weight: var(--titan-font-weight-medium) !important;
                background-color: var(--titan-base-00) !important;
              }
              
              /* Cabeçalho da grade - mais escuro */
              .fc-col-header {
                background-color: var(--titan-base-00) !important;
                border-color: var(--titan-stroke) !important;
              }
              
              /* Forçar cor branca para todos os textos do cabeçalho */
              .fc-col-header-cell * {
                color: var(--titan-text-high) !important;
              }
              
              /* Especificamente para os nomes dos dias */
              .fc-col-header-cell .fc-col-header-cell-cushion {
                color: var(--titan-text-high) !important;
              }
              
              /* Título do mês/ano */
              .fc-toolbar-title {
                color: var(--titan-text-high) !important;
                font-weight: var(--titan-font-weight-semibold) !important;
              }
              
              /* Botões de navegação */
              .fc-button {
                color: var(--titan-text-high) !important;
                background-color: var(--titan-card-bg) !important;
                border-color: var(--titan-stroke) !important;
              }
              
              .fc-button:hover {
                background-color: var(--titan-primary) !important;
                border-color: var(--titan-primary) !important;
              }
              
              /* Divisórias da grade */
              .fc td, .fc th {
                border-color: var(--titan-stroke) !important;
              }
              
              .fc-theme-standard td, .fc-theme-standard th, .fc-theme-standard .fc-scrollgrid {
                border-color: var(--titan-stroke) !important;
              }
              
              /* Células dos dias */
              .fc-daygrid-day {
                border-color: var(--titan-stroke) !important;
              }
              
              /* Eventos */
              .fc-event {
                border-color: var(--titan-stroke) !important;
              }
              
              /* Hover nos dias */
              .fc-daygrid-day:hover {
                background-color: rgba(255, 255, 255, 0.05) !important;
              }
              
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>

            {/* 🧩 Legenda abaixo do calendário */}
            {!carregando && (
              <div style={{
                marginTop: "var(--titan-spacing-lg)",
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--titan-spacing-md)",
                backgroundColor: "var(--titan-card-bg)",
                padding: "var(--titan-spacing-md)",
                borderRadius: "var(--titan-radius-md)",
                border: "1px solid var(--titan-stroke)",
                fontSize: "var(--titan-font-size-sm)",
                backdropFilter: "blur(10px)"
              }}>
                {legenda.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "var(--titan-spacing-sm)" }}>
                    <div style={{
                      width: "14px",
                      height: "14px",
                      backgroundColor: item.cor,
                      borderRadius: "var(--titan-radius-sm)",
                      border: "1px solid var(--titan-stroke)"
                    }}></div>
                    <span style={{ color: "var(--titan-text-med)" }}>{item.texto}</span>
                  </div>
                ))}
              </div>
            )}

    {/* Modal de Detalhes */}
            {modalAberto && (
              <div className={styles.modalOverlay} onClick={fecharModal}>
                <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={styles.modalCloseButton}
                    onClick={fecharModal}
                    aria-label="Fechar modal"
                  >
                    ×
                  </button>

                  <header className={styles.modalHeader}>
                    <div>
                      <h2>Agenda</h2>
                      <p>
                        {(() => {
                          const [ano, mes, dia] = dataModal.split("-");
                          const dataLocal = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
                          return dataLocal.toLocaleDateString("pt-BR", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          });
                        })()}
                      </p>
                    </div>
                  </header>

                  <div className={styles.modalTabs}>
                    <button
                      type="button"
                      className={`${styles.modalTab} ${abaAtiva === "solicitacoes" ? styles.modalTabActive : ""}`}
                      onClick={() => setAbaAtiva("solicitacoes")}
                    >
                      Solicitações
                    </button>
                    <button
                      type="button"
                      className={`${styles.modalTab} ${abaAtiva === "obrigacoes" ? styles.modalTabActive : ""}`}
                      onClick={() => setAbaAtiva("obrigacoes")}
                    >
                      Obrigações
                    </button>
                  </div>

                  <div className={styles.modalSearch}>
                    <input
                      type="text"
                      placeholder="Buscar por ID, assunto, cliente, departamento ou responsável..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      aria-label="Buscar dentro do modal"
                    />
                  </div>

                  <div className={styles.modalTableWrapper}>
                    <table className={styles.modalTable}>
                      <thead>
                        <tr>
                          <th>No</th>
                          <th onClick={() => requestSort("status")}>
                            <div className={styles.modalSortableHeader}>
                              Status
                              {sortConfig.key === "status" && (
                                <span>{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                              )}
                            </div>
                          </th>
                          <th onClick={() => requestSort("departamento")}>
                            <div className={styles.modalSortableHeader}>
                              Departamento
                              {sortConfig.key === "departamento" && (
                                <span>{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                              )}
                            </div>
                          </th>
                          <th onClick={() => requestSort("id")}>
                            <div className={styles.modalSortableHeader}>
                              ID
                              {sortConfig.key === "id" && (
                                <span>{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                              )}
                            </div>
                          </th>
                          <th
                            className={styles.modalAssuntoHeader}
                            onClick={() => requestSort("assunto")}
                          >
                            <div className={styles.modalSortableHeader}>
                              Assunto
                              {sortConfig.key === "assunto" && (
                                <span>{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                              )}
                            </div>
                          </th>
                          <th onClick={() => requestSort("cliente_nome")}>
                            <div className={styles.modalSortableHeader}>
                              Cliente
                              {sortConfig.key === "cliente_nome" && (
                                <span>{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                              )}
                            </div>
                          </th>
                          <th>Prazo</th>
                          <th>Atividades</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tarefasVisiveisModal.length === 0 ? (
                          <tr>
                            <td colSpan={8} className={styles.modalEmpty}>
                              Nenhuma {abaAtiva === "solicitacoes" ? "solicitação" : "obrigação"} encontrada.
                            </td>
                          </tr>
                        ) : (
                          tarefasVisiveisModal.map((evento, index) => {
                            const dados = evento.extendedProps.items?.[0] || evento;
                            const id = dados.extendedProps?.id || evento.extendedProps?.id;
                            const tipo = dados.extendedProps?.tipo || evento.extendedProps?.tipo;
                            const dadosOriginais = evento.dadosOriginais;

                            const renderPrazo = () => {
                              if (tipo === "tarefa") {
                                const dataCampo = `data${tipoData.charAt(0).toUpperCase() + tipoData.slice(1)}`;
                                const data = dadosOriginais?.[dataCampo] || dados[dataCampo];
                                return data ? new Date(data).toLocaleDateString("pt-BR") : "-";
                              }

                              let dataObrigacao;
                              if (tipoDataObrigacao === "vencimento") {
                                dataObrigacao =
                                  dadosOriginais?.vencimento ||
                                  dadosOriginais?.data_vencimento ||
                                  dados.vencimento ||
                                  dados.data_vencimento;
                              } else if (tipoDataObrigacao === "acao") {
                                dataObrigacao =
                                  dadosOriginais?.acao || dadosOriginais?.dataAcao || dados.acao || dados.dataAcao;
                              } else if (tipoDataObrigacao === "meta") {
                                dataObrigacao =
                                  dadosOriginais?.meta || dadosOriginais?.dataMeta || dados.meta || dados.dataMeta;
                              } else {
                                dataObrigacao =
                                  dadosOriginais?.vencimento ||
                                  dadosOriginais?.data_vencimento ||
                                  dados.vencimento ||
                                  dados.data_vencimento;
                              }

                              return dataObrigacao ? new Date(dataObrigacao).toLocaleDateString("pt-BR") : "-";
                            };

                            const progresso =
                              dadosOriginais?.categoria === "Finalizada" ||
                              dadosOriginais?.categoria === "Na Programação" ||
                              dadosOriginais?.categoria === "Concluída Após Meta/Prazo" ||
                              dadosOriginais?.status?.toLowerCase() === "concluída" ||
                              dadosOriginais?.baixadaAutomaticamente === 1
                                ? "100%"
                                : Array.isArray(dadosOriginais?.atividades) && dadosOriginais?.atividades.length > 0
                                  ? `${Math.round(
                                      (dadosOriginais.atividades.filter((a) => a.concluida === 1 || a.cancelada === 1).length /
                                        dadosOriginais.atividades.length) *
                                        100,
                                    )}%`
                                  : "0%";

                            return (
                              <tr key={`${id}-${index}`}>
                                <td>{index + 1}</td>
                                <td>
                                  {capitalize(dadosOriginais?.status || dados.status || "Pendente")}
                                  {dadosOriginais?.baixadaAutomaticamente === 1 && (
                                    <span className={styles.modalBadge}>Auto</span>
                                  )}
                                </td>
                                <td>
                                  {dadosOriginais?.departamento ||
                                    dadosOriginais?.departamentoNome ||
                                    dadosOriginais?.departamento_nome ||
                                    dados.departamento ||
                                    dados.departamentoNome ||
                                    dados.departamento_nome ||
                                    "-"}
                                </td>
                                <td>{id}</td>
                                <td
                                  className={styles.modalLink}
                                  onClick={() => {
                                    if (tipo === "tarefa") {
                                      window.open(`/tarefas/${id}/atividades`, "_blank");
                                    } else if (tipo === "obrigacao") {
                                      window.open(`/gestao/obrigacao/${id}/atividades`, "_blank");
                                    }
                                  }}
                                >
                                  {evento.title.split("\n")[0]}
                                </td>
                                <td>
                                  {dadosOriginais?.cliente_nome || dados.cliente_nome || "-"}
                                  {dadosOriginais?.cliente_cnpj && (
                                    <div className={styles.modalSecondary}>
                                      {dadosOriginais.cliente_cnpj.replace(
                                        /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
                                        "$1.$2.$3/$4-$5",
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td>{renderPrazo()}</td>
                                <td>{progresso}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {tarefasFiltradasModal.length > 0 && (
                    <footer className={styles.modalFooter}>
                      <div className={styles.modalItensPorPagina}>
                        <span>Itens por página:</span>
                        <select
                          value={itensPorPagina}
                          onChange={(e) => setItensPorPagina(Number(e.target.value))}
                          className={styles.modalSelect}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>

                      <div className={styles.modalRange}>
                        {paginaInicioModal} - {paginaFimModal} de {tarefasFiltradasModal.length}
                      </div>

                      <div className={styles.modalPaginationButtons}>
                        <button
                          type="button"
                          onClick={() => setPaginaAtual((prev) => Math.max(prev - 1, 1))}
                          disabled={paginaAtualAjustada === 1}
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaginaAtual((prev) => Math.min(prev + 1, totalPaginasModal))}
                          disabled={paginaAtualAjustada === totalPaginasModal}
                        >
                          Próximo
                        </button>
                      </div>
                    </footer>
                  )}
                </div>
              </div>
            )}
          </>
        )}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}