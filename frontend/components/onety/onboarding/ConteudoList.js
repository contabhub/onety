import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import styles from './ConteudoList.module.css'
import SpaceLoader from '../menu/SpaceLoader'
import { Lock, FileText } from 'lucide-react'

export default function ConteudoList({ moduloId, userRole }) {
  const router = useRouter()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [gruposComProgresso, setGruposComProgresso] = useState([])
  const [acessoGrupos, setAcessoGrupos] = useState({})
  const [verificandoAcesso, setVerificandoAcesso] = useState(true)

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
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
        console.log('🔍 ConteudoList - Buscando grupos:', url)
        const res = await fetch(url, { headers: { 'Authorization': token ? `Bearer ${token}` : '' } })
        if (!res.ok) throw new Error('Falha ao carregar grupos da empresa')
        const data = await res.json()
        console.log('📊 ConteudoList - Dados recebidos:', data)
        const grupos = Array.isArray(data?.data) ? data.data : data || []
        console.log('📋 ConteudoList - Grupos processados:', grupos)
        
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
          console.log('🗂️ ConteudoList - Grupos mapeados:', gruposMapeados)
          
          setItems(gruposMapeados)
          
          // Verificar acesso aos grupos
          setVerificandoAcesso(true)
          const acessos = await verificarAcessoGrupos(gruposMapeados)
          setAcessoGrupos(acessos)
          setVerificandoAcesso(false)
          
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

  // Função para verificar acesso aos grupos baseado na progressão sequencial
  const verificarAcessoGrupos = async (grupos) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
    const user = userRaw ? JSON.parse(userRaw) : null
    const empresaId = user?.EmpresaId || user?.empresa?.id || null
    const viewerId = user?.id

    if (!empresaId || !viewerId || grupos.length === 0) {
      return {}
    }

    try {
      const acessosGrupos = {}
      
      // Verificar acesso para cada grupo
      for (const grupo of grupos) {
        try {
          const res = await fetch(`${API_URL}/grupos/${grupo.id}/verificar-acesso?empresa_id=${empresaId}&usuario_id=${viewerId}`, {
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
          })
          
          if (res.ok) {
            const dados = await res.json()
            acessosGrupos[grupo.id] = dados
          } else {
            // Se der erro, assumir que não pode acessar
            acessosGrupos[grupo.id] = { pode_acessar: false, motivo: 'Erro ao verificar acesso' }
          }
        } catch (error) {
          console.error(`Erro ao verificar acesso do grupo ${grupo.id}:`, error)
          acessosGrupos[grupo.id] = { pode_acessar: false, motivo: 'Erro ao verificar acesso' }
        }
      }
      
      return acessosGrupos
    } catch (error) {
      console.error('Erro ao verificar acesso dos grupos:', error)
      return {}
    }
  }

  // Função para carregar progresso de cada grupo
  const loadProgressoGrupos = async (grupos) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
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
    const acessoGrupo = acessoGrupos[grupo.id]
    
    // Se não pode acessar, mostrar mensagem e não navegar
    if (acessoGrupo && !acessoGrupo.pode_acessar) {
      alert(`Acesso bloqueado: ${acessoGrupo.motivo}`)
      return
    }
    
    router.push(`/onboarding/${moduloId}/grupo/${grupo.id}`)
  }

  const handleFazerProvaPendente = async (e, acessoGrupo) => {
    e.stopPropagation() // Evita que o clique no botão acione o clique no card
    
    // Verificar se há provas não realizadas ou não aprovadas
    if (acessoGrupo.grupo_anterior && acessoGrupo.grupo_anterior.provas) {
      const provasPendentes = acessoGrupo.grupo_anterior.provas.filter(p => !p.realizada || !p.aprovado)
      
      if (provasPendentes.length > 0) {
        // Pegar a primeira prova pendente (priorizar prova do grupo se existir)
        const provaGrupo = provasPendentes.find(p => p.tipo === 'grupo')
        const provaParaFazer = provaGrupo || provasPendentes[0]
        
        // Buscar o ID da prova_empresa para esta prova
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
          const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
          const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
          const user = userRaw ? JSON.parse(userRaw) : null
          const empresaId = user?.EmpresaId || user?.empresa?.id || null

          const provasRes = await fetch(`${API_URL}/prova-empresa/empresa/${empresaId}?prova_id=${provaParaFazer.id}`, {
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
          })
          
          if (provasRes.ok) {
            const provasResponse = await provasRes.json()
            const provasEmpresa = provasResponse.data || []
            
            if (provasEmpresa.length > 0) {
              const provaEmpresaId = provasEmpresa[0].id
              router.push(`/onboarding/${moduloId}/realizar-prova/${provaEmpresaId}`)
            } else {
              alert('Prova não encontrada para esta empresa.')
            }
          } else {
            alert('Erro ao carregar dados da prova.')
          }
        } catch (error) {
          console.error('Erro ao carregar prova:', error)
          alert('Erro ao carregar prova.')
        }
      }
    }
  }


  if (loading || verificandoAcesso) return <SpaceLoader label="Carregando conteúdos..." />
  if (error) return <div className={`${styles.placeholder} ${styles.error}`}>{error}</div>
  if (!gruposComProgresso.length) return <div className={styles.placeholder}>Nenhum conteúdo cadastrado.</div>

  // Lista de grupos de conteúdo
  return (
    <>
    <div className={styles.grid}>
      {gruposComProgresso.map((c) => {
        const acessoGrupo = acessoGrupos[c.id]
        const podeAcessar = !acessoGrupo || acessoGrupo.pode_acessar
        const estaBloqueado = acessoGrupo && !acessoGrupo.pode_acessar
        
        return (
        <article 
          key={c.id} 
          className={`${styles.card} ${podeAcessar ? styles.clickable : styles.blocked}`} 
          onClick={() => handleGrupoClick(c)}
        >
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
            <div className={styles.titleRow}>
              <h3 className={styles.title}>{c.nome}</h3>
              {estaBloqueado && (
                <Lock size={16} className={styles.blockedIcon} title={acessoGrupo.motivo} />
              )}
            </div>
            <p className={styles.desc}>{c.descricao || 'Sem descrição'}</p>
            
            {/* Indicador de bloqueio */}
            {estaBloqueado && (
              <div className={styles.blockedMessage}>
                <span className={styles.blockedText}>
                  {acessoGrupo.motivo}
                </span>
                
                {/* Botão para fazer prova pendente */}
                {acessoGrupo.grupo_anterior && acessoGrupo.grupo_anterior.provas && (
                  <button 
                    className={styles.provaButton}
                    onClick={(e) => handleFazerProvaPendente(e, acessoGrupo)}
                  >
                    <FileText size={14} style={{ marginRight: 6 }} />
                    Fazer Prova Pendente
                  </button>
                )}
              </div>
            )}
            
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
            
            <div className={styles.clickHint}>
              {podeAcessar ? 'Clique para ver conteúdos' : 'Grupo bloqueado'}
            </div>
            
            
          </div>
        </article>
        )
      })}
    </div>
    
  </>
  )
}


