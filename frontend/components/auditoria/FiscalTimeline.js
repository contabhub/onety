import { Calendar, CheckCircle, XCircle, Clock, FileText, BookOpen, BookCopy } from 'lucide-react';
import React, { useState } from 'react';
import styles from '../../styles/auditoria/FiscalTimeline.module.css';

function Tooltip({ children, content }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={styles.tooltipWrapper}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}>
      {children}
      {open && (
        <div className={styles.tooltipBox}>
          {content}
        </div>
      )}
    </span>
  );
}

export default function FiscalTimeline({ year, months, onMonthSelect, loading = false }) {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const getFileTypeIcon = (type) => {
    const iconClassMap = {
      SPED_FISCAL: styles.iconBlue,
      SPED_CONTRIBUICOES: styles.iconGreen,
      DCTF: styles.iconPurple,
      DARF: styles.iconOrange
    };

    const iconColorClass = iconClassMap[type];

    if (!iconColorClass) {
      return null;
    }

    const IconComponent = type === 'DCTF' ? BookOpen : type === 'DARF' ? BookCopy : FileText;

    return (
      <span className={styles.fileIcon}>
        <IconComponent className={iconColorClass} />
      </span>
    );
  };

  const getStatusIcon = (status) => {
    const iconProps = {
      className: `${styles.statusIcon} ${
        status === 'done'
          ? styles.statusDone
          : status === 'missing'
          ? styles.statusMissing
          : styles.statusPending
      }`.trim()
    };

    switch (status) {
      case 'done':
        return <CheckCircle {...iconProps} />;
      case 'missing':
        return <XCircle {...iconProps} />;
      default:
        return <Clock {...iconProps} />;
    }
  };

  const getMonthClass = (status) => {
    if (status === 'done') {
      return `${styles.monthButton} ${styles.monthDone}`;
    }
    return `${styles.monthButton} ${styles.monthMissing}`;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Calendar className={styles.headerIcon} />
          <h3 className={styles.headerTitle}>Timeline Fiscal {year}</h3>
        </div>

        <div className={styles.loadingWrapper}>
          <div className={styles.loadingSpinner} />
          <p className={styles.loadingText}>Carregando timeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Calendar className={styles.headerIcon} />
        <h3 className={styles.headerTitle}>Timeline Fiscal {year}</h3>
      </div>

      <div className={styles.grid}>
        {months.map((monthData) => (
          <Tooltip
            key={monthData.month}
            content={
              monthData.status === 'done' ? (
                <div className={styles.tooltipContent}>
                  <p className={styles.tooltipTitle}>Arquivos analisados:</p>
                  <ul className={styles.tooltipList}>
                    {monthData.tipos.map((tipo, index) => (
                      <li key={index} className={styles.tooltipItem}>
                        {getFileTypeIcon(tipo)}
                        <span>{tipo.replace('SPED_', '')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                'Nenhum arquivo analisado'
              )
            }
          >
            <button
              onClick={() => onMonthSelect(monthData)}
              className={getMonthClass(monthData.status)}
              type="button"
            >
              {getStatusIcon(monthData.status)}
              <div className={styles.monthInfo}>
                <span className={styles.monthName}>{monthNames[monthData.month - 1]}</span>
                <span className={styles.monthDetails}>
                  {monthData.status === 'done'
                    ? `${monthData.arquivos} arquivo(s)`
                    : 'Não analisado'}
                </span>
              </div>
              {monthData.status === 'done' && monthData.tipos.length > 0 && (
                <div className={styles.fileIcons}>
                  {monthData.tipos.slice(0, 3).map((tipo, index) => (
                    <div key={index}>{getFileTypeIcon(tipo)}</div>
                  ))}
                  {monthData.tipos.length > 3 && (
                    <span className={styles.fileCounter}>
                      +{monthData.tipos.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}