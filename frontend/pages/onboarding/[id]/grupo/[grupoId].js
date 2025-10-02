import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import styles from '../../../../styles/onety/onboarding/onboarding.module.css'
import grupoStyles from '../../../../components/onety/onboarding/GrupoConteudoViewer.module.css'
import Topbar from '../../../../components/onety/onboarding/Topbar'
import SpaceLoader from '../../../../components/onety/menu/SpaceLoader'
import OnboardingSidebar from '../../../../components/onety/onboarding/Sidebar'
import { FileText, ClipboardList, Target } from 'lucide-react'

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
  const [provasConteudo, setProvasConteudo] = useState({})
  const [provasEmpresa, setProvasEmpresa] = useState({})
  const [provasGrupo, setProvasGrupo] = useState([])

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
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
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
      // 1. Buscar informações do grupo através da tabela empresas_grupos
      const grupoRes = await fetch(`${API_URL}/empresas-grupos?empresa_id=${empresaId}&grupo_id=${grupoId}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!grupoRes.ok) throw new Error('Falha ao carregar grupo')
      const grupoData = await grupoRes.json()
      const grupoInfo = Array.isArray(grupoData?.data) ? grupoData.data[0] : null
      
      if (!grupoInfo) {
        setError('Grupo não encontrado ou sem acesso')
        setLoading(false)
        return
      }
      
      // Mapear dados do grupo para o formato esperado
      setGrupo({
        id: grupoInfo.grupo_id,
        nome: grupoInfo.grupo_nome,
        descricao: grupoInfo.grupo_descricao,
        ordem: grupoInfo.grupo_ordem,
        ativo: grupoInfo.grupo_ativo,
        modulo_id: grupoInfo.modulo_id,
        modulo_nome: grupoInfo.modulo_nome,
        status: grupoInfo.grupo_status,
        concluido_em: grupoInfo.grupo_concluido_em
      })

      // 2. Buscar conteúdos do grupo vinculados à empresa
      const conteudosRes = await fetch(`${API_URL}/empresas-conteudos?empresa_id=${empresaId}&grupo_id=${grupoId}&limit=100`, {
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

      // 3. Mapear conteúdos para o formato esperado
      const conteudosComStatus = todosConteudos.map(conteudo => ({
        id: conteudo.conteudo_id,
        titulo: conteudo.titulo,
        descricao: conteudo.descricao,
        url: conteudo.url,
        link: conteudo.url, // Para compatibilidade com o player de vídeo
        tipo: conteudo.tipo,
        obrigatorio: conteudo.obrigatorio,
        ordem: conteudo.ordem,
        ativo: conteudo.ativo,
        grupo_id: conteudo.grupo_id,
        grupo_nome: conteudo.grupo_nome,
        usuario_id: conteudo.usuario_id,
        usuario_nome: conteudo.usuario_nome,
        status: conteudo.status,
        concluido_em: conteudo.concluido_em,
        concluido: conteudo.status === 'concluido'
      }))

      setConteudos(conteudosComStatus)
      await loadProvasConteudos(conteudosComStatus)
      await loadProvasGrupo(empresaId, viewerId, grupoId, conteudosComStatus)
      
    } catch (e) {
      setError(e.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const updateProgresso = (conteudosList) => {
    // Verificar se todos os conteúdos estão concluídos E se todas as provas foram feitas
    let conteudosCompletos = 0
    
    for (const conteudo of conteudosList) {
      const provasDoConteudo = provasConteudo[conteudo.id] || []
      
      // Se não há prova para o conteúdo, basta estar concluído
      if (provasDoConteudo.length === 0) {
        if (conteudo.concluido) {
          conteudosCompletos++
        }
      } else {
        // Se há prova, verificar se foi feita com nota >= 7
        const todasProvasAprovadas = provasDoConteudo.every(prova => {
          const provaEmpresa = provasEmpresa[prova.id]
          return provaEmpresa && provaEmpresa.nota !== null && provaEmpresa.nota >= 7
        })
        
        if (conteudo.concluido && todasProvasAprovadas) {
          conteudosCompletos++
        }
      }
    }
    
    // Verificar se há provas de grupo pendentes
    const provasGrupoPendentes = provasGrupo.filter(prova => 
      prova.nota === null || prova.nota < 7
    ).length
    
    // Se há provas de grupo pendentes, não pode ser 100%
    const total = conteudosList.length
    const conteudosCompletosComProvas = provasGrupoPendentes > 0 ? 
      Math.max(0, conteudosCompletos - 1) : conteudosCompletos
    
    const porcentagem = total > 0 ? Math.round((conteudosCompletosComProvas / total) * 100) : 0
    
    console.log('📊 Progresso calculado (considerando provas):', { 
      conteudosCompletos, 
      provasGrupoPendentes, 
      conteudosCompletosComProvas, 
      total, 
      porcentagem 
    })
    console.log('📋 Conteúdos:', conteudosList.map(c => ({ id: c.id, nome: c.nome, concluido: c.concluido })))
    
    setProgresso({ 
      concluidos: conteudosCompletosComProvas, 
      total, 
      porcentagem,
      provasGrupoPendentes: provasGrupoPendentes > 0
    })
  }

  // Função para carregar provas de cada conteúdo (apenas as que têm vínculo com a empresa)
  const loadProvasConteudos = async (conteudos) => {
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

      for (const conteudo of conteudos) {
        // Buscar provas vinculadas à empresa para este conteúdo
        const provasRes = await fetch(`${API_URL}/prova-empresa/empresa/${empresaId}?conteudo_id=${conteudo.id}`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        })
        
        if (provasRes.ok) {
          const provasResponse = await provasRes.json()
          const provasEmpresa = provasResponse.data || []
          
          // Filtrar apenas provas que têm vínculo com este conteúdo
          const provasDoConteudo = provasEmpresa.filter(pe => pe.conteudo_id === conteudo.id)
          
          if (provasDoConteudo.length > 0) {
            // Buscar detalhes das provas
            const provasDetalhes = []
            for (const pe of provasDoConteudo) {
              const provaDetalhesRes = await fetch(`${API_URL}/prova/${pe.prova_id}`, {
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
              })
              
              if (provaDetalhesRes.ok) {
                const provaDetalhes = await provaDetalhesRes.json()
                provasDetalhes.push(provaDetalhes)
                provasEmpresaData[pe.prova_id] = pe
              }
            }
            
            provasData[conteudo.id] = provasDetalhes
          } else {
            provasData[conteudo.id] = []
          }
        }
      }

      setProvasConteudo(provasData)
      setProvasEmpresa(provasEmpresaData)
      console.log('🔍 Provas carregadas (apenas com vínculo):', provasData)
      console.log('🔍 Provas empresa:', provasEmpresaData)
      
      // Atualizar progresso após carregar provas
      setTimeout(() => updateProgresso(conteudos), 50)
    } catch (error) {
      console.error('Erro ao carregar provas dos conteúdos:', error)
    }
  }

  // Função para carregar provas do grupo
  const loadProvasGrupo = async (empresaId, viewerId, grupoId, conteudos = []) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    if (!empresaId || !viewerId || !grupoId) return

    try {
      // Buscar provas vinculadas ao grupo
      const provasRes = await fetch(`${API_URL}/prova-empresa/empresa/${empresaId}?grupo_id=${grupoId}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (provasRes.ok) {
        const provasResponse = await provasRes.json()
        const provasDoGrupo = provasResponse.data || []
        
        setProvasGrupo(provasDoGrupo)
        console.log('🔍 Provas do grupo carregadas:', provasDoGrupo)
        
        // Atualizar progresso após carregar provas do grupo
        setTimeout(() => updateProgresso(conteudos), 50)
      }
    } catch (error) {
      console.error('Erro ao carregar provas do grupo:', error)
    }
  }

  const marcarComoConcluido = async (conteudo) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
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
      // 1. Verificar se existe prova vinculada a este conteúdo
      const provasDoConteudo = provasConteudo[conteudo.id] || []
      
      if (provasDoConteudo.length > 0) {
        // 2. Verificar se todas as provas foram concluídas (nota != NULL)
        for (const prova of provasDoConteudo) {
          const provaEmpresa = provasEmpresa[prova.id]
          
          if (!provaEmpresa || provaEmpresa.nota === null) {
            setError(`Você precisa fazer a prova "${prova.nome}" antes de marcar o conteúdo como concluído.`)
            setMarcandoConcluido(false)
            return
          }
          
          // Verificar se passou na prova (nota >= 7)
          if (provaEmpresa.nota < 7) {
            setError(`Você precisa ter nota >= 7 na prova "${prova.nome}" para concluir o conteúdo. Sua nota atual: ${provaEmpresa.nota}`)
            setMarcandoConcluido(false)
            return
          }
        }
        
        console.log('✅ Todas as provas foram concluídas com sucesso!')
      }

      // 3. Marcar conteúdo como concluído na tabela empresas_conteudos
      const concluirRes = await fetch(`${API_URL}/empresas-conteudos/${empresaId}/${conteudo.id}/concluir`, {
        method: 'PATCH',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          usuario_id: viewerId
        })
      })
      
      if (!concluirRes.ok) throw new Error('Falha ao marcar como concluído')
      
      const resultado = await concluirRes.json()

      // Atualizar estado local com o conteúdo marcado como concluído
      const conteudosAtualizados = conteudos.map(c => 
        c.id === conteudo.id ? { ...c, concluido: true, status: 'concluido' } : c
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

  // Função para renderizar o botão "Próximo" ou "Realizar Prova"
  const renderNextButton = () => {
    const isLastContent = currentIndex === conteudos.length - 1
    const isContentCompleted = conteudoAtual.concluido
    const allContentsCompleted = progresso.concluidos === progresso.total
    const hasProvaGrupo = provasGrupo.length > 0
    const hasProvaGrupoPendente = progresso.provasGrupoPendentes
    
    console.log('🔍 Debug renderNextButton:', {
      isLastContent,
      isContentCompleted,
      allContentsCompleted,
      hasProvaGrupo,
      hasProvaGrupoPendente,
      progresso,
      provasGrupo
    })

    // Se não é o último conteúdo, mostrar botão "Próximo" normal
    if (!isLastContent) {
      return (
        <button 
          onClick={proximoConteudo} 
          className={grupoStyles.navButton}
        >
          Próximo →
        </button>
      )
    }

    // Se é o último conteúdo mas não está concluído, mostrar botão "Próximo" desabilitado
    if (!isContentCompleted) {
      return (
        <button 
          disabled
          className={grupoStyles.navButton}
        >
          Próximo →
        </button>
      )
    }

    // Verificar se há provas de grupo pendentes (verificação direta)
    const provasGrupoPendentes = provasGrupo.filter(prova => 
      prova.nota === null || prova.nota < 7
    )
    
    // Se há provas de grupo pendentes, sempre mostrar "Realizar Prova"
    if (provasGrupoPendentes.length > 0) {
      const provaGrupo = provasGrupoPendentes[0] // Pegar a primeira prova pendente
      const jaFezProva = provaGrupo.nota !== null
      const passouProva = provaGrupo.nota !== null && provaGrupo.nota >= 7

      console.log('🎯 Mostrando botão Realizar Prova:', { provaGrupo, jaFezProva, passouProva })

      return (
        <button 
          onClick={() => handleFazerProvaGrupo(provaGrupo)}
          className={grupoStyles.fazerProvaButton}
        >
          <FileText size={16} style={{ marginRight: 8 }} />
          {!jaFezProva ? 'Realizar Prova' : 'Refazer Prova'}
        </button>
      )
    }

    // Se é o último conteúdo e está concluído e não há provas pendentes, mostrar botão para voltar aos grupos
    return (
      <button 
        onClick={handleVoltar}
        className={grupoStyles.navButton}
      >
        Voltar aos Grupos →
      </button>
    )
  }


  // Função para lidar com a prova do grupo
  const handleFazerProvaGrupo = async (provaEmpresa) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
    const user = userRaw ? JSON.parse(userRaw) : null
    const empresaId = user?.EmpresaId || user?.empresa?.id || null
    const viewerId = user?.id

    if (!empresaId || !viewerId) {
      setError('Dados de usuário ou empresa não encontrados')
      return
    }

    try {
      // Navegar diretamente para a prova do grupo
      router.push(`/onboarding/${moduloId}/realizar-prova/${provaEmpresa.id}`)
    } catch (e) {
      setError(e.message || 'Erro ao preparar prova do grupo')
    }
  }

  // Função para lidar com o clique em "Fazer Prova" específica (da seção de provas)
  const handleFazerProvaEspecifica = async (prova, provaEmpresa) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
    const user = userRaw ? JSON.parse(userRaw) : null
    const empresaId = user?.EmpresaId || user?.empresa?.id || null
    const viewerId = user?.id

    if (!empresaId || !viewerId) {
      setError('Dados de usuário ou empresa não encontrados')
      return
    }

    try {
      let provaEmpresaId = provaEmpresa?.id

      // Se não existe registro prova_empresa, criar um
      if (!provaEmpresaId) {
        const criarRes = await fetch(`${API_URL}/prova-empresa`, {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prova_id: prova.id,
            empresa_id: empresaId,
            viewer_id: viewerId
          })
        })

        if (!criarRes.ok) throw new Error('Falha ao criar registro de prova')

        const provaEmpresa = await criarRes.json()
        provaEmpresaId = provaEmpresa.id
      }

      // Navegar para a página da prova
      router.push(`/onboarding/${moduloId}/realizar-prova/${provaEmpresaId}`)

    } catch (e) {
      setError(e.message || 'Erro ao preparar prova')
    }
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
              <SpaceLoader label="Carregando conteúdos..." />
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
            {/* Header */}
            <div className={styles.header}>
              <div>
                <h1 className={styles.headerTitle}>
                  {grupo?.nome || 'Grupo de Conteúdo'}
                </h1>
                <p className={styles.headerSubtitle}>
                  {progresso.concluidos} de {progresso.total} conteúdos concluídos ({progresso.porcentagem}%)
                </p>
              </div>
              <button onClick={handleVoltar} className={styles.addButton}>
                ← Voltar aos Grupos
              </button>
            </div>

            <div className={grupoStyles.container}>

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

                {/* Seção de Provas */}
                {provasConteudo[conteudoAtual.id] && provasConteudo[conteudoAtual.id].length > 0 && (
                  <div className={grupoStyles.provasSection}>
                    <h4 className={grupoStyles.provasTitle}>
                      <ClipboardList size={20} style={{ marginRight: 8 }} />
                      Prova Obrigatória
                    </h4>
                    <div className={grupoStyles.provasList}>
                      {provasConteudo[conteudoAtual.id].map((prova) => {
                        const provaEmpresa = provasEmpresa[prova.id]
                        const podeFazer = !provaEmpresa || provaEmpresa.nota === null
                        const jaFez = provaEmpresa && provaEmpresa.nota !== null
                        const passou = provaEmpresa && provaEmpresa.nota >= 7
                        
                        return (
                          <div key={prova.id} className={grupoStyles.provaCard}>
                            <div className={grupoStyles.provaInfo}>
                              <h5 className={grupoStyles.provaNome}>{prova.nome}</h5>
                              <div className={grupoStyles.provaStatus}>
                                {jaFez ? (
                                  <span className={passou ? grupoStyles.provaFeita : grupoStyles.provaReprovada}>
                                    {passou ? '✅ Aprovado' : '❌ Reprovado'} - Nota: {provaEmpresa.nota}
                                  </span>
                                ) : (
                                  <span className={grupoStyles.provaDisponivel}>
                                    <Target size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                    Disponível para fazer
                                  </span>
                                )}
                              </div>
                              <p className={grupoStyles.provaDescricao}>
                                {jaFez 
                                  ? passou 
                                    ? 'Parabéns! Você pode marcar o conteúdo como concluído.'
                                    : 'Você precisa refazer a prova e tirar nota >= 7 para concluir o conteúdo.'
                                  : 'Faça esta prova para poder marcar o conteúdo como concluído.'
                                }
                              </p>
                            </div>
                            <div className={grupoStyles.provaActions}>
                              {podeFazer && (
                                <button 
                                  onClick={() => handleFazerProvaEspecifica(prova, provaEmpresa)}
                                  className={grupoStyles.fazerProvaButton}
                                >
                                  <FileText size={16} style={{ marginRight: 8 }} />
                                  Fazer Prova
                                </button>
                              )}
                              {jaFez && !passou && (
                                <button 
                                  onClick={() => handleFazerProvaEspecifica(prova, provaEmpresa)}
                                  className={grupoStyles.fazerProvaButton}
                                >
                                  🔄 Refazer Prova
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
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
                    (() => {
                      const provasDoConteudo = provasConteudo[conteudoAtual.id] || []
                      const podeMarcarConcluido = provasDoConteudo.length === 0 || 
                        provasDoConteudo.every(prova => {
                          const provaEmpresa = provasEmpresa[prova.id]
                          return provaEmpresa && provaEmpresa.nota !== null && provaEmpresa.nota >= 7
                        })
                      
                      return (
                        <button 
                          onClick={() => marcarComoConcluido(conteudoAtual)}
                          disabled={marcandoConcluido || !podeMarcarConcluido}
                          className={grupoStyles.completeButton}
                          title={!podeMarcarConcluido ? 'Complete a(s) prova(s) obrigatória(s) primeiro' : ''}
                        >
                          {marcandoConcluido ? 'Marcando...' : '✓ Marcar como Concluído'}
                        </button>
                      )
                    })()
                  ) : (
                    <span className={grupoStyles.alreadyCompleted}>
                      ✓ Este conteúdo já foi concluído
                    </span>
                  )}
                  
                  {/* Botão Próximo / Fazer Prova */}
                  {renderNextButton()}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

