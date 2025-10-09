import { useEffect, useState } from "react";
import styles from "../../styles/comercial/crm/CategoriasPersonalizadas.module.css";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import SpaceLoader from "../../components/onety/menu/SpaceLoader";
import CategoriaCard from "../../components/comercial/crm/CategoriaCard";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";      
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/router";

export default function CategoriasPersonalizadas() {
  const [categorias, setCategorias] = useState([]);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const userRaw = localStorage.getItem("userData");
    if (userRaw) {
      const user = JSON.parse(userRaw);
      setEmpresaId(user?.EmpresaId || user?.empresa?.id);
    }
  }, []);

  const fetchCategorias = async () => {
    if (!empresaId) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/categorias-campos/${empresaId}`);
      const data = await res.json();
      setCategorias(data);
    } catch (err) {
      console.error("Erro ao buscar categorias:", err);
    }
  };

  useEffect(() => {
    if (empresaId) {
      fetchCategorias();
    }
  }, [empresaId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nome || !empresaId) return;

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/categorias-campos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ empresa_id: empresaId, nome }),
      });

      if (res.ok) {
        setNome("");
        fetchCategorias();
      }
    } catch (err) {
      console.error("Erro ao criar categoria:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/categorias-campos/${id}`, {
        method: "DELETE",
      });
      fetchCategorias();
    } catch (err) {
      console.error("Erro ao excluir categoria:", err);
    }
  };

  if (!empresaId) {
    return (
      <div style={{ display: 'flex', height: '100vh' }}>
        <PrincipalSidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SpaceLoader label="Carregando categorias..." />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <PrincipalSidebar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <button className={styles.backButton} onClick={() => router.back()}>
          <span className={styles.iconWrapper}>
            <FontAwesomeIcon icon={faArrowLeft} />
          </span>
          Voltar
        </button>
        <div className={styles.container}>
          <h2 className={styles.title}>Cadastro de Categorias Personalizadas</h2>

          <form className={styles.form} onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Nome da categoria"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={styles.input}
            />
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </form>

          <div>
            {categorias.map((cat) => (
              <CategoriaCard
                key={cat.id}
                categoria={cat}
                onDeleteCategoria={handleDelete}
                onUpdate={fetchCategorias}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
