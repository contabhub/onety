import React, { useState, useEffect } from "react";
import styles from "../../styles/LeadContacts.module.css"; // Use o mesmo CSS para os modais

const EditCompanyModal = ({ companyId, onClose, onSave }) => {
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [loading, setLoading] = useState(false);

  // Função para buscar os dados da empresa ao abrir o modal
  useEffect(() => {
    const fetchCompany = async () => {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/empresas/empresa/${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      setNome(data.nome);
      setCnpj(data.cnpj || "");
      setEndereco(data.endereco || "");
    };

    fetchCompany();
  }, [companyId]);

  // Função para salvar as alterações da empresa
  const handleSave = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/empresas/${companyId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
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

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>Editar Empresa</h3>
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
            <button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCompanyModal;
