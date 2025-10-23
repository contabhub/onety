'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/financeiro/card';
import { Button } from "../../components/financeiro/botao";
import { Input } from "../../components/financeiro/input";
import { Badge } from "../../components/financeiro/badge";
import { 
  Plus, 
  Search, 
  Download, 
  Upload,
  Filter,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Package,
  Wrench
} from 'lucide-react';
import SpaceLoader from '../../components/onety/menu/SpaceLoader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/financeiro/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/financeiro/dropdown-menu';
import NovoProdutoServicoDrawer from '../../components/financeiro/NovoProdutoServicoDrawer';
import { useProdutos } from '../../hooks/financeiro/useProdutos';
import { useServicos } from '../../hooks/financeiro/useServicos';
import { toast } from 'react-toastify';
import styles from '../../styles/financeiro/cadastro-clientes.module.css';
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

  const [isUpdatingStatusMultiple, setIsUpdatingStatusMultiple] = useState(false);

  // Usar os hooks para buscar produtos e serviços da API
  const { produtos, isLoading: produtosLoading, error: produtosError, fetchProdutos, alterarStatus: alterarStatusProduto } = useProdutos({
    status: statusFilter === 'Todos' ? undefined : statusFilter.toLowerCase()
  });

  const { servicos, isLoading: servicosLoading, error: servicosError, fetchServicos, alterarStatus: alterarStatusServico } = useServicos({
    status: statusFilter === 'Todos' ? undefined : statusFilter.toLowerCase()
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

  const clearSelection = () => {
    setSelectedItems(new Set());
    setSelectAll(false);
  };

  const getStatusBadge = (status) => {
    return status.toLowerCase() === 'ativo' ? (
      <Badge className="bg-[#1E88E5]/20 text-[#26a6eb] border-[#1E88E5]/30">Ativo</Badge>
    ) : (
      <Badge className="bg-[#B0AFC1]/20 text-[#B0AFC1] border-[#B0AFC1]/30">Inativo</Badge>
    );
  };

  const getTipoBadge = (item) => {
    const isProduto = item.itemType === 'produto';
    return (
      <Badge className={`${isProduto ? 'bg-[#1E88E5]/20 text-[#26a6eb] border-[#1E88E5]/30' : 'bg-[#9C27B0]/20 text-[#9C27B0] border-[#9C27B0]/30'}`}>
        {isProduto ? 'Produto' : 'Serviço'}
      </Badge>
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
      const response = await fetch(`${API}/produtos-servicos/${item.id}/status`, {
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
        const response = await fetch(`${API}/produtos-servicos/${id}/status`, {
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

  // Componente de Loading
  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="w-20 h-20">
      <SpaceLoader label="Carregando produtos e serviços..." size={100} minHeight={150} />
      </div>
    </div>
  );

  // Mostrar loading se estiver carregando
  if (isLoading) {
    return (
      <div className={styles.page}>
        <LoadingState />
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
          <p className={styles.headerSubtitle}>Gerencie seus produtos e serviços</p>
        </div>
        <div className={styles.headerActions}>
          <Button 
            size="sm"
            className={styles.btnNew}
            onClick={() => setIsNovoItemOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo item
          </Button>
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
                <Input 
                  placeholder="Digite o nome ou código..."
                  className={styles.searchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={styles.labelSmall}>Tipo</label>
              <Select value={tipoFilter} onValueChange={(value) => setTipoFilter(value)}>
                <SelectTrigger className={styles.selectTriggerSmall}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  <SelectItem value="Todos" className={styles.selectItem}>Todos os tipos</SelectItem>
                  <SelectItem value="Produtos" className={styles.selectItem}>Apenas produtos</SelectItem>
                  <SelectItem value="Serviços" className={styles.selectItem}>Apenas serviços</SelectItem>
                </SelectContent>
              </Select>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={styles.btnSecondary}>
                  Ações em lote
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className={styles.dropdownContent}>
                <DropdownMenuItem className={styles.dropdownItem}>Editar selecionados</DropdownMenuItem>
                <DropdownMenuItem className={styles.dropdownItem} onClick={() => handleBatchStatusChange('ativo')}>
                  Ativar selecionados
                </DropdownMenuItem>
                <DropdownMenuItem className={styles.dropdownItem} onClick={() => handleBatchStatusChange('inativo')}>
                  Desativar selecionados
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              className={styles.btnDangerOutline}
            >
              Limpar seleção
            </Button>
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
                        {item.itemType === 'produto' ? (
                          <Package className="w-4 h-4 text-[#26a6eb]" />
                        ) : (
                          <Wrench className="w-4 h-4 text-[#9C27B0]" />
                        )}
                        <span className={styles.clienteName}>{item.nome}</span>
                      </div>
                    </td>
                    <td className={styles.tableCell}>
                      {getTipoBadge(item)}
                    </td>
                    <td className={styles.tableCell}>
                      <Badge className={styles.badgeActive}>
                        {item.tipo}
                      </Badge>
                    </td>
                    <td className={styles.tableCell}>
                      <button
                        onClick={() => handleStatusChange(item)}
                        className="hover:opacity-80 transition-opacity"
                      >
                        {getStatusBadge(item.status)}
                      </button>
                    </td>
                    <td className={styles.tableCell}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className={styles.dropdownTrigger}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className={styles.dropdownContent}>
                          <DropdownMenuItem 
                            className={styles.dropdownItem}
                            onClick={() => handleStatusChange(item)}
                          >
                            {item.status === 'Ativo' ? 'Desativar' : 'Ativar'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
      <PrincipalSidebar />
    </div>
  );
}
