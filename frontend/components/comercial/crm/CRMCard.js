import React, { useState, useRef, useEffect } from "react";
import styles from "../../../styles/comercial/crm/CRM.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsisV,
  faBriefcase,
  faDollarSign,
  faCalendarAlt,
  faUser,
  faPhone,
  faPen,
  faTimes,
  faExclamationCircle,
  faFire, // Fogo para "quente"
  faSnowflake, // Floco de neve para "frio"
  faInfoCircle, // Info para "neutro"
  faThumbsUp, // Like para "Ganhou"
  faThumbsDown // Dislike para "Perdeu"
} from "@fortawesome/free-solid-svg-icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/router";

export default function CRMCard({ data, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: data.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cardStyle = {
    ...style,
    border: getBordaColor()
  };

  const isDragging = transform?.x !== 0 || transform?.y !== 0;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();

  // useEffect(() => {
  //   console.log("Avatar do responsável:", data.responsavel_avatar);
  //   console.log("Informações:", data);
  // }, []);

  const handleClickOutside = (e) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
      setDropdownOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Verifica se o valor é válido e numérico, caso contrário atribui 0
  const valorNumerico = parseFloat(
    (data.valor && !isNaN(data.valor)) ? data.valor : 0
  );

  // Função para definir a cor da borda com base na temperatura
  function getBordaColor() {
    switch (data.temperatura) {
      case 'quente':
        return '1px solid red'; // Bordas vermelhas para "quente"
      case 'frio':
        return '1px solid blue'; // Bordas azuis para "frio"
      case 'neutro':
      default:
        return '1px solid gray'; // Bordas cinzas para "neutro"
    }
  }

  // Função para escolher o ícone baseado na temperatura
  const getTemperaturaIcon = () => {
    switch (data.temperatura) {
      case 'quente':
        return <FontAwesomeIcon icon={faFire} size="lg" color="red" />;
      case 'frio':
        return <FontAwesomeIcon icon={faSnowflake} size="lg" color="blue" />;
      case 'neutro':
      default:
        return <FontAwesomeIcon icon={faInfoCircle} size="lg" color="gray" />;
    }
  };

  // Adicione a função de máscara de telefone
  function formatarTelefone(telefone) {
    if (!telefone) return '';
    const apenasNumeros = telefone.replace(/\D/g, '');
    if (apenasNumeros.length === 11) {
      // Celular: (XX) 9XXXX-XXXX
      return apenasNumeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    if (apenasNumeros.length === 10) {
      // Fixo: (XX) XXXX-XXXX
      return apenasNumeros.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return telefone;
  }

  return (
    <div
      ref={setNodeRef}
      style={cardStyle}
      {...attributes}
      {...listeners}
      className={`${styles.crmCard} ${isDragging ? styles.dragging : ""}`}
      onDoubleClick={() => router.push(`/comercial/leads/${data.id}`)}
    >
      <div className={styles.crmCardHeaderRow}>
        <div className={styles.cardIconLeft}>
          {data.fase_nome?.toLowerCase() === 'ganhou' ? (
            <FontAwesomeIcon icon={faThumbsUp}  style={{ color: '#18c964' }} />
          ) : data.fase_nome?.toLowerCase() === 'perdeu' ? (
            <FontAwesomeIcon icon={faThumbsDown}  style={{ color: '#f44' }} />
          ) : data.hasPendingActivity ? (
            <FontAwesomeIcon icon={faCalendarAlt} style={{ color: '#F04F4F' }} />
          ) : (
            <FontAwesomeIcon icon={faBriefcase} className={styles.iconCase} />
          )}
        </div>

        <div className={styles.crmCardContent}>
          <div className={styles.crmCardTitleWithIcon}>
            <span className={styles.crmCardTitle}>{data.name || "Sem nome"}</span>
          </div>

          <div className={styles.crmCardSubtitle}>
            {data.telefone ? formatarTelefone(data.telefone) : "Sem telefone"}
          </div>

          <div className={styles.crmCardInfoLine}>
            <div className={styles.crmCardValue}>
              <FontAwesomeIcon icon={faDollarSign} />
              {valorNumerico ? ` ${valorNumerico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "0,00"}
            </div>
            <div className={styles.crmCardDays}>
              <FontAwesomeIcon icon={faCalendarAlt} /> {data.dias || 0} dias
            </div>
          </div>
        </div>
      </div>

      <div className={styles.crmCardDivider}></div>

      {/* Rodapé com o ícone de temperatura e avatar do responsável */}
      <div className={styles.crmCardFooter}>
        <img
          src={data.responsavel_avatar || "/default-avatar.png"}
          alt={data.responsavel_nome || "Responsável"}
          className={styles.responsavelAvatar}
        />
        <div className={styles.iconRight}>
          {getTemperaturaIcon()} {/* Exibe o ícone correto com base na temperatura */}
        </div>
      </div>
    </div>
  );
}
