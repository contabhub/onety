import { useEffect, useState } from 'react'
import styles from './AlternativaList.module.css'
import SpaceLoader from '../../menu/SpaceLoader'
import { Plus, Edit3, Trash2, CheckCircle, Circle } from 'lucide-react'

export default function AlternativaList({ questaoId, onClose }) {
  const [alternativas, setAlternativas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingAlternativa, setEditingAlternativa] = useState(null)

  useEffect(() => {
    if (questaoId) {
      loadAlternativas()
    }
  }, [questaoId])

  const loadAlternativas = async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    setLoading(true)
    setError('')
    
    try {
      const res = await fetch(`${API_URL}/alternativa/questao/${questaoId}?limit=100`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!res.ok) throw new Error('Falha ao carregar alternativas')
      const data = await res.json()
      const alternativasData = Array.isArray(data?.data) ? data.data : []
      
      setAlternativas(alternativasData)
    } catch (e) {
      setError(e.message || 'Erro ao carregar alternativas')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAlternativa = () => {
    setEditingAlternativa(null)
    setShowCreateModal(true)
  }

  const handleEditAlternativa = (alternativa) => {
    setEditingAlternativa(alternativa)
    setShowCreateModal(true)
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
      
      if (!res.ok) throw new Error('Falha ao excluir alternativa')
      
      // Recarregar lista
      loadAlternativas()
    } catch (e) {
      setError(e.message || 'Erro ao excluir alternativa')
    }
  }

  const handleToggleCorreta = async (alternativa) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    try {
      // Se está marcando como correta, primeiro desmarcar todas as outras
      if (!alternativa.correto) {
        // Desmarcar todas as alternativas desta questão
        const outrasAlternativas = alternativas.filter(a => a.id !== alternativa.id)
        for (const alt of outrasAlternativas) {
          if (alt.correto) {
            await fetch(`${API_URL}/alternativa/${alt.id}`, {
              method: 'PATCH',
              headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ correto: 0 })
            })
          }
        }
      }

      // Atualizar a alternativa atual
      const res = await fetch(`${API_URL}/alternativa/${alternativa.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ correto: alternativa.correto ? 0 : 1 })
      })
      
      if (!res.ok) throw new Error('Falha ao atualizar alternativa')
      
      // Recarregar lista
      loadAlternativas()
    } catch (e) {
      setError(e.message || 'Erro ao atualizar alternativa')
    }
  }

  const handleModalClose = () => {
    setShowCreateModal(false)
    setEditingAlternativa(null)
  }

  const handleAlternativaSaved = () => {
    handleModalClose()
    loadAlternativas()
  }

  if (loading) return <SpaceLoader label="Carregando alternativas..." />
  if (error) return <div className={`${styles.placeholder} ${styles.error}`}>{error}</div>

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Alternativas de Resposta</h3>
        <p className={styles.subtitle}>Cada questão tem suas próprias alternativas</p>
        <div className={styles.headerActions}>
          <button 
            onClick={handleCreateAlternativa}
            className={styles.createButton}
          >
            <Plus size={16} />
            Nova Alternativa
          </button>
          <button 
            onClick={onClose}
            className={styles.closeButton}
          >
            Fechar
          </button>
        </div>
      </div>

      {alternativas.length === 0 ? (
        <div className={styles.emptyState}>
          <Circle size={48} className={styles.emptyIcon} />
          <h4>Nenhuma alternativa encontrada</h4>
          <p>Esta questão ainda não possui alternativas de resposta</p>
          <button 
            onClick={handleCreateAlternativa}
            className={styles.createFirstButton}
          >
            <Plus size={16} />
            Criar Primeira Alternativa
          </button>
        </div>
      ) : (
        <div className={styles.alternativasList}>
          {alternativas.map((alternativa, index) => (
            <div key={alternativa.id} className={styles.alternativaCard}>
              <div className={styles.alternativaHeader}>
                <div className={styles.alternativaInfo}>
                  <span className={styles.alternativaLetter}>
                    {String.fromCharCode(65 + index)} {/* A, B, C, D... */}
                  </span>
                  <span className={styles.alternativaText}>
                    {alternativa.opcao}
                  </span>
                </div>
                <div className={styles.alternativaActions}>
                  <button 
                    onClick={() => handleToggleCorreta(alternativa)}
                    className={`${styles.corretaButton} ${alternativa.correto ? styles.correta : ''}`}
                    title={alternativa.correto ? 'Marcar como incorreta' : 'Marcar como correta'}
                  >
                    {alternativa.correto ? <CheckCircle size={20} /> : <Circle size={20} />}
                  </button>
                  <button 
                    onClick={() => handleEditAlternativa(alternativa)}
                    className={styles.actionButton}
                    title="Editar alternativa"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteAlternativa(alternativa)}
                    className={`${styles.actionButton} ${styles.deleteButton}`}
                    title="Excluir alternativa"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              {alternativa.correto && (
                <div className={styles.corretaBadge}>
                  ✓ Alternativa Correta
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de criação/edição de alternativa */}
      {showCreateModal && (
        <AlternativaModal
          alternativa={editingAlternativa}
          questaoId={questaoId}
          onClose={handleModalClose}
          onSaved={handleAlternativaSaved}
        />
      )}
    </div>
  )
}

// Componente modal para criar/editar alternativa
function AlternativaModal({ alternativa, questaoId, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    opcao: alternativa?.opcao || '',
    correto: alternativa?.correto || 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.opcao.trim()) {
      setError('Opção é obrigatória')
      return
    }

    setLoading(true)
    setError('')

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    try {
      const url = alternativa ? `${API_URL}/alternativa/${alternativa.id}` : `${API_URL}/alternativa`
      const method = alternativa ? 'PATCH' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          questao_id: questaoId
        })
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Falha ao salvar alternativa')
      }
      
      onSaved()
    } catch (e) {
      setError(e.message || 'Erro ao salvar alternativa')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>{alternativa ? 'Editar Alternativa' : 'Nova Alternativa'}</h3>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="opcao">Texto da Alternativa</label>
            <textarea
              id="opcao"
              value={formData.opcao}
              onChange={(e) => setFormData({ ...formData, opcao: e.target.value })}
              placeholder="Digite o texto da alternativa"
              rows={3}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.correto === 1}
                onChange={(e) => setFormData({ ...formData, correto: e.target.checked ? 1 : 0 })}
              />
              <span className={styles.checkboxText}>Esta é a alternativa correta</span>
            </label>
          </div>
          
          {error && <div className={styles.errorMessage}>{error}</div>}
          
          <div className={styles.modalActions}>
            <button 
              type="button" 
              onClick={onClose}
              className={styles.cancelButton}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className={styles.saveButton}
            >
              {loading ? 'Salvando...' : (alternativa ? 'Atualizar' : 'Criar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
