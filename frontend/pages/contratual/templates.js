import { useEffect, useState } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import SpaceLoader from "../../components/onety/menu/SpaceLoader";
import styles from "../../styles/contratual/Contratos.module.css";
import { useAuthRedirect } from "../../utils/auth";
import { useRouter } from "next/router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faPen, faEye, faSearch } from "@fortawesome/free-solid-svg-icons";
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


export default function Templates() {
  useAuthRedirect();
  const [templates, setTemplates] = useState([]);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5); // Convertido para estado
  const [searchTerm, setSearchTerm] = useState("");
  const [globalFilter, setGlobalFilter] = useState("todos"); // "todos" | "globais" | "naoGlobais"
  const [userRole, setUserRole] = useState(null);
  const [userPermissions, setUserPermissions] = useState(null);
  const isSuperAdmin = userRole === 'superadmin';
  const isAdmin = userPermissions && userPermissions.includes('admin');
  const isSuperAdminOrAdmin = isSuperAdmin || isAdmin;

  // Função para resetar página quando mudar quantidade de itens
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset para primeira página
  };

  
  // Filtro de busca + globalidade
  const filteredTemplates = templates.filter(t => {
    const templateName = t.name || t.nome; // Suporte para ambos os campos
    const nameOk = templateName && templateName.toLowerCase().includes(searchTerm.toLowerCase());
    const isGlobal = t.is_global !== undefined ? t.is_global : t.global; // Suporte para ambos os campos
    let globalOk = true;
    if (globalFilter === "globais") globalOk = !!isGlobal;
    if (globalFilter === "naoGlobais") globalOk = !isGlobal;
    return nameOk && globalOk;
  });

  // Debug: log dos templates e filtros
  console.log("Templates state:", templates);
  console.log("Filtered templates:", filteredTemplates);
  console.log("Search term:", searchTerm);
  console.log("Global filter:", globalFilter);
  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage) || 1;
  const paginatedTemplates = filteredTemplates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // useEffect para ajustar página atual quando mudar filtros ou quantidade de itens
  useEffect(() => {
    const maxPage = Math.ceil(filteredTemplates.length / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) {
      setCurrentPage(maxPage);
    }
  }, [filteredTemplates.length, itemsPerPage, currentPage]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("userData");

    if (!token) return;
    const user = JSON.parse(userRaw);
    setUser(user);
    setUserRole(user && user.permissoes?.adm ? String(user.permissoes.adm[0]).toLowerCase() : null);
    setUserPermissions(user && user.permissoes?.adm ? user.permissoes.adm : null);

    // Fetch templates from the API
    const empresaId = user?.EmpresaId;
    const url = `${process.env.NEXT_PUBLIC_API_URL}/contratual/modelos-contrato/empresa/${empresaId}/light`;
    
    console.log("URL da API:", url);
    fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log("Dados recebidos da API:", data);
        if (Array.isArray(data)) {
          setTemplates(data);
          console.log("Templates definidos:", data);
        } else {
          console.log("Dados não são um array:", data);
        }
        setIsLoading(false); // Finaliza carregamento
      })
      .catch(err => {
        console.error("Erro ao carregar templates:", err);
        toast.error("Erro ao carregar templates.");
        setIsLoading(false); // Finaliza carregamento mesmo em caso de erro
      })

  }, []);

  const handleViewContract = (id) => {
    router.push(`/contratual/editar-template?id=${id}`);
  };

  const handleDeleteTemplate = (id) => {
    const token = localStorage.getItem("token");
    const confirmDelete = window.confirm("Deseja excluir este template?");
    if (confirmDelete) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/modelos-contrato/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
        .then((res) => {
          if (res.ok) {
            setTemplates((prev) => prev.filter((t) => t.id !== id));   
            toast.success("Template excluído com sucesso!");
          } else {
            toast.error("Erro ao excluir template.");
          }
        })
        .catch((err) => {
          console.error("Erro ao excluir template:", err);
          toast.error("Erro ao excluir template.");
        });
    }
  };

  return (
    <div className={styles.page}>
      <PrincipalSidebar />
      <div className={styles.pageContent}>
        <div className={styles.pageContainer}>
          <div className={styles.header}>
            <h1 className={styles.title}>Modelos de Contrato</h1>
            <div className={styles.userButtonContainer}>
              <button
                className={styles.button}
                onClick={() => router.push("/contratual/criar-template")}
              >
                Criar Template
              </button>
            </div>
          </div>
        {/* Campo de busca */}
        <div className={styles.filtroContainer}>
          <label htmlFor="searchInput">Buscar:</label>
          <input
            id="searchInput"
            type="text"
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className={styles.searchInput}
          />
          {isSuperAdmin && (
            <select
              value={globalFilter}
              onChange={e => {
                setGlobalFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ marginLeft: 16, minWidth: 120 }}
            >
              <option value="todos">Todos</option>
              <option value="globais">Globais</option>
              <option value="naoGlobais">Não globais</option>
            </select>
          )}
          
          {/* Seletor de quantidade de itens por página */}
          <div className={styles.itemsPerPageContainer}>
            <select
              id="itemsPerPage"
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className={styles.itemsPerPageSelect}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <SpaceLoader 
            size={140} 
            label="Carregando templates..." 
            showText={true}
            minHeight={400}
          />
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>Criado por</th>
                  <th>Criado em</th>
                  {isSuperAdmin && <th>Global</th>}
                  {isSuperAdminOrAdmin && <th>Straton</th>}
                  {isSuperAdminOrAdmin && <th>Funcionário</th>}
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTemplates.map((template) => {
                  const templateName = template.name || template.nome;
                  const isGlobal = template.is_global !== undefined ? template.is_global : template.global;
                  const criadoEm = template.criado_em ? new Date(template.criado_em).toLocaleDateString('pt-BR') : '-';
                  
                  return (
                    <tr key={template.id}>
                      <td>{template.id}</td>
                      <td>{templateName}</td>
                      <td>{template.criado_por || '-'}</td>
                      <td>{criadoEm}</td>
                      {isSuperAdmin && <td>{isGlobal ? 'Sim' : 'Não'}</td>}
                      {isSuperAdminOrAdmin && <td>{template.straton ? 'Sim' : 'Não'}</td>}
                      {isSuperAdminOrAdmin && <td>{template.funcionario ? 'Sim' : 'Não'}</td>}
                      <td className={styles.actions}>
                        <button
                          className={styles.viewIcon}
                          title="Visualizar Template"
                          onClick={() => router.push(`/contratual/templates/${template.id}`)}
                        >
                          <FontAwesomeIcon icon={faEye} />
                        </button>
                        {(!isGlobal || isSuperAdminOrAdmin) && (
                          <button
                            className={styles.editIcon}
                            onClick={() => handleViewContract(template.id)}
                          >
                            <FontAwesomeIcon icon={faPen} />
                          </button>
                        )}
                        {(!isGlobal || isSuperAdminOrAdmin) && (
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredTemplates.length === 0 && (
                  <tr>
                    <td colSpan={
                      isSuperAdmin ? 8 : 
                      isSuperAdminOrAdmin ? 6 : 5
                    } style={{ textAlign: "center", padding: "20px" }}>
                      Nenhum template encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredTemplates.length > 0 && totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`${styles.pageButton} ${currentPage === 1 ? styles.disabled : ''}`}
              >
                Anterior
              </button>

              <span className={styles.pageInfo}>
                Página {currentPage} de {totalPages}
              </span>


              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`${styles.pageButton} ${currentPage === totalPages ? styles.disabled : ''}`}
              >
                Próxima
              </button>

            </div>
          )}
          
          {/* Informação quando há apenas uma página */}
          {filteredTemplates.length > 0 && totalPages === 1 && (
            <div className={styles.singlePageMessage}>
              Mostrando todos os {filteredTemplates.length} templates
            </div>
          )}
        </>
        )}

        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick={false}
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
          transition={Bounce}
        />
        </div>
      </div>
    </div>
  );
}
