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
  const [authError, setAuthError] = useState("");
  const [expanded, setExpanded] = useState({});
  // Sem paginação

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("userData");
    const user = userRaw ? JSON.parse(userRaw) : null;
    const empresaId = user?.EmpresaId;

    if (!token || !empresaId) {
      setAuthError("Você precisa estar logado para acessar o CRM.");
      return;
    }

    setAuthError("");
    setLoadingFunis(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funis/${empresaId}`, {
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
      .catch(() => setAuthError("Erro ao buscar funis"))
      .finally(() => setLoadingFunis(false));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("userData");
    const user = userRaw ? JSON.parse(userRaw) : null;
    const empresaId = user?.EmpresaId;

    if (!token || !empresaId || !selectedFunilId) return;

    setLoadingBoard(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/crm/${empresaId}/${selectedFunilId}`, {
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
        // Expande por padrão fases com leads
        const initial = {};
        fasesApi.forEach(f => { initial[f.id] = Array.isArray(f.leads) && f.leads.length > 0; });
        setExpanded(initial);
      })
      .catch(() => setAuthError("Erro ao carregar fases e leads do funil"))
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

  const handleConfirmSelect = async () => {
    if (!leadParaConfirmar) return;
    try {
      const token = localStorage.getItem('token');
      const userRaw = localStorage.getItem('userData');
      const user = userRaw ? JSON.parse(userRaw) : {};
      const empresaId = user?.EmpresaId;

      // Cria (ou garante) o pré-cliente a partir do lead selecionado
      const body = {
        tipo: 'pessoa_fisica',
        nome: leadParaConfirmar.name || leadParaConfirmar.nome || 'Cliente',
        email: leadParaConfirmar.email || 'sem-email@onety.local',
        telefone: leadParaConfirmar.telefone || null,
        endereco: null,
        empresa_id: empresaId,
        lead_id: leadParaConfirmar.id,
      };

      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/pre-clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }).catch(() => null);

      // Opcional: se a API retornar clientId, podemos enviar para o onSelect
      if (resp && resp.ok) {
        const data = await resp.json();
        onSelect({ lead: leadParaConfirmar, clientId: data?.clientId || null });
        onClose();
        return;
      }

    } catch {}

    onSelect({ lead: leadParaConfirmar, clientId: null });
    onClose();
  };

  const handleCancelSelect = () => {
    setLeadParaConfirmar(null);
  };

  return (
    <div className={`${styles.modalOverlay} modal__overlay`}>
      <div className={`${styles.modal} modal__container`}>
        <button className={styles.closeIcon} onClick={onClose} aria-label="Fechar">×</button>
        <h2>Buscar no CRM</h2>

        {authError && (
          <div style={{
            background: 'var(--warning-700, #3e2c00)',
            color: 'var(--warning-200, #ffd27a)',
            padding: 10,
            borderRadius: 6,
            marginBottom: 12,
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {authError}
          </div>
        )}

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
              className={`input ${styles.select}`}
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
          className={`input ${styles.searchInput}`}
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
            const isOpen = !!expanded[fase.id];
            return (
              <div key={fase.id} className={styles.phaseCard}>
                <button
                  type="button"
                  className={styles.phaseHeader}
                  onClick={() => setExpanded(prev => ({ ...prev, [fase.id]: !prev[fase.id] }))}
                  aria-expanded={isOpen}
                >
                  <div className={styles.phaseTitle}>
                    <span className={`${styles.phaseDot} ${phaseClass}`} />
                    <strong>{fase.nome}</strong>
                    <small>({total} {total === 1 ? 'lead' : 'leads'})</small>
                  </div>
                  <span className={styles.chevron}>{isOpen ? '▾' : '▸'}</span>
                </button>

                {isOpen && (
                  <div className={styles.leadList}>
                    {(fase.leads || []).map((lead) => {
                      const telefone = lead.telefone || lead.phone || "";
                      const valorNum = lead.valor != null ? Number(lead.valor) : null;
                      const valorFmt = valorNum != null && !Number.isNaN(valorNum)
                        ? `R$ ${valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : null;
                      return (
                        <div key={lead.id} className={styles.leadItem}>
                          <div className={styles.leadInfo}>
                            <div className={styles.leadName}>{lead.name}</div>
                            <div className={styles.leadMeta}>
                              {lead.email && <span className={styles.leadEmail}>{lead.email}</span>}
                              {telefone && <span className={styles.leadPhone}>{telefone}</span>}
                              {valorFmt && <span className={styles.leadValue}>{valorFmt}</span>}
                            </div>
                          </div>
                          <button className="btn btn--primary" onClick={() => handleSelectClick(lead)}>Selecionar</button>
                        </div>
                      );
                    })}
                    {(!fase.leads || fase.leads.length === 0) && (
                      <div className={styles.emptyPhase}>Sem leads nesta fase.</div>
                    )}
                  </div>
                )}
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
                <button className={`btn ${styles.confirmCancel}`} onClick={handleCancelSelect}>Cancelar</button>
                <button className={`btn btn--primary ${styles.confirmOk}`} onClick={handleConfirmSelect}>Confirmar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
