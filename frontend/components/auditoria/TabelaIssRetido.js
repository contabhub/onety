import styles from "../../styles/auditoria/TabelaIssRetido.module.css";

const formatCurrency = (value) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function TabelaIssRetido({
  temIssRetido,
  issRetidoMensal,
}) {
  if (!temIssRetido || issRetidoMensal.length === 0) return null;

  const totalValor = issRetidoMensal.reduce(
    (sum, item) => sum + item.valor_iss_retido,
    0
  );

  const totalNotas = issRetidoMensal.reduce(
    (sum, item) => sum + item.quantidade_notas,
    0
  );

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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h2 className={styles.title}>ISS Retido por Mês</h2>
            <p className={styles.subtitle}>
              Valores de ISS retido nas notas fiscais de serviço
            </p>
          </div>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.tableHead}>
            <tr>
              <th>Mês</th>
              <th>Ano</th>
              <th>Valor ISS Retido (R$)</th>
              <th>Quantidade de notas</th>
            </tr>
          </thead>
          <tbody>
            {issRetidoMensal.map((item, idx) => (
              <tr key={idx} className={styles.tableRow}>
                <td>{item.mes}</td>
                <td>{item.ano}</td>
                <td>{formatCurrency(item.valor_iss_retido)}</td>
                <td>{item.quantidade_notas}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className={styles.tableFoot}>
            <tr>
              <td colSpan={2}>Total</td>
              <td className={styles.totalValue}>{formatCurrency(totalValor)}</td>
              <td>{totalNotas}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
