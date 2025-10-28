"use client";

import { useState } from "react";
import { Loader2} from "lucide-react";
import { toast } from "react-toastify";
import styles from "../../styles/financeiro/NovoProdutoServicoDrawer.module.css";

export default function NovoProdutoServicoDrawer({
  isOpen,
  onClose,
  onSuccess,
}) {
  const [formData, setFormData] = useState({
    nome: "",
    tipo: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const API = process.env.NEXT_PUBLIC_API_URL;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpar erro do campo quando o usuário começar a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.nome.trim()) {
      newErrors.nome = "Nome é obrigatório";
    }

    if (!formData.tipo) {
      newErrors.tipo = "Tipo é obrigatório";
    }

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      toast.warning("Preencha todos os campos obrigatórios!");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    // Buscar empresaId do userData (prioridade) ou do localStorage direto
    const userData = localStorage.getItem("userData");
    const token = localStorage.getItem("token");

    let empresaId;
    if (userData) {
      const parsedUserData = JSON.parse(userData);
      empresaId = parsedUserData.EmpresaId || parsedUserData.empresa?.id;
    }
    
    // Fallback para localStorage direto
    if (!empresaId) {
      empresaId = localStorage.getItem("empresaId");
    }

    if (!empresaId || !token || !API) {
      console.error("EmpresaId ou Token não encontrados");
      toast.error("Empresa ou token não encontrados. Faça login novamente.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API}/financeiro/produtos-servicos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: formData.nome.trim(),
          tipo: formData.tipo,
          empresa_id: parseInt(empresaId),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao criar produto/serviço");
      }

      const result = await response.json();
      
      // Limpar formulário
      setFormData({
        nome: "",
        tipo: "",
      });
      setErrors({});

      // Fechar modal e notificar sucesso
      onClose();
      onSuccess();

      console.log("Produto/Serviço criado com sucesso:", result);
      toast.success("Produto/Serviço criado com sucesso!");
    } catch (error) {
      console.error("Erro ao criar produto/serviço:", error);
      toast.error("Erro ao criar produto/serviço. Verifique os campos.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        nome: "",
        tipo: "",
      });
      setErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.dialogOverlay} onClick={handleClose}>
      <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>
                Novo Produto/Serviço
              </h2>
              <p className={styles.dialogDescription}>
                Adicione um novo produto ou serviço ao sistema
              </p>
            <button
              type="button"
              onClick={handleClose}
              className={styles.closeButton}
              disabled={isLoading}
            >
            </button>
        </div>

        <div className={styles.formContent}>
          {/* Campo Nome */}
          <div className={styles.fieldContainer}>
            <label className={styles.fieldLabel}>
              Nome <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => handleInputChange("nome", e.target.value)}
              placeholder="Digite o nome do produto/serviço"
              className={`${styles.fieldInput} ${errors.nome ? styles.error : ''}`}
              disabled={isLoading}
            />
            {errors.nome && (
              <p className={styles.errorMessage}>{errors.nome}</p>
            )}
          </div>

          {/* Campo Tipo */}
          <div className={styles.fieldContainer}>
            <label className={styles.fieldLabel}>
              Tipo <span className={styles.required}>*</span>
            </label>
            <select
              value={formData.tipo}
              onChange={(e) => handleInputChange("tipo", e.target.value)}
              className={`${styles.fieldSelect} ${errors.tipo ? styles.error : ''}`}
              disabled={isLoading}
            >
              <option value="">Selecione o tipo</option>
              <option value="produto">Produto</option>
              <option value="serviço">Serviço</option>
            </select>
            {errors.tipo && (
              <p className={styles.errorMessage}>{errors.tipo}</p>
            )}
          </div>
        </div>

        <div className={styles.dialogFooter}>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className={`${styles.button} ${styles.cancelButton}`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className={`${styles.button} ${styles.createButton}`}
          >
            {isLoading ? (
              <>
                <Loader2 className={`h-4 w-4 ${styles.loadingSpinner}`} />
                Criando...
              </>
            ) : (
              <>
                Criar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 