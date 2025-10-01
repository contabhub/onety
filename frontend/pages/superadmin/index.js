import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Users, Building2, BookOpen, BarChart3, Settings, UserCheck, TrendingUp, Calendar, Mail } from 'lucide-react'
import Sidebar from '../../components/onety/superadmin/Sidebar'

export default function SuperadminHome() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(true)
  const [pinned, setPinned] = useState(false)
  const [isAllowed, setIsAllowed] = useState(false)
  const [stats, setStats] = useState({
    usuarios: 0,
    empresas: 0,
    modulos: 0,
    usuariosAtivos: 0
  })
  const [recentData, setRecentData] = useState({
    empresas: [],
    usuarios: []
  })
  const [loading, setLoading] = useState(true)

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

  // Carregar estatísticas
  useEffect(() => {
    if (!isAllowed) return
    
    const fetchStats = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('token')
        
        // Fazer chamadas paralelas para todas as estatísticas e dados recentes
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        
        const [usuariosRes, empresasRes, modulosRes, usuariosRecentesRes, empresasRecentesRes] = await Promise.all([
          fetch(`${apiUrl}/usuarios/estatisticas`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${apiUrl}/empresas/estatisticas`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${apiUrl}/modulos/estatisticas`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${apiUrl}/usuarios/recentes?limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${apiUrl}/empresas/recentes?limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ])

        // Debug: verificar status das respostas
        console.log('Status das respostas:', {
          usuarios: usuariosRes.status,
          empresas: empresasRes.status,
          modulos: modulosRes.status,
          usuariosRecentes: usuariosRecentesRes.status,
          empresasRecentes: empresasRecentesRes.status
        })

        // Verificar se as respostas são válidas
        if (!usuariosRes.ok || !empresasRes.ok || !modulosRes.ok || !usuariosRecentesRes.ok || !empresasRecentesRes.ok) {
          console.error('Erro nas requisições:', {
            usuarios: { status: usuariosRes.status, statusText: usuariosRes.statusText },
            empresas: { status: empresasRes.status, statusText: empresasRes.statusText },
            modulos: { status: modulosRes.status, statusText: modulosRes.statusText },
            usuariosRecentes: { status: usuariosRecentesRes.status, statusText: usuariosRecentesRes.statusText },
            empresasRecentes: { status: empresasRecentesRes.status, statusText: empresasRecentesRes.statusText }
          })
          throw new Error('Erro nas requisições da API')
        }

        const [usuariosData, empresasData, modulosData, usuariosRecentesData, empresasRecentesData] = await Promise.all([
          usuariosRes.json(),
          empresasRes.json(),
          modulosRes.json(),
          usuariosRecentesRes.json(),
          empresasRecentesRes.json()
        ])

        setStats({
          usuarios: usuariosData.total || 0,
          usuariosAtivos: usuariosData.ativos || 0,
          empresas: empresasData.total || 0,
          modulos: modulosData.total || 0
        })

        setRecentData({
          usuarios: usuariosRecentesData || [],
          empresas: empresasRecentesData || []
        })
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error)
        // Em caso de erro, manter valores padrão
        setStats({
          usuarios: 0,
          usuariosAtivos: 0,
          empresas: 0,
          modulos: 0
        })
        setRecentData({
          usuarios: [],
          empresas: []
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [isAllowed])

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
          padding: 32,
          background: 'var(--onity-color-bg)',
          minHeight: '100vh',
        }}
      >
        {/* Header Section */}
        <div style={{
          background: 'var(--onity-color-surface)',
          border: '1px solid var(--onity-color-border)',
          borderRadius: 20,
          padding: 40,
          marginBottom: 32,
          boxShadow: 'var(--onity-elev-med)',
        }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: '2.5rem',
            fontWeight: 700,
            color: 'var(--onity-color-text)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <Settings size={40} />
            Painel do Superadmin
          </h1>
          <p style={{ 
            opacity: 0.8, 
            marginTop: 8,
            fontSize: '1.1rem',
            color: 'var(--onity-color-text)',
            maxWidth: '600px',
            lineHeight: 1.6,
          }}>
            Controle total da plataforma Onety. Gerencie usuários, empresas, módulos e configurações do sistema com poder administrativo completo.
          </p>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
          marginBottom: 32,
        }}>
          <div style={{
            background: 'var(--onity-color-surface)',
            border: '1px solid var(--onity-color-border)',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <div style={{
                width: 48,
                height: 48,
                background: 'var(--onity-color-primary)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
              }}>
                <Users size={24} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: 'var(--onity-color-text)' }}>
                  Usuários Ativos
                </h3>
                <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>
                  Gerenciar contas
                </p>
              </div>
            </div>
            <div style={{ 
              fontSize: '2rem', 
              fontWeight: 700, 
              color: 'var(--onity-color-text)',
              opacity: 0.9
            }}>
              {loading ? '...' : stats.usuariosAtivos.toLocaleString()}
            </div>
            <p style={{ margin: '8px 0 0 0', opacity: 0.6, fontSize: '0.85rem' }}>
              Total de usuários cadastrados
            </p>
          </div>

          <div style={{
            background: 'var(--onity-color-surface)',
            border: '1px solid var(--onity-color-border)',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <div style={{
                width: 48,
                height: 48,
                background: 'var(--onity-color-success)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
              }}>
                <Building2 size={24} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: 'var(--onity-color-text)' }}>
                  Empresas
                </h3>
                <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>
                  Organizações ativas
                </p>
              </div>
            </div>
            <div style={{ 
              fontSize: '2rem', 
              fontWeight: 700, 
              color: 'var(--onity-color-text)',
              opacity: 0.9
            }}>
              {loading ? '...' : stats.empresas.toLocaleString()}
            </div>
            <p style={{ margin: '8px 0 0 0', opacity: 0.6, fontSize: '0.85rem' }}>
              Empresas cadastradas no sistema
            </p>
          </div>

          <div style={{
            background: 'var(--onity-color-surface)',
            border: '1px solid var(--onity-color-border)',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <div style={{
                width: 48,
                height: 48,
                background: 'var(--onity-color-warning)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
              }}>
                <BookOpen size={24} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: 'var(--onity-color-text)' }}>
                  Módulos
                </h3>
                <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>
                  Conteúdo disponível
                </p>
              </div>
            </div>
            <div style={{ 
              fontSize: '2rem', 
              fontWeight: 700, 
              color: 'var(--onity-color-text)',
              opacity: 0.9
            }}>
              {loading ? '...' : stats.modulos.toLocaleString()}
            </div>
            <p style={{ margin: '8px 0 0 0', opacity: 0.6, fontSize: '0.85rem' }}>
              Módulos de treinamento ativos
            </p>
          </div>
        </div>

        {/* Recent Data Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 24,
          marginBottom: 32,
        }}>
          {/* Empresas Recentes */}
          <div style={{
            background: 'var(--onity-color-surface)',
            border: '1px solid var(--onity-color-border)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          }}>
            <div style={{
              background: 'var(--onity-color-surface)',
              borderBottom: '2px solid var(--onity-color-primary)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <Building2 size={20} color="var(--onity-color-primary)" />
              <h3 style={{ 
                margin: 0, 
                fontSize: '1.1rem', 
                fontWeight: 600, 
                color: 'var(--onity-color-text)' 
              }}>
                Empresas Recentes
              </h3>
            </div>
            
            {/* Cabeçalho das Colunas */}
            {!loading && recentData.empresas.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 20px',
                background: 'var(--onity-color-surface)',
                borderBottom: '1px solid var(--onity-color-border)',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'var(--onity-color-text)',
                opacity: 0.6,
                letterSpacing: '0.5px',
              }}>
                <div style={{ width: 32, flexShrink: 0 }}></div>
                <div style={{ flex: 2, minWidth: 0 }}>Nome</div>
                <div style={{ flex: 1, minWidth: 0 }}>Data Criação</div>
                <div style={{ width: 80, flexShrink: 0, textAlign: 'center' }}>Usuários</div>
              </div>
            )}

            <div style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: '20px', textAlign: 'center', opacity: 0.6 }}>
                  Carregando...
                </div>
              ) : recentData.empresas.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', opacity: 0.6 }}>
                  Nenhuma empresa encontrada
                </div>
              ) : (
                <div>
                  {recentData.empresas.map((empresa, index) => (
                    <div key={empresa.id} style={{
                      padding: '16px 20px',
                      borderBottom: index < recentData.empresas.length - 1 ? '1px solid var(--onity-color-border)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'background 0.2s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--onity-color-surface)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: 32,
                        height: 32,
                        background: 'var(--onity-color-primary)',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Building2 size={16} color="white" />
                      </div>
                      <div style={{ flex: 2, minWidth: 0 }}>
                        <div style={{ 
                          fontWeight: 600, 
                          color: 'var(--onity-color-text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {empresa.nome}
                        </div>
                      </div>
                      <div style={{ 
                        flex: 1, 
                        minWidth: 0,
                        fontSize: '0.85rem', 
                        color: 'var(--onity-color-text)',
                        opacity: 0.7,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <Calendar size={14} />
                        {empresa.criado_em ? new Date(empresa.criado_em).toLocaleDateString('pt-BR') : 'N/A'}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: 'var(--onity-color-text)',
                        width: 80,
                        flexShrink: 0,
                      }}>
                        <Users size={16} />
                        {empresa.funcionarios || 0}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Usuários Recentes */}
          <div style={{
            background: 'var(--onity-color-surface)',
            border: '1px solid var(--onity-color-border)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          }}>
            <div style={{
              background: 'var(--onity-color-surface)',
              borderBottom: '2px solid var(--onity-color-primary)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <Users size={20} color="var(--onity-color-primary)" />
              <h3 style={{ 
                margin: 0, 
                fontSize: '1.1rem', 
                fontWeight: 600, 
                color: 'var(--onity-color-text)' 
              }}>
                Usuários Recentes
              </h3>
            </div>
            
            {/* Cabeçalho das Colunas */}
            {!loading && recentData.usuarios.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 20px',
                background: 'var(--onity-color-surface)',
                borderBottom: '1px solid var(--onity-color-border)',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'var(--onity-color-text)',
                opacity: 0.6,
                letterSpacing: '0.5px',
              }}>
                <div style={{ width: 32, flexShrink: 0 }}></div>
                <div style={{ flex: 2, minWidth: 0 }}>Nome</div>
                <div style={{ flex: 2, minWidth: 0 }}>Email</div>
                <div style={{ width: 80, flexShrink: 0, textAlign: 'center' }}>Empresas</div>
                <div style={{ flex: 1, minWidth: 0 }}>Data Criação</div>
              </div>
            )}

            <div style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: '20px', textAlign: 'center', opacity: 0.6 }}>
                  Carregando...
                </div>
              ) : recentData.usuarios.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', opacity: 0.6 }}>
                  Nenhum usuário encontrado
                </div>
              ) : (
                <div>
                  {recentData.usuarios.map((usuario, index) => (
                    <div key={usuario.id} style={{
                      padding: '16px 20px',
                      borderBottom: index < recentData.usuarios.length - 1 ? '1px solid var(--onity-color-border)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'background 0.2s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--onity-color-surface)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: 32,
                        height: 32,
                        background: 'var(--onity-color-success)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontWeight: 600,
                        color: 'white',
                        fontSize: '0.85rem',
                      }}>
                        {(usuario.nome || 'U')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 2, minWidth: 0 }}>
                        <div style={{ 
                          fontWeight: 600, 
                          color: 'var(--onity-color-text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {usuario.nome || 'Usuário'}
                        </div>
                      </div>
                      <div style={{ 
                        flex: 2, 
                        minWidth: 0,
                        fontSize: '0.85rem', 
                        color: 'var(--onity-color-text)',
                        opacity: 0.7,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        <Mail size={14} />
                        {usuario.email || 'N/A'}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: 'var(--onity-color-text)',
                        width: 80,
                        flexShrink: 0,
                      }}>
                        <Building2 size={16} />
                        {usuario.empresas || 0}
                      </div>
                      <div style={{ 
                        flex: 1, 
                        minWidth: 0,
                        fontSize: '0.85rem', 
                        color: 'var(--onity-color-text)',
                        opacity: 0.7,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <Calendar size={14} />
                        {usuario.criado_em ? new Date(usuario.criado_em).toLocaleDateString('pt-BR') : 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{
          background: 'var(--onity-color-surface)',
          border: '1px solid var(--onity-color-border)',
          borderRadius: 20,
          padding: 32,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        }}>
          <h2 style={{ 
            margin: '0 0 24px 0', 
            fontSize: '1.5rem', 
            fontWeight: 600,
            color: 'var(--onity-color-text)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <TrendingUp size={24} />
            Ações Rápidas
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20,
          }}>
            <div style={{
              padding: 20,
              background: 'var(--onity-color-bg)',
              borderRadius: 12,
              border: '1px solid var(--onity-color-border)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                fontSize: '1.1rem', 
                fontWeight: 600, 
                color: 'var(--onity-color-text)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <UserCheck size={20} />
                Gerenciar Usuários
              </h3>
              <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem', lineHeight: 1.5 }}>
                Criar, editar e gerenciar contas de usuários, permissões e acessos.
              </p>
            </div>

            <div style={{
              padding: 20,
              background: 'var(--onity-color-bg)',
              borderRadius: 12,
              border: '1px solid var(--onity-color-border)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                fontSize: '1.1rem', 
                fontWeight: 600, 
                color: 'var(--onity-color-text)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Building2 size={20} />
                Gerenciar Empresas
              </h3>
              <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem', lineHeight: 1.5 }}>
                Administrar organizações, módulos e configurações empresariais.
              </p>
            </div>

            <div style={{
              padding: 20,
              background: 'var(--onity-color-bg)',
              borderRadius: 12,
              border: '1px solid var(--onity-color-border)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                fontSize: '1.1rem', 
                fontWeight: 600, 
                color: 'var(--onity-color-text)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <BarChart3 size={20} />
                Relatórios
              </h3>
              <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem', lineHeight: 1.5 }}>
                Visualizar métricas, estatísticas e relatórios do sistema.
              </p>
            </div>

            <div style={{
              padding: 20,
              background: 'var(--onity-color-bg)',
              borderRadius: 12,
              border: '1px solid var(--onity-color-border)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                fontSize: '1.1rem', 
                fontWeight: 600, 
                color: 'var(--onity-color-text)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Settings size={20} />
                Configurações
              </h3>
              <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem', lineHeight: 1.5 }}>
                Configurar parâmetros gerais e personalizar a plataforma.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}


