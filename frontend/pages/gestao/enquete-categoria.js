import { useEffect, useState } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import NavEnquete from "../../components/gestao/NavEnquete";
import styles from "../../styles/gestao/EnquetePage.module.css";
import { FaSearch, FaLayerGroup } from "react-icons/fa";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function EnqueteCategoriaPage() {
  const [categorias, setCategorias] = useState([]);
  const [categoriasFiltradas, setCategoriasFiltradas] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalFechando, setModalFechando] = useState(false);
  const [nome, setNome] = useState("");
  const [categoriaId, setCategoriaId] = useState(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchCategorias = async () => {
    try {
      setLoading(true);
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        setLoading(false);
        return;
      }
      
      const url = `${BASE_URL}/gestao/enquete/categorias`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setCategorias(data);
      setCategoriasFiltradas(data);
    } catch (err) {
      console.error("Erro ao buscar categorias:", err);
    } finally {
      setLoading(false);
      setTimeout(() => setHasLoaded(true), 50);
    }
  };

  const salvarCategoria = async () => {
    if (!nome) return;
    const payload = { nome };

    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const url = modoEdicao && categoriaId 
        ? `${BASE_URL}/gestao/enquete/categorias/${categoriaId}`
        : `${BASE_URL}/gestao/enquete/categorias`;
      
      const response = await fetch(url, {
        method: modoEdicao && categoriaId ? "PUT" : "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Empresa-Id": empresaId.toString()
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      limparModal();
      fetchCategorias();
    } catch (err) {
      console.error("Erro ao salvar categoria:", err);
    }
  };

  const abrirModalEdicao = (categoria) => {
    setModoEdicao(true);
    setCategoriaId(categoria.id);
    setNome(categoria.nome);
    setModalAberto(true);
  };

  const limparModal = () => {
    setModalFechando(true);
    setTimeout(() => {
      setModalFechando(false);
      setModalAberto(false);
      setNome("");
      setCategoriaId(null);
      setModoEdicao(false);
    }, 300);
  };

  const excluirCategoria = async () => {
    try {
      if (categoriaId) {
        const token = typeof window !== "undefined" 
          ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
          : "";
        const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
        const userData = rawUserData ? JSON.parse(rawUserData) : {};
        const empresaId = userData?.EmpresaId;
        
        if (!empresaId) {
          console.error("EmpresaId não encontrado no storage");
          return;
        }
        
        const url = `${BASE_URL}/gestao/enquete/categorias/${categoriaId}`;
        const response = await fetch(url, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Empresa-Id": empresaId.toString()
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        limparModal();
        fetchCategorias();
      }
    } catch (err) {
      console.error("Erro ao excluir categoria:", err);
    }
  };

  useEffect(() => {
    fetchCategorias();
  }, []);

  return (
    <>
      <PrincipalSidebar />
      <NavEnquete
        tabs={[
          { name: "Enquete", path: "/gestao/enquete" },
          { name: "Categoria", path: "/gestao/enquete-categoria" },
          { name: "Particularidade", path: "/gestao/enquete-particularidade" },
          { name: "Respondendo Enquete", path: "#" },
        ]}
        active="categoria"
      />
      <div className={styles.container}>
        {/* Header com título e botão */}
        <div className={styles.headerRow}>
          <h1 className={styles.headerTitle}>Gestão de Categorias</h1>
          <button
            className={styles.buttonNovo}
            onClick={() => setModalAberto(true)}
          >
            <FaLayerGroup className={styles.icon} />
            Nova Categoria
          </button>
        </div>

        {/* Campo de pesquisa */}
        <div className={styles.searchWrapper}>
          <FaSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Pesquisar categoria..."
            onChange={(e) => {
              const termo = e.target.value.toLowerCase();
              const filtradas = categorias.filter((c) =>
                c.nome.toLowerCase().includes(termo)
              );
              setCategoriasFiltradas(filtradas);
            }}
            className={styles.filterInput}
          />
        </div>

        {/* Tabela de categorias */}
        {loading ? (
          <div className={styles.spinnerContainer}>
            <div className={styles.spinner}></div>
            <span>Carregando categorias...</span>
          </div>
        ) : (
          <table className={`${styles.table} ${hasLoaded ? styles.fadeIn : ""}`}>
            <thead>
              <tr>
                <th className={styles.th}>ID</th>
                <th className={styles.th}>Nome</th>
              </tr>
            </thead>
            <tbody>
              {categoriasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={2} className={styles.emptyState}>
                    Nenhuma categoria encontrada. Crie sua primeira categoria!
                  </td>
                </tr>
              ) : (
                categoriasFiltradas.map((c, i) => (
                  <tr key={c.id}>
                    <td className={styles.td}>{i + 1}</td>
                    <td 
                      className={`${styles.td} ${styles.linkTd}`} 
                      onClick={() => abrirModalEdicao(c)}
                    >
                      {c.nome}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Modal */}
        {modalAberto && (
          <div
            className={`${styles.modalOverlay} ${
              modalFechando ? styles.fadeOutOverlay : styles.fadeInOverlay
            }`}
          >
            <div
              className={`${styles.modalContent} ${
                modalFechando ? styles.fadeOutContent : styles.fadeInContent
              }`}
            >
              <h2 className={styles.modalTitle}>
                {modoEdicao ? "Editar Categoria" : "Nova Categoria"}
              </h2>
              <div className={styles.modalForm}>
                <div>
                  <label htmlFor="nome">Nome *</label>
                  <input
                    id="nome"
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Digite o nome da categoria"
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                {modoEdicao && (
                  <button
                    onClick={excluirCategoria}
                    className={styles.buttonCancelar}
                  >
                    Excluir
                  </button>
                )}
                <button
                  onClick={salvarCategoria}
                  className={styles.buttonSalvar}
                >
                  Salvar
                </button>
                <button onClick={limparModal} className={styles.buttonCancelar}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
