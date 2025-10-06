import React, { useState, useEffect } from "react";
import styles from "../../styles/LeadContacts.module.css";
import { Pencil } from "lucide-react";

const EditContactModal = ({ contactId, onClose, onSave, equipeId }) => {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState(""); // Campo CPF
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Função para buscar os dados do contato ao abrir o modal
    const fetchContact = async () => {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contatos/contato/${contactId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      setNome(data.nome);
      setEmail(data.email);
      setTelefone(data.telefone);
      setCpf(data.cpf || ""); // Preenche com CPF existente
    };

    fetchContact();
  }, [contactId]);

  // Função para salvar as alterações
  const handleSave = async () => {
    setLoading(true);
    const userRaw = localStorage.getItem("user");
    const user = JSON.parse(userRaw);
    const equipeId = user.equipe_id;
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contatos/${contactId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome,
          email,
          telefone,
          cpf: cpf || null, // Permite CPF nulo
          equipe_id: equipeId,
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
        <h3>Editar Contato</h3>
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

export default EditContactModal;
