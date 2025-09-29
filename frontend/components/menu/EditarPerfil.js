import { useEffect, useState } from 'react'
import styles from './EditarPerfil.module.css'

export default function EditarPerfil({ open, onClose, onUpdated }) {
  const [user, setUser] = useState(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    try {
      const raw = localStorage.getItem('userData')
      const parsed = raw ? JSON.parse(raw) : null
      setUser(parsed)
      setNome(parsed?.nome || parsed?.name || '')
      setEmail(parsed?.email || '')
      setTelefone(parsed?.telefone || '')
      setAvatarPreview(parsed?.avatar_url || null)
      setAvatarFile(null)
      setError('')
    } catch {
      setError('Falha ao carregar dados do usuário')
    }
  }, [open])

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const url = URL.createObjectURL(file)
    setAvatarPreview(url)
  }

  const handleSave = async () => {
    if (!user) return
    setLoading(true)
    setError('')
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    try {
      // 1) Atualiza campos básicos
      const res = await fetch(`${API_URL}/usuarios/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ nome, email, telefone })
      })
      if (!res.ok) throw new Error('Falha ao atualizar dados')
      let updated = await res.json()

      // 2) Se houver novo avatar, envia upload
      if (avatarFile) {
        const form = new FormData()
        form.append('avatar', avatarFile)
        const up = await fetch(`${API_URL}/usuarios/${user.id}/avatar`, {
          method: 'PATCH',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: form
        })
        if (!up.ok) throw new Error('Falha ao enviar avatar')
        updated = await up.json()
      }

      // 3) Atualiza localStorage
      const raw = localStorage.getItem('userData')
      const previous = raw ? JSON.parse(raw) : {}
      const merged = { ...previous, ...updated }
      localStorage.setItem('userData', JSON.stringify(merged))

      onUpdated && onUpdated(merged)
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
        <h2>Editar perfil</h2>
        <div className={styles.form}>
          <div className={styles.avatarRow}>
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className={styles.avatar} />
            ) : (
              <div className={styles.avatarFallback}>IMG</div>
            )}
            <label className={styles.uploadBtn}>
              Alterar avatar
              <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
            </label>
          </div>

          <label className={styles.label}>Nome
            <input className={styles.input} value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className={styles.label}>Email
            <input className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className={styles.label}>Telefone
            <input className={styles.input} value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </label>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button className={styles.cancel} onClick={onClose} disabled={loading}>Cancelar</button>
            <button className={styles.save} onClick={handleSave} disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}


