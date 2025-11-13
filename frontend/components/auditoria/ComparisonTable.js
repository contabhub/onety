import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import styles from '../../styles/auditoria/ComparisonTable.module.css';

export default function ComparisonTable({ items, title }) {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getSeverityIcon = (severity) => {
    const iconClass = `${styles.icon} ${
      severity === 'high'
        ? styles.iconHigh
        : severity === 'medium'
        ? styles.iconMedium
        : severity === 'low'
        ? styles.iconLow
        : styles.iconNone
    }`;

    switch (severity) {
      case 'high':
        return <AlertCircle className={iconClass} />;
      case 'medium':
        return <AlertTriangle className={iconClass} />;
      case 'low':
        return <AlertTriangle className={iconClass} />;
      default:
        return <CheckCircle className={iconClass} />;
    }
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'high':
        return styles.severityHigh;
      case 'medium':
        return styles.severityMedium;
      case 'low':
        return styles.severityLow;
      default:
        return styles.severityNone;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.tableHead}>
            <tr>
              <th scope="col" className={styles.headerCell}>
                Fonte
              </th>
              <th scope="col" className={styles.headerCell}>
                Descrição
              </th>
              <th scope="col" className={styles.headerCell}>
                Valor Declarado
              </th>
              <th scope="col" className={styles.headerCell}>
                Valor Esperado
              </th>
              <th scope="col" className={styles.headerCell}>
                Diferença
              </th>
              <th scope="col" className={styles.headerCell}>
                Criticidade
              </th>
            </tr>
          </thead>
          <tbody className={styles.tableBody}>
            {items.map((item) => (
              <tr key={item.id} className={styles.tableRow}>
                <td className={`${styles.cell} ${styles.cellPrimary}`}>
                  {item.source}
                </td>
                <td className={styles.cell}>
                  {item.description}
                </td>
                <td className={styles.cell}>
                  {formatCurrency(item.declaredValue)}
                </td>
                <td className={styles.cell}>
                  {formatCurrency(item.expectedValue)}
                </td>
                <td className={styles.cell}>
                  <span
                    className={
                      item.difference < 0
                        ? styles.differenceNegative
                        : styles.differencePositive
                    }
                  >
                    {formatCurrency(item.difference)}
                  </span>
                </td>
                <td className={styles.cell}>
                  <div className={styles.severityCell}>
                    {getSeverityIcon(item.severity)}
                    <span
                      className={`${styles.severityBadge} ${getSeverityClass(
                        item.severity
                      )}`}
                    >
                      {item.severity === 'high' 
                        ? 'Alta' 
                        : item.severity === 'medium' 
                          ? 'Média' 
                          : item.severity === 'low' 
                            ? 'Baixa' 
                            : 'OK'}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
