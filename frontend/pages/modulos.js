import Head from 'next/head'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import ThemeToggle from '../components/menu/ThemeToggle'
import Header from '../components/menu/Header'
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
  const [carouselRef, setCarouselRef] = useState(null)
  const transitionMs = 380 // transição normal
  const edgeTransitionMs = 750 // transição nas extremidades (último/primeiro)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
    const user = userRaw ? JSON.parse(userRaw) : null
    const userId = user?.id || null
    const empresaId = user?.EmpresaId || user?.empresa?.id || null
    const empresaNome = user?.EmpresaNome || user?.empresa?.nome || null
    
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

  // Ordem desejada dos módulos
  const moduleOrder = [
    'atendimento',
    'comercial', 
    'contratual',
    'financeiro',
    'gestão de processos',
    'auditoria',
    'estrategico'
  ]


  const getModuleLogo = (modulo) => {
    if (modulo?.logo_url) {
      return (
        <img 
          src={modulo.logo_url} 
          alt={`Logo do módulo ${modulo.nome || modulo.name}`}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain',
            borderRadius: 'inherit'
          }}
        />
      )
    }
    
    // Fallback para ícone padrão se não houver logo_url
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    )
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    let filteredModules = modulos
    
    if (term) {
      filteredModules = modulos.filter((m) => `${m.nome || m.name || ''}`.toLowerCase().includes(term))
    }
    
    // Ordena os módulos conforme a ordem especificada
    return filteredModules.sort((a, b) => {
      const nameA = (a.nome || a.name || '').toLowerCase()
      const nameB = (b.nome || b.name || '').toLowerCase()
      
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

  // Itens estendidos para efeito infinito: [cloneLast, ...filtered, cloneFirst]
  const extended = useMemo(() => {
    if (filtered.length <= 1) return filtered
    const first = filtered[0]
    const last = filtered[filtered.length - 1]
    return [last, ...filtered, first]
  }, [filtered])

  const getItemWidth = () => 380 + 40 // largura do item + margin

  const scrollToExtendedIndex = (extIndex, smooth = true) => {
    if (!carouselRef) return
    const itemWidth = getItemWidth()
    const containerWidth = carouselRef.offsetWidth
    const computedStyles = typeof window !== 'undefined' ? window.getComputedStyle(carouselRef) : null
    const paddingLeft = computedStyles ? parseInt(computedStyles.paddingLeft || '0', 10) : 0
    const position = (extIndex * itemWidth + paddingLeft) - (containerWidth / 2) + (itemWidth / 2)
    carouselRef.scrollTo({ left: Math.max(0, position), behavior: smooth ? 'smooth' : 'auto' })
  }

  // Inicializa o scroll no primeiro item real (índice +1 no array estendido)
  useEffect(() => {
    if (extended.length > 0 && carouselRef) {
      const startIndex = filtered.length > 1 ? currentIndex + 1 : currentIndex
      scrollToExtendedIndex(startIndex, false)
    }
  }, [carouselRef, extended])

  const nextModulo = () => {
    if (filtered.length === 0 || isTransitioning) return
    const nextIndex = (currentIndex + 1) % filtered.length
    const goingOver = filtered.length > 1 && currentIndex === filtered.length - 1
    setIsTransitioning(true)
    setCurrentIndex(nextIndex)
    // No array estendido, o próximo real é nextIndex+1; se estourou, passa pelo clone e depois salta
    scrollToExtendedIndex((nextIndex + 1), true)
    if (goingOver) {
      setTimeout(() => {
        // reposiciona silenciosamente no primeiro real
        scrollToExtendedIndex(1, false)
        setIsTransitioning(false)
      }, edgeTransitionMs)
    } else {
      setTimeout(() => setIsTransitioning(false), transitionMs)
    }
  }

  const prevModulo = () => {
    if (filtered.length === 0 || isTransitioning) return
    const prevIndex = (currentIndex - 1 + filtered.length) % filtered.length
    const goingUnder = filtered.length > 1 && currentIndex === 0
    setIsTransitioning(true)
    setCurrentIndex(prevIndex)
    scrollToExtendedIndex((prevIndex + 1), true)
    if (goingUnder) {
      setTimeout(() => {
        // reposiciona silenciosamente no último real
        scrollToExtendedIndex(filtered.length, false)
        setIsTransitioning(false)
      }, edgeTransitionMs)
    } else {
      setTimeout(() => setIsTransitioning(false), transitionMs)
    }
  }

  const selectModulo = (modulo, index, isExtendedIndex = false) => {
    // Se veio de um índice no array estendido, converte para índice real
    const realIndex = isExtendedIndex ? ((index - 1 + filtered.length) % filtered.length) : index
    setSelectedModulo(modulo)
    setCurrentIndex(realIndex)
    scrollToExtendedIndex((realIndex + 1), true)
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
        <Header />
        <div className={styles.header}>
          <h1>Módulos - {empresaName}</h1>
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

               <div 
                 className={styles.carouselTrack}
                 ref={setCarouselRef}
               >
            {extended.map((m, extIndex) => (
                  <div 
                key={`${m.id}-ext-${extIndex}`}
                className={`${styles.carouselItem} ${((extIndex - 1 + filtered.length) % filtered.length) === currentIndex ? styles.active : ''}`}
                onClick={() => selectModulo(m, extIndex, true)}
                  >
                      {((extIndex - 1 + filtered.length) % filtered.length) === currentIndex ? (
                        // Preview expandido quando selecionado
                        <div className={styles.previewCardInline}>
                          <div className={styles.previewHeader}>
                            <div className={styles.moduleIconLarge}>
                              {getModuleLogo(m)}
                            </div>
                            <div className={styles.previewTitle}>
                              <h2>{m.nome || m.name}</h2>
                              <div 
                                className={styles.statusBadge}
                                style={{ backgroundColor: getStatusColor(m.status) }}
                              >
                                {getStatusText(m.status)}
                              </div>
                            </div>
                          </div>
                          <div className={styles.previewContent}>
                            <p>{m.descricao || 'Sem descrição disponível'}</p>
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
                                onClick={() => handleAccessModulo(m)}
                                disabled={m.status === 'bloqueado'}
                              >
                                {m.status === 'bloqueado' ? 'Módulo Bloqueado' : 'Acessar Módulo'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Card normal quando não selecionado
                        <div className={styles.card}>
                          <div className={styles.cardHeader}>
                            <div className={styles.moduleIcon}>
                              {getModuleLogo(m)}
                            </div>
                            <div className={styles.title}>{m.nome || m.name}</div>
                          </div>
                          <div className={styles.meta}>
                            <div className={styles.metaItem}>
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
                      )}
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
                  onClick={() => {
                    setCurrentIndex(index)
                    scrollToExtendedIndex((index + 1), true)
                  }}
                />
              ))}
            </div>

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
