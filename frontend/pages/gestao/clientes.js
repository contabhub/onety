"use client";

import React, { useEffect, useState, useRef } from "react";

// Adicionar estilos CSS para a animação do spinner
const spinnerStyles = `
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

// Injetar os estilos no head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = spinnerStyles;
  document.head.appendChild(styleElement);
}

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

// Estilos adicionais para garantir que todos os toasts sejam escuros
const additionalToastStyles = `
  /* Garantir que todos os toasts tenham o tema escuro */
  .Toastify__toast {
    background-color: #1a1a1a !important;
    color: #ffffff !important;
    border: 1px solid #333333 !important;
    border-radius: 8px !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
  }
  
  .Toastify__toast-body {
    color: #ffffff !important;
    font-family: inherit !important;
    font-weight: 500 !important;
  }
  
  .Toastify__progress-bar {
    background-color: var(--titan-primary) !important;
  }
  
  .Toastify__close-button {
    color: #888888 !important;
  }
  
  .Toastify__close-button:hover {
    color: #ffffff !important;
  }
  
  /* Estilos para os ícones dos toasts */
  .Toastify__toast-icon {
    margin-right: 12px !important;
  }
  
  .Toastify__toast-icon svg {
    width: 20px !important;
    height: 20px !important;
  }
  
  /* Sobrescrever cores específicas dos tipos de toast */
  .Toastify__toast--success {
    background-color: #1a1a1a !important;
    border-left: 4px solid #10b981 !important;
  }
  
  .Toastify__toast--success .Toastify__toast-icon {
    color: #10b981 !important;
  }
  
  .Toastify__toast--error {
    background-color: #1a1a1a !important;
    border-left: 4px solid #ef4444 !important;
  }
  
  .Toastify__toast--error .Toastify__toast-icon {
    color: #ef4444 !important;
  }
  
  .Toastify__toast--warning {
    background-color: #1a1a1a !important;
    border-left: 4px solid #f59e0b !important;
  }
  
  .Toastify__toast--warning .Toastify__toast-icon {
    color: #f59e0b !important;
  }
  
  .Toastify__toast--info {
    background-color: #1a1a1a !important;
    border-left: 4px solid #3b82f6 !important;
  }
  
  .Toastify__toast--info .Toastify__toast-icon {
    color: #3b82f6 !important;
  }
