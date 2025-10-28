"use client";

import React, { useState, useEffect, useRef } from "react";

// Adicionar estilos CSS para a animação do spinner
const spinnerStyles = `
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

// Injetar os estilos no head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = spinnerStyles;
  document.head.appendChild(styleElement);
}

// Estilos personalizados para o Toastify
const toastStyles = `
  .custom-toast {
    background-color: #1a1a1a !important;
    color: #ffffff !important;
    border: 1px solid #333333 !important;
    border-radius: 8px !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
  }
  
  .custom-toast .Toastify__toast-body {
    color: #ffffff !important;
    font-family: inherit !important;
    font-weight: 500 !important;
  }
  
  .custom-toast .Toastify__progress-bar {
    background-color: var(--onity-primary) !important;
  }
  
  .custom-toast .Toastify__close-button {
    color: #888888 !important;
  }
  
  .custom-toast .Toastify__close-button:hover {
    color: #ffffff !important;
  }
  
  /* Estilos para os ícones dos toasts */
  .custom-toast .Toastify__toast-icon {
    margin-right: 12px !important;
  }
  
  .custom-toast .Toastify__toast-icon svg {
    width: 20px !important;
    height: 20px !important;
  }
  
  /* Sobrescrever cores específicas dos tipos de toast */
  .Toastify__toast--success.custom-toast {
    background-color: #1a1a1a !important;
    border-left: 4px solid #10b981 !important;
  }
  
  .Toastify__toast--success.custom-toast .Toastify__toast-icon {
    color: #10b981 !important;
  }
  
  .Toastify__toast--error.custom-toast {
    background-color: #1a1a1a !important;
    border-left: 4px solid #ef4444 !important;
  }
  
  .Toastify__toast--error.custom-toast .Toastify__toast-icon {
    color: #ef4444 !important;
  }
  
  .Toastify__toast--warning.custom-toast {
    background-color: #1a1a1a !important;
    border-left: 4px solid #f59e0b !important;
  }
  
  .Toastify__toast--warning.custom-toast .Toastify__toast-icon {
    color: #f59e0b !important;
  }
  
  .Toastify__toast--info.custom-toast {
    background-color: #1a1a1a !important;
    border-left: 4px solid #3b82f6 !important;
  }
  
  .Toastify__toast--info.custom-toast .Toastify__toast-icon {
    color: #3b82f6 !important;
  }
