import React, { useState, useEffect } from "react";
import styles from "../../../styles/comercial/crm/CRM.module.css";

export default function EditCardModal({ open, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    valor: "",
    dias: "",
    status: "Nova",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        nome: initialData.nome || "",
        telefone: initialData.telefone || "",
        valor: initialData.valor || "",
        dias: initialData.dias || "",
        status: initialData.status || "Nova",
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  if (!open) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>Editar Card</h3>

        <input
          type="text"
          name="nome"
          value={formData.nome}
          onChange={handleChange}
          placeholder="Nome"
          className={styles.input}
        />

        <input
          type="text"
          name="telefone"
          value={formData.telefone}
          onChange={handleChange}
          placeholder="Telefone"
          className={styles.input}
        />

        <input
          type="text"
          name="valor"
          value={formData.valor}
          onChange={handleChange}
          placeholder="Valor"
          className={styles.input}
        />

        <input
          type="number"
          name="dias"
          value={formData.dias}
          onChange={handleChange}
          placeholder="Dias"
          className={styles.input}
        />

        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className={styles.input}
        >
          <option value="Nova">Nova</option>
          <option value="Em andamento">Em andamento</option>
          <option value="Fechada">Fechada</option>
          <option value="Perdida">Perdida</option>
        </select>

        <div className={styles.modalActions}>
          <button className={styles.saveBtn} onClick={handleSave}>
            Salvar
          </button>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
