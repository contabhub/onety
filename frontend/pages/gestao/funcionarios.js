import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import styles from "../../styles/gestao/Funcionarios.module.css";
import { useRouter } from "next/router";
import Select from "react-select";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

const safeParseJSON = (value) => {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("[Funcionarios] Falha ao fazer parse do JSON armazenado:", error);
    return null;
  }
};

const getFirstAvailable = (key) => {
  if (typeof window === "undefined") return null;

  const storages = [sessionStorage, localStorage];
  for (const storage of storages) {
    try {
      const value = storage?.getItem?.(key);
      if (value) return value;
    } catch (error) {
      console.warn(`[Funcionarios] Erro ao ler chave '${key}' do storage:`, error);
    }
  }
  return null;
};

const extractFromUserData = (extractor) => {
  if (typeof window === "undefined") return null;

  const candidates = ["userData", "usuario"];
  for (const key of candidates) {
    const raw = getFirstAvailable(key);
    if (!raw) continue;

    const parsed = safeParseJSON(raw);
    if (!parsed || typeof parsed !== "object") continue;

    const result = extractor(parsed);
    if (result) return result;
  }

  return null;
};

const getToken = () => {
  if (typeof window === "undefined") return "";

  const directToken = getFirstAvailable("token");
  if (directToken) return directToken;

  const tokenFromUserData = extractFromUserData((data) =>
    data?.token ||
    data?.accessToken ||
    data?.jwt ||
    data?.jwtToken ||
    data?.authToken ||
    data?.data?.token ||
    data?.data?.accessToken
  );

  return tokenFromUserData ? String(tokenFromUserData) : "";
};

const getEmpresaId = () => {
  if (typeof window === "undefined") return "";

  const directEmpresaId = getFirstAvailable("empresaId");
  if (directEmpresaId) return directEmpresaId;

  const empresaIdFromUserData = extractFromUserData((data) =>
    data?.EmpresaId ||
    data?.empresaId ||
    data?.empresa?.id ||
    data?.empresaSelecionada?.id ||
    data?.empresaAtiva?.id
  );

  return empresaIdFromUserData ? String(empresaIdFromUserData) : "";
};

