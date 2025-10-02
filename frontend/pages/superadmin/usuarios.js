import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Users, Search, Eye, Edit, Mail, Phone, Calendar } from 'lucide-react'
import Sidebar from '../../components/onety/superadmin/Sidebar'
import EditarUsuario from '../../components/onety/superadmin/EditarUsuario'
import VisualizarUsuario from '../../components/onety/superadmin/VisualizarUsuario'
import GerenciarVinculos from '../../components/onety/superadmin/GerenciarVinculos'
import SpaceLoader from '../../components/onety/menu/SpaceLoader'
import styles from '../../styles/onety/superadmin/usuarios.module.css'

export default function UsuariosPage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(true)
  const [pinned, setPinned] = useState(false)
  const [isAllowed, setIsAllowed] = useState(false)
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [totalUsuarios, setTotalUsuarios] = useState(0)
  const [empresaFilter, setEmpresaFilter] = useState('')
  const [empresas, setEmpresas] = useState([])
  const [editingUsuario, setEditingUsuario] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [viewingUsuario, setViewingUsuario] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [gerenciandoVinculos, setGerenciandoVinculos] = useState(null)
  const [showGerenciarModal, setShowGerenciarModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ nome: '', email: '', senha: '', telefone: '' })

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

  // Carregar usuários e empresas
  useEffect(() => {
    if (!isAllowed) return
    
    const fetchData = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('token')
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        
        // Buscar usuários
        const usuariosResponse = await fetch(`${apiUrl}/usuarios?limit=100`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (!usuariosResponse.ok) {
          throw new Error('Erro ao buscar usuários')
        }

        const usuariosData = await usuariosResponse.json()
        
        // Buscar empresas para o filtro
        const empresasResponse = await fetch(`${apiUrl}/empresas?limit=100`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (empresasResponse.ok) {
          const empresasData = await empresasResponse.json()
          setEmpresas(empresasData.data || [])
        }

        // Para cada usuário, buscar informações adicionais
        const usuariosComDetalhes = await Promise.all(
          (usuariosData.data || []).map(async (usuario) => {
            try {
              // Buscar empresas do usuário
              const empresasUsuarioResponse = await fetch(
                `${apiUrl}/usuarios-empresas?usuario_id=${usuario.id}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
              )
              
              let empresasUsuario = []
              if (empresasUsuarioResponse.ok) {
                const empresasUsuarioData = await empresasUsuarioResponse.json()
                empresasUsuario = empresasUsuarioData.data || []
              }

              return {
                ...usuario,
                empresas: empresasUsuario
              }
            } catch (error) {
              console.error(`Erro ao buscar detalhes do usuário ${usuario.id}:`, error)
              return {
                ...usuario,
                empresas: []
              }
            }
          })
        )

        setUsuarios(usuariosComDetalhes)
        setTotalUsuarios(usuariosData.total || 0)

      } catch (error) {
        console.error('Erro ao carregar dados:', error)
        setUsuarios([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isAllowed])

  // Filtrar usuários
  const usuariosFiltrados = usuarios.filter(usuario => {
    const termo = searchTerm.toLowerCase()
    const nomeMatch = usuario.nome?.toLowerCase().includes(termo) || usuario.name?.toLowerCase().includes(termo)
    const emailMatch = usuario.email?.toLowerCase().includes(termo)
    const empresaMatch = !empresaFilter || usuario.empresas.some(emp => emp.empresa_id === parseInt(empresaFilter))

    return (nomeMatch || emailMatch) && empresaMatch
  })

  // Handlers
  const handleViewUsuario = (usuario) => {
    setViewingUsuario(usuario)
    setShowViewModal(true)
  }

  const handleEditUsuario = (usuario) => {
    setEditingUsuario(usuario)
    setShowEditModal(true)
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEditingUsuario(null)
  }

  const handleCloseViewModal = () => {
    setShowViewModal(false)
    setViewingUsuario(null)
  }

  const handleGerenciarVinculos = (usuario) => {
    setGerenciandoVinculos(usuario)
    setShowGerenciarModal(true)
  }

  const handleCloseGerenciarModal = () => {
    setShowGerenciarModal(false)
    setGerenciandoVinculos(null)
  }

  const handleUsuarioUpdated = (updatedUsuario) => {
    // Atualiza o usuário na lista local
    setUsuarios(prev => 
      prev.map(usuario => 
        usuario.id === updatedUsuario.id ? { ...usuario, ...updatedUsuario } : usuario
      )
    )
  }

  const getInitials = (name) => {
    if (!name) return 'U'
    const parts = String(name).trim().split(/\s+/)
    const first = parts[0]?.[0] || ''
    const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
    return (first + last).toUpperCase()
  }


  if (!isAllowed) return null

  return (
    <div className={styles.container}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        pinned={pinned}
        setPinned={setPinned}
      />

      <main className={`${styles.main} ${!collapsed ? styles.expanded : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>
              <Users size={32} />
              Usuários
            </h1>
            <p className={styles.headerSubtitle}>
              Gerenciar todos os usuários do sistema
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setShowCreateModal(true)}
              className={styles.totalCard}
            >
              Criar Usuário
            </button>
            <div className={styles.totalCard}>
              Total: {totalUsuarios} usuários
            </div>
          </div>
        </div>


        {/* Busca e Filtros */}
        <div className={styles.searchBar}>
          <div className={styles.searchWrapper}>
            <Search size={20} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <select 
            className={styles.filterSelect}
            value={empresaFilter}
            onChange={(e) => setEmpresaFilter(e.target.value)}
          >
            <option value="">Todas as empresas</option>
            {empresas.map(empresa => (
              <option key={empresa.id} value={empresa.id}>
                {empresa.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Tabela de Usuários */}
        <div className={styles.tableContainer}>
          {/* Cabeçalho da Tabela */}
          <div className={styles.tableHeader}>
            <div className={styles.headerColUsuario}>Usuário</div>
            <div className={styles.headerColEmpresas}>Empresas</div>
            <div className={styles.headerColContato}>Contato</div>
            <div className={styles.headerColCriado}>Criado em</div>
            <div className={styles.headerColAcoes}>Ações</div>
          </div>

          {/* Corpo da Tabela */}
          <div className={styles.tableBody}>
            {loading ? (
              <div className={styles.loadingContainer}>
                <SpaceLoader label="Carregando usuários..." />
              </div>
            ) : usuariosFiltrados.length === 0 ? (
              <div className={styles.emptyState}>
                Nenhum usuário encontrado
              </div>
            ) : (
              usuariosFiltrados.map((usuario) => {
                return (
                  <div key={usuario.id} className={styles.tableRow}>
                    {/* Usuário (Avatar + Nome + Email) */}
                    <div className={styles.colUsuario} data-label="Usuário">
                      <div className={styles.avatarWrapper}>
                        {usuario.avatar_url ? (
                          <img 
                            src={usuario.avatar_url} 
                            alt={usuario.nome || usuario.name}
                            className={styles.avatarImage}
                          />
                        ) : (
                          <div className={styles.avatarFallback}>
                            {getInitials(usuario.nome || usuario.name)}
                          </div>
                        )}
                      </div>
                      <div className={styles.usuarioInfo}>
                        <div className={styles.usuarioNome}>
                          {usuario.nome || usuario.name}
                        </div>
                        <div className={styles.usuarioEmail}>
                          {usuario.email}
                        </div>
                      </div>
                    </div>

                    {/* Empresas */}
                    <div className={styles.colEmpresas} data-label="Empresas">
                      <div 
                        className={styles.empresasInfo}
                        onClick={() => handleGerenciarVinculos(usuario)}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className={styles.empresasCount}>{usuario.empresas.length}</span>
                        {usuario.empresas.length > 0 && (
                          <span className={styles.empresasNome}>
                            {usuario.empresas[0].empresa?.nome || 'Empresa'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Contato */}
                    <div className={styles.colContato} data-label="Contato">
                      <div className={styles.contatoInfo}>
                        <div className={styles.contatoItem}>
                          <Mail size={14} />
                          <span>{usuario.email}</span>
                        </div>
                        {usuario.telefone && (
                          <div className={styles.contatoItem}>
                            <Phone size={14} />
                            <span>{usuario.telefone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Data Criação */}
                    <div className={styles.colCriado} data-label="Criado em">
                      <Calendar size={14} />
                      {usuario.criado_em ? new Date(usuario.criado_em).toLocaleDateString('pt-BR') : 'N/A'}
                    </div>

                    {/* Ações */}
                    <div className={styles.colAcoes} data-label="Ações">
                      <button
                        className={`${styles.actionButton} ${styles.actionButtonView}`}
                        title="Visualizar"
                        onClick={() => handleViewUsuario(usuario)}
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        className={`${styles.actionButton} ${styles.actionButtonEdit}`}
                        title="Editar"
                        onClick={() => handleEditUsuario(usuario)}
                      >
                        <Edit size={18} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </main>

      {/* Modal de Edição */}
      <EditarUsuario
        open={showEditModal}
        onClose={handleCloseEditModal}
        usuario={editingUsuario}
        onUpdated={handleUsuarioUpdated}
      />

      {/* Modal de Visualização */}
      <VisualizarUsuario
        open={showViewModal}
        onClose={handleCloseViewModal}
        usuario={viewingUsuario}
      />

      {/* Modal de Gerenciar Vínculos */}
      <GerenciarVinculos
        open={showGerenciarModal}
        onClose={handleCloseGerenciarModal}
        usuario={gerenciandoVinculos}
        onUpdated={() => {
          // Recarregar dados quando vínculos forem atualizados
          window.location.reload()
        }}
      />

      {/* Modal de Criação de Usuário */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 4000
        }}>
          <div style={{
            width: '100%',
            maxWidth: 520,
            background: 'var(--onity-color-surface)',
            border: '1px solid var(--onity-color-border)',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: 0, color: 'var(--onity-color-text)' }}>Criar Usuário</h3>
            <p style={{ marginTop: 8, opacity: 0.7, color: 'var(--onity-color-text)' }}>
              Preencha os dados abaixo para cadastrar um novo usuário.
            </p>

            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Nome</label>
                <input
                  type="text"
                  value={createForm.nome}
                  onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })}
                  placeholder="Nome completo"
                  style={{
                    width: '90%', padding: '10px 12px', borderRadius: 10,
                    border: '1px solid var(--onity-color-border)', background: 'var(--onity-color-bg)',
                    color: 'var(--onity-color-text)'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Email</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  style={{
                    width: '90%', padding: '10px 12px', borderRadius: 10,
                    border: '1px solid var(--onity-color-border)', background: 'var(--onity-color-bg)',
                    color: 'var(--onity-color-text)'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Senha</label>
                <input
                  type="password"
                  value={createForm.senha}
                  onChange={(e) => setCreateForm({ ...createForm, senha: e.target.value })}
                  placeholder="Senha temporária"
                  style={{
                    width: '90%', padding: '10px 12px', borderRadius: 10,
                    border: '1px solid var(--onity-color-border)', background: 'var(--onity-color-bg)',
                    color: 'var(--onity-color-text)'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Telefone (opcional)</label>
                <input
                  type="tel"
                  value={createForm.telefone}
                  onChange={(e) => setCreateForm({ ...createForm, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  style={{
                    width: '90%', padding: '10px 12px', borderRadius: 10,
                    border: '1px solid var(--onity-color-border)', background: 'var(--onity-color-bg)',
                    color: 'var(--onity-color-text)'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                style={{
                  padding: '10px 14px', borderRadius: 10, border: '1px solid var(--onity-color-border)',
                  background: 'transparent', color: 'var(--onity-color-text)', cursor: 'pointer', opacity: creating ? 0.7 : 1
                }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    if (!createForm.nome || !createForm.email || !createForm.senha) return
                    setCreating(true)
                    const token = localStorage.getItem('token')
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
                    const res = await fetch(`${apiUrl}/usuarios`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        nome: createForm.nome,
                        email: createForm.email,
                        senha: createForm.senha,
                        telefone: createForm.telefone || undefined
                      })
                    })
                    if (!res.ok) throw new Error('Falha ao criar usuário')
                    setShowCreateModal(false)
                    // Recarregar a lista (mantendo padrão usado em vínculos)
                    window.location.reload()
                  } catch (e) {
                    console.error(e)
                    alert('Não foi possível criar o usuário.')
                  } finally {
                    setCreating(false)
                    setCreateForm({ nome: '', email: '', senha: '', telefone: '' })
                  }
                }}
                disabled={creating || !createForm.nome || !createForm.email || !createForm.senha}
                style={{
                  padding: '10px 14px', borderRadius: 10, border: '1px solid var(--onity-color-primary)',
                  background: 'var(--onity-color-primary)', color: 'white', fontWeight: 600, cursor: 'pointer',
                  opacity: creating ? 0.7 : 1
                }}
              >
                {creating ? 'Criando...' : 'Criar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
