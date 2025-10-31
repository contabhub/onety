import React, { useState, useMemo } from 'react';

const CompetenciaSelecaoModal = ({
  isOpen,
  onClose,
  clientes,
  selecionados,
  onToggle,
  onConfirmar,
}) => {
  // ✅ HOOKS SEMPRE NO TOPO
  const [busca, setBusca] = useState('');

  // Normalização de props para evitar undefined durante o render
  const safeClientes = Array.isArray(clientes) ? clientes : [];
  const safeSelecionados = Array.isArray(selecionados) ? selecionados : [];

  const todosSelecionados = useMemo(
    () => safeClientes.length > 0 && safeClientes.every((c) => safeSelecionados.includes(c.id)),
    [safeClientes, safeSelecionados]
  );

  const clientesFiltrados = useMemo(() => {
    return safeClientes.filter((c) =>
      `${c.nome} ${c.cnpjCpf}`.toLowerCase().includes(busca.toLowerCase())
    );
  }, [busca, safeClientes]);

  const toggleTodos = () => {
    if (todosSelecionados) {
      clientesFiltrados.forEach((c) => {
        if (safeSelecionados.includes(c.id)) onToggle(c.id);
      });
    } else {
      clientesFiltrados.forEach((c) => {
        if (!safeSelecionados.includes(c.id)) onToggle(c.id);
      });
    }
  };

  // ✅ SOMENTE AGORA VERIFICAMOS SE O MODAL DEVE SER RENDERIZADO
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          background: "var(--onity-color-surface)",
          borderRadius: "var(--onity-radius-l)",
          maxWidth: "700px",
          width: "90%",
          padding: "var(--onity-space-l)",
          boxShadow: "var(--onity-elev-high)",
          maxHeight: "90vh",
          overflowY: "auto",
          border: "1px solid var(--onity-color-border)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--onity-space-l)"
        }}>
          <h2 style={{
            margin: 0,
            fontSize: "var(--onity-type-h3-size)",
            fontWeight: "var(--onity-type-h3-weight)",
            color: "var(--onity-color-text)"
          }}>
            Selecionar Clientes para Consulta
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "var(--onity-icon-secondary)",
              padding: "4px",
              borderRadius: "var(--onity-radius-xs)",
              transition: "all 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--onity-color-bg)";
              e.currentTarget.style.color = "var(--onity-color-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
              e.currentTarget.style.color = "var(--onity-icon-secondary)";
            }}
          >
            ×
          </button>
        </div>

        {/* Campo de Busca */}
        <div style={{ marginBottom: "var(--onity-space-l)" }}>
          <input
            type="text"
            placeholder="Buscar por nome ou CNPJ..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              width: "100%",
              padding: "var(--onity-space-s)",
              border: "2px solid var(--onity-color-border)",
              borderRadius: "var(--onity-radius-xs)",
              background: "var(--onity-color-surface)",
              color: "var(--onity-color-text)",
              fontSize: "var(--onity-type-body-size)",
              fontFamily: "var(--onity-font-family-sans)",
              outline: "none",
              transition: "all 120ms ease",
            }}
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

        {/* Ações Superiores */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--onity-space-m)"
        }}>
          <div style={{
            fontSize: "var(--onity-type-body-size)",
            color: "var(--onity-icon-secondary)",
            opacity: 0.8
          }}>
            {safeSelecionados.length} de {safeClientes.length} cliente(s) selecionado(s)
          </div>
          <button
            onClick={toggleTodos}
            style={{
              background: "var(--onity-color-surface)",
              border: "1px solid var(--onity-color-border)",
              color: "var(--onity-color-text)",
              padding: "var(--onity-space-xs) var(--onity-space-s)",
              borderRadius: "var(--onity-radius-xs)",
              fontSize: "var(--onity-type-body-size)",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--onity-color-bg)";
              e.currentTarget.style.borderColor = "var(--onity-color-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--onity-color-surface)";
              e.currentTarget.style.borderColor = "var(--onity-color-border)";
            }}
          >
            {todosSelecionados ? 'Desmarcar Todos' : 'Selecionar Todos'}
          </button>
        </div>

        {/* Lista de Clientes */}
          <div style={{
            maxHeight: "400px",
            overflowY: "auto",
            marginBottom: "var(--onity-space-l)",
            background: "var(--onity-color-bg)",
            borderRadius: "var(--onity-radius-m)",
            padding: "var(--onity-space-m)",
            border: "1px solid var(--onity-color-border)"
          }}>
          {clientesFiltrados.length === 0 ? (
            <div style={{
              textAlign: "center",
              color: "var(--onity-icon-secondary)",
              fontSize: "var(--onity-type-body-size)",
              padding: "var(--onity-space-l)",
              opacity: 0.8
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: "var(--onity-space-s)" }}>
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              Nenhum cliente encontrado.
            </div>
          ) : (
            clientesFiltrados.map((c) => (
              <label
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "var(--onity-space-s)",
                  marginBottom: "var(--onity-space-xs)",
                  borderRadius: "var(--onity-radius-xs)",
                  cursor: "pointer",
                  transition: "all 120ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--onity-color-bg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <input
                  type="checkbox"
                  checked={safeSelecionados.includes(c.id)}
                  onChange={() => onToggle(c.id)}
                  style={{
                    marginRight: "var(--onity-space-s)",
                    accentColor: "var(--onity-color-primary)",
                    transform: "scale(1.1)",
                  }}
                />
                <div>
                  <div style={{
                    fontSize: "var(--onity-type-body-size)",
                    fontWeight: 500,
                    color: "var(--onity-color-text)",
                    marginBottom: "2px"
                  }}>
                    {c.nome}
                  </div>
                  <div style={{
                    fontSize: "var(--onity-type-caption-size)",
                    color: "var(--onity-icon-secondary)",
                    opacity: 0.8
                  }}>
                    {c.cnpjCpf}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

        {/* Botões */}
        <div style={{
          display: "flex",
          gap: "var(--onity-space-s)",
          justifyContent: "flex-end"
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "var(--onity-space-s) var(--onity-space-m)",
              background: "transparent",
              color: "var(--onity-color-text)",
              border: "1px solid var(--onity-color-border)",
              borderRadius: "var(--onity-radius-xs)",
              fontSize: "var(--onity-type-body-size)",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 120ms ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--onity-color-bg)";
              e.currentTarget.style.borderColor = "var(--onity-color-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "var(--onity-color-border)";
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={safeSelecionados.length === 0}
            style={{
              padding: "var(--onity-space-s) var(--onity-space-m)",
              background: safeSelecionados.length === 0 ? "var(--onity-color-border)" : "var(--onity-color-primary)",
              color: "var(--onity-color-primary-contrast)",
              border: "none",
              borderRadius: "var(--onity-radius-xs)",
              fontSize: "var(--onity-type-body-size)",
              fontWeight: 500,
              cursor: safeSelecionados.length === 0 ? "not-allowed" : "pointer",
              transition: "all 120ms ease",
              opacity: safeSelecionados.length === 0 ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (safeSelecionados.length > 0) {
                e.currentTarget.style.background = "var(--onity-color-primary-hover)";
                e.currentTarget.style.transform = "scale(1.02)";
              }
            }}
            onMouseLeave={(e) => {
              if (safeSelecionados.length > 0) {
                e.currentTarget.style.background = "var(--onity-color-primary)";
                e.currentTarget.style.transform = "scale(1)";
              }
            }}
          >
            Consultar ({safeSelecionados.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompetenciaSelecaoModal;
