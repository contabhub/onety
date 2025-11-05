import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from '../../styles/estrategico/Pagination.module.css';

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  limit,
  hasNextPage,
  hasPrevPage,
  onPageChange
}) {
  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalCount);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={styles.pagination}>
      <div className={styles.paginationInfo}>
        Mostrando <strong>{startItem}</strong> a{' '}
        <strong>{endItem}</strong> de{' '}
        <strong>{totalCount}</strong> resultados
      </div>

      <div className={styles.paginationControls}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrevPage}
          className={styles.paginationButton}
        >
          <ChevronLeft className="w-4 h-4" style={{ marginRight: '0.25rem' }} />
          <span className={styles.hiddenMobile}>Anterior</span>
        </button>

        <div className={styles.paginationButtonGroup}>
          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className={styles.paginationDots}>...</span>
              ) : (
                <button
                  onClick={() => onPageChange(page)}
                  className={page === currentPage ? `${styles.paginationButton} ${styles.paginationButtonActive}` : styles.paginationButton}
                >
                  {page}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage}
          className={styles.paginationButton}
        >
          <span className={styles.hiddenMobile}>Próximo</span>
          <ChevronRight className="w-4 h-4" style={{ marginLeft: '0.25rem' }} />
        </button>
      </div>
    </div>
  );
}

