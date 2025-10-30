import React, { useState, useEffect } from "react";
// Cliente HTTP local (igual ao usado em pages/gestao/clientes.js)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const api = {
  get: async (url, config = {}) => {
    const params = config.params ? `?${new URLSearchParams(config.params).toString()}` : "";
    const res = await fetch(`${API_BASE}${url}${params}`, {
      method: "GET",
      headers: config.headers || {}
    });
    if (config.responseType === "blob") {
      return { data: await res.blob(), headers: { 'content-type': res.headers.get('content-type') || '' } };
    }
    return { data: await res.json() };
  },
  post: async (url, body, config = {}) => {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = config.headers || {};
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
      headers: config.headers || {}
    });
    return { data: await res.json() };
  }
};
import { X, Plus, Trash2, User } from "lucide-react";

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
        api.get(`/api/obrigacoes/${obrigacaoId}/clientes/${clienteId}/responsaveis`),
        api.get("/api/usuarios")
      ]);
      
      // ✅ NOVO: Remover duplicatas dos responsáveis baseado em usuarioId
      const responsaveisUnicos = responsaveisRes.data.filter((resp, index, array) => {
        return array.findIndex(r => r.usuarioId === resp.usuarioId) === index;
      });
      
      setResponsaveis(responsaveisUnicos);
      setUsuarios(usuariosRes.data);
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
      await api.post(`/api/obrigacoes/${obrigacaoId}/clientes/${clienteId}/responsaveis`, {
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
      await api.delete(`/api/obrigacoes/${obrigacaoId}/clientes/${clienteId}/responsaveis/${responsavelId}`);
      
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
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: isLight ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.5)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: isLight ? "rgba(255,255,255,0.98)" : "rgba(11, 11, 17, 0.6)",
        borderRadius: "var(--titan-radius-lg)",
        maxWidth: "600px",
        width: "90%",
        padding: "var(--titan-spacing-lg)",
        boxShadow: "var(--titan-shadow-lg)",
        maxHeight: "90vh",
        overflowY: "auto",
        border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255, 255, 255, 0.1)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--titan-spacing-lg)"
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: "var(--titan-font-size-xl)",
              fontWeight: "var(--titan-font-weight-semibold)",
              color: "var(--titan-text-high)"
            }}>
              Múltiplos Responsáveis
            </h2>
            <p style={{
              margin: "4px 0 0 0",
              fontSize: "var(--titan-font-size-sm)",
              color: "var(--titan-text-med)"
            }}>
              {obrigacaoNome} - {clienteNome}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "var(--titan-text-med)",
              padding: "4px",
              borderRadius: "var(--titan-radius-sm)",
              transition: "all var(--titan-transition-fast)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--titan-input-bg)";
              e.currentTarget.style.color = "var(--titan-text-high)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
              e.currentTarget.style.color = "var(--titan-text-med)";
            }}
          >
            ×
          </button>
        </div>

        {/* Mensagem */}
        {message && (
          <div style={{
            padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
            borderRadius: "var(--titan-radius-sm)",
            marginBottom: "var(--titan-spacing-lg)",
            background: messageType === "success" ? "var(--titan-success)" : "var(--titan-error)",
            color: "white",
            border: `1px solid ${messageType === "success" ? "var(--titan-success)" : "var(--titan-error)"}`,
            fontSize: "var(--titan-font-size-sm)",
            fontWeight: "var(--titan-font-weight-medium)"
          }}>
            {message}
          </div>
        )}

        {/* Adicionar Responsável */}
        <div style={{
          background: isLight ? "rgba(0,0,0,0.02)" : "var(--titan-base-10)",
          padding: "var(--titan-spacing-lg)",
          borderRadius: "var(--titan-radius-md)",
          marginBottom: "var(--titan-spacing-xl)",
          border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid var(--titan-stroke)"
        }}>
          <h3 style={{
            margin: "0 0 var(--titan-spacing-md) 0",
            fontSize: "var(--titan-font-size-base)",
            fontWeight: "var(--titan-font-weight-semibold)",
            color: "var(--titan-text-high)"
          }}>
            Adicionar Responsável
          </h3>
          
          <div style={{
            display: "flex",
            gap: "var(--titan-spacing-md)",
            alignItems: "flex-end",
            justifyContent: "space-between"
          }}>
            <div style={{ flex: 0.95, position: "relative" }}>
              <label style={{
                display: "block",
                marginBottom: "var(--titan-spacing-xs)",
                fontSize: "var(--titan-font-size-sm)",
                fontWeight: "var(--titan-font-weight-medium)",
                color: "var(--titan-text-high)"
              }}>
                Selecionar Usuário
              </label>
              <input
                type="text"
                placeholder="Digite para pesquisar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                  border: "1px solid var(--titan-stroke)",
                  borderRadius: "var(--titan-radius-sm)",
                  fontSize: "var(--titan-font-size-sm)",
                  backgroundColor: "var(--titan-input-bg)",
                  color: "var(--titan-text-high)",
                  outline: "none",
                  transition: "border-color var(--titan-transition-fast)"
                }}
                disabled={loading}
              />
              {searchTerm && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: isLight ? "#fff" : "var(--titan-base-00)", // ✅ NOVO: Fundo sólido branco
                  border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid var(--titan-stroke)",
                  borderRadius: "var(--titan-radius-sm)",
                  maxHeight: "200px",
                  overflow: "auto",
                  zIndex: 10,
                  boxShadow: "var(--titan-shadow-lg)",
                  backdropFilter: "none" // ✅ NOVO: Remover transparência
                }}>
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
                      style={{
                        padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                        cursor: "pointer",
                        borderBottom: "1px solid var(--titan-stroke)",
                        fontSize: "var(--titan-font-size-sm)",
                        color: "var(--titan-text-high)",
                        transition: "background-color var(--titan-transition-fast)",
                        background: isLight ? "#fff" : "var(--titan-base-00)" // ✅ NOVO: Fundo sólido
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isLight ? "rgba(0,0,0,0.04)" : "var(--titan-base-10)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = isLight ? "#fff" : "var(--titan-base-00)"} // ✅ NOVO: Voltar ao fundo sólido
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
              style={{
                padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                background: selectedUsuarioId && !loading ? "var(--titan-success)" : "var(--titan-text-low)",
                color: "white",
                border: "none",
                borderRadius: "var(--titan-radius-sm)",
                fontSize: "var(--titan-font-size-sm)",
                fontWeight: "var(--titan-font-weight-medium)",
                cursor: selectedUsuarioId && !loading ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: "var(--titan-spacing-sm)",
                transition: "all var(--titan-transition-fast)",
                opacity: selectedUsuarioId && !loading ? 1 : 0.7
              }}
              onMouseEnter={(e) => {
                if (selectedUsuarioId && !loading) {
                  e.currentTarget.style.transform = "scale(1.02)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <Plus size={16} />
              {loading ? "Adicionando..." : "Adicionar"}
            </button>
          </div>
        </div>

        {/* Lista de Responsáveis */}
        <div>
          <h3 style={{
            margin: "0 0 var(--titan-spacing-md) 0",
            fontSize: "var(--titan-font-size-base)",
            fontWeight: "var(--titan-font-weight-semibold)",
            color: "var(--titan-text-high)"
          }}>
            Responsáveis Atuais ({responsaveis.length})
          </h3>
          
          {loading ? (
            <div style={{
              textAlign: "center",
              padding: "var(--titan-spacing-xl)",
              color: "var(--titan-text-med)"
            }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                border: "2px solid var(--titan-primary)",
                borderTop: "2px solid transparent",
                animation: "spin 1s linear infinite",
                margin: "0 auto var(--titan-spacing-md)"
              }} />
              Carregando...
            </div>
          ) : responsaveis.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "var(--titan-spacing-xl)",
              color: "var(--titan-text-low)",
              background: isLight ? "rgba(0,0,0,0.02)" : "var(--titan-base-10)",
              borderRadius: "var(--titan-radius-md)",
              border: isLight ? "1px dashed rgba(0,0,0,0.08)" : "1px dashed var(--titan-stroke)"
            }}>
              <User size={48} style={{ marginBottom: "var(--titan-spacing-md)", opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: "var(--titan-font-size-sm)" }}>
                Nenhum responsável vinculado
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "var(--titan-font-size-xs)", opacity: 0.7 }}>
                Adicione responsáveis usando o formulário acima
              </p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gap: "var(--titan-spacing-sm)"
            }}>
              {responsaveis.map((responsavel) => (
                <div
                  key={responsavel.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "var(--titan-spacing-md) var(--titan-spacing-lg)",
                    background: isLight ? "#fff" : "var(--titan-card-bg)",
                    border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid var(--titan-stroke)",
                    borderRadius: "var(--titan-radius-md)",
                    transition: "all var(--titan-transition-fast)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isLight ? "rgba(0,0,0,0.04)" : "var(--titan-base-10)";
                    e.currentTarget.style.borderColor = "var(--titan-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isLight ? "#fff" : "var(--titan-card-bg)";
                    e.currentTarget.style.borderColor = isLight ? "rgba(0,0,0,0.08)" : "var(--titan-stroke)";
                  }}
                >
                  <div>
                    <div style={{
                      fontWeight: "var(--titan-font-weight-medium)",
                      color: "var(--titan-text-high)",
                      fontSize: "var(--titan-font-size-sm)"
                    }}>
                      {responsavel.nome}
                    </div>
                    <div style={{
                      fontSize: "var(--titan-font-size-xs)",
                      color: "var(--titan-text-med)"
                    }}>
                      {responsavel.email}
                      {responsavel.departamentoNome && ` • ${responsavel.departamentoNome}`}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => removerResponsavel(responsavel.usuarioId)}
                    disabled={loading}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--titan-error)",
                      cursor: loading ? "not-allowed" : "pointer",
                      padding: "var(--titan-spacing-xs)",
                      borderRadius: "var(--titan-radius-sm)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all var(--titan-transition-fast)"
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.background = "var(--titan-error)";
                        e.currentTarget.style.color = "white";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "none";
                      e.currentTarget.style.color = "var(--titan-error)";
                    }}
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
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "var(--titan-spacing-xl)",
          paddingTop: "var(--titan-spacing-lg)",
          borderTop: "1px solid var(--titan-stroke)"
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
              background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255, 255, 255, 0.15)",
              color: "var(--titan-text-high)",
              border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "var(--titan-radius-sm)",
              fontSize: "var(--titan-font-size-sm)",
              fontWeight: "var(--titan-font-weight-medium)",
              cursor: "pointer",
              transition: "all var(--titan-transition-fast)"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isLight ? "rgba(0,0,0,0.08)" : "var(--titan-input-bg)";
              e.currentTarget.style.borderColor = "var(--titan-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isLight ? "rgba(0,0,0,0.04)" : "rgba(255, 255, 255, 0.15)";
              e.currentTarget.style.borderColor = isLight ? "rgba(0,0,0,0.08)" : "rgba(255, 255, 255, 0.2)";
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
} 