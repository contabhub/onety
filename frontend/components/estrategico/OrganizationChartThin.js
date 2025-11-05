import React, { useState, useRef, useEffect } from 'react';
import { Users, User, ChevronDown, ChevronRight } from 'lucide-react';
import { getKpiMetaPercentualDepartamentoProprio, getKpiMetaPercentualDepartamentoRecursivo } from '../../utils/estrategico/goalUtils';
import { CircularProgressbarWithChildren, buildStyles } from 'react-circular-progressbar';
import styles from '../../styles/estrategico/OrganizationChartThin.module.css';

export const OrganizationChartThin = ({
  departments,
  onToggleExpand,
  onEditDepartment,
  onDeleteDepartment,
  onDepartmentCardClick,
  userRole,
  user,
  selectedYear,
  selectedMonth
}) => {
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getBorderColor = (department) => {
    try {
      const kpiProprio = getKpiMetaPercentualDepartamentoProprio(department, selectedYear, selectedMonth);
      const percentualProprio = kpiProprio.percentualReal;
      
      const now = new Date();
      const mesAtual = selectedMonth || now.getMonth() + 1;
      const anoAtual = selectedYear || now.getFullYear();
      const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
      
      const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();
      
      const diaReferencia = isCurrentMonth ? now.getDate() : diasNoMes;
      const percentualEsperado = (diaReferencia / diasNoMes) * 100;
      
      if (isCurrentMonth) {
        if (percentualProprio < percentualEsperado - 10) {
          return '#EF4444';
        } else if (percentualProprio < percentualEsperado) {
          return '#F59E42';
        } else {
          return '#10B981';
        }
      } else {
        if (percentualProprio < 50) {
          return '#EF4444';
        } else if (percentualProprio < 100) {
          return '#F59E42';
        } else {
          return '#10B981';
        }
      }
    } catch (error) {
      console.error('Erro ao calcular cor da borda:', error);
      return '#10B981';
    }
  };

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

  const renderDepartmentThin = (department) => {
    const hasChildren = department.children && department.children.length > 0;
    const manager = department.manager;
    const borderColor = getBorderColor(department);
    const { percentualReal, kpiColor } = getKpiData(department);
    const { percentualReal: percentualFilhos, kpiColor: kpiColorFilhos } = hasChildren ? getKpiDataFilhos(department) : { percentualReal: 0, kpiColor: '#3B82F6' };
    

    return (
      <div key={department.id} className={styles.departmentCard}>
        <div 
          className={styles.departmentCardInner}
          style={{ borderColor: borderColor }}
        >
          <div className={styles.departmentHeader}>
            <div className={styles.avatarContainer}>
              {manager?.photo ? (
                <img
                  src={manager.photo}
                  alt={manager.name}
                  className={styles.avatar}
                />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            <div className={styles.departmentInfo}>
              <button
                onClick={() => onDepartmentCardClick?.(department)}
                className={styles.departmentTitle}
              >
                {department.title}
              </button>
              <p className={styles.managerName}>
                {manager?.name || 'Sem líder'}
              </p>
            </div>
            <div className={styles.departmentActions}>
              {hasChildren && (
                <button
                  onClick={() => onToggleExpand(department)}
                  className={styles.toggleButton}
                >
                  {department.isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                </button>
              )}
              
              {(userRole === 'ADMIN' || userRole === 'SUPERADMIN' || (userRole === 'GESTOR' && department.manager?.id === user?.id)) && (
                <div style={{ position: 'relative' }} ref={openMenuId === department.id ? menuRef : null}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === department.id ? null : department.id);
                    }}
                    className={styles.menuButton}
                  >
                    <svg className={styles.menuIcon} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>

                  {openMenuId === department.id && (
                    <div className={styles.menu}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onDepartmentCardClick) {
                            onDepartmentCardClick(department);
                          }
                          setOpenMenuId(null);
                        }}
                        className={styles.menuButtonItem}
                      >
                        <svg className={styles.menuIconSmall} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Ver Departamento
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditDepartment(department);
                          setOpenMenuId(null);
                        }}
                        className={styles.menuButtonItem}
                      >
                        <svg className={styles.menuIconSmall} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar Departamento
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDepartment(department);
                          setOpenMenuId(null);
                        }}
                        className={styles.menuButtonItem}
                        style={{ color: '#dc2626' }}
                      >
                        <svg className={styles.menuIconSmall} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Excluir Departamento
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Users className="w-4 h-4 text-gray-400" />
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {department.employees.length}
                </span>
              </div>
              {hasChildren && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <svg className="w-4 h-4" style={{ color: '#60a5fa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {department.children.length}
                  </span>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '2.5rem', height: '2.5rem' }}>
                <CircularProgressbarWithChildren
                  value={percentualReal}
                  styles={buildStyles({
                    pathColor: kpiColor,
                    trailColor: '#E5E7EB',
                  })}
                >
                  <div style={{ fontSize: '13px', fontWeight: 500, color: kpiColor }}>
                    {percentualReal.toFixed(0)}%
                  </div>
                </CircularProgressbarWithChildren>
              </div>
              
              {hasChildren && (
                <div style={{ width: '2.5rem', height: '2.5rem', marginLeft: '0.25rem' }}>
                  <CircularProgressbarWithChildren
                    value={percentualFilhos}
                    styles={buildStyles({
                      pathColor: kpiColorFilhos,
                      trailColor: '#E5E7EB',
                    })}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 500, color: kpiColorFilhos }}>
                      {percentualFilhos.toFixed(0)}%
                    </div>
                  </CircularProgressbarWithChildren>
                </div>
              )}
            </div>
          </div>
        </div>

        {department.isExpanded && hasChildren && (
          <div style={{ marginTop: '1rem' }}>
            <div className={styles.chartGrid}>
              {department.children.map((child) => (
                <div key={child.id} className={styles.departmentCard}>
                  {renderDepartmentThin(child)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHierarchy = (departments) => {
    return departments.map(department => (
      <div key={department.id} className="relative">
        {renderDepartmentThin(department)}
      </div>
    ));
  };

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
              <div className={styles.chartGrid}>
                {renderHierarchy(departments)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationChartThin;

