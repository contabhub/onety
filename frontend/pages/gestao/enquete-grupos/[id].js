import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import PrincipalSidebar from "../../../components/onety/principal/PrincipalSidebar";
import { toast } from "react-toastify";
import styles from "../../../styles/gestao/EnquetePage.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const ConfirmModal = ({ show, onConfirm, onClose, message }) => {
  if (!show) return null;
  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalBox}>
        <h2>Excluir</h2>
        <div className={styles.modalBody}>
          <span>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
              <path fill="#FFB557" d="M1 21L12 2l11 19zm11-3q.425 0 .713-.288T13 17t-.288-.712T12 16t-.712.288T11 17t.288.713T12 18m-1-3h2v-5h-2z"/>
            </svg>
          </span>
          <p>{message}</p>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btnDanger} onClick={onConfirm}>Excluir</button>
          <button className={styles.btnCancel} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
};

const EnqueteGrupoPage = () => {
  const router = useRouter();
  const grupoId = router.query?.id;
  const [grupo, setGrupo] = useState({ titulo: '' });
  const [perguntas, setPerguntas] = useState([]);
  const [novaPergunta, setNovaPergunta] = useState('');
  const [tipoPergunta, setTipoPergunta] = useState('MULTIPLA');
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => { 
    if (!grupoId) return; 
    fetchGrupo(); 
    fetchPerguntas(); 
  }, [grupoId]);

  const fetchGrupo = async () => {
    const token = typeof window !== "undefined" 
      ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
      : "";
    const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
    const userData = rawUserData ? JSON.parse(rawUserData) : {};
    const empresaId = userData?.EmpresaId;
    
    if (!empresaId) {
      console.error("EmpresaId não encontrado no storage");
      return;
    }
    
    if (!grupoId) return;
    const url = `${BASE_URL}/gestao/enquete/grupos/${grupoId}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Empresa-Id": empresaId.toString()
      },
    });
    
    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    setGrupo(data);
  };

  const fetchPerguntas = async () => {
    const token = typeof window !== "undefined" 
      ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
      : "";
    const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
    const userData = rawUserData ? JSON.parse(rawUserData) : {};
    const empresaId = userData?.EmpresaId;
    
    if (!empresaId) {
      console.error("EmpresaId não encontrado no storage");
      return;
    }
    
    if (!grupoId) return;
    const url = `${BASE_URL}/gestao/enquete/grupos/${grupoId}/perguntas`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Empresa-Id": empresaId.toString()
      },
    });
    
    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    setPerguntas(data);
  };

  const handleNovaPergunta = async () => {
    if (!novaPergunta.trim()) {
      toast.error("Digite o texto da pergunta!", {
        theme: "dark",
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    const token = typeof window !== "undefined" 
      ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
      : "";
    if (!token) {
      toast.error("Sessão expirada. Faça login novamente.", {
        theme: "dark",
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
    const userData = rawUserData ? JSON.parse(rawUserData) : {};
    const empresaId = userData?.EmpresaId;
    
    if (!empresaId) {
      toast.error("EmpresaId não encontrado no storage");
      return;
    }

    if (!grupoId) return;
    const url = `${BASE_URL}/gestao/enquete/perguntas`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Empresa-Id": empresaId.toString()
      },
      body: JSON.stringify({
        grupoId,
        pergunta: novaPergunta.trim(),
        multiplaEscolha: tipoPergunta === 'MULTIPLA'
      }),
    });

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      toast.error("Erro ao criar pergunta");
      return;
    }

    setNovaPergunta('');
    fetchPerguntas();
  };

  const confirmDeletePergunta = (id) => {
    setModalMessage('Realmente deseja excluir a Pergunta?\nAtenção, todas as respostas serão apagadas também.');
    setModalAction(() => async () => {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        toast.error("EmpresaId não encontrado no storage");
        setShowModal(false);
        return;
      }
      
      const url = `${BASE_URL}/gestao/enquete/perguntas/${id}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });

      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status}`);
        toast.error("Erro ao excluir pergunta");
        setShowModal(false);
        return;
      }
      
      setShowModal(false);
      fetchPerguntas();
    });
    setShowModal(true);
  };

  const confirmDeleteGrupo = () => {
    setModalMessage('Realmente deseja excluir o Grupo?\nAtenção, todas as perguntas e respostas serão apagadas também.');
    setModalAction(() => async () => {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        toast.error("EmpresaId não encontrado no storage");
        setShowModal(false);
        return;
      }
      
      if (!grupoId) return;
      const url = `${BASE_URL}/gestao/enquete/grupos/${grupoId}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });

      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status}`);
        toast.error("Erro ao excluir grupo");
        setShowModal(false);
        return;
      }
      
      setShowModal(false);
      window.location.href = '/gestao/enquete';
    });
    setShowModal(true);
  };

  const handleSaveGrupo = async () => {
    const token = typeof window !== "undefined" 
      ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
      : "";
    const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
    const userData = rawUserData ? JSON.parse(rawUserData) : {};
    const empresaId = userData?.EmpresaId;
    
    if (!empresaId) {
      toast.error("EmpresaId não encontrado no storage");
      return;
    }
    
    if (!grupoId) return;
    const url = `${BASE_URL}/gestao/enquete/grupos/${grupoId}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Empresa-Id": empresaId.toString()
      },
      body: JSON.stringify({
        classificacao: grupo.classificacao,
        grupo: grupo.titulo
      }),
    });

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      toast.error("Erro ao atualizar grupo");
      return;
    }
    
    toast.success("Grupo atualizado com sucesso!", {
      theme: "dark",
      position: "top-right",
      autoClose: 3000,
    });
  };

  return (
    <>
      <PrincipalSidebar />
      <ConfirmModal 
        show={showModal} 
        onConfirm={modalAction} 
        onClose={() => setShowModal(false)} 
        message={modalMessage} 
      />
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.row}>
            <div className={styles.left}>
              <label className={styles.label}>Id</label>
              <input type="text" value={grupo?.id || ''} readOnly className={`${styles.inputField} ${styles.readonly}`} />
              <label className={styles.label}>Classificação</label>
              <input type="text" value={grupo?.classificacao || ''} readOnly className={`${styles.inputField} ${styles.readonly}`} />
              <label className={styles.label}>Grupo *</label>
              <textarea 
                value={grupo?.titulo || ''} 
                onChange={(e) => setGrupo({ ...grupo, titulo: e.target.value })}
                className={styles.textareaField}
              />
              <div className={styles.actions}>
                <button className={styles.btnSuccess} onClick={handleSaveGrupo}>Salvar</button>
                <button className={styles.btnDanger} onClick={confirmDeleteGrupo}>Excluir</button>
              </div>
            </div>

            <div className={styles.right}>
              <h3 className={styles.sectionTitle}>Perguntas</h3>
              <label className={styles.label}>Pergunta *</label>
              <input 
                type="text" 
                value={novaPergunta} 
                onChange={(e) => setNovaPergunta(e.target.value)} 
                className={styles.inputField}
              />
              <div className={styles.inline}>
                <div className={styles.inlineGroup}>
                  <label className={styles.label}>Quantidade Respostas *</label>
                  <select 
                    value={tipoPergunta} 
                    onChange={(e) => setTipoPergunta(e.target.value)}
                    className={styles.selectField}
                  >
                    <option value="MULTIPLA">Várias</option>
                    <option value="UNICA">Única</option>
                  </select>
                </div>
                <button className={`${styles.btnSuccess} ${styles.smallButton}`} onClick={handleNovaPergunta}>Nova</button>
              </div>

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>#</th>
                    <th className={styles.th}>Pergunta</th>
                    <th className={styles.th}>Qtd</th>
                    <th className={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {perguntas.map((p, index) => (
                    <tr key={p.id}>
                      <td className={styles.td}>{index + 1}</td>
                      <td className={styles.td}>
                        <span
                          onClick={() => window.location.href = `/gestao/enquete-perguntas/${p.id}`}
                          className={styles.perguntaLink}
                        >
                          {p.texto}
                        </span>
                      </td>
                      <td className={styles.td}>{p.tipo === 'UNICA' ? '1' : 'N'}</td>
                      <td className={styles.td}>
                        <button className={styles.iconButton} onClick={() => confirmDeletePergunta(p.id)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                            <path fill="none" stroke="#FF1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16m-10 4v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EnqueteGrupoPage;