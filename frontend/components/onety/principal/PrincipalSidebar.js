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
  Mic
} from 'lucide-react';
import styles from './PrincipalSidebar.module.css';
import ThemeToggle from '../menu/ThemeToggle';
import EditarPerfil from '../menu/EditarPerfil';

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
      // {
       //  id: 'clients',
        //label: 'Pré-Clientes',
        //icon: <Users size={18} />,
        //route: '/comercial/clients'
      //},
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
        id: 'contratos',
        label: 'Contratos',
        icon: <FileText size={18} />,
        route: '/contratual/contratos'
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
      },
      {
        id: 'documentos',
        label: 'Documentos',
        icon: <FileText size={18} />,
        route: '/contratual/documentos'
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
        label: 'Contas a Pagar',
        icon: <DollarSign size={18} />,
        route: '/financeiro/contas-pagar'
      },
      {
        id: 'contas-receber',
        label: 'Contas a Receber',
        icon: <DollarSign size={18} />,
        route: '/financeiro/contas-receber'
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
        id: 'processos',
        label: 'Processos',
        icon: <Settings size={18} />,
        route: '/gestao-processos/processos'
      },
      {
        id: 'workflows',
        label: 'Workflows',
        icon: <ChevronRight size={18} />,
        route: '/gestao-processos/workflows'
      }
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
        id: 'logs',
        label: 'Logs',
        icon: <Shield size={18} />,
        route: '/auditoria/logs'
      },
      {
        id: 'relatorios',
        label: 'Relatórios',
        icon: <FileText size={18} />,
        route: '/auditoria/relatorios'
      }
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
        id: 'dashboard',
        label: 'Dashboard',
        icon: <Target size={18} />,
        route: '/estrategico/dashboard'
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
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [ajustesExpanded, setAjustesExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();

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

      {/* Bolinhas de Navegação entre Módulos */}
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
          <div className={styles.userDropdown}>
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
    </>
  );
}
