'use client'
import React, { useState, useEffect, useMemo } from 'react';
import { Target } from 'lucide-react';
import GlobalGoalModal from '../../components/estrategico/GlobalGoalModal';
import { DepartmentGoalModal } from '../../components/estrategico/DepartmentGoalModal';
import { GlobalGoalCard } from '../../components/estrategico/GlobalGoalCard';
import { DepartmentGoalCard } from '../../components/estrategico/DepartmentGoalCard';
import { ConfirmModal } from '../../components/estrategico/ConfirmModal';
import { Pagination } from '../../components/estrategico/Pagination';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Select from 'react-select';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';
import styles from '../../styles/estrategico/goals.module.css';

// Configuração da API
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const normalizeUrl = (u) => `${BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;

// Helper para obter token do localStorage
const getToken = () => {
  try {
    return localStorage.getItem('token') || null;
  } catch {
    return null;
  }
};

// Helper para obter EmpresaId do localStorage
const getEmpresaId = () => {
  try {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const parsed = JSON.parse(userData);
      return parsed.EmpresaId || parsed.empresaId || null;
    }
    return null;
  } catch {
    return null;
  }
};

// Helper para obter permissões do localStorage
const getPermissoes = () => {
  try {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const parsed = JSON.parse(userData);
      return parsed.permissoes || {};
    }
    return {};
  } catch {
    return {};
  }
};

// Helper para verificar se tem permissão de admin
const hasAdminPermission = () => {
  const permissoes = getPermissoes();
  return permissoes?.adm && Array.isArray(permissoes.adm) && permissoes.adm.includes('admin');
};

// Helper para fazer requisições fetch
const apiFetch = async (url, options = {}) => {
  const token = getToken();
  const empresaId = getEmpresaId();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (empresaId) {
    headers['X-Empresa-Id'] = empresaId.toString();
  }

  const config = {
    ...options,
    headers
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(normalizeUrl(url), config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};


const normalizeDepartmentGoal = (goal) => {
  if (!goal) return null;

  const departmentId = goal.department_id ?? goal.departamento_id ?? goal.department?.id ?? null;
  const departmentData = goal.department || {
    id: departmentId,
    title: goal.department?.title ?? goal.department_title ?? goal.department?.nome ?? goal.nome_departamento ?? null,
    nome: goal.department?.nome ?? goal.department_title ?? goal.nome_departamento ?? null,
    description: goal.department?.description ?? goal.department_description ?? null,
    descricao: goal.department?.descricao ?? goal.department_description ?? null,
    company_id: goal.department?.company_id ?? goal.department_company_id ?? goal.empresa_id ?? null,
    empresa_id: goal.department?.empresa_id ?? goal.department_company_id ?? goal.empresa_id ?? null,
  };

  const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const normalizeMonth = (month) => {
    if (!month) return null;

    return {
      ...month,
      id: month.id,
      meta_departamental_id: month.meta_departamental_id ?? month.id_metas_departamentais ?? goal.id ?? null,
      start_date: month.start_date ?? month.data_inicio ?? null,
      end_date: month.end_date ?? month.data_fim ?? null,
      value_goal: parseNumber(month.value_goal ?? month.valor_alvo),
      value_achieved: parseNumber(month.value_achieved ?? month.valor_alcancado),
      status: month.status,
      created_at: month.created_at ?? month.criado_em ?? null,
      updated_at: month.updated_at ?? month.atualizado_em ?? null,
    };
  };

  return {
    ...goal,
    company_id: goal.company_id ?? goal.empresa_id ?? null,
    empresa_id: goal.empresa_id ?? goal.company_id ?? null,
    department_id: departmentId,
    departamento_id: goal.departamento_id ?? departmentId,
    title: goal.title ?? goal.nome ?? '',
    nome: goal.nome ?? goal.title ?? '',
    description: goal.description ?? goal.descricao ?? '',
    descricao: goal.descricao ?? goal.description ?? '',
    target_value: parseNumber(goal.target_value ?? goal.valor_alvo),
    current_value: parseNumber(goal.current_value ?? goal.valor_atual),
    calculation_type: goal.calculation_type ?? goal.calculo_tipo ?? 'acumulativa',
    calculationType: goal.calculationType ?? goal.calculation_type ?? goal.calculo_tipo ?? 'acumulativa',
    indicator_type: goal.indicator_type ?? goal.indicador_tipo ?? 'qtd',
    indicatorType: goal.indicatorType ?? goal.indicator_type ?? goal.indicador_tipo ?? 'qtd',
    progress_type: goal.progress_type ?? goal.progresso_tipo ?? 'progresso',
    progressType: goal.progressType ?? goal.progress_type ?? goal.progresso_tipo ?? 'progresso',
    start_date: goal.start_date ?? goal.data_inicio ?? null,
    end_date: goal.end_date ?? goal.data_fim ?? null,
    created_at: goal.created_at ?? goal.criado_em ?? null,
    updated_at: goal.updated_at ?? goal.atualizado_em ?? null,
    department: departmentData,
    monthlyGoals: Array.isArray(goal.monthlyGoals)
      ? goal.monthlyGoals.map(normalizeMonth).filter(Boolean)
      : [],
  };
};

const normalizeGlobalGoal = (goal) => {
  if (!goal) return null;

  const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return {
    ...goal,
    company_id: goal.company_id ?? goal.empresa_id ?? null,
    empresa_id: goal.empresa_id ?? goal.company_id ?? null,
    title: goal.title ?? goal.titulo ?? '',
    titulo: goal.titulo ?? goal.title ?? '',
    description: goal.description ?? goal.descricao ?? '',
    descricao: goal.descricao ?? goal.description ?? '',
    target_value: parseNumber(goal.target_value ?? goal.valor_alvo),
    current_value: parseNumber(goal.current_value ?? goal.valor_atual),
    calculation_type: goal.calculation_type ?? goal.calculo_tipo ?? 'acumulativa',
    calculationType: goal.calculationType ?? goal.calculation_type ?? goal.calculo_tipo ?? 'acumulativa',
    indicator_type: goal.indicator_type ?? goal.indicador_tipo ?? 'qtd',
    indicatorType: goal.indicatorType ?? goal.indicator_type ?? goal.indicador_tipo ?? 'qtd',
    progress_type: goal.progress_type ?? goal.progresso_tipo ?? 'progresso',
    progressType: goal.progressType ?? goal.progress_type ?? goal.progresso_tipo ?? 'progresso',
    start_date: goal.start_date ?? goal.data_inicio ?? null,
    end_date: goal.end_date ?? goal.data_fim ?? null,
    created_at: goal.created_at ?? goal.criado_em ?? null,
    updated_at: goal.updated_at ?? goal.atualizado_em ?? null,
  };
};


export default function GlobalGoals() {
  const router = useRouter();
  // Tentar pegar companyId da URL primeiro, se não tiver, pegar do localStorage
  const companyIdFromUrl = router.isReady ? router.query?.companyId : null;
  const companyIdFromStorage = getEmpresaId();
  const companyId = companyIdFromUrl || companyIdFromStorage;
  
  console.log('🔍 [GlobalGoals] companyId:', {
    fromUrl: companyIdFromUrl,
    fromStorage: companyIdFromStorage,
    final: companyId,
    routerReady: router.isReady
  });
  
  const [goals, setGoals] = useState([]);

  const [loadingGlobalGoals, setLoadingGlobalGoals] = useState(false);
  const [loadingDepartmentGoals, setLoadingDepartmentGoals] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [goalData, setGoalData] = useState(null);
  const [user, setUser] = useState(null);
  const [permissoes, setPermissoes] = useState({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedTrimestre, setSelectedTrimestre] = useState(() => {
    const month = new Date().getMonth() + 1;
    if (month >= 1 && month <= 3) return '1';
    if (month >= 4 && month <= 6) return '2';
    if (month >= 7 && month <= 9) return '3';
    return '4';
  });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [goalsDepartment, setGoalsDepartment] = useState([]);

  const [selectedTrimestreGlobal, setSelectedTrimestreGlobal] = useState(() => {
    const month = new Date().getMonth() + 1;
    if (month >= 1 && month <= 3) return '1';
    if (month >= 4 && month <= 6) return '2';
    if (month >= 7 && month <= 9) return '3';
    return '4';
  });
  const [selectedYearGlobal, setSelectedYearGlobal] = useState(() => new Date().getFullYear().toString());

  const [selectedMonth, setSelectedMonth] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    open: false,
    goal: null
  });

  const [globalGoalsPagination, setGlobalGoalsPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 5,
    hasNextPage: false,
    hasPrevPage: false
  });

  const [departmentGoalsPagination, setDepartmentGoalsPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 5,
    hasNextPage: false,
    hasPrevPage: false
  });


  useEffect(() => {
    const loadUser = () => {
      try {
        const userData = localStorage.getItem('userData');
        if (userData) {
          const parsed = JSON.parse(userData);
          console.log("🔍 [GlobalGoals] Usuário carregado:", parsed);
          setUser(parsed);
          setPermissoes(parsed.permissoes || {});
        }
      } catch (err) {
        console.error("Erro ao carregar usuário:", err);
      }
    };

    loadUser();
  }, [companyId]);

  useEffect(() => {
    loadGlobalGoals();
  }, [companyId, globalGoalsPagination.currentPage, selectedTrimestreGlobal, selectedYearGlobal]);

  useEffect(() => {
    loadDepartmentGoals();
  }, [companyId, departmentGoalsPagination.currentPage, selectedTrimestre, selectedYear, selectedDepartment]);

  useEffect(() => {
    console.log('🔍 [GlobalGoals] Sincronizando filtros globais com departamentais:', {
      selectedTrimestreGlobal,
      selectedYearGlobal,
      selectedTrimestre,
      selectedYear
    });
    
    if (selectedTrimestreGlobal !== selectedTrimestre) {
      console.log('🔍 [GlobalGoals] Sincronizando trimestre:', selectedTrimestreGlobal, '→', selectedTrimestre);
      setSelectedTrimestre(selectedTrimestreGlobal);
    }
    
    if (selectedYearGlobal !== selectedYear) {
      console.log('🔍 [GlobalGoals] Sincronizando ano:', selectedYearGlobal, '→', selectedYear);
      setSelectedYear(selectedYearGlobal);
    }
  }, [selectedTrimestreGlobal, selectedYearGlobal]);

  useEffect(() => {
    console.log('🔍 [GlobalGoals] useEffect loadDepartments - verificando condições:', {
      hasUser: !!user,
      hasPermissoes: !!permissoes,
      hasCompanyId: !!companyId,
      user,
      permissoes,
      companyId
    });
    
    if (user && companyId) {
      console.log('🔍 [GlobalGoals] useEffect loadDepartments - user e companyId disponíveis');
      loadDepartments();
    } else {
      console.log('🔍 [GlobalGoals] useEffect loadDepartments - condições não atendidas');
    }
  }, [companyId, user, permissoes]);

  useEffect(() => {
    if (user && companyId && departments.length === 0) {
      console.log('🔍 [GlobalGoals] useEffect recarregar departamentos - departments vazio, recarregando...');
      loadDepartments();
    }
  }, [departments.length, user, companyId]);

  useEffect(() => {
    if (selectedDepartment && departments.length > 0) {
      const departmentExists = departments.find(d => d.id === selectedDepartment);
      if (!departmentExists) {
        console.log('🔍 [GlobalGoals] Departamento selecionado não existe mais na lista, limpando...');
        setSelectedDepartment(null);
      }
    }
  }, [departments, selectedDepartment]);

  useEffect(() => {
    if (selectedDepartment && departments.length > 0) {
      const departmentExists = departments.find(d => d.id === selectedDepartment);
      if (!departmentExists) {
        console.log('🔍 [GlobalGoals] Departamento selecionado não existe mais na lista, limpando...');
        setSelectedDepartment(null);
      }
    }
  }, [departments, selectedDepartment]);

  useEffect(() => {
    if (permissoes && Object.keys(permissoes).length > 0) {
      console.log('🔍 [GlobalGoals] Permissões mudaram:', permissoes, '- limpando departamentos');
      setDepartments([]);
    }
  }, [permissoes]);

  const loadGlobalGoals = async () => {
    if (!companyId) return;

    try {
      setLoadingGlobalGoals(true);
      
      const globalGoalsParams = new URLSearchParams({
        companyId,
        page: globalGoalsPagination.currentPage.toString(),
        limit: globalGoalsPagination.limit.toString()
      });
      
      if (selectedTrimestreGlobal && selectedTrimestreGlobal !== '') {
        globalGoalsParams.append('trimestre', selectedTrimestreGlobal);
        console.log('🔍 [GlobalGoals] Adicionado trimestre global:', selectedTrimestreGlobal);
      } else {
        console.log('🔍 [GlobalGoals] Trimestre global vazio, não enviando filtro');
      }
      if (selectedYearGlobal && selectedYearGlobal !== '') {
        globalGoalsParams.append('ano', selectedYearGlobal);
        console.log('🔍 [GlobalGoals] Adicionado ano global:', selectedYearGlobal);
      } else {
        console.log('🔍 [GlobalGoals] Ano global vazio, não enviando filtro');
      }

      const globalGoalsResponse = await apiFetch(`/estrategico/metas-globais?${globalGoalsParams.toString()}`);
      console.log('🔍 [GlobalGoals] Resposta da API metas globais:', globalGoalsResponse);
      
      if (globalGoalsResponse.data && globalGoalsResponse.pagination) {
        console.log('🔍 [GlobalGoals] Usando resposta paginada:', globalGoalsResponse.data);
        const normalizedGoals = (globalGoalsResponse.data || [])
          .map(normalizeGlobalGoal)
          .filter(Boolean);
        setGoals(normalizedGoals);
        setGlobalGoalsPagination(globalGoalsResponse.pagination);
      } else {
        console.log('🔍 [GlobalGoals] Usando fallback (resposta antiga):', globalGoalsResponse);
        const normalizedGoals = (Array.isArray(globalGoalsResponse) ? globalGoalsResponse : [globalGoalsResponse])
          .map(normalizeGlobalGoal)
          .filter(Boolean);
        setGoals(normalizedGoals);
      }

    } catch (error) {
      console.error('Erro ao carregar metas globais:', error);
      if (error instanceof Error && (error.message.includes('Acesso negado') || error.message.includes('403'))) {
        setAccessDenied(true);
      } else {
        toast.error('Erro ao carregar metas globais');
      }
    } finally {
      setLoadingGlobalGoals(false);
    }
  };

  const loadDepartmentGoals = async () => {
    if (!companyId) return;

    try {
      setLoadingDepartmentGoals(true);
      
      const departmentGoalsParams = new URLSearchParams({
        page: departmentGoalsPagination.currentPage.toString(),
        limit: departmentGoalsPagination.limit.toString()
      });

      console.log('🔍 [GlobalGoals] Construindo parâmetros para metas departamentais...');
      console.log('🔍 [GlobalGoals] selectedDepartment:', selectedDepartment);
      console.log('🔍 [GlobalGoals] companyId:', companyId);
      console.log('🔍 [GlobalGoals] permissoes:', permissoes);

      // Sempre enviar companyId para validação
      departmentGoalsParams.append('companyId', companyId);
      
      // Se um departamento específico foi selecionado, adicionar o filtro
      if (selectedDepartment) {
        departmentGoalsParams.append('departmentId', selectedDepartment);
        console.log('🔍 [GlobalGoals] Adicionado departmentId:', selectedDepartment);
      } else {
        console.log('🔍 [GlobalGoals] Nenhum departamento selecionado - retornando todos');
      }
      
      if (selectedTrimestre && selectedTrimestre !== '') {
        departmentGoalsParams.append('trimestre', selectedTrimestre);
        console.log('🔍 [GlobalGoals] Adicionado trimestre departamental:', selectedTrimestre);
      } else {
        console.log('🔍 [GlobalGoals] Trimestre departamental vazio, não enviando filtro');
      }
      if (selectedYear && selectedYear !== '') {
        departmentGoalsParams.append('ano', selectedYear);
        console.log('🔍 [GlobalGoals] Adicionado ano departamental:', selectedYear);
      } else {
        console.log('🔍 [GlobalGoals] Ano departamental vazio, não enviando filtro');
      }

      const departmentGoalsResponse = await apiFetch(`/estrategico/metas-departamentais?${departmentGoalsParams.toString()}`);
      console.log('🔍 [GlobalGoals] Resposta da API metas departamentais:', departmentGoalsResponse);
      console.log('🔍 [GlobalGoals] Parâmetros enviados:', departmentGoalsParams.toString());
      
      if (departmentGoalsResponse.data && departmentGoalsResponse.pagination) {
        console.log('🔍 [GlobalGoals] Usando resposta paginada departamental:', departmentGoalsResponse.data);
        console.log('🔍 [GlobalGoals] Paginação departamental:', departmentGoalsResponse.pagination);

        const normalizedGoals = (departmentGoalsResponse.data || [])
          .map(normalizeDepartmentGoal)
          .filter(Boolean);

        setGoalsDepartment(normalizedGoals);
        setDepartmentGoalsPagination(departmentGoalsResponse.pagination);
      } else {
        console.log('🔍 [GlobalGoals] Usando fallback departamental (resposta antiga):', departmentGoalsResponse);
        const normalizedGoals = (Array.isArray(departmentGoalsResponse) ? departmentGoalsResponse : [departmentGoalsResponse])
          .map(normalizeDepartmentGoal)
          .filter(Boolean);
        setGoalsDepartment(normalizedGoals);
      }

    } catch (error) {
      console.error('Erro ao carregar metas departamentais:', error);
      if (error instanceof Error && (error.message.includes('Acesso negado') || error.message.includes('403'))) {
        setAccessDenied(true);
      } else {
        toast.error('Erro ao carregar metas departamentais');
      }
    } finally {
      setLoadingDepartmentGoals(false);
    }
  };

  const getLeaderDepartments = async (userId, companyId) => {
    try {
      const response = await apiFetch(`/estrategico/organograma?companyId=${companyId}`);
      const leaderDepartments = response?.filter((dept) => dept.responsavel_id === userId || dept.manager_id === userId) || [];
      return leaderDepartments;
    } catch (error) {
      console.error('Erro ao buscar departamentos onde é líder:', error);
      return [];
    }
  };

  const loadDepartments = async () => {
    if (!companyId || !user) return;

    console.log('🔍 [GlobalGoals] loadDepartments chamado');
    console.log('🔍 [GlobalGoals] user:', user);
    console.log('🔍 [GlobalGoals] permissoes:', permissoes);
    console.log('🔍 [GlobalGoals] companyId:', companyId);

    try {
      console.log('🔍 [GlobalGoals] Carregando todos os departamentos da empresa...');
      const timestamp = Date.now();
      const url = `/estrategico/departamentos?companyId=${companyId}&t=${timestamp}`;
      console.log('🔍 [GlobalGoals] URL da requisição:', url);
      
      const allDepartments = await apiFetch(url);
      console.log('🔍 [GlobalGoals] Todos os departamentos carregados:', allDepartments);
      
      let filteredDepartments = allDepartments || [];
      
      // Verificar se não é admin (tem permissão admin)
      const isAdmin = hasAdminPermission();
      
      if (!isAdmin && user?.id) {
        console.log('🔍 [GlobalGoals] Aplicando filtro para usuário não-admin...');
        
        const userDepartmentsResponse = await apiFetch(`/estrategico/funcionarios/${user.id}/department?companyId=${companyId}`);
        console.log('🔍 [GlobalGoals] Departamentos onde é membro:', userDepartmentsResponse);
        
        const leaderDepartmentsResponse = await getLeaderDepartments(user.id, companyId);
        console.log('🔍 [GlobalGoals] Departamentos onde é líder:', leaderDepartmentsResponse);
        
        let userDepartmentIds = [];
        if (Array.isArray(userDepartmentsResponse)) {
          userDepartmentIds = userDepartmentsResponse.map((d) => d.department_id);
        } else if (userDepartmentsResponse?.department_id) {
          userDepartmentIds = [userDepartmentsResponse.department_id];
        } else if (userDepartmentsResponse?.id) {
          userDepartmentIds = [userDepartmentsResponse.id];
        }
        
        const leaderDepartmentIds = leaderDepartmentsResponse?.map((d) => d.id) || [];
        const allowedDepartmentIds = Array.from(new Set([...userDepartmentIds, ...leaderDepartmentIds]));
        
        console.log('🔍 [GlobalGoals] IDs dos departamentos permitidos:', allowedDepartmentIds);
        
        if (allowedDepartmentIds.length > 0) {
          filteredDepartments = allDepartments.filter((dept) => 
            allowedDepartmentIds.includes(dept.id)
          );
        } else {
          console.log('🔍 [GlobalGoals] Nenhum departamento permitido encontrado; mantendo lista completa.');
          filteredDepartments = allDepartments;
        }
        
        console.log('🔍 [GlobalGoals] Departamentos filtrados:', filteredDepartments);
        
      } else {
        console.log('🔍 [GlobalGoals] Usuário admin - mostrando todos os departamentos');
      }
      
      setDepartments(filteredDepartments);
      console.log('🔍 [GlobalGoals] Departamentos finais carregados:', filteredDepartments);
      console.log('🔍 [GlobalGoals] Número de departamentos:', filteredDepartments.length);
      
    } catch (error) {
      console.error('❌ [GlobalGoals] Erro ao carregar departamentos:', error);
      toast.error('Erro ao carregar departamentos');
    }
  };

  const fetchGoals = async () => {
    if (!companyId) return;

    try {
      const response = await apiFetch(`/estrategico/metas-globais?companyId=${companyId}&page=${globalGoalsPagination.currentPage}&limit=${globalGoalsPagination.limit}`);
      
      if (response.data && response.pagination) {
        setGoals(response.data);
        setGlobalGoalsPagination(response.pagination);
      } else {
        setGoals(response || []);
      }
    } catch (error) {
      console.error('Erro ao buscar metas globais:', error);
      toast.error('Erro ao buscar metas globais');
    }
  };

  const handleGlobalGoalsPageChange = async (page) => {
    setGlobalGoalsPagination(prev => ({ ...prev, currentPage: page }));
  };

  const handleDepartmentGoalsPageChange = async (page) => {
    setDepartmentGoalsPagination(prev => ({ ...prev, currentPage: page }));
  };

  const handleGlobalFilterChange = (filterType, value) => {
    setGlobalGoalsPagination(prev => ({ ...prev, currentPage: 1 }));
    if (filterType === 'trimestre') {
      setSelectedTrimestreGlobal(value);
    } else {
      setSelectedYearGlobal(value);
    }
  };

  const handleDepartmentFilterChange = (filterType, value) => {
    console.log('🔍 [GlobalGoals] handleDepartmentFilterChange chamado:', { filterType, value });
    setDepartmentGoalsPagination(prev => ({ ...prev, currentPage: 1 }));
    if (filterType === 'department') {
      console.log('🔍 [GlobalGoals] Alterando selectedDepartment de:', selectedDepartment, 'para:', value || null);
      setSelectedDepartment(value || null);
    } else if (filterType === 'trimestre') {
      console.log('🔍 [GlobalGoals] Alterando selectedTrimestre de:', selectedTrimestre, 'para:', value);
      setSelectedTrimestre(value);
    } else {
      console.log('🔍 [GlobalGoals] Alterando selectedYear de:', selectedYear, 'para:', value);
      setSelectedYear(value);
    }
  };

  const handleEdit = (goal) => {
    setGoalData(goal);
    setShowModal(true);
  };

  const handleDelete = async (goalId) => {
    const goalToDelete = goals.find(g => g.id === goalId);
    if (goalToDelete) {
      setConfirmModal({
        open: true,
        goal: goalToDelete
      });
    }
  };

  const performDelete = async () => {
    if (!confirmModal.goal) return;

    try {
      await apiFetch(`/estrategico/metas-globais/${confirmModal.goal.id}`, { method: 'DELETE' });
      toast.success('Meta global excluída com sucesso!');
      fetchGoals();
    } catch (error) {
      console.error('Erro ao excluir meta:', error);
      toast.error('Erro ao excluir meta');
    } finally {
      setConfirmModal({ open: false, goal: null });
    }
  };

  const handleGoalSubmit = async (goalData) => {
    try {
      if (goalData.id) {
        await apiFetch(`/estrategico/metas-globais/${goalData.id}`, {
          method: 'PUT',
          body: goalData
        });
      } else {
        await apiFetch('/estrategico/metas-globais', {
          method: 'POST',
          body: { ...goalData, companyId: companyId || "" }
        });
      }

      toast.success(goalData.id ? 'Meta atualizada com sucesso!' : 'Meta criada com sucesso!');
      setShowModal(false);
      setGoalData(null);
      fetchGoals();
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      toast.error('Erro ao salvar meta');
    }
  };

  useEffect(() => {
    console.log("🚀 permissoes:", permissoes);
    console.log("🚀 selectedDepartment:", selectedDepartment);
    console.log("🚀 companyId:", companyId);
  }, [companyId, selectedDepartment, selectedTrimestre, selectedYear]);

  const handleGoalCreated = () => {
    setIsModalOpen(false);
    loadDepartmentGoals();
  };

  const TRIMESTER_MONTHS = {
    '1': [0, 1, 2],
    '2': [3, 4, 5],
    '3': [6, 7, 8],
    '4': [9, 10, 11],
  };

  const validMonths = useMemo(() => {
    let months = [];
    
    try {
      months = goalsDepartment.flatMap(goal => {
        if (!goal || !goal.monthlyGoals) return [];
        return goal.monthlyGoals;
      })
        .filter(m => {
          if (!m || !m.start_date) return false;
          
          if (!selectedTrimestre) return true;
          const monthIdx = new Date(m.start_date).getMonth();
          return selectedTrimestre && TRIMESTER_MONTHS[selectedTrimestre]?.includes(monthIdx);
        })
        .map(m => {
          if (!m || !m.start_date) return null;
          
          const monthIdx = new Date(m.start_date).getMonth();
          return {
            id: m.id,
            monthIdx,
            label: new Date(m.start_date).toLocaleDateString('pt-BR', { month: 'long' })
          };
        })
        .filter(m => m !== null);
      
      months = months.filter((m, idx, arr) => arr.findIndex(x => x.monthIdx === m.monthIdx) === idx);
      months = months.sort((a, b) => a.monthIdx - b.monthIdx);
    } catch (error) {
      console.error('Erro ao processar validMonths:', error);
      months = [];
    }

    if (!Array.isArray(months)) {
      months = [];
    }

    return months;
  }, [goalsDepartment, selectedTrimestre]);

  useEffect(() => {
    if (Array.isArray(validMonths) && validMonths.length > 0 && !selectedMonth) {
      const currentMonthIdx = new Date().getMonth();
      const monthObj = validMonths.find(m => m && m.monthIdx === currentMonthIdx);
      if (monthObj) {
        setSelectedMonth(monthObj.id);
      }
    }
  }, [validMonths, selectedMonth]);

  

  if (!user || !companyId) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
      </div>
    );
  }
  


  return (
    <>
      <PrincipalSidebar />
      <div className={styles.pageContainer}>
        <div className={styles.headerCard}>
          <div className={styles.headerContent}>
            <div className={styles.headerTop}>
              <div className={styles.headerLeft}>
                <div className={styles.headerTitleRow}>
                  <Target className="h-8 w-8" style={{ color: 'var(--onity-color-primary)' }} />
                  <h1 className={styles.headerTitle}>Metas</h1>
                </div>
              </div>
              
              <div className={styles.headerActions}>
                {hasAdminPermission() && (
                  <button
                    onClick={() => setShowModal(true)}
                    className={styles.addButton}
                  >
                    <svg className={styles.addButtonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className={styles.addButtonTextDesktop}>Nova Meta Global</span>
                    <span className={styles.addButtonTextMobile}>Nova Global</span>
                  </button>
                )}
                
                <button
                  onClick={() => setIsModalOpen(true)}
                  className={styles.addButton}
                >
                  <svg className={styles.addButtonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className={styles.addButtonTextDesktop}>Nova Meta Departamental</span>
                  <span className={styles.addButtonTextMobile}>Nova Departamental</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {accessDenied && (
          <div className={styles.accessDeniedCard}>
            <div className={styles.accessDeniedContent}>
              <div className={styles.accessDeniedInner}>
                <div className={styles.accessDeniedIcon}>
                  <svg className={styles.accessDeniedIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h2 className={styles.accessDeniedTitle}>Acesso Negado</h2>
                <p className={styles.accessDeniedText}>
                  Você não tem permissão para visualizar os dados das metas.
                </p>
                <p className={styles.accessDeniedSubtext}>
                  Entre em contato com o administrador se acredita que isso é um erro.
                </p>
              </div>
            </div>
          </div>
        )}

        {!accessDenied && (
          <>
            <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderLeft}>
                <div className={styles.sectionIcon}>
                  <svg className={styles.sectionIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className={styles.sectionTitle}>Metas Globais</h2>
              </div>

              <div className={styles.sectionFilters}>
                <Select
                  value={selectedTrimestreGlobal ? { value: selectedTrimestreGlobal, label: `${selectedTrimestreGlobal}º Trimestre` } : { value: '', label: 'Todos os trimestres' }}
                  onChange={(option) => handleGlobalFilterChange('trimestre', option?.value || '')}
                  options={[
                    { value: '', label: 'Todos os trimestres' },
                    { value: '1', label: '1º Trimestre' },
                    { value: '2', label: '2º Trimestre' },
                    { value: '3', label: '3º Trimestre' },
                    { value: '4', label: '4º Trimestre' },
                  ]}
                  placeholder="Trimestre"
                  className="min-w-[160px]"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: '40px',
                      backgroundColor: 'var(--onity-color-surface)',
                      borderColor: state.isFocused ? 'var(--onity-color-primary)' : 'var(--onity-color-border)',
                      boxShadow: state.isFocused ? '0 0 0 3px rgba(68, 84, 100, 0.15)' : 'none',
                      '&:hover': {
                        borderColor: 'var(--onity-color-primary)',
                        boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.1)'
                      }
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: 'var(--onity-color-surface)',
                      border: '1px solid var(--onity-color-border)',
                      boxShadow: 'var(--onity-elev-high)'
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected 
                        ? 'var(--onity-color-primary)' 
                        : state.isFocused 
                        ? 'var(--onity-color-bg)' 
                        : 'var(--onity-color-surface)',
                      color: state.isSelected 
                        ? 'var(--onity-color-primary-contrast)' 
                        : 'var(--onity-color-text)',
                      '&:hover': {
                        backgroundColor: state.isSelected 
                          ? 'var(--onity-color-primary-hover)' 
                          : 'var(--onity-color-bg)'
                      }
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: 'var(--onity-text-med)'
                    }),
                    input: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    })
                  }}
                />

                <Select
                  value={selectedYearGlobal ? { value: selectedYearGlobal, label: selectedYearGlobal } : { value: '', label: 'Todos os anos' }}
                  onChange={(option) => handleGlobalFilterChange('ano', option?.value || '')}
                  options={[
                    { value: '', label: 'Todos os anos' },
                    { value: '2024', label: '2024' },
                    { value: '2025', label: '2025' },
                    { value: '2026', label: '2026' },
                    { value: '2027', label: '2027' },
                  ]}
                  placeholder="Ano"
                  className="min-w-[120px]"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: '40px',
                      backgroundColor: 'var(--onity-color-surface)',
                      borderColor: state.isFocused ? 'var(--onity-color-primary)' : 'var(--onity-color-border)',
                      boxShadow: state.isFocused ? '0 0 0 3px rgba(68, 84, 100, 0.15)' : 'none',
                      '&:hover': {
                        borderColor: 'var(--onity-color-primary)',
                        boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.1)'
                      }
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: 'var(--onity-color-surface)',
                      border: '1px solid var(--onity-color-border)',
                      boxShadow: 'var(--onity-elev-high)'
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected 
                        ? 'var(--onity-color-primary)' 
                        : state.isFocused 
                        ? 'var(--onity-color-bg)' 
                        : 'var(--onity-color-surface)',
                      color: state.isSelected 
                        ? 'var(--onity-color-primary-contrast)' 
                        : 'var(--onity-color-text)',
                      '&:hover': {
                        backgroundColor: state.isSelected 
                          ? 'var(--onity-color-primary-hover)' 
                          : 'var(--onity-color-bg)'
                      }
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: 'var(--onity-text-med)'
                    }),
                    input: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    })
                  }}
                />
              </div>
            </div>

            {loadingGlobalGoals ? (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <span className={styles.loadingText}>Carregando metas globais...</span>
              </div>
            ) : goals.length === 0 ? (
              <div className={styles.emptyState}>
                <svg className={styles.emptyStateIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className={styles.emptyStateTitle}>Nenhuma meta global encontrada</h3>
                <p className={styles.emptyStateDescription}>Comece criando sua primeira meta global.</p>
              </div>
            ) : (
              <>
                <div className={styles.goalsList}>
                  {goals.map(goal => (
                    <GlobalGoalCard
                      key={goal.id}
                      goal={goal}
                      onEdit={() => handleEdit(goal)}
                      onDelete={() => handleDelete(goal.id)}
                    />
                  ))}
                </div>
                
                <Pagination
                  currentPage={globalGoalsPagination.currentPage}
                  totalPages={globalGoalsPagination.totalPages}
                  totalCount={globalGoalsPagination.totalCount}
                  limit={globalGoalsPagination.limit}
                  hasNextPage={globalGoalsPagination.hasNextPage}
                  hasPrevPage={globalGoalsPagination.hasPrevPage}
                  onPageChange={handleGlobalGoalsPageChange}
                />
              </>
            )}
          </div>
        

          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderLeft}>
                <div className={styles.sectionIcon}>
                  <Target className="w-5 h-5" style={{ color: 'var(--onity-color-primary)' }} />
                </div>
                <h2 className={styles.sectionTitle}>Metas Departamentais</h2>
              </div>

              <div className={styles.sectionFilters}>
                <Select
                  value={selectedDepartment ? { 
                    value: selectedDepartment, 
                    label: departments.find(d => d.id === selectedDepartment)?.title || 'Departamento não encontrado' 
                  } : null}
                  onChange={(selectedOption) => handleDepartmentFilterChange('department', selectedOption?.value || '')}
                  options={[{ value: '', label: 'Todos' }, ...(departments || []).map(department => ({
                    value: department.id,
                    label: department.title,
                  }))]}
                  placeholder={departments.length === 0 ? "Carregando departamentos..." : "Filtrar por Departamento"}
                  isLoading={departments.length === 0}
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: '40px',
                      backgroundColor: 'var(--onity-color-surface)',
                      borderColor: state.isFocused ? 'var(--onity-color-primary)' : 'var(--onity-color-border)',
                      boxShadow: state.isFocused ? '0 0 0 3px rgba(68, 84, 100, 0.15)' : 'none',
                      '&:hover': {
                        borderColor: 'var(--onity-color-primary)',
                        boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.1)'
                      }
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: 'var(--onity-color-surface)',
                      border: '1px solid var(--onity-color-border)',
                      boxShadow: 'var(--onity-elev-high)'
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected 
                        ? 'var(--onity-color-primary)' 
                        : state.isFocused 
                        ? 'var(--onity-color-bg)' 
                        : 'var(--onity-color-surface)',
                      color: state.isSelected 
                        ? 'var(--onity-color-primary-contrast)' 
                        : 'var(--onity-color-text)',
                      '&:hover': {
                        backgroundColor: state.isSelected 
                          ? 'var(--onity-color-primary-hover)' 
                          : 'var(--onity-color-bg)'
                      }
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: 'var(--onity-text-med)'
                    }),
                    input: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    })
                  }}
                />

                <Select
                  value={selectedTrimestre ? { value: selectedTrimestre, label: `${selectedTrimestre}º Trimestre` } : { value: '', label: 'Todos os trimestres' }}
                  onChange={(selectedOption) => handleDepartmentFilterChange('trimestre', selectedOption?.value || '')}
                  options={[
                    { value: '', label: 'Todos os trimestres' },
                    { value: '1', label: '1º Trimestre' },
                    { value: '2', label: '2º Trimestre' },
                    { value: '3', label: '3º Trimestre' },
                    { value: '4', label: '4º Trimestre' },
                  ]}
                  placeholder="Trimestre"
                  className="min-w-[160px]"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: '40px',
                      backgroundColor: 'var(--onity-color-surface)',
                      borderColor: state.isFocused ? 'var(--onity-color-primary)' : 'var(--onity-color-border)',
                      boxShadow: state.isFocused ? '0 0 0 3px rgba(68, 84, 100, 0.15)' : 'none',
                      '&:hover': {
                        borderColor: 'var(--onity-color-primary)',
                        boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.1)'
                      }
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: 'var(--onity-color-surface)',
                      border: '1px solid var(--onity-color-border)',
                      boxShadow: 'var(--onity-elev-high)'
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected 
                        ? 'var(--onity-color-primary)' 
                        : state.isFocused 
                        ? 'var(--onity-color-bg)' 
                        : 'var(--onity-color-surface)',
                      color: state.isSelected 
                        ? 'var(--onity-color-primary-contrast)' 
                        : 'var(--onity-color-text)',
                      '&:hover': {
                        backgroundColor: state.isSelected 
                          ? 'var(--onity-color-primary-hover)' 
                          : 'var(--onity-color-bg)'
                      }
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: 'var(--onity-text-med)'
                    }),
                    input: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    })
                  }}
                />

                <Select
                  value={selectedYear ? { value: selectedYear, label: selectedYear } : { value: '', label: 'Todos os anos' }}
                  onChange={(selectedOption) => handleDepartmentFilterChange('ano', selectedOption?.value || '')}
                  options={[
                    { value: '', label: 'Todos os anos' },
                    { value: '2024', label: '2024' },
                    { value: '2025', label: '2025' },
                    { value: '2026', label: '2026' },
                    { value: '2027', label: '2027' },
                  ]}
                  placeholder="Ano"
                  className="min-w-[120px]"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: '40px',
                      backgroundColor: 'var(--onity-color-surface)',
                      borderColor: state.isFocused ? 'var(--onity-color-primary)' : 'var(--onity-color-border)',
                      boxShadow: state.isFocused ? '0 0 0 3px rgba(68, 84, 100, 0.15)' : 'none',
                      '&:hover': {
                        borderColor: 'var(--onity-color-primary)',
                        boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.1)'
                      }
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: 'var(--onity-color-surface)',
                      border: '1px solid var(--onity-color-border)',
                      boxShadow: 'var(--onity-elev-high)'
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected 
                        ? 'var(--onity-color-primary)' 
                        : state.isFocused 
                        ? 'var(--onity-color-bg)' 
                        : 'var(--onity-color-surface)',
                      color: state.isSelected 
                        ? 'var(--onity-color-primary-contrast)' 
                        : 'var(--onity-color-text)',
                      '&:hover': {
                        backgroundColor: state.isSelected 
                          ? 'var(--onity-color-primary-hover)' 
                          : 'var(--onity-color-bg)'
                      }
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: 'var(--onity-text-med)'
                    }),
                    input: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    })
                  }}
                />


                </div>
            </div>

            {loadingDepartmentGoals ? (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <span className={styles.loadingText}>Carregando metas departamentais...</span>
              </div>
            ) : goalsDepartment.length === 0 ? (
              <div className={styles.emptyState}>
                <svg className={styles.emptyStateIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className={styles.emptyStateTitle}>Nenhuma meta departamental encontrada</h3>
                <p className={styles.emptyStateDescription}>Comece criando sua primeira meta departamental.</p>
              </div>
            ) : (
              <>
                <div className={styles.goalsList}>
                  {goalsDepartment
                    .map((goal) => (
                      <DepartmentGoalCard 
                        key={goal.id} 
                        goal={goal} 
                        onUpdated={loadDepartmentGoals} 
                        selectedMonth={selectedMonth}
                      />
                    ))}
                </div>
                
                <Pagination
                  currentPage={departmentGoalsPagination.currentPage}
                  totalPages={departmentGoalsPagination.totalPages}
                  totalCount={departmentGoalsPagination.totalCount}
                  limit={departmentGoalsPagination.limit}
                  hasNextPage={departmentGoalsPagination.hasNextPage}
                  hasPrevPage={departmentGoalsPagination.hasPrevPage}
                  onPageChange={handleDepartmentGoalsPageChange}
                />
              </>
            )}
          </div>
        

        {isModalOpen && (
          <DepartmentGoalModal
            companyId={companyId || ""}
            onClose={() => setIsModalOpen(false)}
            onCreated={handleGoalCreated}
          />
        )}

        <GlobalGoalModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSubmit={handleGoalSubmit}
          goalData={goalData}
        />

        <ConfirmModal
          isOpen={confirmModal.open}
          title="Excluir meta global"
          description={
            <span>Tem certeza que deseja excluir a meta global "{confirmModal.goal?.title}"?</span>
          }
          confirmText="Excluir"
          cancelText="Cancelar"
          onConfirm={performDelete}
          onCancel={() => setConfirmModal({ open: false, goal: null })}
        />
        </>
        )}
      </div>
    </>
  );
}

