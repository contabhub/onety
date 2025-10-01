import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { toast } from 'react-toastify'
import styles from '../../../../styles/onety/onboarding/onboarding.module.css'
import questaoStyles from '../../../../components/onety/onboarding/QuestaoList.module.css'
import Topbar from '../../../../components/onety/onboarding/Topbar'
import OnboardingSidebar from '../../../../components/onety/onboarding/Sidebar'
import AlternativaModal from '../../../../components/onety/onboarding/AlternativaModal'

export default function QuestaoListPage() {
  const router = useRouter()
  const { id: moduloId, provaId } = router.query
  const [prova, setProva] = useState(null)
  const [questoes, setQuestoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingQuestao, setEditingQuestao] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [selectedQuestao, setSelectedQuestao] = useState(null)
  const [questaoAlternativas, setQuestaoAlternativas] = useState({})
  const [showAlternativaModal, setShowAlternativaModal] = useState(false)
  const [editingAlternativa, setEditingAlternativa] = useState(null)

  useEffect(() => {
    if (provaId) {
      loadProvaAndQuestoes()
    }
  }, [provaId])

  const loadProvaAndQuestoes = async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    setLoading(true)
    setError('')
    
    try {
      // 1. Buscar informações da prova
      const provaRes = await fetch(`${API_URL}/prova/${provaId}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!provaRes.ok) throw new Error('Falha ao carregar prova')
      const provaData = await provaRes.json()
      setProva(provaData)

      // 2. Buscar questões da prova
      const questoesRes = await fetch(`${API_URL}/questao/prova/${provaId}?limit=100`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!questoesRes.ok) throw new Error('Falha ao carregar questões')
      const questoesData = await questoesRes.json()
      const questoesList = Array.isArray(questoesData?.data) ? questoesData.data : []
      
      setQuestoes(questoesList)
    } catch (e) {
      setError(e.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateQuestao = () => {
    setEditingQuestao(null)
    setShowCreateModal(true)
  }

  const handleEditQuestao = (questao) => {
    setEditingQuestao(questao)
    setShowCreateModal(true)
  }

  const handleDeleteQuestao = async (questao) => {
    if (!confirm(`Tem certeza que deseja excluir esta questão?`)) {
      return
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    try {
      const res = await fetch(`${API_URL}/questao/${questao.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!res.ok) throw new Error('Falha ao excluir questão')
      
      // Recarregar lista
      loadProvaAndQuestoes()
    } catch (e) {
      setError(e.message || 'Erro ao excluir questão')
    }
  }

  const handleModalClose = () => {
    setShowCreateModal(false)
    setEditingQuestao(null)
  }

  const handleQuestaoSaved = () => {
    handleModalClose()
    loadProvaAndQuestoes()
  }

  const loadAlternativasQuestao = async (questaoId) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    try {
      const res = await fetch(`${API_URL}/alternativa/questao/${questaoId}?limit=100`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!res.ok) throw new Error('Falha ao carregar alternativas')
      const data = await res.json()
      const alternativasData = Array.isArray(data?.data) ? data.data : []
      
      setQuestaoAlternativas(prev => ({
        ...prev,
        [questaoId]: alternativasData
      }))
    } catch (e) {
      console.error('Erro ao carregar alternativas:', e)
    }
  }

  const handleViewAlternativas = (questao) => {
    if (selectedQuestao?.id === questao.id) {
      // Se já está selecionada, fecha
      setSelectedQuestao(null)
    } else {
      // Seleciona a questão e carrega alternativas
      setSelectedQuestao(questao)
      loadAlternativasQuestao(questao.id)
    }
  }

  const handleCloseAlternativas = () => {
    setSelectedQuestao(null)
  }

  const handleCreateAlternativa = () => {
    setEditingAlternativa(null)
    setShowAlternativaModal(true)
  }

  const handleEditAlternativa = (alternativa) => {
    setEditingAlternativa(alternativa)
    setShowAlternativaModal(true)
  }

  const handleDeleteAlternativa = async (alternativa) => {
    if (!confirm(`Tem certeza que deseja excluir esta alternativa?`)) {
      return
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    try {
      const res = await fetch(`${API_URL}/alternativa/${alternativa.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Falha ao excluir alternativa')
      }
      
      // Recarregar alternativas da questão
      if (selectedQuestao) {
        loadAlternativasQuestao(selectedQuestao.id)
      }
      
      toast.success('Alternativa excluída com sucesso')
    } catch (e) {
      console.error('Erro ao excluir alternativa:', e)
      toast.error(e.message || 'Erro ao excluir alternativa')
    }
  }

  const handleToggleCorreta = async (alternativa) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    try {
      // Atualizar a alternativa atual
      const res = await fetch(`${API_URL}/alternativa/${alternativa.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ correto: alternativa.correto ? 0 : 1 })
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        // Mostrar toast de erro e retornar sem lançar exceção
        toast.error(errorData.error || 'Falha ao atualizar alternativa')
        return
      }
      
      // Recarregar alternativas
      if (selectedQuestao) {
        loadAlternativasQuestao(selectedQuestao.id)
      }
      
      // Mostrar notificação de sucesso
      toast.success(alternativa.correto ? 'Alternativa desmarcada como correta' : 'Alternativa marcada como correta')
    } catch (e) {
      console.error('Erro ao atualizar alternativa:', e)
      toast.error('Erro de conexão. Tente novamente.')
    }
  }

  const handleAlternativaModalClose = () => {
    setShowAlternativaModal(false)
    setEditingAlternativa(null)
  }

  const handleAlternativaSaved = () => {
    handleAlternativaModalClose()
    if (selectedQuestao) {
      loadAlternativasQuestao(selectedQuestao.id)
    }
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
              currentTab="provas" 
              onChangeTab={() => router.push(`/onboarding/${moduloId}`)} 
              onCollapseChange={setSidebarCollapsed}
            />
            <main className={styles.main}>
              <div className={questaoStyles.placeholder}>Carregando questões...</div>
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
              currentTab="provas" 
              onChangeTab={() => router.push(`/onboarding/${moduloId}`)} 
              onCollapseChange={setSidebarCollapsed}
            />
            <main className={styles.main}>
              <div className={`${questaoStyles.placeholder} ${questaoStyles.error}`}>{error}</div>
            </main>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Head>
        <title>{prova?.nome || 'Questões da Prova'}</title>
      </Head>
      <Topbar sidebarCollapsed={sidebarCollapsed} />
      <div className={styles.layout}>
        <div className={`${styles.contentWrapper} ${sidebarCollapsed ? styles.sidebarCollapsed : styles.sidebarExpanded}`}>
          <OnboardingSidebar 
            currentTab="provas" 
            onChangeTab={() => router.push(`/onboarding/${moduloId}`)} 
            onCollapseChange={setSidebarCollapsed}
          />
          <main className={styles.main}>
            <div className={questaoStyles.container}>
              {/* Botão de voltar */}
              <div>
                <button onClick={handleVoltar} className={questaoStyles.backButton}>
                  ← Voltar às provas
                </button>
              </div>

              {/* Header */}
              <div className={questaoStyles.header}>
                <h2 className={questaoStyles.title}>{prova?.nome}</h2>
                <button 
                  onClick={handleCreateQuestao}
                  className={questaoStyles.createButton}
                >
                  + Nova Questão
                </button>
              </div>

              {questoes.length === 0 ? (
                <div className={questaoStyles.emptyState}>
                  <h3>Nenhuma questão encontrada</h3>
                  <p>Crie a primeira questão para esta prova</p>
                  <button 
                    onClick={handleCreateQuestao}
                    className={questaoStyles.createFirstButton}
                  >
                    + Criar Primeira Questão
                  </button>
                </div>
              ) : (
                <div className={questaoStyles.questoesList}>
                  {questoes.map((questao, index) => (
                    <div key={questao.id} className={questaoStyles.questaoCard}>
                      <div className={questaoStyles.questaoHeader}>
                        <div className={questaoStyles.questaoNumber}>
                          Questão {index + 1}
                        </div>
                        <div className={questaoStyles.questaoActions}>
                          <button 
                            onClick={() => handleEditQuestao(questao)}
                            className={questaoStyles.actionButton}
                            title="Editar questão"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => handleDeleteQuestao(questao)}
                            className={`${questaoStyles.actionButton} ${questaoStyles.deleteButton}`}
                            title="Excluir questão"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      
                      <div className={questaoStyles.questaoContent}>
                        <p className={questaoStyles.questaoEnunciado}>
                          {questao.enunciado}
                        </p>
                        
                        {/* Alternativas da questão */}
                        {selectedQuestao?.id === questao.id && (
                          <div className={questaoStyles.alternativasContainer}>
                            <div className={questaoStyles.alternativasHeader}>
                              <h4>Alternativas de Resposta</h4>
                              <button 
                                onClick={() => handleCloseAlternativas()}
                                className={questaoStyles.closeAlternativasButton}
                              >
                                ✕
                              </button>
                            </div>
                            
                            {questaoAlternativas[questao.id]?.length > 0 ? (
                              <div className={questaoStyles.alternativasList}>
                                {questaoAlternativas[questao.id].map((alternativa, index) => (
                                  <div key={alternativa.id} className={questaoStyles.alternativaItem}>
                                    <span className={questaoStyles.alternativaLetter}>
                                      {String.fromCharCode(65 + index)}
                                    </span>
                                    <span className={questaoStyles.alternativaText}>
                                      {alternativa.opcao}
                                    </span>
                                    <div className={questaoStyles.alternativaActions}>
                                      <button 
                                        onClick={() => handleToggleCorreta(alternativa)}
                                        className={`${questaoStyles.corretaButton} ${alternativa.correto ? questaoStyles.correta : ''}`}
                                        title={alternativa.correto ? 'Marcar como incorreta' : 'Marcar como correta'}
                                      >
                                        {alternativa.correto ? '✓' : '○'}
                                      </button>
                                      <button 
                                        onClick={() => handleEditAlternativa(alternativa)}
                                        className={questaoStyles.actionButton}
                                        title="Editar alternativa"
                                      >
                                        ✏️
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteAlternativa(alternativa)}
                                        className={`${questaoStyles.actionButton} ${questaoStyles.deleteButton}`}
                                        title="Excluir alternativa"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                <button 
                                  onClick={handleCreateAlternativa}
                                  className={questaoStyles.addAlternativaButton}
                                >
                                  + Adicionar Alternativa
                                </button>
                              </div>
                            ) : (
                              <div className={questaoStyles.noAlternativas}>
                                <p>Nenhuma alternativa cadastrada para esta questão</p>
                                <button 
                                  onClick={handleCreateAlternativa}
                                  className={questaoStyles.addAlternativaButton}
                                >
                                  + Adicionar Alternativa
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className={questaoStyles.questaoFooter}>
                          <button 
                            onClick={() => handleViewAlternativas(questao)}
                            className={questaoStyles.alternativasButton}
                          >
                            {selectedQuestao?.id === questao.id ? '📝 Ocultar Alternativas' : '📝 Ver Alternativas'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Modal de criação/edição de questão */}
              {showCreateModal && (
                <QuestaoModal
                  questao={editingQuestao}
                  provaId={provaId}
                  onClose={handleModalClose}
                  onSaved={handleQuestaoSaved}
                />
              )}

              {/* Modal de criação/edição de alternativa */}
              {showAlternativaModal && (
                <AlternativaModal
                  alternativa={editingAlternativa}
                  questaoId={selectedQuestao?.id}
                  onClose={handleAlternativaModalClose}
                  onSaved={handleAlternativaSaved}
                />
              )}

            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

// Componente modal para criar/editar questão
function QuestaoModal({ questao, provaId, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    enunciado: questao?.enunciado || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.enunciado.trim()) {
      setError('Enunciado é obrigatório')
      return
    }

    setLoading(true)
    setError('')

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    try {
      const url = questao ? `${API_URL}/questao/${questao.id}` : `${API_URL}/questao`
      const method = questao ? 'PATCH' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          prova_id: provaId
        })
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Falha ao salvar questão')
      }
      
      onSaved()
    } catch (e) {
      setError(e.message || 'Erro ao salvar questão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={questaoStyles.modalOverlay}>
      <div className={questaoStyles.modal}>
        <div className={questaoStyles.modalHeader}>
          <h3>{questao ? 'Editar Questão' : 'Nova Questão'}</h3>
          <button onClick={onClose} className={questaoStyles.closeButton}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className={questaoStyles.modalForm}>
          <div className={questaoStyles.formGroup}>
            <label htmlFor="enunciado">Enunciado da Questão</label>
            <textarea
              id="enunciado"
              value={formData.enunciado}
              onChange={(e) => setFormData({ ...formData, enunciado: e.target.value })}
              placeholder="Digite o enunciado da questão"
              rows={6}
              required
            />
          </div>
          
          {error && <div className={questaoStyles.errorMessage}>{error}</div>}
          
          <div className={questaoStyles.modalActions}>
            <button 
              type="button" 
              onClick={onClose}
              className={questaoStyles.cancelButton}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className={questaoStyles.saveButton}
            >
              {loading ? 'Salvando...' : (questao ? 'Atualizar' : 'Criar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
