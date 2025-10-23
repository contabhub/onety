"use client";

import { useState, useEffect } from "react";
import styles from "../../styles/financeiro/nova-venda.module.css";
import { Button } from "./botao";
import { Input } from "./input";
import { Label } from "./label";
import { Textarea } from "./textarea";
// Select components removidos - agora usando ReactSelect
import { Calendar } from "./calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "./toggle-group";
import {
  X,
  Calendar as CalendarIcon,
  ChevronDown,
  Info,
  Plus,
  Zap,
  Diamond,
  HelpCircle,
  Loader2,
} from "lucide-react";
// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useVendaFormData } from '../../hooks/financeiro/useVendaFormData';
import { useVendas } from '../../hooks/financeiro/useVenda';
import NovoProdutoServicoDrawer from "./NovoProdutoServicoDrawer";
import { toast } from 'react-toastify';
import ReactSelect from "react-select";

export function NovaVendaDrawer({ isOpen, onClose, onSave }) {
  const { formData: formDataFromAPI, isLoading: isLoadingFormData, error: formDataError } = useVendaFormData();
  const [contasApi, setContasApi] = useState([]);
  const { criarVenda } = useVendas();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isNovoProdutoServicoOpen, setIsNovoProdutoServicoOpen] = useState(false);
  const [formData, setFormData] = useState({
    tipoVenda: "venda-avulsa",
    situacao: "aprovado",
    numeroVenda: "3",
    cliente: "",
    dataVenda: new Date(),
    categoriaFinanceira: "",
    subCategoria: "",
    centroCusto: "",
    vendedor: "",
    descontoTipo: "reais",
    descontoValor: "0,00",
    formaPagamento: "",
    contaRecebimento: "",
    percentual: "100",
    valorReceber: "0,00",
    condicaoPagamento: "a-vista",
    vencimento: new Date(),
    observacoesPagamento: "",
    naturezaOperacao: "",
    observacoesFiscais: "",
    // Campos de recorrência
    tipoIntervalo: "meses",
    intervalo: "1",
    indeterminado: true,
    totalCiclos: "",
    terminoRecorrencia: "indeterminado",
    dataTermino: null,
    // Campos de boleto e e-mail
    gerarBoleto: false,
    contaCorrente: "",
    enviarEmail: false,
    clienteEmail: "",
  });

  const [itens, setItens] = useState([
    {
      id: "1",
      produtoServico: "",
      detalhes: "",
      quantidade: "1,00",
      valorUnitario: "",
      total: "",
    },
  ]);

  // Atualizar vendedor automaticamente com o userId do localStorage
  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (userId) {
      setFormData(prev => ({
        ...prev,
        vendedor: userId
      }));
    }
  }, []);

  // Mostrar erro se houver problema ao carregar dados
  useEffect(() => {
    if (formDataError) {
      toast({
        title: "Erro ao carregar dados",
        description: formDataError,
        variant: "destructive",
      });
    }
  }, [formDataError, toast]);

  // Buscar contas API quando o drawer abrir
  useEffect(() => {
    if (isOpen) {
      fetchContasApi();
    }
  }, [isOpen]);

  const fetchContasApi = async () => {
    const empresaId = localStorage.getItem("empresaId");
    const token = localStorage.getItem("token");
    const API = process.env.NEXT_PUBLIC_API_URL;

    if (!empresaId || !token || !API) return;

    try {
      const response = await fetch(`${API}/contas-api/company/${empresaId}/contas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const json = await response.json();
        const lista = Array.isArray(json) ? json : Array.isArray(json.contas) ? json.contas : [];
        setContasApi(lista);
      }
    } catch (error) {
      console.error("Erro ao buscar contas API:", error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleItemChange = (id, field, value) => {
    setItens(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Calcular total se quantidade e valor unitário estiverem preenchidos
        if (field === 'quantidade' || field === 'valorUnitario') {
          const quantidade = parseFloat(updatedItem.quantidade.replace(',', '.')) || 0;
          const valorUnitario = parseFloat(updatedItem.valorUnitario.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
          updatedItem.total = (quantidade * valorUnitario).toFixed(2).replace('.', ',');
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const addItem = () => {
    const newItem = {
      id: Date.now().toString(),
      produtoServico: "",
      detalhes: "",
      quantidade: "1,00",
      valorUnitario: "",
      total: "",
    };
    setItens(prev => [...prev, newItem]);
  };

  const removeItem = (id) => {
    if (itens.length > 1) {
      setItens(prev => prev.filter(item => item.id !== id));
    }
  };

  const calcularTotalItens = () => {
    return itens.reduce((total, item) => {
      const valor = parseFloat(item.total.replace(',', '.')) || 0;
      return total + valor;
    }, 0);
  };

  const calcularDesconto = () => {
    const totalItens = calcularTotalItens();
    const descontoValor = parseFloat(formData.descontoValor.replace(',', '.')) || 0;
    
    if (formData.descontoTipo === 'reais') {
      return descontoValor;
    } else {
      return (totalItens * descontoValor) / 100;
    }
  };

  const calcularTotalFinal = () => {
    const totalItens = calcularTotalItens();
    const desconto = calcularDesconto();
    return totalItens - desconto;
  };

  const handleNovoProdutoServicoSuccess = () => {
    // Recarregar os dados de produtos/serviços após criar um novo
    // Como estamos usando o hook useVendaFormData, vamos mostrar uma mensagem de sucesso
    toast({
      title: "Produto/Serviço criado!",
      description: "O novo produto/serviço foi adicionado com sucesso. A lista será atualizada automaticamente.",
    });
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 400);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      console.log("🔍 Iniciando salvamento da venda");
      console.log("📋 FormData:", formData);
      console.log("📦 Itens:", itens);

      // Validações básicas
      if (!formData.cliente) {
        console.log("❌ Validação falhou: cliente não selecionado");
        toast({
          title: "Campo obrigatório",
          description: "Selecione um cliente",
          variant: "destructive",
        });
        return;
      }

      if (!formData.dataVenda) {
        console.log("❌ Validação falhou: data de venda não selecionada");
        toast({
          title: "Campo obrigatório",
          description: "Selecione uma data de venda",
          variant: "destructive",
        });
        return;
      }

      // Verificar se pelo menos um item tem produto/serviço
      const itemComProduto = itens.find(item => item.produtoServico && item.produtoServico.trim() !== '');
      if (!itemComProduto) {
        console.log("❌ Validação falhou: nenhum produto/serviço selecionado");
        toast({
          title: "Campo obrigatório",
          description: "Adicione pelo menos um produto ou serviço",
          variant: "destructive",
        });
        return;
      }
      console.log("✅ Produto/serviço selecionado:", itemComProduto);

      // Verificar se todos os itens com produto selecionado têm quantidade e valor
      const itensIncompletos = itens.filter(item => 
        item.produtoServico && 
        item.produtoServico.trim() !== '' && 
        (!item.quantidade || 
         !item.valorUnitario || 
         parseFloat(item.quantidade.replace(',', '.')) <= 0 ||
         parseFloat(item.valorUnitario.replace(/[^\d,.-]/g, '').replace(',', '.')) <= 0)
      );
      
      if (itensIncompletos.length > 0) {
        console.log("❌ Validação falhou: itens incompletos:", itensIncompletos);
        toast({
          title: "Dados incompletos",
          description: "Preencha quantidade e valor válidos para todos os produtos/serviços selecionados",
          variant: "destructive",
        });
        return;
      }
      console.log("✅ Todos os itens estão completos");

      // Validar campos de recorrência se for venda recorrente
      if (formData.tipoVenda === "venda-recorrente") {
        if (!formData.tipoIntervalo || !formData.intervalo) {
          toast({
            title: "Campo obrigatório",
            description: "Preencha os campos de recorrência obrigatórios",
            variant: "destructive",
          });
          return;
        }

        if (!formData.indeterminado && !formData.totalCiclos) {
          toast({
            title: "Campo obrigatório",
            description: "Para recorrência personalizada, informe o total de ciclos",
            variant: "destructive",
          });
          return;
        }
      }

      // Validar campos de boleto e e-mail
      if (formData.gerarBoleto && !formData.contaCorrente) {
        toast({
          title: "Campo obrigatório",
          description: "Informe a conta corrente para gerar o boleto",
          variant: "destructive",
        });
        return;
      }

      if (formData.enviarEmail && !formData.clienteEmail) {
        toast({
          title: "Campo obrigatório",
          description: "Informe o e-mail do cliente para enviar a cobrança",
          variant: "destructive",
        });
        return;
      }

      // Processar conta de recebimento (ERP ou API)
      const isApi = formData.contaRecebimento?.startsWith('api:');
      const isErp = formData.contaRecebimento?.startsWith('erp:');
      const contaIdParsed = isErp ? parseInt(formData.contaRecebimento.split(':')[1]) : null;
      const contaApiIdParsed = isApi ? parseInt(formData.contaRecebimento.split(':')[1]) : null;

      // Buscar dados do cliente para boleto e e-mail
      const clienteSelecionado = formDataFromAPI.clientes.find(c => c.id.toString() === formData.cliente);
      
      const dataToSave = {
        tipo_venda: formData.tipoVenda === "venda-avulsa" ? "venda_avulsa" : 
                   formData.tipoVenda === "venda-recorrente" ? "venda_recorrente" : "orçamento",
        cliente_id: parseInt(formData.cliente),
        categoria_id: formData.categoriaFinanceira ? parseInt(formData.categoriaFinanceira) : null,
        sub_categoria_id: formData.subCategoria ? parseInt(formData.subCategoria) : null,
        produtos_servicos_id: itens.find(item => item.produtoServico)?.produtoServico ? parseInt(itens.find(item => item.produtoServico).produtoServico) : null,
        company_id: parseInt(localStorage.getItem("empresaId") || "0"),
        centro_de_custo_id: formData.centroCusto ? parseInt(formData.centroCusto) : null,
        vendedor_id: parseInt(formData.vendedor),
        data_venda: format(formData.dataVenda, 'yyyy-MM-dd'),
        situacao: formData.situacao,
        valor_venda: calcularTotalFinal(),
        desconto_venda: calcularDesconto(),
        pagamento: formData.formaPagamento,
        conta_recebimento: contaIdParsed,
        conta_recebimento_api: contaApiIdParsed,
        parcelamento: formData.condicaoPagamento,
        vencimento: format(formData.vencimento, 'yyyy-MM-dd'),
        observacoes: formData.observacoesPagamento,
        natureza: formData.naturezaOperacao,
        observacoes_fiscais: formData.observacoesFiscais,
        // Dados de recorrência (se for venda recorrente)
        recorrencia: formData.tipoVenda === "venda-recorrente" ? {
          tipo_intervalo: formData.tipoIntervalo,
          intervalo: parseInt(formData.intervalo),
          indeterminado: formData.indeterminado,
          total_ciclos: formData.indeterminado ? null : parseInt(formData.totalCiclos),
          status: "ativo"
        } : null,
        // Dados de boleto
        boleto: formData.gerarBoleto ? {
          conta_corrente: formData.contaCorrente,
        } : null,
        // Dados de e-mail
        email: formData.enviarEmail,
        cliente_nome: clienteSelecionado?.nome_fantasia || "",
        cliente_cpf_cnpj: "", // Adicionar campo se necessário
        cliente_email: formData.clienteEmail,
      };

      console.log("📤 Dados sendo enviados para criarVenda:", dataToSave);
      console.log("🔍 Verificando dados de recorrência:");
      console.log("   - tipoVenda:", formData.tipoVenda);
      console.log("   - tipo_venda no dataToSave:", dataToSave.tipo_venda);
      console.log("   - recorrencia no dataToSave:", dataToSave.recorrencia);
      
      console.log("🚀 Chamando criarVenda...");
      const result = await criarVenda(dataToSave);
      console.log("✅ Resultado da API:", result);

      toast({
        title: "Sucesso!",
        description: "Venda criada com sucesso!",
      });
      onSave(dataToSave);
      handleClose();
    } catch (error) {
      console.error("❌ Erro ao salvar venda:", error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao salvar a venda",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className={cn(
          styles.novaVendaOverlay,
          isClosing && styles.closing
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleClose();
          }
        }}
      >
        <div
          className={cn(
            styles.novaVendaModal,
            isClosing && styles.closing
          )}
        >
          {/* Handle para indicar que pode ser arrastado */}
          <div className={styles.novaVendaHandle}></div>
          
          {/* Header */}
          <div className={styles.novaVendaHeader}>
            <div>
              <h2 className={styles.novaVendaTitle}>Nova Venda</h2>
              <p className={styles.novaVendaTextSecondary}>
                Preencha as informações da venda
              </p>
            </div>
            <button
              onClick={handleClose}
              className={styles.novaVendaCloseButton}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className={styles.novaVendaContent}>
            {isLoadingFormData && (
              <div className={styles.novaVendaLoading}>
                <div className={styles.novaVendaLoadingSpinner}></div>
                <span>Carregando dados...</span>
              </div>
            )}

          {!isLoadingFormData && (
            <>
              {/* Seção Informações */}
              <div className={styles.novaVendaSection}>
                <h3 className={styles.novaVendaSectionTitle}>Informações</h3>
                
                <div className={styles.novaVendaGrid2Colunas}>
                  {/* Situação da negociação */}
                  <div className={styles.novaVendaField}>
                    <Label className={styles.novaVendaLabel}>
                      Situação da negociação <span className={styles.novaVendaLabelRequired}>*</span>
                    </Label>
                    <ReactSelect
                      className="react-select-container"
                      classNamePrefix="react-select"
                      placeholder="Selecione a situação"
                      value={
                        formData.situacao
                          ? {
                              value: formData.situacao,
                              label: formData.situacao === "aprovado" ? "Venda liberada" :
                                     formData.situacao === "em_andamento" ? "Em andamento" :
                                     formData.situacao === "recusado" ? "Recusado" : formData.situacao
                            }
                          : null
                      }
                      onChange={(selected) => {
                        handleInputChange(
                          "situacao",
                          selected ? selected.value : ""
                        );
                      }}
                      options={[
                        { value: "aprovado", label: "Venda liberada" },
                        { value: "em_andamento", label: "Em andamento" },
                        { value: "recusado", label: "Recusado" }
                      ]}
                      isClearable
                    />
                  </div>

                  {/* Número da venda */}
                  <div className={styles.novaVendaField}>
                    <Label className={styles.novaVendaLabel}>
                      Número da venda <span className={styles.novaVendaLabelRequired}>*</span>
                    </Label>
                      <Input
                        value={formData.numeroVenda}
                        onChange={(e) => handleInputChange('numeroVenda', e.target.value)}
                        className={styles.novaVendaInput}
                      />
                  </div>

                  {/* Cliente */}
                  <div className={styles.novaVendaField}>
                    <Label className={styles.novaVendaLabel}>
                      Cliente <span className={styles.novaVendaLabelRequired}>*</span>
                    </Label>
                    <ReactSelect
                      className="react-select-container"
                      classNamePrefix="react-select"
                      placeholder="Selecione o cliente"
                      value={
                        formDataFromAPI.clientes.find(
                          (cliente) => cliente.id.toString() === formData.cliente
                        )
                          ? {
                              value: formData.cliente,
                              label: formDataFromAPI.clientes.find(
                                (cliente) => cliente.id.toString() === formData.cliente
                              )?.nome_fantasia,
                            }
                          : null
                      }
                      onChange={(selected) => {
                        handleInputChange(
                          "cliente",
                          selected ? selected.value : ""
                        );
                      }}
                      options={formDataFromAPI.clientes.map((cliente) => ({
                        value: cliente.id.toString(),
                        label: cliente.nome_fantasia,
                      }))}
                      isClearable
                    />
                  </div>

                  {/* Data de venda */}
                  <div className={styles.novaVendaField}>
                    <Label className={styles.novaVendaLabel}>
                      Data de venda <span className={styles.novaVendaLabelRequired}>*</span>
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={cn(
                            "theme-input",
                            styles.novaVendaDateInput,
                            !formData.dataVenda && styles.novaVendaTextSecondary
                          )}
                        >
                          <CalendarIcon className={styles.novaVendaCalendarIcon} />
                          {formData.dataVenda ? (
                            format(formData.dataVenda, "dd/MM/yyyy", { locale: ptBR })
                          ) : (
                            <span>Selecione uma data</span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="theme-modal">
                        <Calendar
                          mode="single"
                          selected={formData.dataVenda}
                          onSelect={(date) => handleInputChange('dataVenda', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Categoria financeira */}
                  <div className={styles.novaVendaField}>
                    <Label className={styles.novaVendaLabel}>
                      Categoria financeira <HelpCircle className={styles.novaVendaIcon} />
                    </Label>
                    <ReactSelect
                      className="react-select-container"
                      classNamePrefix="react-select"
                      placeholder="Selecione a categoria"
                      value={
                        formDataFromAPI.categorias.find(
                          (categoria) => categoria.id.toString() === formData.categoriaFinanceira
                        )
                          ? {
                              value: formData.categoriaFinanceira,
                              label: formDataFromAPI.categorias.find(
                                (categoria) => categoria.id.toString() === formData.categoriaFinanceira
                              )?.nome,
                            }
                          : null
                      }
                      onChange={(selected) => {
                        handleInputChange(
                          "categoriaFinanceira",
                          selected ? selected.value : ""
                        );
                      }}
                      options={formDataFromAPI.categorias.map((categoria) => ({
                        value: categoria.id.toString(),
                        label: categoria.nome,
                      }))}
                      isClearable
                    />
                  </div>

                  {/* Sub-categoria */}
                  <div className={styles.novaVendaField}>
                    <Label className={styles.novaVendaLabel}>
                      Sub-categoria <HelpCircle className={styles.novaVendaIcon} />
                    </Label>
                    <ReactSelect
                      className="react-select-container"
                      classNamePrefix="react-select"
                      placeholder="Selecione a sub-categoria"
                      value={
                        formDataFromAPI.subCategorias.find(
                          (subCategoria) => subCategoria.id.toString() === formData.subCategoria
                        )
                          ? {
                              value: formData.subCategoria,
                              label: formDataFromAPI.subCategorias.find(
                                (subCategoria) => subCategoria.id.toString() === formData.subCategoria
                              )?.nome,
                            }
                          : null
                      }
                      onChange={(selected) => {
                        handleInputChange(
                          "subCategoria",
                          selected ? selected.value : ""
                        );
                      }}
                      options={formDataFromAPI.subCategorias.map((subCategoria) => ({
                        value: subCategoria.id.toString(),
                        label: subCategoria.nome,
                      }))}
                      isClearable
                    />
                  </div>

                   {/* Centro de custo */}
                  <div className={styles.novaVendaField}>
                    <Label className={styles.novaVendaLabel}>
                      Centro de custo <HelpCircle className={styles.novaVendaIcon} />
                     </Label>
                    <ReactSelect
                      className="react-select-container"
                      classNamePrefix="react-select"
                      placeholder="Selecione o centro de custo"
                      value={
                        formDataFromAPI.centrosCusto.find(
                          (centro) => centro.id.toString() === formData.centroCusto
                        )
                          ? {
                              value: formData.centroCusto,
                              label: formDataFromAPI.centrosCusto.find(
                                (centro) => centro.id.toString() === formData.centroCusto
                              )?.nome,
                            }
                          : null
                      }
                      onChange={(selected) => {
                        handleInputChange(
                          "centroCusto",
                          selected ? selected.value : ""
                        );
                      }}
                      options={formDataFromAPI.centrosCusto.map((centro) => ({
                        value: centro.id.toString(),
                        label: centro.nome,
                      }))}
                      isClearable
                    />
                   </div>

                   {/* Vendedor responsável */}
                  <div className={cn(styles.novaVendaField, styles.novaVendaVendedorField)}>
                    <Label className={styles.novaVendaLabel}>Vendedor responsável</Label>
                    <ReactSelect
                      className="react-select-container"
                      classNamePrefix="react-select"
                      placeholder="Selecione o vendedor"
                      value={
                        formDataFromAPI.users.find(
                          (user) => user.id.toString() === formData.vendedor
                        )
                          ? {
                              value: formData.vendedor,
                              label: formDataFromAPI.users.find(
                                (user) => user.id.toString() === formData.vendedor
                              )?.name,
                            }
                          : null
                      }
                      onChange={(selected) => {
                        handleInputChange(
                          "vendedor",
                          selected ? selected.value : ""
                        );
                      }}
                      options={formDataFromAPI.users.map((user) => ({
                        value: user.id.toString(),
                        label: user.name,
                      }))}
                      isClearable
                    />
                   </div>
                </div>
              </div>

              {/* Seção Itens */}
              <div className={styles.novaVendaSection}>
                <h3 className={styles.novaVendaSectionTitle}>Itens</h3>
                
                <div className={styles.novaVendaCard}>
                  <div className={styles.novaVendaCardHeader}>
                    <span className={styles.novaVendaTextSecondary}>
                      Nenhuma tabela de preço aplicada à venda.
                    </span>
                    <button className={styles.novaVendaButtonPrimary}>
                      <Diamond className={styles.novaVendaIcon} />
                      Aplicar tabela de preços à venda
                    </button>
                  </div>

                  <div className={styles.novaVendaCardContent}>
                    <div className={styles.novaVendaTable}>
                      <thead>
                        <tr>
                          <th>Detalhes do item <HelpCircle className={styles.novaVendaIcon} /></th>
                          <th>Quantidade <span className={styles.novaVendaLabelRequired}>*</span></th>
                          <th>Valor unitário <span className={styles.novaVendaLabelRequired}>*</span></th>
                          <th>Total <span className={styles.novaVendaLabelRequired}>*</span></th>
                        </tr>
                      </thead>
                      <tbody>

                        {itens.map((item, index) => (
                          <tr key={item.id} className={styles.novaVendaTableRow}>
                            <td>
                              <div className={styles.novaVendaItemContainer}>
                                <div className={styles.novaVendaItemSelect}>
                                  <ReactSelect
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    placeholder="Selecione produto/serviço"
                                    value={
                                      formDataFromAPI.produtosServicos.find(
                                        (produto) => produto.id.toString() === item.produtoServico
                                      )
                                        ? {
                                            value: item.produtoServico,
                                            label: formDataFromAPI.produtosServicos.find(
                                              (produto) => produto.id.toString() === item.produtoServico
                                            )?.nome,
                                          }
                                        : null
                                    }
                                    onChange={(selected) => {
                                      handleItemChange(
                                        item.id,
                                        "produtoServico",
                                        selected ? selected.value : ""
                                      );
                                    }}
                                    options={formDataFromAPI.produtosServicos.map((produto) => ({
                                      value: produto.id.toString(),
                                      label: produto.nome,
                                    }))}
                                    isClearable
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setIsNovoProdutoServicoOpen(true)}
                                  className={styles.novaVendaButton}
                                  title="Adicionar novo produto/serviço"
                                >
                                  <Plus className={styles.novaVendaIcon} />
                                </button>
                              </div>
                            </td>
                            <td>
                              <Input
                                value={item.detalhes}
                                onChange={(e) => handleItemChange(item.id, 'detalhes', e.target.value)}
                                placeholder="Detalhes do item"
                                className={styles.novaVendaInput}
                              />
                            </td>
                            <td>
                              <Input
                                value={item.quantidade}
                                onChange={(e) => handleItemChange(item.id, 'quantidade', e.target.value)}
                                placeholder="1,00"
                                className={styles.novaVendaInput}
                              />
                            </td>
                            <td>
                              <div className={styles.novaVendaInputContainer}>
                                <Input
                                  value={item.valorUnitario}
                                  onChange={(e) => handleItemChange(item.id, 'valorUnitario', e.target.value)}
                                  placeholder="0,00"
                                  className={cn(styles.novaVendaInput, styles.novaVendaCurrencyInput)}
                                />
                                <span className={styles.novaVendaCurrencySymbol}>R$</span>
                              </div>
                            </td>
                            <td>
                              <div className={styles.novaVendaTotalContainer}>
                                <Input
                                  value={item.total}
                                  onChange={(e) => handleItemChange(item.id, 'total', e.target.value)}
                                  placeholder="0,00"
                                  className={cn(styles.novaVendaInput, styles.novaVendaCurrencyInput)}
                                  readOnly
                                />
                                <span className={styles.novaVendaCurrencySymbol}>R$</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </div>

                    <button
                      onClick={addItem}
                      className={styles.novaVendaAddItemButton}
                    >
                      <Plus className={styles.novaVendaIcon} />
                      Adicionar nova linha
                    </button>
                  </div>
                </div>
              </div>

              {/* Seção Configurações de recorrência (apenas para venda recorrente) */}
              {formData.tipoVenda === "venda-recorrente" && (
                <div className={styles.novaVendaSection}>
                  <h3 className={styles.novaVendaSectionTitle}>Configurações de recorrência</h3>
                  
                  <div className={styles.novaVendaGrid2Colunas}>
                    {/* Tipo de intervalo */}
                    <div className={styles.novaVendaField}>
                      <Label className={styles.novaVendaLabel}>
                        Tipo de intervalo <span className={styles.novaVendaLabelRequired}>*</span>
                      </Label>
                      <ReactSelect
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder="Selecione o tipo"
                        value={
                          formData.tipoIntervalo
                            ? {
                                value: formData.tipoIntervalo,
                                label: formData.tipoIntervalo === "dias" ? "Dias" :
                                       formData.tipoIntervalo === "semanas" ? "Semanas" :
                                       formData.tipoIntervalo === "meses" ? "Meses" :
                                       formData.tipoIntervalo === "anos" ? "Anos" : formData.tipoIntervalo
                              }
                            : null
                        }
                        onChange={(selected) => {
                          handleInputChange(
                            "tipoIntervalo",
                            selected ? selected.value : ""
                          );
                        }}
                        options={[
                          { value: "dias", label: "Dias" },
                          { value: "semanas", label: "Semanas" },
                          { value: "meses", label: "Meses" },
                          { value: "anos", label: "Anos" }
                        ]}
                        isClearable
                      />
                    </div>

                    {/* Intervalo */}
                    <div className={styles.novaVendaField}>
                      <Label className={styles.novaVendaLabel}>
                        Intervalo <span className={styles.novaVendaLabelRequired}>*</span>
                      </Label>
                      <Input
                        value={formData.intervalo}
                        onChange={(e) => handleInputChange('intervalo', e.target.value)}
                        placeholder="1"
                        className={styles.novaVendaInput}
                      />
                    </div>

                    {/* Término da recorrência */}
                    <div className={styles.novaVendaField}>
                      <Label className={styles.novaVendaLabel}>
                        Término da recorrência <span className={styles.novaVendaLabelRequired}>*</span>
                      </Label>
                      <ReactSelect
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder="Selecione o término"
                        value={
                          formData.terminoRecorrencia
                            ? {
                                value: formData.terminoRecorrencia,
                                label: formData.terminoRecorrencia === "indeterminado" ? "Indeterminado" :
                                       formData.terminoRecorrencia === "personalizado" ? "Personalizado" : formData.terminoRecorrencia
                              }
                            : null
                        }
                        onChange={(selected) => {
                          const value = selected ? selected.value : "";
                          handleInputChange('terminoRecorrencia', value);
                          if (value === 'indeterminado') {
                            handleInputChange('indeterminado', true);
                          } else {
                            handleInputChange('indeterminado', false);
                          }
                        }}
                        options={[
                          { value: "indeterminado", label: "Indeterminado" },
                          { value: "personalizado", label: "Personalizado" }
                        ]}
                        isClearable
                      />
                    </div>

                    {/* Total de ciclos (apenas se não for indeterminado) */}
                    {!formData.indeterminado && (
                      <div className={styles.novaVendaField}>
                        <Label className={styles.novaVendaLabel}>
                          Total de ciclos <span className={styles.novaVendaLabelRequired}>*</span>
                        </Label>
                        <Input
                          value={formData.totalCiclos}
                          onChange={(e) => handleInputChange('totalCiclos', e.target.value)}
                          placeholder="12"
                          className={styles.novaVendaInput}
                        />
                      </div>
                    )}

                    {/* Data de término (apenas se for personalizado) */}
                    {formData.terminoRecorrencia === 'personalizado' && (
                      <div className={styles.novaVendaField}>
                        <Label className={styles.novaVendaLabel}>
                          Data de término
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className={cn(
                                "theme-input",
                                styles.novaVendaDateInput,
                                !formData.dataTermino && styles.novaVendaTextSecondary
                              )}
                            >
                              <CalendarIcon className={styles.novaVendaCalendarIcon} />
                              {formData.dataTermino ? (
                                format(formData.dataTermino, "dd/MM/yyyy", { locale: ptBR })
                              ) : (
                                <span>Selecione uma data</span>
                              )}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="theme-modal">
                            <Calendar
                              mode="single"
                              selected={formData.dataTermino || undefined}
                              onSelect={(date) => handleInputChange('dataTermino', date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}

                    {/* Vigência total */}
                    <div className={styles.novaVendaField}>
                      <Label className={styles.novaVendaLabel}>Vigência total</Label>
                      <div className={styles.novaVendaInfoBox}>
                        {formData.indeterminado ? "Indeterminado" : `${formData.totalCiclos || 0} ciclos`}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Seção Valor */}
              <div className={styles.novaVendaSection}>
                <h3 className={styles.novaVendaSectionTitle}>Valor</h3>
                
                <div className={styles.novaVendaValueContainer}>
                  {/* Desconto */}
                  <div className={styles.novaVendaField}>
                    <Label className={styles.novaVendaLabel}>Desconto</Label>
                    <div className={styles.novaVendaDiscountContainer}>
                      <ToggleGroup
                        type="single"
                        value={formData.descontoTipo}
                        onValueChange={(value) => value && handleInputChange('descontoTipo', value)}
                        className={styles.novaVendaToggleGroup}
                      >
                        <ToggleGroupItem value="reais" className={styles.novaVendaToggleItem}>
                          R$
                        </ToggleGroupItem>
                        <ToggleGroupItem value="percentual" className={styles.novaVendaToggleItem}>
                          %
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <div className={styles.novaVendaDiscountInputContainer}>
                        <Input
                          value={formData.descontoValor}
                          onChange={(e) => handleInputChange('descontoValor', e.target.value)}
                          className={styles.novaVendaDiscountInput}
                        />
                        <span className={styles.novaVendaDiscountSymbol}>
                          {formData.descontoTipo === 'reais' ? 'R$' : '%'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total da venda */}
                  <div className={styles.novaVendaTotalBox}>
                    <div className={styles.novaVendaTotalContent}>
                      <div className={styles.novaVendaTotalRow}>
                        <span>Itens (R$)</span>
                        <span>{calcularTotalItens().toFixed(2).replace('.', ',')}</span>
                      </div>
                      <div className={styles.novaVendaTotalRowDiscount}>
                        <span>- Desconto (R$)</span>
                        <span>{calcularDesconto().toFixed(2).replace('.', ',')}</span>
                      </div>
                      <div className={styles.novaVendaTotalRowFinal}>
                        <span>= Total (R$)</span>
                        <span>{calcularTotalFinal().toFixed(2).replace('.', ',')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção Informações de pagamento */}
              <div className={styles.novaVendaSection}>
                <h3 className={styles.novaVendaSectionTitle}>Informações de pagamento</h3>
                
                <div className={styles.novaVendaPaymentGrid}>
                  <div className={styles.novaVendaField}>
                    <Label className={styles.novaVendaLabel}>Forma de pagamento</Label>
                    <ReactSelect
                      className="react-select-container"
                      classNamePrefix="react-select"
                      placeholder="Selecione a forma de pagamento"
                      value={
                        formData.formaPagamento
                          ? {
                              value: formData.formaPagamento,
                              label: formData.formaPagamento === "dinheiro" ? "Dinheiro" :
                                     formData.formaPagamento === "pix" ? "PIX" :
                                     formData.formaPagamento === "cartao" ? "Cartão" :
                                     formData.formaPagamento === "boleto" ? "Boleto" : formData.formaPagamento
                            }
                          : null
                      }
                      onChange={(selected) => {
                        handleInputChange(
                          "formaPagamento",
                          selected ? selected.value : ""
                        );
                      }}
                      options={[
                        { value: "dinheiro", label: "Dinheiro" },
                        { value: "pix", label: "PIX" },
                        { value: "cartao", label: "Cartão" },
                        { value: "boleto", label: "Boleto" }
                      ]}
                      isClearable
                    />
                  </div>

                  <div className={styles.novaVendaField}>
                    <Label className={styles.novaVendaLabel}>
                      Conta de recebimento <HelpCircle className={styles.novaVendaIcon} />
                    </Label>
                    <div className={styles.novaVendaAccountContainer}>
                      <ReactSelect
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder="Selecione a conta"
                        value={
                          formData.contaRecebimento
                            ? (() => {
                                const isApi = formData.contaRecebimento.startsWith('api:');
                                const isErp = formData.contaRecebimento.startsWith('erp:');
                                if (isErp) {
                                  const contaId = parseInt(formData.contaRecebimento.split(':')[1]);
                                  const conta = formDataFromAPI.contas.find(c => c.id === contaId);
                                  return conta ? {
                                    value: formData.contaRecebimento,
                                    label: conta.descricao_banco
                                  } : null;
                                } else if (isApi) {
                                  const contaId = parseInt(formData.contaRecebimento.split(':')[1]);
                                  const conta = contasApi.find(c => c.id === contaId);
                                  return conta ? {
                                    value: formData.contaRecebimento,
                                    label: conta.descricao_banco
                                  } : null;
                                }
                                return null;
                              })()
                            : null
                        }
                        onChange={(selected) => {
                          handleInputChange(
                            "contaRecebimento",
                            selected ? selected.value : ""
                          );
                        }}
                        options={[
                          // Contas ERP
                          ...formDataFromAPI.contas
                            .filter((conta) => Boolean(conta.descricao_banco && String(conta.descricao_banco).trim()))
                            .map((conta) => ({
                              value: `erp:${conta.id}`,
                              label: conta.descricao_banco
                            })),
                          // Contas API (OpenFinance)
                          ...contasApi
                            .filter((conta) => Boolean(conta.descricao_banco && String(conta.descricao_banco).trim()))
                            .map((conta) => ({
                              value: `api:${conta.id}`,
                              label: `${conta.descricao_banco} (OpenFinance)`
                            }))
                        ]}
                        isClearable
                        noOptionsMessage={() => "Nenhuma conta encontrada"}
                      />
                      <div className={styles.novaVendaAccountIndicators}>
                        <div className={styles.novaVendaAccountIndicator}></div>
                        <div className={styles.novaVendaAccountIndicator}></div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.novaVendaField}>
                    <Label className={styles.novaVendaLabel}>
                      Vencimento <span className={styles.novaVendaLabelRequired}>*</span> <HelpCircle className={styles.novaVendaIcon} />
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={cn(
                            "theme-input",
                            styles.novaVendaDateInput,
                            !formData.vencimento && styles.novaVendaTextSecondary
                          )}
                        >
                          <CalendarIcon className={styles.novaVendaCalendarIcon} />
                          {formData.vencimento ? (
                            format(formData.vencimento, "dd/MM/yyyy", { locale: ptBR })
                          ) : (
                            <span>Selecione</span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="theme-modal">
                        <Calendar
                          mode="single"
                          selected={formData.vencimento}
                          onSelect={(date) => handleInputChange('vencimento', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>


              {/* Seções colapsáveis */}
              <div className={styles.novaVendaSection}>
                <Accordion type="multiple">
                  {/* Observações de pagamento */}
                  <AccordionItem value="observacoes-pagamento" className={styles.novaVendaAccordion}>
                    <AccordionTrigger className={styles.novaVendaAccordionTrigger}>
                      <span>Observações de pagamento</span>
                    </AccordionTrigger>
                    <AccordionContent className={styles.novaVendaAccordionContent}>
                      <div className={styles.novaVendaField}>
                        <Label className={styles.novaVendaLabel}>Observações</Label>
                        <Textarea
                          value={formData.observacoesPagamento}
                          onChange={(e) => handleInputChange('observacoesPagamento', e.target.value)}
                          placeholder="Inclua informações sobre o pagamento..."
                          rows={3}
                          className={styles.novaVendaTextarea}
                        />
                        <p className={styles.novaVendaTextSecondary}>
                          Inclua informações sobre o pagamento que podem ser relevantes para você e seu cliente.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </>
          )}
          </div>

          {/* Footer */}
          <div className={styles.novaVendaFooter}>
            <button onClick={handleClose} className={styles.novaVendaButtonSecondary}>
              Cancelar
            </button>
            <div className={styles.novaVendaFooterActions}>
              <button
                onClick={handleSave}
                disabled={isSaving || isLoadingFormData}
                className={styles.novaVendaButtonPrimary}
              >
                {isSaving && <div className={styles.novaVendaLoadingSpinner}></div>}
                {isSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer para adicionar novo produto/serviço */}
      <NovoProdutoServicoDrawer
        isOpen={isNovoProdutoServicoOpen}
        onClose={() => setIsNovoProdutoServicoOpen(false)}
        onSuccess={handleNovoProdutoServicoSuccess}
      />
    </>
  );
}

