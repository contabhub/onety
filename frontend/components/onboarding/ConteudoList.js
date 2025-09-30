import { useEffect, useState } from 'react'
import styles from './ConteudoList.module.css'

export default function ConteudoList({ moduloId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    let ignore = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const url = `${API_URL}/conteudo?modulo_id=${encodeURIComponent(moduloId)}&limit=100`
        const res = await fetch(url, { headers: { 'Authorization': token ? `Bearer ${token}` : '' } })
        if (!res.ok) throw new Error('Falha ao carregar conteúdos')
        const data = await res.json()
        if (!ignore) setItems(Array.isArray(data?.data) ? data.data : data || [])
      } catch (e) {
        if (!ignore) setError(e.message || 'Erro ao carregar conteúdos')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    if (moduloId) load()
    return () => { ignore = true }
  }, [moduloId])

  if (loading) return <div className={styles.placeholder}>Carregando conteúdos...</div>
  if (error) return <div className={`${styles.placeholder} ${styles.error}`}>{error}</div>
  if (!items.length) return <div className={styles.placeholder}>Nenhum conteúdo cadastrado.</div>

  return (
    <div className={styles.grid}>
      {items.map((c) => (
        <article key={c.id} className={styles.card}>
          {(c.logo_url || c.link) ? (
            <div className={styles.media}>
              {c.logo_url ? (
                <img src={c.logo_url} alt={`Logo de ${c.nome}`} className={styles.mediaImg} />
              ) : (
                <span className={styles.mediaFallback}>Prévia</span>
              )}
            </div>
          ) : null}
          <div className={styles.body}>
            <h3 className={styles.title}>{c.nome}</h3>
            <p className={styles.desc}>{c.descricao || 'Sem descrição'}</p>
          </div>
        </article>
      ))}
    </div>
  )
}


