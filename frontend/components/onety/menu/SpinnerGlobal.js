import React from 'react';
import styles from './SpinnerGlobal.module.css';

const SpinnerGlobal = ({ 
  size = 24, 
  variant = 'vibrant',
  className = ""
}) => {
  const renderSpinner = () => {
    switch (variant) {
      case 'vibrant':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`${styles.spinnerGlobal} ${className}`}
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="31.416"
              strokeDashoffset="31.416"
              className={styles.spinnerOuter}
            />
            <circle
              cx="12"
              cy="12"
              r="7"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="22"
              strokeDashoffset="22"
              className={styles.spinnerInner}
            />
            <circle
              cx="12"
              cy="12"
              r="4"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="12.566"
              strokeDashoffset="12.566"
              className={styles.spinnerCenter}
            />
          </svg>
        );
      
      case 'gradient':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`${styles.spinnerGlobal} ${className}`}
          >
            <defs>
              <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--onity-primary)" stopOpacity="0.85" />
                <stop offset="50%" stopColor="var(--onity-primary-hover)" stopOpacity="0.8" />
                <stop offset="100%" stopColor="var(--onity-success)" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="url(#spinnerGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="31.416"
              strokeDashoffset="31.416"
              className={styles.spinnerGradientCircle}
            />
          </svg>
        );
      
      default:
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`${styles.spinnerGlobal} ${className}`}
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="31.416"
              strokeDashoffset="31.416"
              className={styles.spinnerDefaultCircle}
            />
          </svg>
        );
    }
  };

  return renderSpinner();
};

export default SpinnerGlobal;
