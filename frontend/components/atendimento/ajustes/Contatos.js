import { useState, useEffect } from 'react';
import styles from './Contatos.module.css';
import { User, Plus, Search, RefreshCw, ChevronLeft, ChevronRight, Edit2, Phone, Mail, Eye, Trash2, Upload, Download } from 'lucide-react';
import ContatoModal from './ContatoModal';
import ContatoDetailsModal from './ContatoDetailsModal';
import ImportContatosModal from './ImportContatosModal';
import ExportContatosModal from './ExportContatosModal';
import { formatPhone } from '../../utils/contactHelper';

export default function Contatos() {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(7);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [editingContato, setEditingContato] = useState(null);
  const [selectedContato, setSelectedContato] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [contatoToDelete, setContatoToDelete] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Verificar se os dados necessários estão disponíveis
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const companyId = userData.companyId;
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
    
    // Carregar contatos
    fetchContatos();
  }, []);

  const fetchContatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('URL da API não configurada.');
      }
      
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').companyId;
      const url = `${apiUrl}/contacts/company/${companyId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar contatos');
      }

      const data = await response.json();
      setContatos(data || []);
    } catch (err) {
      console.error('Erro ao buscar contatos:', err);
      setError('Erro ao carregar contatos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = (newContato) => {
    // Recarregar lista de contatos
    fetchContatos();
    
    // Mostrar mensagem de sucesso
    setSuccessMessage(`Contato "${newContato.nome}" criado com sucesso!`);
    
    // Limpar mensagem após 3 segundos
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  const handleEditSuccess = (updatedContato) => {
    // Recarregar lista de contatos
    fetchContatos();
    
    // Mostrar mensagem de sucesso
    setSuccessMessage(`Contato "${updatedContato.nome}" atualizado com sucesso!`);
    
    // Limpar mensagem após 3 segundos
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  const handleOpenCreateModal = () => {
    setEditingContato(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (contato) => {
    setEditingContato(contato);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingContato(null);
  };

  const handleOpenDetailsModal = (contato) => {
    setSelectedContato(contato);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedContato(null);
  };

  const handleDeleteContato = async (contato) => {
    try {
      setLoading(true);
      setError(null);
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('URL da API não configurada.');
      }
      
      const url = `${apiUrl}/contacts/${contato.id}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar contato');
      }

      // Recarregar lista de contatos
      await fetchContatos();
      
      // Mostrar mensagem de sucesso
      setSuccessMessage(`Contato "${contato.nome}" deletado com sucesso!`);
      
      // Limpar mensagem após 3 segundos
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      
    } catch (err) {
      console.error('Erro ao deletar contato:', err);
      setError('Erro ao deletar contato. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDeleteModal = (contato) => {
    setContatoToDelete(contato);
    setDeleteConfirmModal(true);
  };

  const handleCloseDeleteModal = () => {
    setDeleteConfirmModal(false);
    setContatoToDelete(null);
  };

  const handleConfirmDelete = () => {
    if (contatoToDelete) {
      handleDeleteContato(contatoToDelete);
      handleCloseDeleteModal();
    }
  };

  const handleImportSuccess = (result) => {
    // Recarregar lista de contatos
    fetchContatos();
    
    // Mostrar mensagem de sucesso
    setSuccessMessage(`Importação concluída! ${result.imported || 0} contatos importados com sucesso.`);
    
    // Limpar mensagem após 5 segundos
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  const handleOpenImportModal = () => {
    setIsImportModalOpen(true);
  };

  const handleCloseImportModal = () => {
    setIsImportModalOpen(false);
  };

  const handleOpenExportModal = () => {
    setIsExportModalOpen(true);
  };

  const handleCloseExportModal = () => {
    setIsExportModalOpen(false);
  };

  const handleExportSuccess = () => {
    // Mostrar mensagem de sucesso
    setSuccessMessage('Exportação realizada com sucesso!');
    
    // Limpar mensagem após 3 segundos
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  // Função para gerar iniciais do nome do contato
  const getInitials = (nome) => {
    if (!nome) return 'C';
    return nome
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };



  // Filtrar contatos baseado na busca
  const filteredContatos = contatos.filter(contato => {
    const matchesSearch = contato.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contato.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contato.telefone?.includes(searchTerm);
    
    return matchesSearch;
  });

  // Calcular paginação
  const totalItems = filteredContatos.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // Pegar apenas os contatos da página atual
  const currentContatos = filteredContatos.slice(startIndex, endIndex);

  const renderContatoRow = (contato) => {
    return (
      <tr key={contato.id} className={styles.tr}>
        <td className={`${styles.td} ${styles.nameCell}`}>
          <div className={styles.contatoCell}>
            <div className={styles.avatarInitials}>{getInitials(contato.nome)}</div>
            <div className={styles.nameInfo}>
              <span className={styles.contatoNome}>{contato.nome}</span>
            </div>
          </div>
        </td>
        <td className={styles.td}>
          {contato.telefone ? formatPhone(contato.telefone) : '-'}
        </td>
        <td className={styles.td}>
          {contato.email || '-'}
        </td>
        <td className={`${styles.td} ${styles.actionCell}`}>
          <div className={styles.contatoActions}>
            <button
              className={styles.viewButton}
              onClick={() => handleOpenDetailsModal(contato)}
              title="Ver detalhes do contato"
            >
              <Eye size={16} />
            </button>
            {(userRole === 'Administrador' || userRole === 'Superadmin') && (
              <>
                <button
                  className={styles.editButton}
                  onClick={() => handleOpenEditModal(contato)}
                  title="Editar contato"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  className={styles.deleteButton}
                  onClick={() => handleOpenDeleteModal(contato)}
                  title="Deletar contato"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Carregando contatos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Contatos</h1>
        <div className={styles.headerStats}>
          {totalItems} de {contatos.length} contatos
        </div>
      </div>

      {/* Barra de busca e filtros */}
      <div className={styles.searchBar}>
        <div className={styles.searchInput}>
          <Search size={20} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Pesquisar por nome, email ou telefone"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.input}
          />
        </div>
        <div className={styles.headerActions}>
          {(userRole === 'Administrador' || userRole === 'Superadmin') && (
            <>
              <button 
                className={styles.importButton}
                onClick={handleOpenImportModal}
              >
                <Upload size={20} />
                Importar
              </button>
              <button 
                className={styles.exportButton}
                onClick={handleOpenExportModal}
              >
                <Download size={20} />
                Exportar
              </button>
              <button 
                className={styles.newButton}
                onClick={handleOpenCreateModal}
              >
                <Plus size={20} />
                Novo Contato
              </button>
            </>
          )}
          <button 
            className={styles.refreshButton}
            onClick={fetchContatos}
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
                fetchContatos();
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

      {/* Lista de contatos (Tabela) */}
      <div className={styles.contatosContainer}>
        {currentContatos.length === 0 ? (
          <div className={styles.emptyState}>
            <User size={48} className={styles.emptyIcon} />
            <p>{searchTerm ? 'Nenhum contato encontrado' : 'Nenhum contato cadastrado'}</p>
            {!searchTerm && (userRole === 'Administrador' || userRole === 'Superadmin') && (
              <button 
                className={styles.createFirstButton}
                onClick={handleOpenCreateModal}
              >
                <Plus size={20} />
                Adicionar primeiro contato
              </button>
            )}
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Nome</th>
                  <th className={styles.th}>Telefone</th>
                  <th className={styles.th}>Email</th>
                  <th className={styles.th} style={{ width: '120px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {currentContatos.map(renderContatoRow)}
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

      {/* Modal de contato */}
      <ContatoModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={editingContato ? handleEditSuccess : handleCreateSuccess}
        contato={editingContato}
        isEdit={!!editingContato}
      />

      {/* Modal de detalhes do contato */}
      <ContatoDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={handleCloseDetailsModal}
        contato={selectedContato}
        onEdit={handleOpenEditModal}
      />

      {/* Modal de importação de contatos */}
      <ImportContatosModal
        isOpen={isImportModalOpen}
        onClose={handleCloseImportModal}
        onImportSuccess={handleImportSuccess}
      />

      {/* Modal de exportação de contatos */}
      <ExportContatosModal
        isOpen={isExportModalOpen}
        onClose={handleCloseExportModal}
        onExportSuccess={handleExportSuccess}
      />

      {/* Modal de confirmação de delete */}
      {deleteConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Confirmar Exclusão</h3>
            </div>
            <div className={styles.modalBody}>
              <p>
                Tem certeza que deseja deletar o contato <strong>"{contatoToDelete?.nome}"</strong>?
              </p>
              <p className={styles.warningText}>
                Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.cancelButton}
                onClick={handleCloseDeleteModal}
              >
                Cancelar
              </button>
              <button
                className={styles.confirmDeleteButton}
                onClick={handleConfirmDelete}
              >
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
