"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Download,
  Trash2,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  X,
  Calendar,
  Loader2,
  FileText,
} from "lucide-react";
import { toast } from "react-toastify";
import SpaceLoader from '../../components/onety/menu/SpaceLoader';
import styles from '../../styles/financeiro/contratos.module.css';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';
import { useContratos } from "../../hooks/financeiro/useContratos";
import { DetalhesContratoDrawer } from '../../components/financeiro/DetalhesContratoDrawer';



export default function ContratosPage() {
  const [selectedItems, setSelectedItems] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");
  const [statusFilter, setStatusFilter] = useState("todos");
  
  // Estados para download de boleto
  const [isDownloadingBoleto, setIsDownloadingBoleto] = useState(null);

  // Estados para filtros de data
  const [currentDate, setCurrentDate] = useState(new Date());
  const [periodFilter, setPeriodFilter] = useState("month");
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  
  // Estados para dropdown de ações
  const [activeDropdown, setActiveDropdown] = useState(null);
  
  // Estados para o drawer de detalhes
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [contratoSelecionado, setContratoSelecionado] = useState(null);

  // Usar o hook personalizado
  const { contratos, isLoading, error, buscarContratos } =
    useContratos();

  // Carregar contratos na inicialização
  useEffect(() => {
    buscarContratos();
  }, [buscarContratos]);

  // Função para obter o range de datas baseado no filtro
  const getDateRange = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    switch (periodFilter) {
      case "week":
        // Início da semana (domingo) da data selecionada
        start.setDate(currentDate.getDate() - currentDate.getDay());
        start.setHours(0, 0, 0, 0);
        // Fim da semana (sábado)
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case "month":
        // Início do mês selecionado
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        // Fim do mês selecionado
        end.setMonth(end.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "year":
        // Início do ano da data selecionada
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        // Fim do ano da data selecionada
        end.setMonth(11, 31);
        end.setHours(23, 59, 59, 999);
        break;
      case "all":
        // Todo o período (data muito antiga até hoje)
        start.setFullYear(1900, 0, 1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  };

  // Reset da página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm, periodFilter, currentDate]);

  // Filtrar dados baseado no termo de pesquisa, status e período
  const filteredContratos = contratos.filter((contrato) => {
    // Filtro por status
    const matchesStatus =
      statusFilter === "todos" || contrato.status === statusFilter;

    // Filtro por período
    const { start, end } = getDateRange();
    const contratoDate = new Date(contrato.comeca_em);
    const matchesPeriod = periodFilter === "all" || (contratoDate >= start && contratoDate <= end);

    // Filtro por termo de pesquisa
    if (!searchTerm.trim()) return matchesStatus && matchesPeriod;

    const searchLower = searchTerm.toLowerCase();
    
    // Busca por nome do cliente
    const matchesCliente = contrato.cliente_nome
      .toLowerCase()
      .includes(searchLower);
    
    // Busca por ID do contrato
    const matchesId = contrato.id.toString().includes(searchTerm);
    
    // Busca por número do contrato
    const matchesNumero = contrato.numero_contrato
      ? contrato.numero_contrato.toLowerCase().includes(searchLower)
      : false;

    // Busca por valor - converter formato brasileiro para número
    let matchesValue = false;
    if (searchLower.includes('r$') || searchLower.includes(',') || searchLower.includes('.')) {
      // Remover R$, espaços e converter vírgula para ponto
      const cleanSearch = searchLower
        .replace(/r\$/g, '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
      
      const searchValue = parseFloat(cleanSearch);
      
      if (!isNaN(searchValue)) {
        const contratoValue = Number(contrato.valor || 0);
        // Busca exata ou aproximada (com tolerância de 0.01 para diferenças de arredondamento)
        matchesValue = Math.abs(contratoValue - searchValue) < 0.01;
      }
    }
    
    // Busca por valor sem formatação (apenas números)
    if (!matchesValue && /^\d+([.,]\d+)?$/.test(searchLower)) {
      const cleanSearch = searchLower.replace(',', '.');
      const searchValue = parseFloat(cleanSearch);
      
      if (!isNaN(searchValue)) {
        const contratoValue = Number(contrato.valor || 0);
        matchesValue = Math.abs(contratoValue - searchValue) < 0.01;
      }
    }

    // Busca por data (formato brasileiro)
    const formatDateForSearch = (dateString) => {
      if (!dateString) return "";
      
      try {
        const date = new Date(dateString);
        // Retorna no formato DD/MM/YYYY
        return date.toLocaleDateString("pt-BR");
      } catch {
        return "";
      }
    };
    
    const matchesDate = formatDateForSearch(contrato.data_inicio || "").includes(searchTerm) ||
                       (contrato.proximo_vencimento ? formatDateForSearch(contrato.proximo_vencimento).includes(searchTerm) : false);

    const matchesSearch = matchesCliente || matchesId || matchesNumero || matchesValue || matchesDate;

    return matchesStatus && matchesPeriod && matchesSearch;
  });

  // Cálculos das métricas baseados nos dados reais
  const totalInativos = contratos.filter((c) => c.status === "inativo").length;
  const valorInativos = contratos
    .filter((c) => c.status === "inativo")
    .reduce((sum, c) => sum + (Number(c.valor) || 0), 0);

  const totalCancelados = contratos.filter(
    (c) => c.status === "cancelado"
  ).length;
  const valorCancelados = contratos
    .filter((c) => c.status === "cancelado")
    .reduce((sum, c) => sum + (Number(c.valor) || 0), 0);

  const totalAtivos = contratos.filter((c) => c.status === "ativo").length;
  const valorAtivos = contratos
    .filter((c) => c.status === "ativo")
    .reduce((sum, c) => sum + (Number(c.valor) || 0), 0);

  const totalTodos = contratos.length;
  const valorTodos = contratos.reduce(
    (sum, c) => sum + (Number(c.valor) || 0),
    0
  );

  // Paginação
  const totalPages = Math.ceil(filteredContratos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredContratos.slice(startIndex, endIndex);

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

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedItems(currentItems.map((item) => item.id.toString()));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (itemId, checked) => {
    if (checked) {
      setSelectedItems([...selectedItems, itemId]);
    } else {
      setSelectedItems(selectedItems.filter((id) => id !== itemId));
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Função para formatar o período atual
  const formatCurrentPeriod = () => {
    const { start, end } = getDateRange();
    
    switch (periodFilter) {
      case "week":
        return `${start.toLocaleDateString("pt-BR")} - ${end.toLocaleDateString("pt-BR")}`;
      case "month":
        const monthName = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        // Capitalizar a primeira letra do mês
        return monthName.charAt(0).toUpperCase() + monthName.slice(1);
      case "year":
        return start.getFullYear().toString();
      case "all":
        return "Todo o período";
      default:
        return "Período";
    }
  };

  // Função para navegar entre meses
  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    if (direction === "prev") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
  };

  const formatCurrency = (value) => {
    if (!value || isNaN(value)) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === "Indeterminado") return "Indeterminado";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const getSituacaoBadge = (situacao) => {
    if (!situacao) {
      return (
        <span className={`${styles.statusBadge} ${styles.statusInativo}`}>
          Não definido
        </span>
      );
    }

    switch (situacao) {
      case "ativo":
        return (
          <span className={`${styles.statusBadge} ${styles.statusAtivo}`}>
            Ativo
          </span>
        );
      case "inativo":
        return (
          <span className={`${styles.statusBadge} ${styles.statusInativo}`}>
            Inativo
          </span>
        );
      case "cancelado":
        return (
          <span className={`${styles.statusBadge} ${styles.statusCancelado}`}>
            Cancelado
          </span>
        );
      default:
        return (
          <span className={`${styles.statusBadge} ${styles.statusInativo}`}>
            {situacao}
          </span>
        );
    }
  };


  // Funções para dropdown customizado
  const handleToggleDropdown = (contratoId) => {
    setActiveDropdown(activeDropdown === contratoId ? null : contratoId);
  };

  const handleCloseDropdown = () => {
    setActiveDropdown(null);
  };

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveDropdown(null);
    };
    
    if (activeDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeDropdown]);

  // Função para baixar boleto
  const handleDownloadBoleto = async (contratoId) => {
    try {
      setIsDownloadingBoleto(contratoId);
      
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Token não encontrado");
      }

      // Primeiro, buscar o código de solicitação do contrato
      console.log(`🔍 Buscando código de solicitação para contrato ${contratoId}`);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/boletos/por-contrato/${contratoId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      console.log(`📄 Status da resposta: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        console.log(`❌ Erro na resposta: ${response.status} ${response.statusText}`);
        toast.error("Nenhum boleto encontrado para este contrato");
        return;
      }

      const boleto = await response.json();
      console.log(`📋 Resposta completa do backend:`, boleto);
      console.log(`🔑 codigoSolicitacao encontrado:`, boleto.codigoSolicitacao);
      
      if (!boleto.codigoSolicitacao) {
        console.log(`❌ codigoSolicitacao é null/undefined/empty`);
        toast.error("Código de solicitação não encontrado para este contrato");
        return;
      }

      console.log(`📄 Baixando boleto para contrato ${contratoId} com código: ${boleto.codigoSolicitacao}`);

      // Baixar o PDF do boleto
      const pdfResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/boletos/pdf-simples/${boleto.codigoSolicitacao}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!pdfResponse.ok) {
        throw new Error("Erro ao baixar boleto");
      }

      // Criar blob e baixar arquivo
      const blob = await pdfResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boleto_contrato_${contratoId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Boleto baixado com sucesso!");
      
    } catch (error) {
      console.error("Erro ao baixar boleto:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao baixar boleto";
      toast.error(errorMessage);
    } finally {
      setIsDownloadingBoleto(null);
    }
  };

  // Componente de Loading
  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="w-20 h-20">
        <SpaceLoader label="Carregando contratos..." size={100} minHeight={150} />
      </div>
    </div>
  );

  // Componente de Skeleton para Stats Cards
  const StatsCardSkeleton = () => (
    <div className={styles.statsGrid}>
      {[1, 2, 3, 4].map((index) => (
        <div 
          key={index}
          className={styles.skeletonCard}
        >
          <div className={styles.skeletonCardContent}>
            <div className={styles.skeletonInner}>
              <div className={styles.skeletonLineSmall}></div>
              <div className={styles.skeletonLineLarge}></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Componente para animação de números
  const AnimatedNumber = ({ value, color }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
      // Só anima quando não está carregando e o valor é maior que 0
      if (!isLoading && value > 0) {
        setDisplayValue(0);
        
        const duration = 1500; // 1.5 segundos
        const steps = 60;
        const increment = value / steps;
        const stepDuration = duration / steps;

        let currentValue = 0;
        const timer = setInterval(() => {
          currentValue += increment;
          if (currentValue >= value) {
            setDisplayValue(value);
            clearInterval(timer);
          } else {
            setDisplayValue(Math.floor(currentValue));
          }
        }, stepDuration);

        return () => clearInterval(timer);
      } else if (!isLoading) {
        // Se não está carregando mas o valor é 0, mostra 0
        setDisplayValue(0);
      }
    }, [value, isLoading]);

    return <p className={`${styles.animatedNumber} ${color}`}>{isLoading ? 0 : displayValue}</p>;
  };


  // Se estiver carregando, mostra o estado de loading
  if (isLoading) {
    return (
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Contratos</h1>
            <p className={styles.headerSubtitle}>
              Gerencie seus contratos e acompanhe o status
            </p>
          </div>
        </div>
        <LoadingState />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>Contratos</h1>
          <p className={styles.headerSubtitle}>
            Gerencie seus contratos e acompanhe o status
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <StatsCardSkeleton />
      ) : (
        <div className={styles.statsGrid}>
          <div 
            className={`${styles.statusCard} ${statusFilter === "cancelado" ? styles.statusCardCanceladoSelected : ""}`}
            onClick={() => handleStatusFilter("cancelado")}
          >
            {statusFilter === "cancelado" && (
              <div className={styles.cardCheckIconWrap}>
                <CheckCircle className={styles.iconCancelado} />
              </div>
            )}
            <div className={styles.cardContentPadded}>
              <div className={styles.textCenter}>
                <p className={styles.textMutedSmall}>Cancelados</p>
                <AnimatedNumber value={totalCancelados} color={styles.textCancelado} />
                <p className={`${styles.textAmount} ${styles.textCancelado}`}>
                  {formatCurrency(valorCancelados)}
                </p>
              </div>
            </div>
          </div>

          <div 
            className={`${styles.statusCard} ${statusFilter === "inativo" ? styles.statusCardInativoSelected : ""}`}
            onClick={() => handleStatusFilter("inativo")}
          >
            {statusFilter === "inativo" && (
              <div className={styles.cardCheckIconWrap}>
                <CheckCircle className={styles.iconInativo} />
              </div>
            )}
            <div className={styles.cardContentPadded}>
              <div className={styles.textCenter}>
                <p className={styles.textMutedSmall}>Inativos</p>
                <AnimatedNumber value={totalInativos} color={styles.textInativo} />
                <p className={`${styles.textAmount} ${styles.textInativo}`}>
                  {formatCurrency(valorInativos)}
                </p>
              </div>
            </div>
          </div>

          <div 
            className={`${styles.statusCard} ${statusFilter === "ativo" ? styles.statusCardAtivoSelected : ""}`}
            onClick={() => handleStatusFilter("ativo")}
          >
            {statusFilter === "ativo" && (
              <div className={styles.cardCheckIconWrap}>
                <CheckCircle className={styles.iconAtivo} />
              </div>
            )}
            <div className={styles.cardContentPadded}>
              <div className={styles.textCenter}>
                <p className={styles.textMutedSmall}>Ativos</p>
                <AnimatedNumber value={totalAtivos} color={styles.textAtivo} />
                <p className={`${styles.textAmount} ${styles.textAtivo}`}>
                  {formatCurrency(valorAtivos)}
                </p>
              </div>
            </div>
          </div>

          <div 
            className={`${styles.statusCard} ${statusFilter === "todos" ? styles.statusCardTodosSelected : ""}`}
            onClick={() => handleStatusFilter("todos")}
          >
            {statusFilter === "todos" && (
              <div className={styles.cardCheckIconWrap}>
                <CheckCircle className={styles.iconTodos} />
              </div>
            )}
            <div className={styles.cardContentPadded}>
              <div className={styles.textCenter}>
                <p className={styles.textMutedSmall}>Todos</p>
                <AnimatedNumber value={totalTodos} color={styles.textTodos} />
                <p className={`${styles.textAmount} ${styles.textTodos}`}>
                  {formatCurrency(valorTodos)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filtersCard}>
        <div className={styles.cardContentPadded}>
          <div className={styles.filtersRow}>
            <div className={styles.flex1}>
              <label className={styles.labelSmall}>
                Período
              </label>
              <div className={styles.periodControls}>
                <button
                  type="button"
                  onClick={() => navigateMonth("prev")}
                  className={styles.btnPeriodNav}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <div className={styles.dropdownContainer}>
                  <button
                    type="button"
                    className={styles.btnPeriodSelect}
                    onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
                  >
                    <span>{formatCurrentPeriod()}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  {isPeriodDropdownOpen && (
                    <div className={styles.dropdownContent}>
                      <button 
                        type="button"
                        className={styles.dropdownItem}
                        onClick={() => {
                          setPeriodFilter("week");
                          setIsPeriodDropdownOpen(false);
                        }}
                      >
                        Esta semana
                      </button>
                      <button 
                        type="button"
                        className={styles.dropdownItem}
                        onClick={() => {
                          setPeriodFilter("month");
                          setIsPeriodDropdownOpen(false);
                        }}
                      >
                        Este mês
                      </button>
                      <button 
                        type="button"
                        className={styles.dropdownItem}
                        onClick={() => {
                          setPeriodFilter("year");
                          setIsPeriodDropdownOpen(false);
                        }}
                      >
                        Este ano
                      </button>
                      <button 
                        type="button"
                        className={styles.dropdownItem}
                        onClick={() => {
                          setPeriodFilter("all");
                          setIsPeriodDropdownOpen(false);
                        }}
                      >
                        Todo o período
                      </button>
                    </div>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => navigateMonth("next")}
                  className={styles.btnPeriodNav}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className={styles.flex1}>
              <label className={styles.labelSmall}>
                Pesquisar
              </label>
              <div className={styles.searchWrap}>
                <Search className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Pesquisar por cliente, ID, número, valor (R$ 1.500,00) ou data (11/08/2025, 11/8/25)"
                  className={styles.searchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          {/* Filtros Ativos */}
          {(statusFilter !== "todos" || periodFilter !== "month" || searchTerm) && (
            <div className={styles.activeFiltersRow}>
              <span className={styles.textMutedSmall}>Filtros ativos:</span>
              
              {statusFilter !== "todos" && (
                <span 
                  className={styles.badgeFilter}
                  onClick={() => setStatusFilter("todos")}
                >
                  Status: {statusFilter === "ativo" ? "Ativos" : statusFilter === "inativo" ? "Inativos" : statusFilter === "cancelado" ? "Cancelados" : statusFilter}
                  <X className={styles.badgeCloseIcon} />
                </span>
              )}
              
              {periodFilter !== "month" && (
                <span 
                  className={styles.badgeFilter}
                  onClick={() => setPeriodFilter("month")}
                >
                  Período: {formatCurrentPeriod()}
                  <X className={styles.badgeCloseIcon} />
                </span>
              )}
              
              {searchTerm && (
                <span 
                  className={styles.badgeFilter}
                  onClick={() => setSearchTerm("")}
                >
                  Busca: &quot;{searchTerm}&quot;
                  <X className={styles.badgeCloseIcon} />
                </span>
              )}
              
              <button
                type="button"
                onClick={() => {
                  handleStatusFilter("todos");
                  setPeriodFilter("month");
                  setCurrentDate(new Date());
                  setSearchTerm("");
                }}
                className={styles.btnClearAll}
              >
                Limpar todos
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {selectedItems.length > 0 && (
        <div className={styles.actionsBar}>
          <div className={styles.actionsLeft}>
            <p className={styles.textMutedSmall}>
              {selectedItems.length} registro(s) selecionado(s)
            </p>
            <button
              type="button"
              className={styles.btnSecondary}
            >
              Migrar contratos para Cobranças Conta Azul
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
            >
              Atualizar contratos
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={styles.tableCard}>
        <div className={styles.cardContentPadded}>
          {isLoading ? (
            <LoadingState />
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHeadRow}>
                      <th className={styles.tableHeadCellCheckbox}>
                        <input 
                          type="checkbox" 
                          className={styles.checkbox}
                          checked={
                            selectedItems.length === currentItems.length &&
                            currentItems.length > 0
                          }
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                      </th>
                      <th className={styles.tableHeadCell}>ID</th>

                      <th className={styles.tableHeadCell}>Cliente</th>

                      <th className={styles.tableHeadCell}>
                        Produto/Serviço
                      </th>
                      <th className={styles.tableHeadCell}>Valor (R$)</th>
                      <th className={styles.tableHeadCell}>
                        Desconto (R$)
                      </th>
                      <th className={`${styles.tableHeadCell} ${styles.tableHeadCellCenter}`}>Status</th>

                      <th 
                        className={`${styles.tableHeadCell} ${styles.sortableHeader}`}
                        onClick={() => handleSort("data_inicio")}
                      >
                        Data de início
                      </th>

                      <th className={styles.tableHeadCell}>
                        Próximo vencimento
                      </th>

                      <th className={styles.tableHeadCell}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className={styles.tableEmpty}>
                          <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>
                              <Calendar className="w-16 h-16" />
                            </div>
                            <p className={styles.emptyText}>
                              {searchTerm
                                ? "Nenhum contrato encontrado para a pesquisa."
                                : "Nenhum contrato cadastrado."}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentItems.map((contrato) => (
                        <tr 
                          key={contrato.id} 
                          className={styles.tableRow}
                        >
                          <td className={styles.tableCellCheckbox}>
                            <input 
                              type="checkbox" 
                              className={styles.checkbox}
                              checked={selectedItems.includes(contrato.id.toString())}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectItem(contrato.id.toString(), e.target.checked);
                              }}
                            />
                          </td>

                          <td className={styles.tableCell}>
                            {contrato.numero_contrato || contrato.id}
                          </td>


                          <td className={styles.clienteName}>
                            {contrato.cliente_nome}
                          </td>

                          <td className={styles.tableCell}>
                            {contrato.produto_servico_nome || "N/A"}
                          </td>
                          <td className={styles.tableCell}>
                            {formatCurrency(Number(contrato.valor) || 0)}
                          </td>
                          <td className={styles.tableCell}>
                            {formatCurrency(Number(contrato.desconto) || 0)}
                          </td>
                          <td className={`${styles.tableCell} ${styles.tableCellCenter}`}>
                            {getSituacaoBadge(contrato.status)}
                          </td>

                          <td className={styles.tableCell}>
                            {formatDate(contrato.comeca_em)}
                          </td>

                          <td className={styles.tableCell}>
                            {contrato.proximo_vencimento
                              ? formatDate(contrato.proximo_vencimento)
                              : "Indeterminado"}
                          </td>

                          <td className={styles.tableCell}>
                            <div className={styles.dropdownContainer}>
                              <button
                                type="button"
                                className={styles.dropdownTrigger}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleDropdown(contrato.id);
                                }}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                              {activeDropdown === contrato.id && (
                                <div 
                                  className={styles.dropdownContent}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button 
                                    type="button"
                                    className={styles.dropdownItem}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setContratoSelecionado(contrato.id);
                                      setIsDrawerOpen(true);
                                      handleCloseDropdown();
                                    }}
                                  >
                                    <FileText className="w-4 h-4 mr-2" />
                                    Editar Contrato
                                  </button>
                                  <button 
                                    type="button"
                                    className={styles.dropdownItem}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCloseDropdown();
                                    }}
                                  >
                                    Duplicar
                                  </button>
                                  <button 
                                    type="button"
                                    className={styles.dropdownItem}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadBoleto(contrato.id);
                                      handleCloseDropdown();
                                    }}
                                    disabled={isDownloadingBoleto === contrato.id}
                                  >
                                    {isDownloadingBoleto === contrato.id ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Baixando...
                                      </>
                                    ) : (
                                      <>
                                        <Download className="w-4 h-4 mr-2" />
                                        Baixar boleto
                                      </>
                                    )}
                                  </button>
                                  <button 
                                    type="button"
                                    className={styles.dropdownItemDanger}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCloseDropdown();
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Excluir
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredContratos.length > 0 && (
                <div className={styles.pagination}>
                  <span className={styles.paginationInfo}>
                    Mostrando {(currentPage - 1) * itemsPerPage + 1}
                    {" - "}
                    {Math.min(currentPage * itemsPerPage, filteredContratos.length)} de {filteredContratos.length}
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
            </>
          )}
        </div>
      </div>

      <PrincipalSidebar />
      
      {/* Drawer de Detalhes do Contrato */}
      <DetalhesContratoDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setContratoSelecionado(null);
        }}
        contratoId={contratoSelecionado}
      />
    </div>
  );
}