"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Search,
  Info,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "react-toastify";
import { formatarDataParaMysql } from "../../utils/financeiro/dateUtils";
import styles from "../../styles/financeiro/novo-cliente-drawer.module.css";

// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

// Componente Accordion customizado
const CustomAccordion = ({ children, value, onValueChange }) => {
  return <div className={styles.accordionContainer}>{children}</div>;
};

const CustomAccordionItem = ({ value, children, openAccordions, toggleAccordion }) => {
  const isOpen = openAccordions.includes(value);
  
  return (
    <div className={styles.accordionItem}>
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
      className={styles.accordionTrigger}
      onClick={onClick}
    >
      {children}
      {isOpen ? <ChevronUp className={styles.accordionIcon} /> : <ChevronDown className={styles.accordionIcon} />}
    </button>
  );
};

const CustomAccordionContent = ({ children }) => {
  return <div className={styles.accordionContent}>{children}</div>;
};

export function NovoClienteDrawer({
  isOpen,
  onClose,
  onSave,
}) {
  const [formData, setFormData] = useState({
    // Dados gerais
    tipoPessoa: "Jurídica",
    cnpj: "",
    nomeFantasia: "",
    codigoCadastro: "",
    tiposPapel: {
      cliente: true,
      fornecedor: false,
      transportadora: false,
    },

    // Informações adicionais
    emailPrincipal: "",
    telefoneComercial: "",
    telefoneCelular: "",
    aberturaEmpresa: "",

    // Informações fiscais
    razaoSocial: "",
    optanteSimples: "Não",
    indicadorInscricaoEstadual: "",
    inscricaoEstadual: "",
    inscricaoMunicipal: "",
    inscricaoSuframa: "",

    // Endereço
    pais: "Brasil",
    cep: "",
    endereco: "",
    numero: "",
    estado: "",
    cidade: "",
    bairro: "",
    complemento: "",

    // Outros contatos
    outrosContatos: [],

    // Observações gerais
    observacoes: "",
  });

  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [erroCnpj, setErroCnpj] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [estados, setEstados] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [isClosing, setIsClosing] = useState(false);

  // Funções para formatação de campos
  const formatarCNPJ = (valor) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 14) {
      return apenasNumeros.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        '$1.$2.$3/$4-$5'
      );
    }
    return valor;
  };

  const formatarCPF = (valor) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 11) {
      return apenasNumeros.replace(
        /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
        '$1.$2.$3-$4'
      );
    }
    return valor;
  };

  const formatarCEP = (valor) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 8) {
      return apenasNumeros.replace(/^(\d{5})(\d{3})$/, '$1-$2');
    }
    return valor;
  };

  const formatarData = (valor) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 8) {
      return apenasNumeros.replace(/^(\d{2})(\d{2})(\d{4})$/, '$1/$2/$3');
    }
    return valor;
  };

  // Buscar estados do IBGE
  useEffect(() => {
    fetch(
      "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome"
    )
      .then((res) => res.json())
      .then((data) => setEstados(data))
      .catch((err) => {
        console.error("Erro ao buscar estados:", err);
        toast.error("Erro ao carregar estados");
      });
  }, []);

  // Buscar cidades do estado selecionado
  useEffect(() => {
    if (formData.estado) {
      fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${formData.estado}/municipios`
      )
        .then((res) => res.json())
        .then((data) => setCidades(data))
        .catch((err) => {
          console.error("Erro ao buscar cidades:", err);
          toast.error("Erro ao carregar cidades");
        });
    } else {
      setCidades([]);
    }
  }, [formData.estado]);

  const API = process.env.NEXT_PUBLIC_API_URL;

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

  const enviarClienteParaBackend = async (data) => {
    // Buscar empresaId do userData (padrão correto do sistema)
    const userData = localStorage.getItem("userData");
    const user = userData ? JSON.parse(userData) : null;
    const empresaId = user?.EmpresaId || user?.empresa?.id || null;

    if (!empresaId) {
      toast.error("Empresa não identificada. Verifique seu acesso.");
      return null;
    }

    const tiposSelecionados = [];
    if (data.tiposPapel.cliente) tiposSelecionados.push("cliente");
    if (data.tiposPapel.fornecedor) tiposSelecionados.push("fornecedor");
    if (data.tiposPapel.transportadora)
      tiposSelecionados.push("transportadora");

    try {
      const response = await fetch(`${API}/financeiro/clientes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({
          tipo_pessoa: data.tipoPessoa,
          cpf_cnpj: data.cnpj,
          nome_fantasia: data.nomeFantasia,
          tipo_de_papel: tiposSelecionados.join(","),
          codigo_do_cadastro: data.codigoCadastro,
          email_principal: data.emailPrincipal,
          telefone_comercial: data.telefoneComercial,
          telefone_celular: data.telefoneCelular,
          abertura_empresa: formatarDataParaMysql(data.aberturaEmpresa),
          razao_social: data.razaoSocial,
          optante_simples: data.optanteSimples === "Sim" ? 1 : 0,
          pais: data.pais,
          cep: data.cep,
          endereco: data.endereco,
          numero: data.numero,
          estado: data.estado,
          cidade: data.cidade,
          bairro: data.bairro,
          complemento: data.complemento,
          pessoa_de_contato: data.outrosContatos?.[0]?.pessoaContato || "",
          e_mail_pessoa_contato: data.outrosContatos?.[0]?.email || "",
          telefone_comercial_pessoa_contato:
            data.outrosContatos?.[0]?.telefoneComercial || "",
          telefone_celular_pessoa_contato:
            data.outrosContatos?.[0]?.telefoneCelular || "",
          cargo: data.outrosContatos?.[0]?.cargo || "",
          observacoes: data.observacoes,
          status: "ativo", // Status padrão para novos clientes
          empresa_id: empresaId,
        }),
      });

      const resultado = await response.json();
      console.log("📋 Dados retornados pela API:", resultado);

      if (!response.ok) {
        console.error("Erro detalhado:", resultado);
        throw new Error(
          resultado.error || "Erro desconhecido ao salvar cliente."
        );
      }

      toast.success("Cliente salvo com sucesso!");
      return resultado; // Retorna os dados do cliente criado
    } catch (error) {
      toast.error(`Erro ao salvar cliente: ${error.message}`);
      console.error("Erro ao salvar cliente:", error);
      return null;
    }
  };

  // Função para resetar o formulário
  const resetForm = () => {
    setFormData({
      // Dados gerais
      tipoPessoa: "Jurídica",
      cnpj: "",
      nomeFantasia: "",
      codigoCadastro: "",
      tiposPapel: {
        cliente: true,
        fornecedor: false,
        transportadora: false,
      },

      // Informações adicionais
      emailPrincipal: "",
      telefoneComercial: "",
      telefoneCelular: "",
      aberturaEmpresa: "",

      // Informações fiscais
      razaoSocial: "",
      optanteSimples: "Não",
      indicadorInscricaoEstadual: "",
      inscricaoEstadual: "",
      inscricaoMunicipal: "",
      inscricaoSuframa: "",

      // Endereço
      pais: "Brasil",
      cep: "",
      endereco: "",
      numero: "",
      estado: "",
      cidade: "",
      bairro: "",
      complemento: "",

      // Outros contatos
      outrosContatos: [],

      // Observações gerais
      observacoes: "",
    });
    
    // Resetar estados auxiliares
    setErroCnpj("");
    setOpenAccordions(["dados-gerais"]);
  };

  const handleSave = async () => {
    const clienteCriado = await enviarClienteParaBackend(formData);
    if (clienteCriado) {
      resetForm();
      onSave(clienteCriado); // Passa os dados do cliente criado para o componente pai
    }
    handleClose();
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 600); // Duração da animação de fechamento
  };

  // Função para fechar ao clicar no overlay
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Limpar cidade quando estado for alterado
    if (field === "estado") {
      setFormData((prev) => ({
        ...prev,
        cidade: "",
      }));
    }

    // Busca automática do CEP quando completar 8 dígitos
    if (field === "cep" && value.replace(/\D/g, "").length === 8) {
      setTimeout(() => buscarDadosCEP(), 500); // Pequeno delay para o usuário terminar de digitar
    }

    // Ao alterar o tipo de pessoa, limpar documento e erros
    if (field === "tipoPessoa") {
      setErroCnpj("");
      setFormData((prev) => ({
        ...prev,
        cnpj: "",
      }));
    }
  };

  const handleTipoPapelChange = (tipo, checked) => {
    setFormData((prev) => ({
      ...prev,
      tiposPapel: {
        ...prev.tiposPapel,
        [tipo]: checked,
      },
    }));
  };

  const adicionarContato = () => {
    const novoContato = {
      id: Date.now().toString(),
      pessoaContato: "",
      email: "",
      telefoneComercial: "",
      telefoneCelular: "",
      cargo: "",
    };

    setFormData((prev) => ({
      ...prev,
      outrosContatos: [...prev.outrosContatos, novoContato],
    }));
  };

  const removerContato = (id) => {
    setFormData((prev) => ({
      ...prev,
      outrosContatos: prev.outrosContatos.filter(
        (contato) => contato.id !== id
      ),
    }));
  };

  const atualizarContato = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,
      outrosContatos: prev.outrosContatos.map((contato) =>
        contato.id === id ? { ...contato, [field]: value } : contato
      ),
    }));
  };

  const buscarDadosCNPJ = async () => {
    setErroCnpj("");
    setBuscandoCnpj(true);
    try {
      const cnpjLimpo = (formData.cnpj || "").replace(/\D/g, "");
      if (cnpjLimpo.length !== 14) {
        setErroCnpj("CNPJ deve ter 14 dígitos.");
        setBuscandoCnpj(false);
        return;
      }

      const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`);
      const data = await res.json();

      if (
        !data ||
        data.status === "ERROR" ||
        data.status === 404 ||
        data.message
      ) {
        setErroCnpj(data.message || "CNPJ não encontrado.");
        setBuscandoCnpj(false);
        return;
      }

      const estadoSigla = data.estabelecimento?.estado?.sigla;
      const cidadeNome = data.estabelecimento?.cidade?.nome;

      setFormData((prev) => ({
        ...prev,
        nomeFantasia: data.estabelecimento?.nome_fantasia || prev.nomeFantasia,
        razaoSocial: data.razao_social || prev.razaoSocial,
        endereco: data.estabelecimento?.logradouro || prev.endereco,
        numero: data.estabelecimento?.numero || prev.numero,
        complemento: data.estabelecimento?.complemento || prev.complemento,
        bairro: data.estabelecimento?.bairro || prev.bairro,
        cidade: cidadeNome || prev.cidade,
        estado: estadoSigla || prev.estado,
        cep: data.estabelecimento?.cep
          ? data.estabelecimento.cep.replace(/\D/g, "")
          : prev.cep,
        telefoneComercial: data.estabelecimento?.telefone1
          ? data.estabelecimento.telefone1.replace(/\D/g, "")
          : prev.telefoneComercial,
      }));

      toast.success("✅ Dados do CNPJ carregados com sucesso!");
    } catch (err) {
      setErroCnpj("Erro ao buscar dados do CNPJ. Tente novamente.");
      toast.error("❌ Erro ao buscar dados do CNPJ");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const buscarDadosCEP = async () => {
    const cepLimpo = formData.cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      // toast.error("CEP deve ter 8 dígitos.");
      return;
    }

    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();

      if (!data.erro) {
        const estadoSigla = data.uf;
        const cidadeNome = data.localidade;

        setFormData((prev) => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          bairro: data.bairro || prev.bairro,
          cidade: cidadeNome || prev.cidade,
          estado: estadoSigla || prev.estado,
        }));
        toast.success("✅ Dados do CEP carregados com sucesso!");
      } else {
        toast.error("❌ CEP não encontrado");
      }
    } catch (err) {
      toast.error("❌ Erro ao buscar dados do CEP");
    } finally {
      setBuscandoCep(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        styles.drawerOverlay,
        isClosing && styles.closing
      )}
      onClick={handleOverlayClick}
    >
      <div
        className={cn(
          styles.drawerContainer,
          isClosing && styles.closing
        )}
      >
        {/* Header */}
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>Novo cadastro</h2>
          <button
            type="button"
            onClick={handleClose}
            className={styles.closeButton}
          >
            <X className={styles.closeIcon} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.drawerContent}>
          <div className={styles.drawerContentInner}>
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
                  <span className={styles.fontMedium}>Dados gerais</span>
                </CustomAccordionTrigger>
                <CustomAccordionContent>
                  <div className={styles.spaceY4}>
                    {/* Primeira linha */}
                    <div className={cn(styles.grid1Col, styles.mdGrid3Col)}>
                      <div className={styles.fieldContainer}>
                        <label className={styles.fieldLabel}>
                          Tipo de pessoa *
                        </label>
                        <select
                          value={formData.tipoPessoa}
                          onChange={(e) =>
                            handleInputChange("tipoPessoa", e.target.value)
                          }
                          className={styles.selectField}
                        >
                          <option value="Jurídica">Jurídica</option>
                          <option value="Física">Física</option>
                        </select>
                      </div>

                      <div className={styles.fieldContainer}>
                        <label className={styles.fieldLabel}>{formData.tipoPessoa === "Jurídica" ? "CNPJ" : "CPF"}</label>
                        <div className={styles.inputWithButton}>
                          <input
                            type="text"
                            value={formData.cnpj}
                            onChange={(e) => {
                              const valor = e.target.value;
                              const formatado = formData.tipoPessoa === "Jurídica" 
                                ? formatarCNPJ(valor) 
                                : formatarCPF(valor);
                              handleInputChange("cnpj", formatado);
                            }}
                            placeholder={formData.tipoPessoa === "Jurídica" ? "00.000.000/0000-00" : "000.000.000-00"}
                            className={cn(styles.inputField, styles.inputFieldLarge)}
                          />
                          {formData.tipoPessoa === "Jurídica" && (
                            <button
                              type="button"
                              onClick={buscarDadosCNPJ}
                              disabled={buscandoCnpj}
                              className={cn(styles.buttonOutline, styles.buttonSmall, buscandoCnpj && styles.buttonDisabled)}
                            >
                              {buscandoCnpj ? "Buscando..." : "Buscar dados"}
                            </button>
                          )}
                        </div>
                        {erroCnpj && (
                          <p className={styles.errorMessage}>
                            {erroCnpj}
                          </p>
                        )}
                      </div>

                      <div className={styles.fieldContainer}>
                        <label className={styles.fieldLabel}>
                          {formData.tipoPessoa === "Jurídica" ? "Nome fantasia *" : "Nome cliente *"}
                        </label>
                        <div className={styles.flex} style={{ gap: '8px' }}>
                          <input
                            type="text"
                            value={formData.nomeFantasia}
                            onChange={(e) =>
                              handleInputChange("nomeFantasia", e.target.value)
                            }
                            placeholder={formData.tipoPessoa === "Jurídica" ? "Digite o nome fantasia" : "Digite o nome do cliente"}
                            className={cn(styles.inputField, styles.inputFieldExtraWide)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Segunda linha */}
                    <div className={cn(styles.grid1Col, styles.mdGrid2Col)}>
                      <div className={styles.fieldContainer}>
                        <div className={styles.fieldLabelWithIcon}>
                          <label className={styles.fieldLabel}>
                            Tipo de papel *
                          </label>
                        </div>
                        <div className={styles.checkboxContainer}>
                          <div className={styles.checkboxItem}>
                            <input
                              type="checkbox"
                              id="cliente"
                              checked={formData.tiposPapel.cliente}
                              onChange={(e) =>
                                handleTipoPapelChange(
                                  "cliente",
                                  e.target.checked
                                )
                              }
                              className={styles.checkbox}
                            />
                            <label htmlFor="cliente" className={styles.checkboxLabel}>
                              Cliente
                            </label>
                          </div>
                          <div className={styles.checkboxItem}>
                            <input
                              type="checkbox"
                              id="fornecedor"
                              checked={formData.tiposPapel.fornecedor}
                              onChange={(e) =>
                                handleTipoPapelChange(
                                  "fornecedor",
                                  e.target.checked
                                )
                              }
                              className={styles.checkbox}
                            />
                            <label htmlFor="fornecedor" className={styles.checkboxLabel}>
                              Fornecedor
                            </label>
                          </div>
                          <div className={styles.checkboxItem}>
                            <input
                              type="checkbox"
                              id="transportadora"
                              checked={formData.tiposPapel.transportadora}
                              onChange={(e) =>
                                handleTipoPapelChange(
                                  "transportadora",
                                  e.target.checked
                                )
                              }
                              className={styles.checkbox}
                            />
                            <label
                              htmlFor="transportadora"
                              className={styles.checkboxLabel}
                            >
                              Transportadora
                            </label>
                          </div>
                        </div>
                        <p className={styles.helpText}>
                          É possível selecionar mais de uma opção
                        </p>
                      </div>

                      <div className={styles.fieldContainer}>
                        <div className={styles.fieldLabelWithIcon}>
                          <label className={styles.fieldLabel}>
                            Código do cadastro
                          </label>
                        </div>
                        <input
                          type="text"
                          value={formData.codigoCadastro}
                          onChange={(e) =>
                            handleInputChange("codigoCadastro", e.target.value)
                          }
                          placeholder="Digite o código"
                          className={cn(styles.inputField, styles.inputFieldLarge)}
                        />
                      </div>
                    </div>
                  </div>
                </CustomAccordionContent>
              </CustomAccordionItem>

              {/* Informações Adicionais */}
              <CustomAccordionItem
                value="informacoes-adicionais"
                openAccordions={openAccordions}
                toggleAccordion={toggleAccordion}
              >
                <CustomAccordionTrigger>
                  <span className={styles.fontMedium}>Informações adicionais</span>
                </CustomAccordionTrigger>
                <CustomAccordionContent>
                  <div className={cn(styles.grid1Col, styles.mdGrid2Col, styles.lgGrid4Col)}>
                    <div className={styles.fieldContainer}>
                      <label className={styles.fieldLabel}>
                        E-mail principal
                      </label>
                      <input
                        type="email"
                        value={formData.emailPrincipal}
                        onChange={(e) => {
                          // Converter automaticamente para minúsculas
                          const emailMinusculo = e.target.value.toLowerCase();
                          handleInputChange("emailPrincipal", emailMinusculo);
                        }}
                        placeholder="email@exemplo.com"
                        className={cn(styles.inputField, styles.inputFieldLarge)}
                      />
                    </div>

                    <div className={styles.fieldContainer}>
                      <label className={styles.fieldLabel}>
                        Telefone comercial
                      </label>
                      <input
                        type="text"
                        value={formData.telefoneComercial}
                        onChange={(e) =>
                          handleInputChange("telefoneComercial", e.target.value)
                        }
                        placeholder="(11) 3333-3333"
                        className={cn(styles.inputField, styles.inputFieldLarge)}
                      />
                    </div>

                    <div className={styles.fieldContainer}>
                      <label className={styles.fieldLabel}>
                        Telefone celular
                      </label>
                      <input
                        type="text"
                        value={formData.telefoneCelular}
                        onChange={(e) =>
                          handleInputChange("telefoneCelular", e.target.value)
                        }
                        placeholder="(11) 99999-9999"
                        className={cn(styles.inputField, styles.inputFieldLarge)}
                      />
                    </div>

                    <div className={styles.fieldContainer}>
                      <label className={styles.fieldLabel}>
                        Abertura da empresa
                      </label>
                      <input
                        type="text"
                        value={formData.aberturaEmpresa}
                        onChange={(e) => {
                          const valor = e.target.value;
                          const formatado = formatarData(valor);
                          handleInputChange("aberturaEmpresa", formatado);
                        }}
                        placeholder="dd/mm/aaaa"
                        className={cn(styles.inputField, styles.inputFieldLarge)}
                      />
                    </div>
                  </div>
                </CustomAccordionContent>
              </CustomAccordionItem>

              {/* Informações Fiscais */}
              <CustomAccordionItem
                value="informacoes-fiscais"
                openAccordions={openAccordions}
                toggleAccordion={toggleAccordion}
              >
                <CustomAccordionTrigger>
                  <span className={styles.fontMedium}>Informações fiscais</span>
                </CustomAccordionTrigger>
                <CustomAccordionContent>
                  <div className={styles.spaceY4}>
                    {/* Primeira linha */}
                    <div className={cn(styles.grid1Col, styles.mdGrid2Col)}>
                      <div className={styles.fieldContainer}>
                        <label className={styles.fieldLabel}>
                          Razão social
                        </label>
                        <input
                          type="text"
                          value={formData.razaoSocial}
                          onChange={(e) =>
                            handleInputChange("razaoSocial", e.target.value)
                          }
                          placeholder="Digite a razão social"
                          className={cn(styles.inputField, styles.inputFieldLarge)}
                        />
                      </div>

                      <div className={styles.fieldContainer}>
                        <div className={styles.fieldLabelWithIcon}>
                          <label className={styles.fieldLabel}>
                            Optante pelo simples?
                          </label>
                        </div>
                        <div className={styles.radioGroup}>
                          <div className={styles.radioItem}>
                            <input
                              type="radio"
                              name="optanteSimples"
                              value="Não"
                              id="nao"
                              checked={formData.optanteSimples === "Não"}
                              onChange={(e) =>
                                handleInputChange("optanteSimples", e.target.value)
                              }
                              className={styles.radio}
                            />
                            <label htmlFor="nao" className={styles.radioLabel}>
                              Não
                            </label>
                          </div>
                          <div className={styles.radioItem}>
                            <input
                              type="radio"
                              name="optanteSimples"
                              value="Sim"
                              id="sim"
                              checked={formData.optanteSimples === "Sim"}
                              onChange={(e) =>
                                handleInputChange("optanteSimples", e.target.value)
                              }
                              className={styles.radio}
                            />
                            <label htmlFor="sim" className={styles.radioLabel}>
                              Sim
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Segunda linha */}
                    <div className={cn(styles.grid1Col, styles.mdGrid2Col, styles.lgGrid4Col)}>
                      <div className={styles.fieldContainer}>
                        <label className={styles.fieldLabel}>
                          Indicador de Inscrição estadual
                        </label>
                        <select
                          value={formData.indicadorInscricaoEstadual}
                          onChange={(e) =>
                            handleInputChange(
                              "indicadorInscricaoEstadual",
                              e.target.value
                            )
                          }
                          className={styles.selectField}
                        >
                          <option value="">Selecione</option>
                          <option value="contribuinte">Contribuinte ICMS</option>
                          <option value="isento">Isento</option>
                          <option value="nao-contribuinte">Não contribuinte</option>
                        </select>
                      </div>

                      <div className={styles.fieldContainer}>
                        <div className={styles.fieldLabelWithIcon}>
                          <label className={styles.fieldLabel}>
                            Inscrição estadual
                          </label>
                        </div>
                        <input
                          type="text"
                          value={formData.inscricaoEstadual}
                          onChange={(e) =>
                            handleInputChange(
                              "inscricaoEstadual",
                              e.target.value
                            )
                          }
                          placeholder="Digite a inscrição"
                          className={cn(styles.inputField, styles.inputFieldLarge)}
                        />
                      </div>

                      <div className={styles.fieldContainer}>
                        <label className={styles.fieldLabel}>
                          Inscrição municipal
                        </label>
                        <input
                          type="text"
                          value={formData.inscricaoMunicipal}
                          onChange={(e) =>
                            handleInputChange(
                              "inscricaoMunicipal",
                              e.target.value
                            )
                          }
                          placeholder="Digite a inscrição"
                          className={cn(styles.inputField, styles.inputFieldLarge)}
                        />
                      </div>

                      <div className={styles.fieldContainer}>
                        <label className={styles.fieldLabel}>
                          Inscrição suframa
                        </label>
                        <input
                          type="text"
                          value={formData.inscricaoSuframa}
                          onChange={(e) =>
                            handleInputChange(
                              "inscricaoSuframa",
                              e.target.value
                            )
                          }
                          placeholder="Digite a inscrição"
                          className={cn(styles.inputField, styles.inputFieldLarge)}
                        />
                      </div>
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
                  <span className={styles.fontMedium}>Endereço</span>
                </CustomAccordionTrigger>
                <CustomAccordionContent>
                  <div className={styles.spaceY4}>
                    {/* Primeira linha */}
                    <div className={cn(styles.grid1Col, styles.mdGrid2Col, styles.lgGrid4Col)}>
                      <div className={styles.fieldContainer}>
                        <label className={styles.fieldLabel}>País</label>
                        <input
                          type="text"
                          value={formData.pais}
                          onChange={(e) =>
                            handleInputChange("pais", e.target.value)
                          }
                          placeholder="Brasil"
                          className={cn(styles.inputField, styles.inputFieldLarge)}
                        />
                      </div>

                      <div className={styles.fieldContainer}>
                        <label className={styles.fieldLabel}>CEP</label>
                        <div className={styles.inputWithButton}>
                          <input
                            type="text"
                            value={formData.cep}
                            onChange={(e) => {
                              const valor = e.target.value;
                              const formatado = formatarCEP(valor);
                              handleInputChange("cep", formatado);
                            }}
                            placeholder="00000-000"
                            className={cn(styles.inputField, styles.inputFieldLarge)}
                          />
                          <button
                            type="button"
                            onClick={buscarDadosCEP}
                            disabled={buscandoCep}
                            className={cn(styles.buttonOutline, styles.buttonSmall, buscandoCep && styles.buttonDisabled)}
                          >
                            {buscandoCep ? "Buscando..." : "Buscar dados"}
                          </button>
                        </div>
                      </div>

                      <div className={styles.fieldContainer}>
                        <label className={styles.fieldLabel}>
                          Endereço
                        </label>
                        <input
                          type="text"
                          value={formData.endereco}
                          onChange={(e) =>
                            handleInputChange("endereco", e.target.value)
                          }
                          placeholder="Digite o endereço"
                          className={cn(styles.inputField, styles.inputFieldLarge)}
                        />
                      </div>

                      <div className={styles.fieldContainer}>
                        <label className={styles.fieldLabel}>Número</label>
                        <input
                          type="text"
                          value={formData.numero}
                          onChange={(e) =>
                            handleInputChange("numero", e.target.value)
                          }
                          placeholder="123"
                          className={cn(styles.inputField, styles.inputFieldLarge)}
                        />
                      </div>
                    </div>

                    {/* Segunda linha */}
                    <div className={cn(styles.grid1Col, styles.mdGrid2Col, styles.lgGrid4Col)}>
                      <div className={styles.fieldContainer}>
                        <label className={styles.fieldLabel}>Estado</label>
                        <select
                          value={formData.estado}
                          onChange={(e) =>
                            handleInputChange("estado", e.target.value)
                          }
                          className={styles.selectField}
                        >
                          <option value="">Selecione</option>
                          {estados.map((estado) => (
                            <option
                              key={estado.id}
                              value={estado.sigla}
                            >
                              {estado.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={styles.fieldContainer}>
                        <label className={styles.fieldLabel}>Cidade</label>
                        <select
                          value={formData.cidade}
                          onChange={(e) =>
                            handleInputChange("cidade", e.target.value)
                          }
                          disabled={!formData.estado}
                          className={styles.selectField}
                        >
                          <option value="">
                            {formData.estado
                              ? "Selecione a cidade"
                              : "Selecione um estado primeiro"}
                          </option>
                          {cidades.map((cidade) => (
                            <option
                              key={cidade.id}
                              value={cidade.nome}
                            >
                              {cidade.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={styles.fieldContainer}>
                        <label className={styles.fieldLabel}>Bairro</label>
                        <input
                          type="text"
                          value={formData.bairro}
                          onChange={(e) =>
                            handleInputChange("bairro", e.target.value)
                          }
                          placeholder="Digite o bairro"
                          className={cn(styles.inputField, styles.inputFieldLarge)}
                        />
                      </div>

                      <div className={styles.fieldContainer}>
                        <label className={styles.fieldLabel}>
                          Complemento
                        </label>
                        <input
                          type="text"
                          value={formData.complemento}
                          onChange={(e) =>
                            handleInputChange("complemento", e.target.value)
                          }
                          placeholder="Apto, sala, etc."
                          className={cn(styles.inputField, styles.inputFieldLarge)}
                        />
                      </div>
                    </div>
                  </div>
                </CustomAccordionContent>
              </CustomAccordionItem>

              {/* Outros Contatos */}
              <CustomAccordionItem
                value="outros-contatos"
                openAccordions={openAccordions}
                toggleAccordion={toggleAccordion}
              >
                <CustomAccordionTrigger>
                  <span className={styles.fontMedium}>Outros contatos</span>
                </CustomAccordionTrigger>
                <CustomAccordionContent>
                  <div className={styles.spaceY4}>
                    {formData.outrosContatos.map((contato, index) => (
                      <div
                        key={contato.id}
                        className={styles.contactCard}
                      >
                        <div className={styles.contactHeader}>
                          <h4 className={styles.contactTitle}>
                            Contato {index + 1}
                          </h4>
                          <button
                            type="button"
                            onClick={() => removerContato(contato.id)}
                            className={styles.removeButton}
                          >
                            <Trash2 className={cn(styles.h4, styles.w4, styles.textRed400)} />
                          </button>
                        </div>

                        <div className={cn(styles.grid1Col, styles.mdGrid2Col, styles.lgGrid5Col)}>
                          <div className={styles.fieldContainer}>
                            <label className={styles.fieldLabel}>
                              Pessoa de contato
                            </label>
                            <input
                              type="text"
                              value={contato.pessoaContato}
                              onChange={(e) =>
                                atualizarContato(
                                  contato.id,
                                  "pessoaContato",
                                  e.target.value
                                )
                              }
                              placeholder="Nome da pessoa"
                              className={cn(styles.inputField, styles.inputFieldLarge)}
                            />
                          </div>

                          <div className={styles.fieldContainer}>
                            <label className={styles.fieldLabel}>
                              E-mail
                            </label>
                            <input
                              type="email"
                              value={contato.email}
                              onChange={(e) => {
                                // Converter automaticamente para minúsculas
                                const emailMinusculo = e.target.value.toLowerCase();
                                atualizarContato(
                                  contato.id,
                                  "email",
                                  emailMinusculo
                                );
                              }}
                              placeholder="email@exemplo.com"
                              className={cn(styles.inputField, styles.inputFieldLarge)}
                            />
                          </div>

                          <div className={styles.fieldContainer}>
                            <label className={styles.fieldLabel}>
                              Telefone comercial
                            </label>
                            <input
                              type="text"
                              value={contato.telefoneComercial}
                              onChange={(e) =>
                                atualizarContato(
                                  contato.id,
                                  "telefoneComercial",
                                  e.target.value
                                )
                              }
                              placeholder="(11) 3333-3333"
                              className={cn(styles.inputField, styles.inputFieldLarge)}
                            />
                          </div>

                          <div className={styles.fieldContainer}>
                            <label className={styles.fieldLabel}>
                              Telefone celular
                            </label>
                            <input
                              type="text"
                              value={contato.telefoneCelular}
                              onChange={(e) =>
                                atualizarContato(
                                  contato.id,
                                  "telefoneCelular",
                                  e.target.value
                                )
                              }
                              placeholder="(11) 99999-9999"
                              className={cn(styles.inputField, styles.inputFieldLarge)}
                            />
                          </div>

                          <div className={styles.fieldContainer}>
                            <label className={styles.fieldLabel}>
                              Cargo
                            </label>
                            <input
                              type="text"
                              value={contato.cargo}
                              onChange={(e) =>
                                atualizarContato(
                                  contato.id,
                                  "cargo",
                                  e.target.value
                                )
                              }
                              placeholder="Cargo/Função"
                              className={cn(styles.inputField, styles.inputFieldLarge)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={adicionarContato}
                      className={styles.addContactButton}
                    >
                      <Plus className={cn(styles.h4, styles.w4, styles.mr2)} />
                      Adicionar contato
                    </button>
                  </div>
                </CustomAccordionContent>
              </CustomAccordionItem>

              {/* Observações Gerais */}
              <CustomAccordionItem
                value="observacoes-gerais"
                openAccordions={openAccordions}
                toggleAccordion={toggleAccordion}
              >
                <CustomAccordionTrigger>
                  <span className={styles.fontMedium}>Observações gerais</span>
                </CustomAccordionTrigger>
                <CustomAccordionContent>
                  <div className={styles.spaceY2}>
                    <label className={styles.fieldLabel}>
                      Observações
                    </label>
                    <textarea
                      value={formData.observacoes}
                      onChange={(e) =>
                        handleInputChange("observacoes", e.target.value)
                      }
                      placeholder="Digite observações sobre o cliente"
                      className={cn(styles.textareaField, styles.textareaFieldLarge, styles.minH120px)}
                    />
                  </div>
                </CustomAccordionContent>
              </CustomAccordionItem>
            </CustomAccordion>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.drawerFooter}>
          <button
            type="button"
            onClick={handleClose}
            className={styles.cancelButton}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={styles.saveButton}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
