import { useState, useRef, useEffect } from "react";
import styles from "../../../styles/comercial/crm/LeadInfoCard.module.css";
import { Calendar, DollarSign, User } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBriefcase, faEllipsisV, faPen, faTrash, faExchangeAlt } from "@fortawesome/free-solid-svg-icons";
import EditLeadModal from "./EditLeadModal";
import MigrarLeadModal from "./MigrarLeadModal";
import { useRouter } from "next/router";

export default function LeadInfoCard({ lead, onUpdated}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [editOpen, setEditOpen] = useState(false);
  const [migrarOpen, setMigrarOpen] = useState(false);
  const [leadId, setLeadId] = useState(null);
  const router = useRouter();


  function formatPhoneNumber(phone) {
    if (!phone) return "Não informado";
    const cleaned = phone.replace(/\D/g, "");
    const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
    return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phone;
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  const handleDelete = async () => {
    const confirm = window.confirm("Tem certeza que deseja excluir este lead?");
    if (!confirm) return;
  
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/leads/${lead.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (!res.ok) throw new Error("Erro ao excluir lead");
  
      router.push("/comercial/crm"); // Redireciona após deletar
    } catch (error) {
      console.error("Erro ao excluir lead:", error);
      alert("Erro ao excluir lead. Tente novamente.");
    }
  };
  
  

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.iconWrapper}>
          <FontAwesomeIcon icon={faBriefcase} className={styles.iconTop} />
        </div>

        <div className={styles.dropdownContainer} ref={dropdownRef}>
          <button
            className={styles.dropdownToggle}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <FontAwesomeIcon icon={faEllipsisV} />
          </button>

          {dropdownOpen && (
            <div className={styles.dropdownMenu}>
              <button onClick={() => { setLeadId(lead.id); setEditOpen(true); }} className={styles.dropdownItem}>
                <FontAwesomeIcon icon={faPen} /> Editar
              </button>
              <button onClick={() => setMigrarOpen(true)} className={styles.dropdownItem}>
                <FontAwesomeIcon icon={faExchangeAlt} /> Migrar Lead
              </button>
              <button onClick={handleDelete} className={styles.dropdownItem}>
                <FontAwesomeIcon icon={faTrash} /> Excluir
              </button>
            </div>
          )}
        </div>
      </div>


      <div className={styles.nameSection}>
        <h3 className={styles.title}>{lead.nome || lead.name}</h3>
        <h4 className={styles.subtitle}>{formatPhoneNumber(lead.telefone)}</h4>
        <p className={styles.createdAt}>
          Criado em {new Date(lead.criado_em || lead.created_at).toLocaleDateString('pt-BR', {
            day: 'numeric', month: 'short', year: 'numeric'
          })}
        </p>
      </div>

      <hr className={styles.divider} />

      <div className={styles.infoRow}>
        <DollarSign className={styles.icon} />
        <span className={styles.label}>Valor:</span>
        <span className={styles.value}>
          {lead.valor ? `R$ ${Number(lead.valor).toLocaleString()}` : "Não informado"}
        </span>
      </div>

      <div className={styles.infoRow}>
        <Calendar className={styles.icon} />
        <span className={styles.label}>Data prevista:</span>
        <span className={styles.value}>
          {lead.data_prevista
            ? new Date(lead.data_prevista).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
            : "Não cadastrada"}
        </span>
      </div>

      <div className={styles.infoRow}>
        <User className={styles.icon} />
        <span className={styles.label}>Responsável:</span>
        <span className={styles.value}>
          {lead.responsavel_nome || "Não definido"}
        </span>
      </div>
      <EditLeadModal
        leadId={leadId}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onUpdated={onUpdated} // recarrega a lista após edição
      />
      
      <MigrarLeadModal
        lead={lead}
        open={migrarOpen}
        onClose={() => setMigrarOpen(false)}
        onMigrated={onUpdated} // recarrega a lista após migração
      />
    </div>
  );
}
