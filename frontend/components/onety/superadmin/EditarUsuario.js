import { useEffect, useState } from 'react'
import { X, User, Mail, Phone } from 'lucide-react'
import SpaceLoader from '../menu/SpaceLoader'
import styles from './EditarUsuario.module.css'

export default function EditarUsuario({ open, onClose, usuario, onUpdated }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !usuario) return
    
    setNome(usuario.nome || usuario.name || '')
    setEmail(usuario.email || '')
    setTelefone(usuario.telefone || '')
    setAvatarPreview(usuario.avatar_url || null)
    setAvatarFile(null)
    setError('')
  }, [open, usuario])

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const url = URL.createObjectURL(file)
    setAvatarPreview(url)
  }


  const handleSave = async () => {
    if (!usuario) return
    setLoading(true)
    setError('')
    
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    
    try {
      // 1) Atualiza campos básicos
      const res = await fetch(`${API_URL}/usuarios/${usuario.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          nome, 
          email, 
          telefone
        })
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Falha ao atualizar dados')
      }
      
      let updated = await res.json()

      // 2) Se houver novo avatar, envia upload
      if (avatarFile) {
        const form = new FormData()
        form.append('avatar', avatarFile)
        const up = await fetch(`${API_URL}/usuarios/${usuario.id}/avatar`, {
          method: 'PATCH',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: form
        })
        if (!up.ok) {
          const errorData = await up.json()
          throw new Error(errorData.message || 'Falha ao enviar avatar')
        }
        updated = await up.json()
      }

      onUpdated && onUpdated(updated)
      onClose && onClose()
    } catch (e) {
      setError(e?.message || 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Editar Usuário</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <SpaceLoader label="Salvando alterações..." />
        ) : (
          <div className={styles.form}>
            <div className={styles.avatarRow}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className={styles.avatar} />
              ) : (
                <div className={styles.avatarFallback}>
                  {usuario?.nome?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
              <label className={styles.uploadBtn}>
                Alterar avatar
                <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
              </label>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                <span className={styles.labelTitle}>
                  <User size={16} />
                  <span>Nome</span>
                </span>
                <input 
                  className={styles.input} 
                  value={nome} 
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                />
              </label>
              
              <label className={styles.label}>
                <span className={styles.labelTitle}>
                  <Mail size={16} />
                  <span>Email</span>
                </span>
                <input 
                  className={styles.input} 
                  type="email"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </label>
            </div>

            <label className={styles.label}>
              <span className={styles.labelTitle}>
                <Phone size={16} />
                <span>Telefone</span>
              </span>
              <input 
                className={styles.input} 
                value={telefone} 
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </label>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <button className={styles.cancel} onClick={onClose} disabled={loading}>
                Cancelar
              </button>
              <button className={styles.save} onClick={handleSave} disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
