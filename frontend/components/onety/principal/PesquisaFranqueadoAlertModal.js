import React from "react";
import styles from "../../../styles/onety/PesquisaFranqueadoAlertModal.module.css";

export default function PesquisaFranqueadoAlertModal({
  open,
  onClose,
  onConfirm,
  mensagem,
  total,
  franqueadoraNome,
}) {
  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Fechar alerta"
        >
          ×
        </button>

        <div className={styles.header}>
          <span className={styles.badge}>Pesquisa pendente</span>
          <h2>Sua opinião muda o rumo da rede</h2>
        </div>

        <div className={styles.content}>
          {mensagem && <p className={styles.message}>{mensagem}</p>}
          {typeof total === "number" && total > 0 && (
            <p className={styles.counter}>
              Ainda temos <strong>{total}</strong>{" "}
              {total === 1 ? "pesquisa aguardando" : "pesquisas aguardando"}{" "}
              sua resposta.
            </p>
          )}
          {franqueadoraNome && (
            <p className={styles.meta}>
              Franqueadora: <strong>{franqueadoraNome}</strong>
            </p>
          )}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onConfirm}
          >
            Responder agora
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onClose}
          >
            Responder depois
          </button>
        </div>
      </div>
    </div>
  );
}

