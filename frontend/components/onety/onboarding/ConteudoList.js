import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import styles from './ConteudoList.module.css'
import SpaceLoader from '../menu/SpaceLoader'
import ProvaGrupoModal from './ProvaGrupoModal'

export default function ConteudoList({ moduloId }) {
  const router = useRouter()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [gruposComProgresso, setGruposComProgresso] = useState([])
  const [provasGrupos, setProvasGrupos] = useState({})
  const [provasEmpresa, setProvasEmpresa] = useState({})
  const [showProvaGrupoModal, setShowProvaGrupoModal] = useState(false)
  const [selectedGrupo, setSelectedGrupo] = useState(null)

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
          await loadProgressoGrupos(gruposMapeados)
          await loadProvasGrupos(gruposMapeados)

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

  // Função para carregar provas dos grupos
  const loadProvasGrupos = async (grupos) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
    const user = userRaw ? JSON.parse(userRaw) : null
    const empresaId = user?.EmpresaId || user?.empresa?.id || null
    const viewerId = user?.id

    if (!empresaId || !viewerId) return

    try {
      const provasData = {}
      const provasEmpresaData = {}

      for (const grupo of grupos) {
        // Buscar provas do grupo diretamente
        const provasRes = await fetch(`${API_URL}/prova-grupo/grupo/${grupo.id}`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        })
        
        if (provasRes.ok) {
          const provasResponse = await provasRes.json()
          const provas = provasResponse.data || []
          
          if (provas.length > 0) {
            provasData[grupo.id] = provas
          }
        }
      }

      // Buscar provas liberadas para o usuário
      const provasEmpresaRes = await fetch(`${API_URL}/prova-empresa/empresa/${empresaId}?viewer_id=${viewerId}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (provasEmpresaRes.ok) {
        const provasEmpresaResponse = await provasEmpresaRes.json()
        const provasEmpresaList = provasEmpresaResponse.data || []
        
        provasEmpresaList.forEach(provaEmpresa => {
          provasEmpresaData[provaEmpresa.prova_id] = provaEmpresa
        })
      }

      setProvasGrupos(provasData)
      setProvasEmpresa(provasEmpresaData)
    } catch (error) {
      console.error('Erro ao carregar provas dos grupos:', error)
    }
  }

  // Função para clicar em um grupo - navega para a página dedicada
  const handleGrupoClick = (grupo) => {
    router.push(`/onboarding/${moduloId}/grupo/${grupo.id}`)
  }

  // Função para abrir modal de provas do grupo
  const handleGerenciarProvas = (e, grupo) => {
    e.stopPropagation()
    setSelectedGrupo(grupo)
    setShowProvaGrupoModal(true)
  }

  // Função para fechar modal
  const handleCloseProvaGrupoModal = () => {
    setShowProvaGrupoModal(false)
    setSelectedGrupo(null)
  }

  if (loading) return <SpaceLoader label="Carregando conteúdos..." />
  if (error) return <div className={`${styles.placeholder} ${styles.error}`}>{error}</div>
  if (!gruposComProgresso.length) return <div className={styles.placeholder}>Nenhum conteúdo cadastrado.</div>

  // Lista de grupos de conteúdo
  return (
    <>
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
            
            <div className={styles.groupActions}>
              <button 
                className={styles.manageProvasButton}
                onClick={(e) => handleGerenciarProvas(e, c)}
                title="Gerenciar provas do grupo"
              >
                📝 Gerenciar Provas
              </button>
            </div>
            
            {/* Mostrar provas se o grupo estiver 100% concluído */}
            {c.progresso.porcentagem === 100 && provasGrupos[c.id] && provasGrupos[c.id].length > 0 && (
              <div className={styles.provasContainer}>
                <h4 className={styles.provasTitle}>📝 Provas Disponíveis</h4>
                <div className={styles.provasList}>
                  {provasGrupos[c.id] && provasGrupos[c.id].map((prova) => {
                    const provaEmpresa = provasEmpresa[prova.id]
                    const podeFazer = !provaEmpresa || provaEmpresa.nota === null
                    const jaFez = provaEmpresa && provaEmpresa.nota !== null
                    
                    return (
                      <div key={prova.id} className={styles.provaCard}>
                        <div className={styles.provaInfo}>
                          <h5 className={styles.provaNome}>{prova.nome}</h5>
                          <p className={styles.provaConteudo}>Conteúdo: {prova.conteudo_nome}</p>
                          <div className={styles.provaStatus}>
                            {jaFez ? (
                              <span className={styles.provaFeita}>
                                ✅ Feita - Nota: {provaEmpresa.nota}
                              </span>
                            ) : (
                              <span className={styles.provaDisponivel}>
                                🎯 Disponível para fazer
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={styles.provaActions}>
                          {podeFazer && (
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation()
                                
                                // Se não tem provaEmpresa, criar uma nova
                                if (!provaEmpresa) {
                                  try {
                                    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
                                    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
                                    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
                                    const user = userRaw ? JSON.parse(userRaw) : null
                                    const empresaId = user?.EmpresaId || user?.empresa?.id || null
                                    const viewerId = user?.id

                                    if (!empresaId || !viewerId) {
                                      console.error('Dados do usuário não encontrados')
                                      return
                                    }

                                    // Criar registro prova_empresa
                                    const createRes = await fetch(`${API_URL}/prova-empresa`, {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': token ? `Bearer ${token}` : ''
                                      },
                                      body: JSON.stringify({
                                        prova_id: prova.id,
                                        empresa_id: empresaId,
                                        viewer_id: viewerId
                                      })
                                    })

                                    if (createRes.ok) {
                                      const newProvaEmpresa = await createRes.json()
                                      // Recarregar dados para atualizar a interface
                                      loadProvasGrupos(gruposComProgresso)
                                      // Redirecionar para a prova
                                      router.push(`/onboarding/${moduloId}/realizar-prova/${newProvaEmpresa.id}`)
                                    } else {
                                      console.error('Erro ao criar prova_empresa:', await createRes.text())
                                    }
                                  } catch (error) {
                                    console.error('Erro ao criar prova_empresa:', error)
                                  }
                                  return
                                }
                                
                                router.push(`/onboarding/${moduloId}/realizar-prova/${provaEmpresa.id}`)
                              }}
                              className={styles.fazerProvaButton}
                            >
                              🎯 Fazer Prova
                            </button>
                          )}
                          {jaFez && provaEmpresa && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/onboarding/${moduloId}/realizar-prova/${provaEmpresa.id}`)
                              }}
                              className={styles.verProvaButton}
                            >
                              👁️ Ver Resultado
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
    
    {/* Modal de gerenciar provas do grupo */}
    {showProvaGrupoModal && selectedGrupo && (
      <ProvaGrupoModal
        isOpen={showProvaGrupoModal}
        onClose={handleCloseProvaGrupoModal}
        grupoId={selectedGrupo.id}
        grupoNome={selectedGrupo.nome}
        onSuccess={() => {
          // Recarregar provas dos grupos após sucesso
          loadProvasGrupos(gruposComProgresso)
        }}
      />
    )}
  </>
  )
}


