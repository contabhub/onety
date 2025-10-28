"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import styles from "../../styles/financeiro/novo-departamento-drawer.module.css";

// Utility para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');

export default function NovoDepartamentoDrawer({
  isOpen,
  onClose,
  onSuccess,
}) {
  const [formData, setFormData] = useState({
    nome: "",
    codigo: "",
    descricao: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  
  const drawerRef = useRef(null);

  // Handlers para drawer
  const handleClickOutside = useCallback((event) => {
    if (drawerRef.current && !drawerRef.current.contains(event.target)) {
      handleClose();
    }
  }, []);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      handleClose();
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClickOutside, handleKeyDown]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error("Nome do departamento é obrigatório");
      return;
    }

    setIsSaving(true);
    try {
      const empresaId = localStorage.getItem("empresaId");
      const token = localStorage.getItem("token");
      
      if (!empresaId || !token) {
        throw new Error("Dados de autenticação não encontrados");
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/departamentos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: formData.nome.trim(),
          codigo: formData.codigo.trim() || null,
          descricao: formData.descricao.trim() || null,
          company_id: parseInt(empresaId),
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao criar departamento");
      }

      toast.success("Departamento criado com sucesso!");
      onSuccess();
      onClose();
      
      // Limpar formulário
      setFormData({
        nome: "",
        codigo: "",
        descricao: "",
      });
    } catch (error) {
      console.error("Erro ao criar departamento:", error);
      toast.error("Erro ao criar departamento");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      setFormData({
        nome: "",
        codigo: "",
        descricao: "",
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.drawerOverlay} onClick={handleClickOutside}>
      <div className={styles.drawerContent} ref={drawerRef}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerHeaderInner}>
            <div>
              <h2 className={styles.drawerTitleComponent}>
                Novo Departamento
              </h2>
              <p className={styles.drawerDescriptionComponent}>
                Adicione um novo departamento para organizar seus produtos/serviços
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className={cn(styles.buttonComponent, styles.buttonComponentGhost, styles.buttonComponentSmall, styles.buttonClose)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={cn(styles.drawerBody, styles.formContainer)}>
          <div className={styles.fieldContainer}>
            {/* Nome do departamento */}
            <div className={styles.fieldGroup}>
              <label className={styles.labelComponent}>
                Nome do departamento <span className={styles.requiredMark}>*</span>
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => handleInputChange('nome', e.target.value)}
                placeholder="Ex: Vendas, Marketing, TI"
                className={styles.inputComponent}
              />
            </div>

            {/* Código do departamento */}
            <div className={styles.fieldGroup}>
              <label className={styles.labelComponent}>
                Código do departamento
              </label>
              <input
                type="text"
                value={formData.codigo}
                onChange={(e) => handleInputChange('codigo', e.target.value)}
                placeholder="Ex: VND, MKT, TI"
                className={styles.inputComponent}
              />
              <p className={styles.fieldHint}>
                Código opcional para identificação rápida do departamento
              </p>
            </div>

            {/* Descrição */}
            <div className={styles.fieldGroup}>
              <label className={styles.labelComponent}>
                Descrição
              </label>
              <textarea
                value={formData.descricao}
                onChange={(e) => handleInputChange('descricao', e.target.value)}
                placeholder="Descreva as responsabilidades e atividades do departamento..."
                rows={3}
                className={styles.textareaComponent}
              />
            </div>
          </div>
        </div>

        <div className={styles.drawerFooter}>
          <div className={styles.footerActions}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.buttonFlex1)}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !formData.nome.trim()}
              className={cn(styles.buttonComponent, styles.buttonComponentPrimary, styles.buttonFlex1)}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
