import { AlertTriangle, Trash2 } from "lucide-react";
import styles from "../../styles/financeiro/confirmar-exclusao.module.css";

export function ModalConfirmarExclusaoConta({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  itemName = "lançamento",
  itemValue,
  itemType = 'pagar'
}) {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderContent}>
            <div className={styles.modalIconBg}>
              <AlertTriangle className={styles.modalHeaderIcon} />
            </div>
            <h2 className={styles.modalTitle}>
              Confirmar Exclusão
            </h2>
          </div>
          <p className={styles.modalDescription}>
            Tem certeza que deseja excluir este {itemType === 'pagar' ? 'lançamento a pagar' : 'lançamento a receber'}?
          </p>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.itemInfo}>
            <Trash2 className={styles.itemIcon} />
            <div className={styles.itemDetails}>
              <p className={styles.itemName}>
                {itemName}
              </p>
              {itemValue && (
                <p className={styles.itemValue}>
                  Valor: R$ {Number(itemValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
              <p className={styles.itemWarning}>
                Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>

          <div className={styles.alertBox}>
            <div className={styles.alertContent}>
              <AlertTriangle className={styles.alertIcon} />
              <div className={styles.alertText}>
                <p className={styles.alertTitle}>
                  Atenção
                </p>
                <p className={styles.alertDescription}>
                  Ao excluir este {itemType === 'pagar' ? 'lançamento a pagar' : 'lançamento a receber'}, 
                  ele será removido permanentemente do sistema.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className={styles.cancelBtn}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={styles.confirmBtn}
          >
            {isLoading ? "Excluindo..." : "Confirmar Exclusão"}
          </button>
        </div>
      </div>
    </div>
  );
}