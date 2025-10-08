import React from "react";
import styles from "./ToggleSimNao.module.css";

export default function ToggleSimNao({ checked, onChange, disabled }) {
  return (
    <span className={styles.toggleContainer}>
      <span
        className={
          checked
            ? `${styles.switch} ${styles.switchChecked}`
            : styles.switch
        }
        onClick={() => !disabled && onChange(!checked)}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
      >
        {checked ? (
          <span className={styles.textSim}>SIM</span>
        ) : (
          <span className={styles.textNao}>NÃO</span>
        )}
        <span
          className={
            checked
              ? `${styles.circle} ${styles.circleChecked}`
              : styles.circle
          }
        />
      </span>
    </span>
  );
} 