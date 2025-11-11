"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiCalendar, FiSearch, FiX, FiFilter, FiUsers, FiBriefcase, FiCheckSquare } from "react-icons/fi";
import { CircularProgressbarWithChildren, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import Select from "react-select";
import PrincipalSidebar from "@/components/onety/principal/PrincipalSidebar";
import SpinnerGlobal from "../../components/onety/menu/SpinnerGlobal";
import styles from "../../styles/gestao/PerformanceMensal.module.css";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const resolveUrl = (path) => {
  if (!BASE_URL) return path;
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};

const fetchJson = async (path, options = {}) => {
  const { headers, ...rest } = options;
  const response = await fetch(resolveUrl(path), {
    method: "GET",
    ...rest,
    headers: headers || {}
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(`Erro ao buscar ${path}: ${response.status}`);
    error.response = {
      status: response.status,
      data: payload,
      headers: Object.fromEntries(response.headers.entries())
    };
    throw error;
  }

  return {
    data: payload,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries())
  };
};

const normalizeArrayPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.usuarios)) return payload.usuarios;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const mapUsuariosEmpresa = (payload) => {
  const lista = normalizeArrayPayload(payload);

  return lista
    .map((item) => {
      const id =
        item.usuario_id ??
        item.user_id ??
        item.usuarioId ??
        item.userId ??
        item.id ??
        null;

      const nome =
        item.nome ??
        item.full_name ??
        item.fullName ??
        item.user_name ??
        item.usuario_nome ??
        item.email ??
        (id ? `Usuário ${id}` : null);

      if (!id || !nome) return null;

      return {
        id,
        nome,
        cargoId: item.cargo_id ?? item.cargoId ?? null,
        cargoNome: item.cargo_nome ?? item.cargoNome ?? item.cargo ?? null,
        departamentoId:
          item.departamento_id ?? item.departamentoId ?? item.idDepartamento ?? null,
        departamentoNome:
          item.departamento_nome ??
          item.departamentoNome ??
          item.departamento ??
          null,
        imagem:
          item.avatar_url ??
          item.avatarUrl ??
          item.foto ??
          item.imagem ??
          null,
        email: item.email ?? null,
        raw: item
      };
    })
    .filter(Boolean);
};

const getAuthInfo = () => {
  if (typeof window === "undefined") {
    return { token: null, empresaId: null };
  }

  const token = localStorage.getItem("token");
  let empresaId =
    localStorage.getItem("empresaId") ||
    localStorage.getItem("EmpresaId") ||
    null;

  const rawUserData = localStorage.getItem("userData");
  if (!empresaId && rawUserData) {
    try {
      const parsed = JSON.parse(rawUserData);
      empresaId =
        parsed?.EmpresaId ??
        parsed?.empresaId ??
        parsed?.empresaID ??
        null;
    } catch (error) {
      console.error("Erro ao parsear userData:", error);
    }
  }

  return { token, empresaId };
};

