"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
// Componentes removidos - usando elementos HTML nativos
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
  const [accordionOpen, setAccordionOpen] = useState(false);

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
            <button
              type="button"
              onClick={handleClose}
              className={`${styles.button} ${styles.buttonGhost} ${styles.buttonSmall} ${styles.closeButton}`}
            >
              <X className="h-4 w-4" />
            </button>
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
                        <label className={styles.label}>Número do contrato</label>
                        <div className={styles.input}>
                          {contratoOriginal.numero_contrato || contratoOriginal.id}
                        </div>
                      </div>

                      <div>
                        <label className={styles.label}>Cliente</label>
                        <div className={styles.input}>
                          {contratoOriginal.cliente_nome}
                        </div>
                      </div>

                      <div>
                        <label className={styles.label}>Data de início</label>
                        <div className={styles.input}>
                          {contratoOriginal.data_inicio ? new Date(contratoOriginal.data_inicio).toLocaleDateString('pt-BR') : 'N/A'}
                        </div>
                      </div>

                      <div>
                        <label className={styles.label}>Status</label>
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
                        <label className={styles.label}>
                          Próximo vencimento <span className={styles.textRed}>*</span>
                        </label>
                        <input
                          type="date"
                          value={formData.proximoVencimento ? format(formData.proximoVencimento, "yyyy-MM-dd") : ""}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleInputChange('proximoVencimento', new Date(e.target.value));
                            }
                          }}
                          className={`${styles.input} ${!formData.proximoVencimento ? styles.textSecondary : ''}`}
                        />
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
                        <label className={styles.label}>
                          Categoria financeira
                        </label>
                        <select
                          value={formData.categoriaFinanceira}
                          onChange={(e) => handleInputChange('categoriaFinanceira', e.target.value)}
                          className={styles.input}
                        >
                          <option value="">Selecione a categoria</option>
                          {formDataFromAPI.categorias.map((categoria) => (
                            <option key={categoria.id} value={categoria.id.toString()}>
                              {categoria.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Sub-categoria */}
                      <div>
                        <label className={styles.label}>
                          Sub-categoria
                        </label>
                        <select
                          value={formData.subCategoria}
                          onChange={(e) => handleInputChange('subCategoria', e.target.value)}
                          className={styles.input}
                        >
                          <option value="">Selecione a sub-categoria</option>
                          {formDataFromAPI.subCategorias.map((subCategoria) => (
                            <option key={subCategoria.id} value={subCategoria.id.toString()}>
                              {subCategoria.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Produto/Serviço */}
                      <div>
                        <label className={styles.label}>
                          Produto/Serviço <span className={styles.textRed}>*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <select
                              value={formData.produtoServico}
                              onChange={(e) => handleInputChange('produtoServico', e.target.value)}
                              className={styles.input}
                            >
                              <option value="">Selecione o produto/serviço</option>
                              {formDataFromAPI.produtosServicos.map((produto) => (
                                <option key={produto.id} value={produto.id.toString()}>
                                  {produto.nome}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsNovoProdutoServicoOpen(true)}
                            className={`${styles.button} ${styles.buttonGhost} ${styles.buttonSmall}`}
                            title="Adicionar novo produto/serviço"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Centro de custo */}
                      <div>
                        <label className={styles.label}>
                          Centro de custo
                        </label>
                        <select
                          value={formData.centroCusto}
                          onChange={(e) => handleInputChange('centroCusto', e.target.value)}
                          className={styles.input}
                        >
                          <option value="">Selecione o centro de custo</option>
                          {formDataFromAPI.centrosCusto.map((centro) => (
                            <option key={centro.id} value={centro.id.toString()}>
                              {centro.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Vendedor responsável */}
                      <div>
                        <label className={styles.label}>Vendedor responsável</label>
                        <select
                          value={formData.vendedorResponsavel}
                          onChange={(e) => handleInputChange('vendedorResponsavel', e.target.value)}
                          className={styles.input}
                        >
                          <option value="">Selecione o vendedor</option>
                          {formDataFromAPI.users.map((user) => (
                            <option key={user.id} value={user.id.toString()}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Conta de recebimento */}
                      <div>
                        <label className={styles.label}>
                          Conta de recebimento <HelpCircle className="inline h-4 w-4 ml-1" />
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={formData.contaRecebimento}
                            onChange={(e) => handleInputChange('contaRecebimento', e.target.value)}
                            className={styles.input}
                          >
                            <option value="">Selecione a conta</option>
                            {/* Contas ERP */}
                            {formDataFromAPI.contas
                              .filter((conta) => Boolean(conta.descricao_banco && String(conta.descricao_banco).trim()))
                              .map((conta) => (
                                <option key={`erp-${conta.id}`} value={`erp:${conta.id}`}>
                                  {conta.banco} — {conta.descricao_banco}
                                </option>
                              ))}

                            {/* Contas API (OpenFinance) */}
                            {formDataFromAPI.contasApi
                              .filter((conta) => Boolean(conta.descricao_banco && String(conta.descricao_banco).trim()))
                              .map((conta) => (
                                <option key={`api-${conta.id}`} value={`api:${conta.id}`}>
                                  {conta.descricao_banco} (OpenFinance)
                                </option>
                              ))}

                            {formDataFromAPI.contas.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 &&
                             formDataFromAPI.contasApi.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 && (
                              <option value="" disabled>Nenhuma conta encontrada</option>
                            )}
                          </select>
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
                                <select
                                  value={item.produtoServico}
                                  onChange={(e) => handleItemChange(item.id, 'produtoServico', e.target.value)}
                                  className={styles.input}
                                >
                                  <option value="">Selecione produto/serviço</option>
                                  {formDataFromAPI.produtosServicos.map((produto) => (
                                    <option key={produto.id} value={produto.id.toString()}>
                                      {produto.nome}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className={styles.tableCell}>
                                <input
                                  type="text"
                                  value={item.detalhes}
                                  onChange={(e) => handleItemChange(item.id, 'detalhes', e.target.value)}
                                  placeholder="Detalhes do item"
                                  className={styles.input}
                                />
                              </td>
                              <td className={styles.tableCell}>
                                <input
                                  type="text"
                                  value={item.quantidade}
                                  onChange={(e) => handleItemChange(item.id, 'quantidade', e.target.value)}
                                  placeholder="1,00"
                                  className={styles.input}
                                />
                              </td>
                              <td className={styles.tableCell}>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={item.valorUnitario}
                                    onChange={(e) => handleItemChange(item.id, 'valorUnitario', e.target.value)}
                                    placeholder="0,00"
                                    className={`${styles.input} pl-8`}
                                  />
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-textSecondary">R$</span>
                                </div>
                              </td>
                              <td className={styles.tableCell}>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={item.total}
                                    onChange={(e) => handleItemChange(item.id, 'total', e.target.value)}
                                    placeholder="0,00"
                                    className={`${styles.input} pl-8 pr-8`}
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

                    <button
                      type="button"
                      onClick={addItem}
                      className={`${styles.button} ${styles.buttonOutline}`}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar nova linha
                    </button>
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
                      <label className={styles.label}>Desconto</label>
                      <div className="flex items-center gap-2">
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleInputChange('descontoTipo', 'reais')}
                            className={`${styles.button} ${formData.descontoTipo === 'reais' ? styles.buttonPrimary : styles.buttonOutline}`}
                            style={{ padding: '8px 16px' }}
                          >
                            R$
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInputChange('descontoTipo', 'percentual')}
                            className={`${styles.button} ${formData.descontoTipo === 'percentual' ? styles.buttonPrimary : styles.buttonOutline}`}
                            style={{ padding: '8px 16px' }}
                          >
                            %
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.descontoValor}
                            onChange={(e) => handleInputChange('descontoValor', e.target.value)}
                            className={`${styles.input} w-32 pl-8`}
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
                <div className={styles.card}>
                  <button
                    type="button"
                    onClick={() => setAccordionOpen(!accordionOpen)}
                    className={styles.cardHeader}
                    style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none', background: 'transparent' }}
                  >
                    <span className={styles.cardTitle}>Observações de pagamento</span>
                    <span style={{ float: 'right' }}>{accordionOpen ? '−' : '+'}</span>
                  </button>
                  {accordionOpen && (
                    <div className={styles.cardContent}>
                      <div>
                        <label className={styles.label}>Observações</label>
                        <textarea
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
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className={styles.drawerFooter}>
            <div className={styles.footerActions}>
              <button 
                type="button"
                onClick={handleClose} 
                className={`${styles.button} ${styles.buttonOutline}`}
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSave} 
                disabled={isSaving || isLoadingFormData || isLoadingContrato}
                className={`${styles.button} ${styles.buttonPrimary}`}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isSaving ? "Salvando..." : "Salvar alterações"}
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