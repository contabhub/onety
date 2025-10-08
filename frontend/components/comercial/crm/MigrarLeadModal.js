import { useState, useEffect } from "react";
import styles from "../../../styles/comercial/crm/CRM.module.css";

export default function MigrarLeadModal({ open, onClose, lead, onMigrated }) {
  const [funis, setFunis] = useState([]);
  const [fases, setFases] = useState([]);
  const [funilSelecionado, setFunilSelecionado] = useState(null);
  const [faseSelecionada, setFaseSelecionada] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingFases, setLoadingFases] = useState(false);

  useEffect(() => {
    if (open && lead) {
      fetchFunis();
    }
  }, [open, lead]);

  useEffect(() => {
    if (funilSelecionado) {
      fetchFases(funilSelecionado);
    } else {
      setFases([]);
      setFaseSelecionada(null);
    }
  }, [funilSelecionado]);

  const fetchFunis = async () => {
    try {
      const token = localStorage.getItem("token");
      const userRaw = localStorage.getItem("userData");
      
      if (!token || !userRaw) return;
      
      const user = JSON.parse(userRaw);
      const empresaId = user?.EmpresaId || user?.empresa?.id;
      
      if (!empresaId) {
        console.error("Usuário não tem empresa associada.");
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funis/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Erro ao buscar funis");
      
      const funisData = await res.json();
      setFunis(Array.isArray(funisData) ? funisData : []);
    } catch (error) {
      console.error("Erro ao buscar funis:", error);
    }
  };

  const fetchFases = async (funilId) => {
    if (!funilId) return;
    
    setLoadingFases(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funil-fases/${funilId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Erro ao buscar fases");
      
      const fasesData = await res.json();
      setFases(Array.isArray(fasesData) ? fasesData : []);
    } catch (error) {
      console.error("Erro ao buscar fases:", error);
      setFases([]);
    } finally {
      setLoadingFases(false);
    }
  };

  const handleMigrar = async () => {
    if (!funilSelecionado || !faseSelecionada) {
      alert("Selecione um funil e uma fase para migrar o lead.");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funis/leads/${lead.id}/mover`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          funil_id: funilSelecionado,
          fase_id: faseSelecionada,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erro ao migrar lead");
      }

      const result = await res.json();
      console.log("Lead migrado com sucesso:", result);
      
      // Fecha o modal e notifica o componente pai
      onMigrated();
      onClose();
      
      // Reset dos estados
      setFunilSelecionado(null);
      setFaseSelecionada(null);
    } catch (error) {
      console.error("Erro ao migrar lead:", error);
      alert(`Erro ao migrar lead: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFunilSelecionado(null);
    setFaseSelecionada(null);
    onClose();
  };

  if (!open) return null;

  const leadNome = lead?.name || lead?.nome || lead?.Nome || "";

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Migrar Lead</h3>
          <button onClick={handleClose} className={styles.closeButton}>
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label>Lead:</label>
            <p className={styles.leadInfo}>{leadNome}</p>
          </div>

          <div className={styles.formGroup}>
            <label>Selecione o Funil:</label>
            <select
              value={funilSelecionado || ""}
              onChange={(e) => setFunilSelecionado(e.target.value ? Number(e.target.value) : null)}
              className={styles.select}
            >
              <option value="">Selecione um funil</option>
              {funis.map((funil) => (
                <option key={funil.id} value={funil.id}>
                  {funil.nome}
                </option>
              ))}
            </select>
          </div>

          {funilSelecionado && (
            <div className={styles.formGroup}>
              <label>Selecione a Fase:</label>
              {loadingFases ? (
                <p>Carregando fases...</p>
              ) : (
                <select
                  value={faseSelecionada || ""}
                  onChange={(e) => setFaseSelecionada(e.target.value ? Number(e.target.value) : null)}
                  className={styles.select}
                >
                  <option value="">Selecione uma fase</option>
                  {fases.map((fase) => (
                    <option key={fase.id} value={fase.id}>
                      {fase.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {funilSelecionado && faseSelecionada && (
            <div className={styles.formGroup}>
              <label>Confirmação:</label>
              <p className={styles.confirmation}>
                O lead <strong>{leadNome}</strong> será movido para a fase{" "}
                <strong>
                  {fases.find(f => f.id === faseSelecionada)?.nome}
                </strong>{" "}
                do funil{" "}
                <strong>
                  {funis.find(f => f.id === funilSelecionado)?.nome}
                </strong>
              </p>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button onClick={handleClose} className={styles.cancelButton}>
            Cancelar
          </button>
          <button
            onClick={handleMigrar}
            disabled={!funilSelecionado || !faseSelecionada || loading}
            className={styles.saveButton}
          >
            {loading ? "Migrando..." : "Migrar Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}
