import { useState, useEffect } from "react";
import { FaCheck } from "react-icons/fa";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEllipsisV } from "@fortawesome/free-solid-svg-icons";
import { registrarHistorico } from "../../../utils/registrarHistorico";
import styles from "../../../styles/comercial/crm/PendentesAtividades.module.css";
import { CalendarDays } from "lucide-react";

export default function PendentesAtividades({ atividadesPendentes, leadId, onUpdated }) {
  const token = localStorage.getItem("token");
  const [isDropdownOpen, setIsDropdownOpen] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // Tenta obter o usuário do localStorage primeiro
    const userRaw = localStorage.getItem("userData");
    if (userRaw) {
      try {
        const userObj = JSON.parse(userRaw);
        setUserId(userObj.id);
        return;
      } catch (err) {
        console.error("Erro ao parsear userData", err);
      }
    }

    // Se não tiver no localStorage, busca da API
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/usuarios`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setUserId(data.id);
      })
      .catch((err) => console.error("Erro ao buscar usuário:", err));
  }, []);


  const concluirAtividade = async (atividade) => {
    console.log("Clicou para concluir:", atividade);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/atividades/${atividade.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "concluida" }),
      });

      if (!res.ok) throw new Error("Erro ao concluir atividade.");

      await registrarHistorico({
        lead_id: leadId,
        usuario_id: userId,
        tipo: "atividade",
        titulo: "Atividade concluída",
        descricao: atividade.nome,
        referencia_id: atividade.id,
        token,
      });

      onUpdated?.();
    } catch (error) {
      console.error("Erro ao concluir atividade:", error);
    }
  };

  const excluirAtividade = async (atividade) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/atividades/${atividade.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Erro ao excluir atividade.");

      onUpdated?.();
    } catch (error) {
      console.error("Erro ao excluir atividade:", error);
    }
  };

  const editarAtividade = (atividade) => {
    console.log("Editar atividade", atividade);
    // Aqui você pode abrir um modal ou redirecionar para edição
    alert(`Função editar ainda não implementada para: ${atividade.nome}`);
  };

  const toggleDropdown = (id) => {
    setIsDropdownOpen(isDropdownOpen === id ? null : id);
  };

  return (
    <div className={styles.container}>
      {atividadesPendentes.map((atividade) => (
        <div key={atividade.id} className={styles.activityCard}>
          <div className={styles.left}>
            <div className={styles.iconWrapper}>
              <CalendarDays size={20} color="#f44336" />
            </div>
            <div className={styles.content}>
              <div className={styles.name}>{atividade.nome}</div>
              <div className={styles.status}>Status: {atividade.status}</div>
            </div>
          </div>
          <div className={styles.actions}>
            <button className={styles.checkButton} onClick={() => concluirAtividade(atividade)}>
              <FaCheck size={18} className={styles.checkIcon} />
            </button>
            <button className={styles.menuButton} onClick={() => toggleDropdown(atividade.id)}>
              <FontAwesomeIcon icon={faEllipsisV} size="lg" className={styles.menuIcon} />
            </button>

            {isDropdownOpen === atividade.id && (
              <div className={styles.dropdownMenu}>
                <button onClick={() => editarAtividade(atividade)}>Editar</button>
                <button onClick={() => excluirAtividade(atividade)}>Excluir</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
