import React, { useState, useEffect } from "react";
import styles from "../../styles/gestao/ModalProrrogarTarefas.module.css";

export default function ModalProrrogarTarefas({ 
  isOpen, 
  onClose, 
  onConfirm, 
  loading = false 
}) {
  const [alterarAcao, setAlterarAcao] = useState(true);
  const [alterarMeta, setAlterarMeta] = useState(true);
  const [alterarVencimento, setAlterarVencimento] = useState(true);
  const [novaAcao, setNovaAcao] = useState("");
  const [novaMeta, setNovaMeta] = useState("");
  const [novoVencimento, setNovoVencimento] = useState("");
  const [motivo, setMotivo] = useState("");
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const getTheme = () => document.documentElement.getAttribute("data-theme") === "light";
    setIsLight(getTheme());
    const handleChange = (e) => {
      const detail = (e && e.detail) || {};
      if (detail && (detail.theme === "light" || detail.theme === "dark")) {
        setIsLight(detail.theme === "light");
      } else {
        setIsLight(getTheme());
      }
    };
    window.addEventListener("titan-theme-change", handleChange);
    return () => window.removeEventListener("titan-theme-change", handleChange);
  }, []);

  const handleConfirm = () => {
    if (!motivo.trim()) {
      alert("Por favor, informe o motivo da prorrogação.");
      return;
    }

    if (!alterarAcao && !alterarMeta && !alterarVencimento) {
      alert("Por favor, selecione pelo menos um campo para alterar.");
      return;
    }

    onConfirm({
      alterarAcao,
      alterarMeta,
      alterarVencimento,
      novaAcao: alterarAcao ? novaAcao : undefined,
      novaMeta: alterarMeta ? novaMeta : undefined,
      novoVencimento: alterarVencimento ? novoVencimento : undefined,
      motivo: motivo.trim()
    });
  };

  const handleClose = () => {
    // Resetar campos ao fechar
    setAlterarAcao(true);
    setAlterarMeta(true);
    setAlterarVencimento(true);
    setNovaAcao("");
    setNovaMeta("");
    setNovoVencimento("");
    setMotivo("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Prorrogando Tarefas
          </h2>
          <button onClick={handleClose} className={styles.closeButton}>
            ×
          </button>
        </div>

        {/* Campos de Data */}
        <div className={styles.grid3}>
          {/* Ação */}
          <div>
            <div className={styles.inlineLabel}>
              <input type="checkbox" checked={alterarAcao} onChange={(e) => setAlterarAcao(e.target.checked)} className={styles.checkbox} />
              <label className={alterarAcao ? styles.labelActive : styles.labelMuted}>Ação *</label>
            </div>
            <input type="date" value={novaAcao} onChange={(e) => setNovaAcao(e.target.value)} disabled={!alterarAcao} className={`${styles.input} ${!alterarAcao ? styles.inputDisabled : ""}`} />
          </div>

          {/* Meta */}
          <div>
            <div className={styles.inlineLabel}>
              <input type="checkbox" checked={alterarMeta} onChange={(e) => setAlterarMeta(e.target.checked)} className={styles.checkbox} />
              <label className={alterarMeta ? styles.labelActive : styles.labelMuted}>Meta *</label>
            </div>
            <input type="date" value={novaMeta} onChange={(e) => setNovaMeta(e.target.value)} disabled={!alterarMeta} className={`${styles.input} ${!alterarMeta ? styles.inputDisabled : ""}`} />
          </div>

          {/* Vencimento */}
          <div>
            <div className={styles.inlineLabel}>
              <input type="checkbox" checked={alterarVencimento} onChange={(e) => setAlterarVencimento(e.target.checked)} className={styles.checkbox} />
              <label className={alterarVencimento ? styles.labelActive : styles.labelMuted}>Vencimento *</label>
            </div>
            <input type="date" value={novoVencimento} onChange={(e) => setNovoVencimento(e.target.value)} disabled={!alterarVencimento} className={`${styles.input} ${!alterarVencimento ? styles.inputDisabled : ""}`} />
          </div>
        </div>

        {/* Motivo */}
        <div className={styles.section}>
          <label className={styles.formLabel}>Motivo *</label>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva o motivo da prorrogação..." rows={4} className={styles.textarea} />
        </div>

        {/* Botões */}
        <div className={styles.actions}>
          <button
            onClick={handleClose}
            className={`${styles.button} ${styles.buttonSecondary}`}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`${styles.button} ${styles.buttonPrimary}`}
          >
            {loading ? "Confirmando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
