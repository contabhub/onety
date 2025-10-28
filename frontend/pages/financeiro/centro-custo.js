"use client";

import { useState, useEffect } from "react";
import styles from '../../styles/financeiro/centro-custo.module.css';

import {
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  MoreVertical,
} from "lucide-react";
import { NovoCentroCustoModal } from "../../components/financeiro/NovoCentroCustoModal";
import { toast } from "react-toastify";
import SpaceLoader from "../../components/onety/menu/SpaceLoader";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";


export default function CentrosCustoPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [isNovoModalOpen, setIsNovoModalOpen] = useState(false);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [centrosCusto, setCentrosCusto] = useState([]);
  const [loading, setLoading] = useState(true);
  const [centroSelecionado, setCentroSelecionado] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false
  });
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const API = process.env.NEXT_PUBLIC_API_URL;

  // Função para lidar com mudança de itens por página
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset para primeira página
  };

  // Função auxiliar para buscar companyId
  const getCompanyId = () => {
    const userData = localStorage.getItem("userData");
    let companyId = localStorage.getItem("empresaId");

    if (!companyId && userData) {
      const parsedUserData = JSON.parse(userData);
      companyId = parsedUserData.EmpresaId || parsedUserData.empresa?.id;
    }

    return companyId;
  };

  // Logs para debug da renderização
  useEffect(() => {
    console.log('🎨 Renderizando centros de custo:', centrosCusto);
  }, [centrosCusto]);

  // Buscar centros de custo da API
  useEffect(() => {
    const fetchCentrosCusto = async () => {
      try {
        const companyId = getCompanyId();
        const token = localStorage.getItem("token");

        console.log("🔍 companyId:", companyId);
        console.log("🔐 token:", token);

        if (!companyId || !token) {
          console.warn(
            "🚫 companyId ou token ausentes. Cancelando requisição."
          );
          setLoading(false);
          return;
        }

        const url = `${API}/financeiro/centro-de-custo/empresa/${companyId}`;
        console.log("🌐 URL da requisição:", url);

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log("📥 Resposta bruta (Response):", response);

        if (!response.ok) {
          throw new Error(`Erro HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Dados recebidos do backend:", data);

        // Mapear os dados do backend para o formato esperado pelo frontend
        const centrosFormatados = data.map((centro) => ({
          id: String(centro.id),
          codigo: centro.codigo || "",
          nome: centro.nome || "",
          situacao:
            centro.situacao === "ativo" ? "Ativo" : "Inativo",
        }));

        console.log("📁 Centros formatados:", centrosFormatados);
        setCentrosCusto(centrosFormatados);
      } catch (error) {
        console.error("❌ Erro ao buscar centros de custo:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCentrosCusto();
  }, [API]);

  // Funções para filtrar por situação
  const handleFilterAtivos = () => setStatusFilter("Ativo");
  const handleFilterInativos = () => setStatusFilter("Inativo");
  const handleFilterTodos = () => setStatusFilter("Todos");

  // Funções para controlar dropdown individual
  const handleDropdownToggle = (centroId, event) => {
    if (openDropdownId === centroId) {
      setOpenDropdownId(null);
      return;
    }

    // Calcular posição do dropdown
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();

    // Definir posição do dropdown
    setDropdownPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.right - 192 + window.scrollX // 192px é a largura do dropdown
    });

    setOpenDropdownId(centroId);
  };

  // Função para fechar dropdown quando clicar fora
  const handleCloseDropdown = () => {
    setOpenDropdownId(null);
  };

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(`.${styles.dropdownContainer}`) &&
        !event.target.closest(`.${styles.dropdownContent}`)) {
        setOpenDropdownId(null);
      }
    };

    if (openDropdownId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdownId]);

  const filteredCentros = centrosCusto.filter((centro) => {
    // Filtro por termo de busca
    const matchesSearch =
      centro.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      centro.codigo.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtro por situação
    const matchesStatus =
      statusFilter === "Todos" || centro.situacao === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const sortedCentros = [...filteredCentros].sort((a, b) => {
    if (!sortField) return 0;

    const aValue = a[sortField];
    const bValue = b[sortField];

    if (sortDirection === "asc") {
      return aValue.toString().localeCompare(bValue.toString());
    } else {
      return bValue.toString().localeCompare(aValue.toString());
    }
  });

  // Lógica de paginação
  const totalPages = Math.ceil(sortedCentros.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCentros = sortedCentros.slice(startIndex, startIndex + itemsPerPage);

  // Cálculo das páginas visíveis
  const maxVisiblePages = 5;
  let paginaInicio = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let paginaFim = Math.min(totalPages, paginaInicio + maxVisiblePages - 1);
  
  // Ajusta o início se estivermos próximos ao fim
  if (paginaFim - paginaInicio < maxVisiblePages - 1) {
    paginaInicio = Math.max(1, paginaFim - maxVisiblePages + 1);
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSaveCentro = async (data) => {
    try {
      const companyId = getCompanyId();
      const token = localStorage.getItem("token");

      if (!companyId || !token) {
        console.error("❌ companyId ou token ausentes!");
        toast.error("Empresa não selecionada ou token inválido.");
        return;
      }

      console.log("📦 Salvando centro de custo:", data);

      const response = await fetch(`${API}/financeiro/centro-de-custo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          codigo: data.codigo,
          nome: data.nome,
          situacao: data.situacao === "Ativo" ? "ativo" : "inativo",
          empresa_id: Number(companyId),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Erro ao salvar centro de custo:", errorData);
        toast.error(`Erro ao salvar centro de custo: ${errorData.message || 'Erro desconhecido'}`);
        return;
      }

      console.log('🔔 Exibindo toast de sucesso para criação');
      toast.success("Centro de custo criado com sucesso! ✅");

      const novoCentro = await response.json();
      console.log("✅ Centro de custo salvo com sucesso:", novoCentro);

      // Verifica se o resultado tem a estrutura esperada
      if (!novoCentro.id) {
        console.error('❌ Resultado não tem ID:', novoCentro);
        toast.error('Erro: resposta da API não contém ID do centro de custo');
        return;
      }

      // Adicionar o novo centro à lista local (atualização parcial)
      const centroFormatado = {
        id: String(novoCentro.id),
        codigo: novoCentro.codigo ?? data.codigo ?? "",
        nome: novoCentro.nome ?? data.nome ?? "",
        situacao:
          novoCentro.situacao === "ativo"
            ? "Ativo"
            : novoCentro.situacao === "inativo"
              ? "Inativo"
              : data.situacao, // fallback se vier null
      };

      console.log('🔍 Centro formatado para adicionar:', centroFormatado);
      console.log('🔍 Estado atual antes da adição:', centrosCusto);

      setCentrosCusto((prev) => {
        const updated = [...prev, centroFormatado];
        console.log('🔍 Estado atualizado:', updated);
        return updated;
      });

      setIsNovoModalOpen(false);
    } catch (error) {
      console.error("❌ Erro inesperado ao salvar centro de custo:", error);
      toast.error("Erro inesperado ao salvar centro de custo.");
    }
  };

  const handleEditCentro = async (data) => {
    if (!centroSelecionado) return;

    try {
      const companyId = getCompanyId();
      const token = localStorage.getItem("token");

      if (!companyId || !token) {
        console.error("❌ companyId ou token ausentes!");
        toast.error("Empresa não selecionada ou token inválido.");
        return;
      }

      console.log("📦 Editando centro de custo:", data);

      const response = await fetch(
        `${API}/financeiro/centro-de-custo/${centroSelecionado.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            codigo: data.codigo,
            nome: data.nome,
            situacao: data.situacao === "Ativo" ? "ativo" : "inativo",
            empresa_id: Number(companyId),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Erro ao editar centro de custo:", errorData);
        toast.error(
          `Erro ao editar centro de custo: ${errorData.message || ""}`
        );
        return;
      }

      console.log('🔔 Exibindo toast de sucesso para edição');
      toast.success("Centro de custo editado com sucesso! ✅");

      const centroEditado = await response.json();
      console.log("✅ Centro de custo editado com sucesso:", centroEditado);

      // Atualizar apenas o centro editado na lista local (atualização parcial)
      const centroFormatado = {
        id: String(centroEditado.id || centroSelecionado.id),
        codigo:
          centroEditado.codigo ?? data.codigo ?? centroSelecionado.codigo ?? "",
        nome: centroEditado.nome ?? data.nome ?? centroSelecionado.nome ?? "",
        situacao:
          centroEditado.situacao === "ativo"
            ? "Ativo"
            : centroEditado.situacao === "inativo"
              ? "Inativo"
              : centroSelecionado.situacao,
      };

      setCentrosCusto((prev) =>
        prev.map((c) => (c.id === centroSelecionado.id ? centroFormatado : c))
      );
      setIsEditModalOpen(false);
      setCentroSelecionado(null);
    } catch (error) {
      console.error("❌ Erro inesperado ao editar centro de custo:", error);
      toast.error("Erro inesperado ao editar centro de custo.");
    }
  };

  const handleDeleteCentro = async () => {
    if (!deleteModal.centro?.id) {
      console.error("ID do centro de custo não encontrado.");
      toast.error("ID do centro de custo não encontrado.");
      return;
    }

    const centroId = deleteModal.centro.id;

    try {
      const token = localStorage.getItem("token");
      const empresaId = getCompanyId();

      if (!token) {
        console.error("❌ Token ausente!");
        toast.error("Token de autenticação não encontrado.");
        return;
      }

      if (!empresaId) {
        console.error("❌ EmpresaId ausente!");
        toast.error("Empresa não selecionada.");
        return;
      }

      const response = await fetch(
        `${API}/financeiro/centro-de-custo/${centroId}?empresa_id=${empresaId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Erro ao excluir centro de custo:", errorData);
        toast.error(
          `Erro ao excluir centro de custo: ${errorData.message || ""}`
        );
        return;
      }
      console.log('🔔 Exibindo toast de sucesso para exclusão');
      toast.success("Centro de custo excluído com sucesso! ✅");

      console.log("✅ Centro de custo excluído com sucesso");
      setCentrosCusto((prev) => prev.filter((c) => c.id !== centroId));
    } catch (error) {
      console.error("❌ Erro inesperado ao excluir centro de custo:", error);
      toast.error("Erro inesperado ao excluir centro de custo.");
    }
  };

  const handleToggleStatus = async (centro) => {
    try {
      const companyId = getCompanyId();
      const token = localStorage.getItem("token");

      if (!companyId || !token) {
        console.error("❌ companyId ou token ausentes!");
        toast.error("Empresa não selecionada ou token inválido.");
        return;
      }

      const novaSituacao = centro.situacao === "Ativo" ? "Inativo" : "Ativo";
      console.log(
        `📦 Alterando situação do centro ${centro.id} para: ${novaSituacao}`
      );

      const response = await fetch(`${API}/financeiro/centro-de-custo/${centro.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          codigo: centro.codigo,
          nome: centro.nome,
          situacao: novaSituacao === "Ativo" ? "ativo" : "inativo",
          empresa_id: Number(companyId),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(
          "❌ Erro ao alterar situação do centro de custo:",
          errorData
        );
        toast.error(`Erro ao alterar situação: ${errorData.message || ""}`);
        return;
      }

      console.log('🔔 Exibindo toast de sucesso para alteração de status');
      toast.success(`Situação alterada para ${novaSituacao}! ✅`);

      const centroAtualizado = await response.json();
      console.log(
        "✅ Situação do centro de custo alterada com sucesso:",
        centroAtualizado
      );

      // Atualizar apenas o centro alterado na lista local (atualização parcial)
      const centroFormatado = {
        id: String(centroAtualizado.id || centro.id),
        codigo: centroAtualizado.codigo ?? centro.codigo,
        nome: centroAtualizado.nome ?? centro.nome,
        situacao:
          centroAtualizado.situacao === "ativo"
            ? "Ativo"
            : centroAtualizado.situacao === "inativo"
              ? "Inativo"
              : novaSituacao, // fallback se backend não devolver nada
      };

      setCentrosCusto((prev) =>
        prev.map((c) => (c.id === centro.id ? centroFormatado : c))
      );
    } catch (error) {
      console.error(
        "❌ Erro inesperado ao alterar situação do centro de custo:",
        error
      );
      toast.error("Erro inesperado ao alterar situação.");
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  const getStatusBadge = (situacao) => {
    return situacao === "Ativo" ? (
      <span className={styles.centroCustoBadgeAtivo}>Ativo</span>
    ) : (
      <span className={styles.centroCustoBadgeInativo}>Inativo</span>
    );
  };

  const stats = {
    ativos: centrosCusto.filter((c) => c.situacao === "Ativo").length,
    inativos: centrosCusto.filter((c) => c.situacao === "Inativo").length,
    todos: centrosCusto.length,
  };

  return (
    <div className={styles.centroCustoPage}>
      <PrincipalSidebar />
      {/* Header */}
      <div className={styles.centroCustoHeader}>
        <h1 className={styles.centroCustoHeaderTitle}>Centros de custo</h1>
        <div className={styles.centroCustoHeaderActions}>
          <button
            type="button"
            className={styles.btnNew}
            onClick={() => setIsNovoModalOpen(true)}
          >
            Novo Centro de Custo
          </button>
        </div>
      </div>



      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div
          className={`${styles.statusCard} ${statusFilter === "Ativo" ? styles.statusCardAtivoSelected : styles.statusCard}`}
          onClick={handleFilterAtivos}
        >
          {statusFilter === "Ativo" && (
            <div className={styles.cardCheckIconWrap}>
              <CheckCircle className={styles.iconAtivo} />
            </div>
          )}
          <div className={styles.cardContentPadded}>
            <div className={styles.textCenter}>
              <p className={styles.textMutedSmall}>Ativos</p>
              <p className={`${styles.animatedNumber} ${styles.textAtivo}`}>
                {stats.ativos}
              </p>
            </div>
          </div>
        </div>

        <div
          className={`${styles.statusCard} ${statusFilter === "Inativo" ? styles.statusCardInativoSelected : styles.statusCard}`}
          onClick={handleFilterInativos}
        >
          {statusFilter === "Inativo" && (
            <div className={styles.cardCheckIconWrap}>
              <CheckCircle className={styles.iconInativo} />
            </div>
          )}
          <div className={styles.cardContentPadded}>
            <div className={styles.textCenter}>
              <p className={styles.textMutedSmall}>Inativos</p>
              <p className={`${styles.animatedNumber} ${styles.textInativo}`}>
                {stats.inativos}
              </p>
            </div>
          </div>
        </div>

        <div
          className={`${styles.statusCard} ${statusFilter === "Todos" ? styles.statusCardTodosSelected : styles.statusCardTodos}`}
          onClick={handleFilterTodos}
        >
          {statusFilter === "Todos" && (
            <div className={styles.cardCheckIconWrap}>
              <CheckCircle className={styles.iconTodos} />
            </div>
          )}
          <div className={styles.cardContentPadded}>
            <div className={styles.textCenter}>
              <p className={styles.textMutedSmall}>Todos</p>
              <p className={`${styles.animatedNumber} ${styles.textTodos}`}>
                {stats.todos}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className={styles.centroCustoFiltersCard}>
        <div className={styles.centroCustoFiltersContent}>
          <div className={styles.centroCustoFiltersRow}>
            <div className={styles.centroCustoFilterGroup}>
              <label className={styles.centroCustoFilterLabel}>Pesquisar</label>
              <div className={styles.centroCustoSearchContainer}>
                <Search className={styles.centroCustoSearchIcon} />
                <input
                  type="text"
                  placeholder="Pesquisar"
                  className={styles.centroCustoSearchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtro Ativo */}
      {statusFilter !== "Todos" && (
        <div className={styles.centroCustoFiltrosAtivosCard}>
          <div className={styles.centroCustoFiltrosAtivosContent}>
            <span className={styles.centroCustoFiltrosAtivosText}>
              Filtro: {statusFilter}
            </span>
            <button
              type="button"
              onClick={handleFilterTodos}
              className={styles.centroCustoSecondaryBtn}
            >
              Limpar filtro
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.tableHeadRow}>
                <th className={styles.tableHeadCell}>
                  <button
                    onClick={() => handleSort("codigo")}
                    className={styles.tableHeadButton}
                  >
                    Código
                    {getSortIcon("codigo")}
                  </button>
                </th>
                <th className={styles.tableHeadCell}>
                  <button
                    onClick={() => handleSort("nome")}
                    className={styles.tableHeadButton}
                  >
                    Nome
                    {getSortIcon("nome")}
                  </button>
                </th>
                <th className={styles.tableHeadCell}>
                  <button
                    onClick={() => handleSort("situacao")}
                    className={styles.tableHeadButton}
                  >
                    Situação
                    {getSortIcon("situacao")}
                  </button>
                </th>
                <th className={styles.tableHeadCell}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className={styles.tableEmpty}>
                    <div className={styles.loadingWrap}>
                      <SpaceLoader
                        size={80}
                        label="Carregando centros de custo..."
                        showText={true}
                        minHeight={200}
                      />
                    </div>
                  </td>
                </tr>
              ) : sortedCentros.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.tableEmpty}>
                    <div className={styles.loadingWrap}>
                      <div className={styles.notFoundIcon}></div>
                      <p className={styles.textMutedSmall}>
                        {statusFilter !== "Todos"
                          ? `Nenhum centro de custo ${statusFilter.toLowerCase()} encontrado`
                          : "Nenhum centro de custo encontrado"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCentros.map((centro) => (
                  <tr key={centro.id} className={styles.tableRow}>
                    <td className={styles.tableCell}>{centro.codigo || "-"}</td>
                    <td className={styles.tableCell}>{centro.nome}</td>
                    <td className={styles.tableCell}>{getStatusBadge(centro.situacao)}</td>
                    <td className={styles.tableCell}>
                      <div className={styles.dropdownContainer}>
                        <button
                          className={styles.dropdownTrigger}
                          onClick={(e) => handleDropdownToggle(centro.id, e)}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {sortedCentros.length > 0 && (
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Mostrando {(currentPage - 1) * itemsPerPage + 1}
              {" - "}
              {Math.min(currentPage * itemsPerPage, sortedCentros.length)} de {sortedCentros.length}
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

      {/* Novo Centro de Custo Modal */}
      <NovoCentroCustoModal
        isOpen={isNovoModalOpen}
        onClose={() => setIsNovoModalOpen(false)}
        onSave={handleSaveCentro}
      />

      {/* Editar Centro de Custo Modal */}
      {centroSelecionado && (
        <NovoCentroCustoModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setCentroSelecionado(null);
          }}
          onSave={handleEditCentro}
          centro={centroSelecionado}
          isEditing={true}
        />
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteModal.isOpen && (
        <div className={styles.centroCustoModalOverlay} onClick={() => setDeleteModal({ isOpen: false })}>
          <div className={styles.centroCustoModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.centroCustoModalHeader}>
              <h2 className={styles.centroCustoModalTitle}>Excluir centro de custo</h2>
            </div>

            <div className={styles.centroCustoModalBody}>
              <p className={styles.centroCustoModalDescription}>
                Deseja excluir o centro de custo <strong className={styles.centroCustoModalHighlight}>{deleteModal.centro?.nome}</strong>?
              </p>
            </div>

            <div className={styles.centroCustoModalFooter}>
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false })}
                className={styles.centroCustoModalBtnCancelar}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteCentro}
                className={styles.centroCustoModalBtnConfirmar}
              >
                Excluir centro de custo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dropdown Global */}
      {openDropdownId && (
        <div
          className={styles.dropdownContent}
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left
          }}
        >
          <button
            className={styles.dropdownItem}
            onClick={() => {
              const centro = sortedCentros.find(c => c.id === openDropdownId);
              if (centro) {
                setCentroSelecionado(centro);
                setIsEditModalOpen(true);
                handleCloseDropdown();
              }
            }}
          >
            <Edit className="w-4 h-4" />
            Editar
          </button>
          <button
            className={styles.dropdownItemDanger}
            onClick={() => {
              const centro = sortedCentros.find(c => c.id === openDropdownId);
              if (centro) {
                setDeleteModal({
                  isOpen: true,
                  centro
                });
                handleCloseDropdown();
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </button>
          <button
            className={styles.dropdownItem}
            onClick={() => {
              const centro = sortedCentros.find(c => c.id === openDropdownId);
              if (centro) {
                handleToggleStatus(centro);
                handleCloseDropdown();
              }
            }}
          >
            {(() => {
              const centro = sortedCentros.find(c => c.id === openDropdownId);
              return centro?.situacao === "Ativo" ? (
                <>
                  <XCircle className="w-4 h-4" />
                  Inativar
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Ativar
                </>
              );
            })()}
          </button>
        </div>
      )}
    </div>
  );
}
