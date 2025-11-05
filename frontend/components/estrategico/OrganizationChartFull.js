import React from 'react';
import CanvasOrgChart from '../../components/estrategico/CanvasOrgChart';
import styles from '../../styles/estrategico/OrganizationChartFull.module.css';

export const OrganizationChartFull = ({
  departments,
  highlightedDepartment,
  globalGoal,
  onToggleExpand,
  onEditDepartment,
  onDeleteDepartment,
  userRole,
  currentUserId,
  companyId,
  selectedYear,
  selectedMonth
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.wrapper}>
          <div className={styles.inner}>
            {departments.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateContent}>
                  <h3 className={styles.emptyStateTitle}>Nenhum departamento encontrado</h3>
                  <p className={styles.emptyStateDescription}>
                    Comece criando o primeiro departamento da sua empresa
                  </p>
                </div>
              </div>
            ) : (
              <div className={styles.chartContainer}>
                {departments.map(root => (
                  <CanvasOrgChart
                    key={`${root.id}-${selectedYear}-${selectedMonth}`}
                    data={(departments.find(d => d.id === root.id) || root)}
                    highlightedDepartment={highlightedDepartment}
                    globalGoal={globalGoal}
                    onToggleExpand={(node) => onToggleExpand(node.id)}
                    onEditDepartment={onEditDepartment}
                    onDeleteDepartment={onDeleteDepartment}
                    userRole={userRole}
                    currentUserId={currentUserId}
                    companyId={companyId}
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationChartFull;

