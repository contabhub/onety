import React from "react";
import { useDroppable } from "@dnd-kit/core"; // useDroppable vem do core!
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import SortableCard from "../crm/SortableCard"; // novo componente com useSortable
import styles from "../../styles/Column.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSuitcase, faSackDollar } from "@fortawesome/free-solid-svg-icons";

export default function Column({ id, title, cards, onEdit }) {
  const { setNodeRef } = useDroppable({ id });

  const totalCards = Array.isArray(cards) ? cards.length : 0;

  const totalValue = Array.isArray(cards)
  ? cards.reduce((sum, card) => {
      const value = parseFloat(card.valor);
      return sum + (isNaN(value) ? 0 : value);
    }, 0)
  : 0;



  // 👉 Identifica colunas especiais
  const isGanhou = title.toLowerCase() === "ganhou";
  const isPerdeu = title.toLowerCase() === "perdeu";
  const isProposta = title.toLowerCase() === "proposta";

  const columnClass = isGanhou
    ? `${styles.column} ${styles.ganhouColumn}`
    : isPerdeu
      ? `${styles.column} ${styles.perdeuColumn}`
    : isProposta
      ? `${styles.column} ${styles.PropostaColumn}`
      : styles.column;

  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <strong className={
          isGanhou ? styles.ganhouTitle :
            isPerdeu ? styles.perdeuTitle :
            isProposta ? styles.propostaTitle  :
              ""
        }>
          {title}
        </strong>

        <div className={styles.columnInfo}>
          <span className={isGanhou ? styles.ganhouIcon : isPerdeu ? styles.perdeuIcon : isProposta ? styles.propostaIcon  : ""}>
            <FontAwesomeIcon icon={faSuitcase} className={styles.columnCard} />
            {totalCards}
          </span>
          <span className={isGanhou ? styles.ganhouValor : isPerdeu ? styles.perdeuValor : isProposta ? styles.propostaValor  : ""}>
            <FontAwesomeIcon icon={faSackDollar} className={styles.columnCard} />
            R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>

        </div>
      </div>

      <div ref={setNodeRef} className={styles.columnBody}>
        <SortableContext items={cards.map(card => card.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard key={card.id} id={card.id} data={card} onEdit={onEdit} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