`;

// Injetar os estilos do toast
if (typeof document !== 'undefined') {
  const toastStyleElement = document.createElement('style');
  toastStyleElement.textContent = toastStyles;
  document.head.appendChild(toastStyleElement);
}
import {
  Plus,
  Search,
  Download,
  Upload,
  Edit,
  Trash2,
  MoreVertical,
  CheckCircle,
  XCircle,
  X,
} from "lucide-react";
import { NovoClienteDrawer } from "../../components/financeiro/NovoClienteDrawer";
import { EditarClienteDrawer } from "../../components/financeiro/EditarCliente";
import { DetalhesClienteDrawer } from "../../components/financeiro/DetalheClienteDrawer";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from '../../styles/financeiro/cadastro-clientes.module.css';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';
import { Loader2 } from "lucide-react";
import ReactSelect from "react-select";


const DeleteModal = ({ isOpen, onClose, onConfirm, clienteNome }) => {
  if (!isOpen) return null;
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.deleteModalContent} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.deleteModalTitle}>Excluir cliente</h3>
        <div className={styles.deleteModalBody}>
          <p className={styles.deleteModalDescription}>
            Tem certeza que deseja excluir o cliente &quot;
            <strong className={styles.deleteModalHighlight}>{clienteNome}</strong>&quot;?
          </p>
          <div className={styles.deleteModalWarning}>
            <p className={styles.deleteModalWarningText}>
              Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos permanentemente.
            </p>
          </div>
        </div>
        <div className={styles.deleteModalActions}>
          <button type="button" onClick={onClose} className={styles.deleteModalBtnCancel}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} className={styles.deleteModalBtnConfirm}>
            Excluir cliente
          </button>
        </div>
      </div>
    </div>
  );
};

// Função para debounce
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export default function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const searchDebounced = useDebounce(searchTerm, 400);
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isNovoClienteOpen, setIsNovoClienteOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false });

  const [clientes, setClientes] = useState([]);
  const [isEditarClienteOpen, setIsEditarClienteOpen] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [isDetalheDrawerOpen, setIsDetalheDrawerOpen] = useState(false);
  const [clienteDetalhado, setClienteDetalhado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedClientes, setSelectedClientes] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL;
  
  // Estados para dropdown nativo
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Estado para ordenação
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc"
  });

  // Funções para dropdown nativo
  const handleDropdownToggle = (id, event) => {
    if (openDropdownId === id) {
      setOpenDropdownId(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      });
      setOpenDropdownId(id);
    }
  };

  const handleCloseDropdown = () => {
    setOpenDropdownId(null);
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdownId && !event.target.closest(`.${styles.dropdownContainer}`)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId]);

  // Opções para o react-select de status
  const statusOptions = [
    { value: "Todos", label: "Todos" },
    { value: "Ativo", label: "Ativo" },
    { value: "Inativo", label: "Inativo" }
  ];

  const filteredClientes = clientes.filter((cliente) => {
    const matchesSearch =
      (cliente.nome_fantasia?.toLowerCase() || "").includes(
        searchDebounced.toLowerCase()
      ) ||
      (cliente.cnpj || "").includes(searchDebounced) ||
      (cliente.e_mail_principal?.toLowerCase() || "").includes(
        searchDebounced.toLowerCase()
      );

    // Filtro por status
    const matchesStatus = 
      statusFilter === "Todos" || 
      (statusFilter === "Ativo" && cliente.status === "ativo") ||
      (statusFilter === "Inativo" && cliente.status === "inativo");

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredClientes.length / itemsPerPage);
  
  // Reset da página atual se ela for maior que o total de páginas
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Reset da seleção quando mudar página, filtros ou ordenação
  useEffect(() => {
    setSelectedClientes([]);
    setSelectAll(false);
  }, [currentPage, searchDebounced, statusFilter, sortConfig]);
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClientes = filteredClientes.slice(
    startIndex,
    startIndex + itemsPerPage
  );

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

  // Função para solicitar ordenação
  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Funções para gerenciar seleção
  const handleSelectAll = () => {
    if (selectAll) {
      // Desmarcar todos
      setSelectedClientes([]);
      setSelectAll(false);
    } else {
      // Marcar todos os clientes da página atual
      const allIds = paginatedClientes.map(cliente => cliente.id);
      setSelectedClientes(allIds);
      setSelectAll(true);
    }
  };

  const handleSelectIndividual = (clienteId) => {
    setSelectedClientes(prev => {
      if (prev.includes(clienteId)) {
        // Remover da seleção
        const newSelection = prev.filter(id => id !== clienteId);
        setSelectAll(false);
        return newSelection;
      } else {
        // Adicionar à seleção
        const newSelection = [...prev, clienteId];
        // Verificar se todos os clientes da página estão selecionados
        if (newSelection.length === paginatedClientes.length) {
          setSelectAll(true);
        }
        return newSelection;
      }
    });
  };

  // Verificar se um cliente específico está selecionado
  const isClienteSelected = (clienteId) => {
    return selectedClientes.includes(clienteId);
  };

  // Verificar se o checkbox "selecionar todos" deve estar marcado
  const isSelectAllChecked = () => {
    return selectAll && paginatedClientes.length > 0;
  };

  // Função para inativar múltiplos clientes
  const handleInativarSelecionados = async () => {
    if (selectedClientes.length === 0) {
      toast.error("Nenhum cliente selecionado.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Token de autenticação não encontrado.");
      return;
    }

    try {
      // Inativar todos os clientes selecionados
      const promises = selectedClientes.map(clienteId => 
        fetch(`${API}/financeiro/clientes/${clienteId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "inativo" }),
        })
      );

      const responses = await Promise.all(promises);
      
      // Verificar se todas as requisições foram bem-sucedidas
      const failedRequests = responses.filter(res => !res.ok);
      
      if (failedRequests.length > 0) {
        throw new Error(`${failedRequests.length} cliente(s) não puderam ser inativados.`);
      }

      // Atualizar lista local
      setClientes(prev => 
        prev.map(cliente => 
          selectedClientes.includes(cliente.id) 
            ? { ...cliente, status: "inativo" }
            : cliente
        )
      );

      // Limpar seleção
      setSelectedClientes([]);
      setSelectAll(false);

      toast.success(`${selectedClientes.length} cliente(s) inativado(s) com sucesso!`);
    } catch (err) {
      console.error("❌ Erro ao inativar clientes:", err);
      toast.error(`Erro ao inativar clientes: ${err.message}`);
    }
  };

  // Função para excluir múltiplos clientes
  const handleExcluirSelecionados = async () => {
    if (selectedClientes.length === 0) {
      toast.error("Nenhum cliente selecionado.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Token de autenticação não encontrado.");
      return;
    }

    try {
      // Excluir todos os clientes selecionados
      const promises = selectedClientes.map(clienteId => 
        fetch(`${API}/financeiro/clientes/${clienteId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      );

      const responses = await Promise.all(promises);
      
      // Verificar se todas as requisições foram bem-sucedidas
      const failedRequests = responses.filter(res => !res.ok);
      
      if (failedRequests.length > 0) {
        throw new Error(`${failedRequests.length} cliente(s) não puderam ser excluídos.`);
      }

      // Atualizar lista local
      setClientes(prev => 
        prev.filter(cliente => !selectedClientes.includes(cliente.id))
      );

      // Limpar seleção
      setSelectedClientes([]);
      setSelectAll(false);

      toast.success(`${selectedClientes.length} cliente(s) excluído(s) com sucesso!`);
    } catch (err) {
      console.error("❌ Erro ao excluir clientes:", err);
      toast.error(`Erro ao excluir clientes: ${err.message}`);
    }
  };


  const handleSaveCliente = async (clienteData) => {
    console.log("Salvando cliente:", clienteData);
    
    // Se o clienteData tem um ID, busca os dados completos
    if (clienteData && clienteData.id) {
      try {
        // Buscar empresaId do userData (padrão correto do sistema)
        const userData = localStorage.getItem("userData");
        const user = userData ? JSON.parse(userData) : null;
        const companyId = user?.EmpresaId || user?.empresa?.id || null;
        const token = localStorage.getItem("token");
        
        if (companyId && token) {
          const response = await fetch(`${API}/financeiro/clientes/empresa/${companyId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          
          if (response.ok) {
            const clientesCompletos = await response.json();
            // Atualiza a lista com os dados completos
            setClientes(clientesCompletos);
            toast.success("Cliente adicionado com sucesso!");
          } else {
            // Fallback: adiciona o cliente retornado mesmo que incompleto
            setClientes((prev) => [clienteData, ...prev]);
            toast.success("Cliente adicionado com sucesso!");
          }
        }
      } catch (error) {
        console.error("Erro ao buscar clientes completos:", error);
        // Fallback: adiciona o cliente retornado mesmo que incompleto
        setClientes((prev) => [clienteData, ...prev]);
        toast.success("Cliente adicionado com sucesso!");
      }
    } else {
      // Se não tem ID, apenas adiciona o que foi retornado
      setClientes((prev) => [clienteData, ...prev]);
      toast.success("Cliente adicionado com sucesso!");
    }
  };

  const handleDeleteCliente = () => {
    const clienteId = deleteModal.cliente?.id;
    const token = localStorage.getItem("token");

    if (!clienteId || !token) {
      toast.error("ID do cliente ou token não encontrado.");
      return;
    }

    fetch(`${API}/financeiro/clientes/${clienteId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao excluir cliente");

        // Atualiza lista local
        setClientes((prev) => prev.filter((c) => c.id !== clienteId));

        toast.success("Cliente excluído com sucesso!");
      })
      .catch((err) => {
        console.error("❌ Erro ao excluir cliente:", err);
        toast.error("Erro ao excluir cliente.");
      })
      .finally(() => {
        setDeleteModal({ isOpen: false });
      });
  };

  const handleToggleStatus = async (clienteId, novoStatus) => {
    const token = localStorage.getItem("token");

    if (!clienteId || !token) {
      toast.error("ID do cliente ou token não encontrado.");
      return;
    }

    try {
      const response = await fetch(`${API}/financeiro/clientes/${clienteId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: novoStatus }),
      });

      if (!response.ok) {
        throw new Error("Erro ao atualizar status do cliente");
      }

      // Atualiza lista local
      setClientes((prev) =>
        prev.map((c) =>
          c.id === clienteId ? { ...c, status: novoStatus } : c
        )
      );

      const statusText = novoStatus === "ativo" ? "ativado" : "inativado";
      toast.success(`Cliente ${statusText} com sucesso!`);
    } catch (err) {
      console.error("❌ Erro ao atualizar status do cliente:", err);
      toast.error("Erro ao atualizar status do cliente.");
    }
  };

  const getStatusBadge = (status) => {
    // Se não houver status definido, considera como ativo
    const clientStatus = status || "ativo";
    return clientStatus === "ativo" ? (
      <span className={styles.badgeActive}>
        <CheckCircle className={styles.badgeIcon} />
        Ativo
      </span>
    ) : (
      <span className={styles.badgeInactive}>
        <XCircle className={styles.badgeIcon} />
        Inativo
      </span>
    );
  };

  // Componente de Loading
  const LoadingState = () => (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <Loader2
        size={32}
        style={{
          color: '#1976D2',
          animation: 'spin 1s linear infinite'
        }}
      />
      <span style={{ color: '#6B7280', fontSize: '14px' }}>Carregando clientes...</span>
    </div>
  );

  // Componente de Skeleton para Stats Cards
  const StatsCardSkeleton = () => (
    <div className={styles.statsGrid}>
      {[1, 2, 3].map((index) => (
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
      if (!loading && value > 0) {
        setDisplayValue(0);
        
        const duration = 200; // 1.5 segundos
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
      } else if (!loading) {
        // Se não está carregando mas o valor é 0, mostra 0
        setDisplayValue(0);
      }
    }, [value, loading]);

    return <p className={`${styles.animatedNumber} ${color}`}>{loading ? 0 : displayValue}</p>;
  };

  const stats = {
    ativo: clientes.filter((c) => c.status === "ativo").length,
    inativo: clientes.filter((c) => c.status === "inativo").length,
    todos: clientes.length,
  };

  useEffect(() => {
    // Buscar empresaId do userData (padrão correto do sistema)
    const userData = localStorage.getItem("userData");
    const user = userData ? JSON.parse(userData) : null;
    const companyId = user?.EmpresaId || user?.empresa?.id || null;
    const token = localStorage.getItem("token");

    console.log("🔍 companyId:", companyId);
    console.log("🔐 token:", token);

    if (!companyId || !token) {
      console.warn("🚫 companyId ou token ausentes. Cancelando requisição.");
      setLoading(false);
      return;
    }

    const url = `${API}/financeiro/clientes/empresa/${companyId}`;
    console.log("🌐 URL da requisição:", url);

    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        console.log("📥 Resposta bruta (Response):", res);
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        console.log("✅ Dados recebidos do backend:", data);
        setClientes(data);
      })
      .catch((err) => {
        console.error("❌ Erro ao buscar clientes:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className={styles.page}>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        toastClassName="custom-toast"
        closeButton={false}
      />
      {/* Topbar (título + ações + filtros) */}
      <div className={styles.toolbarBox}>
        <div className={styles.toolbarHeader}>
          <h1 className={styles.headerTitleSmall}>Clientes</h1>
          <div className={styles.headerActions}>
            <button
              type="button"
              disabled
              className={styles.btnExport}
            >
              <Download className={styles.iconSmallWithGap} />
              Exportar
            </button>
            <button
              type="button"
              disabled
              className={styles.btnImport}
            >
              <Upload className={styles.iconSmallWithGap} />
              Importar
            </button>
            <button
              type="button"
              className={styles.btnNew}
              onClick={() => setIsNovoClienteOpen(true)}
            >
              <Plus className={styles.iconSmallWithGap} />
              Novo cliente
            </button>
          </div>
        </div>

        {/* Nada aqui - filtros ficam na seção abaixo (mantendo o search no lugar original) */}
      </div>

      {/* Contadores em cards transparentes (separados dos filtros) */}
      {loading ? (
        <StatsCardSkeleton />
      ) : (
        <div className={styles.statsGrid}>
          <div 
            className={`${styles.statusCard} ${statusFilter === "Ativo" ? styles.statusCardAtivoSelected : styles.statusCardAtivo}`}
            onClick={() => setStatusFilter("Ativo")}
          >
            {statusFilter === "Ativo" && (
              <div className={styles.cardCheckIconWrap}>
                <CheckCircle className={styles.iconAtivo} />
              </div>
            )}
            <div className={styles.cardContentPadded}>
              <div className={styles.textCenter}>
                <p className={styles.textMutedSmall}>Ativo</p>
                <AnimatedNumber value={stats.ativo} color={styles.textAtivo} />
              </div>
            </div>
          </div>

          <div 
            className={`${styles.statusCard} ${statusFilter === "Inativo" ? styles.statusCardInativoSelected : styles.statusCardInativo}`}
            onClick={() => setStatusFilter("Inativo")}
          >
            {statusFilter === "Inativo" && (
              <div className={styles.cardCheckIconWrap}>
                <CheckCircle className={styles.iconInativo} />
              </div>
            )}
            <div className={styles.cardContentPadded}>
              <div className={styles.textCenter}>
                <p className={styles.textMutedSmall}>Inativo</p>
                <AnimatedNumber value={stats.inativo} color={styles.textInativo} />
              </div>
            </div>
          </div>

          <div 
            className={`${styles.statusCard} ${statusFilter === "Todos" ? styles.statusCardTodosSelected : styles.statusCardTodos}`}
            onClick={() => setStatusFilter("Todos")}
          >
            {statusFilter === "Todos" && (
              <div className={styles.cardCheckIconWrap}>
                <CheckCircle className={styles.iconTodos} />
              </div>
            )}
            <div className={styles.cardContentPadded}>
              <div className={styles.textCenter}>
                <p className={styles.textMutedSmall}>Todos</p>
                <AnimatedNumber value={stats.todos} color={styles.textTodos} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card separado para filtros */}
      <div className={styles.tableContainer}>
        <div className={styles.cardContentPadded}>
          <div className={styles.filtersRow}>
            <div className={styles.filtersRowBox} style={{ flex: 1 }}>
              <div className={styles.searchWrap}>
                <Search className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Pesquisar clientes..."
                  className={styles.searchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.filtersRowBox}>
              <select
                className={styles.filterSelect}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="Todos">Todos os status</option>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros Ativos removidos a pedido */}

      {/* Indicador de ordenação */}
      {sortConfig.key && (
        <div style={{
          marginBottom: "var(--onity-spacing-sm)",
          padding: "var(--onity-spacing-sm) var(--onity-spacing-md)",
          backgroundColor: "rgba(0, 128, 255, 0.1)",
          border: "1px solid rgba(0, 128, 255, 0.2)",
          borderRadius: "var(--onity-radius-sm)",
          color: "var(--onity-primary)",
          fontSize: "var(--onity-font-size-sm)",
          display: "flex",
          alignItems: "center",
          gap: "var(--onity-spacing-sm)"
        }}>
          <span>
            Ordenado por: <strong>{sortConfig.key === "nome_fantasia" ? "Nome" : 
              sortConfig.key === "cpf_cnpj" ? "CPF/CNPJ" :
              sortConfig.key === "email_principal" ? "E-mail" :
              sortConfig.key === "status" ? "Status" : sortConfig.key}</strong>
            {" "}({sortConfig.direction === "asc" ? "A-Z" : "Z-A"})
          </span>
          <button
            onClick={() => setSortConfig({ key: null, direction: "asc" })}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "var(--onity-primary)",
              cursor: "pointer",
              fontSize: "var(--onity-font-size-sm)",
              padding: "var(--onity-spacing-xs)",
              borderRadius: "var(--onity-radius-sm)",
              transition: "all var(--onity-transition-fast)"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(0, 128, 255, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            ✕ Limpar ordenação
          </button>
        </div>
      )}

      {/* Actions - aparecem apenas quando houver seleção */}
      {selectedClientes.length > 0 && (
        <div className={styles.actionsBar}>
          <div className={styles.actionsLeft}>
            <p className={styles.textMutedSmall}>{selectedClientes.length} registro(s) selecionado(s)</p>
            <button 
              type="button"
              className={styles.btnDangerOutline}
              onClick={handleExcluirSelecionados}
            >
              Excluir
            </button>
            <button 
              type="button"
              className={styles.btnSecondary}
              onClick={handleInativarSelecionados}
            >
              Inativar
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <LoadingState />
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHeadRow}>
                      <th className={styles.tableHeadCellCheckbox}>
                        <input 
                          type="checkbox" 
                          className={styles.checkbox}
                          checked={isSelectAllChecked()}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th 
                        className={`${styles.tableHeadCell} ${styles.sortableTh}`}
                        onClick={() => requestSort("nome_fantasia")}
                        style={{ cursor: "pointer" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          Nome
                          {sortConfig.key === "nome_fantasia" && (
                            <span style={{ fontSize: "12px", color: "var(--onity-primary)" }}>
                              {sortConfig.direction === "asc" ? "▲" : "▼"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className={`${styles.tableHeadCell} ${styles.sortableTh}`}
                        onClick={() => requestSort("cpf_cnpj")}
                        style={{ cursor: "pointer" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          CPF / CNPJ
                          {sortConfig.key === "cpf_cnpj" && (
                            <span style={{ fontSize: "12px", color: "var(--onity-primary)" }}>
                              {sortConfig.direction === "asc" ? "▲" : "▼"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className={`${styles.tableHeadCell} ${styles.sortableTh}`}
                        onClick={() => requestSort("email_principal")}
                        style={{ cursor: "pointer" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          E-mail
                          {sortConfig.key === "email_principal" && (
                            <span style={{ fontSize: "12px", color: "var(--onity-primary)" }}>
                              {sortConfig.direction === "asc" ? "▲" : "▼"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className={styles.tableHeadCell}>
                        Telefone
                      </th>
                      <th 
                        className={`${styles.tableHeadCell} ${styles.sortableTh}`}
                        onClick={() => requestSort("status")}
                        style={{ cursor: "pointer" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          Status
                          {sortConfig.key === "status" && (
                            <span style={{ fontSize: "12px", color: "var(--onity-primary)" }}>
                              {sortConfig.direction === "asc" ? "▲" : "▼"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className={styles.tableHeadCell}>
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedClientes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={styles.tableEmpty}>
                          Nenhum cliente encontrado.
                        </td>
                      </tr>
                    ) : (
                      paginatedClientes.map((cliente) => (
                        <tr key={cliente.id} className={styles.tableRow}>
                          <td className={styles.tableCellCheckbox}>
                            <input 
                              type="checkbox" 
                              className={styles.checkbox}
                              checked={isClienteSelected(cliente.id)}
                              onChange={() => handleSelectIndividual(cliente.id)}
                            />
                          </td>
                          <td
                            className={styles.clienteName}
                            onClick={() => {
                              setClienteDetalhado(cliente);
                              setIsDetalheDrawerOpen(true);
                            }}
                          >
                            {cliente.nome_fantasia}
                          </td>

                          <td className={styles.tableCell}>
                            {cliente.cpf_cnpj}
                          </td>
                          <td className={styles.tableCell}>
                            {cliente.email_principal}
                          </td>
                          <td className={styles.tableCell}>
                            {cliente.telefone_comercial}
                          </td>
                          <td className={styles.tableCell}>{getStatusBadge(cliente.status)}</td>
                          <td className={styles.tableCell}>
                            <div className={styles.dropdownContainer}>
                              <button
                                type="button"
                                className={styles.dropdownTrigger}
                                onClick={(e) => handleDropdownToggle(`cliente-${cliente.id}`, e)}
                              >
                                <MoreVertical className={styles.iconSmallWithGap} />
                              </button>
                              {openDropdownId === `cliente-${cliente.id}` && (
                                <div className={styles.dropdownContent} style={{
                                  position: 'fixed',
                                  top: dropdownPosition.top,
                                  left: dropdownPosition.left,
                                  transform: 'translateX(-100%)'
                                }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setClienteSelecionado(cliente);
                                      setIsEditarClienteOpen(true);
                                      handleCloseDropdown();
                                    }}
                                    className={styles.dropdownItem}
                                  >
                                    <Edit className={styles.iconSmallWithGap} />
                                    Editar
                                  </button>

                                  {cliente.status === "ativo" ? (
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        handleToggleStatus(cliente.id, "inativo");
                                        handleCloseDropdown();
                                      }} 
                                      className={styles.dropdownItemDanger}
                                    >
                                      <XCircle className={styles.iconSmallWithGap} />
                                      Inativar
                                    </button>
                                  ) : (
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        handleToggleStatus(cliente.id, "ativo");
                                        handleCloseDropdown();
                                      }} 
                                      className={styles.dropdownItemPrimary}
                                    >
                                      <CheckCircle className={styles.iconSmallWithGap} />
                                      Ativar
                                    </button>
                                  )}

                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setDeleteModal({ isOpen: true, cliente });
                                      handleCloseDropdown();
                                    }} 
                                    className={styles.dropdownItemDanger}
                                  >
                                    <Trash2 className={styles.iconSmallWithGap} />
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
                {/* Pagination (movida para dentro do container da tabela) */}
                {filteredClientes.length > 0 && (
                  <div className={`${styles.pagination} ${styles.paginationInline}`}>
                    <span className={styles.paginationInfo}>
                      Mostrando {(currentPage - 1) * itemsPerPage + 1}
                      {" - "}
                      {Math.min(currentPage * itemsPerPage, filteredClientes.length)} de {filteredClientes.length}
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
        </>
      )}

      {clienteDetalhado && (
        <DetalhesClienteDrawer
          isOpen={isDetalheDrawerOpen}
          onClose={() => setIsDetalheDrawerOpen(false)}
          cliente={{
            ...clienteDetalhado,
            nome: clienteDetalhado.nome_fantasia ?? "", // <- adiciona o campo "nome"
          }}
        />
      )}

      {/* Novo Cliente Drawer */}
      <NovoClienteDrawer
        isOpen={isNovoClienteOpen}
        onClose={() => setIsNovoClienteOpen(false)}
        onSave={handleSaveCliente}
      />

      {clienteSelecionado && (
        <EditarClienteDrawer
          isOpen={isEditarClienteOpen}
          onClose={() => setIsEditarClienteOpen(false)}
          cliente={clienteSelecionado}
          onSave={(updatedCliente) => {
            // Atualiza a lista de clientes com os dados atualizados
            setClientes((prev) =>
              prev.map((c) =>
                c.id === updatedCliente.id
                  ? {
                      ...c,
                      ...updatedCliente,
                      status: c.status, // Mantém o status atual
                      tipo: c.tipo,
                      dataCadastro: c.dataCadastro,
                    }
                  : c
              )
            );
            setIsEditarClienteOpen(false);
          }}
        />
      )}

      {/* Delete Modal */}
      <DeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false })}
        onConfirm={handleDeleteCliente}
        clienteNome={deleteModal.cliente?.nome_fantasia || ""}
      />
      <PrincipalSidebar />
    </div>
  );
}
