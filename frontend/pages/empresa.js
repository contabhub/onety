import Head from 'next/head'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import ThemeToggle from '../components/onety/menu/ThemeToggle'
import SpaceLoader from '../components/onety/menu/SpaceLoader'
import Header from '../components/onety/menu/Header'
import bgStyles from '../styles/onety/login.module.css'
import styles from '../styles/onety/empresa.module.css'
import { toast } from 'react-toastify'

export default function Empresa() {
  const [bgSrc, setBgSrc] = useState('/img/Bg-Empresa.jpg')
  const [isLightTheme, setIsLightTheme] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [companies, setCompanies] = useState([])
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isSuperadmin, setIsSuperadmin] = useState(false)
  const router = useRouter()

  const MIN_LOADING_MS = 1000

  useEffect(() => {
    const resolveTheme = () => {
      try {
        const saved = localStorage.getItem('theme')
        const attr = document.documentElement.getAttribute('data-theme')
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        const theme = saved || attr || (prefersDark ? 'dark' : 'light')
        setIsLightTheme(theme === 'light')
        setBgSrc(theme === 'light' ? '/img/Bg-Empresa.jpg' : '/img/Bg-Empresa.jpg')
      } catch {
        setIsLightTheme(false)
        setBgSrc('/img/Bg-Empresa.jpg')
      }
    }
    resolveTheme()
    const observer = new MutationObserver(() => resolveTheme())
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const onStorage = (e) => { if (e.key === 'theme') resolveTheme() }
    window.addEventListener('storage', onStorage)
    return () => { observer.disconnect(); window.removeEventListener('storage', onStorage) }
  }, [])

  // Detecta se é superadmin a partir do token (payload JWT)
  useEffect(() => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      if (!token) return
      const payloadBase64 = token.split('.')[1] || ''
      const payloadJson = payloadBase64 ? atob(payloadBase64) : '{}'
      const payload = JSON.parse(payloadJson)
      const permissoes = payload?.permissoes || {}
      const isSA = Array.isArray(permissoes?.adm) && permissoes.adm.includes('superadmin')
      setIsSuperadmin(!!isSA)
    } catch {
      setIsSuperadmin(false)
    }
  }, [])

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
    const userId = userRaw ? (JSON.parse(userRaw)?.id) : null
    const fetchCompanies = async () => {
      if (hasLoaded) return // Evita múltiplas execuções
      
      setLoading(true)
      setError('')
      setHasLoaded(true)
      const startAt = Date.now()
      
      try {
        if (!userId) {
          toast.error('Usuário não autenticado', { toastId: 'auth-error' })
          throw new Error('Usuário não autenticado')
        }
        
        // 1) Busca vínculos usuario-empresa
        const resLinks = await fetch(`${API_URL}/usuarios-empresas?usuario_id=${userId}&limit=100`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        })
        
        if (!resLinks.ok) {
          toast.error('Erro ao buscar empresas', { toastId: 'fetch-error' })
          throw new Error('Falha ao buscar vínculos de empresas')
        }
        
        const linksData = await resLinks.json()
        const links = Array.isArray(linksData?.data) ? linksData.data : []
        const empresaIds = [...new Set(links.map((l) => l.empresa_id).filter(Boolean))]
        
        if (empresaIds.length === 0) { 
          toast.info('Nenhuma empresa encontrada', { toastId: 'no-companies' })
          setCompanies([])
          return 
        }
        
        // 2) Busca detalhes de cada empresa com contagem de membros
        const details = await Promise.all(
          empresaIds.map(async (id) => {
            const r = await fetch(`${API_URL}/empresas/${id}`, {
              headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            })
            if (!r.ok) return null
            
            const empresa = await r.json()
            
            // Busca contagem de membros
            const membersRes = await fetch(`${API_URL}/usuarios-empresas/count/${id}`, {
              headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            })
            const membersData = membersRes.ok ? await membersRes.json() : { membros: 0 }
            
            return {
              ...empresa,
              membros: membersData.membros
            }
          })
        )
        
        const validCompanies = details.filter(Boolean)
        setCompanies(validCompanies)
        
        // Só mostra toast se houver empresas
        if (validCompanies.length > 0) {
          toast.success(`${validCompanies.length} empresa(s) encontrada(s)`, {
            toastId: 'companies-loaded'
          })
        }
        
      } catch (e) {
        toast.error(e.message || 'Erro ao carregar empresas', { toastId: 'load-error' })
        setCompanies([])
      } finally {
        const elapsed = Date.now() - startAt
        const remaining = Math.max(0, MIN_LOADING_MS - elapsed)
        setTimeout(() => setLoading(false), remaining)
      }
    }
    fetchCompanies()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return companies
    return companies.filter((c) => `${c.nome || c.name || ''}`.toLowerCase().includes(term))
  }, [companies, search])

  const getInitials = (name) => {
    if (!name) return 'NA'
    const parts = String(name).trim().split(/\s+/)
    const first = parts[0]?.[0] || ''
    const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
    return (first + last).toUpperCase()
  }

  const handleAccessCompany = (company) => {
    // Atualiza o userData no localStorage com a empresa selecionada
    try {
      const userRaw = localStorage.getItem('userData')
      const user = userRaw ? JSON.parse(userRaw) : {}
      const updated = {
        ...user,
        EmpresaId: company.id,
        EmpresaNome: company.nome || company.name
      }
      localStorage.setItem('userData', JSON.stringify(updated))
    } catch {
      // Se falhar o parse/serialize, segue o fluxo de navegação
    }
    router.push('/modulos')
  }

  return (
    <div>
      <Head>
        <title>Escolha sua Empresa</title>
      </Head>

      <div className={bgStyles.background}>
        <div className={bgStyles.videoContainer}>
          <img src={bgSrc} alt="Background GIF" className={bgStyles.videoBackground} style={{ opacity: isLightTheme ? 0.7 : 0.35 }} />
        </div>

        <div className={styles.page}>
          <Header />
          <div className={styles.header}>
            <h1>Escolha sua Empresa</h1>
          </div>

          <div className={styles.searchRow}>
            <div className={styles.searchBox}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
              <input
                placeholder="Buscar empresas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {isSuperadmin && (
              <button
                className={styles.controlBtn}
                onClick={() => router.push('/superadmin')}
                type="button"
              >
                Painel de Controle
              </button>
            )}
          </div>


          <div className={`${styles.grid} ${filtered.length === 1 ? styles.single : ''}`}>
            {loading ? (
              <SpaceLoader label="Carregando empresas..." />
            ) : (
              filtered.map((c) => (
                <div key={c.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div className={styles.badge}>{getInitials(c.nome || c.name)}</div>
                    <div className={styles.title}>{c.nome || c.name}</div>
                  </div>
                  <div className={styles.meta}>
                    <div className={styles.metaItem}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <span>{c.membros ?? c.members ?? 0} membros</span>
                    </div>
                  </div>
                  <div className={styles.cardFooter}>
                    <button 
                      className={styles.accessBtn}
                      onClick={() => handleAccessCompany(c)}
                    >
                      Acessar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


