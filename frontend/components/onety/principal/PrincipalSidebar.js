import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Pin, 
  Sun, 
  MessageSquare, 
  Users, 
  FileText, 
  DollarSign, 
  Settings, 
  Shield, 
  Target,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Edit3,
  RefreshCw,
  User,
  Building2,
  UserCheck,
  Contact,
  Webhook,
  Tag,
  ExternalLink,
  Mic,
  LayoutDashboard,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Upload,
  FileBarChart,
  Package,
  FolderOpen, 
  BarChart3,
  BarChart2
} from 'lucide-react';
import styles from './PrincipalSidebar.module.css';
import ThemeToggle from '../menu/ThemeToggle';
import EditarPerfil from '../menu/EditarPerfil';
import { useWebSocket } from '../../../hooks/useWebSocket';
import CriarModal from '../../gestao/CriarModal';
import NovoClienteModal from '../../gestao/NovoClienteModal';
import NovaTarefaModal from '../../gestao/NovaTarefaModal';

// Registry de módulos com seus itens específicos
const MODULE_REGISTRY = {
  atendimento: {
    id: 'atendimento',
    nome: 'Atendimento',
    icon: <MessageSquare size={20} />,
    logos: {
      light: '/img/atendimento preto.png',
      dark: '/img/atendimento branco.png'
    },
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard size={18} />,
        route: '/atendimento/dashboard'
      },
      {
        id: 'chat',
        label: 'Chat',
        icon: <MessageSquare size={18} />,
        route: '/atendimento/chat'
      },
      {
        id: 'ajustes',
        label: 'Ajustes',
        icon: <Settings size={18} />,
        route: '/atendimento/ajustes'
      }
      ,
      {
        id: 'cargos',
        label: 'Cargos',
        icon: <Users size={18} />,
        route: '/atendimento/ajustes?section=cargos'
      }
    ]
  },
  comercial: {
    id: 'comercial',
    nome: 'Comercial',
    icon: <Users size={20} />,
    logos: {
      light: '/img/Comercial preto.png',
      dark: '/img/Comercial branco.png'
    },
   items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard size={18} />,
        route: '/comercial/dashboard'
      },
      {
        id: 'crm',
        label: 'CRM',
        icon: <Target size={18} />,
        route: '/comercial/crm'
      },
      {
        id: 'vendedor-master',
        label: 'Vendedor Master',
        icon: <Mic size={18} />,
        route: '/comercial/vendedor-master'
      },
      {
        id: 'funis',
        label: 'Funis',
        icon: <FileText size={18} />,
        route: '/comercial/funis'
      },
      {
        id: 'playbooks',
        label: 'Playbooks',
        icon: <FileText size={18} />,
        route: '/comercial/playbooks'
      },
      {
        id: 'tipos-atividades',
        label: 'Atividades',
        icon: <Settings size={18} />,
        route: '/comercial/tipos-de-atividades'
      },
      {
        id: 'cadastro-produtos',
        label: 'Produtos',
        icon: <DollarSign size={18} />,
        route: '/comercial/cadastro-produtos'
      },
      {
        id: 'categorias',
        label: 'Categorias',
        icon: <Tag size={18} />,
        route: '/comercial/categorias'
      }
    ]
  },
  contratual: {
    id: 'contratual',
    nome: 'Contratual',
    icon: <FileText size={20} />,
    logos: {
      light: '/img/Contratual preto.png',
      dark: '/img/Contratual Branco.png'
    },
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard size={18} />,
        route: '/contratual/dashboard'
      },
      {
        id: 'contratos',
        label: 'Contratos',
        icon: <FileText size={18} />,
        route: '/contratual/contratos'
      },
      {
        id: 'documentos',
        label: 'Documentos',
        icon: <FileText size={18} />,
        route: '/contratual/documentos'
      },
      {
        id: 'templates',
        label: 'Templates',
        icon: <FileText size={18} />,
        route: '/contratual/templates'
      },
      {
        id: 'variaveis-personalizadas',
        label: 'Variáveis Personalizadas',
        icon: <Tag size={18} />,
        route: '/contratual/variaveis-personalizadas'
      },
      {
        id: 'signatarios',
        label: 'Signatários',
        icon: <UserCheck size={18} />,
        route: '/contratual/signatarios'
      },
      {
        id: 'contratada',
        label: 'Contratada',
        icon: <Building2 size={18} />,
        route: '/contratual/contratada'
      }
    ]
  },
  financeiro: {
    id: 'financeiro',
    nome: 'Financeiro',
    icon: <DollarSign size={20} />,
    logos: {
      light: '/img/Financeiro Preto.png',
      dark: '/img/Financeiro branco.png'
    },
    items: [
      {
        id: 'contas-pagar',
        label: 'Visão Geral',
        icon: <LayoutDashboard size={18} />,
        route: '/financeiro/visao-geral'
      },
      {
        id: 'cadastros',
        label: 'Cadastros',
        icon: <Users size={18} />,
        route: '/financeiro/clientes'
      },
      {
        id: 'vendas',
        label: 'Vendas',
        icon: <ShoppingCart size={18} />,
        route: '/financeiro/vendas'
      },
      {
        id: 'financeiro',
        label: 'Financeiro',
        icon: <DollarSign size={18} />,
        route: '/financeiro/contas-a-pagar'
      },
      {
        id: 'captura-facil',
        label: 'Captura Fácil',
        icon: <Upload size={18} />,
        route: '/financeiro/captura-facil'
      }
    ]
  },
  'gestão de processos': {
    id: 'gestão de processos',
    nome: 'Gestão de Processos',
    icon: <Settings size={20} />,
    logos: {
      light: '/img/Gestão preto.png',
      dark: '/img/Gestão branco.png'
    },
    items: [
      {
        id: 'departamentos',
        label: 'Departamentos',
        icon: <Building2 size={18} />,
        route: '/gestao/departamentos'
      },
      {
        id: 'cargos',
        label: 'Cargos',
        icon: <Users size={18} />,
        route: '/gestao/cargos'
      },
      {
        id: 'clientes-gestao',
        label: 'Clientes',
        icon: <Users size={18} />,
        route: '/gestao/clientes'
      },
      {
        id: 'obrigacoes',
        label: 'Obrigações',
        icon: <FileText size={18} />,
        route: '/gestao/obrigacoes'
      },
      {
        id: 'processos',
        label: 'Processos',
        icon: <FileText size={18} />,
        route: '/gestao/processos'
      },
      {
        id: 'processos-globais',
        label: 'Processos Globais',
        icon: <FileText size={18} />,
        route: '/gestao/processos-globais'
      },
      {
        id: 'enquete',
        label: 'Enquete',
        icon: <FileText size={18} />,
        route: '/gestao/enquete'
      },
      {
        id: 'parcelamento',
        label: 'Parcelamento',
        icon: <FileBarChart size={18} />,
        route: '/gestao/parcelamento'
      },
      {
        id: 'situacao-fiscal',
        label: 'Situação Fiscal',
        icon: <Shield size={18} />,
        route: '/gestao/situacao-fiscal'
      },
      {
        id: 'certificados',
        label: 'Certificados',
        icon: <FileText size={18} />,
        route: '/gestao/certificados'
      },
      {
        id: 'pdf-layout',
        label: 'PDF Layout',
        icon: <FileText size={18} />,
        route: '/gestao/pdf-layout'
      },
      {
        id: 'relatorios',
        label: 'Relatórios',
        icon: <FileBarChart size={18} />,
        route: '/gestao/relatorios'
      },

    ]
  },
  auditoria: {
    id: 'auditoria',
    nome: 'Auditoria',
    icon: <Shield size={20} />,
    logos: {
      light: '/img/Auditoria Preto.png',
      dark: '/img/Auditoria Branco.png'
    },
    items: [
      {
        id: 'dashboard-simples',
        label: 'Dashboard Simples Nacional',
        icon: <BarChart3 size={18} />,
        route: '/auditoria/dashboard-simples'
      },
      {
        id: 'extrato',
        label: 'Extrato',
        icon: <FileText size={18} />,
        route: '/auditoria/rct-sn'
      },
      {
        id: 'notas-fiscais',
        label: 'Notas Fiscais',
        icon: <FolderOpen size={18} />,
        route: '/auditoria/leitor-xml'
      },
      // Novos atalhos

      {
        id: 'dashboard-normal',
        label: 'Dashboard Regime Normal',
        icon: <Building2 size={18} />,
        route: '/auditoria/dashboard-normal'
      },

      {
        id: 'analisador-entregas',
        label: 'Analisador de Entregas',
        icon: <FileText size={18} />,
        route: '/auditoria/analisador-entregas'
      },
      {
        id: 'analise-obrigacoes',
        label: 'Análise de Obrigações',
        icon: <BarChart2 size={18} />,
        route: '/auditoria/analise-obrigacoes'
      },

      {
        id: 'consolidado',
        label: 'Consolidado Anual',
        icon: <BarChart3 size={18} />,
        route: '/auditoria/consolidado'
      },

    ]
  },
  estratégico: {
    id: 'estratégico',
    nome: 'Estratégico',
    icon: <Target size={20} />,
    logos: {
      light: '/img/Estratégico Preto.png',
      dark: '/img/Estratégico Branco.png'
    },
    items: [
      {
        id: 'organograma',
        label: 'Organograma',
        icon: <Building2 size={18} />,
        route: '/estrategico/organograma'
      },
      {
        id: 'kpis',
        label: 'KPIs',
        icon: <FileBarChart size={18} />,
        route: '/estrategico/kpis'
      },
      {
        id: 'metas',
        label: 'Metas',
        icon: <Target size={18} />,
        route: '/estrategico/metas'
      }
    ]
  }
};

