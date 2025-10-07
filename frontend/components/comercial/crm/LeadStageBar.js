import React, { useEffect } from "react";
import styles from "../../../styles/comercial/crm/LeadStageBar.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faThumbsUp, faThumbsDown } from "@fortawesome/free-solid-svg-icons";

export default function LeadStageBar({ fases, faseAtualId, onChangeFase }) {
  useEffect(() => {
    console.log("[LeadStageBar] fases recebidas:", fases);
    console.log("[LeadStageBar] faseAtualId:", faseAtualId);
  }, [fases, faseAtualId]);

  if (!fases || fases.length === 0) {
    console.warn("[LeadStageBar] Nenhuma fase para exibir.");
    return null;
  }

  return (
    <div className={styles.stageBarContainer}>
      {fases.map((fase, index) => {
        const isAtual = fase.id === faseAtualId;
        const faseNome = fase.nome.toLowerCase();
        const isGanhou = faseNome === "ganhou";
        const isPerdeu = faseNome === "perdeu";

        return (
          <React.Fragment key={fase.id}>
            <div
              className={`
                ${styles.stageItem} 
                ${isAtual ? styles.atual : ""} 
                ${(isGanhou || isPerdeu) ? styles.final : ""}
              `}
              onClick={() => onChangeFase(fase.id)}
            >
              <span className={styles.stageName}>
                {isGanhou && (
                  <FontAwesomeIcon
                    icon={faThumbsUp}
                    style={{ marginRight: 6, color: "#00b894" }}
                  />
                )}
                {isPerdeu && (
                  <FontAwesomeIcon
                    icon={faThumbsDown}
                    style={{ marginRight: 6, color: "#d63031" }}
                  />
                )}
                {fase.nome}
              </span>
            </div>

            {/* Exibe seta entre fases, exceto na última */}
            {index < fases.length - 1 && (
              <span className={styles.arrow}>&#8250;</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
