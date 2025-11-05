import React from 'react';
import { X } from 'lucide-react';
import styles from '../../styles/estrategico/ConfirmModal.module.css';

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = 'Sim',
  cancelText = 'Não',
  onConfirm,
  onCancel
}) {
  if (!isOpen) return null;

  const getConfirmButtonClass = () => {
    if (confirmText === 'Sim, Completar') return styles.buttonSuccess;
    if (confirmText === 'Sim, Reabrir') return styles.buttonWarning;
    return styles.buttonDanger;
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button onClick={onCancel} className={styles.modalCloseButton}>
            <X size={28} />
          </button>
        </div>
        <div className={styles.modalBody}>{description}</div>
        <div className={styles.modalFooter}>
          <button
            onClick={onCancel}
            className={`${styles.button} ${styles.buttonSecondary}`}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`${styles.button} ${getConfirmButtonClass()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
} 

