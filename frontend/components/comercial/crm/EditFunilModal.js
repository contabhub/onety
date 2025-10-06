import { useState, useEffect } from "react";
import styles from "../../../styles/comercial/crm/CRM.module.css";

export default function EditFunilModal({ open, onClose, funil, onSave }) {
  const [nome, setNome] = useState(funil?.nome || "");
  const [fases, setFases] = useState([]);

  useEffect(() => {
    if (funil) {
      setNome(funil.nome || "");
      fetchFases(funil.id);
    }
  }, [funil]);

  const fetchFases = async (funilId) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funil-fases/${funilId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setFases(data);
    } catch (err) {
      console.error("Erro ao buscar fases:", err);
    }
  };

  const handleFaseChange = (index, value) => {
    const updated = [...fases];
    updated[index].nome = value;
    setFases(updated);
  };

  const handleSave = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      // Atualiza o nome do funil
      const resFunil = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funis/${funil.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome,
          is_default: false,
        }),
      });

      if (!resFunil.ok) throw new Error("Erro ao salvar funil");

      // Atualiza cada fase
      for (const fase of fases) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funil-fases/${fase.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            nome: fase.nome,
            descricao: fase.descricao || "",
            ordem: fase.ordem || 0,
          }),
        });
      }

      onSave(); // recarrega lista
      onClose();
    } catch (err) {
      console.error("Erro ao salvar edição:", err);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2 className={styles.modalTitle}>Editar Funil</h2>

        <input
          className={styles.input}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do funil"
        />

        <div style={{ marginTop: "1rem" }}>
          <h4 style={{ marginBottom: "0.5rem" }}>Fases do Funil</h4>
          {fases.map((fase, index) => (
            <input
              key={fase.id}
              className={styles.input}
              value={fase.nome}
              onChange={(e) => handleFaseChange(index, e.target.value)}
              placeholder={`Fase ${index + 1}`}
              style={{ marginBottom: "0.5rem" }}
            />
          ))}
        </div>

        <div className={styles.modalActions}>
          <button className={styles.saveBtn} onClick={handleSave}>
            Salvar
          </button>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
