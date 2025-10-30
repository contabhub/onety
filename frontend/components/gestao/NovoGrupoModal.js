import React, { useState, useEffect } from 'react';
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from "../../styles/gestao/CargosPage.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const NovoGrupoModal = ({ isOpen, onClose, onCreated }) => {
  const [classificacao, setClassificacao] = useState(0);
  const [grupo, setGrupo] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLight, setIsLight] = useState(false);

  // Calcula a classificação sempre que abrir o modal e limpa os campos
  useEffect(() => {
    if (isOpen) {
      setGrupo("");
      const calcularClassificacao = async () => {
        try {
          const token = typeof window !== "undefined" 
            ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
            : "";
          const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
          const userData = rawUserData ? JSON.parse(rawUserData) : {};
          const empresaId = userData?.EmpresaId;
          
          if (!empresaId) {
            console.error("EmpresaId não encontrado no storage");
            setClassificacao(1);
            return;
          }
          
          const url = `${BASE_URL}/gestao/enquete/grupos`;
          const response = await fetch(url, {
            headers: { 
              Authorization: `Bearer ${token}`,
              "X-Empresa-Id": empresaId.toString()
            },
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          setClassificacao(data.length + 1);
        } catch (error) {
          console.error("Erro ao calcular classificação:", error);
          setClassificacao(1); // fallback
        }
      };
      calcularClassificacao();
    }
  }, [isOpen]);

  // Detectar tema atual e reagir a mudanças
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const getTheme = () => document.documentElement.getAttribute('data-theme') === 'light';
    setIsLight(getTheme());
    const handleChange = (e) => {
      const detail = e.detail;
      if (detail && (detail.theme === 'light' || detail.theme === 'dark')) {
        setIsLight(detail.theme === 'light');
      } else {
        setIsLight(getTheme());
      }
    };
    window.addEventListener('titan-theme-change', handleChange);
    return () => window.removeEventListener('titan-theme-change', handleChange);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!grupo.trim()) {
      toast.error("Informe o nome do grupo.");
      return;
    }
    setLoading(true);

    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        toast.error("EmpresaId não encontrado no storage");
        setLoading(false);
        return;
      }
      
      const url = `${BASE_URL}/gestao/enquete/grupos`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Empresa-Id": empresaId.toString()
        },
        body: JSON.stringify({
          classificacao,
          grupo,
        }),
      });

      if (response.status === 409) {
        toast.error("Já existe um grupo com esse nome, altere antes de salvar!");
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      toast.success("Grupo criado com sucesso!");
      onCreated();
      onClose();
    } catch (error) {
      console.error("Erro ao criar grupo:", error);
      toast.error("Erro ao criar grupo");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
  <div className={`${styles.modalOverlay} ${isLight ? styles.modalOverlayLight : styles.modalOverlayDark}`}>
        <div className={`${styles.modalContent} ${isLight ? styles.modalContentLight : styles.modalContentDark}`} style={{ width: "400px" }}>
          <h2 className={styles.modalTitle} style={{ textAlign: "center" }}>
            Novo Grupo
          </h2>

          <ToastContainer />

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="id" className={styles.label}>
                ID
              </label>
              <input
                type="text"
                id="id"
                value={classificacao}
                disabled
                className={styles.inputField}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="classificacao" className={styles.label}>
                Classificação
              </label>
              <input
                type="text"
                id="classificacao"
                value={classificacao}
                disabled
                className={styles.inputField}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="grupo" className={styles.label}>
                Nome do Grupo
              </label>
              <input
                type="text"
                id="grupo"
                value={grupo}
                onChange={(e) => setGrupo(e.target.value)}
                className={styles.inputField}
                required
                autoFocus
              />
            </div>

            <div className={styles.modalActions}>
              <button
                type="submit"
                disabled={loading}
                className={styles.btnPrimary}
              >
                {loading ? "Criando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className={styles.btnCancel}
              >
                Fechar
              </button>
            </div>
          </form>
        </div>
      </div>
  );
};

export default NovoGrupoModal;
