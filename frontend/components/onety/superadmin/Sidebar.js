import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Pin, LayoutDashboard, User, Building2, Edit3, Sun, RefreshCw, ChevronDown } from 'lucide-react'
import styles from './Sidebar.module.css'
import ThemeToggle from '../menu/ThemeToggle'
import EditarPerfil from '../menu/EditarPerfil'

export default function Sidebar({ collapsed, setCollapsed, pinned, setPinned }) {
  const router = useRouter()
  const [hovered, setHovered] = useState(false)
  const [userData, setUserData] = useState(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [isLightTheme, setIsLightTheme] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)

  const handleMouseEnter = () => {
    setHovered(true)
    if (!pinned) setCollapsed(false)
  }
  const handleMouseLeave = () => {
    setHovered(false)
    if (!pinned) setCollapsed(true)
  }
  const handlePin = () => {
    const n = !pinned
    setPinned(n)
    setCollapsed(!n)
  }

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

  // Detectar tema
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

  const handleToggleTheme = () => {
    const input = document.getElementById('onety-theme-switch')
    if (input) {
      input.click()
      return
    }
    try {
      const current = document.documentElement.getAttribute('data-theme') || (isLightTheme ? 'light' : 'dark')
      const next = current === 'light' ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', next)
      localStorage.setItem('theme', next)
      setIsLightTheme(next === 'light')
    } catch {}
  }

  const getInitials = (name) => {
    if (!name) return 'U'
    const parts = String(name).trim().split(/\s+/)
    const first = parts[0]?.[0] || ''
    const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
    return (first + last).toUpperCase()
  }

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

  const items = [
    { name: 'Empresas', icon: <Building2 size={22} />, path: '/superadmin/empresas' },
    { name: 'Usuários', icon: <User size={22} />, path: '/superadmin/usuarios' },
  ]

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
            <button className={`${styles.pinButton} ${pinned ? styles.pinned : ''}`} onClick={handlePin} title={pinned ? 'Desafixar' : 'Fixar'}>
              <Pin size={20} />
            </button>
          )}
        </div>

        <nav className={styles.menu}>
          {items.map((item, idx) => (
            <Link key={item.name + idx} href={item.path} className={styles.menuItem}>
              {item.icon}
              {!collapsed && <span>{item.name}</span>}
            </Link>
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
  )
}


