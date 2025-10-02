import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Building2, Search, Filter, Eye, Edit, Calendar, Users, Plus, Trash } from 'lucide-react'
import Sidebar from '../../components/onety/superadmin/Sidebar'
import EditarEmpresa from '../../components/onety/superadmin/EditarEmpresa'
import CriarEmpresa from '../../components/onety/superadmin/CriarEmpresa'
import SpaceLoader from '../../components/onety/menu/SpaceLoader'
import styles from '../../styles/onety/superadmin/empresas.module.css'

export default function EmpresasPage() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(true)
  const [pinned, setPinned] = useState(false)
  const [isAllowed, setIsAllowed] = useState(false)
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [totalEmpresas, setTotalEmpresas] = useState(0)
  const [editingEmpresa, setEditingEmpresa] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingEmpresa, setDeletingEmpresa] = useState(null)
  const [deleting, setDeleting] = useState(false)

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

  // Carregar empresas
  useEffect(() => {
    if (!isAllowed) return
    
    const fetchEmpresas = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('token')
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        
        const response = await fetch(`${apiUrl}/empresas?limit=100`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (!response.ok) {
          throw new Error('Erro ao buscar empresas')
        }

        const data = await response.json()
        
        // Para cada empresa, buscar a contagem de usuários
        const empresasComUsuarios = await Promise.all(
          data.data.map(async (empresa) => {
            try {
              const countResponse = await fetch(
                `${apiUrl}/usuarios-empresas/count/${empresa.id}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
              )
              
              if (countResponse.ok) {
                const countData = await countResponse.json()
                return {
                  ...empresa,
                  totalUsuarios: countData.membros || 0
                }
              }
            } catch (error) {
              console.error(`Erro ao buscar contagem de usuários da empresa ${empresa.id}:`, error)
            }
            
            return {
              ...empresa,
              totalUsuarios: 0
            }
          })
        )

        setEmpresas(empresasComUsuarios)
        setTotalEmpresas(data.total || 0)
      } catch (error) {
        console.error('Erro ao carregar empresas:', error)
        setEmpresas([])
      } finally {
        setLoading(false)
      }
    }

    fetchEmpresas()
  }, [isAllowed])

  // Filtrar empresas
  const empresasFiltradas = empresas.filter(empresa => {
    const termo = searchTerm.toLowerCase()
    return (
      empresa.nome?.toLowerCase().includes(termo) ||
      empresa.cnpj?.toLowerCase().includes(termo) ||
      empresa.id?.toString().includes(termo)
    )
  })

  // Handlers
  const handleEditEmpresa = (empresa) => {
    setEditingEmpresa(empresa)
    setShowEditModal(true)
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEditingEmpresa(null)
  }

  const handleEmpresaUpdated = (updatedEmpresa) => {
    // Atualiza a empresa na lista local
    setEmpresas(prev => 
      prev.map(empresa => 
        empresa.id === updatedEmpresa.id ? { ...empresa, ...updatedEmpresa } : empresa
      )
    )
  }

  const handleEmpresaCreated = (newEmpresa) => {
    // Adiciona a nova empresa na lista local
    setEmpresas(prev => [newEmpresa, ...prev])
    setTotalEmpresas(prev => prev + 1)
  }

  const handleDeleteEmpresa = async (empresa) => {
    try {
      setDeleting(true)
      const token = localStorage.getItem('token')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/empresas/${empresa.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Falha ao excluir empresa')
      setEmpresas(prev => prev.filter(e => e.id !== empresa.id))
      setTotalEmpresas(prev => Math.max(0, prev - 1))
      setShowDeleteModal(false)
      setDeletingEmpresa(null)
    } catch (e) {
      console.error('Erro ao excluir empresa:', e)
      setShowDeleteModal(false)
      setDeletingEmpresa(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleRequestDeleteEmpresa = (empresa) => {
    setDeletingEmpresa(empresa)
    setShowDeleteModal(true)
  }

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
  }

  const handleViewEmpresa = (empresa) => {
    // Atualiza o userData no localStorage com a empresa selecionada
    try {
      const userRaw = localStorage.getItem('userData')
      const user = userRaw ? JSON.parse(userRaw) : {}
      const updated = {
        ...user,
        EmpresaId: empresa.id,
        EmpresaNome: empresa.nome
      }
      localStorage.setItem('userData', JSON.stringify(updated))
    } catch (error) {
      console.error('Erro ao atualizar dados da empresa:', error)
    }
    // Redireciona para a página de módulos
    router.push('/modulos')
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
              <Building2 size={32} />
              Empresas
            </h1>
            <p className={styles.headerSubtitle}>
              Total: {totalEmpresas} empresas
            </p>
          </div>
          <button
            className={styles.createButton}
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={20} />
            Nova Empresa
          </button>
        </div>

        {/* Busca e Filtros */}
        <div className={styles.searchBar}>
          <div className={styles.searchWrapper}>
            <Search size={20} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar empresas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <button className={styles.filterButton}>
            <Filter size={18} />
            Filtros
          </button>
        </div>

        {/* Tabela de Empresas */}
        <div className={styles.tableContainer}>
          {/* Cabeçalho da Tabela */}
          <div className={styles.tableHeader}>
            <div className={styles.headerColEmpresa}>Empresa</div>
            <div className={styles.headerColId}>ID</div>
            <div className={styles.headerColTributacao}>Tributação</div>
            <div className={styles.headerColUsuarios}>Usuários</div>
            <div className={styles.headerColDataCriacao}>Data Criação</div>
            <div className={styles.headerColAcoes}>Ações</div>
          </div>

          {/* Corpo da Tabela */}
          <div className={styles.tableBody}>
            {loading ? (
              <div className={styles.loadingContainer}>
                <SpaceLoader label="Carregando empresas..." />
              </div>
            ) : empresasFiltradas.length === 0 ? (
              <div className={styles.emptyState}>
                Nenhuma empresa encontrada
              </div>
            ) : (
              empresasFiltradas.map((empresa) => {
                const getBadgeClass = () => {
                  if (empresa.regime_tributario === 'simples') return styles.badgeSimples
                  if (empresa.regime_tributario === 'lucro real') return styles.badgeLucroReal
                  return styles.badgeLucroPresumido
                }

                return (
                  <div key={empresa.id} className={styles.tableRow}>
                    {/* Empresa (Logo + Nome + CNPJ) */}
                    <div className={styles.colEmpresa}>
                      <div className={styles.logoWrapper}>
                        {empresa.logo_url ? (
                          <img 
                            src={empresa.logo_url} 
                            alt={empresa.nome}
                            className={styles.logoImage}
                            onError={(e) => {
                              e.target.style.display = 'none'
                              e.target.nextSibling.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <div 
                          className={styles.logoPlaceholder}
                          style={{ display: empresa.logo_url ? 'none' : 'flex' }}
                        >
                          <Building2 size={32} color="white" />
                        </div>
                      </div>
                      <div className={styles.empresaInfo}>
                        <div className={styles.empresaNome}>
                          {empresa.nome}
                        </div>
                        {empresa.cnpj && (
                          <div className={styles.empresaCnpj}>
                            CNPJ: {empresa.cnpj}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ID */}
                    <div className={styles.colId}>
                      {empresa.id}
                    </div>

                    {/* Tributação */}
                    <div className={styles.colTributacao}>
                      {empresa.regime_tributario ? (
                        <span className={`${styles.badgeTributacao} ${getBadgeClass()}`}>
                          {empresa.regime_tributario}
                        </span>
                      ) : (
                        <span style={{ opacity: 0.5, fontSize: '0.85rem' }}>N/A</span>
                      )}
                    </div>

                    {/* Usuários */}
                    <div className={styles.colUsuarios}>
                      <Users size={16} />
                      {empresa.totalUsuarios || 0}
                    </div>

                    {/* Data Criação */}
                    <div className={styles.colDataCriacao}>
                      <Calendar size={14} />
                      {empresa.criado_em ? new Date(empresa.criado_em).toLocaleDateString('pt-BR') : 'N/A'}
                    </div>

                    {/* Ações */}
                    <div className={styles.colAcoes}>
                      <button
                        className={`${styles.actionButton} ${styles.actionButtonView}`}
                        title="Visualizar módulos da empresa"
                        onClick={() => handleViewEmpresa(empresa)}
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        className={`${styles.actionButton} ${styles.actionButtonEdit}`}
                        title="Editar"
                        onClick={() => handleEditEmpresa(empresa)}
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        className={`${styles.actionButton} ${styles.actionButtonDelete}`}
                        title="Excluir"
                        onClick={() => handleRequestDeleteEmpresa(empresa)}
                      >
                        <Trash size={18} />
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
      <EditarEmpresa
        open={showEditModal}
        onClose={handleCloseEditModal}
        empresa={editingEmpresa}
        onUpdated={handleEmpresaUpdated}
      />

      {/* Modal de Criação */}
      <CriarEmpresa
        open={showCreateModal}
        onClose={handleCloseCreateModal}
        onCreated={handleEmpresaCreated}
      />

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && (
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
            <h3 style={{ margin: 0, color: 'var(--onity-color-text)' }}>Excluir Empresa</h3>
            <p style={{ marginTop: 8, opacity: 0.7, color: 'var(--onity-color-text)' }}>
              Tem certeza que deseja excluir a empresa {deletingEmpresa?.nome ? `"${deletingEmpresa.nome}"` : ''}? Esta ação não poderá ser desfeita.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              <button
                onClick={() => { setShowDeleteModal(false); setDeletingEmpresa(null) }}
                disabled={deleting}
                style={{
                  padding: '10px 14px', borderRadius: 10, border: '1px solid var(--onity-color-border)',
                  background: 'transparent', color: 'var(--onity-color-text)', cursor: 'pointer', opacity: deleting ? 0.7 : 1
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => deletingEmpresa && handleDeleteEmpresa(deletingEmpresa)}
                disabled={deleting}
                style={{
                  padding: '10px 14px', borderRadius: 10, border: '1px solid var(--onity-color-danger)',
                  background: 'var(--onity-color-danger)', color: 'white', fontWeight: 600, cursor: 'pointer',
                  opacity: deleting ? 0.7 : 1
                }}
              >
                {deleting ? 'Excluindo...' : 'Excluir' }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

