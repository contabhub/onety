"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "./botao";
import { Input } from "./input";
import { Label } from "./label";
import { Textarea } from "./textarea";
import { toast } from "react-toastify";
import styles from "../../styles/financeiro/NovoContratoDrawer.module.css";
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
  Zap,
  CalendarIcon,
  HelpCircle,
  Loader2,
  ChevronDown,
  DollarSign,
  Search,
  Diamond,
  Info,
  RefreshCw,
} from "lucide-react";
import NovoProdutoServicoDrawer from "./NovoProdutoServicoDrawer";
import NovoDepartamentoDrawer from "./NovoDepartamentoDrawer";
import { useContratos } from "../../hooks/financeiro/useContratos";
import ReactSelect from "react-select";


// Estilos customizados para o ReactSelect
const customSelectStyles = {
  control: (provided, state) => ({
    ...provided,
    backgroundColor: 'var(--onety-bg-dark-purple)',
    borderColor: state.isFocused ? 'var(--onety-primary)' : 'var(--onety-neon-purple-border)',
    borderWidth: '1px',
    borderRadius: 'var(--onety-border-radius-sm)',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(99, 102, 241, 0.1)' : 'none',
    minHeight: '40px',
    transition: 'var(--onety-transition)',
    '&:hover': {
      borderColor: 'var(--onety-primary)',
    },
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: 'var(--onety-bg-dark-purple)',
    border: '1px solid var(--onety-neon-purple-border)',
    borderRadius: 'var(--onety-border-radius-sm)',
    zIndex: 'var(--onety-z-dropdown)',
    boxShadow: 'var(--onety-shadow-lg)',
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isFocused ? 'var(--onety-neon-purple-light)' : 'transparent',
    color: state.isFocused ? 'var(--onety-text-main)' : 'var(--onety-text-secondary)',
    transition: 'var(--onety-transition)',
    '&:hover': {
      backgroundColor: 'var(--onety-neon-purple-light)',
      color: 'var(--onety-text-main)',
    },
  }),
  singleValue: (provided) => ({
    ...provided,
    color: 'var(--onety-text-main)',
  }),
  input: (provided) => ({
    ...provided,
    color: 'var(--onety-text-main)',
  }),
  placeholder: (provided) => ({
    ...provided,
    color: 'var(--onety-text-secondary)',
  }),
  dropdownIndicator: (provided) => ({
    ...provided,
    color: 'var(--onety-text-secondary)',
    transition: 'var(--onety-transition)',
    '&:hover': {
      color: 'var(--onety-text-main)',
    },
  }),
  clearIndicator: (provided) => ({
    ...provided,
    color: 'var(--onety-text-secondary)',
    transition: 'var(--onety-transition)',
    '&:hover': {
      color: 'var(--onety-error)',
    },
  }),
};

