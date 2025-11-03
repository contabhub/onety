"use client";

import React from "react";

export default function CriacaoProgressoModal({ isOpen, total, criadas, onClose, onConcluir, onAbrirTarefa }) {
  if (!isOpen) return null;

  const concluido = criadas.length >= total && total > 0;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2000,
      backdropFilter: "blur(3px)",
      WebkitBackdropFilter: "blur(3px)",
    }}>
      <div style={{
        background: "rgba(11, 11, 17, 0.55)",
        color: "var(--titan-text-high)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        overflow: "hidden",
        width: "92%",
        maxWidth: 560,
        maxHeight: "90vh",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>Nova Solicitação</div>
          {/* Sem botão de fechar */}
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          <div style={{ textAlign: "center", fontSize: 20, fontWeight: 600, margin: "6px 0 12px" }}>
            Tarefas geradas: {criadas.length} de {total}
          </div>

          {/* Lista */}
          <div style={{ maxHeight: "40vh", overflowY: "auto", paddingRight: 4 }}>
            {criadas.map((t) => (
              <div key={t.id} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 12,
                margin: "10px 0",
                borderRadius: 10,
                background: "var(--titan-info-bg, rgba(46,134,222,0.10))",
                boxShadow: "0 6px 14px rgba(0,0,0,0.16)",
                border: "1px solid var(--titan-info-border, rgba(46,134,222,0.28))",
              }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--titan-text-high)" }}>{t.titulo || `Tarefa ${t.id}`}</div>
                <button
                  title="Abrir Tarefa"
                  onClick={() => onAbrirTarefa(t.id)}
                  style={{
                    border: "none",
                    background: "rgba(255,255,255,0.9)",
                    color: "var(--titan-info-text, #2e86de)",
                    padding: "8px 10px",
                    borderRadius: 10,
                    boxShadow: "0 6px 16px rgba(0,0,0,0.16)",
                    cursor: "pointer",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <path d="M16 2v4M8 2v4M3 10h18"/>
                    <polyline points="9,15 11,17 15,13" />
                  </svg>
                </button>
              </div>
            ))}

            {/* Loading placeholder enquanto cria */}
            {criadas.length < total && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                margin: "12px 0",
                borderRadius: 10,
                background: "rgba(255,255,255,0.08)",
                border: "1px dashed rgba(255,255,255,0.25)",
                gap: 12,
                color: "var(--titan-text-med)",
                fontSize: 14,
              }}>
                <span className="spinner" style={{
                  width: 20,
                  height: 20,
                  border: "3px solid rgba(255,255,255,0.25)",
                  borderTopColor: "var(--titan-primary)",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 1s linear infinite",
                }} />
                Gerando tarefas...
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: 20, borderTop: "1px solid var(--titan-stroke)" }}>
          {/* Sem botão Fechar; apenas Concluir quando finalizar */}
          <button disabled={!concluido} onClick={onConcluir} style={{
            padding: "10px 18px",
            background: concluido ? "var(--titan-success)" : "var(--titan-stroke)",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: concluido ? "pointer" : "not-allowed",
          }}>Concluir</button>
        </div>
      </div>

      {/* pequena keyframes inline */}
      <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
    </div>
  );
}


