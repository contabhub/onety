"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "react-toastify";
import styles from "../../styles/financeiro/NovoContratoDrawer.module.css";
import {
  X,
  Plus,
  Loader2,
  RefreshCw,
} from "lucide-react";
import NovoProdutoServicoDrawer from "./NovoProdutoServicoDrawer";
import NovoDepartamentoDrawer from "./NovoDepartamentoDrawer";
import { useContratos } from "../../hooks/financeiro/useContratos";
import ReactSelect from "react-select";


// Estilos customizados para o ReactSelect baseados no globals.css
const customSelectStyles = {
  control: (provided, state) => ({
    ...provided,
    backgroundColor: 'var(--onity-color-surface)',
    border: '2px solid var(--onity-color-border)',
    borderRadius: '5px',
    minHeight: '40px',
    height: '40px',
    boxShadow: 'none',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    '&:hover': {
      borderColor: 'var(--onity-color-primary)',
      transform: 'translateY(-1px)',
      boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.1)',
    },
  }),
  'control--is-focused': (provided) => ({
    ...provided,
    borderColor: 'var(--onity-color-primary)',
    boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.15)',
  }),
  valueContainer: (provided) => ({
    ...provided,
    padding: '0 12px',
  }),
  placeholder: (provided) => ({
    ...provided,
    color: 'var(--onity-color-text)',
    opacity: '0.6',
  }),
  singleValue: (provided) => ({
    ...provided,
    color: 'var(--onity-color-text)',
    fontWeight: '500',
  }),
  inputContainer: (provided) => ({
    ...provided,
    color: 'var(--onity-color-text)',
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: 'var(--onity-color-surface)',
    border: '1px solid var(--onity-color-border)',
    borderRadius: '5px',
    boxShadow: 'var(--onity-elev-high)',
    zIndex: 10020,
  }),
  menuPortal: (provided) => ({
    ...provided,
    zIndex: 10020,
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isFocused ? 'var(--onity-color-bg)' : 'var(--onity-color-surface)',
    color: 'var(--onity-color-text)',
    padding: '12px 16px',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: 'var(--onity-color-bg)',
      color: 'var(--onity-color-text)',
    },
  }),
  'option--is-selected': (provided) => ({
    ...provided,
    backgroundColor: 'var(--onity-color-primary)',
    color: 'var(--onity-color-primary-contrast)',
  }),
  'option--is-focused': (provided) => ({
    ...provided,
    backgroundColor: 'var(--onity-color-bg)',
    color: 'var(--onity-color-text)',
  }),
  indicatorSeparator: (provided) => ({
    ...provided,
    backgroundColor: 'var(--onity-color-border)',
  }),
  dropdownIndicator: (provided) => ({
    ...provided,
    color: 'var(--onity-color-text)',
  }),
  clearIndicator: (provided) => ({
    ...provided,
    color: 'var(--onity-color-text)',
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
  
  // Estados para componentes customizados
  const [accordionOpen, setAccordionOpen] = useState([]);

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

    console.log("🔍 getSubCategoriasReceita - categorias:", formDataFromAPI.categorias);
    console.log("🔍 getSubCategoriasReceita - subCategorias:", formDataFromAPI.subCategorias);

    // Filtrar apenas subcategorias de receita
    formDataFromAPI.subCategorias.forEach((subCategoria) => {
      // Verificar se a categoria pai é de receita (tipo_id = 1)
      const categoriaPai = formDataFromAPI.categorias.find(cat => cat.id === subCategoria.categoria_id);
      console.log(`🔍 Subcategoria ${subCategoria.nome} (categoria_id: ${subCategoria.categoria_id}) - categoria pai encontrada:`, categoriaPai);
      
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

    console.log("🔍 getSubCategoriasReceita - items finais:", items);

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
    // Buscar empresaId do userData (padrão correto do sistema)
    const userData = localStorage.getItem("userData");
    const user = userData ? JSON.parse(userData) : null;
    const empresaId = user?.EmpresaId || user?.empresa?.id || null;
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
          const res = await fetch(`${API}/financeiro/clientes/empresa/${empresaId}`, {
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
          const res = await fetch(`${API}/financeiro/categorias/tipo/1`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          // A API retorna diretamente um array de categorias
          return data || [];
        } catch (error) {
          console.error("Erro ao buscar categorias:", error);
          return [];
        }
      };

      // 3. Buscar subcategorias
      const fetchSubCategorias = async () => {
        try {
          const res = await fetch(`${API}/financeiro/sub-categorias/empresa/${empresaId}`, {
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
          const res = await fetch(`${API}/financeiro/centro-de-custo/empresa/${empresaId}`, {
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
          const res = await fetch(`${API}/usuarios`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          // A API retorna { data: rows, page, limit, total: ... }
          return data.data || [];
        } catch (error) {
          console.error("Erro ao buscar usuários:", error);
          return [];
        }
      };

      // 6. Buscar contas ERP
      const fetchContas = async () => {
        try {
          console.log(`🔍 Buscando contas ERP para empresa ${empresaId}`);
          const res = await fetch(`${API}/contas-api/company/${empresaId}/contas`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (!res.ok) {
            console.error(`❌ Erro na resposta: ${res.status} ${res.statusText}`);
            return [];
          }
          
          const data = await res.json();
          console.log('📋 Dados recebidos da API contas:', data);
          
          // Filtrar apenas contas tradicionais (sem account)
          const contasTradicionais = (data.contas || []).filter(conta => !conta.account);
          console.log(`🔍 Contas tradicionais encontradas: ${contasTradicionais.length}`, contasTradicionais);
          
          return contasTradicionais;
        } catch (error) {
          console.error("Erro ao buscar contas ERP:", error);
          return [];
        }
      };

      // 7. Buscar contas API (OpenFinance)
      const fetchContasApi = async () => {
        try {
          console.log(`🔍 Buscando contas API para empresa ${empresaId}`);
          const res = await fetch(`${API}/contas-api/company/${empresaId}/contas`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (!res.ok) {
            console.error(`❌ Erro na resposta: ${res.status} ${res.statusText}`);
            return [];
          }
          
          const data = await res.json();
          console.log('📋 Dados recebidos da API contas:', data);
          
          // Filtrar apenas contas API (com account)
          const contasApi = (data.contas || []).filter(conta => conta.account && conta.account.toString().trim() !== "");
          console.log(`🔍 Contas API encontradas: ${contasApi.length}`, contasApi);
          
          return contasApi;
        } catch (error) {
          console.error("Erro ao buscar contas API:", error);
          return [];
        }
      };

      // 8. Buscar produtos/serviços
      const fetchProdutosServicos = async () => {
        try {
          const res = await fetch(`${API}/financeiro/produtos-servicos/empresa/${empresaId}`, {
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
          const res = await fetch(`${API}/financeiro/departamentos?empresa_id=${empresaId}`, {
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

      console.log("🔍 Debug categorias:", categorias);
      console.log("🔍 Debug subcategorias:", subCategorias);
      console.log("🔍 Debug produtos/serviços:", produtosServicos);
      console.log("🔍 Debug departamentos:", departamentos);
      console.log("🔍 Debug produtos/serviços:", produtosServicos);
      console.log("🔍 Debug departamentos:", departamentos);
      console.log("🔍 Debug users:", users);

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

  // Funções para componentes customizados
  const toggleAccordion = (value) => {
    setAccordionOpen(prev => 
      prev.includes(value) 
        ? prev.filter(item => item !== value)
        : [...prev, value]
    );
  };

  const handleDateSelect = (field, dateString) => {
    const date = dateString ? new Date(dateString + 'T00:00:00') : null;
    handleInputChange(field, date);
  };

  // Função para converter Date para string no formato YYYY-MM-DD
  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
      // Buscar empresaId e userId do userData (padrão correto do sistema)
      const userData = localStorage.getItem("userData");
      const user = userData ? JSON.parse(userData) : null;
      const empresaId = user?.EmpresaId || user?.empresa?.id || null;
      const userId = user?.id || null;
      
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
        empresa_id: parseInt(empresaId),
        valor: calcularTotalFinal(), // Valor calculado dos itens com desconto
        desconto: calcularDesconto(), // Desconto calculado
        data_inicio: formData.dataInicio ? format(formData.dataInicio, 'yyyy-MM-dd') : '',
        dia_gerado: formData.dataPrimeiraVenda ? format(formData.dataPrimeiraVenda, 'yyyy-MM-dd') : (formData.dataInicio ? format(formData.dataInicio, 'yyyy-MM-dd') : ''),
        proximo_vencimento: formData.vencimento ? format(formData.vencimento, 'yyyy-MM-dd') : (formData.dataInicio ? format(formData.dataInicio, 'yyyy-MM-dd') : ''),
        status: "pendente",
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
        // Valor recorrente
        valor_recorrente: calcularTotalFinal(),
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
      console.log("🔍 Debug campos obrigatórios:", {
        cliente_id: dadosContrato.cliente_id,
        empresa_id: dadosContrato.empresa_id,
        data_inicio: dadosContrato.data_inicio,
        formData_cliente: formData.cliente,
        formData_dataInicio: formData.dataInicio,
        empresaId: empresaId
      });

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
            <button
              type="button"
              onClick={handleClose}
              className={styles.closeButton}
            >
              <X className={styles.iconMedium} />
            </button>
          </div>

          {/* Content */}
          <div className={styles.content}>
            <div className={styles.contentInner}>
            {isLoadingFormData && (
              <div className={styles.loadingContainer}>
                <Loader2 className={`${styles.iconLarge} ${styles.iconSpin}`} />
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
                      <label className={styles.label}>
                        Número do contrato <span className={styles.required}>*</span>
                      </label>
                      <div className={styles.relative}>
                        <input
                          type="text"
                          value={formData.numeroContrato}
                          onChange={(e) => handleInputChange('numeroContrato', e.target.value)}
                          className={`${styles.input} ${styles.inputWithReloadIcon}`}
                          placeholder="Digite ou gere automaticamente"
                        />
                        <button
                          type="button"
                          onClick={gerarNumeroContratoAutomatico}
                          disabled={isGeneratingNumber}
                          className={styles.reloadButton}
                          title="Gerar número automaticamente"
                        >
                          {isGeneratingNumber ? (
                            <Loader2 className={styles.reloadIcon} />
                          ) : (
                            <RefreshCw className={styles.reloadIcon} />
                          )}
                        </button>
                      </div>
                      <p className={styles.textSecondary}>
                        Clique no ícone para gerar o próximo número automaticamente
                      </p>
                    </div>

                    {/* Cliente */}
                    <div className={styles.fieldContainer}>
                      <label className={styles.label}>
                        Cliente <span className={styles.required}>*</span>
                      </label>
                      <div className={styles.flexGap2}>
                        <div className={styles.flex1}>
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
                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            menuPosition="fixed"
                            noOptionsMessage={() => "Nenhum cliente encontrado"}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Data de início */}
                    <div className={styles.fieldContainer}>
                      <label className={styles.label}>
                        Data de início <span className={styles.required}>*</span>
                      </label>
                      <input
                        type="date"
                        value={formatDateForInput(formData.dataInicio)}
                        onChange={(e) => handleDateSelect('dataInicio', e.target.value)}
                        className={styles.input}
                      />
                    </div>

                    {/* Data da primeira venda */}
                    <div className={styles.fieldContainer}>
                      <label className={styles.label}>
                        Data da primeira venda <span className={styles.required}>*</span> 
                      </label>
                      <input
                        type="date"
                        value={formatDateForInput(formData.dataPrimeiraVenda)}
                        onChange={(e) => handleDateSelect('dataPrimeiraVenda', e.target.value)}
                        className={styles.input}
                      />
                    </div>
                  </div>
                </div>

                {/* Seção Configurações de recorrência */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Configurações de recorrência</h3>
                  
                  <div className={`${styles.grid} ${styles.gridTwoCols}`}>
                    {/* Tipo de intervalo */}
                    <div className={styles.fieldContainer}>
                      <label className={styles.label}>
                        Tipo de intervalo <span className={styles.required}>*</span>
                      </label>
                      <select
                        value={formData.tipoIntervalo}
                        onChange={(e) => handleInputChange('tipoIntervalo', e.target.value)}
                        className={styles.selectTrigger}
                      >
                        <option value="dias">Dias</option>
                        <option value="semanas">Semanas</option>
                        <option value="meses">Meses</option>
                        <option value="anos">Anos</option>
                      </select>
                    </div>

                    {/* Intervalo */}
                    <div className={styles.fieldContainer}>
                      <label className={styles.label}>
                        Intervalo <span className={styles.required}>*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.intervalo}
                        onChange={(e) => handleInputChange('intervalo', e.target.value)}
                        placeholder="1"
                        className={styles.input}
                      />
                    </div>

                    {/* Término da recorrência */}
                    <div className={styles.fieldContainer}>
                      <label className={styles.label}>
                        Término da recorrência <span className={styles.required}>*</span>
                      </label>
                      <select
                        value={formData.terminoRecorrencia}
                        onChange={(e) => {
                          const value = e.target.value;
                          handleInputChange('terminoRecorrencia', value);
                          if (value === 'indeterminado') {
                            handleInputChange('indeterminado', true);
                          } else {
                            handleInputChange('indeterminado', false);
                          }
                        }}
                        className={styles.selectTrigger}
                      >
                        <option value="indeterminado">Indeterminado</option>
                        <option value="personalizado">Personalizado</option>
                      </select>
                    </div>

                    {/* Total de ciclos (apenas se não for indeterminado) */}
                    {!formData.indeterminado && (
                      <div className={styles.fieldContainer}>
                        <label className={styles.label}>
                          Total de ciclos <span className={styles.required}>*</span>
                        </label>
                        <input
                          type="text"
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
                        <label className={styles.label}>
                          Data de término
                        </label>
                        <input
                          type="date"
                          value={formatDateForInput(formData.dataTermino)}
                          onChange={(e) => handleDateSelect('dataTermino', e.target.value)}
                          className={styles.input}
                        />
                      </div>
                    )}

                    {/* Vigência total */}
                    <div className={styles.fieldContainer}>
                      <label className={styles.label}>Vigência total</label>
                      <div className={styles.infoBadge}>
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
                      <label className={styles.label}>
                        Subcategoria de Receita <span className={styles.required}>*</span> 
                      </label>
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
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        menuPosition="fixed"
                        noOptionsMessage={() => "Nenhuma subcategoria encontrada"}
                      />
                    </div>

                    {/* Centro de custo */}
                    <div className={styles.fieldContainer}>
                      <label className={styles.label}>
                        Centro de custo 
                      </label>
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
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        menuPosition="fixed"
                        noOptionsMessage={() => "Nenhum centro de custo encontrado"}
                      />
                    </div>

                    {/* Vendedor responsável */}
                    <div className={styles.fieldContainer}>
                      <label className={styles.label}>Vendedor responsável</label>
                      <ReactSelect
                        options={(formDataFromAPI.users || []).map((user) => ({
                          value: user.id.toString(),
                          label: user.nome,
                        }))}
                        value={formDataFromAPI.users.find((user) => user.id.toString() === formData.vendedorResponsavel) 
                          ? { value: formData.vendedorResponsavel, label: formDataFromAPI.users.find((user) => user.id.toString() === formData.vendedorResponsavel)?.nome }
                          : null}
                        onChange={(option) => handleInputChange('vendedorResponsavel', option ? option.value : '')}
                        placeholder="Pesquisar vendedor..."
                        styles={customSelectStyles}
                        isClearable
                        isSearchable
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        menuPosition="fixed"
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

                    <div className={styles.spaceY4}>
                      {/* Labels dos campos */}
                      <div className={styles.itemsLabelsGrid}>
                        <div className={styles.itemLabel}>
                          Produtos/Serviços <span className={styles.required}>*</span>
                        </div>
                        <div className={styles.itemLabel}>
                          Departamento
                        </div>
                        <div className={styles.itemLabel}>
                          Detalhes do item 
                        </div>
                        <div className={styles.itemLabel}>
                          Quantidade <span className={styles.required}>*</span>
                        </div>
                        <div className={styles.itemLabel}>
                          Valor unitário <span className={styles.required}>*</span>
                        </div>
                        <div className={styles.itemLabel}>
                          Total <span className={styles.required}>*</span>
                        </div>
                      </div>

                      {itens.map((item, index) => (
                        <div key={item.id} className={styles.itemsRow}>
                          {/* Produto/Serviço */}
                          <div className={styles.itemFieldContainer}>
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
                                      height: '32px',
                                      minHeight: '32px',
                                      fontSize: '12px',
                                      border: '1px solid var(--onity-color-border)',
                                    }),
                                  }}
                                  isClearable
                                  isSearchable
                                  menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                  menuPosition="fixed"
                                  noOptionsMessage={() => "Nenhum produto encontrado"}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsNovoProdutoServicoOpen(true)}
                                className={`${styles.itemFieldIcon} ${styles.itemFieldIconSmall}`}
                                title="Adicionar novo produto/serviço"
                              >
                                <Plus className={styles.iconSmall} />
                              </button>
                            </div>
                          </div>

                          {/* Departamento */}
                          <div className={styles.itemFieldContainer}>
                            <div className={styles.itemField}>
                              <div className={styles.itemFieldFlex}>
                                <ReactSelect
                                  options={Array.isArray(formDataFromAPI.departamentos) ? formDataFromAPI.departamentos.map((departamento) => ({
                                    value: departamento.id.toString(),
                                    label: departamento.nome,
                                  })) : []}
                                  value={Array.isArray(formDataFromAPI.departamentos) && formDataFromAPI.departamentos.find((departamento) => departamento.id.toString() === item.departamento) 
                                    ? { value: item.departamento, label: formDataFromAPI.departamentos.find((departamento) => departamento.id.toString() === item.departamento)?.nome }
                                    : null}
                                  onChange={(option) => handleItemChange(item.id, 'departamento', option ? option.value : '')}
                                  placeholder="Pesquisar departamento..."
                                  styles={{
                                    ...customSelectStyles,
                                    control: (provided, state) => ({
                                      ...customSelectStyles.control(provided, state),
                                      height: '32px',
                                      minHeight: '32px',
                                      fontSize: '12px',
                                      border: '1px solid var(--onity-color-border)',
                                    }),
                                  }}
                                  isClearable
                                  isSearchable
                                  menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                  menuPosition="fixed"
                                  noOptionsMessage={() => "Nenhum departamento encontrado"}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsNovoDepartamentoOpen(true)}
                                className={`${styles.itemFieldIcon} ${styles.itemFieldIconSmall}`}
                                title="Adicionar novo departamento"
                              >
                                <Plus className={styles.iconSmall} />
                              </button>
                            </div>
                          </div>

                          {/* Detalhes */}
                          <div className={styles.itemFieldContainer}>
                            <input
                              type="text"
                              value={item.detalhes}
                              onChange={(e) => handleItemChange(item.id, 'detalhes', e.target.value)}
                              placeholder="Detalhes"
                              className={`${styles.input} ${styles.inputSmall}`}
                            />
                          </div>

                          {/* Quantidade */}
                          <div className={styles.itemFieldContainer}>
                            <input
                              type="text"
                              value={item.quantidade}
                              onChange={(e) => handleItemChange(item.id, 'quantidade', e.target.value)}
                              placeholder="1,00"
                              className={`${styles.input} ${styles.inputSmall}`}
                            />
                          </div>

                          {/* Valor unitário */}
                          <div className={styles.itemFieldContainer}>
                          <div className={styles.relative}>
                            <input
                              type="text"
                              value={item.valorUnitario}
                              onChange={(e) => handleItemChange(item.id, 'valorUnitario', e.target.value)}
                              placeholder="R$ 0,00"
                              className={`${styles.input} ${styles.inputSmall} ${styles.inputWithIcon}`}
                            />
                            </div>
                          </div>

                          {/* Total */}
                          <div className={styles.itemFieldContainer}>
                            <div className={styles.relativeFlexItemsCenterGap1}>
                              <div className={styles.flex1Relative}>
                                <input
                                  type="text"
                                  value={item.total}
                                  placeholder="R$ 0,00"
                                  className={`${styles.input} ${styles.inputSmall} ${styles.inputWithIcon} ${styles.inputReadOnly}`}
                                  readOnly
                                />
                              </div>
                              {itens.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeItem(item.id)}
                                  className={`${styles.itemFieldIcon} ${styles.itemFieldIconSmall}`}
                                  title="Remover item"
                                >
                                  <X className={styles.iconSmall} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addItem}
                        className={`${styles.buttonOutline} ${styles.borderDashed} w-full`}
                      >
                        <Plus className={`${styles.iconMedium} ${styles.iconWithMargin}`} />
                        Adicionar nova linha
                      </button>
                    </div>

                    
                  </div>
                </div>

                {/* Seção Valor */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Valor</h3>
                  
                  <div className={styles.valueContainer}>
                    {/* Desconto */}
                    <div className={styles.valueField}>
                      <label className={styles.label}>Desconto</label>
                      <div className={styles.flexItemsCenterGap2}>
                        <div className={styles.toggleGroup}>
                          <label className={styles.toggleGroupItem}>
                            <input
                              type="radio"
                              name="descontoTipo"
                              value="reais"
                              checked={formData.descontoTipo === 'reais'}
                              onChange={(e) => handleInputChange('descontoTipo', e.target.value)}
                              className={styles.toggleRadio}
                            />
                            R$
                          </label>
                          <label className={styles.toggleGroupItem}>
                            <input
                              type="radio"  
                              name="descontoTipo"
                              value="percentual"
                              checked={formData.descontoTipo === 'percentual'}
                              onChange={(e) => handleInputChange('descontoTipo', e.target.value)}
                              className={styles.toggleRadio}
                            />
                            %
                          </label>
                        </div>
                        <div className={styles.relative}>
                          <input
                            type="text"
                            value={formData.descontoValor}
                            onChange={(e) => handleInputChange('descontoValor', e.target.value)}
                            className={`${styles.input} w-32 ${formData.descontoTipo === 'reais' ? styles.inputWithPrefix : styles.inputWithSuffix}`}
                          />
                          <span className={`${formData.descontoTipo === 'reais' ? styles.symbolPrefix : styles.symbolSuffix}`}>
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
                      <label className={styles.label}>Forma de pagamento</label>
                      <select
                        value={formData.formaPagamento}
                        onChange={(e) => handleInputChange('formaPagamento', e.target.value)}
                        className={styles.selectTrigger}
                      >
                        <option value="">Selecione</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="pix">PIX</option>
                        <option value="cartao">Cartão</option>
                        <option value="boleto">Boleto</option>
                      </select>
                    </div>

                    {/* Conta de recebimento */}
                    <div className={styles.fieldContainer}>
                      <label className={styles.label}>
                        Conta de recebimento <span className={styles.required}>*</span> 
                      </label>
                      <div className={styles.paymentField}>
                        <select
                          value={formData.contaRecebimento}
                          onChange={(e) => handleInputChange('contaRecebimento', e.target.value)}
                          className={styles.selectTrigger}
                        >
                          <option value="">Selecione a conta</option>
                          
                          {/* Contas ERP */}
                          {formDataFromAPI.contas
                            .filter((conta) => {
                              const temBanco = conta.banco && String(conta.banco).trim();
                              const temDescricao = conta.descricao_banco && String(conta.descricao_banco).trim();
                              const temApiId = conta.api_id && String(conta.api_id).trim();
                              return temBanco || temDescricao || temApiId;
                            })
                            .map((conta) => {
                              const nomeConta = conta.descricao_banco || conta.banco || `Conta ${conta.id}`;
                              const bancoConta = conta.banco || 'Banco';
                              return (
                                <option
                                  key={`erp-${conta.id}`}
                                  value={`erp:${conta.id}`}
                                >
                                  {bancoConta} — {nomeConta}
                                </option>
                              );
                            })}

                          {/* Contas API (OpenFinance) */}
                          {formDataFromAPI.contasApi
                            .filter((conta) => {
                              const temBanco = conta.banco && String(conta.banco).trim();
                              const temDescricao = conta.descricao_banco && String(conta.descricao_banco).trim();
                              const temAccount = conta.account && String(conta.account).trim();
                              return temBanco || temDescricao || temAccount;
                            })
                            .map((conta) => {
                              const nomeConta = conta.descricao_banco || conta.banco || `Conta ${conta.account}`;
                              return (
                                <option
                                  key={`api-${conta.id}`}
                                  value={`api:${conta.id}`}
                                >
                                  {nomeConta} (OpenFinance)
                                </option>
                              );
                            })}

                          {/* Fallback: Mostrar TODAS as contas se nenhuma passou no filtro */}
                          {formDataFromAPI.contas.length > 0 && formDataFromAPI.contas.filter(c => c.banco || c.descricao_banco || c.api_id).length === 0 && 
                            formDataFromAPI.contas.map((conta) => (
                              <option
                                key={`erp-fallback-${conta.id}`}
                                value={`erp:${conta.id}`}
                              >
                                Conta {conta.id} - {conta.api_id || 'Sem nome'}
                              </option>
                            ))}
                        </select>
                        <div className={styles.paymentIndicators}>
                          <div className={`${styles.paymentIndicator} ${styles.paymentIndicatorPrimary}`}></div>
                          <div className={`${styles.paymentIndicator} ${styles.paymentIndicatorWarning}`}></div>
                        </div>
                      </div>
                    </div>

                    {/* Vencimento */}
                    <div className={styles.fieldContainer}>
                      <label className={styles.label}>
                        Vencimento <span className={styles.required}>*</span> 
                      </label>
                      <input
                        type="date"
                        value={formatDateForInput(formData.vencimento)}
                        onChange={(e) => handleDateSelect('vencimento', e.target.value)}
                        className={styles.input}
                      />
                    </div>
                  </div>

                 
                </div>

                {/* Seções colapsáveis */}
                <div className={styles.accordionContainer}>
                  {/* Observações de pagamento */}
                  <div className={styles.accordionItem}>
                    <button
                      type="button"
                      onClick={() => toggleAccordion('observacoes-pagamento')}
                      className={styles.accordionTrigger}
                    >
                      <span className={styles.accordionTriggerTitle}>Observações de pagamento</span>
                    </button>
                    {accordionOpen.includes('observacoes-pagamento') && (
                      <div className={styles.accordionContent}>
                        <div className={styles.fieldContainer}>
                          <label className={styles.label}>Observações</label>
                          <textarea
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
                      </div>
                    )}
                  </div>
                </div>
                
              </>
            )}
            </div>
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <button type="button" onClick={handleClose} className={styles.buttonOutline}>
              Cancelar
            </button>
            <div className={styles.footerButtons}>
              <button 
                type="button"
                onClick={handleSave} 
                disabled={isSaving || isLoadingFormData}
                className={`${styles.buttonPrimary} ${styles.footerButton}`}
              >
                {isSaving && <Loader2 className={`${styles.iconMedium} ${styles.iconWithMargin} ${styles.iconSpin}`} />}
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

      {/* Drawer para adicionar novo departamento */}
      <NovoDepartamentoDrawer
        isOpen={isNovoDepartamentoOpen}
        onClose={() => setIsNovoDepartamentoOpen(false)}
        onSuccess={handleNovoDepartamentoSuccess}
      />
    </>
  );
} 