`;

// Injetar os estilos adicionais do toast
if (typeof document !== 'undefined') {
  const additionalToastStyleElement = document.createElement('style');
  additionalToastStyleElement.textContent = additionalToastStyles;
  document.head.appendChild(additionalToastStyleElement);
}
import { useRouter } from "next/router";
import NovoClienteModal from "@/components/gestao/NovoClienteModal";
import ClientesImportTemplateModal from "@/components/gestao/ClientesImportTemplateModal";
import styles from "../../styles/gestao/Clientes.module.css";
import EnviarPesquisaFranqueadosModal from "@/components/gestao/EnviarPesquisaFranqueadosModal";
import PrincipalSidebar from "@/components/onety/principal/PrincipalSidebar";
import { Pencil, Trash2, Loader2, Send, Users } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
// Fallback de permissões (ajuste se houver util real de permissões)
const hasPermissao = () => true;
import Select from "react-select";
import { useAuthRedirect } from "@/utils/auth";

// Cliente HTTP simples baseado em fetch, compatível com uso básico feito neste arquivo
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
    return { data: await res.json() };
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
  delete: async (url, config = {}) => {
    const res = await fetch(`${API_BASE}${url}`, {
      method: "DELETE",
      headers: config.headers || {}
    });
    return { data: await res.json() };
  }
};

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


function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// abas: "clientes" | "grupos" | "franqueados"

// Função utilitária para checar se é admin/superadmin
function isAdmin() {
  if (typeof window === "undefined") return false;
  const tipo = (typeof window !== 'undefined') ? localStorage.getItem("tipo") : null;
  return tipo === "admin" || tipo === "superadmin";
}

  // Função utilitária para verificar se é empresa franqueadora
  function isFranqueadora() {
    if (typeof window === "undefined") return false;

    // Primeiro tenta pegar do tipoEmpresa
    let tipoEmpresa = (typeof window !== 'undefined') ? localStorage.getItem("tipoEmpresa") : null;

    // Se não tiver, tenta buscar no userData e depois empresasBackup
    if (!tipoEmpresa) {
      try {
        const userDataRaw = localStorage.getItem("userData");
        const empresasBackup = localStorage.getItem("empresasBackup");

        // 1) userData.tipoEmpresa
        const parsedUser = userDataRaw ? JSON.parse(userDataRaw) : null;
        if (parsedUser?.tipoEmpresa) {
          tipoEmpresa = parsedUser.tipoEmpresa;
        }

        // 2) empresasBackup como fallback
        if (!tipoEmpresa && empresasBackup) {
          const empresas = JSON.parse(empresasBackup);
          const empresaId = parsedUser?.EmpresaId ? String(parsedUser.EmpresaId) : null;
          const empresaAtual = empresaId ? empresas.find((e) => String(e.id) === empresaId) : null;
          tipoEmpresa = empresaAtual?.tipo_empresa || "franqueado";
        }

        // Cache
        localStorage.setItem("tipoEmpresa", tipoEmpresa || "");
      } catch (error) {
        // Silenciar erro
      }
    }

    return tipoEmpresa === "franqueadora";
  }

export default function ClientesPage() {
  useAuthRedirect();
  const [clientes, setClientes] = useState([]);
  const [totalClientes, setTotalClientes] = useState(0);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [limitePorPagina, setLimitePorPagina] = useState(10);
  const [pesquisa, setPesquisa] = useState("");
  const pesquisaDebounced = useDebounce(pesquisa, 400);
  const [abaAtiva, setAbaAtiva] = useState("clientes");
  const [loading, setLoading] = useState(false);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mostrarAbaFranqueados, setMostrarAbaFranqueados] = useState(false);
  
  // Estado para ordenação
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc"
  });

  useEffect(() => {
    setMounted(true);
    try {
      setMostrarAbaFranqueados(isFranqueadora() && hasPermissao("anjos", "visualizar"));
    } catch {}
  }, []);


  // Estados para grupos
  const [mostrarModalGrupo, setMostrarModalGrupo] = useState(false);
  const [grupos, setGrupos] = useState([]);
  const [pesquisaGrupo, setPesquisaGrupo] = useState("");
  const [paginaGrupos, setPaginaGrupos] = useState(1);
  const [totalGrupos, setTotalGrupos] = useState(0);
  const [limiteGruposPorPagina, setLimiteGruposPorPagina] = useState(10);
  const [grupoEditando, setGrupoEditando] = useState(null);

  // Estados para franqueados
  const [franqueados, setFranqueados] = useState([]);
  const [pesquisaFranqueado, setPesquisaFranqueado] = useState("");
  const [paginaFranqueados, setPaginaFranqueados] = useState(1);
  const [totalFranqueados, setTotalFranqueados] = useState(0);
  const [loadingFranqueados, setLoadingFranqueados] = useState(false);
  const [mostrarModalFranqueado, setMostrarModalFranqueado] = useState(false);
  const [limiteFranqueadosPorPagina, setLimiteFranqueadosPorPagina] = useState(10);
  const [franqueadoSelecionado, setFranqueadoSelecionado] = useState(null);
  const [mostrarModalDetalhes, setMostrarModalDetalhes] = useState(false);
  const [mostrarModalNovoFranqueado, setMostrarModalNovoFranqueado] = useState(false);
  const [mostrarModalPesquisa, setMostrarModalPesquisa] = useState(false);
  const [empresaId, setEmpresaId] = useState(0);


  // Estados para filtros de franqueados
  const [filtrosFranqueados, setFiltrosFranqueados] = useState({
    anjo: "",
    ciclo: "",
    uf: "",
    cidade: "",
    conselheiro: "",
    status: ""
  });

  const [filtrosFranqueadosTemp, setFiltrosFranqueadosTemp] = useState({
    anjo: "",
    ciclo: "",
    uf: "",
    cidade: "",
    conselheiro: "",
    status: ""
  });

  // Novo estado para controlar a visibilidade dos filtros avançados
  const [mostrarFiltrosAvancados, setMostrarFiltrosAvancados] = useState(false);

  // Estados para opções dos filtros
  const [opcoesAnjo, setOpcoesAnjo] = useState([]);
  const [opcoesCiclo, setOpcoesCiclo] = useState([]);
  const [opcoesUF, setOpcoesUF] = useState([]);
  const [opcoesCidade, setOpcoesCidade] = useState([]);
  const [opcoesConselheiro, setOpcoesConselheiro] = useState([]);
  const [opcoesStatus, setOpcoesStatus] = useState([]);


  // Função para deletar grupos
  const handleDeleteGrupo = async (grupoId) => {
    if (!window.confirm("Tem certeza que deseja excluir este grupo?")) return;
    try {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      await api.delete(`/gestao/clientes/grupos/${grupoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Grupo excluído com sucesso!");
      buscarGrupos();
    } catch (error) {
      toast.error("Erro ao excluir grupo.");
    }
  };


  // Função para buscar grupos
  const buscarGrupos = async () => {
    setLoadingGrupos(true);
    try {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      const empresaId = (typeof window !== 'undefined') ? (JSON.parse(localStorage.getItem("userData") || '{}')?.EmpresaId) : null;
      if (!token || !empresaId) return;
      const response = await api.get("/gestao/clientes/grupos", {
        params: {
          empresaId,
          search: pesquisaGrupo,
          page: paginaGrupos,
          limit: limiteGruposPorPagina,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      setGrupos(response.data.grupos || []);
      setTotalGrupos(response.data.total || 0);
    } catch (err) {
      console.error("Erro ao buscar grupos", err);
    } finally {
      setLoadingGrupos(false);
    }
  };

  // Função para abrir modal de detalhes do franqueado
  const abrirModalDetalhes = (franqueado) => {
    setFranqueadoSelecionado(franqueado);
    setMostrarModalDetalhes(true);
  };

  // Função para abrir modal de novo franqueado
  const abrirModalNovoFranqueado = () => {
    setMostrarModalNovoFranqueado(true);
  };

  // Função para lidar com sucesso do cadastro de novo franqueado
  const handleNovoFranqueadoSuccess = (novoFranqueado) => {
    toast.success('Franqueado cadastrado com sucesso!');
    setMostrarModalNovoFranqueado(false);
    buscarFranqueados(); // Recarrega a lista
  };

  // Função para aplicar filtros de franqueados
  const aplicarFiltrosFranqueados = () => {
    setPaginaFranqueados(1);
    setFiltrosFranqueados(filtrosFranqueadosTemp);
  };

  // Função para limpar filtros de franqueados
  const limparFiltrosFranqueados = () => {
    setFiltrosFranqueados({
      anjo: "",
      ciclo: "",
      uf: "",
      cidade: "",
      conselheiro: "",
      status: ""
    });
    setFiltrosFranqueadosTemp({
      anjo: "",
      ciclo: "",
      uf: "",
      cidade: "",
      conselheiro: "",
      status: ""
    });
    setPesquisaFranqueado("");
    setPaginaFranqueados(1);
    
    // Recarregar todas as cidades quando limpar filtros
    if (abaAtiva === "franqueados") {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      if (token) {
        api.get("/gestao/franqueados/opcoes/cidade", {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
          setOpcoesCidade(res.data.map((c) => ({ label: c, value: c })));
        }).catch((error) => {
          // Se for erro 403, não mostrar erro para o usuário
          if (error?.response?.status === 403) {
            setOpcoesCidade([]);
          } else {
            console.error("Erro ao buscar todas as cidades:", error);
            setOpcoesCidade([]);
          }
        });
      }
    }
  };

  // Função para buscar franqueados
  const buscarFranqueados = async () => {
    setLoadingFranqueados(true);
    try {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      const empresaId = (typeof window !== 'undefined') ? (JSON.parse(localStorage.getItem("userData") || '{}')?.EmpresaId) : null;
      if (!token || !empresaId) return;



      const response = await api.get("/gestao/franqueados", {
        params: {
          empresaId,
          search: pesquisaFranqueado,
          page: paginaFranqueados,
          limit: limiteFranqueadosPorPagina,
          anjo: filtrosFranqueados.anjo,
          ciclo: filtrosFranqueados.ciclo,
          uf: filtrosFranqueados.uf,
          cidade: filtrosFranqueados.cidade,
          conselheiro: filtrosFranqueados.conselheiro,
          status: filtrosFranqueados.status,
        },
        headers: { Authorization: `Bearer ${token}` },
      });



      setFranqueados(response.data.franqueados || []);
      setTotalFranqueados(response.data.total || 0);
    } catch (err) {
      // Se for erro 403 (Forbidden), significa que a empresa não tem permissão
      // para acessar franqueados - não mostrar erro para o usuário
      if (err?.response?.status === 403) {
        setFranqueados([]);
        setTotalFranqueados(0);
        // Não mostrar toast de erro
      } else {
        console.error("Erro ao buscar franqueados", err);
        // Só mostrar toast para outros tipos de erro
        toast.error("Erro ao carregar franqueados");
      }
    } finally {
      setLoadingFranqueados(false);
    }
  };


  useEffect(() => {
    if (abaAtiva === "clientes") {
      buscarClientes();
    } else if (abaAtiva === "grupos") {
      buscarGrupos();
    } else if (abaAtiva === "franqueados") {
      buscarFranqueados();
    }
    // eslint-disable-next-line
  }, [abaAtiva, paginaAtual, paginaGrupos, paginaFranqueados, pesquisaDebounced, pesquisaGrupo, pesquisaFranqueado, limiteFranqueadosPorPagina, limiteGruposPorPagina, filtrosFranqueados]);

  // Resetar página quando pesquisa mudar
  useEffect(() => {
    if (abaAtiva === "franqueados") {
      setPaginaFranqueados(1);
    }
  }, [pesquisaFranqueado, abaAtiva]);

  // Ao mudar quantidade de itens por página, volte para página 1
  useEffect(() => {
    if (abaAtiva === "franqueados") {
      setPaginaFranqueados(1);
    }
  }, [limiteFranqueadosPorPagina, abaAtiva]);

  // Ao mudar quantidade de itens por página de grupos, volte para página 1
  useEffect(() => {
    if (abaAtiva === "grupos") {
      setPaginaGrupos(1);
    }
  }, [limiteGruposPorPagina, abaAtiva]);




  const [filtros, setFiltros] = useState({
    tipoInscricao: "",
    tipo: "",
    status: "",
    dores: [],
    solucoes: [],
    grupos: [],
  });

  // Novo estado para filtros temporários (usados nos selects)
  const [filtrosTemp, setFiltrosTemp] = useState({
    tipoInscricao: "",
    tipo: "",
    status: "",
    dores: [],
    solucoes: [],
    grupos: [],
  });

  // Sincronizar filtrosTemp com filtros ao abrir a tela ou limpar
  useEffect(() => {
    setFiltrosTemp(filtros);
  }, [filtros.tipoInscricao, filtros.tipo, filtros.status, filtros.dores, filtros.solucoes, filtros.grupos]);

  // Sincronizar filtrosFranqueadosTemp com filtrosFranqueados
  useEffect(() => {
    setFiltrosFranqueadosTemp(filtrosFranqueados);
  }, [filtrosFranqueados.anjo, filtrosFranqueados.ciclo, filtrosFranqueados.uf, filtrosFranqueados.cidade, filtrosFranqueados.conselheiro, filtrosFranqueados.status]);

  // Atualizar cidades quando UF mudar
  useEffect(() => {
    if (filtrosFranqueados.uf && abaAtiva === "franqueados") {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      if (token) {
        api.get(`/gestao/franqueados/opcoes/cidade?uf=${filtrosFranqueados.uf}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
          setOpcoesCidade(res.data.map((c) => ({ label: c, value: c })));
        }).catch((error) => {
          // Se for erro 403, não mostrar erro para o usuário
          if (error?.response?.status === 403) {
            setOpcoesCidade([]);
          } else {
            console.error("Erro ao buscar cidades por UF:", error);
            setOpcoesCidade([]);
          }
        });
      }
    } else if (!filtrosFranqueados.uf && abaAtiva === "franqueados") {
      // Se não há UF selecionada, buscar todas as cidades
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      if (token) {
        api.get("/gestao/franqueados/opcoes/cidade", {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
          setOpcoesCidade(res.data.map((c) => ({ label: c, value: c })));
        }).catch((error) => {
          // Se for erro 403, não mostrar erro para o usuário
          if (error?.response?.status === 403) {
            setOpcoesCidade([]);
          } else {
            console.error("Erro ao buscar todas as cidades:", error);
            setOpcoesCidade([]);
          }
        });
      }
    }
  }, [filtrosFranqueados.uf, abaAtiva]);

  const [opcoesDores, setOpcoesDores] = useState([]);
  const [opcoesSolucoes, setOpcoesSolucoes] = useState([]);
  const [opcoesGrupos, setOpcoesGrupos] = useState([]);
  const [opcoesStatusClientes, setOpcoesStatusClientes] = useState([]);

  useEffect(() => {
    // Buscar dores e solucoes do backend
    api.get("/gestao/clientes/dores").then(res => {
      setOpcoesDores(res.data.map((d) => ({ label: d, value: d })));
    });
    api.get("/gestao/clientes/solucoes").then(res => {
      setOpcoesSolucoes(res.data.map((s) => ({ label: s, value: s })));
    });
    
    // Buscar grupos da empresa
    const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
    const empresaId = (typeof window !== 'undefined') ? (JSON.parse(localStorage.getItem("userData") || '{}')?.EmpresaId) : null;
    if (token && empresaId) {
      api.get(`/gestao/clientes/grupos/todos?empresaId=${empresaId}`).then(res => {
        setOpcoesGrupos(res.data.grupos.map((g) => ({ label: g.nome, value: g.id.toString() })));
      }).catch(err => {
        console.error("Erro ao buscar grupos:", err);
      });

      // Buscar status existentes na carteira da empresa
      api.get(`/gestao/clientes/opcoes/status`, {
        params: { empresaId },
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        const opts = (res.data || [])
          .filter((s) => !!s)
          .map((s) => ({ label: s, value: s }));
        setOpcoesStatusClientes(opts);
      }).catch(err => {
        console.error("Erro ao buscar status de clientes:", err);
        setOpcoesStatusClientes([]);
      });
    }
  }, []);

  // Carregar opções dos filtros de franqueados
  useEffect(() => {
    if (abaAtiva === "franqueados") {
      // Opções fixas para alguns filtros
      setOpcoesCiclo([
        { label: "10k", value: "10k" },
        { label: "30k", value: "30k" },
        { label: "60k", value: "60k" },
        { label: "Paladino", value: "Paladino" },
        { label: "Heroes", value: "Heroes" }
      ]);

      setOpcoesStatus([
        { label: "Ativo", value: "ativo" },
        { label: "Inativo", value: "inativo" },
        { label: "Pendente", value: "pendente" },
        { label: "Suspenso", value: "suspenso" }
      ]);

      // Buscar opções dinâmicas do backend
      const token = sessionStorage.getItem("token");
      if (token) {
        // Buscar ANJOs únicos
        api.get("/gestao/franqueados/opcoes/anjo", {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
          setOpcoesAnjo(res.data.map((a) => ({ label: a, value: a })));
        }).catch((error) => {
          // Se for erro 403, não mostrar erro para o usuário
          if (error?.response?.status === 403) {
            setOpcoesAnjo([]);
          } else {
            console.error("Erro ao buscar ANJOs:", error);
            setOpcoesAnjo([]);
          }
        });

        // Buscar UFs únicas
        api.get("/gestao/franqueados/opcoes/uf", {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
          setOpcoesUF(res.data.map((u) => ({ label: u, value: u })));
        }).catch((error) => {
          // Se for erro 403, não mostrar erro para o usuário
          if (error?.response?.status === 403) {
            setOpcoesUF([]);
          } else {
            console.error("Erro ao buscar UFs:", error);
            // Fallback para UFs brasileiras
            setOpcoesUF([
              { label: "AC", value: "AC" }, { label: "AL", value: "AL" }, { label: "AP", value: "AP" },
              { label: "AM", value: "AM" }, { label: "BA", value: "BA" }, { label: "CE", value: "CE" },
              { label: "DF", value: "DF" }, { label: "ES", value: "ES" }, { label: "GO", value: "GO" },
              { label: "MA", value: "MA" }, { label: "MT", value: "MT" }, { label: "MS", value: "MS" },
              { label: "MG", value: "MG" }, { label: "PA", value: "PA" }, { label: "PB", value: "PB" },
              { label: "PR", value: "PR" }, { label: "PE", value: "PE" }, { label: "PI", value: "PI" },
              { label: "RJ", value: "RJ" }, { label: "RN", value: "RN" }, { label: "RS", value: "RS" },
              { label: "RO", value: "RO" }, { label: "RR", value: "RR" }, { label: "SC", value: "SC" },
              { label: "SP", value: "SP" }, { label: "SE", value: "SE" }, { label: "TO", value: "TO" }
            ]);
          }
        });

        // Buscar cidades únicas
        api.get("/gestao/franqueados/opcoes/cidade", {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
          setOpcoesCidade(res.data.map((c) => ({ label: c, value: c })));
        }).catch((error) => {
          // Se for erro 403, não mostrar erro para o usuário
          if (error?.response?.status === 403) {
            setOpcoesCidade([]);
          } else {
            console.error("Erro ao buscar cidades:", error);
            setOpcoesCidade([]);
          }
        });

        // Buscar conselheiros únicos
        api.get("/gestao/franqueados/opcoes/conselheiro", {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
          setOpcoesConselheiro(res.data.map((c) => ({ label: c, value: c })));
        }).catch((error) => {
          console.error("Erro ao buscar conselheiros:", error);
          setOpcoesConselheiro([]);
        });
      }
    }
  }, [abaAtiva]);

  const router = useRouter();
  const [importando, setImportando] = useState(false);
  const [mostrarImportHelp, setMostrarImportHelp] = useState(false);
  const inputFileRef = useRef(null);

  const buscarClientes = async () => {
    setLoading(true);
    try {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      const empresaId = (typeof window !== 'undefined') ? (JSON.parse(localStorage.getItem("userData") || '{}')?.EmpresaId) : null;
      if (!token || !empresaId) {
        router.push("/login");
        return;
      }

      const response = await api.get(`/gestao/clientes`, {
        params: {
          empresaId,
          page: paginaAtual,
          limit: limitePorPagina,
          tipoInscricao: filtros.tipoInscricao,
          tipo: filtros.tipo,
          status: filtros.status,
          dores: filtros.dores.join(","),
          solucoes: filtros.solucoes.join(","),
          grupos: filtros.grupos.join(","),
          search: pesquisaDebounced,
          sortBy: sortConfig.key,
          sortOrder: sortConfig.direction,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      setClientes(response.data.clientes || []);
      setTotalClientes(response.data.total || 0);
    } catch (err) {
      console.error("Erro ao buscar clientes", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buscarClientes();
  }, [paginaAtual, filtros, pesquisaDebounced, limitePorPagina, sortConfig]);

  // Ao mudar quantidade de itens por página, volte para página 1
  useEffect(() => {
    setPaginaAtual(1);
  }, [limitePorPagina, filtros, pesquisaDebounced, sortConfig]);


  useEffect(() => {
    if (!mostrarModal) buscarClientes();
  }, [mostrarModal]);

  const aplicarFiltros = () => {
    setPaginaAtual(1);
    setFiltros(filtrosTemp);
  };

  const limparFiltros = () => {
    setFiltros({ tipoInscricao: "", tipo: "", status: "", dores: [], solucoes: [], grupos: [] });
    setPesquisa("");
    setPaginaAtual(1);
  };

  const totalPaginas = Math.ceil(totalClientes / limitePorPagina);
  const paginaInicio = Math.max(1, paginaAtual - 2);
  const paginaFim = Math.min(totalPaginas, paginaInicio + 4);

  // Variáveis de paginação para grupos
  const totalPaginasGrupos = Math.ceil(totalGrupos / limiteGruposPorPagina);
  const paginaInicioGrupos = Math.max(1, paginaGrupos - 2);
  const paginaFimGrupos = Math.min(totalPaginasGrupos, paginaInicioGrupos + 4);

  // Variáveis de paginação para franqueados
  const totalPaginasFranqueados = Math.ceil(totalFranqueados / limiteFranqueadosPorPagina);
  const paginaInicioFranqueados = Math.max(1, paginaFranqueados - 2);
  const paginaFimFranqueados = Math.min(totalPaginasFranqueados, paginaInicioFranqueados + 4);

  const formatarData = (data) => {
    if (!data) return "";
    return new Date(data).toLocaleDateString("pt-BR");
  };



  // Função para solicitar ordenação
  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Função para importar clientes via planilha
  const handleImportarClientes = () => {
    setMostrarImportHelp(true);
  };

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    try {
      const token = (typeof window !== 'undefined') ? localStorage.getItem("token") : null;
      const formData = new FormData();
      formData.append("file", file);
      // Adiciona instrução de mapeamento de colunas para o backend (se suportado)
      formData.append("colMap", JSON.stringify({
        "EMPRESAS": "nome",
        "CNPJ/CPF": "cnpjCpf",
        "TRIBUTAÇÃO": "regimeTributario"
      }));
      const response = await api.post("/gestao/clientes/importar-planilha", formData, {
        headers: {
          Authorization: `Bearer ${token}`
        },
      });
      toast.success("Clientes importados com sucesso!");
      buscarClientes();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao importar clientes.");
    } finally {
      setImportando(false);
    }
  };

  useEffect(() => {
    // Definir empresaId do sessionStorage
    if (typeof window !== 'undefined') {
      const id = localStorage.getItem("userData");
      const parsed = id ? JSON.parse(id) : null;
      if (parsed?.EmpresaId) {
        setEmpresaId(parseInt(parsed.EmpresaId));
      }
    }
  }, []);

  // Buscar franqueados quando mudar os filtros
  useEffect(() => {
    buscarFranqueados();
  }, [filtrosFranqueados, paginaFranqueados]);


  return (
    <>
      <PrincipalSidebar />
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
      <div className={styles.container}>
        {/* ABA DE NAVEGAÇÃO */}
        <div className={styles.tabsContainer}>
          <div
            className={`${styles.tab} ${abaAtiva === "clientes" ? styles.activeTab : ""}`}
            onClick={() => setAbaAtiva("clientes")}
          >
            Clientes
          </div>
          <div
            className={`${styles.tab} ${abaAtiva === "grupos" ? styles.activeTab : ""}`}
            onClick={() => setAbaAtiva("grupos")}
          >
            Grupos
          </div>
          {mounted && mostrarAbaFranqueados && (
            <div
              className={`${styles.tab} ${abaAtiva === "franqueados" ? styles.activeTab : ""}`}
              onClick={() => setAbaAtiva("franqueados")}
            >
              Franqueados
            </div>
          )}
        </div>

        {/* CONTEÚDO DAS ABAS */}
        {abaAtiva === "clientes" ? (
          <>
            {/* Linha de filtros */}
            <div className={styles.filtersRow}>
              <select
                value={filtrosTemp.tipoInscricao}
                onChange={e => setFiltrosTemp(f => ({ ...f, tipoInscricao: e.target.value }))}
                className={styles.filtroSelect}
              >
                <option value="">Tipo de Inscrição</option>
                <option value="CNPJ">CNPJ</option>
                <option value="CPF">CPF</option>
              </select>
              <select
                value={filtrosTemp.tipo}
                onChange={e => setFiltrosTemp(f => ({ ...f, tipo: e.target.value }))}
                className={styles.filtroSelect}
              >
                <option value="">Tipo</option>
                <option value="Fixo">Fixo</option>
              </select>
              <select
                value={filtrosTemp.status}
                onChange={e => setFiltrosTemp(f => ({ ...f, status: e.target.value }))}
                className={styles.filtroSelect}
              >
                <option value="">Status</option>
                {opcoesStatusClientes.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {/* Filtro de Dor */}
              <div style={{ minWidth: 180, marginRight: 1 }}>
                <Select
                  isMulti
                  options={opcoesDores}
                  value={opcoesDores.filter(opt => filtrosTemp.dores.includes(opt.value))}
                  onChange={opts => setFiltrosTemp(f => ({ ...f, dores: opts.map(o => o.value) }))}
                  placeholder="Filtrar por dor"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: 35,
                      maxHeight: 35,
                      width: 180,
                      borderRadius: 'var(--titan-radius-sm)',
                      fontSize: 'var(--titan-font-size-sm)',
                      outline: "none",
                      boxShadow: "none",
                      borderColor: "var(--titan-stroke)",
                      backgroundColor: "var(--titan-input-bg)",
                      ...(state.isFocused ? {
                        borderColor: "var(--titan-primary)",
                        boxShadow: "var(--titan-glow-primary)"
                      } : {}),
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: "var(--titan-text-low)",
                      opacity: 1,
                      fontWeight: "var(--titan-font-weight-normal)",
                      fontSize: "var(--titan-font-size-sm)",
                    }),
                    multiValue: (base) => ({
                      ...base,
                      backgroundColor: "var(--titan-primary)",
                      margin: 0,
                      borderRadius: "var(--titan-radius-sm)",
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      color: "white",
                      fontWeight: "var(--titan-font-weight-medium)",
                      fontSize: "var(--titan-font-size-sm)",
                    }),
                    multiValueRemove: (base) => ({
                      ...base,
                      color: "white",
                      ":hover": {
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                        color: "white",
                      },
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      flexWrap: "nowrap",
                      gap: 4,
                      overflowX: "auto",
                      fontSize: "var(--titan-font-size-sm)",
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected
                        ? "var(--titan-primary)"
                        : state.isFocused
                          ? "rgba(255, 255, 255, 0.02)"
                          : "var(--titan-base-00)",
                      color: state.isSelected ? "white" : "var(--titan-text-high)",
                      cursor: "pointer",
                      boxShadow: "none",
                      outline: "none",
                      border: "none",
                      fontSize: "var(--titan-font-size-sm)",
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 9999,
                    }),
                    menuList: (base) => ({
                      ...base,
                      boxShadow: "none",
                      outline: "none",
                    }),
                  }}
                  menuPlacement="auto"
                />
              </div>
              {/* Filtro de Solução */}
              <div style={{ minWidth: 180, marginRight: 1 }}>
                <Select
                  isMulti
                  options={opcoesSolucoes}
                  value={opcoesSolucoes.filter(opt => filtrosTemp.solucoes.includes(opt.value))}
                  onChange={opts => setFiltrosTemp(f => ({ ...f, solucoes: opts.map(o => o.value) }))}
                  placeholder="Filtrar por solução"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: 35,
                      maxHeight: 35,
                      width: 180,
                      borderRadius: 'var(--titan-radius-sm)',
                      fontSize: 'var(--titan-font-size-sm)',
                      outline: "none",
                      boxShadow: "none",
                      borderColor: "var(--titan-stroke)",
                      backgroundColor: "var(--titan-input-bg)",
                      ...(state.isFocused ? {
                        borderColor: "var(--titan-primary)",
                        boxShadow: "var(--titan-glow-primary)"
                      } : {}),
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: "var(--titan-text-low)",
                      opacity: 1,
                      fontWeight: "var(--titan-font-weight-normal)",
                      fontSize: "var(--titan-font-size-sm)",
                    }),
                    multiValue: (base) => ({
                      ...base,
                      backgroundColor: "var(--titan-primary)",
                      margin: 0,
                      borderRadius: "var(--titan-radius-sm)",
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      color: "white",
                      fontWeight: "var(--titan-font-weight-medium)",
                      fontSize: "var(--titan-font-size-sm)",
                    }),
                    multiValueRemove: (base) => ({
                      ...base,
                      color: "white",
                      ":hover": {
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                        color: "white",
                      },
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      flexWrap: "nowrap",
                      gap: 4,
                      overflowX: "auto",
                      fontSize: "var(--titan-font-size-sm)",
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected
                        ? "var(--titan-primary)"
                        : state.isFocused
                          ? "rgba(255, 255, 255, 0.02)"
                          : "var(--titan-base-00)",
                      color: state.isSelected ? "white" : "var(--titan-text-high)",
                      cursor: "pointer",
                      boxShadow: "none",
                      outline: "none",
                      border: "none",
                      fontSize: "var(--titan-font-size-sm)",
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 9999,
                    }),
                    menuList: (base) => ({
                      ...base,
                      boxShadow: "none",
                      outline: "none",
                    }),
                  }}
                  menuPlacement="auto"
                />
              </div>

              {/* Filtro de Grupo */}
              <div style={{ minWidth: 180, marginRight: 1 }}>
                <Select
                  isMulti
                  options={opcoesGrupos}
                  value={opcoesGrupos.filter(opt => filtrosTemp.grupos.includes(opt.value))}
                  onChange={opts => setFiltrosTemp(f => ({ ...f, grupos: opts.map(o => o.value) }))}
                  placeholder="Filtrar por grupo"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: 35,
                      maxHeight: 35,
                      width: 180,
                      borderRadius: 'var(--titan-radius-sm)',
                      fontSize: 'var(--titan-font-size-sm)',
                      outline: "none",
                      boxShadow: "none",
                      borderColor: "var(--titan-stroke)",
                      backgroundColor: "var(--titan-input-bg)",
                      ...(state.isFocused ? {
                        borderColor: "var(--titan-primary)",
                        boxShadow: "var(--titan-glow-primary)"
                      } : {}),
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: "var(--titan-text-low)",
                      opacity: 1,
                      fontWeight: "var(--titan-font-weight-normal)",
                      fontSize: "var(--titan-font-size-sm)",
                    }),
                    multiValue: (base) => ({
                      ...base,
                      backgroundColor: "var(--titan-primary)",
                      margin: 0,
                      borderRadius: "var(--titan-radius-sm)",
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      color: "white",
                      fontWeight: "var(--titan-font-weight-medium)",
                      fontSize: "var(--titan-font-size-sm)",
                    }),
                    multiValueRemove: (base) => ({
                      ...base,
                      color: "white",
                      ":hover": {
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                        color: "white",
                      },
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      flexWrap: "nowrap",
                      gap: 4,
                      overflowX: "auto",
                      fontSize: "var(--titan-font-size-sm)",
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected
                        ? "var(--titan-primary)"
                        : state.isFocused
                          ? "rgba(255, 255, 255, 0.02)"
                          : "var(--titan-base-00)",
                      color: state.isSelected ? "white" : "var(--titan-text-high)",
                      cursor: "pointer",
                      boxShadow: "none",
                      outline: "none",
                      border: "none",
                      fontSize: "var(--titan-font-size-sm)",
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 9999,
                    }),
                    menuList: (base) => ({
                      ...base,
                      boxShadow: "none",
                      outline: "none",
                    }),
                  }}
                  menuPlacement="auto"
                />
              </div>
              <button onClick={aplicarFiltros} className={styles.botaoAplicar}>
                Aplicar Filtros
              </button>
              <button onClick={limparFiltros} className={styles.botaoLimpar}>
                Limpar Tudo
              </button>
            </div>

            {/* Linha pesquisa + botão */}
            <div className={styles.buttonsRow}>
              {hasPermissao("clientes", "criar") && (
                <button onClick={() => setMostrarModal(true)} className={styles.botaoClientes}>+ Clientes</button>
              )}

              {/* Botão Importar Clientes */}
              {(hasPermissao("clientes", "criar") || isAdmin()) && (
                <>
                  <button
                    onClick={handleImportarClientes}
                    className={styles.botaoClientes}
                    disabled={importando}
                    style={{ marginLeft: 8 }}
                  >
                    {importando ? "Importando..." : "Importar Clientes"}
                  </button>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: "none" }}
                    ref={inputFileRef}
                    onChange={onFileChange}
                  />
                </>
              )}

              {/* Campo de pesquisa movido para cá */}
              <input
                type="text"
                placeholder="Pesquisar nome ou CNPJ..."
                value={pesquisa}
                onChange={e => setPesquisa(e.target.value)}
                className={styles.filtroInput}
                style={{ width: 200, marginLeft: 8, marginRight: 8 }}
              />

              {/* Botão Exportar Excel */}
              <button
                onClick={async () => {
                  const token = sessionStorage.getItem("token");
                  const empresaId = sessionStorage.getItem("empresaId");
                  // Montar params com todos os filtros aplicados
                  const params = new URLSearchParams({
                    empresaId: empresaId || '',
                    tipoInscricao: filtros.tipoInscricao,
                    tipo: filtros.tipo,
                    status: filtros.status,
                    dores: filtros.dores.join(","),
                    solucoes: filtros.solucoes.join(","),
                    grupos: filtros.grupos.join(","),
                    search: pesquisa,
                  });
                  const url = `/gestao/clientes/exportar-excel?${params.toString()}`;
                  try {
                    const res = await api.get(url, {
                      responseType: 'blob',
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    const blob = new Blob([res.data], { type: res.headers['content-type'] });
                    const urlBlob = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = urlBlob;
                    a.download = "clientes.xlsx";
                    a.click();
                    window.URL.revokeObjectURL(urlBlob);
                  } catch (err) {
                    toast.error("Erro ao exportar clientes.");
                  }
                }}
                className={styles.botaoClientes}
                style={{ marginLeft: 8 }}
              >
                Exportar Excel
              </button>
            </div>

            {/* Indicador de ordenação */}
            {sortConfig.key && (
              <div style={{
                marginBottom: "var(--titan-spacing-sm)",
                padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                backgroundColor: "rgba(0, 128, 255, 0.1)",
                border: "1px solid rgba(0, 128, 255, 0.2)",
                borderRadius: "var(--titan-radius-sm)",
                color: "var(--titan-primary)",
                fontSize: "var(--titan-font-size-sm)",
                display: "flex",
                alignItems: "center",
                gap: "var(--titan-spacing-sm)"
              }}>
                <span>
                  Ordenado por: <strong>{sortConfig.key === "nome" ? "Apelido" : 
                    sortConfig.key === "tipoInscricao" ? "Tipo de Inscrição" :
                    sortConfig.key === "status" ? "Status" :
                    sortConfig.key === "dataInicio" ? "Data Início" : sortConfig.key}</strong>
                  {" "}({sortConfig.direction === "asc" ? "A-Z" : "Z-A"})
                </span>
                <button
                  onClick={() => setSortConfig({ key: null, direction: "asc" })}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    color: "var(--titan-primary)",
                    cursor: "pointer",
                    fontSize: "var(--titan-font-size-sm)",
                    padding: "var(--titan-spacing-xs)",
                    borderRadius: "var(--titan-radius-sm)",
                    transition: "all var(--titan-transition-fast)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(0, 128, 255, 0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  ✕ Limpar ordenação
                </button>
              </div>
            )}

            {/* Tabela */}
            {loading ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <Loader2
                  size={32}
                  style={{
                    color: '#1976D2',
                    animation: 'spin 1s linear infinite'
                  }}
                />
                <span style={{ color: '#6B7280', fontSize: '14px' }}>Carregando clientes...</span>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>#</th>
                    <th 
                      className={`${styles.th} ${styles.sortableTh}`}
                      onClick={() => requestSort("tipoInscricao")}
                      style={{ cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        Tipo de Inscrição
                        {sortConfig.key === "tipoInscricao" && (
                          <span style={{ fontSize: "12px", color: "var(--titan-primary)" }}>
                            {sortConfig.direction === "asc" ? "▲" : "▼"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className={styles.th}>Inscrição</th>
                    <th 
                      className={`${styles.th} ${styles.sortableTh}`}
                      onClick={() => requestSort("nome")}
                      style={{ cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        Apelido
                        {sortConfig.key === "nome" && (
                          <span style={{ fontSize: "12px", color: "var(--titan-primary)" }}>
                            {sortConfig.direction === "asc" ? "▲" : "▼"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className={styles.th}>Tipo</th>
                    <th 
                      className={`${styles.th} ${styles.sortableTh}`}
                      onClick={() => requestSort("status")}
                      style={{ cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        Status
                        {sortConfig.key === "status" && (
                          <span style={{ fontSize: "12px", color: "var(--titan-primary)" }}>
                            {sortConfig.direction === "asc" ? "▲" : "▼"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className={styles.th}>Status Complementar</th>
                    <th className={styles.th}>Responsável Legal</th>
                    <th className={styles.th}>Dores</th>
                    <th className={styles.th}>Soluções</th>
                    <th 
                      className={`${styles.th} ${styles.sortableTh}`}
                      onClick={() => requestSort("dataInicio")}
                      style={{ cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        Data Início
                        {sortConfig.key === "dataInicio" && (
                          <span style={{ fontSize: "12px", color: "var(--titan-primary)" }}>
                            {sortConfig.direction === "asc" ? "▲" : "▼"}
                          </span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c, index) => (
                    <tr key={c.id}>
                      <td className={styles.td}>{(paginaAtual - 1) * limitePorPagina + index + 1}</td>
                      <td className={styles.td}>{c.tipoInscricao || ""}</td>
                      <td
                        className={`${styles.td} ${styles.linkTd}`}
                        onClick={() => router.push(`/dashboard/clientes/${c.id}`)}
                      >
                        <span className={styles.cellHighlight}>
                          {formatarCnpjCpf(c.cnpjCpf)}
                        </span>
                      </td>
                      <td
                        className={`${styles.td} ${styles.linkTd}`}
                        onClick={() => router.push(`/dashboard/clientes/${c.id}`)}
                      >
                        <span className={styles.cellHighlight}>
                          {c.nome || ""}
                        </span>
                      </td>
                      <td className={styles.td}>{c.tipo || ""}</td>
                      <td
                        className={`${styles.td} ${styles.linkTd}`}
                        onClick={() => {
                          const novoStatus = c.status || "";
                          setFiltrosTemp(f => ({ ...f, status: novoStatus }));
                          setFiltros(f => ({ ...f, status: novoStatus }));
                          setPaginaAtual(1);
                        }}
                        title={c.status || ""}
                      >
                        <span className={styles.cellHighlight}>
                          {c.status || ""}
                        </span>
                      </td>
                      <td className={styles.td}>{c.statusComplementar || ""}</td>
                      <td className={styles.td}>{c.responsavelLegal || ""}</td>
                      <td className={styles.td}>{Array.isArray(c.dores) ? c.dores.join(", ") : ""}</td>
                      <td className={styles.td}>{Array.isArray(c.solucoes) ? c.solucoes.join(", ") : ""}</td>
                      <td className={styles.td}>{formatarData(c.dataInicio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* PAGINAÇÃO COM SETAS */}
            <div className={styles.pagination}>
              <span>
                Mostrando {(paginaAtual - 1) * limitePorPagina + 1}
                {" - "}
                {Math.min(paginaAtual * limitePorPagina, totalClientes)} de {totalClientes}
              </span>
              <div className={styles.paginationButtons}>
                <select
                  value={limitePorPagina}
                  onChange={(e) => setLimitePorPagina(Number(e.target.value))}
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
                  onClick={() => setPaginaAtual(1)}
                  disabled={paginaAtual === 1}
                  aria-label="Primeira página"
                >
                  {"<<"}
                </button>
                <button
                  className={styles.paginationArrow}
                  onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                  disabled={paginaAtual === 1}
                  aria-label="Página anterior"
                >
                  {"<"}
                </button>
                {Array.from({ length: paginaFim - paginaInicio + 1 }, (_, i) => paginaInicio + i).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPaginaAtual(p)}
                    className={p === paginaAtual ? styles.paginationButtonActive : styles.paginationArrow}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className={styles.paginationArrow}
                  onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaAtual === totalPaginas}
                  aria-label="Próxima página"
                >
                  {">"}
                </button>
                <button
                  className={styles.paginationArrow}
                  onClick={() => setPaginaAtual(totalPaginas)}
                  disabled={paginaAtual === totalPaginas}
                  aria-label="Última página"
                >
                  {">>"}
                </button>
              </div>
            </div>

            {/* Modal NovoClienteModal aqui */}
            {mostrarModal && (
              <NovoClienteModal
                onClose={() => setMostrarModal(false)}
                onSuccess={() => {
                  setMostrarModal(false);
                  buscarClientes(); // atualiza a lista depois de cadastrar
                }}
              />
            )}
          </>
        ) : abaAtiva === "grupos" ? (
          <>
            {/* CONTEÚDO DA ABA DE GRUPOS */}
            <div className={styles.buttonsRow}>
              <button
                className={styles.botaoClientes}
                onClick={() => setMostrarModalGrupo(true)}
              >
                + Grupos
              </button>
              <input
                type="text"
                placeholder="Pesquisar"
                value={pesquisaGrupo}
                onChange={e => setPesquisaGrupo(e.target.value)}
                className={styles.filtroInput}
                style={{ width: 200, marginRight: 8 }}
              />

            </div>
            {loadingGrupos ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <Loader2
                  size={32}
                  style={{
                    color: '#1976D2',
                    animation: 'spin 1s linear infinite'
                  }}
                />
                <span style={{ color: '#6B7280', fontSize: '14px' }}>Carregando grupos...</span>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>No</th>
                    <th className={styles.th}>Nome</th>
                    <th className={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g, idx) => (
                    <tr key={g.id}>
                      <td className={styles.td}>{(paginaGrupos - 1) * limiteGruposPorPagina + idx + 1}</td>
                      <td 
                        className={`${styles.td} ${styles.linkTd}`}
                        onClick={() => window.open(`/dashboard/grupos/${g.id}`, '_blank')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className={styles.cellHighlight}>
                          {g.nome}
                        </span>
                      </td>
                      <td className={styles.td + " " + styles.actionsTd}>
                        <span style={{
                          display: "flex",
                          gap: 18,
                          justifyContent: "flex-end",
                          width: "100%",
                        }}>
                          <Pencil
                            size={20}
                            className={`${styles.actionIcon} ${styles.edit}`}
                            onClick={() => {
                              setGrupoEditando(g);
                              setMostrarModalGrupo(true);
                            }}
                          />
                          <Trash2
                            size={20}
                            className={`${styles.actionIcon} ${styles.delete}`}
                            onClick={() => handleDeleteGrupo(g.id)}
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {/* PAGINAÇÃO GRUPOS */}
            <div className={styles.pagination}>
              <span>
                Mostrando {(paginaGrupos - 1) * limiteGruposPorPagina + 1}
                {" - "}
                {Math.min(paginaGrupos * limiteGruposPorPagina, totalGrupos)} de {totalGrupos}
              </span>
              <div className={styles.paginationButtons}>
                <select
                  value={limiteGruposPorPagina}
                  onChange={(e) => setLimiteGruposPorPagina(Number(e.target.value))}
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
                  onClick={() => setPaginaGrupos(1)}
                  disabled={paginaGrupos === 1}
                  aria-label="Primeira página"
                >
                  {"<<"}
                </button>
                <button
                  className={styles.paginationArrow}
                  onClick={() => setPaginaGrupos((p) => Math.max(1, p - 1))}
                  disabled={paginaGrupos === 1}
                  aria-label="Página anterior"
                >
                  {"<"}
                </button>
                {Array.from({ length: paginaFimGrupos - paginaInicioGrupos + 1 }, (_, i) => paginaInicioGrupos + i).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPaginaGrupos(p)}
                    className={p === paginaGrupos ? styles.paginationButtonActive : styles.paginationArrow}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className={styles.paginationArrow}
                  onClick={() => setPaginaGrupos((p) => Math.min(totalPaginasGrupos, p + 1))}
                  disabled={paginaGrupos === totalPaginasGrupos}
                  aria-label="Próxima página"
                >
                  {">"}
                </button>
                <button
                  className={styles.paginationArrow}
                  onClick={() => setPaginaGrupos(totalPaginasGrupos)}
                  disabled={paginaGrupos === totalPaginasGrupos}
                  aria-label="Última página"
                >
                  {">>"}
                </button>
              </div>
            </div>
            {/* MODAL DE NOVO GRUPO */}
            {/* Modal de grupo indisponível: componente não encontrado */}
          </>
        ) : abaAtiva === "franqueados" ? (
           <>
             {/* CONTEÚDO DA ABA DE FRANQUEADOS */}
             
             {/* LINHA DE FILTROS - OCULTA POR PADRÃO */}
             {mostrarFiltrosAvancados && (
               <div className={styles.filtersRow}>
                 <div style={{ minWidth: 180, marginRight: 8 }}>
                   <Select
                     placeholder="Filtrar por ANJO"
                     options={opcoesAnjo}
                     value={opcoesAnjo.find(opt => opt.value === filtrosFranqueadosTemp.anjo) || null}
                     onChange={(opt) => setFiltrosFranqueadosTemp(f => ({ ...f, anjo: opt?.value || "" }))}
                     isClearable
                     classNamePrefix="react-select"
                     styles={{
                       control: (base, state) => ({
                         ...base,
                         minHeight: 35,
                         maxHeight: 35,
                         width: 180,
                         borderRadius: 'var(--titan-radius-sm)',
                         fontSize: 'var(--titan-font-size-sm)',
                         outline: "none",
                         boxShadow: "none",
                         borderColor: "var(--titan-stroke)",
                         backgroundColor: "var(--titan-input-bg)",
                         ...(state.isFocused ? {
                           borderColor: "var(--titan-primary)",
                           boxShadow: "var(--titan-glow-primary)"
                         } : {}),
                       }),
                       placeholder: (base) => ({
                         ...base,
                         color: "var(--titan-text-low)",
                         opacity: 1,
                         fontWeight: "var(--titan-font-weight-normal)",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       singleValue: (base) => ({
                         ...base,
                         color: "var(--titan-text-high)",
                         fontWeight: "var(--titan-font-weight-medium)",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       option: (base, state) => ({
                         ...base,
                         backgroundColor: state.isSelected
                           ? "var(--titan-primary)"
                           : state.isFocused
                             ? "rgba(255, 255, 255, 0.02)"
                             : "var(--titan-base-00)",
                         color: state.isSelected ? "white" : "var(--titan-text-high)",
                         cursor: "pointer",
                         boxShadow: "none",
                         outline: "none",
                         border: "none",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       menu: (base) => ({
                         ...base,
                         zIndex: 9999,
                       }),
                       menuList: (base) => ({
                         ...base,
                         boxShadow: "none",
                         outline: "none",
                       }),
                     }}
                     menuPlacement="auto"
                   />
                 </div>

                 <div style={{ minWidth: 180, marginRight: 8 }}>
                   <Select
                     placeholder="Filtrar por Ciclo"
                     options={opcoesCiclo}
                     value={opcoesCiclo.find(opt => opt.value === filtrosFranqueadosTemp.ciclo) || null}
                     onChange={(opt) => setFiltrosFranqueadosTemp(f => ({ ...f, ciclo: opt?.value || "" }))}
                     isClearable
                     classNamePrefix="react-select"
                     styles={{
                       control: (base, state) => ({
                         ...base,
                         minHeight: 35,
                         maxHeight: 35,
                         width: 180,
                         borderRadius: 'var(--titan-radius-sm)',
                         fontSize: 'var(--titan-font-size-sm)',
                         outline: "none",
                         boxShadow: "none",
                         borderColor: "var(--titan-stroke)",
                         backgroundColor: "var(--titan-input-bg)",
                         ...(state.isFocused ? {
                           borderColor: "var(--titan-primary)",
                           boxShadow: "var(--titan-glow-primary)"
                         } : {}),
                       }),
                       placeholder: (base) => ({
                         ...base,
                         color: "var(--titan-text-low)",
                         opacity: 1,
                         fontWeight: "var(--titan-font-weight-normal)",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       singleValue: (base) => ({
                         ...base,
                         color: "var(--titan-text-high)",
                         fontWeight: "var(--titan-font-weight-medium)",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       option: (base, state) => ({
                         ...base,
                         backgroundColor: state.isSelected
                           ? "var(--titan-primary)"
                           : state.isFocused
                             ? "rgba(255, 255, 255, 0.02)"
                             : "var(--titan-base-00)",
                         color: state.isSelected ? "white" : "var(--titan-text-high)",
                         cursor: "pointer",
                         boxShadow: "none",
                         outline: "none",
                         border: "none",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       menu: (base) => ({
                         ...base,
                         zIndex: 9999,
                       }),
                       menuList: (base) => ({
                         ...base,
                         boxShadow: "none",
                         outline: "none",
                       }),
                     }}
                     menuPlacement="auto"
                   />
                 </div>

                 <div style={{ minWidth: 120, marginRight: 8 }}>
                   <Select
                     placeholder="Filtrar por UF"
                     options={opcoesUF}
                     value={opcoesUF.find(opt => opt.value === filtrosFranqueadosTemp.uf) || null}
                     onChange={(opt) => setFiltrosFranqueadosTemp(f => ({ ...f, uf: opt?.value || "" }))}
                     isClearable
                     classNamePrefix="react-select"
                     styles={{
                       control: (base, state) => ({
                         ...base,
                         minHeight: 35,
                         maxHeight: 35,
                         width: 120,
                         borderRadius: 'var(--titan-radius-sm)',
                         fontSize: 'var(--titan-font-size-sm)',
                         outline: "none",
                         boxShadow: "none",
                         borderColor: "var(--titan-stroke)",
                         backgroundColor: "var(--titan-input-bg)",
                         ...(state.isFocused ? {
                           borderColor: "var(--titan-primary)",
                           boxShadow: "var(--titan-glow-primary)"
                         } : {}),
                       }),
                       placeholder: (base) => ({
                         ...base,
                         color: "var(--titan-text-low)",
                         opacity: 1,
                         fontWeight: "var(--titan-font-weight-normal)",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       singleValue: (base) => ({
                         ...base,
                         color: "var(--titan-text-high)",
                         fontWeight: "var(--titan-font-weight-medium)",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       option: (base, state) => ({
                         ...base,
                         backgroundColor: state.isSelected
                           ? "var(--titan-primary)"
                           : state.isFocused
                             ? "rgba(255, 255, 255, 0.02)"
                             : "var(--titan-base-00)",
                         color: state.isSelected ? "white" : "var(--titan-text-high)",
                         cursor: "pointer",
                         boxShadow: "none",
                         outline: "none",
                         border: "none",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       menu: (base) => ({
                         ...base,
                         zIndex: 9999,
                       }),
                       menuList: (base) => ({
                         ...base,
                         boxShadow: "none",
                         outline: "none",
                       }),
                     }}
                     menuPlacement="auto"
                   />
                 </div>

                 <div style={{ minWidth: 180, marginRight: 8 }}>
                   <Select
                     placeholder="Filtrar por Cidade"
                     options={opcoesCidade}
                     value={opcoesCidade.find(opt => opt.value === filtrosFranqueadosTemp.cidade) || null}
                     onChange={(opt) => setFiltrosFranqueadosTemp(f => ({ ...f, cidade: opt?.value || "" }))}
                     isClearable
                     classNamePrefix="react-select"
                     styles={{
                       control: (base, state) => ({
                         ...base,
                         minHeight: 35,
                         maxHeight: 35,
                         width: 180,
                         borderRadius: 'var(--titan-radius-sm)',
                         fontSize: 'var(--titan-font-size-sm)',
                         outline: "none",
                         boxShadow: "none",
                         borderColor: "var(--titan-stroke)",
                         backgroundColor: "var(--titan-input-bg)",
                         ...(state.isFocused ? {
                           borderColor: "var(--titan-primary)",
                           boxShadow: "var(--titan-glow-primary)"
                         } : {}),
                       }),
                       placeholder: (base) => ({
                         ...base,
                         color: "var(--titan-text-low)",
                         opacity: 1,
                         fontWeight: "var(--titan-font-weight-normal)",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       singleValue: (base) => ({
                         ...base,
                         color: "var(--titan-text-high)",
                         fontWeight: "var(--titan-font-weight-medium)",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       option: (base, state) => ({
                         ...base,
                         backgroundColor: state.isSelected
                           ? "var(--titan-primary)"
                           : state.isFocused
                             ? "rgba(255, 255, 255, 0.02)"
                             : "var(--titan-base-00)",
                         color: state.isSelected ? "white" : "var(--titan-text-high)",
                         cursor: "pointer",
                         boxShadow: "none",
                         outline: "none",
                         border: "none",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       menu: (base) => ({
                         ...base,
                         zIndex: 9999,
                       }),
                       menuList: (base) => ({
                         ...base,
                         boxShadow: "none",
                         outline: "none",
                       }),
                     }}
                     menuPlacement="auto"
                   />
                 </div>

                 <div style={{ minWidth: 180, marginRight: 8 }}>
                   <Select
                     placeholder="Filtrar por Conselheiro"
                     options={opcoesConselheiro}
                     value={opcoesConselheiro.find(opt => opt.value === filtrosFranqueadosTemp.conselheiro) || null}
                     onChange={(opt) => setFiltrosFranqueadosTemp(f => ({ ...f, conselheiro: opt?.value || "" }))}
                     isClearable
                     classNamePrefix="react-select"
                     styles={{
                       control: (base, state) => ({
                         ...base,
                         minHeight: 35,
                         maxHeight: 35,
                         width: 180,
                         borderRadius: 'var(--titan-radius-sm)',
                         fontSize: 'var(--titan-font-size-sm)',
                         outline: "none",
                         boxShadow: "none",
                         borderColor: "var(--titan-stroke)",
                         backgroundColor: "var(--titan-input-bg)",
                         ...(state.isFocused ? {
                           borderColor: "var(--titan-primary)",
                           boxShadow: "var(--titan-glow-primary)"
                         } : {}),
                       }),
                       placeholder: (base) => ({
                         ...base,
                         color: "var(--titan-text-low)",
                         opacity: 1,
                         fontWeight: "var(--titan-font-weight-normal)",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       singleValue: (base) => ({
                         ...base,
                         color: "var(--titan-text-high)",
                         fontWeight: "var(--titan-font-weight-medium)",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       option: (base, state) => ({
                         ...base,
                         backgroundColor: state.isSelected
                           ? "var(--titan-primary)"
                           : state.isFocused
                             ? "rgba(255, 255, 255, 0.02)"
                             : "var(--titan-base-00)",
                         color: state.isSelected ? "white" : "var(--titan-text-high)",
                         cursor: "pointer",
                         boxShadow: "none",
                         outline: "none",
                         border: "none",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       menu: (base) => ({
                         ...base,
                         zIndex: 9999,
                       }),
                       menuList: (base) => ({
                         ...base,
                         boxShadow: "none",
                         outline: "none",
                       }),
                     }}
                     menuPlacement="auto"
                   />
                 </div>

                 <div style={{ minWidth: 180, marginRight: 8 }}>
                   <Select
                     placeholder="Filtrar por Status"
                     options={opcoesStatus}
                     value={opcoesStatus.find(opt => opt.value === filtrosFranqueadosTemp.status) || null}
                     onChange={(opt) => setFiltrosFranqueadosTemp(f => ({ ...f, status: opt?.value || "" }))}
                     isClearable
                     classNamePrefix="react-select"
                     styles={{
                       control: (base, state) => ({
                         ...base,
                         minHeight: 35,
                         maxHeight: 35,
                         width: 180,
                         borderRadius: 'var(--titan-radius-sm)',
                         fontSize: 'var(--titan-font-size-sm)',
                         outline: "none",
                         boxShadow: "none",
                         borderColor: "var(--titan-stroke)",
                         backgroundColor: "var(--titan-input-bg)",
                         ...(state.isFocused ? {
                           borderColor: "var(--titan-primary)",
                           boxShadow: "var(--titan-glow-primary)"
                         } : {}),
                       }),
                       placeholder: (base) => ({
                         ...base,
                         color: "var(--titan-text-low)",
                         opacity: 1,
                         fontWeight: "var(--titan-font-weight-normal)",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       singleValue: (base) => ({
                         ...base,
                         color: "var(--titan-text-high)",
                         fontWeight: "var(--titan-font-weight-medium)",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       option: (base, state) => ({
                         ...base,
                         backgroundColor: state.isSelected
                           ? "var(--titan-primary)"
                           : state.isFocused
                             ? "rgba(255, 255, 255, 0.02)"
                             : "var(--titan-base-00)",
                         color: state.isSelected ? "white" : "var(--titan-text-high)",
                         cursor: "pointer",
                         boxShadow: "none",
                         outline: "none",
                         border: "none",
                         fontSize: "var(--titan-font-size-sm)",
                       }),
                       menu: (base) => ({
                         ...base,
                         zIndex: 9999,
                       }),
                       menuList: (base) => ({
                         ...base,
                         boxShadow: "none",
                         outline: "none",
                       }),
                     }}
                     menuPlacement="auto"
                   />
                 </div>

                 <button onClick={aplicarFiltrosFranqueados} className={styles.botaoAplicar}>
                   Aplicar Filtros
                 </button>
                 <button onClick={limparFiltrosFranqueados} className={styles.botaoLimpar}>
                   Limpar Tudo
                 </button>
               </div>
             )}

                           <div className={styles.buttonsRow}>
                {hasPermissao("anjos", "criar") && (
                  <button
                    className={styles.botaoClientes}
                    onClick={abrirModalNovoFranqueado}
                  >
                    + Franqueado
                  </button>
                )}
                <input
                  type="text"
                  placeholder="Pesquisar franqueado..."
                  value={pesquisaFranqueado}
                  onChange={e => setPesquisaFranqueado(e.target.value)}
                  className={styles.filtroInput}
                  style={{ width: 200, marginLeft: 8 }}
                />
                
                {/* Botão para mostrar/ocultar filtros avançados */}
                <button
                  onClick={() => setMostrarFiltrosAvancados(!mostrarFiltrosAvancados)}
                  className={styles.botaoClientes}
                  style={{ marginLeft: 8 }}
                >
                  {mostrarFiltrosAvancados ? "Ocultar Filtros Avançados" : "Abrir Filtros Avançados"}
                </button>

                {/* Botão para enviar pesquisa de satisfação */}
                {hasPermissao("anjos", "visualizar") && (
                  <button
                    onClick={() => setMostrarModalPesquisa(true)}
                    className={styles.botaoClientes}
                    style={{ marginLeft: 8, backgroundColor: '#10b981', borderColor: '#10b981' }}
                  >
                    <Send size={16} style={{ marginRight: 6 }} />
                    Enviar Pesquisa
                  </button>
                )}
                
                {/* Indicador de resultados */}
                <div style={{ 
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--titan-text-low)',
                  fontSize: 'var(--titan-font-size-sm)'
                }}>
                  <span>
                    {loadingFranqueados 
                      ? "Carregando..." 
                      : `${totalFranqueados} franqueado${totalFranqueados !== 1 ? 's' : ''} encontrado${totalFranqueados !== 1 ? 's' : ''}`
                    }
                  </span>
                  {(filtrosFranqueados.anjo || filtrosFranqueados.ciclo || filtrosFranqueados.uf || filtrosFranqueados.cidade || filtrosFranqueados.conselheiro || filtrosFranqueados.status) && (
                    <span style={{ color: 'var(--titan-primary)' }}>
                      (com filtros aplicados)
                    </span>
                  )}
                </div>
              </div>

            {loadingFranqueados ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <Loader2
                  size={32}
                  style={{
                    color: '#1976D2',
                    animation: 'spin 1s linear infinite'
                  }}
                />
                <span style={{ color: '#6B7280', fontSize: '14px' }}>Carregando franqueados...</span>
              </div>
            ) : (
              <table className={styles.table} style={{ tableLayout: 'fixed', width: '100%' }}>
                                <thead>
                  <tr>
                    <th className={styles.th} style={{ width: '18%' }}>Unidade</th>
                    <th className={styles.th} style={{ width: '20%' }}>Nome</th>
                    <th className={styles.th} style={{ width: '15%' }}>CNPJ/CPF</th>
                    <th className={styles.th} style={{ width: '8%' }}>UF</th>
                    <th className={styles.th} style={{ width: '15%' }}>Cidade</th>
                    <th className={styles.th} style={{ width: '10%' }}>Status</th>
                    <th className={styles.th} style={{ width: '10%' }}>Telefone</th>
                    <th className={styles.th} style={{ width: '4%' }}>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {franqueados.map((f, idx) => (
                    <tr key={f.id}>
                      <td 
                        className={`${styles.td} ${styles.linkTd}`} 
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} 
                        title={f.unidade || "-"}
                        onClick={() => router.push(`/dashboard/franqueado/${f.id}`)}
                      >
                        <span className={styles.cellHighlight}>
                          {f.unidade || "-"}
                        </span>
                      </td>
                      <td className={styles.td} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.nome || "-"}>{f.nome || "-"}</td>
                      <td className={styles.td} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={formatarCnpjCpf(f.cnpj_cpf)}>{formatarCnpjCpf(f.cnpj_cpf)}</td>
                      <td className={styles.td}>{f.uf || "-"}</td>
                      <td className={styles.td} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.cidade || "-"}>{f.cidade || "-"}</td>
                      <td className={styles.td}>
                        <span className={`${styles.status} ${f.situacao === 'ativo' ? styles.statusAtivo :
                            f.situacao === 'distrato' ? styles.statusDistrato :
                              f.situacao === 'congelado' ? styles.statusCongelado :
                                styles.statusAtivo
                          }`}>
                          {f.situacao || "ativo"}
                        </span>
                      </td>
                      <td className={styles.td} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.telefone_principal || "-"}>{f.telefone_principal || "-"}</td>
                      <td className={styles.td} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.email || "-"}>{f.email || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* PAGINAÇÃO FRANQUEADOS */}
            <div className={styles.pagination}>
              <span>
                Mostrando {(paginaFranqueados - 1) * limiteFranqueadosPorPagina + 1}
                {" - "}
                {Math.min(paginaFranqueados * limiteFranqueadosPorPagina, totalFranqueados)} de {totalFranqueados}
              </span>
              <div className={styles.paginationButtons}>
                <select
                  value={limiteFranqueadosPorPagina}
                  onChange={(e) => setLimiteFranqueadosPorPagina(Number(e.target.value))}
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
                  onClick={() => setPaginaFranqueados(1)}
                  disabled={paginaFranqueados === 1}
                  aria-label="Primeira página"
                >
                  {"<<"}
                </button>
                <button
                  className={styles.paginationArrow}
                  onClick={() => setPaginaFranqueados((p) => Math.max(1, p - 1))}
                  disabled={paginaFranqueados === 1}
                  aria-label="Página anterior"
                >
                  {"<"}
                </button>
                {Array.from({ length: paginaFimFranqueados - paginaInicioFranqueados + 1 }, (_, i) => paginaInicioFranqueados + i).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPaginaFranqueados(p)}
                    className={p === paginaFranqueados ? styles.paginationButtonActive : styles.paginationArrow}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className={styles.paginationArrow}
                  onClick={() => setPaginaFranqueados((p) => Math.min(totalPaginasFranqueados, p + 1))}
                  disabled={paginaFranqueados === totalPaginasFranqueados}
                  aria-label="Próxima página"
                >
                  {">"}
                </button>
                <button
                  className={styles.paginationArrow}
                  onClick={() => setPaginaFranqueados(totalPaginasFranqueados)}
                  disabled={paginaFranqueados === totalPaginasFranqueados}
                  aria-label="Última página"
                >
                  {">>"}
                </button>
              </div>
            </div>
          </>
        ) : null}

        {/* Modal de NovoClienteModal só para aba de clientes */}
        {abaAtiva === "clientes" && mostrarModal && (
          <NovoClienteModal
            onClose={() => setMostrarModal(false)}
            onSuccess={() => {
              setMostrarModal(false);
              buscarClientes();
            }}
          />
        )}

        {/* Modal de Detalhes do Franqueado */}
        {/* Modal de detalhes de franqueado indisponível: componente não encontrado */}

        {/* Modal de Novo Franqueado */}
        {/* Modal de novo franqueado indisponível: componente não encontrado */}

        {/* Modal para enviar pesquisa de satisfação */}
        <EnviarPesquisaFranqueadosModal
          isOpen={mostrarModalPesquisa}
          onClose={() => setMostrarModalPesquisa(false)}
          empresaId={empresaId}
        />

        {/* Modal de ajuda para importação de clientes */}
        <ClientesImportTemplateModal
          open={mostrarImportHelp}
          onClose={() => setMostrarImportHelp(false)}
          onSelectFile={() => {
            setMostrarImportHelp(false);
            if (inputFileRef.current) {
              inputFileRef.current.value = "";
              inputFileRef.current.click();
            }
          }}
        />

      </div>
    </>
  );
}
