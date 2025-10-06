import React, { useState, useEffect } from "react";
import styles from "../../../styles/comercial/crm/CRM.module.css";
import { useRouter } from "next/router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBriefcase } from "@fortawesome/free-solid-svg-icons";
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


// Mapeamento de status com base no título da coluna
const statusMapping = {
  "Lead - MQL": "Lead",
  "Qualificação": "Qualificação",
  "Reunião agendada": "Reunião Agendada",
  "Envio da COF": "Envio COF",
  "Reunião realizada": "Reunião Realizada",
  "Pós Reunião": "Pós Reunião",
  "Ganhou": "Ganhou",
  "Perdeu": "Perdeu"
};

export default function CreateCardModal({ open, onClose, onCreate, columnOptions, teamId, funilId }) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    telefone: "",
    email: "",
    fase_funil_id: "",
    team_id: "",     // 🔥 Adicionado
    funil_id: "",    // 🔥 Adicionado
    valor: "",       // Opcional
    data_prevista: "", // Opcional
    user_id: "",
  });
  const [membrosEquipe, setMembrosEquipe] = useState([]);
  const [isLoadingMembros, setIsLoadingMembros] = useState(false);

  useEffect(() => {
    async function fetchMembrosEquipe() {
      if (!teamId) return;
      setIsLoadingMembros(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user_equipes/${teamId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Erro ao buscar membros da equipe");
        const data = await res.json();
        setMembrosEquipe(Array.isArray(data) ? data : []);
      } catch (err) {
        setMembrosEquipe([]);
        console.error("Erro ao buscar membros da equipe:", err);
      }
      setIsLoadingMembros(false);
    }
    fetchMembrosEquipe();
  }, [teamId]);



  useEffect(() => {
    if (columnOptions && columnOptions.length > 0 && teamId && funilId) {
      setFormData((prev) => ({
        ...prev,
        fase_funil_id: columnOptions[0].id,
        team_id: teamId,
        funil_id: funilId
      }));
    }
  }, [columnOptions, teamId, funilId]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.user_id ||  !formData.fase_funil_id) {
      toast.warning("Por favor, preencha todos os campos obrigatórios: Nome e Responsável.");
      return;
    }

    const status =
      statusMapping[columnOptions.find((col) => col.id === formData.fase_funil_id)?.title] || "aberto";


    try {
      console.log("Dados enviados:", {
        name: formData.name,
        telefone: formData.telefone,
        email: formData.email,
        status,
        team_id: formData.team_id,
        funil_id: formData.funil_id,
        fase_funil_id: formData.fase_funil_id,
        valor: formData.valor,
        data_prevista: formData.data_prevista,
        user_id: formData.user_id ? parseInt(formData.user_id) : null,

      });

      const token = localStorage.getItem("token");
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          telefone: formData.telefone,
          email: formData.email,
          status,
          team_id: parseInt(formData.team_id),
          funil_id: parseInt(formData.funil_id),
          fase_funil_id: parseInt(formData.fase_funil_id),
          valor: parseFloat(
            formData.valor
              .toString()
              .replace(/\./g, "")   // remove separador de milhar (ponto)
              .replace(",", ".")    // troca vírgula decimal por ponto
          ),
          data_prevista: formData.data_prevista || null,
          user_id: formData.user_id ? parseInt(formData.user_id) : null,


        }),
      });

      const result = await response.json();

      if (response.ok) {
        const newCard = {
          id: result.leadId,
          name: formData.name,
          email: formData.email,
          telefone: formData.telefone,
          status,
          valor: parseFloat(formData.valor) || 0,
          dataPrevista: formData.data_prevista || null,
        };
        onCreate(formData.fase_funil_id, newCard);
        onClose();
        setFormData({
          name: "",
          telefone: "",
          email: "",
          fase_funil_id: columnOptions?.[0]?.id || "",
        });

        // 🚀 Redirecionar para a página do lead
        router.push(`/leads/${result.leadId}`);

      } else {
        throw new Error(result.message || "Erro ao criar lead");
      }
    } catch (error) {
      console.error("Erro ao criar lead:", error);
    }
  };

  if (!open) return null;


  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3 className={styles.createTitle}> <FontAwesomeIcon icon={faBriefcase} className={styles.iconTop} />Novo Negócio</h3>

        <div className={styles.formGrid}>
          <div>
            <label className={styles.label}>Nome <span style={{color: 'red'}}>*</span></label>
            <input className={styles.input} name="name" value={formData.name} onChange={handleChange} />
          </div>

          <div>
            <label className={styles.label}>Telefone</label>
            <input className={styles.input} name="telefone" value={formData.telefone} onChange={handleChange} />
          </div>

          <div>
            <label className={styles.label}>Email</label>
            <input className={styles.input} name="email" value={formData.email} onChange={handleChange} />
          </div>

          <div>
            <label className={styles.label}>Valor</label>
            <input className={styles.input} name="valor" value={formData.valor} onChange={handleChange} />
          </div>

          <div>
            <label className={styles.label}>Data Prevista</label>
            <input className={styles.input} type="date" name="data_prevista" value={formData.data_prevista} onChange={handleChange} />
          </div>

          <div>
            <label className={styles.label}>Fase do Funil <span style={{color: 'red'}}>*</span></label>
            <select className={styles.input} name="fase_funil_id" value={formData.fase_funil_id} onChange={handleChange}>
              {columnOptions.map((col) => (
                <option key={col.id} value={col.id}>{col.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={styles.label}>Responsável <span style={{color: 'red'}}>*</span></label>
            <select
              className={styles.input}
              name="user_id"
              value={formData.user_id || ""}
              onChange={handleChange}
              required
            >
              <option value="">Selecione o responsável</option>
              {isLoadingMembros ? (
                <option>Carregando...</option>
              ) : (
                membrosEquipe
                  .filter((m) => m.role !== 'superadmin')
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.full_name}
                    </option>
                  ))
              )}
            </select>

          </div>

        </div>

        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.saveBtn} onClick={handleSubmit}>Criar</button>
        </div>
      </div>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
        transition={Bounce}
      />
    </div>

  );
}
