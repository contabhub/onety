"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/financeiro/card";
import 'react-toastify/dist/ReactToastify.css';
import { Button } from "../../components/financeiro/botao";
import { Input } from "../../components/financeiro/input";
import { Badge } from "../../components/financeiro/badge";
import { Checkbox } from '../../components/financeiro/checkbox';
import styles from "../../styles/financeiro/ContasAReceber.module.css";
import {
  Search,
  Plus,
  FileText,
  Upload,
  Download,
  Filter,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronLeft,
  ChevronRight,
  Mail,
  MoreVertical,
  Receipt,
  AlertTriangle,
  Loader2,
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
import NovaReceitaDrawer from "../../components/financeiro/novaReceitaDrawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/financeiro/dropdown-menu";
import { ExportarReceber } from "../../components/financeiro/ExportarReceber";
import { ImportarReceber } from "../../components/financeiro/ImportarReceber";
import { ImportarOFXModal } from "../../components/financeiro/ImportarOFXModal";
import { DownloadPlanilhasContasModal } from "../../components/financeiro/DownloadPlanilhasContasModal";
import { ptBR } from "date-fns/locale";
import {
  format,
  isToday,
  isAfter,
  isBefore,
  parseISO,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
  isWithinInterval,
  format as formatDate,
} from "date-fns";
import OpenFinancePluggy from "./contas-a-receber/open-finance";
import SpaceLoader from "../../components/onety/menu/SpaceLoader";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

// Função cn para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');


// Função utilitária fora do componente para evitar erro de linter....
function getPeriodRange(period, currentMonth) {
  const today = new Date();
  const targetDate = currentMonth || today;

  switch (period) {
    case "Hoje":
      return { start: today, end: today, label: format(today, "dd/MM/yyyy") };
    case "Esta semana": {
      const start = startOfWeek(today, { weekStartsOn: 1 });
      const end = endOfWeek(today, { weekStartsOn: 1 });
      return {
        start,
        end,
        label: `${format(start, "dd/MM/yyyy")} a ${format(end, "dd/MM/yyyy")}`,
      };
    }
    case "Este mês": {
      const start = startOfMonth(targetDate);
      const end = endOfMonth(targetDate);
      return {
        start,
        end,
        label: format(start, "MMMM/yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()),
      };
    }
    case "Este ano": {
      const start = startOfYear(today);
      const end = endOfYear(today);
      return {
        start,
        end,
        label: `${format(start, "dd/MM/yyyy")} a ${format(end, "dd/MM/yyyy")}`,
      };
    }
    case "Últimos 30 dias": {
      const start = subDays(today, 29);
      return {
        start,
        end: today,
        label: `${format(start, "dd/MM/yyyy")} a ${format(
          today,
          "dd/MM/yyyy"
        )}`,
      };
    }
    case "Últimos 12 meses": {
      const start = subMonths(today, 11);
      return {
        start,
        end: today,
        label: `${format(start, "MM/yyyy")} a ${format(today, "MM/yyyy")}`,
      };
    }
    case "Todo o período":
    default:
      return { start: null, end: null, label: "Todo o período" };
  }
}

// Função utilitária para padronizar os dados de entrada de ambas as rotas
function mapEntrada(raw) {
  const isPluggy = !!raw.description && !raw.descricao;

  // Mapear categoria baseado nos dados disponíveis
  let categoria = '';
  if (raw.subcategoria_nome && raw.categoria_nome) {
    categoria = `${raw.categoria_nome} - ${raw.subcategoria_nome}`;
  } else if (raw.categoria_nome) {
    categoria = raw.categoria_nome;
  } else if (isPluggy) {
    categoria = 'Transação Pluggy';
  } else {
    categoria = 'Sem categoria';
  }

  const entrada = {
    id: raw.id,
    descricao: raw.descricao || raw.description || "",
    a_receber: Number(raw.a_receber || raw.valor || raw.amount || 0),
    data_transacao:
      raw.data_transacao || raw.date || raw.data_recebimento || "",
    data_vencimento:
      raw.data_vencimento || raw.date || raw.data_transacao || "",
    situacao: raw.situacao || (isPluggy ? "recebido" : "em aberto"),
    observacoes: raw.observacoes || raw.observacao || "",
    parcelamento: raw.parcelamento || 0,
    intervalo_parcelas: raw.intervalo_parcelas || 0,
    boleto_id: raw.boleto_id || null,
    categoria: categoria,
    cliente: raw.cliente_nome_fantasia || undefined,
    origem: raw.origem || "empresa", // Usar a origem da transação ou "empresa" como padrão
    transacao_api_id: raw.transacao_api_id || null,
    conciliacao_id: raw.conciliacao_id || null,
    conciliacao_status: raw.conciliacao_status || null,
  };


  return entrada;
}

export default function ContasAReceber() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [selectedSubcategoria, setSelectedSubcategoria] = useState("all");
  const [subcategoriasDisponiveis, setSubcategoriasDisponiveis] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isNovaReceitaOpen, setIsNovaReceitaOpen] = useState(false);
  const [downloadPlanilhasModal, setDownloadPlanilhasModal] = useState(false);
  const [entradas, setEntradas] = useState([]);
  const [selectedReceita, setSelectedReceita] = useState(null);
  const [dadosParaDuplicacao, setDadosParaDuplicacao] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("Este mês");
  const periodOptions = [
    "Hoje",
    "Esta semana",
    "Este mês",
    "Este ano",
    "Últimos 30 dias",
    "Últimos 12 meses",
    "Todo o período",
  ];
  const [showOpenFinance, setShowOpenFinance] = useState(false);
  const [isExportarReceberOpen, setIsExportarReceberOpen] = useState(false);
  const [isImportarReceberOpen, setIsImportarReceberOpen] = useState(false);
  const [isImportarOFXOpen, setIsImportarOFXOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dadosConciliacao, setDadosConciliacao] = useState(new Map());
  const [openMenuIndex, setOpenMenuIndex] = useState(null);
  const [isBatchMenuOpen, setIsBatchMenuOpen] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL;
  const searchParams = useSearchParams();
  const router = useRouter();

  // Estados para modal de exclusão
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [entradaParaExcluir, setEntradaParaExcluir] = useState(null);
  const [isDeletingEntrada, setIsDeletingEntrada] = useState(false);

  // Estados para seleção múltipla
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);

  // Estados para modal de revogação de conciliação
  const [isRevogacaoModalOpen, setIsRevogacaoModalOpen] = useState(false);
  const [entradaParaRevogar, setEntradaParaRevogar] = useState(null);
  const [isRevogando, setIsRevogando] = useState(false);

  // Normalizar os parâmetros de query string
  const rawStatus = searchParams.get("status");
  const rawVencimento = searchParams.get("vencimento");
  const rawSubcategoria = searchParams.get("subcategoria");
  const rawDataInicio = searchParams.get("data_inicio");
  const rawDataFim = searchParams.get("data_fim");

  // Mapear valores da URL para valores do backend
  const getMappedStatus = (status) => {
    if (!status) return null;

    const statusMap = {
      VENCIDO: "vencidos",
      VENCIDOS: "vencidos",
      RECEBIDO: "recebido",
      PAGO: "recebido", // Mapear "pago" para "recebido" (vindo do relatório)
      CONCILIADO: "recebido", // Mostra como "recebido" mas mantém a badge "Conciliada"
      EM_ABERTO: "em aberto",
      "EM ABERTO": "em aberto",
      ABERTO: "em aberto",
    };

    return statusMap[status.toUpperCase()] || status.toLowerCase();
  };

  const status = getMappedStatus(rawStatus);
  const vencimento = rawVencimento;
  const subcategoria = rawSubcategoria;
  const dataInicio = rawDataInicio;
  const dataFim = rawDataFim;

  // Função para extrair subcategorias dos dados
  const extractSubcategorias = useCallback((entradas) => {
    const subcategorias = new Set();

    entradas.forEach(entrada => {
      if (entrada.categoria) {
        // Se a categoria contém " - ", extrair a subcategoria
        if (entrada.categoria.includes(' - ')) {
          const subcategoria = entrada.categoria.split(' - ')[1];
          if (subcategoria && subcategoria !== 'Sem categoria') {
            subcategorias.add(subcategoria);
          }
        } else {
          // Se não tem subcategoria, usar a categoria inteira
          if (entrada.categoria !== 'Sem categoria') {
            subcategorias.add(entrada.categoria);
          }
        }
      }
    });

    return Array.from(subcategorias).sort();
  }, []);

  // Função para buscar dados de conciliação (usando enum "conciliado")
  const buscarDadosConciliacao = useCallback(async (entradas) => {
    try {
      const mapaConciliacao = new Map();

      // Para cada transação com status "conciliado", marcar como conciliada
      const transacoesConciliadas = entradas.filter(e => e.situacao === "conciliado");

      transacoesConciliadas.forEach(entrada => {
        mapaConciliacao.set(entrada.id, {
          status: "conciliada",
          transacao_api_id: entrada.transacao_api_id
        });
      });

      setDadosConciliacao(mapaConciliacao);
      console.log("🔍 Transações conciliadas mapeadas:", mapaConciliacao);
    } catch (error) {
      console.error("Erro ao mapear conciliações:", error);
    }
  }, []);

  // Função para recarregar os dados das entradas (empresa)
  const recarregarEntradas = useCallback(async () => {
    const userData = localStorage.getItem("userData");
    const user = userData ? JSON.parse(userData) : null;
    const empresaId = user?.EmpresaId || null;
    const token = localStorage.getItem("token");
    if (!empresaId || !token || !API) {
      console.error("EmpresaId, Token ou API não encontrados");
      return;
    }
    try {
      let url = `${API}/financeiro/transacoes/empresa/${empresaId}/entradas`;
      const queryParams = [];
      if (status) queryParams.push(`status=${status}`);
      if (vencimento) queryParams.push(`vencimento=${vencimento}`);
      if (subcategoria) queryParams.push(`subcategoria=${subcategoria}`);
      if (dataInicio) queryParams.push(`data_inicio=${dataInicio}`);
      if (dataFim) queryParams.push(`data_fim=${dataFim}`);
      if (queryParams.length > 0) {
        url += `?${queryParams.join("&")}`;
      }
      const resEmpresa = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dataEmpresa = resEmpresa.ok ? await resEmpresa.json() : [];
      const entradasMapeadas = dataEmpresa.map(mapEntrada);
      setEntradas(entradasMapeadas);

      // Extrair subcategorias dos dados
      const subcategorias = extractSubcategorias(entradasMapeadas);
      setSubcategoriasDisponiveis(subcategorias);

      // Buscar dados de conciliação usando a mesma lógica da revogação
      await buscarDadosConciliacao(entradasMapeadas);
    } catch (error) {
      setEntradas([]);
      console.error("Erro ao buscar transações de entrada:", error);
    }
  }, [API, status, vencimento, subcategoria, dataInicio, dataFim, extractSubcategorias, buscarDadosConciliacao]);

  useEffect(() => {
    const userData = localStorage.getItem("userData");
    const user = userData ? JSON.parse(userData) : null;
    const empresaId = user?.EmpresaId || null;
    const token = localStorage.getItem("token");

    if (!empresaId || !token) {
      console.error("EmpresaId ou Token não encontrados no localStorage");
      setIsLoading(false);
      return;
    }

    const fetchEntradas = async () => {
      try {
        setIsLoading(true);
        await recarregarEntradas();
      } catch (error) {
        console.error("Erro ao buscar transações de entrada:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEntradas();
  }, [recarregarEntradas]);



  const periodRange = getPeriodRange(selectedPeriod, currentMonth);

  // Aplicar filtros locais apenas se não houver filtros na URL
  const shouldApplyLocalFilters = !status && !vencimento && !subcategoria && !dataInicio && !dataFim;

  const filteredTransactions = entradas
    .filter((transaction) => {
      // Se há filtros na URL, não aplicar filtros de período localmente
      if (!shouldApplyLocalFilters) return true;

      if (!periodRange.start || !periodRange.end) return true;
      // Garantir que a data seja comparada corretamente, ignorando timezone
      let vencimento;
      if (typeof transaction.data_vencimento === "string") {
        vencimento = parseISO(transaction.data_vencimento);
      } else {
        vencimento = new Date(transaction.data_vencimento);
      }
      const start = new Date(
        periodRange.start.getFullYear(),
        periodRange.start.getMonth(),
        periodRange.start.getDate(),
        0,
        0,
        0,
        0
      );
      const end = new Date(
        periodRange.end.getFullYear(),
        periodRange.end.getMonth(),
        periodRange.end.getDate(),
        23,
        59,
        59,
        999
      );

      return isWithinInterval(vencimento, { start, end });
    })
    .filter((transaction) => {
      // Aplicar filtro de busca sempre, independente de filtros na URL
      if (!searchTerm.trim()) return true;

      const searchLower = searchTerm.toLowerCase();

      // Busca por descrição
      const matchesDescription = transaction.descricao
        .toLowerCase()
        .includes(searchLower);

      // Busca por categoria
      const matchesCategory = transaction.categoria
        ?.toLowerCase()
        .includes(searchLower) || false;

      // Busca por cliente
      const matchesClient = transaction.cliente
        ?.toLowerCase()
        .includes(searchLower) || false;

      // Busca por observações
      const matchesObservacoes = transaction.observacoes
        ?.toLowerCase()
        .includes(searchLower) || false;

      // Busca por situação
      const matchesSituacao = transaction.situacao
        .toLowerCase()
        .includes(searchLower);

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
          const transactionValue = Number(transaction.a_receber || 0);
          // Busca exata ou aproximada (com tolerância de 0.01 para diferenças de arredondamento)
          matchesValue = Math.abs(transactionValue - searchValue) < 0.01;
        }
      }

      // Busca por valor sem formatação (apenas números)
      if (!matchesValue && /^\d+([.,]\d+)?$/.test(searchLower)) {
        const cleanSearch = searchLower.replace(',', '.');
        const searchValue = parseFloat(cleanSearch);

        if (!isNaN(searchValue)) {
          const transactionValue = Number(transaction.a_receber || 0);
          matchesValue = Math.abs(transactionValue - searchValue) < 0.01;
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

      const matchesDate = formatDateForSearch(transaction.data_vencimento || "").includes(searchTerm) ||
        (transaction.data_transacao ? formatDateForSearch(transaction.data_transacao).includes(searchTerm) : false);

      return matchesDescription || matchesCategory || matchesClient || matchesObservacoes || matchesSituacao || matchesValue || matchesDate;
    })
    .filter((transaction) => {
      // Filtro por subcategoria (se especificado na URL)
      if (subcategoria && subcategoria !== "all") {
        if (!transaction.categoria) return false;

        // Se a categoria contém " - ", verificar se a subcategoria corresponde
        if (transaction.categoria.includes(' - ')) {
          const subcategoriaAtual = transaction.categoria.split(' - ')[1];
          return subcategoriaAtual === subcategoria;
        }

        // Se não tem subcategoria, verificar se a categoria inteira corresponde
        return transaction.categoria === subcategoria;
      }
      return true;
    })
    .filter((transaction) => {
      // Filtro por período específico (se especificado na URL)
      if (dataInicio && dataFim) {
        const vencimento = typeof transaction.data_vencimento === "string"
          ? parseISO(transaction.data_vencimento)
          : new Date(transaction.data_vencimento);

        const inicio = parseISO(dataInicio);
        const fim = parseISO(dataFim);

        return isWithinInterval(vencimento, { start: inicio, end: fim });
      }
      return true;
    })
    .filter((transaction) => {
      // Filtro local por subcategoria (se não há filtros na URL)
      if (shouldApplyLocalFilters && selectedSubcategoria !== "all") {
        if (!transaction.categoria) return false;

        // Se a categoria contém " - ", verificar se a subcategoria corresponde
        if (transaction.categoria.includes(' - ')) {
          const subcategoriaAtual = transaction.categoria.split(' - ')[1];
          return subcategoriaAtual === selectedSubcategoria;
        }

        // Se não tem subcategoria, verificar se a categoria inteira corresponde
        return transaction.categoria === selectedSubcategoria;
      }
      return true;
    });

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Função para formatar valores em reais (corrigida)
  function formatBRL(value) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  // Cálculo dos totais
  const hoje = new Date();
  const vencidos = filteredTransactions
    .filter((e) => e.situacao === "vencidos")
    .reduce((acc, e) => acc + Number(e.a_receber || 0), 0);
  const recebidos = filteredTransactions
    .filter((e) => e.situacao === "recebido")
    .reduce((acc, e) => acc + Number(e.a_receber || 0), 0);
  const vencemHoje = filteredTransactions
    .filter((e) => {
      const dataVenc = new Date(e.data_vencimento);
      return isToday(dataVenc) && e.situacao === "em aberto";
    })
    .reduce((acc, e) => acc + Number(e.a_receber || 0), 0);
  const aVencer = filteredTransactions
    .filter((e) => {
      const dataVenc = new Date(e.data_vencimento);
      return isAfter(dataVenc, hoje) && e.situacao === "em aberto";
    })
    .reduce((acc, e) => acc + Number(e.a_receber || 0), 0);
  const totalPeriodo = filteredTransactions.reduce(
    (acc, e) => acc + Number(e.a_receber || 0),
    0
  );

  const stats = [
    {
      title: "Vencidos (R$)",
      value: formatBRL(vencidos),
      color: "stat-vencidos-receber",
    },
    {
      title: "Vencem hoje (R$)",
      value: formatBRL(vencemHoje),
      color: "stat-vencem-hoje-receber",
    },
    {
      title: "A vencer (R$)",
      value: formatBRL(aVencer),
      color: "stat-a-vencer-receber",
    },
    {
      title: "Recebidos (R$)",
      value: formatBRL(recebidos),
      color: "stat-recebidos",
    },
    {
      title: "Total do período (R$)",
      value: formatBRL(totalPeriodo),
      color: "stat-total-receber",
    },
  ];

  const getStatusBadge = (status, situacao) => {
    if (situacao === "Recebido") {
      return <Badge className={`${styles.bgGreen100} ${styles.textGreen800}`}>Recebido</Badge>;
    } else {
      return <Badge className={`${styles.bgYellow100} ${styles.textYellow800}`}>Em Aberto</Badge>;
    }
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentMonth);
    if (direction === "prev") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentMonth(newDate);
    setSelectedPeriod("Este mês"); // Resetar para "Este mês" quando navega
  };

  const handlePeriodChange = (newPeriod) => {
    setSelectedPeriod(newPeriod);
    // Resetar o mês atual quando não for "Este mês"
    if (newPeriod !== "Este mês") {
      setCurrentMonth(new Date());
    }
  };

  const handleNovaReceita = () => {
    setIsNovaReceitaOpen(true);
  };

  const handleImportarOFX = () => {
    setIsImportarOFXOpen(true);
  };

  const handleSaveReceita = async (data) => {
    // Recarrega os dados para refletir as mudanças
    await recarregarEntradas();

    // Verifica se é uma edição ou nova receita baseado na presença de ID
    if (data.id) {
      toast.success("Receita atualizada com sucesso!");
    } else {
      toast.success("Receita criada com sucesso!");
    }
  };

  const handleUpdateSituacao = async (id, novaSituacao) => {
    try {
      const token = localStorage.getItem("token");
      let body = { situacao: novaSituacao };

      // Para situações "em aberto" ou "vencidos", enviar data_transacao como null
      if (novaSituacao === "em aberto" || novaSituacao === "vencidos") {
        body.data_transacao = null;
      }
      // Para situação "recebido", enviar a data de hoje
      else if (novaSituacao === "recebido") {
        body.data_transacao = formatDate(new Date(), "yyyy-MM-dd");
      }

      const response = await fetch(`${API}/financeiro/transacoes/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Erro ao atualizar situação");

      await recarregarEntradas();
      toast.success("Situação atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar situação:", error);
      toast.error("Erro ao atualizar situação. Tente novamente.");
    }
  };



  const handleEditReceita = (entrada) => {
    setSelectedReceita(entrada);
    setIsNovaReceitaOpen(true);
  };

  // Função para duplicar receita
  const handleDuplicarReceita = async (entrada) => {
    console.log("🔄 Duplicando receita:", entrada);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Token não encontrado");
        return;
      }

      // Busca os dados completos da transação via GET
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/transacoes/${entrada.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        toast.error("Erro ao buscar dados da transação");
        return;
      }

      const data = await res.json();
      console.log("📋 Dados completos da transação:", data);

      // Abre o drawer de nova receita
      setIsNovaReceitaOpen(true);

      // Passa os dados completos para preencher o formulário
      setDadosParaDuplicacao({
        descricao: data.descricao || "",
        valor: data.valor || 0,
        categoria: data.sub_categoria_id ? data.sub_categoria_id.toString() : data.categoria_id?.toString() || "",
        contaRecebimento: data.conta_id ? `erp:${data.conta_id}` : data.conta_api_id ? `api:${data.conta_api_id}` : "",
        cliente: data.cliente_id?.toString() || "",
        vencimento: data.data_vencimento ? new Date(data.data_vencimento) : new Date(),
        formaPagamento: data.origem || "",
        observacoes: data.observacoes || "",
        centroCusto: data.centro_de_custo_id?.toString() || "",
        // Campos específicos para duplicação
        duplicacao: {
          recebido: false, // Sempre começar como não recebido
          dataRecebimento: null,
          parcela: data.parcelamento || 1,
          intervaloParcelas: data.intervalo_parcelas || 30,
        },
        // Dados relacionados para busca
        cliente_nome: data.cliente_nome || "",
        categoria_nome: data.categoria_nome || "",
        subcategoria_nome: data.subcategoria_nome || "",
        conta_nome: data.conta_nome || "",
        centro_custo_nome: data.centro_custo_nome || "",
      });

      toast.success("Dados carregados para duplicação");
    } catch (error) {
      console.error("Erro ao duplicar receita:", error);
      toast.error("Erro ao carregar dados para duplicação");
    }
  };

  // Função para abrir modal de exclusão
  const handleOpenDeleteModal = (entradaId, descricao, valor) => {
    setEntradaParaExcluir({ id: entradaId, descricao, valor });
    setIsDeleteModalOpen(true);
  };

  // Função para excluir entrada
  const handleDeleteEntrada = async () => {
    if (!entradaParaExcluir) return;

    try {
      setIsDeletingEntrada(true);

      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Token não encontrado");
      }

      // Buscar a entrada para verificar a origem
      const entrada = entradas.find(e => e.id === entradaParaExcluir.id);

      let response;
      if (entrada?.origem === "pluggy") {
        // Para transações Pluggy, usar a rota de transacoes-api
        const userData = localStorage.getItem("userData");
        const user = userData ? JSON.parse(userData) : null;
        const empresaId = user?.EmpresaId || null;
        response = await fetch(`${API}/financeiro/transacoes-api/company/${empresaId}/transacao/${entradaParaExcluir.id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } else if (entrada?.origem === "Importação OFX") {
        // Para transações OFX, usar a rota transacoes (mesmo que empresa)
        response = await fetch(`${API}/financeiro/transacoes/${entradaParaExcluir.id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } else {
        // Para transações da empresa, usar a rota transacoes
        response = await fetch(`${API}/financeiro/transacoes/${entradaParaExcluir.id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao excluir lançamento");
      }

      toast.success(`Lançamento "${entradaParaExcluir.descricao}" excluído com sucesso!`);

      // Fechar modal e recarregar dados
      setIsDeleteModalOpen(false);
      setEntradaParaExcluir(null);
      await recarregarEntradas();

    } catch (error) {
      console.error("❌ Erro ao excluir lançamento:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao excluir lançamento";
      toast.error(errorMessage);
    } finally {
      setIsDeletingEntrada(false);
    }
  };

  // Funções para seleção múltipla
  const handleSelectItem = (id, checked) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  // Função para alterar status de múltiplos itens
  const handleBatchStatusChange = async (novaSituacao) => {
    if (selectedItems.size === 0) return;

    try {
      setIsDeletingMultiple(true); // Reutilizar o estado de loading
      const token = localStorage.getItem("token");
      const itemsToUpdate = Array.from(selectedItems);

      // Alterar status de todos os itens selecionados
      const promises = itemsToUpdate.map(async (id) => {
        let body = { situacao: novaSituacao };

        // Para situações "em aberto" ou "vencidos", enviar data_transacao como null
        if (novaSituacao === "em aberto" || novaSituacao === "vencidos") {
          body.data_transacao = null;
        }
        // Para situação "recebido", enviar a data de hoje
        else if (novaSituacao === "recebido") {
          body.data_transacao = formatDate(new Date(), "yyyy-MM-dd");
        }

        const response = await fetch(`${API}/financeiro/transacoes/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`Erro ao alterar status do lançamento ${id}`);
        }

        return response.json();
      });

      await Promise.all(promises);

      // Recarregar dados para refletir as mudanças
      await recarregarEntradas();

      // Limpar seleção após alteração
      setSelectedItems(new Set());
      setSelectAll(false);

      // Toast de confirmação
      const situacaoLabel = novaSituacao === "recebido" ? "pago" :
        novaSituacao === "vencidos" ? "vencido" : "em aberto";
      toast.success(`${selectedItems.size} lançamento(s) marcado(s) como ${situacaoLabel} com sucesso!`);
    } catch (error) {
      console.error("Erro ao alterar status em lote:", error);
      toast.error("Erro ao alterar status dos lançamentos selecionados");
    } finally {
      setIsDeletingMultiple(false);
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = paginatedTransactions.map(entrada => entrada.id);
      setSelectedItems(new Set(allIds));
      setSelectAll(true);
    } else {
      setSelectedItems(new Set());
      setSelectAll(false);
    }
  };

  const handleDeleteMultiple = async () => {
    if (selectedItems.size === 0) return;

    try {
      setIsDeletingMultiple(true);
      const token = localStorage.getItem("token");
      const itemsToDelete = Array.from(selectedItems);

      // Excluir cada item individualmente
      for (const id of itemsToDelete) {
        const entrada = entradas.find(e => e.id === id);

        let response;
        if (entrada?.origem === "pluggy") {
          const userData = localStorage.getItem("userData");
          const user = userData ? JSON.parse(userData) : null;
          const empresaId = user?.EmpresaId || null;
          response = await fetch(`${API}/financeiro/transacoes-api/company/${empresaId}/transacao/${id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } else if (entrada?.origem === "Importação OFX") {
          response = await fetch(`${API}/financeiro/transacoes/${id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } else {
          response = await fetch(`${API}/financeiro/transacoes/${id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        }

        if (!response.ok) {
          throw new Error(`Erro ao excluir lançamento ${id}`);
        }
      }

      // Remover itens excluídos do estado local
      setEntradas(prevEntradas =>
        prevEntradas.filter(entrada => !selectedItems.has(entrada.id))
      );

      // Limpar seleções
      setSelectedItems(new Set());
      setSelectAll(false);

      // Toast de confirmação
      toast.success(`${selectedItems.size} lançamento(s) excluído(s) com sucesso!`);
    } catch (error) {
      console.error("Erro ao excluir múltiplos lançamentos:", error);
      toast.error("Erro ao excluir alguns lançamentos. Tente novamente.");
    } finally {
      setIsDeletingMultiple(false);
    }
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
    setSelectAll(false);
  };

  // Sincronizar estado selectAll com seleções individuais
  useEffect(() => {
    if (paginatedTransactions.length === 0) {
      setSelectAll(false);
      return;
    }

    const allSelected = paginatedTransactions.every(entrada => selectedItems.has(entrada.id));
    const someSelected = paginatedTransactions.some(entrada => selectedItems.has(entrada.id));

    if (allSelected) {
      setSelectAll(true);
    } else if (someSelected) {
      setSelectAll(false);
    }
  }, [selectedItems, paginatedTransactions]);

  // Limpar seleções quando mudar de página ou filtros
  useEffect(() => {
    clearSelection();
  }, [currentPage, searchTerm, selectedPeriod, currentMonth, status, vencimento, subcategoria, dataInicio, dataFim]);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenuIndex !== null) {
        setOpenMenuIndex(null);
      }
      if (isBatchMenuOpen) {
        setIsBatchMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuIndex, isBatchMenuOpen]);

  // Função para limpar filtros da URL
  const clearFilters = () => {
    router.push("/financeiro/contas-a-receber");
  };

  // Verificar se há filtros ativos
  const hasActiveFilters = status || vencimento || subcategoria || dataInicio || dataFim;

  // Função para baixar o boleto em PDF
  const handleDownloadBoleto = async (transacaoId) => {
    try {
      const token = localStorage.getItem("token");
      // 1. Buscar o codigo_solicitacao
      const resCodigo = await fetch(`${API}/financeiro/transacoes/${transacaoId}/codigo-solicitacao`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resCodigo.ok) {
        toast.error("Não foi possível obter o código do boleto.");
        return;
      }
      const { codigo_solicitacao } = await resCodigo.json();
      if (!codigo_solicitacao) {
        toast.error("Código de solicitação do boleto não encontrado.");
        return;
      }

      // 2. Baixar o PDF
      const resPdf = await fetch(`${API}/financeiro/boletos/pdf-simples/${codigo_solicitacao}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resPdf.ok) {
        toast.error("Erro ao baixar o PDF do boleto.");
        return;
      }
      const blob = await resPdf.blob();
      // 3. Forçar download no navegador
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boleto_${transacaoId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Boleto baixado com sucesso!");
    } catch (error) {
      console.error("Erro ao baixar boleto:", error);
      toast.error("Erro ao baixar boleto.");
    }
  };


  // Função para buscar o transacao_api_id correto automaticamente
  const buscarTransacaoApiIdCorreto = async (entrada, token) => {
    try {
      const userData = localStorage.getItem("userData");
      const user = userData ? JSON.parse(userData) : null;
      const empresaId = user?.EmpresaId || null;
      if (!empresaId) return null;

      console.log("🔍 Buscando transacao_api_id para:", {
        descricao: entrada.descricao,
        valor: entrada.a_receber,
        id: entrada.id
      });

      // Buscar todas as contas API da empresa
      const contasApiRes = await fetch(`${API}/financeiro/contas/company/${empresaId}/contas`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!contasApiRes.ok) {
        console.log("⚠️ Não foi possível buscar contas API");
        return null;
      }

      const contasApiData = await contasApiRes.json();
      const contasApi = Array.isArray(contasApiData) ? contasApiData : Array.isArray(contasApiData.contas) ? contasApiData.contas : [];

      console.log("🔍 Contas API encontradas:", contasApi.length);

      // Para cada conta API, buscar transações
      for (const conta of contasApi) {
        try {
          const contaId = conta.account || conta.id;
          if (!contaId) continue;

          const transacoesApiRes = await fetch(`${API}/financeiro/transacoes-api/${contaId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (transacoesApiRes.ok) {
            const transacoesData = await transacoesApiRes.json();
            const transacoes = transacoesData.transactions || [];

            console.log(`🔍 Transações da conta ${contaId}:`, transacoes.length);

            // Procurar transação com valor e descrição similar
            const transacaoSimilar = transacoes.find((tx) => {
              const valorSimilar = Math.abs(parseFloat(tx.amount) - entrada.a_receber) < 0.01;
              const descricaoSimilar = tx.description && entrada.descricao &&
                (tx.description.toLowerCase().includes(entrada.descricao.toLowerCase()) ||
                  entrada.descricao.toLowerCase().includes(tx.description.toLowerCase()) ||
                  // Buscar por palavras-chave comuns
                  entrada.descricao.toLowerCase().split(' ').some(palavra =>
                    palavra.length > 3 && tx.description.toLowerCase().includes(palavra)
                  ));

              if (valorSimilar && descricaoSimilar) {
                console.log("🎯 Correspondência encontrada:", {
                  transacaoApi: { id: tx.id, amount: tx.amount, description: tx.description },
                  transacao: { id: entrada.id, valor: entrada.a_receber, descricao: entrada.descricao }
                });
              }

              return valorSimilar && descricaoSimilar;
            });

            if (transacaoSimilar) {
              console.log("✅ Transacao_api_id encontrado:", transacaoSimilar.id);
              return transacaoSimilar.id;
            }
          }
        } catch (error) {
          console.log("⚠️ Erro ao buscar transações da conta:", error);
        }
      }

      console.log("❌ Nenhuma correspondência encontrada");
      return null;
    } catch (error) {
      console.error("❌ Erro na busca automática:", error);
      return null;
    }
  };

  // Função para abrir modal de revogação de conciliação
  const handleRevogarConciliacao = (entrada) => {
    setEntradaParaRevogar(entrada);
    setIsRevogacaoModalOpen(true);
  };

  // Função para executar a revogação de conciliação (lógica original)
  const executarRevogacaoConciliacao = async (entrada) => {
    console.log("🔄 Iniciando revogação para entrada:", entrada);

    try {
      const token = localStorage.getItem("token");
      const userData = localStorage.getItem("userData");
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || null;

      if (!token) {
        toast.error("Token não encontrado. Faça login novamente.");
        return false;
      }

      let transacaoApiId = entrada.transacao_api_id;

      // Se não tiver transacao_api_id, buscar automaticamente
      if (!transacaoApiId) {
        console.log("🔍 Transacao_api_id não encontrado, buscando automaticamente...");

        // Buscar o transacao_api_id correto baseado no valor e descrição
        transacaoApiId = await buscarTransacaoApiIdCorreto(entrada, token);

        if (!transacaoApiId) {
          // Se não conseguir encontrar automaticamente, pedir ao usuário
          const userInput = prompt(
            `Não foi possível encontrar automaticamente o ID da transação da API.\n\n` +
            `Para revogar a conciliação da transação:\n` +
            `• Descrição: "${entrada.descricao}"\n` +
            `• Valor: R$ ${entrada.a_receber}\n\n` +
            `Informe o transacao_api_id correto:`
          );

          if (userInput && !isNaN(Number(userInput))) {
            transacaoApiId = Number(userInput);
            console.log("✅ Transacao_api_id informado pelo usuário:", transacaoApiId);
          } else if (userInput === null) {
            toast.info("Revogação cancelada pelo usuário.");
            return false;
          } else {
            toast.error("ID inválido. A revogação foi cancelada.");
            return false;
          }
        }
      }

      if (!transacaoApiId) {
        toast.error("Não foi possível encontrar o ID da transação da API para revogar. Esta transação pode não estar conciliada.");
        return false;
      }

      console.log("📤 Enviando requisição de revogação:", {
        transacao_api_id: transacaoApiId,
        transacao_id: entrada.id,
        usuario_id: userId
      });

      const response = await fetch(`${API}/financeiro/conciliacoes/revogar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transacao_api_id: transacaoApiId,
          transacao_id: entrada.id,
          usuario_id: userId,
          observacao: 'Revogação de conciliação via interface',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao revogar conciliação');
      }

      console.log("🎉 Conciliação revogada com sucesso!");
      return true;

    } catch (error) {
      console.error("Erro ao revogar conciliação:", error);
      toast.error(error.message || "Erro ao revogar conciliação.");
      return false;
    }
  };

  // Função para revogar conciliação e excluir transação
  const handleRevogarEExcluir = async () => {
    if (!entradaParaRevogar) return;

    try {
      setIsRevogando(true);

      // Primeiro revogar a conciliação
      const revogacaoSucesso = await executarRevogacaoConciliacao(entradaParaRevogar);

      if (revogacaoSucesso) {
        // Se a revogação foi bem-sucedida, excluir a transação
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Token não encontrado");
        }

        // Buscar a entrada para verificar a origem
        const entrada = entradas.find(e => e.id === entradaParaRevogar.id);

        let response;
        if (entrada?.origem === "pluggy") {
          // Para transações Pluggy, usar a rota de transacoes-api
          const userData = localStorage.getItem("userData");
          const user = userData ? JSON.parse(userData) : null;
          const empresaId = user?.EmpresaId || null;
          response = await fetch(`${API}/financeiro/transacoes-api/company/${empresaId}/transacao/${entradaParaRevogar.id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } else if (entrada?.origem === "Importação OFX") {
          // Para transações OFX, usar a rota transacoes
          response = await fetch(`${API}/financeiro/transacoes/${entradaParaRevogar.id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } else {
          // Para transações da empresa, usar a rota transacoes
          response = await fetch(`${API}/financeiro/transacoes/${entradaParaRevogar.id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Erro ao excluir lançamento");
        }

        toast.success(`Conciliação revogada e lançamento "${entradaParaRevogar.descricao}" excluído com sucesso!`);

        // Fechar modal e recarregar dados
        setIsRevogacaoModalOpen(false);
        setEntradaParaRevogar(null);
        await recarregarEntradas();
      }

    } catch (error) {
      console.error("❌ Erro ao revogar e excluir:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao revogar e excluir lançamento";
      toast.error(errorMessage);
    } finally {
      setIsRevogando(false);
    }
  };

  // Função para apenas revogar conciliação
  const handleApenasRevogar = async () => {
    if (!entradaParaRevogar) return;

    try {
      setIsRevogando(true);

      // Revogar a conciliação
      const revogacaoSucesso = await executarRevogacaoConciliacao(entradaParaRevogar);

      if (revogacaoSucesso) {
        toast.success("Conciliação revogada com sucesso!");

        // Fechar modal de revogação
        setIsRevogacaoModalOpen(false);
        setEntradaParaRevogar(null);

        // Recarregar dados para refletir a mudança
        await recarregarEntradas();
      }

    } catch (error) {
      console.error("❌ Erro ao revogar conciliação:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao revogar conciliação";
      toast.error(errorMessage);
    } finally {
      setIsRevogando(false);
    }
  };

  // Componente de Loading
  const LoadingState = () => (
    <SpaceLoader
      size={120}
      label="Carregando contas a receber..."
      showText={true}
      minHeight={220}
    />
  );

  // Se estiver carregando, mostra o estado de loading
  if (isLoading) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>Contas a receber</h1>
            <p className={styles.subtitle}>
              Gerencie suas contas a receber e fluxo de caixa
            </p>
          </div>
          <div className={styles.headerActions}>
            <Button
              variant="outline"
              size="sm"
              disabled
              className={styles.contasReceberSecondaryBtn}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled
              className={styles.contasReceberSecondaryBtn}
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar planilha
            </Button>
            <Button
              size="sm"
              disabled
              className={styles.contasReceberPrimaryBtn}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova receita
            </Button>
          </div>
        </div>

        {/* Loading State */}
        <div className={styles.filtersCard}>
          <div className={styles.filtersContent}>
            <LoadingState />
          </div>
        </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Contas a receber</h1>
          <p className={styles.subtitle}>
            Gerencie suas contas a receber e fluxo de caixa
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportarReceberOpen(true)}
            className={styles.contasReceberExportBtn}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportarReceberOpen(true)}
            className={styles.contasReceberImportBtn}
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar planilha
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportarOFX}
            className={styles.contasReceberOfxBtn}
          >
            <FileText className="h-4 w-4 mr-2" />
            Importar OFX
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDownloadPlanilhasModal(true)}
            className={styles.contasReceberSecondaryBtn}
          >
            <FileText className="h-4 w-4 mr-2" />
            Planilhas
          </Button>
          <Button
            size="sm"
            onClick={handleNovaReceita}
            className={styles.contasReceberPrimaryBtn}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova receita
          </Button>
        </div>
      </div>


      {/* Modal simples para exibir o componente OpenFinancePluggy */}
      {showOpenFinance && (
        <div className={`${styles.fixed} ${styles.inset0} ${styles.bgBlack} ${styles.bgOpacity40} ${styles.flex} ${styles.itemsCenter} ${styles.justifyCenter} ${styles.z50}`}>
          <div className={`${styles.bgWhite} ${styles.rounded} ${styles.shadow} ${styles.p4} ${styles.maxWlg} ${styles.wFull} ${styles.relative}`}>
            <button
              className={`${styles.absolute} ${styles.top2} ${styles.right2} ${styles.textGray500} ${styles.hoverTextGray700} ${styles.textXl}`}
              onClick={() => setShowOpenFinance(false)}
              aria-label="Fechar"
            >
              ×
            </button>
            <OpenFinancePluggy />
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        {stats.map((stat, index) => (
          <div
            key={index}
            className={styles.statsCard}
          >
            <div className={styles.statContent}>
              <div className={styles.statInfo}>
                <p className={styles.statTitle}>
                  {stat.title}
                </p>
                <p className={`${styles.statValue} ${styles[stat.color.replace('stat-', 'stat').replace('-receber', '').replace('-', '')]}`}>
                  {stat.value}
                </p>
              </div>
              <DollarSign className={`${styles.statIcon} ${styles[stat.color.replace('stat-', 'stat').replace('-receber', '').replace('-', '')]}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Indicador de Filtros Ativos */}
      {hasActiveFilters && (
        <div className={styles.filtrosAtivosCardReceber}>
          <div className="pt-4">
            <div className={`${styles.flex} ${styles.itemsCenter} ${styles.justifyBetween}`}>
              <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gap2}`}>
                <Filter className={`${styles.h4} ${styles.w4} ${styles.textBlue600}`} />
                <span className={`${styles.textSm} ${styles.fontMedium} theme-text-white`}>
                  Filtros ativos:
                </span>
                {status && (
                  <Badge
                    variant="secondary"
                    className={styles.filtrosAtivosBadgeReceber}
                  >
                    Status: {rawStatus}
                  </Badge>
                )}
                {vencimento && (
                  <Badge
                    variant="secondary"
                    className={styles.filtrosAtivosBadgeReceber}
                  >
                    Vencimento: {vencimento}
                  </Badge>
                )}
                {subcategoria && (
                  <Badge
                    variant="secondary"
                    className={styles.filtrosAtivosBadgeReceber}
                  >
                    Subcategoria: {subcategoria}
                  </Badge>
                )}
                {dataInicio && dataFim && (
                  <Badge
                    variant="secondary"
                    className={styles.filtrosAtivosBadgeReceber}
                  >
                    Período: {dataInicio} a {dataFim}
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className={styles.contasReceberSecondaryBtn}
              >
                Limpar filtros
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filtersCard}>
        <div className={styles.filtersContent}>
          <div className={`${styles.flex} ${styles.flexCol} ${styles.lgFlexRow} ${styles.gap4}`}>
            <div className={styles.flex1}>
              <label className={`${styles.textSm} ${styles.fontMedium} ${styles.mb2} ${styles.block}`}>
                Vencimento
              </label>
              <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gap2}`}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth("prev")}
                  className={styles.contasReceberNavBtn}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Select
                  value={selectedPeriod}
                  onValueChange={handlePeriodChange}
                >
                  <SelectTrigger className={`${styles.minW150px}`}>
                    <SelectValue>
                      {selectedPeriod === "Este mês"
                        ? format(currentMonth, "MMMM/yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())
                        : selectedPeriod
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className={styles.statCard}>
                    {periodOptions.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                      >
                        {option === "Este mês"
                          ? format(currentMonth, "MMMM/yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())
                          : option
                        }
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth("next")}
                  className={styles.contasReceberNavBtn}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className={styles.flex1}>
              <label className={`${styles.textSm} ${styles.fontMedium} ${styles.mb2} ${styles.block}`}>
                Pesquisar no período selecionado
              </label>
              <div className={`${styles.relative}`}>
                <Input
                  placeholder="Pesquisar por descrição, categoria, cliente, observações, situação, valor (R$ 1.500,00) ou data (11/08/2025, 11/8/25)"
                  className={`${styles.pl8}`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.flex1}>
              <label className={`${styles.textSm} ${styles.fontMedium} ${styles.mb2} ${styles.block}`}>
                Conta
              </label>
              <Select
                value={selectedAccount}
                onValueChange={setSelectedAccount}
                disabled
              >
                <SelectTrigger >
                  <SelectValue placeholder="Selecionar todas" />
                </SelectTrigger>
                <SelectContent className={styles.statCard}>
                  <SelectItem
                    value="all"
                  >
                    Selecionar todas
                  </SelectItem>
                  <SelectItem
                    value="bradesco"
                  >
                    Banco Bradesco
                  </SelectItem>
                  <SelectItem
                    value="conta-azul"
                  >
                    Conta Straton
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={styles.flex1}>
              <label className={`${styles.textSm} ${styles.fontMedium} ${styles.mb2} ${styles.block}`}>
                Subcategoria
              </label>
              <select
                value={selectedSubcategoria}
                onChange={(e) => setSelectedSubcategoria(e.target.value)}
                disabled={!shouldApplyLocalFilters}
                className={`${styles.contasReceberPaginationSelect}`}
              >
                <option value="all">Todas as subcategorias</option>
                {subcategoriasDisponiveis.map((subcategoria) => (
                  <option
                    key={subcategoria}
                    value={subcategoria}
                  >
                    {subcategoria}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <Card className={styles.contasReceberTransactionsCard}>
        <CardContent className={styles.contasReceberTableContent}>
          <div className={styles.contasReceberTableContainer}>
            <div className={styles.contasReceberPaginationControls}>
             
                {selectedItems.size > 0 && (
                  <>
                    <div className={styles.dropdownContainer}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsBatchMenuOpen(!isBatchMenuOpen);
                        }}
                        className={`${styles.contasReceberSecondaryBtn} ${styles.batchMenuButton}`}
                      >
                        Alterar Status
                      </button>
                      {isBatchMenuOpen && (
                        <div
                          className={`${styles.contasReceberDropdown} ${styles.dropdownMenuLeft}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              handleBatchStatusChange('recebido');
                              setIsBatchMenuOpen(false);
                            }}
                            className={`${styles.contasReceberDropdownItem} ${styles.dropdownMenuItem}`}
                          >
                            Marcar como Pago
                          </button>
                          <button
                            onClick={() => {
                              handleBatchStatusChange('em aberto');
                              setIsBatchMenuOpen(false);
                            }}
                            className={`${styles.contasReceberDropdownItem} ${styles.dropdownMenuItem}`}
                          >
                            Marcar como Em Aberto
                          </button>
                          <button
                            onClick={() => {
                              handleBatchStatusChange('vencidos');
                              setIsBatchMenuOpen(false);
                            }}
                            className={`${styles.contasReceberDropdownItem} ${styles.dropdownMenuItem}`}
                          >
                            Marcar como Vencido
                          </button>
                        </div>
                      )}
                    </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className={styles.contasReceberSecondaryBtn}
                  >
                    Renegociar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                    className={styles.contasReceberSecondaryBtn}
                  >
                    Limpar seleção
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteMultiple}
                    disabled={isDeletingMultiple}
                    className={styles.contasReceberSecondaryBtn}
                  >
                    {isDeletingMultiple ? (
                      <>
                        <Loader2 className={styles.contasReceberActionIcon} />
                        Processando...
                      </>
                    ) : (
                      <>
                        Excluir selecionados ({selectedItems.size})
                      </>
                    )}
                  </Button>
                </>
              )}
              </div>
            </div>

            <div className={styles.contasReceberTableContainer}>
              <table className={styles.nativeTable}>
                <thead className={`${styles.contasReceberTableHeader} ${styles.nativeThead}`}>
                  <tr>
                    <th className={`${styles.contasReceberTableHeaderCell} ${styles.nativeTh}`}>
                      <Checkbox
                        checked={
                          selectedItems.size === paginatedTransactions.length &&
                          paginatedTransactions.length > 0
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className={`${styles.contasReceberTableHeaderText} ${styles.nativeTh}`}>
                      Venci.
                    </th>
                    <th className={`${styles.contasReceberTableHeaderText} ${styles.nativeTh}`}>
                      Rece.
                    </th>
                    <th className={`${styles.contasReceberTableHeaderText} ${styles.nativeTh}`}>
                      Descrição
                    </th>
                    <th className={`${styles.contasReceberTableHeaderText} ${styles.nativeTh}`}>
                      Total (R$)
                    </th>
                    <th className={`${styles.contasReceberTableHeaderText} ${styles.nativeTh}`}>
                      A receber
                    </th>
                    <th className={`${styles.contasReceberTableHeaderText} ${styles.nativeTh}`}>
                      Situação
                    </th>
                    <th className={`${styles.contasReceberTableHeaderText} ${styles.nativeTh}`}>
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={styles.contasReceberTableRowEmpty}>
                        <div className={styles.contasReceberEmptyState}>
                          <div className={styles.contasReceberEmptyIcon}>
                            <div className={styles.contasReceberQuestionMark}>?</div>
                          </div>
                          <p className={styles.contasReceberEmptyTitle}>Not found</p>
                          <p className={styles.contasReceberEmptyText}>Nenhuma transação encontrada</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map((entrada, index) => (
                      <tr
                        key={index}
                        className={styles.contasReceberTableRow}
                      >
                        <td className={styles.nativeTd}>
                          <Checkbox
                            checked={selectedItems.has(entrada.id)}
                            onCheckedChange={(checked) =>
                              handleSelectItem(entrada.id, checked)
                            }
                          />
                        </td>
                        <td className={`${styles.contasReceberTableCellSecondary} ${styles.nativeTd}`}>
                          {entrada.origem === "Importação OFX" && entrada.data_transacao
                            ? new Date(entrada.data_transacao).toLocaleDateString()
                            : new Date(entrada.data_vencimento).toLocaleDateString()}
                        </td>
                        <td className={`${styles.contasReceberTableCellSecondary} ${styles.nativeTd}`}>
                          {(() => {
                            // Debug: log para entender o problema
                            if (entrada.situacao === "recebido") {
                              console.log("🔍 Receita recebida:", {
                                id: entrada.id,
                                situacao: entrada.situacao,
                                data_transacao: entrada.data_transacao,
                                descricao: entrada.descricao
                              });
                            }
                            
                            return entrada.situacao === "recebido" && entrada.data_transacao
                              ? new Date(entrada.data_transacao).toLocaleDateString()
                              : entrada.situacao === "vencidos" && entrada.data_transacao
                              ? new Date(entrada.data_transacao).toLocaleDateString()
                              : <Clock className="h-4 w-4" />;
                          })()}
                        </td>
                        <td className={styles.nativeTd}>
                        <div>
                          <div>
                            <p className={styles.contasReceberTableCellPrimary}>{entrada.descricao}</p>
                            {entrada.origem === "pluggy" && (
                              <Badge className={styles.badgePluggy}>
                                Pluggy
                              </Badge>
                            )}
                            {entrada.origem === "Importação OFX" && (
                              <Badge className={styles.badgeOfx}>
                                OFX
                              </Badge>
                            )}
                            {/* Badge para transações conciliadas */}
                            {entrada.situacao === "conciliado" && (
                              <Badge className={styles.badgeConciliado}>
                                Conciliada
                              </Badge>
                            )}
                          </div>
                          <p className={styles.contasReceberTableCellSecondary}>{entrada.categoria}</p>
                          {entrada.cliente && (
                            <p className={styles.contasReceberTableCellSecondary}>{entrada.cliente}</p>
                          )}
                        </div>
                        </td>
                        <td className={`${styles.contasReceberTableCellValue} ${styles.nativeTd}`}>
                          R$ {Number(entrada.a_receber || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`${styles.contasReceberTableCellValue} ${styles.nativeTd}`}>
                          R$ {Number(entrada.a_receber || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={styles.nativeTd}>
                          <span
                            className={cn({
                              [styles.badgePago]: entrada.situacao === "recebido" || entrada.situacao === "conciliado",
                              [styles.badgeVencido]: entrada.situacao === "vencidos",
                              [styles.badgeEmAberto]: entrada.situacao === "em aberto"
                            })}
                          >
                            {entrada.situacao === "recebido"
                              ? "Pago"
                              : entrada.situacao === "conciliado"
                              ? "Pago"
                              : entrada.situacao === "vencidos"
                              ? "Vencidos"
                              : "Em Aberto"}
                          </span>
                        </td>
                        <td className={`${styles.tableCellWithDropdown} ${styles.nativeTd}`}>
                          <div className={styles.dropdownContainer}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuIndex(openMenuIndex === index ? null : index);
                              }}
                              className={`${styles.contasReceberActionBtn} ${styles.actionButton}`}
                            >
                              <MoreVertical className={styles.iconMore} />
                            </button>
                            {openMenuIndex === index && (
                              <div
                                className={`${styles.contasReceberDropdown} ${styles.dropdownMenu}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {entrada.situacao === "em aberto" && (
                                  <>
                                    <button
                                      onClick={() => {
                                        handleUpdateSituacao(entrada.id, "recebido");
                                        setOpenMenuIndex(null);
                                      }}
                                      className={`${styles.contasReceberDropdownItem} ${styles.dropdownMenuItem}`}
                                    >
                                      Marcar como Pago
                                    </button>
                                    <button
                                      onClick={() => {
                                        handleUpdateSituacao(entrada.id, "vencidos");
                                        setOpenMenuIndex(null);
                                      }}
                                      className={`${styles.contasReceberDropdownItem} ${styles.dropdownMenuItem}`}
                                    >
                                      Marcar como Vencido
                                    </button>
                                  </>
                                )}

                                {entrada.situacao === "recebido" && (
                                  <button
                                    onClick={() => {
                                      handleUpdateSituacao(entrada.id, "em aberto");
                                      setOpenMenuIndex(null);
                                    }}
                                    className={`${styles.contasReceberDropdownItem} ${styles.dropdownMenuItem}`}
                                  >
                                    Voltar para Em Aberto
                                  </button>
                                )}

                                {entrada.situacao === "vencidos" && (
                                  <>
                                    <button
                                      onClick={() => {
                                        handleUpdateSituacao(entrada.id, "em aberto");
                                        setOpenMenuIndex(null);
                                      }}
                                      className={`${styles.contasReceberDropdownItem} ${styles.dropdownMenuItem}`}
                                    >
                                      Voltar para Em Aberto
                                    </button>
                                    <button
                                      onClick={() => {
                                        handleUpdateSituacao(entrada.id, "recebido");
                                        setOpenMenuIndex(null);
                                      }}
                                      className={`${styles.contasReceberDropdownItem} ${styles.dropdownMenuItem}`}
                                    >
                                      Marcar como Pago
                                    </button>
                                  </>
                                )}

                                <button
                                  onClick={() => {
                                    handleEditReceita(entrada);
                                    setOpenMenuIndex(null);
                                  }}
                                  disabled={entrada.origem === "pluggy"}
                                  className={`${styles.contasReceberDropdownItem} ${styles.dropdownMenuItem}`}
                                >
                                  Editar Lançamento
                                  {entrada.origem === "pluggy" &&
                                    " (não disponível)"}
                                </button>

                                <button
                                  onClick={() => {
                                    handleDuplicarReceita(entrada);
                                    setOpenMenuIndex(null);
                                  }}
                                  className={`${styles.contasReceberDropdownItem} ${styles.dropdownMenuItem}`}
                                >
                                  Duplicar Lançamento
                                </button>

                                {entrada.boleto_id && (
                                  <button
                                    onClick={() => {
                                      handleDownloadBoleto(entrada.id);
                                      setOpenMenuIndex(null);
                                    }}
                                    className={`${styles.contasReceberDropdownItem} ${styles.dropdownMenuItem}`}
                                  >
                                    Baixar boleto
                                  </button>
                                )}

                                {/* Item para revogar conciliação - mostrar para transações conciliadas */}
                                {entrada.situacao === "conciliado" && (
                                  <button
                                    onClick={() => {
                                      handleRevogarConciliacao(entrada);
                                      setOpenMenuIndex(null);
                                    }}
                                    className={`${styles.contasReceberDropdownItem} ${styles.dropdownMenuItem}`}
                                  >
                                    Revogar Conciliação
                                  </button>
                                )}

                                <button
                                  className={`${styles.contasReceberDropdownItem} ${styles.dropdownMenuItem}`}
                                  onClick={() => {
                                    handleOpenDeleteModal(entrada.id, entrada.descricao, entrada.a_receber);
                                    setOpenMenuIndex(null);
                                  }}
                                >
                                  Excluir Lançamento
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

          {/* Footer with totals and pagination */}
          <div className={styles.contasReceberPagination}>
            <span className={styles.contasReceberPaginationInfo}>
              {filteredTransactions.length > 0 ? (
                <>
                  Mostrando {(currentPage - 1) * itemsPerPage + 1}
                  {" - "}
                  {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} de {filteredTransactions.length}
                </>
              ) : (
                <span className={styles.contasReceberPaginationEmpty}>
                  Nenhum registro encontrado
                </span>
              )}
            </span>
            <div className={styles.contasReceberPaginationControls}>
              <div className={styles.contasReceberPaginationButtons}>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className={styles.contasReceberPaginationSelect}
                style={{ marginRight: 16 }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <button
                className={styles.contasReceberPaginationArrow}
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1 || totalPages === 0}
                aria-label="Primeira página"
              >
                {"<<"}
              </button>
              <button
                className={styles.contasReceberPaginationArrow}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || totalPages === 0}
                aria-label="Página anterior"
              >
                {"<"}
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startPage = Math.max(1, currentPage - 2);
                return startPage + i;
              }).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={page === currentPage ? styles.contasReceberPaginationButtonActive : styles.contasReceberPaginationArrow}
                >
                  {page}
                </button>
              ))}
              <button
                className={styles.contasReceberPaginationArrow}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                aria-label="Próxima página"
              >
                {">"}
              </button>
              <button
                className={styles.contasReceberPaginationArrow}
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                aria-label="Última página"
              >
                {">>"}
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nova Receita Drawer */}
      <NovaReceitaDrawer
        isOpen={isNovaReceitaOpen}
        onClose={() => {
          setIsNovaReceitaOpen(false);
          setDadosParaDuplicacao(null); // Limpa os dados de duplicação ao fechar
          setSelectedReceita(null); // Limpa a receita selecionada ao fechar
        }}
        onSave={handleSaveReceita}
        dadosParaDuplicacao={dadosParaDuplicacao}
        transacaoId={selectedReceita?.id?.toString()}
      />

      <ExportarReceber
        isOpen={isExportarReceberOpen}
        onClose={() => setIsExportarReceberOpen(false)}
      />

      <ImportarReceber
        isOpen={isImportarReceberOpen}
        onClose={() => setIsImportarReceberOpen(false)}
        onImportSuccess={recarregarEntradas}
      />

      {/* Download Planilhas Modal */}
      <DownloadPlanilhasContasModal
        isOpen={downloadPlanilhasModal}
        onClose={() => setDownloadPlanilhasModal(false)}
      />

      {/* Importar OFX Modal */}
      <ImportarOFXModal
        isOpen={isImportarOFXOpen}
        onClose={() => setIsImportarOFXOpen(false)}
        onImportSuccess={recarregarEntradas}
        tipo="receber"
      />

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className={styles.statCard}>
          <DialogHeader>
            <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gap3} ${styles.mb4}`}>
              <div className={`${styles.w10} ${styles.h10} ${styles.rounded} ${styles.flex} ${styles.itemsCenter} ${styles.justifyCenter}`}>
                <AlertTriangle className={`${styles.w5} ${styles.h5} ${styles.textRed500}`} />
              </div>
              <DialogTitle className={`${styles.textXl} ${styles.fontBold}`}>
                Excluir lançamento
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className={styles.gap4}>
            <div className={styles.textCenter}>
              <p className={styles.mb4}>
                Tem certeza que deseja excluir o lançamento{" "}
                <span className={styles.fontSemibold}>
                  &ldquo;{entradaParaExcluir?.descricao}&rdquo;
                </span>
                {entradaParaExcluir?.valor && (
                  <>
                    {" "}no valor de{" "}
                    <span className={styles.fontSemibold}>
                      {formatBRL(entradaParaExcluir.valor)}
                    </span>
                  </>
                )}
                ?
              </p>

              <div className={`${styles.rounded} ${styles.p4}`}>
                <p className={`${styles.textRed500} ${styles.textSm} ${styles.fontMedium}`}>
                  ⚠️ Esta ação não poderá ser desfeita e todos os dados relacionados serão perdidos permanentemente.
                </p>
              </div>
            </div>

            {isDeletingEntrada && (
              <div className={`${styles.flex} ${styles.itemsCenter} ${styles.justifyCenter} ${styles.py2}`}>
                <div className={`${styles.w6} ${styles.h6} ${styles.rounded} ${styles.mr3}`}></div>
                <span>Excluindo lançamento...</span>
              </div>
            )}
          </div>

          <div className={`${styles.flex} ${styles.justifyEnd} ${styles.gap3} ${styles.mt6}`}>
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeletingEntrada}
              className={styles.contasReceberSecondaryBtn}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteEntrada}
              disabled={isDeletingEntrada}
              className={styles.contasReceberPrimaryBtn}
            >
              {isDeletingEntrada ? (
                <>
                  <div className={`${styles.w4} ${styles.h4} ${styles.rounded} ${styles.mr2}`}></div>
                  Excluindo...
                </>
              ) : (
                "Excluir Lançamento"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Revogação de Conciliação */}
      <Dialog open={isRevogacaoModalOpen} onOpenChange={setIsRevogacaoModalOpen}>
        <DialogContent className={`${styles.statCard} ${styles.maxWlg}`}>
          <DialogHeader>
            <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gap3} ${styles.mb4}`}>
              <div className={`${styles.w10} ${styles.h10} ${styles.rounded} ${styles.flex} ${styles.itemsCenter} ${styles.justifyCenter}`}>
                <AlertTriangle className={`${styles.w5} ${styles.h5} ${styles.textOrange500}`} />
              </div>
              <DialogTitle className={`${styles.textXl} ${styles.fontBold}`}>
                Revogar Conciliação
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className={styles.gap4}>
            <div className={styles.textCenter}>
              <p className={styles.mb4}>
                Você está prestes a revogar a conciliação do lançamento{" "}
                <span className={styles.fontSemibold}>
                  &ldquo;{entradaParaRevogar?.descricao}&rdquo;
                </span>
                {entradaParaRevogar?.a_receber && (
                  <>
                    {" "}no valor de{" "}
                    <span className={styles.fontSemibold}>
                      {formatBRL(entradaParaRevogar.a_receber)}
                    </span>
                  </>
                )}
                .
              </p>

              <div className={`${styles.rounded} ${styles.p4} ${styles.mb6}`}>
                <p className={`${styles.textOrange500} ${styles.textSm} ${styles.fontMedium}`}>
                  ⚠️ Após revogar a conciliação, o que você deseja fazer com esta transação?
                </p>
              </div>

              <div className={`${styles.gap3}`}>
                <p className={`${styles.textSm} ${styles.fontMedium} ${styles.mb3}`}>
                  Escolha uma das opções abaixo:
                </p>

                <Button
                  onClick={handleApenasRevogar}
                  disabled={isRevogando}
                  className={`${styles.contasReceberSecondaryBtn} ${styles.mb2}`}
                >
                  {isRevogando ? (
                    <>
                      <Loader2 className={`${styles.h4} ${styles.w4} ${styles.mr2}`} />
                      Processando...
                    </>
                  ) : (
                    <>
                      Apenas Revogar Conciliação
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleRevogarEExcluir}
                  disabled={isRevogando}
                  className={`${styles.contasReceberPrimaryBtn}`}
                >
                  {isRevogando ? (
                    <>
                      <Loader2 className={`${styles.h4} ${styles.w4} ${styles.mr2}`} />
                      Processando...
                    </>
                  ) : (
                    <>
                      Revogar e Excluir Transação
                    </>
                  )}
                </Button>
              </div>
            </div>

            {isRevogando && (
              <div className={`${styles.flex} ${styles.itemsCenter} ${styles.justifyCenter} ${styles.py2}`}>
                <div className={`${styles.w6} ${styles.h6} ${styles.rounded} ${styles.mr3}`}></div>
                <span>Revogando conciliação...</span>
              </div>
            )}
          </div>

          <div className={`${styles.flex} ${styles.justifyEnd} ${styles.gap3} ${styles.mt6}`}>
            <Button
              variant="outline"
              onClick={() => {
                setIsRevogacaoModalOpen(false);
                setEntradaParaRevogar(null);
              }}
              disabled={isRevogando}
              className={styles.contasReceberSecondaryBtn}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
