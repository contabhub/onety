import React from "react";
import styles from "../../styles/gestao/LocalTabs.module.css";

export default function LocalTabs({ active, tabs, onTabChange }) {
  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <div
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
          >
            {tab.name}
          </div>
        );
      })}
    </div>
  );
} 