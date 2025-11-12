import styles from '../../styles/auditoria/ObligationStatusPanel.module.css';

export default function ObligationStatusPanel({ title, imported }) {
  return (
    <div className={`${styles.panel} ${imported ? styles.imported : styles.missing}`.trim()}>
      {title}
      <div className={styles.label}>{imported ? 'Importado' : 'Faltando'}</div>
    </div>
  );
}
