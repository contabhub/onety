"use client";

import { useState, useEffect } from "react";
import styles from "../../styles/financeiro/extrato-movimentacoes.module.css";
import { Card, CardContent, CardHeader, CardTitle } from '../../components/financeiro/card';
import { Button } from '../../components/financeiro/botao';
import { Input } from '../../components/financeiro/input';
import { Badge } from '../../components/financeiro/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/financeiro/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/financeiro/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/financeiro/dialog';
import {
  Search,
  Plus,
  FileText,
  Upload,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  X,
  Mail,
  Info,
  MoreVertical,
  Trash2,
  Edit,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  RefreshCw,
  Calendar,
} from "lucide-react";

/**
 * @typedef {"month" | "week" | "year" | "all"} PeriodFilter
 */

/**
 * @typedef {Object} DateRange
 * @property {Date} start
 * @property {Date} end
 */
import { toast } from "react-toastify";
import { EditReceitaDrawer } from "../../components/financeiro/EditReceitaDrawer";
import { EditDespesaDrawer } from "../../components/financeiro/EditDespesaDrawer";
import NovaReceitaDrawer from "../../components/financeiro/NovaReceitaDrawer";
import { NovaDespesaDrawer } from "../../components/financeiro/NovaDespesaDrawer";
import { NovaTransferenciaModal } from "../../components/financeiro/NovaTransferenciaModal";
import { ExportarMovimentacoes } from "../../components/financeiro/ExportarMovimentacoes";
import { ImportarMovimentacoes } from "../../components/financeiro/ImportarMovimentacoes";
import { DownloadPlanilhasModal } from "../../components/financeiro/DownloadPlanilhasModal";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import Image from "next/image";

// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

/**
 * @typedef {Object} TransacaoAPI
 * @property {number} id
 * @property {string} data_transacao
 * @property {string} descricao
 * @property {string} categoria_nome
 * @property {string | null} subcategoria_nome
 * @property {string} tipo_nome
 * @property {string | null} cliente_nome_fantasia
 * @property {string | null} centro_custo_codigo
 * @property {string | null} centro_custo_nome
 * @property {string} situacao
 * @property {number} valor
 * @property {"entrada" | "saida"} tipo
 * @property {string} [origem]
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} TransacaoAPIPluggy
 * @property {number} id
 * @property {string} pluggy_transaction_id
 * @property {string} account_id
 * @property {string} description
 * @property {string} amount
 * @property {string} [currency_code]
 * @property {string} date
 * @property {string | null} [status]
 * @property {string} [situacao]
 * @property {string | null} [anexo_base64]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 * @property {string} [company_id]
 * @property {string} [cliente_id]
 */

/**
 * @typedef {Object} Movimentacao
 * @property {string} id
 * @property {string} data
 * @property {string} descricao
 * @property {string} categoria
 * @property {string} [cliente]
 * @property {"Recebido" | "Vencido" | "Pago" | "Transferido" | "Em Aberto"} situacao
 * @property {number} valor
 * @property {"receita" | "despesa" | "transferencia"} tipo
 * @property {boolean} [hasEmail]
 * @property {"empresa" | "pluggy" | "Importação OFX"} [origem]
 */

