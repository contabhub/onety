"use client";

import { useState } from "react";
import { Button } from "./botao";
import { Input } from "./input";
import { Label } from "./label";
import { Textarea } from "./textarea";
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
import {
  X,
  Search,
  Info,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
} from "lucide-react";
// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};
import { toast } from "react-toastify";
import { formatarDataParaMysql } from "../../utils/financeiro/dateUtils";
import { useEffect } from "react";
import styles from "../../styles/financeiro/novo-cliente-drawer.module.css";
// Removido InputMask para evitar warning de findDOMNode

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

  const enviarClienteParaBackend = async (data) => {
    const empresaId = localStorage.getItem("empresaId");

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
      const response = await fetch(`${API}/clientes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({
          tipo_de_pessoa: data.tipoPessoa,
          cnpj: data.cnpj,
          nome_fantasia: data.nomeFantasia,
          tipo_de_papel: tiposSelecionados.join(","),
          codigo_do_cadastro: data.codigoCadastro,
          e_mail_principal: data.emailPrincipal,
          telefone_comercial: data.telefoneComercial,
          telefone_celular: data.telefoneCelular,
          abertura_da_empresa: formatarDataParaMysql(data.aberturaEmpresa),
          razao_social: data.razaoSocial,
          optante_pelo_simples: data.optanteSimples === "Sim" ? 1 : 0,
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
          company_id: empresaId,
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

      toast.success("✅ Cliente salvo com sucesso!");
      return resultado; // Retorna os dados do cliente criado
    } catch (error) {
      toast.error(`❌ Erro ao salvar cliente: ${error.message}`);
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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className={styles.closeButton}
          >
            <X className={styles.closeIcon} />
          </Button>
        </div>

        {/* Content */}
        <div className={styles.drawerContent}>
          <div className={styles.drawerContentInner}>
            <Accordion
              type="multiple"
              value={openAccordions}
              onValueChange={setOpenAccordions}
              className={styles.accordionContainer}
            >
              {/* Dados Gerais */}
              <AccordionItem
                value="dados-gerais"
                className={styles.accordionItem}
              >
                <AccordionTrigger className={styles.accordionTrigger}>
                  <span className={styles.fontMedium}>Dados gerais</span>
                </AccordionTrigger>
                <AccordionContent className={styles.accordionContent}>
                  <div className={styles.spaceY4}>
                    {/* Primeira linha */}
                    <div className={cn(styles.grid1Col, styles.mdGrid3Col)}>
                      <div className={styles.fieldContainer}>
                        <Label className={styles.fieldLabel}>
                          Tipo de pessoa *
                        </Label>
                        <Select
                          value={formData.tipoPessoa}
                          onValueChange={(value) =>
                            handleInputChange("tipoPessoa", value)
                          }
                        >
                          <SelectTrigger className={styles.selectField}>
                            <SelectValue className={styles.textWhite} />
                          </SelectTrigger>
                          <SelectContent className={styles.selectContent}>
                            <SelectItem
                              value="Jurídica"
                              className={styles.selectItem}
                            >
                              Jurídica
                            </SelectItem>
                            <SelectItem
                              value="Física"
                              className={styles.selectItem}
                            >
                              Física
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className={styles.fieldContainer}>
                        <Label className={styles.fieldLabel}>{formData.tipoPessoa === "Jurídica" ? "CNPJ" : "CPF"}</Label>
                        <div className={styles.inputWithButton}>
                          <Input
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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={buscarDadosCNPJ}
                              disabled={buscandoCnpj}
                              className={cn(styles.buttonOutline, styles.buttonSmall, buscandoCnpj && styles.buttonDisabled)}
                            >
                              {buscandoCnpj ? "Buscando..." : "Buscar dados"}
                            </Button>
                          )}
                        </div>
                        {erroCnpj && (
                          <p className={styles.errorMessage}>
                            {erroCnpj}
                          </p>
                        )}
                      </div>

                      <div className={styles.fieldContainer}>
                        <Label className={styles.fieldLabel}>
                          {formData.tipoPessoa === "Jurídica" ? "Nome fantasia *" : "Nome cliente *"}
                        </Label>
                        <div className={styles.flex} style={{ gap: '8px' }}>
                          <Input
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
                          <Label className={styles.fieldLabel}>
                            Tipo de papel *
                          </Label>
                        </div>
                        <div className={styles.checkboxContainer}>
                          <div className={styles.checkboxItem}>
                            <Checkbox
                              id="cliente"
                              checked={formData.tiposPapel.cliente}
                              onCheckedChange={(checked) =>
                                handleTipoPapelChange(
                                  "cliente",
                                  checked
                                )
                              }
                            />
                            <Label htmlFor="cliente" className={styles.checkboxLabel}>
                              Cliente
                            </Label>
                          </div>
                          <div className={styles.checkboxItem}>
                            <Checkbox
                              id="fornecedor"
                              checked={formData.tiposPapel.fornecedor}
                              onCheckedChange={(checked) =>
                                handleTipoPapelChange(
                                  "fornecedor",
                                  checked
                                )
                              }
                            />
                            <Label htmlFor="fornecedor" className={styles.checkboxLabel}>
                              Fornecedor
                            </Label>
                          </div>
                          <div className={styles.checkboxItem}>
                            <Checkbox
                              id="transportadora"
                              checked={formData.tiposPapel.transportadora}
                              onCheckedChange={(checked) =>
                                handleTipoPapelChange(
                                  "transportadora",
                                  checked
                                )
                              }
                            />
                            <Label
                              htmlFor="transportadora"
                              className={styles.checkboxLabel}
                            >
                              Transportadora
                            </Label>
                          </div>
                        </div>
                        <p className={styles.helpText}>
                          É possível selecionar mais de uma opção
                        </p>
                      </div>

                      <div className={styles.fieldContainer}>
                        <div className={styles.fieldLabelWithIcon}>
                          <Label className={styles.fieldLabel}>
                            Código do cadastro
                          </Label>
                        </div>
                        <Input
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
                </AccordionContent>
              </AccordionItem>

              {/* Informações Adicionais */}
              <AccordionItem
                value="informacoes-adicionais"
                className={styles.accordionItem}
              >
                <AccordionTrigger className={styles.accordionTrigger}>
                  <span className={styles.fontMedium}>Informações adicionais</span>
                </AccordionTrigger>
                <AccordionContent className={styles.accordionContent}>
                  <div className={cn(styles.grid1Col, styles.mdGrid2Col, styles.lgGrid4Col)}>
                    <div className={styles.fieldContainer}>
                      <Label className={styles.fieldLabel}>
                        E-mail principal
                      </Label>
                      <Input
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
                      <Label className={styles.fieldLabel}>
                        Telefone comercial
                      </Label>
                      <Input
                        value={formData.telefoneComercial}
                        onChange={(e) =>
                          handleInputChange("telefoneComercial", e.target.value)
                        }
                        placeholder="(11) 3333-3333"
                        className={cn(styles.inputField, styles.inputFieldLarge)}
                      />
                    </div>

                    <div className={styles.fieldContainer}>
                      <Label className={styles.fieldLabel}>
                        Telefone celular
                      </Label>
                      <Input
                        value={formData.telefoneCelular}
                        onChange={(e) =>
                          handleInputChange("telefoneCelular", e.target.value)
                        }
                        placeholder="(11) 99999-9999"
                        className={cn(styles.inputField, styles.inputFieldLarge)}
                      />
                    </div>

                    <div className={styles.fieldContainer}>
                      <Label className={styles.fieldLabel}>
                        Abertura da empresa
                      </Label>
                      <Input
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
                </AccordionContent>
              </AccordionItem>

              {/* Informações Fiscais */}
              <AccordionItem
                value="informacoes-fiscais"
                className={styles.accordionItem}
              >
                <AccordionTrigger className={styles.accordionTrigger}>
                  <span className={styles.fontMedium}>Informações fiscais</span>
                </AccordionTrigger>
                <AccordionContent className={styles.accordionContent}>
                  <div className={styles.spaceY4}>
                    {/* Primeira linha */}
                    <div className={cn(styles.grid1Col, styles.mdGrid2Col)}>
                      <div className={styles.fieldContainer}>
                        <Label className={styles.fieldLabel}>
                          Razão social
                        </Label>
                        <Input
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
                          <Label className={styles.fieldLabel}>
                            Optante pelo simples?
                          </Label>
                        </div>
                        <RadioGroup
                          value={formData.optanteSimples}
                          onValueChange={(value) =>
                            handleInputChange("optanteSimples", value)
                          }
                          className={styles.radioGroup}
                        >
                          <div className={styles.radioItem}>
                            <RadioGroupItem value="Não" id="nao" />
                            <Label htmlFor="nao" className={styles.radioLabel}>
                              Não
                            </Label>
                          </div>
                          <div className={styles.radioItem}>
                            <RadioGroupItem value="Sim" id="sim" />
                            <Label htmlFor="sim" className={styles.radioLabel}>
                              Sim
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>

                    {/* Segunda linha */}
                    <div className={cn(styles.grid1Col, styles.mdGrid2Col, styles.lgGrid4Col)}>
                      <div className={styles.fieldContainer}>
                        <Label className={styles.fieldLabel}>
                          Indicador de Inscrição estadual
                        </Label>
                        <Select
                          value={formData.indicadorInscricaoEstadual}
                          onValueChange={(value) =>
                            handleInputChange(
                              "indicadorInscricaoEstadual",
                              value
                            )
                          }
                        >
                          <SelectTrigger className={styles.selectField}>
                            <SelectValue
                              placeholder="Selecione"
                              className={styles.textWhite}
                            />
                          </SelectTrigger>
                          <SelectContent className={styles.selectContent}>
                            <SelectItem
                              value="contribuinte"
                              className={styles.selectItem}
                            >
                              Contribuinte ICMS
                            </SelectItem>
                            <SelectItem
                              value="isento"
                              className={styles.selectItem}
                            >
                              Isento
                            </SelectItem>
                            <SelectItem
                              value="nao-contribuinte"
                              className={styles.selectItem}
                            >
                              Não contribuinte
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className={styles.fieldContainer}>
                        <div className={styles.fieldLabelWithIcon}>
                          <Label className={styles.fieldLabel}>
                            Inscrição estadual
                          </Label>
                        </div>
                        <Input
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
                        <Label className={styles.fieldLabel}>
                          Inscrição municipal
                        </Label>
                        <Input
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
                        <Label className={styles.fieldLabel}>
                          Inscrição suframa
                        </Label>
                        <Input
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
                </AccordionContent>
              </AccordionItem>

              {/* Endereço */}
              <AccordionItem
                value="endereco"
                className={styles.accordionItem}
              >
                <AccordionTrigger className={styles.accordionTrigger}>
                  <span className={styles.fontMedium}>Endereço</span>
                </AccordionTrigger>
                <AccordionContent className={styles.accordionContent}>
                  <div className={styles.spaceY4}>
                    {/* Primeira linha */}
                    <div className={cn(styles.grid1Col, styles.mdGrid2Col, styles.lgGrid4Col)}>
                      <div className={styles.fieldContainer}>
                        <Label className={styles.fieldLabel}>País</Label>
                        <Input
                          value={formData.pais}
                          onChange={(e) =>
                            handleInputChange("pais", e.target.value)
                          }
                          placeholder="Brasil"
                          className={cn(styles.inputField, styles.inputFieldLarge)}
                        />
                      </div>

                      <div className={styles.fieldContainer}>
                        <Label className={styles.fieldLabel}>CEP</Label>
                        <div className={styles.inputWithButton}>
                          <Input
                            value={formData.cep}
                            onChange={(e) => {
                              const valor = e.target.value;
                              const formatado = formatarCEP(valor);
                              handleInputChange("cep", formatado);
                            }}
                            placeholder="00000-000"
                            className={cn(styles.inputField, styles.inputFieldLarge)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={buscarDadosCEP}
                            disabled={buscandoCep}
                            className={cn(styles.buttonOutline, styles.buttonSmall, buscandoCep && styles.buttonDisabled)}
                          >
                            {buscandoCep ? "Buscando..." : "Buscar dados"}
                          </Button>
                        </div>
                      </div>

                      <div className={styles.fieldContainer}>
                        <Label className={styles.fieldLabel}>
                          Endereço
                        </Label>
                        <Input
                          value={formData.endereco}
                          onChange={(e) =>
                            handleInputChange("endereco", e.target.value)
                          }
                          placeholder="Digite o endereço"
                          className={cn(styles.inputField, styles.inputFieldLarge)}
                        />
                      </div>

                      <div className={styles.fieldContainer}>
                        <Label className={styles.fieldLabel}>Número</Label>
                        <Input
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
                        <Label className={styles.fieldLabel}>Estado</Label>
                        <Select
                          value={formData.estado}
                          onValueChange={(value) =>
                            handleInputChange("estado", value)
                          }
                        >
                          <SelectTrigger className={styles.selectField}>
                            <SelectValue
                              placeholder="Selecione"
                              className={styles.textWhite}
                            />
                          </SelectTrigger>
                          <SelectContent className={styles.selectContent}>
                            {estados.map((estado) => (
                              <SelectItem
                                key={estado.id}
                                value={estado.sigla}
                                className={styles.selectItem}
                              >
                                {estado.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className={styles.fieldContainer}>
                        <Label className={styles.fieldLabel}>Cidade</Label>
                        <Select
                          value={formData.cidade}
                          onValueChange={(value) =>
                            handleInputChange("cidade", value)
                          }
                          disabled={!formData.estado}
                        >
                          <SelectTrigger
                            className={styles.selectField}
                            disabled={!formData.estado}
                          >
                            <SelectValue
                              placeholder={
                                formData.estado
                                  ? "Selecione a cidade"
                                  : "Selecione um estado primeiro"
                              }
                              className={styles.textWhite}
                            />
                          </SelectTrigger>
                          <SelectContent className={styles.selectContent}>
                            {cidades.map((cidade) => (
                              <SelectItem
                                key={cidade.id}
                                value={cidade.nome}
                                className={styles.selectItem}
                              >
                                {cidade.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className={styles.fieldContainer}>
                        <Label className={styles.fieldLabel}>Bairro</Label>
                        <Input
                          value={formData.bairro}
                          onChange={(e) =>
                            handleInputChange("bairro", e.target.value)
                          }
                          placeholder="Digite o bairro"
                          className={cn(styles.inputField, styles.inputFieldLarge)}
                        />
                      </div>

                      <div className={styles.fieldContainer}>
                        <Label className={styles.fieldLabel}>
                          Complemento
                        </Label>
                        <Input
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
                </AccordionContent>
              </AccordionItem>

              {/* Outros Contatos */}
              <AccordionItem
                value="outros-contatos"
                className={styles.accordionItem}
              >
                <AccordionTrigger className={styles.accordionTrigger}>
                  <span className={styles.fontMedium}>Outros contatos</span>
                </AccordionTrigger>
                <AccordionContent className={styles.accordionContent}>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removerContato(contato.id)}
                            className={styles.removeButton}
                          >
                            <Trash2 className={cn(styles.h4, styles.w4, styles.textRed400)} />
                          </Button>
                        </div>

                        <div className={cn(styles.grid1Col, styles.mdGrid2Col, styles.lgGrid5Col)}>
                          <div className={styles.fieldContainer}>
                            <Label className={styles.fieldLabel}>
                              Pessoa de contato
                            </Label>
                            <Input
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
                            <Label className={styles.fieldLabel}>
                              E-mail
                            </Label>
                            <Input
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
                            <Label className={styles.fieldLabel}>
                              Telefone comercial
                            </Label>
                            <Input
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
                            <Label className={styles.fieldLabel}>
                              Telefone celular
                            </Label>
                            <Input
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
                            <Label className={styles.fieldLabel}>
                              Cargo
                            </Label>
                            <Input
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

                    <Button
                      variant="outline"
                      onClick={adicionarContato}
                      className={styles.addContactButton}
                    >
                      <Plus className={cn(styles.h4, styles.w4, styles.mr2)} />
                      Adicionar contato
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Observações Gerais */}
              <AccordionItem
                value="observacoes-gerais"
                className={styles.accordionItem}
              >
                <AccordionTrigger className={styles.accordionTrigger}>
                  <span className={styles.fontMedium}>Observações gerais</span>
                </AccordionTrigger>
                <AccordionContent className={styles.accordionContent}>
                  <div className={styles.spaceY2}>
                    <Label className={styles.fieldLabel}>
                      Observações
                    </Label>
                    <Textarea
                      value={formData.observacoes}
                      onChange={(e) =>
                        handleInputChange("observacoes", e.target.value)
                      }
                      placeholder="Digite observações sobre o cliente"
                      className={cn(styles.textareaField, styles.textareaFieldLarge, styles.minH120px)}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.drawerFooter}>
          <Button
            variant="outline"
            onClick={handleClose}
            className={styles.cancelButton}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className={styles.saveButton}
          >
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
