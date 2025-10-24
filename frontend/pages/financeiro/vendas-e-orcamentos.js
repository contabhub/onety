"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import styles from '../../styles/financeiro/vendas-e-orcamento.module.css';
import { Button } from '../../components/financeiro/botao';
import { Input } from '../../components/financeiro/input';
import { Card, CardContent } from '../../components/financeiro/card';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/financeiro/table';
import { Badge } from '../../components/financeiro/badge';
import { Checkbox } from '../../components/financeiro/checkbox';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  FileText,
  Printer,
  Trash2,
  Send,
  Mail,
  MoreHorizontal,
  Info,
  Calendar,
  ChevronUp,
  Plus,
  DollarSign,
  ChevronDown,
  Download,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/financeiro/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/financeiro/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/financeiro/dialog";
import { NovaVendaDrawer } from '../../components/financeiro/NovaVendaDrawer';
import { DetalhesVendaDrawer } from "../../components/financeiro/DetalhesVendaDrawer";
import { DetalhesContratoDrawer } from "../../components/financeiro/DetalhesContratoDrawer";
import { useVendas } from "../../hooks/financeiro/useVenda";
import { useContratos } from "../../hooks/financeiro/useContratos";
// import Lottie from "lottie-react";
import { toast } from "react-toastify";

// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

// Tipos para filtros de data (convertido para comentários)
// PeriodFilter: "month" | "week" | "year" | "all"
// DateRange: { start: Date; end: Date }

