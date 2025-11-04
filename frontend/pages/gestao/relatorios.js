"use client";

import React, { useEffect, useState } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import { ClienteSelectInline } from "../../components/gestao/ClienteSelectInline";
import styles from "../../styles/gestao/RelatoriosPage.module.css";
import VisaoGeralModal from "../../components/gestao/VisaoGeralModal";
import * as XLSX from "xlsx";
import "jspdf-autotable";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
    } catch { }
    return sessionStorage.getItem("empresaId") || "";
};


// === COMPARAÇÃO POR DIA (ignora horas/fusos) ===
function ymd(d) {
    if (!d) return null;
    // Garante 'YYYY-MM-DD' mesmo quando vier 'YYYY-MM-DD HH:MM:SS+00'
    return String(d).slice(0, 10);
}
function lte(a, b) { // a <= b
    const A = ymd(a), B = ymd(b);
    if (!A || !B) return false;
    return A <= B;
}
function lt(a, b) { // a < b
    const A = ymd(a), B = ymd(b);
    if (!A || !B) return false;
    return A < B;
}
function gt(a, b) { // a > b
    const A = ymd(a), B = ymd(b);
    if (!A || !B) return false;
    return A > B;
}
function gte(a, b) { // a >= b
    const A = ymd(a), B = ymd(b);
    if (!A || !B) return false;
    return A >= B;
}

// Função para corrigir timezone das datas do backend
function corrigirTimezoneData(dataString) {
    // Se a data já está no formato YYYY-MM-DD, retorna como está
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
        return dataString;
    }

    // Se tem T e Z, é formato ISO com timezone
    if (dataString.includes('T') && dataString.includes('Z')) {
        // O backend já envia no timezone local, só precisamos extrair a data
        // Remove tudo após o T e retorna só a data
        return dataString.split('T')[0];
    }

    // Fallback: tenta converter normalmente
    try {
        const data = new Date(dataString);
        return data.toISOString().split('T')[0];
    } catch {
        return dataString;
    }
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
    border-left: 4px solid var(--titan-success) !important;
  }
  
  .Toastify__toast--success.custom-toast .Toastify__toast-icon {
    color: var(--titan-success) !important;
  }
  
  .Toastify__toast--error.custom-toast {
    background-color: #1a1a1a !important;
    border-left: 4px solid var(--titan-error) !important;
  }
  
  .Toastify__toast--error.custom-toast .Toastify__toast-icon {
    color: var(--titan-error) !important;
  }
  
  .Toastify__toast--warning.custom-toast {
    background-color: #1a1a1a !important;
    border-left: 4px solid var(--titan-warning) !important;
  }
  
  .Toastify__toast--warning.custom-toast .Toastify__toast-icon {
    color: var(--titan-warning) !important;
  }
  
  .Toastify__toast--info.custom-toast {
    background-color: #1a1a1a !important;
    border-left: 4px solid var(--titan-primary) !important;
  }
  
  .Toastify__toast--info.custom-toast .Toastify__toast-icon {
    color: var(--titan-primary) !important;
  }
