import React from "react";
import { useRouter } from "next/router";
import styles from "../../styles/gestao/NavEnquete.module.css";

export default function NavTabs({ active, tabs, onTabClick }) {
  const router = useRouter();

  // Tabs padrão para enquete (mantém compatibilidade)
  const defaultTabs = [
    { name: "Enquete", path: "/gestao/enquete" },
    { name: "Categoria", path: "/gestao/enquete-categoria" },
    { name: "Particularidade", path: "/gestao/enquete-particularidade" },
    { name: "Respondendo Enquete", path: "#" }
  ];

  const tabsToRender = tabs || defaultTabs;

  const handleTabClick = (tab) => {
    // Se tem onClick customizado, executa
    if (tab.onClick) {
      tab.onClick();
      return;
    }
    
    // Se tem callback externo, executa
    if (onTabClick) {
      onTabClick(tab);
      return;
    }

    // Comportamento padrão: navegação
    if (tab.path.startsWith("#")) {
      return;
    }
    router.push(tab.path);
  };

  return (
    <div className={styles.navTabsContainer}>
      {tabsToRender.map((tab) => {
        const isActive = active === tab.name.toLowerCase();
        return (
          <div
            key={tab.name}
            onClick={() => handleTabClick(tab)}
            className={`${styles.tab} ${isActive ? styles.activeTab : ""} ${tab.path === "#" ? styles.disabledTab : ""}`}
          >
            {tab.name}
          </div>
        );
      })}
    </div>
  );
}
