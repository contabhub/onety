import styles from "../../../styles/comercial/dashboard/Dashboard.module.css";

const SkeletonTable = ({ rows = 5 }) => {
  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Responsável</th>
            <th>Status</th>
            <th>Data</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, index) => (
            <tr key={index}>
              <td>
                <div className={styles.skeletonTableCell} style={{ width: '30%' }}></div>
              </td>
              <td>
                <div className={styles.skeletonTableCell} style={{ width: '20%' }}></div>
              </td>
              <td>
                <div className={styles.skeletonTableCell} style={{ width: '15%' }}></div>
              </td>
              <td>
                <div className={styles.skeletonTableCell} style={{ width: '15%' }}></div>
              </td>
              <td>
                <div className={styles.skeletonTableCell} style={{ width: '10%' }}></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SkeletonTable; 