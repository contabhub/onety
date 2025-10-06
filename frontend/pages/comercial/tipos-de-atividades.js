// pages/tipos-de-atividades.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import styles from "../styles/TiposAtividade.module.css";
import Layout from "../components/layout/Layout";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";  

export default function TiposDeAtividades() {
  const [tipos, setTipos] = useState([]);
  const [novoNome, setNovoNome] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [editandoNome, setEditandoNome] = useState("");
  const [token, setToken] = useState(null);
  const [equipeId, setEquipeId] = useState(null); // Estado único para equipe_id
  const [loading, setLoading] = useState(false); // Novo estado para loading
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem("token");
    setToken(t);
    const userRaw = localStorage.getItem("user");
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        if (user.equipe_id) setEquipeId(user.equipe_id);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (token && equipeId) fetchTipos();
  }, [token, equipeId]);

  const fetchTipos = async () => {
    if (!equipeId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tipos-atividade/equipe/${equipeId}`,
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
    if (!novoNome.trim() || !equipeId) return;
    try {
      const payload = { nome: novoNome, equipe_id: equipeId };
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tipos-atividade`, {
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
    if (!equipeId) return;
    try {
      const payload = { nome: editandoNome, equipe_id: equipeId };
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tipos-atividade/${id}`, {
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
    if (!confirm("Deseja excluir este tipo de atividade?") || !equipeId) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tipos-atividade/${id}?equipe_id=${equipeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchTipos();
    } catch (err) {
      console.error("Erro ao excluir:", err);
    }
  };

  return (
    <Layout>
      <button className={styles.backButton} onClick={() => router.back()}>
        <span className={styles.iconWrapper}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </span>
        Voltar
      </button>
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
        <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p className={styles.loadingText}>Carregando atividades...</p>
      </div>
      
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
                    <button onClick={() => setEditandoId(null)}>Cancelar</button>
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
    </Layout>
  );
}
