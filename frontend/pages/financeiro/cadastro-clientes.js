"use client";

import { useState, useEffect } from "react";
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
import { NovoClienteDrawer } from "../../components/financeiro/NovoClienteDrawer";
import { EditarClienteDrawer } from "../../components/financeiro/EditarCliente";
import { DetalhesClienteDrawer } from "../../components/financeiro/DetalheClienteDrawer";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../components/financeiro/dropdown-menu";
import { toast } from "react-toastify";
import SpaceLoader from '../../components/onety/menu/SpaceLoader';
import styles from '../../styles/financeiro/cadastro-clientes.module.css';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';


const DeleteModal = ({ isOpen, onClose, onConfirm, clienteNome }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={styles.modalContentSmall}>
        <DialogHeader>
          <DialogTitle className={styles.dialogTitle}>Excluir cliente</DialogTitle>
        </DialogHeader>

        <div className={styles.modalBody}>
          <p className={styles.textMutedSmall}>
            Tem certeza que deseja excluir o cliente &quot;
            <strong className={styles.textWhite}>{clienteNome}</strong>&quot;?
          </p>
          <p className={styles.textDangerSmall}>
            Esta ação não pode ser desfeita.
          </p>
        </div>

        <div className={styles.modalActions}>
          <Button variant="outline" onClick={onClose} className={styles.btnSecondary}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} className={styles.btnDanger}>
            Excluir cliente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState("");
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
  const API = process.env.NEXT_PUBLIC_API_URL;

  const filteredClientes = clientes.filter((cliente) => {
    const matchesSearch =
      (cliente.nome_fantasia?.toLowerCase() || "").includes(
        searchTerm.toLowerCase()
      ) ||
      (cliente.cnpj || "").includes(searchTerm) ||
      (cliente.e_mail_principal?.toLowerCase() || "").includes(
        searchTerm.toLowerCase()
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
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClientes = filteredClientes.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Função para gerar números das páginas dinamicamente
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // Se temos 5 páginas ou menos, mostra todas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Se temos mais de 5 páginas, mostra páginas inteligentemente
      if (currentPage <= 3) {
        // Páginas iniciais: 1, 2, 3, 4, 5, ..., última
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Páginas finais: 1, ..., penúltima, antepenúltima, última
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Páginas do meio: 1, ..., anterior, atual, próximo, ..., última
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const handleSaveCliente = async (clienteData) => {
    console.log("Salvando cliente:", clienteData);
    
    // Se o clienteData tem um ID, busca os dados completos
    if (clienteData && clienteData.id) {
      try {
        const companyId = localStorage.getItem("empresaId");
        const token = localStorage.getItem("token");
        
        if (companyId && token) {
          const response = await fetch(`${API}/clientes/company/${companyId}`, {
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

    fetch(`${API}/clientes/${clienteId}`, {
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
      const response = await fetch(`${API}/clientes/${clienteId}/status`, {
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
      <Badge className="bg-[#1E88E5]/10 text-[#1E88E5] border-[#1E88E5]/20">
        <CheckCircle className="w-3 h-3 mr-1" />
        Ativo
      </Badge>
    ) : (
      <Badge className="bg-[#F50057]/10 text-[#F50057] border-[#F50057]/20">
        <XCircle className="w-3 h-3 mr-1" />
        Inativo
      </Badge>
    );
  };

  // Componente de Loading
  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="w-20 h-20">
      <SpaceLoader label="Carregando clientes..." size={100} minHeight={150} />
      </div>
    </div>
  );

  // Componente de Skeleton para Stats Cards
  const StatsCardSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((index) => (
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
      if (!loading && value > 0) {
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
    const companyId = localStorage.getItem("empresaId");
    const token = localStorage.getItem("token");

    console.log("🔍 companyId:", companyId);
    console.log("🔐 token:", token);

    if (!companyId || !token) {
      console.warn("🚫 companyId ou token ausentes. Cancelando requisição.");
      setLoading(false);
      return;
    }

    const url = `${API}/clientes/company/${companyId}`;
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
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>Clientes</h1>
          <p className={styles.headerSubtitle}>Gerencie seus clientes</p>
        </div>
        <div className={styles.headerActions}>
          <Button
            disabled
            variant="outline"
            size="sm"
            className={styles.btnExport}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button
            disabled
            variant="outline"
            size="sm"
            className={styles.btnImport}
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button
            size="sm"
            className={styles.btnNew}
            onClick={() => setIsNovoClienteOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo cliente
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <StatsCardSkeleton />
      ) : (
        <div className={styles.statsGrid}>
          <Card 
            className={`${styles.statusCard} ${statusFilter === "Ativo" ? styles.statusCardAtivoSelected : styles.statusCardAtivo}`}
            onClick={() => setStatusFilter("Ativo")}
          >
            {statusFilter === "Ativo" && (
              <div className={styles.cardCheckIconWrap}>
                <CheckCircle className={styles.iconAtivo} />
              </div>
            )}
            <CardContent className={styles.cardContentPadded}>
              <div className={styles.textCenter}>
                <p className={styles.textMutedSmall}>Ativo</p>
                <AnimatedNumber value={stats.ativo} color={styles.textAtivo} />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`${styles.statusCard} ${statusFilter === "Inativo" ? styles.statusCardInativoSelected : styles.statusCardInativo}`}
            onClick={() => setStatusFilter("Inativo")}
          >
            {statusFilter === "Inativo" && (
              <div className={styles.cardCheckIconWrap}>
                <CheckCircle className={styles.iconInativo} />
              </div>
            )}
            <CardContent className={styles.cardContentPadded}>
              <div className={styles.textCenter}>
                <p className={styles.textMutedSmall}>Inativo</p>
                <AnimatedNumber value={stats.inativo} color={styles.textInativo} />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`${styles.statusCard} ${statusFilter === "Todos" ? styles.statusCardTodosSelected : styles.statusCardTodos}`}
            onClick={() => setStatusFilter("Todos")}
          >
            {statusFilter === "Todos" && (
              <div className={styles.cardCheckIconWrap}>
                <CheckCircle className={styles.iconTodos} />
              </div>
            )}
            <CardContent className={styles.cardContentPadded}>
              <div className={styles.textCenter}>
                <p className={styles.textMutedSmall}>Todos</p>
                <AnimatedNumber value={stats.todos} color={styles.textTodos} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className={styles.filtersCard}>
        <CardContent className={styles.cardContentPadded}>
          <div className={styles.filtersRow}>
            <div className={styles.flex1}>
              <label className={styles.labelSmall}>
                Pesquisar
              </label>
              <div className={styles.searchWrap}>
                <Search className={styles.searchIcon} />
                <Input
                  placeholder="Pesquisar"
                  className={styles.searchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.filtersRight}>
              <div>
                <label className={styles.labelSmall}>
                  Status
                </label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value)}
                >
                  <SelectTrigger className={styles.selectTriggerSmall}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={styles.selectContent}>
                    <SelectItem value="Todos" className={styles.selectItem}>Todos</SelectItem>
                    <SelectItem value="Ativo" className={styles.selectItem}>Ativo</SelectItem>
                    <SelectItem value="Inativo" className={styles.selectItem}>Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Filtros Ativos */}
          {(statusFilter !== "Todos" || searchTerm) && (
            <div className={styles.activeFiltersRow}>
              <span className={styles.textMutedSmall}>Filtros ativos:</span>
              
              {statusFilter !== "Todos" && (
                <Badge 
                  className={styles.badgeFilter}
                  onClick={() => setStatusFilter("Todos")}
                >
                  Status: {statusFilter}
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
                  setStatusFilter("Todos");
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
      <div className={styles.actionsBar}>
        <div className={styles.actionsLeft}>
          <p className={styles.textMutedSmall}>0 registro(s) selecionado(s)</p>
          <Button disabled variant="outline" size="sm" className={styles.btnDangerOutline}>Excluir</Button>
          <Button disabled variant="outline" size="sm" className={styles.btnSecondary}>Inativar</Button>
        </div>
      </div>

      {/* Table */}
      <Card className={styles.tableCard}>
        <CardContent className={styles.cardContentPadded}>
          {loading ? (
            <LoadingState />
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHeadRow}>
                      <th className={styles.tableHeadCellCheckbox}>
                        <input type="checkbox" className={styles.checkbox} />
                      </th>
                      <th className={styles.tableHeadCell}>
                        Nome
                      </th>
                      <th className={styles.tableHeadCell}>
                        CPF / CNPJ / ID Estrangeiro
                      </th>
                      <th className={styles.tableHeadCell}>
                        E-mail
                      </th>
                      <th className={styles.tableHeadCell}>
                        Telefone
                      </th>
                      <th className={styles.tableHeadCell}>
                        Status
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
                            <input type="checkbox" className={styles.checkbox} />
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
                            {cliente.cnpj}
                          </td>
                          <td className={styles.tableCell}>
                            {cliente.e_mail_principal}
                          </td>
                          <td className={styles.tableCell}>
                            {cliente.telefone_comercial}
                          </td>
                          <td className={styles.tableCell}>{getStatusBadge(cliente.status)}</td>
                          <td className={styles.tableCell}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className={styles.dropdownTrigger}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className={styles.dropdownContent}>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setClienteSelecionado(cliente);
                                    setIsEditarClienteOpen(true);
                                  }}
                                  className={styles.dropdownItem}
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>

                                {cliente.status === "ativo" ? (
                                  <DropdownMenuItem onClick={() => handleToggleStatus(cliente.id, "inativo")} className={styles.dropdownItemDanger}>
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Inativar
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleToggleStatus(cliente.id, "ativo")} className={styles.dropdownItemPrimary}>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Ativar
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuItem onClick={() => setDeleteModal({ isOpen: true, cliente })} className={styles.dropdownItemDanger}>
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
                    </SelectContent>
                  </Select>
                  <span className={styles.textMutedSmall}>Registros por página</span>
                </div>

                <div className={styles.paginationCenter}>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className={styles.pageNavBtn}>
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>

                  <div className={styles.pageNumbers}>
                    {getPageNumbers().map((page, index) => (
                      <Button key={index} variant={currentPage === page ? "default" : "outline"} size="sm" onClick={() => (typeof page === 'number' ? setCurrentPage(page) : null)} disabled={typeof page === 'string'} className={`${styles.pageBtn} ${typeof page === 'string' ? styles.pageEllipsis : currentPage === page ? styles.pageBtnActive : ''}`}>
                        {page}
                      </Button>
                    ))}
                  </div>

                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className={styles.pageNavBtn}>
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <p className={styles.textMutedSmall}>
                  Mostrando {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filteredClientes.length)} de {filteredClientes.length} registros
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
