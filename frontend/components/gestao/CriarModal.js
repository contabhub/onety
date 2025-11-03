import React from "react";
import styles from "../../styles/gestao/CriarModal.module.css";

export default function CriarModal({
  isOpen,
  onClose,
  onNovaSolicitacao,
  onNovaSolicitacaoUnica,
  onNovoCliente,
  onNovaObrigacaoEsporadica,
  podeCriarTarefa,
  podeCriarCliente,
}) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Criar</h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Fechar modal"
          >
            ×
          </button>
        </div>

        {/* Botões */}
        <div className={styles.buttonGroup}>
          {podeCriarTarefa && (
            <button className={styles.button} onClick={onNovaSolicitacao}>
              <span className={styles.icon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                  <path fill="currentColor" fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12s4.477 10 10 10s10-4.477 10-10M12 7a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1m-1 9a1 1 0 0 1 1-1h.008a1 1 0 1 1 0 2H12a1 1 0 0 1-1-1" clipRule="evenodd" />
                </svg>
              </span>
              <span className={styles.label}>Novo Processo</span>
            </button>
          )}

          <button className={styles.button} onClick={onNovaSolicitacaoUnica}>
            <span className={styles.icon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                <path fill="currentColor" d="M6 2a2 2 0 0 0-2 2v16c0 .55.45 1 1 1h5.54c-.22-.31-.4-.65-.53-1H5V4h9v5h5v2.08c.34.05.68.13 1 .26V8.59a1 1 0 0 0-.29-.71l-5.59-5.59A1 1 0 0 0 13.41 2H6Zm8 1.41L18.59 8H14V3.41ZM20 14c-.61 0-1.22.18-1.75.53c-.53.34-.96.83-1.25 1.41c-.29.58-.39 1.24-.28 1.88c.11.64.43 1.22.89 1.67c.45.46 1.03.78 1.67.89c.64.11 1.3.01 1.88-.28c.58-.29 1.07-.72 1.41-1.25c.34-.53.53-1.14.53-1.75c0-.83-.33-1.63-.91-2.21A3.003 3.003 0 0 0 20 14Zm.75 2.5l.66 1.44l-1.49-.28L19 19.5l-.28-1.49l-1.44-.66l1.44-.66L19 15l.28 1.49l1.49.01l-1.49.66Z" />
              </svg>
            </span>
            <span className={styles.label}>Tarefa Única</span>
          </button>

          <button className={styles.button} onClick={onNovaObrigacaoEsporadica}>
            <span className={styles.icon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 512 512">
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M256 42.667c117.821 0 213.334 95.513 213.334 213.333c0 117.821-95.513 213.334-213.334 213.334c-117.82 0-213.333-95.513-213.333-213.334C42.667 138.18 138.18 42.667 256 42.667m0 106.667c-58.91 0-106.666 47.756-106.666 106.666S197.09 362.667 256 362.667S362.667 314.911 362.667 256c0-58.91-47.756-106.666-106.667-106.666"
                />
              </svg>
            </span>
            <span className={styles.label}>Obrigação Esporádica</span>
          </button>

          {podeCriarCliente && (
            <button className={styles.button} onClick={onNovoCliente}>
              <span className={styles.icon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3L2 12h3v8z" />
                </svg>
              </span>
              <span className={styles.label}>Novo Cliente</span>
            </button>
          )}
        </div>

        {/* Botão Fechar */}
        <div className={styles.footer}>
          <button className={styles.fecharButton} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
