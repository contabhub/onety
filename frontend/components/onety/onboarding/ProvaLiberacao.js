import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { toast } from 'react-toastify'
import styles from './ProvaLiberacao.module.css'
import { CheckCircle, Lock, Play, Trophy, Clock } from 'lucide-react'

export default function ProvaLiberacao({ moduloId, onProvaLiberada }) {
  const router = useRouter()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [liberando, setLiberando] = useState(false)
  const [forcando, setForcando] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [provasLiberadas, setProvasLiberadas] = useState([])

  useEffect(() => {
    if (moduloId) {
      verificarStatusModulo()
      buscarProvasLiberadas()
    }
  }, [moduloId])

  const verificarStatusModulo = async () => {
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
      const res = await fetch(`${API_URL}/prova-empresa/status-modulo/${moduloId}?empresa_id=${empresaId}&viewer_id=${viewerId}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!res.ok) throw new Error('Falha ao verificar status do módulo')
      const data = await res.json()
      setStatus(data)
    } catch (e) {
      setError(e.message || 'Erro ao verificar status do módulo')
    } finally {
      setLoading(false)
    }
  }

  const liberarProva = async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
    const user = userRaw ? JSON.parse(userRaw) : null
    const empresaId = user?.EmpresaId || user?.empresa?.id || null
    const viewerId = user?.id

    if (!empresaId || !viewerId) {
      toast.error('Dados de usuário ou empresa não encontrados')
      return
    }

    setLiberando(true)
    
    try {
      const res = await fetch(`${API_URL}/prova-empresa/liberar-prova`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modulo_id: moduloId,
          empresa_id: empresaId,
          viewer_id: viewerId
        })
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Falha ao liberar prova')
      }
      
      const data = await res.json()
      toast.success(data.mensagem)
      
      // Recarregar status e provas
      await verificarStatusModulo()
      await buscarProvasLiberadas()
      
      // Notificar componente pai
      if (onProvaLiberada) {
        onProvaLiberada(data)
      }
    } catch (e) {
      toast.error(e.message || 'Erro ao liberar prova')
    } finally {
      setLiberando(false)
    }
  }

  const forcarConclusaoGrupo = async (grupoId) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
    const user = userRaw ? JSON.parse(userRaw) : null
    const empresaId = user?.EmpresaId || user?.empresa?.id || null
    const viewerId = user?.id

    if (!empresaId || !viewerId) {
      toast.error('Dados de usuário ou empresa não encontrados')
      return
    }

    setForcando(true)
    
    try {
      const res = await fetch(`${API_URL}/prova-empresa/forcar-conclusao-grupo`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grupo_conteudo_id: grupoId,
          empresa_id: empresaId,
          viewer_id: viewerId
        })
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Falha ao forçar conclusão do grupo')
      }
      
      const data = await res.json()
      toast.success(data.mensagem)
      
      // Recarregar status
      await verificarStatusModulo()
    } catch (e) {
      toast.error(e.message || 'Erro ao forçar conclusão do grupo')
    } finally {
      setForcando(false)
    }
  }

  const buscarProvasLiberadas = async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const userRaw = typeof window !== 'undefined' ? localStorage.getItem('userData') : null
    const user = userRaw ? JSON.parse(userRaw) : null
    const empresaId = user?.EmpresaId || user?.empresa?.id || null
    const viewerId = user?.id

    if (!empresaId || !viewerId) {
      return
    }

    try {
      const res = await fetch(`${API_URL}/prova-empresa/empresa/${empresaId}?viewer_id=${viewerId}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (res.ok) {
        const data = await res.json()
        // Filtrar apenas provas deste módulo
        const provasDoModulo = data.data?.filter(prova => {
          // Aqui você pode adicionar lógica para filtrar por módulo se necessário
          return true
        }) || []
        setProvasLiberadas(provasDoModulo)
      }
    } catch (e) {
      console.error('Erro ao buscar provas liberadas:', e)
    }
  }

  const navegarParaProva = (provaEmpresaId) => {
    router.push(`/onboarding/${moduloId}/realizar-prova/${provaEmpresaId}`)
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Clock size={24} className={styles.loadingIcon} />
          <span>Verificando status do módulo...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <span>{error}</span>
        </div>
      </div>
    )
  }

  if (!status) {
    return null
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Status do Módulo</h3>
        <div className={styles.progress}>
          <span className={styles.progressText}>
            {status.grupos_concluidos} de {status.total_grupos} grupos concluídos
          </span>
          <span className={styles.progressPercentage}>
            ({status.porcentagem}%)
          </span>
          <button 
            onClick={() => setShowDebug(!showDebug)}
            className={styles.debugButton}
          >
            {showDebug ? 'Ocultar Debug' : 'Mostrar Debug'}
          </button>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill} 
          style={{ width: `${status.porcentagem}%` }}
        />
      </div>

      {/* Status da prova */}
      <div className={styles.provaStatus}>
        {status.modulo_completo ? (
          <div className={styles.provaLiberada}>
            <div className={styles.statusIcon}>
              <CheckCircle size={24} />
            </div>
            <div className={styles.statusContent}>
              <h4>Módulo Concluído! 🎉</h4>
              <p>Parabéns! Você concluiu todos os grupos de conteúdo deste módulo.</p>
              
              {status.provas_liberadas > 0 ? (
                <div className={styles.provaDisponivel}>
                  <div className={styles.provaInfo}>
                    <Trophy size={20} />
                    <span>Prova disponível para realização</span>
                  </div>
                  {provasLiberadas.length > 0 ? (
                    <div className={styles.provasList}>
                      {provasLiberadas.map((prova, index) => (
                        <button 
                          key={prova.id}
                          onClick={() => navegarParaProva(prova.id)}
                          className={styles.fazerProvaButton}
                        >
                          <Play size={16} />
                          Fazer Prova {index + 1}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button 
                      onClick={() => buscarProvasLiberadas()}
                      className={styles.fazerProvaButton}
                    >
                      <Play size={16} />
                      Carregar Provas
                    </button>
                  )}
                </div>
              ) : (
                <div className={styles.liberarProva}>
                  <p>Clique no botão abaixo para liberar a prova:</p>
                  <button 
                    onClick={liberarProva}
                    disabled={liberando}
                    className={styles.liberarButton}
                  >
                    {liberando ? (
                      <>
                        <Clock size={16} />
                        Liberando...
                      </>
                    ) : (
                      <>
                        <Play size={16} />
                        Liberar Prova
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.provaBloqueada}>
            <div className={styles.statusIcon}>
              <Lock size={24} />
            </div>
            <div className={styles.statusContent}>
              <h4>Prova Bloqueada</h4>
              <p>Complete todos os grupos de conteúdo para liberar a prova.</p>
              <div className={styles.progressoRestante}>
                <span>Faltam {status.total_grupos - status.grupos_concluidos} grupos para concluir</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Debug Info */}
      {showDebug && status.debug && (
        <div className={styles.debugContainer}>
          <h4>Debug Info</h4>
          <div className={styles.debugSection}>
            <h5>Grupos:</h5>
            {status.debug.grupos.map((grupo, index) => (
              <div key={index} className={styles.debugItem}>
                <span><strong>{grupo.nome}</strong></span>
                <span>Concluído: {grupo.concluido ? 'Sim' : 'Não'}</span>
                {!grupo.concluido && (
                  <button 
                    onClick={() => forcarConclusaoGrupo(grupo.id)}
                    disabled={forcando}
                    className={styles.forcarButton}
                  >
                    {forcando ? 'Forçando...' : 'Forçar Conclusão'}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className={styles.debugSection}>
            <h5>Conteúdos por Grupo:</h5>
            {status.debug.conteudos_por_grupo.map((grupo, index) => (
              <div key={index} className={styles.debugItem}>
                <span><strong>{grupo.grupo_nome}</strong></span>
                <span>{grupo.conteudos_concluidos}/{grupo.total_conteudos} conteúdos concluídos</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
