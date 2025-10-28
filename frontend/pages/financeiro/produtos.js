'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical,
  X
} from 'lucide-react';
import SpaceLoader from '../../components/onety/menu/SpaceLoader';
import NovoProdutoServicoDrawer from '../../components/financeiro/NovoProdutoServicoDrawer';
import { useProdutos } from '../../hooks/financeiro/useProdutos';
import { useServicos } from '../../hooks/financeiro/useServicos';
import { toast } from 'react-toastify';
import styles from '../../styles/financeiro/produtos.module.css';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';

export default function ProdutosServicosPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [tipoFilter, setTipoFilter] = useState('Todos');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isNovoItemOpen, setIsNovoItemOpen] = useState(false);
  const [userData, setUserData] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  const [isUpdatingStatusMultiple, setIsUpdatingStatusMultiple] = useState(false);

  // Carregar dados do usuário do localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('userData');
      const parsed = raw ? JSON.parse(raw) : null;
      setUserData(parsed);
      
      if (parsed) {
        const empresaIdFromUserData = parsed.EmpresaId || parsed.empresa?.id;
        setEmpresaId(empresaIdFromUserData);
        console.log('🏢 EmpresaId carregado:', empresaIdFromUserData);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar userData:', error);
    }
  }, []);

  // Usar os hooks para buscar produtos e serviços da API
  const { produtos, isLoading: produtosLoading, error: produtosError, fetchProdutos, alterarStatus: alterarStatusProduto } = useProdutos({
    status: statusFilter === 'Todos' ? undefined : statusFilter.toLowerCase(),
    empresaId: empresaId
  });

  const { servicos, isLoading: servicosLoading, error: servicosError, fetchServicos, alterarStatus: alterarStatusServico } = useServicos({
    status: statusFilter === 'Todos' ? undefined : statusFilter.toLowerCase(),
    empresaId: empresaId
  });

  const isLoading = produtosLoading || servicosLoading;
  const error = produtosError || servicosError;

  // Unificar produtos e serviços em uma lista
  const itensUnificados = [
    ...produtos.map(produto => ({
      id: produto.id,
      nome: produto.nome,
      tipo: produto.tipo,
      status: produto.status,
      itemType: 'produto',
      originalItem: produto
    })),
    ...servicos.map(servico => ({
      id: servico.id,
      nome: servico.nome,
      tipo: servico.tipo,
      status: servico.status,
      codigo: servico.codigo,
      itemType: 'servico',
      originalItem: servico
    }))
  ];

  const filteredItems = itensUnificados.filter(item => {
    const matchesSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.codigo && item.codigo.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'Todos' || item.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesTipo = tipoFilter === 'Todos' || 
                       (tipoFilter === 'Produtos' && item.itemType === 'produto') ||
                       (tipoFilter === 'Serviços' && item.itemType === 'servico');
    
    return matchesSearch && matchesStatus && matchesTipo;
  });

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  // Cálculo das páginas visíveis
  const maxVisiblePages = 5;
  let paginaInicio = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let paginaFim = Math.min(totalPages, paginaInicio + maxVisiblePages - 1);
  
  // Ajusta o início se estivermos próximos ao fim
  if (paginaFim - paginaInicio < maxVisiblePages - 1) {
    paginaInicio = Math.max(1, paginaFim - maxVisiblePages + 1);
  }

  // Função para resetar página quando mudar quantidade de itens
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset para primeira página
  };

  // Funções para seleção múltipla
  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = paginatedItems.map(item => item.id);
      setSelectedItems(new Set(allIds));
      setSelectAll(true);
    } else {
      setSelectedItems(new Set());
      setSelectAll(false);
    }
  };

  const handleSelectItem = (id, checked) => {
    const newSelectedItems = new Set(selectedItems);
    if (checked) {
      newSelectedItems.add(id);
    } else {
      newSelectedItems.delete(id);
    }
    setSelectedItems(newSelectedItems);
  };

  // Sincronizar estado selectAll com seleções individuais
  useEffect(() => {
    if (paginatedItems.length === 0) {
      setSelectAll(false);
      return;
    }
    
    const allSelected = paginatedItems.every(item => selectedItems.has(item.id));
    if (allSelected) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [paginatedItems, selectedItems]);

  // Limpar seleções quando mudar de página ou filtros
  useEffect(() => {
    setSelectedItems(new Set());
    setSelectAll(false);
  }, [currentPage, searchTerm, statusFilter, tipoFilter]);

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(`.${styles.dropdownContainer}`) && 
          !event.target.closest(`.${styles.dropdownContent}`)) {
        setOpenDropdownId(null);
      }
    };

    if (openDropdownId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdownId]);

  const clearSelection = () => {
    setSelectedItems(new Set());
    setSelectAll(false);
  };

  const getStatusBadge = (status) => {
    return status.toLowerCase() === 'ativo' ? (
      <span className={styles.badgeActive}>Ativo</span>
    ) : (
      <span className={styles.badgeInactive}>Inativo</span>
    );
  };

  const getTipoBadge = (item) => {
    const isProduto = item.itemType === 'produto';
    return (
      <span className={isProduto ? styles.badgeProduto : styles.badgeServico}>
        {isProduto ? 'Produto' : 'Serviço'}
      </span>
    );
  };

  const getStatusCount = (status) => {
    if (status === 'Todos') return itensUnificados.length;
    return itensUnificados.filter(item => item.status.toLowerCase() === status.toLowerCase()).length;
  };

  const getTipoCount = (tipo) => {
    if (tipo === 'Todos') return itensUnificados.length;
    return itensUnificados.filter(item => 
      (tipo === 'Produtos' && item.itemType === 'produto') ||
      (tipo === 'Serviços' && item.itemType === 'servico')
    ).length;
  };

  const handleStatusChange = async (item) => {
    try {
      const newStatus = item.status === 'Ativo' ? 'inativo' : 'ativo';
      
      const token = localStorage.getItem("token");
      const API = process.env.NEXT_PUBLIC_API_URL;

      if (!token || !API) {
        toast.error("Token não encontrado. Faça login novamente.");
        return;
      }

      // Usar a rota correta da API para alterar status
      const response = await fetch(`${API}/financeiro/produtos-servicos/${item.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Erro ao alterar status");
      }

      const result = await response.json();
      
      // Recarregar dados para refletir a mudança
      if (item.itemType === 'produto') {
        await fetchProdutos();
      } else {
        await fetchServicos();
      }
      
      toast.success(result.message || `Status alterado para ${newStatus === 'ativo' ? 'Ativo' : 'Inativo'}`);
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do item');
    }
  };





  // Função para alterar status de múltiplos itens
  const handleBatchStatusChange = async (newStatus) => {
    if (selectedItems.size === 0) return;

    try {
      setIsUpdatingStatusMultiple(true);
      
      const token = localStorage.getItem("token");
      const API = process.env.NEXT_PUBLIC_API_URL;

      if (!token || !API) {
        toast.error("Token não encontrado. Faça login novamente.");
        return;
      }

      // Alterar status de todos os itens selecionados usando a rota correta
      const promises = Array.from(selectedItems).map(async (id) => {
        const response = await fetch(`${API}/financeiro/produtos-servicos/${id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!response.ok) {
          throw new Error(`Erro ao alterar status do item ${id}`);
        }

        return response.json();
      });
      
      await Promise.all(promises);
      
      // Recarregar dados para refletir as mudanças
      await fetchProdutos();
      await fetchServicos();
      
      // Limpar seleção após alteração
      setSelectedItems(new Set());
      setSelectAll(false);
      
      toast.success(`${selectedItems.size} item(s) ${newStatus === 'ativo' ? 'ativado(s)' : 'desativado(s)'} com sucesso`);
    } catch (error) {
      console.error('Erro ao alterar status em lote:', error);
      toast.error('Erro ao alterar status dos itens selecionados');
    } finally {
      setIsUpdatingStatusMultiple(false);
    }
  };

  const handleNovoItemSuccess = () => {
    // Recarregar a lista após criar um novo item
    window.location.reload();
  };

  // Função para editar item individual
  const handleEditItem = (item) => {
    // Definir o item para edição e abrir o modal
    setItemToEdit(item);
    setIsEditModalOpen(true);
  };

  // Função para editar itens selecionados
  const handleEditSelected = () => {
    if (selectedItems.size === 0) {
      toast.warning("Selecione pelo menos um item para editar");
      return;
    }

    if (selectedItems.size > 1) {
      toast.warning("Por enquanto, é possível editar apenas um item por vez");
      return;
    }

    // Pegar o primeiro item selecionado
    const selectedId = Array.from(selectedItems)[0];
    const selectedItem = itensUnificados.find(item => item.id === selectedId);

    if (!selectedItem) {
      toast.error("Item selecionado não encontrado");
      return;
    }

    // Definir o item para edição e abrir o modal
    setItemToEdit(selectedItem);
    setIsEditModalOpen(true);
  };

  // Função para fechar o modal de edição
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setItemToEdit(null);
  };

  // Função para controlar dropdown individual
  const handleDropdownToggle = (itemId, event) => {
    if (openDropdownId === itemId) {
      setOpenDropdownId(null);
      return;
    }

    // Calcular posição do dropdown
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    
    // Definir posição do dropdown
    setDropdownPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.right - 192 + window.scrollX // 192px é a largura do dropdown
    });
    
    setOpenDropdownId(itemId);
  };

  // Função para fechar dropdown quando clicar fora
  const handleCloseDropdown = () => {
    setOpenDropdownId(null);
  };

  // Função para salvar as alterações do item
  const handleSaveEdit = async (updatedData) => {
    try {
      const token = localStorage.getItem("token");
      const API = process.env.NEXT_PUBLIC_API_URL;

      if (!token || !API) {
        toast.error("Token não encontrado. Faça login novamente.");
        return;
      }

      const response = await fetch(`${API}/financeiro/produtos-servicos/${itemToEdit.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        throw new Error("Erro ao atualizar item");
      }

      const result = await response.json();
      
      // Recarregar dados para refletir a mudança
      await fetchProdutos();
      await fetchServicos();
      
      toast.success(result.message || "Item atualizado com sucesso");
      handleCloseEditModal();
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
      toast.error('Erro ao atualizar item');
    }
  };

  // Componente de Loading
  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="w-20 h-20">
      <SpaceLoader label="Carregando produtos e serviços..." size={100} minHeight={150} />
      </div>
    </div>
  );

  // Mostrar loading se estiver carregando ou se não há empresaId
  if (isLoading || !empresaId) {
    return (
      <div className={styles.page}>
        <LoadingState />
      </div>
    );
  }

  // Mostrar erro se não conseguir carregar dados da empresa
  if (!userData) {
    return (
      <div className={styles.page}>
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Erro de Autenticação</h2>
            <p className="text-gray-500">Não foi possível carregar os dados do usuário. Faça login novamente.</p>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>
            Produtos e Serviços
          </h1>
        </div>
        <div className={styles.headerActions}>
          <button 
            type="button"
            className={styles.btnNew}
            onClick={() => setIsNovoItemOpen(true)}
          >
            Novo item
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className={styles.filtersCard}>
        <div className={styles.cardContentPadded}>
          <div className={styles.filtersRow}>
            <div className={styles.flex1}>
              <label className={styles.labelSmall}>Buscar produtos e serviços</label>
              <div className={styles.searchWrap}>
                <Search className={styles.searchIcon} />
                <input 
                  type="text"
                  placeholder="Digite o nome ou código..."
                  className={styles.searchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={styles.labelSmall}>Tipo</label>
              <select
                value={tipoFilter}
                onChange={(e) => setTipoFilter(e.target.value)}
                className={styles.selectTriggerSmall}
              >
                <option value="Todos">Todos os tipos</option>
                <option value="Produtos">Apenas produtos</option>
                <option value="Serviços">Apenas serviços</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Batch Actions */}
      {selectedItems.size > 0 && (
        <div className={styles.actionsBar}>
          <div className={styles.actionsLeft}>
            <span className={styles.textMutedSmall}>
              {selectedItems.size} registro(s) selecionado(s)
            </span>
            <div className={styles.dropdownContainer}>
              <button 
                type="button"
                className={styles.btnSecondary}
                onClick={(e) => handleDropdownToggle('batch-actions', e)}
              >
                Ações em lote
              </button>
              {openDropdownId === 'batch-actions' && (
                <div className={styles.dropdownContent} style={{
                  top: dropdownPosition.top,
                  left: dropdownPosition.left
                }}>
                  <button className={styles.dropdownItem} onClick={() => {
                    handleBatchStatusChange('ativo');
                    handleCloseDropdown();
                  }}>
                    Ativar selecionados
                  </button>
                  <button className={styles.dropdownItem} onClick={() => {
                    handleBatchStatusChange('inativo');
                    handleCloseDropdown();
                  }}>
                    Desativar selecionados
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className={styles.btnDangerOutline}
            >
              Limpar seleção
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.tableHeadRow}>
                <th className={styles.tableHeadCellCheckbox}>
                  <input 
                    type="checkbox" 
                    className={styles.checkbox}
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th className={styles.tableHeadCell}>
                  Nome
                  <span className="ml-1">↕</span>
                </th>
                <th className={styles.tableHeadCell}>
                  Tipo
                </th>
                <th className={styles.tableHeadCell}>
                  Categoria
                </th>
                <th className={styles.tableHeadCell}>
                  Status
                </th>
                <th className={styles.tableHeadCell}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.tableEmpty}>
                    <div className={styles.loadingWrap}>
                      <div className={styles.notFoundIcon}></div>
                      <p className={styles.textMutedSmall}>
                        {searchTerm || statusFilter !== 'Todos' || tipoFilter !== 'Todos' 
                          ? 'Nenhum item encontrado com os filtros aplicados' 
                          : 'Nenhum produto ou serviço cadastrado'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
                  <tr key={item.id} className={styles.tableRow}>
                    <td className={styles.tableCellCheckbox}>
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={selectedItems.has(item.id)}
                        onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                      />
                    </td>
                    <td className={styles.tableCell}>
                      <div className="flex items-center gap-2">
                        <span className={styles.clienteName}>{item.nome}</span>
                      </div>
                    </td>
                    <td className={styles.tableCell}>
                      {getTipoBadge(item)}
                    </td>
                    <td className={styles.tableCell}>
                      <span className={styles.badgeCategoria}>
                        {item.tipo}
                      </span>
                    </td>
                    <td className={styles.tableCell}>
                      <button
                        onClick={() => handleStatusChange(item)}
                        className={styles.statusButton}
                      >
                        {getStatusBadge(item.status)}
                      </button>
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.dropdownContainer}>
                        <button
                          className={styles.dropdownTrigger}
                          onClick={(e) => handleDropdownToggle(item.id, e)}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {filteredItems.length > 0 && (
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Mostrando {(currentPage - 1) * itemsPerPage + 1}
              {" - "}
              {Math.min(currentPage * itemsPerPage, filteredItems.length)} de {filteredItems.length}
            </span>
            <div className={styles.paginationButtons}>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className={styles.paginationSelect}
                style={{ marginRight: 16 }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <button
                className={styles.paginationArrow}
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                aria-label="Primeira página"
              >
                {"<<"}
              </button>
              <button
                className={styles.paginationArrow}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Página anterior"
              >
                {"<"}
              </button>
              {Array.from({ length: paginaFim - paginaInicio + 1 }, (_, i) => paginaInicio + i).map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={p === currentPage ? styles.paginationButtonActive : styles.paginationArrow}
                >
                  {p}
                </button>
              ))}
              <button
                className={styles.paginationArrow}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Próxima página"
              >
                {">"}
              </button>
              <button
                className={styles.paginationArrow}
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                aria-label="Última página"
              >
                {">>"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Novo Produto/Serviço Drawer */}
      <NovoProdutoServicoDrawer
        isOpen={isNovoItemOpen}
        onClose={() => setIsNovoItemOpen(false)}
        onSuccess={handleNovoItemSuccess}
      />

      {/* Dropdown Global */}
      {openDropdownId && (
        <div 
          className={styles.dropdownContent}
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left
          }}
        >
          <button
            className={styles.dropdownItem}
            onClick={() => {
              const item = itensUnificados.find(i => i.id === openDropdownId);
              if (item) {
                handleEditItem(item);
                handleCloseDropdown();
              }
            }}
          >
            Editar
          </button>
          <button
            className={styles.dropdownItem}
            onClick={() => {
              const item = itensUnificados.find(i => i.id === openDropdownId);
              if (item) {
                handleStatusChange(item);
                handleCloseDropdown();
              }
            }}
          >
            {(() => {
              const item = itensUnificados.find(i => i.id === openDropdownId);
              return item?.status === 'Ativo' ? 'Desativar' : 'Ativar';
            })()}
          </button>
        </div>
      )}

      {/* Modal de Edição */}
      {isEditModalOpen && itemToEdit && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Editar Item</h3>
              <button
                onClick={handleCloseEditModal}
                className={styles.modalCloseButton}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Nome
                </label>
                <input
                  type="text"
                  defaultValue={itemToEdit.nome}
                  className={styles.formInput}
                  id="edit-nome"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Tipo
                </label>
                <select
                  defaultValue={itemToEdit.itemType === 'produto' ? 'produto' : 'servico'}
                  className={styles.formInput}
                  id="edit-tipo"
                >
                  <option value="produto">Produto</option>
                  <option value="servico">Serviço</option>
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Status
                </label>
                <select
                  defaultValue={itemToEdit.status.toLowerCase()}
                  className={styles.formInput}
                  id="edit-status"
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
            
            <div className={styles.modalActions}>
              <button
                onClick={handleCloseEditModal}
                className={styles.modalCancelButton}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const nome = document.getElementById('edit-nome').value;
                  const tipo = document.getElementById('edit-tipo').value;
                  const status = document.getElementById('edit-status').value;
                  
                  handleSaveEdit({
                    nome: nome.trim(),
                    tipo: tipo
                  });
                }}
                className={styles.modalSaveButton}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <PrincipalSidebar />
    </div>
  );
}
