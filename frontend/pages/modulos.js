import Head from 'next/head'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import ThemeToggle from '../components/menu/ThemeToggle'
import styles from '../styles/modulos.module.css'
import { toast } from 'react-toastify'

export default function Modulos() {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modulos, setModulos] = useState([])
  const [empresaName, setEmpresaName] = useState('')
  const [hasLoaded, setHasLoaded] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedModulo, setSelectedModulo] = useState(null)
  const router = useRouter()

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
    const userId = userRaw ? (JSON.parse(userRaw)?.id) : null
    const empresaId = typeof window !== 'undefined' ? localStorage.getItem('selectedEmpresaId') : null
    const empresaNome = typeof window !== 'undefined' ? localStorage.getItem('selectedEmpresaName') : null
    
    const fetchModulos = async () => {
      if (hasLoaded) return // Evita múltiplas execuções
      
      setLoading(true)
      setError('')
      setHasLoaded(true)
      
      try {
        if (!userId) {
          toast.error('Usuário não autenticado', { toastId: 'auth-error' })
          throw new Error('Usuário não autenticado')
        }

        if (!empresaId) {
          toast.error('Empresa não selecionada', { toastId: 'no-company' })
          throw new Error('Empresa não selecionada')
        }
        
        // Busca módulos vinculados à empresa
        const res = await fetch(`${API_URL}/modulos-empresa?empresa_id=${empresaId}&limit=100`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        })
        
        if (!res.ok) {
          toast.error('Erro ao buscar módulos', { toastId: 'fetch-error' })
          throw new Error('Falha ao buscar módulos da empresa')
        }
        
        const data = await res.json()
        const modulosEmpresa = Array.isArray(data?.data) ? data.data : []
        
        if (modulosEmpresa.length === 0) { 
          toast.info('Nenhum módulo encontrado para esta empresa', { toastId: 'no-modulos' })
          setModulos([])
          return 
        }
        
        // Busca detalhes de cada módulo
        const details = await Promise.all(
          modulosEmpresa.map(async (moduloEmpresa) => {
            const r = await fetch(`${API_URL}/modulos/${moduloEmpresa.modulo_id}`, {
              headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            })
            if (!r.ok) return null
            
            const modulo = await r.json()
            
            return {
              ...modulo,
              status: moduloEmpresa.status,
              empresa_id: moduloEmpresa.empresa_id
            }
          })
        )
        
        const validModulos = details.filter(Boolean)
        setModulos(validModulos)
        setEmpresaName(empresaNome || 'Empresa')
        
        // Só mostra toast se houver módulos
        if (validModulos.length > 0) {
          toast.success(`${validModulos.length} módulo(s) encontrado(s)`, {
            toastId: 'modulos-loaded'
          })
        }
        
      } catch (e) {
        toast.error(e.message || 'Erro ao carregar módulos', { toastId: 'load-error' })
        setModulos([])
      } finally {
        setLoading(false)
      }
    }
    
    if (empresaId) {
      fetchModulos()
    }
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return modulos
    return modulos.filter((m) => `${m.nome || m.name || ''}`.toLowerCase().includes(term))
  }, [modulos, search])

  // Define o módulo selecionado quando os módulos são carregados
  useEffect(() => {
    if (filtered.length > 0 && !selectedModulo) {
      setSelectedModulo(filtered[0])
    }
  }, [filtered, selectedModulo])

  // Atualiza o módulo selecionado quando o índice muda
  useEffect(() => {
    if (filtered.length > 0) {
      setSelectedModulo(filtered[currentIndex])
    }
  }, [currentIndex, filtered])

  const getInitials = (name) => {
    if (!name) return 'MD'
    const parts = String(name).trim().split(/\s+/)
    const first = parts[0]?.[0] || ''
    const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
    return (first + last).toUpperCase()
  }

  const handleAccessModulo = (modulo) => {
    // Aqui você pode adicionar a lógica para acessar o módulo
    // Por exemplo: router.push(`/modulo/${modulo.id}`)
    console.log('Acessando módulo:', modulo.nome || modulo.name)
  }

  const nextModulo = () => {
    setCurrentIndex((prev) => (prev + 1) % filtered.length)
  }

  const prevModulo = () => {
    setCurrentIndex((prev) => (prev - 1 + filtered.length) % filtered.length)
  }

  const selectModulo = (modulo, index) => {
    setSelectedModulo(modulo)
    setCurrentIndex(index)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'liberado': return 'var(--onity-color-success)'
      case 'bloqueado': return 'var(--onity-color-error)'
      case 'pendente': return 'var(--onity-color-warning)'
      default: return 'var(--onity-color-border)'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'liberado': return 'Liberado'
      case 'bloqueado': return 'Bloqueado'
      case 'pendente': return 'Pendente'
      default: return 'Desconhecido'
    }
  }

  return (
    <div>
      <Head>
        <title>Módulos - {empresaName}</title>
      </Head>

      <div className={styles.page}>
        <div className={styles.header}>
          <h1>Módulos - {empresaName}</h1>
          <div className={styles.themeWrap}>
            <ThemeToggle />
          </div>
        </div>

        <div className={styles.searchBox}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            placeholder="Buscar módulos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className={styles.loading}>Carregando...</div>
        ) : filtered.length > 0 ? (
          <div className={styles.carouselContainer}>
            {/* Carrossel de módulos */}
            <div className={styles.carousel}>
              <button 
                className={styles.navButton}
                onClick={prevModulo}
                disabled={filtered.length <= 1}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </button>

              <div className={styles.carouselTrack}>
                {filtered.map((m, index) => (
                  <div 
                    key={m.id} 
                    className={`${styles.carouselItem} ${index === currentIndex ? styles.active : ''}`}
                    onClick={() => selectModulo(m, index)}
                  >
                    <div className={styles.card}>
                      <div className={styles.cardHeader}>
                        <div className={styles.badge}>{getInitials(m.nome || m.name)}</div>
                        <div className={styles.title}>{m.nome || m.name}</div>
                      </div>
                      <div className={styles.meta}>
                        <div className={styles.metaItem}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                          </svg>
                          <span>{m.descricao || 'Sem descrição'}</span>
                        </div>
                        <div className={styles.metaItem}>
                          <div 
                            className={styles.statusBadge}
                            style={{ backgroundColor: getStatusColor(m.status) }}
                          >
                            {getStatusText(m.status)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                className={styles.navButton}
                onClick={nextModulo}
                disabled={filtered.length <= 1}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </button>
            </div>

            {/* Indicadores */}
            <div className={styles.indicators}>
              {filtered.map((_, index) => (
                <button
                  key={index}
                  className={`${styles.indicator} ${index === currentIndex ? styles.active : ''}`}
                  onClick={() => setCurrentIndex(index)}
                />
              ))}
            </div>

            {/* Preview do módulo selecionado */}
            {selectedModulo && (
              <div className={styles.previewSection}>
                <div className={styles.previewCard}>
                  <div className={styles.previewHeader}>
                    <h2>{selectedModulo.nome || selectedModulo.name}</h2>
                    <div 
                      className={styles.statusBadge}
                      style={{ backgroundColor: getStatusColor(selectedModulo.status) }}
                    >
                      {getStatusText(selectedModulo.status)}
                    </div>
                  </div>
                  <div className={styles.previewContent}>
                    <p>{selectedModulo.descricao || 'Sem descrição disponível'}</p>
                    <div className={styles.previewPlaceholder}>
                      <div className={styles.placeholderIcon}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                      </div>
                      <h3>Preview do Módulo</h3>
                      <p>Em breve você poderá visualizar o conteúdo do módulo aqui</p>
                    </div>
                    <div className={styles.previewActions}>
                      <button 
                        className={styles.accessBtn}
                        onClick={() => handleAccessModulo(selectedModulo)}
                        disabled={selectedModulo.status === 'bloqueado'}
                      >
                        {selectedModulo.status === 'bloqueado' ? 'Módulo Bloqueado' : 'Acessar Módulo'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.noResults}>
            <p>Nenhum módulo encontrado</p>
          </div>
        )}
      </div>
    </div>
  )
}
