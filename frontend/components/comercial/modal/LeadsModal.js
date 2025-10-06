import { useEffect, useMemo, useState } from "react";
import styles from "./LeadsModal.module.css";

export default function LeadsModal({ onClose, onSelect }) {
  const [funis, setFunis] = useState([]);
  const [selectedFunilId, setSelectedFunilId] = useState("");
  const [fases, setFases] = useState([]); // cada fase: { id, nome, ordem, leads: [] }
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingFunis, setLoadingFunis] = useState(false);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [leadParaConfirmar, setLeadParaConfirmar] = useState(null);
  // Sem paginação

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");
    const user = userRaw ? JSON.parse(userRaw) : null;
    const equipeId = user?.equipe_id;

    if (!token || !equipeId) {
      alert("Você precisa estar logado para acessar o CRM.");
      return;
    }

    setLoadingFunis(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/funis/${equipeId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao buscar funis.");
        return res.json();
      })
      .then((data) => {
        setFunis(data || []);
        // Seleciona default se existir
        const def = (data || []).find((f) => f.is_default);
        if (def) setSelectedFunilId(String(def.id));
      })
      .catch(() => alert("Erro ao buscar funis"))
      .finally(() => setLoadingFunis(false));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");
    const user = userRaw ? JSON.parse(userRaw) : null;
    const equipeId = user?.equipe_id;

    if (!token || !equipeId || !selectedFunilId) return;

    setLoadingBoard(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/crm/${equipeId}/${selectedFunilId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao buscar dados do funil.");
        return res.json();
      })
      .then((data) => {
        const fasesApi = Array.isArray(data?.fases) ? data.fases : [];
        setFases(fasesApi);
      })
      .catch(() => alert("Erro ao carregar fases e leads do funil"))
      .finally(() => setLoadingBoard(false));
  }, [selectedFunilId]);

  const filteredFases = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return fases;
    return fases.map((f) => ({
      ...f,
      leads: Array.isArray(f.leads)
        ? f.leads.filter((l) => (l?.name || "").toLowerCase().includes(term))
        : [],
    }));
  }, [fases, searchTerm]);

  // Retorna classe CSS para o ponto/color da fase
  const getPhaseClass = (nomeFase) => {
    const n = (nomeFase || "").toLowerCase();
    if (n === "proposta") return styles.proposta; // amarelo
    if (n === "ganhou") return styles.ganhou; // verde
    if (n === "perdeu") return styles.perdeu; // vermelho
    return "";
  };

  const handleSelectClick = (lead) => {
    setLeadParaConfirmar(lead);
  };

  const handleConfirmSelect = () => {
    if (!leadParaConfirmar) return;
    onSelect(leadParaConfirmar);
    onClose();
  };

  const handleCancelSelect = () => {
    setLeadParaConfirmar(null);
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <button className={styles.closeIcon} onClick={onClose} aria-label="Fechar">×</button>
        <h2>Buscar no CRM</h2>

        {/* Seleção de Funil */}
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="funilSelect"><strong>Funil:</strong>{" "}</label>
          {loadingFunis ? (
            <span>Carregando funis...</span>
          ) : (
            <select
              id="funilSelect"
              value={selectedFunilId}
              onChange={(e) => setSelectedFunilId(e.target.value)}
              className={styles.select}
            >
              <option value="">Selecione um funil</option>
              {funis.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Busca */}
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
          disabled={!selectedFunilId || loadingBoard}
        />

        {/* Fases e Leads */}
        <div style={{ marginTop: 12 }}>
          {loadingBoard && <div>Carregando dados do funil...</div>}
          {!loadingBoard && selectedFunilId && filteredFases.length === 0 && (
            <div>Nenhuma fase encontrada para este funil.</div>
          )}

          {!loadingBoard && filteredFases.map((fase) => {
            const total = (fase.leads || []).length;
            const phaseClass = getPhaseClass(fase.nome);
            return (
              <div key={fase.id} style={{ border: "1px solid #eee", padding: 8, borderRadius: 6, marginBottom: 12 }}>
                <div className={styles.phaseHeader}>
                  <div className={styles.phaseTitle}>
                    <span className={`${styles.phaseDot} ${phaseClass}`} />
                    <strong>{fase.nome}</strong>
                    <small>({total} leads)</small>
                  </div>
                </div>

                <div className={styles.leadList}>
                  {(fase.leads || []).map((lead) => (
                    <div key={lead.id} className={styles.leadItem}>
                      <div className={styles.leadInfo}>
                        <div className={styles.leadName}>{lead.name}</div>
                        <div className={styles.leadEmail}>{lead.email}</div>
                      </div>
                      <button onClick={() => handleSelectClick(lead)}>Selecionar</button>
                    </div>
                  ))}
                  {(!fase.leads || fase.leads.length === 0) && (
                    <div style={{ color: "#888" }}>Sem leads nesta fase.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal de confirmação */}
        {leadParaConfirmar && (
          <div className={styles.confirmOverlay}>
            <div className={styles.confirmModal}>
              <div className={styles.confirmTitle}>Confirmar ação</div>
              <div className={styles.confirmText}>
                Deseja transformar <strong>{leadParaConfirmar.name}</strong> em cliente?
              </div>
              <div className={styles.confirmActions}>
                <button className={styles.confirmCancel} onClick={handleCancelSelect}>Cancelar</button>
                <button className={styles.confirmOk} onClick={handleConfirmSelect}>Confirmar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
