"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
} from "./dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
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
import { Calendar } from "./calendar";
import {
  X,
  Plus,
  CalendarIcon,
  HelpCircle,
  Loader2,
  Diamond,
  Info,
} from "lucide-react";
import NovoProdutoServicoDrawer from "./NovoProdutoServicoDrawer";
import { useVendas } from "../../hooks/financeiro/useVenda";
import { toast } from "react-toastify";

// Função cn para combinar classes
const cn = (...classes) => classes.filter(Boolean).join(' ');

// EditarVendaDrawerProps: { isOpen: boolean, onClose: () => void, vendaId: number | null }
// FormData: { situacao: string, categoriaFinanceira: string, subCategoria: string, centroCusto: string, vendedor: string, contaRecebimento: string, valor: string, desconto: string, formaPagamento: string, condicaoPagamento: string, vencimento: Date | null, observacoesPagamento: string, naturezaOperacao: string, observacoesFiscais: string, descontoTipo: string, descontoValor: string }
// ItemVenda: { id: string, produtoServico: string, detalhes: string, quantidade: string, valorUnitario: string, total: string }
// FormDataFromAPI: { clientes: any[], categorias: any[], subCategorias: any[], centrosCusto: any[], users: any[], contas: any[], contasApi: any[], produtosServicos: any[] }

