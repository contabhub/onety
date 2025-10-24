"use client";

import { useState } from "react";
import { Button } from "../../components/financeiro/botao";
import { Input } from "../../components/financeiro/input";
import { Label } from "../../components/financeiro/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/financeiro/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/financeiro/select";
import { Loader2, Plus, X } from "lucide-react";
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className={styles.dialogTitle}>
              Novo Produto/Serviço
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className={styles.closeButton}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </div>
          <DialogDescription className={styles.dialogDescription}>
            Adicione um novo produto ou serviço ao sistema
          </DialogDescription>
        </DialogHeader>

        <div className={styles.formContent}>
          {/* Campo Nome */}
          <div className={styles.fieldContainer}>
            <Label className={styles.fieldLabel}>
              Nome <span className={styles.required}>*</span>
            </Label>
            <Input
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
            <Label className={styles.fieldLabel}>
              Tipo <span className={styles.required}>*</span>
            </Label>
            <Select
              value={formData.tipo}
              onValueChange={(value) => handleInputChange("tipo", value)}
              disabled={isLoading}
            >
              <SelectTrigger 
                className={`${styles.fieldSelect} ${errors.tipo ? styles.error : ''}`}
              >
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className={styles.selectContent}>
                <SelectItem 
                  value="produto" 
                  className={styles.selectItem}
                >
                  Produto
                </SelectItem>
                <SelectItem 
                  value="serviço" 
                  className={styles.selectItem}
                >
                  Serviço
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.tipo && (
              <p className={styles.errorMessage}>{errors.tipo}</p>
            )}
          </div>
        </div>

        <DialogFooter className={styles.dialogFooter}>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className={`${styles.button} ${styles.cancelButton}`}
          >
            Cancelar
          </Button>
          <Button
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
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 