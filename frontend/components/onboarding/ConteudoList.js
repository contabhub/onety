import { useEffect, useState } from 'react'

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

  if (loading) return <div style={{ padding: 16 }}>Carregando conteúdos...</div>
  if (error) return <div style={{ padding: 16, color: 'var(--onity-color-error)' }}>{error}</div>
  if (!items.length) return <div style={{ padding: 16 }}>Nenhum conteúdo cadastrado.</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, padding: 16 }}>
      {items.map((c) => (
        <article key={c.id} style={{ border: '1px solid var(--onity-color-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--onity-color-bgElevated)' }}>
          {c.link ? (
            <div style={{ height: 160, background: '#0b0b0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* placeholder simples para mídia/imagem do link */}
              <span style={{ color: '#fff', opacity: 0.8 }}>Prévia</span>
            </div>
          ) : null}
          <div style={{ padding: 16 }}>
            <h3 style={{ margin: '0 0 8px' }}>{c.nome}</h3>
            <p style={{ margin: 0, opacity: 0.85 }}>{c.descricao || 'Sem descrição'}</p>
          </div>
        </article>
      ))}
    </div>
  )
}