export default function EditarVendaDrawer({
  isOpen,
  onClose,
  vendaId,
}) {
  const [formData, setFormData] = useState({
    situacao: "aprovado",
    categoriaFinanceira: "",
    subCategoria: "",
    centroCusto: "",
    vendedor: "",
    contaRecebimento: "",
    valor: "",
    desconto: "0",
    formaPagamento: "",
    condicaoPagamento: "a-vista",
    vencimento: new Date(),
    observacoesPagamento: "",
    naturezaOperacao: "",
    observacoesFiscais: "",
    // Campos de desconto
    descontoTipo: "reais",
    descontoValor: "0",
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

  const [formDataFromAPI, setFormDataFromAPI] = useState({
    clientes: [],
    categorias: [],
    subCategorias: [],
    centrosCusto: [],
    users: [],
    contas: [],
    contasApi: [],
    produtosServicos: [],
  });

  const [vendaOriginal, setVendaOriginal] = useState(null);
  const [isLoadingFormData, setIsLoadingFormData] = useState(false);
  const [isLoadingVenda, setIsLoadingVenda] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isNovoProdutoServicoOpen, setIsNovoProdutoServicoOpen] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL;
  
  // Usar o hook de vendas
  const vendasHook = useVendas();
  const { atualizarVenda } = vendasHook;

  // Carregar dados do formulário e da venda quando abrir
  useEffect(() => {
    if (isOpen && vendaId) {
      loadFormData();
      loadVendaData();
    }
  }, [isOpen, vendaId]);

  const loadFormData = async () => {
    const empresaId = localStorage.getItem("empresaId");
    const token = localStorage.getItem("token");

    if (!empresaId || !token || !API) {
      console.error("EmpresaId ou Token não encontrados");
      return;
    }

    setIsLoadingFormData(true);
    try {
      // Carregar todos os dados do formulário em uma única requisição
      const formDataRes = await fetch(`${API}/vendas/form-data?company_id=${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!formDataRes.ok) {
        throw new Error('Erro ao carregar dados do formulário');
      }

      const formData = await formDataRes.json();

      // Buscar contas API separadamente
      let contasApi = [];
      try {
        const contasApiRes = await fetch(`${API}/contas-api/company/${empresaId}/contas`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (contasApiRes.ok) {
          const json = await contasApiRes.json();
          contasApi = Array.isArray(json) ? json : Array.isArray(json.contas) ? json.contas : [];
        }
      } catch (error) {
        console.error("Erro ao buscar contas API:", error);
      }

      setFormDataFromAPI({
        clientes: formData.clientes || [],
        categorias: formData.categorias || [],
        subCategorias: formData.subCategorias || [],
        centrosCusto: formData.centrosCusto || [],
        users: formData.users || [],
        contas: formData.contas || [],
        contasApi: contasApi,
        produtosServicos: formData.produtosServicos || [],
      });
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setIsLoadingFormData(false);
    }
  };

  const loadVendaData = async () => {
    if (!vendaId) return;

    const token = localStorage.getItem("token");
    if (!token || !API) {
      console.error("Token não encontrado");
      return;
    }

    setIsLoadingVenda(true);
    try {
      const response = await fetch(`${API}/vendas/${vendaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar dados da venda');
      }

      const venda = await response.json();
      setVendaOriginal(venda);

      // Preencher o formulário com os dados da venda
      setFormData({
        situacao: venda.situacao || "aprovado",
        categoriaFinanceira: venda.categoria_id?.toString() || "",
        subCategoria: venda.sub_categoria_id?.toString() || "",
        centroCusto: venda.centro_de_custo_id?.toString() || "",
        vendedor: venda.vendedor_id?.toString() || "",
        contaRecebimento: venda.conta_recebimento_api ? `api:${venda.conta_recebimento_api}` : venda.conta_recebimento ? `erp:${venda.conta_recebimento}` : "",
        valor: venda.valor_venda?.toString() || "",
        desconto: venda.desconto_venda?.toString() || "0",
        formaPagamento: venda.pagamento || "",
        condicaoPagamento: venda.parcelamento || "a-vista",
        vencimento: venda.vencimento ? new Date(venda.vencimento) : new Date(),
        observacoesPagamento: venda.observacoes || "",
        naturezaOperacao: venda.natureza || "",
        observacoesFiscais: venda.observacoes_fiscais || "",
        descontoTipo: "reais", // Valor padrão
        descontoValor: venda.desconto_venda?.toString() || "0",
      });

      // Configurar itens (simplificado para um item principal)
      const itensIniciais = [
        {
          id: "1",
          produtoServico: venda.produtos_servicos_id?.toString() || "",
          detalhes: "",
          quantidade: "1,00",
          valorUnitario: venda.valor_venda?.toString() || "",
          total: venda.valor_venda?.toString() || "",
        },
      ];
      console.log("📦 Configurando itens iniciais:", itensIniciais);
      setItens(itensIniciais);

    } catch (error) {
      console.error("Erro ao carregar venda:", error);
    } finally {
      setIsLoadingVenda(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (id, field, value) => {
    console.log(`🔄 Atualizando item ${id}, campo ${field} para valor: ${value}`);
    setItens(prev => {
      const newItens = prev.map(item => {
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
    });
      console.log(`✅ Itens atualizados:`, newItens);
      return newItens;
    });
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
    loadFormData();
  };

  const handleSave = async () => {
    if (!vendaId) return;

    setIsSaving(true);
    try {
      // Validar campos obrigatórios
      console.log("🔍 Validando itens:", itens);
      const itemComProduto = itens.find(item => item.produtoServico && item.produtoServico.trim() !== '');
      console.log("🔍 Item com produto encontrado:", itemComProduto);
      if (!itemComProduto) {
        throw new Error("Selecione um produto ou serviço");
      }

      // Validar se o valor total é maior que zero
      const totalFinal = calcularTotalFinal();
      if (totalFinal <= 0) {
        throw new Error("O valor total deve ser maior que zero");
      }

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
        throw new Error("Preencha quantidade e valor válidos para todos os produtos/serviços selecionados");
      }

      // Processar conta de recebimento (ERP ou API)
      const isApi = formData.contaRecebimento?.startsWith('api:');
      const isErp = formData.contaRecebimento?.startsWith('erp:');
      const contaIdParsed = isErp ? parseInt(formData.contaRecebimento.split(':')[1]) : null;
      const contaApiIdParsed = isApi ? parseInt(formData.contaRecebimento.split(':')[1]) : null;

      // Preparar dados para atualização (apenas campos editáveis)
      const dadosAtualizacao = {};
      
      // Campos editáveis que sempre devem ser enviados
      dadosAtualizacao.situacao = formData.situacao;
      dadosAtualizacao.valor_venda = calcularTotalFinal();
      dadosAtualizacao.desconto_venda = calcularDesconto();
      dadosAtualizacao.vendedor_id = formData.vendedor ? parseInt(formData.vendedor) : null;
      
      // Campos opcionais que só são enviados se preenchidos
      if (formData.categoriaFinanceira && formData.categoriaFinanceira.trim() !== '') {
        dadosAtualizacao.categoria_id = parseInt(formData.categoriaFinanceira);
      }
      
      if (formData.subCategoria && formData.subCategoria.trim() !== '') {
        dadosAtualizacao.sub_categoria_id = parseInt(formData.subCategoria);
      }
      
      if (itemComProduto && itemComProduto.produtoServico && itemComProduto.produtoServico.trim() !== '') {
        dadosAtualizacao.produtos_servicos_id = parseInt(itemComProduto.produtoServico);
      }
      
      if (formData.centroCusto && formData.centroCusto.trim() !== '') {
        dadosAtualizacao.centro_de_custo_id = parseInt(formData.centroCusto);
      }
      
      if (formData.formaPagamento) {
        dadosAtualizacao.pagamento = formData.formaPagamento;
      }
      
      // Sempre enviar os campos de conta (mesmo que sejam null)
      dadosAtualizacao.conta_recebimento = contaIdParsed;
      dadosAtualizacao.conta_recebimento_api = contaApiIdParsed;
      
      if (formData.condicaoPagamento) {
        dadosAtualizacao.parcelamento = formData.condicaoPagamento;
      }
      
      if (formData.vencimento) {
        dadosAtualizacao.vencimento = format(formData.vencimento, 'yyyy-MM-dd');
      } else {
        dadosAtualizacao.vencimento = format(new Date(), 'yyyy-MM-dd');
      }
      
      if (formData.observacoesPagamento) {
        dadosAtualizacao.observacoes = formData.observacoesPagamento;
      }
      
      if (formData.naturezaOperacao) {
        dadosAtualizacao.natureza = formData.naturezaOperacao;
      }
      
      if (formData.observacoesFiscais) {
        dadosAtualizacao.observacoes_fiscais = formData.observacoesFiscais;
      }

      console.log("Dados para atualização:", dadosAtualizacao);

      await atualizarVenda(vendaId, dadosAtualizacao);
      toast.success("Venda atualizada com sucesso!");
      onClose();
    } catch (error) {
      console.error("Erro ao atualizar venda:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao atualizar venda";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className="max-h-[85vh] flex flex-col bg-darkPurple border-neonPurple">
          <DrawerHeader className="border-b border-neonPurple bg-darkPurple">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle className="text-xl font-semibold text-textMain">Editar Venda</DrawerTitle>
                <DrawerDescription className="text-textSecondary">
                  Edite as informações da venda
                </DrawerDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 text-textMain hover:text-textSecondary"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DrawerHeader>

          <div className="flex-1 p-6 space-y-6 overflow-y-auto min-h-0 bg-darkPurple">
            {(isLoadingFormData || isLoadingVenda) && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-textMain" />
                <span className="ml-2 text-textMain">Carregando dados...</span>
              </div>
            )}

            {!isLoadingFormData && !isLoadingVenda && vendaOriginal && (
              <>
                {/* Informações da venda (somente leitura) */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-textMain">Informações da Venda</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">Número da venda</Label>
                      <div className="bg-neonPurple/20 text-textMain px-3 py-2 rounded text-sm">
                        {vendaOriginal.numero_venda || vendaOriginal.id}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">Cliente</Label>
                      <div className="bg-neonPurple/20 text-textMain px-3 py-2 rounded text-sm">
                        {vendaOriginal.cliente_nome}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">Data da venda</Label>
                      <div className="bg-neonPurple/20 text-textMain px-3 py-2 rounded text-sm">
                        {vendaOriginal.data_venda ? new Date(vendaOriginal.data_venda).toLocaleDateString('pt-BR') : 'N/A'}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">Tipo da venda</Label>
                      <div className="bg-neonPurple/20 text-textMain px-3 py-2 rounded text-sm">
                        {vendaOriginal.tipo_venda}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção Classificação */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-textMain">Classificação</h3>
                  
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
                        <SelectTrigger className="bg-darkPurple border-neonPurple text-textMain">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-darkPurple border-neonPurple">
                          <SelectItem value="aprovado" className="text-textMain hover:bg-neonPurple">Aprovado</SelectItem>
                          <SelectItem value="em_andamento" className="text-textMain hover:bg-neonPurple">Em andamento</SelectItem>
                          <SelectItem value="recusado" className="text-textMain hover:bg-neonPurple">Recusado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Categoria financeira */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">
                        Categoria financeira
                      </Label>
                      <Select
                        value={formData.categoriaFinanceira}
                        onValueChange={(value) => handleInputChange('categoriaFinanceira', value)}
                      >
                        <SelectTrigger className="bg-darkPurple border-neonPurple text-textMain">
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                        <SelectContent className="bg-darkPurple border-neonPurple">
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
                        Sub-categoria
                      </Label>
                      <Select
                        value={formData.subCategoria}
                        onValueChange={(value) => handleInputChange('subCategoria', value)}
                      >
                        <SelectTrigger className="bg-darkPurple border-neonPurple text-textMain">
                          <SelectValue placeholder="Selecione a sub-categoria" />
                        </SelectTrigger>
                        <SelectContent className="bg-darkPurple border-neonPurple">
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
                        Centro de custo
                      </Label>
                      <Select
                        value={formData.centroCusto}
                        onValueChange={(value) => handleInputChange('centroCusto', value)}
                      >
                        <SelectTrigger className="bg-darkPurple border-neonPurple text-textMain">
                          <SelectValue placeholder="Selecione o centro de custo" />
                        </SelectTrigger>
                        <SelectContent className="bg-darkPurple border-neonPurple">
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
                        <SelectTrigger className="bg-darkPurple border-neonPurple text-textMain">
                          <SelectValue placeholder="Selecione o vendedor" />
                        </SelectTrigger>
                        <SelectContent className="bg-darkPurple border-neonPurple">
                          {formDataFromAPI.users.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()} className="text-textMain hover:bg-neonPurple">
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Conta de recebimento */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">
                        Conta de recebimento <HelpCircle className="inline h-4 w-4 ml-1 text-textSecondary" />
                      </Label>
                      <div className="flex items-center gap-2">
                        <Select
                          value={formData.contaRecebimento}
                          onValueChange={(value) => handleInputChange('contaRecebimento', value)}
                        >
                          <SelectTrigger className="bg-darkPurple border-neonPurple text-textMain">
                            <SelectValue placeholder="Selecione a conta" />
                          </SelectTrigger>
                          <SelectContent className="bg-darkPurple border-neonPurple">
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
                            {formDataFromAPI.contasApi
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
                             formDataFromAPI.contasApi.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 && (
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
                  </div>
                </div>

                {/* Seção Itens */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-textMain">Itens</h3>
                  
                  <div className="bg-darkPurple border border-neonPurple p-4 rounded-lg">
                    <div className="space-y-4">
                      <div className="grid grid-cols-12 gap-2 text-sm font-medium text-textMain">
                        <div className="col-span-3">Produtos/Serviços <span className="text-hotPink">*</span></div>
                        <div className="col-span-3">Detalhes do item</div>
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
                                  <SelectTrigger className="bg-darkPurple border-neonPurple text-textMain">
                                    <SelectValue placeholder="Selecione produto/serviço" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-darkPurple border-neonPurple">
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Forma de pagamento */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">Forma de pagamento</Label>
                      <Select
                        value={formData.formaPagamento}
                        onValueChange={(value) => handleInputChange('formaPagamento', value)}
                      >
                        <SelectTrigger className="bg-darkPurple border-neonPurple text-textMain">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="bg-darkPurple border-neonPurple">
                          <SelectItem value="dinheiro" className="text-textMain hover:bg-neonPurple">Dinheiro</SelectItem>
                          <SelectItem value="pix" className="text-textMain hover:bg-neonPurple">PIX</SelectItem>
                          <SelectItem value="cartao" className="text-textMain hover:bg-neonPurple">Cartão</SelectItem>
                          <SelectItem value="boleto" className="text-textMain hover:bg-neonPurple">Boleto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Condição de pagamento */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">
                        Condição de pagamento <span className="text-hotPink">*</span>
                      </Label>
                      <Select
                        value={formData.condicaoPagamento}
                        onValueChange={(value) => handleInputChange('condicaoPagamento', value)}
                      >
                        <SelectTrigger className="bg-darkPurple border-neonPurple text-textMain">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-darkPurple border-neonPurple">
                          <SelectItem value="a-vista" className="text-textMain hover:bg-neonPurple">À vista</SelectItem>
                          <SelectItem value="30-dias" className="text-textMain hover:bg-neonPurple">30 dias</SelectItem>
                          <SelectItem value="60-dias" className="text-textMain hover:bg-neonPurple">60 dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Vencimento */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-textMain">
                        Vencimento <span className="text-hotPink">*</span>
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
                        <PopoverContent className="w-auto p-0 bg-darkPurple border-neonPurple">
                          <Calendar
                            mode="single"
                            selected={formData.vencimento || undefined}
                            onSelect={(date) => handleInputChange('vencimento', date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

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
                  <AccordionItem value="informacoes-fiscais" className="border border-neonPurple rounded-lg bg-darkPurple">
                    <AccordionTrigger className="px-4 py-3 text-textMain hover:text-textSecondary">
                      <span className="text-lg font-semibold text-textMain">Informações fiscais</span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-textMain">
                          Natureza de operação
                        </Label>
                        <Select
                          value={formData.naturezaOperacao}
                          onValueChange={(value) => handleInputChange('naturezaOperacao', value)}
                        >
                          <SelectTrigger className="bg-darkPurple border-neonPurple text-textMain">
                            <SelectValue placeholder="Selecione a natureza da operação" />
                          </SelectTrigger>
                          <SelectContent className="bg-darkPurple border-neonPurple">
                            <SelectItem value="venda" className="text-textMain hover:bg-neonPurple">Venda</SelectItem>
                            <SelectItem value="prestacao-servicos" className="text-textMain hover:bg-neonPurple">Prestação de Serviços</SelectItem>
                            <SelectItem value="transferencia" className="text-textMain hover:bg-neonPurple">Transferência</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Observações complementares da nota fiscal */}
                  <AccordionItem value="observacoes-fiscais" className="border border-neonPurple rounded-lg bg-darkPurple">
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
                  </AccordionItem>
                </Accordion>
              </>
            )}
          </div>

          <DrawerFooter className="border-t border-neonPurple bg-darkPurple sticky bottom-0">
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1 border-neonPurple bg-darkPurple text-textMain hover:bg-neonPurple hover:text-textMain">
                Cancelar
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isSaving || isLoadingFormData || isLoadingVenda}
                className="flex-1 bg-primary hover:bg-primary/80 text-textMain"
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isSaving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Drawer para adicionar novo produto/serviço */}
      <NovoProdutoServicoDrawer
        isOpen={isNovoProdutoServicoOpen}
        onClose={() => setIsNovoProdutoServicoOpen(false)}
        onSuccess={handleNovoProdutoServicoSuccess}
      />
    </>
  );
} 