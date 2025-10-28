// Componente atualizado para permitir edição completa de clientes

"use client";

import { useEffect, useState } from "react";
import { Button } from "./botao";
import { Input } from "./input";
import { Label } from "./label";
import { Textarea } from "./textarea";
import { X, Plus, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Checkbox } from "./checkbox";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";
import { formatarDataParaMysql } from "../../utils/financeiro/dateUtils";
import styles from "../../styles/financeiro/EditarCliente.module.css";

// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

export function EditarClienteDrawer({
  isOpen,
  onClose,
  cliente,
  onSave,
}) {
  const [formData, setFormData] = useState(cliente || {});
  const [openAccordions, setOpenAccordions] = useState([
    "dados-gerais",
  ]);

  useEffect(() => {
    setFormData(cliente || {});
  }, [cliente]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Token de autenticação não encontrado.");
      return;
    }

    const dataParaSalvar = {
      ...formData,
      abertura_empresa: formData.abertura_empresa ? formatarDataParaMysql(formData.abertura_empresa) : undefined,
    };

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/clientes/${formData.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dataParaSalvar),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erro ao atualizar cliente:", errorData);
        toast.error(`Erro ao salvar: ${errorData.message || "Erro desconhecido"}`);
        return;
      }

      toast.success("Cliente atualizado com sucesso!");
      onSave && onSave();
      onClose();
    } catch (error) {
      console.error("Erro inesperado:", error);
      toast.error(`Erro ao salvar: ${error.message || "Erro desconhecido"}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.editarClienteOverlay}>
      <div className={styles.editarClienteContainer}>
        <div className={styles.editarClienteHeader}>
          <h2 className={styles.editarClienteTitle}>
            Editar Cliente
          </h2>
          <button
            onClick={onClose}
            className={styles.editarClienteCloseButton}
          >
            <X className={styles.editarClienteCloseIcon} />
          </button>
        </div>

        <div className={styles.editarClienteContent}>
          <div className={styles.editarClienteForm}>
            <Accordion
              type="multiple"
              value={openAccordions}
              onValueChange={setOpenAccordions}
              className={styles.editarClienteAccordionContainer}
            >
              {/* Dados Gerais */}
              <AccordionItem
                value="dados-gerais"
                className={styles.editarClienteAccordionItem}
              >
                <AccordionTrigger className={styles.editarClienteAccordionTrigger}>
                  <span className={styles.editarClienteFontMedium}>Dados gerais</span>
                </AccordionTrigger>
                <AccordionContent className={styles.editarClienteAccordionContent}>
                  <div className={styles.editarClienteSpaceY4}>
                    {/* Primeira linha */}
                    <div className={cn(styles.editarClienteGrid1Col, styles.editarClienteMdGrid3Col)}>
                      <div className={styles.editarClienteField}>
                        <Label className={styles.editarClienteLabel}>Nome fantasia</Label>
                        <Input
                          value={formData.nome_fantasia || ""}
                          onChange={(e) =>
                            handleInputChange("nome_fantasia", e.target.value)
                          }
                          className={cn(styles.editarClienteInput, styles.editarClienteInputExtraWide)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <Label className={styles.editarClienteLabel}>Razão social</Label>
                        <Input
                          value={formData.razao_social || ""}
                          onChange={(e) =>
                            handleInputChange("razao_social", e.target.value)
                          }
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <Label className={styles.editarClienteLabel}>CPF / CNPJ</Label>
                        <Input
                          value={formData.cpf_cnpj || ""}
                          onChange={(e) => handleInputChange("cpf_cnpj", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                    </div>

                    {/* Segunda linha */}
                    <div className={cn(styles.editarClienteGrid1Col, styles.editarClienteMdGrid2Col)}>
                      <div className={styles.editarClienteField}>
                        <Label className={styles.editarClienteLabel}>Tipo de pessoa</Label>
                        <Select
                          value={formData.tipo_pessoa || ""}
                          onValueChange={(value) =>
                            handleInputChange("tipo_pessoa", value)
                          }
                        >
                          <SelectTrigger className={styles.editarClienteSelectTrigger}>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className={styles.editarClienteSelectContent}>
                            <SelectItem value="física" className={styles.editarClienteSelectItem}>Física</SelectItem>
                            <SelectItem value="jurídica" className={styles.editarClienteSelectItem}>Jurídica</SelectItem>
                            <SelectItem value="estrangeira" className={styles.editarClienteSelectItem}>Estrangeira</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className={styles.editarClienteField}>
                        <Label className={styles.editarClienteLabel}>Abertura da empresa</Label>
                        <Input
                          type="date"
                          value={formData.abertura_empresa?.split("T")[0] || ""}
                          onChange={(e) => handleInputChange("abertura_empresa", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Informações de Contato */}
              <AccordionItem
                value="contato"
                className={styles.editarClienteAccordionItem}
              >
                <AccordionTrigger className={styles.editarClienteAccordionTrigger}>
                  <span className={styles.editarClienteFontMedium}>Informações de contato</span>
                </AccordionTrigger>
                <AccordionContent className={styles.editarClienteAccordionContent}>
                  <div className={cn(styles.editarClienteGrid1Col, styles.editarClienteMdGrid2Col, styles.editarClienteLgGrid4Col)}>
                    <div className={styles.editarClienteField}>
                      <Label className={styles.editarClienteLabel}>Email principal</Label>
                      <Input
                        value={formData.email_principal || ""}
                        onChange={(e) =>
                          handleInputChange("email_principal", e.target.value)
                        }
                        className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                      />
                    </div>
                    <div className={styles.editarClienteField}>
                      <Label className={styles.editarClienteLabel}>Telefone comercial</Label>
                      <Input
                        value={formData.telefone_comercial || ""}
                        onChange={(e) =>
                          handleInputChange("telefone_comercial", e.target.value)
                        }
                        className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                      />
                    </div>
                    <div className={styles.editarClienteField}>
                      <Label className={styles.editarClienteLabel}>Telefone celular</Label>
                      <Input
                        value={formData.telefone_celular || ""}
                        onChange={(e) =>
                          handleInputChange("telefone_celular", e.target.value)
                        }
                        className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                      />
                    </div>
                    <div className={styles.editarClienteField}>
                      <Label className={styles.editarClienteLabel}>Simples Nacional</Label>
                      <Select
                        value={formData.optante_simples ? "Sim" : "Não"}
                        onValueChange={(value) =>
                          handleInputChange(
                            "optante_simples",
                            value === "Sim" ? 1 : 0
                          )
                        }
                      >
                        <SelectTrigger className={styles.editarClienteSelectTrigger}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className={styles.editarClienteSelectContent}>
                          <SelectItem value="Sim" className={styles.editarClienteSelectItem}>Sim</SelectItem>
                          <SelectItem value="Não" className={styles.editarClienteSelectItem}>Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Endereço */}
              <AccordionItem
                value="endereco"
                className={styles.editarClienteAccordionItem}
              >
                <AccordionTrigger className={styles.editarClienteAccordionTrigger}>
                  <span className={styles.editarClienteFontMedium}>Endereço</span>
                </AccordionTrigger>
                <AccordionContent className={styles.editarClienteAccordionContent}>
                  <div className={styles.editarClienteSpaceY4}>
                    {/* Primeira linha */}
                    <div className={cn(styles.editarClienteGrid1Col, styles.editarClienteMdGrid2Col, styles.editarClienteLgGrid4Col)}>
                      <div className={styles.editarClienteField}>
                        <Label className={styles.editarClienteLabel}>País</Label>
                        <Input
                          value={formData.pais || ""}
                          onChange={(e) => handleInputChange("pais", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <Label className={styles.editarClienteLabel}>CEP</Label>
                        <Input
                          value={formData.cep || ""}
                          onChange={(e) => handleInputChange("cep", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <Label className={styles.editarClienteLabel}>Endereço</Label>
                        <Input
                          value={formData.endereco || ""}
                          onChange={(e) => handleInputChange("endereco", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <Label className={styles.editarClienteLabel}>Número</Label>
                        <Input
                          value={formData.numero || ""}
                          onChange={(e) => handleInputChange("numero", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                    </div>

                    {/* Segunda linha */}
                    <div className={cn(styles.editarClienteGrid1Col, styles.editarClienteMdGrid2Col, styles.editarClienteLgGrid4Col)}>
                      <div className={styles.editarClienteField}>
                        <Label className={styles.editarClienteLabel}>Estado</Label>
                        <Input
                          value={formData.estado || ""}
                          onChange={(e) => handleInputChange("estado", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <Label className={styles.editarClienteLabel}>Cidade</Label>
                        <Input
                          value={formData.cidade || ""}
                          onChange={(e) => handleInputChange("cidade", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <Label className={styles.editarClienteLabel}>Bairro</Label>
                        <Input
                          value={formData.bairro || ""}
                          onChange={(e) => handleInputChange("bairro", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <Label className={styles.editarClienteLabel}>Complemento</Label>
                        <Input
                          value={formData.complemento || ""}
                          onChange={(e) =>
                            handleInputChange("complemento", e.target.value)
                          }
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Observações */}
              <AccordionItem
                value="observacoes"
                className={styles.editarClienteAccordionItem}
              >
                <AccordionTrigger className={styles.editarClienteAccordionTrigger}>
                  <span className={styles.editarClienteFontMedium}>Observações</span>
                </AccordionTrigger>
                <AccordionContent className={styles.editarClienteAccordionContent}>
                  <div className={styles.editarClienteSpaceY2}>
                    <Label className={styles.editarClienteLabel}>
                      Observações
                    </Label>
                    <Textarea
                      value={formData.observacoes || ""}
                      onChange={(e) =>
                        handleInputChange("observacoes", e.target.value)
                      }
                      className={cn(styles.editarClienteTextarea, styles.editarClienteTextareaLarge, styles.editarClienteMinH120px)}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        <div className={styles.editarClienteFooter}>
          <button onClick={onClose} className={styles.editarClienteCancelButton}>
            Cancelar
          </button>
          <button onClick={handleSave} className={styles.editarClienteSaveButton}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
