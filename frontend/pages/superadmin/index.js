import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Sidebar from '../../components/superadmin/Sidebar'

export default function SuperadminHome() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(true)
  const [pinned, setPinned] = useState(false)
  const [isAllowed, setIsAllowed] = useState(false)

  // Persistência simples do estado da sidebar
  useEffect(() => {
    try {
      const pinnedSaved = localStorage.getItem('sa_sidebarPinned')
      const collapsedSaved = localStorage.getItem('sa_sidebarCollapsed')
      if (pinnedSaved != null) setPinned(pinnedSaved === 'true')
      if (collapsedSaved != null) setCollapsed(collapsedSaved === 'true')
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem('sa_sidebarPinned', String(pinned)) } catch {}
  }, [pinned])
  useEffect(() => {
    try { localStorage.setItem('sa_sidebarCollapsed', String(collapsed)) } catch {}
  }, [collapsed])

  // Proteção de rota: exige token com permissoes.adm.includes('superadmin')
  useEffect(() => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      if (!token) { router.replace('/login'); return }
      const payloadStr = token.split('.')[1] || ''
      const payload = payloadStr ? JSON.parse(atob(payloadStr)) : {}
      const permissoes = payload?.permissoes || {}
      const ok = Array.isArray(permissoes?.adm) && permissoes.adm.includes('superadmin')
      if (!ok) { router.replace('/empresa'); return }
      setIsAllowed(true)
    } catch {
      router.replace('/login')
    }
  }, [router])

  if (!isAllowed) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        pinned={pinned}
        setPinned={setPinned}
      />

      <main
        style={{
          marginLeft: collapsed ? 72 : 242,
          transition: 'margin-left .15s ease-out',
          width: '100%',
          padding: 24,
        }}
      >
        <h1 style={{ margin: 0 }}>Painel do Superadmin</h1>
        <p style={{ opacity: .8, marginTop: 8 }}>Bem-vindo ao ambiente administrativo.</p>
        <div style={{ marginTop: 24 }}>
          <div style={{
            border: '1px solid var(--onity-color-border)',
            background: 'var(--onity-color-surface)',
            borderRadius: 12,
            padding: 16
          }}>
            <strong>Atalhos rápidos</strong>
            <ul style={{ marginTop: 12 }}>
              <li>Gerenciar usuários</li>
              <li>Empresas e módulos</li>
              <li>Configurações gerais</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}


