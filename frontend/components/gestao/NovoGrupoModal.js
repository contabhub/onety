import React, { useState, useEffect } from 'react';
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Cliente HTTP mínimo (fetch)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const api = {
  get: async (url, config = {}) => {
    const params = config.params ? `?${new URLSearchParams(config.params).toString()}` : '';
    const res = await fetch(`${API_BASE}${url}${params}`, { headers: config.headers || {} });
    return { data: await res.json() };
  },
  post: async (url, body, config = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(config.headers || {}) };
    const res = await fetch(`${API_BASE}${url}`, { method: 'POST', headers, body: JSON.stringify(body) });
    return { data: await res.json(), status: res.status };
  }
};

const NovoGrupoModal = ({ isOpen, onClose, onCreated }) => {
  const [classificacao, setClassificacao] = useState(0);
  const [grupo, setGrupo] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLight, setIsLight] = useState(false);
  const [empresaId, setEmpresaId] = useState("");

  // Calcula a classificação sempre que abrir o modal e limpa os campos
  useEffect(() => {
    if (isOpen) {
      setGrupo("");
      const empresa = (typeof window !== 'undefined')
        ? (JSON.parse(localStorage.getItem('userData') || '{}')?.EmpresaId?.toString() || localStorage.getItem('empresaId') || '')
        : '';
      setEmpresaId(empresa || '');
      const calcularClassificacao = async () => {
        try {
          if (!empresa) {
            setClassificacao(1);
            return;
          }
          const token = (typeof window !== 'undefined') ? (localStorage.getItem('token') || sessionStorage.getItem('token')) : null;
          const response = await api.get(`/gestao/clientes/grupos/todos`, {
            params: { empresaId: empresa },
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          const list = response?.data?.grupos || [];
          setClassificacao(list.length + 1);
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
      const detail = e && e.detail ? e.detail : {};
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
    if (!empresaId) {
      toast.error("Empresa não identificada.");
      return;
    }
    setLoading(true);

    try {
      const token = (typeof window !== 'undefined') ? (localStorage.getItem('token') || sessionStorage.getItem('token')) : null;
      const res = await api.post(`/gestao/clientes/grupos`, {
        nome: grupo.trim(),
        empresaId: empresaId
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.status >= 400) throw new Error('Erro ao criar grupo');
      toast.success("Grupo criado com sucesso!");
      onCreated();
      onClose();
    } catch (error) {
      console.error("Erro ao criar grupo:", error);
      if (error?.response?.status === 409) {
        toast.error("Já existe um grupo com esse nome, altere antes de salvar!");
      } else {
        toast.error("Erro ao criar grupo");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: isLight ? "rgba(0, 0, 0, 0.35)" : "rgba(0, 0, 0, 0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
          transition: "all 0.3s ease",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      >
        <div
          style={{
            backgroundColor: isLight ? "#ffffff" : "rgba(11, 11, 17, 0.6)",
            padding: "var(--onity-space-l)",
            borderRadius: "var(--onity-radius-l)",
            width: "400px",
            maxWidth: "100%",
            boxSizing: "border-box",
            boxShadow: "var(--onity-elev-high)",
            border: isLight ? "1px solid var(--onity-color-border)" : "1px solid var(--onity-color-border)",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              marginBottom: "var(--onity-space-m)",
              fontSize: "var(--onity-type-h2-size)",
              fontWeight: 600,
              color: "var(--onity-color-text)",
            }}
          >
            Novo Grupo
          </h2>

          <ToastContainer />

          <form onSubmit={handleSubmit}>
            {/* ID e Classificação - campos somente leitura */}
            <div style={{ marginBottom: "var(--titan-spacing-sm)" }}>
              <label htmlFor="id" style={{ 
                display: "block", 
                fontSize: "var(--titan-font-size-sm)", 
                fontWeight: "var(--titan-font-weight-semibold)", 
                color: "var(--onity-color-text)",
                marginBottom: "var(--titan-spacing-xs)"
              }}>
                ID
              </label>
              <input
                type="text"
                id="id"
                value={classificacao}
                disabled
                style={{
                  width: "100%",
                  padding: "var(--onity-space-s)",
                  borderRadius: "var(--onity-radius-xs)",
                  border: "1px solid var(--onity-color-border)",
                  backgroundColor: "var(--onity-color-surface)",
                  color: "var(--onity-color-text)",
                  fontSize: "var(--onity-type-body-size)",
                  transition: "all 0.2s ease",
                }}
              />
            </div>

            <div style={{ marginBottom: "var(--titan-spacing-sm)" }}>
              <label htmlFor="classificacao" style={{ 
                display: "block", 
                fontSize: "var(--titan-font-size-sm)", 
                fontWeight: "var(--titan-font-weight-semibold)", 
                color: "var(--onity-color-text)",
                marginBottom: "var(--titan-spacing-xs)"
              }}>
                Classificação
              </label>
              <input
                type="text"
                id="classificacao"
                value={classificacao}
                disabled
                style={{
                  width: "100%",
                  padding: "var(--onity-space-s)",
                  borderRadius: "var(--onity-radius-xs)",
                  border: "1px solid var(--onity-color-border)",
                  backgroundColor: "var(--onity-color-surface)",
                  color: "var(--onity-color-text)",
                  fontSize: "var(--onity-type-body-size)",
                  transition: "all 0.2s ease",
                }}
              />
            </div>

            {/* Nome do grupo */}
            <div style={{ marginBottom: "var(--titan-spacing-md)" }}>
              <label htmlFor="grupo" style={{ 
                display: "block", 
                fontSize: "var(--titan-font-size-sm)", 
                fontWeight: "var(--titan-font-weight-semibold)", 
                color: "var(--onity-color-text)",
                marginBottom: "var(--titan-spacing-xs)"
              }}>
                Nome do Grupo
              </label>
              <input
                type="text"
                id="grupo"
                value={grupo}
                onChange={(e) => setGrupo(e.target.value)}
                style={{
                  width: "100%",
                  padding: "var(--onity-space-s)",
                  borderRadius: "var(--onity-radius-xs)",
                  border: "1px solid var(--onity-color-border)",
                  backgroundColor: "var(--onity-color-surface)",
                  color: "var(--onity-color-text)",
                  fontSize: "var(--onity-type-body-size)",
                  transition: "all 0.2s ease",
                }}
                required
                autoFocus
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--onity-color-primary)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(68, 84, 100, 0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--onity-color-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Botões */}
            <div style={{ textAlign: "center" }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  backgroundColor: "var(--onity-color-primary)",
                  color: "white",
                  padding: "var(--onity-space-s) var(--onity-space-m)",
                  borderRadius: "var(--onity-radius-xs)",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  marginRight: "var(--onity-space-s)",
                  fontSize: "var(--onity-type-body-size)",
                  fontWeight: 500,
                  transition: "all 0.2s ease",
                  opacity: loading ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background = "var(--onity-color-primary-hover)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "var(--onity-elev-high)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background = "var(--onity-color-primary)";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
              >
                {loading ? "Criando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  backgroundColor: isLight ? "var(--onity-color-surface)" : "rgba(255, 255, 255, 0.12)",
                  color: "var(--onity-color-text)",
                  padding: "var(--onity-space-s) var(--onity-space-m)",
                  borderRadius: "var(--onity-radius-xs)",
                  border: isLight ? "1px solid var(--onity-color-border)" : "1px solid rgba(255, 255, 255, 0.15)",
                  cursor: "pointer",
                  fontSize: "var(--onity-type-body-size)",
                  fontWeight: 500,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isLight ? "var(--onity-color-surface)" : "rgba(255, 255, 255, 0.18)";
                  e.currentTarget.style.borderColor = isLight ? "var(--onity-color-primary)" : "rgba(255, 255, 255, 0.25)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isLight ? "var(--onity-color-surface)" : "rgba(255, 255, 255, 0.12)";
                  e.currentTarget.style.borderColor = isLight ? "var(--onity-color-border)" : "rgba(255, 255, 255, 0.15)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
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
