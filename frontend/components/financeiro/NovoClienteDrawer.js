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
    onClose();
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

  const consultarSerasa = () => {
    console.log("Consultando no Serasa");
    // Aqui você implementaria a consulta no Serasa
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div
        className={cn(
          "w-full bg-[#1B1229] rounded-t-lg shadow-xl transition-transform duration-300 ease-out max-h-[90vh] overflow-hidden flex flex-col",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#673AB7]/20 bg-[#1B1229] sticky top-0 z-10">
          <h2 className="text-xl font-semibold text-white">Novo cadastro</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-[#B0AFC1] hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 bg-[#1B1229]">
            <Accordion
              type="multiple"
              value={openAccordions}
              onValueChange={setOpenAccordions}
              className="space-y-4"
            >
              {/* Dados Gerais */}
              <AccordionItem
                value="dados-gerais"
                className="bg-[#1B1229]/50 backdrop-blur-sm border border-[#673AB7]/20 rounded-lg"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline text-white">
                  <span className="font-medium">Dados gerais</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {/* Primeira linha */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white font-medium">
                          Tipo de pessoa *
                        </Label>
                        <Select
                          value={formData.tipoPessoa}
                          onValueChange={(value) =>
                            handleInputChange("tipoPessoa", value)
                          }
                        >
                          <SelectTrigger className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white hover:bg-[#1B1229]/50 focus:border-[#1E88E5] focus:ring-[#1E88E5]">
                            <SelectValue className="text-white" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1B1229] border-[#673AB7]/30">
                            <SelectItem
                              value="Jurídica"
                              className="text-white hover:bg-[#673AB7]/20 focus:bg-[#673AB7]/20"
                            >
                              Jurídica
                            </SelectItem>
                            <SelectItem
                              value="Física"
                              className="text-white hover:bg-[#673AB7]/20 focus:bg-[#673AB7]/20"
                            >
                              Física
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white font-medium">{formData.tipoPessoa === "Jurídica" ? "CNPJ" : "CPF"}</Label>
                        <div className="flex gap-2">
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
                            className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                          />
                          {formData.tipoPessoa === "Jurídica" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={buscarDadosCNPJ}
                              disabled={buscandoCnpj}
                              className="border-[#1E88E5] text-[#1E88E5] hover:bg-[#1E88E5] hover:text-white disabled:opacity-50"
                            >
                              {buscandoCnpj ? "Buscando..." : "Buscar dados"}
                            </Button>
                          )}
                        </div>
                        {erroCnpj && (
                          <p className="text-xs text-red-400 mt-1">
                            {erroCnpj}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white font-medium">
                          {formData.tipoPessoa === "Jurídica" ? "Nome fantasia *" : "Nome cliente *"}
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            value={formData.nomeFantasia}
                            onChange={(e) =>
                              handleInputChange("nomeFantasia", e.target.value)
                            }
                            placeholder={formData.tipoPessoa === "Jurídica" ? "Digite o nome fantasia" : "Digite o nome do cliente"}
                            className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                          />
                          <Button
                            disabled
                            variant="outline"
                            size="sm"
                            onClick={consultarSerasa}
                            className="border-[#673AB7] text-[#673AB7] hover:bg-[#673AB7] hover:text-white"
                          >
                            <Search className="h-4 w-4 mr-1" />
                            Consultar no Serasa
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#B0AFC1] hover:text-[#1E88E5]"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Segunda linha */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-white font-medium">
                            Tipo de papel *
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#B0AFC1] hover:text-[#1E88E5]"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
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
                            <Label htmlFor="cliente" className="text-white">
                              Cliente
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
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
                            <Label htmlFor="fornecedor" className="text-white">
                              Fornecedor
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
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
                              className="text-white"
                            >
                              Transportadora
                            </Label>
                          </div>
                        </div>
                        <p className="text-xs text-[#B0AFC1]">
                          É possível selecionar mais de uma opção
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-white font-medium">
                            Código do cadastro
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#B0AFC1] hover:text-[#1E88E5]"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          value={formData.codigoCadastro}
                          onChange={(e) =>
                            handleInputChange("codigoCadastro", e.target.value)
                          }
                          placeholder="Digite o código"
                          className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Informações Adicionais */}
              <AccordionItem
                value="informacoes-adicionais"
                className="bg-[#1B1229]/50 backdrop-blur-sm border border-[#673AB7]/20 rounded-lg"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline text-white">
                  <span className="font-medium">Informações adicionais</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-white font-medium">
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
                        className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white font-medium">
                        Telefone comercial
                      </Label>
                      <Input
                        value={formData.telefoneComercial}
                        onChange={(e) =>
                          handleInputChange("telefoneComercial", e.target.value)
                        }
                        placeholder="(11) 3333-3333"
                        className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white font-medium">
                        Telefone celular
                      </Label>
                      <Input
                        value={formData.telefoneCelular}
                        onChange={(e) =>
                          handleInputChange("telefoneCelular", e.target.value)
                        }
                        placeholder="(11) 99999-9999"
                        className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white font-medium">
                        Abertura da empresa
                      </Label>
                      <div className="relative">
                        <Input
                          value={formData.aberturaEmpresa}
                          onChange={(e) =>
                            handleInputChange("aberturaEmpresa", e.target.value)
                          }
                          placeholder="dd/mm/aaaa"
                          className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                        />
                        <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#B0AFC1]" />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Informações Fiscais */}
              <AccordionItem
                value="informacoes-fiscais"
                className="bg-[#1B1229]/50 backdrop-blur-sm border border-[#673AB7]/20 rounded-lg"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline text-white">
                  <span className="font-medium">Informações fiscais</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {/* Primeira linha */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white font-medium">
                          Razão social
                        </Label>
                        <Input
                          value={formData.razaoSocial}
                          onChange={(e) =>
                            handleInputChange("razaoSocial", e.target.value)
                          }
                          placeholder="Digite a razão social"
                          className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-white font-medium">
                            Optante pelo simples?
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#B0AFC1] hover:text-[#1E88E5]"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                        <RadioGroup
                          value={formData.optanteSimples}
                          onValueChange={(value) =>
                            handleInputChange("optanteSimples", value)
                          }
                          className="flex gap-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Não" id="nao" />
                            <Label htmlFor="nao" className="text-white">
                              Não
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Sim" id="sim" />
                            <Label htmlFor="sim" className="text-white">
                              Sim
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>

                    {/* Segunda linha */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white font-medium">
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
                          <SelectTrigger className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white hover:bg-[#1B1229]/50 focus:border-[#1E88E5] focus:ring-[#1E88E5]">
                            <SelectValue
                              placeholder="Selecione"
                              className="text-white"
                            />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1B1229] border-[#673AB7]/30">
                            <SelectItem
                              value="contribuinte"
                              className="text-white hover:bg-[#673AB7]/20 focus:bg-[#673AB7]/20"
                            >
                              Contribuinte ICMS
                            </SelectItem>
                            <SelectItem
                              value="isento"
                              className="text-white hover:bg-[#673AB7]/20 focus:bg-[#673AB7]/20"
                            >
                              Isento
                            </SelectItem>
                            <SelectItem
                              value="nao-contribuinte"
                              className="text-white hover:bg-[#673AB7]/20 focus:bg-[#673AB7]/20"
                            >
                              Não contribuinte
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-white font-medium">
                            Inscrição estadual
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#B0AFC1] hover:text-[#1E88E5]"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
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
                          className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white font-medium">
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
                          className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white font-medium">
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
                          className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Endereço */}
              <AccordionItem
                value="endereco"
                className="bg-[#1B1229]/50 backdrop-blur-sm border border-[#673AB7]/20 rounded-lg"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline text-white">
                  <span className="font-medium">Endereço</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {/* Primeira linha */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white font-medium">País</Label>
                        <Input
                          value={formData.pais}
                          onChange={(e) =>
                            handleInputChange("pais", e.target.value)
                          }
                          placeholder="Brasil"
                          className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white font-medium">CEP</Label>
                        <div className="flex gap-2">
                          <Input
                            value={formData.cep}
                            onChange={(e) => {
                              const valor = e.target.value;
                              const formatado = formatarCEP(valor);
                              handleInputChange("cep", formatado);
                            }}
                            placeholder="00000-000"
                            className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={buscarDadosCEP}
                            disabled={buscandoCep}
                            className="border-[#1E88E5] text-[#1E88E5] hover:bg-[#1E88E5] hover:text-white disabled:opacity-50"
                          >
                            {buscandoCep ? "Buscando..." : "Buscar dados"}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white font-medium">
                          Endereço
                        </Label>
                        <Input
                          value={formData.endereco}
                          onChange={(e) =>
                            handleInputChange("endereco", e.target.value)
                          }
                          placeholder="Digite o endereço"
                          className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white font-medium">Número</Label>
                        <Input
                          value={formData.numero}
                          onChange={(e) =>
                            handleInputChange("numero", e.target.value)
                          }
                          placeholder="123"
                          className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                        />
                      </div>
                    </div>

                    {/* Segunda linha */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label className="text-white font-medium">Estado</Label>
                        <Select
                          value={formData.estado}
                          onValueChange={(value) =>
                            handleInputChange("estado", value)
                          }
                        >
                          <SelectTrigger className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white hover:bg-[#1B1229]/50 hover:text-[#1E88E5] focus:border-[#1E88E5] focus:ring-[#1E88E5]">
                            <SelectValue
                              placeholder="Selecione"
                              className="text-white"
                            />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1B1229] border-[#673AB7]/30">
                            {estados.map((estado) => (
                              <SelectItem
                                key={estado.id}
                                value={estado.sigla}
                                className="text-white hover:bg-[#673AB7]/20 hover:text-[#1E88E5] focus:bg-[#673AB7]/20 focus:text-[#1E88E5]"
                              >
                                {estado.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white font-medium">Cidade</Label>
                        <Select
                          value={formData.cidade}
                          onValueChange={(value) =>
                            handleInputChange("cidade", value)
                          }
                          disabled={!formData.estado}
                        >
                          <SelectTrigger
                            className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white hover:bg-[#1B1229]/50 hover:text-[#1E88E5] focus:border-[#1E88E5] focus:ring-[#1E88E5]"
                            disabled={!formData.estado}
                          >
                            <SelectValue
                              placeholder={
                                formData.estado
                                  ? "Selecione a cidade"
                                  : "Selecione um estado primeiro"
                              }
                              className="text-white"
                            />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1B1229] border-[#673AB7]/30">
                            {cidades.map((cidade) => (
                              <SelectItem
                                key={cidade.id}
                                value={cidade.nome}
                                className="text-white hover:bg-[#673AB7]/20 hover:text-[#1E88E5] focus:bg-[#673AB7]/20 focus:text-[#1E88E5]"
                              >
                                {cidade.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white font-medium">Bairro</Label>
                        <Input
                          value={formData.bairro}
                          onChange={(e) =>
                            handleInputChange("bairro", e.target.value)
                          }
                          placeholder="Digite o bairro"
                          className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]">
                          Complemento
                        </Label>
                        <Input
                          value={formData.complemento}
                          onChange={(e) =>
                            handleInputChange("complemento", e.target.value)
                          }
                          placeholder="Apto, sala, etc."
                          className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]"
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Outros Contatos */}
              <AccordionItem
                value="outros-contatos"
                className="bg-[#1B1229]/50 backdrop-blur-sm border border-[#673AB7]/20 rounded-lg"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline text-white">
                  <span className="font-medium">Outros contatos</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {formData.outrosContatos.map((contato, index) => (
                      <div
                        key={contato.id}
                        className="border rounded-lg p-4 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-white">
                            Contato {index + 1}
                          </h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removerContato(contato.id)}
                          >
                            <Trash2 className="h-4 w-4 text-[#F50057]" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                          <div className="space-y-2">
                            <Label className="bg-[#1B1229]/30 border-[#673AB7]/30 text-white placeholder:text-[#B0AFC1] focus:border-[#1E88E5]">
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
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-white font-medium">
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
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-white font-medium">
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
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-white font-medium">
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
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-white font-medium">
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
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      onClick={adicionarContato}
                      className="w-full border-[#9C27B0] text-[#9C27B0] hover:bg-[#9C27B0] hover:text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar contato
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Observações Gerais */}
              <AccordionItem
                value="observacoes-gerais"
                className="bg-[#1B1229]/50 backdrop-blur-sm border border-[#673AB7]/20 rounded-lg"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline text-white">
                  <span className="font-medium">Observações gerais</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-2">
                    <Label className="text-white font-medium">
                      Observações
                    </Label>
                    <Textarea
                      value={formData.observacoes}
                      onChange={(e) =>
                        handleInputChange("observacoes", e.target.value)
                      }
                      placeholder="Digite observações sobre o cliente"
                      className="min-h-[120px]"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-[#673AB7]/20 bg-[#1B1229] sticky bottom-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-[#673AB7] text-[#B0AFC1] hover:bg-[#673AB7]/10"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="bg-[#1E88E5] hover:bg-[#1976D2] text-white"
          >
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
