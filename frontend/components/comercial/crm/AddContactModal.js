import React, { useState } from "react";
import styles from "../../../styles/comercial/crm/LeadContacts.module.css";
import { Plus } from "lucide-react";
import { useRouter } from "next/router";

const AddContactModal = ({ leadId, onClose, onSave, equipeId }) => {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState(""); // Campo CPF
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Função para salvar o novo contato
  const handleSave = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("userData");
    const user = JSON.parse(userRaw);
    const empresaId = user?.EmpresaId || user?.empresa?.id;

    if (!empresaId) {
      alert("Erro: Empresa não identificada. Por favor, recarregue a página.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/contatos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lead_id: leadId,
          nome,
          email,
          telefone,
          cpf: cpf || null, // Permite CPF nulo
          empresa_id: empresaId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSave(); // Chama a função de salvar no componente pai
        onClose(); // Fecha o modal
      } else {
        console.error(data.error);
      }
    } catch (error) {
      console.error("Erro ao salvar contato:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>Adicionar Contato</h3>
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
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.modalField}>
            <label>Telefone</label>
            <input
              type="text"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              required
            />
          </div>
          <div className={styles.modalField}>
            <label>CPF</label>
            <input
              type="text"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="CPF (opcional)"
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
    </div>
  );
};

export default AddContactModal;
