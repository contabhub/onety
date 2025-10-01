import { useState } from 'react'
import { toast } from 'react-toastify'
import styles from './QuestaoList.module.css'

export default function AlternativaModal({ alternativa, questaoId, onClose, onSaved }) {
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
        const errorMessage = errorData.error || 'Falha ao salvar alternativa'
        setError(errorMessage)
        toast.error(errorMessage)
        return
      }
      
      toast.success(alternativa ? 'Alternativa atualizada com sucesso' : 'Alternativa criada com sucesso')
      onSaved()
    } catch (e) {
      const errorMessage = 'Erro de conexão. Tente novamente.'
      setError(errorMessage)
      toast.error(errorMessage)
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
