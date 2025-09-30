import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import ThemeToggle from './ThemeToggle'
import EditarPerfil from './EditarPerfil'
import styles from './Header.module.css'

export default function Header() {
  const [isLightTheme, setIsLightTheme] = useState(false)
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Resolve tema
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem('userData')
      const parsed = raw ? JSON.parse(raw) : null
      setUser(parsed)
    } catch {
      setUser(null)
    }
  }, [])

  const handleEditProfile = () => {
    setModalOpen(true)
  }

  const handleLogout = () => {
    try {
      localStorage.removeItem('token')
    } catch {}
    router.push('/login')
  }

  const handleChangeCompany = () => {
    try {
      const raw = localStorage.getItem('userData')
      const parsed = raw ? JSON.parse(raw) : {}
      if (parsed && typeof parsed === 'object') {
        delete parsed.EmpresaId
        delete parsed.EmpresaNome
        if (parsed.empresa) delete parsed.empresa
        localStorage.setItem('userData', JSON.stringify(parsed))
        setUser(parsed)
      }
      // limpeza de chaves legadas
      localStorage.removeItem('selectedEmpresaId')
      localStorage.removeItem('selectedEmpresaName')
    } catch {}
    setMenuOpen(false)
    router.push('/empresa')
  }

  const getInitials = (name) => {
    if (!name) return 'US'
    const parts = String(name).trim().split(/\s+/)
    const first = parts[0]?.[0] || ''
    const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
    return (first + last).toUpperCase()
  }

  const logoSrc = isLightTheme ? '/img/Logo-Onety-Preta.png' : '/img/onety.png'

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <img src={logoSrc} alt="Onety Logo" className={styles.logo} />
      </div>
      <div className={styles.right}>
        <ThemeToggle />
        <div className={styles.user} onClick={() => setMenuOpen((v) => !v)}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user?.nome || user?.name || 'Usuário'} className={styles.avatar} />
          ) : (
            <div className={styles.avatarFallback}>{getInitials(user?.nome || user?.name)}</div>
          )}
          <span className={styles.userName}>{user?.nome || user?.name || user?.email || 'Usuário'}</span>
          <svg className={styles.caret} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        {menuOpen && (
          <div className={styles.dropdown} onMouseLeave={() => setMenuOpen(false)}>
            {router.pathname === '/modulos' && (
              <button className={styles.dropdownItem} onClick={handleChangeCompany}>Trocar de empresa</button>
            )}
            <button className={styles.dropdownItem} onClick={handleEditProfile}>Editar perfil</button>
            <button className={styles.dropdownItem} onClick={handleLogout}>Sair</button>
          </div>
        )}
        <EditarPerfil
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onUpdated={(u) => setUser(u)}
        />
      </div>
    </header>
  )
}


