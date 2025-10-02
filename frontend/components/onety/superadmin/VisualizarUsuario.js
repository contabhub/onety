import { useEffect, useState } from 'react'
import { X, User, Mail, Phone, Calendar, Building2, Users, Shield, UserCheck, Briefcase } from 'lucide-react'
import SpaceLoader from '../menu/SpaceLoader'
import styles from './VisualizarUsuario.module.css'

export default function VisualizarUsuario({ open, onClose, usuario }) {
  const [loading, setLoading] = useState(false)
  const [empresasDetalhadas, setEmpresasDetalhadas] = useState([])

  useEffect(() => {
    if (!open || !usuario) return
    
    // Buscar detalhes das empresas do usuário
    const fetchEmpresasDetalhadas = async () => {
      if (!usuario.empresas || usuario.empresas.length === 0) {
        setEmpresasDetalhadas([])
        return
      }

      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        
        const empresasPromises = usuario.empresas.map(async (empresaUsuario) => {
          try {
            const response = await fetch(`${API_URL}/empresas/${empresaUsuario.empresa_id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
            
            if (response.ok) {
              const empresaData = await response.json()
              return {
                ...empresaData,
                role: empresaUsuario.role || 'usuario',
                criado_em: empresaUsuario.criado_em
              }
            }
          } catch (error) {
            console.error(`Erro ao buscar empresa ${empresaUsuario.empresa_id}:`, error)
          }
          
          return {
            id: empresaUsuario.empresa_id,
            nome: 'Empresa não encontrada',
            cnpj: 'N/A',
            role: empresaUsuario.role || 'usuario',
            criado_em: empresaUsuario.criado_em
          }
        })

        const empresas = await Promise.all(empresasPromises)
        setEmpresasDetalhadas(empresas)
      } catch (error) {
        console.error('Erro ao buscar empresas:', error)
        setEmpresasDetalhadas([])
      } finally {
        setLoading(false)
      }
    }

    fetchEmpresasDetalhadas()
  }, [open, usuario])

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <Shield size={16} />
      case 'rh': return <User size={16} />
      case 'gestor': return <UserCheck size={16} />
      case 'usuario': return <User size={16} />
      default: return <User size={16} />
    }
  }

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Administrador'
      case 'rh': return 'RH'
      case 'gestor': return 'Gestor'
      default: return 'Usuário'
    }
  }

  const getInitials = (name) => {
    if (!name) return 'U'
    const parts = String(name).trim().split(/\s+/)
    const first = parts[0]?.[0] || ''
    const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
    return (first + last).toUpperCase()
  }

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Visualizar Usuário</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {/* Informações do Usuário */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Informações Pessoais</h3>
            
            <div className={styles.userInfo}>
              <div className={styles.avatarSection}>
                {usuario.avatar_url ? (
                  <img src={usuario.avatar_url} alt="Avatar" className={styles.avatar} />
                ) : (
                  <div className={styles.avatarFallback}>
                    {getInitials(usuario.nome || usuario.name)}
                  </div>
                )}
                <div className={styles.userBasic}>
                  <h4 className={styles.userName}>{usuario.nome || usuario.name}</h4>
                  <div className={styles.userRole}>
                    {getRoleIcon(usuario.role_principal || usuario.role || 'usuario')}
                    <span>{getRoleLabel(usuario.role_principal || usuario.role || 'usuario')}</span>
                  </div>
                </div>
              </div>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <Mail size={18} />
                  <div>
                    <span className={styles.infoLabel}>Email</span>
                    <span className={styles.infoValue}>{usuario.email}</span>
                  </div>
                </div>

                {usuario.telefone && (
                  <div className={styles.infoItem}>
                    <Phone size={18} />
                    <div>
                      <span className={styles.infoLabel}>Telefone</span>
                      <span className={styles.infoValue}>{usuario.telefone}</span>
                    </div>
                  </div>
                )}

                <div className={styles.infoItem}>
                  <Calendar size={18} />
                  <div>
                    <span className={styles.infoLabel}>Criado em</span>
                    <span className={styles.infoValue}>
                      {usuario.criado_em ? new Date(usuario.criado_em).toLocaleDateString('pt-BR') : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Empresas Vinculadas */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Building2 size={20} />
              Empresas Vinculadas ({empresasDetalhadas.length})
            </h3>

            {loading ? (
              <div className={styles.loadingContainer}>
                <SpaceLoader label="Carregando empresas..." size={80} />
              </div>
            ) : empresasDetalhadas.length === 0 ? (
              <div className={styles.emptyState}>
                <Building2 size={48} />
                <p>Usuário não está vinculado a nenhuma empresa</p>
              </div>
            ) : (
              <div className={styles.empresasList}>
                {empresasDetalhadas.map((empresa) => (
                  <div key={empresa.id} className={styles.empresaCard}>
                    <div className={styles.empresaHeader}>
                      <div className={styles.empresaLogo}>
                        {empresa.logo_url ? (
                          <img src={empresa.logo_url} alt={empresa.nome} className={styles.logoImage} />
                        ) : (
                          <Building2 size={24} />
                        )}
                      </div>
                      <div className={styles.empresaInfo}>
                        <h4 className={styles.empresaNome}>{empresa.nome}</h4>
                        {empresa.cnpj && (
                          <p className={styles.empresaCnpj}>CNPJ: {empresa.cnpj}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className={styles.empresaDetails}>
                      <div className={styles.empresaRole}>
                        {getRoleIcon(empresa.role)}
                        <span>{getRoleLabel(empresa.role)}</span>
                      </div>
                      {empresa.criado_em && (
                        <div className={styles.empresaDate}>
                          <Calendar size={14} />
                          <span>Vinculado em: {new Date(empresa.criado_em).toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.closeBtn} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
