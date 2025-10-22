"use client";

import { useState } from "react";
import { Button } from "./botao";
import { Input } from "./input";
import { Label } from "./label";
import { Textarea } from "./textarea";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "./drawer";
import { X, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

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

  return (
    <Drawer open={isOpen} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[85vh] flex flex-col bg-darkPurple border-neonPurple">
        <DrawerHeader className="border-b border-neonPurple bg-darkPurple">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-xl font-semibold text-textMain">
                Novo Departamento
              </DrawerTitle>
              <DrawerDescription className="text-textSecondary">
                Adicione um novo departamento para organizar seus produtos/serviços
              </DrawerDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={isSaving}
              className="h-8 w-8 p-0 text-textMain hover:text-textSecondary"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="flex-1 p-6 space-y-6 overflow-y-auto min-h-0 bg-darkPurple">
          <div className="space-y-4">
            {/* Nome do departamento */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-textMain">
                Nome do departamento <span className="text-hotPink">*</span>
              </Label>
              <Input
                value={formData.nome}
                onChange={(e) => handleInputChange('nome', e.target.value)}
                placeholder="Ex: Vendas, Marketing, TI"
                className="bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
              />
            </div>

            {/* Código do departamento */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-textMain">
                Código do departamento
              </Label>
              <Input
                value={formData.codigo}
                onChange={(e) => handleInputChange('codigo', e.target.value)}
                placeholder="Ex: VND, MKT, TI"
                className="bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
              />
              <p className="text-xs text-textSecondary">
                Código opcional para identificação rápida do departamento
              </p>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-textMain">
                Descrição
              </Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => handleInputChange('descricao', e.target.value)}
                placeholder="Descreva as responsabilidades e atividades do departamento..."
                rows={3}
                className="bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
              />
            </div>
          </div>
        </div>

        <DrawerFooter className="border-t border-neonPurple bg-darkPurple sticky bottom-0">
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleClose}
              disabled={isSaving}
              className="flex-1 border-neonPurple bg-darkPurple text-textMain hover:bg-neonPurple hover:text-textMain"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || !formData.nome.trim()}
              className="flex-1 bg-primary hover:bg-primary/80 text-textMain"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
