"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/financeiro/card";
import 'react-toastify/dist/ReactToastify.css';
import { Button } from "../../components/financeiro/botao";
import { Input } from "../../components/financeiro/input";
import { Badge } from "../../components/financeiro/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/financeiro/table';
import { Checkbox } from '../../components/financeiro/checkbox';
import styles from "../../styles/financeiro/contas-a-pagar.module.css";

// Função cn para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');
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
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { NovaDespesaDrawer } from "../../components/financeiro/NovaDespesaDrawer.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/financeiro/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { EditDespesaDrawer } from "../../components/financeiro/EditDespesaDrawer";
import { ExportarPagar } from "../../components/financeiro/ExportarPagar";
import { ImportarPagar } from "../../components/financeiro/ImportarPagar";
import { ImportarOFXModal } from "../../components/financeiro/ImportarOFXModal";
import { DownloadPlanilhasContasModal } from "../../components/financeiro/DownloadPlanilhasContasModal";
import { ModalConfirmarExclusaoConta } from "../../components/financeiro/ModalConfirmarExclusaoConta";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import {
  isToday,
  isAfter,
  parseISO,
  isWithinInterval,
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  format as formatDate,
} from "date-fns";
import { ptBR } from "date-fns/locale";
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
// Removido import do Lottie - usando CSS spinner
// Removido import do loader - usando CSS spinner
import { toast } from "react-toastify";
import Image from "next/image";

// Função utilitária para padronizar os dados de saída de ambas as rotas
function mapSaida(raw) {
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

  // Para transações OFX, usar data_transacao como data_vencimento quando disponível
  const isOFX = raw.origem === "Importação OFX";
  const dataVencimento = isOFX && raw.data_transacao 
    ? raw.data_transacao 
    : raw.data_vencimento || raw.date || "";

  const saida = {
    id: raw.id,
    // data_vencimento: para OFX, usa data_transacao; para outros, prioriza data_vencimento, depois date
    data_vencimento: dataVencimento,
    // data_transacao: só pega se realmente existir
    data_transacao: raw.data_transacao || "",
    descricao: raw.descricao || raw.description || "",
    a_pagar: Number(raw.valor || raw.amount || raw.a_pagar || 0),
    situacao: raw.situacao || (isPluggy ? "recebido" : "em aberto"),
    categoria: categoria,
    cliente: raw.cliente_nome_fantasia || undefined,
    origem: raw.origem || "empresa", // Usar a origem da transação ou "empresa" como padrão
    transacao_api_id: raw.transacao_api_id || null,
    conciliacao_id: raw.conciliacao_id || null,
    conciliacao_status: raw.conciliacao_status || null,
  };

  // Debug: log para transações recebidas
  if (saida.situacao === "recebido") {
    console.log("🔍 Mapeando transação recebida:", {
      id: saida.id,
      situacao: saida.situacao,
      data_transacao: saida.data_transacao,
      data_transacao_raw: raw.data_transacao,
      descricao: saida.descricao
    });
  }

  // Log para debug de conciliação
  if (raw.situacao === "conciliado" || raw.transacao_api_id) {
    console.log("🔍 Mapeando transação conciliada:", {
      id: raw.id,
      descricao: raw.descricao,
      situacao: raw.situacao,
      transacao_api_id: raw.transacao_api_id,
      conciliacao_id: raw.conciliacao_id,
      conciliacao_status: raw.conciliacao_status
    });
  }

  return saida;
}

// Função utilitária para calcular o range do período
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

