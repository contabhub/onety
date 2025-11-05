'use client'

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Plus, Printer, GitFork, Grid3X3, List } from 'lucide-react';

import toast from 'react-hot-toast';
import OrganizationChartThin from '../../components/estrategico/OrganizationChartThin';
import OrganizationChartList from '../../components/estrategico/OrganizationChartList';
import OrganizationChartFull from '../../components/estrategico/OrganizationChartFull';
import Select from 'react-select';
import { DepartmentModal } from '../../components/estrategico/DepartmentModal';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';
import styles from '../../styles/estrategico/organization.module.css';

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

// Helper para obter dados do usuário do localStorage
const getUserData = () => {
  try {
    const userData = localStorage.getItem('userData');
    if (userData) {
      return JSON.parse(userData);
    }
    return null;
  } catch {
    return null;
  }
};

// Helper para obter role do usuário (mantendo compatibilidade com o código existente)
const getUserRole = () => {
  try {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const parsed = JSON.parse(userData);
      // Verificar se tem role direto
      if (parsed.role) return parsed.role;
      // Verificar permissões
      const permissoes = parsed.permissoes || {};
      if (permissoes.adm && permissoes.adm.includes('admin')) return 'ADMIN';
      if (permissoes.rh && permissoes.rh.includes('admin')) return 'RH';
      if (permissoes.gestao && permissoes.gestao.includes('admin')) return 'GESTOR';
      return 'FUNCIONARIO';
    }
    return null;
  } catch {
    return null;
  }
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

const loadPdfLibs = async () => {
  const [html2canvas, jsPDF] = await Promise.all([
    import('html2canvas').then(module => module.default),
    import('jspdf').then(module => module.default)
  ]);
  return { html2canvas, jsPDF };
};

function buildDepartmentTree(nodes, performanceData) {
  const nodeMap = new Map();
  const performanceMap = new Map();

  performanceData?.forEach(perf => {
    if (perf?.department_id) {
      performanceMap.set(perf.department_id, perf);
    }
  });

  nodes?.forEach(node => {
    if (!node?.id) return;
    nodeMap.set(node.id, {
      ...node,
      children: [],
      isExpanded: true,
      isEmployeesVisible: false,
      tasks: []
    });
  });

  nodes?.forEach(node => {
    if (node?.parent_id && node?.id) {
      const parent = nodeMap.get(node.parent_id);
      const current = nodeMap.get(node.id);
      if (parent && current && parent.children) {
        parent.children.push(current);
      }
    }
  });

  const rootNodes = Array.from(nodeMap.values())
    .filter(node => !node.parent_id)
    .sort((a, b) => (a.level || 0) - (b.level || 0));
  
  return rootNodes;
}

function flattenDepartments(departments) {
  const result = [];
  function traverse(nodes) {
    nodes.forEach(node => {
      result.push(node);
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    });
  }
  traverse(departments);
  return result;
}

async function loadDepartmentGoalsWithMonths(companyId) {
  try {
    const departmentGoals = await apiFetch(`/estrategico/metas-departamentais/organization?companyId=${companyId}`);
    return departmentGoals;
  } catch (error) {
    console.error('Erro ao carregar metas departamentais:', error);
    return [];
  }
}

