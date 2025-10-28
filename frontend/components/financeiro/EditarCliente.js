// Componente atualizado para permitir edição completa de clientes

"use client";

import React, { useEffect, useState } from "react";
import { X, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "react-toastify";
import { formatarDataParaMysql } from "../../utils/financeiro/dateUtils";
import styles from "../../styles/financeiro/EditarCliente.module.css";

// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

// Componente Accordion customizado
const CustomAccordion = ({ children, value, onValueChange }) => {
  return <div className={styles.editarClienteAccordionContainer}>{children}</div>;
};

const CustomAccordionItem = ({ value, children, openAccordions, toggleAccordion }) => {
  const isOpen = openAccordions.includes(value);
  
  return (
    <div className={styles.editarClienteAccordionItem}>
      {React.Children.map(children, child => {
        if (child.type === CustomAccordionTrigger) {
          return React.cloneElement(child, { isOpen, onClick: () => toggleAccordion(value) });
        }
        if (child.type === CustomAccordionContent) {
          return isOpen ? child : null;
        }
        return child;
      })}
    </div>
  );
};

const CustomAccordionTrigger = ({ children, isOpen, onClick }) => {
  return (
    <button
      type="button"
      className={styles.editarClienteAccordionTrigger}
      onClick={onClick}
    >
      {children}
      {isOpen ? <ChevronUp className={styles.accordionIcon} /> : <ChevronDown className={styles.accordionIcon} />}
    </button>
  );
};

const CustomAccordionContent = ({ children }) => {
  return <div className={styles.editarClienteAccordionContent}>{children}</div>;
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

  // Função para toggle de accordion
  const toggleAccordion = (value) => {
    setOpenAccordions(prev => 
      prev.includes(value)
        ? prev.filter(item => item !== value)
        : [...prev, value]
    );
  };

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
            <CustomAccordion
              value={openAccordions}
              onValueChange={setOpenAccordions}
            >
              {/* Dados Gerais */}
              <CustomAccordionItem
                value="dados-gerais"
                openAccordions={openAccordions}
                toggleAccordion={toggleAccordion}
              >
                <CustomAccordionTrigger>
                  <span className={styles.editarClienteFontMedium}>Dados gerais</span>
                </CustomAccordionTrigger>
                <CustomAccordionContent>
                  <div className={styles.editarClienteSpaceY4}>
                    {/* Primeira linha */}
                    <div className={cn(styles.editarClienteGrid1Col, styles.editarClienteMdGrid3Col)}>
                      <div className={styles.editarClienteField}>
                        <label className={styles.editarClienteLabel}>Nome fantasia</label>
                        <input
                          type="text"
                          value={formData.nome_fantasia || ""}
                          onChange={(e) =>
                            handleInputChange("nome_fantasia", e.target.value)
                          }
                          className={cn(styles.editarClienteInput, styles.editarClienteInputExtraWide)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <label className={styles.editarClienteLabel}>Razão social</label>
                        <input
                          type="text"
                          value={formData.razao_social || ""}
                          onChange={(e) =>
                            handleInputChange("razao_social", e.target.value)
                          }
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <label className={styles.editarClienteLabel}>CPF / CNPJ</label>
                        <input
                          type="text"
                          value={formData.cpf_cnpj || ""}
                          onChange={(e) => handleInputChange("cpf_cnpj", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                    </div>

                    {/* Segunda linha */}
                    <div className={cn(styles.editarClienteGrid1Col, styles.editarClienteMdGrid2Col)}>
                      <div className={styles.editarClienteField}>
                        <label className={styles.editarClienteLabel}>Tipo de pessoa</label>
                        <select
                          value={formData.tipo_pessoa || ""}
                          onChange={(e) =>
                            handleInputChange("tipo_pessoa", e.target.value)
                          }
                          className={styles.editarClienteSelectTrigger}
                        >
                          <option value="">Selecione</option>
                          <option value="física">Física</option>
                          <option value="jurídica">Jurídica</option>
                          <option value="estrangeira">Estrangeira</option>
                        </select>
                      </div>
                      <div className={styles.editarClienteField}>
                        <label className={styles.editarClienteLabel}>Abertura da empresa</label>
                        <input
                          type="date"
                          value={formData.abertura_empresa?.split("T")[0] || ""}
                          onChange={(e) => handleInputChange("abertura_empresa", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                    </div>
                  </div>
                </CustomAccordionContent>
              </CustomAccordionItem>

              {/* Informações de Contato */}
              <CustomAccordionItem
                value="contato"
                openAccordions={openAccordions}
                toggleAccordion={toggleAccordion}
              >
                <CustomAccordionTrigger>
                  <span className={styles.editarClienteFontMedium}>Informações de contato</span>
                </CustomAccordionTrigger>
                <CustomAccordionContent>
                  <div className={cn(styles.editarClienteGrid1Col, styles.editarClienteMdGrid2Col, styles.editarClienteLgGrid4Col)}>
                    <div className={styles.editarClienteField}>
                      <label className={styles.editarClienteLabel}>Email principal</label>
                      <input
                        type="email"
                        value={formData.email_principal || ""}
                        onChange={(e) =>
                          handleInputChange("email_principal", e.target.value)
                        }
                        className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                      />
                    </div>
                    <div className={styles.editarClienteField}>
                      <label className={styles.editarClienteLabel}>Telefone comercial</label>
                      <input
                        type="text"
                        value={formData.telefone_comercial || ""}
                        onChange={(e) =>
                          handleInputChange("telefone_comercial", e.target.value)
                        }
                        className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                      />
                    </div>
                    <div className={styles.editarClienteField}>
                      <label className={styles.editarClienteLabel}>Telefone celular</label>
                      <input
                        type="text"
                        value={formData.telefone_celular || ""}
                        onChange={(e) =>
                          handleInputChange("telefone_celular", e.target.value)
                        }
                        className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                      />
                    </div>
                    <div className={styles.editarClienteField}>
                      <label className={styles.editarClienteLabel}>Simples Nacional</label>
                        <select
                          value={formData.optante_simples ? "Sim" : "Não"}
                          onChange={(e) =>
                            handleInputChange(
                              "optante_simples",
                              e.target.value === "Sim" ? 1 : 0
                            )
                          }
                          className={styles.editarClienteSelectTrigger}
                        >
                          <option value="">Selecione</option>
                          <option value="Sim">Sim</option>
                          <option value="Não">Não</option>
                        </select>
                    </div>
                  </div>
                </CustomAccordionContent>
              </CustomAccordionItem>

              {/* Endereço */}
              <CustomAccordionItem
                value="endereco"
                openAccordions={openAccordions}
                toggleAccordion={toggleAccordion}
              >
                <CustomAccordionTrigger>
                  <span className={styles.editarClienteFontMedium}>Endereço</span>
                </CustomAccordionTrigger>
                <CustomAccordionContent>
                  <div className={styles.editarClienteSpaceY4}>
                    {/* Primeira linha */}
                    <div className={cn(styles.editarClienteGrid1Col, styles.editarClienteMdGrid2Col, styles.editarClienteLgGrid4Col)}>
                      <div className={styles.editarClienteField}>
                        <label className={styles.editarClienteLabel}>País</label>
                        <input
                          type="text"
                          value={formData.pais || ""}
                          onChange={(e) => handleInputChange("pais", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <label className={styles.editarClienteLabel}>CEP</label>
                        <input
                          type="text"
                          value={formData.cep || ""}
                          onChange={(e) => handleInputChange("cep", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <label className={styles.editarClienteLabel}>Endereço</label>
                        <input
                          type="text"
                          value={formData.endereco || ""}
                          onChange={(e) => handleInputChange("endereco", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <label className={styles.editarClienteLabel}>Número</label>
                        <input
                          type="text"
                          value={formData.numero || ""}
                          onChange={(e) => handleInputChange("numero", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                    </div>

                    {/* Segunda linha */}
                    <div className={cn(styles.editarClienteGrid1Col, styles.editarClienteMdGrid2Col, styles.editarClienteLgGrid4Col)}>
                      <div className={styles.editarClienteField}>
                        <label className={styles.editarClienteLabel}>Estado</label>
                        <input
                          type="text"
                          value={formData.estado || ""}
                          onChange={(e) => handleInputChange("estado", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <label className={styles.editarClienteLabel}>Cidade</label>
                        <input
                          type="text"
                          value={formData.cidade || ""}
                          onChange={(e) => handleInputChange("cidade", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <label className={styles.editarClienteLabel}>Bairro</label>
                        <input
                          type="text"
                          value={formData.bairro || ""}
                          onChange={(e) => handleInputChange("bairro", e.target.value)}
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                      <div className={styles.editarClienteField}>
                        <label className={styles.editarClienteLabel}>Complemento</label>
                        <input
                          type="text"
                          value={formData.complemento || ""}
                          onChange={(e) =>
                            handleInputChange("complemento", e.target.value)
                          }
                          className={cn(styles.editarClienteInput, styles.editarClienteInputLarge)}
                        />
                      </div>
                    </div>
                  </div>
                </CustomAccordionContent>
              </CustomAccordionItem>

              {/* Observações */}
              <CustomAccordionItem
                value="observacoes"
                openAccordions={openAccordions}
                toggleAccordion={toggleAccordion}
              >
                <CustomAccordionTrigger>
                  <span className={styles.editarClienteFontMedium}>Observações</span>
                </CustomAccordionTrigger>
                <CustomAccordionContent>
                  <div className={styles.editarClienteSpaceY2}>
                    <label className={styles.editarClienteLabel}>
                      Observações
                    </label>
                    <textarea
                      value={formData.observacoes || ""}
                      onChange={(e) =>
                        handleInputChange("observacoes", e.target.value)
                      }
                      className={cn(styles.editarClienteTextarea, styles.editarClienteTextareaLarge, styles.editarClienteMinH120px)}
                    />
                  </div>
                </CustomAccordionContent>
              </CustomAccordionItem>
            </CustomAccordion>
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
