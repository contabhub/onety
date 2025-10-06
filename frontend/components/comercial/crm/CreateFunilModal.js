// components/crm/CreateFunilModal.js
import { useState } from "react";
import styles from "../../../styles/comercial/crm/CRM.module.css"; // Mesmo arquivo de estilos
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function CreateFunilModal({ open, onClose, onFunilCreated }) {
  const [nome, setNome] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  if (!open) return null;

  async function handleCreate() {
    try {
      const token = localStorage.getItem('token');
      const userRaw = localStorage.getItem('user');

      if (!token || !userRaw) {
        toast.error("Usuário ou token não encontrado.");
        return;
      }

      const user = JSON.parse(userRaw);
      const equipe_id = user.equipe_id;

      if (!equipe_id) {
        toast.warning("Usuário não possui equipe associada.");
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/funis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          equipe_id,
          nome,
          is_default: isDefault
        })
      });

      const data = await res.json();

      if (res.ok) {
        onFunilCreated(); // Atualiza lista de funis
        onClose();
      } else {
        console.error(data.error);
        toast.error(data.error || "Erro ao criar funil");
      }
    } catch (error) {
      console.error("Erro ao criar funil:", error);
    }
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2 className={styles.modalTitle}>Novo Funil</h2>

        <input
          className={styles.input}
          placeholder="Nome do Funil"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />


        <div className={styles.modalActions}>
          <button className={styles.saveBtn} onClick={handleCreate}>
            Criar
          </button>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancelar
          </button>
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
