import React from 'react';
import styles from './Button.module.css';

export function Button({
  label = 'Okay',
  icon = null,
  iconPosition = 'start',
  iconColor = null,
  iconFill = false,
  buttonStyle = 'regular',
  ...rest
}) {
  const StartIcon = iconPosition === 'start' ? icon : null;
  const EndIcon = iconPosition === 'end' ? icon : null;
  const classList = [styles.button];
  
  if (iconColor) {
    classList.push(styles[`icon${iconColor.charAt(0).toUpperCase() + iconColor.slice(1)}`]);
  }
  if (iconFill) {
    classList.push(styles.iconFill);
  }
  classList.push(styles[`buttonStyle${buttonStyle.charAt(0).toUpperCase() + buttonStyle.slice(1)}`]);

  return (
    <button data-component="Button" className={classList.join(' ')} {...rest}>
      {StartIcon && (
        <span className={`${styles.icon} ${styles.iconStart}`}>
          <StartIcon />
        </span>
      )}
      <span className={styles.label}>{label}</span>
      {EndIcon && (
        <span className={`${styles.icon} ${styles.iconEnd}`}>
          <EndIcon />
        </span>
      )}
    </button>
  );
}

