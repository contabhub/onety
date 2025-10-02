import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import styles from './ConteudoList.module.css'
import SpaceLoader from '../menu/SpaceLoader'

export default function ConteudoList({ moduloId }) {
  const router = useRouter()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [gruposComProgresso, setGruposComProgresso] = useState([])

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
    const user = userRaw ? JSON.parse(userRaw) : null
    const empresaId = user?.EmpresaId || user?.empresa?.id || null
    let ignore = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        if (!empresaId) {
          setError('Empresa não identificada')
          setLoading(false)
          return
        }

        // Buscar grupos vinculados à empresa através da tabela empresas_grupos
        const url = `${API_URL}/empresas-grupos?empresa_id=${empresaId}&modulo_id=${moduloId}&limit=100`
        const res = await fetch(url, { headers: { 'Authorization': token ? `Bearer ${token}` : '' } })
        if (!res.ok) throw new Error('Falha ao carregar grupos da empresa')
        const data = await res.json()
        const grupos = Array.isArray(data?.data) ? data.data : data || []
        
        if (!ignore) {
          // Mapear os dados da query para o formato esperado
          const gruposMapeados = grupos.map(grupo => ({
            id: grupo.grupo_id,
            nome: grupo.grupo_nome,
            descricao: grupo.grupo_descricao,
            ordem: grupo.grupo_ordem,
            ativo: grupo.grupo_ativo,
            modulo_id: grupo.modulo_id,
            modulo_nome: grupo.modulo_nome,
            status: grupo.grupo_status,
            concluido_em: grupo.grupo_concluido_em
          }))
          
          setItems(gruposMapeados)
          await loadProgressoGrupos(gruposMapeados)
        }
      } catch (e) {
        if (!ignore) setError(e.message || 'Erro ao carregar grupos')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    if (moduloId && empresaId) load()
    return () => { ignore = true }
  }, [moduloId])

  // Função para carregar progresso de cada grupo
  const loadProgressoGrupos = async (grupos) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
    const user = userRaw ? JSON.parse(userRaw) : null
    const empresaId = user?.EmpresaId || user?.empresa?.id || null
    const viewerId = user?.id

    if (!empresaId || !viewerId || grupos.length === 0) {
      setGruposComProgresso(grupos.map(grupo => ({ ...grupo, progresso: { concluidos: 0, total: 0, porcentagem: 0 } })))
      return
    }

    try {
      // Para cada grupo, buscar total de conteúdos e quantos foram concluídos
      const gruposComProgresso = await Promise.all(
        grupos.map(async (grupo) => {
          try {
            // Buscar conteúdos vinculados à empresa através da tabela empresas_conteudos
            const conteudosRes = await fetch(`${API_URL}/empresas-conteudos?empresa_id=${empresaId}&grupo_id=${grupo.id}&limit=100`, {
              headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            })
            
            let totalConteudos = 0
            let conteudosConcluidos = 0
            
            if (conteudosRes.ok) {
              const conteudosData = await conteudosRes.json()
              const conteudos = Array.isArray(conteudosData?.data) ? conteudosData.data : []
              
              totalConteudos = conteudos.length
              // Contar quantos estão com status 'concluido'
              conteudosConcluidos = conteudos.filter(c => c.status === 'concluido').length
            }

            const porcentagem = totalConteudos > 0 ? Math.round((conteudosConcluidos / totalConteudos) * 100) : 0

            return {
              ...grupo,
              progresso: {
                concluidos: conteudosConcluidos,
                total: totalConteudos,
                porcentagem
              }
            }
          } catch (error) {
            console.error(`Erro ao carregar progresso do grupo ${grupo.id}:`, error)
            return {
              ...grupo,
              progresso: { concluidos: 0, total: 0, porcentagem: 0 }
            }
          }
        })
      )

      setGruposComProgresso(gruposComProgresso)
    } catch (error) {
      console.error('Erro ao carregar progresso dos grupos:', error)
      setGruposComProgresso(grupos.map(grupo => ({ ...grupo, progresso: { concluidos: 0, total: 0, porcentagem: 0 } })))
    }
  }

  // Função para clicar em um grupo - navega para a página dedicada
  const handleGrupoClick = (grupo) => {
    router.push(`/onboarding/${moduloId}/grupo/${grupo.id}`)
  }

  if (loading) return <SpaceLoader label="Carregando conteúdos..." />
  if (error) return <div className={`${styles.placeholder} ${styles.error}`}>{error}</div>
  if (!gruposComProgresso.length) return <div className={styles.placeholder}>Nenhum conteúdo cadastrado.</div>

  // Lista de grupos de conteúdo
  return (
    <div className={styles.grid}>
      {gruposComProgresso.map((c) => (
        <article key={c.id} className={`${styles.card} ${styles.clickable}`} onClick={() => handleGrupoClick(c)}>
          {(c.logo_url) ? (
            <div className={styles.media}>
              {c.logo_url ? (
                <img src={c.logo_url} alt={`Logo de ${c.nome}`} className={styles.mediaImg} />
              ) : (
                <span className={styles.mediaFallback}>Prévia</span>
              )}
            </div>
          ) : null}
          <div className={styles.body}>
            <h3 className={styles.title}>{c.nome}</h3>
            <p className={styles.desc}>{c.descricao || 'Sem descrição'}</p>
            
            {/* Barra de progresso */}
            <div className={styles.progressContainer}>
              <div className={styles.progressInfo}>
                <span className={styles.progressText}>
                  {c.progresso.concluidos} de {c.progresso.total} concluídos
                </span>
                <span className={styles.progressPercentage}>
                  ({c.progresso.porcentagem}%)
                </span>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${c.progresso.porcentagem}%` }}
                />
              </div>
            </div>
            
            <div className={styles.clickHint}>Clique para ver conteúdos</div>
          </div>
        </article>
      ))}
    </div>
  )
}


