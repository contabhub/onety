// pages/tipos-de-atividades.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import styles from "../../styles/comercial/crm/TiposAtividade.module.css";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import SpaceLoader from "../../components/onety/menu/SpaceLoader";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";  

export default function TiposDeAtividades() {
  const [tipos, setTipos] = useState([]);
  const [novoNome, setNovoNome] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [editandoNome, setEditandoNome] = useState("");
  const [token, setToken] = useState(null);
  const [empresaId, setEmpresaId] = useState(null); // Estado único para empresa_id
  const [loading, setLoading] = useState(false); // Novo estado para loading
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem("token");
    setToken(t);
    const userRaw = localStorage.getItem("userData") || localStorage.getItem("user");
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        const inferredEmpresaId =
          user.EmpresaId ??
          user?.empresa_id ??
          user?.empresaId ??
          user?.empresa?.id ??
          user?.Empresa?.id ??
          null;
        if (inferredEmpresaId) setEmpresaId(inferredEmpresaId);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (token && empresaId) fetchTipos();
  }, [token, empresaId]);

  const fetchTipos = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/comercial/tipos-atividade/empresa/${empresaId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setTipos(data);
      } else {
        console.warn("Resposta inesperada de tipos:", data);
        setTipos([]);
      }
    } catch (err) {
      console.error("Erro ao buscar tipos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCriar = async () => {
    if (!novoNome.trim()) return;
    if (!empresaId) {
      console.warn("empresaId não definido – não é possível criar o tipo.");
      return;
    }
    try {
      const payload = { nome: novoNome, empresa_id: empresaId };
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/tipos-atividade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      setNovoNome("");
      fetchTipos();
    } catch (err) {
      console.error("Erro ao criar tipo:", err);
    }
  };

  const handleAtualizar = async (id) => {
    if (!empresaId) return;
    try {
      const payload = { nome: editandoNome, empresa_id: empresaId };
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/tipos-atividade/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      setEditandoId(null);
      setEditandoNome("");
      fetchTipos();
    } catch (err) {
      console.error("Erro ao atualizar:", err);
    }
  };

  const handleExcluir = async (id) => {
    if (!confirm("Deseja excluir este tipo de atividade?") || !empresaId) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/tipos-atividade/${id}?empresa_id=${empresaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchTipos();
    } catch (err) {
      console.error("Erro ao excluir:", err);
    }
  };

  return (
    <>
      <div className={styles.page}>
        <PrincipalSidebar />
        <div className={styles.pageContent}>
          <div className={styles.container}>
            <h1 className={styles.title}>Tipos de Atividades</h1>

            <div className={styles.formRow}>
              <input
                type="text"
                placeholder="Novo tipo de atividade"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                className={styles.input}
              />
              <button className={styles.addBtn} onClick={handleCriar}>
                Adicionar
              </button>
            </div>

            {loading ? (
              <SpaceLoader label="Carregando atividades..." />
            ) : (
              <ul className={styles.lista}>
                {tipos.map((tipo) => (
                  <li key={tipo.id} className={styles.item}>
                    {editandoId === tipo.id ? (
                      <>
                        <input
                          className={styles.inputEdit}
                          value={editandoNome}
                          onChange={(e) => setEditandoNome(e.target.value)}
                        />
                        <button
                          className={styles.saveBtn}
                          onClick={() => handleAtualizar(tipo.id)}
                        >
                          Salvar
                        </button>
                        <button className={styles.cancelBtn} onClick={() => setEditandoId(null)}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <span>{tipo.nome}</span>
                        <div className={styles.actionButtons}>
                          <button
                            title="Editar tipo"
                            className={styles.iconButton}
                            onClick={() => {
                              setEditandoId(tipo.id);
                              setEditandoNome(tipo.nome);
                            }}
                          >
                            <FiEdit className={styles.icon} />
                          </button>
                          <button
                            title="Excluir tipo"
                            className={`${styles.iconButton} ${styles.deleteBtn}`}
                            onClick={() => handleExcluir(tipo.id)}
                          >
                            <FiTrash2 className={styles.icon} />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