export default function PerformanceMensalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 🚨 SOLUÇÃO PARA HYDRATION: Estado para garantir renderização apenas no cliente
  const [mounted, setMounted] = useState(false);
  
  // Estados principais
  const [loading, setLoading] = useState(true);
  const [loadingFiltros, setLoadingFiltros] = useState(false);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [performanceGeral, setPerformanceGeral] = useState({
    total: 0,
    emAberto: 0,
    atrasadas: 0,
    concluidas: 0
  });
  const [usuariosPerformance, setUsuariosPerformance] = useState([]);
  
  // Estados para filtros aplicados (usados no carregamento de dados)
  const [periodoSelecionado, setPeriodoSelecionado] = useState(() => {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `${mes}/${ano}`;
  });
  const [tiposTarefas, setTiposTarefas] = useState("Todos");
  const [departamentos, setDepartamentos] = useState([]);
  const [usuariosSelecionados, setUsuariosSelecionados] = useState([]);
  const [obrigacoesSelecionadas, setObrigacoesSelecionadas] = useState([]);
  
  // Estados para filtros temporários (mostrados na interface)
  const [periodoTemp, setPeriodoTemp] = useState(() => {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `${mes}/${ano}`;
  });
  const [tiposTarefasTemp, setTiposTarefasTemp] = useState("Todos");
  const [departamentosTemp, setDepartamentosTemp] = useState([]);
  const [usuariosSelecionadosTemp, setUsuariosSelecionadosTemp] = useState([]);
  const [obrigacoesSelecionadasTemp, setObrigacoesSelecionadasTemp] = useState([]);
  
  // Estado para departamentos reais
  const [departamentosReais, setDepartamentosReais] = useState([]);
  
  // Estado para usuários filtrados
  const [usuariosFiltrados, setUsuariosFiltrados] = useState([]);
  
  // Estado para todos os usuários
  const [todosUsuarios, setTodosUsuarios] = useState([]);
  
  // Estado para obrigações reais
  const [obrigacoesReais, setObrigacoesReais] = useState([]);
  
  // Estado para obrigações filtradas
  const [obrigacoesFiltradas, setObrigacoesFiltradas] = useState([]);
  
  // Estado para carregamento de obrigações
  const [carregandoObrigacoes, setCarregandoObrigacoes] = useState(false);
  
  // Estado para carregamento de departamentos
  const [carregandoDepartamentos, setCarregandoDepartamentos] = useState(false);
  
  // Estados para dropdowns
  const [dropdownPeriodo, setDropdownPeriodo] = useState(false);
  const [dropdownTiposTarefas, setDropdownTiposTarefas] = useState(false);
  const [dropdownUsuarios, setDropdownUsuarios] = useState(false);
  
  // Estados para ordenação


  // Estados para modal
  const [modalAberto, setModalAberto] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [tarefasDetalhadas, setTarefasDetalhadas] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  
  // Estados para funcionalidades do modal
  const [abaAtiva, setAbaAtiva] = useState("solicitacoes");
  const [searchTerm, setSearchTerm] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [sortConfig, setSortConfig] = useState({
    key: "id",
    direction: "asc"
  });
  
  const tarefasPorPagina = 10;

  // Referências para dropdowns
  const periodoRef = useRef(null);
  const tiposTarefasRef = useRef(null);
  const usuariosRef = useRef(null);

  // Função para carregar dados de performance
  const carregarDados = async () => {
    console.log("🚀 Iniciando carregamento de dados...");
    console.log("🔍 Estado atual dos filtros:", {
      periodoSelecionado,
      departamentos,
      tiposTarefas,
      usuariosSelecionados,
      obrigacoesSelecionadas
    });
    
    // Limpeza mais agressiva para evitar qualquer flash de dados antigos
    setPerformanceGeral({
      total: 0,
      emAberto: 0,
      atrasadas: 0,
      concluidas: 0
    });
    setUsuariosPerformance([]);
    setUsuariosFiltrados([]);
    setObrigacoesFiltradas([]);
    setDadosCarregados(false);
    
    try {
      const { token, empresaId } = getAuthInfo();

      if (!token || !empresaId) {
        router.replace("/auth/login");
        return;
      }

    const headers = {
      Authorization: `Bearer ${token}`,
      "X-Empresa-Id": empresaId.toString()
    };
      
      // Extrair mês e ano do período selecionado
      const [mes, ano] = periodoSelecionado.split("/");
      const mesSelecionado = parseInt(mes) - 1; // Mês começa em 0 no JavaScript
      const anoSelecionado = parseInt(ano);
      
      console.log("🔍 Buscando dados da API...");
      
      // 🚀 TIMING DETALHADO PARA IDENTIFICAR GARGALOS
      const startTime = performance.now();
      
      // Buscar dados usando as mesmas APIs da visão geral
      console.log("⏱️ Iniciando chamadas paralelas...");
      
      const tarefasAPITime = performance.now();
      const resTarefas = await fetchJson(`/gestao/tarefas/todas/${empresaId}`, { headers });
      const tarefasTime = performance.now() - tarefasAPITime;
      console.log(`✅ Tarefas carregadas em: ${tarefasTime.toFixed(2)}ms`);
      
      const obrigacoesStart = performance.now();
      const resObrigacoes = await fetchJson(`/gestao/obrigacoes/empresa/${empresaId}/todas`, { headers });
      const obrigacoesTime = performance.now() - obrigacoesStart;
      console.log(`✅ Obrigações carregadas em: ${obrigacoesTime.toFixed(2)}ms`);
      
      const usuariosStart = performance.now();
    const resUsuarios = await fetchJson(`/usuarios-empresas/empresa/${empresaId}`, { headers });
      const usuariosTime = performance.now() - usuariosStart;
      console.log(`✅ Usuários carregados em: ${usuariosTime.toFixed(2)}ms`);
      
      const totalAPITime = performance.now() - startTime;
      console.log(`📊 Total das 3 APIs: ${totalAPITime.toFixed(2)}ms`);
      console.log(`📊 Dados da API recebidos - iniciando processamento...`);

      const tarefasAbertas = Array.isArray(resTarefas.data) ? resTarefas.data : [];
      const obrigacoes = Array.isArray(resObrigacoes.data) ? resObrigacoes.data : [];
      
    let usuarios = mapUsuariosEmpresa(resUsuarios.data);
      
      // Salvar todos os usuários para uso em filtros
      setTodosUsuarios(usuarios);
      
      console.log(`📊 Dados recebidos: ${tarefasAbertas.length} tarefas, ${obrigacoes.length} obrigações, ${usuarios.length} usuários`);
      
      // 🚀 TIMING DO PROCESSAMENTO JAVASCRIPT
      const processamentoStart = performance.now();
      
      // 🔍 LOG DETALHADO DE TODAS AS OPERAÇÕES PARA IDENTIFICAR GARGALOS
      console.log("🔍 Iniciando processamento detalhado...");



      // APLICAR FILTRO DE USUÁRIOS SELECIONADOS
      if (usuariosSelecionados.length > 0) {
        console.log("👥 Aplicando filtro de usuários...");
        const start = performance.now();
        usuarios = usuarios.filter(usuario => 
          usuariosSelecionados.includes(usuario.nome)
        );
        console.log(`✅ Filtro de usuários aplicado em: ${(performance.now() - start).toFixed(2)}ms`);
      }

      // Filtrar tarefas e obrigações do mês selecionado (mesma lógica da visão geral)
      console.log("📅 Filtrando tarefas por período...");
      const filtroTarefasStart = performance.now();
      const tarefasDoMes = tarefasAbertas.filter((t) => {
        const prazo = new Date(t.dataPrazo);
        return prazo.getMonth() === mesSelecionado &&
          prazo.getFullYear() === anoSelecionado;
      });
      console.log(`✅ Filtro de tarefas por período em: ${(performance.now() - filtroTarefasStart).toFixed(2)}ms`);

      console.log("📅 Filtrando obrigações por período...");
      const filtroObrigacoesStart = performance.now();
      const obrigacoesDoMes = obrigacoes.filter((o) => {
        const venc = o.vencimento || o.dataPrazo;
        if (!venc) return false;
        const dataVencimento = venc.split("T")[0];
        const [ano, mes] = dataVencimento.split("-");
        return (
          Number(ano) === anoSelecionado &&
          Number(mes) === mesSelecionado + 1
        );
      });
      console.log(`✅ Filtro de obrigações por período em: ${(performance.now() - filtroObrigacoesStart).toFixed(2)}ms`);

      // APLICAR FILTRO DE TIPOS DE TAREFAS
      let tarefasFiltradas = tarefasDoMes;
      let obrigacoesFiltradas = obrigacoesDoMes;

      if (tiposTarefas === "Processos") {
        obrigacoesFiltradas = []; // Não mostrar obrigações
      } else if (tiposTarefas === "Obrigações") {
        tarefasFiltradas = []; // Não mostrar tarefas
      }
      // Se for "Todos", mantém ambos

      // APLICAR FILTRO DE DEPARTAMENTOS
      if (departamentos.length > 0) {
        console.log("🔍 Aplicando filtro de departamentos:", departamentos);
        const normaliza = (valor) => (valor ?? '').toString().toLowerCase();

        const tarefasAntes = tarefasFiltradas.length;
        tarefasFiltradas = tarefasFiltradas.filter((t) =>
          departamentos.some((dept) => {
            const deptStr = typeof dept === 'string' ? dept : String(dept);
            const alvo = deptStr.toLowerCase();
            const match = (
              normaliza(t.departamento) === alvo ||
              normaliza(t.departamentoNome) === alvo ||
              normaliza(t.departamento_nome) === alvo
            );
            if (match) {
              console.log(`✅ Tarefa ${t.id} match com departamento ${deptStr}`);
            }
            return match;
          })
        );
        console.log(`📊 Tarefas filtradas: ${tarefasAntes} -> ${tarefasFiltradas.length}`);

        const obrigacoesAntes = obrigacoesFiltradas.length;
        obrigacoesFiltradas = obrigacoesFiltradas.filter((o) =>
          departamentos.some((dept) => {
            const deptStr = typeof dept === 'string' ? dept : String(dept);
            const match = normaliza(o.departamento_nome) === deptStr.toLowerCase();
            if (match) {
              console.log(`✅ Obrigação ${o.nome} match com departamento ${deptStr}`);
            }
            return match;
          })
        );
        console.log(`📊 Obrigações filtradas: ${obrigacoesAntes} -> ${obrigacoesFiltradas.length}`);
      } else {
        console.log("🔍 Nenhum departamento selecionado, mantendo todos os dados");
      }

      // APLICAR FILTRO DE OBRIGAÇÕES
      if (obrigacoesSelecionadas.length > 0) {
        obrigacoesFiltradas = obrigacoesFiltradas.filter(o => 
          obrigacoesSelecionadas.includes(o.nome)
        );
      }

      // Calcular tarefas realizadas (mesma lógica da visão geral)
      const tarefasRealizadas = [
        ...tarefasFiltradas.filter(t => {
          const total = t.atividades?.length || 0;
          const concluidas = t.atividades?.filter((a) => a.concluida === 1 || a.cancelada === 1).length || 0;

          return (
            t.status?.toLowerCase() === "concluída" ||
            t.baixadaAutomaticamente === 1 ||
            (total > 0 && concluidas === total)
          );
        }),
        ...obrigacoesFiltradas.filter(o => {
          // Se a obrigação está marcada como CONCLUÍDA, ela está concluída independentemente das atividades
          if (o.status?.toLowerCase() === "concluida") {
            return true;
          }
          // Se foi baixada automaticamente, também está concluída
          if (o.baixadaAutomaticamente === 1) {
            return true;
          }
          // Caso contrário, verificar se todas as atividades estão concluídas
          const total = o.atividades?.length || 0;
          const concluidas = o.atividades?.filter((a) => a.concluida === 1 || a.cancelada === 1).length || 0;
          return total > 0 && concluidas === total;
        })
      ];

      // Calcular tarefas em aberto e atrasadas
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0); // Zerar horário para comparação apenas de data

      const tarefasEmAberto = tarefasFiltradas.filter((t) => {
        if (t.baixadaAutomaticamente === 1) return false;
        
        const total = t.atividades?.length || 0;
        const concluidas = t.atividades?.filter((a) => a.concluida === 1 || a.cancelada === 1).length || 0;
        const naoConcluida = total === 0 || concluidas < total;
        
        if (!naoConcluida) return false; // Se já foi concluída, não está em aberto
        
        // Verificar se ainda não passou do prazo
        const dataPrazo = new Date(t.dataPrazo);
        dataPrazo.setHours(0, 0, 0, 0);
        
        return dataPrazo >= hoje; // Em aberto = não concluída + ainda não passou do prazo
      });

      const tarefasAtrasadas = tarefasFiltradas.filter((t) => {
        if (t.baixadaAutomaticamente === 1) return false;
        
        const total = t.atividades?.length || 0;
        const concluidas = t.atividades?.filter((a) => a.concluida === 1 || a.cancelada === 1).length || 0;
        const naoConcluida = total === 0 || concluidas < total;
        
        if (!naoConcluida) return false; // Se já foi concluída, não está atrasada
        
        // Verificar se passou do prazo
        const dataPrazo = new Date(t.dataPrazo);
        dataPrazo.setHours(0, 0, 0, 0);
        
        return dataPrazo < hoje; // Atrasada = não concluída + passou do prazo
      });

      const obrigacoesEmAberto = obrigacoesFiltradas.filter((o) => {
        // Se foi baixada automaticamente, não está em aberto
        if (o.baixadaAutomaticamente === 1) return false;
        // Se está marcada como concluída, não está em aberto
        if (o.status?.toLowerCase() === "concluida") return false;
        
        // Verificar se ainda não passou do prazo
        const venc = o.vencimento || o.dataPrazo;
        if (!venc) return false;
        
        const dataVencimento = new Date(venc);
        dataVencimento.setHours(0, 0, 0, 0);
        
        return dataVencimento >= hoje; // Em aberto = não concluída + ainda não passou do prazo
      });

      const obrigacoesAtrasadas = obrigacoesFiltradas.filter((o) => {
        // Se foi baixada automaticamente, não está atrasada
        if (o.baixadaAutomaticamente === 1) return false;
        // Se está marcada como concluída, não está atrasada
        if (o.status?.toLowerCase() === "concluida") return false;
        
        // Verificar se passou do prazo
        const venc = o.vencimento || o.dataPrazo;
        if (!venc) return false;
        
        const dataVencimento = new Date(venc);
        dataVencimento.setHours(0, 0, 0, 0);
        
        return dataVencimento < hoje; // Atrasada = não concluída + passou do prazo
      });

      // Calcular estatísticas gerais
      let totalRealizadas = tarefasRealizadas.length;
      let totalEmAberto = tarefasEmAberto.length + obrigacoesEmAberto.length;
      let totalAtrasadas = tarefasAtrasadas.length + obrigacoesAtrasadas.length;
      let total = totalRealizadas + totalEmAberto + totalAtrasadas;

      // APLICAR FILTRO DE USUÁRIOS SELECIONADOS NAS ESTATÍSTICAS GERAIS
      if (usuariosSelecionados.length > 0) {
        // Filtrar tarefas e obrigações apenas dos usuários selecionados
        const tarefasFiltradasPorUsuario = tarefasFiltradas.filter(t => {
          const responsavel = todosUsuarios.find(u => u.id === t.responsavelId);
          return responsavel && usuariosSelecionados.includes(responsavel.nome);
        });

        const obrigacoesFiltradasPorUsuario = obrigacoesFiltradas.filter(o => {
          const responsaveis = o.responsaveis || [];
          return responsaveis.some((resp) => {
            const userId = resp.usuarioId || resp.id || resp.userId;
            const responsavel = todosUsuarios.find(u => u.id === userId);
            return responsavel && usuariosSelecionados.includes(responsavel.nome);
          });
        });

        // Recalcular estatísticas usando a MESMA lógica da performance individual
        const tarefasConcluidasFiltradas = tarefasFiltradasPorUsuario.filter(t => {
          const total = t.atividades?.length || 0;
          const concluidas = t.atividades?.filter((a) => a.concluida === 1 || a.cancelada === 1).length || 0;
          return (
            t.status?.toLowerCase() === "concluída" ||
            t.baixadaAutomaticamente === 1 ||
            (total > 0 && concluidas === total)
          );
        });

        const tarefasEmAbertoFiltradas = tarefasFiltradasPorUsuario.filter(t => {
          if (t.baixadaAutomaticamente === 1) return false;
          const total = t.atividades?.length || 0;
          const concluidas = t.atividades?.filter((a) => a.concluida === 1 || a.cancelada === 1).length || 0;
          const naoConcluida = total === 0 || concluidas < total;
          
          if (!naoConcluida) return false;
          
          const dataPrazo = new Date(t.dataPrazo);
          dataPrazo.setHours(0, 0, 0, 0);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          
          return dataPrazo >= hoje;
        });

        const tarefasAtrasadasFiltradas = tarefasFiltradasPorUsuario.filter(t => {
          if (t.baixadaAutomaticamente === 1) return false;
          
          const total = t.atividades?.length || 0;
          const concluidas = t.atividades?.filter((a) => a.concluida === 1 || a.cancelada === 1).length || 0;
          const naoConcluida = total === 0 || concluidas < total;
          
          if (!naoConcluida) return false;
          
          const dataPrazo = new Date(t.dataPrazo);
          dataPrazo.setHours(0, 0, 0, 0);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          
          return dataPrazo < hoje;
        });

        const obrigacoesConcluidasFiltradas = obrigacoesFiltradasPorUsuario.filter(o => {
          // Se a obrigação está marcada como CONCLUÍDA, ela está concluída independentemente das atividades
          if (o.status?.toLowerCase() === "concluida") {
            return true;
          }
          // Se foi baixada automaticamente, também está concluída
          if (o.baixadaAutomaticamente === 1) {
            return true;
          }
          // Caso contrário, verificar se todas as atividades estão concluídas
          const total = o.atividades?.length || 0;
          const concluidas = o.atividades?.filter((a) => a.concluida === 1 || a.cancelada === 1).length || 0;
          return total > 0 && concluidas === total;
        });

        const obrigacoesEmAbertoFiltradas = obrigacoesFiltradasPorUsuario.filter(o => {
          // Se foi baixada automaticamente, não está em aberto
          if (o.baixadaAutomaticamente === 1) return false;
          // Se está marcada como concluída, não está em aberto
          if (o.status?.toLowerCase() === "concluida") return false;
          
          const venc = o.vencimento || o.dataPrazo;
          if (!venc) return false;
          
          const dataVencimento = new Date(venc);
          dataVencimento.setHours(0, 0, 0, 0);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          
          return dataVencimento >= hoje;
        });

        const obrigacoesAtrasadasFiltradas = obrigacoesFiltradasPorUsuario.filter(o => {
          // Se foi baixada automaticamente, não está atrasada
          if (o.baixadaAutomaticamente === 1) return false;
          // Se está marcada como concluída, não está atrasada
          if (o.status?.toLowerCase() === "concluida") return false;
          
          const venc = o.vencimento || o.dataPrazo;
          if (!venc) return false;
          
          const dataVencimento = new Date(venc);
          dataVencimento.setHours(0, 0, 0, 0);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          
          return dataVencimento < hoje;
        });

        // Recalcular estatísticas com dados filtrados usando a mesma lógica
        totalRealizadas = tarefasConcluidasFiltradas.length + obrigacoesConcluidasFiltradas.length;
        totalEmAberto = tarefasEmAbertoFiltradas.length + obrigacoesEmAbertoFiltradas.length;
        totalAtrasadas = tarefasAtrasadasFiltradas.length + obrigacoesAtrasadasFiltradas.length;
        total = totalRealizadas + totalEmAberto + totalAtrasadas;
      }

      // Filtrar usuários por departamento se necessário
      let usuariosParaCalcular = usuarios;
      if (departamentos.length > 0) {
        console.log("🔍 Filtrando usuários por departamento:", departamentos);
        console.log("🔍 Total de usuários antes do filtro:", usuarios.length);
        console.log("🔍 Exemplo de usuário:", usuarios[0]);
        
        usuariosParaCalcular = usuarios.filter(usuario => {
          const match = departamentos.some(dept => {
            const deptStr = typeof dept === 'string' ? dept : String(dept);
            const usuarioDept = usuario.departamentoNome?.toLowerCase();
            const deptLower = deptStr.toLowerCase();
            const isMatch = usuarioDept === deptLower;
            
            console.log(`🔍 Usuário ${usuario.nome}: "${usuarioDept}" === "${deptLower}" = ${isMatch}`);
            
            return isMatch;
          });
          
          if (match) {
            console.log(`✅ Usuário ${usuario.nome} incluído no filtro`);
          } else {
            console.log(`❌ Usuário ${usuario.nome} excluído do filtro`);
          }
          
          return match;
        });
        console.log("🔍 Usuários filtrados por departamento:", departamentos, "Total:", usuariosParaCalcular.length);
      } else {
        console.log("🔍 Nenhum departamento selecionado, mantendo todos os usuários");
      }

      // Calcular performance por usuário
      const usuariosPerformance = usuariosParaCalcular.map(usuario => {
        // Para tarefas: usar responsavelId diretamente
        const tarefasDoUsuario = tarefasFiltradas.filter(t => t.responsavelId === usuario.id);
        
        // Para obrigações: usar a tabela de responsáveis
        const obrigacoesDoUsuario = obrigacoesFiltradas.filter(o => {
          // Verificar se o usuário está na lista de responsáveis da obrigação
          const isResponsible = o.responsaveis && o.responsaveis.some((resp) => {
            // Try different possible field names for user ID
            const userId = resp.usuarioId || resp.id || resp.userId;
            return userId === usuario.id;
          });
          
          return isResponsible;
        });
        
        const tarefasConcluidas = tarefasDoUsuario.filter(t => {
          const total = t.atividades?.length || 0;
          const concluidas = t.atividades?.filter((a) => a.concluida === 1 || a.cancelada === 1).length || 0;
          return (
            t.status?.toLowerCase() === "concluída" ||
            t.baixadaAutomaticamente === 1 ||
            (total > 0 && concluidas === total)
          );
        });

        const tarefasEmAbertoUsuario = tarefasDoUsuario.filter(t => {
          if (t.baixadaAutomaticamente === 1) return false;
          const total = t.atividades?.length || 0;
          const concluidas = t.atividades?.filter((a) => a.concluida === 1 || a.cancelada === 1).length || 0;
          const naoConcluida = total === 0 || concluidas < total;
          
          if (!naoConcluida) return false; // Se já foi concluída, não está em aberto
          
          // Verificar se ainda não passou do prazo
          const dataPrazo = new Date(t.dataPrazo);
          dataPrazo.setHours(0, 0, 0, 0);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          
          return dataPrazo >= hoje; // Em aberto = não concluída + ainda não passou do prazo
        });

        const tarefasAtrasadasUsuario = tarefasDoUsuario.filter(t => {
          if (t.baixadaAutomaticamente === 1) return false;
          
          const total = t.atividades?.length || 0;
          const concluidas = t.atividades?.filter((a) => a.concluida === 1 || a.cancelada === 1).length || 0;
          const naoConcluida = total === 0 || concluidas < total;
          
          if (!naoConcluida) return false; // Se já foi concluída, não está atrasada
          
          // Verificar se passou do prazo
          const dataPrazo = new Date(t.dataPrazo);
          dataPrazo.setHours(0, 0, 0, 0);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          
          return dataPrazo < hoje; // Atrasada = não concluída + passou do prazo
        });

        const obrigacoesConcluidas = obrigacoesDoUsuario.filter(o => {
          // Se a obrigação está marcada como CONCLUÍDA, ela está concluída independentemente das atividades
          if (o.status?.toLowerCase() === "concluida") {
            return true;
          }
          // Se foi baixada automaticamente, também está concluída
          if (o.baixadaAutomaticamente === 1) {
            return true;
          }
          // Caso contrário, verificar se todas as atividades estão concluídas
          const total = o.atividades?.length || 0;
          const concluidas = o.atividades?.filter((a) => a.concluida === 1 || a.cancelada === 1).length || 0;
          return total > 0 && concluidas === total;
        });

        const obrigacoesEmAbertoUsuario = obrigacoesDoUsuario.filter(o => {
          // Se foi baixada automaticamente, não está em aberto
          if (o.baixadaAutomaticamente === 1) return false;
          // Se está marcada como concluída, não está em aberto
          if (o.status?.toLowerCase() === "concluida") return false;
          
          // Verificar se ainda não passou do prazo
          const venc = o.vencimento || o.dataPrazo;
          if (!venc) return false;
          
          const dataVencimento = new Date(venc);
          dataVencimento.setHours(0, 0, 0, 0);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          
          return dataVencimento >= hoje; // Em aberto = não concluída + ainda não passou do prazo
        });

        const obrigacoesAtrasadasUsuario = obrigacoesDoUsuario.filter(o => {
          // Se foi baixada automaticamente, não está atrasada
          if (o.baixadaAutomaticamente === 1) return false;
          // Se está marcada como concluída, não está atrasada
          if (o.status?.toLowerCase() === "concluida") return false;
          
          // Verificar se passou do prazo
          const venc = o.vencimento || o.dataPrazo;
          if (!venc) return false;
          
          const dataVencimento = new Date(venc);
          dataVencimento.setHours(0, 0, 0, 0);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          
          return dataVencimento < hoje; // Atrasada = não concluída + passou do prazo
        });

        const totalTarefas = tarefasConcluidas.length + tarefasEmAbertoUsuario.length + tarefasAtrasadasUsuario.length;
        const totalObrigacoes = obrigacoesConcluidas.length + obrigacoesEmAbertoUsuario.length + obrigacoesAtrasadasUsuario.length;
        const totalUsuario = totalTarefas + totalObrigacoes;

        return {
          id: usuario.id,
          nome: usuario.nome,
          cargo: usuario.cargoNome || 'Sem cargo',
          departamento: usuario.departamentoNome || 'Sem departamento',
          foto: usuario.imagem,
          tarefas: {
            total: totalUsuario,
            emAberto: tarefasEmAbertoUsuario.length + obrigacoesEmAbertoUsuario.length,
            atrasadas: tarefasAtrasadasUsuario.length + obrigacoesAtrasadasUsuario.length,
            concluidas: tarefasConcluidas.length + obrigacoesConcluidas.length
          }
        };
      });

      // Formatar dados para o frontend
      const dadosFormatados = {
        performanceGeral: {
          total: total,
          emAberto: totalEmAberto,
          atrasadas: totalAtrasadas,
          concluidas: totalRealizadas
        },
        usuarios: usuariosPerformance
      };

      // Atualizar todos os estados de uma vez para renderização imediata
      console.log("🔄 Atualizando estados para renderização...");
      const estadosStart = performance.now();
      
      setPerformanceGeral(dadosFormatados.performanceGeral);
      setUsuariosPerformance(dadosFormatados.usuarios);
      
      console.log(`✅ Estados principais atualizados em: ${(performance.now() - estadosStart).toFixed(2)}ms`);
      
      // Atualizar obrigações filtradas baseado nos departamentos selecionados
      if (obrigacoesReais.length > 0) {
        console.log("📋 Atualizando obrigações filtradas...");
        const obrigacoesFiltradasStart = performance.now();
        
        console.log("🔍 Departamentos selecionados:", departamentos);
        console.log("🔍 Exemplo de obrigação:", obrigacoesReais[0]);
        console.log("🔍 Estrutura completa da primeira obrigação:", JSON.stringify(obrigacoesReais[0], null, 2));
        console.log("🔍 Todas as obrigações têm departamento_nome?", obrigacoesReais.every(o => o.departamento_nome));
        console.log("🔍 Departamentos únicos nas obrigações:", [...new Set(obrigacoesReais.map(o => o.departamento_nome).filter(Boolean))]);
        
        const obrigacoesFiltradasPorDepartamento = obrigacoesReais.filter((o) => {
          // Se não há departamentos selecionados, mostrar todas
          if (departamentos.length === 0) {
            console.log("🔍 Nenhum departamento selecionado, mostrando todas as obrigações");
            return true;
          }
          
          // Verificar se a obrigação tem departamento
          if (!o.departamento_nome) {
            console.log(`❌ Obrigação "${o.nome}" não tem departamento_nome`);
            return false;
          }
          
          console.log(`🔍 Verificando obrigação "${o.nome}" com departamento "${o.departamento_nome}"`);
          console.log("🔍 Departamentos selecionados:", departamentos);
          
          // Verificar se algum departamento selecionado corresponde
          const match = departamentos.some(dept => {
            const deptStr = typeof dept === 'string' ? dept : String(dept);
            const isMatch = o.departamento_nome.toLowerCase() === deptStr.toLowerCase();
            
            console.log(`🔍 Comparando: "${o.departamento_nome}" === "${deptStr}" = ${isMatch}`);
            
            if (isMatch) {
              console.log(`✅ Obrigação "${o.nome}" corresponde ao departamento "${deptStr}"`);
            }
            return isMatch;
          });
          
          console.log(`🔍 Resultado para "${o.nome}": ${match ? 'INCLUÍDA' : 'EXCLUÍDA'}`);
          return match;
        });
        
        setObrigacoesFiltradas(obrigacoesFiltradasPorDepartamento);
        console.log(`✅ Obrigações filtradas atualizadas em: ${(performance.now() - obrigacoesFiltradasStart).toFixed(2)}ms`);
        console.log(`📊 Obrigações filtradas: ${obrigacoesFiltradasPorDepartamento.length}/${obrigacoesReais.length}`);
      }
      
      // 🚀 FINALIZAR TIMING DO PROCESSAMENTO
      const processamentoTime = performance.now() - processamentoStart;
      console.log(`⚡ Processamento JavaScript concluído em: ${processamentoTime.toFixed(2)}ms`);
      
      const tempoTotal = performance.now() - startTime;
      console.log(`🎯 TEMPO TOTAL DA OPERAÇÃO: ${tempoTotal.toFixed(2)}ms`);
      console.log(`📊 Resumo: APIs=${totalAPITime.toFixed(2)}ms | JS=${processamentoTime.toFixed(2)}ms | Total=${tempoTotal.toFixed(2)}ms`);
      
      // Aguardar um tick para garantir que todos os estados foram atualizados
      console.log("⏳ Aguardando próximo tick para finalizar...");
      setTimeout(() => {
        // Marcar que os dados foram carregados APÓS todo o processamento
        console.log("✅ Dados completamente processados - marcando como carregados");
        setDadosCarregados(true);
        
        // 🚨 SOLUÇÃO IMEDIATA: Forçar loading como false
        console.log("🚨 FORÇANDO loading como false...");
        setLoading(false);
        
        // Forçar re-renderização imediata
        console.log("🔄 Forçando re-renderização...");
        setPerformanceGeral(prev => ({ ...prev }));
        
        console.log("🎯 Renderização forçada concluída!");
      }, 0);
      
      // Retornar Promise que resolve quando os dados estão prontos
      return new Promise((resolve) => {
        const checkDadosCarregados = () => {
          if (dadosCarregados) {
            resolve();
          } else {
            setTimeout(checkDadosCarregados, 10);
          }
        };
        checkDadosCarregados();
      });
      
    } catch (error) {
      console.error("Erro ao carregar dados de performance:", error);
      // Em caso de erro, usar dados vazios
      setPerformanceGeral({
        total: 0,
        emAberto: 0,
        atrasadas: 0,
        concluidas: 0
      });
      setUsuariosPerformance([]);
      setUsuariosFiltrados([]);
    }
  };

  // Função para carregar departamentos reais
  const carregarDepartamentos = async () => {
    try {
      setCarregandoDepartamentos(true);
      const { token, empresaId } = getAuthInfo();

      if (!token || !empresaId) {
        router.replace("/auth/login");
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "X-Empresa-Id": empresaId.toString()
      };
      console.log("🏢 Iniciando carregamento de departamentos...");
      const startTime = performance.now();
      
      // Usar a rota dedicada para nomes de departamentos (retorna { id, nome })
      const res = await fetchJson(`/gestao/departamentos/empresa/${empresaId}/nomes`, { headers });
      const time = performance.now() - startTime;
      
      console.log(`✅ Departamentos carregados em: ${time.toFixed(2)}ms - ${res.data?.length || 0} departamentos`);
      console.log("🔍 Dados dos departamentos:", res.data);
      console.log("🔍 Estrutura do primeiro departamento:", res.data?.[0]);
      console.log("🔍 Status da resposta:", res.status);
      console.log("🔍 Headers da resposta:", res.headers);
      
      // Normalizar: garantir array de objetos { id, nome }, únicos e ordenados
      const departamentosArray = Array.isArray(res.data) 
        ? [...res.data]
            .filter((d) => d && (d.nome ?? '').toString().trim() !== '')
            .reduce((acc, cur) => {
              const nome = (cur.nome || '').toString();
              if (!acc.find((x) => x.nome === nome)) acc.push({ id: cur.id, nome });
              return acc;
            }, [])
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        : [];
      console.log("🔍 Array de departamentos processado:", departamentosArray);
      console.log("🔍 Verificando se tem propriedade 'nome':", departamentosArray.map(d => ({ id: d.id, nome: d.nome, hasNome: !!d.nome })));
      setDepartamentosReais(departamentosArray);
      
      console.log("📊 Estado departamentosReais atualizado:", departamentosArray.length, "departamentos");
    } catch (error) {
      const errorInfo =
        error && typeof error === "object"
          ? {
              message: error.message,
              status: error.response?.status,
              data: error.response?.data,
              config: error.config,
            }
          : { message: String(error) };
      console.error("❌ Erro ao carregar departamentos:", error);
      console.error("❌ Detalhes do erro:", errorInfo);
      setDepartamentosReais([]);
    } finally {
      setCarregandoDepartamentos(false);
    }
  };

  // Função para carregar obrigações reais
  const carregarObrigacoes = async () => {
    try {
      const { token, empresaId } = getAuthInfo();

      if (!token || !empresaId) {
        router.replace("/auth/login");
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "X-Empresa-Id": empresaId.toString()
      };
      console.log("📋 Iniciando carregamento de obrigações...");
      const startTime = performance.now();
      
      const res = await fetchJson(`/gestao/obrigacoes/empresa/${empresaId}/todas`, { headers });
      const time = performance.now() - startTime;
      
      console.log(`✅ Obrigações carregadas em: ${time.toFixed(2)}ms - ${res.data?.length || 0} obrigações`);
      
      // Remover duplicatas por nome
      const obrigacoesUnicas = Array.isArray(res.data) ? res.data.filter((obrigacao, index, self) => 
        index === self.findIndex(o => o.nome === obrigacao.nome)
      ) : [];
      
      setObrigacoesReais(obrigacoesUnicas);
    } catch (error) {
      console.error("❌ Erro ao carregar obrigações:", error);
      setObrigacoesReais([]);
    }
  };

  // Função para atualizar URL com filtros
