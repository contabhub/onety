import { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import styles from "../styles/Templates.module.css";
import { useAuthRedirect } from "../utils/auth";
import { useRouter } from "next/router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faPen, faEye, faSearch } from "@fortawesome/free-solid-svg-icons";
import UserMenu from "../components/menu/UserMenu";
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import meuLottieJson from '../assets/Loading.json';
import Lottie from 'lottie-react';


export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5); // Convertido para estado
  const [searchTerm, setSearchTerm] = useState("");
  const [globalFilter, setGlobalFilter] = useState("todos"); // "todos" | "globais" | "naoGlobais"

  // Função para resetar página quando mudar quantidade de itens
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset para primeira página
  };

  // Filtro de busca + globalidade
  const filteredTemplates = templates.filter(t => {
    const nameOk = t.name && t.name.toLowerCase().includes(searchTerm.toLowerCase());
    let globalOk = true;
    if (globalFilter === "globais") globalOk = !!t.is_global;
    if (globalFilter === "naoGlobais") globalOk = !t.is_global;
    return nameOk && globalOk;
  });
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
    const userRaw = localStorage.getItem("user");

    if (!token) return;
    const user = JSON.parse(userRaw);
    setUser(user);

    // Fetch templates from the API
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/templates/light`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-equipe-id": user?.equipe_id,
      },
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTemplates(data);
        }
        setIsLoading(false); // Finaliza carregamento

      })
      .catch(err => {
        console.error("Erro ao carregar templates:", err);
      })

  }, []);

  const handleViewContract = (id) => {
    router.push(`/editar-template?id=${id}`);
  };

  const handleDeleteTemplate = (id) => {
    const token = localStorage.getItem("token");
    const confirmDelete = window.confirm("Deseja excluir este template?");
    if (confirmDelete) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/templates/${id}`, {
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
    <Layout>
      <div className={styles.templatesHeader}>
        <h1 className={styles.title}>Modelos de Contrato</h1>
        <button
          className={styles.newBtn}
          onClick={() => router.push("/criar-template")}
        >
          Criar Template
        </button>
      </div>
      {/* Campo de busca */}
      <div className={styles.searchContainer}>
        <div className={styles.searchInputWrapper}>
          <FontAwesomeIcon icon={faSearch} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <select
          className={styles.globalFilterSelect}
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
        <div className={styles.loadingContainer}>
          <Lottie 
            animationData={meuLottieJson} 
            loop={true}
            style={{ width: 200, height: 200 }}
          />          <p className={styles.loadingText}>Carregando templates...</p>
        </div>
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTemplates.map((template) => (
                  <tr key={template.id}>
                    <td>{template.id}</td>
                    <td>{template.name}</td>
                    <td className={styles.actions}>
                      <button
                        className={styles.viewIcon}
                        title="Visualizar Template"
                        onClick={() => router.push(`/templates/${template.id}`)}
                      >
                        <FontAwesomeIcon icon={faEye} />
                      </button>
                      {(!template.is_global || user?.role === "superadmin") && (

                        <button
                          className={styles.editIcon}
                          onClick={() => handleViewContract(template.id)}
                        >
                          <FontAwesomeIcon icon={faPen} />
                        </button>
                      )}
                      {(!template.is_global || user?.role === "superadmin") && (
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDeleteTemplate(template.id)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      )}

                    </td>
                  </tr>
                ))}
                {filteredTemplates.length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ textAlign: "center", padding: "20px" }}>
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


    </Layout>
  );
}