export default function ContasAPagar() {
  const [isNovaDespesaOpen, setIsNovaDespesaOpen] = useState(false);
  const [isExportarOpen, setIsExportarOpen] = useState(false);
  const [isImportarOpen, setIsImportarOpen] = useState(false);
  const [isImportarOFXOpen, setIsImportarOFXOpen] = useState(false);
  const [downloadPlanilhasModal, setDownloadPlanilhasModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const API = process.env.NEXT_PUBLIC_API_URL;
  const [saidas, setSaidas] = useState([]);
  const [dadosConciliacao, setDadosConciliacao] = useState(new Map());
  const [selectedPeriod, setSelectedPeriod] = useState("Este mês");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const periodOptions = [
    "Hoje",
    "Esta semana",
    "Este mês",
    "Este ano",
    "Últimos 30 dias",
    "Últimos 12 meses",
    "Todo o período",
  ];
  const searchParams = useSearchParams();
  const router = useRouter();

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
      PAGO: "recebido",
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

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [selectedSubcategoria, setSelectedSubcategoria] = useState(subcategoria || "all");
  const [subcategoriasDisponiveis, setSubcategoriasDisponiveis] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Função para buscar dados de conciliação (usando enum "conciliado")
  const buscarDadosConciliacao = useCallback(async (saidas) => {
    try {
      const mapaConciliacao = new Map();
      
      // Para cada transação com status "conciliado", marcar como conciliada
      const transacoesConciliadas = saidas.filter(s => s.situacao === "conciliado");
      
      transacoesConciliadas.forEach(saida => {
        mapaConciliacao.set(saida.id, {
          status: "conciliada",
          transacao_api_id: saida.transacao_api_id
        });
      });
      
      setDadosConciliacao(mapaConciliacao);
      console.log("🔍 Transações conciliadas mapeadas:", mapaConciliacao);
    } catch (error) {
      console.error("Erro ao mapear conciliações:", error);
    }
  }, []);

  // Função para extrair subcategorias únicas dos dados
  const extractSubcategorias = useCallback((saidas) => {
    const subcategorias = new Set();
    
    saidas.forEach(saida => {
      if (saida.categoria) {
        // Se a categoria contém " - ", é uma subcategoria
        if (saida.categoria.includes(' - ')) {
          const subcategoria = saida.categoria.split(' - ')[1];
          if (subcategoria && subcategoria !== 'Sem categoria') {
            subcategorias.add(subcategoria);
          }
        }
      }
    });
    
    return Array.from(subcategorias).sort();
  }, []);

  // Log para debug
  console.log("Query params:", {
    rawStatus,
    rawVencimento,
    rawSubcategoria,
    rawDataInicio,
    rawDataFim,
    mappedStatus: status,
    subcategoria,
    dataInicio,
    dataFim,
  });

  const periodRange = getPeriodRange(selectedPeriod, currentMonth);



  // Aplicar filtros locais apenas se não houver filtros na URL
  const shouldApplyLocalFilters = !status && !vencimento && !subcategoria && !dataInicio && !dataFim;

  const filteredSaidas = saidas
    .filter((saida) => {
      // Se há filtros na URL, não aplicar filtros de período localmente
      if (!shouldApplyLocalFilters) return true;

      if (!periodRange.start || !periodRange.end) return true;
      // Garantir que a data seja comparada corretamente, ignorando timezone
      let vencimento;
      if (typeof saida.data_vencimento === "string") {
        vencimento = parseISO(saida.data_vencimento);
      } else {
        vencimento = new Date(saida.data_vencimento);
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
      // Log para depuração
      console.log(
        "data_vencimento:",
        saida.data_vencimento,
        "vencimento:",
        vencimento,
        "start:",
        start,
        "end:",
        end
      );
      return isWithinInterval(vencimento, { start, end });
    })
    .filter((saida) => {
      // Filtro por subcategoria (se especificado na URL)
      if (subcategoria && subcategoria !== "all") {
        if (!saida.categoria) return false;
        
        // Se a categoria contém " - ", verificar se a subcategoria corresponde
        if (saida.categoria.includes(' - ')) {
          const subcategoriaAtual = saida.categoria.split(' - ')[1];
          return subcategoriaAtual === subcategoria;
        }
        
        // Se não tem subcategoria, verificar se a categoria inteira corresponde
        return saida.categoria === subcategoria;
      }
      return true;
    })
    .filter((saida) => {
      // Filtro por período específico (se especificado na URL)
      if (dataInicio && dataFim) {
        const vencimento = typeof saida.data_vencimento === "string" 
          ? parseISO(saida.data_vencimento) 
          : new Date(saida.data_vencimento);
        
        const inicio = parseISO(dataInicio);
        const fim = parseISO(dataFim);
        
        return isWithinInterval(vencimento, { start: inicio, end: fim });
      }
      return true;
    })
    .filter((saida) => {
      // Filtro local por subcategoria (se não há filtros na URL)
      if (shouldApplyLocalFilters && selectedSubcategoria !== "all") {
        if (!saida.categoria) return false;
        
        // Se a categoria contém " - ", verificar se a subcategoria corresponde
        if (saida.categoria.includes(' - ')) {
          const subcategoriaAtual = saida.categoria.split(' - ')[1];
          return subcategoriaAtual === selectedSubcategoria;
        }
        
        // Se não tem subcategoria, verificar se a categoria inteira corresponde
        return saida.categoria === selectedSubcategoria;
      }
      return true;
    })
         .filter((saida) => {
       // Aplicar filtro de busca sempre, independente de filtros na URL
       if (!searchTerm.trim()) return true;

      const searchLower = searchTerm.toLowerCase();
      
      // Busca por descrição
      const matchesDescription = saida.descricao
        .toLowerCase()
        .includes(searchLower);
      
      // Busca por categoria
      const matchesCategory = saida.categoria
        ?.toLowerCase()
        .includes(searchLower) || false;
      
      // Busca por cliente
      const matchesClient = saida.cliente
        ?.toLowerCase()
        .includes(searchLower) || false;

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
          const saidaValue = Number(saida.a_pagar || 0);
          // Busca exata ou aproximada (com tolerância de 0.01 para diferenças de arredondamento)
          matchesValue = Math.abs(saidaValue - searchValue) < 0.01;
        }
      }
      
      // Busca por valor sem formatação (apenas números)
      if (!matchesValue && /^\d+([.,]\d+)?$/.test(searchLower)) {
        const cleanSearch = searchLower.replace(',', '.');
        const searchValue = parseFloat(cleanSearch);
        
        if (!isNaN(searchValue)) {
          const saidaValue = Number(saida.a_pagar || 0);
          matchesValue = Math.abs(saidaValue - searchValue) < 0.01;
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
      
      const matchesDate = formatDateForSearch(saida.data_vencimento || "").includes(searchTerm) ||
                         (saida.data_transacao ? formatDateForSearch(saida.data_transacao).includes(searchTerm) : false);

      return matchesDescription || matchesCategory || matchesClient || matchesValue || matchesDate;
    });

  // Cálculo dos totais filtrados
  const hoje = new Date();
  const vencidos = filteredSaidas
    .filter((e) => e.situacao === "vencidos")
    .reduce((acc, e) => acc + Number(e.a_pagar || 0), 0);
  const pagos = filteredSaidas
    .filter((e) => e.situacao === "recebido")
    .reduce((acc, e) => acc + Number(e.a_pagar || 0), 0);
      const vencemHoje = filteredSaidas
    .filter((e) => {
      const dataVenc =
        typeof e.data_vencimento === "string"
          ? parseISO(e.data_vencimento)
          : new Date(e.data_vencimento);
      return isToday(dataVenc) && e.situacao === "em aberto";
    })
    .reduce((acc, e) => acc + Number(e.a_pagar || 0), 0);
  const aVencer = filteredSaidas
    .filter((e) => {
      const dataVenc =
        typeof e.data_vencimento === "string"
          ? parseISO(e.data_vencimento)
          : new Date(e.data_vencimento);
      return isAfter(dataVenc, hoje) && e.situacao === "em aberto";
    })
    .reduce((acc, e) => acc + Number(e.a_pagar || 0), 0);
  const totalPeriodo = filteredSaidas.reduce(
    (acc, e) => acc + Number(e.a_pagar || 0),
    0
  );

  const stats = [
    {
      title: "Vencidos (R$)",
      value: `R$ ${vencidos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: TrendingDown,
      color: "stat-vencidos",
    },
    {
      title: "Vencem hoje (R$)",
      value: `R$ ${vencemHoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: Clock,
      color: "stat-vencem-hoje",
    },
    {
      title: "A vencer (R$)",
      value: `R$ ${aVencer.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: Calendar,
      color: "stat-a-vencer",
    },
    {
      title: "Pagos (R$)",
      value: `R$ ${pagos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: "stat-pagos",
    },
    {
      title: "Total do período (R$)",
      value: `R$ ${totalPeriodo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "stat-total",
    },
  ];

  const transactions = [
    // {
    //   vencimento: '02/06/2025',
    //   pagamento: '02/06/2025',
    //   descricao: '57/60 - Agerio - Deposit...',
    //   detalhe: '3.1.01 Pagam...  BWA RIO',
    //   total: '1.619,02',
    //   aPagar: '0,00',
    //   situacao: 'Pago',
    //   status: 'paid'
    // },
    // {
    //   vencimento: '02/06/2025',
    //   pagamento: '02/06/2025',
    //   descricao: '41/50 - Consultoria Juríd...',
    //   detalhe: '2.3.08 Consult...  Leno Ferreira',
    //   total: '750,00',
    //   aPagar: '0,00',
    //   situacao: 'Pago',
    //   status: 'paid'
    // },
    // {
    //   vencimento: '02/06/2025',
    //   pagamento: '02/06/2025',
    //   descricao: '33/99 - Marketing de con...',
    //   detalhe: '2.4.21 Marketi...  Fabio Guedes',
    //   total: '2.800,00',
    //   aPagar: '0,00',
    //   situacao: 'Pago',
    //   status: 'paid'
    // }
  ];

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

  const handleNovaDespesa = () => {
    setIsNovaDespesaOpen(true);
  };

  const handleExportar = () => {
    setIsExportarOpen(true);
  };

  const handleImportar = () => {
    setIsImportarOpen(true);
  };

  const handleImportarOFX = () => {
    setIsImportarOFXOpen(true);
  };

  // Função para limpar filtros da URL
  const clearFilters = () => {
    router.push("/financeiro/contas-a-pagar");
  };

  // Verificar se há filtros ativos
  const hasActiveFilters = status || vencimento || subcategoria || dataInicio || dataFim;

  const totalPages = Math.ceil(filteredSaidas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSaidas = filteredSaidas.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handleSaveDespesa = async (data) => {
    console.log("Salvando nova despesa:", data);
    // Recarrega os dados para incluir a nova despesa
    await recarregarSaidas();
    // Toast de confirmação
    toast.success("Nova despesa criada com sucesso!");
  };

  // Função para recarregar os dados das saídas (empresa + transacoes-api/accountId/saidas)

  const recarregarSaidas = useCallback(async () => {
    let empresaId = localStorage.getItem("empresaId");
    // Se não encontrou empresaId diretamente, buscar do userData
    if (!empresaId) {
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      empresaId = userData.EmpresaId || null;
    }
    const token = localStorage.getItem("token");
    if (!empresaId || !token || !API) return;

    let url = `${API}/financeiro/transacoes/empresa/${empresaId}/saidas`;
    const queryParams = [];
    if (status) queryParams.push(`status=${status}`);
    if (vencimento) queryParams.push(`vencimento=${vencimento}`);
    if (queryParams.length > 0) {
      url += `?${queryParams.join("&")}`;
    }

    setIsLoading(true);
    try {
      const resEmpresa = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dataEmpresa = resEmpresa.ok ? await resEmpresa.json() : [];
      
      console.log("🔍 DADOS BRUTOS DA API (primeiras 3 transações):", JSON.stringify(dataEmpresa.slice(0, 3), null, 2));
      
      const saidasMapeadas = dataEmpresa.map(mapSaida);
      
      // Log específico para transações conciliadas
      const transacoesConciliadas = saidasMapeadas.filter(s => s.situacao === "conciliado");
      if (transacoesConciliadas.length > 0) {
        console.log("🔍 TRANSAÇÕES CONCILIADAS ENCONTRADAS:", JSON.stringify(transacoesConciliadas, null, 2));
      }
      
      setSaidas(saidasMapeadas);
      
      // Extrair subcategorias disponíveis
      const subcategorias = extractSubcategorias(saidasMapeadas);
      setSubcategoriasDisponiveis(subcategorias);
      
      // Buscar dados de conciliação usando a mesma lógica da revogação
      await buscarDadosConciliacao(saidasMapeadas);
    } catch (error) {
      setSaidas([]);
    } finally {
      setIsLoading(false);
    }
  }, [API, status, vencimento, buscarDadosConciliacao, extractSubcategorias]);

  // Função para lidar com a edição de despesa
  const handleSaveDespesaEditada = async (data) => {
    console.log("Despesa editada:", data);
    // Recarrega os dados para refletir as mudanças
    await recarregarSaidas();
    // Toast de confirmação
    toast.success("Despesa atualizada com sucesso!");
  };

  useEffect(() => {
    let empresaId = localStorage.getItem("empresaId");
    // Se não encontrou empresaId diretamente, buscar do userData
    if (!empresaId) {
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      empresaId = userData.EmpresaId || null;
    }
    const token = localStorage.getItem("token");

    if (!empresaId || !token) {
      console.error("EmpresaId ou Token não encontrados no localStorage");
      setIsLoading(false);
      return;
    }

    const fetchSaidas = async () => {
      try {
        setIsLoading(true);

        await recarregarSaidas();
      } catch (error) {
        console.error("Erro ao buscar saídas:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSaidas();
  }, [API, status, vencimento, recarregarSaidas]);



  const handleUpdateSituacao = async (id, novaSituacao) => {
    console.log("Enviando atualização de situação:", { id, novaSituacao }); // Log para depuração
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
      
      console.log("Body enviado para atualização de situação:", body); // <-- Log para depuração
      const response = await fetch(`${API}/financeiro/transacoes/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Erro ao atualizar situação");

      // Atualizar apenas o item específico no estado local
      setSaidas(prevSaidas => 
        prevSaidas.map(saida => 
          saida.id === id 
            ? {
                ...saida,
                situacao: novaSituacao,
                data_transacao: novaSituacao === "recebido" 
                  ? formatDate(new Date(), "yyyy-MM-dd")
                  : novaSituacao === "vencidos" && saida.data_transacao
                  ? saida.data_transacao // Manter data_transacao se já existir para vencidos
                  : "" // Limpar data_transacao para em aberto
              }
            : saida
        )
      );

      toast.success("Situação atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar situação:", error);
      toast.error("Erro ao atualizar situação. Tente novamente.");
    }
  };

  // Função para abrir modal de confirmação de exclusão
  const handleConfirmarExclusao = (saida) => {
    setSaidaParaExcluir(saida);
    setIsConfirmacaoExclusaoOpen(true);
  };

  // Função para executar a exclusão
  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const saida = saidas.find(s => s.id === id);
      
      let response;
      if (saida?.origem === "pluggy") {
        // Para transações Pluggy, usar a rota pluggy
        response = await fetch(`${API}/transacoes-api/pluggy/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } else if (saida?.origem === "Importação OFX") {
        // Para transações OFX, usar a rota transacoes (mesmo que empresa)
        response = await fetch(`${API}/financeiro/transacoes/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } else {
        // Para transações da empresa, usar a rota transacoes
        response = await fetch(`${API}/financeiro/transacoes/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      if (!response.ok) throw new Error("Erro ao excluir lançamento");

      // Remover apenas o item específico do estado local
      setSaidas(prevSaidas => prevSaidas.filter(saida => saida.id !== id));
      
      // Toast de confirmação
      toast.success("Lançamento excluído com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir lançamento:", error);
      toast.error("Erro ao excluir lançamento. Tente novamente.");
    }
  };

  // Função para confirmar exclusão (chamada pelo modal)
  const handleConfirmarExclusaoExecucao = async () => {
    if (!saidaParaExcluir) return;

    try {
      setIsExcluindo(true);
      await handleDelete(saidaParaExcluir.id);
      
      // Fechar modal
      setIsConfirmacaoExclusaoOpen(false);
      setSaidaParaExcluir(null);
    } catch (error) {
      console.error("Erro ao excluir:", error);
    } finally {
      setIsExcluindo(false);
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
      await recarregarSaidas();
      
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
      const allIds = paginatedSaidas.map(saida => saida.id);
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
        const saida = saidas.find(s => s.id === id);
        
        let response;
        if (saida?.origem === "pluggy") {
          response = await fetch(`${API}/transacoes-api/pluggy/${id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } else if (saida?.origem === "Importação OFX") {
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
      setSaidas(prevSaidas => 
        prevSaidas.filter(saida => !selectedItems.has(saida.id))
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

  const [isEditDespesaOpen, setIsEditDespesaOpen] = useState(false);
  const [despesaSelecionada, setDespesaSelecionada] = useState(null);
  const [dadosParaDuplicacao, setDadosParaDuplicacao] = useState(null);

  // Função para duplicar despesa
  const handleDuplicarDespesa = async (saida) => {
    console.log("🔄 Duplicando despesa:", saida);
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Token não encontrado");
        return;
      }

      // Busca os dados completos da transação via GET
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/transacoes/${saida.id}`, {
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

      // Abre o drawer de nova despesa
      setIsNovaDespesaOpen(true);
      
      // Passa os dados completos para preencher o formulário
      setDadosParaDuplicacao({
        descricao: data.descricao || "",
        valor: data.valor || 0,
        categoria: data.sub_categoria_id ? data.sub_categoria_id.toString() : data.categoria_id?.toString() || "",
        contaPagamento: data.conta_id ? `erp:${data.conta_id}` : data.conta_api_id ? `api:${data.conta_api_id}` : "",
        cliente: data.cliente_id?.toString() || "",
        vencimento: data.data_vencimento ? new Date(data.data_vencimento) : new Date(),
        origem: data.origem || "",
        observacoes: data.observacoes || "",
        centroCusto: data.centro_de_custo_id?.toString() || "",
        // Campos específicos para duplicação
        duplicacao: {
          pago: false, // Sempre começar como não pago
          dataPagamento: null,
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
      console.error("Erro ao duplicar despesa:", error);
      toast.error("Erro ao carregar dados para duplicação");
    }
  };

  // Estados para seleção múltipla
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);

  // Estados para modal de revogação de conciliação
  const [isRevogacaoModalOpen, setIsRevogacaoModalOpen] = useState(false);
  const [saidaParaRevogar, setSaidaParaRevogar] = useState(null);
  const [isRevogando, setIsRevogando] = useState(false);

  // Estados para modal de confirmação de exclusão
  const [isConfirmacaoExclusaoOpen, setIsConfirmacaoExclusaoOpen] = useState(false);
  const [saidaParaExcluir, setSaidaParaExcluir] = useState(null);
  const [isExcluindo, setIsExcluindo] = useState(false);

  const clearSelection = () => {
    setSelectedItems(new Set());
    setSelectAll(false);
  };

  // Função para buscar o transacao_api_id correto automaticamente
  const buscarTransacaoApiIdCorreto = async (saida, token) => {
    try {
      let empresaId = localStorage.getItem("empresaId");
      // Se não encontrou empresaId diretamente, buscar do userData
      if (!empresaId) {
        const userData = JSON.parse(localStorage.getItem("userData") || "{}");
        empresaId = userData.EmpresaId || null;
      }
      if (!empresaId) return null;

      console.log("🔍 Buscando transacao_api_id para:", {
        descricao: saida.descricao,
        valor: saida.a_pagar,
        id: saida.id
      });

      // Buscar todas as contas API da empresa
      const contasApiRes = await fetch(`${API}/contas-api/company/${empresaId}/contas`, {
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

          const transacoesApiRes = await fetch(`${API}/transacoes-api/${contaId}`, {
            headers: { Authorization: `Bearer ${token}` },
            redirect: 'follow' // Seguir redirects automaticamente
          });

          console.log(`🔍 Status da requisição para conta ${contaId}:`, transacoesApiRes.status, transacoesApiRes.statusText);

          if (transacoesApiRes.ok) {
            const transacoesData = await transacoesApiRes.json();
            const transacoes = transacoesData.transactions || [];

            console.log(`🔍 Transações da conta ${contaId}:`, transacoes.length);
            console.log(`🔍 Dados das transações:`, transacoes.slice(0, 3)); // Log das primeiras 3 transações para debug

            // Procurar transação com valor e descrição similar
            const transacaoSimilar = transacoes.find((tx) => {
              const valorSimilar = Math.abs(parseFloat(tx.amount) - saida.a_pagar) < 0.01;
              const descricaoSimilar = tx.description && saida.descricao && 
                (tx.description.toLowerCase().includes(saida.descricao.toLowerCase()) ||
                 saida.descricao.toLowerCase().includes(tx.description.toLowerCase()) ||
                 // Buscar por palavras-chave comuns
                 saida.descricao.toLowerCase().split(' ').some(palavra => 
                   palavra.length > 3 && tx.description.toLowerCase().includes(palavra)
                 ));

              if (valorSimilar && descricaoSimilar) {
                console.log("🎯 Correspondência encontrada:", {
                  transacaoApi: { id: tx.id, amount: tx.amount, description: tx.description },
                  transacao: { id: saida.id, valor: saida.a_pagar, descricao: saida.descricao }
                });
              }

              return valorSimilar && descricaoSimilar;
            });

            if (transacaoSimilar) {
              console.log("✅ Transacao_api_id encontrado:", transacaoSimilar.id);
              return transacaoSimilar.id;
            }
          } else {
            console.log(`⚠️ Requisição falhou para conta ${contaId}:`, transacoesApiRes.status, transacoesApiRes.statusText);
            // Tentar ler o corpo da resposta para mais detalhes
            try {
              const errorText = await transacoesApiRes.text();
              console.log(`⚠️ Detalhes do erro:`, errorText);
            } catch (e) {
              console.log(`⚠️ Não foi possível ler o corpo da resposta de erro`);
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
  const handleRevogarConciliacao = (saida) => {
    setSaidaParaRevogar(saida);
    setIsRevogacaoModalOpen(true);
  };

  // Função para executar a revogação de conciliação (lógica original)
  const executarRevogacaoConciliacao = async (saida) => {
    console.log("🔄 Iniciando revogação para saída:", saida);
    
    try {
      const token = localStorage.getItem("token");
      const userData = localStorage.getItem("userData");
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || null;
      
      if (!token) {
        toast.error("Token não encontrado. Faça login novamente.");
        return false;
      }

      let transacaoApiId = saida.transacao_api_id;
      
      console.log("🔍 Dados da saída para revogação:", {
        id: saida.id,
        descricao: saida.descricao,
        transacao_api_id: saida.transacao_api_id,
        conciliacao_id: saida.conciliacao_id,
        conciliacao_status: saida.conciliacao_status
      });
      
      // Se não tiver transacao_api_id, buscar automaticamente
      if (!transacaoApiId) {
        console.log("🔍 Transacao_api_id não encontrado, buscando automaticamente...");
        
        // Buscar o transacao_api_id correto baseado no valor e descrição
        transacaoApiId = await buscarTransacaoApiIdCorreto(saida, token);
        
        if (!transacaoApiId) {
          // Se não conseguir encontrar automaticamente, pedir ao usuário
          const userInput = prompt(
            `Não foi possível encontrar automaticamente o ID da transação da API.\n\n` +
            `Para revogar a conciliação da transação:\n` +
            `• Descrição: "${saida.descricao}"\n` +
            `• Valor: R$ ${saida.a_pagar}\n\n` +
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
        transacao_id: saida.id,
        usuario_id: userId
      });

      const response = await fetch(`${API}/conciliacoes/revogar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transacao_api_id: transacaoApiId,
          transacao_id: saida.id,
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
    if (!saidaParaRevogar) return;

    try {
      setIsRevogando(true);
      
      // Primeiro revogar a conciliação
      const revogacaoSucesso = await executarRevogacaoConciliacao(saidaParaRevogar);
      
      if (revogacaoSucesso) {
        // Se a revogação foi bem-sucedida, excluir a transação
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Token não encontrado");
        }

        // Buscar a saída para verificar a origem
        const saida = saidas.find(s => s.id === saidaParaRevogar.id);
        
        let response;
        if (saida?.origem === "pluggy") {
          // Para transações Pluggy, usar a rota pluggy
          response = await fetch(`${API}/transacoes-api/pluggy/${saidaParaRevogar.id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } else if (saida?.origem === "Importação OFX") {
          // Para transações OFX, usar a rota transacoes
          response = await fetch(`${API}/financeiro/transacoes/${saidaParaRevogar.id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } else {
          // Para transações da empresa, usar a rota transacoes
          response = await fetch(`${API}/financeiro/transacoes/${saidaParaRevogar.id}`, {
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

        toast.success(`Conciliação revogada e lançamento "${saidaParaRevogar.descricao}" excluído com sucesso!`);
        
        // Remover a transação do estado local
        setSaidas(prevSaidas => 
          prevSaidas.filter(saida => saida.id !== saidaParaRevogar.id)
        );
        
        // Fechar modal
        setIsRevogacaoModalOpen(false);
        setSaidaParaRevogar(null);
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
    if (!saidaParaRevogar) return;

    try {
      setIsRevogando(true);
      
      // Revogar a conciliação
      const revogacaoSucesso = await executarRevogacaoConciliacao(saidaParaRevogar);
      
      if (revogacaoSucesso) {
        toast.success("Conciliação revogada com sucesso!");
        
        // Atualizar apenas a transação específica no estado local
        setSaidas(prevSaidas => 
          prevSaidas.map(saida => 
            saida.id === saidaParaRevogar.id 
              ? { ...saida, situacao: "em aberto" }
              : saida
          )
        );
        
        // Fechar modal de revogação
        setIsRevogacaoModalOpen(false);
        setSaidaParaRevogar(null);
      }
      
    } catch (error) {
      console.error("❌ Erro ao revogar conciliação:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao revogar conciliação";
      toast.error(errorMessage);
    } finally {
      setIsRevogando(false);
    }
  };

  // Sincronizar estado selectAll com seleções individuais
  useEffect(() => {
    if (paginatedSaidas.length === 0) {
      setSelectAll(false);
      return;
    }
    
    const allSelected = paginatedSaidas.every(saida => selectedItems.has(saida.id));
    const someSelected = paginatedSaidas.some(saida => selectedItems.has(saida.id));
    
    if (allSelected) {
      setSelectAll(true);
    } else if (someSelected) {
      setSelectAll(false);
    }
  }, [selectedItems, paginatedSaidas]);

  // Limpar seleções quando mudar de página ou filtros
  useEffect(() => {
    clearSelection();
  }, [currentPage, searchTerm, selectedPeriod, currentMonth, status, vencimento, subcategoria, dataInicio, dataFim]);

  // Componente de Loading
  const LoadingState = () => (
    <div className={styles.contasPagarLoadingContainer}>
      <div className={styles.contasPagarLoadingContent}>
        <div className={styles.contasPagarLoadingSpinner}>
          <div className={styles.contasPagarLoadingSpinnerInner}></div>
        </div>
        <p className={styles.contasPagarLoadingText}>Carregando contas a pagar...</p>
      </div>
    </div>
  );

  // Se estiver carregando, mostra o estado de loading
  if (isLoading) {
    return (
      <div className={styles.contasPagarContainer}>
        {/* Header */}
        <div className={styles.contasPagarHeader}>
          <div className={styles.contasPagarHeaderLeft}>
            <h1 className={styles.contasPagarTitle}>Contas a pagar</h1>
            <p className={styles.contasPagarSubtitle}>
              Gerencie suas contas a pagar e fluxo de caixa
            </p>
          </div>
          <div className={styles.contasPagarHeaderRight}>
            <Button
              variant="outline"
              size="sm"
              disabled
              className={styles.contasPagarSecondaryBtn}
            >
              <Download className={styles.contasPagarActionIcon} />
              Exportar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled
              className={styles.contasPagarSecondaryBtn}
            >
              <Upload className={styles.contasPagarActionIcon} />
              Importar planilha
            </Button>
            <Button
              size="sm"
              disabled
              className={styles.contasPagarPrimaryBtn}
            >
              <Plus className={styles.contasPagarActionIcon} />
              Nova despesa
            </Button>
          </div>
        </div>

        {/* Loading State */}
        <Card className={styles.contasPagarTransactionsCard}>
          <CardContent className={styles.contasPagarTableContent}>
            <LoadingState />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.contasPagarContainer}>
      {/* Header */}
      <div className={styles.contasPagarHeader}>
        <div className={styles.contasPagarHeaderLeft}>
          <h1 className={styles.contasPagarTitle}>Contas a pagar</h1>
          <p className={styles.contasPagarSubtitle}>
            Gerencie suas contas a pagar e fluxo de caixa
          </p>
        </div>
        <div className={styles.contasPagarHeaderRight}>
          <div className={styles.contasPagarActionContainer}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportar}
              className={styles.contasPagarExportBtn}
            >
              <Download className={styles.contasPagarActionIcon} />
              Exportar
            </Button>
          </div>
          <div className={styles.contasPagarActionContainer}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportar}
              className={styles.contasPagarImportBtn}
            >
              <Upload className={styles.contasPagarActionIcon} />
              Importar planilha
            </Button>
          </div>
          <div className={styles.contasPagarActionContainer}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportarOFX}
              className={styles.contasPagarOfxBtn}
            >
              <FileText className={styles.contasPagarActionIcon} />
              Importar OFX
            </Button>
          </div>
          <div className={styles.contasPagarActionContainer}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDownloadPlanilhasModal(true)}
              className={styles.contasPagarSecondaryBtn}
            >
              <FileText className={styles.contasPagarActionIcon} />
              Planilhas
            </Button>
          </div>
          <Button
            size="sm"
            onClick={handleNovaDespesa}
            className={styles.contasPagarPrimaryBtn}
          >
            <Plus className={styles.contasPagarActionIcon} />
            Nova despesa
          </Button>
        </div>
      </div>

      {/* Success Alert */}
      {/* <Card className="border-[#1E88E5]/20 bg-[#1E88E5]/10">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-[#1E88E5] rounded flex items-center justify-center">
              <div className="h-2 w-2 bg-white rounded"></div>
            </div>
            <div>
              <h3 className="font-medium text-white">Carregamento concluído</h3>
              <p className="text-[#B0AFC1] text-sm">
                A planilha foi carregada. Agora só falta você revisar os dados
                para finalizar a importação.
              </p>
              <Button
                variant="link"
                className="text-[#1E88E5] p-0 h-auto font-normal text-sm hover:text-[#9C27B0]"
              >
                Ver importação
              </Button>
            </div>
          </div>
        </CardContent>
      </Card> */}

      {/* Stats Cards */}
      <div className={styles.contasPagarStatsGrid}>
        {stats.map((stat, index) => (
          <Card
            key={index}
            className={styles.contasPagarStatCard}
          >
            <CardContent className={styles.contasPagarStatCardContent}>
              <div className={styles.contasPagarStatCardInner}>
                <div className={styles.contasPagarStatCardInfo}>
                  <p className={styles.contasPagarStatCardTitle}>
                    {stat.title}
                  </p>
                  <p className={cn(styles.contasPagarStatCardValue, styles[stat.color])}>
                    {stat.value}
                  </p>
                  <p className={cn(styles.contasPagarStatCardAmount, styles[stat.color])}>
                    {stat.amount}
                  </p>
                </div>
                <stat.icon className={cn(styles.contasPagarStatCardIcon, styles[stat.color])} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Indicador de Filtros Ativos */}
      {hasActiveFilters && (
        <Card className={styles.filtrosAtivosCard}>
          <CardContent className="pt-4">
            <div className={styles.filtrosAtivosContainer}>
              <div className={styles.filtrosAtivosLeft}>
                <Filter className={styles.filtrosAtivosIcon} />
                <span className={styles.filtrosAtivosText}>
                  Filtros ativos:
                </span>
                {status && (
                  <Badge
                    variant="secondary"
                    className={styles.filtrosAtivosBadge}
                  >
                    Status: {rawStatus}
                  </Badge>
                )}
                {vencimento && (
                  <Badge
                    variant="secondary"
                    className={styles.filtrosAtivosBadge}
                  >
                    Vencimento: {vencimento}
                  </Badge>
                )}
                {subcategoria && (
                  <Badge
                    variant="secondary"
                    className={styles.filtrosAtivosBadge}
                  >
                    Subcategoria: {subcategoria}
                  </Badge>
                )}
                {dataInicio && dataFim && (
                  <Badge
                    variant="secondary"
                    className={styles.filtrosAtivosBadge}
                  >
                    Período: {dataInicio} a {dataFim}
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className={styles.contasPagarSecondaryBtn}
              >
                Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className={styles.contasPagarFiltersCard}>
        <CardContent className="pt-6">
          <div className={styles.contasPagarFiltersContainer}>
            <div className={styles.contasPagarFilterRow}>
              <div className={styles.contasPagarFilterGroup}>
                <label className={styles.contasPagarFilterLabel}>
                  Vencimento
                </label>
                <div className={styles.contasPagarPeriodContainer}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth("prev")}
                    className={styles.contasPagarNavBtn}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Select
                    value={selectedPeriod}
                    onValueChange={handlePeriodChange}
                  >
                    <SelectTrigger className="min-w-[150px] theme-input">
                      <SelectValue>
                        {selectedPeriod === "Este mês" 
                          ? format(currentMonth, "MMMM/yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())
                          : selectedPeriod
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="theme-modal theme-border-secondary">
                      {periodOptions.map((option) => (
                        <SelectItem
                          key={option}
                          value={option}
                          className="theme-text-white hover:bg-[#673AB7]/20"
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
                    className={styles.contasPagarNavBtn}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className={styles.contasPagarFilterGroup}>
                <label className={styles.contasPagarFilterLabel}>
                  Pesquisar no período selecionado
                </label>
                <div className={styles.contasPagarSearchContainer}>
                  <Search className={styles.contasPagarSearchIcon} />
                  <Input
                    placeholder="Pesquisar por descrição, categoria, cliente, valor (R$ 1.500,00) ou data (11/08/2025, 11/8/25)"
                    className={styles.contasPagarSearchInput}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.contasPagarFilterGroup}>
                <label className={styles.contasPagarFilterLabel}>
                  Conta
                </label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className={styles.contasPagarSelect}
                  disabled
                >
                  <option value="all">Selecionar todas</option>
                  <option value="bradesco">Banco Bradesco</option>
                  <option value="conta-azul">Conta Azul</option>
                </select>
              </div>
              <div className={styles.contasPagarFilterGroup}>
                <label className={styles.contasPagarFilterLabel}>
                  Subcategoria
                </label>
                <select
                  value={selectedSubcategoria}
                  onChange={(e) => setSelectedSubcategoria(e.target.value)}
                  className={styles.contasPagarSelect}
                >
                  <option value="all">Todas as subcategorias</option>
                  {subcategoriasDisponiveis.map((subcategoria) => (
                    <option key={subcategoria} value={subcategoria}>
                      {subcategoria}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                
                
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className={styles.contasPagarTransactionsCard}>
        <CardContent className={styles.contasPagarTableContent}>
          <div className={styles.contasPagarTableContainer}>
            <div className={styles.contasPagarPaginationControls}>
             
                {selectedItems.size > 0 && (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={styles.contasPagarSecondaryBtn}
                        >
                          Alterar Status
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className={styles.contasPagarDropdown}>
                        <DropdownMenuItem 
                          onClick={() => handleBatchStatusChange('recebido')}
                          className={styles.contasPagarDropdownItem}
                        >
                          Marcar como Pago
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleBatchStatusChange('em aberto')}
                          className={styles.contasPagarDropdownItem}
                        >
                          Marcar como Em Aberto
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleBatchStatusChange('vencidos')}
                          className={styles.contasPagarDropdownItem}
                        >
                          Marcar como Vencido
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className={styles.contasPagarSecondaryBtn}
                  >
                    Renegociar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                    className={styles.contasPagarSecondaryBtn}
                  >
                    Limpar seleção
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteMultiple}
                    disabled={isDeletingMultiple}
                    className={styles.contasPagarSecondaryBtn}
                  >
                    {isDeletingMultiple ? (
                      <>
                        <Loader2 className={styles.contasPagarActionIcon} />
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

            <div className={styles.contasPagarTableContainer}>
              <Table>
                <TableHeader className={styles.contasPagarTableHeader}>
                  <TableRow>
                    <TableHead className={styles.contasPagarTableHeaderCell}>
                      <Checkbox
                        checked={
                          selectedItems.size === paginatedSaidas.length &&
                          paginatedSaidas.length > 0
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className={styles.contasPagarTableHeaderText}>
                      Venci.
                    </TableHead>
                    <TableHead className={styles.contasPagarTableHeaderText}>
                      Paga.
                    </TableHead>
                    <TableHead className={styles.contasPagarTableHeaderText}>
                      Descrição
                    </TableHead>
                    <TableHead className={styles.contasPagarTableHeaderText}>
                      Total (R$)
                    </TableHead>
                    <TableHead className={styles.contasPagarTableHeaderText}>
                      A pagar
                    </TableHead>
                    <TableHead className={styles.contasPagarTableHeaderText}>
                      Situação
                    </TableHead>
                    <TableHead className={styles.contasPagarTableHeaderText}>
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSaidas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className={styles.contasPagarTableRowEmpty}>
                        <div className={styles.contasPagarTableRowEmptyText}>
                          Nenhuma transação encontrada
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedSaidas.map((saida, index) => (
                      <TableRow
                        key={index}
                        className={styles.contasPagarTableRow}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedItems.has(saida.id)}
                            onCheckedChange={(checked) =>
                              handleSelectItem(saida.id, checked)
                            }
                          />
                        </TableCell>
                        <TableCell className={styles.contasPagarTableCellSecondary}>
                          {saida.origem === "Importação OFX" && saida.data_transacao
                            ? new Date(saida.data_transacao).toLocaleDateString()
                            : new Date(saida.data_vencimento).toLocaleDateString()}
                        </TableCell>
                        <TableCell className={styles.contasPagarTableCellSecondary}>
                          {(() => {
                            // Debug: log para entender o problema
                            if (saida.situacao === "recebido") {
                              console.log("🔍 Despesa recebida:", {
                                id: saida.id,
                                situacao: saida.situacao,
                                data_transacao: saida.data_transacao,
                                descricao: saida.descricao
                              });
                            }
                            
                            return saida.situacao === "recebido" && saida.data_transacao
                              ? new Date(saida.data_transacao).toLocaleDateString()
                              : saida.situacao === "vencidos" && saida.data_transacao
                              ? new Date(saida.data_transacao).toLocaleDateString()
                              : <Clock className="h-4 w-4" />;
                          })()}
                        </TableCell>
                        <TableCell>
                        <div>
                          <div>
                            <p className={styles.contasPagarTableCellPrimary}>{saida.descricao}</p>
                            {saida.origem === "pluggy" && (
                              <Badge className={styles.badgePluggy}>
                                Pluggy
                              </Badge>
                            )}
                            {saida.origem === "Importação OFX" && (
                              <Badge className={styles.badgeOfx}>
                                OFX
                              </Badge>
                            )}
                            {/* Badge para transações conciliadas */}
                            {saida.situacao === "conciliado" && (
                              <Badge className={styles.badgeConciliado}>
                                Conciliada
                              </Badge>
                            )}
                          </div>
                          <p className={styles.contasPagarTableCellSecondary}>{saida.categoria}</p>
                          {saida.cliente && (
                            <p className={styles.contasPagarTableCellSecondary}>{saida.cliente}</p>
                          )}
                        </div>
                        </TableCell>
                        <TableCell className={styles.contasPagarTableCellValue}>
                          R$ {Number(saida.a_pagar || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className={styles.contasPagarTableCellValue}>
                          R$ {Number(saida.a_pagar || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn({
                              [styles.badgePago]: saida.situacao === "recebido" || saida.situacao === "conciliado",
                              [styles.badgeVencido]: saida.situacao === "vencidos",
                              [styles.badgeEmAberto]: saida.situacao === "em aberto"
                            })}
                          >
                            {saida.situacao === "recebido"
                              ? "Pago"
                              : saida.situacao === "conciliado"
                              ? "Pago"
                              : saida.situacao === "vencidos"
                              ? "Vencidos"
                              : "Em Aberto"}
                          </span>
                        </TableCell>
                        <TableCell className={styles.contasPagarTableCellActions}>
                          <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={styles.contasPagarActionBtn}
                              >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className={styles.contasPagarDropdown}>
                            {saida.situacao === "em aberto" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleUpdateSituacao(saida.id, "recebido")
                                  }
                                  className={styles.contasPagarDropdownItem}
                                >
                                  Marcar como Pago
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleUpdateSituacao(saida.id, "vencidos")
                                  }
                                  className={styles.contasPagarDropdownItem}
                                >
                                  Marcar como Vencido
                                </DropdownMenuItem>
                              </>
                            )}

                            {saida.situacao === "recebido" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleUpdateSituacao(saida.id, "em aberto")
                                }
                                className={styles.contasPagarDropdownItem}
                              >
                                Voltar para Em Aberto
                              </DropdownMenuItem>
                            )}

                            {saida.situacao === "vencidos" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleUpdateSituacao(saida.id, "em aberto")
                                  }
                                  className={styles.contasPagarDropdownItem}
                                >
                                  Voltar para Em Aberto
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleUpdateSituacao(saida.id, "recebido")
                                  }
                                  className={styles.contasPagarDropdownItem}
                                >
                                  Marcar como Pago
                                </DropdownMenuItem>
                              </>
                            )}

                            <DropdownMenuItem
                              onClick={() => {
                                setDespesaSelecionada(saida);
                                setIsEditDespesaOpen(true);
                              }}
                              disabled={saida.origem === "pluggy"}
                              className={styles.contasPagarDropdownItem}
                            >
                              Editar
                              {saida.origem === "pluggy" &&
                                " (não disponível)"}
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => handleDuplicarDespesa(saida)}
                              className={styles.contasPagarDropdownItem}
                            >
                              Duplicar Lançamento
                            </DropdownMenuItem>

                            {/* Item para revogar conciliação - mostrar para transações conciliadas */}
                            {saida.situacao === "conciliado" && (
                              <DropdownMenuItem
                                onClick={() => handleRevogarConciliacao(saida)}
                                className={styles.contasPagarDropdownItem}
                              >
                                Revogar Conciliação
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem
                              className={styles.contasPagarDropdownItem}
                              onClick={() => handleConfirmarExclusao(saida)}
                            >
                              Excluir Lançamento
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
          </div>

          {/* Footer with totals and pagination */}
          <div className={styles.contasPagarPagination}>
            <div className={styles.contasPagarPaginationControls}>
              <div className={styles.contasPagarPaginationButtons}>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className={styles.contasPagarPaginationSelect}
                style={{ marginRight: 16 }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <button
                className={styles.contasPagarPaginationArrow}
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1 || totalPages === 0}
                aria-label="Primeira página"
              >
                {"<<"}
              </button>
              <button
                className={styles.contasPagarPaginationArrow}
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
                  className={page === currentPage ? styles.contasPagarPaginationButtonActive : styles.contasPagarPaginationArrow}
                >
                  {page}
                </button>
              ))}
              <button
                className={styles.contasPagarPaginationArrow}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                aria-label="Próxima página"
              >
                {">"}
              </button>
              <button
                className={styles.contasPagarPaginationArrow}
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

      {/* Nova Despesa Drawer */}
      <NovaDespesaDrawer
        isOpen={isNovaDespesaOpen}
        onClose={() => {
          setIsNovaDespesaOpen(false);
          setDadosParaDuplicacao(null); // Limpa os dados de duplicação ao fechar
        }}
        onSave={handleSaveDespesa}
        dadosParaDuplicacao={dadosParaDuplicacao}
      />

      {/* Edit Despesa Drawer */}
      <EditDespesaDrawer
        isOpen={isEditDespesaOpen}
        onClose={() => setIsEditDespesaOpen(false)}
        transacaoId={
          despesaSelecionada ? String(despesaSelecionada.id) : undefined
        }
        onSave={handleSaveDespesaEditada}
      />

      {/* Exportar Pagar Modal */}
      <ExportarPagar
        isOpen={isExportarOpen}
        onClose={() => setIsExportarOpen(false)}
      />

      {/* Importar Pagar Modal */}
      <ImportarPagar
        isOpen={isImportarOpen}
        onClose={() => setIsImportarOpen(false)}
        onImportSuccess={recarregarSaidas}
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
        onImportSuccess={recarregarSaidas}
        tipo="pagar"
      />

      {/* Modal de Revogação de Conciliação */}
      <Dialog open={isRevogacaoModalOpen} onOpenChange={setIsRevogacaoModalOpen}>
        <DialogContent className="bg-[#1B1229] border-[#673AB7]/30 text-white max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#FF9800]/20 rounded flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[#FF9800]" />
              </div>
              <DialogTitle className="text-xl font-bold text-white">
                Revogar Conciliação
              </DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-[#B0AFC1] mb-4">
                Você está prestes a revogar a conciliação do lançamento{" "}
                <span className="text-white font-semibold">
                  &ldquo;{saidaParaRevogar?.descricao}&rdquo;
                </span>
                {saidaParaRevogar?.a_pagar && (
                  <>
                    {" "}no valor de{" "}
                    <span className="text-white font-semibold">
                      R$ {Number(saidaParaRevogar.a_pagar).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </>
                )}
                .
              </p>
              
              <div className="bg-[#FF9800]/10 border border-[#FF9800]/20 rounded-lg p-4 mb-6">
                <p className="text-[#FF9800] text-sm font-medium">
                  ⚠️ Após revogar a conciliação, o que você deseja fazer com esta transação?
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-[#B0AFC1] text-sm font-medium mb-3">
                  Escolha uma das opções abaixo:
                </p>
                
                <Button
                  onClick={handleApenasRevogar}
                  disabled={isRevogando}
                  className="w-full bg-[#1E88E5] hover:bg-[#1565C0] text-white mb-2"
                >
                  {isRevogando ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
                  className="w-full bg-[#F50057] hover:bg-[#D1004E] text-white"
                >
                  {isRevogando ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
              <div className="flex items-center justify-center py-4">
                <div className="w-6 h-6 border-2 border-[#673AB7] border-t-transparent rounded animate-spin mr-3"></div>
                <span className="text-[#B0AFC1]">Revogando conciliação...</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsRevogacaoModalOpen(false);
                setSaidaParaRevogar(null);
              }}
              disabled={isRevogando}
              className="border-[#673AB7] text-[#B0AFC1] hover:bg-[#673AB7]/10"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <ModalConfirmarExclusaoConta
        isOpen={isConfirmacaoExclusaoOpen}
        onClose={() => {
          setIsConfirmacaoExclusaoOpen(false);
          setSaidaParaExcluir(null);
        }}
        onConfirm={handleConfirmarExclusaoExecucao}
        isLoading={isExcluindo}
        itemName={saidaParaExcluir?.descricao || ""}
        itemValue={saidaParaExcluir?.a_pagar}
        itemType="pagar"
      />
      </div>
    </>
  );
}
