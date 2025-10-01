import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import styles from './ConclusoesList.module.css'
import SpaceLoader from '../menu/SpaceLoader'
import { CheckCircle, FolderOpen } from 'lucide-react'

export default function ConclusoesList({ moduloId }) {
  const router = useRouter()
  const [conclusoes, setConclusoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (moduloId) {
      loadConclusoes()
    }
  }, [moduloId])

  const loadConclusoes = async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    
    setLoading(true)
    setError('')
    
    try {
      // 1. Buscar todos os grupos do módulo
      const gruposRes = await fetch(
        `${API_URL}/grupo-conteudo?modulo_id=${encodeURIComponent(moduloId)}&limit=100`,
        { headers: { 'Authorization': token ? `Bearer ${token}` : '' } }
      )
      
      if (!gruposRes.ok) throw new Error('Falha ao carregar grupos')
      const gruposData = await gruposRes.json()
      const grupos = Array.isArray(gruposData?.data) ? gruposData.data : []

      // 2. Para cada grupo, buscar conteúdos concluídos
      const todasConclusoes = []
      
      for (const grupo of grupos) {
        const conteudosRes = await fetch(
          `${API_URL}/conteudo?grupo_conteudo_id=${grupo.id}&limit=100`,
          { headers: { 'Authorization': token ? `Bearer ${token}` : '' } }
        )
        
        if (conteudosRes.ok) {
          const conteudosData = await conteudosRes.json()
          const conteudos = Array.isArray(conteudosData?.data) ? conteudosData.data : []
          
          // Filtrar apenas os concluídos e adicionar informações do grupo
          const conteudosConcluidos = conteudos
            .filter(c => c.concluido === 1)
            .map(c => ({
              ...c,
              grupoNome: grupo.nome,
              grupoDescricao: grupo.descricao,
              grupoLogoUrl: grupo.logo_url
            }))
          
          todasConclusoes.push(...conteudosConcluidos)
        }
      }

      setConclusoes(todasConclusoes)
    } catch (e) {
      setError(e.message || 'Erro ao carregar conclusões')
    } finally {
      setLoading(false)
    }
  }

  const handleConteudoClick = (conteudo) => {
    // Navegar para o grupo específico e conteúdo
    const grupoId = conteudo.grupo_conteudo_id
    router.push(`/onboarding/${moduloId}?grupo=${grupoId}`, undefined, { shallow: true })
  }

  if (loading) return <SpaceLoader label="Carregando conclusões..." />
  if (error) return <div className={`${styles.placeholder} ${styles.error}`}>{error}</div>
  if (!conclusoes.length) {
    return (
      <div className={styles.emptyState}>
        <CheckCircle size={64} className={styles.emptyIcon} />
        <h3 className={styles.emptyTitle}>Nenhum conteúdo concluído ainda</h3>
        <p className={styles.emptyDescription}>
          Quando você concluir conteúdos, eles aparecerão aqui.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <CheckCircle size={24} />
          Conteúdos Concluídos
        </h2>
        <span className={styles.badge}>{conclusoes.length} concluído{conclusoes.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={styles.grid}>
        {conclusoes.map((conteudo) => (
          <article 
            key={conteudo.id} 
            className={styles.card}
            onClick={() => handleConteudoClick(conteudo)}
          >
            <div className={styles.cardHeader}>
              <div className={styles.checkMark}>
                <CheckCircle size={20} />
              </div>
              <div className={styles.grupoInfo}>
                <FolderOpen size={16} />
                <span className={styles.grupoNome}>{conteudo.grupoNome}</span>
              </div>
            </div>

            <div className={styles.cardBody}>
              <h3 className={styles.conteudoTitulo}>{conteudo.nome}</h3>
              {conteudo.descricao && (
                <p className={styles.conteudoDescricao}>{conteudo.descricao}</p>
              )}
            </div>

            {conteudo.grupoLogoUrl && (
              <div className={styles.cardFooter}>
                <img 
                  src={conteudo.grupoLogoUrl} 
                  alt={conteudo.grupoNome}
                  className={styles.grupoLogo}
                />
              </div>
            )}

            <div className={styles.clickHint}>Clique para revisar</div>
          </article>
        ))}
      </div>
    </div>
  )
}

