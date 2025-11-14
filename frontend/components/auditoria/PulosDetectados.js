import styles from "../../styles/auditoria/PulosDetectados.module.css";

function formatCNPJ(cnpj) {
  return cnpj
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

const renderEmptyState = () => (
  <div className={styles.emptyState}>
    <svg
      className={styles.emptyIcon}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
    <p className={styles.emptyTitle}>Nenhum pulo detectado nas notas fiscais</p>
    <p className={styles.emptySubtitle}>
      A sequência de notas fiscais está correta
    </p>
  </div>
);

const renderPuloCard = (pulo, index) => (
  <div key={index} className={styles.puloCard}>
    <div className={styles.puloGrid}>
      <div>
        <span className={styles.puloLabel}>Emitente CNPJ:</span> {formatCNPJ(pulo.cnpj)}
      </div>
      <div>
        <span className={styles.puloLabel}>Série:</span> {pulo.serie}
      </div>
      <div>
        <span className={styles.puloLabel}>Mês/Ano Esperado:</span> {pulo.mesEsperado} de {pulo.anoEsperado}
      </div>
      <div>
        <span className={styles.puloLabel}>Total Notas Puladas:</span> {pulo.notasPuladas.length}
      </div>
    </div>
    <div className={styles.notasList}>
      {pulo.notasPuladas.map((numero, idx) => (
        <span key={idx} className={styles.notaTag}>
          {numero}
        </span>
      ))}
    </div>
  </div>
);

export default function PulosDetectados({
  pulosDetectados,
  mostrarPulosDetectados,
  onTogglePulosDetectados,
}) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Pulos Detectados nas Notas Fiscais</h2>
        <button
          onClick={onTogglePulosDetectados}
          className={styles.toggleButton}
          type="button"
        >
          <svg
            className={styles.toggleIcon}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 15l7-7 7 7"
            />
          </svg>
          {mostrarPulosDetectados ? "Ocultar" : "Mostrar"}
        </button>
      </div>

      {mostrarPulosDetectados && (
        <>
          {pulosDetectados.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className={styles.alert}>
              <div className={styles.alertHeader}>
                <svg className={styles.alertIcon} viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <h3 className={styles.alertTitle}>
                    Aviso: Pulos na Sequência de Notas Fiscais Detectados!
                  </h3>
                  <div className={styles.alertText}>
                    <p>
                      Foram detectadas falhas na sequência numérica das seguintes notas fiscais:
                    </p>
                    {pulosDetectados.map((pulo, index) => renderPuloCard(pulo, index))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

