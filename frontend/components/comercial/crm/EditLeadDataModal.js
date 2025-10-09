import { useState, useEffect } from "react";
import styles from "../../../styles/comercial/crm/LeadDataCard.module.css";

export default function EditLeadDataModal({ open, onClose, categoria, leadId, onSave }) {
  const [valores, setValores] = useState({});  // Cada campo terá seu próprio valor

  // Carregar os valores dos campos quando a categoria mudar ou o modal for aberto
  useEffect(() => {
    if (open && categoria) {
      const initialValues = categoria.campos.reduce((acc, campo) => {
        acc[campo.campo_id] = campo.valor || "";
        return acc;
      }, {});
      setValores(initialValues);  // Atualiza os valores no estado
    }
  }, [open, categoria]);  // Sempre que o modal for aberto ou a categoria mudar, atualizar valores

  const [loading, setLoading] = useState(false);

  // Função para lidar com a alteração de valor de um campo
  const handleChange = (id, value) => {
    setValores(prev => ({ ...prev, [id]: value }));
  };

  // Função para salvar os valores dos campos
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      for (const campo of categoria.campos) {
        const campoId = campo.campo_id;

        const valor = valores[campoId] || "";

        const isUpdate = campo.valor_id !== undefined && campo.valor_id !== null;

        const url = isUpdate
          ? `${process.env.NEXT_PUBLIC_API_URL}/comercial/valores-personalizados/${campo.valor_id}`
          : `${process.env.NEXT_PUBLIC_API_URL}/comercial/valores-personalizados`;

        const method = isUpdate ? "PUT" : "POST";

        const body = isUpdate
          ? { valor }
          : {
            lead_id: leadId,
            campo_id: campoId,
            valor,
          };

        await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(body),
        });
      }

      onSave();  // Atualiza os dados no card
      onClose(); // Fecha o modal
    } catch (err) {
      console.error("Erro ao salvar valores:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>Editar: {categoria.categoria_nome}</h3>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {categoria.campos.map((campo) => (
            <div key={campo.campo_id} className={styles.modalField}>
              <label>{campo.nome}</label>
              <input
                type={campo.tipo === "data" ? "date" : "text"}
                value={valores[campo.campo_id] || ""}
                onChange={(e) => handleChange(campo.campo_id, e.target.value)}
              />
            </div>

          ))}
          <div className={styles.modalButtons}>
            <button type="button" onClick={onClose}>
              Cancelar
            </button>

            <button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
