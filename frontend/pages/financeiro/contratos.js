"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../../components/financeiro/card";
import { Button } from "../../components/financeiro/botao";
import { Input } from "../../components/financeiro/input";
import { Badge } from "../../components/financeiro/badge";
import {
  Plus,
  Search,
  Download,
  Upload,
  Filter,
  Edit,
  Trash2,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  X,
  Calendar,
  Info,
  Loader2,
  Printer,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/financeiro/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/financeiro/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../components/financeiro/dropdown-menu";
import { toast } from "react-toastify";
import SpaceLoader from '../../components/onety/menu/SpaceLoader';
import styles from '../../styles/financeiro/contratos.module.css';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';
import NovoContratoDrawer from "../../components/financeiro/NovoContratoDrawer";
import { DetalhesContratoDrawer } from "../../components/financeiro/DetalhesContratoDrawer";
import EditarContratoDrawer from "../../components/financeiro/EditarContratoDrawer";
import { useContratos } from "../../hooks/financeiro/useContratos";

// Tipos para filtros de data
// PeriodFilter: "month" | "week" | "year" | "all"

// Interface para os dados do contrato baseada na estrutura real da tabela
// ContratoLocal: objeto com propriedades do contrato

export default function ContratosPage() {
  const [selectedItems, setSelectedItems] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");
  const [isNovoContratoOpen, setIsNovoContratoOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("todos");
  
  // Estados para download de boleto
  const [isDownloadingBoleto, setIsDownloadingBoleto] = useState(null);
  
  // Estados para detalhes do contrato
  const [isDetalhesContratoOpen, setIsDetalhesContratoOpen] = useState(false);
  const [contratoSelecionado, setContratoSelecionado] = useState(null);
  
  // Estados para edição do contrato
  const [isEditarContratoOpen, setIsEditarContratoOpen] = useState(false);
  const [contratoParaEditar, setContratoParaEditar] = useState(null);

  // Estados para filtros de data
  const [currentDate, setCurrentDate] = useState(new Date());
  const [periodFilter, setPeriodFilter] = useState("month");
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);

  // Usar o hook personalizado
  const { contratos, isLoading, error, buscarContratos, criarContrato } =
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
    const contratoDate = new Date(contrato.data_inicio);
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
    if (!situacao)
      return (
        <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
          Não definido
        </Badge>
      );

    switch (situacao) {
      case "ativo":
        return (
          <Badge className="bg-[#1E88E5]/20 text-[#26a6eb] border-[#1E88E5]/30">
            Ativo
          </Badge>
        );
      case "inativo":
        return (
          <Badge className="bg-[#FF9800]/20 text-[#FF9800] border-[#FF9800]/30">
            Inativo
          </Badge>
        );
      case "cancelado":
        return (
          <Badge className="bg-[#F50057]/20 text-[#ff1769] border-[#F50057]/30">
            Cancelado
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
            {situacao}
          </Badge>
        );
    }
  };

  const handleNovoContratoSave = async (data) => {
    try {
      // Usar a função do hook para criar o contrato
      await criarContrato(data);

      // Fechar o drawer
      setIsNovoContratoOpen(false);
    } catch (error) {
      console.error("Erro ao salvar contrato:", error);
    }
  };

  const handleAbrirDetalhesContrato = (contratoId) => {
    setContratoSelecionado(contratoId);
    setIsDetalhesContratoOpen(true);
  };

  const handleFecharDetalhesContrato = () => {
    setIsDetalhesContratoOpen(false);
    setContratoSelecionado(null);
  };

  const handleAbrirEditarContrato = (contratoId) => {
    setContratoParaEditar(contratoId);
    setIsEditarContratoOpen(true);
  };

  const handleFecharEditarContrato = () => {
    setIsEditarContratoOpen(false);
    setContratoParaEditar(null);
  };

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
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inter-boletos/boletos/por-contrato/${contratoId}`, {
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
      const pdfResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inter-boletos/pdf-simples/${boleto.codigoSolicitacao}`, {
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
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((index) => (
        <Card 
          key={index}
          className="bg-[#1B1229]/50 backdrop-blur-sm border border-[#673AB7]/20 animate-pulse"
        >
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="h-4 bg-[#673AB7]/20 rounded w-16 mx-auto"></div>
              <div className="h-8 bg-[#673AB7]/20 rounded w-12 mx-auto"></div>
            </div>
          </CardContent>
        </Card>
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

  const stats = [
    {
      title: "Cancelados",
      value: totalCancelados,
      amount: formatCurrency(valorCancelados),
      color: "text-[#F50057]",
      borderColor: "border-[#F50057]/30",
      status: "cancelado",
    },
    {
      title: "Inativos",
      value: totalInativos,
      amount: formatCurrency(valorInativos),
      color: "text-[#FF9800]",
      borderColor: "border-[#FF9800]/30",
      status: "inativo",
    },
    {
      title: "Ativos",
      value: totalAtivos,
      amount: formatCurrency(valorAtivos),
      color: "text-[#1E88E5]",
      borderColor: "border-[#1E88E5]/30",
      status: "ativo",
    },
    {
      title: "Todos",
      value: totalTodos,
      amount: formatCurrency(valorTodos),
      color: "text-[#673AB7]",
      borderColor: "border-[#673AB7]/30",
      status: "todos",
    },
  ];

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
        <div className={styles.headerActions}>
          <Button
            variant="outline"
            size="sm"
            className={styles.btnExport}
            disabled
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button
            size="sm"
            className={styles.btnNew}
            onClick={() => setIsNovoContratoOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo contrato
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <StatsCardSkeleton />
      ) : (
        <div className={styles.statsGrid}>
          {stats.map((stat, index) => (
            <Card
              key={index}
              className={`${styles.statusCard} ${
                statusFilter === stat.status ? styles.statusCardSelected : ""
              }`}
              onClick={() => handleStatusFilter(stat.status)}
            >
              {statusFilter === stat.status && (
                <div className={styles.cardCheckIconWrap}>
                  <CheckCircle className={styles.iconSelected} />
                </div>
              )}
              <CardContent className={styles.cardContentPadded}>
                <div className={styles.textCenter}>
                  <p className={styles.textMutedSmall}>{stat.title}</p>
                  <AnimatedNumber value={stat.value} color={stat.color} />
                  <p className={`${styles.textAmount} ${stat.color}`}>
                    {stat.amount}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className={styles.filtersCard}>
        <CardContent className={styles.cardContentPadded}>
          <div className={styles.filtersRow}>
            <div className={styles.flex1}>
              <label className={styles.labelSmall}>
                Período
              </label>
              <div className={styles.periodControls}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth("prev")}
                  className={styles.btnPeriodNav}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <DropdownMenu open={isPeriodDropdownOpen} onOpenChange={setIsPeriodDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={styles.btnPeriodSelect}
                    >
                      <span>{formatCurrentPeriod()}</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="center"
                    className={styles.dropdownContent}
                  >
                    <DropdownMenuItem 
                      className={styles.dropdownItem}
                      onClick={() => {
                        setPeriodFilter("week");
                        setIsPeriodDropdownOpen(false);
                      }}
                    >
                      Esta semana
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className={styles.dropdownItem}
                      onClick={() => {
                        setPeriodFilter("month");
                        setIsPeriodDropdownOpen(false);
                      }}
                    >
                      Este mês
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className={styles.dropdownItem}
                      onClick={() => {
                        setPeriodFilter("year");
                        setIsPeriodDropdownOpen(false);
                      }}
                    >
                      Este ano
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className={styles.dropdownItem}
                      onClick={() => {
                        setPeriodFilter("all");
                        setIsPeriodDropdownOpen(false);
                      }}
                    >
                      Todo o período
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth("next")}
                  className={styles.btnPeriodNav}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className={styles.flex1}>
              <label className={styles.labelSmall}>
                Pesquisar
              </label>
              <div className={styles.searchWrap}>
                <Search className={styles.searchIcon} />
                <Input
                  placeholder="Pesquisar por cliente, ID, número, valor (R$ 1.500,00) ou data (11/08/2025, 11/8/25)"
                  className={styles.searchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.filtersRight}>
              <Button
                variant="outline"
                className={styles.btnSecondary}
                disabled
              >
                <Filter className="w-4 h-4 mr-2" />
                Mais filtros
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
          
          {/* Filtros Ativos */}
          {(statusFilter !== "todos" || periodFilter !== "month" || searchTerm) && (
            <div className={styles.activeFiltersRow}>
              <span className={styles.textMutedSmall}>Filtros ativos:</span>
              
              {statusFilter !== "todos" && (
                <Badge 
                  className={styles.badgeFilter}
                  onClick={() => setStatusFilter("todos")}
                >
                  Status: {stats.find((s) => s.status === statusFilter)?.title}
                  <X className={styles.badgeCloseIcon} />
                </Badge>
              )}
              
              {periodFilter !== "month" && (
                <Badge 
                  className={styles.badgeFilter}
                  onClick={() => setPeriodFilter("month")}
                >
                  Período: {formatCurrentPeriod()}
                  <X className={styles.badgeCloseIcon} />
                </Badge>
              )}
              
              {searchTerm && (
                <Badge 
                  className={styles.badgeFilter}
                  onClick={() => setSearchTerm("")}
                >
                  Busca: &quot;{searchTerm}&quot;
                  <X className={styles.badgeCloseIcon} />
                </Badge>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleStatusFilter("todos");
                  setPeriodFilter("month");
                  setCurrentDate(new Date());
                  setSearchTerm("");
                }}
                className={styles.btnClearAll}
              >
                Limpar todos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {selectedItems.length > 0 && (
        <div className={styles.actionsBar}>
          <div className={styles.actionsLeft}>
            <p className={styles.textMutedSmall}>
              {selectedItems.length} registro(s) selecionado(s)
            </p>
            <Button
              size="sm"
              variant="outline"
              className={styles.btnSecondary}
            >
              Migrar contratos para Cobranças Conta Azul
            </Button>
            <Button
              size="sm"
              className={styles.btnPrimary}
            >
              Atualizar contratos
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className={styles.tableCard}>
        <CardContent className={styles.cardContentPadded}>
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
                      <th 
                        className={`${styles.tableHeadCell} ${styles.sortableHeader}`}
                        onClick={() => handleSort("data_inicio")}
                      >
                        Data de início
                        {sortField === "data_inicio" ? (
                          sortDirection === "asc" ? (
                            <ChevronLeft className="w-3 h-3 inline ml-1" />
                          ) : (
                            <ChevronRight className="w-3 h-3 inline ml-1" />
                          )
                        ) : (
                          <ChevronLeft className="w-3 h-3 inline ml-1 text-[#B0AFC1]" />
                        )}
                      </th>
                      <th className={styles.tableHeadCell}>Número</th>
                      <th className={styles.tableHeadCell}>Cliente</th>
                      <th className={styles.tableHeadCell}>
                        Próximo vencimento
                      </th>
                      <th className={styles.tableHeadCell}>
                        Produto/Serviço
                      </th>
                      <th className={styles.tableHeadCell}>Valor (R$)</th>
                      <th className={styles.tableHeadCell}>
                        Desconto (R$)
                      </th>
                      <th className={styles.tableHeadCell}>Status</th>
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
                          onClick={() => handleAbrirDetalhesContrato(contrato.id)}
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
                            {formatDate(contrato.data_inicio)}
                          </td>
                          <td className={styles.tableCell}>
                            {contrato.numero_contrato || contrato.id}
                          </td>
                          <td className={styles.clienteName}>
                            {contrato.cliente_nome}
                          </td>
                          <td className={styles.tableCell}>
                            {contrato.proximo_vencimento
                              ? formatDate(contrato.proximo_vencimento)
                              : "Indeterminado"}
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
                          <td className={styles.tableCell}>
                            {getSituacaoBadge(contrato.status)}
                          </td>
                          <td className={styles.tableCell}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={styles.dropdownTrigger}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className={styles.dropdownContent}
                              >
                                <DropdownMenuItem 
                                  className={styles.dropdownItem}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAbrirDetalhesContrato(contrato.id);
                                  }}
                                >
                                  <Info className="w-4 h-4 mr-2" />
                                  Ver detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className={styles.dropdownItem}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAbrirEditarContrato(contrato.id);
                                  }}
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem className={styles.dropdownItem}>
                                  Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className={styles.dropdownItem}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadBoleto(contrato.id);
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
                                </DropdownMenuItem>
                                <DropdownMenuItem className={styles.dropdownItemDanger}>
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
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
              <div className={styles.paginationBar}>
                <div className={styles.paginationLeft}>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => setItemsPerPage(Number(value))}
                  >
                    <SelectTrigger className={styles.perPageSelectTrigger}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={styles.selectContent}>
                      <SelectItem value="10" className={styles.selectItem}>10</SelectItem>
                      <SelectItem value="25" className={styles.selectItem}>25</SelectItem>
                      <SelectItem value="50" className={styles.selectItem}>50</SelectItem>
                      <SelectItem value="100" className={styles.selectItem}>100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className={styles.textMutedSmall}>Registros por página</span>
                </div>

                <div className={styles.paginationCenter}>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} 
                    disabled={currentPage === 1} 
                    className={styles.pageNavBtn}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>

                  <div className={styles.pageNumbers}>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`${styles.pageBtn} ${
                            currentPage === pageNum ? styles.pageBtnActive : ""
                          }`}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} 
                    disabled={currentPage === totalPages} 
                    className={styles.pageNavBtn}
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <p className={styles.textMutedSmall}>
                  Mostrando {startIndex + 1} -{" "}
                  {Math.min(endIndex, filteredContratos.length)} de{" "}
                  {filteredContratos.length} registros
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Novo Contrato Drawer */}
      <NovoContratoDrawer
        isOpen={isNovoContratoOpen}
        onClose={() => setIsNovoContratoOpen(false)}
        onSave={handleNovoContratoSave}
      />

      {/* Detalhes do Contrato Drawer */}
      <DetalhesContratoDrawer
        isOpen={isDetalhesContratoOpen}
        onClose={handleFecharDetalhesContrato}
        contratoId={contratoSelecionado}
      />

      {/* Editar Contrato Drawer */}
      <EditarContratoDrawer
        isOpen={isEditarContratoOpen}
        onClose={handleFecharEditarContrato}
        contratoId={contratoParaEditar}
      />
      
      <PrincipalSidebar />
    </div>
  );
}