export default function ExtratoMovimentacoesPage() {
  const [selectedDate, setSelectedDate] = useState("30/06/2025");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showFilters, setShowFilters] = useState(true);
  const [activeFilters, setActiveFilters] = useState(["Situação: Quitado"]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    transacao: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [editReceitaDrawer, setEditReceitaDrawer] = useState({
    isOpen: false,
    transacaoId: null,
  });
  const [editDespesaDrawer, setEditDespesaDrawer] = useState({
    isOpen: false,
    transacaoId: null,
  });
  const [novaReceitaDrawer, setNovaReceitaDrawer] = useState(false);
  const [novaDespesaDrawer, setNovaDespesaDrawer] = useState(false);
  const [isUpdatingSituacao, setIsUpdatingSituacao] = useState(null);
  const [activeFilter, setActiveFilter] = useState("total");
  const [novaTransferenciaModal, setNovaTransferenciaModal] = useState(false);
  const [exportarMovimentacoesModal, setExportarMovimentacoesModal] =
    useState(false);
  const [importarMovimentacoesModal, setImportarMovimentacoesModal] =
    useState(false);
  const [downloadPlanilhasModal, setDownloadPlanilhasModal] =
    useState(false);

  // Estados para filtros de data
  const [currentDate, setCurrentDate] = useState(new Date());
  const [periodFilter, setPeriodFilter] = useState("month");

  // Função para buscar transações da API
  const fetchTransacoes = async () => {
    try {
      setIsLoading(true);
      const empresaId = localStorage.getItem("empresaId");
      const token = localStorage.getItem("token");

      if (!empresaId || !token) {
        console.error("EmpresaId ou token não encontrado no localStorage");
        setError("Credenciais não encontradas. Faça login novamente.");
        setIsLoading(false);
        return;
      }

      // Buscar dados da rota transacoes (empresa)
      const responseEmpresa = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transacoes/empresa/${empresaId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Buscar dados da rota transacoes-api (Pluggy)
      const responsePluggy = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transacoes-api/company/${empresaId}/transacoes`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Verificar se ambas as requisições foram bem-sucedidas
      if (!responseEmpresa.ok) {
        throw new Error(
          `Erro HTTP ${responseEmpresa.status} na rota transacoes`
        );
      }

      if (!responsePluggy.ok) {
        console.warn(
          `Erro HTTP ${responsePluggy.status} na rota transacoes-api - continuando apenas com dados da empresa`
        );
      }

      const dataEmpresa = await responseEmpresa.json();

      // Processar dados da API Pluggy com validações
      let dataPluggy = [];
      if (responsePluggy.ok) {
        try {
          const responseData = await responsePluggy.json();
          console.log("Resposta da API Pluggy:", responseData);

          // Verificar se a resposta é um array
          if (Array.isArray(responseData)) {
            dataPluggy = responseData;
          } else if (responseData && typeof responseData === "object") {
            // Se for um objeto, verificar se tem uma propriedade que contém o array
            if (
              responseData.transactions &&
              Array.isArray(responseData.transactions)
            ) {
              dataPluggy = responseData.transactions;
            } else if (responseData.data && Array.isArray(responseData.data)) {
              dataPluggy = responseData.data;
            } else if (
              responseData.transacoes &&
              Array.isArray(responseData.transacoes)
            ) {
              dataPluggy = responseData.transacoes;
            } else if (
              responseData.results &&
              Array.isArray(responseData.results)
            ) {
              dataPluggy = responseData.results;
            } else {
              console.warn(
                "Resposta da API Pluggy não é um array válido:",
                responseData
              );
              dataPluggy = [];
            }
          } else {
            console.warn(
              "Resposta da API Pluggy não é um array:",
              responseData
            );
            dataPluggy = [];
          }
        } catch (parseError) {
          console.error(
            "Erro ao fazer parse da resposta da API Pluggy:",
            parseError
          );
          dataPluggy = [];
        }
      }

      // Converter dados da API empresa para o formato da interface Movimentacao
      const movimentacoesEmpresa = dataEmpresa.map(
        (transacao) => {
          const valorConvertido =
            transacao.tipo === "entrada" ? transacao.valor : -transacao.valor;
          const situacaoMapeada = mapearSituacao(
            transacao.situacao,
            transacao.tipo
          );

          return {
            id: `empresa_${transacao.id}`,
            data: new Date(transacao.data_transacao).toLocaleDateString(
              "pt-BR"
            ),
            descricao: transacao.descricao || "Sem descrição",
            categoria: transacao.subcategoria_nome
              ? `${transacao.categoria_nome || "Sem categoria"} - ${
                  transacao.subcategoria_nome
                }`
              : transacao.categoria_nome || "Sem categoria",
            cliente: transacao.cliente_nome_fantasia || undefined,
            situacao: situacaoMapeada,
            valor: valorConvertido,
            tipo: transacao.tipo === "entrada" ? "receita" : "despesa",
            hasEmail: false, // Pode ser implementado posteriormente
            origem: transacao.origem || "empresa", // Usar a origem da transação ou "empresa" como padrão
          };
        }
      );

      // Converter dados da API Pluggy para o formato da interface Movimentacao
      const movimentacoesPluggy = Array.isArray(dataPluggy)
        ? dataPluggy.map((transacao) => {
            const valor = parseFloat(transacao.amount);
            const valorConvertido = valor >= 0 ? valor : -Math.abs(valor);

            // Para transações Pluggy, usar a função mapearSituacaoPluggy para determinar situação
            const situacaoMapeada = mapearSituacaoPluggy(
              transacao.situacao ?? "recebido"
            );

            // Debug: Log para transações Pluggy com situação vencida
            if (
              transacao.situacao === "vencidos" ||
              situacaoMapeada === "Vencido"
            ) {
              console.log(
                `Transação Pluggy vencida: ID=${transacao.id}, situacao_original=${transacao.situacao}, situacao_mapeada=${situacaoMapeada}`
              );
            }

            return {
              id: `pluggy_${transacao.id}`,
              data: new Date(transacao.date).toLocaleDateString("pt-BR"),
              descricao: transacao.description || "Transação Pluggy",
              categoria: "Transação Pluggy", // Categoria padrão para transações Pluggy
              cliente: undefined, // Transações Pluggy não têm cliente associado
              situacao: situacaoMapeada,
              valor: valorConvertido,
              tipo: valor >= 0 ? "receita" : "despesa",
              hasEmail: false,
              origem: "pluggy",
            };
          })
        : [];

      // Unir os resultados e ordenar por data (mais recente primeiro)
      const todasMovimentacoes = [
        ...movimentacoesEmpresa,
        ...movimentacoesPluggy,
      ].sort((a, b) => {
        const dataA = new Date(a.data.split("/").reverse().join("-"));
        const dataB = new Date(b.data.split("/").reverse().join("-"));
        return dataB.getTime() - dataA.getTime();
      });

      setMovimentacoes(todasMovimentacoes);
      setError(null);
    } catch (error) {
      console.error("Erro ao buscar transações:", error);
      setError("Erro ao carregar movimentações. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  // Função para mapear situação da API para o formato da interface
  const mapearSituacao = (situacaoAPI, tipo) => {
    const situacao = situacaoAPI || "em_aberto";

    switch (situacao.toLowerCase()) {
      case "recebido":
        // Para despesas, "recebido" se torna "Pago"
        if (tipo === "saida") {
          return "Pago";
        }
        return "Recebido";
      case "vencidos":
        // "Vencidos" sempre se torna "Vencido", independente do tipo
        return "Vencido";
      case "transferido":
        return "Transferido";
      case "em_aberto":
      default:
        return "Em Aberto";
    }
  };

  // Função para mapear situação das transações Pluggy
  const mapearSituacaoPluggy = (situacaoAPI) => {
    const situacao = situacaoAPI || "recebido";

    // Debug: Log para mapeamento de situação Pluggy
    console.log(
      `Mapeando situação Pluggy: API="${situacaoAPI}", situacao="${situacao}"`
    );

    switch (situacao.toLowerCase()) {
      case "recebido":
      case "pago": // "Pago" e "Recebido" são tratados como "recebido" no banco
        console.log(`Mapeamento Pluggy: ${situacao} = Recebido`);
        return "Recebido";
      case "vencido":
      case "vencidos": // Adicionado suporte para plural
        console.log(`Mapeamento Pluggy: ${situacao} = Vencido`);
        return "Vencido";
      case "transferido":
        console.log(`Mapeamento Pluggy: ${situacao} = Transferido`);
        return "Transferido";
      case "em_aberto":
      default:
        console.log(`Mapeamento Pluggy: ${situacao} = Em Aberto`);
        return "Em Aberto";
    }
  };

  // Função para mapear situação da interface para o formato da API
  const mapearSituacaoParaAPI = (situacao) => {
    switch (situacao) {
      case "Recebido":
      case "Pago": // "Pago" e "Recebido" são mapeados para "recebido" no banco
        return "recebido";
      case "Vencido":
        return "vencidos";
      case "Transferido":
        return "transferido";
      case "Em Aberto":
        return "em_aberto";
      default:
        return "em_aberto";
    }
  };

  // Função para atualizar situação da transação
  const handleUpdateSituacao = async (transacaoId, novaSituacao) => {
    const transacao = movimentacoes.find((m) => m.id === transacaoId);
    if (!transacao) return;

    try {
      setIsUpdatingSituacao(transacaoId);
      const token = localStorage.getItem("token");
      const empresaId = localStorage.getItem("empresaId");

      if (!token || !empresaId) {
        setError("Token ou empresaId não encontrado. Faça login novamente.");
        return;
      }

      const situacaoAPI = mapearSituacaoParaAPI(novaSituacao);

      let response;

      if (transacao.origem === "pluggy") {
        // Para transações Pluggy, usar os dados que já temos em memória
        const pluggyId = transacaoId.replace("pluggy_", "");

        console.log(
          `Atualizando transação OpenFinance: ID=${pluggyId}, nova situação=${novaSituacao}, situacaoAPI=${situacaoAPI}`
        );

        // Buscar a transação original da lista de dados Pluggy
        const transacoesPluggyResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/transacoes-api/company/${empresaId}/transacoes`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!transacoesPluggyResponse.ok) {
          throw new Error(
            `Erro HTTP ${transacoesPluggyResponse.status} ao buscar transações Pluggy`
          );
        }

        const responseData = await transacoesPluggyResponse.json();

        // Processar dados da API Pluggy com validações (mesma lógica do fetchTransacoes)
        let transacoesPluggy = [];
        if (Array.isArray(responseData)) {
          transacoesPluggy = responseData;
        } else if (responseData && typeof responseData === "object") {
          // Se for um objeto, verificar se tem uma propriedade que contém o array
          if (
            responseData.transactions &&
            Array.isArray(responseData.transactions)
          ) {
            transacoesPluggy = responseData.transactions;
          } else if (responseData.data && Array.isArray(responseData.data)) {
            transacoesPluggy = responseData.data;
          } else if (
            responseData.transacoes &&
            Array.isArray(responseData.transacoes)
          ) {
            transacoesPluggy = responseData.transacoes;
          } else if (
            responseData.results &&
            Array.isArray(responseData.results)
          ) {
            transacoesPluggy = responseData.results;
          } else {
            console.warn(
              "Resposta da API Pluggy não é um array válido:",
              responseData
            );
            transacoesPluggy = [];
          }
        } else {
          console.warn("Resposta da API Pluggy não é um array:", responseData);
          transacoesPluggy = [];
        }

        const transacaoOriginal = transacoesPluggy.find(
          (t) => t.id.toString() === pluggyId
        );

        if (!transacaoOriginal) {
          throw new Error("Transação não encontrada");
        }

        // Preparar dados para atualização mantendo todos os campos originais
        const dadosAtualizados = {
          description: transacaoOriginal.description,
          amount: transacaoOriginal.amount,
          date: transacaoOriginal.date
            ? new Date(transacaoOriginal.date)
                .toISOString()
                .slice(0, 19)
                .replace("T", " ")
            : null,
          situacao: situacaoAPI, // Apenas este campo é alterado
          anexo_base64: transacaoOriginal.anexo_base64,
          currency_code: transacaoOriginal.currency_code,
          status: transacaoOriginal.status,
          category: transacaoOriginal.category,
        };

        response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/transacoes-api/company/${empresaId}/transacao/${pluggyId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(dadosAtualizados),
          }
        );
      } else if (transacao.origem === "Importação OFX") {
        // Para transações OFX, usar a rota transacoes (mesmo que empresa)
        const idEmpresa = transacaoId.replace("empresa_", "");
        response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/transacoes/${idEmpresa}/situacao`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ situacao: situacaoAPI }),
          }
        );
      } else {
        // Para transações da empresa, usar a rota transacoes
        const idEmpresa = transacaoId.replace("empresa_", "");
        response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/transacoes/${idEmpresa}/situacao`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ situacao: situacaoAPI }),
          }
        );
      }

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`);
      }

      console.log(
        `Transação Pluggy atualizada com sucesso: ID=${transacaoId}, situação=${novaSituacao}`
      );

      // Recarregar dados após atualização
      await fetchTransacoes();

      toast.success("Situação atualizada com sucesso");
    } catch (error) {
      console.error("Erro ao atualizar situação:", error);
      toast.error("Erro ao atualizar situação. Tente novamente.");
    } finally {
      setIsUpdatingSituacao(null);
    }
  };

  // Função para obter opções de situação baseadas na situação atual
  const getSituacaoOptions = (situacaoAtual, tipo, origem) => {
    let todasSituacoes = ["Recebido", "Vencido", "Em Aberto"];

    // Se for despesa, usa "Pago" e "Vencido" em vez de "Recebido"
    if (tipo === "despesa") {
      todasSituacoes = ["Pago", "Vencido", "Em Aberto"];
    }

    // Remove a situação atual da lista de opções
    return todasSituacoes.filter((situacao) => situacao !== situacaoAtual);
  };

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

  // Carregar dados ao montar o componente
  useEffect(() => {
    fetchTransacoes();
  }, []);

  // Reset da página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchTerm, periodFilter, currentDate]);

  const filteredMovimentacoes = movimentacoes.filter((mov) => {
    // Filtro por período
    const { start, end } = getDateRange();
    const movDate = new Date(mov.data.split("/").reverse().join("-"));
    const matchesPeriod = periodFilter === "all" || (movDate >= start && movDate <= end);

    // Filtro baseado no stats card selecionado
    let matchesFilter = true;

    switch (activeFilter) {
      case "receitas-realizadas":
        matchesFilter = mov.tipo === "receita" && mov.situacao !== "Em Aberto";
        break;
      case "despesas-realizadas":
        matchesFilter = mov.tipo === "despesa" && mov.situacao !== "Em Aberto";
        break;
      case "receitas-aberto":
        matchesFilter = mov.tipo === "receita" && mov.situacao === "Em Aberto";
        break;
      case "despesas-aberto":
        matchesFilter = mov.tipo === "despesa" && mov.situacao === "Em Aberto";
        break;
      case "vencidas":
        matchesFilter = mov.situacao === "Vencido";
        break;
      case "total":
      default:
        matchesFilter = true; // Mostra todas as movimentações
        break;
    }

    // Filtro de busca
    if (!searchTerm.trim()) return matchesFilter && matchesPeriod;

    const searchLower = searchTerm.toLowerCase();
    
    // Busca por descrição
    const matchesDescription = (mov.descricao || "")
      .toLowerCase()
      .includes(searchLower);
    
    // Busca por categoria
    const matchesCategory = (mov.categoria || "")
      .toLowerCase()
      .includes(searchLower);
    
    // Busca por cliente
    const matchesClient = mov.cliente
      ? mov.cliente.toLowerCase().includes(searchLower)
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
        const movValue = Math.abs(Number(mov.valor) || 0);
        // Busca exata ou aproximada (com tolerância de 0.01 para diferenças de arredondamento)
        matchesValue = Math.abs(movValue - searchValue) < 0.01;
      }
    }
    
    // Busca por valor sem formatação (apenas números)
    if (!matchesValue && /^\d+([.,]\d+)?$/.test(searchLower)) {
      const cleanSearch = searchLower.replace(',', '.');
      const searchValue = parseFloat(cleanSearch);
      
      if (!isNaN(searchValue)) {
        const movValue = Math.abs(Number(mov.valor) || 0);
        matchesValue = Math.abs(movValue - searchValue) < 0.01;
      }
    }

    // Busca por data (formato brasileiro)
    const matchesDate = mov.data.includes(searchTerm);

    const matchesSearch = matchesDescription || matchesCategory || matchesClient || matchesValue || matchesDate;

    return matchesFilter && matchesPeriod && matchesSearch;
  });

  const totalPages = Math.ceil(filteredMovimentacoes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMovimentacoes = filteredMovimentacoes.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Cálculos dos totais (sempre baseados em todas as movimentações, não nas filtradas)
  const receitasEmAberto = movimentacoes
    .filter((m) => m.tipo === "receita" && m.situacao === "Em Aberto")
    .reduce((sum, m) => sum + Math.abs(Number(m.valor) || 0), 0);
  const receitasRealizadas = movimentacoes
    .filter((m) => m.tipo === "receita" && m.situacao !== "Em Aberto")
    .reduce((sum, m) => sum + Math.abs(Number(m.valor) || 0), 0);
  const despesasEmAberto = movimentacoes
    .filter((m) => m.tipo === "despesa" && m.situacao === "Em Aberto")
    .reduce((sum, m) => sum + Math.abs(Number(m.valor) || 0), 0);
  const despesasRealizadas = movimentacoes
    .filter((m) => m.tipo === "despesa" && m.situacao !== "Em Aberto")
    .reduce((sum, m) => sum + Math.abs(Number(m.valor) || 0), 0);
  const transacoesVencidas = movimentacoes
    .filter((m) => m.situacao === "Vencido")
    .reduce((sum, m) => sum + Math.abs(Number(m.valor) || 0), 0);
  // Total do período deve considerar TODAS as movimentações (realizadas + em aberto)
  const totalPeriodo =
    receitasRealizadas +
    receitasEmAberto -
    (despesasRealizadas + despesasEmAberto);

  const handleSelectItem = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === paginatedMovimentacoes.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(paginatedMovimentacoes.map((m) => m.id));
    }
  };

  const removeFilter = (filter) => {
    setActiveFilters((prev) => prev.filter((f) => f !== filter));
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
  };

  const getStatusBadge = (situacao) => {
    switch (situacao) {
      case "Recebido":
        return (
          <Badge className={styles.extratoMovimentacoesBadgePago}>
            Recebido
          </Badge>
        );
      case "Vencido":
        return (
          <Badge className={styles.extratoMovimentacoesBadgeVencido}>
            Vencido
          </Badge>
        );
      case "Pago":
        return (
          <Badge className={styles.extratoMovimentacoesBadgePago}>
            Pago
          </Badge>
        );
      case "Transferido":
        return (
          <Badge className={styles.extratoMovimentacoesBadgeConciliado}>
            Transferido
          </Badge>
        );
      case "Em Aberto":
        return (
          <Badge className={styles.extratoMovimentacoesBadgeEmAberto}>
            Em Aberto
          </Badge>
        );
      default:
        return (
          <Badge className={styles.extratoMovimentacoesBadgeEmAberto}>
            {situacao}
          </Badge>
        );
    }
  };

  const formatCurrency = (value, tipo) => {
    const formatted = Math.abs(value).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Se for despesa, sempre mostra com sinal negativo
    if (tipo === "despesa") {
      return `-R$ ${formatted}`;
    }

    // Para outros tipos, mantém a lógica original
    return value < 0 ? `-R$ ${formatted}` : `R$ ${formatted}`;
  };

  // Função para formatar números com separador de milhares
  const formatNumberWithThousands = (value) => {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getValueColor = (value, tipo) => {
    if (tipo === "receita") return "text-[#1E88E5]";
    if (tipo === "despesa") return "text-[#F50057]";
    return value < 0 ? "text-[#F50057]" : "text-[#1E88E5]";
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

  // Função para excluir transação
  const handleDeleteTransacao = async () => {
    if (!deleteModal.transacao) return;

    try {
      setIsDeleting(true);
      const token = localStorage.getItem("token");
      const empresaId = localStorage.getItem("empresaId");

      if (!token || !empresaId) {
        setError("Token ou empresaId não encontrado. Faça login novamente.");
        return;
      }

      let response;

      if (deleteModal.transacao.origem === "pluggy") {
        // Para transações Pluggy, usar a rota transacoes-api
        const pluggyId = deleteModal.transacao.id.replace("pluggy_", "");
        response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/transacoes-api/company/${empresaId}/transacao/${pluggyId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
      } else if (deleteModal.transacao.origem === "Importação OFX") {
        // Para transações OFX, usar a rota transacoes (mesmo que empresa)
        const transacaoId = deleteModal.transacao.id.replace("empresa_", "");
        response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/transacoes/${transacaoId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
      } else {
        // Para transações da empresa, usar a rota transacoes
        const transacaoId = deleteModal.transacao.id.replace("empresa_", "");
        response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/transacoes/${transacaoId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
      }

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`);
      }

      // Recarregar dados após exclusão
      await fetchTransacoes();

      // Fechar modal
      setDeleteModal({ isOpen: false, transacao: null });

      toast.success("Transação excluída com sucesso");
    } catch (error) {
      toast.error("Erro ao excluir transação");
      setError("Erro ao excluir transação. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Função para abrir drawer de edição
  const handleEditTransacao = (transacao) => {
    // Transações Pluggy e OFX não podem ser editadas
    if (transacao.origem === "pluggy") {
      toast.warning("Transações Pluggy não podem ser editadas");
      return;
    }
    
    if (transacao.origem === "Importação OFX") {
      toast.warning("Transações OFX não podem ser editadas");
      return;
    }

    if (transacao.tipo === "receita") {
      setEditReceitaDrawer({
        isOpen: true,
        transacaoId: transacao.id.replace("empresa_", ""),
      });
    } else if (transacao.tipo === "despesa") {
      setEditDespesaDrawer({
        isOpen: true,
        transacaoId: transacao.id.replace("empresa_", ""),
      });
    } else {
      toast.warning("Edição não disponível para transferências");
    }
  };

  // Função para fechar drawers de edição
  const handleCloseEditDrawers = () => {
    setEditReceitaDrawer({ isOpen: false, transacaoId: null });
    setEditDespesaDrawer({ isOpen: false, transacaoId: null });
  };

  // Função para salvar edição
  const handleSaveEdit = (data) => {
    // Recarregar dados após edição
    fetchTransacoes();
    toast.success("Transação atualizada com sucesso");
  };

  // Função para aplicar filtro baseado no stats card
  const handleApplyFilter = (filterType) => {
    setActiveFilter(filterType);
    setCurrentPage(1); // Volta para primeira página ao aplicar filtro
  };

  // Função para limpar filtros
  const handleClearFilters = () => {
    setActiveFilter("total");
    setCurrentPage(1);
  };

  // Função para abrir drawer de nova receita
  const handleOpenNovaReceita = () => {
    setNovaReceitaDrawer(true);
  };

  // Função para abrir drawer de nova despesa
  const handleOpenNovaDespesa = () => {
    setNovaDespesaDrawer(true);
  };

  // Função para fechar drawers de nova transação
  const handleCloseNovosDrawers = () => {
    setNovaReceitaDrawer(false);
    setNovaDespesaDrawer(false);
  };

  // Função para salvar nova transação
  const handleSaveNovaTransacao = (data) => {
    // Recarregar dados após criação
    fetchTransacoes();
    toast.success("Transação criada com sucesso");
    handleCloseNovosDrawers();
  };

  if (isLoading) {
    return (
      <div className={styles.extratoMovimentacoesPage}>
        <div className={styles.extratoMovimentacoesLoading}>
          <div className={styles.extratoMovimentacoesLoadingContent}>
            <div className={styles.extratoMovimentacoesLoadingSpinner}>
              <div className={styles.extratoMovimentacoesLoadingSpinnerInner}></div>
            </div>
            <p className={styles.extratoMovimentacoesLoadingText}>Carregando movimentações...</p>
          </div>
        </div>
      </div>
    );
  }


  return (
    <>
      <PrincipalSidebar />
      <div className={styles.extratoMovimentacoesPage}>
      {/* Header */}
      <div className={styles.extratoMovimentacoesHeader}>
        <div>
          <h1 className={styles.extratoMovimentacoesHeaderTitle}>
            Extrato de movimentações
          </h1>
          <p className={styles.extratoMovimentacoesHeaderSubtitle}>
            Visualize todas as movimentações financeiras
            {movimentacoes.some((m) => m.origem === "pluggy") && (
              <span className="ml-2">
                •{" "}
                <Badge className={styles.extratoMovimentacoesBadgePluggy}>
                  OpenFinance
                </Badge>
                {movimentacoes.filter((m) => m.origem === "pluggy").length}{" "}
                transações sincronizadas
              </span>
            )}
          </p>
        </div>
        <div className={styles.extratoMovimentacoesHeaderActions}>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchTransacoes}
            disabled={isLoading}
            className={styles.extratoMovimentacoesSecondaryBtn}
          >
            <RefreshCw className={styles.extratoMovimentacoesActionIcon} />
            {isLoading ? "Carregando..." : "Atualizar"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className={styles.extratoMovimentacoesSecondaryBtn}
              >
                <Plus className={styles.extratoMovimentacoesActionIcon} />
                Nova
                <ChevronDown className={styles.extratoMovimentacoesActionIcon} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={styles.extratoMovimentacoesDropdown}
            >
              <DropdownMenuItem
                onClick={handleOpenNovaReceita}
                className={styles.extratoMovimentacoesDropdownItem}
              >
                <TrendingUp className={styles.extratoMovimentacoesActionIcon} />
                Receita
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleOpenNovaDespesa}
                className={styles.extratoMovimentacoesDropdownItem}
              >
                <TrendingDown className={styles.extratoMovimentacoesActionIcon} />
                Despesa
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setNovaTransferenciaModal(true)}
                className={styles.extratoMovimentacoesDropdownItem}
              >
                <ArrowRight className={styles.extratoMovimentacoesActionIcon} />
                Transferência
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportarMovimentacoesModal(true)}
            className={styles.extratoMovimentacoesExportBtn}
          >
            <Download className={styles.extratoMovimentacoesActionIcon} />
            Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportarMovimentacoesModal(true)}
            className={styles.extratoMovimentacoesImportBtn}
          >
            <Upload className={styles.extratoMovimentacoesActionIcon} />
            Importar planilha
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDownloadPlanilhasModal(true)}
            className={styles.extratoMovimentacoesOfxBtn}
          >
            <FileText className={styles.extratoMovimentacoesActionIcon} />
            Planilhas
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className={styles.extratoMovimentacoesFiltersCard}>
        <CardContent className={styles.extratoMovimentacoesFiltersContent}>
          <div className={styles.extratoMovimentacoesFiltersRow}>
            <div className={styles.extratoMovimentacoesFilterGroup}>
              <label className={styles.extratoMovimentacoesFilterLabel}>
                Período
              </label>
              <div className={styles.extratoMovimentacoesPeriodContainer}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth("prev")}
                  className={styles.extratoMovimentacoesNavBtn}
                >
                  <ChevronLeft className={styles.extratoMovimentacoesNavIcon} />
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={styles.extratoMovimentacoesPeriodButton}
                    >
                      <span>{formatCurrentPeriod()}</span>
                      <ChevronDown className={styles.extratoMovimentacoesNavIcon} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="center"
                    className={styles.extratoMovimentacoesDropdown}
                  >
                    <DropdownMenuItem 
                      className={styles.extratoMovimentacoesDropdownItem}
                      onClick={() => setPeriodFilter("week")}
                    >
                      Esta semana
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className={styles.extratoMovimentacoesDropdownItem}
                      onClick={() => setPeriodFilter("month")}
                    >
                      Este mês
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className={styles.extratoMovimentacoesDropdownItem}
                      onClick={() => setPeriodFilter("year")}
                    >
                      Este ano
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className={styles.extratoMovimentacoesDropdownItem}
                      onClick={() => setPeriodFilter("all")}
                    >
                      Todo o período
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth("next")}
                  className={styles.extratoMovimentacoesNavBtn}
                >
                  <ChevronRight className={styles.extratoMovimentacoesNavIcon} />
                </Button>
              </div>
            </div>
            <div className={styles.extratoMovimentacoesFilterGroup}>
              <label className={styles.extratoMovimentacoesFilterLabel}>
                Pesquisar no período selecionado
              </label>
              <div className={styles.extratoMovimentacoesSearchContainer}>
                <Input
                  placeholder="Pesquisar por descrição, categoria, cliente, valor (R$ 1.500,00) ou data (11/08/2025, 11/8/25)"
                  className={styles.extratoMovimentacoesSearchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.extratoMovimentacoesActionBtn}
                >
                </Button>
              </div>
            </div>
            <div className={styles.extratoMovimentacoesFilterGroup}>
              <label className={styles.extratoMovimentacoesFilterLabel}>
                Conta
              </label>
              <Select
                value={selectedAccount}
                onValueChange={setSelectedAccount}
                disabled
              >
                <SelectTrigger className={styles.extratoMovimentacoesSearchInput}>
                  <SelectValue placeholder="Selecionar todas" />
                </SelectTrigger>
                <SelectContent className={styles.extratoMovimentacoesDropdown}>
                  <SelectItem
                    value="all"
                    className={styles.extratoMovimentacoesDropdownItem}
                  >
                    Selecionar todas
                  </SelectItem>
                  <SelectItem
                    value="bradesco"
                    className={styles.extratoMovimentacoesDropdownItem}
                  >
                    Banco Bradesco
                  </SelectItem>
                  <SelectItem
                    value="conta-azul"
                    className={styles.extratoMovimentacoesDropdownItem}
                  >
                    Conta Azul
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className={styles.extratoMovimentacoesStatsGrid}>
        <Card
          className={`${styles.extratoMovimentacoesStatCard} ${
            activeFilter === "receitas-aberto"
              ? styles.extratoMovimentacoesStatCardActive
              : styles.extratoMovimentacoesStatCardInactive
          }`}
          onClick={() => handleApplyFilter("receitas-aberto")}
        >
          <CardContent className={styles.extratoMovimentacoesStatCardContent}>
            <div className={styles.extratoMovimentacoesStatCardInner}>
              <div className={styles.extratoMovimentacoesStatCardInfo}>
                <p className={styles.extratoMovimentacoesStatCardTitle}>
                  Receitas em aberto (R$)
                </p>
                <p className={styles.extratoMovimentacoesStatCardValue}>
                  R$ {formatNumberWithThousands(receitasEmAberto)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${styles.extratoMovimentacoesStatCard} ${
            activeFilter === "receitas-realizadas"
              ? styles.extratoMovimentacoesStatCardActive
              : styles.extratoMovimentacoesStatCardInactive
          }`}
          onClick={() => handleApplyFilter("receitas-realizadas")}
        >
          <CardContent className={styles.extratoMovimentacoesStatCardContent}>
            <div className={styles.extratoMovimentacoesStatCardInner}>
              <div className={styles.extratoMovimentacoesStatCardInfo}>
                <p className={styles.extratoMovimentacoesStatCardTitle}>
                  Receitas realizadas (R$)
                </p>
                <p className={`${styles.extratoMovimentacoesStatCardValue} ${styles.extratoMovimentacoesStatValueActive}`}>
                  R$ {formatNumberWithThousands(receitasRealizadas)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${styles.extratoMovimentacoesStatCard} ${
            activeFilter === "despesas-aberto"
              ? styles.extratoMovimentacoesStatCardActive
              : styles.extratoMovimentacoesStatCardInactive
          }`}
          onClick={() => handleApplyFilter("despesas-aberto")}
        >
          <CardContent className={styles.extratoMovimentacoesStatCardContent}>
            <div className={styles.extratoMovimentacoesStatCardInner}>
              <div className={styles.extratoMovimentacoesStatCardInfo}>
                <p className={styles.extratoMovimentacoesStatCardTitle}>
                  Despesas em aberto (R$)
                </p>
                <p className={styles.extratoMovimentacoesStatCardValue}>
                  R$ {formatNumberWithThousands(despesasEmAberto)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${styles.extratoMovimentacoesStatCard} ${
            activeFilter === "despesas-realizadas"
              ? styles.extratoMovimentacoesStatCardActive
              : styles.extratoMovimentacoesStatCardInactive
          }`}
          onClick={() => handleApplyFilter("despesas-realizadas")}
        >
          <CardContent className={styles.extratoMovimentacoesStatCardContent}>
            <div className={styles.extratoMovimentacoesStatCardInner}>
              <div className={styles.extratoMovimentacoesStatCardInfo}>
                <p className={styles.extratoMovimentacoesStatCardTitle}>
                  Despesas realizadas (R$)
                </p>
                <p className={`${styles.extratoMovimentacoesStatCardValue} ${styles.extratoMovimentacoesStatValueActive}`}>
                  R$ {formatNumberWithThousands(despesasRealizadas)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${styles.extratoMovimentacoesStatCard} ${
            activeFilter === "vencidas"
              ? styles.extratoMovimentacoesStatCardActive
              : styles.extratoMovimentacoesStatCardInactive
          }`}
          onClick={() => handleApplyFilter("vencidas")}
        >
          <CardContent className={styles.extratoMovimentacoesStatCardContent}>
            <div className={styles.extratoMovimentacoesStatCardInner}>
              <div className={styles.extratoMovimentacoesStatCardInfo}>
                <p className={styles.extratoMovimentacoesStatCardTitle}>
                  Transações vencidas (R$)
                </p>
                <p className={`${styles.extratoMovimentacoesStatCardValue} ${styles.extratoMovimentacoesStatValueActive}`}>
                  R$ {formatNumberWithThousands(transacoesVencidas)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${styles.extratoMovimentacoesStatCard} ${
            activeFilter === "total"
              ? styles.extratoMovimentacoesStatCardActive
              : styles.extratoMovimentacoesStatCardInactive
          }`}
          onClick={() => handleApplyFilter("total")}
        >
          <CardContent className={styles.extratoMovimentacoesStatCardContent}>
            <div className={styles.extratoMovimentacoesStatCardInner}>
              <div className={styles.extratoMovimentacoesStatCardInfo}>
                <div className="flex items-center justify-center gap-1">
                  <p className={styles.extratoMovimentacoesStatCardTitle}>
                    Total do período (R$)
                  </p>
                </div>
                <p className={`${styles.extratoMovimentacoesStatCardValue} ${styles.extratoMovimentacoesStatValueActive}`}>
                  R$ {formatNumberWithThousands(totalPeriodo)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className={styles.extratoMovimentacoesActions}>
        <div className={styles.extratoMovimentacoesActionsLeft}>
          <span className={styles.extratoMovimentacoesTableFooterSecondary}>
            {selectedItems.length} registro(s) selecionado(s)
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedItems.length === 0}
            className={styles.extratoMovimentacoesSecondaryBtn}
          >
            Pagar pelo CA de Bolso
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedItems.length === 0}
            className={styles.extratoMovimentacoesSecondaryBtn}
          >
            Ações em lote
            <ChevronDown className={styles.extratoMovimentacoesActionIcon} />
          </Button>
        </div>

        {/* Botão para limpar filtros */}
        {(activeFilter !== "total" || periodFilter !== "month") && (
          <div className={styles.extratoMovimentacoesActionsRight}>
            <span className={styles.extratoMovimentacoesTableFooterSecondary}>
              Filtros ativos:{" "}
              {activeFilter !== "total" && (
                activeFilter === "receitas-realizadas"
                  ? "Receitas realizadas"
                  : activeFilter === "despesas-realizadas"
                  ? "Despesas realizadas"
                  : activeFilter === "receitas-aberto"
                  ? "Receitas em aberto"
                  : activeFilter === "despesas-aberto"
                  ? "Despesas em aberto"
                  : activeFilter === "vencidas"
                  ? "Transações vencidas"
                  : "Total"
              )}
              {activeFilter !== "total" && periodFilter !== "month" && " • "}
              {periodFilter !== "month" && (
                periodFilter === "week" ? "Esta semana" :
                periodFilter === "year" ? "Este ano" :
                periodFilter === "all" ? "Todo o período" : "Período personalizado"
              )}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleClearFilters();
                setPeriodFilter("month");
                setCurrentDate(new Date());
              }}
              className={styles.extratoMovimentacoesSecondaryBtn}
            >
              <X className={styles.extratoMovimentacoesActionIcon} />
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className={styles.extratoMovimentacoesTableCard}>
        <div className={styles.extratoMovimentacoesTableContent}>
          <div className={styles.extratoMovimentacoesTableContainer}>
            <table className={styles.extratoMovimentacoesTable}>
              <thead>
                <tr className={styles.extratoMovimentacoesTableHeader}>
                  <th className={styles.extratoMovimentacoesTableHeaderCell}>
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={
                        selectedItems.length ===
                          paginatedMovimentacoes.length &&
                        paginatedMovimentacoes.length > 0
                      }
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className={styles.extratoMovimentacoesTableHeaderText}>
                    <div className="flex items-center gap-1">
                      Data
                      <div className="flex flex-col">
                        <ArrowUp className={styles.extratoMovimentacoesTableSortIcon} />
                        <ArrowDown className={styles.extratoMovimentacoesTableSortIcon} />
                      </div>
                    </div>
                  </th>
                  <th className={styles.extratoMovimentacoesTableHeaderCell}>
                    Descrição
                  </th>
                  <th className={styles.extratoMovimentacoesTableHeaderCell}>
                    Situação
                  </th>
                  <th className={styles.extratoMovimentacoesTableHeaderCell}>
                    Valor (R$)
                  </th>
                  <th className={styles.extratoMovimentacoesTableHeaderCell}>
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedMovimentacoes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.extratoMovimentacoesTableRowEmpty}>
                      <div className="flex flex-col items-center ">
                        <div className={styles.extratoMovimentacoesEmptyIcon}>
                          ?
                        </div>
                        <p className={styles.extratoMovimentacoesTableRowEmptyText}>Nenhuma movimentação encontrada</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedMovimentacoes.map((movimentacao) => (
                    <tr
                      key={movimentacao.id}
                      className={styles.extratoMovimentacoesTableRow}
                    >
                      <td className={styles.extratoMovimentacoesTableCell}>
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedItems.includes(movimentacao.id)}
                          onChange={() => handleSelectItem(movimentacao.id)}
                        />
                      </td>
                      <td className={styles.extratoMovimentacoesTableCellPrimary}>
                        {movimentacao.data}
                      </td>
                      <td className={styles.extratoMovimentacoesTableCell}>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className={styles.extratoMovimentacoesTableCellPrimary}>
                              {movimentacao.descricao}
                            </p>
                            {movimentacao.origem === "pluggy" && (
                              <Badge className={styles.extratoMovimentacoesBadgePluggy}>
                                OpenFinance
                              </Badge>
                            )}
                            {movimentacao.origem === "Importação OFX" && (
                              <Badge className={styles.extratoMovimentacoesBadgeOfx}>
                                OFX
                              </Badge>
                            )}
                          </div>
                          <p className={styles.extratoMovimentacoesTableCellSecondary}>
                          {movimentacao.cliente}
                          </p>
                          {movimentacao.cliente && (
                            <p className={styles.extratoMovimentacoesTableCellSecondary}>
                              {movimentacao.categoria}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className={styles.extratoMovimentacoesTableCell}>
                        {getStatusBadge(movimentacao.situacao)}
                      </td>
                      <td className={styles.extratoMovimentacoesTableCellValue}>
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={`text-sm font-medium ${getValueColor(
                              movimentacao.valor,
                              movimentacao.tipo
                            )}`}
                          >
                            {formatCurrency(
                              movimentacao.valor,
                              movimentacao.tipo
                            )}
                          </span>
                          {movimentacao.hasEmail && (
                            <Mail className={styles.extratoMovimentacoesActionIcon} />
                          )}
                        </div>
                      </td>
                      <td className={styles.extratoMovimentacoesTableCell}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUpdatingSituacao === movimentacao.id}
                              className={styles.extratoMovimentacoesActionBtn}
                            >
                              <MoreVertical className={styles.extratoMovimentacoesActionIcon} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className={styles.extratoMovimentacoesDropdown}
                          >
                            <DropdownMenuItem
                              onClick={() => handleEditTransacao(movimentacao)}
                              disabled={movimentacao.origem === "pluggy" || movimentacao.origem === "Importação OFX"}
                              className={`${
                                movimentacao.origem === "pluggy" || movimentacao.origem === "Importação OFX"
                                  ? `${styles.extratoMovimentacoesDropdownItem} opacity-50 cursor-not-allowed`
                                  : styles.extratoMovimentacoesDropdownItem
                              }`}
                            >
                              <Edit className={styles.extratoMovimentacoesActionIcon} />
                              Editar
                              {movimentacao.origem === "pluggy" &&
                                " (não disponível)"}
                              {movimentacao.origem === "Importação OFX" &&
                                " (não disponível)"}
                            </DropdownMenuItem>

                            {/* Opções de mudança de situação */}
                            {getSituacaoOptions(
                              movimentacao.situacao,
                              movimentacao.tipo,
                              movimentacao.origem
                            ).map((situacao) => (
                              <DropdownMenuItem
                                key={situacao}
                                onClick={() =>
                                  handleUpdateSituacao(
                                    movimentacao.id,
                                    situacao
                                  )
                                }
                                disabled={
                                  isUpdatingSituacao === movimentacao.id
                                }
                                className={styles.extratoMovimentacoesDropdownItem}
                              >
                                <div className="flex items-center">
                                  {isUpdatingSituacao === movimentacao.id ? (
                                    <div className="h-4 w-4 mr-2 animate-spin rounded border-2 border-[#1E88E5] border-t-transparent" />
                                  ) : (
                                    <CheckCircle className={styles.extratoMovimentacoesActionIcon} />
                                  )}
                                  Mudar para {situacao}
                                </div>
                              </DropdownMenuItem>
                            ))}

                            <DropdownMenuItem
                              onClick={() =>
                                setDeleteModal({
                                  isOpen: true,
                                  transacao: movimentacao,
                                })
                              }
                              className={`${styles.extratoMovimentacoesDropdownItem} danger`}
                            >
                              <Trash2 className={styles.extratoMovimentacoesActionIcon} />
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

          {/* Footer with totals and pagination */}
          <div className={styles.extratoMovimentacoesFooter}>
            {/* Totals */}
            <div className={styles.extratoMovimentacoesTotals}>
              <div className={styles.extratoMovimentacoesTotalsLeft}>
                <p className={styles.extratoMovimentacoesTotalsTitle}>
                  Totais do período
                </p>
                <p className={styles.extratoMovimentacoesTotalsDate}>
                  {selectedDate} a {selectedDate}
                </p>
              </div>
              <div className={styles.extratoMovimentacoesTotalsRight}>
                <p className={styles.extratoMovimentacoesTotalsLabel}>
                  Valor total do período (R$)
                </p>
                <p className={styles.extratoMovimentacoesTotalsValue}>
                  R$ {formatNumberWithThousands(totalPeriodo)}
                </p>
              </div>
            </div>

            {/* Pagination */}
            {filteredMovimentacoes.length > 0 && (
              <div className={styles.extratoMovimentacoesPagination}>
                <span className={styles.extratoMovimentacoesPaginationInfo}>
                  Mostrando {(currentPage - 1) * itemsPerPage + 1}
                  {" - "}
                  {Math.min(currentPage * itemsPerPage, filteredMovimentacoes.length)} de {filteredMovimentacoes.length}
                  {activeFilter !== "total" && (
                    <span className={styles.extratoMovimentacoesStatValueActive}> (filtrado)</span>
                  )}
                </span>
                <div className={styles.extratoMovimentacoesPaginationButtons}>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className={styles.extratoMovimentacoesPaginationSelect}
                    style={{ marginRight: 16 }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <button
                    className={styles.extratoMovimentacoesPaginationArrow}
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    aria-label="Primeira página"
                  >
                    {"<<"}
                  </button>
                  <button
                    className={styles.extratoMovimentacoesPaginationArrow}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    aria-label="Página anterior"
                  >
                    {"<"}
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={p === currentPage ? styles.extratoMovimentacoesPaginationButtonActive : styles.extratoMovimentacoesPaginationArrow}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    className={styles.extratoMovimentacoesPaginationArrow}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Próxima página"
                  >
                    {">"}
                  </button>
                  <button
                    className={styles.extratoMovimentacoesPaginationArrow}
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
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog
        open={deleteModal.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteModal({ isOpen: false, transacao: null });
          }
        }}
      >
        <DialogContent className={styles.extratoMovimentacoesDropdown}>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              <p>
                Você tem certeza que quer excluir &ldquo;
                {deleteModal.transacao?.descricao}&rdquo;?
              </p>
              {deleteModal.transacao?.origem === "pluggy" && (
                <p className="mt-2 text-sm">
                  Esta transação foi sincronizada do OpenFinance e será removida
                  permanentemente.
                </p>
              )}
              {deleteModal.transacao?.origem === "Importação OFX" && (
                <p className="mt-2 text-sm">
                  Esta transação foi importada via OFX e será removida
                  permanentemente.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteModal({ isOpen: false, transacao: null })}
              disabled={isDeleting}
              className={styles.extratoMovimentacoesSecondaryBtn}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTransacao}
              disabled={isDeleting}
              className={`${styles.extratoMovimentacoesDropdownItem} danger`}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drawers de Edição */}
      <EditReceitaDrawer
        isOpen={editReceitaDrawer.isOpen}
        onClose={handleCloseEditDrawers}
        onSave={handleSaveEdit}
        transacaoId={editReceitaDrawer.transacaoId || undefined}
      />

      <EditDespesaDrawer
        isOpen={editDespesaDrawer.isOpen}
        onClose={handleCloseEditDrawers}
        onSave={handleSaveEdit}
        transacaoId={editDespesaDrawer.transacaoId || undefined}
      />

      {/* Drawers de Nova Transação */}
      <NovaReceitaDrawer
        isOpen={novaReceitaDrawer}
        onClose={handleCloseNovosDrawers}
        onSave={handleSaveNovaTransacao}
      />

      <NovaDespesaDrawer
        isOpen={novaDespesaDrawer}
        onClose={handleCloseNovosDrawers}
        onSave={handleSaveNovaTransacao}
      />

      <NovaTransferenciaModal
        isOpen={novaTransferenciaModal}
        onClose={() => setNovaTransferenciaModal(false)}
        onSuccess={fetchTransacoes}
      />

      <ExportarMovimentacoes
        isOpen={exportarMovimentacoesModal}
        onClose={() => setExportarMovimentacoesModal(false)}
      />

      <ImportarMovimentacoes
        isOpen={importarMovimentacoesModal}
        onClose={() => setImportarMovimentacoesModal(false)}
        onImportSuccess={fetchTransacoes}
      />

      <DownloadPlanilhasModal
        isOpen={downloadPlanilhasModal}
        onClose={() => setDownloadPlanilhasModal(false)}
      />
      </div>
    </>
  );
}
