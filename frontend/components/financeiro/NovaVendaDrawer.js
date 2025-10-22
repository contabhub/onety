"use client";

import { useState, useEffect } from "react";
import "../../styles/financeiro/vendas.module.css";
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
          "fixed inset-0 z-50 bg-black/50 vendas-modal-overlay",
          isClosing && "closing"
        )}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 9999
        }}
      >
        <div
          className={cn(
            "fixed inset-0 bg-darkPurple shadow-xl overflow-hidden flex flex-col vendas-modal w-full h-full",
            isClosing && "closing"
          )}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 10000
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-neonPurple bg-darkPurple sticky top-0 z-10">
            <div>
              <h2 className="text-xl font-semibold vendas-text-primary">Nova Venda</h2>
              <p className="vendas-text-secondary text-sm">
                Preencha as informações da venda
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0 vendas-text-primary hover:vendas-text-secondary"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="h-full px-6 py-4 space-y-6">
              {isLoadingFormData && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin vendas-loading" />
                  <span className="ml-2 vendas-text-primary">Carregando dados...</span>
                </div>
              )}

          {!isLoadingFormData && (
            <>
              {/* Seção Informações */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-textMain">Informações</h3>
                
                {/* Tipo da venda */}
                {/* <div className="space-y-2">
                  <Label className="text-sm font-medium text-textMain">Tipo da venda</Label>
                  <ToggleGroup
                    type="single"
                    value={formData.tipoVenda}
                    onValueChange={(value) => value && handleInputChange('tipoVenda', value)}
                    className="justify-start bg-darkPurple border-neonPurple"
                  >
                    <ToggleGroupItem value="orcamento" className="px-4 py-2 text-textMain data-[state=on]:bg-neonPurple data-[state=on]:text-textMain">
                      Orçamento
                    </ToggleGroupItem>
                    <ToggleGroupItem value="venda-avulsa" className="px-4 py-2 text-textMain data-[state=on]:bg-neonPurple data-[state=on]:text-textMain">
                      Venda avulsa
                    </ToggleGroupItem>
                    <ToggleGroupItem value="venda-recorrente" className="px-4 py-2 text-textMain data-[state=on]:bg-neonPurple data-[state=on]:text-textMain">
                      Venda recorrente (contrato)
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div> */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Situação da negociação */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-textMain">
                      Situação da negociação <span className="text-hotPink">*</span>
                    </Label>
                    <Select
                      value={formData.situacao}
                      onValueChange={(value) => handleInputChange('situacao', value)}
                    >
                      <SelectTrigger className="vendas-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="vendas-dropdown z-[10002]">
                        <SelectItem value="aprovado" className="text-textMain hover:bg-neonPurple">Venda liberada</SelectItem>
                        <SelectItem value="em_andamento" className="text-textMain hover:bg-neonPurple">Em andamento</SelectItem>
                        <SelectItem value="recusado" className="text-textMain hover:bg-neonPurple">Recusado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Número da venda */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-textMain">
                      Número da venda <span className="text-hotPink">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        value={formData.numeroVenda}
                        onChange={(e) => handleInputChange('numeroVenda', e.target.value)}
                        className="pr-10 bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-textMain hover:text-textSecondary"
                      >
                        <Zap className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Cliente */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-textMain">
                      Cliente <span className="text-hotPink">*</span>
                    </Label>
                    <Select
                      value={formData.cliente}
                      onValueChange={(value) => handleInputChange('cliente', value)}
                    >
                      <SelectTrigger className="vendas-input">
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                                             <SelectContent className="vendas-dropdown z-[10002]">
                         {formDataFromAPI.clientes.map((cliente) => (
                            <SelectItem key={cliente.id} value={cliente.id.toString()} className="vendas-dropdown-item">
                             {cliente.nome_fantasia}
                           </SelectItem>
                         ))}
                       </SelectContent>
                    </Select>
                  </div>

                  {/* Data de venda */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-textMain">
                      Data de venda <span className="text-hotPink">*</span>
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal border-neonPurple bg-darkPurple text-textMain",
                            !formData.dataVenda && "text-textSecondary"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.dataVenda ? (
                            format(formData.dataVenda, "dd/MM/yyyy", { locale: ptBR })
                          ) : (
                            <span>Selecione uma data</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 vendas-popover-content z-[10003]">
                        <Calendar
                          mode="single"
                          selected={formData.dataVenda}
                          onSelect={(date) => handleInputChange('dataVenda', date)}
                          initialFocus
                          className="vendas-calendar"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Categoria financeira */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-textMain">
                      Categoria financeira <HelpCircle className="inline h-4 w-4 ml-1 text-textSecondary" />
                    </Label>
                    <Select
                      value={formData.categoriaFinanceira}
                      onValueChange={(value) => handleInputChange('categoriaFinanceira', value)}
                    >
                      <SelectTrigger className="vendas-input">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                                             <SelectContent className="vendas-dropdown z-[10002]">
                         {formDataFromAPI.categorias.map((categoria) => (
                           <SelectItem key={categoria.id} value={categoria.id.toString()} className="text-textMain hover:bg-neonPurple">
                             {categoria.nome}
                           </SelectItem>
                         ))}
                       </SelectContent>
                    </Select>
                  </div>

                  {/* Sub-categoria */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-textMain">
                      Sub-categoria <HelpCircle className="inline h-4 w-4 ml-1 text-textSecondary" />
                    </Label>
                    <Select
                      value={formData.subCategoria}
                      onValueChange={(value) => handleInputChange('subCategoria', value)}
                    >
                      <SelectTrigger className="vendas-input">
                        <SelectValue placeholder="Selecione a sub-categoria" />
                      </SelectTrigger>
                                             <SelectContent className="vendas-dropdown z-[10002]">
                         {formDataFromAPI.subCategorias.map((subCategoria) => (
                           <SelectItem key={subCategoria.id} value={subCategoria.id.toString()} className="text-textMain hover:bg-neonPurple">
                             {subCategoria.nome}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>

                   {/* Centro de custo */}
                   <div className="space-y-2">
                     <Label className="text-sm font-medium text-textMain">
                       Centro de custo <HelpCircle className="inline h-4 w-4 ml-1 text-textSecondary" />
                     </Label>
                     <Select
                       value={formData.centroCusto}
                       onValueChange={(value) => handleInputChange('centroCusto', value)}
                     >
                       <SelectTrigger className="vendas-input">
                         <SelectValue placeholder="Selecione o centro de custo" />
                       </SelectTrigger>
                       <SelectContent className="vendas-dropdown z-[10002]">
                         {formDataFromAPI.centrosCusto.map((centro) => (
                           <SelectItem key={centro.id} value={centro.id.toString()} className="text-textMain hover:bg-neonPurple">
                             {centro.nome}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>

                   {/* Vendedor responsável */}
                   <div className="space-y-2">
                     <Label className="text-sm font-medium text-textMain">Vendedor responsável</Label>
                     <Select
                       value={formData.vendedor}
                       onValueChange={(value) => handleInputChange('vendedor', value)}
                     >
                       <SelectTrigger className="vendas-input">
                         <SelectValue placeholder="Selecione o vendedor" />
                       </SelectTrigger>
                       <SelectContent className="vendas-dropdown z-[10002]">
                         {formDataFromAPI.users.map((user) => (
                           <SelectItem key={user.id} value={user.id.toString()} className="text-textMain hover:bg-neonPurple">
                             {user.name}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
                </div>
              </div>

              {/* Seção Itens */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-textMain">Itens</h3>
                
                <div className="bg-darkPurple border border-neonPurple p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-textSecondary">
                      Nenhuma tabela de preço aplicada à venda.
                    </span>
                    <Button className="bg-primary hover:bg-primary/80 text-textMain">
                      <Diamond className="h-4 w-4 mr-2" />
                      Aplicar tabela de preços à venda
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-12 gap-2 text-sm font-medium text-textMain">
                      <div className="col-span-3">Detalhes do item <HelpCircle className="inline h-4 w-4 ml-1 text-textSecondary" /></div>
                      <div className="col-span-2">Quantidade <span className="text-hotPink">*</span></div>
                      <div className="col-span-2">Valor unitário <span className="text-hotPink">*</span></div>
                      <div className="col-span-2">Total <span className="text-hotPink">*</span></div>
                    </div>

                    {itens.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <Select
                                value={item.produtoServico}
                                onValueChange={(value) => handleItemChange(item.id, 'produtoServico', value)}
                              >
                                <SelectTrigger className="vendas-input">
                                  <SelectValue placeholder="Selecione produto/serviço" />
                                </SelectTrigger>
                                <SelectContent className="vendas-dropdown z-[10002]">
                                  {formDataFromAPI.produtosServicos.map((produto) => (
                                    <SelectItem key={produto.id} value={produto.id.toString()} className="text-textMain hover:bg-neonPurple">
                                      {produto.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setIsNovoProdutoServicoOpen(true)}
                              className="h-6 w-6 p-0 text-hotPink hover:bg-hotPink/10 hover:text-textMain flex-shrink-0"
                              title="Adicionar novo produto/serviço"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="col-span-3">
                          <Input
                            value={item.detalhes}
                            onChange={(e) => handleItemChange(item.id, 'detalhes', e.target.value)}
                            placeholder="Detalhes do item"
                            className="bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            value={item.quantidade}
                            onChange={(e) => handleItemChange(item.id, 'quantidade', e.target.value)}
                            placeholder="1,00"
                            className="bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
                          />
                        </div>
                        <div className="col-span-2">
                          <div className="relative">
                            <Input
                              value={item.valorUnitario}
                              onChange={(e) => handleItemChange(item.id, 'valorUnitario', e.target.value)}
                              placeholder="0,00"
                              className="pl-8 bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-textSecondary">R$</span>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="relative">
                            <Input
                              value={item.total}
                              onChange={(e) => handleItemChange(item.id, 'total', e.target.value)}
                              placeholder="0,00"
                              className="pl-8 pr-8 bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
                              readOnly
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-textSecondary">R$</span>
                            <Diamond className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                          </div>
                        </div>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      onClick={addItem}
                      className="w-full border-dashed border-neonPurple bg-darkPurple text-textMain hover:bg-neonPurple hover:text-textMain"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar nova linha
                    </Button>
                  </div>
                </div>
              </div>

              {/* Seção Configurações de recorrência (apenas para venda recorrente) */}
              {formData.tipoVenda === "venda-recorrente" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-textMain">Configurações de recorrência</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tipo de intervalo */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">
                        Tipo de intervalo <span className="text-hotPink">*</span>
                      </Label>
                      <Select
                        value={formData.tipoIntervalo}
                        onValueChange={(value) => handleInputChange('tipoIntervalo', value)}
                      >
                        <SelectTrigger className="vendas-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="vendas-dropdown z-[10002]">
                          <SelectItem value="dias" className="text-textMain hover:bg-neonPurple">Dias</SelectItem>
                          <SelectItem value="semanas" className="text-textMain hover:bg-neonPurple">Semanas</SelectItem>
                          <SelectItem value="meses" className="text-textMain hover:bg-neonPurple">Meses</SelectItem>
                          <SelectItem value="anos" className="text-textMain hover:bg-neonPurple">Anos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Intervalo */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">
                        Intervalo <span className="text-hotPink">*</span>
                      </Label>
                      <Input
                        value={formData.intervalo}
                        onChange={(e) => handleInputChange('intervalo', e.target.value)}
                        placeholder="1"
                        className="bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
                      />
                    </div>

                    {/* Término da recorrência */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">
                        Término da recorrência <span className="text-hotPink">*</span>
                      </Label>
                      <Select
                        value={formData.terminoRecorrencia}
                        onValueChange={(value) => {
                          handleInputChange('terminoRecorrencia', value);
                          if (value === 'indeterminado') {
                            handleInputChange('indeterminado', true);
                          } else {
                            handleInputChange('indeterminado', false);
                          }
                        }}
                      >
                        <SelectTrigger className="vendas-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="vendas-dropdown z-[10002]">
                          <SelectItem value="indeterminado" className="text-textMain hover:bg-neonPurple">Indeterminado</SelectItem>
                          <SelectItem value="personalizado" className="text-textMain hover:bg-neonPurple">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Total de ciclos (apenas se não for indeterminado) */}
                    {!formData.indeterminado && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-textMain">
                          Total de ciclos <span className="text-hotPink">*</span>
                        </Label>
                        <Input
                          value={formData.totalCiclos}
                          onChange={(e) => handleInputChange('totalCiclos', e.target.value)}
                          placeholder="12"
                          className="bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
                        />
                      </div>
                    )}

                    {/* Data de término (apenas se for personalizado) */}
                    {formData.terminoRecorrencia === 'personalizado' && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-textMain">
                          Data de término
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal border-neonPurple bg-darkPurple text-textMain",
                                !formData.dataTermino && "text-textSecondary"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.dataTermino ? (
                                format(formData.dataTermino, "dd/MM/yyyy", { locale: ptBR })
                              ) : (
                                <span>Selecione uma data</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 vendas-popover-content z-[10003]">
                            <Calendar
                              mode="single"
                              selected={formData.dataTermino || undefined}
                              onSelect={(date) => handleInputChange('dataTermino', date)}
                              initialFocus
                              className="vendas-calendar"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}

                    {/* Vigência total */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">Vigência total</Label>
                      <div className="bg-neonPurple text-textMain px-3 py-2 rounded text-sm font-medium">
                        {formData.indeterminado ? "Indeterminado" : `${formData.totalCiclos || 0} ciclos`}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Seção Valor */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-textMain">Valor</h3>
                
                <div className="space-y-4">
                  {/* Desconto */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-textMain">Desconto</Label>
                    <div className="flex items-center gap-2">
                      <ToggleGroup
                        type="single"
                        value={formData.descontoTipo}
                        onValueChange={(value) => value && handleInputChange('descontoTipo', value)}
                        className="bg-darkPurple border-neonPurple"
                      >
                        <ToggleGroupItem value="reais" className="px-3 py-1 text-textMain data-[state=on]:bg-neonPurple data-[state=on]:text-textMain">
                          R$
                        </ToggleGroupItem>
                        <ToggleGroupItem value="percentual" className="px-3 py-1 text-textMain data-[state=on]:bg-neonPurple data-[state=on]:text-textMain">
                          %
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <div className="relative">
                        <Input
                          value={formData.descontoValor}
                          onChange={(e) => handleInputChange('descontoValor', e.target.value)}
                          className="w-32 pl-8 bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-textSecondary">
                          {formData.descontoTipo === 'reais' ? 'R$' : '%'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total da venda */}
                  <div className="bg-darkPurple border border-neonPurple p-4 rounded-lg">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-textMain">
                        <span>Itens (R$)</span>
                        <span>{calcularTotalItens().toFixed(2).replace('.', ',')}</span>
                      </div>
                      <div className="flex justify-between text-hotPink">
                        <span>- Desconto (R$)</span>
                        <span>{calcularDesconto().toFixed(2).replace('.', ',')}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-lg border-t border-neonPurple pt-2 text-textMain">
                        <span>= Total (R$)</span>
                        <span>{calcularTotalFinal().toFixed(2).replace('.', ',')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção Informações de pagamento */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-textMain">Informações de pagamento</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-textMain">Forma de pagamento</Label>
                    <Select
                      value={formData.formaPagamento}
                      onValueChange={(value) => handleInputChange('formaPagamento', value)}
                    >
                      <SelectTrigger className="vendas-input">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="vendas-dropdown z-[10002]">
                        <SelectItem value="dinheiro" className="text-textMain hover:bg-neonPurple">Dinheiro</SelectItem>
                        <SelectItem value="pix" className="text-textMain hover:bg-neonPurple">PIX</SelectItem>
                        <SelectItem value="cartao" className="text-textMain hover:bg-neonPurple">Cartão</SelectItem>
                        <SelectItem value="boleto" className="text-textMain hover:bg-neonPurple">Boleto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-textMain">
                      Conta de recebimento <HelpCircle className="inline h-4 w-4 ml-1 text-textSecondary" />
                    </Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={formData.contaRecebimento}
                        onValueChange={(value) => handleInputChange('contaRecebimento', value)}
                      >
                        <SelectTrigger className="vendas-input">
                          <SelectValue placeholder="Selecione a conta" />
                        </SelectTrigger>
                        <SelectContent className="vendas-dropdown z-[10002]">
                          {/* Contas ERP */}
                          {formDataFromAPI.contas
                            .filter((conta) => Boolean(conta.descricao_banco && String(conta.descricao_banco).trim()))
                            .map((conta) => (
                              <SelectItem
                                key={`erp-${conta.id}`}
                                value={`erp:${conta.id}`}
                                className="text-textMain hover:bg-neonPurple flex justify-between items-center"
                              >
                                <span>{conta.descricao_banco}</span>
                              </SelectItem>
                            ))}

                          {/* Contas API (OpenFinance) */}
                          {contasApi
                            .filter((conta) => Boolean(conta.descricao_banco && String(conta.descricao_banco).trim()))
                            .map((conta) => (
                              <SelectItem
                                key={`api-${conta.id}`}
                                value={`api:${conta.id}`}
                                className="text-textMain hover:bg-neonPurple flex justify-between items-center"
                              >
                                <span>{conta.descricao_banco}</span>
                                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40">OpenFinance</span>
                              </SelectItem>
                            ))}

                          {formDataFromAPI.contas.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 &&
                           contasApi.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 && (
                            <div className="text-textSecondary px-2 py-1">
                              Nenhuma conta encontrada
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        <div className="w-2 h-2 bg-warning rounded-full"></div>
                      </div>
                    </div>
                  </div>

                  {/* <div className="space-y-2">
                    <Label className="text-sm font-medium text-textMain">Percentual</Label>
                    <div className="text-sm font-medium text-textMain bg-darkPurple border border-neonPurple px-3 py-2 rounded">
                      100 %
                    </div>
                  </div> */}

                  {/* <div className="space-y-2">
                    <Label className="text-sm font-medium text-textMain">Valor a receber</Label>
                    <div className="relative">
                      <Input
                        value={formData.valorReceber}
                        onChange={(e) => handleInputChange('valorReceber', e.target.value)}
                        className="pl-8 bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-textSecondary">R$</span>
                    </div>
                  </div> */}

                  {/* <div className="space-y-2">
                    <Label className="text-sm font-medium text-textMain">
                      Condição de pagamento <span className="text-hotPink">*</span> <HelpCircle className="inline h-4 w-4 ml-1 text-textSecondary" />
                    </Label>
                    <Select
                      value={formData.condicaoPagamento}
                      onValueChange={(value) => handleInputChange('condicaoPagamento', value)}
                    >
                      <SelectTrigger className="vendas-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="vendas-dropdown z-[10002]">
                        <SelectItem value="a-vista" className="text-textMain hover:bg-neonPurple">À vista</SelectItem>
                        <SelectItem value="30-dias" className="text-textMain hover:bg-neonPurple">30 dias</SelectItem>
                        <SelectItem value="60-dias" className="text-textMain hover:bg-neonPurple">60 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div> */}

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-textMain">
                      Vencimento <span className="text-hotPink">*</span> <HelpCircle className="inline h-4 w-4 ml-1 text-textSecondary" />
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal border-neonPurple bg-darkPurple text-textMain",
                            !formData.vencimento && "text-textSecondary"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.vencimento ? (
                            format(formData.vencimento, "dd/MM/yyyy", { locale: ptBR })
                          ) : (
                            <span>Selecione</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 vendas-popover-content z-[10003]">
                        <Calendar
                          mode="single"
                          selected={formData.vencimento}
                          onSelect={(date) => handleInputChange('vencimento', date)}
                          initialFocus
                          className="vendas-calendar"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* <div className="space-y-2">
                    <Button variant="outline" className="w-full border-neonPurple bg-darkPurple text-textMain hover:bg-neonPurple hover:text-textMain">
                      Editar parcelas
                    </Button>
                  </div> */}
                </div>
              </div>

              {/* Seção Boleto e E-mail */}
              {/* <div className="space-y-4">
                <h3 className="text-lg font-semibold text-textMain">Boleto e E-mail</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-textMain">
                      Gerar boleto
                    </Label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="gerarBoleto"
                        checked={formData.gerarBoleto}
                        onChange={(e) => handleInputChange('gerarBoleto', e.target.checked)}
                        className="rounded border-neonPurple bg-darkPurple text-textMain"
                      />
                      <Label htmlFor="gerarBoleto" className="text-sm text-textMain">
                        Gerar boleto automaticamente
                      </Label>
                    </div>
                  </div>

                  {formData.gerarBoleto && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">
                        Conta corrente <span className="text-hotPink">*</span>
                      </Label>
                      <Input
                        value={formData.contaCorrente}
                        onChange={(e) => handleInputChange('contaCorrente', e.target.value)}
                        placeholder="269127208"
                        className="bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-textMain">
                      Enviar e-mail
                    </Label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="enviarEmail"
                        checked={formData.enviarEmail}
                        onChange={(e) => handleInputChange('enviarEmail', e.target.checked)}
                        className="rounded border-neonPurple bg-darkPurple text-textMain"
                      />
                      <Label htmlFor="enviarEmail" className="text-sm text-textMain">
                        Enviar e-mail com boleto
                      </Label>
                    </div>
                  </div>

                  {formData.enviarEmail && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">
                        E-mail do cliente <span className="text-hotPink">*</span>
                      </Label>
                      <Input
                        value={formData.clienteEmail}
                        onChange={(e) => handleInputChange('clienteEmail', e.target.value)}
                        placeholder="cliente@email.com"
                        type="email"
                        className="bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
                      />
                    </div>
                  )}
                </div>

                {(formData.gerarBoleto || formData.enviarEmail) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-blue-800">
                          {formData.gerarBoleto && formData.enviarEmail && 
                            "O boleto será gerado automaticamente e enviado por e-mail para o cliente."}
                          {formData.gerarBoleto && !formData.enviarEmail && 
                            "O boleto será gerado automaticamente. Você pode baixá-lo após a criação da venda."}
                          {!formData.gerarBoleto && formData.enviarEmail && 
                            "Um e-mail será enviado para o cliente com as informações da venda."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div> */}

              {/* Seções colapsáveis */}
              <Accordion type="multiple" className="space-y-4">
                {/* Observações de pagamento */}
                <AccordionItem value="observacoes-pagamento" className="border border-neonPurple rounded-lg bg-darkPurple">
                  <AccordionTrigger className="px-4 py-3 text-textMain hover:text-textSecondary">
                    <span className="text-lg font-semibold text-textMain">Observações de pagamento</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">Observações</Label>
                      <Textarea
                        value={formData.observacoesPagamento}
                        onChange={(e) => handleInputChange('observacoesPagamento', e.target.value)}
                        placeholder="Inclua informações sobre o pagamento..."
                        rows={3}
                        className="bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
                      />
                      <p className="text-xs text-textSecondary">
                        Inclua informações sobre o pagamento que podem ser relevantes para você e seu cliente.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Informações fiscais */}
                {/* <AccordionItem value="informacoes-fiscais" className="border border-neonPurple rounded-lg bg-darkPurple">
                  <AccordionTrigger className="px-4 py-3 text-textMain hover:text-textSecondary">
                    <span className="text-lg font-semibold text-textMain">Informações fiscais</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">
                        Natureza de operação <span className="text-hotPink">*</span>
                      </Label>
                      <Select
                        value={formData.naturezaOperacao}
                        onValueChange={(value) => handleInputChange('naturezaOperacao', value)}
                      >
                        <SelectTrigger className="vendas-input">
                          <SelectValue placeholder="Selecione a natureza da operação" />
                        </SelectTrigger>
                        <SelectContent className="vendas-dropdown z-[10002]">
                          <SelectItem value="venda" className="text-textMain hover:bg-neonPurple">Venda</SelectItem>
                          <SelectItem value="prestacao-servicos" className="text-textMain hover:bg-neonPurple">Prestação de Serviços</SelectItem>
                          <SelectItem value="transferencia" className="text-textMain hover:bg-neonPurple">Transferência</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </AccordionContent>
                </AccordionItem> */}

                {/* Observações complementares da nota fiscal */}
                {/* <AccordionItem value="observacoes-fiscais" className="border border-neonPurple rounded-lg bg-darkPurple">
                  <AccordionTrigger className="px-4 py-3 text-textMain hover:text-textSecondary">
                    <span className="text-lg font-semibold text-textMain">Observações complementares da nota fiscal</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">Observações</Label>
                      <Textarea
                        value={formData.observacoesFiscais}
                        onChange={(e) => handleInputChange('observacoesFiscais', e.target.value)}
                        placeholder="Inclua informações relevantes para seu cliente..."
                        rows={3}
                        className="bg-darkPurple border-neonPurple text-textMain placeholder:text-textSecondary"
                      />
                      <p className="text-xs text-textSecondary">
                        Inclua informações relevantes para seu cliente. Elas aparecerão na nota fiscal, nos campos &quot;Descrição do serviço&quot; ou &quot;Informações Complementares Contribuinte&quot;, visíveis no XML, PDF e DANFE.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem> */}
              </Accordion>
            </>
          )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-neonPurple bg-darkPurple mt-auto">
            <Button variant="outline" onClick={handleClose} className="vendas-outline-btn">
              Cancelar
            </Button>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving || isLoadingFormData}
                className="vendas-primary-btn"
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isSaving ? "Salvando..." : "Salvar"}
              </Button>
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
