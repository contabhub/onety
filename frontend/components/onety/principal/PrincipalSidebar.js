import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
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
  ChevronRight
} from 'lucide-react';
import styles from './PrincipalSidebar.module.css';
import ThemeToggle from '../menu/ThemeToggle';

// Registry de módulos com seus itens específicos
const MODULE_REGISTRY = {
  atendimento: {
    id: 'atendimento',
    nome: 'Atendimento',
    icon: <MessageSquare size={16} />,
    logos: {
      light: '/img/logo-onety-atendimento-preta.png',
      dark: '/img/logo-onety-atendimento-branca.png'
    },
    items: [
      {
        id: 'chat',
        label: 'Chat',
        icon: <MessageSquare size={14} />,
        route: '/atendimento/chat'
      },
      {
        id: 'ajustes',
        label: 'Ajustes',
        icon: <Settings size={14} />,
        route: '/atendimento/ajustes'
      }
    ]
  },
  comercial: {
    id: 'comercial',
    nome: 'Comercial',
    icon: <Users size={16} />,
    logos: {
      light: '/img/logo-onety-comercial-preta.png',
      dark: '/img/logo-onety-comercial-branca.png'
    },
    items: [
      {
        id: 'leads',
        label: 'Leads',
        icon: <Users size={14} />,
        route: '/comercial/leads'
      },
      {
        id: 'vendas',
        label: 'Vendas',
        icon: <Target size={14} />,
        route: '/comercial/vendas'
      }
    ]
  },
  contratual: {
    id: 'contratual',
    nome: 'Contratual',
    icon: <FileText size={16} />,
    logos: {
      light: '/img/modulos/contratual-light.png',
      dark: '/img/modulos/contratual-dark.png'
    },
    items: [
      {
        id: 'contratos',
        label: 'Contratos',
        icon: <FileText size={14} />,
        route: '/contratual/contratos'
      },
      {
        id: 'documentos',
        label: 'Documentos',
        icon: <FileText size={14} />,
        route: '/contratual/documentos'
      }
    ]
  },
  financeiro: {
    id: 'financeiro',
    nome: 'Financeiro',
    icon: <DollarSign size={16} />,
    logos: {
      light: '/img/modulos/financeiro-light.png',
      dark: '/img/modulos/financeiro-dark.png'
    },
    items: [
      {
        id: 'contas-pagar',
        label: 'Contas a Pagar',
        icon: <DollarSign size={14} />,
        route: '/financeiro/contas-pagar'
      },
      {
        id: 'contas-receber',
        label: 'Contas a Receber',
        icon: <DollarSign size={14} />,
        route: '/financeiro/contas-receber'
      }
    ]
  },
  'gestão de processos': {
    id: 'gestão de processos',
    nome: 'Gestão de Processos',
    icon: <Settings size={16} />,
    logos: {
      light: '/img/modulos/gestao-processos-light.png',
      dark: '/img/modulos/gestao-processos-dark.png'
    },
    items: [
      {
        id: 'processos',
        label: 'Processos',
        icon: <Settings size={14} />,
        route: '/gestao-processos/processos'
      },
      {
        id: 'workflows',
        label: 'Workflows',
        icon: <ChevronRight size={14} />,
        route: '/gestao-processos/workflows'
      }
    ]
  },
  auditoria: {
    id: 'auditoria',
    nome: 'Auditoria',
    icon: <Shield size={16} />,
    logos: {
      light: '/img/modulos/auditoria-light.png',
      dark: '/img/modulos/auditoria-dark.png'
    },
    items: [
      {
        id: 'logs',
        label: 'Logs',
        icon: <Shield size={14} />,
        route: '/auditoria/logs'
      },
      {
        id: 'relatorios',
        label: 'Relatórios',
        icon: <FileText size={14} />,
        route: '/auditoria/relatorios'
      }
    ]
  },
  estratégico: {
    id: 'estratégico',
    nome: 'Estratégico',
    icon: <Target size={16} />,
    logos: {
      light: '/img/modulos/estrategico-light.png',
      dark: '/img/modulos/estrategico-dark.png'
    },
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: <Target size={14} />,
        route: '/estrategico/dashboard'
      },
      {
        id: 'metas',
        label: 'Metas',
        icon: <Target size={14} />,
        route: '/estrategico/metas'
      }
    ]
  }
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
  const router = useRouter();

  const handleMouseEnter = () => {
    setHovered(true);
    if (!pinned) setCollapsed(false);
  };
  const handleMouseLeave = () => {
    setHovered(false);
    if (!pinned) setCollapsed(true);
  };
  const handlePin = () => {
    const nextPinned = !pinned;
    setPinned(nextPinned);
    setCollapsed(!nextPinned);
  };


  // Carrega módulos do localStorage e detecta módulo ativo
  useEffect(() => {
    const loadModules = () => {
      try {
        const userData = localStorage.getItem('userData');
        if (!userData) return;

        const user = JSON.parse(userData);
        const empresaId = user?.EmpresaId || user?.empresa?.id;
        
        // Carrega todos os módulos disponíveis independente da empresa
        const availableModules = Object.keys(MODULE_REGISTRY).map(key => ({
          id: key,
          ...MODULE_REGISTRY[key]
        }));

        setModules(availableModules);

        // Detecta módulo ativo baseado no module_id no localStorage
        const activeModuleId = localStorage.getItem('activeModuleId') || 'atendimento';
        const foundModule = availableModules.find(m => m.id === activeModuleId);
        
        if (foundModule) {
          setCurrentModule(foundModule);
          // Define primeiro item como ativo se não houver
          if (foundModule.items.length > 0) {
            setActiveItem(foundModule.items[0]);
          }
        }

      } catch (error) {
        console.error('Erro ao carregar módulos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadModules();
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
    }
  }, [router.pathname, currentModule]);

  const handleModuleChange = (moduleId) => {
    const module = modules.find(m => m.id === moduleId);
    if (module) {
      setCurrentModule(module);
      localStorage.setItem('activeModuleId', moduleId);
      
      // Navega para o primeiro item do módulo
      if (module.items.length > 0) {
        setActiveItem(module.items[0]);
        router.push(module.items[0].route);
      }
    }
  };

  const handleItemClick = (item) => {
    setActiveItem(item);
    router.push(item.route);
  };

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
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : styles.expanded}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.topBar}>
        <div className={styles.logo}>
          <img
            src={collapsed
              ? '/img/Logo-Onety-Colapsada.png'
              : currentModule?.logos
                ? (isLightTheme ? currentModule.logos.light : currentModule.logos.dark)
                : (isLightTheme ? '/img/Logo-Onety-Sidebar-Preta.png' : '/img/Logo-Onety-Sidebar.png')}
            alt={currentModule?.nome || "Onety"}
            className={styles.logoImg}
          />
        </div>
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
      <div className={styles.sidebarContent}>
        <nav className={styles.nav}>
          {currentModule.items.map((item) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${activeItem?.id === item.id ? styles.active : ''}`}
              onClick={() => handleItemClick(item)}
            >
              <div className={styles.navItemIcon}>
                {item.icon}
              </div>
              {!collapsed && <span className={styles.navItemLabel}>{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Bolinhas de Navegação entre Módulos */}
      <div className={styles.moduleDots}>
        <div className={styles.dotsContainer}>
          {modules.map((module) => (
            <button
              key={module.id}
              className={`${styles.dot} ${currentModule?.id === module.id ? styles.active : ''}`}
              onClick={() => handleModuleChange(module.id)}
              title={module.nome}
              aria-label={`Mudar para módulo ${module.nome}`}
            >
              <div className={styles.dotIcon}>
                {module.icon}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Toggle de Tema */}
      <div className={styles.themeSection}>
        <div className={styles.themeButton}>
          {!collapsed && (
              <ThemeToggle />
          )}
        </div>
      </div>
    </aside>
  );
}
