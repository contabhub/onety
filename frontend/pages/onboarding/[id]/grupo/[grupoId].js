import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import styles from '../../../../styles/onety/onboarding/onboarding.module.css'
import grupoStyles from '../../../../components/onety/onboarding/GrupoConteudoViewer.module.css'
import Topbar from '../../../../components/onety/onboarding/Topbar'
import OnboardingSidebar from '../../../../components/onety/onboarding/Sidebar'

export default function GrupoConteudoPage() {
  const router = useRouter()
  const { id: moduloId, grupoId } = router.query
  const [grupo, setGrupo] = useState(null)
  const [conteudos, setConteudos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [progresso, setProgresso] = useState({ concluidos: 0, total: 0, porcentagem: 0 })
  const [marcandoConcluido, setMarcandoConcluido] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  useEffect(() => {
    if (grupoId) {
      loadGrupoAndConteudos()
    }
  }, [grupoId])

  // Verificar se há um conteúdo específico na URL ao carregar
  useEffect(() => {
    const { conteudo } = router.query
    if (conteudo && conteudos.length > 0) {
      const conteudoIndex = parseInt(conteudo) - 1 // URL usa 1-based, array usa 0-based
      if (conteudoIndex >= 0 && conteudoIndex < conteudos.length) {
        setCurrentIndex(conteudoIndex)
      }
    }
  }, [router.query, conteudos])

  const loadGrupoAndConteudos = async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
    const user = userRaw ? JSON.parse(userRaw) : null
    const empresaId = user?.EmpresaId || user?.empresa?.id || null
    const viewerId = user?.id

    if (!empresaId || !viewerId) {
      setError('Dados de usuário ou empresa não encontrados')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    
    try {
      // 1. Buscar informações do grupo
      const grupoRes = await fetch(`${API_URL}/grupo-conteudo/${grupoId}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!grupoRes.ok) throw new Error('Falha ao carregar grupo')
      const grupoData = await grupoRes.json()
      setGrupo(grupoData)

      // 2. Verificar se a empresa tem acesso ao grupo
      const vinculosRes = await fetch(`${API_URL}/empresa-conteudo/grupo-conteudo/${grupoId}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!vinculosRes.ok) throw new Error('Falha ao verificar acesso ao grupo')
      const vinculosData = await vinculosRes.json()
      const vinculos = Array.isArray(vinculosData?.data) ? vinculosData.data : []

      const empresaTemAcesso = vinculos.some(v => v.empresa_id === empresaId)
      
      if (!empresaTemAcesso) {
        setError('Sua empresa não tem acesso a este grupo de conteúdo')
        setLoading(false)
        return
      }

      // 3. Buscar conteúdos do grupo
      const conteudosRes = await fetch(`${API_URL}/conteudo?grupo_conteudo_id=${grupoId}&limit=100`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!conteudosRes.ok) throw new Error('Falha ao carregar conteúdos')
      const conteudosData = await conteudosRes.json()
      const todosConteudos = Array.isArray(conteudosData?.data) ? conteudosData.data : []

      if (todosConteudos.length === 0) {
        setError('Nenhum conteúdo encontrado neste grupo')
        setLoading(false)
        return
      }

      // 4. Os conteúdos já vêm com o campo 'concluido' da tabela conteudo
      const conteudosComStatus = todosConteudos.map(conteudo => ({
        ...conteudo,
        concluido: conteudo.concluido === 1
      }))

      setConteudos(conteudosComStatus)
      updateProgresso(conteudosComStatus)
      
    } catch (e) {
      setError(e.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const updateProgresso = (conteudosList) => {
    const concluidos = conteudosList.filter(c => c.concluido).length
    const total = conteudosList.length
    const porcentagem = total > 0 ? Math.round((concluidos / total) * 100) : 0
    
    console.log('📊 Progresso calculado:', { concluidos, total, porcentagem })
    console.log('📋 Conteúdos:', conteudosList.map(c => ({ id: c.id, nome: c.nome, concluido: c.concluido })))
    
    setProgresso({ concluidos, total, porcentagem })
  }

  const marcarComoConcluido = async (conteudo) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
    const user = userRaw ? JSON.parse(userRaw) : null
    const empresaId = user?.EmpresaId || user?.empresa?.id || null
    const viewerId = user?.id

    if (!empresaId || !viewerId) {
      setError('Dados de usuário ou empresa não encontrados')
      return
    }

    setMarcandoConcluido(true)
    
    try {
      // Usar a nova rota que marca conteúdo como concluído e verifica conclusão do grupo
      const concluirRes = await fetch(`${API_URL}/conteudo/${conteudo.id}/concluir`, {
        method: 'PATCH',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          viewer_id: viewerId,
          empresa_id: empresaId
        })
      })
      
      if (!concluirRes.ok) throw new Error('Falha ao marcar como concluído')
      
      const resultado = await concluirRes.json()

      // Atualizar estado local com o conteúdo marcado como concluído
      const conteudosAtualizados = conteudos.map(c => 
        c.id === conteudo.id ? { ...c, concluido: 1 } : c
      )
      setConteudos(conteudosAtualizados)
      updateProgresso(conteudosAtualizados)

      // Se o grupo foi completado, mostrar mensagem de parabéns
      if (resultado.grupo_completo) {
        console.log('🎉 Parabéns! Grupo completo!', resultado.progresso)
      }
      
    } catch (e) {
      setError(e.message || 'Erro ao marcar como concluído')
    } finally {
      setMarcandoConcluido(false)
    }
  }

  const proximoConteudo = () => {
    if (currentIndex < conteudos.length - 1) {
      const novoIndex = currentIndex + 1
      setCurrentIndex(novoIndex)
      // Atualizar URL com o novo índice do conteúdo
      router.push(`/onboarding/${moduloId}/grupo/${grupoId}?conteudo=${novoIndex + 1}`, undefined, { shallow: true })
    }
  }

  const conteudoAnterior = () => {
    if (currentIndex > 0) {
      const novoIndex = currentIndex - 1
      setCurrentIndex(novoIndex)
      // Atualizar URL com o novo índice do conteúdo
      router.push(`/onboarding/${moduloId}/grupo/${grupoId}?conteudo=${novoIndex + 1}`, undefined, { shallow: true })
    }
  }

  const irParaConteudo = (index) => {
    setCurrentIndex(index)
    // Atualizar URL com o novo índice do conteúdo
    router.push(`/onboarding/${moduloId}/grupo/${grupoId}?conteudo=${index + 1}`, undefined, { shallow: true })
  }

  const handleVoltar = () => {
    router.push(`/onboarding/${moduloId}`)
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <Head>
          <title>Carregando...</title>
        </Head>
        <Topbar sidebarCollapsed={sidebarCollapsed} />
        <div className={styles.layout}>
          <div className={`${styles.contentWrapper} ${sidebarCollapsed ? styles.sidebarCollapsed : styles.sidebarExpanded}`}>
            <OnboardingSidebar 
              currentTab="conteudo" 
              onChangeTab={() => router.push(`/onboarding/${moduloId}`)} 
              onCollapseChange={setSidebarCollapsed}
            />
            <main className={styles.main}>
              <div className={grupoStyles.placeholder}>Carregando conteúdos...</div>
            </main>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <Head>
          <title>Erro</title>
        </Head>
        <Topbar sidebarCollapsed={sidebarCollapsed} />
        <div className={styles.layout}>
          <div className={`${styles.contentWrapper} ${sidebarCollapsed ? styles.sidebarCollapsed : styles.sidebarExpanded}`}>
            <OnboardingSidebar 
              currentTab="conteudo" 
              onChangeTab={() => router.push(`/onboarding/${moduloId}`)} 
              onCollapseChange={setSidebarCollapsed}
            />
            <main className={styles.main}>
              <div className={`${grupoStyles.placeholder} ${grupoStyles.error}`}>{error}</div>
            </main>
          </div>
        </div>
      </div>
    )
  }

  if (!conteudos.length) {
    return (
      <div className={styles.page}>
        <Head>
          <title>{grupo?.nome || 'Grupo'}</title>
        </Head>
        <Topbar sidebarCollapsed={sidebarCollapsed} />
        <div className={styles.layout}>
          <div className={`${styles.contentWrapper} ${sidebarCollapsed ? styles.sidebarCollapsed : styles.sidebarExpanded}`}>
            <OnboardingSidebar 
              currentTab="conteudo" 
              onChangeTab={() => router.push(`/onboarding/${moduloId}`)} 
              onCollapseChange={setSidebarCollapsed}
            />
            <main className={styles.main}>
              <div className={grupoStyles.placeholder}>Nenhum conteúdo encontrado.</div>
            </main>
          </div>
        </div>
      </div>
    )
  }

  const conteudoAtual = conteudos[currentIndex]

  return (
    <div className={styles.page}>
      <Head>
        <title>{grupo?.nome || 'Grupo de Conteúdo'}</title>
      </Head>
      <Topbar sidebarCollapsed={sidebarCollapsed} />
      <div className={styles.layout}>
        <div className={`${styles.contentWrapper} ${sidebarCollapsed ? styles.sidebarCollapsed : styles.sidebarExpanded}`}>
          <OnboardingSidebar 
            currentTab="conteudo" 
            onChangeTab={() => router.push(`/onboarding/${moduloId}`)} 
            onCollapseChange={setSidebarCollapsed}
          />
          <main className={styles.main}>
            <div className={grupoStyles.container}>
              {/* Botão de voltar acima do título */}
              <div>
                <button onClick={handleVoltar} className={grupoStyles.backButton}>
                  ← Voltar aos grupos
                </button>
              </div>

              {/* Header com progresso */}
              <div className={grupoStyles.header}>
                <div className={grupoStyles.headerInfo}>
                  <h2 className={grupoStyles.groupTitle}>{grupo?.nome}</h2>
                  <div className={grupoStyles.progressInfo}>
                    <span>{progresso.concluidos} de {progresso.total} concluídos</span>
                    <span className={grupoStyles.percentage}>({progresso.porcentagem}%)</span>
                  </div>
                </div>
              </div>

              {/* Barra de progresso */}
              <div className={grupoStyles.progressBar}>
                <div 
                  className={grupoStyles.progressFill} 
                  style={{ width: `${progresso.porcentagem}%` }}
                />
              </div>

              {/* Navegação de conteúdos */}
              <div className={grupoStyles.contentNavigation}>
                <div className={grupoStyles.contentCounter}>
                  Conteúdo {currentIndex + 1} de {conteudos.length}
                </div>
                <div className={grupoStyles.contentTabs}>
                  {conteudos.map((conteudo, index) => (
                    <button
                      key={conteudo.id}
                      className={`${grupoStyles.tab} ${index === currentIndex ? grupoStyles.active : ''} ${conteudo.concluido ? grupoStyles.completed : ''}`}
                      onClick={() => irParaConteudo(index)}
                    >
                      {conteudo.concluido ? '✓' : index + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conteúdo atual */}
              <div className={grupoStyles.currentContent}>
                <div className={grupoStyles.contentHeader}>
                  <h3 className={grupoStyles.contentTitle}>{conteudoAtual.nome}</h3>
                  {conteudoAtual.concluido && (
                    <span className={grupoStyles.completedBadge}>Concluído</span>
                  )}
                </div>
                
                {conteudoAtual.descricao && (
                  <p className={grupoStyles.contentDescription}>{conteudoAtual.descricao}</p>
                )}

                {/* Player de vídeo */}
                {conteudoAtual.link && (
                  <div className={grupoStyles.videoContainer}>
                    <video 
                      src={conteudoAtual.link} 
                      className={grupoStyles.videoPlayer}
                      poster={grupo?.logo_url}
                      controls
                    />
                  </div>
                )}

                {/* Botões de ação */}
                <div className={grupoStyles.actionButtons}>
                  <button 
                    onClick={conteudoAnterior} 
                    disabled={currentIndex === 0}
                    className={grupoStyles.navButton}
                  >
                    ← Anterior
                  </button>
                  
                  {!conteudoAtual.concluido ? (
                    <button 
                      onClick={() => marcarComoConcluido(conteudoAtual)}
                      disabled={marcandoConcluido}
                      className={grupoStyles.completeButton}
                    >
                      {marcandoConcluido ? 'Marcando...' : '✓ Marcar como Concluído'}
                    </button>
                  ) : (
                    <span className={grupoStyles.alreadyCompleted}>
                      ✓ Este conteúdo já foi concluído
                    </span>
                  )}
                  
                  <button 
                    onClick={proximoConteudo} 
                    disabled={currentIndex === conteudos.length - 1}
                    className={grupoStyles.navButton}
                  >
                    Próximo →
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