// Mapeamento de chaves do registry para IDs numéricos usados em permissoes_modulos
// Mantém compatibilidade com telas de Cargos e página de Módulos
const MODULE_KEY_TO_NUMERIC_ID = {
  atendimento: 1,
  estratégico: 2,
  comercial: 3,
  'gestão de processos': 4,
  contratual: 5,
  financeiro: 6,
  auditoria: 7,
};

export default function PrincipalSidebar() {
  const [currentModule, setCurrentModule] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [userData, setUserData] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [showLeadsModal, setShowLeadsModal] = useState(false);
  const [selectedNotificationLeads, setSelectedNotificationLeads] = useState([]);
  const [selectedNotificationTitle, setSelectedNotificationTitle] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [criarModalOpen, setCriarModalOpen] = useState(false);
  const [novoClienteModalOpen, setNovoClienteModalOpen] = useState(false);
  const [novoProcessoModalOpen, setNovoProcessoModalOpen] = useState(false);
  const [ajustesExpanded, setAjustesExpanded] = useState(false);
  const [vendasExpanded, setVendasExpanded] = useState(false);
  const [financeiroExpanded, setFinanceiroExpanded] = useState(false);
  const [cadastrosExpanded, setCadastrosExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();
  const { socket } = useWebSocket();

  // Carrega o estado da sidebar do localStorage na inicialização
  useEffect(() => {
    try {
      const savedPinned = localStorage.getItem('sidebarPinned');
      const savedCollapsed = localStorage.getItem('sidebarCollapsed');
      
      if (savedPinned !== null) {
        const isPinned = savedPinned === 'true';
        setPinned(isPinned);
        setCollapsed(!isPinned);
      } else if (savedCollapsed !== null) {
        setCollapsed(savedCollapsed === 'true');
      }
    } catch (error) {
      console.error('Erro ao carregar estado da sidebar:', error);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Salva o estado pinned no localStorage quando mudar
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem('sidebarPinned', pinned.toString());
      } catch (error) {
        console.error('Erro ao salvar estado pinned:', error);
      }
    }
  }, [pinned, isInitialized]);

  // Salva o estado collapsed no localStorage quando mudar (apenas se não estiver pinned)
  useEffect(() => {
    if (isInitialized && !pinned) {
      try {
        localStorage.setItem('sidebarCollapsed', collapsed.toString());
      } catch (error) {
        console.error('Erro ao salvar estado collapsed:', error);
      }
    }
  }, [collapsed, pinned, isInitialized]);

  // Configurações de animação do Framer Motion - SPRING SUAVE
  const container = {
    initial: { opacity: 0 },
    animate: { 
      opacity: 1,
      transition: {
        staggerChildren: 0.06, // Cascata rápida
        delayChildren: 0.1,
      },
    },
    exit: { opacity: 0 }
  };

  const item = {
    initial: { 
      y: 60, 
      opacity: 0,
    },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 640, // Rápido no começo
        damping: 38,    // Desacelera suave
        mass: 0.7       // Responde rápido
      },
    },
    exit: {
      y: -30,
      opacity: 0,
      transition: { 
        duration: 0.2,
        ease: [0.4, 0, 1, 1]
      }
    },
  };

  const logoAnimation = {
    initial: { 
      y: 60, 
      opacity: 0,
    },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 640,
        damping: 38,
        mass: 0.7,
        delay: 0.05 // Logo aparece primeiro
      },
    },
    exit: {
      y: -30,
      opacity: 0,
      transition: { 
        duration: 0.2,
        ease: [0.4, 0, 1, 1]
      }
    },
  };

  const handleMouseEnter = () => {
    setHovered(true);
    if (!pinned) {
      setCollapsed(false);
      document.body.classList.add('has-sidebar');
      document.body.classList.add('sidebar-expanded');
    }
  };
  const handleMouseLeave = () => {
    setHovered(false);
    if (!pinned) {
      setCollapsed(true);
      document.body.classList.remove('sidebar-expanded');
      // mantém has-sidebar enquanto o componente existir
    }
  };
  const handlePin = () => {
    const nextPinned = !pinned;
    setPinned(nextPinned);
    setCollapsed(!nextPinned);
    
    // Ajustar classe do body baseado no estado do pin
    if (nextPinned) {
      document.body.classList.add('has-sidebar');
      document.body.classList.add('sidebar-expanded');
    } else {
      document.body.classList.remove('sidebar-expanded');
    }
  };


  // Garantir que no primeiro carregamento a classe do body esteja correta
  useEffect(() => {
    const applyBodyClass = () => {
      const shouldExpand = pinned || !collapsed;
      document.body.classList.add('has-sidebar');
      if (shouldExpand) {
        document.body.classList.add('sidebar-expanded');
      } else {
        document.body.classList.remove('sidebar-expanded');
      }
    };

    applyBodyClass();
    return () => {
      document.body.classList.remove('sidebar-expanded');
      document.body.classList.remove('has-sidebar');
    };
  }, [collapsed, pinned]);


  // Carrega módulos do localStorage e detecta módulo ativo
  useEffect(() => {
    const loadModules = () => {
      try {
        const userData = localStorage.getItem('userData');
        if (!userData) return;

        const user = JSON.parse(userData);
        const empresaId = user?.EmpresaId || user?.empresa?.id;

        // Carrega todos os módulos disponíveis
        let availableModules = Object.keys(MODULE_REGISTRY).map(key => ({
          id: key,
          ...MODULE_REGISTRY[key]
        }));

        // Verifica permissões: admin/superadmin veem todos; demais filtram por permissoes_modulos
        const isAdmin = Array.isArray(user?.permissoes?.adm) && (
          user.permissoes.adm.includes('admin') || user.permissoes.adm.includes('superadmin')
        );
        if (!isAdmin) {
          const allowedIds = Array.isArray(user?.permissoes_modulos)
            ? user.permissoes_modulos.map((x) => Number(x))
            : [];
          availableModules = availableModules.filter((m) => {
            const numericId = MODULE_KEY_TO_NUMERIC_ID[m.id] ?? -1;
            return allowedIds.includes(numericId);
          });
        }

        setModules(availableModules);

        // Detecta módulo ativo baseado no module_id no localStorage
        const activeModuleId = localStorage.getItem('activeModuleId') || availableModules[0]?.id || 'atendimento';
        const foundModule = availableModules.find(m => m.id === activeModuleId) || availableModules[0] || null;
        
        if (foundModule) {
          setCurrentModule(foundModule);
          // Não define item ativo automaticamente - deixa o usuário escolher
          setActiveItem(null);
        }

      } catch (error) {
        console.error('Erro ao carregar módulos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadModules();
  }, []);

  // Notificações - helpers
  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notificacoes/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(Number(data?.total || 0));
    } catch {}
  };

  const fetchNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notificacoes?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notificacoes/lidas`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCount(0);
      await fetchNotifications();
    } catch {}
  };

  const markOneAsRead = async (id) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notificacoes/${id}/lida`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications((list) => list.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const handleNotificationClick = (notification) => {
    // Verifica se é uma notificação de leads
    if (notification.type === 'leads.upcoming' || notification.type === 'leads.overdue') {
      try {
        // Verifica se data_json já é um objeto ou se precisa ser parseado
        let data;
        if (typeof notification.data_json === 'string') {
          data = JSON.parse(notification.data_json);
        } else {
          data = notification.data_json;
        }
        
        if (data && data.leads && data.leads.length > 0) {
          setSelectedNotificationLeads(data.leads);
          setSelectedNotificationTitle(notification.title);
          setShowLeadsModal(true);
        }
      } catch (error) {
        console.error('Erro ao processar dados da notificação:', error);
        console.error('data_json:', notification.data_json);
        console.error('Tipo do data_json:', typeof notification.data_json);
      }
    } else {
      // Para outros tipos de notificação, mostra modal genérico com detalhes
      setSelectedNotification(notification);
      setShowDetailsModal(true);
    }
  };

  // Polling simples para badge
  useEffect(() => {
    fetchUnreadCount();
    const i = setInterval(fetchUnreadCount, 20000);
    return () => clearInterval(i);
  }, []);

  // Realtime: incrementa badge ao receber notification:new
  useEffect(() => {
    if (!socket) return;
    const handler = (payload) => {
      try {
        setUnreadCount((c) => (isFinite(c) ? c + 1 : 1));
      } catch {}
    };
    socket.on('notification:new', handler);
    return () => {
      socket.off('notification:new', handler);
    };
  }, [socket]);

  // Carregar dados do usuário
  useEffect(() => {
    try {
      const raw = localStorage.getItem('userData');
      const parsed = raw ? JSON.parse(raw) : null;
      setUserData(parsed);
    } catch {
      setUserData(null);
    }
  }, []);

  // Detectar tema (similar ao Sidebar de superadmin)
  useEffect(() => {
    const resolveTheme = () => {
      try {
        const saved = localStorage.getItem('theme');
        const attr = document.documentElement.getAttribute('data-theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || attr || (prefersDark ? 'dark' : 'light');
        setIsLightTheme(theme === 'light');
      } catch {
        setIsLightTheme(false);
      }
    };
    resolveTheme();
    const observer = new MutationObserver(() => resolveTheme());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const onStorage = (e) => { if (e.key === 'theme') resolveTheme(); };
    window.addEventListener('storage', onStorage);
    return () => { observer.disconnect(); window.removeEventListener('storage', onStorage); };
  }, []);

  // Detecta item ativo baseado na rota atual
  useEffect(() => {
    if (!currentModule) return;

    const currentPath = router.pathname;
    const activeItem = currentModule.items.find(item => 
      currentPath.startsWith(item.route)
    );

    if (activeItem) {
      setActiveItem(activeItem);
    } else {
      // Se não há item ativo na rota atual, limpa o item ativo
      setActiveItem(null);
    }
  }, [router.pathname, currentModule]);

  // Detectar seção ativa do submenu de ajustes
  useEffect(() => {
    if (router.pathname === '/atendimento/ajustes' && router.query.section) {
      // Se estamos na página de ajustes e há uma seção específica, expandir o submenu
      setAjustesExpanded(true);
    }
  }, [router.pathname, router.query.section]);

  // Detectar seção ativa do submenu de vendas
  useEffect(() => {
    if (router.pathname === '/financeiro/vendas-e-orcamentos' || router.pathname === '/financeiro/contratos') {
      // Se estamos em uma página de vendas, expandir o submenu
      setVendasExpanded(true);
    }
  }, [router.pathname]);

  // Detectar seção ativa do submenu de financeiro
  useEffect(() => {
    if (
      router.pathname === '/financeiro/outras-contas' ||
      router.pathname === '/financeiro/contas-a-pagar' ||
      router.pathname === '/financeiro/contas-a-receber' ||
      router.pathname === '/financeiro/extrato-movimentacoes' ||
      router.pathname === '/financeiro/fluxo-caixa-mensal' ||
      router.pathname === '/financeiro/categorias' ||
      router.pathname === '/financeiro/centro-custo'
    ) {
      // Se estamos em uma página de financeiro, expandir o submenu
      setFinanceiroExpanded(true);
    }
  }, [router.pathname]);

  // Detectar seção ativa do submenu de cadastros
  useEffect(() => {
    if (
      router.pathname === '/financeiro/clientes' ||
      router.pathname === '/financeiro/produtos'
    ) {
      // Se estamos em uma página de cadastros, expandir o submenu
      setCadastrosExpanded(true);
    }
  }, [router.pathname]);

  const handleModuleChange = (moduleId) => {
    const module = modules.find(m => m.id === moduleId);
    if (module && module.id !== currentModule?.id) {
    
      
      // Inicia a animação
      setIsAnimating(true);
      
      // Muda o módulo após um pequeno delay para permitir a animação de saída
      setTimeout(() => {
        setCurrentModule(module);
        localStorage.setItem('activeModuleId', moduleId);
        setActiveItem(null);
        
        // Finaliza a animação após um delay maior
        setTimeout(() => {
          setIsAnimating(false);
        }, 1200);
      }, 300);
    }
  };

  const handleItemClick = (item) => {
    setActiveItem(item);
    router.push(item.route);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = String(name).trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  };

  const handleEditProfile = () => {
    setModalOpen(true);
    setUserMenuOpen(false);
  };

  const handleLogout = () => {
    setLogoutModalOpen(true);
    setUserMenuOpen(false);
  };

  const confirmLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('userData');
    } catch {}
    setLogoutModalOpen(false);
    router.push('/login');
  };

  const handleChangeCompany = () => {
    setConfirmModalOpen(true);
    setUserMenuOpen(false);
  };

  const confirmChangeCompany = () => {
    try {
      const raw = localStorage.getItem('userData');
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object') {
        delete parsed.EmpresaId;
        delete parsed.EmpresaNome;
        if (parsed.empresa) delete parsed.empresa;
        localStorage.setItem('userData', JSON.stringify(parsed));
        setUserData(parsed);
      }
      localStorage.removeItem('selectedEmpresaId');
      localStorage.removeItem('selectedEmpresaName');
    } catch {}
    setConfirmModalOpen(false);
    router.push('/empresa');
  };

  const handleToggleTheme = () => {
    const input = document.getElementById('onity-theme-switch');
    if (input) {
      input.click();
      return;
    }
    try {
      const current = document.documentElement.getAttribute('data-theme') || (isLightTheme ? 'light' : 'dark');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      setIsLightTheme(next === 'light');
    } catch {}
  };

  const toggleAjustes = () => {
    setAjustesExpanded(!ajustesExpanded);
  };

  const toggleVendas = () => {
    setVendasExpanded(!vendasExpanded);
  };

  const toggleFinanceiro = () => {
    setFinanceiroExpanded(!financeiroExpanded);
  };

  const toggleCadastros = () => {
    setCadastrosExpanded(!cadastrosExpanded);
  };

  // Itens de ajustes
  const ajustesItems = [
    {
      id: 'conta',
      title: 'Conta',
      description: 'Defina seus dados e da sua empresa',
      icon: Building2,
      route: '/atendimento/ajustes?section=conta'
    },
    {
      id: 'canais',
      title: 'Canais de atendimento',
      description: 'Configure seus canais de atendimento',
      icon: MessageSquare,
      route: '/atendimento/ajustes?section=canais'
    },
    {
      id: 'equipes',
      title: 'Equipes',
      description: 'Gerencie suas equipes de atendimento',
      icon: Users,
      route: '/atendimento/ajustes?section=equipes'
    },
    {
      id: 'usuarios',
      title: 'Usuários',
      description: 'Gerencie os usuários da empresa',
      icon: UserCheck,
      route: '/atendimento/ajustes?section=usuarios'
    },
    {
      id: 'contatos',
      title: 'Contatos',
      description: 'Gerencie seus contatos e clientes',
      icon: Contact,
      route: '/atendimento/ajustes?section=contatos'
    },
    {
      id: 'etiquetas',
      title: 'Etiquetas',
      description: 'Crie e gerencie etiquetas de contatos',
      icon: Tag,
      route: '/atendimento/ajustes?section=etiquetas'
    },
    {
      id: 'links-externos',
      title: 'Links Externos',
      description: 'Gerencie links úteis da empresa',
      icon: ExternalLink,
      route: '/atendimento/ajustes?section=links-externos'
    },
    {
      id: 'webhooks',
      title: 'Webhooks',
      description: 'Configure integrações automáticas',
      icon: Webhook,
      route: '/atendimento/ajustes?section=webhooks'
    }
  ];

  // Itens de vendas
  const vendasItems = [
    {
      id: 'vendas-orcamentos',
      title: 'Vendas e orçamentos',
      description: 'Gerencie suas vendas e orçamentos',
      icon: ShoppingCart,
      route: '/financeiro/vendas-e-orcamentos'
    },
    {
      id: 'contratos',
      title: 'Contratos',
      description: 'Gerencie seus contratos',
      icon: FileText,
      route: '/financeiro/contratos'
    }
  ];

  // Itens de cadastros
  const cadastrosItems = [
    {
      id: 'clientes',
      title: 'Clientes',
      description: 'Gerencie seus clientes',
      icon: Users,
      route: '/financeiro/clientes'
    },
    {
      id: 'produtos',
      title: 'Produtos e Serviços',
      description: 'Gerencie produtos e serviços',
      icon: Package,
      route: '/financeiro/produtos'
    }
  ];

  // Itens de financeiro
  const financeiroItems = [
    {
      id: 'outras-contas',
      title: 'Contas',
      description: 'Gerencie suas contas financeiras',
      icon: Settings,
      route: '/financeiro/outras-contas'
    },
    {
      id: 'extrato-movimentacoes',
      title: 'Extrato de movimentações',
      description: 'Visualize extrato de movimentações',
      icon: FileText,
      route: '/financeiro/extrato-movimentacoes'
    },
    {
      id: 'fluxo-caixa-mensal',
      title: 'Fluxo de Caixa Mensal',
      description: 'Acompanhe o fluxo de caixa',
      icon: FileBarChart,
      route: '/financeiro/fluxo-caixa-mensal'
    },
    {
      id: 'categorias-financeiras',
      title: 'Categorias Financeiras',
      description: 'Gerencie categorias e subcategorias',
      icon: Tag,
      route: '/financeiro/categorias'
    },
    {
      id: 'centro-custo',
      title: 'Centros de Custo',
      description: 'Gerencie os centros de custo',
      icon: DollarSign,
      route: '/financeiro/centro-custo'
    }
  ];

  if (loading) {
    return (
      <div className={styles.sidebar}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  if (!currentModule) {
    return (
      <div className={styles.sidebar}>
        <div className={styles.error}>
          <span>Nenhum módulo encontrado</span>
        </div>
      </div>
    );
  }


  return (
    <>
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : styles.expanded}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.topBar}>
        <AnimatePresence mode="wait">
          <motion.div 
            key={`logo-${currentModule?.id}-${collapsed ? 'collapsed' : 'expanded'}`}
            className={styles.logo}
            variants={logoAnimation}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <img
              src={collapsed
                ? '/img/Logo-Onety-Colapsada.png'
                : currentModule?.logos
                  ? (isLightTheme ? currentModule.logos.light : currentModule.logos.dark)
                  : (isLightTheme ? '/img/Logo-Onety-Sidebar-Preta.png' : '/img/Logo-Onety-Sidebar.png')}
              alt={currentModule?.nome || "Onety"}
              className={styles.logoImg}
            />
          </motion.div>
        </AnimatePresence>
        {!collapsed && (
          <button
            className={`${styles.pinButton} ${pinned ? styles.pinned : ''}`}
            onClick={handlePin}
            title={pinned ? 'Desafixar' : 'Fixar'}
          >
            <Pin size={20} />
          </button>
        )}
      </div>


      {/* Itens do Módulo */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={currentModule?.id}
          className={styles.sidebarContent}
          variants={container}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <nav className={styles.nav}>
          {currentModule.items.map((item) => {
            // Se for o item "ajustes", adicionar funcionalidade de expandir/colapsar
            if (item.id === 'ajustes') {
              return (
                <div key={item.id}>
                  <motion.button
                    variants={item}
                    className={`${styles.navItem} ${activeItem?.id === item.id ? styles.active : ''}`}
                    onClick={() => {
                      // Para ajustes, navega diretamente para a página
                      handleItemClick(item);
                    }}
                  >
                    <div className={styles.navItemIcon}>
                      {item.icon}
                    </div>
                    {!collapsed && <span className={styles.navItemLabel}>{item.label}</span>}
                    {!collapsed && (
                      <div 
                        className={styles.expandButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAjustes();
                        }}
                        title={ajustesExpanded ? "Fechar ajustes" : "Abrir ajustes"}
                      >
                        {ajustesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    )}
                  </motion.button>
                  
                  {/* Submenu de ajustes */}
                  {ajustesExpanded && !collapsed && (
                    <div className={styles.submenu}>
                      {ajustesItems.map((ajusteItem) => {
                        const IconComponent = ajusteItem.icon;
                        const isActive = router.query.section === ajusteItem.id;
                        return (
                          <button
                            key={ajusteItem.id}
                            className={`${styles.submenuItem} ${isActive ? styles.active : ''}`}
                            onClick={() => router.push(ajusteItem.route)}
                            title={ajusteItem.description}
                          >
                            <div className={styles.submenuIcon}>
                              <IconComponent size={16} />
                            </div>
                            <div className={styles.submenuContent}>
                              <span className={styles.submenuTitle}>{ajusteItem.title}</span>
                              <span className={styles.submenuDescription}>{ajusteItem.description}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            
            // Se for o item "vendas", adicionar funcionalidade de expandir/colapsar
            if (item.id === 'vendas') {
              // Verifica qual item do submenu está ativo
              const isVendaItemActive = router.pathname === '/financeiro/vendas-e-orcamentos' || router.pathname === '/financeiro/contratos';
              
              return (
                <div key={item.id}>
                  <motion.button
                    variants={item}
                    className={`${styles.navItem} ${isVendaItemActive ? styles.active : ''}`}
                    onClick={() => {
                      // Para vendas, navega diretamente para a primeira opção
                      router.push('/financeiro/vendas-e-orcamentos');
                    }}
                  >
                    <div className={styles.navItemIcon}>
                      {item.icon}
                    </div>
                    {!collapsed && <span className={styles.navItemLabel}>{item.label}</span>}
                    {!collapsed && (
                      <div 
                        className={styles.expandButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVendas();
                        }}
                        title={vendasExpanded ? "Fechar vendas" : "Abrir vendas"}
                      >
                        {vendasExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    )}
                  </motion.button>
                  
                  {/* Submenu de vendas */}
                  {vendasExpanded && !collapsed && (
                    <div className={styles.submenu}>
                      {vendasItems.map((vendaItem) => {
                        const IconComponent = vendaItem.icon;
                        const isActive = router.pathname === vendaItem.route;
                        return (
                          <button
                            key={vendaItem.id}
                            className={`${styles.submenuItem} ${isActive ? styles.active : ''}`}
                            onClick={() => router.push(vendaItem.route)}
                            title={vendaItem.description}
                          >
                            <div className={styles.submenuIcon}>
                              <IconComponent size={16} />
                            </div>
                            <div className={styles.submenuContent}>
                              <span className={styles.submenuTitle}>{vendaItem.title}</span>
                              <span className={styles.submenuDescription}>{vendaItem.description}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            
            // Se for o item "cadastros", adicionar funcionalidade de expandir/colapsar
            if (item.id === 'cadastros') {
              // Verifica qual item do submenu está ativo
              const isCadastroItemActive = router.pathname === '/financeiro/clientes' || router.pathname === '/financeiro/produtos';
              
              return (
                <div key={item.id}>
                  <motion.button
                    variants={item}
                    className={`${styles.navItem} ${isCadastroItemActive ? styles.active : ''}`}
                    onClick={() => {
                      // Para cadastros, navega diretamente para a primeira opção
                      router.push('/financeiro/clientes');
                    }}
                  >
                    <div className={styles.navItemIcon}>
                      {item.icon}
                    </div>
                    {!collapsed && <span className={styles.navItemLabel}>{item.label}</span>}
                    {!collapsed && (
                      <div 
                        className={styles.expandButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCadastros();
                        }}
                        title={cadastrosExpanded ? "Fechar cadastros" : "Abrir cadastros"}
                      >
                        {cadastrosExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    )}
                  </motion.button>
                  
                  {/* Submenu de cadastros */}
                  {cadastrosExpanded && !collapsed && (
                    <div className={styles.submenu}>
                      {cadastrosItems.map((cadastroItem) => {
                        const IconComponent = cadastroItem.icon;
                        const isActive = router.pathname === cadastroItem.route;
                        return (
                          <button
                            key={cadastroItem.id}
                            className={`${styles.submenuItem} ${isActive ? styles.active : ''}`}
                            onClick={() => router.push(cadastroItem.route)}
                            title={cadastroItem.description}
                          >
                            <div className={styles.submenuIcon}>
                              <IconComponent size={16} />
                            </div>
                            <div className={styles.submenuContent}>
                              <span className={styles.submenuTitle}>{cadastroItem.title}</span>
                              <span className={styles.submenuDescription}>{cadastroItem.description}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            
            // Se for o item "financeiro", adicionar funcionalidade de expandir/colapsar
            if (item.id === 'financeiro') {
              // Verifica qual item do submenu está ativo
              const isFinanceiroItemActive = 
                router.pathname === '/financeiro/outras-contas' ||
                router.pathname === '/financeiro/contas-a-pagar' ||
                router.pathname === '/financeiro/contas-a-receber' ||
                router.pathname === '/financeiro/extrato-movimentacoes' ||
                router.pathname === '/financeiro/fluxo-caixa-mensal' ||
                router.pathname === '/financeiro/categorias' ||
                router.pathname === '/financeiro/centro-custo';
              
              return (
                <div key={item.id}>
                  <motion.button
                    variants={item}
                    className={`${styles.navItem} ${isFinanceiroItemActive ? styles.active : ''}`}
                    onClick={() => {
                      // Para financeiro, navega diretamente para a primeira opção
                      router.push('/financeiro/contas-a-pagar');
                    }}
                  >
                    <div className={styles.navItemIcon}>
                      {item.icon}
                    </div>
                    {!collapsed && <span className={styles.navItemLabel}>{item.label}</span>}
                    {!collapsed && (
                      <div 
                        className={styles.expandButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFinanceiro();
                        }}
                        title={financeiroExpanded ? "Fechar financeiro" : "Abrir financeiro"}
                      >
                        {financeiroExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    )}
                  </motion.button>
                  
                  {/* Submenu de financeiro */}
                  {financeiroExpanded && !collapsed && (
                    <div className={styles.submenu}>
                      {financeiroItems.map((financeiroItem) => {
                        const IconComponent = financeiroItem.icon;
                        const isActive = router.pathname === financeiroItem.route;
                        return (
                          <button
                            key={financeiroItem.id}
                            className={`${styles.submenuItem} ${isActive ? styles.active : ''}`}
                            onClick={() => router.push(financeiroItem.route)}
                            title={financeiroItem.description}
                          >
                            <div className={styles.submenuIcon}>
                              <IconComponent size={16} />
                            </div>
                            <div className={styles.submenuContent}>
                              <span className={styles.submenuTitle}>{financeiroItem.title}</span>
                              <span className={styles.submenuDescription}>{financeiroItem.description}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            
            // Para outros itens, renderizar normalmente
            return (
              <motion.button
                key={item.id}
                variants={item}
                className={`${styles.navItem} ${activeItem?.id === item.id ? styles.active : ''}`}
                onClick={(e) => {
                  handleItemClick(item);
                }}
                style={{ 
                  position: 'relative',
                  zIndex: item.id === currentModule.items[0]?.id ? 25 : 10
                }}
              >
                <div className={styles.navItemIcon}>
                  {item.icon}
                </div>
                {!collapsed && <span className={styles.navItemLabel}>{item.label}</span>}
              </motion.button>
            );
          })}
          </nav>
        </motion.div>
      </AnimatePresence>

      {/* Bolinhas de Navegação entre Módulos - só aparecem quando expandida */}
      {!collapsed && (
        <motion.div 
          className={styles.moduleDots}
          variants={container}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <div className={styles.dotsContainer}>
            {modules.map((module) => (
              <motion.button
                key={module.id}
                className={`${styles.dot} ${currentModule?.id === module.id ? styles.active : ''}`}
                onClick={() => handleModuleChange(module.id)}
                title={module.nome}
                aria-label={`Mudar para módulo ${module.nome}`}
                variants={item}
              >
                <div className={styles.dotIcon}>
                  {module.icon}
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Seção do usuário na parte inferior */}
      <motion.div 
        className={styles.userSection}
        variants={item}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <div 
          className={styles.userProfile}
          onClick={() => setUserMenuOpen(!userMenuOpen)}
        >
          <div className={styles.userAvatar}>
            {userData?.avatar_url ? (
              <img src={userData.avatar_url} alt={userData?.nome || userData?.name || 'Usuário'} />
            ) : (
              <div className={styles.avatarFallback}>
                {getInitials(userData?.nome || userData?.name)}
              </div>
            )}
            {unreadCount > 0 && (
              <span className={styles.notificationBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </div>
          {!collapsed && (
            <div className={styles.userInfo}>
              <div className={styles.userName}>
                {userData?.nome || userData?.name || 'Usuário'}
              </div>
              <div className={styles.userRole}>
                {userData?.EmpresaNome || 'Usuário'}
              </div>
            </div>
          )}
          {!collapsed && (
            <ChevronDown size={20} className={`${styles.chevron} ${userMenuOpen ? styles.rotated : ''}`} />
          )}
        </div>

        {/* Dropdown do usuário */}
        {userMenuOpen && !collapsed && (
          <div className={styles.userDropdown} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <button className={styles.dropdownItem} onClick={() => { setNotifModalOpen(true); fetchNotifications(); setTimeout(() => setUserMenuOpen(false), 0); }}>
              <MessageSquare size={20} />
              <span>Notificações {unreadCount > 0 ? `(${unreadCount})` : ''}</span>
            </button>
            <button className={styles.dropdownItem} onClick={() => { setCriarModalOpen(true); setUserMenuOpen(false); }}>
              <Edit3 size={20} />
                <span>Criar Tarefas</span>
            </button>
            <button className={styles.dropdownItem} onClick={handleEditProfile}>
              <Edit3 size={20} />
              <span>Editar Perfil</span>
            </button>
            <div className={styles.dropdownItem} onClick={handleToggleTheme} role="button" tabIndex={0}>
              <Sun size={20} />
              <span>Mudar tema</span>
              <div className={styles.themeToggleSmall}>
                <ThemeToggle />
              </div>
            </div>
            <button className={styles.dropdownItem} onClick={handleChangeCompany}>
              <RefreshCw size={20} />
              <span>Voltar as Empresas</span>
            </button>
            <div className={styles.dropdownDivider} />
            <button className={styles.dropdownItem} onClick={handleLogout}>
              <User size={20} />
              <span>Sair</span>
            </button>
          </div>
        )}
      </motion.div>
    </aside>

    <EditarPerfil
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      onUpdated={(u) => setUserData(u)}
    />

    {/* Criar Modal (atalho rápido) */}
    <CriarModal
      isOpen={criarModalOpen}
      onClose={() => setCriarModalOpen(false)}
      onNovaSolicitacao={() => { setCriarModalOpen(false); setNovoProcessoModalOpen(true); }}
      onNovaSolicitacaoUnica={() => { setCriarModalOpen(false); }}
      onNovoCliente={() => { setCriarModalOpen(false); setNovoClienteModalOpen(true); }}
      onNovaObrigacaoEsporadica={() => { setCriarModalOpen(false); }}
      podeCriarTarefa={true}
      podeCriarCliente={true}
    />

    {/* Novo Cliente Modal */}
    {novoClienteModalOpen && (
      <NovoClienteModal
        onClose={() => setNovoClienteModalOpen(false)}
        onSuccess={() => setNovoClienteModalOpen(false)}
      />
    )}

    {/* Novo Processo (Nova Tarefa) */}
    {novoProcessoModalOpen && (
      <NovaTarefaModal
        onClose={() => setNovoProcessoModalOpen(false)}
      />
    )}

    {/* Modal de confirmação para trocar de empresa */}
    {confirmModalOpen && (
      <div className={styles.modalOverlay}>
        <div className={styles.modal}>
          <h3>Trocar de Empresa</h3>
          <p>Tem certeza que deseja trocar de empresa? Você será redirecionado para a seleção de empresas.</p>
          <div className={styles.modalActions}>
            <button 
              className={styles.modalCancel}
              onClick={() => setConfirmModalOpen(false)}
            >
              Cancelar
            </button>
            <button 
              className={styles.modalConfirm}
              onClick={confirmChangeCompany}
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Modal de confirmação para logout */}
    {logoutModalOpen && (
      <div className={styles.modalOverlay}>
        <div className={styles.modal}>
          <h3>Sair da Conta</h3>
          <p>Tem certeza que deseja sair da sua conta? Você será redirecionado para a tela de login.</p>
          <div className={styles.modalActions}>
            <button 
              className={styles.modalCancel}
              onClick={() => setLogoutModalOpen(false)}
            >
              Cancelar
            </button>
            <button 
              className={styles.modalConfirm}
              onClick={confirmLogout}
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Modal de Notificações */}
    {notifModalOpen && (
      <div className={styles.modalOverlay}>
        <div className={`${styles.modal} ${styles.notificationsModal}`}>
          <div className={styles.notificationsHeader}>
            <h3 className={styles.notificationsTitle}>Notificações</h3>
            <div className={styles.notificationsActions}>
              <button className={styles.modalCancel} onClick={markAllAsRead} disabled={unreadCount === 0}>Marcar todas como lidas</button>
              <button className={styles.modalConfirm} onClick={() => setNotifModalOpen(false)}>Fechar</button>
            </div>
          </div>
          <div className={styles.notificationsMeta}>{unreadCount} não lida(s)</div>
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            {notificationsLoading ? (
              <div style={{ padding: 16 }}>Carregando...</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 16 }}>Sem notificações no momento.</div>
            ) : (
              <table className={styles.notificationsTable}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Título</th>
                    <th>Módulo</th>
                    <th>Quando</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr 
                      key={n.id} 
                      className={`${!n.read_at ? styles.notificationRowUnread : ''} ${styles.notificationRowClickable}`}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <td>{n.read_at ? 'Lida' : 'Nova'}</td>
                      <td>{n.title}</td>
                      <td>{n.module}</td>
                      <td>{new Date(n.created_at).toLocaleString('pt-BR')}</td>
             <td>
               {!n.read_at && (
                 <button 
                   className={styles.notifMarkButton} 
                   onClick={(e) => {
                     e.stopPropagation();
                     markOneAsRead(n.id);
                   }}
                 >
                   Marcar lida
                 </button>
               )}
             </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Modal de Detalhes dos Leads */}
    {showLeadsModal && (
      <div className={styles.modalOverlay} onClick={() => setShowLeadsModal(false)}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>{selectedNotificationTitle}</h3>
            <button 
              className={styles.closeButton} 
              onClick={() => setShowLeadsModal(false)}
            >
              ×
            </button>
          </div>
          <div className={styles.modalContent}>
            <div className={styles.leadsList}>
              {selectedNotificationLeads.map((lead) => (
                <div key={lead.id} className={styles.leadCard}>
                  <div className={styles.leadHeader}>
                    <h4 className={styles.leadName}>{lead.nome}</h4>
                    <span className={`${styles.leadStatus} ${lead.urgente ? styles.urgent : styles.normal}`}>
                      {lead.urgente ? 'Urgente' : 'Normal'}
                    </span>
                  </div>
                  <div className={styles.leadDetails}>
                    <div className={styles.leadInfo}>
                      <span className={styles.leadLabel}>Data Prevista:</span>
                      <span className={styles.leadValue}>
                        {new Date(lead.data_prevista).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {lead.dias_restantes !== undefined && (
                      <div className={styles.leadInfo}>
                        <span className={styles.leadLabel}>Dias Restantes:</span>
                        <span className={`${styles.leadValue} ${lead.dias_restantes <= 0 ? styles.overdue : ''}`}>
                          {lead.dias_restantes <= 0 ? `${Math.abs(lead.dias_restantes)} dias atrasado` : `${lead.dias_restantes} dias`}
                        </span>
                      </div>
                    )}
                    {lead.dias_atraso !== undefined && (
                      <div className={styles.leadInfo}>
                        <span className={styles.leadLabel}>Dias de Atraso:</span>
                        <span className={`${styles.leadValue} ${styles.overdue}`}>
                          {lead.dias_atraso} dias
                        </span>
                      </div>
                    )}
                    {lead.fase_nome && (
                      <div className={styles.leadInfo}>
                        <span className={styles.leadLabel}>Fase:</span>
                        <span className={styles.leadValue}>{lead.fase_nome}</span>
                      </div>
                    )}
                    {lead.responsavel_nome && (
                      <div className={styles.leadInfo}>
                        <span className={styles.leadLabel}>Responsável:</span>
                        <span className={styles.leadValue}>{lead.responsavel_nome}</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.leadActions}>
                    <button 
                      className={styles.viewLeadButton}
                      onClick={() => {
                        setShowLeadsModal(false);
                        router.push(`/comercial/leads/${lead.id}`);
                      }}
                    >
                      Ver Lead
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Modal de Detalhes Genérico */}
    {showDetailsModal && selectedNotification && (
      <div className={styles.modalOverlay} onClick={() => setShowDetailsModal(false)}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>Detalhes da Notificação</h3>
            <button 
              className={styles.closeButton} 
              onClick={() => setShowDetailsModal(false)}
            >
              ×
            </button>
          </div>
           <div className={styles.modalContent}>
             <div className={styles.notificationDetails}>
               {/* Para notificações de mensagem, layout simplificado */}
               {selectedNotification.type === 'lead.message' ? (
                 <>
                   <div className={styles.detailRow}>
                     <span className={styles.detailLabel}>Mensagem:</span>
                     <span className={styles.detailValue}>{selectedNotification.body}</span>
                   </div>
                 </>
               ) : (
                 <>
                   {/* Layout simplificado para outros tipos de notificação */}
                   <div className={styles.detailRow}>
                     <span className={styles.detailLabel}>Título:</span>
                     <span className={styles.detailValue}>{selectedNotification.title}</span>
                   </div>
                   <div className={styles.detailRow}>
                     <span className={styles.detailLabel}>Data de Criação:</span>
                     <span className={styles.detailValue}>
                       {new Date(selectedNotification.created_at).toLocaleString('pt-BR')}
                     </span>
                   </div>
                   <div className={styles.detailRow}>
                     <span className={styles.detailLabel}>Descrição:</span>
                     <span className={styles.detailValue}>{selectedNotification.body}</span>
                   </div>
                 </>
               )}
             </div>
            
             {/* Botões de ação baseados no tipo */}
             <div className={styles.notificationActions}>
               {selectedNotification.type === 'lead.message' ? (
                 <button 
                   className={styles.actionButton}
                   onClick={() => {
                     setShowDetailsModal(false);
                     // Extrai o conversation_id dos dados JSON
                     let route = '/atendimento/chat';
                     if (selectedNotification.data_json) {
                       try {
                         const data = typeof selectedNotification.data_json === 'string' 
                           ? JSON.parse(selectedNotification.data_json) 
                           : selectedNotification.data_json;
                         if (data.conversation_id) {
                           route = `/atendimento/chat?conv=${data.conversation_id}`;
                         }
                       } catch (error) {
                         console.error('Erro ao parsear dados da notificação:', error);
                       }
                     }
                     router.push(route);
                   }}
                 >
                   Ir para Chat
                 </button>
               ) : selectedNotification.type === 'leads.upcoming' || selectedNotification.type === 'leads.overdue' ? (
                 <button 
                   className={styles.actionButton}
                   onClick={() => {
                     setShowDetailsModal(false);
                     router.push('/comercial/crm');
                   }}
                 >
                   Ir para CRM
                 </button>
               ) : selectedNotification.module === 'contratual' ? (
                 <button 
                   className={styles.actionButton}
                   onClick={() => {
                     setShowDetailsModal(false);
                     router.push('/contratual/dashboard');
                   }}
                 >
                   Ir para Contratual
                 </button>
               ) : selectedNotification.module === 'atendimento' ? (
                 <button 
                   className={styles.actionButton}
                   onClick={() => {
                     setShowDetailsModal(false);
                     router.push('/atendimento/dashboard');
                   }}
                 >
                   Ir para Atendimento
                 </button>
               ) : null}
              
              {!selectedNotification.read_at && (
                <button 
                  className={styles.markReadButton}
                  onClick={() => {
                    markOneAsRead(selectedNotification.id);
                    setShowDetailsModal(false);
                  }}
                >
                  Marcar como Lida
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
