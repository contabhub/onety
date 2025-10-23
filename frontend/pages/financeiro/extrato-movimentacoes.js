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
import { EditReceitaDrawer } from "@/components/EditReceitaDrawer";
import { EditDespesaDrawer } from "@/components/EditDespesaDrawer";
import { NovaReceitaDrawer } from "@/components/NovaReceitaDrawer.js";
import { NovaDespesaDrawer } from "@/components/NovaDespesaDrawer.js";
import { NovaTransferenciaModal } from "@/components/financeiro/NovaTransferenciaModal";
import { ExportarMovimentacoes } from "@/components/financeiro/ExportarMovimentacoes";
import { ImportarMovimentacoes } from "@/components/financeiro/ImportarMovimentacoes";
import { DownloadPlanilhasModal } from "@/components/financeiro/DownloadPlanilhasModal";
import Image from "next/image";

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
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);

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
          <Badge className="badge-recebido-extrato">
            Recebido
          </Badge>
        );
      case "Vencido":
        return (
          <Badge className="badge-vencido-extrato">
            Vencido
          </Badge>
        );
      case "Pago":
        return (
          <Badge className="badge-pago-extrato">
            Pago
          </Badge>
        );
      case "Transferido":
        return (
          <Badge className="badge-transferido-extrato">
            Transferido
          </Badge>
        );
      case "Em Aberto":
        return (
          <Badge className="badge-em-aberto-extrato">
            Em Aberto
          </Badge>
        );
      default:
        return (
          <Badge className="badge-em-aberto-extrato">
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
      <div className="p-6 space-y-6 theme-bg-primary min-h-screen">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-20 h-20">
            <div className={styles.extratoMovimentacoesLoadingSpinner}>
              <div className={styles.extratoMovimentacoesLoadingSpinnerInner}></div>
            </div>
          </div>
          <p className="theme-text-secondary text-lg">Carregando movimentações...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6 theme-bg-primary min-h-screen">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="text-[#F50057] mb-4">
            <X className="h-12 w-12 mx-auto" />
          </div>
          <p className="theme-text-secondary text-lg mb-4">{error}</p>
          <Button
            onClick={fetchTransacoes}
            variant="outline"
            className="extrato-secondary-btn"
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 theme-bg-primary min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold theme-text-white">
            Extrato de movimentações
          </h1>
          <p className="theme-text-secondary mt-1">
            Visualize todas as movimentações financeiras
            {movimentacoes.some((m) => m.origem === "pluggy") && (
              <span className="ml-2">
                •{" "}
                <Badge className="badge-pluggy-extrato text-xs">
                  OpenFinance
                </Badge>
                {movimentacoes.filter((m) => m.origem === "pluggy").length}{" "}
                transações sincronizadas
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchTransacoes}
            disabled={isLoading}
            className="extrato-outline-btn"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {isLoading ? "Carregando..." : "Atualizar"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="extrato-primary-btn"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="extrato-dropdown"
            >
              <DropdownMenuItem
                onClick={handleOpenNovaReceita}
                className="extrato-dropdown-item"
              >
                <TrendingUp className="h-4 w-4 mr-2 text-[#1E88E5]" />
                Receita
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleOpenNovaDespesa}
                className="extrato-dropdown-item"
              >
                <TrendingDown className="h-4 w-4 mr-2 text-[#F50057]" />
                Despesa
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setNovaTransferenciaModal(true)}
                className="extrato-dropdown-item"
              >
                <ArrowRight className="h-4 w-4 mr-2 text-[#9C27B0]" />
                Transferência
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            className="extrato-outline-btn opacity-50"
            disabled
          >
            <FileText className="h-4 w-4 mr-2" />
            Relatórios
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportarMovimentacoesModal(true)}
            className="extrato-outline-btn"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportarMovimentacoesModal(true)}
            className="extrato-outline-btn"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar planilha
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDownloadPlanilhasModal(true)}
            className="extrato-outline-btn"
          >
            <FileText className="h-4 w-4 mr-2" />
            Planilhas
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled
            className="extrato-outline-btn opacity-50"
          >
            <Upload className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="extrato-filters-card">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            <div className="flex-1">
              <label className="text-sm font-medium theme-text-secondary mb-2 block">
                Período
              </label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth("prev")}
                  className="extrato-outline-btn"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <DropdownMenu open={isPeriodDropdownOpen} onOpenChange={setIsPeriodDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="extrato-outline-btn min-w-[140px] justify-between"
                    >
                      <span>{formatCurrentPeriod()}</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="center"
                    className="extrato-dropdown min-w-[160px]"
                  >
                    <DropdownMenuItem 
                      className="extrato-dropdown-item"
                      onClick={() => {
                        setPeriodFilter("week");
                        setIsPeriodDropdownOpen(false);
                      }}
                    >
                      Esta semana
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="extrato-dropdown-item"
                      onClick={() => {
                        setPeriodFilter("month");
                        setIsPeriodDropdownOpen(false);
                      }}
                    >
                      Este mês
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="extrato-dropdown-item"
                      onClick={() => {
                        setPeriodFilter("year");
                        setIsPeriodDropdownOpen(false);
                      }}
                    >
                      Este ano
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="extrato-dropdown-item"
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
                  className="extrato-outline-btn"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium theme-text-secondary mb-2 block">
                Pesquisar no período selecionado
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 theme-text-secondary" />
                <Input
                  placeholder="Pesquisar por descrição, categoria, cliente, valor (R$ 1.500,00) ou data (11/08/2025, 11/8/25)"
                  className="pl-10 extrato-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 theme-text-secondary hover:theme-text-accent hover:bg-[#673AB7]/10"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium theme-text-secondary mb-2 block">
                Conta
              </label>
              <Select
                value={selectedAccount}
                onValueChange={setSelectedAccount}
                disabled
              >
                <SelectTrigger className="extrato-select">
                  <SelectValue placeholder="Selecionar todas" />
                </SelectTrigger>
                <SelectContent className="extrato-dropdown">
                  <SelectItem
                    value="all"
                    className="extrato-select-option"
                  >
                    Selecionar todas
                  </SelectItem>
                  <SelectItem
                    value="bradesco"
                    className="extrato-select-option"
                  >
                    Banco Bradesco
                  </SelectItem>
                  <SelectItem
                    value="conta-azul"
                    className="extrato-select-option"
                  >
                    Conta Azul
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                disabled
                variant="outline"
                className="extrato-outline-btn opacity-50"
              >
                <Filter className="h-4 w-4 mr-2" />
                Mais filtros
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card
          className={`cursor-pointer extrato-card ${
            activeFilter === "receitas-aberto"
              ? "extrato-card-active"
              : ""
          }`}
          onClick={() => handleApplyFilter("receitas-aberto")}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium theme-text-secondary">
                Receitas em aberto (R$)
              </p>
              <p className="text-2xl font-bold theme-text-secondary">
                R$ {formatNumberWithThousands(receitasEmAberto)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer extrato-card ${
            activeFilter === "receitas-realizadas"
              ? "extrato-card-active"
              : ""
          }`}
          onClick={() => handleApplyFilter("receitas-realizadas")}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium theme-text-secondary">
                Receitas realizadas (R$)
              </p>
              <p className="text-2xl font-bold text-[#1E88E5]">
                R$ {formatNumberWithThousands(receitasRealizadas)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer extrato-card ${
            activeFilter === "despesas-aberto"
              ? "extrato-card-active"
              : ""
          }`}
          onClick={() => handleApplyFilter("despesas-aberto")}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium theme-text-secondary">
                Despesas em aberto (R$)
              </p>
              <p className="text-2xl font-bold theme-text-secondary">
                R$ {formatNumberWithThousands(despesasEmAberto)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer extrato-card ${
            activeFilter === "despesas-realizadas"
              ? "extrato-card-active"
              : ""
          }`}
          onClick={() => handleApplyFilter("despesas-realizadas")}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium theme-text-secondary">
                Despesas realizadas (R$)
              </p>
              <p className="text-2xl font-bold text-[#F50057]">
                R$ {formatNumberWithThousands(despesasRealizadas)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer extrato-card ${
            activeFilter === "vencidas"
              ? "extrato-card-active"
              : ""
          }`}
          onClick={() => handleApplyFilter("vencidas")}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium theme-text-secondary">
                Transações vencidas (R$)
              </p>
              <p className="text-2xl font-bold text-[#FFD600]">
                R$ {formatNumberWithThousands(transacoesVencidas)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer extrato-card ${
            activeFilter === "total"
              ? "extrato-card-active"
              : ""
          }`}
          onClick={() => handleApplyFilter("total")}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <p className="text-sm font-medium theme-text-secondary">
                  Total do período (R$)
                </p>
                <Info className="h-4 w-4 theme-text-secondary" />
              </div>
              <p className="text-2xl font-bold text-[#9C27B0]">
                R$ {formatNumberWithThousands(totalPeriodo)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm theme-text-secondary">
            {selectedItems.length} registro(s) selecionado(s)
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedItems.length === 0}
            className="extrato-outline-btn"
          >
            Pagar pelo CA de Bolso
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedItems.length === 0}
            className="extrato-outline-btn"
          >
            Ações em lote
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* Botão para limpar filtros */}
        {(activeFilter !== "total" || periodFilter !== "month") && (
          <div className="flex items-center gap-2">
            <span className="text-sm theme-text-secondary">
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
              className="extrato-outline-btn"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <Card className="extrato-table">
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="extrato-table-header">
                  <th className="text-left p-3 text-sm font-medium table-header-text-extrato">
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
                  <th className="text-left p-3 text-sm font-medium table-header-text-extrato">
                    <div className="flex items-center gap-1">
                      Data
                      <div className="flex flex-col">
                        <ArrowUp className="h-3 w-3 theme-text-secondary" />
                        <ArrowDown className="h-3 w-3 theme-text-secondary" />
                      </div>
                    </div>
                  </th>
                  <th className="text-left p-3 text-sm font-medium table-header-text-extrato">
                    Descrição
                  </th>
                  <th className="text-left p-3 text-sm font-medium table-header-text-extrato">
                    Situação
                  </th>
                  <th className="text-right p-3 text-sm font-medium table-header-text-extrato">
                    Valor (R$)
                  </th>
                  <th className="text-left p-3 text-sm font-medium table-header-text-extrato">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedMovimentacoes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 theme-text-secondary">
                      <div className="flex flex-col items-center ">
                        <Image
                          src="/nenhuma.png"
                          alt="Nenhuma movimentação"
                          width={128}
                          height={128}
                          className="w-32 h-32"
                        />
                        <p>Nenhuma movimentação encontrada</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedMovimentacoes.map((movimentacao) => (
                    <tr
                      key={movimentacao.id}
                      className="extrato-table-row"
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedItems.includes(movimentacao.id)}
                          onChange={() => handleSelectItem(movimentacao.id)}
                        />
                      </td>
                      <td className="p-3 text-sm table-cell-primary-extrato">
                        {movimentacao.data}
                      </td>
                      <td className="p-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium table-cell-primary-extrato">
                              {movimentacao.descricao}
                            </p>
                            {movimentacao.origem === "pluggy" && (
                              <Badge className="badge-pluggy-extrato text-xs">
                                OpenFinance
                              </Badge>
                            )}
                            {movimentacao.origem === "Importação OFX" && (
                              <Badge className="badge-ofx-extrato text-xs">
                                OFX
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs table-cell-secondary-extrato">
                          {movimentacao.cliente}
                          </p>
                          {movimentacao.cliente && (
                            <p className="text-xs cliente-text-extrato">
                              {movimentacao.categoria}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {getStatusBadge(movimentacao.situacao)}
                      </td>
                      <td className="p-3 text-right">
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
                            <Mail className="h-4 w-4 theme-text-secondary" />
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUpdatingSituacao === movimentacao.id}
                              className="extrato-action-btn"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="extrato-dropdown"
                          >
                            <DropdownMenuItem
                              onClick={() => handleEditTransacao(movimentacao)}
                              disabled={movimentacao.origem === "pluggy" || movimentacao.origem === "Importação OFX"}
                              className={`${
                                movimentacao.origem === "pluggy" || movimentacao.origem === "Importação OFX"
                                  ? "extrato-dropdown-item opacity-50 cursor-not-allowed"
                                  : "extrato-dropdown-item"
                              }`}
                            >
                              <Edit className="h-4 w-4 mr-2" />
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
                                className="extrato-dropdown-item"
                              >
                                <div className="flex items-center">
                                  {isUpdatingSituacao === movimentacao.id ? (
                                    <div className="h-4 w-4 mr-2 animate-spin rounded border-2 border-[#1E88E5] border-t-transparent" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4 mr-2 text-[#1E88E5]" />
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
                              className="extrato-dropdown-item"
                            >
                              <Trash2 className="h-4 w-4 mr-2 text-[#F50057]" />
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
          <div className="mt-6 pt-4 table-footer-border-extrato space-y-4">
            {/* Totals */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium table-footer-text-extrato">
                  Totais do período
                </p>
                <p className="text-xs table-footer-secondary-extrato">
                  {selectedDate} a {selectedDate}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium table-footer-secondary-extrato">
                  Valor total do período (R$)
                </p>
                <p className="text-lg font-bold table-footer-accent-extrato">
                  R$ {formatNumberWithThousands(totalPeriodo)}
                </p>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => setItemsPerPage(Number(value))}
                  >
                    <SelectTrigger className="w-16 extrato-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="extrato-dropdown">
                      <SelectItem
                        value="25"
                        className="extrato-select-option"
                      >
                        25
                      </SelectItem>
                      <SelectItem
                        value="50"
                        className="extrato-select-option"
                      >
                        50
                      </SelectItem>
                      <SelectItem
                        value="100"
                        className="extrato-select-option"
                      >
                        100
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm table-footer-secondary-extrato">
                    Registros por página
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="extrato-pagination-btn disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from(
                      { length: Math.min(5, totalPages) },
                      (_, i) => i + 1
                    ).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 p-0 ${
                          currentPage === page
                            ? "extrato-pagination-btn-active"
                            : "extrato-pagination-btn"
                        }`}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="extrato-pagination-btn disabled:opacity-30"
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#1E88E5] hover:text-[#1E88E5] hover:bg-[#1E88E5]/10"
                  >
                    <ArrowUp className="h-4 w-4 mr-1" />
                    Voltar ao topo
                  </Button>
                  <Select value="1 - 25 de 140" onValueChange={() => {}}>
                    <SelectTrigger className="w-32 extrato-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="extrato-dropdown">
                      <SelectItem
                        value="1 - 25 de 140"
                        className="extrato-select-option"
                      >
                        1 - 25 de 140
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Ir para página"
                    className="w-24 extrato-input"
                  />
                  <Button
                    size="sm"
                    className="extrato-primary-btn"
                  >
                    Ok
                  </Button>
                </div>
              </div>

              <p className="text-sm table-footer-secondary-extrato">
                Mostrando {startIndex + 1} -{" "}
                {Math.min(
                  startIndex + itemsPerPage,
                  filteredMovimentacoes.length
                )}{" "}
                de {filteredMovimentacoes.length} registros
                {activeFilter !== "total" && (
                  <span className="table-footer-accent-extrato ml-1">(filtrado)</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog
        open={deleteModal.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteModal({ isOpen: false, transacao: null });
          }
        }}
      >
        <DialogContent className="extrato-modal">
          <DialogHeader className="extrato-modal-header">
            <DialogTitle className="theme-text-white">Confirmar Exclusão</DialogTitle>
            <DialogDescription className="theme-text-secondary">
              <p>
                Você tem certeza que quer excluir &ldquo;
                {deleteModal.transacao?.descricao}&rdquo;?
              </p>
              {deleteModal.transacao?.origem === "pluggy" && (
                <p className="mt-2 text-sm theme-text-secondary">
                  Esta transação foi sincronizada do OpenFinance e será removida
                  permanentemente.
                </p>
              )}
              {deleteModal.transacao?.origem === "Importação OFX" && (
                <p className="mt-2 text-sm theme-text-secondary">
                  Esta transação foi importada via OFX e será removida
                  permanentemente.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="extrato-modal-footer">
            <Button
              variant="outline"
              onClick={() => setDeleteModal({ isOpen: false, transacao: null })}
              disabled={isDeleting}
              className="extrato-outline-btn"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTransacao}
              disabled={isDeleting}
              className="bg-[#F50057] hover:bg-[#D1004E] text-white"
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
  );
}
