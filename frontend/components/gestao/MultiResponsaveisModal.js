import React, { useState, useEffect } from "react";
// Cliente HTTP local (igual ao usado em pages/gestao/clientes.js)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const getToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
};
const api = {
  get: async (url, config = {}) => {
    const params = config.params ? `?${new URLSearchParams(config.params).toString()}` : "";
    const res = await fetch(`${API_BASE}${url}${params}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${getToken()}`, ...(config.headers || {}) }
    });
    if (config.responseType === "blob") {
      return { data: await res.blob(), headers: { 'content-type': res.headers.get('content-type') || '' } };
    }
    return { data: await res.json() };
  },
  post: async (url, body, config = {}) => {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = { Authorization: `Bearer ${getToken()}`, ...(config.headers || {}) };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      headers,
      body: isFormData ? body : JSON.stringify(body)
    });
    return { data: await res.json() };
  },
  delete: async (url, config = {}) => {
    const res = await fetch(`${API_BASE}${url}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}`, ...(config.headers || {}) }
    });
    return { data: await res.json() };
  }
};
import { X, Plus, Trash2, User } from "lucide-react";
import styles from "./MultiResponsaveisModal.module.css";

export default function MultiResponsaveisModal({
  isOpen,
  onClose,
  obrigacaoId,
  clienteId,
  obrigacaoNome,
  clienteNome,
  onSuccess
}) {
  const [responsaveis, setResponsaveis] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsuarioId, setSelectedUsuarioId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    if (isOpen) {
      carregarDados();
    }
  }, [isOpen, obrigacaoId, clienteId]);

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

  // Evitar recarregamentos desnecessários
  useEffect(() => {
    if (!isOpen) {
      // Limpar dados quando modal fecha
      setResponsaveis([]);
      setUsuarios([]);
      setSelectedUsuarioId(null);
      setSearchTerm("");
      setMessage("");
    }
  }, [isOpen]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Carregar responsáveis atuais
      const [responsaveisRes, usuariosRes] = await Promise.all([
        api.get(`/gestao/obrigacoes/${obrigacaoId}/clientes/${clienteId}/responsaveis`),
        api.get("/usuarios")
      ]);
      
      const listaResp = Array.isArray(responsaveisRes.data)
        ? responsaveisRes.data
        : (Array.isArray(responsaveisRes.data?.responsaveis) ? responsaveisRes.data.responsaveis : (Array.isArray(responsaveisRes.data?.data) ? responsaveisRes.data.data : []));
      // ✅ NOVO: Remover duplicatas dos responsáveis baseado em usuarioId
      const responsaveisUnicos = listaResp.filter((resp, index, array) => {
        return array.findIndex(r => r.usuarioId === resp.usuarioId) === index;
      });
      
      setResponsaveis(responsaveisUnicos);
      const listaUsuarios = Array.isArray(usuariosRes.data)
        ? usuariosRes.data
        : (Array.isArray(usuariosRes.data?.usuarios) ? usuariosRes.data.usuarios : (Array.isArray(usuariosRes.data?.data) ? usuariosRes.data.data : []));
      setUsuarios(listaUsuarios);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setMessage("Erro ao carregar dados");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const adicionarResponsavel = async () => {
    if (!selectedUsuarioId) return;
    
    // ✅ NOVO: Verificar se o usuário já é responsável
    const jaEResponsavel = responsaveis.some(resp => resp.usuarioId === selectedUsuarioId);
    if (jaEResponsavel) {
      setMessage("Este usuário já é responsável por esta obrigação!");
      setMessageType("error");
      setTimeout(() => setMessage(""), 3000);
      return;
    }
    
    setLoading(true);
    try {
      await api.post(`/gestao/obrigacoes/${obrigacaoId}/clientes/${clienteId}/responsaveis`, {
        usuarioId: selectedUsuarioId
      });
      
      // Limpar campos imediatamente após sucesso
      setSelectedUsuarioId(null);
      setSearchTerm("");
      
      // Recarregar dados para mostrar o novo responsável na lista
      await carregarDados();
      
      // Notificar sucesso
      setMessage("Responsável adicionado com sucesso!");
      setMessageType("success");
      
      // Limpar mensagem após 3 segundos
      setTimeout(() => {
        setMessage("");
      }, 3000);
      
      // Notificar componente pai (sem fechar o modal)
      onSuccess();
    } catch (error) {
      console.error("Erro ao adicionar responsável:", error);
      setMessage(error.response?.data?.error || "Erro ao adicionar responsável");
      setMessageType("error");
      
      // Limpar mensagem de erro após 5 segundos
      setTimeout(() => {
        setMessage("");
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  const removerResponsavel = async (responsavelId) => {
    if (!window.confirm("Tem certeza que deseja remover este responsável?")) return;
    
    setLoading(true);
    try {
      await api.delete(`/gestao/obrigacoes/${obrigacaoId}/clientes/${clienteId}/responsaveis/${responsavelId}`);
      
      setMessage("Responsável removido com sucesso!");
      setMessageType("success");
      carregarDados();
      onSuccess();
    } catch (error) {
      setMessage(error.response?.data?.error || "Erro ao remover responsável");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ NOVO: Filtrar usuários que ainda não são responsáveis (baseado em usuarioId)
  const usuariosDisponiveis = usuarios.filter(usuario => 
    !responsaveis.some(resp => resp.usuarioId === usuario.id)
  );

  // ✅ NOVO: Filtrar usuários baseado no termo de pesquisa
  const usuariosFiltrados = usuariosDisponiveis.filter(usuario => {
    if (!searchTerm.trim()) return false; // Só mostrar quando digitar algo
    
    const searchLower = searchTerm.toLowerCase();
    return (
      usuario.nome.toLowerCase().includes(searchLower) ||
      usuario.email.toLowerCase().includes(searchLower) ||
      (usuario.departamentoNome && usuario.departamentoNome.toLowerCase().includes(searchLower))
    );
  });

  if (!isOpen) return null;

  return (
    <div className={`${styles.overlay} ${isLight ? styles.overlayLight : ''}`}>
      <div className={`${styles.box} ${!isLight ? styles.boxDark : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>
              Múltiplos Responsáveis
            </h2>
            <p className={styles.subtitle}>
              {obrigacaoNome} - {clienteNome}
            </p>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            ×
          </button>
        </div>

        {/* Mensagem */}
        {message && (
          <div className={`${styles.alert} ${messageType === 'success' ? styles.alertSuccess : styles.alertError}`}>
            {message}
          </div>
        )}

        {/* Adicionar Responsável */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Adicionar Responsável
          </h3>
          
          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label className={styles.label}>
                Selecionar Usuário
              </label>
              <input
                type="text"
                placeholder="Digite para pesquisar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.input}
                disabled={loading}
              />
              {searchTerm && (
                <div className={styles.dropdown}>
                  {usuariosFiltrados.map(usuario => (
                    <div
                      key={usuario.id}
                      onClick={() => {
                        setSelectedUsuarioId(usuario.id);
                        setSearchTerm(`${usuario.nome} (${usuario.email})${usuario.departamentoNome ? ` - ${usuario.departamentoNome}` : ""}`);
                        // Fechar o dropdown após seleção
                      setTimeout(() => {
                          const input = document.querySelector('input[type="text"]');
                          if (input && input.blur) input.blur();
                        }, 100);
                      }}
                      onMouseDown={(e) => {
                        // Prevenir comportamento padrão para evitar problemas de foco
                        e.preventDefault();
                      }}
                      className={styles.dropdownItem}
                    >
                      {usuario.nome} ({usuario.email}){usuario.departamentoNome ? ` - ${usuario.departamentoNome}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={adicionarResponsavel}
              disabled={!selectedUsuarioId || loading}
              className={styles.addBtn}
            >
              <Plus size={16} />
              {loading ? "Adicionando..." : "Adicionar"}
            </button>
          </div>
        </div>

        {/* Lista de Responsáveis */}
        <div>
          <h3 className={styles.listTitle}>
            Responsáveis Atuais ({responsaveis.length})
          </h3>
          
          {loading ? (
            <div className={styles.emptyState}>
              <div className={styles.spinner} />
              Carregando...
            </div>
          ) : responsaveis.length === 0 ? (
            <div className={styles.emptyState}>
              <User size={48} className={styles.emptyIcon} />
              <p style={{ margin: 0 }}>
                Nenhum responsável vinculado
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, opacity: 0.7 }}>
                Adicione responsáveis usando o formulário acima
              </p>
            </div>
          ) : (
            <div className={styles.list}>
              {responsaveis.map((responsavel) => (
                <div
                  key={responsavel.id}
                  className={styles.item}
                >
                  <div>
                    <div className={styles.itemName}>
                      {responsavel.nome}
                    </div>
                    <div className={styles.itemSub}>
                      {responsavel.email}
                      {responsavel.departamentoNome && ` • ${responsavel.departamentoNome}`}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => removerResponsavel(responsavel.usuarioId)}
                    disabled={loading}
                    className={styles.removeBtn}
                    title="Remover responsável"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button onClick={onClose} className={styles.footerCloseBtn}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
} 