export default function NovoContratoDrawer({
  isOpen,
  onClose,
  onSave,
}) {
  const [formData, setFormData] = useState({
    tipoVenda: "venda-recorrente",
    numeroContrato: "",
    cliente: "",
    dataInicio: null,
    diaGeracaoVendas: "1",
    dataPrimeiraVenda: null,
    repetirVenda: "1",
    periodoRecorrencia: "mes",
    terminoRecorrencia: "indeterminado",
    dataTermino: null,
    vigenciaTotal: "",
    categoria: "",
    produtoServico: "",
    vendedorResponsavel: "",
    centroCusto: "",
    usarCentroCustoPorItem: false,
    formaPagamento: "",
    contaRecebimento: "",
    vencimentoSempre: "5",
    vencimento: null,
    valor: "",
    desconto: "0",
    observacoesPagamento: "",
    observacoesFiscais: "",
    // Campos de recorrência
    tipoIntervalo: "meses",
    intervalo: "1",
    indeterminado: true,
    totalCiclos: "",
    // Campos de desconto
    descontoTipo: "reais",
    descontoValor: "0",
  });

  const [itens, setItens] = useState([
    {
      id: "1",
      produtoServico: "",
      departamento: "",
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
    departamentos: [],
  });

  const [isLoadingFormData, setIsLoadingFormData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isNovoProdutoServicoOpen, setIsNovoProdutoServicoOpen] = useState(false);
  const [isNovoDepartamentoOpen, setIsNovoDepartamentoOpen] = useState(false);
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL;
  
  // Usar o hook de contratos para gerar número automático
  const { buscarProximoNumeroContrato } = useContratos();

  // Função para converter valor brasileiro para número
  const parseValorBrasileiro = (valor) => {
    if (!valor) return 0;
    
    // Remove símbolos de moeda e espaços
    let valorLimpo = valor.replace(/[^\d.,]/g, '');
    
    // Se tem vírgula e ponto, a vírgula é decimal
    if (valorLimpo.includes(',') && valorLimpo.includes('.')) {
      // Verifica qual vem por último para determinar o separador decimal
      const ultimaVirgula = valorLimpo.lastIndexOf(',');
      const ultimoPonto = valorLimpo.lastIndexOf('.');
      
      if (ultimaVirgula > ultimoPonto) {
        // Vírgula é decimal: 1.250,50 → 1250.50
        valorLimpo = valorLimpo.replace(/\./g, '').replace(',', '.');
      } else {
        // Ponto é decimal: 1,250.50 → 1250.50
        valorLimpo = valorLimpo.replace(/,/g, '');
      }
    } else if (valorLimpo.includes(',')) {
      // Só tem vírgula - pode ser decimal ou separador de milhares
      const partes = valorLimpo.split(',');
      if (partes.length === 2 && partes[1].length <= 2) {
        // Vírgula como decimal: 1250,50 → 1250.50
        valorLimpo = valorLimpo.replace(',', '.');
      } else {
        // Vírgula como separador de milhares: 1,250 → 1250
        valorLimpo = valorLimpo.replace(/,/g, '');
      }
    }
    // Se só tem ponto, mantém como está (formato americano ou separador de milhares)
    
    return parseFloat(valorLimpo) || 0;
  };

  // Função para formatar número no padrão brasileiro
  const formatarValorBrasileiro = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor);
  };

  // Função para criar lista apenas de subcategorias de receita
  const getSubCategoriasReceita = () => {
    const items = [];

    // Filtrar apenas subcategorias de receita
    formDataFromAPI.subCategorias.forEach((subCategoria) => {
      // Verificar se a categoria pai é de receita
      const categoriaPai = formDataFromAPI.categorias.find(cat => cat.id === subCategoria.categoria_id);
      if (categoriaPai) {
        items.push({
          id: subCategoria.id,
          nome: subCategoria.nome,
          isSubcategoria: true,
          categoria_id: subCategoria.categoria_id,
          categoria_pai_nome: categoriaPai.nome, // Adicionar nome da categoria pai para exibição
        });
      }
    });

    // Ordenar alfabeticamente por categoria pai e depois por subcategoria
    return items.sort((a, b) => {
      // Primeiro ordena por categoria pai
      const categoriaCompare = (a.categoria_pai_nome || '').localeCompare(b.categoria_pai_nome || '');
      if (categoriaCompare !== 0) return categoriaCompare;
      
      // Se a categoria pai for igual, ordena por nome da subcategoria
      return a.nome.localeCompare(b.nome);
    });
  };
  
  // Carregar dados do formulário da API e gerar número automático
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false); // Reset do estado de fechamento
      loadFormData();
      // Gerar número de contrato automaticamente quando abrir o drawer
      gerarNumeroContratoAutomatico();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFormData = async () => {
    const empresaId = localStorage.getItem("empresaId");
    const token = localStorage.getItem("token");

    if (!empresaId || !token || !API) {
      console.error("EmpresaId ou Token não encontrados");
      toast.error("Erro: Dados de autenticação não encontrados");
      return;
    }

    setIsLoadingFormData(true);
    try {
      // EXATAMENTE IGUAL AO NOVA RECEITA - carregar cada endpoint separadamente
      
      // 1. Buscar clientes
      const fetchClientes = async () => {
        try {
          const res = await fetch(`${API}/clientes/company/${empresaId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          return data;
        } catch (error) {
          console.error("Erro ao buscar clientes:", error);
          return [];
        }
      };

      // 2. Buscar categorias de receita
      const fetchCategorias = async () => {
        try {
          const res = await fetch(`${API}/companies/${empresaId}/categorias`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          // Filtrar apenas categorias de receita
          const receitaData = data.find((item) => item.tipo === "Receita");
          return receitaData?.categorias || [];
        } catch (error) {
          console.error("Erro ao buscar categorias:", error);
          return [];
        }
      };

      // 3. Buscar subcategorias
      const fetchSubCategorias = async () => {
        try {
          const res = await fetch(`${API}/sub-categorias/empresa/${empresaId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          return data;
        } catch (error) {
          console.error("Erro ao buscar subcategorias:", error);
          return [];
        }
      };

      // 4. Buscar centros de custo
      const fetchCentrosDeCusto = async () => {
        try {
          const res = await fetch(`${API}/centro-de-custo/empresa/${empresaId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          return data;
        } catch (error) {
          console.error("Erro ao buscar centros de custo:", error);
          return [];
        }
      };

      // 5. Buscar usuários
      const fetchUsers = async () => {
        try {
          const res = await fetch(`${API}/users/company/${empresaId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          return data;
        } catch (error) {
          console.error("Erro ao buscar usuários:", error);
          return [];
        }
      };

      // 6. Buscar contas ERP
      const fetchContas = async () => {
        try {
          const res = await fetch(`${API}/contas/empresa/${empresaId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          return Array.isArray(data) ? data : Array.isArray(data?.contas) ? data.contas : [];
        } catch (error) {
          console.error("Erro ao buscar contas:", error);
          return [];
        }
      };

      // 7. Buscar contas API
      const fetchContasApi = async () => {
        try {
          const res = await fetch(`${API}/contas-api/company/${empresaId}/contas`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const json = await res.json();
          return Array.isArray(json) ? json : Array.isArray(json.contas) ? json.contas : [];
        } catch (error) {
          console.error("Erro ao buscar contas API:", error);
          return [];
        }
      };

      // 8. Buscar produtos/serviços
      const fetchProdutosServicos = async () => {
        try {
          const res = await fetch(`${API}/produtos-servicos/company/${empresaId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          return data;
        } catch (error) {
          console.error("Erro ao buscar produtos/serviços:", error);
          return [];
        }
      };

      // 9. Buscar departamentos
      const fetchDepartamentos = async () => {
        try {
          const res = await fetch(`${API}/departamentos?company_id=${empresaId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          return data;
        } catch (error) {
          console.error("Erro ao buscar departamentos:", error);
          return [];
        }
      };

      // Executar todas as requisições em paralelo
      const [
        clientes,
        categorias,
        subCategorias,
        centrosCusto,
        users,
        contas,
        contasApi,
        produtosServicos,
        departamentos
      ] = await Promise.all([
        fetchClientes(),
        fetchCategorias(),
        fetchSubCategorias(),
        fetchCentrosDeCusto(),
        fetchUsers(),
        fetchContas(),
        fetchContasApi(),
        fetchProdutosServicos(),
        fetchDepartamentos()
      ]);

      console.log("📊 Dados carregados:", {
        clientes: clientes.length,
        categorias: categorias.length,
        subCategorias: subCategorias.length,
        centrosCusto: centrosCusto.length,
        users: users.length,
        contas: contas.length,
        contasApi: contasApi.length,
        produtosServicos: produtosServicos.length,
        departamentos: departamentos.length
      });

      setFormDataFromAPI({
        clientes,
        categorias,
        subCategorias,
        centrosCusto,
        users,
        contas,
        contasApi,
        produtosServicos,
        departamentos
      });
      
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados do formulário. Tente novamente.");
    } finally {
      setIsLoadingFormData(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Função para gerar número de contrato automaticamente
  const gerarNumeroContratoAutomatico = async () => {
    try {
      setIsGeneratingNumber(true);
      const proximoNumero = await buscarProximoNumeroContrato();
      setFormData(prev => ({ ...prev, numeroContrato: proximoNumero }));
      toast.success("Número do contrato gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar número de contrato:", error);
      toast.error("Erro ao gerar número do contrato automaticamente");
    } finally {
      setIsGeneratingNumber(false);
    }
  };

  const handleItemChange = (id, field, value) => {
    setItens(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Calcular total se quantidade e valor unitário estiverem preenchidos
        if (field === 'quantidade' || field === 'valorUnitario') {
          const quantidade = parseValorBrasileiro(updatedItem.quantidade);
          const valorUnitario = parseValorBrasileiro(updatedItem.valorUnitario);
          const totalCalculado = quantidade * valorUnitario;
          updatedItem.total = formatarValorBrasileiro(totalCalculado);
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
      departamento: "",
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
      const valor = parseValorBrasileiro(item.total);
      return total + valor;
    }, 0);
  };

  const calcularDesconto = () => {
    const totalItens = calcularTotalItens();
    const descontoValor = parseValorBrasileiro(formData.descontoValor);
    
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
    toast.success("Produto/Serviço criado com sucesso!");
  };

  const handleNovoDepartamentoSuccess = () => {
    // Recarregar os dados de departamentos após criar um novo
    loadFormData();
    toast.success("Departamento criado com sucesso!");
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 400); // Duração da animação de fechamento
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const empresaId = localStorage.getItem("empresaId");
      const userId = localStorage.getItem("userId");
      
      if (!empresaId || !userId) {
        toast.error("Dados de autenticação não encontrados");
        throw new Error("Dados de autenticação não encontrados");
      }

      // Validar campos obrigatórios
      if (!formData.numeroContrato) {
        toast.warning("Por favor, preencha o número do contrato");
        throw new Error("Número do contrato é obrigatório");
      }

      if (!formData.cliente) {
        toast.warning("Por favor, selecione um cliente");
        throw new Error("Cliente é obrigatório");
      }

      if (!formData.dataInicio) {
        toast.warning("Por favor, selecione a data de início");
        throw new Error("Data de início é obrigatória");
      }

      if (!formData.dataPrimeiraVenda) {
        toast.warning("Por favor, selecione a data da primeira venda");
        throw new Error("Data da primeira venda é obrigatória");
      }

      if (!formData.vencimento) {
        toast.warning("Por favor, selecione a data de vencimento");
        throw new Error("Data de vencimento é obrigatória");
      }

      if (!formData.categoria) {
        toast.warning("Por favor, selecione uma subcategoria de receita");
        throw new Error("Subcategoria de receita é obrigatória");
      }

      // Filtrar itens válidos (com produto/serviço selecionado)
      const itensValidos = itens.filter(item => item.produtoServico && item.produtoServico.trim() !== '');
      
      if (itensValidos.length === 0) {
        toast.warning("Adicione pelo menos um produto ou serviço");
        throw new Error("Adicione pelo menos um produto ou serviço");
      }

      // Verificar se todos os itens válidos têm quantidade e valor preenchidos
      const itensIncompletos = itensValidos.filter(item => 
        !item.quantidade || 
        !item.valorUnitario || 
        parseFloat(item.quantidade.replace(',', '.')) <= 0 ||
        parseFloat(item.valorUnitario.replace(/[^\d,.-]/g, '').replace(',', '.')) <= 0
      );
      
      if (itensIncompletos.length > 0) {
        toast.warning(`Preencha quantidade e valor válidos para todos os ${itensIncompletos.length} produto(s)/serviço(s) selecionado(s)`);
        throw new Error(`Preencha quantidade e valor válidos para todos os ${itensIncompletos.length} produto(s)/serviço(s) selecionado(s)`);
      }

      // Verificar se o total calculado é maior que zero
      const totalCalculado = calcularTotalFinal();
      if (totalCalculado <= 0) {
        toast.warning("O valor total do contrato deve ser maior que zero");
        throw new Error("O valor total do contrato deve ser maior que zero");
      }

      // Validar campos de recorrência
      if (!formData.tipoIntervalo || !formData.intervalo) {
        toast.warning("Preencha os campos de recorrência obrigatórios (Tipo de intervalo e Intervalo)");
        throw new Error("Preencha os campos de recorrência obrigatórios");
      }

      if (!formData.indeterminado && !formData.totalCiclos) {
        toast.warning("Para recorrência personalizada, informe o total de ciclos");
        throw new Error("Para recorrência personalizada, informe o total de ciclos");
      }

      // Validar conta de recebimento
      if (!formData.contaRecebimento) {
        toast.warning("Por favor, selecione a conta de recebimento");
        throw new Error("Conta de recebimento é obrigatória");
      }

      // Processar conta de recebimento (ERP ou API)
      const isApi = formData.contaRecebimento?.startsWith('api:');
      const isErp = formData.contaRecebimento?.startsWith('erp:');
      const contaIdParsed = isErp ? parseInt(formData.contaRecebimento.split(':')[1]) : null;
      const contaApiIdParsed = isApi ? parseInt(formData.contaRecebimento.split(':')[1]) : null;

      // Preparar array de produtos/serviços a partir dos itens
      const produtosServicos = itens
        .filter(item => item.produtoServico && item.produtoServico.trim() !== '')
        .map(item => ({
          produtos_servicos_id: parseInt(item.produtoServico),
          departamento_id: item.departamento && item.departamento.trim() !== '' ? parseInt(item.departamento) : null,
          quantidade: parseValorBrasileiro(item.quantidade) || 1,
          valor_unitario: parseValorBrasileiro(item.valorUnitario) || 0,
          desconto: 0, // Por enquanto, desconto será aplicado no nível do contrato
          observacoes: item.detalhes || null
        }));

      // Encontrar o item selecionado (categoria ou subcategoria)
      const itemSelecionado = getSubCategoriasReceita().find(
        (item) => item.id.toString() === formData.categoria
      );

      if (!itemSelecionado) {
        toast.error("Por favor, selecione uma subcategoria válida.");
        throw new Error("Subcategoria inválida");
      }

      // Preparar dados do contrato para a rota específica de contratos
      const dadosContrato = {
        cliente_id: parseInt(formData.cliente),
        // Manter produtos_servicos_id para compatibilidade (primeiro item ou null)
        produtos_servicos_id: produtosServicos.length > 0 ? produtosServicos[0].produtos_servicos_id : null,
        // Novo: array de produtos/serviços
        produtos_servicos: produtosServicos,
        company_id: parseInt(empresaId),
        valor: calcularTotalFinal(), // Valor calculado dos itens com desconto
        desconto: calcularDesconto(), // Desconto calculado
        data_inicio: formData.dataInicio ? format(formData.dataInicio, 'yyyy-MM-dd') : '',
        dia_gerado: formData.dataPrimeiraVenda ? format(formData.dataPrimeiraVenda, 'yyyy-MM-dd') : (formData.dataInicio ? format(formData.dataInicio, 'yyyy-MM-dd') : ''),
        proximo_vencimento: formData.vencimento ? format(formData.vencimento, 'yyyy-MM-dd') : (formData.dataInicio ? format(formData.dataInicio, 'yyyy-MM-dd') : ''),
        status: "ativo",
        observacoes: `${formData.observacoesPagamento || ''} | Contrato Nº: ${formData.numeroContrato}`,
        // Novos campos adicionados
        centro_de_custo_id: formData.centroCusto ? parseInt(formData.centroCusto) : null,
        vendedor_id: formData.vendedorResponsavel ? parseInt(formData.vendedorResponsavel) : parseInt(userId),
        observacoes_fiscais: formData.observacoesFiscais,
        numero_contrato: formData.numeroContrato,
        // Campos de categoria e sub-categoria
        categoria_id: itemSelecionado.isSubcategoria
          ? itemSelecionado.categoria_id
          : itemSelecionado.id,
        sub_categoria_id: itemSelecionado.isSubcategoria
          ? itemSelecionado.id
          : null,
        // Conta de recebimento
        conta_id: contaIdParsed,
        conta_api_id: contaApiIdParsed,
        // Dados de recorrência
        recorrencia: {
          tipo_intervalo: formData.tipoIntervalo,
          intervalo: parseInt(formData.intervalo),
          indeterminado: formData.indeterminado,
          total_ciclos: formData.indeterminado ? null : parseInt(formData.totalCiclos),
          status: "ativo"
        }
      };

      console.log("Dados do contrato sendo enviados:", dadosContrato);

      await onSave(dadosContrato);
      toast.success("Contrato salvo com sucesso!");
      handleClose();
    } catch (error) {
      console.error("Erro ao salvar contrato:", error);
      // Se o erro não foi tratado acima (validações), exibe uma mensagem genérica
      if (!error.message.includes("obrigatório") && !error.message.includes("Adicione") && !error.message.includes("Preencha")) {
        toast.error(error.message || "Erro ao salvar contrato. Tente novamente.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={`${styles.novoContratoOverlay} ${isClosing ? styles.closing : ''}`}>
        <div
          className={`${styles.novoContratoDrawer} ${isClosing ? styles.closing : ''}`}
        >
          {/* Header */}
          <div className={styles.header}>
            <div>
              <h2 className={styles.headerTitle}>Novo Contrato</h2>
              <p className={styles.headerSubtitle}>
                Preencha as informações do contrato recorrente
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
          <div className={styles.content}>
            <div className={styles.contentInner}>
            {isLoadingFormData && (
              <div className={styles.loadingContainer}>
                <Loader2 className="h-6 w-6 animate-spin text-textMain" />
                <span className={styles.loadingText}>Carregando dados...</span>
              </div>
            )}

            {!isLoadingFormData && (
              <>
                {/* Seção Informações */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Informações</h3>
                

                  <div className={`${styles.grid} ${styles.gridTwoCols}`}>
                    {/* Número do contrato */}
                    <div className={styles.fieldContainer}>
                      <Label className={styles.label}>
                        Número do contrato <span className={styles.required}>*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          value={formData.numeroContrato}
                          onChange={(e) => handleInputChange('numeroContrato', e.target.value)}
                          className={`${styles.input} pr-10`}
                          placeholder="Digite ou gere automaticamente"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={gerarNumeroContratoAutomatico}
                          disabled={isGeneratingNumber}
                          className={`${styles.buttonIcon} absolute right-1 top-1/2 -translate-y-1/2`}
                          title="Gerar número automaticamente"
                        >
                          {isGeneratingNumber ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <p className={styles.textSecondary}>
                        Clique no ícone para gerar o próximo número automaticamente
                      </p>
                    </div>

                    {/* Cliente */}
                    <div className={styles.fieldContainer}>
                      <Label className={styles.label}>
                        Cliente <span className={styles.required}>*</span>
                      </Label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <ReactSelect
                            options={(formDataFromAPI.clientes || []).map((cliente) => ({
                              value: cliente.id.toString(),
                              label: cliente.nome_fantasia,
                            }))}
                            value={formDataFromAPI.clientes.find((cliente) => cliente.id.toString() === formData.cliente) 
                              ? { value: formData.cliente, label: formDataFromAPI.clientes.find((cliente) => cliente.id.toString() === formData.cliente)?.nome_fantasia }
                              : null}
                            onChange={(option) => handleInputChange('cliente', option ? option.value : '')}
                            placeholder="Pesquisar cliente..."
                            styles={customSelectStyles}
                            isClearable
                            isSearchable
                            noOptionsMessage={() => "Nenhum cliente encontrado"}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className={styles.buttonOutline}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          <Search className="h-4 w-4 mr-1" />
                          ?
                        </Button>
                      </div>
                    </div>

                    {/* Data de início */}
                    <div className={styles.fieldContainer}>
                      <Label className={styles.label}>
                        Data de início <span className={styles.required}>*</span> <HelpCircle className={styles.helpIcon} />
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`${styles.calendarButton} ${!formData.dataInicio ? styles.placeholder : ''}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.dataInicio ? (
                              format(formData.dataInicio, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecione uma data</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-darkPurple border-neonPurple">
                          <Calendar
                            mode="single"
                            selected={formData.dataInicio || undefined}
                            onSelect={(date) => handleInputChange('dataInicio', date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Data da primeira venda */}
                    <div className={styles.fieldContainer}>
                      <Label className={styles.label}>
                        Data da primeira venda <span className={styles.required}>*</span> <HelpCircle className={styles.helpIcon} />
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`${styles.calendarButton} ${!formData.dataPrimeiraVenda ? styles.placeholder : ''}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.dataPrimeiraVenda ? (
                              format(formData.dataPrimeiraVenda, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecione uma data</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-darkPurple border-neonPurple">
                          <Calendar
                            mode="single"
                            selected={formData.dataPrimeiraVenda || undefined}
                            onSelect={(date) => handleInputChange('dataPrimeiraVenda', date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                {/* Seção Configurações de recorrência */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Configurações de recorrência</h3>
                  
                  <div className={`${styles.grid} ${styles.gridTwoCols}`}>
                    {/* Tipo de intervalo */}
                    <div className={styles.fieldContainer}>
                      <Label className={styles.label}>
                        Tipo de intervalo <span className={styles.required}>*</span>
                      </Label>
                      <Select
                        value={formData.tipoIntervalo}
                        onValueChange={(value) => handleInputChange('tipoIntervalo', value)}
                      >
                        <SelectTrigger className={styles.selectTrigger}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={styles.selectContent}>
                          <SelectItem value="dias" className={styles.selectItem}>Dias</SelectItem>
                          <SelectItem value="semanas" className={styles.selectItem}>Semanas</SelectItem>
                          <SelectItem value="meses" className={styles.selectItem}>Meses</SelectItem>
                          <SelectItem value="anos" className={styles.selectItem}>Anos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Intervalo */}
                    <div className={styles.fieldContainer}>
                      <Label className={styles.label}>
                        Intervalo <span className={styles.required}>*</span>
                      </Label>
                      <Input
                        value={formData.intervalo}
                        onChange={(e) => handleInputChange('intervalo', e.target.value)}
                        placeholder="1"
                        className={styles.input}
                      />
                    </div>

                    {/* Término da recorrência */}
                    <div className={styles.fieldContainer}>
                      <Label className={styles.label}>
                        Término da recorrência <span className={styles.required}>*</span>
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
                        <SelectTrigger className={styles.selectTrigger}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={styles.selectContent}>
                          <SelectItem value="indeterminado" className={styles.selectItem}>Indeterminado</SelectItem>
                          <SelectItem value="personalizado" className={styles.selectItem}>Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Total de ciclos (apenas se não for indeterminado) */}
                    {!formData.indeterminado && (
                      <div className={styles.fieldContainer}>
                        <Label className={styles.label}>
                          Total de ciclos <span className={styles.required}>*</span>
                        </Label>
                        <Input
                          value={formData.totalCiclos}
                          onChange={(e) => handleInputChange('totalCiclos', e.target.value)}
                          placeholder="12"
                          className={styles.input}
                        />
                      </div>
                    )}

                    {/* Data de término (apenas se for personalizado) */}
                    {formData.terminoRecorrencia === 'personalizado' && (
                      <div className={styles.fieldContainer}>
                        <Label className={styles.label}>
                          Data de término
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={`${styles.calendarButton} ${!formData.dataTermino ? styles.placeholder : ''}`}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.dataTermino ? (
                                format(formData.dataTermino, "dd/MM/yyyy", { locale: ptBR })
                              ) : (
                                <span>Selecione uma data</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className={`w-auto p-0 ${styles.bgDarkPurple} ${styles.borderNeonPurple}`}>
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
                    <div className={styles.fieldContainer}>
                      <Label className={styles.label}>Vigência total</Label>
                      <div className={`${styles.bgNeonPurple} ${styles.textMain} px-3 py-2 rounded text-sm font-medium`}>
                        {formData.indeterminado ? "Indeterminado" : `${formData.totalCiclos || 0} ciclos`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção Classificação */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Classificação</h3>
                  
                  <div className={`${styles.grid} ${styles.gridTwoCols}`}>
                    {/* Subcategoria de Receita */}
                    <div className={styles.fieldContainer}>
                      <Label className={styles.label}>
                        Subcategoria de Receita <span className={styles.required}>*</span> <HelpCircle className={styles.helpIcon} />
                      </Label>
                      <ReactSelect
                        options={getSubCategoriasReceita().map((item) => ({
                          value: item.id.toString(),
                          label: `${item.categoria_pai_nome} → ${item.nome}`,
                        }))}
                        value={getSubCategoriasReceita().find((item) => item.id.toString() === formData.categoria) 
                          ? { 
                              value: formData.categoria, 
                              label: getSubCategoriasReceita().find((item) => item.id.toString() === formData.categoria)?.categoria_pai_nome + ' → ' + getSubCategoriasReceita().find((item) => item.id.toString() === formData.categoria)?.nome 
                            }
                          : null}
                        onChange={(option) => handleInputChange('categoria', option ? option.value : '')}
                        placeholder="Pesquisar subcategoria de receita..."
                        styles={customSelectStyles}
                        isClearable
                        isSearchable
                        noOptionsMessage={() => "Nenhuma subcategoria encontrada"}
                      />
                    </div>

                    {/* Centro de custo */}
                    <div className={styles.fieldContainer}>
                      <Label className={styles.label}>
                        Centro de custo <HelpCircle className={styles.helpIcon} />
                      </Label>
                      <ReactSelect
                        options={(formDataFromAPI.centrosCusto || []).map((centro) => ({
                          value: centro.id.toString(),
                          label: centro.nome,
                        }))}
                        value={formDataFromAPI.centrosCusto.find((centro) => centro.id.toString() === formData.centroCusto) 
                          ? { value: formData.centroCusto, label: formDataFromAPI.centrosCusto.find((centro) => centro.id.toString() === formData.centroCusto)?.nome }
                          : null}
                        onChange={(option) => handleInputChange('centroCusto', option ? option.value : '')}
                        placeholder="Pesquisar centro de custo..."
                        styles={customSelectStyles}
                        isClearable
                        isSearchable
                        noOptionsMessage={() => "Nenhum centro de custo encontrado"}
                      />
                    </div>

                    {/* Vendedor responsável */}
                    <div className={styles.fieldContainer}>
                      <Label className={styles.label}>Vendedor responsável</Label>
                      <ReactSelect
                        options={(formDataFromAPI.users || []).map((user) => ({
                          value: user.id.toString(),
                          label: user.name,
                        }))}
                        value={formDataFromAPI.users.find((user) => user.id.toString() === formData.vendedorResponsavel) 
                          ? { value: formData.vendedorResponsavel, label: formDataFromAPI.users.find((user) => user.id.toString() === formData.vendedorResponsavel)?.name }
                          : null}
                        onChange={(option) => handleInputChange('vendedorResponsavel', option ? option.value : '')}
                        placeholder="Pesquisar vendedor..."
                        styles={customSelectStyles}
                        isClearable
                        isSearchable
                        noOptionsMessage={() => "Nenhum vendedor encontrado"}
                      />
                    </div>
                  </div>
                </div>

                {/* Seção Itens */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Itens</h3>
                  
                  <div className={styles.itemsContainer}>
                    <div className={styles.itemsHeader}>
                      <span className={styles.itemsHeaderText}>
                        Nenhuma tabela de preço aplicada ao contrato.
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className={styles.itemsGrid}>
                        <div className="col-span-2">Produtos/Serviços <span className={styles.required}>*</span></div>
                        <div className="col-span-2">Departamento</div>
                        <div className="col-span-2">Detalhes do item <HelpCircle className={styles.helpIcon} /></div>
                        <div className="col-span-2">Quantidade <span className={styles.required}>*</span></div>
                        <div className="col-span-2">Valor unitário <span className={styles.required}>*</span></div>
                        <div className="col-span-2">Total <span className={styles.required}>*</span></div>
                      </div>

                      {itens.map((item, index) => (
                        <div key={item.id} className={styles.itemsRow}>
                          {/* Produto/Serviço */}
                          <div className="col-span-2">
                            <div className={styles.itemField}>
                              <div className={styles.itemFieldFlex}>
                                <ReactSelect
                                  options={(formDataFromAPI.produtosServicos || []).map((produto) => ({
                                    value: produto.id.toString(),
                                    label: produto.nome,
                                  }))}
                                  value={formDataFromAPI.produtosServicos.find((produto) => produto.id.toString() === item.produtoServico) 
                                    ? { value: item.produtoServico, label: formDataFromAPI.produtosServicos.find((produto) => produto.id.toString() === item.produtoServico)?.nome }
                                    : null}
                                  onChange={(option) => handleItemChange(item.id, 'produtoServico', option ? option.value : '')}
                                  placeholder="Pesquisar produto..."
                                  styles={{
                                    ...customSelectStyles,
                                    control: (provided, state) => ({
                                      ...customSelectStyles.control(provided, state),
                                      minHeight: '32px',
                                      fontSize: '12px',
                                    }),
                                  }}
                                  isClearable
                                  isSearchable
                                  noOptionsMessage={() => "Nenhum produto encontrado"}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsNovoProdutoServicoOpen(true)}
                                className={`${styles.itemFieldIcon} ${styles.itemFieldIconSmall}`}
                                title="Adicionar novo produto/serviço"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Departamento */}
                          <div className="col-span-2">
                            <div className={styles.itemField}>
                              <div className={styles.itemFieldFlex}>
                                <ReactSelect
                                  options={(formDataFromAPI.departamentos || []).map((departamento) => ({
                                    value: departamento.id.toString(),
                                    label: departamento.nome,
                                  }))}
                                  value={formDataFromAPI.departamentos.find((departamento) => departamento.id.toString() === item.departamento) 
                                    ? { value: item.departamento, label: formDataFromAPI.departamentos.find((departamento) => departamento.id.toString() === item.departamento)?.nome }
                                    : null}
                                  onChange={(option) => handleItemChange(item.id, 'departamento', option ? option.value : '')}
                                  placeholder="Pesquisar departamento..."
                                  styles={{
                                    ...customSelectStyles,
                                    control: (provided, state) => ({
                                      ...customSelectStyles.control(provided, state),
                                      minHeight: '32px',
                                      fontSize: '12px',
                                    }),
                                  }}
                                  isClearable
                                  isSearchable
                                  noOptionsMessage={() => "Nenhum departamento encontrado"}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsNovoDepartamentoOpen(true)}
                                className={`${styles.itemFieldIcon} ${styles.itemFieldIconSmall}`}
                                title="Adicionar novo departamento"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Detalhes */}
                          <div className="col-span-2">
                            <Input
                              value={item.detalhes}
                              onChange={(e) => handleItemChange(item.id, 'detalhes', e.target.value)}
                              placeholder="Detalhes"
                              className={`${styles.input} ${styles.inputSmall}`}
                            />
                          </div>

                          {/* Quantidade */}
                          <div className="col-span-2">
                            <Input
                              value={item.quantidade}
                              onChange={(e) => handleItemChange(item.id, 'quantidade', e.target.value)}
                              placeholder="1,00"
                              className={`${styles.input} ${styles.inputSmall}`}
                            />
                          </div>

                          {/* Valor unitário */}
                          <div className="col-span-2">
                            <div className="relative">
                              <Input
                                value={item.valorUnitario}
                                onChange={(e) => handleItemChange(item.id, 'valorUnitario', e.target.value)}
                                placeholder="0,00"
                                className={`${styles.input} ${styles.inputSmall} ${styles.inputWithIcon}`}
                              />
                              <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs ${styles.textSecondary}`}>R$</span>
                            </div>
                          </div>

                          {/* Total */}
                          <div className="col-span-2">
                            <div className="relative flex items-center gap-1">
                              <div className="flex-1 relative">
                                <Input
                                  value={item.total}
                                  placeholder="0,00"
                                  className={`${styles.input} ${styles.inputSmall} ${styles.inputWithIcon} ${styles.inputReadOnly}`}
                                  readOnly
                                />
                                <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs ${styles.textSecondary}`}>R$</span>
                                <Diamond className={`absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 ${styles.textPrimary}`} />
                              </div>
                              {itens.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeItem(item.id)}
                                  className={`${styles.itemFieldIcon} ${styles.itemFieldIconSmall}`}
                                  title="Remover item"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      <Button
                        variant="outline"
                        onClick={addItem}
                        className={`${styles.buttonOutline} ${styles.borderDashed} w-full`}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar nova linha
                      </Button>
                    </div>

                    
                  </div>
                </div>

                {/* Seção Valor */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Valor</h3>
                  
                  <div className={styles.valueContainer}>
                    {/* Desconto */}
                    <div className={styles.fieldContainer}>
                      <Label className={styles.label}>Desconto</Label>
                      <div className="flex items-center gap-2">
                        <ToggleGroup
                          type="single"
                          value={formData.descontoTipo}
                          onValueChange={(value) => value && handleInputChange('descontoTipo', value)}
                          className={styles.toggleGroup}
                        >
                          <ToggleGroupItem value="reais" className={styles.toggleGroupItem}>
                            R$
                          </ToggleGroupItem>
                          <ToggleGroupItem value="percentual" className={styles.toggleGroupItem}>
                            %
                          </ToggleGroupItem>
                        </ToggleGroup>
                        <div className="relative">
                          <Input
                            value={formData.descontoValor}
                            onChange={(e) => handleInputChange('descontoValor', e.target.value)}
                            className={`${styles.input} w-32 pl-8`}
                          />
                          <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${styles.textSecondary}`}>
                            {formData.descontoTipo === 'reais' ? 'R$' : '%'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Total do contrato */}
                    <div className={styles.valueSummary}>
                      <div className={styles.valueRow}>
                        <div className={styles.valueRowMain}>
                          <span>Itens (R$)</span>
                        </div>
                        <div className={styles.valueRowMain}>
                          <span>{formatarValorBrasileiro(calcularTotalItens())}</span>
                        </div>
                      </div>
                      <div className={styles.valueRow}>
                        <div className={styles.valueRowDiscount}>
                          <span>- Desconto (R$)</span>
                        </div>
                        <div className={styles.valueRowDiscount}>
                          <span>{formatarValorBrasileiro(calcularDesconto())}</span>
                        </div>
                      </div>
                      <div className={styles.valueRowTotal}>
                        <div>
                          <span>= Total (R$)</span>
                        </div>
                        <div>
                          <span>{formatarValorBrasileiro(calcularTotalFinal())}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção Informações de pagamento */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Informações de pagamento</h3>
                  
                  <div className={`${styles.grid} ${styles.gridTwoCols}`}>
                    {/* Forma de pagamento */}
                    <div className={styles.fieldContainer}>
                      <Label className={styles.label}>Forma de pagamento</Label>
                      <Select
                        value={formData.formaPagamento}
                        onValueChange={(value) => handleInputChange('formaPagamento', value)}
                      >
                        <SelectTrigger className={styles.selectTrigger}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className={styles.selectContent}>
                          <SelectItem value="dinheiro" className={styles.selectItem}>Dinheiro</SelectItem>
                          <SelectItem value="pix" className={styles.selectItem}>PIX</SelectItem>
                          <SelectItem value="cartao" className={styles.selectItem}>Cartão</SelectItem>
                          <SelectItem value="boleto" className={styles.selectItem}>Boleto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Conta de recebimento */}
                    <div className={styles.fieldContainer}>
                      <Label className={styles.label}>
                        Conta de recebimento <span className={styles.required}>*</span> <HelpCircle className={styles.helpIcon} />
                      </Label>
                      <div className={styles.paymentField}>
                        <Select
                          value={formData.contaRecebimento}
                          onValueChange={(value) => handleInputChange('contaRecebimento', value)}
                        >
                          <SelectTrigger className={styles.selectTrigger}>
                            <SelectValue placeholder="Selecione a conta" />
                          </SelectTrigger>
                          <SelectContent className={styles.selectContent}>
                            {/* Contas ERP */}
                            {formDataFromAPI.contas
                              .filter((conta) => Boolean(conta.descricao_banco && String(conta.descricao_banco).trim()))
                              .map((conta) => (
                                <SelectItem
                                  key={`erp-${conta.id}`}
                                  value={`erp:${conta.id}`}
                                  className={styles.selectItem}
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
                                  className={styles.selectItem}
                                >
                                  <span>{conta.descricao_banco}</span>
                                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40">OpenFinance</span>
                                </SelectItem>
                              ))}

                            {formDataFromAPI.contas.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 &&
                             formDataFromAPI.contasApi.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 && (
                              <div className={`${styles.textSecondary} px-2 py-1`}>
                                Nenhuma conta encontrada
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                        <div className={styles.paymentIndicators}>
                          <div className={`${styles.paymentIndicator} ${styles.paymentIndicatorPrimary}`}></div>
                          <div className={`${styles.paymentIndicator} ${styles.paymentIndicatorWarning}`}></div>
                        </div>
                      </div>
                    </div>

                    {/* Vencimento */}
                    <div className={styles.fieldContainer}>
                      <Label className={styles.label}>
                        Vencimento <span className={styles.required}>*</span> <HelpCircle className={styles.helpIcon} />
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`${styles.calendarButton} ${!formData.vencimento ? styles.placeholder : ''}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.vencimento ? (
                              format(formData.vencimento, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecione</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className={`w-auto p-0 ${styles.bgDarkPurple} ${styles.borderNeonPurple}`}>
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
                <Accordion type="multiple" className={styles.section}>
                  {/* Observações de pagamento */}
                  <AccordionItem value="observacoes-pagamento" className={styles.accordionItem}>
                    <AccordionTrigger className={styles.accordionTrigger}>
                      <span className={styles.accordionTriggerTitle}>Observações de pagamento</span>
                    </AccordionTrigger>
                    <AccordionContent className={styles.accordionContent}>
                      <div className={styles.fieldContainer}>
                        <Label className={styles.label}>Observações</Label>
                        <Textarea
                          value={formData.observacoesPagamento}
                          onChange={(e) => handleInputChange('observacoesPagamento', e.target.value)}
                          placeholder="Inclua informações sobre o pagamento..."
                          rows={3}
                          className={styles.accordionTextarea}
                        />
                        <p className={styles.accordionHelp}>
                          Inclua informações sobre o pagamento que podem ser relevantes para você e seu cliente.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                
              </>
            )}
            </div>
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <Button variant="outline" onClick={handleClose} className={styles.buttonOutline}>
              Cancelar
            </Button>
            <div className={styles.footerButtons}>
              <Button 
                onClick={handleSave} 
                disabled={isSaving || isLoadingFormData}
                className={`${styles.buttonPrimary} ${styles.footerButton}`}
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

      {/* Drawer para adicionar novo departamento */}
      <NovoDepartamentoDrawer
        isOpen={isNovoDepartamentoOpen}
        onClose={() => setIsNovoDepartamentoOpen(false)}
        onSuccess={handleNovoDepartamentoSuccess}
      />
    </>
  );
} 