"use client";

import { useState, useEffect } from "react";
import { Button } from './botao';
import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { Calendar } from './calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Checkbox } from './checkbox';
import { X, Calendar as CalendarIcon, ChevronDown, Info, Plus, FileText, CheckCircle2 } from "lucide-react";
import { format, formatISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import ReactSelect from "react-select";
import { NovoClienteDrawer } from "./NovoClienteDrawer";
import { Switch } from './switch';
import ModalRecorrenciaPersonalizada from "./ModalRecorrenciaPersonalizada";
import { PDFViewer } from "./pdf-viewer";

// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};


export function NovaDespesaDrawer({
  isOpen,
  onClose,
  onSave,
  dataCompetencia,
  dadosBoleto,
  dadosParaDuplicacao,
}) {
  const [formData, setFormData] = useState({
    cliente: "",
    dataCompetencia: dataCompetencia || new Date(),
    descricao: "",
    valor: "",
    habilitarRateio: false,
    categoria: "",
    centroCusto: "",
    codigoReferencia: "",
    repetirLancamento: false,
    vencimento: new Date(),
    origem: "",
    contaPagamento: "",
    pago: false,
    dataPagamento: null,
    agendado: false,
    observacoes: "",
    anexo_base64: "",
    parcelamento: "A vista",
    intervaloParcelas: "30",
  });

  const [clientes, setClientes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [subCategorias, setSubCategorias] = useState([]);
  const [contas, setContas] = useState([]);
  const [contasApi, setContasApi] = useState([]);
  const [centrosDeCusto, setCentrosDeCusto] = useState([]);
  const [showNovoClienteDrawer, setShowNovoClienteDrawer] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL;
  const [showCalendar, setShowCalendar] = useState(null);

  // Estado para recorrência
  const [repetirLancamento, setRepetirLancamento] = useState(false);
  const [recorrencias, setRecorrencias] = useState([]);
  const [recorrenciaSelecionada, setRecorrenciaSelecionada] = useState("");
  // Estado para dia de cobrança recorrente
  const [diaCobranca, setDiaCobranca] = useState("1");
  
  // Função para limpar seleção de recorrência
  const limparSelecaoRecorrencia = () => {
    setRecorrenciaSelecionada("");
  };

  // Estado para modal de recorrência personalizada
  const [showModalRecorrencia, setShowModalRecorrencia] = useState(false);

  // Estado para parcelamento
  const [parcelamento, setParcelamento] = useState("A vista");
  const [valorParcela, setValorParcela] = useState("");

  // Estado para aviso de conflito
  const [avisoConflito, setAvisoConflito] = useState(false);
  // Estado para controlar se a data de vencimento foi definida manualmente
  const [vencimentoManual, setVencimentoManual] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Reset do estado de fechamento quando modal abre
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false); // Reset do estado de fechamento
    }
  }, [isOpen]);

  // Pré-preencher campos quando há dados do boleto
  useEffect(() => {
    if (dadosBoleto) {
      setFormData(prev => ({
        ...prev,
        descricao: dadosBoleto.descricao || prev.descricao,
        valor: dadosBoleto.valor ? dadosBoleto.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : prev.valor,
        vencimento: dadosBoleto.dataVencimento || prev.vencimento,
        origem: dadosBoleto.origem || prev.origem,
        observacoes: dadosBoleto.observacoes || prev.observacoes,
        anexo_base64: dadosBoleto.anexo_base64 || prev.anexo_base64,
      }));
    }
  }, [dadosBoleto]);

  // Atualiza valor da parcela ao mudar parcelamento ou valor
  useEffect(() => {
    if (parcelamento !== "A vista" && formData.valor) {
      const numParcelas = parseInt(parcelamento.replace("x", ""));
      if (!isNaN(numParcelas) && numParcelas > 0) {
        const valor = parseFloat(formData.valor.replace(",", "."));
        if (!isNaN(valor)) {
          setValorParcela((valor / numParcelas).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
        } else {
          setValorParcela("");
        }
      } else {
        setValorParcela("");
      }
    } else {
      setValorParcela("");
    }
  }, [parcelamento, formData.valor]);

  // Atualiza aviso de conflito
  useEffect(() => {
    if (parcelamento !== "A vista" && repetirLancamento) {
      setAvisoConflito(true);
    } else {
      setAvisoConflito(false);
    }
  }, [parcelamento, repetirLancamento]);

  // Reset vencimento manual quando desativa repetir lançamento
  useEffect(() => {
    if (!repetirLancamento) {
      setVencimentoManual(false);
    }
  }, [repetirLancamento]);

  // Função para calcular próxima data de vencimento recorrente
  function calcularProximoVencimento(dia, baseDate) {
    const ano = baseDate.getFullYear();
    const mes = baseDate.getMonth() + 1; // 1-12
    let diaNum;
    if (dia === "ultimo") {
      // Último dia do mês
      diaNum = new Date(ano, mes, 0).getDate();
    } else {
      diaNum = parseInt(dia);
      // Se o mês não tem esse dia, pega o último dia do mês
      const ultimoDia = new Date(ano, mes, 0).getDate();
      if (diaNum > ultimoDia) diaNum = ultimoDia;
    }
    return new Date(ano, mes - 1, diaNum);
  }

  // Atualiza vencimento automaticamente quando recorrente (apenas se não foi definido manualmente)
  useEffect(() => {
    if (repetirLancamento && !vencimentoManual) {
      const novaData = calcularProximoVencimento(diaCobranca, formData.vencimento || new Date());
      setFormData((prev) => ({ ...prev, vencimento: novaData }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diaCobranca, repetirLancamento, vencimentoManual]);

  useEffect(() => {
    const empresaId = localStorage.getItem("empresaId");
    const token = localStorage.getItem("token");

    if (!empresaId || !token) return;

    // Função para buscar clientes (será reutilizada após criar novo cliente)
    const fetchClientes = async () => {
      try {
        console.log("Buscando clientes...");
        const res = await fetch(`${API}/clientes/company/${empresaId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        console.log("Clientes carregados:", data);
        setClientes(data);
      } catch (error) {
        console.error("Erro ao buscar clientes:", error);
      }
    };

    const fetchCategorias = async () => {
      try {
        // Buscar categorias principais de despesa
        const res = await fetch(`${API}/companies/${empresaId}/categorias`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();

        // Filtrar apenas categorias de despesa
        const despesaData = data.find((item) => item.tipo === "Despesa");
        const categoriasDespesa = despesaData?.categorias || [];
        setCategorias(categoriasDespesa);
      } catch (error) {
        console.error("Erro ao buscar categorias:", error);
      }
    };

    const fetchSubCategorias = async () => {
      try {
        const res = await fetch(`${API}/sub-categorias/empresa/${empresaId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        setSubCategorias(data);
      } catch (error) {
        console.error("Erro ao buscar subcategorias:", error);
      }
    };

    const fetchContas = async () => {
      try {
        const res = await fetch(`${API}/contas/empresa/${empresaId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        const lista = Array.isArray(data) ? data : Array.isArray(data?.contas) ? data.contas : [];
        setContas(lista);
      } catch (error) {
        console.error("Erro ao buscar contas:", error);
        setContas([]);
      }
    };

    const fetchContasApi = async () => {
      try {
        const res = await fetch(`${API}/contas-api/company/${empresaId}/contas`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await res.json();
        const lista = Array.isArray(json) ? json : Array.isArray(json.contas) ? json.contas : [];
        setContasApi(lista);
      } catch (error) {
        console.error("Erro ao buscar contas API:", error);
      }
    };

    const fetchCentrosDeCusto = async () => {
      try {
        const res = await fetch(`${API}/centro-de-custo/empresa/${empresaId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        setCentrosDeCusto(data);
      } catch (error) {
        console.error("Erro ao buscar centros de custo:", error);
      }
    };

    fetchClientes();
    fetchCategorias();
    fetchSubCategorias();
    fetchContas();
    fetchContasApi();
    fetchCentrosDeCusto();
  }, [API]);

  // Função para buscar as 5 últimas recorrências personalizadas (apenas as criadas pelo usuário)
  const fetchUltimasRecorrencias = async () => {
    const empresaId = localStorage.getItem("empresaId");
    const token = localStorage.getItem("token");
    if (!empresaId || !token) return [];
    
    try {
      const res = await fetch(`${API}/recorrencias?company_id=${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        console.error("Erro ao buscar recorrências:", res.status);
        return [];
      }
      
      const data = await res.json();
      console.log("📋 Todas as recorrências recebidas:", data);
      
      // Filtrar apenas recorrências da empresa atual (dupla verificação)
      const recorrenciasEmpresa = (data || []).filter((rec) => 
        rec.company_id && rec.company_id.toString() === empresaId
      );
      
      console.log("🏢 Recorrências filtradas por empresa:", recorrenciasEmpresa);
      
      // Filtrar apenas recorrências personalizadas (não automáticas)
      const recorrenciasPersonalizadas = recorrenciasEmpresa.filter((rec) => 
        rec.frequencia && // Tem frequência definida
        !rec.automatica && // Não é automática
        rec.status === 'ativo' // Está ativa
      );
      
      console.log("🎯 Recorrências personalizadas filtradas:", recorrenciasPersonalizadas);
      
      // Ordena por created_at desc e pega só as 5 mais recentes
      const ultimasRecorrencias = recorrenciasPersonalizadas
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
        
      console.log("🔄 Recorrências personalizadas carregadas:", ultimasRecorrencias.length);
      return ultimasRecorrencias;
    } catch (error) {
      console.error("❌ Erro ao buscar recorrências:", error);
      return [];
    }
  };

  // Atualiza recorrências ao abrir drawer ou criar nova
  useEffect(() => {
    if (repetirLancamento) {
      console.log("🔄 Carregando recorrências personalizadas...");
      fetchUltimasRecorrencias().then((recorrencias) => {
        console.log("📋 Recorrências carregadas:", recorrencias);
        setRecorrencias(recorrencias);
      });
    } else {
      // Limpa as recorrências quando desativa
      setRecorrencias([]);
      setRecorrenciaSelecionada("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repetirLancamento]);

  // Preenche formulário quando dados de duplicação são fornecidos
  useEffect(() => {
    if (dadosParaDuplicacao && isOpen) {
      console.log("🔄 Preenchendo formulário com dados de duplicação:", dadosParaDuplicacao);
      
      setFormData({
        cliente: String(dadosParaDuplicacao.cliente || ""),
        dataCompetencia: dataCompetencia || null,
        descricao: String(dadosParaDuplicacao.descricao || ""),
        valor: String(dadosParaDuplicacao.valor || ""),
        habilitarRateio: false,
        categoria: String(dadosParaDuplicacao.categoria || ""),
        centroCusto: String(dadosParaDuplicacao.centroCusto || ""),
        codigoReferencia: "",
        repetirLancamento: false,
        vencimento: dadosParaDuplicacao.vencimento || new Date(),
        origem: String(dadosParaDuplicacao.origem || ""),
        contaPagamento: String(dadosParaDuplicacao.contaPagamento || ""),
        pago: Boolean(dadosParaDuplicacao.duplicacao?.pago || false),
        dataPagamento: dadosParaDuplicacao.duplicacao?.dataPagamento || null,
        agendado: false,
        observacoes: String(dadosParaDuplicacao.observacoes || ""),
        anexo_base64: "",
        parcelamento: dadosParaDuplicacao.duplicacao?.parcela ? `${dadosParaDuplicacao.duplicacao.parcela}x` : "A vista",
        intervaloParcelas: String(dadosParaDuplicacao.duplicacao?.intervaloParcelas || "30"),
      });
      
      // Configura parcelamento se disponível
      if (dadosParaDuplicacao.duplicacao?.parcela > 1) {
        setParcelamento(`${dadosParaDuplicacao.duplicacao.parcela}x`);
      } else {
        setParcelamento("A vista");
      }
      
      console.log("✅ Formulário preenchido com sucesso");
    }
  }, [dadosParaDuplicacao, isOpen, dataCompetencia]);

  // Função para criar recorrência personalizada
  const mapTipoParaFrequencia = (tipo, intervalo) => {
    if (tipo === "dias" && intervalo === "1") return "diaria";
    if (tipo === "semanas") return "semanal";
    if (tipo === "meses") return "mensal";
    if (tipo === "anos") return "anual";
    return tipo; // fallback
  };

  const handleCriarRecorrenciaPersonalizada = async (dados) => {
    console.log("🔄 handleCriarRecorrenciaPersonalizada chamada com:", dados);
    const empresaId = localStorage.getItem("empresaId");
    const token = localStorage.getItem("token");
    if (!empresaId || !token) {
      console.error("❌ EmpresaId ou token não encontrados");
      return;
    }
    
    const payload = {
      frequencia: mapTipoParaFrequencia(dados.tipo, dados.intervalo),
      total_parcelas: dados.total,
      indeterminada: false,
      intervalo_personalizado: dados.intervalo,
      tipo_intervalo: dados.tipo,
      status: 'ativo',
      automatica: false, // Marca como não automática (personalizada)
      company_id: parseInt(empresaId),
    };
    
    console.log("📦 Payload para criar recorrência:", payload);
    
    try {
      const res = await fetch(`${API}/recorrencias`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        const nova = await res.json();
        console.log("✅ Nova recorrência personalizada criada:", nova);
        
        // Buscar lista atualizada de recorrências personalizadas
        const novasRecorrencias = await fetchUltimasRecorrencias();
        
        // Atualizar estado sem duplicação
        setRecorrencias(novasRecorrencias);
        
        // Selecionar a nova recorrência criada
        // Usa recorrencia_id se id não estiver disponível
        const idRecorrencia = nova.recorrencia_id || nova.id;
        if (idRecorrencia) {
          setRecorrenciaSelecionada(idRecorrencia.toString());
        }
        
        toast.success("Recorrência personalizada criada com sucesso!");
        setShowModalRecorrencia(false);
      } else {
        const errorData = await res.json();
        console.error("❌ Erro ao criar recorrência:", errorData);
        toast.error("Erro ao criar recorrência personalizada.");
      }
    } catch (error) {
      console.error("❌ Erro ao criar recorrência:", error);
      toast.error("Erro ao criar recorrência personalizada.");
    }
  };

  // Função para criar lista apenas de subcategorias de despesa
  const getSubCategoriasDespesa = () => {
    const items = [];

    // Filtrar apenas subcategorias de despesa
    subCategorias.forEach((subCategoria) => {
      // Verificar se a categoria pai é de despesa
      const categoriaPai = categorias.find(cat => cat.id === subCategoria.categoria_id);
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

  // Função para buscar clientes (reutilizada após criar novo cliente)
  const fetchClientes = async () => {
    const empresaId = localStorage.getItem("empresaId");
    const token = localStorage.getItem("token");

    if (!empresaId || !token) return;

    try {
      console.log("Buscando clientes...");
      const res = await fetch(`${API}/clientes/company/${empresaId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      console.log("Clientes carregados:", data);
      setClientes(data);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
    }
  };

  // Função para lidar com o salvamento de novo cliente
  const handleNovoClienteSave = async (data) => {
    console.log("Novo cliente criado:", data);
    
    // Atualizar a lista de clientes
    await fetchClientes();
    
    // Se o novo cliente foi criado com sucesso, selecioná-lo automaticamente
    if (data && data.id) {
      console.log("Selecionando novo cliente:", data.id);
      setFormData(prev => ({
        ...prev,
        cliente: data.id.toString()
      }));
      
      // Aguardar um pouco para garantir que o estado foi atualizado
      setTimeout(() => {
        console.log("Estado atualizado, cliente selecionado:", data.id);
      }, 100);
    }
    
    setShowNovoClienteDrawer(false);
  };

  const createDespesa = async () => {
    console.log("🚀 Iniciando createDespesa...");
    const empresaId = localStorage.getItem("empresaId");
    const token = localStorage.getItem("token");

    console.log("🏢 Empresa ID:", empresaId);
    console.log("🔑 Token:", token ? "Presente" : "Ausente");

    if (!empresaId || !token) {
      toast.error("Empresa ou token não encontrados. Faça login novamente.");
      return;
    }

    // Validação de campos obrigatórios
    console.log("🔍 Validando campos obrigatórios...");
    console.log("📝 Descrição:", formData.descricao);
    console.log("💰 Valor:", formData.valor);
    
    if (!formData.descricao) {
      console.warn("⚠️ Descrição não preenchida");
      console.log("🔔 Exibindo toast: Descrição é obrigatória!");
      toast("Descrição é obrigatória!", { type: "error" });
      return;
    }

    if (!formData.valor) {
      console.warn("⚠️ Valor não preenchido");
      console.log("🔔 Exibindo toast: Valor é obrigatório!");
      toast("Valor é obrigatório!", { type: "error" });
      return;
    }

    if (!formData.categoria) {
      console.warn("⚠️ Categoria não preenchida");
      console.log("🔔 Exibindo toast: Categoria é obrigatória!");
      toast("Categoria é obrigatória!", { type: "error" });
      return;
    }

    if (!formData.contaPagamento) {
      console.warn("⚠️ Conta de pagamento não preenchida");
      console.log("🔔 Exibindo toast: Conta de pagamento é obrigatória!");
      toast("Conta de pagamento é obrigatória!", { type: "error" });
      return;
    }

    if (!formData.cliente) {
      console.warn("⚠️ Cliente não preenchido");
      console.log("🔔 Exibindo toast: Cliente é obrigatório!");
      toast("Cliente é obrigatório!", { type: "error" });
      return;
    }
    
    console.log("✅ Validação de campos obrigatórios passou!");

    // Validação para data de pagamento quando já pago
    if (formData.pago && !formData.dataPagamento) {
      toast.error("Por favor, selecione a data de pagamento.");
      return;
    }

        // SEMPRE criar nova despesa, mesmo que já exista uma transação do boleto
    console.log("🔄 Fluxo de CRIAÇÃO de nova despesa...");
    console.log("📝 TransacaoId do boleto (será ignorado):", dadosBoleto?.transacaoId);

    // Encontrar o item selecionado (categoria ou subcategoria)
    console.log("🔄 Preparando dados para criação de nova transação...");
    const subCategoriasDespesa = getSubCategoriasDespesa();
    const itemSelecionado = subCategoriasDespesa.find(
      (item) => item.id.toString() === formData.categoria
    );

    const numParcelas = parcelamento !== "A vista" ? parseInt(parcelamento.replace("x", "")) : 1;
    const valorTotal = parseFloat(formData.valor.replace(",", "."));
    const valorPorParcela = numParcelas > 1 ? valorTotal / numParcelas : valorTotal;
    
    console.log("💰 Cálculo de valores:");
    console.log("   - Parcelamento:", parcelamento);
    console.log("   - Número de parcelas:", numParcelas);
    console.log("   - Valor total:", valorTotal);
    console.log("   - Valor por parcela:", valorPorParcela);

      const isApi = formData.contaPagamento?.startsWith('api:');
      const isErp = formData.contaPagamento?.startsWith('erp:');
      const contaIdParsed = isErp ? parseInt(formData.contaPagamento.split(':')[1]) : null;
      const contaApiIdParsed = isApi ? parseInt(formData.contaPagamento.split(':')[1]) : null;

      const payload = {
      conta_id: contaIdParsed,
      conta_api_id: contaApiIdParsed || null,
      company_id: parseInt(empresaId),
      tipo: "saida",
      valor: valorPorParcela,
      descricao: formData.descricao,
      data_transacao: formData.pago && formData.dataPagamento 
        ? formData.dataPagamento.toISOString().split("T")[0] 
        : null,
      origem: formData.origem,
      data_vencimento: formData.vencimento.toISOString().split("T")[0],
      situacao: formData.pago ? "recebido" : "em_aberto",
      observacoes: formData.observacoes || null,
      parcelamento:
        parcelamento === "A vista"
          ? 1
          : parseInt(parcelamento.replace("x", "")),
      intervalo_parcelas:
        parcelamento === "A vista"
          ? null
          : 30,
      categoria_id: itemSelecionado
        ? (itemSelecionado.isSubcategoria
            ? itemSelecionado.categoria_id
            : itemSelecionado.id)
        : null,
      sub_categoria_id: itemSelecionado && itemSelecionado.isSubcategoria
        ? itemSelecionado.id
        : null,
      anexo_base64: formData.anexo_base64 || null,
      cliente_id: formData.cliente ? parseInt(formData.cliente) : null,
      centro_de_custo_id: formData.centroCusto
        ? parseInt(formData.centroCusto)
        : null,
    };
    
    console.log("🔍 Verificando campos críticos do payload:");
    console.log("   - conta_id:", payload.conta_id);
    console.log("   - company_id:", payload.company_id);
    console.log("   - valor:", payload.valor);
    console.log("   - descricao:", payload.descricao);
    console.log("   - data_vencimento:", payload.data_vencimento);

    try {
      console.log("📦 Preparando payload para envio...");
      console.log("📋 Payload:", payload);
      
      // Impede envio se ambos selecionados
      if (parcelamento !== "A vista" && repetirLancamento) {
        toast.error("Não é possível usar Parcelamento e Repetir lançamento ao mesmo tempo. Escolha apenas um.");
        return;
      }
      // Parcelamento: cria recorrência mensal determinada
      if (parcelamento !== "A vista") {
        const recorrenciaPayload = {
          frequencia: "mensal",
          total_parcelas: parseInt(parcelamento.replace("x", "")),
          indeterminada: false,
          intervalo_personalizado: 1,
          tipo_intervalo: "meses",
          status: "ativo",
          // company_id: parseInt(empresaId),
          ...payload,
        };
        const response = await fetch(`${API}/recorrencias`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(recorrenciaPayload),
        });
        if (!response.ok) {
          toast.error("Erro ao criar despesa parcelada.");
          return;
        }
        const data = await response.json();
        toast.success("Despesa parcelada criada com sucesso!");
        onClose();
        onSave(data);
        return;
      }
      // Recorrência personalizada - usar configuração existente
      if (repetirLancamento && recorrenciaSelecionada) {
        const recorrencia = recorrencias.find(
          (r) => r.id.toString() === recorrenciaSelecionada
        );
        if (!recorrencia) {
          toast.error("Selecione uma configuração de recorrência válida.");
          return;
        }
        
        console.log("🔄 Usando configuração de recorrência existente:", recorrencia.id);
        
        // Criar recorrência usando configuração existente (com flag para não duplicar na lista)
        const recorrenciaPayload = {
          ...payload,
          // Dados da configuração de recorrência
          frequencia: recorrencia.frequencia,
          total_parcelas: recorrencia.total_parcelas,
          indeterminada: recorrencia.indeterminada,
          intervalo_personalizado: recorrencia.intervalo_personalizado,
          tipo_intervalo: recorrencia.tipo_intervalo,
          status: recorrencia.status,
          // Flag para indicar que é um template existente (não deve aparecer na lista)
          usar_template_existente: true,
          recorrencia_template_id: recorrencia.id,
        };
        
        const response = await fetch(`${API}/recorrencias`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(recorrenciaPayload),
        });
        
        if (!response.ok) {
          toast.error("Erro ao criar recorrência.");
          return;
        }
        
        const data = await response.json();
        console.log("✅ Recorrência criada usando template existente:", data);
        toast.success("Recorrência criada com sucesso!");
        onClose();
        onSave(data);
        return;
      }
      // Fluxo normal (não recorrente) - SEMPRE criar nova transação
      console.log("🌐 Fazendo POST para criar nova transação:", `${API}/transacoes`);
      console.log("📤 Headers:", {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ? "Presente" : "Ausente"}`,
      });
      
      const response = await fetch(`${API}/transacoes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log("✅ Status da resposta:", response.status);
      console.log("📊 Dados retornados:", data);

      if (!response.ok) {
        console.error("❌ Erro na resposta:", response.status, data);
        toast.error("Erro ao criar despesa.");
        return;
      }

      // Verificar se o valor foi extraído do PDF
      if (data.valor_extraido_pdf) {
        console.log("💰 Valor extraído do PDF:", data.valor_original, "→", data.valor_novo);
        toast.success(`Despesa criada com sucesso! Valor extraído do PDF: R$ ${data.valor_original} → R$ ${data.valor_novo}`);
      } else {
        console.log("🎉 Nova despesa criada com sucesso!");
        toast.success("Nova despesa criada com sucesso!");
      }
      
      onClose();
      onSave(data);
    } catch (error) {
      console.error("❌ Erro ao criar despesa:", error);
      console.error("🔍 Detalhes do erro:", {
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined
      });
      toast.error("Erro ao criar despesa. Verifique os campos.");
    }
  };

  const handleSave = async () => {
    console.log("🔄 Iniciando salvamento da despesa...");
    console.log("📋 Dados do boleto:", dadosBoleto);
    console.log("📝 Form data:", formData);
    await createDespesa();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são permitidos');
      return;
    }

    // Validar tamanho (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Tamanho máximo permitido é 10 MB');
      return;
    }

    toast.info('Processando PDF...');

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      // Remove o prefixo "data:application/pdf;base64,"
      const base64Data = base64.split(',')[1];
      
      setFormData((prev) => ({ 
        ...prev, 
        anexo_base64: base64Data 
      }));
      
      toast.success('PDF anexado com sucesso! O valor será extraído automaticamente ao salvar.');
    };
    
    reader.onerror = () => {
      toast.error('Erro ao processar arquivo');
    };
    
    reader.readAsDataURL(file);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 400); // Duração da animação de fechamento
  };

  if (!isOpen) return null;

  const subCategoriasDespesa = getSubCategoriasDespesa();

  return (
    <>
      <div className={cn(
        "fixed inset-0 z-50 bg-black/50 nova-despesa-overlay",
        isClosing && "closing"
      )}>
        <div
          className={cn(
            "fixed inset-0 theme-bg-primary shadow-xl overflow-hidden flex flex-col nova-despesa-modal",
            isClosing && "closing"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 theme-border-primary border-b theme-bg-primary sticky top-0 z-10">
            <h2 className="text-xl font-semibold theme-text-white">
              {dadosBoleto ? 'Editar despesa do boleto' : 'Nova despesa'}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0 theme-text-white hover:theme-text-secondary"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="h-full px-6 py-4 space-y-4">
              {/* Informações do boleto (quando disponível) */}
              {dadosBoleto && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium theme-text-white">
                    Informações do boleto
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Valor */}
                    <div className="space-y-2">
                      <Label className="theme-text-secondary">Valor</Label>
                      <div className="text-[#1E88E5] font-semibold text-lg">
                        {dadosBoleto.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </div>

                    {/* Vencimento */}
                    <div className="space-y-2">
                      <Label className="theme-text-secondary">Vencimento</Label>
                      <div className="theme-text-white">
                        {dadosBoleto.dataVencimento.toLocaleDateString('pt-BR')}
                      </div>
                    </div>

                    {/* Tipo */}
                    <div className="space-y-2">
                      <Label className="theme-text-secondary">Tipo</Label>
                      <div className="theme-text-white">
                        {dadosBoleto.tipoBoleto === 'pix' ? 'Boleto PIX' : 'Boleto Bancário'}
                      </div>
                    </div>

                    {/* Origem */}
                    <div className="space-y-2">
                      <Label className="theme-text-secondary">Origem</Label>
                      <div className="theme-text-white capitalize">
                        {dadosBoleto.origem}
                      </div>
                    </div>

                    {/* Beneficiário */}
                    {dadosBoleto.boletoMeta?.beneficiario && (
                      <div className="space-y-2">
                        <Label className="theme-text-secondary">Beneficiário</Label>
                        <div className="theme-text-white">
                          {dadosBoleto.boletoMeta.beneficiario}
                        </div>
                      </div>
                    )}

                    {/* Dados técnicos */}
                    {dadosBoleto.boletoMeta && (
                      <div className="space-y-2">
                        <Label className="theme-text-secondary">Dados técnicos</Label>
                        <div className="theme-text-secondary text-sm">
                          {dadosBoleto.tipoBoleto === 'linha_digitavel' ? 
                            `Banco: ${dadosBoleto.boletoMeta.bank_code}, Código: ${dadosBoleto.boletoMeta.barcode?.slice(0, 8)}...` :
                            `Beneficiário: ${dadosBoleto.boletoMeta.beneficiario || 'N/A'}`
                          }
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <hr className="theme-border-primary" />
                </div>
              )}

              {/* Informações do lançamento */}
              <div>
                <h3 className="text-lg font-medium theme-text-white mb-3">
                  Informações do lançamento
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {/* Fornecedor */}
                  <div className="space-y-2">
                    <Label htmlFor="cliente" className="theme-text-secondary">Cliente/Fornecedor <span className="text-[#F50057]">*</span></Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <ReactSelect
                          className="react-select-container"
                          classNamePrefix="react-select"
                          placeholder="Selecione o fornecedor"
                          value={
                            clientes.find(
                              (opt) => opt.id.toString() === formData.cliente
                            ) ? {
                              value: formData.cliente,
                              label: clientes.find(
                                (opt) => opt.id.toString() === formData.cliente
                              )?.nome_fantasia,
                            } : null
                          }
                          onChange={(selected) => {
                            console.log("Cliente selecionado:", selected);
                            handleInputChange(
                              "cliente",
                              selected ? selected.value : ""
                            );
                          }}
                          options={clientes.map((item) => ({
                            value: item.id.toString(),
                            label: item.nome_fantasia,
                          }))}
                          isClearable
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNovoClienteDrawer(true)}
                        className="theme-button-secondary px-3"
                        title="Adicionar novo fornecedor"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Data de competência */}
                  {/* <div className="space-y-2">
                    <Label>Data de Competência</Label>
                    <div className="flex gap-2">
                      <Popover
                        open={showCalendar === "competencia"}
                        onOpenChange={(open) =>
                          setShowCalendar(open ? "competencia" : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "flex-1 justify-start text-left font-normal theme-input",
                              !formData.dataCompetencia && "theme-text-secondary"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.dataCompetencia
                              ? format(formData.dataCompetencia, "dd/MM/yyyy", {
                                  locale: ptBR,
                                })
                              : "Selecione a data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={formData.dataCompetencia || undefined}
                            onSelect={(date) => {
                              handleInputChange("dataCompetencia", date);
                              setShowCalendar(null);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {formData.dataCompetencia && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleInputChange("dataCompetencia", null)}
                          className="px-3"
                          title="Limpar data"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div> */}

                  {/* Descrição */}
                  <div className="space-y-2">
                    <Label htmlFor="descricao" className="theme-text-secondary">Descrição <span className="text-[#F50057]">*</span></Label>
                    <Input
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) =>
                        handleInputChange("descricao", e.target.value)
                      }
                      placeholder="Digite a descrição"
                      className="theme-input theme-text-muted"
                    />
                  </div>

                  {/* Já pago? */}
                  {/* <div className="flex items-center gap-4 mt-4">
                    <Label htmlFor="pago" className="theme-text-white">Já pago?</Label>
                    <Switch
                      id="pago"
                      checked={formData.pago}
                      onCheckedChange={(checked) => {
                        handleInputChange("recebido", checked);
                        if (checked && !formData.dataPagamento) {
                          handleInputChange("dataPagamento", new Date());
                        } else if (!checked) {
                          // Limpa a data de pagamento quando desmarca o toggle
                          handleInputChange("dataPagamento", null);
                        }
                      }}
                    />
                    {formData.pago && (
                      <div className="flex-1 min-w-[200px]">
                        <Label className="theme-text-white">Data de Pagamento</Label>
                        <div className="flex gap-2 mt-1">
                          <Popover
                            open={showCalendar === "pagamento"}
                            onOpenChange={(open) =>
                              setShowCalendar(open ? "pagamento" : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "flex-1 justify-start text-left font-normal theme-input",
                                  !formData.dataPagamento && "theme-text-secondary"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {formData.dataPagamento
                                  ? format(formData.dataPagamento, "dd/MM/yyyy", {
                                      locale: ptBR,
                                    })
                                  : "Selecione a data"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={formData.dataPagamento || undefined}
                                onSelect={(date) => {
                                  handleInputChange("dataPagamento", date);
                                  setShowCalendar(null);
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          {formData.dataPagamento && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleInputChange("dataPagamento", null)}
                              className="px-3 theme-input hover:theme-text-white "
                              title="Limpar data"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div> */}
                </div>

                {/* Categoria, Centro de Custo e Valor alinhados */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 items-end">
                  {/* Categoria */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="theme-text-secondary">Subcategoria Despesa <span className="text-[#F50057]">*</span></Label>
                      <Info className="h-4 w-4 theme-text-secondary" />
                    </div>
                    <ReactSelect
                      className="react-select-container"
                      classNamePrefix="react-select"
                      placeholder="Selecione a subcategoria de despesa"
                      value={
                        subCategoriasDespesa.find(
                          (opt) => opt.id.toString() === formData.categoria
                        ) ? {
                          value: formData.categoria,
                          label: `${subCategoriasDespesa.find(
                            (opt) => opt.id.toString() === formData.categoria
                          )?.categoria_pai_nome} → ${subCategoriasDespesa.find(
                            (opt) => opt.id.toString() === formData.categoria
                          )?.nome}`,
                        } : null
                      }
                      onChange={(selected) =>
                        handleInputChange(
                          "categoria",
                          selected ? selected.value : ""
                        )
                      }
                      options={subCategoriasDespesa.map((item) => ({
                        value: item.id.toString(),
                        label: `${item.categoria_pai_nome} → ${item.nome}`,
                      }))}
                      isClearable
                    />
                  </div>

                  {/* Centro de Custo */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="theme-text-secondary">Centro de Custo</Label>
                      <Info className="h-4 w-4 invisible" />
                    </div>
                    <ReactSelect
                      className="react-select-container"
                      classNamePrefix="react-select"
                      placeholder="Selecione o centro de custo"
                      value={
                        centrosDeCusto.find(
                          (opt) => opt.id.toString() === formData.centroCusto
                        ) ? {
                          value: formData.centroCusto,
                          label: centrosDeCusto.find(
                            (opt) => opt.id.toString() === formData.centroCusto
                          )?.nome,
                        } : null
                      }
                      onChange={(selected) =>
                        handleInputChange(
                          "centroCusto",
                          selected ? selected.value : ""
                        )
                      }
                      options={centrosDeCusto.map((item) => ({
                        value: item.id.toString(),
                        label: item.nome,
                      }))}
                      isClearable
                    />
                  </div>

                  {/* Valor */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="valor" className="theme-text-secondary">Valor <span className="text-[#F50057]">*</span></Label>
                      <span className="w-4" />{" "}
                      {/* Placeholder para alinhamento */}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 theme-text-secondary">
                        R$
                      </span>
                      <Input
                        id="valor"
                        value={formData.valor}
                        onChange={(e) =>
                          handleInputChange("valor", e.target.value)
                        }
                        placeholder="0,00"
                        className="theme-input theme-text-muted pl-10 w-full h-10"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Toggle de recorrência - MOVIDO PARA CIMA DE CONDIÇÃO DE PAGAMENTO */}
              <div className="flex items-center gap-4 mb-4 mt-4">
                <Label htmlFor="repetirLancamento" className="theme-text-secondary">Repetir lançamento?</Label>
                <Switch
                  id="repetirLancamento"
                  checked={repetirLancamento}
                  onCheckedChange={setRepetirLancamento}
                />
                {repetirLancamento && (
                  <div className="flex-1 min-w-[320px]">
                    <Label className="ml-4 theme-text-secondary">Configurações de repetição *</Label>
                    <Select
                      value={recorrenciaSelecionada}
                      onValueChange={(val) => {
                        console.log("🔄 Selecionando recorrência:", val);
                        if (val === "personalizar") {
                          setShowModalRecorrencia(true);
                        } else {
                          setRecorrenciaSelecionada(val);
                        }
                      }}
                    >
                      <SelectTrigger className="theme-input">
                        <SelectValue placeholder="Selecione a recorrência" />
                      </SelectTrigger>
                      <SelectContent className="theme-modal theme-border-secondary">
                        {recorrencias.length > 0 ? (
                          recorrencias.map((rec, index) => (
                            <SelectItem 
                              key={`${rec.id}-${index}`} 
                              value={rec.id.toString()} 
                              className="theme-text-white"
                            >
                              {`${rec.frequencia === "mensal" ? "Mensal" : rec.frequencia.charAt(0).toUpperCase() + rec.frequencia.slice(1)}: A cada ${rec.intervalo_personalizado || 1} ${rec.tipo_intervalo || "mês(es)"}, ${rec.total_parcelas || "∞"} vez(es)${rec.indeterminada ? " (indeterminada)" : ""}`}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="theme-text-secondary px-2 py-1">Nenhuma recorrência personalizada encontrada</div>
                        )}
                        <SelectItem value="personalizar" className="theme-text-white">
                          ➕ Criar nova recorrência personalizada...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Condição de pagamento */}
              <div>
                <h3 className="text-lg font-medium theme-text-white mb-3">
                  Condição de pagamento
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Parcelamento e Vencimento lado a lado quando não recorrente */}
                  {!repetirLancamento ? (
                    <>
                      {/* Parcelamento */}
                      <div className="space-y-2">
                        <Label className="theme-text-secondary">Parcelamento</Label>
                        <Select
                          value={parcelamento}
                          onValueChange={setParcelamento}
                        >
                          <SelectTrigger className="theme-input">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="theme-modal theme-border-secondary">
                            <SelectItem value="A vista" className="theme-text-white">À vista</SelectItem>
                            {Array.from({ length: 59 }, (_, i) => (
                              <SelectItem key={i + 2} value={`${i + 2}x`} className="theme-text-white">{`${i + 2}x`}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {parcelamento !== "A vista" && valorParcela && (
                          <div className="text-sm theme-text-secondary mt-1">
                            Valor de cada parcela: <span className="font-semibold theme-text-white">{valorParcela}</span>
                          </div>
                        )}
                      </div>

                      {/* Data de Vencimento */}
                      <div className="space-y-2">
                        <Label className="theme-text-white">Data de vencimento <span className="text-[#F50057]">*</span></Label>
                        <Popover
                          open={showCalendar === "vencimento"}
                          onOpenChange={(open) =>
                            setShowCalendar(open ? "vencimento" : null)
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal theme-input",
                                !formData.vencimento && "theme-text-secondary"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.vencimento
                                ? format(formData.vencimento, "dd/MM/yyyy", {
                                    locale: ptBR,
                                  })
                                : "Selecione a data"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={formData.vencimento}
                              onSelect={(date) => {
                                if (date) {
                                  handleInputChange("vencimento", date);
                                }
                                setShowCalendar(null);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* 1º vencimento */}
                      <div className="space-y-2">
                        <Label className="theme-text-white">1º vencimento *</Label>
                        <Popover
                          open={showCalendar === "vencimento"}
                          onOpenChange={(open) =>
                            setShowCalendar(open ? "vencimento" : null)
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal theme-input",
                                !formData.vencimento && "theme-text-secondary"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.vencimento
                                ? format(formData.vencimento, "dd/MM/yyyy", {
                                    locale: ptBR,
                                  })
                                : "Selecione a data"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={formData.vencimento}
                              onSelect={(date) => {
                                if (date) {
                                  handleInputChange("vencimento", date);
                                  setVencimentoManual(true);
                                }
                                setShowCalendar(null);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </>
                  )}

                  {/* Forma de pagamento */}
                  <div className="space-y-2">
                    <Label className="theme-text-white">Forma de pagamento</Label>
                    <Select
                      value={formData.origem}
                      onValueChange={(value) =>
                        handleInputChange("origem", value)
                      }
                    >
                      <SelectTrigger className="theme-input">
                        <SelectValue placeholder="Selecione a forma" />
                      </SelectTrigger>
                      <SelectContent className="theme-modal theme-border-secondary">
                        <SelectItem value="dinheiro" className="theme-text-white">Dinheiro</SelectItem>
                        <SelectItem value="cartao" className="theme-text-white">Cartão</SelectItem>
                        <SelectItem value="transferencia" className="theme-text-white">
                          Transferência
                        </SelectItem>
                        <SelectItem value="pix" className="theme-text-white">PIX</SelectItem>
                        <SelectItem value="boleto" className="theme-text-white">Boleto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Conta de pagamento */}
                  <div className="space-y-2">
                    <Label className="theme-text-white">Conta de pagamento <span className="text-[#F50057]">*</span></Label>
                    <div className="flex items-center gap-2">
                   <Select
                      value={formData.contaPagamento}
                      onValueChange={(value) =>
                        handleInputChange("contaPagamento", value)
                      }
                    >
                        <SelectTrigger className="theme-input">
                          <SelectValue placeholder="Selecione a conta" />
                        </SelectTrigger>
                        <SelectContent className="theme-modal theme-border-secondary">
                          {/* Contas ERP */}
                          {contas
                            .filter((conta) => Boolean(conta.descricao_banco && String(conta.descricao_banco).trim()))
                            .map((conta) => (
                              <SelectItem
                                key={`erp-${conta.id}`}
                                value={`erp:${conta.id}`}
                                className="theme-text-white flex justify-between items-center"
                              >
                                <span>{conta.banco} — {conta.descricao_banco}</span>
                              </SelectItem>
                            ))}

                          {/* Contas API (OpenFinance) */}
                          {contasApi
                            .filter((conta) => Boolean(conta.descricao_banco && String(conta.descricao_banco).trim()))
                            .map((conta) => (
                              <SelectItem
                                key={`api-${conta.id}`}
                                value={`api:${conta.id}`}
                                className="theme-text-white flex justify-between items-center"
                              >
                                <span>{conta.descricao_banco}</span>
                                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40">OpenFinance</span>
                              </SelectItem>
                            ))}

                          {contas.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 &&
                           contasApi.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 && (
                            <div className="theme-text-secondary px-2 py-1">
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

              {/* Tabs - Observações e Anexo */}
              <div>
                <Tabs defaultValue="observacoes" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 theme-modal theme-border-secondary">
                    <TabsTrigger value="observacoes" className="theme-text-white data-[state=active]:bg-[#673AB7] data-[state=active]:theme-text-white">Observações</TabsTrigger>
                    <TabsTrigger value="anexo" className="theme-text-white data-[state=active]:bg-[#673AB7] data-[state=active]:theme-text-white">Anexo</TabsTrigger>
                  </TabsList>
                  <TabsContent value="observacoes" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="observacoes" className="theme-text-secondary">Observações</Label>
                      <Textarea
                        id="observacoes"
                        value={formData.observacoes}
                        onChange={(e) =>
                          handleInputChange("observacoes", e.target.value)
                        }
                        placeholder="Descreva observações relevantes sobre esse lançamento financeiro"
                        className="min-h-[100px] theme-input theme-text-muted"
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="anexo" className="space-y-4">
                    <div className="space-y-2">
                      {/* Upload de PDF */}
                      <div className="nova-despesa-pdf-section border-2 border-dashed theme-border-primary rounded-lg p-6 text-center">
                        <Label htmlFor="fileInput" className="cursor-pointer">
                          <div className="space-y-2">
                            <FileText className="h-8 w-8 text-[#673AB7] mx-auto" />
                            <p className="theme-text-white font-medium">
                              Clique para selecionar arquivo PDF
                            </p>
                            <p className="theme-text-secondary text-sm">
                              O valor será extraído automaticamente do boleto
                            </p>
                          </div>
                        </Label>
                        <input
                          id="fileInput"
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </div>

                      {/* Status do arquivo */}
                      {formData.anexo_base64 && (
                        <div className="nova-despesa-pdf-success">
                          <div className="flex items-center gap-2 nova-despesa-pdf-success-text">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="font-medium">PDF anexado com sucesso!</span>
                          </div>
                          <p className="theme-text-secondary text-sm mt-1">
                            O valor será extraído automaticamente ao salvar
                          </p>
                        </div>
                      )}

                      {/* Visualização do PDF */}
                      {formData.anexo_base64 && (
                        <div className="space-y-2">
                          <Label className="theme-text-secondary">Visualização do PDF</Label>
                          <div className="nova-despesa-pdf-viewer">
                            <PDFViewer 
                              base64Data={formData.anexo_base64}
                              fileName="boleto.pdf"
                              height="h-64"
                              showControls={true}
                            />
                          </div>
                          <div className="flex items-center gap-2 text-sm theme-text-secondary">
                            <Info className="h-4 w-4" />
                            <span>O valor do boleto será extraído automaticamente do PDF</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3 theme-border-primary border-t theme-bg-primary mt-auto">
            <Button variant="outline" onClick={onClose} className="theme-button-secondary">
              Voltar
            </Button>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                className="theme-button-primary"
              >
                {dadosBoleto ? 'Atualizar despesa' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Novo Cliente Drawer */}
      <NovoClienteDrawer
        isOpen={showNovoClienteDrawer}
        onClose={() => setShowNovoClienteDrawer(false)}
        onSave={handleNovoClienteSave}
      />
      {/* Modal de recorrência personalizada */}
      <ModalRecorrenciaPersonalizada
        open={showModalRecorrencia}
        onClose={() => setShowModalRecorrencia(false)}
        onConfirm={handleCriarRecorrenciaPersonalizada}
      />
    </>
  );
}
