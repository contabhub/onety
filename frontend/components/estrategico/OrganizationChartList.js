import React from 'react';
import { User, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { getKpiMetaPercentualDepartamentoProprio, getKpiMetaPercentualDepartamentoRecursivo } from '../../utils/estrategico/goalUtils';
import { CircularProgressbarWithChildren, buildStyles } from 'react-circular-progressbar';
import styles from '../../styles/estrategico/OrganizationChartList.module.css';

export const OrganizationChartList = ({
  departments,
  onToggleExpand,
  onEditDepartment,
  onDeleteDepartment,
  onDepartmentCardClick,
  userRole,
  selectedYear,
  selectedMonth
}) => {
  const flattenDepartments = (nodes, level = 0) => {
    const result = [];
    
    nodes.forEach(node => {
      result.push({ ...node, level });
      if (node.isExpanded && node.children && node.children.length > 0) {
        result.push(...flattenDepartments(node.children, level + 1));
      }
    });
    
    return result;
  };

  const allDepartments = flattenDepartments(departments);

  const getKpiData = (department) => {
    try {
      const kpiProprio = getKpiMetaPercentualDepartamentoProprio(department, selectedYear, selectedMonth);
      const percentualReal = kpiProprio.percentualReal;
      
      const now = new Date();
      const mesAtual = selectedMonth || now.getMonth() + 1;
      const anoAtual = selectedYear || now.getFullYear();
      const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
      
      const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();
      
      const diaReferencia = isCurrentMonth ? now.getDate() : diasNoMes;
      const percentualEsperado = (diaReferencia / diasNoMes) * 100;
      
      let kpiColor = '#10B981';
      
      if (isCurrentMonth) {
        if (percentualReal < percentualEsperado - 10) {
          kpiColor = '#EF4444';
        } else if (percentualReal < percentualEsperado) {
          kpiColor = '#F59E42';
        } else {
          kpiColor = '#10B981';
        }
      } else {
        if (percentualReal < 50) {
          kpiColor = '#EF4444';
        } else if (percentualReal < 100) {
          kpiColor = '#F59E42';
        } else {
          kpiColor = '#10B981';
        }
      }
      
      return { percentualReal, kpiColor };
    } catch (error) {
      console.error('Erro ao calcular dados do KPI:', error);
      return { percentualReal: 0, kpiColor: '#10B981' };
    }
  };

  const getKpiDataFilhos = (department) => {
    try {
      const kpiRecursivo = getKpiMetaPercentualDepartamentoRecursivo(department, selectedYear, selectedMonth);
      const percentualReal = kpiRecursivo.percentualReal;
      
      const now = new Date();
      const mesAtual = selectedMonth || now.getMonth() + 1;
      const anoAtual = selectedYear || now.getFullYear();
      const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
      
      const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();
      
      const diaReferencia = isCurrentMonth ? now.getDate() : diasNoMes;
      const percentualEsperado = (diaReferencia / diasNoMes) * 100;
      
      let kpiColor = '#3B82F6';
      
      if (isCurrentMonth) {
        if (percentualReal < percentualEsperado - 10) {
          kpiColor = '#EF4444';
        } else if (percentualReal < percentualEsperado) {
          kpiColor = '#F59E42';
        } else {
          kpiColor = '#10B981';
        }
      } else {
        if (percentualReal < 50) {
          kpiColor = '#EF4444';
        } else if (percentualReal < 100) {
          kpiColor = '#F59E42';
        } else {
          kpiColor = '#10B981';
        }
      }
      
      return { percentualReal, kpiColor };
    } catch (error) {
      console.error('Erro ao calcular dados do KPI dos filhos:', error);
      return { percentualReal: 0, kpiColor: '#3B82F6' };
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.tableWrapper}>
        <div className={styles.tableScrollContainer}>
        <div className={`${styles.tableHeader} ${styles.tableHeaderPrimary}`}>
          <div className={`${styles.tableHeaderRow} ${styles.tableHeaderRowPrimary}`}>
            <div className={styles.tableHeaderCell}>Departamento</div>
            <div className={styles.tableHeaderCell}>Líder</div>
            <div className={`${styles.tableHeaderCell} ${styles.tableHeaderCellCenter}`}>Colaboradores</div>
            <div className={`${styles.tableHeaderCell} ${styles.tableHeaderCellCenter}`}>Subdepartamentos</div>
            <div className={`${styles.tableHeaderCell} ${styles.tableHeaderCellCenter}`}>KPI Próprio</div>
            <div className={`${styles.tableHeaderCell} ${styles.tableHeaderCellCenter}`}>KPI Filhos</div>
            <div className={`${styles.tableHeaderCell} ${styles.tableHeaderCellCenter}`}>Ações</div>
          </div>
        </div>

        <div className={styles.tableBodyContainer}>
          {allDepartments.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateContent}>
                <Building2 className={styles.emptyStateIcon} />
                <h3 className={`${styles.emptyStateTitle} ${styles.emptyStateTitleSpacing}`}>Nenhum departamento encontrado</h3>
                <p className={styles.emptyStateDescription}>
                  Comece criando o primeiro departamento da sua empresa
                </p>
              </div>
            </div>
          ) : (
            allDepartments.map((department) => {
              const manager = department.manager;
              const hasChildren = department.children && department.children.length > 0;
              const childrenCount = department.children ? department.children.length : 0;

              return (
                <div
                  key={department.id}
                  className={styles.tableRow}
                  style={{ paddingLeft: `calc(var(--onity-space-l) + ${department.level * 24}px)` }}
                >
                  <div className={styles.tableRowGrid}>
                    <div className={styles.departmentCell}>
                      {hasChildren && (
                        <button
                          onClick={() => onToggleExpand(department.id)}
                          className={styles.expandButton}
                        >
                          {department.isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      <div className={styles.departmentCellInner}>
                        <Building2 className={styles.departmentIcon} />
                        <button
                          onClick={() => onDepartmentCardClick?.(department)}
                          className={styles.departmentTitle}
                        >
                          {department.title}
                        </button>
                      </div>
                    </div>

                    <div className={styles.managerCell}>
                      {manager?.photo ? (
                        <img
                          src={manager.photo}
                          alt={manager.name}
                          className={styles.managerAvatar}
                        />
                      ) : (
                        <div className={styles.managerAvatarPlaceholder}>
                          <User className={styles.managerAvatarIcon} />
                        </div>
                      )}
                      <span className={styles.managerName}>
                        {manager?.name || 'Sem líder'}
                      </span>
                    </div>

                    <div className={`${styles.tableCell} ${styles.tableCellCenter}`}>
                      <span className={`${styles.badge} ${styles.badgeBlue}`}>
                        {department.employees.length}
                      </span>
                    </div>

                    <div className={`${styles.tableCell} ${styles.tableCellCenter}`}>
                      <span className={`${styles.badge} ${styles.badgeGreen}`}>
                        {childrenCount}
                      </span>
                    </div>

                    <div className={`${styles.tableCell} ${styles.tableCellCenter}`}>
                      <div className={styles.progressContainer}>
                        <div className={styles.progressCircle}>
                          <CircularProgressbarWithChildren
                            value={getKpiData(department).percentualReal}
                            styles={buildStyles({
                              pathColor: getKpiData(department).kpiColor,
                              trailColor: 'var(--onity-color-border)',
                            })}
                          >
                            <div className={styles.progressText} style={{ color: getKpiData(department).kpiColor }}>
                              {getKpiData(department).percentualReal.toFixed(0)}%
                            </div>
                          </CircularProgressbarWithChildren>
                        </div>
                      </div>
                    </div>

                    <div className={`${styles.tableCell} ${styles.tableCellCenter}`}>
                      <div className={styles.progressContainer}>
                        {hasChildren ? (
                          <div className={styles.progressCircle}>
                            <CircularProgressbarWithChildren
                              value={getKpiDataFilhos(department).percentualReal}
                              styles={buildStyles({
                                pathColor: getKpiDataFilhos(department).kpiColor,
                                trailColor: 'var(--onity-color-border)',
                              })}
                            >
                              <div className={styles.progressText} style={{ color: getKpiDataFilhos(department).kpiColor }}>
                                {getKpiDataFilhos(department).percentualReal.toFixed(0)}%
                              </div>
                            </CircularProgressbarWithChildren>
                          </div>
                        ) : (
                          <span className={styles.progressTextEmpty}>-</span>
                        )}
                      </div>
                    </div>

                    <div className={`${styles.tableCell} ${styles.tableCellCenter}`}>
                      <div className={styles.actionsContainer}>
                        {userRole !== 'FUNCIONARIO' && (
                          <>
                            <button
                              onClick={() => onEditDepartment(department)}
                              className={styles.actionButton}
                              title="Editar departamento"
                            >
                              <svg className={styles.actionButtonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => onDeleteDepartment(department)}
                              className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                              title="Excluir departamento"
                            >
                              <svg className={styles.actionButtonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationChartList;