export default function OrganizationChart() {
  const router = useRouter();
  // Tentar pegar companyId da URL primeiro, se não tiver, pegar do localStorage
  const companyIdFromUrl = router.isReady ? router.query?.companyId : null;
  const companyIdFromStorage = getEmpresaId();
  const companyId = companyIdFromUrl || companyIdFromStorage;
  
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const canvasContainerRef = useRef(null);
  const [user, setUser] = useState(null);

  const [highlightedDepartment, setHighlightedDepartment] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [globalGoal, setGlobalGoal] = useState(null);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState(null);
  const [deleteTasks, setDeleteTasks] = useState(false);
  const [transferTasks, setTransferTasks] = useState(false);
  const [selectedTransferDepartment, setSelectedTransferDepartment] = useState('');
  const [allDepartments, setAllDepartments] = useState([]);
  const [menuDepartment, setMenuDepartment] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [viewMode, setViewMode] = useState('full');

  useEffect(() => {
    const loadUser = () => {
      const userData = getUserData();
      if (!userData) return;
      
      setUser(userData);
      
      if (companyId) {
        const role = getUserRole();
        setUserRole(role);
      }
    };
    loadUser();
  }, [companyId]);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!companyId) return;
        
        const [response, employeesFromUsers] = await Promise.all([
          apiFetch(`/estrategico/organograma?companyId=${companyId}`),
          apiFetch(`/estrategico/funcionarios?companyId=${companyId}`)
        ]);

        setAllEmployees(employeesFromUsers);

        const nodes = response.map(apiNode => ({
          id: apiNode.id,
          title: apiNode.title,
          parent_id: apiNode.parent_id || null,
          employees: employeesFromUsers.filter(emp => emp.department_id === apiNode.id),
          manager: apiNode.manager ? { 
            id: apiNode.manager.id,
            name: apiNode.manager.full_name, 
            photo: apiNode.manager.avatar_url 
          } : undefined,
          children: [],
          tasks: [],
          isExpanded: true,
          isEmployeesVisible: false
        }));
        
        const departmentPerformance = await apiFetch(`/estrategico/departamentos/performance?companyId=${companyId}`);
        if (!departmentPerformance || !Array.isArray(departmentPerformance)) {
          throw new Error('Resposta inválida da API de performance');
        }
        
        const rootDepartments = buildDepartmentTree(nodes, departmentPerformance);

        const goalsWithMonths = await loadDepartmentGoalsWithMonths(companyId);

        const addAllGoalsToTree = (nodes) => {
          return nodes.map(node => {
            const nodeGoals = goalsWithMonths.filter(g => g.department_id === node.id);
            
            return {
              ...node,
              goals: nodeGoals,
              children: node.children ? addAllGoalsToTree(node.children) : []
            };
          });
        }

        const departmentsWithGoals = addAllGoalsToTree(rootDepartments);
        
        setDepartments(departmentsWithGoals);
        
      } catch  {
        toast.error('Erro ao carregar organograma');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [companyId, selectedYear, selectedMonth]);

  useEffect(() => {
    const loadEmployees = async () => {
      if (!companyId) return;
      try {
        const employees = await apiFetch(`/estrategico/funcionarios?companyId=${companyId}`);
        setAllEmployees(employees || []);
      } catch {
        setAllEmployees([]);
      }
    };
    loadEmployees();
  }, [companyId]);

  const handleAddDepartment = () => {
    setSelectedDepartment(null);
    setIsDepartmentModalOpen(true);
  };

  const handleDeleteDepartment = async (department) => {
    if (department.parent_id === null) {
      toast.error('Departamento raiz não pode ser excluído');
      return;
    }

    try {
      const departmentsResponse = await apiFetch(`/estrategico/organograma?companyId=${companyId}`);
      const allDeptNodes = departmentsResponse.map(apiNode => ({
        id: apiNode.id,
        title: apiNode.title,
        parent_id: apiNode.parent_id || null,
        employees: [],
        children: [],
        tasks: [],
        isExpanded: true,
        isEmployeesVisible: false
      }));
      
      const filteredDepartments = allDeptNodes.filter(dept => dept.id !== department.id);
      setAllDepartments(filteredDepartments);
    } catch (error) {
      console.error('Erro ao carregar departamentos:', error);
      toast.error('Erro ao carregar departamentos');
      return;
    }

    setDepartmentToDelete(department);
    setShowDeleteModal(true);
  };

  const handleSubmitDepartment = async (data) => {
    if (!companyId) return;
    try {
      if (selectedDepartment) {
        const editResponse = await apiFetch(`/estrategico/departamentos/${selectedDepartment.id}`, {
          method: 'PUT',
          body: {
            title: data.title,
            description: data.description,
            manager_id: data.manager_id,
            parent_id: data.parent_id
          }
        });
        
        if (editResponse.error) {
          toast.error(editResponse.error);
          return;
        }
        
        toast.success('Departamento atualizado com sucesso!');
      } else {
        const createResponse = await apiFetch('/estrategico/departamentos', {
          method: 'POST',
          body: {
            companyId,
            title: data.title,
            description: data.description,
            manager_id: data.manager_id,
            parent_id: data.parent_id
          }
        });
        
        if (createResponse.error) {
          toast.error(createResponse.error);
          return;
        }
        
        toast.success('Departamento criado com sucesso!');
      }
      const [response, allEmployees] = await Promise.all([
        apiFetch(`/estrategico/organograma?companyId=${companyId}`),
        apiFetch(`/estrategico/funcionarios?companyId=${companyId}`)
      ]);
      const nodes = response.map(apiNode => ({
        id: apiNode.id,
        title: apiNode.title,
        parent_id: apiNode.parent_id || null,
        employees: allEmployees.filter(emp => emp.department_id === apiNode.id),
        manager: apiNode.manager ? { 
          id: allEmployees.find(emp => emp.full_name === apiNode.manager?.full_name)?.id,
          name: apiNode.manager.full_name, 
          photo: apiNode.manager.avatar_url 
        } : undefined,
        children: [],
        tasks: [],
        isExpanded: true,
        isEmployeesVisible: false
      }));
      const departmentPerformance = await apiFetch(`/estrategico/departamentos/performance?companyId=${companyId}`);
      const rootDepartments = buildDepartmentTree(nodes, departmentPerformance);
      setDepartments(rootDepartments);
      setIsDepartmentModalOpen(false);
      setSelectedDepartment(null);
    } catch {
      toast.error('Erro ao salvar departamento');
    }
  };

  const confirmDeleteDepartment = async () => {
    if (!companyId || !departmentToDelete) return;
    
    if (!deleteTasks && !transferTasks) {
      toast.error('Selecione uma opção para as tarefas: deletar ou transferir');
      return;
    }
    
    if (transferTasks && !selectedTransferDepartment) {
      toast.error('Selecione um departamento para transferir as tarefas');
      return;
    }
    
    try {
      const params = new URLSearchParams({
        companyId: companyId,
        deleteTasks: deleteTasks.toString(),
        transferTasks: transferTasks.toString()
      });
      
      if (transferTasks && selectedTransferDepartment) {
        params.append('transferToDepartment', selectedTransferDepartment);
      }
      
      const response = await apiFetch(`/estrategico/organograma/${departmentToDelete.id}?${params.toString()}`, {
        method: 'DELETE'
      });

      let message = 'Departamento excluído com sucesso!';
      if (response.reorganizedChildren > 0) {
        message += ` ${response.reorganizedChildren} departamentos filhos foram reorganizados automaticamente.`;
      }
      if (response.movedTasks) {
        message += ' Tarefas foram movidas para o departamento pai.';
      }
      if (response.deletedTasks) {
        message += ' Tarefas foram deletadas.';
      }
      if (response.transferredTasks) {
        message += ` Tarefas foram transferidas para o departamento selecionado.`;
      }
      
      toast.success(message);

      const [departmentsResponse, allEmployees] = await Promise.all([
        apiFetch(`/estrategico/organograma?companyId=${companyId}`),
        apiFetch(`/estrategico/funcionarios?companyId=${companyId}`)
      ]);
      const nodes = departmentsResponse.map(apiNode => ({
        id: apiNode.id,
        title: apiNode.title,
        parent_id: apiNode.parent_id || null,
        employees: allEmployees.filter(emp => emp.department_id === apiNode.id),
        manager: apiNode.manager ? {
          id: allEmployees.find(emp => emp.full_name === apiNode.manager?.full_name)?.id,
          name: apiNode.manager.full_name,
          photo: apiNode.manager.avatar_url
        } : undefined,
        children: [],
        tasks: [],
        isExpanded: true,
        isEmployeesVisible: false
      }));
      const departmentPerformance = await apiFetch(`/estrategico/departamentos/performance?companyId=${companyId}`);
      const rootDepartments = buildDepartmentTree(nodes, departmentPerformance);
      setDepartments(rootDepartments);
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error;
        if (apiError.response?.data?.code === 'ROOT_DEPARTMENT_CANNOT_BE_DELETED') {
          toast.error('Departamento raiz não pode ser excluído');
        } else {
          toast.error('Erro ao excluir departamento');
        }
      } else {
        toast.error('Erro ao excluir departamento');
      }
    } finally {
      setShowDeleteModal(false);
      setDepartmentToDelete(null);
      setDeleteTasks(false);
      setTransferTasks(false);
      setSelectedTransferDepartment('');
      setAllDepartments([]);
    }
  };

  const handleNodeClick = (node) => {
    const updateNode = (nodes) => {
      return nodes.map(n => {
        if (n.id === (typeof node === 'string' ? node : node.id)) {
          const newState = !n.isExpanded;
          
          if (!newState) {
            return {
              ...n,
              isExpanded: false,
              children: n.children?.map(child => ({
                ...child,
                isExpanded: false
              }))
            };
          }
          
          return { ...n, isExpanded: true };
        }
        
        if (n.children) {
          return { ...n, children: updateNode(n.children) };
        }
        
        return n;
      });
    };

    setDepartments(prev => updateNode(prev));
  };

  const handlePrint = async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      toast.error('Canvas não encontrado');
      return;
    }
    
    try {
      setIsPrinting(true);
      toast.loading('Gerando PDF...');

      const { jsPDF } = await loadPdfLibs();
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      const a3Width = 420;
      const a3Height = 297;
      const canvasRatio = canvas.height / canvas.width;
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a3'
      });

      let finalWidth = a3Width;
      let finalHeight = a3Width * canvasRatio;
      
      if (finalHeight > a3Height) {
        finalHeight = a3Height;
        finalWidth = a3Height / canvasRatio;
      }

      const marginX = Math.max(0, a3Width - finalWidth) / 2;
      const marginY = Math.max(0, a3Height - finalHeight) / 2;

      pdf.addImage(imgData, 'PNG', marginX, marginY, finalWidth, finalHeight);

      pdf.setProperties({
        title: 'Organograma - Formato A3 Paisagem',
        subject: 'Estrutura Organizacional',
        creator: 'Sistema de Gestão',
        author: 'Empresa Inquebrável',
        keywords: 'organograma, estrutura organizacional'
      });

      const dateStr = new Date().toLocaleDateString('pt-BR');
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Gerado em ${dateStr}`, marginX, a3Height - 5);

      pdf.save('organograma-a3-paisagem.pdf');
      
      toast.dismiss();
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsPrinting(false);
    }
  };

  const searchDepartment = (term) => {
    if (!term.trim()) {
      setHighlightedDepartment(null);
      return;
    }

    const expandParents = (node, targetId, parents = []) => {
      if (node.id === targetId) {
        parents.forEach(parentId => {
          const expandNode = (nodes) =>
            nodes.map(n => n.id === parentId ? { ...n, isExpanded: true } : { ...n, children: n.children ? expandNode(n.children) : [] });
          setDepartments(prev => expandNode(prev));
        });
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (expandParents(child, targetId, [...parents, node.id])) {
            return true;
          }
        }
      }
      return false;
    };

    const findDepartment = (node) => {
      if (node.title.toLowerCase().includes(term.toLowerCase())) {
        expandParents(departments[0], node.id);
        setHighlightedDepartment(node.id);
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (findDepartment(child)) {
            return true;
          }
        }
      }
      return false;
    };

    if (departments[0]) {
      const found = findDepartment(departments[0]);
      if (!found) {
        setHighlightedDepartment(null);
        toast.error('Departamento não encontrado');
      }
    }
  };

  const handleDepartmentTitleClick = (departmentId) => {
     if (!user) {
    toast.error('Usuário não autenticado');
    return;
  }
    if (userRole === 'FUNCIONARIO') {
      const userDepartment = allEmployees.find(emp => emp.id === user.id)?.department_id;
      if (userDepartment !== departmentId) {
        toast.error('Você não tem permissão para acessar este departamento');
        return;
      }
    }
    router.push(`/company/${companyId}/departments/${departmentId}`);
  };

  const getMesesDisponiveis = () => {
    const meses = [
      { value: 1, label: 'Janeiro' },
      { value: 2, label: 'Fevereiro' },
      { value: 3, label: 'Março' },
      { value: 4, label: 'Abril' },
      { value: 5, label: 'Maio' },
      { value: 6, label: 'Junho' },
      { value: 7, label: 'Julho' },
      { value: 8, label: 'Agosto' },
      { value: 9, label: 'Setembro' },
      { value: 10, label: 'Outubro' },
      { value: 11, label: 'Novembro' },
      { value: 12, label: 'Dezembro' }
    ];
    return meses;
  };

  const getAnosDisponiveis = () => {
    const currentYear = new Date().getFullYear();
    const anos = [];
    for (let i = currentYear - 2; i <= currentYear + 2; i++) {
      anos.push({ value: i, label: i.toString() });
    }
    return anos;
  };

  const loadGoals = async () => {
    if (!companyId) return;
    setGoalsLoading(true);
    try {
      const globalGoals = await apiFetch(`/estrategico/metas-globais?companyId=${companyId}`);
      setGlobalGoal(globalGoals?.[0] || null);
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
      toast.error('Erro ao carregar metas');
    } finally {
      setGoalsLoading(false);
    }
  };

  useEffect(() => {
    loadGoals();
  }, [companyId, selectedYear, selectedMonth]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (showMenu) {
        setShowMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showMenu]);

  if (loading || !user || !companyId) {
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
              <div className={styles.headerIcon}>
                <GitFork className="w-8 h-8" style={{ color: '#4f46e5' }} />
              </div>
              <div>
                <h1 className={styles.headerTitle}>Estrutura Organizacional</h1>
              </div>
            </div>
            
            {(userRole === 'SUPERADMIN' || userRole === 'ADMIN' || userRole === 'RH') && (
              <button
                onClick={handleAddDepartment}
                className={styles.addButton}
              >
                <Plus className="w-4 h-4" />
                Novo Departamento
              </button>
            )}
          </div>

          <div className={styles.filtersSection}>
            <div className={styles.filtersRow}>
              <div className={styles.viewModeGroup}>
                <button
                  onClick={() => setViewMode('full')}
                  className={`${styles.viewModeButton} ${
                    viewMode === 'full'
                      ? styles.viewModeButtonActive
                      : styles.viewModeButtonInactive
                  }`}
                >
                  <GitFork className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('thin')}
                  className={`${styles.viewModeButton} ${
                    viewMode === 'thin'
                      ? styles.viewModeButtonActive
                      : styles.viewModeButtonInactive
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`${styles.viewModeButton} ${
                    viewMode === 'list'
                      ? styles.viewModeButtonActive
                      : styles.viewModeButtonInactive
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <div className={styles.filtersControls}>
                <Select
                  value={{ value: selectedMonth, label: getMesesDisponiveis().find(m => m.value === selectedMonth)?.label || '' }}
                  onChange={(option) => setSelectedMonth(option?.value || new Date().getMonth() + 1)}
                  options={getMesesDisponiveis()}
                  placeholder="Mês"
                  className="min-w-[120px]"
                  styles={{
                    control: (base) => ({
                      ...base,
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      boxShadow: 'none',
                      backgroundColor: 'white',
                      minHeight: '36px'
                    }),
                    indicatorSeparator: (base) => ({
                      ...base,
                      backgroundColor: '#d1d5db'
                    }),
                    dropdownIndicator: (base) => ({
                      ...base,
                      color: '#6b7280'
                    })
                  }}
                />
                <Select
                  value={{ value: selectedYear, label: selectedYear.toString() }}
                  onChange={(option) => setSelectedYear(option?.value || new Date().getFullYear())}
                  options={getAnosDisponiveis()}
                  placeholder="Ano"
                  className="min-w-[100px]"
                  styles={{
                    control: (base) => ({
                      ...base,
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      boxShadow: 'none',
                      backgroundColor: 'white',
                      minHeight: '36px'
                    }),
                    indicatorSeparator: (base) => ({
                      ...base,
                      backgroundColor: '#d1d5db'
                    }),
                    dropdownIndicator: (base) => ({
                      ...base,
                      color: '#6b7280'
                    })
                  }}
                />
                
                <button
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className={`${styles.exportButton} ${isPrinting ? styles.exportButtonDisabled : ''}`}
                >
                  <Printer className="w-4 h-4" />
                  {isPrinting ? 'Gerando PDF...' : 'Exportar PDF'}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      <div ref={canvasContainerRef} className={styles.chartContainer}>
        {viewMode === 'thin' && (
          <OrganizationChartThin
            departments={departments}
            onToggleExpand={handleNodeClick}
            onEditDepartment={(node) => {
              setSelectedDepartment(node);
              setIsDepartmentModalOpen(true);
            }}
            onDeleteDepartment={handleDeleteDepartment}
            onDepartmentCardClick={(node) => {
              router.push(`/company/${companyId}/departments/${node.id}`);
            }}
            userRole={userRole}
            user={user}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
          />
        )}
        
        {viewMode === 'list' && (
          <OrganizationChartList
            departments={departments}
            onToggleExpand={handleNodeClick}
            onEditDepartment={(node) => {
              setSelectedDepartment(node);
              setIsDepartmentModalOpen(true);
            }}
            onDeleteDepartment={handleDeleteDepartment}
            onDepartmentCardClick={(node) => {
              router.push(`/company/${companyId}/departments/${node.id}`);
            }}
            userRole={userRole}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
          />
        )}
        
        {viewMode === 'full' && (
          <OrganizationChartFull
            departments={departments}
            highlightedDepartment={highlightedDepartment}
            globalGoal={globalGoal}
            onToggleExpand={handleNodeClick}
            onEditDepartment={(node) => {
              setSelectedDepartment(node);
              setIsDepartmentModalOpen(true);
            }}
            onDeleteDepartment={handleDeleteDepartment}
            userRole={userRole}
            currentUserId={user?.id}
            companyId={companyId}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
          />
        )}
        <DepartmentModal
          isOpen={isDepartmentModalOpen}
          onClose={() => {
            setIsDepartmentModalOpen(false);
            setSelectedDepartment(null);
          }}
          onSubmit={handleSubmitDepartment}
          department={selectedDepartment}
          title={selectedDepartment ? "Editar Departamento" : "Novo Departamento"}
          parentDepartments={flattenDepartments(departments)}
          allEmployees={allEmployees}
          companyId={companyId}
          isEditDisabled={selectedDepartment?.is_system_department ?? false}
        />
        {showMenu && menuDepartment && menuPosition && (
          <div
            className={styles.menu}
            style={{ 
              left: menuPosition.x, 
              top: menuPosition.y,
              position: 'fixed',
              zIndex: 1000
            }}
            onClick={e => e.stopPropagation()}
          >
            {(userRole === 'ADMIN' || 
              userRole === 'SUPERADMIN' || 
              (userRole === 'GESTOR' && menuDepartment.manager?.id === user.id)
            ) && (
              <>
                <button
                  className={`${styles.menuButton} ${styles.menuButtonEdit}`}
                  onClick={() => {
                    setShowMenu(false);
                    const dept = flattenDepartments(departments).find(d => d.id === menuDepartment.id);
                    setSelectedDepartment(dept || menuDepartment);
                    setIsDepartmentModalOpen(true);
                  }}
                >
                  Editar Departamento
                </button>
                <button
                  className={`${styles.menuButton} ${styles.menuButtonDelete}`}
                  onClick={() => {
                    setShowMenu(false);
                    const dept = flattenDepartments(departments).find(d => d.id === menuDepartment.id);
                    handleDeleteDepartment(dept || menuDepartment);
                  }}
                >
                  Excluir Departamento
                </button>
              </>
            )}
          </div>
        )}
        {showDeleteModal && (
          <div className={styles.deleteModalOverlay}>
            <div className={styles.deleteModal}>
              <h2 className={styles.deleteModalTitle}>Excluir Departamento</h2>
              <p className={styles.deleteModalText}>
                Tem certeza que deseja excluir o departamento <strong>"{departmentToDelete?.title}"</strong>?
              </p>
              
              <div className={styles.deleteModalWarning}>
                <p className={styles.deleteModalWarningText}>
                  Esta ação irá:
                  <br />• Reorganizar automaticamente os departamentos filhos
                  <br />• Desvincular todos os membros do departamento
                  <br />• Remover o departamento permanentemente
                </p>
              </div>

              <div className={styles.deleteModalTasks}>
                <h3 className={styles.deleteModalTasksTitle}>O que fazer com as tarefas do departamento?</h3>
                
                <div className={styles.deleteModalTasksOptions}>
                  <label className={styles.deleteModalCheckbox}>
                    <input
                      type="checkbox"
                      checked={deleteTasks}
                      onChange={(e) => {
                        setDeleteTasks(e.target.checked);
                        if (e.target.checked) {
                          setTransferTasks(false);
                          setSelectedTransferDepartment('');
                        }
                      }}
                      className={styles.deleteModalCheckboxInput}
                    />
                    <span className={styles.deleteModalCheckboxLabel}>Deletar todas as tarefas</span>
                  </label>
                  
                  <label className={styles.deleteModalCheckbox}>
                    <input
                      type="checkbox"
                      checked={transferTasks}
                      onChange={(e) => {
                        setTransferTasks(e.target.checked);
                        if (e.target.checked) {
                          setDeleteTasks(false);
                        }
                      }}
                      className={styles.deleteModalCheckboxInput}
                    />
                    <span className={styles.deleteModalCheckboxLabel}>Transferir tarefas para outro departamento</span>
                  </label>
                  
                  {transferTasks && (
                    <div className={styles.deleteModalSelectContainer}>
                      <select
                        value={selectedTransferDepartment}
                        onChange={(e) => setSelectedTransferDepartment(e.target.value)}
                        className={styles.deleteModalSelect}
                      >
                        <option value="">Selecione um departamento</option>
                        {allDepartments.map(dept => (
                          <option key={dept.id} value={dept.id}>
                            {dept.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.deleteModalActions}>
                <button
                  onClick={() => { 
                    setShowDeleteModal(false); 
                    setDepartmentToDelete(null);
                    setDeleteTasks(false);
                    setTransferTasks(false);
                    setSelectedTransferDepartment('');
                    setAllDepartments([]);
                  }}
                  className={`${styles.deleteModalButton} ${styles.deleteModalButtonCancel}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteDepartment}
                  className={`${styles.deleteModalButton} ${styles.deleteModalButtonDelete}`}
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

