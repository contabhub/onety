import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { createPortal } from 'react-dom'
import styles from './Sidebar.module.css'
import { LayoutList, Pin, User, Edit3, Sun, RefreshCw, ChevronDown, CheckCircle, FileText, Lock, ChevronRight, PlayCircle, BookOpen, FolderOpen, ChevronUp } from 'lucide-react'
import EditarPerfil from '../menu/EditarPerfil'


export default function OnboardingSidebar({ currentTab, onChangeTab, tabs, onCollapseChange, userRole }) {
  const router = useRouter()
  const [isLightTheme, setIsLightTheme] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [collapsed, setCollapsed] = useState(true) // Estado inicial sempre colapsado
  const [pinned, setPinned] = useState(false) // Estado inicial sempre não fixado
  const [userData, setUserData] = useState(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)
  
  // Estados para a sanfona
  const [expandedModulos, setExpandedModulos] = useState({})
  const [expandedGrupos, setExpandedGrupos] = useState({})
  const [modulosData, setModulosData] = useState([])
  const [loading, setLoading] = useState(true)
  const [acessoGrupos, setAcessoGrupos] = useState({})
  const [accordionScrollRef, setAccordionScrollRef] = useState(null)
  const [accordionExpanded, setAccordionExpanded] = useState(false)

  const handleMouseEnter = () => {
    if (!pinned) setCollapsed(false)
  }
  const handleMouseLeave = () => {
    if (!pinned) setCollapsed(true)
  }
  const handlePin = () => {
    const nextPinned = !pinned
    setPinned(nextPinned)
    setCollapsed(!nextPinned)
  }

  // Função para carregar dados dos módulos e grupos
  const loadModulosData = async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
    const user = userRaw ? JSON.parse(userRaw) : null
    const empresaId = user?.EmpresaId || user?.empresa?.id || null
    const viewerId = user?.id

    if (!empresaId || !viewerId) {
      setLoading(false)
      return
    }

    try {
      // Buscar módulos da empresa
      const modulosRes = await fetch(`${API_URL}/modulos-empresa?empresa_id=${empresaId}&limit=100`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!modulosRes.ok) throw new Error('Falha ao carregar módulos')
      
      const modulosData = await modulosRes.json()
      const modulos = Array.isArray(modulosData?.data) ? modulosData.data : []

      // Para cada módulo, buscar grupos e conteúdos
      const modulosCompletos = await Promise.all(
        modulos.map(async (moduloEmpresa) => {
          // Buscar dados completos do módulo
          const moduloRes = await fetch(`${API_URL}/modulos/${moduloEmpresa.modulo_id}`, {
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
          })
          
          let modulo = moduloEmpresa.modulo || {}
          if (moduloRes.ok) {
            const moduloData = await moduloRes.json()
            modulo = moduloData.data || moduloData || {}
          }

          // Buscar grupos do módulo
          const gruposRes = await fetch(`${API_URL}/empresas-grupos?empresa_id=${empresaId}&modulo_id=${moduloEmpresa.modulo_id}&limit=100`, {
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
          })
          
          let grupos = []
          if (gruposRes.ok) {
            const gruposData = await gruposRes.json()
            grupos = Array.isArray(gruposData?.data) ? gruposData.data : []
          }

          // Para cada grupo, buscar conteúdos
          const gruposComConteudos = await Promise.all(
            grupos.map(async (grupoEmpresa) => {
              // Buscar dados completos do grupo
              const grupoRes = await fetch(`${API_URL}/grupos/${grupoEmpresa.grupo_id}`, {
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
              })
              
              let grupo = grupoEmpresa.grupo || {}
              if (grupoRes.ok) {
                const grupoData = await grupoRes.json()
                grupo = grupoData.data || grupoData || {}
              }

              // Verificar acesso ao grupo
              const acessoRes = await fetch(`${API_URL}/grupos/${grupoEmpresa.grupo_id}/verificar-acesso?empresa_id=${empresaId}&usuario_id=${viewerId}`, {
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
              })
              
              let acesso = { pode_acessar: true }
              if (acessoRes.ok) {
                acesso = await acessoRes.json()
              }

              // Buscar conteúdos do grupo
              const conteudosRes = await fetch(`${API_URL}/empresas-conteudos?empresa_id=${empresaId}&grupo_id=${grupoEmpresa.grupo_id}&limit=100`, {
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
              })
              
              let conteudos = []
              if (conteudosRes.ok) {
                const conteudosData = await conteudosRes.json()
                conteudos = Array.isArray(conteudosData?.data) ? conteudosData.data : []
              }

              // Buscar dados completos dos conteúdos
              const conteudosCompletos = await Promise.all(
                conteudos.map(async (conteudoEmpresa) => {
                  const conteudoRes = await fetch(`${API_URL}/conteudos/${conteudoEmpresa.conteudo_id}`, {
                    headers: { 'Authorization': token ? `Bearer ${token}` : '' }
                  })
                  
                  let conteudo = conteudoEmpresa.conteudo || {}
                  if (conteudoRes.ok) {
                    const conteudoData = await conteudoRes.json()
                    conteudo = conteudoData.data || conteudoData || {}
                  }

                  return {
                    ...conteudoEmpresa,
                    conteudo: conteudo
                  }
                })
              )

              // Ordenar conteúdos por ordem
              conteudosCompletos.sort((a, b) => (a.conteudo?.ordem || 0) - (b.conteudo?.ordem || 0))

              return {
                ...grupoEmpresa,
                grupo: grupo,
                acesso: acesso,
                conteudos: conteudosCompletos,
                progresso: {
                  concluidos: conteudosCompletos.filter(c => c.status === 'concluido').length,
                  total: conteudosCompletos.length,
                  porcentagem: conteudosCompletos.length > 0 ? Math.round((conteudosCompletos.filter(c => c.status === 'concluido').length / conteudosCompletos.length) * 100) : 0
                }
              }
            })
          )

          // Ordenar grupos por ordem
          gruposComConteudos.sort((a, b) => (a.grupo?.ordem || 0) - (b.grupo?.ordem || 0))

          return {
            ...moduloEmpresa,
            modulo: modulo,
            grupos: gruposComConteudos,
            progresso: {
              concluidos: gruposComConteudos.filter(g => g.progresso.porcentagem === 100).length,
              total: gruposComConteudos.length,
              porcentagem: gruposComConteudos.length > 0 ? Math.round((gruposComConteudos.filter(g => g.progresso.porcentagem === 100).length / gruposComConteudos.length) * 100) : 0
            }
          }
        })
      )

      // Ordenar módulos pela ordem definida no modulos.js
      const moduleOrder = [
        'atendimento',
        'comercial', 
        'contratual',
        'financeiro',
        'gestão de processos',
        'auditoria',
        'estratégico'
      ]

      const normalize = (s) => String(s || '').trim().toLowerCase()
      
      modulosCompletos.sort((a, b) => {
        const nameA = normalize(a.modulo?.nome || a.modulo?.name || '')
        const nameB = normalize(b.modulo?.nome || b.modulo?.name || '')
        
        const indexA = moduleOrder.findIndex(order => nameA.includes(order))
        const indexB = moduleOrder.findIndex(order => nameB.includes(order))
        
        // Se ambos estão na lista de ordem, ordena pela posição
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB
        }
        
        // Se apenas A está na lista, A vem primeiro
        if (indexA !== -1) return -1
        
        // Se apenas B está na lista, B vem primeiro
        if (indexB !== -1) return 1
        
        // Se nenhum está na lista, mantém ordem alfabética
        return nameA.localeCompare(nameB)
      })

      setModulosData(modulosCompletos)
    } catch (error) {
      console.error('Erro ao carregar dados dos módulos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Hidratação: carregar estado do localStorage após montagem
  useEffect(() => {
    setIsHydrated(true)
    try {
      const savedCollapsed = localStorage.getItem('sidebarCollapsed')
      const savedPinned = localStorage.getItem('sidebarPinned')
      
      if (savedCollapsed !== null) {
        setCollapsed(JSON.parse(savedCollapsed))
      }
      if (savedPinned !== null) {
        setPinned(JSON.parse(savedPinned))
      }
    } catch {
      // Ignorar erros de localStorage
    }
  }, [])

  // Carregar dados dos módulos quando o componente montar
  useEffect(() => {
    loadModulosData()
  }, [])

  // Detectar URL atual e expandir automaticamente
  useEffect(() => {
    const { id: moduloId, grupoId } = router.query
    
    if (moduloId && grupoId) {
      // Expandir o módulo atual
      setExpandedModulos(prev => ({
        ...prev,
        [moduloId]: true
      }))
      
      // Expandir o grupo atual
      setExpandedGrupos(prev => ({
        ...prev,
        [grupoId]: true
      }))
    }
  }, [router.query])

  // Comunicar mudanças no estado de colapso para o componente pai
  useEffect(() => {
    onCollapseChange?.(collapsed)
  }, [collapsed, onCollapseChange])

  // Persistir estado de colapso no localStorage (apenas após hidratação)
  useEffect(() => {
    if (!isHydrated) return
    try {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(collapsed))
    } catch {
      // Ignorar erros de localStorage
    }
  }, [collapsed, isHydrated])

  // Persistir estado de pin no localStorage (apenas após hidratação)
  useEffect(() => {
    if (!isHydrated) return
    try {
      localStorage.setItem('sidebarPinned', JSON.stringify(pinned))
    } catch {
      // Ignorar erros de localStorage
    }
  }, [pinned, isHydrated])

    // Carregar dados do usuário
    useEffect(() => {
      try {
        const raw = localStorage.getItem('userData')
        const parsed = raw ? JSON.parse(raw) : null
        setUserData(parsed)
      } catch {
        setUserData(null)
      }
    }, [])


    const getInitials = (name) => {
      if (!name) return 'U'
      const parts = String(name).trim().split(/\s+/)
      const first = parts[0]?.[0] || ''
      const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
      return (first + last).toUpperCase()
    }

  useEffect(() => {
    const resolveTheme = () => {
      try {
        const saved = localStorage.getItem('theme')
        const attr = document.documentElement.getAttribute('data-theme')
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        const theme = saved || attr || (prefersDark ? 'dark' : 'light')
        setIsLightTheme(theme === 'light')
      } catch {
        setIsLightTheme(false)
      }
    }
    resolveTheme()
    const observer = new MutationObserver(() => resolveTheme())
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const onStorage = (e) => { if (e.key === 'theme') resolveTheme() }
    window.addEventListener('storage', onStorage)
    return () => { observer.disconnect(); window.removeEventListener('storage', onStorage) }
  }, [])

  const items = useMemo(() => {
    const allItems = tabs || [
    { key: 'conteudo', label: 'Conteúdo', icon: LayoutList },
    { key: 'provas', label: 'Provas', icon: FileText },
    { key: 'conclusoes', label: 'Conclusões', icon: CheckCircle },
    ]
    
    // Filtrar abas baseado no role do usuário
    if (userRole !== 'superadmin') {
      return allItems.filter(item => item.key !== 'provas')
    }
    
    return allItems
  }, [tabs, userRole])


  const handleEditProfile = () => {
    setModalOpen(true)
    setUserMenuOpen(false)
  }

  const handleLogout = () => {
    setLogoutModalOpen(true)
    setUserMenuOpen(false)
  }

  const confirmLogout = () => {
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('userData')
    } catch {}
    setLogoutModalOpen(false)
    router.push('/login')
  }


  const handleChangeCompany = () => {
    setConfirmModalOpen(true)
    setUserMenuOpen(false)
  }

  const confirmChangeCompany = () => {
    try {
      const raw = localStorage.getItem('userData')
      const parsed = raw ? JSON.parse(raw) : {}
      if (parsed && typeof parsed === 'object') {
        delete parsed.EmpresaId
        delete parsed.EmpresaNome
        if (parsed.empresa) delete parsed.empresa
        localStorage.setItem('userData', JSON.stringify(parsed))
        setUserData(parsed)
      }
      localStorage.removeItem('selectedEmpresaId')
      localStorage.removeItem('selectedEmpresaName')
    } catch {}
    setConfirmModalOpen(false)
    router.push('/empresa')
  }

  // Funções para controlar a expansão da sanfona
  const toggleModulo = (moduloId) => {
    setExpandedModulos(prev => ({
      ...prev,
      [moduloId]: !prev[moduloId]
    }))
  }

  const toggleGrupo = (grupoId) => {
    setExpandedGrupos(prev => ({
      ...prev,
      [grupoId]: !prev[grupoId]
    }))
  }

  // Função para navegar para um módulo
  const navigateToModulo = (moduloId) => {
    router.push(`/onboarding/${moduloId}`)
  }

  // Função para navegar para um grupo
  const navigateToGrupo = (moduloId, grupoId) => {
    router.push(`/onboarding/${moduloId}/grupo/${grupoId}`)
  }

  // Função para navegar para um conteúdo
  const navigateToConteudo = (moduloId, grupoId, conteudoId) => {
    // Expandir automaticamente o módulo e grupo
    setExpandedModulos(prev => ({
      ...prev,
      [moduloId]: true
    }))
    setExpandedGrupos(prev => ({
      ...prev,
      [grupoId]: true
    }))
    
    router.push(`/onboarding/${moduloId}/grupo/${grupoId}?conteudo=${conteudoId}`)
  }

  // Função para obter o ícone de status
  const getStatusIcon = (item, tipo) => {
    if (tipo === 'modulo') {
      if (item.progresso.porcentagem === 100) return <CheckCircle size={14} className={styles.statusCompleted} />
      if (item.progresso.porcentagem > 0) return <PlayCircle size={14} className={styles.statusInProgress} />
      return <BookOpen size={14} className={styles.statusNotStarted} />
    }
    
    if (tipo === 'grupo') {
      if (!item.acesso.pode_acessar) return <Lock size={14} className={styles.statusBlocked} />
      if (item.progresso.porcentagem === 100) return <CheckCircle size={14} className={styles.statusCompleted} />
      if (item.progresso.porcentagem > 0) return <PlayCircle size={14} className={styles.statusInProgress} />
      return <FolderOpen size={14} className={styles.statusNotStarted} />
    }
    
    if (tipo === 'conteudo') {
      if (item.status === 'concluido') return <CheckCircle size={12} className={styles.statusCompleted} />
      return <PlayCircle size={12} className={styles.statusNotStarted} />
    }
  }

  // Função para scroll para cima na sanfona
  const scrollAccordionUp = () => {
    if (accordionScrollRef) {
      accordionScrollRef.scrollBy({
        top: -100,
        behavior: 'smooth'
      })
    }
  }

  // Função para alternar o accordion
  const toggleAccordion = () => {
    setAccordionExpanded(!accordionExpanded)
  }

  return (
    <aside
      className={`${styles.aside} ${collapsed ? styles.collapsed : styles.expanded}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.logoBox}>
      <div className={styles.logo}>
          <img
            src={collapsed
              ? '/img/Logo-Onety-Colapsada.png'
              : (isLightTheme ? '/img/Logo-Onety-Sidebar-Preta.png' : '/img/Logo-Onety-Sidebar.png')}
            alt="Onety"
            className={styles.logoImg}
            style={{
              width: collapsed ? 48 : 160,
              height: collapsed ? 48 : 64,
              marginLeft: collapsed ? -3 : 15
            }}
          />
        </div>
        {!collapsed && (
          <button
            className={`${styles.pinButton} ${pinned ? styles.pinned : ''}`}
            onClick={handlePin}
            title={pinned ? 'Desafixar' : 'Fixar'}
          >
            <Pin size={16} />
          </button>
        )}
      </div>
      <nav>
        {/* Aba Conteúdo com seta integrada */}
        <button
          onClick={() => onChangeTab?.('conteudo')}
          className={`${styles.tabButton} ${currentTab === 'conteudo' ? styles.active : ''}`}
        >
          <LayoutList size={18} style={{ marginRight: 8 }} />
          <span>Conteúdo</span>
          <div 
            className={styles.tabArrow}
            onClick={(e) => {
              e.stopPropagation()
              toggleAccordion()
            }}
            title={accordionExpanded ? "Fechar accordion" : "Abrir accordion"}
          >
            {accordionExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {/* Accordion entre Conteúdo e Provas */}
        {accordionExpanded && currentTab === 'conteudo' && (
          <div className={styles.accordionNav}>
            {loading ? (
              <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <span>Carregando...</span>
              </div>
            ) : (
              <div 
                className={styles.accordionContainer}
                ref={setAccordionScrollRef}
              >
                {modulosData.map((modulo) => (
                  <div key={modulo.modulo_id} className={styles.accordionItem}>
                    {/* Cabeçalho do Módulo */}
                    <div 
                      className={`${styles.accordionHeader} ${styles.moduloHeader}`}
                      onClick={() => toggleModulo(modulo.modulo_id)}
                    >
                      <div className={styles.headerLeft}>
                        <ChevronRight 
                          size={16} 
                          className={`${styles.chevron} ${expandedModulos[modulo.modulo_id] ? styles.rotated : ''}`} 
                        />
                        {getStatusIcon(modulo, 'modulo')}
                        <span className={styles.itemTitle}>{modulo.modulo?.nome || 'Módulo'}</span>
                      </div>
                      <div className={styles.progressInfo}>
                        <span className={styles.progressText}>
                          {modulo.progresso.concluidos}/{modulo.progresso.total}
                        </span>
                        <div className={styles.progressBar}>
                          <div 
                            className={styles.progressFill}
                            style={{ width: `${modulo.progresso.porcentagem}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Conteúdo do Módulo (Grupos) */}
                    {expandedModulos[modulo.modulo_id] && (
                      <div className={styles.accordionContent}>
                        {modulo.grupos.map((grupo) => (
                          <div key={grupo.grupo_id} className={styles.accordionItem}>
                            {/* Cabeçalho do Grupo */}
                            <div 
                              className={`${styles.accordionHeader} ${styles.grupoHeader}`}
                              onClick={() => toggleGrupo(grupo.grupo_id)}
                            >
                              <div className={styles.headerLeft}>
                                <ChevronRight 
                                  size={14} 
                                  className={`${styles.chevron} ${expandedGrupos[grupo.grupo_id] ? styles.rotated : ''}`} 
                                />
                                {getStatusIcon(grupo, 'grupo')}
                                <span className={styles.itemTitle}>{grupo.grupo?.nome || 'Grupo'}</span>
                              </div>
                              <div className={styles.progressInfo}>
                                <span className={styles.progressText}>
                                  {grupo.progresso.concluidos}/{grupo.progresso.total}
                                </span>
                                <div className={styles.progressBar}>
                                  <div 
                                    className={styles.progressFill}
                                    style={{ width: `${grupo.progresso.porcentagem}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Conteúdo do Grupo (Conteúdos) */}
                            {expandedGrupos[grupo.grupo_id] && (
                              <div className={styles.accordionContent}>
                                {grupo.conteudos.map((conteudo) => (
                                  <div 
                                    key={conteudo.conteudo_id} 
                                    className={`${styles.accordionItem} ${styles.conteudoItem}`}
                                    onClick={() => navigateToConteudo(modulo.modulo_id, grupo.grupo_id, conteudo.conteudo_id)}
                                  >
                                    <div className={styles.headerLeft}>
                                      {getStatusIcon(conteudo, 'conteudo')}
                                      <span className={styles.itemTitle}>{conteudo.titulo || conteudo.conteudo?.titulo || 'Conteúdo'}</span>
                                    </div>
                                    <div className={styles.progressInfo}>
                                      <div className={styles.statusBadge}>
                                        {conteudo.status === 'concluido' ? 'Concluído' : 'Pendente'}
                                      </div>
                                      {conteudo.status === 'concluido' && (
                                        <div className={styles.progressBar}>
                                          <div className={`${styles.progressFill} ${styles.progressCompleted}`}></div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Demais abas */}
        {items.filter(item => item.key !== 'conteudo').map((t) => (
          <button
            key={t.key}
            onClick={() => onChangeTab?.(t.key)}
            className={`${styles.tabButton} ${currentTab === t.key ? styles.active : ''}`}
          >
            {t.icon ? <t.icon size={18} style={{ marginRight: 8 }} /> : null}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

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
                Superadmin
              </div>
            </div>
          )}
          {!collapsed && (
            <ChevronDown size={16} className={`${styles.chevron} ${userMenuOpen ? styles.rotated : ''}`} />
          )}
        </div>

        {/* Dropdown do usuário */}
        {userMenuOpen && !collapsed && (
          <div className={styles.userDropdown}>
            <button className={styles.dropdownItem} onClick={handleEditProfile}>
              <Edit3 size={16} />
              <span>Editar Perfil</span>
            </button>
            <button className={styles.dropdownItem} onClick={handleChangeCompany}>
              <RefreshCw size={16} />
              <span>Voltar as Empresas</span>
            </button>
            <div className={styles.dropdownDivider} />
            <button className={styles.dropdownItem} onClick={handleLogout}>
              <User size={16} />
              <span>Sair</span>
            </button>
          </div>
        )}
      </div>

      {/* Modais renderizados via Portal fora da sidebar */}
      {typeof window !== 'undefined' && (
        <>
          {modalOpen && createPortal(
            <EditarPerfil
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              onUpdated={(u) => setUserData(u)}
            />,
            document.body
          )}

          {/* Modal de confirmação para trocar de empresa */}
          {confirmModalOpen && createPortal(
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
            </div>,
            document.body
          )}

          {/* Modal de confirmação para logout */}
          {logoutModalOpen && createPortal(
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
            </div>,
            document.body
          )}
        </>
      )}
    </aside>
  )
}


