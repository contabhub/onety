import styles from "../../styles/auditoria/FaturamentoCards.module.css";

const formatCurrency = (value) =>
  `R$ ${(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
  })}`;

export default function FaturamentoCards({
  loading,
  faturamentoExtrato,
  faturamentoNotas,
  valoresGuiasDas,
}) {
  return (
    <div className={styles.cardsGrid}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardInfo}>
            <p className={styles.cardLabel}>Faturamento Extrato</p>
            <p className={`${styles.cardValue} ${styles.valueGreen}`}>
              {loading ? "..." : formatCurrency(faturamentoExtrato)}
            </p>
          </div>
          <div className={`${styles.iconWrapper} ${styles.iconGreen}`}>
            <svg
              className={styles.statusIcon}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardInfo}>
            <p className={styles.cardLabel}>Faturamento Notas</p>
            <p className={`${styles.cardValue} ${styles.valueBlue}`}>
              {loading ? "..." : formatCurrency(faturamentoNotas)}
            </p>
          </div>
          <div className={`${styles.iconWrapper} ${styles.iconBlue}`}>
            <svg
              className={styles.statusIcon}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardInfo}>
            <p className={styles.cardLabel}>Valores Guias DAS</p>
            <p className={`${styles.cardValue} ${styles.valueOrange}`}>
              {loading ? "..." : formatCurrency(valoresGuiasDas)}
            </p>
          </div>
          <div className={`${styles.iconWrapper} ${styles.iconOrange}`}>
            <svg
              className={styles.statusIcon}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
