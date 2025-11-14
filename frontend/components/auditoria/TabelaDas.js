import styles from "../../styles/auditoria/TabelaDas.module.css";

export default function TabelaDas({
  temDas,
  dasMensais,
  mostrarDas,
  onToggleDas,
}) {
  const renderStatusBadge = (status) => {
    if (status === "pago") {
      return <span className={`${styles.statusBadge} ${styles.statusPaid}`}>Pago</span>;
    }

    if (status === "a_pagar") {
      return <span className={`${styles.statusBadge} ${styles.statusPending}`}>A pagar</span>;
    }

    return (
      <span className={`${styles.statusBadge} ${styles.statusImport}`}>Importação pendente</span>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.headerIconWrapper}>
            <svg
              className={styles.headerIcon}
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

          <div>
            <h2 className={styles.title}>DAS por Mês</h2>
            <p className={styles.subtitle}>
              Status de pagamento do DAS (Documento de Arrecadação do Simples Nacional)
            </p>
          </div>
        </div>

        <button
          onClick={onToggleDas}
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
          {mostrarDas ? "Ocultar" : "Mostrar"}
        </button>
      </div>

      {mostrarDas && (
        <div>
          {!temDas || dasMensais.length === 0 ? (
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
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className={styles.emptyTitle}>Nenhum DAS encontrado para o período</p>
              <p className={styles.emptySubtitle}>
                Os dados de DAS aparecerão aqui quando disponíveis
              </p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead className={styles.tableHead}>
                  <tr>
                    <th>Mês</th>
                    <th>Ano</th>
                    <th>Status</th>
                    <th>Valor DAS (R$)</th>
                    <th>Data de pagamento</th>
                  </tr>
                </thead>
                <tbody>
                  {dasMensais.map((item, idx) => (
                    <tr key={idx} className={styles.tableRow}>
                      <td>{item.mes}</td>
                      <td>{item.ano}</td>
                      <td>{renderStatusBadge(item.status)}</td>
                      <td>
                        {item.valor_das
                          ? `R$ ${item.valor_das.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}`
                          : "-"}
                      </td>
                      <td>{item.data_pagamento || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
