import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import ThemeToggle from '../menu/ThemeToggle'
import styles from './Topbar.module.css'

export default function Header({ sidebarCollapsed }) {
  const [isLightTheme, setIsLightTheme] = useState(false)
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [moduleName, setModuleName] = useState('')
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

  // Busca nome do módulo a partir do id na rota
  useEffect(() => {
    const id = router.query?.id
    if (!id) return
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    let ignore = false
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/modulos/${id}`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        })
        if (!res.ok) return
        const data = await res.json()
        if (!ignore) setModuleName(data?.nome || data?.name || String(id))
      } catch {
        if (!ignore) setModuleName(String(id))
      }
    }
    load()
    return () => { ignore = true }
  }, [router.query?.id])

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

  return (
    <header className={`${styles.header} ${sidebarCollapsed ? styles.sidebarCollapsed : styles.sidebarExpanded}`}>
      <div className={styles.left}>
        <span className={styles.title}>{moduleName ? `Módulo: ${moduleName}` : 'Onboarding'}</span>
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
      </div>
    </header>
  )
}


