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
  ExternalLink
} from 'lucide-react';
import styles from './PrincipalSidebar.module.css';
import ThemeToggle from '../menu/ThemeToggle';
import EditarPerfil from '../menu/EditarPerfil';

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
  const [userData, setUserData] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [ajustesExpanded, setAjustesExpanded] = useState(false);
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
    if (module) {
      setCurrentModule(module);
      localStorage.setItem('activeModuleId', moduleId);
      
      // Não navega automaticamente - apenas muda o módulo ativo
      // O usuário deve clicar em um item específico para navegar
      setActiveItem(null);
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
          {currentModule.items.map((item) => {
            // Se for o item "ajustes", adicionar funcionalidade de expandir/colapsar
            if (item.id === 'ajustes') {
              return (
                <div key={item.id}>
                  <button
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
                  </button>
                  
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
              <button
                key={item.id}
                className={`${styles.navItem} ${activeItem?.id === item.id ? styles.active : ''}`}
                onClick={(e) => {
                  console.log('Item clicado:', item.label, e);
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
              </button>
            );
          })}
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

      {/* Seção do usuário na parte inferior */}
      <div className={styles.userSection}>
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
      </div>
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
