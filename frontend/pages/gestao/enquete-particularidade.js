import { useEffect, useState } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import NavEnquete from "../../components/gestao/NavEnquete";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from "../../styles/gestao/EnquetePage.module.css";
import { FaSearch, FaRegStar } from "react-icons/fa";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function EnqueteParticularidadePage() {
  const [particularidades, setParticularidades] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [modoEdicao, setModoEdicao] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalFechando, setModalFechando] = useState(false);
  const [particularidadeSelecionada, setParticularidadeSelecionada] = useState({
    id: "",
    nome: "",
    descricao: "",
    categoriaId: ""
  });

  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    fetchParticularidades();
    fetchCategorias();
  }, []);

  const fetchParticularidades = async () => {
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
      
      const url = `${BASE_URL}/gestao/enquete/particularidades`;
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
      setParticularidades(data);
    } catch (err) {
      console.error("Erro ao buscar particularidades:", err);
    } finally {
      setLoading(false);
      setTimeout(() => setHasLoaded(true), 50);
    }
  };

  const fetchCategorias = async () => {
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
    } catch (err) {
      console.error("Erro ao buscar categorias:", err);
    }
  };

  const abrirModalEdicao = (p) => {
    setModoEdicao(true);
    setParticularidadeSelecionada(p);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalFechando(true);
    setTimeout(() => {
      setModalFechando(false);
      setModalAberto(false);
      setModoEdicao(false);
      setParticularidadeSelecionada({ id: "", nome: "", descricao: "", categoriaId: "" });
    }, 300);
  };

  const handleSalvar = async () => {
    const { id, nome, descricao, categoriaId } = particularidadeSelecionada;
    const payload = { nome, descricao, categoriaId };

    const nomeTrim = nome.trim().toLowerCase();
    const nomeExiste = particularidades.some(
      (p) => p.nome.trim().toLowerCase() === nomeTrim && p.id !== id
    );

    if (nomeExiste) {
      toast.warning(`Ops, o nome ${nome} já existe, altere antes de salvar.`);
      return;
    }

    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        toast.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const url = id 
        ? `${BASE_URL}/gestao/enquete/particularidades/${id}`
        : `${BASE_URL}/gestao/enquete/particularidades`;
      
      const response = await fetch(url, {
        method: id ? "PUT" : "POST",
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

      fecharModal();
      fetchParticularidades();
    } catch (err) {
      console.error("Erro ao salvar particularidade:", err);
      toast.error("Erro ao salvar particularidade");
    }
  };

  const handleExcluir = async () => {
    const { id } = particularidadeSelecionada;
    if (!id) return;

    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        toast.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const url = `${BASE_URL}/gestao/enquete/particularidades/${id}`;
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

      fecharModal();
      fetchParticularidades();
    } catch (err) {
      console.error("Erro ao excluir particularidade:", err);
      toast.error("Erro ao excluir particularidade");
    }
  };

  const particularidadesFiltradas = particularidades.filter((p) =>
    p.nome.toLowerCase().includes(filtro.toLowerCase())
  );

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
        active="particularidade"
      />
      <div className={styles.container}>
        <ToastContainer />

        {/* Header com título e botão */}
        <div className={styles.headerRow}>
          <h1 className={styles.headerTitle}>Gestão de Particularidades</h1>
          <button
            className={styles.buttonNovo}
            onClick={() => {
              setModoEdicao(false);
              setParticularidadeSelecionada({ id: "", nome: "", descricao: "", categoriaId: "" });
              setModalAberto(true);
            }}
          >
            <FaRegStar className={styles.icon} />
            Nova Particularidade
          </button>
        </div>

        {/* Campo de pesquisa */}
        <div className={styles.searchWrapper}>
          <FaSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Pesquisar particularidade..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className={styles.filterInput}
          />
        </div>

        {/* Tabela de particularidades */}
        {loading ? (
          <div className={styles.spinnerContainer}>
            <div className={styles.spinner}></div>
            <span>Carregando particularidades...</span>
          </div>
        ) : (
          <table className={`${styles.table} ${hasLoaded ? styles.fadeIn : ""}`}>
            <thead>
              <tr>
                <th className={styles.th}>ID</th>
                <th className={styles.th}>Nome</th>
                <th className={styles.th}>Descrição</th>
                <th className={styles.th}>Categoria</th>
              </tr>
            </thead>
            <tbody>
              {particularidadesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.emptyState}>
                    Nenhuma particularidade encontrada. Crie sua primeira particularidade!
                  </td>
                </tr>
              ) : (
                particularidadesFiltradas.map((p, i) => (
                  <tr key={p.id}>
                    <td className={styles.td}>{i + 1}</td>
                    <td
                      className={`${styles.td} ${styles.linkTd}`}
                      onClick={() => abrirModalEdicao(p)}
                    >
                      {p.nome}
                    </td>
                    <td className={styles.td}>{p.descricao}</td>
                    <td className={styles.td}>{p.categoria}</td>
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
                {modoEdicao ? "Editar Particularidade" : "Nova Particularidade"}
              </h2>

              <div className={styles.modalForm}>
                <div>
                  <label>Nome *</label>
                  <input
                    type="text"
                    value={particularidadeSelecionada.nome}
                    onChange={(e) =>
                      setParticularidadeSelecionada((prev) => ({
                        ...prev,
                        nome: e.target.value,
                      }))
                    }
                    placeholder="Nome da particularidade"
                  />
                </div>

                <div>
                  <label>Descrição *</label>
                  <textarea
                    value={particularidadeSelecionada.descricao}
                    onChange={(e) =>
                      setParticularidadeSelecionada((prev) => ({
                        ...prev,
                        descricao: e.target.value,
                      }))
                    }
                    placeholder="Descrição"
                  />
                </div>

                <div>
                  <label>Categoria *</label>
                  <select
                    value={particularidadeSelecionada.categoriaId}
                    onChange={(e) =>
                      setParticularidadeSelecionada((prev) => ({
                        ...prev,
                        categoriaId: e.target.value,
                      }))
                    }
                  >
                    <option value="">Selecione...</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.modalFooter}>
                {modoEdicao && (
                  <button onClick={handleExcluir} className={styles.buttonCancelar}>
                    Excluir
                  </button>
                )}
                <button onClick={handleSalvar} className={styles.buttonSalvar}>
                  Salvar
                </button>
                <button onClick={fecharModal} className={styles.buttonCancelar}>
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
