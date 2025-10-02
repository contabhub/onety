import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { createPortal } from 'react-dom'
import styles from './Sidebar.module.css'
import { LayoutList, Pin, User, Edit3, Sun, RefreshCw, ChevronDown, CheckCircle, FileText } from 'lucide-react'
import EditarPerfil from '../menu/EditarPerfil'


export default function OnboardingSidebar({ currentTab, onChangeTab, tabs, onCollapseChange }) {
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

  const items = useMemo(() => tabs || [
    { key: 'conteudo', label: 'Conteúdo', icon: LayoutList },
    { key: 'provas', label: 'Provas', icon: FileText },
    { key: 'conclusoes', label: 'Conclusões', icon: CheckCircle },
  ], [tabs])


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
        {items.map((t) => (
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


