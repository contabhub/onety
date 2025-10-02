import { useState, useEffect } from 'react'
import styles from './ConteudoModal.module.css'

export default function ConteudoModal({ isOpen, onClose, moduloId, onSuccess }) {
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tipo: 'texto',
    url: '',
    grupo_id: '',
    obrigatorio: true,
    ordem: 1
  })
  const [grupos, setGrupos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showGrupoModal, setShowGrupoModal] = useState(false)
  const [novoGrupo, setNovoGrupo] = useState({ nome: '', descricao: '' })

  // Carregar grupos quando o modal abre
  useEffect(() => {
    if (isOpen && moduloId) {
      loadGrupos()
    }
  }, [isOpen, moduloId])

  const loadGrupos = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/grupos?modulo_id=${moduloId}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      const data = await response.json()
      if (data.data) {
        setGrupos(data.data)
      }
    } catch (err) {
      console.error('Erro ao carregar grupos:', err)
    }
  }

  const handleCreateGrupo = async () => {
    if (!novoGrupo.nome.trim()) {
      setError('Nome do grupo é obrigatório')
      return
    }

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/grupos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          nome: novoGrupo.nome,
          descricao: novoGrupo.descricao,
          modulo_id: moduloId,
          ordem: grupos.length + 1
        })
      })

      if (response.ok) {
        const newGrupo = await response.json()
        setGrupos(prev => [...prev, newGrupo])
        setFormData(prev => ({ ...prev, grupo_id: newGrupo.id }))
        setNovoGrupo({ nome: '', descricao: '' })
        setShowGrupoModal(false)
        setError('')
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Erro ao criar grupo')
      }
    } catch (err) {
      setError('Erro de conexão ao criar grupo')
      console.error('Erro ao criar grupo:', err)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData(prev => ({
        ...prev,
        arquivo: file
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const formDataToSend = new FormData()
      
      // Adicionar campos do formulário
      Object.keys(formData).forEach(key => {
        if (key !== 'arquivo' && formData[key] !== '') {
          let value = formData[key]
          // Converter boolean para inteiro
          if (key === 'obrigatorio') {
            value = value ? '1' : '0'
          }
          formDataToSend.append(key, value)
        }
      })

      // Adicionar arquivo se existir
      if (formData.arquivo) {
        formDataToSend.append('arquivo', formData.arquivo)
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/conteudo`, {
        method: 'POST',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        body: formDataToSend
      })

      if (response.ok) {
        const newConteudo = await response.json()
        onSuccess?.(newConteudo)
        onClose()
        // Reset form
        setFormData({
          titulo: '',
          descricao: '',
          tipo: 'texto',
          url: '',
          grupo_id: '',
          obrigatorio: true,
          ordem: 1
        })
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Erro ao criar conteúdo')
      }
    } catch (err) {
      setError('Erro de conexão')
      console.error('Erro ao criar conteúdo:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2>Novo Conteúdo</h2>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <label className={styles.label}>
            Título *
            <input
              type="text"
              className={styles.input}
              name="titulo"
              value={formData.titulo}
              onChange={handleInputChange}
              required
              placeholder="Digite o título do conteúdo"
            />
          </label>

          <label className={styles.label}>
            Descrição
            <textarea
              className={styles.textarea}
              name="descricao"
              value={formData.descricao}
              onChange={handleInputChange}
              placeholder="Descreva o conteúdo"
            />
          </label>

          <label className={styles.label}>
            Tipo *
            <select
              className={styles.select}
              name="tipo"
              value={formData.tipo}
              onChange={handleInputChange}
              required
            >
              <option value="texto">Texto</option>
              <option value="video">Vídeo</option>
              <option value="pdf">PDF</option>
              <option value="quiz">Quiz</option>
              <option value="link">Link</option>
              <option value="outro">Outro</option>
            </select>
          </label>

          <label className={styles.label}>
            Grupo *
            <div className={styles.grupoRow}>
              <select
                className={`${styles.select} ${styles.grupoSelect}`}
                name="grupo_id"
                value={formData.grupo_id}
                onChange={handleInputChange}
                required
              >
                <option value="">Selecione um grupo</option>
                {grupos.map(grupo => (
                  <option key={grupo.id} value={grupo.id}>
                    {grupo.nome}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.addGrupoBtn}
                onClick={() => setShowGrupoModal(true)}
              >
                + Novo Grupo
              </button>
            </div>
          </label>

          <label className={styles.label}>
            URL
            <input
              type="url"
              className={styles.input}
              name="url"
              value={formData.url}
              onChange={handleInputChange}
              placeholder="https://exemplo.com"
            />
          </label>

          <label className={styles.label}>
            Arquivo
            <input
              type="file"
              className={styles.fileInput}
              name="arquivo"
              onChange={handleFileChange}
              accept="video/*,.pdf"
            />
            <div className={styles.fileHint}>
              Formatos aceitos: vídeo (MP4, AVI, etc.) e PDF
            </div>
          </label>

          <label className={styles.label}>
            Ordem
            <input
              type="number"
              className={styles.input}
              name="ordem"
              value={formData.ordem}
              onChange={handleInputChange}
              min="1"
            />
          </label>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="obrigatorio"
              checked={formData.obrigatorio}
              onChange={handleInputChange}
            />
            Conteúdo obrigatório
          </label>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancel}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.save}
              disabled={loading}
            >
              {loading ? 'Criando...' : 'Criar Conteúdo'}
            </button>
          </div>
        </form>

      </div>
    </div>

    {/* Modal separado para criar novo grupo */}
    {showGrupoModal && (
      <div className={`${styles.backdrop} ${styles.grupoModal}`} onClick={() => setShowGrupoModal(false)}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <h3>Novo Grupo</h3>
          <div className={styles.form}>
            <label className={styles.label}>
              Nome *
              <input
                type="text"
                className={styles.input}
                value={novoGrupo.nome}
                onChange={(e) => setNovoGrupo(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Digite o nome do grupo"
                required
              />
            </label>
            <label className={styles.label}>
              Descrição
              <textarea
                className={styles.textarea}
                value={novoGrupo.descricao}
                onChange={(e) => setNovoGrupo(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descreva o grupo"
              />
            </label>
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => setShowGrupoModal(false)}
                className={styles.cancel}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateGrupo}
                className={styles.save}
              >
                Criar Grupo
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  )
}