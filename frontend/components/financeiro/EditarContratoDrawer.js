"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "./toggle-group";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";
import { Calendar } from "./calendar";
import {
  X,
  Plus,
  CalendarIcon,
  HelpCircle,
  Loader2,
  DollarSign,
  Search,
  Diamond,
  Info,
} from "lucide-react";
import NovoProdutoServicoDrawer from "./NovoProdutoServicoDrawer";
import { useContratos } from "../../hooks/financeiro/useContratos";
import { toast } from "react-toastify";
import styles from "../../styles/financeiro/DetalhesContratoDrawer.module.css";

// Função simples para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

export default function EditarContratoDrawer({
  isOpen,
  onClose,
  contratoId,
  opcaoEdicao,
}) {
  const [formData, setFormData] = useState({
    proximoVencimento: null,
    categoriaFinanceira: "",
    subCategoria: "",
    produtoServico: "",
    vendedorResponsavel: "",
    centroCusto: "",
    contaRecebimento: "",
    valor: "",
    desconto: "0",
    observacoesPagamento: "",
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

  const [contratoOriginal, setContratoOriginal] = useState(null);
  const [isLoadingFormData, setIsLoadingFormData] = useState(false);
  const [isLoadingContrato, setIsLoadingContrato] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isNovoProdutoServicoOpen, setIsNovoProdutoServicoOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL;
  
  // Usar o hook de contratos
  const { atualizarContrato, buscarContratos } = useContratos();

  // Carregar dados do formulário e do contrato quando abrir
  useEffect(() => {
    if (isOpen && contratoId) {
      setIsClosing(false); // Reset do estado de fechamento
      loadFormData();
      loadContratoData();
    }
  }, [isOpen, contratoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preencher data quando vem da edição de vencimento
  useEffect(() => {
    if (opcaoEdicao && opcaoEdicao.novaData) {
      setFormData(prev => ({
        ...prev,
        proximoVencimento: opcaoEdicao.novaData
      }));
    }
  }, [opcaoEdicao]);

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

  const loadContratoData = async () => {
    if (!contratoId) return;

    const token = localStorage.getItem("token");
    if (!token || !API) {
      console.error("Token não encontrado");
      return;
    }

    setIsLoadingContrato(true);
    try {
      const response = await fetch(`${API}/contratos/${contratoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar dados do contrato');
      }

      const contrato = await response.json();
      setContratoOriginal(contrato);

      // Preencher o formulário com os dados do contrato
      setFormData({
        proximoVencimento: contrato.proximo_vencimento ? new Date(contrato.proximo_vencimento) : null,
        categoriaFinanceira: contrato.categoria_id?.toString() || "",
        subCategoria: contrato.sub_categoria_id?.toString() || "",
        produtoServico: contrato.produtos_servicos_id?.toString() || "",
        vendedorResponsavel: contrato.vendedor_id?.toString() || "",
        centroCusto: contrato.centro_de_custo_id?.toString() || "",
        contaRecebimento: contrato.conta_api_id ? `api:${contrato.conta_api_id}` : contrato.conta_id ? `erp:${contrato.conta_id}` : "",
        valor: contrato.valor?.toString() || "",
        desconto: contrato.desconto?.toString() || "0",
        observacoesPagamento: contrato.observacoes || "",
        observacoesFiscais: contrato.observacoes_fiscais || "",
        descontoTipo: "reais", // Valor padrão
        descontoValor: contrato.desconto?.toString() || "0",
      });

      // Configurar itens (simplificado para um item principal)
      setItens([
        {
          id: "1",
          produtoServico: contrato.produtos_servicos_id?.toString() || "",
          detalhes: "",
          quantidade: "1,00",
          valorUnitario: contrato.valor?.toString() || "",
          total: contrato.valor?.toString() || "",
        },
      ]);

    } catch (error) {
      console.error("Erro ao carregar contrato:", error);
    } finally {
      setIsLoadingContrato(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
    loadFormData();
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 400); // Duração da animação de fechamento
  };

  const handleSave = async () => {
    if (!contratoId) return;

    setIsSaving(true);
    try {
      // Validar campos obrigatórios
      if (!formData.produtoServico) {
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
      
      // Campos obrigatórios que sempre devem ser enviados
      dadosAtualizacao.valor = calcularTotalFinal();
      dadosAtualizacao.desconto = calcularDesconto();
      
      // Campos opcionais que só são enviados se preenchidos
      if (formData.produtoServico) {
        dadosAtualizacao.produtos_servicos_id = parseInt(formData.produtoServico);
      }
      
      // Adicionar próximo vencimento se foi alterado
      if (formData.proximoVencimento) {
        dadosAtualizacao.proximo_vencimento = format(formData.proximoVencimento, 'yyyy-MM-dd');
      }
      
      if (formData.centroCusto) {
        dadosAtualizacao.centro_de_custo_id = parseInt(formData.centroCusto);
      }
      
      if (formData.vendedorResponsavel) {
        dadosAtualizacao.vendedor_id = parseInt(formData.vendedorResponsavel);
      }
      
      // Sempre enviar os campos de conta (mesmo que sejam null)
      dadosAtualizacao.conta_id = contaIdParsed;
      dadosAtualizacao.conta_api_id = contaApiIdParsed;
      
      if (formData.observacoesPagamento) {
        dadosAtualizacao.observacoes = formData.observacoesPagamento;
      }
      
      if (formData.observacoesFiscais) {
        dadosAtualizacao.observacoes_fiscais = formData.observacoesFiscais;
      }
      
      if (formData.categoriaFinanceira) {
        dadosAtualizacao.categoria_id = parseInt(formData.categoriaFinanceira);
      }
      
      if (formData.subCategoria) {
        dadosAtualizacao.sub_categoria_id = parseInt(formData.subCategoria);
      }

      console.log("Dados para atualização:", dadosAtualizacao);

      // Se vem da edição de vencimento, usar endpoint PUT com dados específicos
      if (opcaoEdicao) {
        // Preparar dados para envio incluindo a flag de vencimento
        const somenteProximoVencimento = opcaoEdicao.opcao === 'apenas';
        const dadosVencimento = {
          ...dadosAtualizacao,
          proximo_vencimento: format(formData.proximoVencimento, 'yyyy-MM-dd'),
          somente_proximo_vencimento: somenteProximoVencimento
        };

        console.log("🔍 Opção selecionada:", opcaoEdicao.opcao);
        console.log("🔍 somenteProximoVencimento boolean:", somenteProximoVencimento);
        console.log("🔍 Dados enviados para PUT vencimento:", dadosVencimento);
        console.log("🔍 JSON.stringify dos dados:", JSON.stringify(dadosVencimento));

        // Usar endpoint PUT normal mas com dados de vencimento
        await atualizarContrato(contratoId, dadosVencimento);
        toast.success(`Vencimento do contrato atualizado com sucesso! ${opcaoEdicao.opcao === 'apenas' ? '(Apenas esta data)' : '(Todas as próximas datas)'}`);
      } else {
        // Usar endpoint normal de atualização
        await atualizarContrato(contratoId, dadosAtualizacao);
        toast.success("Contrato atualizado com sucesso!");
      }
      
      handleClose();
    } catch (error) {
      console.error("Erro ao atualizar contrato:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao atualizar contrato";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={cn(
        styles.drawerContainer,
        isClosing && "closing"
      )}>
        <div
          className={cn(
            styles.drawerContent,
            isClosing && "closing"
          )}
        >
          {/* Header */}
          <div className={styles.drawerHeader}>
            <div className={styles.headerLeft}>
              <h2 className={styles.headerTitle}>Editar Contrato</h2>
              <p className={styles.headerSubtitle}>
                Edite as informações do contrato
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className={styles.closeButton}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className={styles.drawerContentArea}>
            {(isLoadingFormData || isLoadingContrato) && (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <span className={styles.loadingText}>Carregando dados...</span>
              </div>
            )}

            {!isLoadingFormData && !isLoadingContrato && contratoOriginal && (
              <>
                {/* Informações do contrato (somente leitura) */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Informações do Contrato</h3>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.gridTwoCols}>
                      <div>
                        <Label className={styles.label}>Número do contrato</Label>
                        <div className={styles.input}>
                          {contratoOriginal.numero_contrato || contratoOriginal.id}
                        </div>
                      </div>

                      <div>
                        <Label className={styles.label}>Cliente</Label>
                        <div className={styles.input}>
                          {contratoOriginal.cliente_nome}
                        </div>
                      </div>

                      <div>
                        <Label className={styles.label}>Data de início</Label>
                        <div className={styles.input}>
                          {contratoOriginal.data_inicio ? new Date(contratoOriginal.data_inicio).toLocaleDateString('pt-BR') : 'N/A'}
                        </div>
                      </div>

                      <div>
                        <Label className={styles.label}>Status</Label>
                        <div className={styles.input}>
                          {contratoOriginal.status}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção Próximo Vencimento */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Próximo Vencimento</h3>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.gridTwoCols}>
                      {/* Próximo vencimento */}
                      <div>
                        <Label className={styles.label}>
                          Próximo vencimento <span className={styles.textRed}>*</span>
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                styles.buttonOutline,
                                !formData.proximoVencimento && styles.textSecondary
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.proximoVencimento ? (
                                format(formData.proximoVencimento, "dd/MM/yyyy", { locale: ptBR })
                              ) : (
                                <span>Selecione uma data</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={formData.proximoVencimento || undefined}
                              onSelect={(date) => handleInputChange('proximoVencimento', date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção Classificação */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Classificação</h3>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.gridTwoCols}>
                      {/* Categoria financeira */}
                      <div>
                        <Label className={styles.label}>
                          Categoria financeira
                        </Label>
                        <Select
                          value={formData.categoriaFinanceira}
                          onValueChange={(value) => handleInputChange('categoriaFinanceira', value)}
                        >
                          <SelectTrigger className={styles.input}>
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {formDataFromAPI.categorias.map((categoria) => (
                              <SelectItem key={categoria.id} value={categoria.id.toString()}>
                                {categoria.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Sub-categoria */}
                      <div>
                        <Label className={styles.label}>
                          Sub-categoria
                        </Label>
                        <Select
                          value={formData.subCategoria}
                          onValueChange={(value) => handleInputChange('subCategoria', value)}
                        >
                          <SelectTrigger className={styles.input}>
                            <SelectValue placeholder="Selecione a sub-categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {formDataFromAPI.subCategorias.map((subCategoria) => (
                              <SelectItem key={subCategoria.id} value={subCategoria.id.toString()}>
                                {subCategoria.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Produto/Serviço */}
                      <div>
                        <Label className={styles.label}>
                          Produto/Serviço <span className={styles.textRed}>*</span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <Select
                              value={formData.produtoServico}
                              onValueChange={(value) => handleInputChange('produtoServico', value)}
                            >
                              <SelectTrigger className={styles.input}>
                                <SelectValue placeholder="Selecione o produto/serviço" />
                              </SelectTrigger>
                              <SelectContent>
                                {formDataFromAPI.produtosServicos.map((produto) => (
                                  <SelectItem key={produto.id} value={produto.id.toString()}>
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
                            className={styles.buttonSmall}
                            title="Adicionar novo produto/serviço"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Centro de custo */}
                      <div>
                        <Label className={styles.label}>
                          Centro de custo
                        </Label>
                        <Select
                          value={formData.centroCusto}
                          onValueChange={(value) => handleInputChange('centroCusto', value)}
                        >
                          <SelectTrigger className={styles.input}>
                            <SelectValue placeholder="Selecione o centro de custo" />
                          </SelectTrigger>
                          <SelectContent>
                            {formDataFromAPI.centrosCusto.map((centro) => (
                              <SelectItem key={centro.id} value={centro.id.toString()}>
                                {centro.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Vendedor responsável */}
                      <div>
                        <Label className={styles.label}>Vendedor responsável</Label>
                        <Select
                          value={formData.vendedorResponsavel}
                          onValueChange={(value) => handleInputChange('vendedorResponsavel', value)}
                        >
                          <SelectTrigger className={styles.input}>
                            <SelectValue placeholder="Selecione o vendedor" />
                          </SelectTrigger>
                          <SelectContent>
                            {formDataFromAPI.users.map((user) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Conta de recebimento */}
                      <div>
                        <Label className={styles.label}>
                          Conta de recebimento <HelpCircle className="inline h-4 w-4 ml-1" />
                        </Label>
                        <div className="flex items-center gap-2">
                          <Select
                            value={formData.contaRecebimento}
                            onValueChange={(value) => handleInputChange('contaRecebimento', value)}
                          >
                            <SelectTrigger className={styles.input}>
                              <SelectValue placeholder="Selecione a conta" />
                            </SelectTrigger>
                            <SelectContent>
                              {/* Contas ERP */}
                              {formDataFromAPI.contas
                                .filter((conta) => Boolean(conta.descricao_banco && String(conta.descricao_banco).trim()))
                                .map((conta) => (
                                  <SelectItem
                                    key={`erp-${conta.id}`}
                                    value={`erp:${conta.id}`}
                                    className="flex justify-between items-center"
                                  >
                                    <span>{conta.banco} — {conta.descricao_banco}</span>
                                  </SelectItem>
                                ))}

                              {/* Contas API (OpenFinance) */}
                              {formDataFromAPI.contasApi
                                .filter((conta) => Boolean(conta.descricao_banco && String(conta.descricao_banco).trim()))
                                .map((conta) => (
                                  <SelectItem
                                    key={`api-${conta.id}`}
                                    value={`api:${conta.id}`}
                                    className="flex justify-between items-center"
                                  >
                                    <span>{conta.descricao_banco}</span>
                                    <span className={cn(styles.badge, styles.badgeInfo)}>OpenFinance</span>
                                  </SelectItem>
                                ))}

                              {formDataFromAPI.contas.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 &&
                               formDataFromAPI.contasApi.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 && (
                                <div className={styles.textSecondary}>
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
                </div>

                {/* Seção Itens */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Itens</h3>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.tableContainer}>
                      <table className={styles.table}>
                        <thead className={styles.tableHeader}>
                          <tr>
                            <th className={styles.tableHeaderCell}>Produtos/Serviços <span className={styles.textRed}>*</span></th>
                            <th className={styles.tableHeaderCell}>Detalhes do item</th>
                            <th className={styles.tableHeaderCell}>Quantidade <span className={styles.textRed}>*</span></th>
                            <th className={styles.tableHeaderCell}>Valor unitário <span className={styles.textRed}>*</span></th>
                            <th className={styles.tableHeaderCell}>Total <span className={styles.textRed}>*</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {itens.map((item, index) => (
                            <tr key={item.id} className={styles.tableRow}>
                              <td className={styles.tableCell}>
                                <Select
                                  value={item.produtoServico}
                                  onValueChange={(value) => handleItemChange(item.id, 'produtoServico', value)}
                                >
                                  <SelectTrigger className={styles.input}>
                                    <SelectValue placeholder="Selecione produto/serviço" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {formDataFromAPI.produtosServicos.map((produto) => (
                                      <SelectItem key={produto.id} value={produto.id.toString()}>
                                        {produto.nome}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className={styles.tableCell}>
                                <Input
                                  value={item.detalhes}
                                  onChange={(e) => handleItemChange(item.id, 'detalhes', e.target.value)}
                                  placeholder="Detalhes do item"
                                  className={styles.input}
                                />
                              </td>
                              <td className={styles.tableCell}>
                                <Input
                                  value={item.quantidade}
                                  onChange={(e) => handleItemChange(item.id, 'quantidade', e.target.value)}
                                  placeholder="1,00"
                                  className={styles.input}
                                />
                              </td>
                              <td className={styles.tableCell}>
                                <div className="relative">
                                  <Input
                                    value={item.valorUnitario}
                                    onChange={(e) => handleItemChange(item.id, 'valorUnitario', e.target.value)}
                                    placeholder="0,00"
                                    className={cn(styles.input, "pl-8")}
                                  />
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-textSecondary">R$</span>
                                </div>
                              </td>
                              <td className={styles.tableCell}>
                                <div className="relative">
                                  <Input
                                    value={item.total}
                                    onChange={(e) => handleItemChange(item.id, 'total', e.target.value)}
                                    placeholder="0,00"
                                    className={cn(styles.input, "pl-8 pr-8")}
                                    readOnly
                                  />
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-textSecondary">R$</span>
                                  <Diamond className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <Button
                      variant="outline"
                      onClick={addItem}
                      className={cn(styles.button, styles.buttonOutline)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar nova linha
                    </Button>
                  </div>
                </div>

                {/* Seção Valor */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Valor</h3>
                  </div>
                  <div className={styles.cardContent}>
                    {/* Desconto */}
                    <div>
                      <Label className={styles.label}>Desconto</Label>
                      <div className="flex items-center gap-2">
                        <ToggleGroup
                          type="single"
                          value={formData.descontoTipo}
                          onValueChange={(value) => value && handleInputChange('descontoTipo', value)}
                        >
                          <ToggleGroupItem value="reais">
                            R$
                          </ToggleGroupItem>
                          <ToggleGroupItem value="percentual">
                            %
                          </ToggleGroupItem>
                        </ToggleGroup>
                        <div className="relative">
                          <Input
                            value={formData.descontoValor}
                            onChange={(e) => handleInputChange('descontoValor', e.target.value)}
                            className={cn(styles.input, "w-32 pl-8")}
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-textSecondary">
                            {formData.descontoTipo === 'reais' ? 'R$' : '%'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Total do contrato */}
                    <div className={styles.totalSection}>
                      <div className={styles.totalContainer}>
                        <div className={styles.totalRow}>
                          <span className={styles.textMain}>Itens (R$)</span>
                          <span className={styles.textMain}>{calcularTotalItens().toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className={styles.totalRow}>
                          <span className={styles.textRed}>- Desconto (R$)</span>
                          <span className={styles.textRed}>{calcularDesconto().toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className={cn(styles.totalRow, "border-t pt-2 font-semibold text-lg")}>
                          <span className={styles.textMain}>= Total (R$)</span>
                          <span className={styles.textMain}>{calcularTotalFinal().toFixed(2).replace('.', ',')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seções colapsáveis */}
                <Accordion type="multiple">
                  {/* Observações de pagamento */}
                  <AccordionItem value="observacoes-pagamento" className={styles.card}>
                    <AccordionTrigger className={styles.cardHeader}>
                      <span className={styles.cardTitle}>Observações de pagamento</span>
                    </AccordionTrigger>
                    <AccordionContent className={styles.cardContent}>
                      <div>
                        <Label className={styles.label}>Observações</Label>
                        <Textarea
                          value={formData.observacoesPagamento}
                          onChange={(e) => handleInputChange('observacoesPagamento', e.target.value)}
                          placeholder="Inclua informações sobre o pagamento..."
                          rows={3}
                          className={styles.input}
                        />
                        <p className={cn(styles.textSecondary, "text-xs mt-2")}>
                          Inclua informações sobre o pagamento que podem ser relevantes para você e seu cliente.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            )}
          </div>

          {/* Footer */}
          <div className={styles.drawerFooter}>
            <div className={styles.footerActions}>
              <Button 
                variant="outline" 
                onClick={handleClose} 
                className={cn(styles.button, styles.buttonOutline)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isSaving || isLoadingFormData || isLoadingContrato}
                className={cn(styles.button, styles.buttonPrimary)}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isSaving ? "Salvando..." : "Salvar alterações"}
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