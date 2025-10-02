import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import styles from './ProvaList.module.css'
import SpaceLoader from '../menu/SpaceLoader'
import { Plus, FileText, Edit3, Trash2, Eye } from 'lucide-react'

export default function ProvaList({ moduloId }) {
  const router = useRouter()
  const [provas, setProvas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProva, setEditingProva] = useState(null)

  useEffect(() => {
    if (moduloId) {
      loadProvas()
    }
  }, [moduloId])

  const loadProvas = async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    setLoading(true)
    setError('')
    
    try {
      // Buscar provas relacionadas aos conteúdos do módulo
      const res = await fetch(`${API_URL}/prova?limit=100`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!res.ok) throw new Error('Falha ao carregar provas')
      const data = await res.json()
      const provasData = Array.isArray(data?.data) ? data.data : []
      
      setProvas(provasData)
    } catch (e) {
      setError(e.message || 'Erro ao carregar provas')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProva = () => {
    setEditingProva(null)
    setShowCreateModal(true)
  }

  const handleEditProva = (prova) => {
    setEditingProva(prova)
    setShowCreateModal(true)
  }

  const handleDeleteProva = async (prova) => {
    if (!confirm(`Tem certeza que deseja excluir a prova "${prova.nome}"?`)) {
      return
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    try {
      const res = await fetch(`${API_URL}/prova/${prova.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!res.ok) throw new Error('Falha ao excluir prova')
      
      // Recarregar lista
      loadProvas()
    } catch (e) {
      setError(e.message || 'Erro ao excluir prova')
    }
  }

  const handleViewQuestoes = (prova) => {
    router.push(`/onboarding/${moduloId}/prova/${prova.id}`)
  }

  const handleModalClose = () => {
    setShowCreateModal(false)
    setEditingProva(null)
  }

  const handleProvaSaved = () => {
    handleModalClose()
    loadProvas()
  }

  if (loading) return <SpaceLoader label="Carregando provas..." />
  if (error) return <div className={`${styles.placeholder} ${styles.error}`}>{error}</div>

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Provas do Módulo</h2>
        <button 
          onClick={handleCreateProva}
          className={styles.createButton}
        >
          <Plus size={16} />
          Nova Prova
        </button>
      </div>

      {provas.length === 0 ? (
        <div className={styles.emptyState}>
          <FileText size={48} className={styles.emptyIcon} />
          <h3>Nenhuma prova encontrada</h3>
          <p>Crie sua primeira prova para este módulo</p>
          <button 
            onClick={handleCreateProva}
            className={styles.createFirstButton}
          >
            <Plus size={16} />
            Criar Primeira Prova
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {provas.map((prova) => (
            <div key={prova.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{prova.nome}</h3>
                <div className={styles.cardActions}>
                  <button 
                    onClick={() => handleViewQuestoes(prova)}
                    className={styles.actionButton}
                    title="Ver questões"
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    onClick={() => handleEditProva(prova)}
                    className={styles.actionButton}
                    title="Editar prova"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteProva(prova)}
                    className={`${styles.actionButton} ${styles.deleteButton}`}
                    title="Excluir prova"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className={styles.cardContent}>
                <p className={styles.cardDescription}>
                  {prova.grupo_id ? (
                    <>Vincular ao Grupo ID: {prova.grupo_id}</>
                  ) : prova.conteudo_id ? (
                    <>Vincular ao Conteúdo ID: {prova.conteudo_id}</>
                  ) : (
                    <>Sem vínculo definido</>
                  )}
                </p>
                <div className={styles.cardMeta}>
                  <span className={styles.metaItem}>
                    Criada em: {new Date(prova.created_at || Date.now()).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de criação/edição de prova */}
      {showCreateModal && (
        <ProvaModal
          prova={editingProva}
          moduloId={moduloId}
          onClose={handleModalClose}
          onSaved={handleProvaSaved}
        />
      )}
    </div>
  )
}

// Componente modal para criar/editar prova
function ProvaModal({ prova, moduloId, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    nome: prova?.nome || '',
    grupo_id: prova?.grupo_id || '',
    conteudo_id: prova?.conteudo_id || '',
    tipo_vinculo: prova?.conteudo_id ? 'conteudo' : 'grupo' // 'grupo' ou 'conteudo'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [conteudos, setConteudos] = useState([])
  const [grupos, setGrupos] = useState([])
  const [loadingConteudos, setLoadingConteudos] = useState(false)

  // Carregar grupos primeiro
  useEffect(() => {
    if (moduloId) {
      loadGrupos()
    }
  }, [moduloId])

  // Carregar conteúdos depois que os grupos estiverem carregados
  useEffect(() => {
    if (moduloId && grupos.length > 0) {
      loadConteudos()
    }
  }, [moduloId, grupos])

  const loadGrupos = async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    try {
      const res = await fetch(`${API_URL}/grupos?modulo_id=${moduloId}&limit=100`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      })
      
      if (!res.ok) throw new Error('Falha ao carregar grupos')
      const data = await res.json()
      const gruposData = Array.isArray(data?.data) ? data.data : []
      
      console.log(`🔍 Debug ProvaList - Grupos carregados:`, gruposData)
      console.log(`🔍 Debug ProvaList - Total grupos: ${gruposData.length}`)
      
      setGrupos(gruposData)
    } catch (e) {
      console.error('Erro ao carregar grupos:', e)
      setGrupos([])
    }
  }

  const loadConteudos = async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    setLoadingConteudos(true)
    
    try {
      // Buscar conteúdos de todos os grupos do módulo
      const conteudosPromises = grupos.map(async (grupo) => {
        try {
          const conteudosRes = await fetch(`${API_URL}/conteudo?grupo_id=${grupo.id}&limit=100`, {
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
          })
          
          if (conteudosRes.ok) {
            const conteudosData = await conteudosRes.json()
            const conteudos = Array.isArray(conteudosData?.data) ? conteudosData.data : []
            return conteudos.map(conteudo => ({
              ...conteudo,
              grupo_nome: grupo.nome,
              grupo_id: grupo.id
            }))
          }
          return []
        } catch (error) {
          console.error(`Erro ao carregar conteúdos do grupo ${grupo.id}:`, error)
          return []
        }
      })
      
      const conteudosArrays = await Promise.all(conteudosPromises)
      const todosConteudos = conteudosArrays.flat()
      
      console.log(`🔍 Debug ProvaList - Conteúdos carregados:`, todosConteudos)
      console.log(`🔍 Debug ProvaList - Total grupos: ${grupos.length}`)
      console.log(`🔍 Debug ProvaList - Total conteúdos: ${todosConteudos.length}`)
      
      setConteudos(todosConteudos)
    } catch (e) {
      console.error('Erro ao carregar conteúdos:', e)
      setConteudos([])
    } finally {
      setLoadingConteudos(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.nome.trim()) {
      setError('Nome da prova é obrigatório')
      return
    }
    
    if (formData.tipo_vinculo === 'grupo' && !formData.grupo_id) {
      setError('Selecione um grupo')
      return
    }
    
    if (formData.tipo_vinculo === 'conteudo' && !formData.conteudo_id) {
      setError('Selecione um conteúdo')
      return
    }

    setLoading(true)
    setError('')

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    try {
      const url = prova ? `${API_URL}/prova/${prova.id}` : `${API_URL}/prova`
      const method = prova ? 'PATCH' : 'POST'
      
      // Preparar dados para envio
      const dadosParaEnvio = {
        nome: formData.nome,
        ...(formData.tipo_vinculo === 'grupo' ? { grupo_id: formData.grupo_id } : {}),
        ...(formData.tipo_vinculo === 'conteudo' ? { conteudo_id: formData.conteudo_id } : {})
      }
      
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dadosParaEnvio)
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Falha ao salvar prova')
      }
      
      onSaved()
    } catch (e) {
      setError(e.message || 'Erro ao salvar prova')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>{prova ? 'Editar Prova' : 'Nova Prova'}</h3>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="nome">Nome da Prova</label>
            <input
              id="nome"
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Digite o nome da prova"
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="tipo_vinculo">Tipo de Vínculo</label>
            <select
              id="tipo_vinculo"
              value={formData.tipo_vinculo}
              onChange={(e) => setFormData({ 
                ...formData, 
                tipo_vinculo: e.target.value,
                grupo_id: '',
                conteudo_id: ''
              })}
            >
              <option value="grupo">Vincular ao Grupo</option>
              <option value="conteudo">Vincular ao Conteúdo</option>
            </select>
          </div>

          {formData.tipo_vinculo === 'grupo' && (
            <div className={styles.formGroup}>
              <label htmlFor="grupo_id">Grupo</label>
              <select
                id="grupo_id"
                value={formData.grupo_id}
                onChange={(e) => setFormData({ ...formData, grupo_id: e.target.value })}
                required
              >
                <option value="">Selecione um grupo</option>
                {grupos.map(grupo => (
                  <option key={grupo.id} value={grupo.id}>
                    {grupo.nome}
                  </option>
                ))}
              </select>
              {grupos.length === 0 && (
                <div className={styles.emptyText}>Nenhum grupo encontrado para este módulo</div>
              )}
            </div>
          )}

          {formData.tipo_vinculo === 'conteudo' && (
            <div className={styles.formGroup}>
              <label htmlFor="conteudo_id">Conteúdo</label>
              {loadingConteudos ? (
                <div className={styles.loadingText}>Carregando conteúdos...</div>
              ) : (
                <select
                  id="conteudo_id"
                  value={formData.conteudo_id}
                  onChange={(e) => setFormData({ ...formData, conteudo_id: e.target.value })}
                  required
                >
                  <option value="">Selecione um conteúdo</option>
                  {conteudos.map(conteudo => (
                    <option key={conteudo.id} value={conteudo.id}>
                      {conteudo.titulo} (Grupo: {conteudo.grupo_nome})
                    </option>
                  ))}
                </select>
              )}
              {conteudos.length === 0 && !loadingConteudos && (
                <div className={styles.emptyText}>Nenhum conteúdo encontrado para este módulo</div>
              )}
            </div>
          )}
          
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
              {loading ? 'Salvando...' : (prova ? 'Atualizar' : 'Criar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
