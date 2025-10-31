import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from "../../styles/gestao/NovoGrupoClienteModal.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function NovoGrupoClienteModal({ isOpen, onClose, onCreated, grupo }) {
  const [nome, setNome] = useState((grupo && grupo.nome) || "");
  const [empresaId, setEmpresaId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNome((grupo && grupo.nome) || "");
  }, [grupo]);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
    const parsed = raw ? JSON.parse(raw) : null;
    const id = parsed?.EmpresaId ? String(parsed.EmpresaId) : sessionStorage.getItem("empresaId") || "";
    if (id) setEmpresaId(id);
  }, []);

  // Detecta tema atual e reage a mudanças do tema global
  // Sem dependência de tema: usamos variáveis de globals.css

  const handleConfirmar = async () => {
    if (!nome.trim()) {
      toast.error("Preencha o nome do grupo!");
      return;
    }
    setLoading(true);
    try {
      const token = typeof window !== "undefined"
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "")
        : "";
      const url = grupo
        ? `${BASE_URL}/gestao/clientes/grupos/${grupo.id}`
        : `${BASE_URL}/gestao/clientes/grupos`;
      const method = grupo ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nome, empresaId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(grupo ? "✅ Grupo editado com sucesso!" : "✅ Grupo cadastrado com sucesso!");
      setNome("");
      if (typeof onCreated === "function") onCreated();
      onClose();
    } catch (error) {
      toast.error("Erro ao salvar grupo.");
    } finally {
      setLoading(false);
    }
  };
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.modalTitle}>{grupo ? "Editar Grupo" : "Novo Grupo"}</h2>
        <div className={styles.formGroup}>
          <label className={styles.label}>Nome *</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={styles.inputField}
            placeholder="Digite o nome do grupo"
            autoFocus
          />
        </div>
        <div className={styles.modalActions}>
          <button onClick={onClose} className={styles.btnCancel} disabled={loading}>
            Cancelar
          </button>
          <button onClick={handleConfirmar} className={styles.btnPrimary} disabled={loading}>
            {loading ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