const atualizarURL = (filtros) => {
    const params = new URLSearchParams();
    
    if (filtros.periodo && filtros.periodo !== periodoSelecionado) {
      params.set('periodo', filtros.periodo);
    }
    if (filtros.departamento && filtros.departamento !== "Todos") {
      params.set('departamento', filtros.departamento);
    }
    if (filtros.tipoTarefa && filtros.tipoTarefa !== "Todos") {
      params.set('tipoTarefa', filtros.tipoTarefa);
    }
    if (filtros.time && filtros.time !== "Todos") {
      params.set('time', filtros.time);
    }
    if (filtros.usuario && filtros.usuario !== "Todos") {
      params.set('usuario', filtros.usuario);
    }
    if (filtros.tipoUsuario && filtros.tipoUsuario !== "Todos") {
      params.set('tipoUsuario', filtros.tipoUsuario);
    }

    const novaURL = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(novaURL, { scroll: false });
  };

  // Função para carregar filtros da URL
  const carregarFiltrosDaURL = () => {
    const periodo = searchParams?.get('periodo');
    const departamento = searchParams?.get('departamento');
    const tipoTarefa = searchParams?.get('tipoTarefa');
    const time = searchParams?.get('time');
    const usuario = searchParams?.get('usuario');
    const tipoUsuario = searchParams?.get('tipoUsuario');
    const obrigacao = searchParams?.get('obrigacao');

    if (periodo) {
      setPeriodoSelecionado(periodo);
      setPeriodoTemp(periodo);
    }
    if (departamento) {
      const depts = departamento.split(',').filter(d => d.trim());
      setDepartamentos(depts);
      setDepartamentosTemp(depts);
    }
    if (tipoTarefa) {
      setTiposTarefas(tipoTarefa);
      setTiposTarefasTemp(tipoTarefa);
    }
    if (usuario) {
      const users = usuario.split(',').filter(u => u.trim());
      setUsuariosSelecionados(users);
      setUsuariosSelecionadosTemp(users);
    }
    if (obrigacao) {
      const obrs = obrigacao.split(',').filter(o => o.trim());
      setObrigacoesSelecionadas(obrs);
      setObrigacoesSelecionadasTemp(obrs);
    }
  };

  // 🚨 SOLUÇÃO PARA HYDRATION: Garantir que o componente só renderize no cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  // Carregar dados quando a página carrega
  useEffect(() => {
    if (!mounted) return; // Não carregar nada até estar montado no cliente
    
    console.log("🔄 useEffect executado - iniciando carregamento...");
    const carregarTudo = async () => {
      console.log("🚀 Iniciando carregamento...");
      const carregamentoInicio = performance.now();
      setLoading(true);
      
      try {
        console.log("📊 Carregando dados de performance...");
        console.log("⏳ Aguardando carregarDados()...");
        await carregarDados();
        console.log("✅ Dados de performance carregados");
        
        // 🚫 Carregar departamentos sempre para garantir dados atualizados
        console.log("🏢 Carregando departamentos...");
        await carregarDepartamentos();
        console.log("✅ Departamentos carregados - Estado atual:", departamentosReais.length);
        
        // 🚫 Carregar obrigações sempre para garantir dados atualizados
        console.log("📋 Carregando obrigações...");
        await carregarObrigacoes();
        console.log("✅ Obrigações carregadas");
        
        // 🔍 VERIFICAR ESTADOS APÓS CARREGAMENTO
        console.log("🔍 Estados após carregamento:", {
          departamentosReais: departamentosReais.length,
          obrigacoesReais: obrigacoesReais.length,
          usuariosFiltrados: usuariosFiltrados.length,
          obrigacoesFiltradas: obrigacoesFiltradas.length
        });
        
        // 🔄 Aplicar filtros será feito em useEffect separado após carregamento
        
        const carregamentoTotal = performance.now() - carregamentoInicio;
        console.log(`🎉 Carregamento completo em: ${carregamentoTotal.toFixed(2)}ms!`);
        
        console.log("🏁 Chegou no final do try - indo para finally...");
      } catch (error) {
        console.error("❌ Erro no carregamento:", error);
        // Fallback - mostrar dados vazios mas não travar
        setPerformanceGeral({
          total: 0,
          emAberto: 0,
          atrasadas: 0,
          concluidas: 0
        });
        setUsuariosPerformance([]);
        console.log("🏁 Chegou no catch - indo para finally...");
      } finally {
        console.log("🏁 Finalizando loading...");
        console.log("🔧 Definindo loading como false...");
        setLoading(false);
        setDadosCarregados(true);
        console.log("✅ Loading definido como false!");
      }
    };
    
    carregarTudo();
  }, [mounted]); // Removidas as dependências problemáticas

  

  // Aplicar filtros após carregamento de obrigações
  useEffect(() => {
    if (obrigacoesReais.length > 0) {
      console.log("🔄 Aplicando filtros após carregamento de obrigações...");
      setObrigacoesFiltradas(obrigacoesReais);
      console.log(`✅ Obrigações filtradas aplicadas: ${obrigacoesReais.length}`);
    }
  }, [obrigacoesReais]);

  // Carregar filtros da URL quando searchParams mudar
  useEffect(() => {
    carregarFiltrosDaURL();
  }, [searchParams]);

  // Recarregar dados quando filtros mudam (apenas após carregamento inicial)
  useEffect(() => {
    if (!loading && performanceGeral.total >= 0) { // Garantir que já carregou pelo menos uma vez
      console.log("🔄 Recarregando dados devido a mudança de filtros...");
      console.log("🔍 Filtros que mudaram:", {
        periodoSelecionado,
        departamentos,
        tiposTarefas,
        usuariosSelecionados,
        obrigacoesSelecionadas
      });
      // Usar setTimeout para evitar múltiplas chamadas simultâneas
      const timeoutId = setTimeout(() => {
        carregarDados();
      }, 25); // Reduzido para 25ms para ser mais responsivo
      return () => clearTimeout(timeoutId);
    }
  }, [periodoSelecionado, departamentos, tiposTarefas, usuariosSelecionados, obrigacoesSelecionadas]);

  // 🚫 Evitar carregamento duplicado se já temos dados
  const carregarDadosSeNecessario = () => {
    if (departamentosReais.length === 0 || obrigacoesReais.length === 0) {
      console.log("📋 Carregando dados necessários...");
      carregarDados();
    } else {
      console.log("✅ Dados já carregados, pulando carregamento...");
    }
  };

  // Recarregar usuários filtrados quando departamentos TEMPORÁRIOS mudam
  useEffect(() => {
    if (todosUsuarios.length > 0) {
      console.log("🔄 Filtrando usuários por departamentos temporários:", departamentosTemp);
      console.log("🔍 Total de usuários disponíveis:", todosUsuarios.length);
      console.log("🔍 Exemplo de usuário:", todosUsuarios[0]);
      
      const usuariosFiltradosPorDepartamento = todosUsuarios.filter((u) => {
        // Se não há departamentos selecionados, mostrar todos os usuários
        if (departamentosTemp.length === 0) {
          console.log(`✅ Usuário ${u.nome} incluído (sem filtro de departamento)`);
          return true;
        }
        
        // Verificar se o usuário tem departamento
        if (!u.departamentoNome) {
          console.log(`⚠️ Usuário ${u.nome} não tem departamento definido`);
          return false;
        }
        
        console.log(`🔍 Verificando usuário ${u.nome} com departamento "${u.departamentoNome}"`);
        console.log(`🔍 Departamentos selecionados:`, departamentosTemp);
        
        // Verificar se algum departamento selecionado corresponde
        const match = departamentosTemp.some(dept => {
          const deptStr = typeof dept === 'string' ? dept : String(dept);
          const isMatch = u.departamentoNome.toLowerCase() === deptStr.toLowerCase();
          
          console.log(`🔍 Comparando: "${u.departamentoNome}" === "${deptStr}" = ${isMatch}`);
          
          if (isMatch) {
            console.log(`✅ Usuário ${u.nome} corresponde ao departamento ${deptStr}`);
          }
          
          return isMatch;
        });
        
        if (match) {
          console.log(`✅ Usuário ${u.nome} INCLUÍDO na filtragem`);
        } else {
          console.log(`❌ Usuário ${u.nome} EXCLUÍDO da filtragem`);
        }
        
        return match;
      });
      
      setUsuariosFiltrados(usuariosFiltradosPorDepartamento);
      console.log(`✅ Usuários filtrados por departamento: ${usuariosFiltradosPorDepartamento.length}/${todosUsuarios.length}`);
      console.log(`📋 Lista de usuários filtrados:`, usuariosFiltradosPorDepartamento.map(u => u.nome));
      
      // Se há departamentos selecionados, limpar usuários selecionados que não pertencem aos departamentos
      if (departamentosTemp.length > 0) {
        const usuariosValidos = usuariosFiltradosPorDepartamento.map(u => u.nome);
        const usuariosSelecionadosValidos = usuariosSelecionadosTemp.filter(nome => 
          usuariosValidos.includes(nome)
        );
        
        if (usuariosSelecionadosValidos.length !== usuariosSelecionadosTemp.length) {
          console.log("🔄 Limpando usuários selecionados que não pertencem aos departamentos filtrados");
          setUsuariosSelecionadosTemp(usuariosSelecionadosValidos);
        }
      }
    } else {
      // Limpar se não há usuários carregados
      setUsuariosFiltrados([]);
    }
  }, [departamentosTemp, todosUsuarios, usuariosSelecionadosTemp]);

  // Recarregar usuários filtrados quando departamentos APLICADOS mudam
  useEffect(() => {
    if (todosUsuarios.length > 0) {
      console.log("🔄 Filtrando usuários por departamentos aplicados:", departamentos);
      
      const usuariosFiltradosPorDepartamento = todosUsuarios.filter((u) => {
        // Se não há departamentos selecionados, mostrar todos os usuários
        if (departamentos.length === 0) {
          return true;
        }
        
        // Verificar se o usuário tem departamento
        if (!u.departamentoNome) {
          console.log(`⚠️ Usuário ${u.nome} não tem departamento definido`);
          return false;
        }
        
        // Verificar se algum departamento selecionado corresponde
        const match = departamentos.some(dept => {
          const deptStr = typeof dept === 'string' ? dept : String(dept);
          const isMatch = u.departamentoNome.toLowerCase() === deptStr.toLowerCase();
          
          if (isMatch) {
            console.log(`✅ Usuário ${u.nome} corresponde ao departamento ${deptStr}`);
          }
          
          return isMatch;
        });
        
        return match;
      });
      
      setUsuariosFiltrados(usuariosFiltradosPorDepartamento);
      console.log(`✅ Usuários filtrados por departamento aplicado: ${usuariosFiltradosPorDepartamento.length}/${todosUsuarios.length}`);
      
      // Se há departamentos selecionados, limpar usuários selecionados que não pertencem aos departamentos
      if (departamentos.length > 0) {
        const usuariosValidos = usuariosFiltradosPorDepartamento.map(u => u.nome);
        const usuariosSelecionadosValidos = usuariosSelecionados.filter(nome => 
          usuariosValidos.includes(nome)
        );
        
        if (usuariosSelecionadosValidos.length !== usuariosSelecionados.length) {
          console.log("🔄 Limpando usuários selecionados que não pertencem aos departamentos aplicados");
          setUsuariosSelecionados(usuariosSelecionadosValidos);
        }
      }
    }
  }, [departamentos, todosUsuarios, usuariosSelecionados]);

  // Recarregar obrigações filtradas quando departamentos TEMPORÁRIOS mudam
  useEffect(() => {
    if (obrigacoesReais.length > 0) {
      const obrigacoesFiltradasPorDepartamento = obrigacoesReais.filter((o) => 
        departamentosTemp.length === 0 || 
        departamentosTemp.some(dept => {
          const deptStr = typeof dept === 'string' ? dept : String(dept);
          return o.departamento_nome?.toLowerCase() === deptStr.toLowerCase();
        })
      );
      setObrigacoesFiltradas(obrigacoesFiltradasPorDepartamento);
    } else {
      // Limpar se não há obrigações carregadas
      setObrigacoesFiltradas([]);
    }
  }, [departamentosTemp, obrigacoesReais]);

  // Recarregar obrigações filtradas quando departamentos APLICADOS mudam
  useEffect(() => {
    if (obrigacoesReais.length > 0) {
      const obrigacoesFiltradasPorDepartamento = obrigacoesReais.filter((o) => 
        departamentos.length === 0 || 
        departamentos.some(dept => {
          const deptStr = typeof dept === 'string' ? dept : String(dept);
          return o.departamento_nome?.toLowerCase() === deptStr.toLowerCase();
        })
      );
      setObrigacoesFiltradas(obrigacoesFiltradasPorDepartamento);
    }
  }, [departamentos, obrigacoesReais]);

  // Handlers para dropdowns
