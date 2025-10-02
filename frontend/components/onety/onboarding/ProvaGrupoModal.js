import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import styles from './ProvaGrupoModal.module.css'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export default function ProvaGrupoModal({ 
  isOpen, 
  onClose, 
  grupoId, 
  grupoNome, 
  onSuccess 
}) {
  const [loading, setLoading] = useState(false)
  const [provas, setProvas] = useState([])
  const [provasVinculadas, setProvasVinculadas] = useState([])
  const [selectedProva, setSelectedProva] = useState('')
  const [obrigatorio, setObrigatorio] = useState(false)
  const [ordem, setOrdem] = useState(1)

  useEffect(() => {
    if (isOpen && grupoId) {
      loadProvas()
      loadProvasVinculadas()
    }
  }, [isOpen, grupoId])

  const loadProvas = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/prova?limit=100`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (response.ok) {
        const data = await response.json()
        setProvas(data.data || [])
      }
    } catch (error) {
      console.error('Erro ao carregar provas:', error)
    }
  }


  const loadProvasVinculadas = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/prova-grupo/grupo/${grupoId}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (response.ok) {
        const data = await response.json()
        setProvasVinculadas(data.data || [])
      }
    } catch (error) {
      console.error('Erro ao carregar provas vinculadas:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedProva) {
      toast.error('Selecione uma prova')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/prova-grupo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          prova_id: selectedProva,
          grupo_id: grupoId,
          obrigatorio,
          ordem
        })
      })

      if (response.ok) {
        toast.success('Prova vinculada ao grupo com sucesso!')
        setSelectedProva('')
        setObrigatorio(false)
        setOrdem(1)
        loadProvasVinculadas()
        onSuccess?.()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erro ao vincular prova')
      }
    } catch (error) {
      console.error('Erro ao vincular prova:', error)
      toast.error('Erro ao vincular prova')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (provaGrupoId) => {
    if (!confirm('Tem certeza que deseja remover esta prova do grupo?')) return

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/prova-grupo/${provaGrupoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })

      if (response.ok) {
        toast.success('Prova removida do grupo com sucesso!')
        loadProvasVinculadas()
        onSuccess?.()
      } else {
        toast.error('Erro ao remover prova do grupo')
      }
    } catch (error) {
      console.error('Erro ao remover prova:', error)
      toast.error('Erro ao remover prova')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleObrigatorio = async (provaGrupoId, currentObrigatorio) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/prova-grupo/${provaGrupoId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          obrigatorio: !currentObrigatorio
        })
      })

      if (response.ok) {
        toast.success(`Prova ${!currentObrigatorio ? 'tornada obrigatória' : 'tornada opcional'} com sucesso!`)
        loadProvasVinculadas()
        onSuccess?.()
      } else {
        toast.error('Erro ao atualizar prova')
      }
    } catch (error) {
      console.error('Erro ao atualizar prova:', error)
      toast.error('Erro ao atualizar prova')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Gerenciar Provas do Grupo</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.content}>
          <div className={styles.grupoInfo}>
            <h3>Grupo: {grupoNome}</h3>
          </div>

          {/* Formulário para adicionar nova prova */}
          <form onSubmit={handleSubmit} className={styles.form}>
            <h4>Adicionar Nova Prova</h4>
            <div className={styles.formGroup}>
              <label>Prova:</label>
              <select 
                value={selectedProva} 
                onChange={(e) => setSelectedProva(e.target.value)}
                required
              >
                <option value="">Selecione uma prova</option>
                {provas
                  .filter(prova => !provasVinculadas.some(v => v.prova_id === prova.id))
                  .map(prova => (
                    <option key={prova.id} value={prova.id}>
                      {prova.nome}
                    </option>
                  ))
                }
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>
                <input 
                  type="checkbox" 
                  checked={obrigatorio}
                  onChange={(e) => setObrigatorio(e.target.checked)}
                />
                Prova Obrigatória
              </label>
            </div>

            <div className={styles.formGroup}>
              <label>Ordem:</label>
              <input 
                type="number" 
                value={ordem}
                onChange={(e) => setOrdem(parseInt(e.target.value) || 1)}
                min="1"
              />
            </div>

            <button type="submit" disabled={loading} className={styles.submitButton}>
              {loading ? 'Vinculando...' : 'Vincular Prova'}
            </button>
          </form>

          {/* Lista de provas vinculadas */}
          <div className={styles.provasList}>
            <h4>Provas Vinculadas ({provasVinculadas.length})</h4>
            {provasVinculadas.length === 0 ? (
              <p className={styles.empty}>Nenhuma prova vinculada a este grupo.</p>
            ) : (
              <div className={styles.provasGrid}>
                {provasVinculadas.map(prova => (
                  <div key={prova.id} className={styles.provaCard}>
                    <div className={styles.provaInfo}>
                      <h5>{prova.prova_nome}</h5>
                      <div className={styles.provaMeta}>
                        <span className={styles.ordem}>Ordem: {prova.ordem}</span>
                        <span className={`${styles.obrigatorio} ${prova.obrigatorio ? styles.obrigatorioTrue : styles.obrigatorioFalse}`}>
                          {prova.obrigatorio ? '🔒 Obrigatória' : '🔓 Opcional'}
                        </span>
                      </div>
                    </div>
                    <div className={styles.provaActions}>
                      <button 
                        onClick={() => handleToggleObrigatorio(prova.id, prova.obrigatorio)}
                        className={styles.toggleButton}
                        disabled={loading}
                      >
                        {prova.obrigatorio ? 'Tornar Opcional' : 'Tornar Obrigatória'}
                      </button>
                      <button 
                        onClick={() => handleRemove(prova.id)}
                        className={styles.removeButton}
                        disabled={loading}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
