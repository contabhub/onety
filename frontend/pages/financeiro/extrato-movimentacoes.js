"use client";

import { useState, useEffect } from "react";
import styles from "../../styles/financeiro/extrato-movimentacoes.module.css";
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
  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    movimentacao: null,
  });
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  // Estados para filtros de data
  const [currentDate, setCurrentDate] = useState(new Date());
  const [periodFilter, setPeriodFilter] = useState("month");

  // Estados para dropdowns customizados
  const [isNovaDropdownOpen, setIsNovaDropdownOpen] = useState(false);
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const [isAccountSelectOpen, setIsAccountSelectOpen] = useState(false);

  // Função para buscar transações da API
  const fetchTransacoes = async () => {
    try {
      setIsLoading(true);
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      const empresaId = userData.EmpresaId || localStorage.getItem("empresaId");
      const token = localStorage.getItem("token");

      if (!empresaId || !token) {
        console.error("EmpresaId ou token não encontrado no localStorage");
        setError("Credenciais não encontradas. Faça login novamente.");
        setIsLoading(false);
        return;
      }

      // Buscar dados da rota transacoes (empresa)
      const responseEmpresa = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/financeiro/transacoes/empresa/${empresaId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Buscar dados da rota transacoes-api (Pluggy)
      const responsePluggy = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/financeiro/transacoes-api/company/${empresaId}/transacoes`,
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
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      const empresaId = userData.EmpresaId || localStorage.getItem("empresaId");
      const token = localStorage.getItem("token");

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
          `${process.env.NEXT_PUBLIC_API_URL}/financeiro/transacoes-api/company/${empresaId}/transacoes`,
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
          `${process.env.NEXT_PUBLIC_API_URL}/financeiro/transacoes-api/company/${empresaId}/transacao/${pluggyId}`,
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
          `${process.env.NEXT_PUBLIC_API_URL}/financeiro/transacoes/${idEmpresa}/situacao`,
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
          `${process.env.NEXT_PUBLIC_API_URL}/financeiro/transacoes/${idEmpresa}/situacao`,
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

  // Função para abrir dropdown e calcular posição
  const handleToggleDropdown = (event, movimentacaoId) => {
    event.stopPropagation();
    if (openDropdown === movimentacaoId) {
      setOpenDropdown(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
      setOpenDropdown(movimentacaoId);
    }
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown && !event.target.closest(`[data-dropdown-id="${openDropdown}"]`)) {
        setOpenDropdown(null);
      }
      
      // Fechar dropdowns customizados
      if (!event.target.closest('.nova-dropdown')) {
        setIsNovaDropdownOpen(false);
      }
      if (!event.target.closest('.period-dropdown')) {
        setIsPeriodDropdownOpen(false);
      }
      if (!event.target.closest('.account-select')) {
        setIsAccountSelectOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

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
          <span className={`${styles.badgeComponent} ${styles.extratoMovimentacoesBadgePago}`}>
            Recebido
          </span>
        );
      case "Vencido":
        return (
          <span className={`${styles.badgeComponent} ${styles.extratoMovimentacoesBadgeVencido}`}>
            Vencido
          </span>
        );
      case "Pago":
        return (
          <span className={`${styles.badgeComponent} ${styles.extratoMovimentacoesBadgePago}`}>
            Pago
          </span>
        );
      case "Transferido":
        return (
          <span className={`${styles.badgeComponent} ${styles.extratoMovimentacoesBadgeConciliado}`}>
            Transferido
          </span>
        );
      case "Em Aberto":
        return (
          <span className={`${styles.badgeComponent} ${styles.extratoMovimentacoesBadgeEmAberto}`}>
            Em Aberto
          </span>
        );
      default:
        return (
          <span className={`${styles.badgeComponent} ${styles.extratoMovimentacoesBadgeEmAberto}`}>
            {situacao}
          </span>
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
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      const empresaId = userData.EmpresaId || localStorage.getItem("empresaId");
      const token = localStorage.getItem("token");

      if (!token || !empresaId) {
        setError("Token ou empresaId não encontrado. Faça login novamente.");
        return;
      }

      let response;

      if (deleteModal.transacao.origem === "pluggy") {
        // Para transações Pluggy, usar a rota transacoes-api
        const pluggyId = deleteModal.transacao.id.replace("pluggy_", "");
        response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/financeiro/transacoes-api/company/${empresaId}/transacao/${pluggyId}`,
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
          `${process.env.NEXT_PUBLIC_API_URL}/financeiro/transacoes/${transacaoId}`,
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
          `${process.env.NEXT_PUBLIC_API_URL}/financeiro/transacoes/${transacaoId}`,
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
            {movimentacoes.some((m) => m.origem === "pluggy") && (
              <span className={styles.extratoMovimentacoesInlineSpan}>
                •{" "}
                <span className={`${styles.badgeComponent} ${styles.extratoMovimentacoesBadgePluggy}`}>
                  OpenFinance
                </span>
                {movimentacoes.filter((m) => m.origem === "pluggy").length}{" "}
                transações sincronizadas
              </span>
            )}
          </p>
        </div>
        <div className={styles.extratoMovimentacoesHeaderActions}>
          <button
            onClick={fetchTransacoes}
            disabled={isLoading}
            className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.buttonSmall} ${styles.extratoMovimentacoesSecondaryBtn}`}
          >
            <RefreshCw className={styles.extratoMovimentacoesActionIcon} />
            {isLoading ? "Carregando..." : "Atualizar"}
          </button>
          <div className={`${styles.dropdownComponent} nova-dropdown`}>
            <button
              onClick={() => setIsNovaDropdownOpen(!isNovaDropdownOpen)}
              className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.buttonSmall} ${styles.extratoMovimentacoesSecondaryBtn}`}
            >
              <Plus className={styles.extratoMovimentacoesActionIcon} />
              Nova
              <ChevronDown className={styles.extratoMovimentacoesActionIcon} />
            </button>
            {isNovaDropdownOpen && (
              <div className={`${styles.dropdownContent} ${styles.dropdownRight} ${styles.extratoMovimentacoesDropdown}`}>
                <button
                  onClick={() => {
                    handleOpenNovaReceita();
                    setIsNovaDropdownOpen(false);
                  }}
                  className={`${styles.dropdownItem} ${styles.extratoMovimentacoesDropdownItem}`}
                >
                  <TrendingUp className={styles.extratoMovimentacoesActionIcon} />
                  Receita
                </button>
                <button
                  onClick={() => {
                    handleOpenNovaDespesa();
                    setIsNovaDropdownOpen(false);
                  }}
                  className={`${styles.dropdownItem} ${styles.extratoMovimentacoesDropdownItem}`}
                >
                  <TrendingDown className={styles.extratoMovimentacoesActionIcon} />
                  Despesa
                </button>
                <button
                  onClick={() => {
                    setNovaTransferenciaModal(true);
                    setIsNovaDropdownOpen(false);
                  }}
                  className={`${styles.dropdownItem} ${styles.extratoMovimentacoesDropdownItem}`}
                >
                  <ArrowRight className={styles.extratoMovimentacoesActionIcon} />
                  Transferência
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setExportarMovimentacoesModal(true)}
            className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.buttonSmall} ${styles.extratoMovimentacoesExportBtn}`}
          >
            <Download className={styles.extratoMovimentacoesActionIcon} />
            Exportar
          </button>
          <button
            onClick={() => setImportarMovimentacoesModal(true)}
            className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.buttonSmall} ${styles.extratoMovimentacoesImportBtn}`}
          >
            <Upload className={styles.extratoMovimentacoesActionIcon} />
            Importar
          </button>
          <button
            onClick={() => setDownloadPlanilhasModal(true)}
            className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.buttonSmall} ${styles.extratoMovimentacoesOfxBtn}`}
          >
            <FileText className={styles.extratoMovimentacoesActionIcon} />
            Planilhas
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={`${styles.cardComponent} ${styles.extratoMovimentacoesFiltersCard}`}>
        <div className={`${styles.cardContent} ${styles.extratoMovimentacoesFiltersContent}`}>
          <div className={styles.extratoMovimentacoesFiltersRow}>
            <div className={styles.extratoMovimentacoesFilterGroup}>
              <label className={styles.extratoMovimentacoesFilterLabel}>
                Período
              </label>
              <div className={styles.extratoMovimentacoesPeriodContainer}>
                <button
                  onClick={() => navigateMonth("prev")}
                  className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.buttonSmall} ${styles.extratoMovimentacoesNavBtn}`}
                >
                  <ChevronLeft className={styles.extratoMovimentacoesNavIcon} />
                </button>
                
                <div className={`${styles.dropdownComponent} period-dropdown`}>
                  <button
                    onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
                    className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.buttonSmall} ${styles.extratoMovimentacoesPeriodButton}`}
                  >
                    <span>{formatCurrentPeriod()}</span>
                    <ChevronDown className={styles.extratoMovimentacoesNavIcon} />
                  </button>
                  {isPeriodDropdownOpen && (
                    <div className={`${styles.dropdownContent} ${styles.dropdownCenter} ${styles.extratoMovimentacoesDropdown}`}>
                      <button
                        onClick={() => {
                          setPeriodFilter("week");
                          setIsPeriodDropdownOpen(false);
                        }}
                        className={`${styles.dropdownItem} ${styles.extratoMovimentacoesDropdownItem}`}
                      >
                        Esta semana
                      </button>
                      <button
                        onClick={() => {
                          setPeriodFilter("month");
                          setIsPeriodDropdownOpen(false);
                        }}
                        className={`${styles.dropdownItem} ${styles.extratoMovimentacoesDropdownItem}`}
                      >
                        Este mês
                      </button>
                      <button
                        onClick={() => {
                          setPeriodFilter("year");
                          setIsPeriodDropdownOpen(false);
                        }}
                        className={`${styles.dropdownItem} ${styles.extratoMovimentacoesDropdownItem}`}
                      >
                        Este ano
                      </button>
                      <button
                        onClick={() => {
                          setPeriodFilter("all");
                          setIsPeriodDropdownOpen(false);
                        }}
                        className={`${styles.dropdownItem} ${styles.extratoMovimentacoesDropdownItem}`}
                      >
                        Todo o período
                      </button>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => navigateMonth("next")}
                  className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.buttonSmall} ${styles.extratoMovimentacoesNavBtn}`}
                >
                  <ChevronRight className={styles.extratoMovimentacoesNavIcon} />
                </button>
              </div>
            </div>
            <div className={styles.extratoMovimentacoesFilterGroup}>
              <label className={styles.extratoMovimentacoesFilterLabel}>
                Pesquisar no período selecionado
              </label>
              <div className={styles.extratoMovimentacoesSearchContainer}>
                <Search className={styles.extratoMovimentacoesSearchIcon} size={16} />
                <input
                  type="text"
                  placeholder="Pesquisar por descrição, categoria, cliente, valor (R$ 1.500,00) ou data (11/08/2025, 11/8/25)"
                  className={styles.extratoMovimentacoesSearchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.extratoMovimentacoesFilterGroup}>
              <label className={styles.extratoMovimentacoesFilterLabel}>
                Conta
              </label>
              <div className={`${styles.selectComponent} account-select`}>
                <button
                  onClick={() => setIsAccountSelectOpen(!isAccountSelectOpen)}
                  disabled
                  className={`${styles.selectTrigger} ${styles.extratoMovimentacoesSearchInput} ${styles.buttonDisabled}`}
                >
                  <span className={styles.selectValue}>
                    {selectedAccount === "all" ? "Selecionar todas" : 
                     selectedAccount === "bradesco" ? "Banco Bradesco" :
                     selectedAccount === "conta-azul" ? "Conta Azul" : 
                     "Selecionar todas"}
                  </span>
                  <ChevronDown className={styles.selectIcon} />
                </button>
                {isAccountSelectOpen && (
                  <div className={`${styles.selectContent} ${styles.extratoMovimentacoesDropdown}`}>
                    <button
                      onClick={() => {
                        setSelectedAccount("all");
                        setIsAccountSelectOpen(false);
                      }}
                      className={`${styles.selectItem} ${styles.extratoMovimentacoesDropdownItem}`}
                    >
                      Selecionar todas
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAccount("bradesco");
                        setIsAccountSelectOpen(false);
                      }}
                      className={`${styles.selectItem} ${styles.extratoMovimentacoesDropdownItem}`}
                    >
                      Banco Bradesco
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAccount("conta-azul");
                        setIsAccountSelectOpen(false);
                      }}
                      className={`${styles.selectItem} ${styles.extratoMovimentacoesDropdownItem}`}
                    >
                      Conta Azul
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.extratoMovimentacoesStatsGrid}>
        <div
          className={`${styles.cardComponent} ${styles.extratoMovimentacoesStatCard} ${
            activeFilter === "receitas-aberto"
              ? styles.extratoMovimentacoesStatCardActive
              : styles.extratoMovimentacoesStatCardInactive
          }`}
          onClick={() => handleApplyFilter("receitas-aberto")}
        >
          <div className={`${styles.cardContent} ${styles.extratoMovimentacoesStatCardContent}`}>
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
          </div>
        </div>

        <div
          className={`${styles.cardComponent} ${styles.extratoMovimentacoesStatCard} ${
            activeFilter === "receitas-realizadas"
              ? styles.extratoMovimentacoesStatCardActive
              : styles.extratoMovimentacoesStatCardInactive
          }`}
          onClick={() => handleApplyFilter("receitas-realizadas")}
        >
          <div className={`${styles.cardContent} ${styles.extratoMovimentacoesStatCardContent}`}>
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
          </div>
        </div>

        <div
          className={`${styles.cardComponent} ${styles.extratoMovimentacoesStatCard} ${
            activeFilter === "despesas-aberto"
              ? styles.extratoMovimentacoesStatCardActive
              : styles.extratoMovimentacoesStatCardInactive
          }`}
          onClick={() => handleApplyFilter("despesas-aberto")}
        >
          <div className={`${styles.cardContent} ${styles.extratoMovimentacoesStatCardContent}`}>
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
          </div>
        </div>

        <div
          className={`${styles.cardComponent} ${styles.extratoMovimentacoesStatCard} ${
            activeFilter === "despesas-realizadas"
              ? styles.extratoMovimentacoesStatCardActive
              : styles.extratoMovimentacoesStatCardInactive
          }`}
          onClick={() => handleApplyFilter("despesas-realizadas")}
        >
          <div className={`${styles.cardContent} ${styles.extratoMovimentacoesStatCardContent}`}>
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
          </div>
        </div>

        <div
          className={`${styles.cardComponent} ${styles.extratoMovimentacoesStatCard} ${
            activeFilter === "vencidas"
              ? styles.extratoMovimentacoesStatCardActive
              : styles.extratoMovimentacoesStatCardInactive
          }`}
          onClick={() => handleApplyFilter("vencidas")}
        >
          <div className={`${styles.cardContent} ${styles.extratoMovimentacoesStatCardContent}`}>
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
          </div>
        </div>

        <div
          className={`${styles.cardComponent} ${styles.extratoMovimentacoesStatCard} ${
            activeFilter === "total"
              ? styles.extratoMovimentacoesStatCardActive
              : styles.extratoMovimentacoesStatCardInactive
          }`}
          onClick={() => handleApplyFilter("total")}
        >
          <div className={`${styles.cardContent} ${styles.extratoMovimentacoesStatCardContent}`}>
            <div className={styles.extratoMovimentacoesStatCardInner}>
              <div className={styles.extratoMovimentacoesStatCardInfo}>
                <div className={styles.extratoMovimentacoesFlexCenter}>
                  <p className={styles.extratoMovimentacoesStatCardTitle}>
                    Total do período (R$)
                  </p>
                </div>
                <p className={`${styles.extratoMovimentacoesStatCardValue} ${styles.extratoMovimentacoesStatValueActive}`}>
                  R$ {formatNumberWithThousands(totalPeriodo)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.extratoMovimentacoesActions}>
        <div className={styles.extratoMovimentacoesActionsLeft}>
          <span className={styles.extratoMovimentacoesTableFooterSecondary}>
            {selectedItems.length} registro(s) selecionado(s)
          </span>
          <button
            disabled={selectedItems.length === 0}
            className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.buttonSmall} ${styles.extratoMovimentacoesSecondaryBtn} ${selectedItems.length === 0 ? styles.buttonDisabled : ''}`}
          >
            Pagar pelo CA de Bolso
          </button>
          <button
            disabled={selectedItems.length === 0}
            className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.buttonSmall} ${styles.extratoMovimentacoesSecondaryBtn} ${selectedItems.length === 0 ? styles.buttonDisabled : ''}`}
          >
            Ações em lote
            <ChevronDown className={styles.extratoMovimentacoesActionIcon} />
          </button>
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
            <button
              onClick={() => {
                handleClearFilters();
                setPeriodFilter("month");
                setCurrentDate(new Date());
              }}
              className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.buttonSmall} ${styles.extratoMovimentacoesSecondaryBtn}`}
            >
              <X className={styles.extratoMovimentacoesActionIcon} />
              Limpar filtros
            </button>
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
                      className={styles.extratoMovimentacoesCheckbox}
                      checked={
                        selectedItems.length ===
                          paginatedMovimentacoes.length &&
                        paginatedMovimentacoes.length > 0
                      }
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className={styles.extratoMovimentacoesTableHeaderText}>
                    <div className={styles.extratoMovimentacoesFlexItemsCenter}>
                      Data
                      <div className={styles.extratoMovimentacoesFlexCol}>
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
                      <div className={styles.extratoMovimentacoesFlexColCenter}>
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
                          className={styles.extratoMovimentacoesCheckbox}
                          checked={selectedItems.includes(movimentacao.id)}
                          onChange={() => handleSelectItem(movimentacao.id)}
                        />
                      </td>
                      <td className={styles.extratoMovimentacoesTableCellPrimary}>
                        {movimentacao.data}
                      </td>
                      <td className={styles.extratoMovimentacoesTableCell}>
                        <div className={styles.extratoMovimentacoesFlexItemsCenterGap2}>
                          <button
                            onClick={() => setDetailModal({ isOpen: true, movimentacao })}
                            className={styles.extratoMovimentacoesVerCompletoBtn}
                          >
                            Ver completo
                          </button>
                            {movimentacao.origem === "pluggy" && (
                              <span className={`${styles.badgeComponent} ${styles.extratoMovimentacoesBadgePluggy}`}>
                                OpenFinance
                              </span>
                            )}
                            {movimentacao.origem === "Importação OFX" && (
                              <span className={`${styles.badgeComponent} ${styles.extratoMovimentacoesBadgeOfx}`}>
                                OFX
                              </span>
                          )}
                        </div>
                      </td>
                      <td className={styles.extratoMovimentacoesTableCell}>
                        {getStatusBadge(movimentacao.situacao)}
                      </td>
                      <td className={styles.extratoMovimentacoesTableCellValue}>
                        <div className={styles.extratoMovimentacoesFlexEnd}>
                          <span
                            className={`${styles.extratoMovimentacoesTextSm} ${styles.extratoMovimentacoesFontMedium} ${getValueColor(
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
                        <button
                          onClick={(e) => handleToggleDropdown(e, movimentacao.id)}
                          disabled={isUpdatingSituacao === movimentacao.id}
                          className={styles.extratoMovimentacoesActionBtn}
                          data-dropdown-id={movimentacao.id}
                        >
                          <MoreVertical className={styles.extratoMovimentacoesActionIcon} />
                        </button>
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
                    className={`${styles.extratoMovimentacoesPaginationSelect} ${styles.extratoMovimentacoesPaginationSelectMargin}`}
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

      {/* Dropdown Flutuante */}
      {openDropdown && paginatedMovimentacoes.find(m => m.id === openDropdown) && (
        <div 
          className={styles.extratoMovimentacoesDropdown}
          style={{
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`
          }}
          data-dropdown-id={openDropdown}
        >
          {(() => {
            const movimentacao = paginatedMovimentacoes.find(m => m.id === openDropdown);
            if (!movimentacao) return null;
            
            return (
              <>
                <button
                  onClick={() => {
                    handleEditTransacao(movimentacao);
                    setOpenDropdown(null);
                  }}
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
                </button>

                {/* Opções de mudança de situação */}
                {getSituacaoOptions(
                  movimentacao.situacao,
                  movimentacao.tipo,
                  movimentacao.origem
                ).map((situacao) => (
                  <button
                    key={situacao}
                    onClick={() => {
                      handleUpdateSituacao(
                        movimentacao.id,
                        situacao
                      );
                      setOpenDropdown(null);
                    }}
                    disabled={
                      isUpdatingSituacao === movimentacao.id
                    }
                    className={styles.extratoMovimentacoesDropdownItem}
                  >
                    <div className={styles.extratoMovimentacoesFlexItemsCenter}>
                      {isUpdatingSituacao === movimentacao.id ? (
                        <div className={styles.extratoMovimentacoesInlineLoadingSpinner} />
                      ) : (
                        <CheckCircle className={styles.extratoMovimentacoesActionIcon} />
                      )}
                      Mudar para {situacao}
                    </div>
                  </button>
                ))}

                <button
                  onClick={() => {
                    setDeleteModal({
                      isOpen: true,
                      transacao: movimentacao,
                    });
                    setOpenDropdown(null);
                  }}
                  className={`${styles.extratoMovimentacoesDropdownItem} danger`}
                >
                  <Trash2 className={styles.extratoMovimentacoesActionIcon} />
                  Excluir
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Modal de Detalhes da Movimentação */}
      {detailModal.isOpen && (
        <div className={styles.extratoMovimentacoesModalContainer}>
          <div 
            className={styles.extratoMovimentacoesModalOverlay}
            onClick={() => setDetailModal({ isOpen: false, movimentacao: null })}
          />
          <div className={styles.extratoMovimentacoesModalContent}>
            <div className={styles.extratoMovimentacoesModalHeader}>
              <h3 className={styles.extratoMovimentacoesModalTitle}>Detalhes da Movimentação</h3>
            </div>
            {detailModal.movimentacao && (
              <div className={styles.extratoMovimentacoesModalDetails}>
                <div className={styles.extratoMovimentacoesDetailRow}>
                  <span className={styles.extratoMovimentacoesDetailLabel}>Descrição:</span>
                  <span className={styles.extratoMovimentacoesDetailValue}>
                    {detailModal.movimentacao.descricao}
                  </span>
                </div>
                <div className={styles.extratoMovimentacoesDetailRow}>
                  <span className={styles.extratoMovimentacoesDetailLabel}>Data:</span>
                  <span className={styles.extratoMovimentacoesDetailValue}>
                    {detailModal.movimentacao.data}
                  </span>
                </div>
                <div className={styles.extratoMovimentacoesDetailRow}>
                  <span className={styles.extratoMovimentacoesDetailLabel}>Categoria:</span>
                  <span className={styles.extratoMovimentacoesDetailValue}>
                    {detailModal.movimentacao.categoria || "Sem categoria"}
                  </span>
                </div>
                {detailModal.movimentacao.cliente && (
                  <div className={styles.extratoMovimentacoesDetailRow}>
                    <span className={styles.extratoMovimentacoesDetailLabel}>Cliente:</span>
                    <span className={styles.extratoMovimentacoesDetailValue}>
                      {detailModal.movimentacao.cliente}
                    </span>
                  </div>
                )}
                <div className={styles.extratoMovimentacoesDetailRow}>
                  <span className={styles.extratoMovimentacoesDetailLabel}>Situação:</span>
                  <span className={styles.extratoMovimentacoesDetailValue}>
                    {getStatusBadge(detailModal.movimentacao.situacao)}
                  </span>
                </div>
                <div className={styles.extratoMovimentacoesDetailRow}>
                  <span className={styles.extratoMovimentacoesDetailLabel}>Tipo:</span>
                  <span className={styles.extratoMovimentacoesDetailValue}>
                    {detailModal.movimentacao.tipo === "receita" ? "Receita" : 
                     detailModal.movimentacao.tipo === "despesa" ? "Despesa" : 
                     "Transferência"}
                  </span>
                </div>
                <div className={styles.extratoMovimentacoesDetailRow}>
                  <span className={styles.extratoMovimentacoesDetailLabel}>Valor:</span>
                  <span className={`${styles.extratoMovimentacoesDetailValue} ${getValueColor(
                    detailModal.movimentacao.valor,
                    detailModal.movimentacao.tipo
                  )}`}>
                    {formatCurrency(detailModal.movimentacao.valor, detailModal.movimentacao.tipo)}
                  </span>
                </div>
                <div className={styles.extratoMovimentacoesDetailRow}>
                  <span className={styles.extratoMovimentacoesDetailLabel}>Origem:</span>
                  <span className={styles.extratoMovimentacoesDetailValue}>
                    {detailModal.movimentacao.origem === "pluggy" ? "OpenFinance" :
                     detailModal.movimentacao.origem === "Importação OFX" ? "Importação OFX" :
                     "Empresa"}
                  </span>
                </div>
              </div>
            )}
            <div className={styles.extratoMovimentacoesModalFooter}>
              <button
                onClick={() => setDetailModal({ isOpen: false, movimentacao: null })}
                className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.extratoMovimentacoesSecondaryBtn}`}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteModal.isOpen && (
        <div className={styles.extratoMovimentacoesModalContainer}>
          <div 
            className={styles.extratoMovimentacoesModalOverlay}
            onClick={() => !isDeleting && setDeleteModal({ isOpen: false, transacao: null })}
          />
          <div className={styles.extratoMovimentacoesModalContent}>
            <div className={styles.extratoMovimentacoesModalHeader}>
              <h3 className={styles.extratoMovimentacoesModalTitle}>Confirmar Exclusão</h3>
            </div>
            <div className={styles.extratoMovimentacoesModalDetails}>
              <div className={styles.extratoMovimentacoesDetailRow}>
                <p className={styles.extratoMovimentacoesDetailValue}>
                Você tem certeza que quer excluir &ldquo;
                {deleteModal.transacao?.descricao}&rdquo;?
              </p>
              </div>
              {deleteModal.transacao?.origem === "pluggy" && (
                <div className={styles.extratoMovimentacoesDetailRow}>
                  <p className={styles.extratoMovimentacoesModalText}>
                  Esta transação foi sincronizada do OpenFinance e será removida
                  permanentemente.
                </p>
                </div>
              )}
              {deleteModal.transacao?.origem === "Importação OFX" && (
                <div className={styles.extratoMovimentacoesDetailRow}>
                  <p className={styles.extratoMovimentacoesModalText}>
                  Esta transação foi importada via OFX e será removida
                  permanentemente.
                </p>
                </div>
              )}
            </div>
            <div className={styles.extratoMovimentacoesModalFooter}>
              <button
                onClick={() => !isDeleting && setDeleteModal({ isOpen: false, transacao: null })}
                disabled={isDeleting}
                className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.extratoMovimentacoesSecondaryBtn} ${isDeleting ? styles.buttonDisabled : ''}`}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteTransacao}
                disabled={isDeleting}
                className={`${styles.extratoMovimentacoesDeleteBtn} ${isDeleting ? styles.buttonDisabled : ''}`}
              >
                {isDeleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

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