const normalizeUrl = (url) => {
  if (!BASE_URL) return url;
  return `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const buildUrl = (url, params) => {
  const normalized = normalizeUrl(url);
  if (!params || typeof params !== "object" || Object.keys(params).length === 0) {
    return normalized;
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null) {
          searchParams.append(key, item);
        }
      });
    } else {
      searchParams.append(key, value);
    }
  });

  const queryString = searchParams.toString();
  if (!queryString) return normalized;
  return normalized.includes("?") ? `${normalized}&${queryString}` : `${normalized}?${queryString}`;
};

const parseResponseBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const normalizeUsuariosResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const { usuarios, data, items, results, lista, list } = payload;
    if (Array.isArray(usuarios)) return usuarios;
    if (Array.isArray(data)) return data;
    if (Array.isArray(items)) return items;
    if (Array.isArray(results)) return results;
    if (Array.isArray(lista)) return lista;
    if (Array.isArray(list)) return list;
  }
  return [];
};

const request = async (method, url, { headers = {}, params, body } = {}) => {
  const finalUrl = buildUrl(url, params);
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const finalHeaders = { ...headers };

  if (!isFormData && body !== undefined && body !== null && typeof body !== "string") {
    finalHeaders["Content-Type"] = finalHeaders["Content-Type"] || "application/json";
  }

  Object.keys(finalHeaders).forEach((key) => {
    if (finalHeaders[key] === undefined) {
      delete finalHeaders[key];
    }
  });

  const fetchOptions = {
    method,
    headers: finalHeaders,
  };

  if (body !== undefined && body !== null) {
    fetchOptions.body =
      isFormData || typeof body === "string" || body instanceof Blob
        ? body
        : JSON.stringify(body);
  }

  const response = await fetch(finalUrl, fetchOptions);
  const data = await parseResponseBody(response);

  if (!response.ok) {
    const error = new Error(response.statusText || "Request failed");
    error.response = {
      status: response.status,
      data,
      statusText: response.statusText,
    };
    throw error;
  }

  return {
    data,
    status: response.status,
  };
};

const api = {
  get: (url, { headers = {}, params } = {}) => request("GET", url, { headers, params }),
  post: (url, body, { headers = {}, params } = {}) =>
    request("POST", url, { headers, params, body }),
  put: (url, body, { headers = {}, params } = {}) =>
    request("PUT", url, { headers, params, body }),
  patch: (url, body, { headers = {}, params } = {}) =>
    request("PATCH", url, { headers, params, body }),
  delete: (url, { headers = {}, params, body } = {}) =>
    request("DELETE", url, { headers, params, body }),
};

const IconEye = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 1200 1200" fill="#00050b">
    <path d="M779.843 599.925c0 95.331-80.664 172.612-180.169 172.612c-99.504 0-180.168-77.281-180.168-172.612c0-95.332 80.664-172.612 180.168-172.612c99.505-.001 180.169 77.281 180.169 172.612M600 240.521c-103.025.457-209.814 25.538-310.904 73.557C214.038 351.2 140.89 403.574 77.394 468.219C46.208 501.218 6.431 549 0 599.981c.76 44.161 48.13 98.669 77.394 131.763c59.543 62.106 130.786 113.018 211.702 154.179C383.367 931.674 487.712 958.015 600 959.48c103.123-.464 209.888-25.834 310.866-73.557c75.058-37.122 148.243-89.534 211.74-154.179c31.185-32.999 70.962-80.782 77.394-131.763c-.76-44.161-48.13-98.671-77.394-131.764c-59.543-62.106-130.824-112.979-211.74-154.141C816.644 268.36 712.042 242.2 600 240.521m-.076 89.248c156.119 0 282.675 120.994 282.675 270.251S756.043 870.27 599.924 870.27S317.249 749.275 317.249 600.02c0-149.257 126.556-270.251 282.675-270.251" />
  </svg>
);

const IconEyeOff = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#00050b" viewBox="0 0 256 256">
    <path d="M228 175a8 8 0 0 1-10.92-3l-19-33.2A123.2 123.2 0 0 1 162 155.46l5.87 35.22a8 8 0 0 1-6.58 9.21a8.4 8.4 0 0 1-1.29.11a8 8 0 0 1-7.88-6.69l-5.77-34.58a133 133 0 0 1-36.68 0l-5.77 34.58A8 8 0 0 1 96 200a8.4 8.4 0 0 1-1.32-.11a8 8 0 0 1-6.58-9.21l5.9-35.22a123.2 123.2 0 0 1-36.06-16.69L39 172a8 8 0 1 1-13.94-8l20-35a153.5 153.5 0 0 1-19.3-20a8 8 0 1 1 12.46-10c16.6 20.54 45.64 45 89.78 45s73.18-24.49 89.78-45a8 8 0 1 1 12.44 10a153.5 153.5 0 0 1-19.3 20l20 35a8 8 0 0 1-2.92 11" />
  </svg>
);

function PasswordInput({ value, onChange, placeholder }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={styles.passwordInputWrapper}>
      <input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={styles.inputFull}
      />
      <button
        type="button"
        className={styles.passwordToggleButton}
        onClick={() => setShowPassword((v) => !v)}
        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
      >
        {showPassword ? <IconEye /> : <IconEyeOff />}
      </button>
    </div>
  );
}

PasswordInput.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

// Ícones para cargos/franqueados
const IconFranqueado = () => (
  <span style={{ color: 'var(--titan-primary)', fontWeight: 'bold', fontSize: 18, marginRight: 4 }}></span>
);
const IconCargo = () => (
  <span style={{ color: 'var(--titan-secondary)', fontWeight: 'bold', fontSize: 18, marginRight: 4 }}></span>
);
const IconAdmin = () => (
  <span style={{ color: 'var(--titan-success)', fontWeight: 'bold', fontSize: 18, marginRight: 4 }}></span>
);

export default function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [supervisores, setSupervisores] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalFechando, setModalFechando] = useState(false);
  const [loading, setLoading] = useState(true);

  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [cargoId, setCargoId] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [departamentoId, setDepartamentoId] = useState("");

  const [erroSenha, setErroSenha] = useState("");
  const [erroDepartamento, setErroDepartamento] = useState("");
  const [erroGeral, setErroGeral] = useState("");

  const [empresaId, setEmpresaId] = useState("");
  const [headers, setHeaders] = useState({ Authorization: "" });

  // ✅ Novos estados para paginação
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [pagina, setPagina] = useState(1);
  
  // ✅ Estados para busca e filtros
  const [busca, setBusca] = useState("");
  const [funcionariosFiltrados, setFuncionariosFiltrados] = useState([]);
  
  // ✅ Estados para abas
  const [abaAtiva, setAbaAtiva] = useState("funcionarios");
  
  // ✅ Estados para transferência
  const [usuariosSelecionados, setUsuariosSelecionados] = useState([]);
  const [clientesVinculados, setClientesVinculados] = useState([]);
  const [mostrarClientesVinculados, setMostrarClientesVinculados] = useState(false);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [clientesSelecionados, setClientesSelecionados] = useState([]);
  // ✅ Estados para transferência direta entre usuários (footer da coluna)
  const [transferDestinoPorUsuario, setTransferDestinoPorUsuario] = useState({});
  const [confirmTransferModal, setConfirmTransferModal] = useState({ open: false });
  // ✅ Estado para loading da transferência
  const [transferLoading, setTransferLoading] = useState({});
  
  // ✅ Novos estados para filtros da aba Transferência
  const [buscaTransferencia, setBuscaTransferencia] = useState("");
  const [departamentoFiltro, setDepartamentoFiltro] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState("");
  const [funcionariosFiltradosTransferencia, setFuncionariosFiltradosTransferencia] = useState([]);

  // ✅ Estado para verificar se é super admin
  const [isSuperAdmin] = useState(false);

  // ✅ Estado para detecção de tema
  const [isLight, setIsLight] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedEmpresaId = getEmpresaId();
      const token = getToken();
      if (storedEmpresaId && token) {
        setEmpresaId(storedEmpresaId);
        setHeaders({ Authorization: `Bearer ${token}` });
      }
    }
  }, []);

  // ✅ Detecção de tema
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsLight(theme === 'light');
    };

    checkTheme();
    window.addEventListener('titan-theme-change', checkTheme);
    return () => window.removeEventListener('titan-theme-change', checkTheme);
  }, []);

  // ✅ Reset da página quando mudar filtros
  useEffect(() => {
    setPagina(1);
  }, [itensPorPagina]);

  // ✅ Reset da página quando busca mudar
  useEffect(() => {
    setPagina(1);
  }, [busca]);

  // ✅ Filtrar funcionários quando busca ou lista mudar
  useEffect(() => {
    if (!busca.trim()) {
      setFuncionariosFiltrados(funcionarios);
    } else {
      const termoBusca = busca.toLowerCase().trim();
      const filtrados = funcionarios.filter(f => 
        f.nome?.toLowerCase().includes(termoBusca) ||
        f.email?.toLowerCase().includes(termoBusca)
      );
      setFuncionariosFiltrados(filtrados);
    }
  }, [funcionarios, busca]);

  // ✅ Filtrar funcionários para aba de transferência
  useEffect(() => {
    let funcionariosFiltrados = funcionarios;
    
    // Filtro por departamento
    if (departamentoFiltro) {
      funcionariosFiltrados = funcionariosFiltrados.filter(f => 
        f.departamentoNome === departamentoFiltro
      );
    }
    
    // Filtro por busca (nome)
    if (buscaTransferencia.trim()) {
      const termoBusca = buscaTransferencia.toLowerCase().trim();
      funcionariosFiltrados = funcionariosFiltrados.filter(f => 
        f.nome?.toLowerCase().includes(termoBusca)
      );
    }
    
    console.log('Filtros aplicados:', { departamentoFiltro, buscaTransferencia, total: funcionarios.length, filtrados: funcionariosFiltrados.length });
    setFuncionariosFiltradosTransferencia(funcionariosFiltrados);
  }, [funcionarios, departamentoFiltro, buscaTransferencia]);

  // ✅ Inicializar funcionários filtrados quando funcionários forem carregados
  useEffect(() => {
    setFuncionariosFiltradosTransferencia(funcionarios);
  }, [funcionarios]);

  // ✅ Reagir às mudanças no filtro de grupo
  useEffect(() => {
    if (usuariosSelecionados.length > 0) {
      buscarClientesVinculadosAutomatico(usuariosSelecionados, true);
    }
  }, [grupoFiltro]);


  useEffect(() => {
    if (modalAberto && empresaId && headers.Authorization) {
      api.get(`/gestao/cargos/empresa/${empresaId}`, { headers })
        .then(res => setCargos(res.data))
        .catch((error) => {
          console.warn("[Funcionarios] Falha ao carregar cargos:", error?.response || error);
          setCargos([]);
        });
      api.get(`/gestao/usuarios/empresa/${empresaId}`, { headers })
        .then(res => setSupervisores(res.data))
        .catch(() => setSupervisores([]));
    }
  }, [modalAberto, empresaId, headers]);

  
  // Fetch funcionarios
  const fetchFuncionarios = async () => {
    setLoading(true); // ⬅️ Começa carregamento
    try {
      const res = await api.get("/usuarios", { headers });
      const lista = normalizeUsuariosResponse(res.data);
      setFuncionarios(lista);
    } catch (error) {
      console.error("Erro ao buscar funcionários:", error);
    } finally {
      setLoading(false); // ⬅️ Termina carregamento
    }
  };


  // Fetch departamentos
  const fetchDepartamentos = async () => {
    try {
      const res = await api.get(`/gestao/departamentos/${empresaId}`, { headers });
      setDepartamentos(res.data);
    } catch (error) {
      console.error("Erro ao buscar departamentos:", error);
    }
  };

  // Fetch grupos
  const fetchGrupos = async () => {
    try {
      const res = await api.get(`/gestao/clientes/grupos/todos?empresaId=${empresaId}`, { headers });
      setGrupos(res.data.grupos || []);
    } catch (error) {
      console.error("Erro ao buscar grupos:", error);
    }
  };

  const removerFuncionario = async (usuarioId) => {
    if (!confirm("Tem certeza que deseja remover este funcionário da empresa?")) return;

    try {
      const { data: relacoes } = await api.get(`/gestao/departamentos/relacao-empresas/usuario/${usuarioId}`, { headers });
      const relacao = relacoes.find((r) => r.empresaId == empresaId);

      if (!relacao) return alert("Relação não encontrada.");

      await api.delete(`/gestao/departamentos/relacao-empresas/${relacao.id}`, { headers });
      fetchFuncionarios();
    } catch (error) {
      console.error("Erro ao remover funcionário:", error);
      alert("Erro ao remover funcionário.");
    }
  };

  //Atualizar departamentos do funcionário. 
  const atualizarDepartamento = async (usuarioId, nomeDepto) => {
    try {
      // Pega o departamentoId correspondente
      const deptoSelecionado = departamentos.find((d) => d.nome === nomeDepto);
      const departamentoId = deptoSelecionado?.id || null;

      // Busca a relação do usuário com a empresa
      const { data: relacoes } = await api.get(`/gestao/departamentos/relacao-empresas/usuario/${usuarioId}`, { headers });
      const relacao = relacoes.find((r) => r.empresaId == empresaId);

      if (!relacao) {
        alert("Relação empresa/usuário não encontrada.");
        return;
      }

      await api.patch(`/gestao/departamentos/relacao-empresas/${relacao.id}`, { departamentoId }, { headers });
      fetchFuncionarios();
    } catch (error) {
      console.error("Erro ao atualizar departamento:", error);
      alert("Erro ao atualizar departamento.");
    }
  };

  useEffect(() => {
    if (empresaId && headers.Authorization) {
      fetchFuncionarios();
      fetchDepartamentos();
      fetchGrupos();
    }
  }, [empresaId, headers]);

  // ✅ Busca automática em tempo real (otimizada para velocidade)
  const buscarClientesVinculadosAutomatico = async (usuarioIds, forcarAtualizacao = false) => {
    if (usuarioIds.length === 0) return;
    
    setLoadingClientes(true);
    try {
      const token = getToken();
      const empresaId = getEmpresaId();
      
      // ✅ Parâmetros otimizados para cache busting
      const params = new URLSearchParams({
        usuarioIds: usuarioIds.join(","),
        empresaId: empresaId || "",
        ...(grupoFiltro && { grupoId: grupoFiltro }),
        ...(forcarAtualizacao && { _t: Date.now().toString() })
      });
      
      // ✅ Buscar clientes vinculados aos usuários selecionados
      const response = await api.get("/gestao/clientes/usuarios-vinculados", {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // ✅ Processamento otimizado dos dados
      const clientesComDetalhes = response.data.clientes || [];
      
      console.log('Clientes retornados pela API:', clientesComDetalhes);
      console.log('Usuários selecionados:', usuarioIds);
      console.log('Grupo filtro:', grupoFiltro);
      
      // ✅ Mapeamento otimizado sem loops desnecessários
      const clientesComObrigacoes = clientesComDetalhes.map((cliente) => ({
        ...cliente,
        obrigacoes: [], // ✅ Array vazio para performance
        usuarioResponsavel: cliente.responsavelNome || 'Usuário não encontrado'
      }));
      
      // ✅ Atualizar estado de uma vez só
      setClientesVinculados(clientesComObrigacoes);
      setMostrarClientesVinculados(true);
    } catch (error) {
      console.error("Erro ao buscar clientes vinculados:", error);
      toast.error("Erro ao carregar clientes vinculados.", { theme: "dark" });
    } finally {
      setLoadingClientes(false);
    }
  };

  // ✅ Função unificada para limpar tudo
  const limparFiltrosTransferencia = () => {
    setDepartamentoFiltro("");
    setBuscaTransferencia("");
    setGrupoFiltro("");
    setUsuariosSelecionados([]);
    setClientesVinculados([]);
    setMostrarClientesVinculados(false);
    setFuncionariosFiltradosTransferencia(funcionarios);
  };

  // ✅ Função para transferir responsabilidade dos clientes
  const transferirResponsabilidade = async (origemId, destinoId) => {
    try {
      // ✅ Ativar loading para este usuário específico
      setTransferLoading(prev => ({ ...prev, [origemId]: true }));
      
      // ✅ Buscar clientes selecionados do usuário de origem
      const clientesDoUsuario = clientesVinculados.filter(cliente => 
        funcionarios.find(f => f.id === origemId)?.nome === cliente.usuarioResponsavel
      );
      
      // ✅ Filtrar apenas os clientes que estão selecionados
      const clientesParaTransferir = clientesDoUsuario.filter(cliente => 
        clientesSelecionados.includes(cliente.id)
      );

      if (clientesParaTransferir.length === 0) {
        toast.error("Nenhum cliente selecionado para transferir.");
        setTransferLoading(prev => ({ ...prev, [origemId]: false }));
        return;
      }

      // ✅ Preparar dados para a API
      const dadosTransferencia = {
        clienteIds: clientesParaTransferir.map(c => c.id),
        novoResponsavelId: destinoId,
        empresaId: empresaId,
        usuarioAnteriorId: origemId // ✅ Adicionar ID do usuário anterior
      };

      console.log('Dados da transferência:', dadosTransferencia);

      // ✅ Mostrar toast de loading
      const loadingToastId = toast.loading(`Transferindo responsabilidade de ${clientesParaTransferir.length} cliente(s)...`, {
        position: "top-right",
        autoClose: false,
        closeButton: false,
        draggable: false,
        closeOnClick: false,
        pauseOnHover: false,
        theme: "dark"
      });

      // ✅ Chamar API para transferir responsabilidade
      const response = await api.put("/gestao/clientes/transferir-responsabilidade", dadosTransferencia, { headers });
      
      if (response.status === 200) {
        // ✅ Atualizar toast para sucesso
        toast.update(loadingToastId, {
          render: `Responsabilidade de ${clientesParaTransferir.length} cliente(s) transferida com sucesso!`,
          type: "success",
          isLoading: false,
          autoClose: 3000, // ✅ Reduzido para 3 segundos
          closeButton: true,
          draggable: true,
          closeOnClick: true,
          pauseOnHover: true,
          theme: "dark"
        });
        
        // ✅ Limpar seleções imediatamente
        setClientesSelecionados([]);
        setTransferDestinoPorUsuario(prev => ({ ...prev, [origemId]: null }));
        
        // ✅ Recarregar dados em paralelo para máxima velocidade
        if (usuariosSelecionados.length > 0) {
          // ✅ Não aguardar - executar em background
          buscarClientesVinculadosAutomatico(usuariosSelecionados, true);
        }
      }
    } catch (error) {
      console.error("Erro ao transferir responsabilidade:", error);
      toast.error("Erro ao transferir responsabilidade. Tente novamente.", {
        theme: "dark"
      });
    } finally {
      // ✅ Sempre desativar loading
      setTransferLoading(prev => ({ ...prev, [origemId]: false }));
    }
  };

  // ✅ Cálculos de paginação
  const totalPaginas = Math.max(1, Math.ceil(funcionariosFiltrados.length / itensPorPagina));
  const paginaInicio = Math.max(1, pagina - 2);
  const paginaFim = Math.min(totalPaginas, paginaInicio + 4);
  const funcionariosPaginados = funcionariosFiltrados.slice(
    (pagina - 1) * itensPorPagina,
    pagina * itensPorPagina
  );

  // Abrir modal novo funcionario
  const abrirModal = () => {
    setNome("");
    setApelido("");
    setNascimento("");
    setSupervisorId("");
    setCargoId("");
    setEmail("");
    setSenha("");
    setConfirmarSenha("");
    setDepartamentoId("");
    setErroSenha("");
    setErroDepartamento("");
    setErroGeral("");
    setModalAberto(true);
  };

  // Fechar modal com animação
  const fecharModal = () => {
    setModalFechando(true);
    setTimeout(() => {
      setModalAberto(false);
      setModalFechando(false);
    }, 300);
  };

  // Gerar senha aleatória
  const gerarSenhaAleatoria = () => {
    const novaSenha = Math.random().toString(36).slice(-10);
    setSenha(novaSenha);
    setConfirmarSenha(novaSenha);
  };

  // Criar funcionário
  const criarFuncionario = async () => {
    setErroSenha("");
    setErroDepartamento("");
    setErroGeral("");

    if (senha !== confirmarSenha) {
      setErroSenha("As senhas não coincidem.");
      return;
    }
    if (!departamentoId) {
      setErroDepartamento("Departamento não selecionado.");
      return;
    }
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      setErroGeral("Preencha todos os campos obrigatórios.");
      return;
    }

    let cargoParaSalvar = cargoId;
    if (!cargoParaSalvar && cargos.length > 0) {
      // Busca o cargo Administrador
      const adminCargo = cargos.find((c) => c.nome && c.nome.toLowerCase().includes("admin"));
      if (adminCargo) cargoParaSalvar = adminCargo.id;
    }

    try {
      await api.post(
        "/usuarios",
        {
          nome,
          email,
          senha,
          departamentoId,
          cargoId: cargoParaSalvar || null,
          apelido,
          nascimento,
          supervisorId: supervisorId || null,
        },
        { headers }
      );
      fetchFuncionarios();
      fecharModal();
      toast.success("Funcionário cadastrado com sucesso!", { theme: "dark" });
    } catch (error) {
      console.error("Erro ao cadastrar funcionário:", error);
      
      // ✅ Tratamento específico para erro 400 (usuário já cadastrado)
      if (error.response?.status === 400) {
        toast.error(
          "Este usuário já está cadastrado no sistema. Entre em contato com o administrador para vincular o usuário à empresa.",
          { 
            theme: "dark",
            autoClose: 8000, // ✅ Toast mais longo para mensagem importante
            position: "top-center" // ✅ Posição central para maior visibilidade
          }
        );
        setErroGeral("Usuário já cadastrado no sistema. Entre em contato com o administrador.");
      } else {
        // ✅ Outros tipos de erro
        toast.error("Erro ao cadastrar funcionário. Tente novamente.", { theme: "dark" });
        setErroGeral("Erro ao cadastrar funcionário.");
      }
    }
  };

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.container}>
        <div 
          style={{
            overflow: "hidden",
            maxWidth: "100%",
            width: "100%",
          }}
        >
        {/* Header com título e botão lado a lado - APENAS para aba Funcionários */}
        {abaAtiva === "funcionarios" && (
        <div className={styles.header}>
          <h1 className={styles.title}>Gestão de Usuários</h1>
          {/* ✅ Botão só aparece para super admin */}
          {isSuperAdmin && (
            <button className={styles.buttonNovo} onClick={abrirModal}>
              + Novo Funcionário
            </button>
          )}
        </div>
        )}

        {/* ✅ Campo de Busca - APENAS para aba Funcionários */}
        {abaAtiva === "funcionarios" && (
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        )}

        {/* ✅ Sistema de Abas */}
        <div className={styles.tabsContainer}>
          <div
            className={`${styles.tab} ${abaAtiva === "funcionarios" ? styles.activeTab : ""}`}
            onClick={() => setAbaAtiva("funcionarios")}
          >
            Funcionários
          </div>
          <div
            className={`${styles.tab} ${abaAtiva === "transferencia" ? styles.activeTab : ""}`}
            onClick={() => setAbaAtiva("transferencia")}
          >
            Transferência
          </div>
        </div>

        {/* ✅ Conteúdo das Abas */}
        {abaAtiva === "funcionarios" ? (
          <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>No</th>
                <th className={styles.th}>Apelido</th>
                <th className={styles.th}>Nome</th>
                <th className={styles.th}>Email</th>
                <th className={styles.th}>Cargo</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr style={{ backgroundColor: "transparent" }}>
                  <td colSpan={10} style={{ textAlign: "center", padding: "40px 0", backgroundColor: "var(--titan-card-bg)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <svg
                        style={{ width: "36px", height: "36px", marginBottom: 12, animation: "spin 1s linear infinite" }}
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle cx="12" cy="12" r="10" stroke="var(--titan-primary)" strokeWidth="4" opacity="0.25" />
                        <path d="M22 12a10 10 0 0 1-10 10" stroke="var(--titan-primary)" strokeWidth="4" strokeLinecap="round" />
                      </svg>
                      <div style={{ fontSize: "15px", color: "var(--titan-text-med)" }}>
                        Carregando funcionários...
                      </div>
                      <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
                    </div>
                  </td>
                </tr>
              ) : (
                funcionariosPaginados.map((f, idx) => (
                  <tr key={f.id}>
                    <td className={styles.td}>{(pagina - 1) * itensPorPagina + idx + 1}</td>
                    <td className={styles.td}>{f.email?.split("@")[0]}</td>
                    <td
                      className={`${styles.td} ${styles.linkTd}`}
                      onClick={() => router.push(`/gestao/funcionarios/${f.id}`)}
                      style={{ color: 'var(--titan-text-high)' }}
                    >
                      {f.nome}
                    </td>
                    <td className={styles.td}>{f.email}</td>
                    <td className={styles.td}>
                      {f.cargoNome === 'FRANQUEADO' && <IconFranqueado />}
                      {f.cargoNome?.toLowerCase().includes('admin') && <IconAdmin />}
                      {f.cargoNome && !f.cargoNome.toLowerCase().includes('admin') && f.cargoNome !== 'FRANQUEADO' && <IconCargo />}
                      <span style={{ color: 'var(--titan-text-high)', fontWeight: 500 }}>{f.cargoNome || ''}</span>
                    </td>
                    <td className={styles.td}><span style={{ color: 'var(--titan-success)', fontWeight: 500 }}>Ativo</span></td>
                    <td className={styles.td}>
                      <button
                        onClick={() => removerFuncionario(f.id)}
                        style={{
                          padding: "4px 8px",
                          background: "var(--titan-error)",
                          border: "none",
                          borderRadius: "var(--titan-radius-sm)",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: "var(--titan-font-size-sm)",
                          fontWeight: "var(--titan-font-weight-medium)",
                          transition: "all var(--titan-transition-fast)"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-1px)";
                          e.currentTarget.style.boxShadow = "var(--titan-shadow-md)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        ) : abaAtiva === "transferencia" ? (
          <div 
            style={{
              overflow: "hidden",
              maxWidth: "100%",
              width: "100%",
            }}
          >
            <h2>Transferência de Responsáveis</h2>
            
            {/* ✅ Filtros para aba de transferência */}
            <div 
              style={{
                overflow: "hidden",
                maxWidth: "100%",
                width: "100%",
              }}
            >
              <div 
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--titan-spacing-lg)",
                  overflow: "hidden",
                  maxWidth: "100%",
                }}
              >
                <div className={styles.filtroCol}>
                  <label className={styles.filtroLabel}>Departamento:</label>
                  <select 
                    value={departamentoFiltro} 
                    onChange={(e) => setDepartamentoFiltro(e.target.value)}
                    className={styles.filtroSelect}
                  >
                    <option value="">Todos os departamentos</option>
                    {departamentos.map((depto) => (
                      <option key={depto.id} value={depto.nome}>{depto.nome}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.filtroCol}>
                  <label className={styles.filtroLabel}>Grupo:</label>
                  <select 
                    value={grupoFiltro} 
                    onChange={(e) => setGrupoFiltro(e.target.value)}
                    className={styles.filtroSelect}
                  >
                    <option value="">Todos os grupos</option>
                    {grupos.map((grupo) => (
                      <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>
                    ))}
                  </select>
                </div>
                <div className={`${styles.filtroCol} ${styles.filtroColSelect}`}>
                  <label className={styles.filtroLabel}>Selecionar Usuários:</label>
                  <Select
                    isMulti
                    options={funcionariosFiltradosTransferencia.map(f => ({
                      value: f.id,
                      label: f.nome
                    }))}
                    value={usuariosSelecionados.map(id => {
                      const usuario = funcionariosFiltradosTransferencia.find(f => f.id === id);
                      return {
                        value: id,
                        label: usuario ? usuario.nome : ''
                      };
                    })}
                    onChange={(selectedOptions) => {
                      const ids = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
                      // ✅ Limitar a 4 usuários
                      if (ids.length <= 4) {
                        setUsuariosSelecionados(ids);
                        // ✅ Busca automática em tempo real
                        if (ids.length > 0) {
                          buscarClientesVinculadosAutomatico(ids);
                        } else {
                          // ✅ Limpar resultados se não há usuários selecionados
                          setClientesVinculados([]);
                          setMostrarClientesVinculados(false);
                          setClientesSelecionados([]); // ✅ Limpar seleção também
                        }
                      }
                    }}
                    placeholder="Selecione até 4 usuários..."
                    className={styles.reactSelect}
                    classNamePrefix="react-select"
                    noOptionsMessage={() => "Nenhum usuário encontrado"}
                    loadingMessage={() => "Carregando..."}
                    isOptionDisabled={() => usuariosSelecionados.length >= 4}
                    closeMenuOnSelect={false}
                    // ✅ PROPRIEDADES PARA RESOLVER O PROBLEMA DO DROPDOWN
                    menuPosition="fixed"
                    menuPlacement="auto"
                    menuShouldBlockScroll={false}
                    menuShouldScrollIntoView={true}
                    menuIsOpen={undefined}
                    onMenuOpen={() => {}}
                    onMenuClose={() => {}}
                    // ✅ Controle de tamanho nativo do React Select
                    styles={{
                      control: (base) => ({
                        ...base,
                        height: '48px',
                        minHeight: '48px',
                        maxHeight: '48px',
                        padding: '0 12px'
                      }),
                      valueContainer: (base) => ({
                        ...base,
                        height: '48px',
                        padding: '0',
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '4px'
                      }),
                      multiValue: (base) => ({
                        ...base,
                        height: '24px',
                        margin: '2px 4px 2px 0',
                        maxWidth: '120px',
                        overflow: 'hidden'
                      }),
                      multiValueLabel: (base) => ({
                        ...base,
                        fontSize: '12px',
                        maxWidth: '80px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }),
                      input: (base) => ({
                        ...base,
                        maxWidth: '100px',
                        overflow: 'hidden'
                      })
                    }}
                  />
                </div>
                <div className={styles.filtroCol}>
                  <label className={styles.filtroLabel} style={{ opacity: 0 }}>Espaçador</label>
                  <button
                    onClick={limparFiltrosTransferencia}
                    style={{
                      background: "var(--titan-input-bg)",
                      border: "1px solid var(--titan-stroke)",
                      borderRadius: "var(--titan-radius-sm)",
                      padding: "12px 16px",
                      color: "var(--titan-text-high)",
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-medium)",
                      cursor: "pointer",
                      transition: "all var(--titan-transition-fast)",
                      height: "48px",
                      minHeight: "48px",
                      maxHeight: "48px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--titan-base-05)";
                      e.currentTarget.style.borderColor = "var(--titan-primary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--titan-input-bg)";
                      e.currentTarget.style.borderColor = "var(--titan-stroke)";
                    }}
                    type="button"
                  >
                    Limpar Tudo
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de Clientes Vinculados */}
            {mostrarClientesVinculados && (
              <div className={styles.clientesVinculados}>
                <h3>Clientes Vinculados aos Usuários Selecionados</h3>
                

                {loadingClientes ? (
                  <div className={styles.loading}>Carregando clientes...</div>
                ) : (
                  <div 
                    style={{
                      background: "var(--titan-card-bg)",
                      borderRadius: "var(--titan-radius-md)",
                      border: "1px solid var(--titan-stroke)",
                      width: "100%",
                      minWidth: 0,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <div 
                      style={{
                        display: "flex",
                        gap: "var(--titan-spacing-lg)",
                        marginTop: "var(--titan-spacing-md)",
                        padding: "var(--titan-spacing-lg)",
                        width: "100%",
                        overflowX: "auto",
                        overflowY: "hidden",
                        minWidth: "max-content",
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        scrollbarWidth: "thin",
                        scrollbarColor: "var(--titan-stroke) transparent",
                        // ✅ Estilos para garantir compatibilidade cross-browser
                        WebkitOverflowScrolling: "touch",
                        msOverflowStyle: "none",
                      }}
                      onScroll={(e) => {
                        // ✅ Prevenir scroll vertical acidental
                        if (Math.abs(e.currentTarget.scrollTop) > 0) {
                          e.currentTarget.scrollTop = 0;
                        }
                      }}
                    >
                      {/* ✅ Layout em colunas por usuário */}
                      {usuariosSelecionados.map((usuarioId) => {
                        const usuario = funcionarios.find(f => f.id === usuarioId);
                        const clientesDoUsuario = clientesVinculados.filter(cliente => 
                          // ✅ Filtrar clientes por usuário responsável
                          funcionarios.find(f => f.id === usuarioId)?.nome === cliente.usuarioResponsavel
                        );
                        
                        if (!usuario) return null;
                        
                        return (
                          <div 
                            key={usuarioId} 
                            style={{
                              background: "var(--titan-input-bg)",
                              border: "1px solid var(--titan-stroke)",
                              borderRadius: "var(--titan-radius-lg)",
                              padding: "var(--titan-spacing-lg)",
                              boxShadow: "var(--titan-shadow-md)",
                              minHeight: "400px",
                              display: "flex",
                              flexDirection: "column",
                              width: "270px",
                              flexShrink: 0,
                              minWidth: "32px",
                              maxWidth: "360px",
                            }}
                          >
                            <div 
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--titan-spacing-md)",
                                marginBottom: "var(--titan-spacing-lg)",
                                paddingBottom: "var(--titan-spacing-md)",
                                borderBottom: "2px solid var(--titan-stroke)",
                                background: "linear-gradient(135deg, var(--titan-base-05) 0%, var(--titan-base-00) 100%)",
                                padding: "var(--titan-spacing-md)",
                                borderRadius: "var(--titan-radius-md)",
                                margin: "calc(-1 * var(--titan-spacing-lg)) calc(-1 * var(--titan-spacing-lg)) var(--titan-spacing-lg) calc(-1 * var(--titan-spacing-lg))",
                              }}
                            >
                              <div 
                                style={{
                                  flex: 1,
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "var(--titan-spacing-xs)",
                                }}
                              >
                                <h4 
                                  style={{
                                    margin: 0,
                                    color: "var(--titan-text-high)",
                                    fontSize: "var(--titan-font-size-lg)",
                                    fontWeight: "var(--titan-font-weight-semibold)",
                                  }}
                                >
                                  {usuario.nome}
                                </h4>
                                {usuario.departamentoNome && (
                                  <span 
                                    style={{
                                      color: "var(--titan-text-med)",
                                      fontSize: "var(--titan-font-size-xs)",
                                      fontWeight: "var(--titan-font-weight-medium)",
                                      background: "var(--titan-base-05)",
                                      padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                                      borderRadius: "var(--titan-radius-sm)",
                                      alignSelf: "flex-start",
                                    }}
                                  >
                                    {usuario.departamentoNome}
                                  </span>
                                )}
                              </div>
                              <div 
                                style={{
                                  background: "var(--titan-primary)",
                                  color: "white",
                                  padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                                  borderRadius: "var(--titan-radius-md)",
                                  fontSize: "var(--titan-font-size-xs)",
                                  fontWeight: "var(--titan-font-weight-medium)",
                                  minWidth: "40px",
                                  textAlign: "center",
                                }}
                              >
                                {clientesDoUsuario.length}
                              </div>
                            </div>
                            
                            {/* ✅ Botões Selecionar/Desmarcar Todos para este usuário específico */}
                            {clientesDoUsuario.length > 0 && (
                              <div 
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  marginBottom: "var(--titan-spacing-md)",
                                  padding: "var(--titan-spacing-sm)",
                                  background: "rgba(255, 255, 255, 0.03)",
                                  borderRadius: "var(--titan-radius-sm)",
                                  border: "1px solid var(--titan-stroke)",
                                }}
                              >
                                <button 
                                  style={{
                                    background: (() => {
                                      const todosSelecionados = clientesDoUsuario.every(c => 
                                        clientesSelecionados.includes(c.id)
                                      );
                                      return todosSelecionados ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.1)";
                                    })(),
                                    color: (() => {
                                      const todosSelecionados = clientesDoUsuario.every(c => 
                                        clientesSelecionados.includes(c.id)
                                      );
                                      return todosSelecionados ? "var(--titan-text-med)" : "white";
                                    })(),
                                    border: (() => {
                                      const todosSelecionados = clientesDoUsuario.every(c => 
                                        clientesSelecionados.includes(c.id)
                                      );
                                      return todosSelecionados ? "1px solid var(--titan-stroke)" : "none";
                                    })(),
                                    padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                                    borderRadius: "var(--titan-radius-sm)",
                                    fontSize: "var(--titan-font-size-xs)",
                                    fontWeight: "var(--titan-font-weight-medium)",
                                    cursor: "pointer",
                                    transition: "all var(--titan-transition-fast)",
                                  }}
                                  onMouseEnter={(e) => {
                                    const todosSelecionados = clientesDoUsuario.every(c => 
                                      clientesSelecionados.includes(c.id)
                                    );
                                    if (todosSelecionados) {
                                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                                    } else {
                                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                                    }
                                    e.currentTarget.style.transform = "translateY(-1px)";
                                  }}
                                  onMouseLeave={(e) => {
                                    const todosSelecionados = clientesDoUsuario.every(c => 
                                      clientesSelecionados.includes(c.id)
                                    );
                                    if (todosSelecionados) {
                                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                                    } else {
                                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                                    }
                                    e.currentTarget.style.transform = "translateY(0)";
                                  }}
                                  onClick={() => {
                                    const clientesIds = clientesDoUsuario.map(c => c.id);
                                    const todosSelecionados = clientesIds.every(id => 
                                      clientesSelecionados.includes(id)
                                    );
                                    
                                    if (todosSelecionados) {
                                      // ✅ Desmarcar todos os clientes deste usuário
                                      setClientesSelecionados(prev => 
                                        prev.filter(id => !clientesIds.includes(id))
                                      );
                                    } else {
                                      // ✅ Selecionar todos os clientes deste usuário
                                      setClientesSelecionados(prev => {
                                        const semEsteUsuario = prev.filter(id => 
                                          !clientesIds.includes(id)
                                        );
                                        return [...semEsteUsuario, ...clientesIds];
                                      });
                                    }
                                  }}
                                >
                                  {(() => {
                                    const todosSelecionados = clientesDoUsuario.every(c => 
                                      clientesSelecionados.includes(c.id)
                                    );
                                    return todosSelecionados ? (
                                      <>☐ Desmarcar Todos</>
                                    ) : (
                                      <>☑️ Selecionar Todos</>
                                    );
                                  })()}
                                </button>
                              </div>
                            )}
                            
                            {/* ✅ Footer de transferência: destino + enviar */}
                            <div
                              style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 'var(--titan-spacing-md)' }}
                            >
                              <select
                                value={transferDestinoPorUsuario[usuarioId] ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value ? Number(e.target.value) : null;
                                  setTransferDestinoPorUsuario(prev => ({ ...prev, [usuarioId]: value }));
                                }}
                                style={{
                                  flex: 1,
                                  height: 36,
                                  background: 'var(--titan-input-bg)',
                                  border: '1px solid var(--titan-stroke)',
                                  borderRadius: 'var(--titan-radius-sm)',
                                  color: 'var(--titan-text-high)'
                                }}
                              >
                                <option value="">Selecionar destino…</option>
                                {usuariosSelecionados
                                  .filter((id) => id !== usuarioId)
                                  .map((id) => {
                                    const u = funcionarios.find((f) => f.id === id);
                                    if (!u) return null;
                                    return (
                                      <option key={u.id} value={u.id}>{u.nome}</option>
                                    );
                                  })}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  const destino = transferDestinoPorUsuario[usuarioId];
                                  if (!destino) return;
                                  setConfirmTransferModal({ open: true, origemId: usuarioId, destinoId: destino });
                                }}
                                title="Solicitar transferência"
                                disabled={transferLoading[usuarioId]}
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 8,
                                  background: transferLoading[usuarioId] ? 'var(--titan-stroke)' : 'var(--titan-primary)',
                                  color: '#fff',
                                  border: 'none',
                                  cursor: transferLoading[usuarioId] ? 'not-allowed' : 'pointer',
                                  opacity: transferLoading[usuarioId] ? 0.6 : 1,
                                  transition: 'all var(--titan-transition-fast)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                {transferLoading[usuarioId] ? (
                                  <svg 
                                    width="16" 
                                    height="16" 
                                    viewBox="0 0 24 24" 
                                    fill="none"
                                    className={styles.spin}
                                  >
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                                    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                                  </svg>
                                ) : (
                                  '⇄'
                                )}
                              </button>
                            </div>

                            <div 
                              style={{
                                flex: 1,
                                overflowY: "auto",
                                maxHeight: "300px",
                              }}
                            >
                              {clientesDoUsuario.length > 0 ? (
                                clientesDoUsuario.map((cliente, index) => (
                                  <div 
                                    key={cliente.id} 
                                    style={{
                                      background: "var(--titan-input-bg)",
                                      border: "1px solid var(--titan-stroke)",
                                      borderRadius: "var(--titan-radius-md)",
                                      padding: "var(--titan-spacing-md)",
                                      marginBottom: "var(--titan-spacing-md)",
                                      boxShadow: "var(--titan-shadow-sm)",
                                      transition: "all var(--titan-transition-fast)",
                                    }}
                                  >
                                    <div 
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "var(--titan-spacing-sm)",
                                        marginBottom: "var(--titan-spacing-sm)",
                                        paddingBottom: "var(--titan-spacing-sm)",
                                        borderBottom: "1px solid var(--titan-stroke)",
                                      }}
                                    >
                                      {/* ✅ Checkbox para seleção */}
                                      <input
                                        type="checkbox"
                                        checked={clientesSelecionados.includes(cliente.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setClientesSelecionados(prev => [...prev, cliente.id]);
                                          } else {
                                            setClientesSelecionados(prev => prev.filter(id => id !== cliente.id));
                                          }
                                        }}
                                        style={{
                                          width: "18px",
                                          height: "18px",
                                          cursor: "pointer",
                                          accentColor: "var(--titan-primary)",
                                        }}
                                      />
                                      <div 
                                        style={{
                                          flex: 1,
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "var(--titan-spacing-xs)",
                                        }}
                                      >
                                        <span 
                                          style={{
                                            fontWeight: "var(--titan-font-weight-semibold)",
                                            color: "var(--titan-text-high)",
                                            fontSize: "var(--titan-font-size-sm)",
                                          }}
                                        >
                                          {cliente.nome}
                                        </span>
                                        <span 
                                          style={{
                                            color: "var(--titan-text-med)",
                                            fontSize: "var(--titan-font-size-xs)",
                                            fontFamily: "monospace",
                                          }}
                                        >
                                          {cliente.cnpjCpf}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div 
                                  style={{
                                    textAlign: "center",
                                    padding: "var(--titan-spacing-xl)",
                                    color: "var(--titan-text-low)",
                                    fontSize: "var(--titan-font-size-sm)",
                                    fontStyle: "italic",
                                    background: "var(--titan-base-05)",
                                    borderRadius: "var(--titan-radius-sm)",
                                  }}
                                >
                                  <span>Nenhum cliente vinculado</span>
                                </div>
                              )}
                            </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* ✅ Paginação adicionada - APENAS para aba Funcionários */}
        {abaAtiva === "funcionarios" && !loading && funcionariosFiltrados.length > 0 && (
          <div className={styles.pagination}>
            <span>
              Mostrando {(pagina - 1) * itensPorPagina + 1}
              {" - "}
              {Math.min(pagina * itensPorPagina, funcionariosFiltrados.length)} de {funcionariosFiltrados.length}
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
        )}

        {modalAberto && (
          <div 
            className={`${styles.modalOverlay} ${modalFechando ? styles.fadeOutOverlay : styles.fadeInOverlay}`}
            style={{
              background: isLight ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.5)",
              zIndex: 9999
            }}
          >
            <div 
              className={`${styles.modalContent} ${styles.modalContentSmaller} ${modalFechando ? styles.fadeOutContent : styles.fadeInContent}`}
              style={{
                background: isLight ? "rgba(255, 255, 255, 0.98)" : "var(--titan-card-bg)",
                border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid var(--titan-stroke)"
              }}
            >
              <h2 className={styles.modalTitle}>Novo Funcionário</h2>
              <form className={styles.modalForm} onSubmit={e => { e.preventDefault(); criarFuncionario(); }}>
                <div className={styles.inputRow}>
                  <div className={styles.inputCol}>
                    <label className={styles.label}>Nome *</label>
                    <input 
                      type="text" 
                      value={nome} 
                      onChange={e => setNome(e.target.value)} 
                      className={styles.inputGroup}
                      placeholder="Digite o nome completo"
                    />
                  </div>
                  <div className={styles.inputCol}>
                    <label className={styles.label}>Email *</label>
                    <input 
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      className={styles.inputGroup}
                      placeholder="exemplo@empresa.com"
                    />
                  </div>
                </div>
                <div className={styles.inputRow}>
                  <div className={styles.inputCol}>
                    <label className={styles.label}>Senha *</label>
                    <PasswordInput value={senha} onChange={e => setSenha(e.target.value)} placeholder="Digite a senha" />
                  </div>
                  <div className={styles.inputCol}>
                    <label className={styles.label}>Confirmar Senha *</label>
                    <PasswordInput value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} placeholder="Confirme a senha" />
                  </div>
                </div>
                <div className={styles.inputRow}>
                  <div className={styles.inputCol}>
                    <button onClick={gerarSenhaAleatoria} type="button" className={styles.buttonGenerateSmall}>
                      Gerar Senha Aleatória
                    </button>
                  </div>
                </div>
                <div className={styles.inputRow}>
                  <div className={styles.inputCol}>
                    <label className={styles.label}>Departamento *</label>
                    <select value={departamentoId} onChange={e => setDepartamentoId(e.target.value)} className={styles.inputGroup}>
                      <option value="">Selecione o Departamento</option>
                      {departamentos.map((d) => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.inputCol}>
                    <label className={styles.label}>Cargo</label>
                    <select value={cargoId} onChange={e => setCargoId(e.target.value)} className={styles.inputGroup}>
                      <option value="">Selecione...</option>
                      {cargos.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {erroSenha && <p className={styles.errorText}>{erroSenha}</p>}
                {erroDepartamento && <p className={styles.errorText}>{erroDepartamento}</p>}
                {erroGeral && <p className={styles.errorText}>{erroGeral}</p>}
                <div className={styles.modalFooter}>
                  <button type="submit" className={styles.buttonSalvar}>Confirmar</button>
                  <button type="button" onClick={fecharModal} className={styles.buttonCancelar}>Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* ✅ Modal de confirmação de transferência */}
        {confirmTransferModal.open && (
          <div 
            className={styles.modalOverlay}
            style={{
              background: isLight ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.5)",
              zIndex: 9999
            }}
          >
            <div 
              className={styles.modalContent}
              style={{
                background: isLight ? "rgba(255, 255, 255, 0.98)" : "var(--titan-card-bg)",
                border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid var(--titan-stroke)"
              }}
            >
              <h2 className={styles.modalTitle}>Transferindo</h2>
              <div style={{ color: 'var(--titan-text-high)', lineHeight: 1.6 }}>
                Realmente deseja transferir a responsabilidade dos clientes selecionados?
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.buttonCancelar}
                  onClick={() => setConfirmTransferModal({ open: false })}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.buttonSalvar}
                  onClick={() => {
                    if (confirmTransferModal.origemId && confirmTransferModal.destinoId) {
                      transferirResponsabilidade(confirmTransferModal.origemId, confirmTransferModal.destinoId);
                    }
                    setConfirmTransferModal({ open: false });
                  }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
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
        toastStyle={{
          background: 'var(--titan-base-00)',
          color: 'var(--titan-text-high)',
          border: '1px solid var(--titan-stroke)',
          borderRadius: 'var(--titan-radius-md)',
          boxShadow: 'var(--titan-shadow-lg)'
        }}
      />
    </>
  );
}
