import React, { useEffect, useState } from "react";
import styles from "../../../styles/comercial/crm/CRM.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";

export default function EditLeadModal({ leadId, open, onClose, onUpdated }) {
  const [formData, setFormData] = useState(null);
  const [membrosEquipe, setMembrosEquipe] = useState([]);
  const [isLoadingMembros, setIsLoadingMembros] = useState(false);

  useEffect(() => {
    if (open && leadId) {
      fetchLead();
    }
  }, [open, leadId]);

  // Buscar os dados do lead
  const fetchLead = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/leads/${leadId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Erro na API:', res.status, errorText);
        throw new Error(`Erro ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setFormData(data);

      // Buscar membros da equipe (depois que já pegou o team_id do lead)
      if (data?.empresa_id) fetchMembrosEquipe(data.empresa_id);
    } catch (error) {
      console.error("Erro ao buscar lead:", error);
      alert(`Erro ao carregar dados do lead: ${error.message}`);
    }
  };

  // Buscar membros da equipe pelo team_id do lead
  const fetchMembrosEquipe = async (teamId) => {
    setIsLoadingMembros(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/usuarios-empresas/empresa/${teamId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`Erro ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setMembrosEquipe(Array.isArray(data) ? data : []);
      console.log("👤 Membros da equipe:", data);
    } catch (err) {
      console.error("Erro ao buscar membros da equipe:", err);
      setMembrosEquipe([]);
    }
    setIsLoadingMembros(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem("token");
      // Payload incluindo o responsável (user_id)
      const payload = {
        nome: formData.nome || formData.name,
        email: formData.email,
        telefone: formData.telefone,
        valor: parseFloat(formData.valor || 0),
        data_prevista: formData.data_prevista?.split("T")[0] || null,
        empresa_id: formData.empresa_id,
        funil_id: formData.funil_id,
        funil_fase_id: formData.funil_fase_id,
        status: formData.status || "aberto",
        usuario_id: formData.usuario_id || formData.user_id ? parseInt(formData.usuario_id || formData.user_id) : null,
      };

      console.log("Enviando atualização:", payload);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/leads/${leadId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Erro na API:', res.status, errorText);
        throw new Error(`Erro ${res.status}: ${res.statusText}`);
      }

      onUpdated();
      onClose();
    } catch (error) {
      console.error("Erro ao atualizar lead:", error);
      alert(`Erro ao atualizar lead: ${error.message}`);
    }
  };

  if (!open || !formData) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3 className={styles.modalTitle}>Editar Lead</h3>

        <div className={styles.formGrid}>
          <div>
            <label className={styles.label}>Nome</label>
            <input name="nome" value={formData.nome || formData.name || ""} onChange={handleChange} placeholder="Nome" className={styles.input} />
          </div>
          <div>
            <label className={styles.label}>Email</label>
            <input name="email" value={formData.email || ""} onChange={handleChange} placeholder="Email" className={styles.input} />
          </div>
          <div>
            <label className={styles.label}>Telefone</label>
            <input name="telefone" value={formData.telefone || ""} onChange={handleChange} placeholder="Telefone" className={styles.input}  />
          </div>
          <div>
            <label className={styles.label}>Valor</label>
            <input name="valor" value={formData.valor || ""} onChange={handleChange} placeholder="Valor" className={styles.input} />
          </div>
          <div>
            <label className={styles.label}>Data Prevista</label>
            <input type="date" name="data_prevista" value={formData.data_prevista?.split("T")[0] || ""} onChange={handleChange} className={styles.input} />
          </div>
          <div>
            <label className={styles.label}>Responsável</label>
            <select
              className={`${styles.input} ${styles.responsavelSelect}`}
              name="usuario_id"
              value={formData.usuario_id || formData.user_id || ""}
              onChange={handleChange}
              required
            >
              <option value="">Selecione o responsável</option>
              {isLoadingMembros ? (
                <option>Carregando...</option>
              ) : (
                membrosEquipe
                  .filter((m) => m.cargo_nome !== 'superadmin')
                  .map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name}
                    </option>
                  ))
              )}
            </select>
          </div>
        </div>

        <div className={styles.modalActions}>
          <button onClick={handleSubmit} className={styles.saveBtn}>Salvar</button>
          <button onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