const toggleDropdown = (dropdown) => {
    switch (dropdown) {
      case 'periodo':
        setDropdownPeriodo(!dropdownPeriodo);
        setDropdownTiposTarefas(false);
        setDropdownUsuarios(false);
        break;
      case 'tiposTarefas':
        setDropdownTiposTarefas(!dropdownTiposTarefas);
        setDropdownPeriodo(false);
        setDropdownUsuarios(false);
        break;
      case 'usuarios':
        setDropdownUsuarios(!dropdownUsuarios);
        setDropdownPeriodo(false);
        setDropdownTiposTarefas(false);
        break;
    }
  };

  // Função para calcular progresso do donut chart
  const calcularProgresso = (usuario) => {
    const total = usuario.tarefas.total;
    const concluidas = usuario.tarefas.concluidas;
    return total > 0 ? Math.round((concluidas / total) * 100) : 0;
  };

  // Função para obter cor baseada no status
  const getCorStatus = (status) => {
    switch (status) {
      case 'emAberto': return '#facc15';
      case 'atrasadas': return '#9333ea';
      case 'concluidas': return '#22c55e';
      default: return '#6b7280';
    }
  };

  // Função para aplicar filtros
  const aplicarFiltros = async () => {
    setLoadingFiltros(true);
    
    console.log("🔄 Iniciando aplicação de filtros...");
    console.log("🔍 Departamentos temporários:", departamentosTemp);
    console.log("🔍 Departamentos atuais:", departamentos);
    const startTime = performance.now();
    
    // Limpeza imediata e mais agressiva para evitar qualquer flash
    setPerformanceGeral({
      total: 0,
      emAberto: 0,
      atrasadas: 0,
      concluidas: 0
    });
    setUsuariosPerformance([]);
    setUsuariosFiltrados([]);
    setObrigacoesFiltradas([]);
    setDadosCarregados(false);
    
    try {
      // Copiar valores temporários para os valores aplicados
      console.log("📝 Aplicando filtros temporários...");
      setPeriodoSelecionado(periodoTemp);
      setTiposTarefas(tiposTarefasTemp);
      setDepartamentos([...departamentosTemp]);
      setUsuariosSelecionados([...usuariosSelecionadosTemp]);
      setObrigacoesSelecionadas([...obrigacoesSelecionadasTemp]);
      
      console.log("✅ Filtros aplicados:", {
        departamentos: [...departamentosTemp],
        usuarios: [...usuariosSelecionadosTemp],
        obrigacoes: [...obrigacoesSelecionadasTemp]
      });
      
      console.log("⚡ Filtros aplicados, recarregando dados...");
      const dadosStart = performance.now();
      
      // Recarregar dados com os novos filtros e aguardar processamento completo
      await carregarDados();
      
      const dadosTime = performance.now() - dadosStart;
      console.log(`✅ Dados recarregados em: ${dadosTime.toFixed(2)}ms`);
      
      // Atualizar URL
      atualizarURL({
        periodo: periodoTemp,
        departamento: departamentosTemp.join(','),
        tipoTarefa: tiposTarefasTemp,
        usuario: usuariosSelecionadosTemp.join(','),
        obrigacao: obrigacoesSelecionadasTemp.join(',')
      });
      
      const totalTime = performance.now() - startTime;
      console.log(`🎯 Total da aplicação de filtros: ${totalTime.toFixed(2)}ms`);
    } finally {
      console.log("✅ Loading removido - dados completamente carregados");
      setLoadingFiltros(false);
    }
  };

  // Função para limpar filtros
  const limparFiltros = () => {
    // Limpar valores aplicados
    setTiposTarefas("Todos");
    setDepartamentos([]);
    setUsuariosSelecionados([]);
    setObrigacoesSelecionadas([]);
    setDadosCarregados(false);
    
    // Limpar valores temporários
    setTiposTarefasTemp("Todos");
    setDepartamentosTemp([]);
    setUsuariosSelecionadosTemp([]);
    setObrigacoesSelecionadasTemp([]);
    
    // Resetar período para o mês atual
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    const periodoAtual = `${mes}/${ano}`;
    
    setPeriodoSelecionado(periodoAtual);
    setPeriodoTemp(periodoAtual);
    
    carregarDados();
    router.replace(window.location.pathname, { scroll: false });
  };

  // Função para abrir modal com detalhes das tarefas
  const abrirModalTarefas = async (usuario) => {
    setUsuarioSelecionado(usuario);
    setModalAberto(true);
    setModalLoading(true);
    
    try {
      const { token, empresaId } = getAuthInfo();

      if (!token || !empresaId) {
        router.replace("/auth/login");
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "X-Empresa-Id": empresaId.toString()
      };
      
      // Extrair mês e ano do período selecionado
      const [mes, ano] = periodoSelecionado.split("/");
      const mesSelecionado = parseInt(mes) - 1;
      const anoSelecionado = parseInt(ano);
      
      // Buscar tarefas e obrigações do usuário
      const [resTarefas, resObrigacoes] = await Promise.all([
        fetchJson(`/gestao/tarefas/todas/${empresaId}`, { headers }),
        fetchJson(`/gestao/obrigacoes/empresa/${empresaId}/todas`, { headers })
      ]);

      const todasTarefas = Array.isArray(resTarefas.data) ? resTarefas.data : [];
      const todasObrigacoes = Array.isArray(resObrigacoes.data) ? resObrigacoes.data : [];

      // Filtrar tarefas do usuário e período
      const tarefasDoUsuario = todasTarefas.filter((t) => {
        const prazo = new Date(t.dataPrazo);
        const mesCorreto = prazo.getMonth() === mesSelecionado && prazo.getFullYear() === anoSelecionado;
        const usuarioCorreto = t.responsavelId === usuario.id;
        return mesCorreto && usuarioCorreto;
      });

      const obrigacoesDoUsuario = todasObrigacoes.filter((o) => {
        const venc = o.vencimento || o.dataPrazo;
        if (!venc) return false;
        const dataVencimento = venc.split("T")[0];
        const [ano, mes] = dataVencimento.split("-");
        const mesCorreto = Number(ano) === anoSelecionado && Number(mes) === mesSelecionado + 1;
        const usuarioCorreto = o.responsaveis && o.responsaveis.some((resp) => {
          const userId = resp.usuarioId || resp.id || resp.userId;
          return userId === usuario.id;
        });
        return mesCorreto && usuarioCorreto;
      });

      // Combinar tarefas e obrigações com informações de status
      const tarefasComStatus = [
        ...tarefasDoUsuario.map((t) => ({
          ...t,
          tipo: 'tarefa',
          titulo: t.titulo || t.nome,
          prazo: t.dataPrazo,
          status: (() => {
            if (t.baixadaAutomaticamente === 1) return 'concluida';
            const total = t.atividades?.length || 0;
            const concluidas = t.atividades?.filter((a) => a.concluida === 1 || a.cancelada === 1).length || 0;
            if (total === 0 || concluidas === total) return 'concluida';
            
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const dataPrazo = new Date(t.dataPrazo);
            dataPrazo.setHours(0, 0, 0, 0);
            
            return dataPrazo < hoje ? 'atrasada' : 'emAberto';
          })()
        })),
        ...obrigacoesDoUsuario.map((o) => ({
          ...o,
          tipo: 'obrigacao',
          titulo: o.nome || o.titulo,
          prazo: o.vencimento || o.dataPrazo,
          status: (() => {
            if (o.baixadaAutomaticamente === 1) return 'concluida';
            if (o.status?.toLowerCase() === 'concluida') return 'concluida';
            
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const dataVencimento = new Date(o.vencimento || o.dataPrazo);
            dataVencimento.setHours(0, 0, 0, 0);
            
            return dataVencimento < hoje ? 'atrasada' : 'emAberto';
          })()
        }))
      ];

      setTarefasDetalhadas(tarefasComStatus);
    } catch (error) {
      console.error("Erro ao carregar detalhes das tarefas:", error);
      setTarefasDetalhadas([]);
    } finally {
      setModalLoading(false);
    }
  };

  // Função para fechar modal
  const fecharModal = () => {
    setModalAberto(false);
    setUsuarioSelecionado(null);
    setTarefasDetalhadas([]);
    setSearchTerm("");
    setPaginaAtual(1);
    setAbaAtiva("solicitacoes");
    setModalLoading(false);
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

  // Função para formatar status
  const formatarStatus = (str) => {
    if (!str) return '';
    
    // Tratar casos específicos
    if (str.toLowerCase() === 'emaberto') return 'Em Aberto';
    if (str.toLowerCase() === 'em_aberto') return 'Em Aberto';
    if (str.toLowerCase() === 'em aberto') return 'Em Aberto';
    if (str.toLowerCase() === 'pendente') return 'Pendente';
    if (str.toLowerCase() === 'concluida') return 'Concluída';
    if (str.toLowerCase() === 'concluída') return 'Concluída';
    if (str.toLowerCase() === 'atrasada') return 'Atrasada';
    
    // Para outros casos, usar capitalize normal
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  // Função para filtrar tarefas por texto
  const filtroTexto = (t) => {
    const termo = searchTerm.toLowerCase();
    return (
      String(t.id).includes(termo) ||
      (t.titulo?.toLowerCase().includes(termo)) ||
      (t.cliente_nome?.toLowerCase().includes(termo)) ||
      (t.status?.toLowerCase().includes(termo)) ||
      (t.departamento?.toLowerCase().includes(termo))
    );
  };

  // Processar dados para o modal
  const solicitacoes = tarefasDetalhadas.filter((t) => t.tipo === "tarefa");
  const obrigacoesListadas = tarefasDetalhadas.filter((t) => t.tipo === "obrigacao");
  const tarefasFiltradasBase = abaAtiva === "solicitacoes" ? solicitacoes : obrigacoesListadas;
  const tarefasFiltradas = tarefasFiltradasBase.filter(filtroTexto);

  // Ordenar tarefas
  let tarefasOrdenadas = [...tarefasFiltradas];
  if (sortConfig.key) {
    const key = sortConfig.key;
    tarefasOrdenadas.sort((a, b) => {
      let result = 0;
      const aValue = a[key] ?? "";
      const bValue = b[key] ?? "";
      result = typeof aValue === "number" && typeof bValue === "number"
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), "pt-BR", { numeric: true });
      return sortConfig.direction === "asc" ? result : -result;
    });
  }

  const totalPaginas = Math.ceil(tarefasFiltradas.length / tarefasPorPagina);
  const tarefasVisiveis = tarefasOrdenadas.slice(
    (paginaAtual - 1) * tarefasPorPagina,
    paginaAtual * tarefasPorPagina
  );

  // Resetar página quando mudar busca ou aba
  useEffect(() => {
    setPaginaAtual(1);
  }, [searchTerm, abaAtiva]);

  // Estilos para tabela
  const th = {
    padding: "8px",
    fontWeight: 500,
    color: "#6b7280",
    textAlign: "left",
  };

  const td = {
    padding: "8px",
    color: "#374151",
    fontSize: "12px",
  };



  // 🔍 DEBUG: Verificar se o loading está sendo atualizado
  useEffect(() => {
    console.log("🔄 Loading mudou para:", loading);
  }, [loading]);
  
  useEffect(() => {
    console.log("🔄 DadosCarregados mudou para:", dadosCarregados);
  }, [dadosCarregados]);

  // 🔍 DEBUG: Verificar estados dos filtros
  useEffect(() => {
    console.log("🔍 Estados dos filtros:", {
      departamentosReais: departamentosReais.length,
      obrigacoesReais: obrigacoesReais.length,
      usuariosFiltrados: usuariosFiltrados.length,
      obrigacoesFiltradas: obrigacoesFiltradas.length
    });
  }, [departamentosReais, obrigacoesReais, usuariosFiltrados, obrigacoesFiltradas]);

  // 💾 Cache local para persistir filtros entre navegações
  useEffect(() => {
    // Salvar filtros no localStorage quando mudarem
    if (departamentosReais.length > 0 || obrigacoesReais.length > 0) {
      const cache = {
        departamentos: departamentosReais,
        obrigacoes: obrigacoesReais,
        timestamp: Date.now()
      };
      localStorage.setItem('performance-filtros-cache', JSON.stringify(cache));
      console.log("💾 Filtros salvos no cache:", cache);
    }
  }, [departamentosReais, obrigacoesReais]);

  // 🔄 Restaurar filtros do cache ao montar componente
  useEffect(() => {
    if (mounted) {
      try {
        const cached = localStorage.getItem('performance-filtros-cache');
        if (cached) {
          const { departamentos, obrigacoes, timestamp } = JSON.parse(cached);
          const cacheAge = Date.now() - timestamp;
          
          // Cache válido por 5 minutos
          if (cacheAge < 5 * 60 * 1000) {
            console.log("🔄 Restaurando filtros do cache:", { departamentos: departamentos.length, obrigacoes: obrigacoes.length });
            
            if (departamentos.length > 0) {
              setDepartamentosReais(departamentos);
            }
            if (obrigacoes.length > 0) {
              setObrigacoesReais(obrigacoes);
            }
          } else {
            console.log("⏰ Cache expirado, removendo...");
            localStorage.removeItem('performance-filtros-cache');
          }
        }
      } catch (error) {
        console.error("❌ Erro ao restaurar cache:", error);
        localStorage.removeItem('performance-filtros-cache');
      }
    }
  }, [mounted]);

  // 🔄 Aplicar filtros quando departamentos ou todosUsuarios mudarem
  useEffect(() => {
    if (todosUsuarios.length > 0) {
      console.log("🔄 Aplicando filtros de departamento aos usuários...");
      console.log("🔍 Departamentos selecionados:", departamentos);
      console.log("🔍 Primeiro usuário exemplo:", todosUsuarios[0]);
      
      const usuariosFiltradosPorDepartamento = todosUsuarios.filter((u) => {
        // Se não há departamentos selecionados, mostrar todos os usuários
        if (departamentos.length === 0) {
          console.log(`✅ Usuário ${u.nome} incluído (sem filtro de departamento)`);
          return true;
        }
        
        // Verificar se o usuário tem departamento
        if (!u.departamentoNome) {
          console.log(`⚠️ Usuário ${u.nome} não tem departamento definido`);
          return false;
        }
        
        console.log(`🔍 Verificando usuário ${u.nome} com departamento "${u.departamentoNome}"`);
        console.log(`🔍 Departamentos aplicados:`, departamentos);
        
        // Verificar se algum departamento selecionado corresponde
        const match = departamentos.some(dept => {
          const deptStr = typeof dept === 'string' ? dept : String(dept);
          const isMatch = u.departamentoNome.toLowerCase() === deptStr.toLowerCase();
          
          console.log(`🔍 Comparando: "${u.departamentoNome}" === "${deptStr}" = ${isMatch}`);
          
          if (isMatch) {
            console.log(`✅ Usuário ${u.nome} corresponde ao departamento ${deptStr}`);
          }
          
          return isMatch;
        });
        
        if (match) {
          console.log(`✅ Usuário ${u.nome} INCLUÍDO na filtragem`);
        } else {
          console.log(`❌ Usuário ${u.nome} EXCLUÍDO da filtragem`);
        }
        
        return match;
      });
      
      setUsuariosFiltrados(usuariosFiltradosPorDepartamento);
      console.log(`✅ Usuários filtrados por departamento: ${usuariosFiltradosPorDepartamento.length}/${todosUsuarios.length}`);
      console.log(`📋 Lista de usuários filtrados:`, usuariosFiltradosPorDepartamento.map(u => u.nome));
    }
  }, [departamentos, todosUsuarios]);

  // 🔄 Aplicar filtros quando obrigacoesReais mudarem (incluindo do cache)
  useEffect(() => {
    if (obrigacoesReais.length > 0) {
      console.log("🔄 Aplicando filtros de obrigações...");
      setObrigacoesFiltradas(obrigacoesReais);
      console.log(`✅ Obrigações filtradas: ${obrigacoesReais.length}`);
    }
  }, [obrigacoesReais]);

  // 🔍 DEBUG: Log dos estados para identificar problema de renderização
  console.log("🔍 Estados atuais:", {
    loading,
    dadosCarregados,
    performanceGeral: performanceGeral.total,
    usuariosPerformance: usuariosPerformance.length,
    usuariosFiltrados: usuariosFiltrados.length
  });

  // 🚨 SOLUÇÃO PARA HYDRATION: Não renderizar nada até estar montado no cliente
  if (!mounted) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.container}>
          <div className={styles.mainContent}>
            <div className={styles.content}>
              {/* Breadcrumbs */}
              <div className={styles.breadcrumbs}>
                <div className={styles.breadcrumbsContainer}>
                  <span>Relatórios</span>
                  <span className={styles.breadcrumbSeparator}>›</span>
                  <span className={styles.breadcrumbActive}>Performance Mensal</span>
                </div>
              </div>

              {/* Estado de Inicialização */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "calc(100vh - 200px)",
                padding: "var(--titan-spacing-2xl)",
                textAlign: "center"
              }}>
                <div style={{
                  marginBottom: "var(--titan-spacing-md)",
                  position: "relative"
                }}>
                  <SpinnerGlobal size={60} variant="gradient" />
                </div>
                
                <div style={{ 
                  fontSize: "var(--titan-font-size-xl)", 
                  fontWeight: "var(--titan-font-weight-medium)", 
                  marginBottom: "var(--titan-spacing-sm)",
                  color: "var(--titan-text-high)"
                }}>
                  Inicializando
                </div>
                
                <div style={{ 
                  fontSize: "var(--titan-font-size-sm)", 
                  color: "var(--titan-text-med)"
                }}>
                  Preparando interface...
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.container}>
          <div className={styles.mainContent}>
            <div className={styles.content}>
              {/* Breadcrumbs */}
              <div className={styles.breadcrumbs}>
                <div className={styles.breadcrumbsContainer}>
                  <span>Relatórios</span>
                  <span className={styles.breadcrumbSeparator}>›</span>
                  <span className={styles.breadcrumbActive}>Performance Mensal</span>
                </div>
              </div>

              {/* Estado de Carregamento */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "calc(100vh - 200px)",
                padding: "var(--titan-spacing-2xl)",
                textAlign: "center"
              }}>
                <div style={{
                  marginBottom: "var(--titan-spacing-lg)",
                  position: "relative"
                }}>
                  <SpinnerGlobal size={80} variant="gradient" />
                </div>
                
                <div style={{ 
                  fontSize: "var(--titan-font-size-2xl)", 
                  fontWeight: "var(--titan-font-weight-semibold)", 
                  marginBottom: "var(--titan-spacing-md)",
                  color: "var(--titan-text-high)"
                }}>
                  Carregando Performance Mensal
                </div>
                
                <div style={{ 
                  fontSize: "var(--titan-font-size-base)", 
                  color: "var(--titan-text-med)",
                  maxWidth: "400px",
                  lineHeight: "var(--titan-line-height-relaxed)"
                }}>
                  Preparando relatórios e métricas de performance para análise detalhada
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.container}>
        <div className={styles.mainContent}>
          <div className={styles.content}>
        {/* Breadcrumbs */}
        <div className={styles.breadcrumbs}>
          <div className={styles.breadcrumbsContainer}>
            <span>Relatórios</span>
            <span className={styles.breadcrumbSeparator}>›</span>
            <span className={styles.breadcrumbActive}>Performance Mensal</span>
          </div>
        </div>

          {/* Barra de Filtros */}
          <div className={styles.filtersBar}>
            <div className={styles.filtersContainer}>
              
              {/* Filtro Período */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('periodo')}
                  className={styles.filterButton}
                >
                  <span>Período: {periodoTemp}</span>
                  <FiCalendar size={16} />
                </button>
                {dropdownPeriodo && (
                  <div
                    ref={periodoRef}
                    className={styles.filterDropdown}
                  >
                    {(() => {
                      const hoje = new Date();
                      const anoAtual = hoje.getFullYear();
                      const mesAtual = hoje.getMonth();
                      
                      // Gerar períodos dos últimos 12 meses + mês atual
                      const periodos = [];
                      for (let i = -12; i <= 0; i++) {
                        const data = new Date(anoAtual, mesAtual + i, 1);
                        const mes = String(data.getMonth() + 1).padStart(2, '0');
                        const ano = data.getFullYear();
                        periodos.push(`${mes}/${ano}`);
                      }
                      return periodos;
                    })().map((periodo) => (
                      <div
                        key={periodo}
                        onClick={() => {
                          setPeriodoTemp(periodo);
                          setDropdownPeriodo(false);
                        }}
                        className={`${styles.filterOption} ${periodo === periodoTemp ? styles.filterOptionActive : ''}`}
                      >
                        {periodo}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Filtro Tipos de Tarefas */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => toggleDropdown('tiposTarefas')}
                  className={styles.filterButton}
                >
                  <span>Tipos de tarefas: {tiposTarefasTemp}</span>
                  <FiCheckSquare size={16} />
                </button>
                {dropdownTiposTarefas && (
                  <div
                    ref={tiposTarefasRef}
                    className={styles.filterDropdown}
                  >
                    {["Todos", "Processos", "Obrigações"].map((tipo) => (
                      <div
                        key={tipo}
                        onClick={() => {
                          setTiposTarefasTemp(tipo);
                          setDropdownTiposTarefas(false);
                        }}
                        className={`${styles.filterOption} ${tipo === tiposTarefasTemp ? styles.filterOptionActive : ''}`}
                      >
                        {tipo}
                      </div>
                    ))}
                  </div>
                )}
              </div>

                                {/* Filtro Departamentos */}
                  <div style={{ minWidth: 220, maxWidth: 320 }}>
                    <Select
                      isMulti
                      options={departamentosReais.length > 0 ? departamentosReais.filter(d => d.nome).map(d => ({ value: d.nome, label: d.nome })) : []}
                      value={departamentosTemp.map(dep => ({ value: dep, label: dep }))}
                      onChange={selected => {
                        const novosDepartamentos = selected.map(opt => opt.value);
                        console.log("🔍 Departamentos selecionados:", novosDepartamentos);
                        setDepartamentosTemp(novosDepartamentos);
                      }}
                      placeholder="Filtrar por departamento(s)"
                      isLoading={carregandoDepartamentos}
                      isDisabled={carregandoDepartamentos}
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          minHeight: 35,
                          maxHeight: 35,
                          borderRadius: 8,
                          fontSize: 14,
                          outline: "none",
                          boxShadow: "none",
                          borderColor: state.isFocused ? "#000080" : "rgba(255, 255, 255, 0.08)",
                          backgroundColor: carregandoDepartamentos ? "rgba(255, 255, 255, 0.02)" : "rgba(255, 255, 255, 0.04)",
                          color: "#E6E9F0",
                          transition: "all 120ms ease-out",
                          ...(state.isFocused && { 
                            borderColor: "#000080",
                            boxShadow: "0 0 8px rgba(0, 76, 255, 0.33)"
                          }),
                          ...(carregandoDepartamentos && { cursor: "not-allowed" }),
                        }),
                        placeholder: (base) => ({
                          ...base,
                          color: carregandoDepartamentos ? "#6F7384" : "#6F7384",
                          opacity: 1,
                          fontWeight: 400,
                        }),
                        multiValue: (base) => ({
                          ...base,
                          backgroundColor: "rgba(0, 128, 255, 0.2)",
                          margin: 0,
                          borderRadius: 6,
                        }),
                        multiValueLabel: (base) => ({
                          ...base,
                          color: "#FFFFFF",
                          fontWeight: 500,
                          padding: "2px 6px",
                        }),
                        multiValueRemove: (base) => ({
                          ...base,
                          color: "#FFFFFF",
                          ":hover": {
                            backgroundColor: "#000080",
                            color: "#FFFFFF",
                          },
                        }),
                        valueContainer: (base) => ({
                          ...base,
                          flexWrap: "nowrap",
                          gap: 4,
                          overflowX: "auto",
                          padding: "4px 8px",
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isSelected
                            ? "rgba(0, 128, 255, 0.2)"
                            : state.isFocused
                              ? "rgba(255, 255, 255, 0.08)"
                              : "rgba(255, 255, 255, 0.04)",
                          color: state.isSelected ? "#FFFFFF" : "#E6E9F0",
                          cursor: "pointer",
                          boxShadow: "none",
                          outline: "none",
                          border: "none",
                          padding: "8px 12px",
                          transition: "all 120ms ease-out",
                        }),
                        menu: (base) => ({
                          ...base,
                          zIndex: 300,
                          backgroundColor: "#0B0B11",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: 8,
                          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.4)",
                          backdropFilter: "blur(10px)",
                        }),
                        menuList: (base) => ({
                          ...base,
                          boxShadow: "none",
                          outline: "none",
                          padding: "4px 0",
                          maxHeight: 200,
                          zIndex: 300,
                        }),
                        loadingMessage: (base) => ({
                          ...base,
                          color: "#6F7384",
                          fontSize: "14px",
                        }),
                      }}
                      menuPlacement="auto"
                      loadingMessage={() => "Carregando departamentos..."}
                      noOptionsMessage={() => {
                        if (carregandoDepartamentos) return "Carregando...";
                        if (departamentosReais.length === 0) return "Nenhum departamento encontrado";
                        return "Nenhuma opção disponível";
                      }}
                    />
                  </div>



              {/* Filtro Usuários */}
              <div style={{ minWidth: 220, maxWidth: 320 }}>
                <Select
                  isMulti
                  options={usuariosFiltrados.map((u) => ({ value: u.nome, label: u.nome }))}
                  value={usuariosSelecionadosTemp.map(user => ({ value: user, label: user }))}
                  onChange={selected => {
                    const novosUsuarios = selected.map(opt => opt.value);
                    setUsuariosSelecionadosTemp(novosUsuarios);
                  }}
                  placeholder="Filtrar por usuário(s)"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: 35,
                      maxHeight: 35,
                      borderRadius: 8,
                      fontSize: 14,
                      outline: "none",
                      boxShadow: "none",
                      borderColor: state.isFocused ? "#000080" : "rgba(255, 255, 255, 0.08)",
                      backgroundColor: "rgba(255, 255, 255, 0.04)",
                      color: "#E6E9F0",
                      transition: "all 120ms ease-out",
                      ...(state.isFocused && { 
                        borderColor: "#000080",
                        boxShadow: "0 0 8px rgba(0, 76, 255, 0.33)"
                      }),
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: "#6F7384",
                      opacity: 1,
                      fontWeight: 400,
                    }),
                    multiValue: (base) => ({
                      ...base,
                      backgroundColor: "rgba(0, 128, 255, 0.2)",
                      margin: 0,
                      borderRadius: 6,
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      color: "#FFFFFF",
                      fontWeight: 500,
                      padding: "2px 6px",
                    }),
                    multiValueRemove: (base) => ({
                      ...base,
                      color: "#FFFFFF",
                      ":hover": {
                        backgroundColor: "#000080",
                        color: "#FFFFFF",
                      },
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      flexWrap: "nowrap",
                      gap: 4,
                      overflowX: "auto",
                      padding: "4px 8px",
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected
                        ? "rgba(0, 128, 255, 0.2)"
                        : state.isFocused
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(255, 255, 255, 0.04)",
                      color: state.isSelected ? "#FFFFFF" : "#E6E9F0",
                      cursor: "pointer",
                      boxShadow: "none",
                      outline: "none",
                      border: "none",
                      padding: "8px 12px",
                      transition: "all 120ms ease-out",
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 9999999,
                      backgroundColor: "#0B0B11",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 8,
                      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.4)",
                      backdropFilter: "blur(10px)",
                    }),
                    menuList: (base) => ({
                      ...base,
                      boxShadow: "none",
                      outline: "none",
                      padding: "4px 0",
                      maxHeight: 200,
                      zIndex: 9999999,
                    }),
                  }}
                  menuPlacement="auto"
                />
              </div>

              {/* Filtro Obrigações */}
              <div style={{ minWidth: 220, maxWidth: 320 }}>
                <Select
                  isMulti
                  options={obrigacoesFiltradas.map((o) => ({ value: o.nome, label: o.nome }))}
                  value={obrigacoesSelecionadasTemp.map(obr => ({ value: obr, label: obr }))}
                  onChange={selected => {
                    const novasObrigacoes = selected.map(opt => opt.value);
                    setObrigacoesSelecionadasTemp(novasObrigacoes);
                  }}
                  placeholder="Filtrar por obrigação(ões)"
                  isLoading={carregandoObrigacoes}
                  isDisabled={carregandoObrigacoes}
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: 35,
                      maxHeight: 35,
                      borderRadius: 8,
                      fontSize: 14,
                      outline: "none",
                      boxShadow: "none",
                      borderColor: state.isFocused ? "#000080" : "rgba(255, 255, 255, 0.08)",
                      backgroundColor: carregandoObrigacoes ? "rgba(255, 255, 255, 0.02)" : "rgba(255, 255, 255, 0.04)",
                      color: "#E6E9F0",
                      transition: "all 120ms ease-out",
                      ...(state.isFocused && { 
                        borderColor: "#000080",
                        boxShadow: "0 0 8px rgba(0, 76, 255, 0.33)"
                      }),
                      ...(carregandoObrigacoes && { cursor: "not-allowed" }),
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: carregandoObrigacoes ? "#6F7384" : "#6F7384",
                      opacity: 1,
                      fontWeight: 400,
                    }),
                    multiValue: (base) => ({
                      ...base,
                      backgroundColor: "rgba(0, 128, 255, 0.2)",
                      margin: 0,
                      borderRadius: 6,
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      color: "#FFFFFF",
                      fontWeight: 500,
                      padding: "2px 6px",
                    }),
                    multiValueRemove: (base) => ({
                      ...base,
                      color: "#FFFFFF",
                      ":hover": {
                        backgroundColor: "#000080",
                        color: "#FFFFFF",
                      },
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      flexWrap: "nowrap",
                      gap: 4,
                      overflowX: "auto",
                      padding: "4px 8px",
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected
                        ? "rgba(0, 128, 255, 0.2)"
                        : state.isFocused
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(255, 255, 255, 0.04)",
                      color: state.isSelected ? "#FFFFFF" : "#E6E9F0",
                      cursor: "pointer",
                      boxShadow: "none",
                      outline: "none",
                      border: "none",
                      padding: "8px 12px",
                      transition: "all 120ms ease-out",
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 9999999,
                      backgroundColor: "#0B0B11",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 8,
                      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.4)",
                      backdropFilter: "blur(10px)",
                    }),
                    menuList: (base) => ({
                      ...base,
                      boxShadow: "none",
                      outline: "none",
                      padding: "4px 0",
                      maxHeight: 200,
                      zIndex: 9999999,
                    }),
                    loadingMessage: (base) => ({
                      ...base,
                      color: "#6F7384",
                      fontSize: "14px",
                    }),
                  }}
                  menuPlacement="auto"
                  loadingMessage={() => "Carregando obrigações..."}
                  noOptionsMessage={() => carregandoObrigacoes ? "Carregando..." : "Nenhuma obrigação encontrada"}
                />
              </div>



              {/* Botões de Ação */}
              <div className={styles.actionButtons}>
                <button
                  onClick={aplicarFiltros}
                  disabled={loadingFiltros}
                  className={styles.btnPrimary}
                >
                  <FiSearch size={16} />
                  {loadingFiltros ? "Aplicando..." : "Aplicar"}
                </button>
                <button
                  onClick={limparFiltros}
                  className={styles.btnSecondary}
                >
                  <FiX size={16} />
                  Limpar
                </button>
              </div>
            </div>


          </div>

          {/* Conteúdo Principal */}
          <div className={styles.mainGrid}>
            {loadingFiltros && (
              <div className={styles.loadingOverlay}>
                <div style={{ textAlign: "center" }}>
                  <div className={styles.loadingSpinner} />
                  <div className={styles.loadingText}>
                    Aplicando filtros...
                  </div>
                </div>
              </div>
            )}
            
            {/* Performance Geral - Lado Esquerdo */}
            <div className={styles.performanceCard}>
              <div className={styles.performanceCardInner}>
                <h2 className={styles.performanceTitle}>
                  Performance Geral
                </h2>

                {/* Círculo de Progresso Principal */}
                <div className={styles.progressCircle}>
                  <div className={styles.progressCircleInner}>
                    {loadingFiltros || !dadosCarregados ? (
                      // Estado de carregamento
                      <div className={styles.progressCircleLoading}>
                        <div className={styles.progressCircleLoadingSpinner} />
                        <div className={styles.progressCircleLoadingText}>
                          Carregando...
                        </div>
                      </div>
                    ) : (
                    <CircularProgressbarWithChildren
                      value={performanceGeral.total > 0 ? Math.round((performanceGeral.concluidas / performanceGeral.total) * 100) : 0}
                      maxValue={100}
                      strokeWidth={12}
                      styles={buildStyles({
                        pathColor: "#22c55e",
                        trailColor: "#f3f4f6",
                        strokeLinecap: "round"
                      })}
                    >
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <div className={styles.progressPercentage}>
                          {performanceGeral.total > 0 ? Math.round((performanceGeral.concluidas / performanceGeral.total) * 100) : 0}%
                        </div>
                        <div className={styles.progressLabel}>
                          Concluído
                        </div>
                      </div>
                    </CircularProgressbarWithChildren>
                    )}
                  </div>
                </div>

                {/* Estatísticas com Porcentagens */}
                <div className={styles.statsContainer}>
                  <div className={styles.statItem}>
                    <div className={`${styles.statColor} ${styles.statColorSuccess}`}></div>
                    <div className={styles.statContent}>
                      <div className={styles.statHeader}>
                        <span className={styles.statLabel}>Concluídas</span>
                        <span className={styles.statPercentage}>
                          {loadingFiltros || !dadosCarregados ? "..." : (performanceGeral.total > 0 ? Math.round((performanceGeral.concluidas / performanceGeral.total) * 100) : 0) + "%"}
                        </span>
                      </div>
                      <div className={styles.statDetails}>
                        {loadingFiltros || !dadosCarregados ? "Carregando..." : `${performanceGeral.concluidas} de ${performanceGeral.total} tarefas`}
                      </div>
                    </div>
                  </div>

                  <div className={styles.statItem}>
                    <div className={`${styles.statColor} ${styles.statColorWarning}`}></div>
                    <div className={styles.statContent}>
                      <div className={styles.statHeader}>
                        <span className={styles.statLabel}>Em aberto</span>
                        <span className={styles.statPercentage}>
                          {loadingFiltros || !dadosCarregados ? "..." : (performanceGeral.total > 0 ? Math.round((performanceGeral.emAberto / performanceGeral.total) * 100) : 0) + "%"}
                        </span>
                      </div>
                      <div className={styles.statDetails}>
                        {loadingFiltros || !dadosCarregados ? "Carregando..." : `${performanceGeral.emAberto} de ${performanceGeral.total} tarefas`}
                      </div>
                    </div>
                  </div>

                  <div className={styles.statItem}>
                    <div className={`${styles.statColor} ${styles.statColorError}`}></div>
                    <div className={styles.statContent}>
                      <div className={styles.statHeader}>
                        <span className={styles.statLabel}>Atrasadas</span>
                        <span className={styles.statPercentage}>
                          {loadingFiltros || !dadosCarregados ? "..." : (performanceGeral.total > 0 ? Math.round((performanceGeral.atrasadas / performanceGeral.total) * 100) : 0) + "%"}
                        </span>
                      </div>
                      <div className={styles.statDetails}>
                        {loadingFiltros || !dadosCarregados ? "Carregando..." : `${performanceGeral.atrasadas} de ${performanceGeral.total} tarefas`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cards de Usuários - Lado Direito */}
            <div className={styles.usersGrid}>
              <div className={styles.usersContainer}>
                {usuariosPerformance.map((usuario) => (
                  <div
                    key={usuario.id}
                    className={styles.userCard}
                  >
                    <div className={styles.userHeader}>
                      {/* Avatar com Progresso Circular */}
                      <div className={styles.userAvatar}>
                        {/* Círculo de Progresso como Borda */}
                        <CircularProgressbarWithChildren
                          value={loadingFiltros ? 0 : calcularProgresso(usuario)}
                          maxValue={100}
                          strokeWidth={4}
                          styles={buildStyles({
                            pathColor: loadingFiltros ? "#e5e7eb" : "#22c55e",
                            trailColor: "#f3f4f6",
                            strokeLinecap: "round"
                          })}
                        >
                          {/* Avatar dentro do círculo */}
                          <div className={styles.userAvatarInner}>
                            {usuario.foto && usuario.foto.trim() !== '' ? (
                              <img
                                src={usuario.foto}
                                alt={usuario.nome}
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  target.style.display = 'none';
                                  const sibling = target.nextElementSibling;
                                  if (sibling) {
                                    sibling.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <div 
                              className={styles.userAvatarText}
                              style={{ 
                                display: (!usuario.foto || usuario.foto.trim() === '') ? 'flex' : 'none'
                              }}
                            >
                              {usuario.nome.charAt(0)}
                            </div>
                          </div>
                        </CircularProgressbarWithChildren>
                        
                        {/* Porcentagem abaixo da imagem */}
                        <div className={styles.userAvatarPercentage}>
                          {loadingFiltros ? "..." : calcularProgresso(usuario) + "%"}
                        </div>
                      </div>

                      {/* Informações do usuário */}
                      <div className={styles.userInfo}>
                        <div className={styles.userName}>
                          {usuario.nome}
                        </div>
                        <div className={styles.userRole}>
                          {usuario.cargo}
                        </div>
                        <div className={styles.userDepartment}>
                          {usuario.departamento}
                        </div>
                        {/* Porcentagem de progresso */}
                        <div className={styles.userProgress}>
                          {loadingFiltros ? "Carregando..." : `${calcularProgresso(usuario)}% concluído`}
                        </div>
                      </div>
                    </div>

                    {/* Estatísticas */}
                    <div className={styles.userStats}>
                      <div 
                        className={styles.userStatsTitle}
                        onClick={() => abrirModalTarefas(usuario)}
                      >
                        {loadingFiltros ? "..." : `${usuario.tarefas.total} Tarefas`}
                      </div>
                      
                      {/* Mini gráfico de barras */}
                      <div className={styles.userProgressBar}>
                        {loadingFiltros ? (
                          <div className={styles.userProgressBarLoading} />
                        ) : (
                          <>
                        <div 
                          className={styles.userProgressBarSuccess}
                          style={{ flex: usuario.tarefas.concluidas }}
                        ></div>
                        <div 
                          className={styles.userProgressBarWarning}
                          style={{ flex: usuario.tarefas.emAberto }}
                        ></div>
                        <div 
                          className={styles.userProgressBarError}
                          style={{ flex: usuario.tarefas.atrasadas }}
                        ></div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      {/* Modal de Detalhes das Tarefas */}
      {modalAberto && usuarioSelecionado && (
        <div
          onClick={fecharModal}
          className={styles.modalOverlay}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(11, 11, 17, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1050,
            padding: "var(--titan-spacing-sm)"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={styles.modalContent}
            style={{
              backgroundColor: "var(--titan-card-bg)",
              backdropFilter: "blur(20px)",
              border: "1px solid var(--titan-stroke)",
              borderRadius: "var(--titan-radius-md)",
              boxShadow: "var(--titan-shadow-lg)",
              maxWidth: "85vw",
              maxHeight: "85vh",
              width: "100%",
              overflow: "auto",
              position: "relative"
            }}
          >
            <div className={styles.modalHeader} style={{
              padding: "var(--titan-spacing-md)",
              borderBottom: "1px solid var(--titan-stroke)",
              backgroundColor: "rgba(255, 255, 255, 0.02)"
            }}>
              <h2 style={{ 
                fontSize: "var(--titan-font-size-lg)", 
                fontWeight: "var(--titan-font-weight-semibold)", 
                marginBottom: "var(--titan-spacing-xs)",
                color: "var(--titan-text-high)"
              }}>
                Detalhes das Tarefas
              </h2>
              <p style={{ 
                fontSize: "var(--titan-font-size-xs)", 
                color: "var(--titan-text-low)",
                margin: 0
              }}>
                Performance Mensal &gt; {usuarioSelecionado?.nome} - {periodoSelecionado}
              </p>
            </div>

            {/* Resumo das Estatísticas */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "var(--titan-spacing-sm)",
              margin: "var(--titan-spacing-md)",
              padding: "var(--titan-spacing-md)",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              borderRadius: "var(--titan-radius-sm)",
              border: "1px solid var(--titan-stroke)"
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ 
                  fontSize: "var(--titan-font-size-2xl)", 
                  fontWeight: "var(--titan-font-weight-bold)", 
                  color: "var(--titan-success)",
                  marginBottom: "var(--titan-spacing-xs)"
                }}>
                  {usuarioSelecionado?.tarefas.concluidas}
                </div>
                <div style={{ 
                  fontSize: "var(--titan-font-size-xs)", 
                  color: "var(--titan-text-med)" 
                }}>
                  Concluídas
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ 
                  fontSize: "var(--titan-font-size-2xl)", 
                  fontWeight: "var(--titan-font-weight-bold)", 
                  color: "var(--titan-warning)",
                  marginBottom: "var(--titan-spacing-xs)"
                }}>
                  {usuarioSelecionado?.tarefas.emAberto}
                </div>
                <div style={{ 
                  fontSize: "var(--titan-font-size-xs)", 
                  color: "var(--titan-text-med)" 
                }}>
                  Em Aberto
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ 
                  fontSize: "var(--titan-font-size-2xl)", 
                  fontWeight: "var(--titan-font-weight-bold)", 
                  color: "var(--titan-error)",
                  marginBottom: "var(--titan-spacing-xs)"
                }}>
                  {usuarioSelecionado?.tarefas.atrasadas}
                </div>
                <div style={{ 
                  fontSize: "var(--titan-font-size-xs)", 
                  color: "var(--titan-text-med)" 
                }}>
                  Atrasadas
                </div>
              </div>
            </div>

            {/* Abas de navegação */}
            <div style={{ 
              display: "flex", 
              gap: "var(--titan-spacing-sm)", 
              margin: "0 var(--titan-spacing-md) var(--titan-spacing-sm)",
              padding: "0 var(--titan-spacing-sm)"
            }}>
              <button
                onClick={() => setAbaAtiva("solicitacoes")}
                style={{
                  padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                  backgroundColor: abaAtiva === "solicitacoes" 
                    ? "var(--titan-primary)" 
                    : "rgba(255, 255, 255, 0.05)",
                  color: abaAtiva === "solicitacoes" 
                    ? "var(--titan-text-high)" 
                    : "var(--titan-text-med)",
                  border: "1px solid var(--titan-stroke)",
                  borderRadius: "var(--titan-radius-sm)",
                  fontSize: "var(--titan-font-size-xs)",
                  fontWeight: "var(--titan-font-weight-medium)",
                  cursor: "pointer",
                  transition: "var(--titan-transition-fast)",
                  boxShadow: abaAtiva === "solicitacoes" ? "var(--titan-glow-primary)" : "none"
                }}
              >
                Processos
              </button>

              <button
                onClick={() => setAbaAtiva("obrigacoes")}
                style={{
                  padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                  backgroundColor: abaAtiva === "obrigacoes" 
                    ? "var(--titan-primary)" 
                    : "rgba(255, 255, 255, 0.05)",
                  color: abaAtiva === "obrigacoes" 
                    ? "var(--titan-text-high)" 
                    : "var(--titan-text-med)",
                  border: "1px solid var(--titan-stroke)",
                  borderRadius: "var(--titan-radius-sm)",
                  fontSize: "var(--titan-font-size-xs)",
                  fontWeight: "var(--titan-font-weight-medium)",
                  cursor: "pointer",
                  transition: "var(--titan-transition-fast)",
                  boxShadow: abaAtiva === "obrigacoes" ? "var(--titan-glow-primary)" : "none"
                }}
              >
                Obrigações
              </button>
            </div>

            <input
              type="text"
              placeholder={`Buscar ${abaAtiva === "solicitacoes" ? "solicitações" : "obrigações"}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "calc(100% - var(--titan-spacing-lg))",
                padding: "var(--titan-spacing-sm)",
                margin: "0 var(--titan-spacing-md) var(--titan-spacing-sm)",
                borderRadius: "var(--titan-radius-sm)",
                border: "1px solid var(--titan-stroke)",
                backgroundColor: "var(--titan-input-bg)",
                color: "var(--titan-text-high)",
                fontSize: "var(--titan-font-size-xs)",
                fontFamily: "var(--titan-font-family)",
                transition: "var(--titan-transition-fast)"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--titan-primary)";
                e.target.style.boxShadow = "var(--titan-glow-primary)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--titan-stroke)";
                e.target.style.boxShadow = "none";
              }}
            />

            {/* Estado de Carregamento */}
            {modalLoading ? (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--titan-spacing-xl) var(--titan-spacing-md)",
                color: "var(--titan-text-low)"
              }}>
                <div style={{
                  width: "32px",
                  height: "32px",
                  marginBottom: "var(--titan-spacing-sm)",
                  position: "relative"
                }}>
                  <svg 
                    style={{ 
                      width: "32px", 
                      height: "32px", 
                      animation: "spin 1s linear infinite" 
                    }} 
                    viewBox="0 0 24 24" 
                    fill="none"
                  >
                    <circle cx="12" cy="12" r="10" stroke="var(--titan-stroke)" strokeWidth="3" fill="none" />
                    <path 
                      d="M12 2a10 10 0 0 1 10 10" 
                      stroke="var(--titan-primary)" 
                      strokeWidth="3" 
                      strokeLinecap="round" 
                      strokeDasharray="31.416" 
                      strokeDashoffset="31.416" 
                      style={{ animation: "dash 1.5s ease-in-out infinite" }} 
                    />
                  </svg>
                </div>
                <div style={{ 
                  fontSize: "var(--titan-font-size-base)", 
                  fontWeight: "var(--titan-font-weight-medium)", 
                  marginBottom: "var(--titan-spacing-xs)",
                  color: "var(--titan-text-high)"
                }}>
                  Carregando tarefas...
                </div>
                <div style={{ 
                  fontSize: "var(--titan-font-size-xs)", 
                  textAlign: "center",
                  color: "var(--titan-text-med)"
                }}>
                  Buscando processos e obrigações de {usuarioSelecionado?.nome} para {periodoSelecionado}
                </div>
                <style jsx>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  @keyframes dash {
                    0% { stroke-dashoffset: 31.416; }
                    50% { stroke-dashoffset: 0; }
                    100% { stroke-dashoffset: -31.416; }
                  }
                `}</style>
              </div>
            ) : (
              /* Tabela de tarefas */
              <div style={{ 
                margin: "0 var(--titan-spacing-md)",
                borderRadius: "var(--titan-radius-sm)",
                overflow: "hidden",
                border: "1px solid var(--titan-stroke)"
              }}>
                <table style={{ 
                  width: "100%", 
                  borderCollapse: "collapse", 
                  fontSize: "var(--titan-font-size-xs)", 
                  tableLayout: "auto" 
                }}>
                  <thead style={{ 
                    background: "rgba(255, 255, 255, 0.03)",
                    borderBottom: "1px solid var(--titan-stroke)"
                  }}>
                    <tr>
                      <th style={{
                        ...th,
                        padding: "var(--titan-spacing-sm)",
                        textAlign: "left",
                        fontWeight: "var(--titan-font-weight-semibold)",
                        color: "var(--titan-text-high)",
                        backgroundColor: "rgba(255, 255, 255, 0.02)"
                      }}>
                        No
                      </th>
                      <th style={{
                        ...th,
                        padding: "var(--titan-spacing-sm)",
                        textAlign: "left",
                        fontWeight: "var(--titan-font-weight-semibold)",
                        color: "var(--titan-text-high)",
                        backgroundColor: "rgba(255, 255, 255, 0.02)",
                        cursor: "pointer", 
                        userSelect: "none"
                      }} onClick={() => requestSort("status")}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          Status
                          {sortConfig.key === "status" && (
                            <span style={{ fontSize: 12, color: "var(--titan-primary)" }}>
                              {sortConfig.direction === "asc" ? "▲" : "▼"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th style={{
                        ...th,
                        padding: "var(--titan-spacing-sm)",
                        textAlign: "left",
                        fontWeight: "var(--titan-font-weight-semibold)",
                        color: "var(--titan-text-high)",
                        backgroundColor: "rgba(255, 255, 255, 0.02)",
                        cursor: "pointer", 
                        userSelect: "none"
                      }} onClick={() => requestSort("departamento")}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          Departamento
                          {sortConfig.key === "departamento" && (
                            <span style={{ fontSize: 12, color: "var(--titan-primary)" }}>
                              {sortConfig.direction === "asc" ? "▲" : "▼"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th style={{
                        ...th,
                        padding: "var(--titan-spacing-sm)",
                        textAlign: "left",
                        fontWeight: "var(--titan-font-weight-semibold)",
                        color: "var(--titan-text-high)",
                        backgroundColor: "rgba(255, 255, 255, 0.02)",
                        cursor: "pointer", 
                        userSelect: "none"
                      }} onClick={() => requestSort("id")}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          ID
                          {sortConfig.key === "id" && (
                            <span style={{ fontSize: 12, color: "var(--titan-primary)" }}>
                              {sortConfig.direction === "asc" ? "▲" : "▼"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th style={{
                        ...th,
                        padding: "var(--titan-spacing-sm)",
                        textAlign: "left",
                        fontWeight: "var(--titan-font-weight-semibold)",
                        color: "var(--titan-text-high)",
                        backgroundColor: "rgba(255, 255, 255, 0.02)",
                        cursor: "pointer", 
                        userSelect: "none"
                      }} onClick={() => requestSort("titulo")}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          Título
                          {sortConfig.key === "titulo" && (
                            <span style={{ fontSize: 12, color: "var(--titan-primary)" }}>
                              {sortConfig.direction === "asc" ? "▲" : "▼"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th style={{
                        ...th,
                        padding: "var(--titan-spacing-sm)",
                        textAlign: "left",
                        fontWeight: "var(--titan-font-weight-semibold)",
                        color: "var(--titan-text-high)",
                        backgroundColor: "rgba(255, 255, 255, 0.02)",
                        cursor: "pointer", 
                        userSelect: "none"
                      }} onClick={() => requestSort("cliente_nome")}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          Cliente
                          {sortConfig.key === "cliente_nome" && (
                            <span style={{ fontSize: 12, color: "var(--titan-primary)" }}>
                              {sortConfig.direction === "asc" ? "▲" : "▼"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th style={{
                        ...th,
                        padding: "var(--titan-spacing-sm)",
                        textAlign: "left",
                        fontWeight: "var(--titan-font-weight-semibold)",
                        color: "var(--titan-text-high)",
                        backgroundColor: "rgba(255, 255, 255, 0.02)",
                        minWidth: 80, 
                        maxWidth: 110, 
                        wordBreak: "break-word"
                      }}>
                        Prazo
                      </th>
                      <th style={{
                        ...th,
                        padding: "var(--titan-spacing-sm)",
                        textAlign: "left",
                        fontWeight: "var(--titan-font-weight-semibold)",
                        color: "var(--titan-text-high)",
                        backgroundColor: "rgba(255, 255, 255, 0.02)"
                      }}>
                        Atividades
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tarefasVisiveis.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ 
                          textAlign: "center", 
                          padding: "var(--titan-spacing-md)", 
                          color: "var(--titan-text-low)",
                          fontSize: "var(--titan-font-size-xs)"
                        }}>
                          Nenhuma {abaAtiva === "solicitacoes" ? "solicitação" : "obrigação"} encontrada.
                        </td>
                      </tr>
                    ) : (
                      tarefasVisiveis.map((tarefa, i) => (
                        <tr key={i} style={{ 
                          borderBottom: "1px solid var(--titan-stroke)",
                          backgroundColor: i % 2 === 0 ? "rgba(255, 255, 255, 0.01)" : "transparent",
                          transition: "var(--titan-transition-fast)"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = i % 2 === 0 ? "rgba(255, 255, 255, 0.01)" : "transparent";
                        }}
                        >
                          <td style={{
                            ...td,
                            padding: "var(--titan-spacing-sm)",
                            color: "var(--titan-text-med)"
                          }}>
                            {i + 1}
                          </td>
                          <td style={{
                            ...td,
                            padding: "var(--titan-spacing-sm)",
                            color: "var(--titan-text-med)"
                          }}>
                            {formatarStatus(tarefa.status)}
                            {tarefa.baixadaAutomaticamente === 1 && (
                              <span
                                style={{
                                  marginLeft: "var(--titan-spacing-xs)",
                                  padding: "1px var(--titan-spacing-xs)",
                                  backgroundColor: "var(--titan-success)",
                                  color: "var(--titan-base-00)",
                                  borderRadius: "var(--titan-radius-sm)",
                                  fontSize: "10px",
                                  fontWeight: "var(--titan-font-weight-bold)",
                                  fontFamily: "var(--titan-font-family)",
                                  userSelect: "none",
                                }}
                                title="Baixada Automaticamente"
                              >
                                Auto
                              </span>
                            )}
                          </td>
                          <td style={{
                            ...td,
                            padding: "var(--titan-spacing-sm)",
                            color: "var(--titan-text-med)"
                          }}>
                            {tarefa.departamento || tarefa.departamentoNome || tarefa.departamento_nome || '-'}
                          </td>
                          <td style={{
                            ...td,
                            padding: "var(--titan-spacing-sm)",
                            color: "var(--titan-text-med)"
                          }}>
                            {tarefa.id}
                          </td>
                          <td
                            style={{ 
                              ...td, 
                              color: "var(--titan-text-high)", 
                              cursor: "pointer", 
                              minWidth: 100, 
                              maxWidth: 150, 
                              wordBreak: "break-word",
                              padding: "var(--titan-spacing-sm)",
                              fontWeight: "var(--titan-font-weight-medium)",
                              transition: "var(--titan-transition-fast)"
                            }}
                            onClick={() => {
                              if (tarefa.tipo === "tarefa") {
                                window.open(`/tarefas/${tarefa.id}/atividades`, "_blank");
                              } else if (tarefa.tipo === "obrigacao") {
                                window.open(`/dashboard/obrigacoes/${tarefa.id}/atividades`, "_blank");
                              }
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = "underline";
                              e.currentTarget.style.color = "var(--titan-primary-hover)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = "none";
                              e.currentTarget.style.color = "var(--titan-text-high)";
                            }}
                          >
                            {tarefa.titulo}
                          </td>
                          <td style={{ 
                            ...td, 
                            minWidth: 100, 
                            maxWidth: 150, 
                            wordBreak: "break-word",
                            padding: "var(--titan-spacing-sm)",
                            color: "var(--titan-text-med)"
                          }}>
                            {tarefa.cliente_nome || "-"}
                            {tarefa.cliente_cnpj && (
                              <div style={{ 
                                fontSize: "10px", 
                                color: "var(--titan-text-low)", 
                                marginTop: "-1px", 
                                wordBreak: "break-word" 
                              }}>
                                {tarefa.cliente_cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}
                              </div>
                            )}
                          </td>
                          <td style={{
                            ...td,
                            padding: "var(--titan-spacing-sm)",
                            color: "var(--titan-text-med)"
                          }}>
                            {tarefa.prazo ? new Date(tarefa.prazo).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td style={{
                            ...td,
                            padding: "var(--titan-spacing-sm)",
                            color: "var(--titan-text-med)"
                          }}>
                            {(tarefa.categoria === "Finalizada" ||
                              tarefa.categoria === "Na Programação" ||
                              tarefa.categoria === "Concluída Após Meta/Prazo" ||
                              tarefa.status?.toLowerCase() === "concluída" ||
                              tarefa.baixadaAutomaticamente === 1) ? (
                              "100%"
                            ) : (
                              Array.isArray(tarefa.atividades) && tarefa.atividades.length > 0
                                ? `${Math.round(
                                    (
                                      tarefa.atividades.filter((a) => a.concluida === 1 || a.cancelada === 1).length /
                                      tarefa.atividades.length
                                    ) * 100
                                  )}%`
                                : "0%"
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginação */}
            {!modalLoading && (
              <div
                style={{
                  margin: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                  fontSize: "var(--titan-font-size-xs)",
                  color: "var(--titan-text-low)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "var(--titan-spacing-sm)",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  borderRadius: "var(--titan-radius-sm)",
                  border: "1px solid var(--titan-stroke)"
                }}
              >
              <div>
                Itens por página: <strong style={{ color: "var(--titan-text-high)" }}>{tarefasPorPagina}</strong>
              </div>
              <div>
                {`${(paginaAtual - 1) * tarefasPorPagina + 1} - ${Math.min(
                  paginaAtual * tarefasPorPagina,
                  tarefasFiltradas.length
                )} de ${tarefasFiltradas.length}`}
              </div>
              <div style={{ display: "flex", gap: "var(--titan-spacing-xs)" }}>
                <button
                  onClick={() => setPaginaAtual((prev) => Math.max(prev - 1, 1))}
                  disabled={paginaAtual === 1}
                  style={{
                    padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                    border: "1px solid var(--titan-stroke)",
                    backgroundColor: paginaAtual === 1 
                      ? "rgba(255, 255, 255, 0.05)" 
                      : "rgba(255, 255, 255, 0.08)",
                    cursor: paginaAtual === 1 ? "not-allowed" : "pointer",
                    color: paginaAtual === 1 
                      ? "var(--titan-text-low)" 
                      : "var(--titan-text-med)",
                    borderRadius: "var(--titan-radius-sm)",
                    fontSize: "var(--titan-font-size-xs)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    transition: "var(--titan-transition-fast)"
                  }}
                  onMouseEnter={(e) => {
                    if (paginaAtual !== 1) {
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.12)";
                      e.currentTarget.style.borderColor = "var(--titan-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (paginaAtual !== 1) {
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.borderColor = "var(--titan-stroke)";
                    }
                  }}
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPaginaAtual((prev) => Math.min(prev + 1, totalPaginas))}
                  disabled={paginaAtual === totalPaginas}
                  style={{
                    padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                    border: "1px solid var(--titan-stroke)",
                    backgroundColor: paginaAtual === totalPaginas 
                      ? "rgba(255, 255, 255, 0.05)" 
                      : "rgba(255, 255, 255, 0.08)",
                    cursor: paginaAtual === totalPaginas ? "not-allowed" : "pointer",
                    color: paginaAtual === totalPaginas 
                      ? "var(--titan-text-low)" 
                      : "var(--titan-text-med)",
                    borderRadius: "var(--titan-radius-sm)",
                    fontSize: "var(--titan-font-size-xs)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    transition: "var(--titan-transition-fast)"
                  }}
                  onMouseEnter={(e) => {
                    if (paginaAtual !== totalPaginas) {
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.12)";
                      e.currentTarget.style.borderColor = "var(--titan-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (paginaAtual !== totalPaginas) {
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.borderColor = "var(--titan-stroke)";
                    }
                  }}
                >
                  Próximo
                </button>
              </div>
            </div>
            )}

            {/* Botão Fechar */}
            <button
              onClick={fecharModal}
              style={{
                position: "absolute",
                top: "var(--titan-spacing-sm)",
                right: "var(--titan-spacing-md)",
                background: "none",
                border: "none",
                fontSize: "24px",
                cursor: "pointer",
                color: "var(--titan-text-low)",
                lineHeight: 1,
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                transition: "var(--titan-transition-fast)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "var(--titan-text-high)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--titan-text-low)";
              }}
            >
              &times;
            </button>
          </div>
        </div>
      )}
        </div>
      </div>
    </>
  );
} 