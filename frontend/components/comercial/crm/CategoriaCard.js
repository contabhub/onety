import { useEffect, useState } from "react";
import styles from "../../../styles/comercial/crm/CategoriasPersonalizadas.module.css";
import { FaTrash, FaEdit, FaPlus, FaCheck, FaTimes } from "react-icons/fa";

export default function CategoriaCard({
  categoria,
  onDeleteCategoria,
  onUpdate,
}) {
  const [campos, setCampos] = useState([]);
  const [nomeCampo, setNomeCampo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("texto");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editCategoria, setEditCategoria] = useState(false);
  const [categoriaNome, setCategoriaNome] = useState(categoria.nome);
  const [editCampoId, setEditCampoId] = useState(null);
  const [editCampoData, setEditCampoData] = useState({
    nome: "",
    tipo: "",
    descricao: "",
  });

  const fetchCampos = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/comercial/campos-personalizados/${categoria.id}`
      );
      const data = await res.json();
      setCampos(data);
    } catch (err) {
      console.error("Erro ao buscar campos:", err);
    }
  };

  useEffect(() => {
    fetchCampos();
  }, [categoria.id]);

  const handleAddCampo = async (e) => {
    e.preventDefault();
    if (!nomeCampo || !tipo) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/comercial/campos-personalizados`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            categoria_id: categoria.id,
            funil_id: null,
            nome: nomeCampo,
            descricao,
            tipo,
          }),
        }
      );

      if (res.ok) {
        setNomeCampo("");
        setDescricao("");
        setTipo("texto");
        fetchCampos();
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      console.error("Erro ao adicionar campo:", err);
    }
  };

  const handleUpdateCampo = async (id) => {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/comercial/campos-personalizados/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editCampoData),
        }
      );
      setEditCampoId(null);
      fetchCampos();
    } catch (err) {
      console.error("Erro ao atualizar campo:", err);
    }
  };

  const handleUpdateCategoria = async () => {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/comercial/categorias-campos/${categoria.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: categoriaNome }),
        }
      );
      setEditCategoria(false);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Erro ao atualizar categoria:", err);
    }
  };

  const handleDeleteCampo = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este campo?")) return;

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/comercial/campos-personalizados/${id}`,
        {
          method: "DELETE",
        }
      );
      fetchCampos();
    } catch (err) {
      console.error("Erro ao excluir campo:", err);
    }
  };

  return (
    <div className={styles.campoBox}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {editCategoria ? (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="text"
              value={categoriaNome}
              onChange={(e) => setCategoriaNome(e.target.value)}
              className={styles.input}
              style={{ maxWidth: "250px" }}
            />
            <button
              className={styles.excluirCampoBtn}
              onClick={handleUpdateCategoria}
            >
              <FaCheck />
            </button>
            <button
              className={styles.excluirCampoBtn}
              onClick={() => setEditCategoria(false)}
            >
              <FaTimes />
            </button>
          </div>
        ) : (
          <h3>{categoria.nome}</h3>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            className={styles.editCampoBtn}
            onClick={() => setEditCategoria(true)}
            title="Editar categoria"
          >
            <FaEdit />
          </button>
          <button
            className={styles.trashCampoBtn}
            onClick={() => onDeleteCategoria(categoria.id)}
            title="Excluir categoria"
          >
            <FaTrash />
          </button>
        </div>
      </div>

      <ul className={styles.camposList}>
        {campos.map((campo) => (
          <li key={campo.id} className={styles.campoItem}>
            {editCampoId === campo.id ? (
              <div style={{ width: "100%" }}>
                <input
                  type="text"
                  placeholder="Nome"
                  value={editCampoData.nome}
                  onChange={(e) =>
                    setEditCampoData({ ...editCampoData, nome: e.target.value })
                  }
                  className={styles.input}
                />
                <input
                  type="text"
                  placeholder="Descrição"
                  value={editCampoData.descricao}
                  onChange={(e) =>
                    setEditCampoData({
                      ...editCampoData,
                      descricao: e.target.value,
                    })
                  }
                  className={styles.input}
                />
                <select
                  value={editCampoData.tipo}
                  onChange={(e) =>
                    setEditCampoData({ ...editCampoData, tipo: e.target.value })
                  }
                  className={styles.input}
                >
                  <option value="texto">Texto</option>
                  <option value="numero">Número</option>
                  <option value="data">Data</option>
                  <option value="lista">Lista</option>
                  <option value="url">URL</option>
                  <option value="endereco">Endereço</option>
                </select>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginTop: "0.5rem",
                  }}
                >
                  <button
                    className={styles.button}
                    onClick={() => handleUpdateCampo(campo.id)}
                  >
                    Salvar
                  </button>
                  <button
                    className={styles.button}
                    onClick={() => setEditCampoId(null)}
                    style={{ backgroundColor: "#e53e3e" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span>
                  <strong>{campo.nome}</strong> — {campo.tipo}
                </span>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    className={styles.editCampoBtn}
                    title="Editar campo"
                    onClick={() => {
                      setEditCampoId(campo.id);
                      setEditCampoData({
                        nome: campo.nome,
                        tipo: campo.tipo,
                        descricao: campo.descricao || "",
                      });
                    }}
                  >
                    <FaEdit />
                  </button>

                  <button
                    className={styles.trashCampoBtn}
                    onClick={() => handleDeleteCampo(campo.id)}
                    title="Excluir campo"
                  >
                    <FaTrash />
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {showForm ? (
        <form className={styles.formNovoCampo} onSubmit={handleAddCampo}>
          <input
            type="text"
            placeholder="Nome do campo"
            value={nomeCampo}
            onChange={(e) => setNomeCampo(e.target.value)}
          />
          <input
            type="text"
            placeholder="Descrição (opcional)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="texto">Texto</option>
            <option value="numero">Número</option>
            <option value="data">Data</option>
            <option value="lista">Lista</option>
            <option value="url">URL</option>
            <option value="endereco">Endereço</option>
          </select>

          <div style={{ display: "flex", gap: "1rem" }}>
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className={styles.button}
              style={{ backgroundColor: "#e53e3e" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className={styles.addFieldButton}
        >
          + Adicionar campo
        </button>
      )}
    </div>
  );
}
