"use client";

/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Handshake, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import Select from "react-select";
import styles from '../../../styles/estrategico/departmentDetails.module.css';
import { DepartmentGoalModal } from '../../../components/estrategico/DepartmentGoalModal';
import { MonthlyGoalRow } from '../../../components/estrategico/MonthlyGoalRow';
import { calcularProgressoMeta } from '../../../utils/estrategico/goalUtils';
import { KpiMetaPercentualDepartamento } from '../../../components/estrategico/KpiMetaPercentualDepartamento';

// Configuração da API
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const normalizeUrl = (u) => `${BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;

const getToken = () => {
  try {
    return localStorage.getItem('token') || null;
  } catch {
    return null;
  }
};

const getUserData = () => {
  try {
    const stored = localStorage.getItem('userData');
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch {
    return null;
  }
};

const getEmpresaId = () => {
  const data = getUserData();
  if (!data) return null;
  return data.EmpresaId || data.empresaId || null;
};

const getUserRoleFromStorage = () => {
  const data = getUserData();
  if (!data) return null;
  if (data.role) return data.role;
  const permissoes = data.permissoes || {};
  if (permissoes.adm && permissoes.adm.includes('admin')) return 'ADMIN';
  if (permissoes.rh && permissoes.rh.includes('admin')) return 'RH';
  if (permissoes.gestao && permissoes.gestao.includes('admin')) return 'GESTOR';
  return 'FUNCIONARIO';
};

const apiFetch = async (url, options = {}) => {
  const token = getToken();
  const empresaId = getEmpresaId();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
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

export default function DepartmentDetails() {
  const params = useParams();
  const companyId = params?.companyId;
  const departmentId = params?.departmentId;
  const [user, setUser] = useState(null);
  const [department, setDepartment] = useState(null);
  const [members, setMembers] = useState([]);
  const [departmentTasks, setDepartmentTasks] = useState([]);
  const [employeeTasks, setEmployeeTasks] = useState({});
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  });

  const [filteredTasks, setFilteredTasks] = useState([]);
  const [departmentGoals, setDepartmentGoals] = useState([]);
  const [goals, setGoals] = useState([]);
  const [selectedTrimestre, setSelectedTrimestre] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [childDepartments, setChildDepartments] = useState([]);
  const [departmentStats, setDepartmentStats] = useState(null);
  const [departmentMeetings, setDepartmentMeetings] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedMeetingYear, setSelectedMeetingYear] = useState(null);
  const [availableMeetingYears, setAvailableMeetingYears] = useState([]);
  const [employeePerformances, setEmployeePerformances] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [editGoalModalOpen, setEditGoalModalOpen] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState(null);
  const [addingMonthGoalId, setAddingMonthGoalId] = useState(null);
  const [newMonth, setNewMonth] = useState('');
  const [newValue, setNewValue] = useState(0);
  const [selectedMeetingMonth, setSelectedMeetingMonth] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  
  // Estados para controlar expansão das seções
  const [expandedSections, setExpandedSections] = useState({
    team: false,
    goals: false,
    meetings: false,
    tasks: false,
    childDepartments: false
  });

  // Estados para permissões
  const [userRole, setUserRole] = useState('');
  const [isOwnDepartment, setIsOwnDepartment] = useState(false);
  const [isLeaderOfDepartment, setIsLeaderOfDepartment] = useState(false);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Função para decodificar entidades HTML e limpar tags
  const cleanHtmlContent = (htmlContent) => {
    if (!htmlContent) return '';
    
    // Criar um elemento temporário para decodificar entidades HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // Obter o texto limpo (sem tags HTML)
    let cleanText = tempDiv.textContent || tempDiv.innerText || '';
    
    // Limpar espaços extras e quebras de linha
    cleanText = cleanText.replace(/\s+/g, ' ').trim();
    
    return cleanText;
  };

  const getTrimestreFromStartDate = (date) => {
    const month = new Date(date).getMonth() + 1;
    if (month <= 3) return '1';
    if (month <= 6) return '2';
    if (month <= 9) return '3';
    return '4';
  };

  // Função para verificar permissões de exibição dos componentes
  const canViewComponent = (componentType) => {
    // SUPERADMIN, ADMIN e RH têm acesso total
    if (['SUPERADMIN', 'ADMIN', 'RH'].includes(userRole)) {
      return true;
    }

    switch (componentType) {
      case 'kpi': {
        // Todos veem o KPI
        return true;
      }
      
      case 'performance': {
        // GESTOR pode ver se for líder do departamento
        return userRole === 'GESTOR' && isLeaderOfDepartment;
      }
      
      case 'team': {
        // FUNCIONARIO e GESTOR veem o time
        return ['FUNCIONARIO', 'GESTOR'].includes(userRole);
      }
      
      case 'goals': {
        // FUNCIONARIO vê se for seu próprio departamento
        // GESTOR vê se for seu próprio departamento ou se for líder
        if (userRole === 'FUNCIONARIO') {
          return isOwnDepartment;
        }
        if (userRole === 'GESTOR') {
          return isOwnDepartment || isLeaderOfDepartment;
        }
        return false;
      }
      
      case 'meetings': {
        // Apenas SUPERADMIN, ADMIN e RH veem reuniões
        return false;
      }
      
      case 'tasks': {
        // SUPERADMIN, ADMIN e RH veem todas as tarefas
        // GESTOR vê tarefas dos departamentos que lidera
        if (['SUPERADMIN', 'ADMIN', 'RH'].includes(userRole)) {
          return true;
        }
        if (userRole === 'GESTOR' && isLeaderOfDepartment) {
          return true;
        }
        return false;
      }
      
      case 'childDepartments': {
        // FUNCIONARIO e GESTOR veem departamentos vinculados
        return ['FUNCIONARIO', 'GESTOR'].includes(userRole);
      }
      
      default:
        return false;
    }
  };

  // const handleViewMeeting = (meeting: any) => {
  //   setEditingMeeting(meeting);
  //   setShowDetailsModal(true);
  // };

  const handleViewEmployeeProfile = (employeeId) => {
    if (!canViewComponent('team')) return;
    router.push(`/company/${companyId}/employee/${employeeId}`);
  };

  // Carregar usuário e verificar permissões
  useEffect(() => {
    const loadUserAndCheckRole = async () => {
      try {
        const currentUser = getUserData();
        if (!currentUser) {
          console.error("❌ [DepartmentDetails] Usuário não encontrado - redirecionando para login");
          router.push('/login');
          return;
        }
        setUser(currentUser);
        
        if (!companyId) {
          return;
        }
        
        // Verificar papel do usuário na empresa (igual ao CompanyDashboard)
        try {
          const storedRole = getUserRoleFromStorage();
          if (storedRole) {
            setUserRole(storedRole);
          }

          const userRoleResponse = await apiFetch(`/user-company/role?userId=${currentUser.id}&companyId=${companyId}`);
          setUserRole(userRoleResponse.role);
          
          // Teste adicional: verificar se o usuário tem acesso direto à empresa
          try {
            const testCompany = await apiFetch(`/companies/${companyId}`);
          } catch (companyError) {
            console.error("❌ [DepartmentDetails] Erro ao acessar empresa:", companyError);
            
            // Se não conseguir acessar a empresa, pode ser que o usuário não tenha registro na user_company
            
            toast.error("Usuário não tem acesso a esta empresa. Entre em contato com o administrador.");
          }
          
        } catch (roleError) {
          console.error("❌ [DepartmentDetails] Erro ao verificar role:", roleError);
          if (roleError instanceof Error) {
            console.error("❌ [DepartmentDetails] Mensagem do erro de role:", roleError.message);
          }
          toast.error("Erro ao verificar permissões na empresa");
        }
        
      } catch (err) {
        console.error("❌ [DepartmentDetails] Erro ao carregar usuário:", err);
        if (err instanceof Error) {
          console.error("❌ [DepartmentDetails] Erro message:", err.message);
        }
        // Se não conseguir carregar o usuário, redirecionar para login
        router.push('/');
      }
    };

    loadUserAndCheckRole();
  }, [router, companyId]);

  useEffect(() => {
    const loadDepartment = async () => {
      try {
        if (!companyId || !departmentId || !user) {
          return;
        }

        // 🔹 Carrega detalhes do departamento
        const deptDetails = await apiFetch(`/departments/${departmentId}`);
        setDepartment(deptDetails);

        // 🔹 Carrega membros
        const deptMembers = await apiFetch(`/departments/${departmentId}/members?companyId=${companyId}`);
        setMembers(deptMembers || []);

        // 🔹 Verificar se o usuário é membro ou líder do departamento
        const userIsMember = deptMembers?.some((member) => member.id === user.id);
        setIsOwnDepartment(userIsMember);

        // 🔹 Verificar se o usuário é líder do departamento
        try {
          const leaderResponse = await apiFetch(`/departments/leader/${user.id}?companyId=${companyId}`);
          const isLeader = leaderResponse?.some((dept) => dept.id === departmentId);
          setIsLeaderOfDepartment(isLeader);
        } catch {
          setIsLeaderOfDepartment(false);
        }

        // 🔹 Carrega tarefas do departamento (sempre para calcular estatísticas de performance)
        let deptTasks = [];
        try {
          deptTasks = await apiFetch(`/tasks?departmentId=${departmentId}`);
          setDepartmentTasks(deptTasks || []);
        } catch (error) {
          setDepartmentTasks([]);
        }

        // 🔹 Carrega metas do departamento (só se tiver permissão)
        if (canViewComponent('goals')) {
          const deptGoals = await apiFetch(`/department-goals/department/${departmentId}`);
          setDepartmentGoals(deptGoals || []);
        }

        // As estatísticas serão calculadas em um useEffect separado 
        // depois que userRole e isLeaderOfDepartment forem atualizados

      } catch (err) {
        console.error("❌ [DepartmentDetails] Erro ao carregar departamento:", err);
        if (err instanceof Error) {
          console.error("❌ [DepartmentDetails] Stack trace:", err.stack);
          console.error("❌ [DepartmentDetails] Message:", err.message);
          
          // Verificar se é erro de acesso negado (403)
          if (err.message.includes('Acesso negado') || err.message.includes('403')) {
            setAccessDenied(true);
          } else {
            toast.error("Erro ao carregar departamento");
          }
        } else {
          toast.error("Erro ao carregar departamento");
        }
      } finally {
        setLoading(false);
      }
    };
    loadDepartment();
  }, [companyId, departmentId, user, userRole]);

  // useEffect separado para calcular estatísticas de performance
  useEffect(() => {
    const calculatePerformanceStats = () => {
      if (!canViewComponent('performance')) {
        return;
      }

      // Calcular estatísticas considerando task_assignees
      let totalTasks = 0;
      let completedTasks = 0;
      
      const taskStatus = {
        todo: 0,
        in_progress: 0,
        completed: 0,
        completed_late: 0,
        overdue: 0,
        cancelled: 0,
      };

      departmentTasks.forEach((task) => {
        // Se a tarefa tem assignees múltiplos, contar cada um
        if (task.assignees && task.assignees.length > 0) {
          task.assignees.forEach((assignee) => {
            totalTasks++;
            const status = assignee.status || task.status;
            
            if (status === 'completed' || status === 'completed_late') {
              completedTasks++;
            }
            
            if (status in taskStatus) {
              taskStatus[status]++;
            }
          });
        } else {
          // Tarefa individual (assigned_to direto)
          totalTasks++;
          if (task.status === 'completed' || task.status === 'completed_late') {
            completedTasks++;
          }
          
          if (task.status in taskStatus) {
            taskStatus[task.status]++;
          }
        }
      });

      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      const departmentPerformance = {
        employees: members.length,
        tasks: totalTasks,
        completionRate: completionRate.toFixed(2),  // Taxa de conclusão
        taskStatus,  // Passando a estatística de status
      };

      setDepartmentStats(departmentPerformance);
    };

    calculatePerformanceStats();
  }, [userRole, isLeaderOfDepartment, isOwnDepartment, departmentTasks, members]);

  const loadGoals = async () => {
    try {
      if (!departmentId || !companyId || !user || !canViewComponent('goals')) return;

      const deptGoals = await apiFetch(`/department-goals/department/${departmentId}?companyId=${companyId}`);

      if (!Array.isArray(deptGoals)) {
        console.error('❌ [DepartmentDetails] deptGoals não é um array:', deptGoals);
        setGoals([]);
        return;
      }

      const goalsWithMonths = await Promise.all(
        deptGoals.map(async (goal) => {
          const monthlyGoals = await apiFetch(`/department-goals/${goal.id}/months`);

          // Se um mês específico estiver selecionado, use apenas os dados desse mês
          if (selectedMonth) {
            const monthGoal = monthlyGoals.find((m) => {
              const data = new Date((m).start_date);
              return data.getMonth() + 1 === Number(selectedMonth);
            });
            if (monthGoal) {
              return {
                ...goal,
                monthlyGoals,
                current_value: monthGoal.value_achieved || 0,
                target_value: monthGoal.value_goal || 0,
                progress: monthGoal.value_goal > 0 ? ((monthGoal.value_achieved || 0) / monthGoal.value_goal) * 100 : 0,
              };
            } else {
              // Se não encontrou a meta para o mês selecionado, retorna com valores zerados
              return {
                ...goal,
                monthlyGoals,
                current_value: 0,
                target_value: 0,
                progress: 0,
              };
            }
          }

          // Caso contrário, calcule o progresso geral
          const current_value = monthlyGoals.reduce((acc, m) => acc + (m.value_achieved || 0), 0);
          const target_value = monthlyGoals.reduce((acc, m) => acc + (m.value_goal || 0), 0);
          const progress = target_value > 0 ? (current_value / target_value) * 100 : 0;

          return {
            ...goal,
            monthlyGoals,
            current_value,
            target_value,
            progress,
          };
        })
      );

      const filteredByTrimester = selectedTrimestre
        ? goalsWithMonths.filter(goal => getTrimestreFromStartDate(goal.start_date) === selectedTrimestre)
        : goalsWithMonths;

      const filteredByYear = selectedYear
        ? filteredByTrimester.filter(goal => new Date(goal.start_date).getFullYear().toString() === selectedYear)
        : filteredByTrimester;

      setGoals(filteredByYear);
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
      toast.error('Erro ao carregar metas');
    }
  };


  useEffect(() => {
    if (canViewComponent('goals')) {
      loadGoals();
    }
  }, [companyId, departmentId, selectedTrimestre, selectedYear, selectedMonth, user, userRole, isOwnDepartment, isLeaderOfDepartment]);

  useEffect(() => {
    if (selectedMonth) {
      loadGoals();
    }
  }, [selectedMonth]);

  // Definir trimestre atual e ano atual como padrão
  useEffect(() => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear().toString();
    
    // Definir trimestre atual
    if (!selectedTrimestre) {
      let currentTrimester = '';
      if (currentMonth <= 3) currentTrimester = '1';
      else if (currentMonth <= 6) currentTrimester = '2';
      else if (currentMonth <= 9) currentTrimester = '3';
      else currentTrimester = '4';
      setSelectedTrimestre(currentTrimester);
    }
    
    // Definir ano atual
    if (!selectedYear) {
      setSelectedYear(currentYear);
    }
  }, [selectedTrimestre, selectedYear]);

  useEffect(() => {
    const loadChildren = async () => {
      if (!departmentId || !companyId || !user || !canViewComponent('childDepartments')) return;

      try {
        const children = await apiFetch(`/departments?companyId=${companyId}`);
        const filteredChildren = children.filter((dept) => dept.parent_id === departmentId);
        setChildDepartments(filteredChildren);
      } catch (error) {
        toast.error('Erro ao buscar subdepartamentos');
        console.error(error);
      }
    };

    if (canViewComponent('childDepartments')) {
      loadChildren();
    }
  }, [departmentId, companyId, user, userRole, isOwnDepartment, isLeaderOfDepartment]);



  const handleToggleTasks = async (employeeId) => {
    if (!canViewComponent('team')) return;
    
    if (selectedEmployeeId === employeeId) {
      setSelectedEmployeeId(null);
      return;
    }

    setSelectedEmployeeId(employeeId);
    if (!employeeTasks[employeeId]) {
      try {
        const result = await apiFetch(`/tasks/employee/${employeeId}/filtered?companyId=${companyId}&page=1&limit=100`);
        const tasks = result?.tasks || result || [];
        setEmployeeTasks(prev => ({ ...prev, [employeeId]: tasks }));
      } catch  {
        toast.error("Erro ao carregar tarefas");
      }
    }
  };

  useEffect(() => {
    let result = [...departmentTasks];

    if (filters.status) {
      result = result.filter(task => task.status === filters.status);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(task => {
        // Buscar no título
        if (task.title.toLowerCase().includes(searchLower)) return true;
        
        // Buscar no assignee direto
        if (task.assignee?.full_name?.toLowerCase().includes(searchLower)) return true;
        
        // Buscar nos assignees múltiplos
        if (task.assignees && task.assignees.some((assignee) => 
          assignee.user.full_name.toLowerCase().includes(searchLower)
        )) return true;
        
        return false;
      });
    }

    setFilteredTasks(result);
  }, [filters, departmentTasks]);

  const statuses = [
    { key: 'todo', color: '#3B82F6' },             // Azul
    { key: 'in_progress', color: '#8B5CF6' },     // Roxo
    { key: 'completed', color: '#10B981' },        // Verde
    { key: 'completed_late', color: '#FBBF24' },   // Amarelo
    { key: 'overdue', color: '#EF4444' },          // Vermelho
    { key: 'cancelled', color: '#6B7280' },        // Cinza
  ];

  const getProgressBarClass = (progress) => {
    if (progress >= 80) return styles.progressHigh;
    if (progress >= 50) return styles.progressMedium;
    return styles.progressLow;
  };

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: 40,
      borderColor: state.isFocused ? 'var(--onity-color-primary)' : 'var(--onity-color-border)',
      boxShadow: state.isFocused ? '0 0 0 3px rgba(68, 84, 100, 0.15)' : 'none',
      '&:hover': {
        borderColor: 'var(--onity-color-primary)'
      }
    }),
    menu: (base) => ({
      ...base,
      zIndex: 1000
    })
  };

  const getStatusText = (status) => {
    const statusTexts = {
      todo: 'A Fazer',
      in_progress: 'Em Andamento',
      completed: 'Concluído',
      completed_late: 'Concluído com Atraso',
      overdue: 'Atrasado',
      cancelled: 'Cancelado',
    };
    return statusTexts[status] || status; // Retorna o texto correspondente ou o próprio status se não encontrado
  };

  // Função para cor do status igual ao KPI
  const getStatusColor = (status) => {
    switch (status) {
      case 'todo': return '#3B82F6'; // Azul
      case 'in_progress': return '#8B5CF6'; // Roxo
      case 'completed': return '#10B981'; // Verde
      case 'completed_late': return '#FBBF24'; // Amarelo
      case 'overdue': return '#EF4444'; // Vermelho
      case 'cancelled': return '#6B7280'; // Cinza
      default: return '#A0AEC0'; // Cinza
    }
  };

  useEffect(() => {
    const loadMeetingsByDepartment = async () => {
      if (!companyId || !members.length || !user || !canViewComponent('meetings')) return;

      try {
        const allMeetings = await apiFetch(`/meetings?companyId=${companyId}`);
        const memberIds = members.map((m) => m.id);
        const relatedMeetings = (allMeetings || []).filter((meeting) =>
          meeting.participants.some((participantId) => memberIds.includes(participantId))
        );
        setDepartmentMeetings(relatedMeetings);
        const years = Array.from(
          new Set(relatedMeetings.map((m) => new Date(m.date).getFullYear().toString()))
        ).sort();

        setAvailableMeetingYears(years);
        
        // Definir o mês atual como padrão se não houver mês selecionado
        if (!selectedMeetingMonth) {
          const currentMonth = (new Date().getMonth() + 1).toString();
          setSelectedMeetingMonth(currentMonth);
        }
        
        // Definir o ano atual como padrão se não houver ano selecionado
        if (!selectedMeetingYear && years.length > 0) {
          const currentYear = new Date().getFullYear().toString();
          setSelectedMeetingYear(years.includes(currentYear) ? currentYear : years[0]);
        }
      } catch (error) {
        console.error("Erro ao buscar reuniões do departamento:", error);
        toast.error("Erro ao buscar reuniões do departamento");
      }
    };

    if (canViewComponent('meetings')) {
      loadMeetingsByDepartment();
    }
  }, [companyId, members, selectedMeetingYear, selectedMeetingMonth, user, userRole, isOwnDepartment, isLeaderOfDepartment]);

  const filteredMeetings = selectedMeetingYear
  ? departmentMeetings.filter((m) => new Date(m.date).getFullYear().toString() === selectedMeetingYear)
  : departmentMeetings;

  const filteredMeetingsWithMonth = selectedMeetingMonth
    ? filteredMeetings.filter((m) => (new Date(m.date).getMonth() + 1).toString() === selectedMeetingMonth)
    : filteredMeetings;

  useEffect(() => {
    const loadAllUsers = async () => {
      try {
        if (!companyId || !user || !canViewComponent('meetings')) return;
        const response = await apiFetch(`/employees?companyId=${companyId}`);
        setAllUsers(response);
      } catch (err) {
        console.error("Erro ao carregar usuários:", err);
      }
    };

    if (canViewComponent('meetings')) {
      loadAllUsers();
    }
  }, [companyId, user, userRole, isOwnDepartment, isLeaderOfDepartment]);

  useEffect(() => {
    async function fetchEmployeePerformances() {
      if (!members || members.length === 0 || !user || !canViewComponent('team')) return;
      const performances = {};
      await Promise.all(members.map(async (emp) => {
        const result = await apiFetch(`/tasks/employee/${emp.id}/filtered?companyId=${companyId}&page=1&limit=100`);
        const tasks = result?.tasks || result || [];
        if (!tasks || tasks.length === 0) {
          performances[emp.id] = -1;
          return;
        }
        const completed = tasks.filter((t) => t.status === 'completed' || t.status === 'completed_late').length;
        performances[emp.id] = Math.round((completed / tasks.length) * 100);
      }));
      setEmployeePerformances(performances);
    }
    if (canViewComponent('team')) {
      fetchEmployeePerformances();
    }
  }, [members, user, userRole, isOwnDepartment, isLeaderOfDepartment]);

  // Função para obter meses do trimestre da meta
  function getMonthsForGoalTrimester(goal) {
    const month = new Date(goal.start_date).getMonth() + 1;
    if (month <= 3) return [1, 2, 3];
    if (month <= 6) return [4, 5, 6];
    if (month <= 9) return [7, 8, 9];
    return [10, 11, 12];
  }

  // Função para alternar expansão das seções
  const toggleSection = (section) => {
    // Verificar permissão antes de permitir expansão
    if (section === 'team' && !canViewComponent('team')) return;
    if (section === 'goals' && !canViewComponent('goals')) return;
    if (section === 'meetings' && !canViewComponent('meetings')) return;
    if (section === 'tasks' && !canViewComponent('tasks')) return;
    if (section === 'childDepartments' && !canViewComponent('childDepartments')) return;
    
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (loading || !user) {
    return <div className={styles.pageLoading}>Carregando departamento...</div>;
  }

  return (
    <div className={styles.page}>
      {/* Header da página */}
      <div className={styles.pageHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerTitleRow}>
            <button
              onClick={() => router.back()}
              className={styles.backButton}
              type="button"
            >
              <ArrowLeft className={styles.backButtonIcon} />
            </button>
            <Handshake className={styles.headerIcon} />
            <h1 className={styles.headerTitle}>{department?.title || 'Departamento'}</h1>
          </div>
          <p className={styles.headerDescription}>
            Visualize detalhes, metas e performance do departamento
          </p>
        </div>

      {/* Mensagem de Acesso Negado */}
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
                Você não tem permissão para visualizar os dados deste departamento.
              </p>
              <p className={styles.accessDeniedSubtext}>
                Entre em contato com o administrador se acredita que isso é um erro.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo do departamento - só mostrar se não tiver acesso negado */}
      {!accessDenied && (
        <>
          {/* Cards de Performance e KPI lado a lado */}
          <div className={styles.cardsGrid}>
          {/* Seção de Performance do Departamento - Só visível para SUPERADMIN/ADMIN/RH ou GESTOR líder */}
          {canViewComponent('performance') && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderLeft}>
                  <div className={`${styles.cardIcon} ${styles.performanceIcon}`}>
                    <svg className={styles.cardIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className={styles.cardTitle}>Performance do Departamento</h2>
                    <p className={styles.cardSubtitle}>Acompanhe o progresso das tarefas</p>
                  </div>
                </div>
              </div>

              {departmentStats ? (
                <div className={styles.performanceBody}>
                  {/* Gráfico de Performance */}
                  <div className={styles.performanceChart}>
                    <svg width="220" height="220" viewBox="0 0 220 220">
                      {(() => {
                        const total = Object.values(departmentStats.taskStatus).reduce((acc, val) => acc + val, 0);
                        const radius = 80;
                        const strokeWidth = 20;
                        const center = 110;
                        const circumference = 2 * Math.PI * radius;
                        let offset = 0;
                        const circles = statuses.map(({ key, color }) => {
                          const value = departmentStats.taskStatus[key];
                          const percent = total === 0 ? 0 : value / total;
                          const strokeLength = percent * circumference;
                          const dashArray = `${strokeLength} ${circumference - strokeLength}`;
                          const dashOffset = circumference - offset;
                          offset += strokeLength;
                          return (
                            <circle
                              key={`status-${key}`}
                              cx={center}
                              cy={center}
                              r={radius}
                              fill="transparent"
                              stroke={color}
                              strokeWidth={strokeWidth}
                              strokeDasharray={dashArray}
                              strokeDashoffset={dashOffset}
                              transform="rotate(-90 110 110)"
                            />
                          );
                        });
                        return circles;
                      })()}
                      <text
                        x="50%"
                        y="50%"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        className={styles.performanceChartText}
                      >
                        {departmentStats.completionRate}%
                      </text>
                    </svg>
                  </div>

                  {/* Resumo */}
                  <div className={styles.performanceSummary}>
                    <div className={styles.performanceSummaryRow}>
                      <div className={styles.performanceSummaryItem}>
                        <span className={`${styles.summaryDot} ${styles.summaryDotPrimary}`} />
                        <span>{departmentStats.employees} Funcionários</span>
                      </div>
                      <div className={styles.performanceSummaryItem}>
                        <span className={`${styles.summaryDot} ${styles.summaryDotSuccess}`} />
                        <span>{departmentStats.tasks} Tarefas</span>
                      </div>
                    </div>
                  </div>

                  {/* Legenda e Estatísticas */}
                  <div className={styles.performanceLegend}>
                    <div className={styles.performanceLegendGrid}>
                      {statuses.map(({ key, color }) => (
                        <div key={`status-${key}`} className={styles.performanceLegendItem}>
                          <div className={styles.performanceLegendLabel}>
                            <span
                              className={styles.legendDot}
                              style={{ backgroundColor: color }}
                            />
                            <span className={styles.legendLabel}>{getStatusText(key)}</span>
                          </div>
                          <span className={styles.legendValue}>{departmentStats.taskStatus[key] || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.loadingState}>
                  <div className={styles.loadingSpinner} />
                  <span className={styles.loadingText}>Carregando estatísticas...</span>
                </div>
              )}
            </div>
          )}

                     {/* Seção de KPI de Meta Percentual */}
           <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderLeft}>
                <div className={`${styles.cardIcon} ${styles.kpiIcon}`}>
                  <svg className={styles.cardIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <h2 className={styles.cardTitle}>KPI de Meta Percentual</h2>
                  <p className={styles.cardSubtitle}>Progresso das metas do mês atual</p>
                </div>
              </div>
            </div>

            <KpiMetaPercentualDepartamento 
              goals={goals} 
              departmentId={departmentId} 
              companyId={companyId} 
            />
          </div>
        </div>

        {/* Seção de Time - Visível para FUNCIONARIO e GESTOR */}
        {canViewComponent('team') && (
          <div className={`${styles.card} ${styles.sectionCard}`}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderLeft}>
                <div className={`${styles.cardIcon} ${styles.teamIcon}`}>
                  <svg className={styles.cardIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className={styles.cardTitle}>Time</h2>
                  <p className={styles.cardSubtitle}>Membros do departamento</p>
                </div>
              </div>
              <button
                onClick={() => toggleSection('team')}
                className={styles.sectionToggleButton}
                type="button"
                aria-label="Alternar exibição do time"
              >
                {expandedSections.team ? (
                  <ChevronDown className={styles.sectionToggleIcon} />
                ) : (
                  <ChevronRight className={styles.sectionToggleIcon} />
                )}
              </button>
            </div>

            {expandedSections.team && (
              <>
                {members.length > 0 ? (
                  <div className={styles.teamMembersGrid}>
                    {members.map(emp => (
                      <div key={emp.id} className={styles.memberCard}>
                        <div className={styles.memberHeader}>
                          <div className={styles.memberAvatar}>
                            {emp.avatar_url ? (
                              <img
                                src={emp.avatar_url}
                                alt="Avatar"
                                className={styles.memberAvatarImage}
                              />
                            ) : (
                              <span className={styles.memberAvatarFallback}>
                                {emp.full_name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className={styles.memberDetails}>
                            <h3 className={styles.memberName}>{emp.full_name}</h3>
                            <p className={styles.memberEmail}>{emp.email}</p>
                          </div>
                        </div>

                        <div className={styles.memberActions}>
                          <button
                            onClick={() => handleToggleTasks(emp.id)}
                            className={`${styles.memberActionButton} ${styles.memberActionTasks}`}
                            type="button"
                            title="Ver tarefas"
                          >
                            <svg className={styles.memberActionIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Tarefas
                          </button>
                          <button
                            onClick={() => handleViewEmployeeProfile(emp.id)}
                            className={`${styles.memberActionButton} ${styles.memberActionProfile}`}
                            type="button"
                            title="Ver perfil"
                          >
                            <Handshake className={styles.memberActionIcon} />
                            Perfil
                          </button>
                        </div>

                        {selectedEmployeeId === emp.id && employeeTasks[emp.id] && (
                          <div className={styles.memberTaskList}>
                            <h4 className={styles.memberTaskTitle}>Tarefas do Funcionário:</h4>
                            <div className={styles.memberTaskItems}>
                              {employeeTasks[emp.id].map(task => (
                                <div key={task.id} className={styles.memberTaskItem}>
                                  <span
                                    className={styles.memberTaskStatusDot}
                                    style={{ backgroundColor: getStatusColor(task.status) }}
                                  />
                                  <span className={styles.memberTaskName}>{task.title}</span>
                                  <span className={styles.memberTaskBadge}>
                                    {getStatusText(task.status)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <svg className={styles.emptyIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h3 className={styles.emptyTitle}>Nenhum membro encontrado</h3>
                    <p className={styles.emptyText}>Este departamento ainda não possui membros cadastrados.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}


                 {/* Seção de Metas Departamentais - Visível para FUNCIONARIO (seu próprio dept) e GESTOR (seu próprio ou que lidera) */}
        {canViewComponent('goals') && (
          <div className={`${styles.card} ${styles.sectionCard}`}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderLeft}>
                <div className={`${styles.cardIcon} ${styles.goalsIcon}`}>
                  <svg className={styles.cardIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className={styles.cardTitle}>Metas Departamentais</h2>
                  <p className={styles.cardSubtitle}>Objetivos e progresso do departamento</p>
                </div>
              </div>
              <div className={styles.sectionFilters}>
                <div className={styles.filterSelectMedium}>
                  <Select
                    classNamePrefix="react-select"
                    value={selectedTrimestre ? { value: selectedTrimestre, label: `${selectedTrimestre}º Trimestre` } : { value: '', label: 'Todos os trimestres' }}
                    onChange={(opt) => {
                      setSelectedTrimestre(opt?.value || null);
                      setSelectedMonth(null);
                    }}
                    options={[
                      { value: '', label: 'Todos os trimestres' },
                      { value: '1', label: '1º Trimestre' },
                      { value: '2', label: '2º Trimestre' },
                      { value: '3', label: '3º Trimestre' },
                      { value: '4', label: '4º Trimestre' },
                    ]}
                    placeholder="Trimestre"
                    styles={selectStyles}
                  />
                </div>
                <div className={styles.filterSelectSmall}>
                  <Select
                    classNamePrefix="react-select"
                    value={selectedYear ? { value: selectedYear, label: selectedYear } : { value: '', label: 'Todos os anos' }}
                    onChange={(opt) => setSelectedYear(opt?.value || '')}
                    options={[
                      { value: '', label: 'Todos os anos' },
                      { value: '2024', label: '2024' },
                      { value: '2025', label: '2025' },
                      { value: '2026', label: '2026' },
                    ]}
                    placeholder="Ano"
                    styles={selectStyles}
                  />
                </div>
                <button
                  onClick={() => toggleSection('goals')}
                  className={styles.sectionToggleButton}
                  type="button"
                  aria-label="Alternar exibição de metas"
                >
                  {expandedSections.goals ? (
                    <ChevronDown className={styles.sectionToggleIcon} />
                  ) : (
                    <ChevronRight className={styles.sectionToggleIcon} />
                  )}
                </button>
              </div>
            </div>

            {expandedSections.goals && (
              <>
                {goals.length > 0 ? (
                  <div className={styles.goalsCardList}>
                    {goals.map(goal => (
                      <div key={`goal-${goal.id}`} className={styles.goalCard}>
                        {/* Topo verde */}
                        <div className={styles.goalCardHeader}>
                          <div className={styles.goalCardHeaderRow}>
                            <div className={styles.goalCardHeaderContent}>
                              <div className={styles.goalCardTitleRow}>
                                <h3 className={styles.goalCardTitle}>{goal.title}</h3>
                                {goal.progress_type === 'regresso' && (
                                  <span className={styles.goalTypeBadge}>🔄 Reversa</span>
                                )}
                              </div>
                              <p className={styles.goalCardDescription}>
                                {goal.description || 'Meta departamental'}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setGoalToEdit(goal);
                                setEditGoalModalOpen(true);
                              }}
                              className={styles.goalEditButton}
                              type="button"
                              title="Editar Meta"
                            >
                              <svg className={styles.goalEditIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Conteúdo do card */}
                        <div className={styles.goalCardBody}>
                          {/* Informações do trimestre */}
                          <div className={styles.goalStatsGrid}>
                            <div className={styles.goalStatCard}>
                              <div className={styles.goalStatHeader}>
                                <svg className={styles.goalStatIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <h4 className={styles.goalStatTitle}>Departamento</h4>
                              </div>
                              <p className={styles.goalStatText}>
                                <span className={styles.goalStatValue}>
                                  {department?.title || 'Não definido'}
                                </span>
                              </p>
                            </div>

                            <div className={styles.goalStatCard}>
                              <div className={styles.goalStatHeader}>
                                <svg className={styles.goalStatIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <h4 className={styles.goalStatTitle}>Período</h4>
                              </div>
                              <p className={styles.goalStatText}>
                                <span className={styles.goalStatValue}>
                                  {(() => {
                                    const month = new Date(goal.start_date).getMonth() + 1;
                                    if (month <= 3) return '1º Trimestre';
                                    if (month <= 6) return '2º Trimestre';
                                    if (month <= 9) return '3º Trimestre';
                                    return '4º Trimestre';
                                  })()}
                                </span>
                              </p>
                              <p className={styles.goalStatSubtext}>
                                {new Date(goal.start_date).toLocaleDateString()} - {new Date(goal.end_date).toLocaleDateString()}
                              </p>
                            </div>

                            <div className={styles.goalStatCard}>
                              <div className={styles.goalStatHeader}>
                                <svg className={styles.goalStatIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                <h4 className={styles.goalStatTitle}>Progresso</h4>
                              </div>
                              <p className={styles.goalStatText}>
                                <span className={styles.goalStatValue}>
                                  {(() => {
                                    const barraPercent = calcularProgressoMeta(goal.monthlyGoals, goal.calculation_type);
                                    return `${barraPercent.toFixed(1)}%`;
                                  })()}
                                </span>
                              </p>
                              <div className={styles.goalProgressTrack}>
                                {(() => {
                                  const barraPercent = calcularProgressoMeta(goal.monthlyGoals, goal.calculation_type);
                                  const progressClass = getProgressBarClass(barraPercent);
                                  return (
                                    <div
                                      className={`${styles.goalProgressBar} ${progressClass}`}
                                      style={{
                                        width: `${Math.min(Math.round(barraPercent), 100)}%`
                                      }}
                                    />
                                  );
                                })()}
                              </div>
                            </div>

                            <div className={styles.goalStatCard}>
                              <div className={styles.goalStatHeader}>
                                <svg className={styles.goalStatIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                <h4 className={styles.goalStatTitle}>Tipo</h4>
                              </div>
                              <p className={styles.goalStatText}>
                                <span className={styles.goalStatValue}>
                                  {goal.calculation_type === 'media' ? 'Média' : goal.calculation_type === 'inverso' ? 'Inverso' : 'Acumulativa'}
                                </span>
                              </p>
                              <p className={styles.goalStatSubtext}>
                                {goal.indicator_type === 'qtd' ? 'Quantitativo' : goal.indicator_type === 'monetario' ? 'Monetário' : goal.indicator_type === 'percentual' ? 'Percentual' : goal.indicator_type === 'dias' ? 'Dias' : 'Indefinido'}
                              </p>
                            </div>
                          </div>

                          {/* Lista mês a mês */}
                          <div className={styles.goalMonthlySection}>
                            <h4 className={styles.goalMonthlyTitle}>Detalhamento Mensal</h4>
                            <div className={styles.goalMonthlyList}>
                              {(goal.monthlyGoals || [])
                                .slice()
                                .sort((a, b) => new Date(a.start_date).getMonth() - new Date(b.start_date).getMonth())
                                .map((mg, idx) => (
                                  <div key={`${goal.id}-${idx}`} className={styles.goalMonthlyItem}>
                                    <MonthlyGoalRow
                                      goal={mg}
                                      onUpdated={loadGoals}
                                      calculationType={goal.calculation_type}
                                      progressType={goal.progress_type}
                                    />
                                  </div>
                                ))}

                              {/* Adicionar mês */}
                              <div className={styles.goalMonthlyItem}>
                                {addingMonthGoalId === goal.id ? (
                                  <div className={styles.addMonthForm}>
                                    <select
                                      value={newMonth}
                                      onChange={e => setNewMonth(e.target.value)}
                                      className={styles.addMonthSelect}
                                    >
                                      <option value="">Selecionar mês</option>
                                      {getMonthsForGoalTrimester(goal)
                                        .filter(m => !(goal.monthlyGoals || []).some((gm) => new Date(gm.start_date).getMonth() + 1 === m))
                                        .map(m => (
                                          <option key={m} value={m}>{monthNames[m - 1]}</option>
                                        ))}
                                    </select>
                                    <input
                                      type="number"
                                      placeholder="Meta"
                                      value={newValue}
                                      onChange={e => setNewValue(Number(e.target.value))}
                                      className={styles.addMonthInput}
                                    />
                                    <button
                                      onClick={async () => {
                                        if (!newMonth || newValue <= 0) return;
                                        const currentYear = new Date().getFullYear();
                                        const start = new Date(currentYear, parseInt(newMonth, 10) - 1, 1);
                                        const end = new Date(currentYear, parseInt(newMonth, 10), 0);
                                        await apiFetch(`/department-goals/${goal.id}/months`, {
                                          method: 'POST',
                                          body: JSON.stringify({
                                            start_date: start.toISOString(),
                                            end_date: end.toISOString(),
                                            value_goal: newValue,
                                            value_achieved: 0,
                                            status: false,
                                          }),
                                        });
                                        setNewMonth('');
                                        setNewValue(0);
                                        setAddingMonthGoalId(null);
                                        loadGoals();
                                      }}
                                      className={styles.addMonthSave}
                                      type="button"
                                    >
                                      Salvar
                                    </button>
                                    <button
                                      onClick={() => {
                                        setAddingMonthGoalId(null);
                                        setNewMonth('');
                                        setNewValue(0);
                                      }}
                                      className={styles.addMonthCancel}
                                      type="button"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setAddingMonthGoalId(goal.id)}
                                    className={styles.addMonthTrigger}
                                    type="button"
                                  >
                                    <svg className={styles.addMonthIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Adicionar Mês
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <svg className={styles.emptyIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h3 className={styles.emptyTitle}>Nenhuma meta departamental encontrada</h3>
                    <p className={styles.emptyText}>Este departamento ainda não possui metas cadastradas.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}


                 {/* Seção de Reuniões - Apenas para SUPERADMIN, ADMIN e RH */}
        {canViewComponent('meetings') && departmentMeetings.length > 0 && (
          <div className={`${styles.card} ${styles.sectionCard}`}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderLeft}>
                <div className={`${styles.cardIcon} ${styles.meetingsIcon}`}>
                  <svg className={styles.cardIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <h2 className={styles.cardTitle}>Reuniões Relacionadas</h2>
                  <p className={styles.cardSubtitle}>Reuniões com membros do departamento</p>
                </div>
              </div>
              <div className={styles.sectionFilters}>
                <div className={styles.filterSelectMedium}>
                  <Select
                    classNamePrefix="react-select"
                    value={selectedMeetingMonth ? { value: selectedMeetingMonth, label: monthNames[parseInt(selectedMeetingMonth, 10) - 1] } : { value: '', label: 'Todos os meses' }}
                    onChange={(opt) => setSelectedMeetingMonth(opt?.value || null)}
                    options={[
                      { value: '', label: 'Todos os meses' },
                      ...monthNames.map((month, index) => ({ value: (index + 1).toString(), label: month }))
                    ]}
                    placeholder="Filtrar por Mês"
                    styles={selectStyles}
                  />
                </div>

                <div className={styles.filterSelectSmall}>
                  <Select
                    classNamePrefix="react-select"
                    value={selectedMeetingYear ? { value: selectedMeetingYear, label: selectedMeetingYear } : { value: '', label: 'Todos os anos' }}
                    onChange={(opt) => setSelectedMeetingYear(opt?.value || null)}
                    options={[
                      { value: '', label: 'Todos os anos' },
                      { value: '2026', label: '2026' },
                      { value: '2025', label: '2025' },
                      { value: '2024', label: '2024' },
                      { value: '2023', label: '2023' },
                      { value: '2022', label: '2022' },
                      { value: '2021', label: '2021' },
                      ...availableMeetingYears.filter(y => !['2021', '2022', '2023', '2024', '2025', '2026'].includes(y)).map(y => ({ value: y, label: y }))
                    ]}
                    placeholder="Filtrar por Ano"
                    styles={selectStyles}
                  />
                </div>

                <button
                  onClick={() => toggleSection('meetings')}
                  className={styles.sectionToggleButton}
                  type="button"
                  aria-label="Alternar exibição de reuniões"
                >
                  {expandedSections.meetings ? (
                    <ChevronDown className={styles.sectionToggleIcon} />
                  ) : (
                    <ChevronRight className={styles.sectionToggleIcon} />
                  )}
                </button>
              </div>
            </div>

            {expandedSections.meetings && (
              <div className={styles.meetingsList}>
                {filteredMeetingsWithMonth.map((meeting) => (
                  <div key={meeting.id} className={styles.meetingCard}>
                    <div className={styles.meetingHeader}>
                      <div className={styles.meetingHeaderContent}>
                        <h3 className={styles.meetingTitle}>{meeting.title}</h3>
                        <p className={styles.meetingDate}>
                          <svg className={styles.meetingDateIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(meeting.date).toLocaleDateString('pt-BR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        <p className={styles.meetingDescription}>{cleanHtmlContent(meeting.description)}</p>
                      </div>
                    </div>

                    <div className={styles.meetingParticipantsSection}>
                      <h4 className={styles.meetingParticipantsTitle}>Participantes:</h4>
                      <div className={styles.meetingParticipantsList}>
                        {meeting.participants.map((participantId) => {
                          const participant = allUsers.find((u) => u.id === participantId);
                          return participant ? (
                            <div key={`participant-${meeting.id}-${participantId}`} className={styles.participantChip}>
                              <div className={styles.participantAvatar}>
                                {participant.avatar_url ? (
                                  <img
                                    src={participant.avatar_url}
                                    alt={participant.full_name}
                                    className={styles.participantAvatarImage}
                                  />
                                ) : (
                                  <span className={styles.participantAvatarFallback}>
                                    {participant.full_name.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <span className={styles.participantName}>{participant.full_name}</span>
                            </div>
                          ) : (
                            <span key={`unknown-${meeting.id}-${participantId}`} className={styles.participantUnknown}>
                              Desconhecido
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


        {/* Seção de Tarefas - Apenas para SUPERADMIN, ADMIN e RH */}
        {canViewComponent('tasks') && (
          <div className={`${styles.card} ${styles.sectionCard}`}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderLeft}>
                <div className={`${styles.cardIcon} ${styles.tasksIcon}`}>
                  <svg className={styles.cardIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h2 className={styles.cardTitle}>Tarefas do Departamento</h2>
                  <p className={styles.cardSubtitle}>Tarefas atribuídas ao departamento</p>
                </div>
              </div>
              <button
                onClick={() => toggleSection('tasks')}
                className={styles.sectionToggleButton}
                type="button"
                aria-label="Alternar exibição de tarefas"
              >
                {expandedSections.tasks ? (
                  <ChevronDown className={styles.sectionToggleIcon} />
                ) : (
                  <ChevronRight className={styles.sectionToggleIcon} />
                )}
              </button>
            </div>

            {expandedSections.tasks && (
              <>
                <div className={styles.tasksFilters}>
                  <input
                    type="text"
                    placeholder="Buscar por título ou responsável..."
                    className={styles.tasksSearch}
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  />

                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className={styles.tasksSelect}
                  >
                    <option value="">Todos os Status</option>
                    <option value="todo">A Fazer</option>
                    <option value="in_progress">Em Andamento</option>
                    <option value="completed">Concluído</option>
                    <option value="completed_late">Concluído com Atraso</option>
                    <option value="overdue">Atrasado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>

                  <button
                    onClick={() => setFilters({ status: '', search: '' })}
                    className={styles.tasksResetButton}
                    type="button"
                  >
                    Limpar Filtros
                  </button>
                </div>

                {filteredTasks.length > 0 ? (
                  <div className={styles.tasksList}>
                    {filteredTasks.map(task => {
                      const isMultipleTask = task.assignees && task.assignees.length > 0;
                      const isGroupTask = isMultipleTask && task.assignees?.[0]?.assignment_type === 'group';

                      return (
                        <div key={task.id} className={styles.taskCard}>
                          <div className={styles.taskCardContent}>
                            <div className={styles.taskAvatarColumn}>
                              {isMultipleTask ? (
                                <div className={styles.taskAvatarGroup}>
                                  {task.assignees?.slice(0, 3).map((assignee, index) => (
                                    <div key={assignee.id} className={styles.taskAvatarWrapper}>
                                      {assignee.user.avatar_url ? (
                                        <img
                                          src={assignee.user.avatar_url}
                                          alt={assignee.user.full_name}
                                          className={styles.taskAvatarImage}
                                        />
                                      ) : (
                                        <div className={`${styles.taskAvatarFallback} ${styles.taskAvatarFallbackOrange}`}>
                                          <span className={styles.taskAvatarFallbackText}>
                                            {assignee.user.full_name?.charAt(0).toUpperCase() || '?'}
                                          </span>
                                        </div>
                                      )}
                                      {isGroupTask && index === 0 && (
                                        <div className={styles.taskGroupIndicator}>
                                          <svg className={styles.taskGroupIcon} fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                                          </svg>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  {task.assignees && task.assignees.length > 3 && (
                                    <div className={styles.taskOverflowAvatar}>
                                      <span className={styles.taskOverflowText}>+{task.assignees.length - 3}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                task.assignee?.avatar_url ? (
                                  <img
                                    src={task.assignee.avatar_url}
                                    alt={task.assignee.full_name}
                                    className={styles.taskSingleAvatarImage}
                                  />
                                ) : (
                                  <div className={`${styles.taskAvatarFallback} ${styles.taskAvatarFallbackOrange}`}>
                                    <span className={styles.taskAvatarFallbackTextLarge}>
                                      {task.assignee?.full_name?.charAt(0).toUpperCase() || '?'}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>

                            <div className={styles.taskInfo}>
                              <div className={styles.taskTitleRow}>
                                <h3 className={styles.taskTitle}>{task.title}</h3>
                                {isGroupTask && (
                                  <span className={`${styles.taskBadge} ${styles.taskBadgeGroup}`}>
                                    <svg className={styles.taskBadgeIcon} fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                                    </svg>
                                    Grupo
                                  </span>
                                )}
                                {isMultipleTask && !isGroupTask && (
                                  <span className={`${styles.taskBadge} ${styles.taskBadgeMultiple}`}>
                                    <svg className={styles.taskBadgeIcon} fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                    Múltipla
                                  </span>
                                )}
                              </div>
                              <div className={styles.taskMeta}>
                                <span className={styles.taskMetaItem}>
                                  <svg className={styles.taskMetaIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  {isMultipleTask ? (
                                    <span>
                                      {task.assignees?.length} responsável{task.assignees && task.assignees.length > 1 ? 'is' : ''}
                                    </span>
                                  ) : (
                                    task.assignee?.full_name || 'Indefinido'
                                  )}
                                </span>
                                <span className={styles.taskMetaItem}>
                                  <svg className={styles.taskMetaIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  {task.end_date ? new Date(task.end_date).toLocaleDateString() : '—'}
                                </span>
                              </div>
                            </div>

                            <div className={styles.taskStatus}>
                              <span
                                className={styles.taskStatusPill}
                                style={{
                                  backgroundColor: getStatusColor(task.status) + '20',
                                  color: getStatusColor(task.status)
                                }}
                              >
                                <span
                                  className={styles.taskStatusDot}
                                  style={{ backgroundColor: getStatusColor(task.status) }}
                                />
                                {getStatusText(task.status)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <svg className={styles.emptyIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h3 className={styles.emptyTitle}>Nenhuma tarefa encontrada</h3>
                    <p className={styles.emptyText}>Este departamento ainda não possui tarefas atribuídas.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

                {/* Seção de Departamentos Vinculados - Visível para FUNCIONARIO e GESTOR */}
        {canViewComponent('childDepartments') && childDepartments.length > 0 && (
          <div className={`${styles.card} ${styles.sectionCard}`}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderLeft}>
                <div className={`${styles.cardIcon} ${styles.childDepartmentsIcon}`}>
                  <svg className={styles.cardIconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h2 className={styles.cardTitle}>Departamentos Vinculados</h2>
                  <p className={styles.cardSubtitle}>Subdepartamentos vinculados</p>
                </div>
              </div>
              <button
                onClick={() => toggleSection('childDepartments')}
                className={styles.sectionToggleButton}
                type="button"
                aria-label="Alternar exibição de subdepartamentos"
              >
                {expandedSections.childDepartments ? (
                  <ChevronDown className={styles.sectionToggleIcon} />
                ) : (
                  <ChevronRight className={styles.sectionToggleIcon} />
                )}
              </button>
            </div>

            {expandedSections.childDepartments && (
              <div className={styles.childDepartmentsGrid}>
                {childDepartments.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => router.push(`/company/${companyId}/departments/${child.id}`)}
                    className={styles.childDepartmentCard}
                    type="button"
                  >
                    <div className={styles.childDepartmentTitleWrapper}>
                      <h3 className={styles.childDepartmentTitle}>{child.title}</h3>
                    </div>
                    {child.description && (
                      <p className={styles.childDepartmentDescription}>{child.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modais */}
        {editGoalModalOpen && (
          <DepartmentGoalModal
            companyId={companyId ?? ''}
            onClose={() => setEditGoalModalOpen(false)}
            onCreated={() => {
              setEditGoalModalOpen(false);
              setGoalToEdit(null);
              loadGoals();
            }}
            goalToEdit={goalToEdit || undefined}
          />
        )}
          </>
        )}
      </div>
      </div>
    
  );
}