export default function VendasOrcamentosPage() {
  const [selectedItems, setSelectedItems] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [isNovaVendaOpen, setIsNovaVendaOpen] = useState(false);
  
  // Estados para filtros de data
  const [currentDate, setCurrentDate] = useState(new Date());
  const [periodFilter, setPeriodFilter] = useState("month");
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);

  // Estado para filtro de situação ativo
  const [activeStatusFilter, setActiveStatusFilter] = useState(null);

  // Estados para modal de mudança de situação
  const [isSituacaoModalOpen, setIsSituacaoModalOpen] = useState(false);
  const [selectedVendaId, setSelectedVendaId] = useState(null);
  const [selectedVendaSituacao, setSelectedVendaSituacao] = useState("");
  const [isUpdatingSituacao, setIsUpdatingSituacao] = useState(false);

  // Estados para download de boleto
  const [isDownloadingBoleto, setIsDownloadingBoleto] = useState(null);

  // Estado para controlar qual dropdown está aberto
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Função para calcular posição do dropdown
  const calculateDropdownPosition = useCallback((buttonElement) => {
    if (!buttonElement) return;
    
    const rect = buttonElement.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 8,
      left: rect.right - 160
    });
  }, []);

  // Função para fechar dropdown quando clicar fora
  const handleCloseDropdown = useCallback(() => {
    setOpenDropdownId(null);
  }, []);

  // Estados para detalhes da venda
  const [isDetalhesVendaOpen, setIsDetalhesVendaOpen] = useState(false);
  const [vendaSelecionada, setVendaSelecionada] = useState(null);

  // Estados para detalhes do contrato
  const [isDetalhesContratoOpen, setIsDetalhesContratoOpen] = useState(false);
  const [contratoSelecionado, setContratoSelecionado] = useState(null);

  // Estados para editar venda (usando o mesmo drawer)
  const [isEditarVendaOpen, setIsEditarVendaOpen] = useState(false);
  const [vendaParaEditar, setVendaParaEditar] = useState(null);

  // Estados para modal de exclusão
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [vendaParaExcluir, setVendaParaExcluir] = useState(null);
  const [isDeletingVenda, setIsDeletingVenda] = useState(false);

  // Função para obter o range de datas baseado no filtro
  const getDateRange = useCallback(() => {
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
  }, [currentDate, periodFilter]);

  // Obter range de datas para o hook
  const dateRange = getDateRange();
  
  // Memoizar as opções para evitar recriações desnecessárias
  const vendasOptions = useMemo(() => ({
    startDate: periodFilter === "all" ? undefined : dateRange.start,
    endDate: periodFilter === "all" ? undefined : dateRange.end
  }), [periodFilter, dateRange.start, dateRange.end]);
  
  const { vendas: vendasOrcamentos, isLoading: isLoadingVendas, error: errorVendas, refetch: refetchVendas, excluirVenda } = useVendas(vendasOptions);
  const { contratos, isLoading: isLoadingContratos, error: errorContratos, buscarContratos } = useContratos();
  
  // Estados de loading e error unificados
  const isLoading = isLoadingVendas || isLoadingContratos;
  const error = errorVendas || errorContratos;
  
  // Função para refetch unificado
  const refetch = useCallback(() => {
    refetchVendas();
    buscarContratos();
  }, [refetchVendas, buscarContratos]);

  // Buscar contratos quando o componente montar
  useEffect(() => {
    buscarContratos();
  }, [buscarContratos]);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [periodFilter, currentDate, searchTerm, activeStatusFilter]);

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdownId && !event.target.closest(`.${styles.vendasOrcamentosDropdownContainer}`)) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdownId]);

  // Função para lidar com o clique nos cards de estatísticas
  const handleStatusCardClick = (status) => {
    setActiveStatusFilter(activeStatusFilter === status ? null : status);
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

  // Função para formatar valor para pesquisa
  const formatValueForSearch = (value) => {
    if (!value) return "";
    
    // Se for número, converter para string
    if (typeof value === "number") {
      return value.toString();
    }
    
    // Se for string, remover formatação de moeda e normalizar
    return value
      .replace(/[R$\s]/g, "") // Remove R$ e espaços
      .replace(/\./g, "") // Remove pontos (separadores de milhares)
      .replace(/,/g, ".") // Substitui vírgula por ponto (decimal)
      .toLowerCase();
  };

  // Função para formatar data para pesquisa
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

  // Unificar vendas e contratos mantendo a estrutura de vendas
  const itensUnificados = useMemo(() => {
    const items = [...vendasOrcamentos];
    
    // Adicionar contratos como "vendas" para exibição
    contratos.forEach(contrato => {
      // Verificar se o contrato está dentro do período selecionado
      if (periodFilter !== "all" && contrato.data_inicio) {
        const dataContratoObj = new Date(contrato.data_inicio);
        const { start, end } = getDateRange();
        
        if (dataContratoObj < start || dataContratoObj > end) {
          return; // Pular este contrato se estiver fora do período
        }
      }
      
      // Adicionar contrato como se fosse uma venda
      items.push({
        id: contrato.id,
        numero_venda: contrato.numero_contrato,
        cliente_nome: contrato.cliente_nome || "",
        produto_servico_nome: contrato.produtos && contrato.produtos.length > 0 
          ? `${contrato.produtos.length} produto(s)/serviço(s)` 
          : "Produto/Serviço não informado",
        valor_venda: contrato.valor?.toString() || "0",
        data_venda: contrato.data_inicio,
        situacao: contrato.status === "ativo" ? "aprovado" : contrato.status === "inativo" ? "recusado" : "em_andamento",
        // Campo especial para identificar que é um contrato
        __tipo: "contrato",
        __contrato_id: contrato.id
      });
    });
    
    // Ordenar por data (mais recente primeiro)
    return items.sort((a, b) => {
      const dataA = new Date(a.data_venda || 0);
      const dataB = new Date(b.data_venda || 0);
      return dataB.getTime() - dataA.getTime();
    });
  }, [vendasOrcamentos, contratos, periodFilter, getDateRange]);

  // Filtrar dados baseado no termo de pesquisa e filtro de situação
  const filteredVendas = itensUnificados.filter(
    (item) => {
      // Filtro por termo de pesquisa
      const searchTermLower = searchTerm.toLowerCase();
      
      // Normalizar o termo de pesquisa para valores
      const normalizedSearchTerm = searchTerm
        .replace(/[R$\s]/g, "") // Remove R$ e espaços
        .replace(/\./g, "") // Remove pontos
        .replace(/,/g, ".") // Substitui vírgula por ponto
        .toLowerCase();
      
      // Verificar se o termo de pesquisa parece ser um valor numérico
      const isNumericSearch = /^\d+([.,]\d+)?$/.test(searchTerm.replace(/[R$\s]/g, ""));
      
      // Função para normalizar valor para comparação flexível
      const normalizeValueForComparison = (value) => {
        if (!value) return [""];
        
        // Remover formatação de moeda
        const cleanValue = value.replace(/[R$\s]/g, "");
        
        // Criar variações com vírgula e ponto
        const variations = [
          cleanValue, // Original
          cleanValue.replace(/\./g, "").replace(/,/g, "."), // Remove pontos, converte vírgula para ponto
          cleanValue.replace(/,/g, "."), // Converte vírgula para ponto
          cleanValue.replace(/\./g, "").replace(/,/g, ""), // Remove pontos e vírgulas
        ];
        
        // Remover duplicatas manualmente
        const uniqueVariations = [];
        variations.forEach(variation => {
          if (!uniqueVariations.includes(variation)) {
            uniqueVariations.push(variation);
          }
        });
        
        return uniqueVariations;
      };
      
      const matchesSearch = 
        // Pesquisa por nome do cliente
        (item.cliente_nome?.toLowerCase() || "").includes(searchTermLower) ||
        // Pesquisa por número da venda
        (item.numero_venda?.toString() || "").includes(searchTerm) ||
        // Pesquisa por produto/serviço
        (item.produto_servico_nome?.toLowerCase() || "").includes(searchTermLower) ||
        // Pesquisa por valor (apenas se o termo parecer numérico)
        (isNumericSearch && (() => {
          const searchVariations = normalizeValueForComparison(searchTerm);
          const valueVariations = normalizeValueForComparison(item.valor_venda || "");
          
          return searchVariations.some(searchVar => 
            valueVariations.some(valueVar => 
              valueVar.toLowerCase() === searchVar.toLowerCase()
            )
          );
        })()) ||
        // Pesquisa por data (formato brasileiro)
        formatDateForSearch(item.data_venda || "").includes(searchTerm);

      // Filtro por situação (se ativo)
      const matchesStatus = activeStatusFilter 
        ? item.situacao === activeStatusFilter 
        : true;

      return matchesSearch && matchesStatus;
    }
  );

  // Cálculos das métricas
  const totalAprovados = filteredVendas.filter(
    (item) => item.situacao === "aprovado"
  ).length;
  const valorAprovados = filteredVendas
    .filter((item) => item.situacao === "aprovado")
    .reduce((sum, item) => sum + parseFloat(item.valor_venda || "0"), 0);

  const totalEmAndamento = filteredVendas.filter(
    (item) => item.situacao === "em_andamento"
  ).length;
  const valorEmAndamento = filteredVendas
    .filter((item) => item.situacao === "em_andamento")
    .reduce((sum, item) => sum + parseFloat(item.valor_venda || "0"), 0);

  const totalRecusados = filteredVendas.filter(
    (item) => item.situacao === "recusado"
  ).length;
  const valorRecusados = filteredVendas
    .filter((item) => item.situacao === "recusado")
    .reduce((sum, item) => sum + parseFloat(item.valor_venda || "0"), 0);

  const totalGeral = filteredVendas.length;
  const valorTotal = filteredVendas.reduce(
    (sum, item) => sum + parseFloat(item.valor_venda || "0"),
    0
  );

  // Paginação
  const totalPages = Math.ceil(filteredVendas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredVendas.slice(startIndex, endIndex);

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

  // useEffect para ajustar página atual quando mudar filtros ou quantidade de itens
  useEffect(() => {
    const maxPage = Math.ceil(filteredVendas.length / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) {
      setCurrentPage(maxPage);
    }
  }, [filteredVendas.length, itemsPerPage, currentPage]);



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

  const handleNovaVendaSave = (data) => {
    console.log("Nova venda salva:", data);
    // Recarregar os dados após salvar uma nova venda
    refetch();
  };

  // Função para abrir modal de mudança de situação
  const handleOpenSituacaoModal = (vendaId, situacaoAtual) => {
    setSelectedVendaId(vendaId);
    setSelectedVendaSituacao(situacaoAtual);
    setIsSituacaoModalOpen(true);
  };

  // Função para atualizar situação da venda
  const handleUpdateSituacao = async (novaSituacao) => {
    if (!selectedVendaId) return;

    try {
      setIsUpdatingSituacao(true);
      
      // Teste de toast para debug
      console.log("🔔 Testando toast...");
      toast.info("Iniciando atualização de situação...");
      
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Token não encontrado");
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/vendas/${selectedVendaId}/situacao`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ situacao: novaSituacao })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao atualizar situação");
      }

      const data = await response.json();
      console.log("✅ Situação atualizada:", data);
      toast.success("Situação atualizada com sucesso!");
      
      // Fechar modal e recarregar dados
      setIsSituacaoModalOpen(false);
      setSelectedVendaId(null);
      setSelectedVendaSituacao("");
      refetch();
      
    } catch (error) {
      console.error("❌ Erro ao atualizar situação:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao atualizar situação";
      toast.error(errorMessage);
    } finally {
      setIsUpdatingSituacao(false);
    }
  };





  // Função para baixar boleto
  const handleDownloadBoleto = async (vendaId) => {
    try {
      setIsDownloadingBoleto(vendaId);
      
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Token não encontrado");
      }

      // Primeiro, buscar o código de solicitação da venda usando a rota mais robusta
      console.log(`🔍 Buscando código de solicitação para venda ${vendaId}`);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/boletos/boletos/codigo-por-venda/${vendaId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      console.log(`📄 Status da resposta: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        console.log(`❌ Erro na resposta: ${response.status} ${response.statusText}`);
        
        // Tentar obter mais detalhes do erro
        try {
          const errorData = await response.json();
          console.log(`📋 Detalhes do erro:`, errorData);
          
          if (response.status === 404) {
            toast.error("Nenhum boleto encontrado para esta venda");
          } else {
            toast.error(errorData.error || "Erro ao buscar boleto");
          }
        } catch {
          toast.error("Erro ao buscar boleto");
        }
        return;
      }

      const boleto = await response.json();
      console.log(`📋 Resposta completa do backend:`, boleto);
      console.log(`🔑 codigoSolicitacao encontrado:`, boleto.codigoSolicitacao);
      
      if (!boleto.codigoSolicitacao) {
        console.log(`❌ codigoSolicitacao é null/undefined/empty`);
        toast.error("Código de solicitação não encontrado para esta venda");
        return;
      }

      console.log(`📄 Baixando boleto para venda ${vendaId} com código: ${boleto.codigoSolicitacao}`);

      // Baixar o PDF do boleto usando a rota correta
      const pdfResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/boletos/pdf-simples/${boleto.codigoSolicitacao}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!pdfResponse.ok) {
        console.log(`❌ Erro ao baixar PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
        
        // Tentar obter mais detalhes do erro
        try {
          const errorData = await pdfResponse.json();
          console.log(`📋 Detalhes do erro do PDF:`, errorData);
          toast.error(errorData.error || "Erro ao baixar boleto");
        } catch {
          toast.error("Erro ao baixar boleto");
        }
        return;
      }

      // Criar blob e baixar arquivo
      const blob = await pdfResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boleto_venda_${vendaId}.pdf`;
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

  // Função para abrir detalhes da venda
  const handleAbrirDetalhesVenda = (vendaId) => {
    setVendaSelecionada(vendaId);
    setIsDetalhesVendaOpen(true);
  };

  // Função para abrir detalhes do contrato
  const handleAbrirDetalhesContrato = (contratoId) => {
    setContratoSelecionado(contratoId);
    setIsDetalhesContratoOpen(true);
  };

  // Função unificada para abrir detalhes
  const handleAbrirDetalhes = (item) => {
    if (item.__tipo === "contrato") {
      handleAbrirDetalhesContrato(item.__contrato_id);
    } else {
      handleAbrirDetalhesVenda(item.id);
    }
  };

  const handleAbrirEditarVenda = (vendaId) => {
    setVendaParaEditar(vendaId);
    setIsEditarVendaOpen(true);
  };

  const handleFecharEditarVenda = () => {
    setIsEditarVendaOpen(false);
    setVendaParaEditar(null);
  };

  const handleEditarVendaSave = (data) => {
    console.log("Venda editada:", data);
    // Recarregar os dados após editar uma venda
    refetch();
  };

  // Função para abrir modal de exclusão
  const handleOpenDeleteModal = (vendaId, numeroVenda, clienteNome) => {
    setVendaParaExcluir({ id: vendaId, numero: numeroVenda, cliente: clienteNome });
    setIsDeleteModalOpen(true);
  };

  // Função para excluir venda
  const handleDeleteVenda = async () => {
    if (!vendaParaExcluir) return;

    try {
      setIsDeletingVenda(true);
      
      // Usar a função excluirVenda do hook
      await excluirVenda(vendaParaExcluir.id);
      
      // Fechar modal primeiro
      setIsDeleteModalOpen(false);
      setVendaParaExcluir(null);
      
      // Mostrar toast de sucesso após fechar o modal
      setTimeout(() => {
        toast.success("Venda excluída com sucesso!");
      }, 100);
      
    } catch (error) {
      console.error("❌ Erro ao excluir venda:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao excluir venda";
      toast.error(errorMessage);
    } finally {
      setIsDeletingVenda(false);
    }
  };



  const formatCurrency = (value) => {
    if (!value && value !== 0) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  };

  const getSituacaoBadge = (situacao) => {
    if (!situacao)
      return (
        <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
          Não definido
        </Badge>
      );

    switch (situacao) {
      case "aprovado":
        return (
          <Badge className="vendas-orcamentos-badge-recebido">
            Venda liberada
          </Badge>
        );
      case "em_andamento":
        return (
          <Badge className="vendas-orcamentos-badge-em-andamento">
            Em Andamento
          </Badge>
        );
      case "recusado":
        return (
          <Badge className="vendas-orcamentos-badge-recusado">
            Recusado
          </Badge>
        );
      case "ativo":
        return (
          <Badge className="bg-[#4CAF50]/20 text-[#4CAF50] border-[#4CAF50]/30">
            Ativo
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

  const stats = [
    {
      title: "Recusados",
      value: totalRecusados,
      amount: formatCurrency(valorRecusados),
      color: "text-[#F50057]",
      status: "recusado",
      isActive: activeStatusFilter === "recusado",
    },
    {
      title: "Em Andamento",
      value: totalEmAndamento,
      amount: formatCurrency(valorEmAndamento),
      color: "text-[#FF9800]",
      status: "em_andamento",
      isActive: activeStatusFilter === "em_andamento",
    },
    {
      title: "Vendas liberadas",
      value: totalAprovados,
      amount: formatCurrency(valorAprovados),
      color: "text-[#1E88E5]",
      status: "aprovado",
      isActive: activeStatusFilter === "aprovado",
    },
    {
      title: "Total do período",
      value: totalGeral,
      amount: formatCurrency(valorTotal),
      color: "text-[#673AB7]",
      status: null,
      isActive: activeStatusFilter === null,
    },
  ];

  // Componente de Loading
  const LoadingState = () => (
    <div className={styles.vendasOrcamentosLoadingContent}>
      <div className={styles.vendasOrcamentosLoadingSpinner}>
        <div className={styles.vendasOrcamentosLoadingSpinnerInner}></div>
      </div>
      <p className={styles.vendasOrcamentosLoadingText}>Carregando vendas...</p>
    </div>
  );

  if (isLoading) {
    return (
      <div className={styles.vendasOrcamentosLoading}>
        <LoadingState />
      </div>
    );
  }
  return (
    <>
      <PrincipalSidebar />
      <div className={styles.vendasOrcamentosPage}>
      {/* Header */}
      <div className={styles.vendasOrcamentosHeader}>
        <div>
          <h1 className={styles.vendasOrcamentosHeaderTitle}>Vendas e orçamentos</h1>
          <p className={styles.vendasOrcamentosHeaderSubtitle}>
            Gerencie suas vendas, orçamentos e fluxo de receitas
          </p>
        </div>
        <div className={styles.vendasOrcamentosHeaderActions}>
         

          <Button
            className={styles.vendasOrcamentosNovaVendaBtn}
            onClick={() => setIsNovaVendaOpen(true)}
          >
            <Plus className={styles.vendasOrcamentosNovaVendaIcon} />
            Nova venda
          </Button>
      

        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.vendasOrcamentosStatsGrid}>
        {stats.map((stat, index) => (
          <Card
            key={index}
            className={`${styles.vendasOrcamentosStatCard} ${
              stat.isActive 
                ? styles.vendasOrcamentosStatCardActive
                : styles.vendasOrcamentosStatCardInactive
            } ${stat.status ? "cursor-pointer" : ""}`}
            onClick={() => handleStatusCardClick(stat.status)}
          >
            <CardContent className={styles.vendasOrcamentosStatCardContent}>
              <div className={styles.vendasOrcamentosStatCardInner}>
                <div className={styles.vendasOrcamentosStatCardInfo}>
                  <p className={styles.vendasOrcamentosStatCardTitle}>
                    {stat.title}
                  </p>
                  <p className={`${styles.vendasOrcamentosStatCardValue} ${stat.status || 'total'} ${stat.isActive ? styles.vendasOrcamentosStatValueActive : ""}`}>
                    {stat.value}
                  </p>
                  <p className={`${styles.vendasOrcamentosStatCardAmount} ${stat.status || 'total'}`}>
                    {stat.amount}
                  </p>
                </div>
                <DollarSign className={`${styles.vendasOrcamentosStatCardIcon} vendas-orcamentos-stat-${stat.status || 'total'} ${stat.isActive ? styles.vendasOrcamentosStatIconActive : ""}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>



      {/* Filtros e pesquisa */}
      <Card className={styles.vendasOrcamentosFiltersCard}>
        <CardContent className={styles.vendasOrcamentosFiltersContent}>
          <div className={styles.vendasOrcamentosFiltersRow}>
            <div className={styles.vendasOrcamentosFilterGroup}>
              <label className={styles.vendasOrcamentosFilterLabel}>
                Período
              </label>
              <div className={styles.vendasOrcamentosPeriodControls}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth("prev")}
                  className="contas-pagar-nav-btn"
                >
                  <ChevronLeft className={styles.vendasOrcamentosNavIcon} color="var(--onity-color-text)" />
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`contas-pagar-nav-btn ${styles.vendasOrcamentosPeriodButton}`}
                    >
                      <span>{formatCurrentPeriod()}</span>
                      <ChevronDown className={styles.vendasOrcamentosNavIcon} color="var(--onity-color-text)" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="center"
                    className="contas-pagar-dropdown"
                  >
                    <DropdownMenuItem 
                      className="contas-pagar-dropdown-item"
                      onClick={() => {
                        setPeriodFilter("week");
                        setIsPeriodDropdownOpen(false);
                      }}
                    >
                      Esta semana
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="contas-pagar-dropdown-item"
                      onClick={() => {
                        setPeriodFilter("month");
                        setIsPeriodDropdownOpen(false);
                      }}
                    >
                      Este mês
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="contas-pagar-dropdown-item"
                      onClick={() => {
                        setPeriodFilter("year");
                        setIsPeriodDropdownOpen(false);
                      }}
                    >
                      Este ano
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="contas-pagar-dropdown-item"
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
                  className="contas-pagar-nav-btn"
                >
                  <ChevronRight className={styles.vendasOrcamentosNavIcon} color="var(--onity-color-text)" />
                </Button>
              </div>
            </div>

            <div className={styles.vendasOrcamentosFilterGroup}>
              <label className={styles.vendasOrcamentosFilterLabel}>
                Pesquisar
              </label>
              <div className={styles.vendasOrcamentosSearchContainer}>
                <Search className={styles.vendasOrcamentosSearchIcon} />
                <Input
                  placeholder="Pesquisar por cliente, número, produto, valor ou data..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.vendasOrcamentosSearchInput}
                />
                {searchTerm && (
                  <div className={styles.vendasOrcamentosSearchTips}>
                    💡 Dicas: Digite valores como &quot;1500&quot;, &quot;1500.50&quot; ou &quot;3,00&quot;, datas como &quot;15/12/2024&quot;
                  </div>
                )}
              </div>
            </div>

            <div className={styles.vendasOrcamentosFilterActions}>
              {activeStatusFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveStatusFilter(null)}
                  className="vendas-orcamentos-secondary-btn"
                >
                  Limpar filtro
                </Button>
              )}
            </div>
          </div>
          
          {/* Indicador de filtro ativo */}
          {activeStatusFilter && (
            <div className="vendas-orcamentos-filtros-ativos-card">
              <div className={styles.vendasOrcamentosFiltrosAtivosContent}>
                <Filter className={styles.vendasOrcamentosFiltrosAtivosIcon} />
                <span className={styles.vendasOrcamentosFiltrosAtivosText}>
                  Filtro ativo: {
                    activeStatusFilter === "ativo" ? "Ativo" :
                    activeStatusFilter === "recusado" ? "Recusados" :
                    activeStatusFilter === "em_andamento" ? "Em Andamento" :
                    activeStatusFilter === "aprovado" ? "Aprovados" : "Total do período"
                  }
                </span>
                <span className={styles.vendasOrcamentosFiltrosAtivosCount}>
                  ({filteredVendas.length} registros encontrados)
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações para itens selecionados */}
      {selectedItems.length > 0 && (
        <Card className={styles.vendasOrcamentosSelectedActions}>
          <CardContent className={styles.vendasOrcamentosSelectedActionsContent}>
            <div className={styles.vendasOrcamentosSelectedActionsInfo}>
              <span className={styles.vendasOrcamentosSelectedCount}>
                {selectedItems.length} registro(s) selecionado(s)
              </span>
              <Button size="sm" className="vendas-orcamentos-primary-btn">
                <FileText className={styles.vendasOrcamentosActionIcon} />
                Gerar notas fiscais de serviço
              </Button>
             
              <Button
                size="sm"
                variant="outline"
                className="vendas-orcamentos-modal-btn-confirmar"
              >
                <Trash2 className={styles.vendasOrcamentosActionIcon} />
                Excluir
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <Card className={styles.vendasOrcamentosTableCard}>
        <CardContent className={styles.vendasOrcamentosTableContent}>
          <div className={styles.vendasOrcamentosTableContainer}>
            <Table>
              <TableHeader className={styles.vendasOrcamentosTableHeader}>
                <TableRow>
                  <TableHead className={styles.vendasOrcamentosTableHeaderCell}>
                    <Checkbox
                      checked={
                        selectedItems.length === currentItems.length &&
                        currentItems.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className={styles.vendasOrcamentosTableHeaderText}>
                    Data <ChevronUp className={styles.vendasOrcamentosTableSortIcon} />
                  </TableHead>
                  <TableHead className={styles.vendasOrcamentosTableHeaderText}>
                    Tipo <ChevronUp className={styles.vendasOrcamentosTableSortIcon} />
                  </TableHead>
                  <TableHead className={styles.vendasOrcamentosTableHeaderText}>
                    Número <ChevronUp className={styles.vendasOrcamentosTableSortIcon} />
                  </TableHead>
                  <TableHead className={styles.vendasOrcamentosTableHeaderText}>
                    Cliente <ChevronUp className={styles.vendasOrcamentosTableSortIcon} />
                  </TableHead>
                  <TableHead className={styles.vendasOrcamentosTableHeaderText}>
                    Valor (R$) <ChevronUp className={styles.vendasOrcamentosTableSortIcon} />
                  </TableHead>
                  <TableHead className={styles.vendasOrcamentosTableHeaderText}>
                    Situação <ChevronUp className={styles.vendasOrcamentosTableSortIcon} />
                  </TableHead>
                  <TableHead className={styles.vendasOrcamentosTableHeaderText}>Nota Fiscal</TableHead>
                  <TableHead className={styles.vendasOrcamentosTableHeaderText}>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className={styles.vendasOrcamentosTableRowEmpty}>
                      <div className={styles.vendasOrcamentosTableRowEmptyText}>
                        {searchTerm || activeStatusFilter
                          ? "Nenhuma venda encontrada para os filtros aplicados."
                          : "Nenhuma venda cadastrada."}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className={`${styles.vendasOrcamentosTableRow} vendas-orcamentos-table-row`}
                      onClick={() => handleAbrirDetalhes(item)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id.toString())}
                          onCheckedChange={(checked) =>
                            handleSelectItem(
                              item.id.toString(),
                              checked
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className={styles.vendasOrcamentosTableCellSecondary}>
                        {formatDate(item.data_venda)}
                      </TableCell>
                      <TableCell>
                        <Badge className={item.__tipo === "contrato" 
                          ? "vendas-orcamentos-badge-contrato" 
                          : "vendas-orcamentos-badge-venda"
                        }>
                          {item.__tipo === "contrato" ? "Contrato" : "Venda"}
                        </Badge>
                      </TableCell>
                      <TableCell className={styles.vendasOrcamentosTableCellSecondary}>
                        {item.numero_venda || "-"}
                      </TableCell>
                      <TableCell>
                        <div className={styles.vendasOrcamentosClienteContainer}>
                          <div className={styles.vendasOrcamentosClienteName}>
                            {item.cliente_nome || "Cliente não informado"}
                          </div>
                          <div className={styles.vendasOrcamentosClienteDetails}>
                            {item.produto_servico_nome ||
                              "Produto/Serviço não informado"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={`${styles.vendasOrcamentosTableCellValue} ${styles.vendasOrcamentosTableCellSecondary}`}>
                        {formatCurrency(parseFloat(item.valor_venda || "0"))}
                      </TableCell>
                      <TableCell>
                        {getSituacaoBadge(item.situacao || "")}
                      </TableCell>
                      <TableCell>
                        <div className={styles.vendasOrcamentosNfsContainer}>
                          <Button
                            size="sm"
                            className="vendas-orcamentos-nfs-btn"
                            disabled
                          >
                            Emitir NFS-e
                          </Button>
                          {(item.situacao || "") === "em_andamento" ? (
                            <Mail className={styles.vendasOrcamentosNfsIcon} />
                          ) : (
                            <Send className={styles.vendasOrcamentosNfsIcon} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={styles.vendasOrcamentosDropdownContainer}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={styles.vendasOrcamentosActionButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openDropdownId === item.id) {
                                setOpenDropdownId(null);
                              } else {
                                calculateDropdownPosition(e.currentTarget);
                                setOpenDropdownId(item.id);
                              }
                            }}
                          >
                            <MoreHorizontal className={styles.vendasOrcamentosActionIcon} />
                          </Button>
                          {openDropdownId === item.id && (
                            <div 
                              className={styles.vendasOrcamentosDropdownContent}
                              style={{
                                top: `${dropdownPosition.top}px`,
                                left: `${dropdownPosition.left}px`
                              }}
                            >
                              <button 
                                className={styles.vendasOrcamentosDropdownItem}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAbrirDetalhes(item);
                                  setOpenDropdownId(null);
                                }}
                              >
                                Ver detalhes
                              </button>
                              {item.__tipo !== "contrato" && (
                                <button 
                                  className={styles.vendasOrcamentosDropdownItem}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAbrirEditarVenda(item.id);
                                    setOpenDropdownId(null);
                                  }}
                                >
                                  Editar
                                </button>
                              )}
                              
                              {item.__tipo !== "contrato" && (
                                <button 
                                  className={styles.vendasOrcamentosDropdownItem}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadBoleto(item.id);
                                    setOpenDropdownId(null);
                                  }}
                                  disabled={isDownloadingBoleto === item.id}
                                >
                                  {isDownloadingBoleto === item.id ? (
                                    <>
                                      <div className={styles.vendasOrcamentosModalSpinner}></div>
                                      Baixando...
                                    </>
                                  ) : (
                                    <>
                                      Baixar boleto
                                    </>
                                  )}
                                </button>
                              )}

                              <button 
                                className={`${styles.vendasOrcamentosDropdownItem} danger`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDeleteModal(item.id, item.numero_venda || "", item.cliente_nome || "");
                                  setOpenDropdownId(null);
                                }}
                              >
                                Excluir
                              </button>
                              {item.__tipo !== "contrato" && (
                                <button 
                                  className={`${styles.vendasOrcamentosDropdownItem} warning`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenSituacaoModal(item.id, item.situacao);
                                    setOpenDropdownId(null);
                                  }}
                                >
                                  Mudar situação
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Paginação e resumo */}
      <div className={styles.vendasOrcamentosPagination}>
        <span className={styles.vendasOrcamentosPaginationInfo}>
          {filteredVendas.length > 0 ? (
            <>
              Mostrando {(currentPage - 1) * itemsPerPage + 1}
              {" - "}
              {Math.min(currentPage * itemsPerPage, filteredVendas.length)} de {filteredVendas.length}
            </>
          ) : (
            "Nenhum registro encontrado"
          )}
        </span>
        <div className={styles.vendasOrcamentosPaginationButtons}>
          <select
            value={itemsPerPage}
            onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
            className={styles.vendasOrcamentosPaginationSelect}
            style={{ marginRight: 16 }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button
            className={styles.vendasOrcamentosPaginationArrow}
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1 || totalPages === 0}
            aria-label="Primeira página"
          >
            {"<<"}
          </button>
          <button
            className={styles.vendasOrcamentosPaginationArrow}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1 || totalPages === 0}
            aria-label="Página anterior"
          >
            {"<"}
          </button>
          {Array.from({ length: paginaFim - paginaInicio + 1 }, (_, i) => paginaInicio + i).map((p) => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={p === currentPage ? styles.vendasOrcamentosPaginationButtonActive : styles.vendasOrcamentosPaginationArrow}
            >
              {p}
            </button>
          ))}
          <button
            className={styles.vendasOrcamentosPaginationArrow}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            aria-label="Próxima página"
          >
            {">"}
          </button>
          <button
            className={styles.vendasOrcamentosPaginationArrow}
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            aria-label="Última página"
          >
            {">>"}
          </button>
        </div>
      </div>

      {/* Nova Venda Drawer */}
      <NovaVendaDrawer
        isOpen={isNovaVendaOpen}
        onClose={() => setIsNovaVendaOpen(false)}
        onSave={handleNovaVendaSave}
        mode="create"
      />

      {/* Editar Venda Drawer (usando o mesmo componente) */}
      <NovaVendaDrawer
        isOpen={isEditarVendaOpen}
        onClose={handleFecharEditarVenda}
        onSave={handleEditarVendaSave}
        vendaId={vendaParaEditar}
        mode="edit"
      />

      {/* Detalhes Venda Drawer */}
      <DetalhesVendaDrawer
        isOpen={isDetalhesVendaOpen}
        onClose={() => setIsDetalhesVendaOpen(false)}
        vendaId={vendaSelecionada}
        onRefresh={refetchVendas}
      />

      {/* Detalhes Contrato Drawer */}
      <DetalhesContratoDrawer
        isOpen={isDetalhesContratoOpen}
        onClose={() => setIsDetalhesContratoOpen(false)}
        contratoId={contratoSelecionado}
        mostrarApenasBoletosP={true}
      />

      {/* Modal de Mudança de Situação */}
      <Dialog open={isSituacaoModalOpen} onOpenChange={setIsSituacaoModalOpen}>
        <DialogContent className={styles.vendasOrcamentosModalContent}>
          <DialogHeader className={styles.vendasOrcamentosModalHeader}>
            <DialogTitle className={styles.vendasOrcamentosModalTitle}>
              Mudar Situação da Venda
            </DialogTitle>
          </DialogHeader>
          
          <div className={styles.vendasOrcamentosModalBody}>
            <div className="text-center">
              <p className={styles.vendasOrcamentosModalDescription}>
                Selecione a nova situação para esta venda:
              </p>
              
              <div className={styles.vendasOrcamentosModalButtons}>
                <Button
                  onClick={() => handleUpdateSituacao("ativo")}
                  disabled={isUpdatingSituacao || selectedVendaSituacao === "ativo"}
                  className={`${styles.vendasOrcamentosModalButton} ${
                    selectedVendaSituacao === "ativo"
                      ? styles.vendasOrcamentosModalButtonActive
                      : ""
                  }`}
                >
                  <div className={`${styles.vendasOrcamentosModalButtonIndicator} ${styles.vendasOrcamentosModalButtonIndicatorActive}`}></div>
                  Ativo
                </Button>
                
                <Button
                  onClick={() => handleUpdateSituacao("em_andamento")}
                  disabled={isUpdatingSituacao || selectedVendaSituacao === "em_andamento"}
                  className={`${styles.vendasOrcamentosModalButton} ${
                    selectedVendaSituacao === "em_andamento"
                      ? styles.vendasOrcamentosModalButtonEmAndamento
                      : ""
                  }`}
                >
                  <div className={`${styles.vendasOrcamentosModalButtonIndicator} ${styles.vendasOrcamentosModalButtonIndicatorEmAndamento}`}></div>
                  Em Andamento
                </Button>
                
                <Button
                  onClick={() => handleUpdateSituacao("aprovado")}
                  disabled={isUpdatingSituacao || selectedVendaSituacao === "aprovado"}
                  className={`${styles.vendasOrcamentosModalButton} ${
                    selectedVendaSituacao === "aprovado"
                      ? styles.vendasOrcamentosModalButtonAprovado
                      : ""
                  }`}
                >
                  <div className={`${styles.vendasOrcamentosModalButtonIndicator} ${styles.vendasOrcamentosModalButtonIndicatorAprovado}`}></div>
                  Venda liberada
                </Button>
                
                <Button
                  onClick={() => handleUpdateSituacao("recusado")}
                  disabled={isUpdatingSituacao || selectedVendaSituacao === "recusado"}
                  className={`${styles.vendasOrcamentosModalButton} ${
                    selectedVendaSituacao === "recusado"
                      ? styles.vendasOrcamentosModalButtonRecusado
                      : ""
                  }`}
                >
                  <div className={`${styles.vendasOrcamentosModalButtonIndicator} ${styles.vendasOrcamentosModalButtonIndicatorRecusado}`}></div>
                  Recusado
                </Button>
              </div>
            </div>
            
            {isUpdatingSituacao && (
              <div className={styles.vendasOrcamentosModalLoading}>
                <div className={styles.vendasOrcamentosModalSpinner}></div>
                <span className={styles.vendasOrcamentosModalLoadingText}>Atualizando situação...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className={styles.vendasOrcamentosModalContent}>
                  <DialogHeader>
          <div className={styles.vendasOrcamentosModalHeaderWithIcon}>
            <div className={styles.vendasOrcamentosModalIcon}>
              <AlertTriangle className={styles.vendasOrcamentosModalIconAlert} />
            </div>
            <DialogTitle className={styles.vendasOrcamentosModalTitleWithIcon}>
              Excluir venda
            </DialogTitle>
          </div>
        </DialogHeader>
          
          <div className={styles.vendasOrcamentosModalBody}>
            <div className="text-center">
              <p className={styles.vendasOrcamentosModalDescriptionWithIcon}>
                Tem certeza que deseja excluir a venda{" "}
                <span className={styles.vendasOrcamentosModalHighlight}>
                  {vendaParaExcluir?.numero ? `#${vendaParaExcluir.numero}` : ""}
                </span>
                {vendaParaExcluir?.cliente && (
                  <>
                    {" "}do cliente{" "}
                    <span className={styles.vendasOrcamentosModalHighlight}>
                      {vendaParaExcluir.cliente}
                    </span>
                  </>
                )}
                ?
              </p>
              
              <div className={styles.vendasOrcamentosModalExclusaoWarning}>
                <p className={styles.vendasOrcamentosModalExclusaoWarningText}>
                  ⚠️ Esta ação não poderá ser desfeita e todos os dados relacionados serão perdidos permanentemente.
                </p>
              </div>
            </div>
            
            {isDeletingVenda && (
              <div className={styles.vendasOrcamentosModalLoading}>
                <div className={styles.vendasOrcamentosModalSpinner}></div>
                <span className={styles.vendasOrcamentosModalLoadingText}>Excluindo venda...</span>
              </div>
            )}
          </div>

          <div className={styles.vendasOrcamentosModalFooter}>
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeletingVenda}
              className="vendas-orcamentos-modal-btn-cancelar"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteVenda}
              disabled={isDeletingVenda}
              className="vendas-orcamentos-modal-btn-confirmar"
            >
              {isDeletingVenda ? (
                <>
                  <div className={styles.vendasOrcamentosModalSpinner}></div>
                  Excluindo...
                </>
              ) : (
                "Excluir Venda"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      </div>
    </>
  );
}
