import React, { useState } from "react";
import { createPortal } from "react-dom";
import styles from "../../../styles/comercial/crm/LeadContacts.module.css"; // Use o mesmo CSS para os modais

const AddCompanyModal = ({ leadId, onClose, onSave }) => {
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [loading, setLoading] = useState(false);

  // Função para salvar a empresa
  const handleSave = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/empresa-leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lead_id: leadId,
          nome,
          cnpj: cnpj || null,
          endereco: endereco || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSave(); // Atualizar a lista de empresas após salvar
        onClose(); // Fechar o modal
      } else {
        console.error(data.error);
      }
    } catch (error) {
      console.error("Erro ao salvar empresa:", error);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modal} role="document">
        <h3>Adicionar Empresa</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className={styles.modalForm}
        >
          <div className={styles.modalField}>
            <label>Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className={styles.modalField}>
            <label>CNPJ</label>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="CNPJ (opcional)"
            />
          </div>
          <div className={styles.modalField}>
            <label>Endereço</label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Endereço (opcional)"
            />
          </div>
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
    </div>,
    typeof document !== 'undefined' ? document.body : (typeof window !== 'undefined' ? window.document.body : null)
  );
};

export default AddCompanyModal;
