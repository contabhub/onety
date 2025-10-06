// components/crm/CreateFaseModal.js
import { useState } from "react";
import styles from "../../../styles/comercial/crm/CRM.module.css"; // já aproveita o estilo!
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function CreateFaseModal({ open, onClose, funilId, onFaseCreated }) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ordem, setOrdem] = useState(0);

  if (!open) return null;

  async function handleCreate() {
    try {
      const token = localStorage.getItem('token');

      // Buscar fases existentes do funil 
      const fasesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funil-fases/${funilId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const fases = await fasesRes.json();

      // Filtra apenas fases do usuário (ordem < 9997)
      const fasesUsuario = fases.filter(f => f.ordem < 9997);

      // Pega a maior ordem existente e soma 1
      const maiorOrdem = fasesUsuario.reduce((max, fase) => Math.max(max, fase.ordem), -1);
      const novaOrdem = maiorOrdem + 1;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funil-fases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          funil_id: funilId,
          nome,
          descricao,
          ordem: novaOrdem
        })
      });

      const data = await res.json();

      if (res.ok) {
        onFaseCreated(); // callback para recarregar as fases
        onClose();
      } else {
        console.error(data.error);
        toast.error(data.error || "Erro ao criar fase");
      }
    } catch (error) {
      console.error("Erro ao criar fase:", error);
    }
  }


  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2 className={styles.modalTitle}>Nova Fase</h2>

        <input
          className={styles.input}
          placeholder="Nome da Fase"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <input
          className={styles.input}
          placeholder="Descrição (opcional)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
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