`;

// Injetar os estilos do toast
if (typeof document !== 'undefined') {
    const toastStyleElement = document.createElement('style');
    toastStyleElement.textContent = toastStyles;
    document.head.appendChild(toastStyleElement);
}

export default function RelatoriosPage() {
    // Estados para filtros
    const [tipoTarefa, setTipoTarefa] = useState("obrigacoes");
    const [departamentos, setDepartamentos] = useState([]);
    const [departamentosList, setDepartamentosList] = useState([]);
    const [status, setStatus] = useState([]);
    const [campoData, setCampoData] = useState("dataPrazo");
    const [periodoInicial, setPeriodoInicial] = useState("");
    const [periodoFinal, setPeriodoFinal] = useState("");
    const [cliente, setCliente] = useState(null);
    const [usuarios, setUsuarios] = useState([]);
    const [obrigacoes, setObrigacoes] = useState([]);
    const [obrigacoesList, setObrigacoesList] = useState([]);
    const [loadingObrigacoes, setLoadingObrigacoes] = useState(false);

    // Novos filtros
    const [colaboradores, setColaboradores] = useState([]);
    const [colaboradoresList, setColaboradoresList] = useState([]);
    const [loadingColaboradores, setLoadingColaboradores] = useState(false);
    const [grupos, setGrupos] = useState([]);
    const [gruposList, setGruposList] = useState([]);
    const [loadingGrupos, setLoadingGrupos] = useState(false);
    const [buscarPor, setBuscarPor] = useState("Departamentos");
    const [tipo, setTipo] = useState("Consolidado");
    const [resultados, setResultados] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [loadingBusca, setLoadingBusca] = useState(false);
    const [jaBuscou, setJaBuscou] = useState(false);
    // Para modal de detalhes de solicitações
    const [modalAberto, setModalAberto] = useState(false);
    const [tituloModal, setTituloModal] = useState("");
    const [solicitacoesModal, setSolicitacoesModal] = useState([]);

    // Para modal de detalhes de baixas diárias
    const [modalBaixasAberto, setModalBaixasAberto] = useState(false);
    const [tituloModalBaixas, setTituloModalBaixas] = useState("");
    const [baixasModal, setBaixasModal] = useState([]);


    // Estados para "tudo" (mock da API Visão Geral)
    const [allObrigacoes, setAllObrigacoes] = useState([]);
    const [allTarefas, setAllTarefas] = useState([]);

    // Mapeamento de campoData para campo real
    const campoDataMap = {
        dataPrazo: "vencimento",
        dataMeta: "meta",
        dataConclusao: "dataBaixa"
    };

    // Status options
    const statusOptionsObr = [
        { value: "", label: "Todos" },
        { value: "pendente", label: "Pendentes" },
        { value: "concluída", label: "Concluídas" },
        { value: "atrasada", label: "Atrasadas" },
        { value: "realizada", label: "Realizadas" },
        { value: "concluida_na_meta", label: "Concluídas até a Meta" },
        { value: "concluida_fora_meta", label: "Concluídas Fora da Meta" },
        { value: "concluida_fora_prazo", label: "Concluídas Fora do Prazo" },
        { value: "dispensada", label: "Dispensadas/Canceladas" }
    ];
    const statusOptionsTar = [
        { value: "", label: "Todos" },
        { value: "aberta", label: "Abertas" },
        { value: "concluída", label: "Concluídas" },
        { value: "atrasada", label: "Atrasadas" },
        { value: "realizada", label: "Realizadas" },
        { value: "concluida_na_meta", label: "Concluídas até a Meta" },
        { value: "concluida_fora_meta", label: "Concluídas Fora da Meta" },
        { value: "concluida_fora_prazo", label: "Concluídas Fora do Prazo" },
        { value: "dispensada", label: "Dispensadas/Canceladas" }
    ];

    // Estado para controlar a aba ativa do modal
    const [abaAtivaModal, setAbaAtivaModal] = useState("obrigacoes");

    const [tipoRelatorio, setTipoRelatorio] = useState("performance");
    const [periodoInicioBaixas, setPeriodoInicioBaixas] = useState(new Date().toISOString().split('T')[0]);
    const [periodoFimBaixas, setPeriodoFimBaixas] = useState(new Date().toISOString().split('T')[0]);
    const [baixasDiarias, setBaixasDiarias] = useState([]);
    const [baixasAgrupadas, setBaixasAgrupadas] = useState([]);

    // NOVO: Estado para baixas agrupadas por data (formato ideal)
    const [baixasPorData, setBaixasPorData] = useState([]);
    const [loadingBaixas, setLoadingBaixas] = useState(false);
    const [errorBaixas, setErrorBaixas] = useState(null);

    // ADICIONE ESTES ESTADOS PARA USUÁRIOS
    const [usuariosList, setUsuariosList] = useState([]);
    const [usuariosSelecionados, setUsuariosSelecionados] = useState([]);
    const [loadingUsuarios, setLoadingUsuarios] = useState(false);

    const [universoResumo, setUniversoResumo] = useState([]);

    // Carrega todos os dados da empresa (igual Visão Geral)
    useEffect(() => {
        async function loadAll() {
            setLoading(true);
            setError(null);
            const token = getToken();
            const empresaId = getEmpresaId();
            if (!empresaId || !token) return;
            try {
                const [obrsRes, tarsRes] = await Promise.all([
                    fetch(`${BASE_URL}/gestao/obrigacoes/empresa/${empresaId}/todas`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "X-Empresa-Id": empresaId,
                            "empresaid": empresaId
                        }
                    }),
                    fetch(`${BASE_URL}/gestao/tarefas/todas/${empresaId}`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "X-Empresa-Id": empresaId,
                            "empresaid": empresaId
                        }
                    })
                ]);
                const obrs = await obrsRes.json();
                const tars = await tarsRes.json();
                setAllObrigacoes(obrs || []);
                setAllTarefas(tars || []);
            } catch (err) {
                setAllObrigacoes([]);
                setAllTarefas([]);
                setError("Erro ao buscar dados.");
            }
            setLoading(false);
        }
        loadAll();
    }, []);

    // Carrega lista de departamentos
    useEffect(() => {
        async function loadDepartamentos() {
            const token = getToken();
            const empresaId = getEmpresaId();
            if (!empresaId || !token) return;
            try {
                const res = await fetch(`${BASE_URL}/gestao/departamentos/empresa/${empresaId}/nomes`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "X-Empresa-Id": empresaId,
                        "empresaid": empresaId
                    },
                });
                const data = await res.json();
                setDepartamentosList(data || []);
            } catch (err) {
                setDepartamentosList([]);
            }
        }
        loadDepartamentos();
    }, []);

    // Carrega obrigações baseada no departamento selecionado
    useEffect(() => {
        async function loadObrigacoes() {
            const token = getToken();
            const empresaId = getEmpresaId();
            if (!empresaId || !token) return;

            setLoadingObrigacoes(true);
            try {
                const res = await fetch(`${BASE_URL}/gestao/obrigacoes/empresa/${empresaId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                let obrigacoesFiltradas = data || [];

                // Se há filtro de departamento, filtrar as obrigações
                if (departamentos.length > 0) {
                    obrigacoesFiltradas = obrigacoesFiltradas.filter((obrigacao) =>
                        departamentos.includes(obrigacao.departamentoId)
                    );
                }

                setObrigacoesList(obrigacoesFiltradas);
            } catch (err) {
                console.error("Erro ao carregar obrigações:", err);
                setObrigacoesList([]);
            } finally {
                setLoadingObrigacoes(false);
            }
        }
        loadObrigacoes();
    }, [departamentos]);

    // Carrega colaboradores baseado no departamento selecionado
    useEffect(() => {
        async function loadColaboradores() {
            const token = getToken();
            const empresaId = getEmpresaId();
            if (!empresaId || !token) return;

            setLoadingColaboradores(true);
            try {
                let colaboradoresFiltrados = [];

                // SEMPRE respeitar o filtro de departamento primeiro
                if (departamentos.length > 0) {
                    // Filtrar por departamento selecionado
                    const res = await fetch(`${BASE_URL}/gestao/departamentos/${departamentos[0]}/usuarios`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const data = await res.json();
                    colaboradoresFiltrados = data || [];
                } else {
                    // Se não há filtro de departamento, buscar todos os usuários da empresa
                    // Nota: A rota /usuarios retorna { data: [...], page, limit, total }
                    const res = await fetch(`${BASE_URL}/usuarios`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const responseData = await res.json();
                    colaboradoresFiltrados = responseData?.data || [];
                }

                setColaboradoresList(colaboradoresFiltrados);

                // IMPORTANTE: Limpar colaboradores selecionados se não estiverem mais disponíveis
                // Isso garante que o filtro de departamento sempre funcione
                if (colaboradores.length > 0) {
                    const colaboradoresDisponiveis = colaboradoresFiltrados.map((c) => c.id);
                    const colaboradoresValidos = colaboradores.filter(id => colaboradoresDisponiveis.includes(id));
                    if (colaboradoresValidos.length !== colaboradores.length) {
                        setColaboradores(colaboradoresValidos);
                    }
                }
            } catch (err) {
                console.error("Erro ao carregar colaboradores:", err);
                setColaboradoresList([]);
            } finally {
                setLoadingColaboradores(false);
            }
        }
        loadColaboradores();
    }, [departamentos]); // Removida dependência de 'colaboradores' para evitar loops

    // Carrega grupos da empresa
    useEffect(() => {
        async function loadGrupos() {
            const token = getToken();
            const empresaId = getEmpresaId();
            if (!empresaId || !token) return;

            setLoadingGrupos(true);
            try {
                const res = await fetch(`${BASE_URL}/gestao/relatorios/clientes/grupos/empresa/${empresaId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                setGruposList(data || []);

                // Limpar grupos selecionados se não estiverem mais disponíveis
                if (grupos.length > 0) {
                    const gruposDisponiveis = data.map((g) => g.id);
                    const gruposValidos = grupos.filter(id => gruposDisponiveis.includes(id));
                    if (gruposValidos.length !== grupos.length) {
                        setGrupos(gruposValidos);
                    }
                }
            } catch (err) {
                console.error("Erro ao carregar grupos:", err);
                setGruposList([]);
            } finally {
                setLoadingGrupos(false);
            }
        }
        loadGrupos();
    }, [grupos]);

    // Estado para armazenar clientes filtrados por grupo
    const [clientesPorGrupo, setClientesPorGrupo] = useState({});

    // Estado para armazenar obrigações filtradas por usuário
    const [obrigacoesPorUsuario, setObrigacoesPorUsuario] = useState({});

    // NOVO: Estado para armazenar dados filtrados por grupo (clientes + obrigações)
    const [dadosPorGrupo, setDadosPorGrupo] = useState([]);

    // Carrega clientes por grupo quando grupos são selecionados
    useEffect(() => {
        async function loadDadosPorGrupo() {
            if (grupos.length === 0) {
                setClientesPorGrupo({});
                setDadosPorGrupo([]);
                return;
            }

            const token = getToken();
            const empresaId = getEmpresaId();
            if (!empresaId || !token) return;

            try {
                // ROTA EXISTENTE: Buscar clientes E suas obrigações por grupo
                const gruposQuery = grupos.length > 0 ? `?grupos=${grupos.join(',')}` : '';
                const res = await fetch(`${BASE_URL}/gestao/relatorios/tarefas/por-grupo/${empresaId}${gruposQuery}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();

                // Manter compatibilidade com o código existente
                const clientesMap = {};
                const gruposData = Array.isArray(data) ? data : [];
                gruposData.forEach((grupo) => {
                    grupo.clientes.forEach((cliente) => {
                        if (!clientesMap[grupo.grupoId]) {
                            clientesMap[grupo.grupoId] = [];
                        }
                        clientesMap[grupo.grupoId].push(cliente.clienteId);
                    });
                });

                setClientesPorGrupo(clientesMap);
                setDadosPorGrupo(gruposData);
                console.log('[Grupos] Dados completos por grupo:', gruposData);
            } catch (err) {
                console.error("Erro ao carregar dados por grupo:", err);
                setClientesPorGrupo({});
                setDadosPorGrupo([]);
            }
        }

        loadDadosPorGrupo();
    }, [grupos]);

    // Carrega obrigações por usuário quando usuários são selecionados
    useEffect(() => {
        async function loadObrigacoesPorUsuario() {
            const token = getToken();
            const empresaId = getEmpresaId();
            if (!empresaId || !token) return;

            try {
                // Se há usuários selecionados, buscar obrigações específicas
                if (colaboradores.length > 0) {
                    const obrigacoesMap = {};

                    // Buscar obrigações para cada usuário selecionado
                    for (const usuarioId of colaboradores) {
                        const res = await fetch(`${BASE_URL}/gestao/relatorios/obrigacoes/por-usuario/${empresaId}?usuarioId=${usuarioId}`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        const data = await res.json();

                        // Mapear obrigações para usuários responsáveis
                        const obrigacoesData = Array.isArray(data) ? data : [];
                        obrigacoesData.forEach((item) => {
                            if (!obrigacoesMap[item.obrigacaoClienteId]) {
                                obrigacoesMap[item.obrigacaoClienteId] = [];
                            }
                            obrigacoesMap[item.obrigacaoClienteId].push(item.responsavelId);
                        });
                    }

                    setObrigacoesPorUsuario(obrigacoesMap);
                } else {
                    // Se não há usuários selecionados, limpar o mapa
                    setObrigacoesPorUsuario({});
                }
            } catch (err) {
                console.error("Erro ao carregar obrigações por usuário:", err);
                setObrigacoesPorUsuario({});
            }
        }

        loadObrigacoesPorUsuario();
    }, [colaboradores]); // Executa quando colaboradores mudam

    // ADICIONE ESTE NOVO USEEFFECT
    useEffect(() => {
        if (tipoRelatorio === "baixas-diarias" && periodoInicioBaixas && periodoFimBaixas) {
            buscarBaixasDiarias();
        }
    }, [periodoInicioBaixas, periodoFimBaixas, tipoRelatorio]);

    // Função utilitária para status concluída (aceita com e sem acento)
    function statusConcluidaObr(status) {
        const s = (status || "").toLowerCase();
        return s === "concluída" || s === "concluida";
    }

    function abrirModalSolicitacoes(filtro, titulo) {

        console.log('[DEBUG] abrirModalSolicitacoes chamada:', { filtro, titulo, tipoTarefa });

        // IMPORTANTE: Usar os dados JÁ FILTRADOS pelos filtros globais!
        // Isso garante que os filtros de colaborador e grupo já foram aplicados
        let lista = [];

        // Aplicar os mesmos filtros globais que foram aplicados na função filtrarLocal
        if (tipoTarefa === "obrigacoes") {
            lista = [...allObrigacoes];
            console.log('[DEBUG] Usando allObrigacoes, quantidade:', allObrigacoes.length);
        } else {
            lista = [...allTarefas];
            console.log('[DEBUG] Usando allTarefas, quantidade:', allTarefas.length);
        }

        // IMPORTANTE: DEPARTAMENTO SEMPRE é aplicado primeiro!
        // Filtrar por departamento sempre que estiver selecionado
        if (departamentos.length > 0) {
            lista = lista.filter(o => departamentos.includes(Number(o.departamentoId)));
        }

        // Depois filtrar por colaborador (se selecionado)
        if (colaboradores.length > 0) {
            if (tipoTarefa === "obrigacoes") {
                lista = lista.filter(o => {
                    if (!o.id) return false;
                    const obrigacaoClienteId = o.id;
                    if (!obrigacoesPorUsuario[obrigacaoClienteId]) return false;
                    return obrigacoesPorUsuario[obrigacaoClienteId].some(usuarioId =>
                        colaboradores.includes(usuarioId)
                    );
                });
            } else {
                lista = lista.filter(o => colaboradores.includes(Number(o.responsavelId)));
            }
        }

        // Filtrar por grupos
        if (grupos.length > 0) {
            lista = lista.filter(o => {
                if (!o.clienteId) return false;
                const clienteId = Number(o.clienteId);
                return Object.values(clientesPorGrupo).some(clientesDoGrupo =>
                    clientesDoGrupo.includes(clienteId)
                );
            });
        }

        // IMPORTANTE: Os filtros globais (período, cliente, obrigações) já foram aplicados acima!
        // Agora só aplicamos o filtro específico do modal (departamento + status)

        // APLICAR FILTROS GLOBAIS QUE FORAM APLICADOS NA FUNÇÃO filtrarLocal
        console.log('[DEBUG] Aplicando filtros globais:', { cliente, periodoInicial, periodoFinal, obrigacoes });

        // Filtro por cliente
        if (cliente) {
            const antes = lista.length;
            lista = lista.filter(o => String(o.clienteId) === cliente);
            console.log('[DEBUG] Filtro cliente:', antes, '->', lista.length);
        }

        // Filtro por período
        if (periodoInicial) {
            const antes = lista.length;
            if (campoData === "dataConclusao") {
                // CORREÇÃO: Quando campoData é "dataConclusao", filtrar por dataConclusao/dataBaixa
                lista = lista.filter(o => {
                    const dataConclusao = o.dataConclusao || o.dataBaixa;
                    return dataConclusao && new Date(dataConclusao) >= new Date(periodoInicial + "T00:00:00");
                });
            } else if (tipoTarefa === "solicitacoes") {
                // Para solicitações: filtrar por dataAcao, dataMeta e dataPrazo
                lista = lista.filter(o => {
                    const dataAcao = o.dataAcao && new Date(o.dataAcao) >= new Date(periodoInicial + "T00:00:00");
                    const dataMeta = o.dataMeta && new Date(o.dataMeta) >= new Date(periodoInicial + "T00:00:00");
                    const dataPrazo = o.dataPrazo && new Date(o.dataPrazo) >= new Date(periodoInicial + "T00:00:00");
                    return dataAcao || dataMeta || dataPrazo;
                });
            } else {
                // Para obrigações: usar o campo selecionado (comportamento atual)
                lista = lista.filter(o => {
                    const dt = o[campoDataMap[campoData]];
                    return dt && new Date(dt) >= new Date(periodoInicial + "T00:00:00");
                });
            }
            console.log('[DEBUG] Filtro período inicial:', antes, '->', lista.length);
        }
        if (periodoFinal) {
            const antes = lista.length;
            if (campoData === "dataConclusao") {
                // CORREÇÃO: Quando campoData é "dataConclusao", filtrar por dataConclusao/dataBaixa
                lista = lista.filter(o => {
                    const dataConclusao = o.dataConclusao || o.dataBaixa;
                    return dataConclusao && new Date(dataConclusao) <= new Date(periodoFinal + "T23:59:59");
                });
            } else if (tipoTarefa === "solicitacoes") {
                // Para solicitações: filtrar por dataAcao, dataMeta e dataPrazo
                lista = lista.filter(o => {
                    const dataAcao = o.dataAcao && new Date(o.dataAcao) <= new Date(periodoFinal + "T23:59:59");
                    const dataMeta = o.dataMeta && new Date(o.dataMeta) <= new Date(periodoFinal + "T00:00:00");
                    const dataPrazo = o.dataPrazo && new Date(o.dataPrazo) <= new Date(periodoFinal + "T23:59:59");
                    return dataAcao || dataMeta || dataPrazo;
                });
            } else {
                // Para obrigações: usar o campo selecionado (comportamento atual)
                lista = lista.filter(o => {
                    const dt = o[campoDataMap[campoData]];
                    return dt && new Date(dt) <= new Date(periodoFinal + "T23:59:59");
                });
            }
            console.log('[DEBUG] Filtro período final:', antes, '->', lista.length);
        }

        // Filtro por obrigações
        if (obrigacoes.length > 0) {
            const antes = lista.length;
            lista = lista.filter(o => obrigacoes.includes(Number(o.obrigacaoId)));
            console.log('[DEBUG] Filtro obrigações:', antes, '->', lista.length);
        }

        // Sempre filtra pelo departamento, se houver
        if (filtro.departamentoId !== undefined) {
            const antes = lista.length;
            lista = lista.filter(t => Number(t.departamentoId) === filtro.departamentoId);
            console.log('[DEBUG] Filtro departamento:', antes, '->', lista.length);
        }

        // Só filtra por status se filtro.status estiver definido!
        console.log('[DEBUG] Modal - Tarefas antes da classificação por status:', lista.length);
        if (filtro.status != null) {
            if (tipoTarefa === "obrigacoes") {
                switch (filtro.status) {
                    case "aberta":
                        lista = lista.filter(item => isAbertaObr(item, campoDataMap[campoData]));
                        break;
                    case "atrasada":
                        lista = lista.filter(item => isAtrasadaObr(item, campoDataMap[campoData]));
                        break;
                    case "realizada":
                    case "concluída":
                        lista = lista.filter(item => isRealizadaObr(item, campoDataMap[campoData]));
                        break;
                    case "concluida_na_meta":
                        lista = lista.filter(item => isConcluidaNaMetaObr(item, campoDataMap[campoData]));
                        break;
                    case "concluida_fora_meta":
                        lista = lista.filter(item => isConcluidaForaMetaObr(item, campoDataMap[campoData]));
                        break;
                    case "concluida_fora_prazo":
                        lista = lista.filter(item => isConcluidaAposPrazoObr(item, campoDataMap[campoData]));
                        break;
                    default:
                        lista = lista.filter((t) => (t.status || "").toLowerCase() === filtro.status);
                }
            } else {
                if (filtro.status === "aberta") {
                    lista = lista.filter(t => (t.status || "").toLowerCase() === "aberta" || (t.status || "").toLowerCase() === "pendente");
                } else if (filtro.status === "concluida_na_meta") {
                    lista = lista.filter(t => {
                        if ((t.status || "").toLowerCase() !== "concluída") return false;
                        if (!t.dataConclusao && !t.dataBaixa) return false;
                        const dataConclusao = t.dataConclusao ?? t.dataBaixa;
                        if (!dataConclusao || !t.dataMeta) return false;

                        // CORREÇÃO: Usar ymd() para comparar apenas a data (ignorar horário)
                        const conclusao = ymd(dataConclusao);
                        const meta = ymd(t.dataMeta);
                        const resultado = lte(conclusao, meta);

                        console.log('[DEBUG] abrirModalSolicitacoes - concluida_na_meta:', {
                            id: t.id,
                            dataConclusao: dataConclusao,
                            dataMeta: t.dataMeta,
                            conclusao: conclusao,
                            meta: meta,
                            resultado: resultado,
                            explicacao: resultado ? 'ATÉ A META' : 'FORA DA META'
                        });

                        return resultado;
                    });
                } else if (filtro.status === "concluida_fora_meta") {
                    lista = lista.filter(t => {
                        if ((t.status || "").toLowerCase() !== "concluída") return false;
                        if (!t.dataConclusao && !t.dataBaixa) return false;
                        const dataConclusao = t.dataConclusao ?? t.dataBaixa;
                        if (!dataConclusao || !t.dataMeta || !t.dataPrazo) return false;

                        // CORREÇÃO: Usar a mesma lógica da função agruparPorDepartamento
                        // Concluída fora da meta = passou da meta MAS não passou do prazo
                        const conclusao = ymd(dataConclusao);
                        const meta = ymd(t.dataMeta);
                        const prazo = ymd(t.dataPrazo);
                        const resultado = gt(conclusao, meta) && lt(conclusao, prazo);

                        console.log('[DEBUG] abrirModalSolicitacoes - concluida_fora_meta:', {
                            id: t.id,
                            dataConclusao: dataConclusao,
                            dataMeta: t.dataMeta,
                            dataPrazo: t.dataPrazo,
                            conclusao: conclusao,
                            meta: meta,
                            prazo: prazo,
                            resultado: resultado,
                            explicacao: resultado ? 'FORA DA META MAS DENTRO DO PRAZO' : 'NÃO SE APLICA'
                        });

                        return resultado;
                    });
                } else if (filtro.status === "concluida_fora_prazo") {
                    lista = lista.filter(t => {
                        if ((t.status || "").toLowerCase() !== "concluída") return false;
                        if (!t.dataConclusao && !t.dataBaixa) return false;
                        const dataConclusao = t.dataConclusao ?? t.dataBaixa;
                        if (!dataConclusao || !t.dataPrazo) return false;

                        // CORREÇÃO: Usar ymd() para comparar apenas a data (ignorar horário)
                        const conclusao = ymd(dataConclusao);
                        const prazo = ymd(t.dataPrazo);
                        const resultado = gt(conclusao, prazo); // Usar a função gt que já normaliza as datas

                        console.log('[DEBUG] abrirModalSolicitacoes - concluida_fora_prazo:', {
                            id: t.id,
                            dataConclusao: dataConclusao,
                            dataPrazo: t.dataPrazo,
                            conclusao: conclusao,
                            prazo: prazo,
                            resultado: resultado,
                            explicacao: resultado ? 'APÓS PRAZO' : 'DENTRO DO PRAZO'
                        });

                        // Após prazo = estritamente maior que o prazo (igualdade NÃO é atraso)
                        return resultado;
                    });
                } else if (filtro.status === "atrasada") {
                    lista = lista.filter(t => {
                        if (!["pendente", "aberta"].includes((t.status || "").toLowerCase())) return false;
                        const now = new Date();
                        let atrasada = false;
                        if (t.dataAcao && t.dataMeta && t.dataPrazo) {
                            atrasada =
                                new Date(t.dataAcao) < now &&
                                new Date(t.dataMeta) < now &&
                                new Date(t.dataPrazo) < now;
                        } else {
                            atrasada =
                                (!t.dataAcao || new Date(t.dataAcao) < now) &&
                                (!t.dataMeta || new Date(t.dataMeta) < now) &&
                                (!t.dataPrazo || new Date(t.dataPrazo) < now);
                        }
                        return atrasada;
                    });
                } else if (filtro.status === "realizada") {
                    lista = lista.filter(t => {
                        if ((t.status || "").toLowerCase() !== "concluída") return false;
                        const dataConclusao = t.dataConclusao ?? t.dataBaixa;
                        if (!dataConclusao) return false;
                        const dt = new Date(dataConclusao);
                        if (t.dataAcao && dt > new Date(t.dataAcao)) return false;
                        if (t.dataMeta && dt > new Date(t.dataMeta)) return false;
                        if (t.dataPrazo && dt > new Date(t.dataPrazo)) return false;
                        return true;
                    });
                } else {
                    lista = lista.filter(t => (t.status || "").toLowerCase() === filtro.status);
                }
            }
        }

        console.log('[DEBUG] Modal - Tarefas após classificação por status:', lista.length);

        const listaPadronizada = lista.map(t => ({
            ...t,
            dataConclusao: t.dataConclusao ?? t.dataBaixa ?? null,
            atividades: Array.isArray(t.atividades) ? t.atividades : [],
            tipo: t.tipo ?? (tipoTarefa === "obrigacoes" ? "obrigacao" : "tarefa"),
            departamento: t.departamento ?? t.departamentoNome ?? "",
        }));

        console.log('[DEBUG] Tipo definido para os itens:', tipoTarefa === "obrigacoes" ? "obrigacao" : "tarefa");
        console.log('[DEBUG] Primeiro item da lista:', listaPadronizada[0]);

        // Só abre o modal se houver itens
        console.log('[DEBUG] Lista padronizada final:', listaPadronizada.length, 'itens');
        console.log('[DEBUG] Dados do modal - quantidade:', listaPadronizada.length);
        console.log('[DEBUG] Primeiros 3 itens:', listaPadronizada.slice(0, 3));

        if (listaPadronizada.length > 0) {
            setSolicitacoesModal(listaPadronizada);
            setTituloModal(titulo);
            setModalAberto(true);
            console.log('[DEBUG] Modal aberto com sucesso');
        } else {
            console.log('[DEBUG] Lista vazia, modal não foi aberto');
        }
    }

    // Funções auxiliares para solicitações
    function isAbertaSolic(t) {
        return (t.status || "").toLowerCase() === "aberta" || (t.status || "").toLowerCase() === "pendente";
    }
    function isAtrasadaSolic(t) {
        if (!["pendente", "aberta"].includes((t.status || "").toLowerCase())) return false;
        const now = new Date();
        if (t.dataAcao && t.dataMeta && t.dataPrazo) {
            return new Date(t.dataAcao) < now && new Date(t.dataMeta) < now && new Date(t.dataPrazo) < now;
        } else {
            return (
                (!t.dataAcao || new Date(t.dataAcao) < now) &&
                (!t.dataMeta || new Date(t.dataMeta) < now) &&
                (!t.dataPrazo || new Date(t.dataPrazo) < now)
            );
        }
    }
    function isRealizadaSolic(t) {
        if ((t.status || "").toLowerCase() !== "concluída") return false;
        const dataConclusao = t.dataConclusao ?? t.dataBaixa;
        if (!dataConclusao) return false;

        // CORREÇÃO: Usar ymd() e lte() para ser consistente com o modal
        const conclusao = ymd(dataConclusao);

        // Realizada = concluída dentro de todos os prazos
        if (t.dataAcao && gt(conclusao, ymd(t.dataAcao))) return false;
        if (t.dataMeta && gt(conclusao, ymd(t.dataMeta))) return false;
        if (t.dataPrazo && gt(conclusao, ymd(t.dataPrazo))) return false;

        return true;
    }
    function isConcluidaNaMetaSolic(t) {
        if ((t.status || "").toLowerCase() !== "concluída") return false;
        const dataConclusao = t.dataConclusao ?? t.dataBaixa;
        if (!dataConclusao || !t.dataMeta) return false;

        // CORREÇÃO: Usar ymd() e lte() para ser consistente com o modal
        const conclusao = ymd(dataConclusao);
        const meta = ymd(t.dataMeta);
        const resultado = lte(conclusao, meta);

        console.log('[DEBUG] isConcluidaNaMetaSolic:', {
            id: t.id,
            dataConclusao: dataConclusao,
            dataMeta: t.dataMeta,
            conclusao: conclusao,
            meta: meta,
            resultado: resultado,
            explicacao: resultado ? 'ATÉ A META' : 'FORA DA META'
        });

        return resultado;
    }
    function isConcluidaForaMetaSolic(t) {
        if ((t.status || "").toLowerCase() !== "concluída") return false;
        const dataConclusao = t.dataConclusao ?? t.dataBaixa;
        if (!dataConclusao || !t.dataMeta || !t.dataPrazo) return false;
        // CORREÇÃO: Usar ymd() para comparar apenas a data (ignorar horário)
        // Fora da meta = passou da meta, mas NÃO passou do prazo
        // Igualdade conta como dentro do prazo/meta (não é "fora")
        return gt(ymd(dataConclusao), ymd(t.dataMeta))
            && lt(ymd(dataConclusao), ymd(t.dataPrazo));
    }
    function isConcluidaForaPrazoSolic(t) {
        if ((t.status || "").toLowerCase() !== "concluída") return false;
        const dataConclusao = t.dataConclusao ?? t.dataBaixa;
        if (!dataConclusao || !t.dataPrazo) return false;
        // CORREÇÃO: Usar ymd() para comparar apenas a data (ignorar horário)
        // Após prazo = estritamente maior que o prazo (igualdade NÃO é atraso)
        return gt(ymd(dataConclusao), ymd(t.dataPrazo));
    }

    // Filtro status igual ao painel de controle
    function filtrarResultados(
        resultados,
        status,
        tipoTarefa,
        campoDataBase,
        campoData
    ) {
        // Se for por data de conclusão, filtra só concluídos
        if (campoData === "dataConclusao") {
            // Status possíveis para concluídos
            const statusConcluidos = [
                "realizada",
                "concluída",
                "concluido",
                "concluida_na_meta",
                "concluida_fora_meta",
                "concluida_fora_prazo"
            ];
            resultados = resultados.filter(item => {
                const s = (item.status || "").toLowerCase();
                return (
                    statusConcluidos.includes(s) ||
                    (tipoTarefa === "obrigacoes" && (
                        isRealizadaObr(item, campoDataBase) ||
                        isConcluidaNaMetaObr(item, campoDataBase) ||
                        isConcluidaForaMetaObr(item, campoDataBase) ||
                        isConcluidaAposPrazoObr(item, campoDataBase)
                    ))
                );
            });
        }
        if (!status[0] || status[0] === "") return resultados;
        const now = new Date();

        // *** Cópia fiel das funções de agrupamento para não dar divergência ***
        function isAberta(item) {
            if (!["pendente", "aberta"].includes((item.status || "").toLowerCase())) return false;
            if (item.dataAcao && item.dataMeta && item.dataPrazo) {
                return (
                    new Date(item.dataAcao) >= now ||
                    new Date(item.dataMeta) >= now ||
                    new Date(item.dataPrazo) >= now
                );
            } else {
                // Só compara as datas existentes
                return (
                    (!item.dataAcao || new Date(item.dataAcao) >= now) ||
                    (!item.dataMeta || new Date(item.dataMeta) >= now) ||
                    (!item.dataPrazo || new Date(item.dataPrazo) >= now)
                );
            }
        }

        function isAtrasada(item) {
            if (!["pendente", "aberta"].includes((item.status || "").toLowerCase())) return false;
            if (item.dataAcao && item.dataMeta && item.dataPrazo) {
                return (
                    new Date(item.dataAcao) < now &&
                    new Date(item.dataMeta) < now &&
                    new Date(item.dataPrazo) < now
                );
            } else {
                return (
                    (!item.dataAcao || new Date(item.dataAcao) < now) &&
                    (!item.dataMeta || new Date(item.dataMeta) < now) &&
                    (!item.dataPrazo || new Date(item.dataPrazo) < now)
                );
            }
        }

        function isRealizadaDentroDoPrazoTotal(item) {
            if ((item.status || "").toLowerCase() !== "concluída") return false;
            const dataConclusao = item.dataConclusao ?? item.dataBaixa;
            if (!dataConclusao) return false;
            const dt = new Date(dataConclusao);
            if (item.dataAcao && dt > new Date(item.dataAcao)) return false;
            if (item.dataMeta && dt > new Date(item.dataMeta)) return false;
            if (item.dataPrazo && dt > new Date(item.dataPrazo)) return false;
            return true;
        }

        function isConcluidaAteMeta(item) {
            if ((item.status || "").toLowerCase() !== "concluída") return false;
            const dataConclusao = item.dataConclusao ?? item.dataBaixa;
            if (!dataConclusao || !item.dataMeta) return false;
            // CORREÇÃO: Usar ymd() para comparar apenas a data (ignorar horário)
            return lte(ymd(dataConclusao), ymd(item.dataMeta));
        }

        function isConcluidaForaMeta(item) {
            if ((item.status || "").toLowerCase() !== "concluída") return false;
            const dataConclusao = item.dataConclusao ?? item.dataBaixa;
            if (!dataConclusao || !item.dataMeta || !item.dataPrazo) return false;
            // CORREÇÃO: Usar ymd() para comparar apenas a data (ignorar horário)
            // Fora da meta = passou da meta, mas NÃO passou do prazo
            // Igualdade conta como dentro do prazo/meta (não é "fora")
            return gt(ymd(dataConclusao), ymd(item.dataMeta))
                && lt(ymd(dataConclusao), ymd(item.dataPrazo));
        }

        function isConcluidaAposPrazo(item) {
            if ((item.status || "").toLowerCase() !== "concluída") return false;
            const dataConclusao = item.dataConclusao ?? item.dataBaixa;
            if (!dataConclusao || !item.dataPrazo) return false;
            // CORREÇÃO: Usar ymd() para comparar apenas a data (ignorar horário)
            // Após prazo = estritamente maior que o prazo (igualdade NÃO é atraso)
            return gt(ymd(dataConclusao), ymd(item.dataPrazo));
        }

        // Filtro fiel às colunas!
        switch (status[0]) {
            case "aberta":
                return resultados.filter(isAberta);
            case "atrasada":
                return resultados.filter(isAtrasada);
            case "realizada":
            case "concluída":
                return resultados.filter(isRealizadaDentroDoPrazoTotal);
            case "concluida_na_meta":
                return resultados.filter(isConcluidaAteMeta);
            case "concluida_fora_prazo":
                return resultados.filter(isConcluidaAposPrazo);
            case "concluida_fora_meta":
                return resultados.filter(isConcluidaForaMeta);
            default:
                return resultados.filter((t) => (t.status || "").toLowerCase() === status[0]);
        }
    }

    // Funções ESPECÍFICAS para obrigações
    function todayYMD() {
        return ymd(new Date().toISOString());
    }

    function isAbertaObr(item, campoDataBase) {
        if ((item.status || "").toLowerCase() !== "pendente") return false;
        const now = todayYMD();
        const base = item[campoDataBase] ?? null;
        if (base) return gte(base, now);
        // Fallback
        const acao = item.dataAcao ?? null;
        const meta = item.dataMeta ?? null;
        const venc = item.vencimento ?? null;
        return (!acao || gte(acao, now)) || (!meta || gte(meta, now)) || (!venc || gte(venc, now));
    }

    function isAtrasadaObr(item, campoDataBase) {
        if ((item.status || "").toLowerCase() !== "pendente") return false;
        const now = todayYMD();
        const base = item[campoDataBase] ?? null;
        if (base) return lt(base, now);
        const acao = item.dataAcao ?? null;
        const meta = item.dataMeta ?? null;
        const venc = item.vencimento ?? null;
        // "Alguma delas já passou" → atrasou
        return (acao && lt(acao, now)) || (meta && lt(meta, now)) || (venc && lt(venc, now));
    }

    function isRealizadaObr(item, campoDataBase) {
        if (!statusConcluidaObr(item.status)) return false;

        const dtEnt = item.dataEntregaFinal ?? item.dataBaixa ?? null;
        if (!dtEnt) return false;

        const base = item[campoDataBase] ?? null; // pode ser meta ou vencimento
        const acao = item.dataAcao ?? null;
        const meta = item.dataMeta ?? null;
        const venc = item.vencimento ?? null;

        // Se houve escolha de base (ex.: "dataMeta" ou "vencimento"), respeite-a
        if (base) return lte(dtEnt, base);

        // Caso padrão: "realizada" significa concluída até TODAS as datas existentes
        // (igualdade conta como dentro do prazo/meta)
        const okAcao = !acao || lte(dtEnt, acao);
        const okMeta = !meta || lte(dtEnt, meta);
        const okVenc = !venc || lte(dtEnt, venc);
        return okAcao && okMeta && okVenc;
    }

    function isConcluidaNaMetaObr(item, campoDataBase) {
        if (!statusConcluidaObr(item.status)) return false;

        const dtEnt = item.dataEntregaFinal ?? item.dataBaixa ?? null;
        const meta = item.dataMeta ?? null;
        if (!dtEnt || !meta) return false;

        // Se a base for "dataMeta", use-a explicitamente
        if (campoDataBase === "dataMeta" && item[campoDataBase]) {
            return lte(dtEnt, item[campoDataBase]);
        }
        return lte(dtEnt, meta);
    }

    function isConcluidaForaMetaObr(item, campoDataBase) {
        if (!statusConcluidaObr(item.status)) return false;

        const dtEnt = item.dataEntregaFinal ?? item.dataBaixa ?? null;
        const meta = item.dataMeta ?? null;
        const venc = item.vencimento ?? null;
        if (!dtEnt || !meta || !venc) return false;

        // Fora da meta = passou da meta, mas NÃO passou do prazo.
        // Igual ao prazo conta como fora da meta (e não atraso).
        if (campoDataBase === "dataMeta" && item[campoDataBase]) {
            return gt(dtEnt, item[campoDataBase]) && lte(dtEnt, venc);
        }
        return gt(dtEnt, meta) && lte(dtEnt, venc);
    }

    function isConcluidaAposPrazoObr(item, campoDataBase) {
        if (!statusConcluidaObr(item.status)) return false;

        const dtEnt = item.dataEntregaFinal ?? item.dataBaixa ?? null;
        const venc = item.vencimento ?? null;
        if (!dtEnt || !venc) return false; // <<< nunca considerar "após prazo" sem os 2 lados

        // DEBUG: Log para verificar a lógica de obrigações
        const resultado = gt(dtEnt, venc);
        console.log('[DEBUG] isConcluidaAposPrazoObr:', {
            id: item.id,
            dataEntrega: dtEnt,
            vencimento: venc,
            campoDataBase: campoDataBase,
            resultado: resultado,
            explicacao: resultado ? 'APÓS PRAZO' : 'DENTRO DO PRAZO'
        });

        // Após prazo = estritamente maior que o prazo (igualdade NÃO é atraso)
        if (campoDataBase === "dataMeta" && item[campoDataBase]) {
            // A base não muda o critério de atraso; só garante que "igual" não jogue para cá
            return resultado;
        }
        return resultado;
    }


    // ADICIONE ESTA NOVA FUNÇÃO
    async function buscarBaixasDiarias() {
        if (!periodoInicioBaixas || !periodoFimBaixas) return;

        setLoadingBaixas(true);
        setErrorBaixas(null);

        const token = getToken();
        const empresaId = getEmpresaId();

        if (!empresaId || !token) {
            setErrorBaixas("Token ou empresa não encontrados");
            setLoadingBaixas(false);
            return;
        }

        try {
            // Buscar baixas diárias (formato ideal: agrupadas por data)
            console.log('[DEBUG] Estado atual:', {
                empresaId,
                periodoInicio: periodoInicioBaixas,
                periodoFim: periodoFimBaixas,
                departamentos,
                usuariosSelecionados,
                colaboradoresList: colaboradoresList.map(c => ({ id: c.id, nome: c.nome }))
            });

            const resBaixas = await fetch(`${BASE_URL}/gestao/relatorios/baixas-diarias`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                    "X-Empresa-Id": empresaId,
                    "empresaid": empresaId
                },
                body: JSON.stringify({
                    empresaId,
                    periodoInicio: periodoInicioBaixas,
                    periodoFim: periodoFimBaixas,
                    departamentos: departamentos,
                    usuarios: usuariosSelecionados
                })
            });

            const baixasData = await resBaixas.json();

            console.log('[DEBUG] Resposta do backend:', baixasData);

            // NOVO: Se o backend retornar no formato ideal (agrupado por data)
            if (baixasData.baixasPorData) {
                setBaixasPorData(baixasData.baixasPorData);
                setUniversoResumo(baixasData.universoResumo || []);
                setBaixasAgrupadas([]); // Limpar formato legado
                setLoadingBaixas(false);
                return;
            }

            // LEGADO: Processar formato antigo se necessário
            setBaixasDiarias(baixasData.baixasAgrupadas || []);

            // Buscar tarefas restantes (pendentes) até o período fim
            const resRestantes = await fetch(`${BASE_URL}/gestao/relatorios/empresa/${empresaId}/pendentes-mes?periodoFim=${periodoFimBaixas}&departamentos=${departamentos.join(',')}&usuarios=${usuariosSelecionados.join(',')}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "X-Empresa-Id": empresaId,
                    "empresaid": empresaId
                }
            });

            const restantesData = await resRestantes.json();

            // Processar e agrupar as baixas para o relatório
            const agrupadas = processarBaixasAgrupadas(
                baixasData.baixasAgrupadas || [],
                restantesData.pendentesAgrupados || []
            );
            setBaixasAgrupadas(agrupadas);
        } catch (err) {
            console.error("Erro ao buscar baixas diárias:", err);
            setErrorBaixas(err.response?.data?.error || "Erro ao buscar baixas diárias");
        } finally {
            setLoadingBaixas(false);
        }
    }

    // ADICIONE ESTA FUNÇÃO PARA PROCESSAR E AGRUPAR AS BAIXAS
    function processarBaixasAgrupadas(dados, tarefasRestantes = []) {
        const agrupadas = [];

        dados.forEach(dept => {
            dept.usuarios.forEach(user => {
                // APLICAR FILTRO DE USUÁRIOS SE HOUVER SELEÇÃO
                if (usuariosSelecionados.length > 0 && !usuariosSelecionados.includes(user.usuarioId)) {
                    return; // Pular este usuário se não estiver selecionado
                }
                // Agrupar por obrigação E POR DIA
                const obrigacoesPorDiaMap = new Map();

                user.baixas.forEach(baixa => {
                    const obrigacaoId = baixa.obrigacaoId;
                    const clienteNome = baixa.clienteNome || 'Cliente não identificado';

                    const dataConclusao = baixa.dataConclusao.split('T')[0]; // Pega só a data (YYYY-MM-DD)

                    // Chave única: obrigacaoId + data
                    const chave = `${obrigacaoId}-${dataConclusao}`;

                    if (!obrigacoesPorDiaMap.has(chave)) {
                        obrigacoesPorDiaMap.set(chave, {
                            obrigacaoNome: baixa.obrigacaoNome || 'Obrigação não identificada',
                            quantidade: 0,
                            clientes: new Set(),
                            dataConclusao: dataConclusao
                        });
                    }

                    const obrigacao = obrigacoesPorDiaMap.get(chave);
                    obrigacao.quantidade += 1;
                    obrigacao.clientes.add(clienteNome);
                });

                // Converter para o formato final
                obrigacoesPorDiaMap.forEach((obrigacao, chave) => {
                    const [obrigacaoId, dataConclusao] = chave.split('-');

                    // Calcular tarefas restantes para este usuário e obrigação
                    let tarefasRestantesCount = 0;

                    // Procurar nas tarefas restantes agrupadas por departamento
                    const deptRestantes = tarefasRestantes.find((d) => d.departamentoId === dept.departamentoId);
                    if (deptRestantes) {
                        // Procurar pelo usuário neste departamento
                        const userRestantes = deptRestantes.usuarios.find((u) => u.usuarioId === user.usuarioId);
                        if (userRestantes) {
                            // Contar obrigações pendentes para esta obrigação específica
                            tarefasRestantesCount = userRestantes.obrigacoes.filter((obr) =>
                                obr.obrigacaoId === parseInt(obrigacaoId)
                            ).length;
                        }
                    }

                    agrupadas.push({
                        departamentoId: dept.departamentoId,
                        departamentoNome: dept.departamentoNome,
                        usuarioId: user.usuarioId,
                        usuarioNome: user.usuarioNome,
                        obrigacaoId: parseInt(obrigacaoId),
                        obrigacaoNome: obrigacao.obrigacaoNome,
                        quantidade: obrigacao.quantidade,
                        tarefasRestantes: tarefasRestantesCount,
                        clientes: Array.from(obrigacao.clientes).sort(),
                        datasConclusao: [obrigacao.dataConclusao] // Array com apenas uma data
                    });
                });
            });
        });

        // ORDENAR POR DATA DE CONCLUSÃO (mais antiga primeiro)
        agrupadas.sort((a, b) => {
            const dataA = new Date(a.datasConclusao[0]).getTime();
            const dataB = new Date(b.datasConclusao[0]).getTime();
            return dataA - dataB;
        });

        return agrupadas;
    }

    function agruparPorDepartamento(dados, departamentosList, campoDataBase, campoData) {
        const mapIdNome = Object.fromEntries(departamentosList.map(dep => [dep.id, dep.nome]));
        const resumo = {};
        dados.forEach((item) => {
            const depId = Number(item.departamentoId) || 0;
            if (!resumo[depId]) {
                resumo[depId] = {
                    departamentoId: depId,
                    departamentoNome: mapIdNome[depId] || "-",
                    qtdTotal: 0,
                    qtdAbertas: 0,
                    qtdAtrasadas: 0,
                    qtdConcluidasNaMeta: 0,
                    qtdConcluidasForaMeta: 0,
                    qtdConcluidasAposPrazo: 0,
                    qtdRealizadas: 0,
                };
            }
            if (campoData === "dataConclusao") {
                // CORREÇÃO: Usar as funções corretas baseadas no tipoTarefa
                if (tipoTarefa === "obrigacoes") {
                    // Para obrigações: usar funções de obrigações
                    if (isRealizadaObr(item, campoDataBase)) resumo[depId].qtdRealizadas += 1;
                    else if (isConcluidaNaMetaObr(item, campoDataBase)) resumo[depId].qtdConcluidasNaMeta += 1;
                    else if (isConcluidaForaMetaObr(item, campoDataBase)) resumo[depId].qtdConcluidasForaMeta += 1;
                    else if (isConcluidaAposPrazoObr(item, campoDataBase)) resumo[depId].qtdConcluidasAposPrazo += 1;
                } else {
                    // Para solicitações: usar funções de solicitações
                    if (isRealizadaSolic(item)) resumo[depId].qtdRealizadas += 1;
                    else if (isConcluidaNaMetaSolic(item)) resumo[depId].qtdConcluidasNaMeta += 1;
                    else if (isConcluidaForaMetaSolic(item)) resumo[depId].qtdConcluidasForaMeta += 1;
                    else if (isConcluidaForaPrazoSolic(item)) resumo[depId].qtdConcluidasAposPrazo += 1;
                }
                // O total é a soma das concluídas
                resumo[depId].qtdTotal = resumo[depId].qtdRealizadas + resumo[depId].qtdConcluidasNaMeta + resumo[depId].qtdConcluidasForaMeta + resumo[depId].qtdConcluidasAposPrazo;
                // Abertas e atrasadas sempre zero (não incrementar nunca)
                resumo[depId].qtdAbertas = 0;
                resumo[depId].qtdAtrasadas = 0;
            } else if (tipoTarefa === "obrigacoes") {
                if (isAtrasadaObr(item, campoDataBase)) resumo[depId].qtdAtrasadas += 1;
                else if (isAbertaObr(item, campoDataBase)) resumo[depId].qtdAbertas += 1;
                else if (isRealizadaObr(item, campoDataBase)) resumo[depId].qtdRealizadas += 1;
                else if (isConcluidaNaMetaObr(item, campoDataBase)) resumo[depId].qtdConcluidasNaMeta += 1;
                else if (isConcluidaForaMetaObr(item, campoDataBase)) resumo[depId].qtdConcluidasForaMeta += 1;
                else if (isConcluidaAposPrazoObr(item, campoDataBase)) resumo[depId].qtdConcluidasAposPrazo += 1;
                resumo[depId].qtdTotal += 1;
            } else {
                console.log('[DEBUG] Classificando solicitação:', {
                    id: item.id,
                    status: item.status,
                    dataConclusao: item.dataConclusao || item.dataBaixa,
                    dataMeta: item.dataMeta,
                    dataPrazo: item.dataPrazo
                });

                if (isAtrasadaSolic(item)) {
                    console.log('[DEBUG] ✅ Classificado como ATRAÇADA');
                    resumo[depId].qtdAtrasadas += 1;
                }
                else if (isAbertaSolic(item)) {
                    console.log('[DEBUG] ✅ Classificado como ABERTA');
                    resumo[depId].qtdAbertas += 1;
                }
                else if (isConcluidaNaMetaSolic(item)) {
                    console.log('[DEBUG] ✅ Classificado como CONCLUÍDA ATÉ A META');
                    resumo[depId].qtdConcluidasNaMeta += 1; // PRIMEIRO: verificar se está dentro da meta (inclui igualdade)
                }
                else if (isConcluidaForaPrazoSolic(item)) {
                    console.log('[DEBUG] ✅ Classificado como CONCLUÍDA APÓS PRAZO');
                    resumo[depId].qtdConcluidasAposPrazo += 1; // DEPOIS: verificar se passou do prazo
                }
                else if (isConcluidaForaMetaSolic(item)) {
                    console.log('[DEBUG] ✅ Classificado como CONCLUÍDA FORA DA META');
                    resumo[depId].qtdConcluidasForaMeta += 1; // POR ÚLTIMO: verificar se passou da meta mas não do prazo
                }
                else if (isRealizadaSolic(item)) {
                    console.log('[DEBUG] ✅ Classificado como REALIZADA');
                    resumo[depId].qtdRealizadas += 1; // POR ÚLTIMO: verificar se foi realizada dentro de todos os prazos
                }
                else {
                    console.log('[DEBUG] ❌ NÃO foi classificado por nenhuma função!');
                }
                resumo[depId].qtdTotal += 1;
            }
        });
        return Object.values(resumo).filter((dados) => dados.qtdTotal > 0);
    }

    // Função para abrir modal de baixas diárias (formato legado)
    function abrirModalBaixas(item) {
        // Buscar as baixas detalhadas para este item específico
        const baixasDetalhadas = baixasDiarias
            .find(dept => dept.departamentoId === item.departamentoId)
            ?.usuarios.find(user => user.usuarioId === item.usuarioId)
            ?.baixas.filter(baixa => baixa.obrigacaoId === item.obrigacaoId) || [];

        // Converter para o formato esperado pelo modal
        const baixasParaModal = baixasDetalhadas.map(baixa => ({
            id: baixa.obrigacaoClienteId,
            status: "concluída",
            departamento: item.departamentoNome,
            departamentoNome: item.departamentoNome,
            nome: baixa.obrigacaoClienteNome,
            cliente_nome: baixa.clienteNome,
            clienteId: baixa.clienteId,
            dataBaixa: baixa.dataConclusao,
            dataConclusao: baixa.dataConclusao,
            dataAcao: baixa.dataMeta ? new Date(baixa.dataMeta).toISOString().split('T')[0] : '', // Usando data da meta como ação (ou vazio se não houver)
            dataMeta: baixa.dataMeta,
            vencimento: baixa.dataPrazo,
            status_cliente: "Ativo", // Definindo status do cliente como "ativo"
            tipo: "obrigacao",
            atividades: [],
            baixadaAutomaticamente: 0,
            categoria: "Concluída"
        }));

        setBaixasModal(baixasParaModal);
        setTituloModalBaixas(`Baixas de ${item.obrigacaoNome} - ${(item.concluidoPorNome || item.usuarioNome)} (${item.departamentoNome})`);
        setModalBaixasAberto(true);
    }

    // NOVA FUNÇÃO: Para abrir modal de baixas usando formato agrupado por data
    function abrirModalBaixasPorData(data, baixa) {
        // Buscar todas as baixas que correspondem aos critérios
        const baixasParaModal = [];

        // Procurar em baixasPorData por todas as baixas que correspondem
        baixasPorData.forEach(grupoData => {
            if (grupoData.data === data) {
                grupoData.itens.forEach(b => {
                    // Se é o mesmo usuário, obrigação e departamento
                    if (b.usuarioId === baixa.usuarioId &&
                        b.obrigacaoId === baixa.obrigacaoId &&
                        b.departamentoId === baixa.departamentoId) {

                        // Se tem quantidade > 0, criar um item para cada cliente
                        if (b.quantidade > 0) {
                            // Se tem tarefasRestantesDetalhes, usar os dados reais
                            if (b.tarefasRestantesDetalhes && b.tarefasRestantesDetalhes.length > 0) {
                                b.tarefasRestantesDetalhes.forEach((cliente) => {
                                    baixasParaModal.push({
                                        id: cliente.obrigacaoClienteId,
                                        status: "concluída",
                                        departamento: b.departamentoNome,
                                        departamentoNome: b.departamentoNome,
                                        nome: cliente.obrigacaoClienteNome,
                                        cliente_nome: cliente.clienteNome,
                                        clienteId: cliente.clienteId,
                                        dataBaixa: data,
                                        dataConclusao: data,
                                        dataAcao: cliente.obrigacaoAcao,
                                        dataMeta: cliente.meta,
                                        vencimento: cliente.vencimento,
                                        status_cliente: "Ativo",
                                        tipo: "obrigacao",
                                        atividades: [],
                                        baixadaAutomaticamente: 0,
                                        categoria: "Concluída"
                                    });
                                });
                            } else {
                                // Fallback: criar um item genérico
                                baixasParaModal.push({
                                    id: b.obrigacaoClienteId || 0,
                                    status: "concluída",
                                    departamento: b.departamentoNome,
                                    departamentoNome: b.departamentoNome,
                                    nome: b.obrigacaoClienteNome || b.obrigacaoNome,
                                    cliente_nome: b.clienteNome || "Cliente não identificado",
                                    clienteId: b.clienteId || 0,
                                    dataBaixa: data,
                                    dataConclusao: data,
                                    dataAcao: b.obrigacaoAcao || data,
                                    dataMeta: data,
                                    vencimento: data,
                                    status_cliente: "Ativo",
                                    tipo: "obrigacao",
                                    atividades: [],
                                    baixadaAutomaticamente: 0,
                                    categoria: "Concluída"
                                });
                            }
                        }
                    }
                });
            }
        });

        setBaixasModal(baixasParaModal);
        setTituloModalBaixas(`Baixas de ${baixa.obrigacaoNome} - ${baixa.usuarioNome} (${baixa.departamentoNome}) - ${new Date(data).toLocaleDateString('pt-BR')} - ${baixasParaModal.length} itens`);
        setModalBaixasAberto(true);
    }

    // NOVA FUNÇÃO: Para abrir modal com tarefas restantes (pendentes)
    function abrirModalTarefasRestantes(baixa, dataVencimento) {
        // Usar os dados que já vêm do backend (tarefasRestantesDetalhes)
        if (baixa.tarefasRestantesDetalhes && baixa.tarefasRestantesDetalhes.length > 0) {
            // Mapear para o formato esperado pelo modal
            const tarefasRestantes = baixa.tarefasRestantesDetalhes.map((item) => ({
                id: item.obrigacaoClienteId,
                status: "pendente",
                departamento: baixa.departamentoNome,
                nome: item.obrigacaoClienteNome,
                cliente_nome: item.clienteNome,
                status_cliente: "Ativo",
                vencimento: item.vencimento,
                responsavel: baixa.usuarioNome,
                atividades: [],
                tipo: "obrigacao",
                dataAcao: item.obrigacaoAcao,
                dataMeta: item.meta,
                dataBaixa: null,
                dataConclusao: null
            }));

            setSolicitacoesModal(tarefasRestantes);
            setTituloModal(`Tarefas Restantes - ${baixa.obrigacaoNome} - ${baixa.usuarioNome} - ${dataVencimento.split('-').reverse().join('/')}`);
            setModalAberto(true);
        } else {
            alert("Nenhuma tarefa restante encontrada para esta obrigação.");
        }
    }

    // Função para filtrar localmente (pode melhorar para mais campos)
    function filtrarLocal(e) {
        e.preventDefault();

        // Impede buscar sem dados carregados
        if (
            loading ||
            (tipoTarefa === "solicitacoes" && allTarefas.length === 0) ||
            (tipoTarefa === "obrigacoes" && allObrigacoes.length === 0)
        ) {
            setError("Espere os dados carregarem para buscar.");
            return;
        }

        setLoadingBusca(true);
        setError(null);
        setJaBuscou(true);

        // Aguarda o React mostrar o "Buscando..." ANTES de travar com o filtro pesado!
        setTimeout(() => {
            let dados = [...(tipoTarefa === "obrigacoes" ? allObrigacoes : allTarefas)];

            console.log('[DEBUG] filtrarLocal - Início:', {
                tipoTarefa,
                campoData,
                periodoInicial,
                periodoFinal,
                totalInicial: dados.length,
                allTarefas: allTarefas.length,
                allObrigacoes: allObrigacoes.length
            });

            // IMPORTANTE: DEPARTAMENTO SEMPRE é aplicado primeiro!
            // Filtrar por departamento sempre que estiver selecionado
            if (departamentos.length > 0) {
                const antes = dados.length;
                dados = dados.filter(o => departamentos.includes(Number(o.departamentoId)));
                console.log('[DEBUG] Filtro departamento:', antes, '->', dados.length);
            }

            // Depois filtrar por colaborador (se selecionado)
            if (colaboradores.length > 0) {
                if (tipoTarefa === "obrigacoes") {
                    // Para obrigações, filtrar baseado na tabela obrigacoes_clientes_responsaveis
                    dados = dados.filter(o => {
                        // Se não tem id (obrigacaoClienteId), não pode ser filtrado por usuário
                        if (!o.id) return false;

                        // Verificar se esta obrigação tem algum dos usuários selecionados como responsável
                        const obrigacaoClienteId = o.id;
                        if (!obrigacoesPorUsuario[obrigacaoClienteId]) return false;

                        // Verificar se algum dos usuários selecionados está na lista de responsáveis
                        return obrigacoesPorUsuario[obrigacaoClienteId].some(usuarioId =>
                            colaboradores.includes(usuarioId)
                        );
                    });
                } else {
                    // Para solicitações, usar o campo responsavelId direto
                    dados = dados.filter(o => colaboradores.includes(Number(o.responsavelId)));
                }
            }

            if (cliente) {
                dados = dados.filter(o => String(o.clienteId) === cliente);
            }
            if (periodoInicial) {
                const antes = dados.length;
                if (campoData === "dataConclusao") {
                    // CORREÇÃO: Quando o campo é "Data Conclusão", filtrar por dataConclusao/dataBaixa
                    dados = dados.filter(o => {
                        const dataConclusao = o.dataConclusao || o.dataBaixa;
                        const resultado = dataConclusao && new Date(dataConclusao) >= new Date(periodoInicial + "T00:00:00");
                        return resultado;
                    });
                    console.log('[DEBUG] Filtro período inicial (dataConclusao):', antes, '->', dados.length);
                } else if (tipoTarefa === "solicitacoes") {
                    // Para solicitações: filtrar por dataAcao, dataMeta e dataPrazo
                    dados = dados.filter(o => {
                        const dataAcao = o.dataAcao && new Date(o.dataAcao) >= new Date(periodoInicial + "T00:00:00");
                        const dataMeta = o.dataMeta && new Date(o.dataMeta) >= new Date(periodoInicial + "T00:00:00");
                        const dataPrazo = o.dataPrazo && new Date(o.dataPrazo) >= new Date(periodoInicial + "T00:00:00");
                        return dataAcao || dataMeta || dataPrazo;
                    });
                    console.log('[DEBUG] Filtro período inicial (solicitacoes):', antes, '->', dados.length);
                } else {
                    // Para obrigações: usar o campo selecionado (comportamento atual)
                    dados = dados.filter(o => {
                        const dt = o[campoDataMap[campoData]];
                        return dt && new Date(dt) >= new Date(periodoInicial + "T00:00:00");
                    });
                    console.log('[DEBUG] Filtro período inicial (obrigacoes):', antes, '->', dados.length);
                }
            }
            if (periodoFinal) {
                const antes = dados.length;
                if (campoData === "dataConclusao") {
                    // CORREÇÃO: Quando o campo é "Data Conclusão", filtrar por dataConclusao/dataBaixa
                    dados = dados.filter(o => {
                        const dataConclusao = o.dataConclusao || o.dataBaixa;
                        const resultado = dataConclusao && new Date(dataConclusao) <= new Date(periodoFinal + "T23:59:59");
                        return resultado;
                    });
                    console.log('[DEBUG] Filtro período final (dataConclusao):', antes, '->', dados.length);
                } else if (tipoTarefa === "solicitacoes") {
                    // Para solicitações: filtrar por dataAcao, dataMeta e dataPrazo
                    dados = dados.filter(o => {
                        const dataAcao = o.dataAcao && new Date(o.dataAcao) <= new Date(periodoFinal + "T23:59:59");
                        const dataMeta = o.dataMeta && new Date(o.dataMeta) <= new Date(periodoFinal + "T00:00:00");
                        const dataPrazo = o.dataPrazo && new Date(o.dataPrazo) <= new Date(periodoFinal + "T23:59:59");
                        return dataAcao || dataMeta || dataPrazo;
                    });
                    console.log('[DEBUG] Filtro período final (solicitacoes):', antes, '->', dados.length);
                } else {
                    // Para obrigações: usar o campo selecionado (comportamento atual)
                    dados = dados.filter(o => {
                        const dt = o[campoDataMap[campoData]];
                        return dt && new Date(dt) <= new Date(periodoFinal + "T23:59:59");
                    });
                    console.log('[DEBUG] Filtro período final (obrigacoes):', antes, '->', dados.length);
                }
            }
            if (obrigacoes.length > 0) {
                dados = dados.filter(o => obrigacoes.includes(Number(o.obrigacaoId)));
            }
            if (grupos.length > 0) {
                // IMPORTANTE: Se há grupos selecionados, usar os dados já filtrados pelo backend!
                // O backend já retorna apenas as obrigações dos clientes dos grupos selecionados
                console.log('[Grupos] Usando dados filtrados por grupo do backend');

                // Se temos dados filtrados por grupo, usar eles diretamente
                if (dadosPorGrupo.length > 0) {
                    // Extrair todas as obrigações dos grupos selecionados
                    const obrigacoesDosGrupos = [];
                    dadosPorGrupo.forEach(grupo => {
                        grupo.clientes.forEach((cliente) => {
                            cliente.obrigacoes.forEach((obrigacao) => {
                                obrigacoesDosGrupos.push({
                                    ...obrigacao,
                                    clienteId: cliente.clienteId,
                                    departamentoId: obrigacao.departamentoId, // USAR O DEPARTAMENTO REAL DO BACKEND!
                                    departamentoNome: obrigacao.departamentoNome, // INCLUIR O NOME TAMBÉM!
                                    obrigacaoId: obrigacao.obrigacaoId || 0
                                });
                            });
                        });
                    });

                    // Substituir os dados pelos dados filtrados por grupo
                    dados = obrigacoesDosGrupos;
                    console.log(`[Grupos] Dados filtrados por grupo: ${dados.length} obrigações`);
                } else {
                    // IMPORTANTE: Se grupo não retorna obrigações, deixar dados vazios (zerado no relatório)
                    console.log('[Grupos] Grupo selecionado não retornou obrigações - relatório ficará zerado');
                    dados = []; // Array vazio = relatório com zeros
                }
            }
            console.log('[DEBUG] Dados antes de filtrarResultados:', dados.length);

            const campoDataBase = campoDataMap[campoData];
            const dadosFiltrados = filtrarResultados(dados, status, tipoTarefa, campoDataBase, campoData);
            console.log('[DEBUG] Dados após filtrarResultados:', dadosFiltrados.length);

            const agrupados = agruparPorDepartamento(dadosFiltrados, departamentosList, campoDataBase, campoData);
            console.log('[DEBUG] Dados agrupados:', agrupados.length);

            setResultados(agrupados);
            setLoadingBusca(false);
        }, 0);
    }


    // [1] CÁLCULO DOS TOTAIS (fora do .map!)
    const totais = resultados.reduce(
        (acc, item) => {
            if (campoData === "dataConclusao") {
                acc.qtdRealizadas += item.qtdRealizadas || 0;
                acc.qtdConcluidasNaMeta += item.qtdConcluidasNaMeta || 0;
                acc.qtdConcluidasForaMeta += item.qtdConcluidasForaMeta || 0;
                acc.qtdConcluidasAposPrazo += item.qtdConcluidasAposPrazo || 0;
                acc.qtdAbertas = 0;
                acc.qtdAtrasadas = 0;
                acc.qtdTotal = acc.qtdRealizadas + acc.qtdConcluidasNaMeta + acc.qtdConcluidasForaMeta + acc.qtdConcluidasAposPrazo;
            } else {
                acc.qtdTotal += item.qtdTotal || 0;
                acc.qtdAbertas += item.qtdAbertas || 0;
                acc.qtdAtrasadas += item.qtdAtrasadas || 0;
                acc.qtdRealizadas += item.qtdRealizadas || 0;
                acc.qtdConcluidasNaMeta += item.qtdConcluidasNaMeta || 0;
                acc.qtdConcluidasForaMeta += item.qtdConcluidasForaMeta || 0;
                acc.qtdConcluidasAposPrazo += item.qtdConcluidasAposPrazo || 0;
            }
            return acc;
        },
        {
            qtdTotal: 0,
            qtdAbertas: 0,
            qtdAtrasadas: 0,
            qtdRealizadas: 0,
            qtdConcluidasNaMeta: 0,
            qtdConcluidasForaMeta: 0,
            qtdConcluidasAposPrazo: 0,
        }
    );

    // Funções utilitárias para exportação e cópia
    function getExportData(data) {
        return data.map(item => {
            const qtdTotal = item.qtdTotal || 0;
            const perc = (qtd) =>
                qtdTotal > 0 ? ((qtd / qtdTotal) * 100).toFixed(2).replace('.', ',') + " %" : "0,00 %";
            const percTotal = (
                parseFloat(perc(item.qtdAbertas).replace(',', '.')) +
                parseFloat(perc(item.qtdAtrasadas).replace(',', '.')) +
                parseFloat(perc(item.qtdRealizadas).replace(',', '.')) +
                parseFloat(perc(item.qtdConcluidasNaMeta).replace(',', '.')) +
                parseFloat(perc(item.qtdConcluidasForaMeta).replace(',', '.')) +
                parseFloat(perc(item.qtdConcluidasAposPrazo).replace(',', '.'))
            ).toFixed(2).replace('.', ',') + " %";

            return {
                Departamento: item.departamentoNome,
                Total: item.qtdTotal,
                Abertas: item.qtdAbertas,
                Atrasadas: item.qtdAtrasadas,
                Realizadas: item.qtdRealizadas,
                "Concluídas até a Meta": item.qtdConcluidasNaMeta,
                "Concluídas fora da Meta": item.qtdConcluidasForaMeta,
                "Concluídas após Prazo": item.qtdConcluidasAposPrazo,
                "% em Aberto": perc(item.qtdAbertas),
                "% em Atraso": perc(item.qtdAtrasadas),
                "% na Programação": perc(item.qtdRealizadas),
                "% Concluídas até a Meta": perc(item.qtdConcluidasNaMeta),
                "% Concluídas fora da Meta": perc(item.qtdConcluidasForaMeta),
                "% Concluídas após o Prazo": perc(item.qtdConcluidasAposPrazo),
                "% Total": percTotal,
            };
        });
    }

    // NOVA FUNÇÃO: Exportação detalhada com informações individuais
    async function getExportDataDetalhado() {
        // Usar os dados originais filtrados (não os agrupados)
        let dadosOriginais = [...(tipoTarefa === "obrigacoes" ? allObrigacoes : allTarefas)];

        // Aplicar os mesmos filtros que foram aplicados na busca
        if (departamentos.length > 0) {
            dadosOriginais = dadosOriginais.filter(o => departamentos.includes(Number(o.departamentoId)));
        }

        if (colaboradores.length > 0) {
            if (tipoTarefa === "obrigacoes") {
                dadosOriginais = dadosOriginais.filter(o => {
                    if (!o.id) return false;
                    const obrigacaoClienteId = o.id;
                    if (!obrigacoesPorUsuario[obrigacaoClienteId]) return false;
                    return obrigacoesPorUsuario[obrigacaoClienteId].some(usuarioId =>
                        colaboradores.includes(usuarioId)
                    );
                });
            } else {
                dadosOriginais = dadosOriginais.filter(o => colaboradores.includes(Number(o.responsavelId)));
            }
        }

        if (cliente) {
            dadosOriginais = dadosOriginais.filter(o => String(o.clienteId) === cliente);
        }

        if (periodoInicial) {
            if (campoData === "dataConclusao") {
                dadosOriginais = dadosOriginais.filter(o => {
                    const dataConclusao = o.dataConclusao || o.dataBaixa;
                    return dataConclusao && new Date(dataConclusao) >= new Date(periodoInicial + "T00:00:00");
                });
            } else if (tipoTarefa === "solicitacoes") {
                dadosOriginais = dadosOriginais.filter(o => {
                    const dataAcao = o.dataAcao && new Date(o.dataAcao) >= new Date(periodoInicial + "T00:00:00");
                    const dataMeta = o.dataMeta && new Date(o.dataMeta) >= new Date(periodoInicial + "T00:00:00");
                    const dataPrazo = o.dataPrazo && new Date(o.dataPrazo) >= new Date(periodoInicial + "T00:00:00");
                    return dataAcao || dataMeta || dataPrazo;
                });
            } else {
                dadosOriginais = dadosOriginais.filter(o => {
                    const dt = o[campoDataMap[campoData]];
                    return dt && new Date(dt) >= new Date(periodoInicial + "T00:00:00");
                });
            }
        }

        if (periodoFinal) {
            if (campoData === "dataConclusao") {
                dadosOriginais = dadosOriginais.filter(o => {
                    const dataConclusao = o.dataConclusao || o.dataBaixa;
                    return dataConclusao && new Date(dataConclusao) <= new Date(periodoFinal + "T23:59:59");
                });
            } else if (tipoTarefa === "solicitacoes") {
                dadosOriginais = dadosOriginais.filter(o => {
                    const dataAcao = o.dataAcao && new Date(o.dataAcao) <= new Date(periodoFinal + "T23:59:59");
                    const dataMeta = o.dataMeta && new Date(o.dataMeta) <= new Date(periodoFinal + "T00:00:00");
                    const dataPrazo = o.dataPrazo && new Date(o.dataPrazo) <= new Date(periodoFinal + "T23:59:59");
                    return dataAcao || dataMeta || dataPrazo;
                });
            } else {
                dadosOriginais = dadosOriginais.filter(o => {
                    const dt = o[campoDataMap[campoData]];
                    return dt && new Date(dt) <= new Date(periodoFinal + "T23:59:59");
                });
            }
        }

        if (obrigacoes.length > 0) {
            dadosOriginais = dadosOriginais.filter(o => obrigacoes.includes(Number(o.obrigacaoId)));
        }

        if (grupos.length > 0) {
            if (dadosPorGrupo.length > 0) {
                const obrigacoesDosGrupos = [];
                dadosPorGrupo.forEach(grupo => {
                    grupo.clientes.forEach((cliente) => {
                        cliente.obrigacoes.forEach((obrigacao) => {
                            obrigacoesDosGrupos.push({
                                ...obrigacao,
                                clienteId: cliente.clienteId,
                                departamentoId: obrigacao.departamentoId,
                                departamentoNome: obrigacao.departamentoNome,
                                obrigacaoId: obrigacao.obrigacaoId || 0
                            });
                        });
                    });
                });
                dadosOriginais = obrigacoesDosGrupos;
            } else {
                dadosOriginais = [];
            }
        }

        // Aplicar filtro de status
        const campoDataBase = campoDataMap[campoData];
        dadosOriginais = filtrarResultados(dadosOriginais, status, tipoTarefa, campoDataBase, campoData);

        // Buscar comentários em lote
        let comentariosMap = {};
        if (dadosOriginais.length > 0) {
            try {
                const token = getToken();
                if (token) {
                    const ids = dadosOriginais.map(item => item.id).filter(id => id);
                    if (ids.length > 0) {
                        const endpoint = tipoTarefa === "obrigacoes"
                            ? `${BASE_URL}/gestao/obrigacoes/comentarios/lote`
                            : `${BASE_URL}/gestao/tarefas/comentarios/lote`;
                        const bodyKey = tipoTarefa === "obrigacoes" ? "obrigacaoIds" : "tarefaIds";

                        const response = await fetch(endpoint, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`
                            },
                            body: JSON.stringify({ [bodyKey]: ids })
                        });
                        comentariosMap = await response.json();
                    }
                }
            } catch (error) {
                console.error("Erro ao buscar comentários:", error);
            }
        }

        // Mapear para formato de exportação detalhado
        return dadosOriginais.map(item => {
            // Determinar status detalhado
            let statusDetalhado = item.status || 'N/A';
            let categoria = 'N/A';

            if (tipoTarefa === "obrigacoes") {
                if (isAbertaObr(item, campoDataBase)) {
                    statusDetalhado = 'Aberta';
                    categoria = 'Em Aberto';
                } else if (isAtrasadaObr(item, campoDataBase)) {
                    statusDetalhado = 'Atrasada';
                    categoria = 'Atrasada';
                } else if (isRealizadaObr(item, campoDataBase)) {
                    statusDetalhado = 'Realizada';
                    categoria = 'Realizada';
                } else if (isConcluidaNaMetaObr(item, campoDataBase)) {
                    statusDetalhado = 'Concluída até a Meta';
                    categoria = 'Concluída até a Meta';
                } else if (isConcluidaForaMetaObr(item, campoDataBase)) {
                    statusDetalhado = 'Concluída fora da Meta';
                    categoria = 'Concluída fora da Meta';
                } else if (isConcluidaAposPrazoObr(item, campoDataBase)) {
                    statusDetalhado = 'Concluída após Prazo';
                    categoria = 'Concluída após Prazo';
                }
            } else {
                if (isAbertaSolic(item)) {
                    statusDetalhado = 'Aberta';
                    categoria = 'Em Aberto';
                } else if (isAtrasadaSolic(item)) {
                    statusDetalhado = 'Atrasada';
                    categoria = 'Atrasada';
                } else if (isRealizadaSolic(item)) {
                    statusDetalhado = 'Realizada';
                    categoria = 'Realizada';
                } else if (isConcluidaNaMetaSolic(item)) {
                    statusDetalhado = 'Concluída até a Meta';
                    categoria = 'Concluída até a Meta';
                } else if (isConcluidaForaMetaSolic(item)) {
                    statusDetalhado = 'Concluída fora da Meta';
                    categoria = 'Concluída fora da Meta';
                } else if (isConcluidaForaPrazoSolic(item)) {
                    statusDetalhado = 'Concluída após Prazo';
                    categoria = 'Concluída após Prazo';
                }
            }

            // Buscar comentário mais recente
            const comentario = comentariosMap[item.id] || null;

            return {
                'ID': item.id || 'N/A',
                'Tipo': tipoTarefa === "obrigacoes" ? 'Obrigação' : 'Processo',
                'Nome': item.nome || item.assunto || 'N/A',
                'Descrição': item.descricao || 'N/A',
                'Cliente': item.cliente_nome || 'N/A',
                'Departamento': item.departamentoNome || item.departamento || 'N/A',
                'Status Detalhado': statusDetalhado,
                'Categoria': categoria,
                'Responsável': item.responsavel || item.responsavelNome || 'N/A',
                'Data Ação': item.dataAcao ? new Date(item.dataAcao).toLocaleDateString('pt-BR') : 'N/A',
                'Data Meta': item.dataMeta ? new Date(item.dataMeta).toLocaleDateString('pt-BR') : 'N/A',
                'Data Prazo': item.dataPrazo || item.vencimento ? new Date(item.dataPrazo || item.vencimento).toLocaleDateString('pt-BR') : 'N/A',
                'Data Conclusão': item.dataConclusao || item.dataBaixa ? new Date(item.dataConclusao || item.dataBaixa).toLocaleDateString('pt-BR') : 'N/A',
                'Último Comentário': comentario ? comentario.comentario : 'N/A',
                'Autor do Comentário': comentario ? comentario.autorNome : 'N/A',
                'Data do Comentário': comentario ? new Date(comentario.criadoEm).toLocaleDateString('pt-BR') : 'N/A',
                'Arquivo Anexo': comentario ? (comentario.nomeArquivo || 'N/A') : 'N/A'
            };
        });
    }



    // FUNÇÕES: Exportação com dados detalhados
    async function exportToExcel() {
        try {
            const exportData = await getExportDataDetalhado();
            const ws = XLSX.utils.json_to_sheet(exportData);

            // Ajustar larguras das colunas
            ws['!cols'] = [
                { wch: 8 },   // ID
                { wch: 12 },  // Tipo
                { wch: 40 },  // Nome
                { wch: 50 },  // Descrição
                { wch: 25 },  // Cliente
                { wch: 20 },  // Departamento
                { wch: 20 },  // Status Detalhado
                { wch: 20 },  // Categoria
                { wch: 20 },  // Responsável
                { wch: 12 },  // Data Ação
                { wch: 12 },  // Data Meta
                { wch: 12 },  // Data Prazo
                { wch: 12 },  // Data Conclusão
                { wch: 50 },  // Último Comentário
                { wch: 20 },  // Autor do Comentário
                { wch: 12 },  // Data do Comentário
                { wch: 30 }   // Arquivo Anexo
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Relatório");
            XLSX.writeFile(wb, `relatorio-${new Date().toISOString().split('T')[0]}.xlsx`);

            toast.success("Exportação concluída com sucesso!");
        } catch (error) {
            console.error("Erro na exportação:", error);
            toast.error("Erro ao exportar dados.");
        }
    }

    async function exportToCSV() {
        try {
            const exportData = await getExportDataDetalhado();
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Relatório");
            XLSX.writeFile(wb, `relatorio-${new Date().toISOString().split('T')[0]}.csv`);

            toast.success("Exportação concluída com sucesso!");
        } catch (error) {
            console.error("Erro na exportação:", error);
            toast.error("Erro ao exportar dados.");
        }
    }

    function copyToClipboard(data) {
        const exportData = getExportData(data);
        const columns = Object.keys(exportData[0] || {});
        let text = columns.join("\t") + "\n";
        exportData.forEach(item => {
            text += columns.map(col => item[col]).join("\t") + "\n";
        });
        navigator.clipboard.writeText(text);
        alert("Copiado para a área de transferência!");
    }

    function printTable() {
        window.print();
    }

    // ADICIONE ESTAS NOVAS FUNÇÕES
    function getExportDataBaixas(data) {
        const exportData = [];

        data.forEach(dept => {
            dept.usuarios.forEach(user => {
                user.baixas.forEach(baixa => {
                    exportData.push({
                        Departamento: dept.departamentoNome,
                        Usuário: user.usuarioNome,
                        'Obrigação Cliente': baixa.obrigacaoClienteNome,
                        Cliente: baixa.clienteNome || '-',
                        'Obrigação Base': baixa.obrigacaoNome || '-',
                        'Data Conclusão': new Date(baixa.dataConclusao).toLocaleDateString('pt-BR'),
                        'Data Prazo': baixa.dataPrazo ? new Date(baixa.dataPrazo).toLocaleDateString('pt-BR') : '-',
                        'Data Meta': baixa.dataMeta ? new Date(baixa.dataMeta).toLocaleDateString('pt-BR') : '-'
                    });
                });
            });
        });

        return exportData;
    }

    // ADICIONE ESTA NOVA FUNÇÃO PARA EXPORTAR O RELATÓRIO AGRUPADO
    function getExportDataBaixasAgrupadas(data) {
        return data.map(item => ({
            Departamento: item.departamentoNome,
            'Concluído por': item.concluidoPorNome || item.usuarioNome,
            'Obrigação': item.obrigacaoNome,
            'Quantidade': item.quantidade,
            'Tarefas Restantes': item.tarefasRestantes
        }));
    }

    // NOVA FUNÇÃO: Para exportar o formato agrupado por data
    function getExportDataBaixasPorData(data) {
        const exportData = [];
        data.forEach((grupo) => {
            grupo.itens
                .filter((item) => item.escopo === 'usuario_obrigacao' && item.concluidasNoDia > 0)
                .forEach((item) => {
                    // Para cada item, expandir com os detalhes individuais (se existirem)
                    if (item.concluidasNoDiaDetalhes && item.concluidasNoDiaDetalhes.length > 0) {
                        item.concluidasNoDiaDetalhes.forEach((detalhe) => {
                            let horaBaixa = '-';
                            if (detalhe.dataBaixa) {
                                const dataBaixa = new Date(detalhe.dataBaixa);
                                // Adicionar 3 horas ao horário
                                dataBaixa.setHours(dataBaixa.getHours() + 3);
                                horaBaixa = dataBaixa.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            }
                            exportData.push({
                                'Data': corrigirTimezoneData(grupo.data).split('-').reverse().join('/'),
                                'Hora da Baixa': horaBaixa,
                                'Departamento': item.departamentoNome,
                                'Obrigação': item.obrigacaoNome,
                                'Cliente': detalhe.clienteNome || '-',
                                'Concluído por': detalhe.concluidoPorNome || item.usuarioNome,
                                'Status': detalhe.categoria || 'Concluída'
                            });
                        });
                    } else {
                        // Fallback caso não tenha detalhes
                        exportData.push({
                            'Data': corrigirTimezoneData(grupo.data).split('-').reverse().join('/'),
                            'Hora da Baixa': '-',
                            'Departamento': item.departamentoNome,
                            'Obrigação': item.obrigacaoNome,
                            'Cliente': '-',
                            'Concluído por': item.concluidoPorNome || item.usuarioNome,
                            'Status': 'Concluída'
                        });
                    }
                });
        });
        return exportData;
    }

    // NOVAS FUNÇÕES: Para exportar o formato agrupado por data
    function exportBaixasPorDataToExcel(data) {
        const exportData = getExportDataBaixasPorData(data);
        const ws = XLSX.utils.json_to_sheet(exportData);

        // Ajustar larguras das colunas para melhor espaçamento
        const colWidths = [
            { wch: 12 }, // Data
            { wch: 15 }, // Hora da Baixa
            { wch: 20 }, // Departamento
            { wch: 30 }, // Obrigação
            { wch: 25 }, // Cliente
            { wch: 25 }, // Concluído por
            { wch: 15 }  // Status
        ];
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Baixas Diárias");
        XLSX.writeFile(wb, `baixas-diarias-${periodoInicioBaixas}-${periodoFimBaixas}.xlsx`);
    }

    function exportBaixasPorDataToCSV(data) {
        const exportData = getExportDataBaixasPorData(data);
        const ws = XLSX.utils.json_to_sheet(exportData);

        // Ajustar larguras das colunas para melhor espaçamento
        const colWidths = [
            { wch: 12 }, // Data
            { wch: 15 }, // Hora da Baixa
            { wch: 20 }, // Departamento
            { wch: 30 }, // Obrigação
            { wch: 25 }, // Cliente
            { wch: 25 }, // Concluído por
            { wch: 15 }  // Status
        ];
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Baixas Diárias");
        XLSX.writeFile(wb, `baixas-diarias-${periodoInicioBaixas}-${periodoFimBaixas}.csv`);
    }

    function exportBaixasToExcel(data) {
        const exportData = getExportDataBaixas(data);
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Baixas Diárias");
        XLSX.writeFile(wb, `baixas-diarias-${periodoInicioBaixas}-${periodoFimBaixas}.xlsx`);
    }

    function exportBaixasToCSV(data) {
        const exportData = getExportDataBaixas(data);
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Baixas Diárias");
        XLSX.writeFile(wb, `baixas-diarias-${periodoInicioBaixas}-${periodoFimBaixas}.csv`);
    }

    // ADICIONE ESTAS NOVAS FUNÇÕES PARA EXPORTAR O RELATÓRIO AGRUPADO
    function exportBaixasAgrupadasToExcel(data) {
        const exportData = getExportDataBaixasAgrupadas(data);
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Baixas Agrupadas");
        XLSX.writeFile(wb, `baixas-agrupadas-${periodoInicioBaixas}-${periodoFimBaixas}.xlsx`);
    }

    function exportBaixasAgrupadasToCSV(data) {
        const exportData = getExportDataBaixasAgrupadas(data);
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Baixas Agrupadas");
        XLSX.writeFile(wb, `baixas-agrupadas-${periodoInicioBaixas}-${periodoFimBaixas}.csv`);
    }

    // [CONDICIONAR CONCLUSÃO - AJUSTE FINAL]
    // A coluna 'Conclusão' só aparece se TODOS os itens exibidos tiverem status de concluído (ex: 'concluída', 'realizada').
    const todosConcluidos = (Array.isArray(resultados) ? resultados : []).every(item => {
        const status = (item.status || '').toLowerCase();
        return status === 'concluída' || status === 'realizada';
    });
    const mostrarConclusao = todosConcluidos;

    // ADICIONE ESTE NOVO USEEFFECT PARA CARREGAR USUÁRIOS
    useEffect(() => {
        async function loadUsuarios() {
            const token = getToken();
            const empresaId = getEmpresaId();
            if (!empresaId || !token) return;

            setLoadingUsuarios(true);
            try {
                let usuariosFiltrados = [];

                // Se há filtro de departamento, buscar apenas usuários daquele departamento
                if (departamentos.length > 0) {
                    const res = await fetch(`${BASE_URL}/gestao/departamentos/${departamentos[0]}/usuarios`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const data = await res.json();
                    usuariosFiltrados = data || [];
                } else {
                    // Se não há filtro de departamento, buscar todos os usuários da empresa
                    // Nota: A rota /usuarios retorna { data: [...], page, limit, total }
                    const res = await fetch(`${BASE_URL}/usuarios`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const responseData = await res.json();
                    usuariosFiltrados = responseData?.data || [];
                }

                setUsuariosList(usuariosFiltrados);

                // Limpar usuários selecionados se não estiverem mais disponíveis
                if (usuariosSelecionados.length > 0) {
                    const usuariosDisponiveis = usuariosFiltrados.map((u) => u.id);
                    const usuariosValidos = usuariosSelecionados.filter(id => usuariosDisponiveis.includes(id));
                    if (usuariosValidos.length !== usuariosSelecionados.length) {
                        setUsuariosSelecionados(usuariosValidos);
                    }
                }
            } catch (err) {
                console.error("Erro ao carregar usuários:", err);
                setUsuariosList([]);
            } finally {
                setLoadingUsuarios(false);
            }
        }
        loadUsuarios();
    }, [departamentos, usuariosSelecionados]);

    // [1] Funções para abrir modal de baixadas e de restantes

    function abrirModalBaixadas(item, data) {
        // Mapear os dados para o formato esperado pelo VisaoGeralModal
        const tarefasMapeadas = (item.concluidasNoDiaDetalhes || []).map((tarefa) => ({
            id: tarefa.id,
            status: tarefa.status,
            departamento: tarefa.departamentoNome,
            departamentoNome: tarefa.departamentoNome,
            nome: tarefa.nome,
            cliente_nome: tarefa.clienteNome,
            status_cliente: "Ativo",
            vencimento: tarefa.vencimento,
            dataBaixa: tarefa.dataBaixa,
            dataConclusao: tarefa.dataBaixa,
            dataAcao: tarefa.acao,
            dataMeta: tarefa.meta,
            responsavel: tarefa.concluidoPorNome || tarefa.usuarioNome,
            atividades: [],
            tipo: "obrigacao",
            baixadaAutomaticamente: 0,
            categoria: tarefa.categoria
        }));

        setTituloModal(`Baixadas em ${item.obrigacaoNome} - ${(item.concluidoPorNome || item.usuarioNome)} (${item.departamentoNome}) em ${corrigirTimezoneData(data).split('-').reverse().join('/')}`);
        setSolicitacoesModal(tarefasMapeadas);
        setModalAberto(true);
    }

    function abrirModalRestantes(item, data) {
        // Mapear os dados para o formato esperado pelo VisaoGeralModal
        const tarefasMapeadas = (item.restantesNoDiaDetalhes || []).map((tarefa) => ({
            id: tarefa.id,
            status: tarefa.status,
            departamento: tarefa.departamentoNome,
            departamentoNome: tarefa.departamentoNome,
            nome: tarefa.nome,
            cliente_nome: tarefa.clienteNome,
            status_cliente: "Ativo",
            vencimento: tarefa.vencimento,
            dataBaixa: null,
            dataConclusao: null,
            dataAcao: tarefa.acao,
            dataMeta: tarefa.meta,
            responsavel: tarefa.usuarioNome,
            atividades: [],
            tipo: "obrigacao",
            baixadaAutomaticamente: 0,
            categoria: tarefa.categoria
        }));

        setTituloModal(`Restantes em ${item.obrigacaoNome} - ${(item.concluidoPorNome || item.usuarioNome)} (${item.departamentoNome}) em ${corrigirTimezoneData(data).split('-').reverse().join('/')}`);
        setSolicitacoesModal(tarefasMapeadas);
        setModalAberto(true);
    }

    return (
        <>
            <PrincipalSidebar />
            <div className={styles.pageBg}>
                <div className={styles.container}>
                    {/* ABAS DE NAVEGAÇÃO */}
                    <div className={styles.tabsContainer}>
                        <div
                            className={`${styles.tab} ${tipoRelatorio === "performance" ? styles.activeTab : ""}`}
                            onClick={() => setTipoRelatorio("performance")}
                        >
                            Relatório de Performance
                        </div>
                        <div
                            className={`${styles.tab} ${tipoRelatorio === "baixas-diarias" ? styles.activeTab : ""}`}
                            onClick={() => setTipoRelatorio("baixas-diarias")}
                        >
                            Baixas Diárias
                        </div>
                    </div>

                    {/* RELATÓRIO DE PERFORMANCE */}
                    {tipoRelatorio === "performance" && (
                        <>
                            {/* Filtros */}
                            <div className={styles.filtrosCard}>
                                <form className={styles.filtrosGridRelatorio} onSubmit={filtrarLocal}>
                                    {/* 1ª linha */}
                                    <div>
                                        <label className={styles.label}>Por Data:</label>
                                        <select
                                            className={styles.input}
                                            value={campoData}
                                            onChange={e => setCampoData(e.target.value)}
                                        >
                                            <option value="dataPrazo">Vencimento/Prazo</option>
                                            <option value="dataMeta">Meta</option>
                                            <option value="dataConclusao">Conclusão</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={styles.label}>Por Período Inicial:</label>
                                        <input
                                            type="date"
                                            className={styles.input}
                                            value={periodoInicial}
                                            onChange={e => setPeriodoInicial(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className={styles.label}>Por Período Final:</label>
                                        <input
                                            type="date"
                                            className={styles.input}
                                            value={periodoFinal}
                                            onChange={e => setPeriodoFinal(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className={styles.label}>Por Cliente:</label>
                                        <div className={styles.clienteSelectContainer}>
                                            <ClienteSelectInline
                                                value={cliente}
                                                onChange={e => setCliente(e.target.value)}
                                            />
                                        </div>
                                    </div>


                                    {/* 2ª linha */}
                                    <div>
                                        <label className={styles.label}>Por Tipo Tarefa:</label>
                                        <select
                                            className={styles.input}
                                            value={tipoTarefa}
                                            onChange={e => {
                                                console.log('[DEBUG] Mudando tipoTarefa para:', e.target.value);
                                                setTipoTarefa(e.target.value);
                                            }}
                                        >
                                            <option value="solicitacoes">Processos</option>
                                            <option value="obrigacoes">Obrigações</option>
                                        </select>
                                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={styles.label}>Por Departamento:</label>
                                        <select
                                            className={styles.input}
                                            value={departamentos.length > 0 ? departamentos[0] : ""}
                                            onChange={e => setDepartamentos([Number(e.target.value)])}
                                        >
                                            <option value="">Selecione</option>
                                            {departamentosList.map(dep => (
                                                <option key={dep.id} value={dep.id}>{dep.nome}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={styles.label}>Por Status:</label>
                                        <select
                                            className={styles.input}
                                            value={status[0] || ""}
                                            onChange={e => setStatus([e.target.value])}
                                        >
                                            {(tipoTarefa === "obrigacoes" ? statusOptionsObr : statusOptionsTar).map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* 3ª linha */}
                                    <div>
                                        <label className={styles.label}>Por Obrigações:</label>
                                        <select
                                            className={styles.input}
                                            value={obrigacoes.length > 0 ? obrigacoes[0] : ""}
                                            onChange={e => setObrigacoes([Number(e.target.value)])}
                                            disabled={loadingObrigacoes}
                                        >
                                            <option value="">
                                                {loadingObrigacoes ? "Carregando..." : "Selecione"}
                                            </option>
                                            {obrigacoesList.map(obrigacao => (
                                                <option key={obrigacao.id} value={obrigacao.id}>
                                                    {obrigacao.nome} - {obrigacao.departamentoNome}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={styles.label}>Por Colaborador:</label>
                                        <select
                                            className={styles.input}
                                            value={colaboradores.length > 0 ? colaboradores[0] : ""}
                                            onChange={e => setColaboradores([Number(e.target.value)])}
                                            disabled={loadingColaboradores}
                                        >
                                            <option value="">
                                                {loadingColaboradores ? "Carregando..." : "Selecione"}
                                            </option>
                                            {colaboradoresList.map(colaborador => (
                                                <option key={colaborador.id} value={colaborador.id}>
                                                    {colaborador.nome}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={styles.label}>Por Grupo:</label>
                                        <select
                                            className={styles.input}
                                            value={grupos.length > 0 ? grupos[0] : ""}
                                            onChange={e => setGrupos([Number(e.target.value)])}
                                            disabled={loadingGrupos}
                                        >
                                            <option value="">
                                                {loadingGrupos ? "Carregando..." : "Selecione"}
                                            </option>
                                            {gruposList.map(grupo => (
                                                <option key={grupo.id} value={grupo.id}>
                                                    {grupo.nome}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                                        <button
                                            type="submit"
                                            className={`${styles.input} ${styles.button}`}
                                            disabled={loadingBusca || loading || allTarefas.length === 0 && tipoTarefa === "solicitacoes" || allObrigacoes.length === 0 && tipoTarefa === "obrigacoes"}
                                        >
                                            {loadingBusca ? "Buscando..." : "Buscar"}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Resultado */}
                            <div className={styles.resultCard}>
                                <div className={styles.tableWrapper}>
                                    <div className={styles.exportButtonsContainer}>
                                        <button
                                            className={`${styles.button} ${styles.exportButtonBase} ${styles.exportButtonSecondary}`}
                                            onClick={() => copyToClipboard(resultados)}
                                        >
                                            Copy
                                        </button>
                                        <button
                                            className={`${styles.button} ${styles.exportButtonBase} ${styles.exportButtonPrimary}`}
                                            onClick={() => exportToExcel()}
                                            title="Exporta dados detalhados de cada item individual"
                                        >
                                            Excel
                                        </button>
                                        <button
                                            className={`${styles.button} ${styles.exportButtonBase} ${styles.exportButtonPrimary}`}
                                            onClick={() => exportToCSV()}
                                            title="Exporta dados detalhados de cada item individual"
                                        >
                                            CSV
                                        </button>
                                        <button
                                            className={`${styles.button} ${styles.exportButtonBase} ${styles.exportButtonSecondary}`}
                                            onClick={printTable}
                                        >
                                            Print
                                        </button>
                                    </div>
                                    <table className={styles.resultTable}>
                                        <thead>
                                            <tr>
                                                <th>Departamento</th>
                                                <th>Total</th>
                                                <th>Abertas</th>
                                                <th>Atrasadas</th>
                                                <th>Realizadas</th>
                                                {mostrarConclusao && <th>Conclusão</th>}
                                                <th>Concluídas até a Meta</th>
                                                <th>Concluídas fora da Meta</th>
                                                <th>Concluídas após Prazo</th>
                                                <th>% em Aberto</th>
                                                <th>% em Atraso</th>
                                                <th>% na Programação</th>
                                                <th>% Concluídas até a Meta</th>
                                                <th>% Concluídas fora da Meta</th>
                                                <th>% Concluídas após o Prazo</th>
                                                <th>% Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {resultados.length > 0 ? (
                                                <>
                                                    {resultados.map((item, idx) => {
                                                        // Cálculo das porcentagens
                                                        const percAberto = item.qtdTotal > 0 ? (item.qtdAbertas / item.qtdTotal) * 100 : 0;
                                                        const percAtraso = item.qtdTotal > 0 ? (item.qtdAtrasadas / item.qtdTotal) * 100 : 0;
                                                        const percRealizadas = item.qtdTotal > 0 ? (item.qtdRealizadas / item.qtdTotal) * 100 : 0;
                                                        const percConcluidasNaMeta = item.qtdTotal > 0 ? (item.qtdConcluidasNaMeta / item.qtdTotal) * 100 : 0;
                                                        const percConcluidasForaMeta = item.qtdTotal > 0 ? (item.qtdConcluidasForaMeta / item.qtdTotal) * 100 : 0;
                                                        const percConcluidasAposPrazo = item.qtdTotal > 0 ? (item.qtdConcluidasAposPrazo / item.qtdTotal) * 100 : 0;
                                                        const percTotal = (percAberto + percAtraso + percRealizadas + percConcluidasNaMeta + percConcluidasForaMeta + percConcluidasAposPrazo).toFixed(2).replace('.', ',');

                                                        const percAbertoStr = percAberto.toFixed(2).replace('.', ',');
                                                        const percAtrasoStr = percAtraso.toFixed(2).replace('.', ',');
                                                        const percRealizadasStr = percRealizadas.toFixed(2).replace('.', ',');
                                                        const percConcluidasNaMetaStr = percConcluidasNaMeta.toFixed(2).replace('.', ',');
                                                        const percConcluidasForaMetaStr = percConcluidasForaMeta.toFixed(2).replace('.', ',');
                                                        const percConcluidasAposPrazoStr = percConcluidasAposPrazo.toFixed(2).replace('.', ',');

                                                        return (
                                                            <tr key={item.departamentoId + "-" + idx}>
                                                                {/* Departamento com clique */}
                                                                <td>{item.departamentoNome || "-"}</td>
                                                                {/* Total */}
                                                                <td
                                                                    className={`${styles.cellCenter} ${item.qtdTotal > 0 ? styles.cellClickable : ''}`}
                                                                    onClick={() =>
                                                                        item.qtdTotal > 0 &&
                                                                        abrirModalSolicitacoes({ departamentoId: item.departamentoId }, `Total de ${item.departamentoNome}`)
                                                                    }
                                                                >
                                                                    {item.qtdTotal}
                                                                </td>
                                                                {/* Abertas */}
                                                                <td
                                                                    className={`${styles.cellCenter} ${item.qtdAbertas > 0 ? styles.cellClickable : ''}`}
                                                                    onClick={() =>
                                                                        item.qtdAbertas > 0 &&
                                                                        abrirModalSolicitacoes({ departamentoId: item.departamentoId, status: "aberta" }, `Abertas de ${item.departamentoNome}`)
                                                                    }
                                                                >
                                                                    {item.qtdAbertas}
                                                                </td>

                                                                {/* Atrasadas */}
                                                                <td
                                                                    className={`${styles.cellCenter} ${item.qtdAtrasadas > 0 ? styles.cellClickable : ''}`}
                                                                    onClick={() =>
                                                                        item.qtdAtrasadas > 0 &&
                                                                        abrirModalSolicitacoes({ departamentoId: item.departamentoId, status: "atrasada" }, `Atrasadas de ${item.departamentoNome}`)
                                                                    }
                                                                >
                                                                    {item.qtdAtrasadas}
                                                                </td>

                                                                {/* Realizadas */}
                                                                <td
                                                                    className={`${styles.cellCenter} ${item.qtdRealizadas > 0 ? styles.cellClickableGreen : ''}`}
                                                                    onClick={() =>
                                                                        item.qtdRealizadas > 0 &&
                                                                        abrirModalSolicitacoes({ departamentoId: item.departamentoId, status: "realizada" }, `Realizadas de ${item.departamentoNome}`)
                                                                    }
                                                                >
                                                                    {item.qtdRealizadas}
                                                                </td>

                                                                {/* Concluídas até a Meta */}
                                                                <td
                                                                    className={`${styles.cellCenter} ${item.qtdConcluidasNaMeta > 0 ? styles.cellClickable : ''}`}
                                                                    onClick={() =>
                                                                        item.qtdConcluidasNaMeta > 0 &&
                                                                        abrirModalSolicitacoes({ departamentoId: item.departamentoId, status: "concluida_na_meta" }, `Concluídas até a Meta de ${item.departamentoNome}`)
                                                                    }
                                                                >
                                                                    {item.qtdConcluidasNaMeta}
                                                                </td>

                                                                {/* Concluídas fora da Meta */}
                                                                <td
                                                                    className={`${styles.cellCenter} ${item.qtdConcluidasForaMeta > 0 ? styles.cellClickable : ''}`}
                                                                    onClick={() =>
                                                                        item.qtdConcluidasForaMeta > 0 &&
                                                                        abrirModalSolicitacoes({ departamentoId: item.departamentoId, status: "concluida_fora_meta" }, `Concluídas fora da Meta de ${item.departamentoNome}`)
                                                                    }
                                                                >
                                                                    {item.qtdConcluidasForaMeta}
                                                                </td>

                                                                {/* Concluídas após Prazo */}
                                                                <td
                                                                    className={`${styles.cellCenter} ${item.qtdConcluidasAposPrazo > 0 ? styles.cellClickable : ''}`}
                                                                    onClick={() =>
                                                                        item.qtdConcluidasAposPrazo > 0 &&
                                                                        abrirModalSolicitacoes({ departamentoId: item.departamentoId, status: "concluida_fora_prazo" }, `Concluídas após Prazo de ${item.departamentoNome}`)
                                                                    }
                                                                >
                                                                    {item.qtdConcluidasAposPrazo}
                                                                </td>

                                                                {/* Conclusão */}
                                                                {mostrarConclusao && <td>{item.dataBaixa || item.dataConclusao || '-'}</td>}

                                                                {/* As outras colunas permanecem normais, sem clique */}
                                                                <td className={styles.cellCenter}>{percAbertoStr}%</td>
                                                                <td className={styles.cellCenter}>{percAtrasoStr}%</td>
                                                                <td className={styles.cellCenter}>{percRealizadasStr}%</td>
                                                                <td className={styles.cellCenter}>{percConcluidasNaMetaStr}%</td>
                                                                <td className={styles.cellCenter}>{percConcluidasForaMetaStr}%</td>
                                                                <td className={styles.cellCenter}>{percConcluidasAposPrazoStr}%</td>
                                                                <td className={styles.cellCenter}>{percTotal}%</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* Linha de totais */}
                                                    <tr className={styles.totalRow}>
                                                        <td>Total</td>
                                                        <td className={styles.cellCenter}>{totais.qtdTotal}</td>
                                                        <td className={styles.cellCenter}>{totais.qtdAbertas}</td>
                                                        <td className={styles.cellCenter}>{totais.qtdAtrasadas}</td>
                                                        <td className={styles.cellCenter}>{totais.qtdRealizadas}</td>
                                                        {mostrarConclusao && <td className={styles.cellCenter}>{totais.qtdConcluidasAposPrazo}</td>}
                                                        <td className={styles.cellCenter}>{totais.qtdConcluidasNaMeta}</td>
                                                        <td className={styles.cellCenter}>{totais.qtdConcluidasForaMeta}</td>
                                                        <td className={styles.cellCenter}>{totais.qtdConcluidasAposPrazo}</td>
                                                        <td colSpan={7}></td>
                                                    </tr>
                                                </>
                                            ) : (
                                                <tr>
                                                    <td colSpan={14} className={styles.textCenter}>
                                                        {loadingBusca
                                                            ? "Buscando..."
                                                            : jaBuscou
                                                                ? "Nenhum resultado encontrado."
                                                                : "Use o filtro acima para buscar resultados."
                                                        }
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {/* RELATÓRIO DE BAIXAS DIÁRIAS */}
                    {tipoRelatorio === "baixas-diarias" && (
                        <>
                            {/* Filtros para Baixas Diárias */}
                            <div className={styles.filtrosCard}>
                                <div className={styles.baixasFiltrosContainer}>
                                    {/* Primeira linha */}
                                    <div className={styles.baixasFiltrosRow}>
                                        <div>
                                            <label className={styles.label}>Período Início:</label>
                                            <input
                                                type="date"
                                                className={styles.input}
                                                value={periodoInicioBaixas}
                                                onChange={e => setPeriodoInicioBaixas(e.target.value)}
                                                min="2020-01-01"
                                                max="2030-12-31"
                                                placeholder="Selecione a data"
                                            />
                                        </div>
                                        <div>
                                            <label className={styles.label}>Período Fim:</label>
                                            <input
                                                type="date"
                                                className={styles.input}
                                                value={periodoFimBaixas}
                                                onChange={e => setPeriodoFimBaixas(e.target.value)}
                                                min="2020-01-01"
                                                max="2030-12-31"
                                                placeholder="Selecione a data"
                                            />
                                        </div>
                                        <div>
                                            <label className={styles.label}>Departamento:</label>
                                            <select
                                                className={styles.input}
                                                value={departamentos.length > 0 ? departamentos[0] : ""}
                                                onChange={e => setDepartamentos([Number(e.target.value)])}
                                            >
                                                <option value="">Todos</option>
                                                {departamentosList.map(dep => (
                                                    <option key={dep.id} value={dep.id}>{dep.nome}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={styles.label}>Usuário:</label>
                                            <select
                                                className={styles.input}
                                                value={usuariosSelecionados.length > 0 ? usuariosSelecionados[0] : ""}
                                                onChange={e => setUsuariosSelecionados(e.target.value ? [Number(e.target.value)] : [])}
                                                disabled={loadingUsuarios}
                                            >
                                                <option value="">Todos</option>
                                                {usuariosList.map(usuario => (
                                                    <option key={usuario.id} value={usuario.id}>
                                                        {usuario.nome}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    {/* Segunda linha */}
                                    <div className={styles.baixasFiltrosButtonContainer}>
                                        <button
                                            className={`${styles.input} ${styles.button}`}
                                            onClick={buscarBaixasDiarias}
                                            disabled={loadingBaixas}
                                        >
                                            {loadingBaixas ? "Buscando..." : "Buscar"}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Resultado das Baixas Diárias */}
                            <div className={styles.resultCard}>
                                <div className={styles.tableWrapper}>
                                    <div className={styles.baixasButtonsContainer}>
                                        <button
                                            className={`${styles.button} ${styles.exportButtonBase} ${styles.exportButtonSecondary}`}
                                            onClick={() => exportBaixasPorDataToExcel(baixasPorData)}
                                            disabled={baixasPorData.length === 0}
                                        >
                                            Excel
                                        </button>
                                        <button
                                            className={`${styles.button} ${styles.exportButtonBase} ${styles.exportButtonSecondary}`}
                                            onClick={() => exportBaixasPorDataToCSV(baixasPorData)}
                                            disabled={baixasPorData.length === 0}
                                        >
                                            CSV
                                        </button>
                                    </div>

                                    {errorBaixas && (
                                        <div className={styles.errorMessage}>
                                            {errorBaixas}
                                        </div>
                                    )}

                                    {/* NOVO: Tabela usando formato agrupado por data */}
                                    {baixasPorData.length > 0 ? (
                                        <div>
                                            <table className={`${styles.resultTable} ${styles.baixasTable}`}>
                                                <thead>
                                                    <tr>
                                                        <th>Data</th>
                                                        <th>Departamento</th>
                                                        <th>Obrigação</th>
                                                        <th>Concluído por</th>
                                                        <th>Baixadas no Dia</th>
                                                        <th>Restantes</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        // PRIMEIRO: Agrupar por data (consolidar objetos com mesma data)
                                                        const dadosConsolidados = new Map();

                                                        baixasPorData.forEach(grupoData => {
                                                            const dataKey = grupoData.data;

                                                            if (!dadosConsolidados.has(dataKey)) {
                                                                dadosConsolidados.set(dataKey, {
                                                                    data: dataKey,
                                                                    itens: []
                                                                });
                                                            }


                                                            // Adicionar apenas itens de escopo 'usuario_obrigacao' com concluidasNoDia > 0
                                                            const itensComConclusao = grupoData.itens.filter(i => i.escopo === 'usuario_obrigacao' && i.concluidasNoDia > 0);
                                                            if (itensComConclusao.length > 0) {
                                                                dadosConsolidados.get(dataKey).itens.push(...itensComConclusao);
                                                            }
                                                        });

                                                        // SEGUNDO: Para cada data consolidada, renderizar as linhas
                                                        return Array.from(dadosConsolidados.values())
                                                            .filter((grupoData) => grupoData.itens.length > 0)
                                                            .map((grupoData, idx) => (
                                                                grupoData.itens.map((item, itemIdx) => (
                                                                                                                                        <tr key={`${grupoData.data}-${item.usuarioId}-${item.obrigacaoId}-${itemIdx}`}>
                                                                        <td className={styles.cellData}>
                                                                            {corrigirTimezoneData(grupoData.data).split('-').reverse().join('/')}
                                                                        </td>
                                                                        <td>{item.departamentoNome}</td>
                                                                        <td>{item.obrigacaoNome}</td>
                                                                        <td>{item.concluidoPorNome || item.usuarioNome}</td>
                                                                        <td className={`${styles.cellCenter} ${styles.cellBaixadas}`}
                                                                            onClick={() => abrirModalBaixadas(item, grupoData.data)}
                                                                            title="Clique para ver detalhes das baixadas">
                                                                          {item.concluidasNoDia}
                                                                        </td>
                                                                        <td className={`${styles.cellCenter} ${styles.cellRestantes}`}
                                                                            onClick={() => abrirModalRestantes(item, grupoData.data)}
                                                                            title="Clique para ver detalhes das restantes">
                                                                          {item.restantesNoDia}
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            ));
                                                    })()}
                                                                                                        {/* Linha de totais */}
                                                    <tr className={styles.totalRow}>
                                                        <td colSpan={4} className={styles.textRight}>Total</td>
                                                        <td className={`${styles.cellCenter} ${styles.cellBaixadas}`}>
                                                          {baixasPorData.reduce((total, grupo) =>
                                                            total + (grupo.itens ? grupo.itens.filter((i) => i.escopo === 'usuario_obrigacao' && i.concluidasNoDia > 0).reduce((subTotal, item) => subTotal + (item.concluidasNoDia || 0), 0) : 0), 0
                                                          )}
                                                        </td>
                                                        <td className={`${styles.cellCenter} ${styles.cellRestantes}`}>
                                                          {baixasPorData.reduce((total, grupo) =>
                                                            total + (grupo.itens ? grupo.itens.filter((i) => i.escopo === 'usuario_obrigacao' && i.concluidasNoDia > 0).reduce((subTotal, item) => subTotal + (item.restantesNoDia || 0), 0) : 0), 0
                                                          )}
                                                        </td>
                                                      </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : baixasAgrupadas.length > 0 ? (
                                        /* LEGADO: Tabela usando formato antigo */
                                        <div>
                                            <table className={styles.resultTable}>
                                                <thead>
                                                    <tr>
                                                        <th>Data</th>
                                                        <th>Departamento</th>
                                                        <th>Usuário</th>
                                                        {/* <th>Obrigação</th> */}
                                                        <th>Quantidade</th>
                                                        <th>Tarefas Restantes</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                                                                        {baixasAgrupadas.map((item, idx) => (
                                                        <tr key={`${item.departamentoId}-${item.usuarioId}-${item.obrigacaoId}-${idx}`}>
                                                            <td className={styles.cellData}>
                                                                {corrigirTimezoneData(item.datasConclusao[0]).split('-').reverse().join('/')}
                                                            </td>
                                                            <td>{item.departamentoNome}</td>
                                                            <td>{item.usuarioNome}</td>
                                                            {/* <td>{item.obrigacaoNome}</td> */}
                                                            <td 
                                                                className={`${styles.cellCenter} ${styles.cellQuantidade}`}
                                                                onClick={() => abrirModalBaixas(item)}
                                                                title="Clique para ver detalhes"
                                                            >
                                                                {item.quantidade}
                                                            </td>
                                                            <td className={`${styles.cellCenter} ${styles.cellRestantes}`}>
                                                                {item.tarefasRestantes}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {/* Linha de totais */}
                                                    <tr className={styles.totalRow}>
                                                        <td colSpan={4}>Total</td>
                                                        <td className={`${styles.cellCenter} ${styles.cellQuantidade}`}>
                                                            {baixasAgrupadas.reduce((total, item) => total + item.quantidade, 0)}
                                                        </td>
                                                        <td className={`${styles.cellCenter} ${styles.cellRestantes}`}>
                                                            {baixasAgrupadas.reduce((total, item) => total + item.tarefasRestantes, 0)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className={styles.emptyMessage}>
                                            {loadingBaixas
                                                ? "Buscando baixas..."
                                                : "Nenhuma baixa encontrada para a data selecionada."
                                            }
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            {modalAberto && (
                <VisaoGeralModal
                    titulo={tituloModal}
                    tarefas={solicitacoesModal}
                    visible={modalAberto}
                    onClose={() => setModalAberto(false)}
                    abaAtiva={tipoTarefa === "solicitacoes" ? "solicitacoes" : "obrigacoes"}
                    setAbaAtiva={() => { }}
                />
            )}

            {/* Modal para detalhes de baixas diárias */}
            {modalBaixasAberto && (
                <VisaoGeralModal
                    titulo={tituloModalBaixas}
                    tarefas={baixasModal}
                    visible={modalBaixasAberto}
                    onClose={() => setModalBaixasAberto(false)}
                    abaAtiva="obrigacoes"
                    setAbaAtiva={() => { }} // Não precisa alterar a aba no modal de baixas
                />
            )}
        </>
    );
}
