import { useState, useEffect } from 'react';
import styles from './Usuarios.module.css';
import { User, Plus, Search, RefreshCw, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import UserModal from './UserModal';

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProfile, setFilterProfile] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [adminId, setAdminId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // Verificar se os dados necessários estão disponíveis
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const companyId = userData.EmpresaId;
    setUserRole(userData.userRole || null);
    
    if (!token) {
      setError('Token de autenticação não encontrado. Faça login novamente.');
      setLoading(false);
      return;
    }
    
    if (!companyId) {
      setError('ID da empresa não encontrado. Faça login novamente.');
      setLoading(false);
      return;
    }
    
    // Carregar usuários
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('URL da API não configurada.');
      }
      
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').EmpresaId;
      const url = `${apiUrl}/atendimento/usuarios/company/${companyId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar usuários');
      }

      const data = await response.json();
      setUsuarios(data.users || []);
      setAdminId(data.admin_id);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      setError('Erro ao carregar usuários. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = (newUser) => {
    // Recarregar lista de usuários
    fetchUsuarios();
    
    // Mostrar mensagem de sucesso
    setSuccessMessage(`Usuário "${newUser.nome}" criado com sucesso!`);
    
    // Limpar mensagem após 3 segundos
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  const handleEditSuccess = (updatedUser) => {
    // Recarregar lista de usuários
    fetchUsuarios();
    
    // Mostrar mensagem de sucesso
    setSuccessMessage(`Usuário "${updatedUser.nome}" atualizado com sucesso!`);
    
    // Limpar mensagem após 3 segundos
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  // Função para gerar iniciais do nome do usuário
  const getInitials = (nome) => {
    if (!nome) return 'U';
    return nome
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Função para obter o perfil do usuário
  const getUserProfile = (user) => {
    if (user.is_admin === 1) {
      return 'Administrador';
    }
    return 'Usuário';
  };

  // Função para obter o perfil principal (para o admin da conta)
  const getMainProfile = (user) => {
    if (user.is_admin === 1 && user.id === adminId) {
      return 'Administrador da conta';
    }
    return null;
  };

  // Classe de cor para role
  const getRoleClass = (role) => {
    if (!role) return 'roleUser';
    const normalized = role.toLowerCase();
    if (normalized.includes('superadmin') || normalized.includes('super')) return 'roleSuperadmin';
    if (normalized.includes('administrador')) return 'roleAdmin';
    return 'roleUser';
  };

  // Filtrar usuários baseado na busca e filtro
  const filteredUsuarios = usuarios.filter(usuario => {
    // Ocultar qualquer usuário Superadmin da listagem
    const isSuperadmin = (typeof usuario.role === 'string' && usuario.role.toLowerCase().includes('superadmin'))
      || usuario.is_superadmin === 1;
    if (isSuperadmin) return false;

    const matchesSearch = usuario.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         usuario.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = !filterProfile || getUserProfile(usuario) === filterProfile;
    
    return matchesSearch && matchesFilter;
  });

  // Calcular paginação
  const totalItems = filteredUsuarios.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // Pegar apenas os usuários da página atual
  const currentUsuarios = filteredUsuarios.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Carregando usuários...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Usuários</h1>
        <div className={styles.headerStats}>
          {totalItems} de {usuarios.length} usuários
        </div>
      </div>

      {/* Barra de busca e filtros */}
      <div className={styles.searchBar}>
        <div className={styles.searchInput}>
          <Search size={20} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Pesquisar"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.input}
          />
        </div>
        <div className={styles.filterSelect}>
          <select
            value={filterProfile}
            onChange={(e) => setFilterProfile(e.target.value)}
            className={styles.select}
          >
            <option value="">Perfil:</option>
            <option value="Administrador">Administrador</option>
            <option value="Usuário">Usuário</option>
          </select>
        </div>
        <div className={styles.headerActions}>
            <button 
              className={styles.newButton}
              onClick={handleOpenCreateModal}
            >
              <Plus size={20} />
              Novo
            </button>
          <button 
            className={styles.refreshButton}
            onClick={fetchUsuarios}
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Mensagens de erro e sucesso */}
      {error && (
        <div className={styles.errorMessage}>
          <span>⚠️</span>
          <div className={styles.errorContent}>
            <p>{error}</p>
            <button 
              onClick={() => {
                setError(null);
                fetchUsuarios();
              }}
              className={styles.retryButton}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {successMessage && (
        <div className={styles.successMessage}>
          <span>✅</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Lista de usuários (Tabela) */}
      <div className={styles.usuariosContainer}>
        {currentUsuarios.length === 0 ? (
          <div className={styles.emptyState}>
            <User size={48} className={styles.emptyIcon} />
            <p>Nenhum usuário encontrado</p>
              <button 
                className={styles.createFirstButton}
                onClick={handleOpenCreateModal}
              >
                <Plus size={20} />
                Adicionar primeiro usuário
              </button>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Usuário</th>
                  <th className={styles.th}>Apelido</th>
                  <th className={styles.th}>Perfis</th>
                  <th className={styles.th} style={{ width: '80px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {currentUsuarios.map((usuario) => {
                  const profile = getUserProfile(usuario);
                  const mainProfile = getMainProfile(usuario);
                  const roleLabel = usuario.role || profile;
                  return (
                    <tr key={usuario.id} className={styles.tr}>
                      <td className={`${styles.td} ${styles.nameCell}`}>
                        <div className={styles.usuarioCell}>
                          {usuario.avatar_url ? (
                            <img 
                              src={usuario.avatar_url} 
                              alt={usuario.nome} 
                              className={styles.avatarImage}
                            />
                          ) : (
                            <div className={styles.avatarInitials}>
                              {getInitials(usuario.nome)}
                            </div>
                          )}
                          <div className={styles.nameInfo}>
                            <span className={styles.usuarioNome}>{usuario.nome}</span>
                            <span className={styles.usuarioEmail}>{usuario.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className={styles.td}>{usuario.apelido || usuario.nome?.split(' ')[0]}</td>
                      <td className={styles.td}>
                        <div className={styles.roleGroup}>
                          {mainProfile && <span className={styles.roleTagMain}>{mainProfile}</span>}
                          <span className={`${styles.roleTag} ${styles[getRoleClass(roleLabel)]}`}>{roleLabel}</span>
                        </div>
                      </td>
                      <td className={`${styles.td} ${styles.actionCell}`}>
                          <button
                            className={styles.editButton}
                            onClick={() => handleOpenEditModal(usuario)}
                            title="Editar usuário"
                          >
                            <Edit2 size={16} />
                          </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.paginationButton}
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </button>
          
          <div className={styles.paginationInfo}>
            Página {currentPage} de {totalPages}
          </div>
          
          <button
            className={styles.paginationButton}
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Próxima
          </button>
        </div>
      )}

      {/* Modal de usuário */}
      <UserModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={editingUser ? handleEditSuccess : handleCreateSuccess}
        user={editingUser}
        isEdit={!!editingUser}
      />
    </div>
  );
}
