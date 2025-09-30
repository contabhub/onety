import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import styles from './GrupoConteudoViewer.module.css'

export default function GrupoConteudoViewer({ grupo, onBack }) {
  const router = useRouter()
  const [conteudos, setConteudos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [progresso, setProgresso] = useState({ concluidos: 0, total: 0, porcentagem: 0 })
  const [marcandoConcluido, setMarcandoConcluido] = useState(false)

  useEffect(() => {
    if (grupo?.id) {
      loadConteudos()
    }
  }, [grupo?.id])

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

  const loadConteudos = async () => {
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

    setLoading(true)
    setError('')
    
    try {
      // 1. Verificar se a empresa tem acesso ao grupo
      const vinculosRes = await fetch(`${API_URL}/empresa-conteudo/grupo-conteudo/${grupo.id}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!vinculosRes.ok) throw new Error('Falha ao verificar acesso ao grupo')
      const vinculosData = await vinculosRes.json()
      const vinculos = Array.isArray(vinculosData?.data) ? vinculosData.data : []

      const empresaTemAcesso = vinculos.some(v => v.empresa_id === empresaId)
      
      if (!empresaTemAcesso) {
        setError('Sua empresa não tem acesso a este grupo de conteúdo')
        return
      }

      // 2. Buscar conteúdos do grupo
      const conteudosRes = await fetch(`${API_URL}/conteudo?grupo_conteudo_id=${grupo.id}&limit=100`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!conteudosRes.ok) throw new Error('Falha ao carregar conteúdos')
      const conteudosData = await conteudosRes.json()
      const todosConteudos = Array.isArray(conteudosData?.data) ? conteudosData.data : []

      if (todosConteudos.length === 0) {
        setError('Nenhum conteúdo encontrado neste grupo')
        return
      }

      // 3. Os conteúdos já vêm com o campo 'concluido' da tabela conteudo
      // Não precisamos mais buscar na empresa_conteudo para verificar progresso individual
      const conteudosComStatus = todosConteudos.map(conteudo => ({
        ...conteudo,
        concluido: conteudo.concluido === 1
      }))

      setConteudos(conteudosComStatus)
      updateProgresso(conteudosComStatus)
      
    } catch (e) {
      setError(e.message || 'Erro ao carregar conteúdos')
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
        // Aqui você pode adicionar um toast ou modal de parabéns
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
      router.push(`/onboarding/${router.query.id}?grupo=${grupo.id}&conteudo=${novoIndex + 1}`, undefined, { shallow: true })
    }
  }

  const conteudoAnterior = () => {
    if (currentIndex > 0) {
      const novoIndex = currentIndex - 1
      setCurrentIndex(novoIndex)
      // Atualizar URL com o novo índice do conteúdo
      router.push(`/onboarding/${router.query.id}?grupo=${grupo.id}&conteudo=${novoIndex + 1}`, undefined, { shallow: true })
    }
  }

  const irParaConteudo = (index) => {
    setCurrentIndex(index)
    // Atualizar URL com o novo índice do conteúdo
    router.push(`/onboarding/${router.query.id}?grupo=${grupo.id}&conteudo=${index + 1}`, undefined, { shallow: true })
  }

  if (loading) return <div className={styles.placeholder}>Carregando conteúdos...</div>
  if (error) return <div className={`${styles.placeholder} ${styles.error}`}>{error}</div>
  if (!conteudos.length) return <div className={styles.placeholder}>Nenhum conteúdo encontrado.</div>

  const conteudoAtual = conteudos[currentIndex]

  return (
    <div className={styles.container}>
      {/* Botão de voltar acima do título */}
      <div>
        <button onClick={onBack} className={styles.backButton}>
          ← Voltar aos grupos
        </button>
      </div>

      {/* Header com progresso */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h2 className={styles.groupTitle}>{grupo.nome}</h2>
          <div className={styles.progressInfo}>
            <span>{progresso.concluidos} de {progresso.total} concluídos</span>
            <span className={styles.percentage}>({progresso.porcentagem}%)</span>
          </div>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill} 
          style={{ width: `${progresso.porcentagem}%` }}
        />
      </div>

      {/* Navegação de conteúdos */}
      <div className={styles.contentNavigation}>
        <div className={styles.contentCounter}>
          Conteúdo {currentIndex + 1} de {conteudos.length}
        </div>
        <div className={styles.contentTabs}>
          {conteudos.map((conteudo, index) => (
            <button
              key={conteudo.id}
              className={`${styles.tab} ${index === currentIndex ? styles.active : ''} ${conteudo.concluido ? styles.completed : ''}`}
              onClick={() => irParaConteudo(index)}
            >
              {conteudo.concluido ? '✓' : index + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo atual */}
      <div className={styles.currentContent}>
        <div className={styles.contentHeader}>
          <h3 className={styles.contentTitle}>{conteudoAtual.nome}</h3>
          {conteudoAtual.concluido && (
            <span className={styles.completedBadge}>Concluído</span>
          )}
        </div>
        
        {conteudoAtual.descricao && (
          <p className={styles.contentDescription}>{conteudoAtual.descricao}</p>
        )}

        {/* Player de vídeo */}
        {conteudoAtual.link && (
          <div className={styles.videoContainer}>
            <video 
              src={conteudoAtual.link} 
              className={styles.videoPlayer}
              poster={grupo.logo_url}
              controls
            />
          </div>
        )}

        {/* Botões de ação */}
        <div className={styles.actionButtons}>
          <button 
            onClick={conteudoAnterior} 
            disabled={currentIndex === 0}
            className={styles.navButton}
          >
            ← Anterior
          </button>
          
          {!conteudoAtual.concluido ? (
            <button 
              onClick={() => marcarComoConcluido(conteudoAtual)}
              disabled={marcandoConcluido}
              className={styles.completeButton}
            >
              {marcandoConcluido ? 'Marcando...' : '✓ Marcar como Concluído'}
            </button>
          ) : (
            <span className={styles.alreadyCompleted}>
              ✓ Este conteúdo já foi concluído
            </span>
          )}
          
          <button 
            onClick={proximoConteudo} 
            disabled={currentIndex === conteudos.length - 1}
            className={styles.navButton}
          >
            Próximo →
          </button>
        </div>
      </div>
    </div>
  )
}
