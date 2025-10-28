"use client";

import { useState, useEffect } from "react";
import { X, Calendar as CalendarIcon, Info, Plus, FileText, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import ReactSelect from "react-select";
import { NovoClienteDrawer } from "./NovoClienteDrawer";
import ModalRecorrenciaPersonalizada from "./ModalRecorrenciaPersonalizada";
import { PDFViewer } from "./pdf-viewer";
import styles from '../../styles/financeiro/nova-despesa.module.css';

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
  // Estado para controlar qual tab está ativa
  const [activeTab, setActiveTab] = useState("observacoes");

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
    let empresaId = localStorage.getItem("empresaId");
    // Se não encontrou empresaId diretamente, buscar do userData
    if (!empresaId) {
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      empresaId = userData.EmpresaId || null;
    }
    const token = localStorage.getItem("token");

    if (!empresaId || !token) return;

    // Função para buscar clientes (será reutilizada após criar novo cliente)
    const fetchClientes = async () => {
      try {
        console.log("🔍 Buscando clientes para empresaId:", empresaId);
        const url = `${API}/financeiro/clientes/empresa/${empresaId}`;
        console.log("🔗 URL completa:", url);
        console.log("🔑 Token presente:", token ? "Sim" : "Não");
        
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        console.log("📡 Status da resposta:", res.status);
        
        if (!res.ok) {
          console.error("❌ Erro na resposta:", res.status, res.statusText);
          const errorText = await res.text();
          console.error("📄 Corpo do erro:", errorText);
          return;
        }
        
        const data = await res.json();
        console.log("✅ Clientes carregados:", data);
        console.log("📊 Quantidade de clientes:", Array.isArray(data) ? data.length : "Não é array");
        setClientes(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("❌ Erro ao buscar clientes:", error);
        setClientes([]);
      }
    };

    const fetchCategorias = async () => {
      try {
        // Buscar todas as categorias da empresa e filtrar apenas as de Despesa
        const res = await fetch(`${API}/financeiro/categorias/empresa/${empresaId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        
        const categoriasDespesa = [];
        const subcatsDespesa = [];

        if (Array.isArray(data)) {
          data.forEach((item) => {
            if (item?.tipo === 'Despesa' && Array.isArray(item.categorias)) {
              item.categorias.forEach((categoria) => {
                const catEnriquecida = {
                  ...categoria,
                  tipo_id: item.tipo_id,
                  tipo_nome: item.tipo,
                };
                categoriasDespesa.push(catEnriquecida);
                if (Array.isArray(categoria.subcategorias)) {
                  categoria.subcategorias.forEach((sub) => {
                    subcatsDespesa.push({
                      ...sub,
                      categoria_nome: categoria.nome,
                    });
                  });
                }
              });
            }
          });
        }

        setCategorias(categoriasDespesa);
        // Se houver subcategorias vindas junto, usar como fonte primária
        if (subcatsDespesa.length > 0) {
          setSubCategorias(subcatsDespesa);
        }
      } catch (error) {
        console.error('Erro ao buscar categorias:', error);
      }
    };

    const fetchSubCategorias = async () => {
      try {
        const url = `${API}/financeiro/sub-categorias/empresa/${empresaId}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          console.error('❌ Erro na resposta (subcategorias):', res.status);
          return;
        }
        const data = await res.json();
        // Se ainda não populamos pelas categorias, usar esse retorno
        if (!Array.isArray(subCategorias) || subCategorias.length === 0) {
          setSubCategorias(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('❌ Erro ao buscar subcategorias:', error);
      }
    };

    const fetchContas = async () => {
      try {
        console.log("🔍 Buscando contas para empresaId:", empresaId);
        const url = `${API}/financeiro/contas/company/${empresaId}/contas`;
        console.log("🔗 URL contas:", url);
        
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        console.log("📡 Status da resposta (contas):", res.status);
        
        const data = await res.json();
        console.log("📦 Dados recebidos (contas):", data);
        
        // A API retorna {total: X, contas: [...]}
        const lista = data?.contas || [];
        console.log("📊 Quantidade de contas:", lista.length);
        setContas(lista);
      } catch (error) {
        console.error("❌ Erro ao buscar contas:", error);
        setContas([]);
      }
    };

    const fetchContasApi = async () => {
      try {
        console.log("🔍 Buscando contas API para empresaId:", empresaId);
        const url = `${API}/financeiro/contas/company/${empresaId}/contas`;
        console.log("🔗 URL contas API:", url);
        
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        console.log("📡 Status da resposta (contas API):", res.status);
        
        if (!res.ok) {
          console.warn("⚠️ Rota de contas API não encontrada (404) - OK, não é obrigatória");
          setContasApi([]);
          return;
        }
        
        const json = await res.json();
        console.log("📦 Dados recebidos (contas API):", json);
        
        const lista = Array.isArray(json) ? json : json?.contas || [];
        console.log("📊 Quantidade de contas API:", lista.length);
        setContasApi(lista);
      } catch (error) {
        console.error("❌ Erro ao buscar contas API:", error);
        setContasApi([]);
      }
    };

    const fetchCentrosDeCusto = async () => {
      try {
        const res = await fetch(`${API}/financeiro/centro-de-custo/empresa/${empresaId}`, {
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
    let empresaId = localStorage.getItem("empresaId");
    // Se não encontrou empresaId diretamente, buscar do userData
    if (!empresaId) {
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      empresaId = userData.EmpresaId || null;
    }
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
    let empresaId = localStorage.getItem("empresaId");
    // Se não encontrou empresaId diretamente, buscar do userData
    if (!empresaId) {
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      empresaId = userData.EmpresaId || null;
    }
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

    // Construir um conjunto com os IDs (como string) de categorias de Despesa carregadas
    const categoriaDespesaIds = new Set(
      (categorias || []).map((cat) => String(cat.id))
    );

    // Filtrar apenas subcategorias cuja categoria pertença às categorias de Despesa
    (subCategorias || []).forEach((subCategoria) => {
      if (categoriaDespesaIds.has(String(subCategoria.categoria_id))) {
        items.push({
          id: subCategoria.id,
          nome: subCategoria.nome,
          isSubcategoria: true,
          categoria_id: subCategoria.categoria_id,
          categoria_pai_nome: subCategoria.categoria_nome || 'Categoria',
        });
      }
    });

    // Ordenar alfabeticamente por categoria pai e depois por subcategoria
    return items.sort((a, b) => {
      const categoriaCompare = (a.categoria_pai_nome || '').localeCompare(b.categoria_pai_nome || '');
      if (categoriaCompare !== 0) return categoriaCompare;
      return a.nome.localeCompare(b.nome);
    });
  };

  // Função para buscar clientes (reutilizada após criar novo cliente)
  const fetchClientes = async () => {
    let empresaId = localStorage.getItem("empresaId");
    // Se não encontrou empresaId diretamente, buscar do userData
    if (!empresaId) {
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      empresaId = userData.EmpresaId || null;
    }
    const token = localStorage.getItem("token");

    if (!empresaId || !token) return;

    try {
      console.log("Buscando clientes...");
      const res = await fetch(`${API}/financeiro/clientes/empresa/${empresaId}`, {
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
    let empresaId = localStorage.getItem("empresaId");
    // Se não encontrou empresaId diretamente, buscar do userData
    if (!empresaId) {
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      empresaId = userData.EmpresaId || null;
    }
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
      empresa_id: parseInt(empresaId),
      tipo: "saida",
      valor: valorPorParcela,
      descricao: formData.descricao,
      data_transacao: formData.pago && formData.dataPagamento 
        ? formData.dataPagamento.toISOString().split("T")[0] 
        : null,
      origem: formData.origem,
      data_vencimento: formData.vencimento.toISOString().split("T")[0],
      situacao: formData.pago ? "recebido" : "em aberto",
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
      subcategoria_id: itemSelecionado && itemSelecionado.isSubcategoria
        ? itemSelecionado.id
        : null,
      anexo_base64: formData.anexo_base64 || null,
      cliente_id: formData.cliente ? parseInt(formData.cliente) : null,
      centro_custo_id: formData.centroCusto
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
      
      const response = await fetch(`${API}/financeiro/transacoes`, {
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
      <div  className={cn(
        styles.novaDespesaOverlay,
        isClosing && styles.closing
      )}>
        <div
          className={cn(
            styles.novaDespesaModal,
            isClosing && styles.closing
          )}
        >
          {/* Header */}
          <div className={styles.novaDespesaHeader}>
            <h2 className={styles.novaDespesaTitle}>
              {dadosBoleto ? 'Editar despesa do boleto' : 'Nova despesa'}
            </h2>
            <button
              onClick={handleClose}
              className={styles.novaDespesaCloseButton}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className={styles.novaDespesaContent}>
              {/* Informações do boleto (quando disponível) */}
              {dadosBoleto && (
                <div className={styles.novaDespesaSection}>
                  <h3 className={styles.novaDespesaSectionTitle}>
                    Informações do boleto
                  </h3>

                  <div className={styles.novaDespesaGrid}>
                    {/* Valor */}
                    <div className={styles.novaDespesaField}>
                      <label className={styles.novaDespesaLabel}>Valor</label>
                      <div className={styles.novaDespesaParcelaValor} style={{color: '#1E88E5', fontSize: '18px'}}>
                        {dadosBoleto.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </div>

                    {/* Vencimento */}
                    <div className={styles.novaDespesaField}>
                      <label className={styles.novaDespesaLabel}>Vencimento</label>
                      <div className={styles.novaDespesaLabel}>
                        {dadosBoleto.dataVencimento.toLocaleDateString('pt-BR')}
                      </div>
                    </div>

                    {/* Tipo */}
                    <div className={styles.novaDespesaField}>
                      <label className={styles.novaDespesaLabel}>Tipo</label>
                      <div className={styles.novaDespesaLabel}>
                        {dadosBoleto.tipoBoleto === 'pix' ? 'Boleto PIX' : 'Boleto Bancário'}
                      </div>
                    </div>

                    {/* Origem */}
                    <div className={styles.novaDespesaField}>
                      <label className={styles.novaDespesaLabel}>Origem</label>
                      <div className={styles.novaDespesaLabel} style={{textTransform: 'capitalize'}}>
                        {dadosBoleto.origem}
                      </div>
                    </div>

                    {/* Beneficiário */}
                    {dadosBoleto.boletoMeta?.beneficiario && (
                      <div className={styles.novaDespesaField}>
                        <label className={styles.novaDespesaLabel}>Beneficiário</label>
                        <div className={styles.novaDespesaLabel}>
                          {dadosBoleto.boletoMeta.beneficiario}
                        </div>
                      </div>
                    )}

                    {/* Dados técnicos */}
                    {dadosBoleto.boletoMeta && (
                      <div className={styles.novaDespesaField}>
                        <label className={styles.novaDespesaLabel}>Dados técnicos</label>
                        <div className={styles.novaDespesaLabel} style={{fontSize: '14px', opacity: 0.7}}>
                          {dadosBoleto.tipoBoleto === 'linha_digitavel' ? 
                            `Banco: ${dadosBoleto.boletoMeta.bank_code}, Código: ${dadosBoleto.boletoMeta.barcode?.slice(0, 8)}...` :
                            `Beneficiário: ${dadosBoleto.boletoMeta.beneficiario || 'N/A'}`
                          }
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Informações do lançamento */}
              <div className={styles.novaDespesaSection}>
                <h3 className={styles.novaDespesaSectionTitle}>
                  Informações do lançamento
                </h3>

                <div className={styles.novaDespesaGrid}>
                  {/* Fornecedor */}
                  <div className={styles.novaDespesaField}>
                    <label htmlFor="cliente" className={styles.novaDespesaLabel}>
                      Cliente/Fornecedor <span className={styles.novaDespesaLabelRequired}>*</span>
                    </label>
                    <div className={styles.novaDespesaClientContainer}>
                      <div className={styles.novaDespesaClientField}>
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
                      <button
                        onClick={() => setShowNovoClienteDrawer(true)}
                        className={styles.novaDespesaAddButton}
                        title="Adicionar novo fornecedor"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>


                  {/* Descrição */}
                  <div className={styles.novaDespesaField}>
                    <label htmlFor="descricao" className={styles.novaDespesaLabel}>
                      Descrição <span className={styles.novaDespesaLabelRequired}>*</span>
                    </label>
                    <input
                      type="text"
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) =>
                        handleInputChange("descricao", e.target.value)
                      }
                      placeholder="Digite a descrição"
                      className={styles.novaDespesaInput}
                    />
                  </div>
                </div>

                {/* Categoria, Centro de Custo e Valor alinhados */}
                <div className={styles.novaDespesaGrid}>
                  {/* Categoria */}
                  <div className={styles.novaDespesaField}>
                    <div className={styles.novaDespesaLabelContainer}>
                      <label className={styles.novaDespesaLabel}>
                        Subcategoria Despesa <span className={styles.novaDespesaLabelRequired}>*</span>
                      </label>
                      <Info className={styles.novaDespesaInfoIcon} />
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
                  <div className={styles.novaDespesaField}>
                    <div className={styles.novaDespesaLabelContainer}>
                      <label className={styles.novaDespesaLabel}>Centro de Custo</label>
                      <Info className={styles.novaDespesaInfoIconInvisible} />
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
                  <div className={styles.novaDespesaField}>
                    <div className={styles.novaDespesaLabelContainer}>
                      <label htmlFor="valor" className={styles.novaDespesaLabel}>
                        Valor <span className={styles.novaDespesaLabelRequired}>*</span>
                      </label>
                      <span className={styles.novaDespesaSpacer} />
                    </div>
                    <div className={styles.novaDespesaInputWithIcon}>
                      <span className={styles.novaDespesaInputIcon}>R$</span>
                      <input
                        type="text"
                        id="valor"
                        value={formData.valor}
                        onChange={(e) =>
                          handleInputChange("valor", e.target.value)
                        }
                        placeholder="0,00"
                        className={styles.novaDespesaInput}
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Toggle de recorrência - MOVIDO PARA CIMA DE CONDIÇÃO DE PAGAMENTO */}
              <div className={styles.novaDespesaField}>
                <div className={styles.novaDespesaSwitchContainer}>
                  <label htmlFor="repetirLancamento" className={styles.novaDespesaLabel}>Repetir lançamento?</label>
                  <input
                    type="checkbox"
                    id="repetirLancamento"
                    checked={repetirLancamento}
                    onChange={(e) => setRepetirLancamento(e.target.checked)}
                    className={styles.novaDespesaCheckbox}
                  />
                  {repetirLancamento && (
                    <div className={styles.novaDespesaRecurrenceSelect}>
                      <select
                        value={recorrenciaSelecionada}
                        onChange={(e) => {
                          const val = e.target.value;
                          console.log("🔄 Selecionando recorrência:", val);
                          if (val === "personalizar") {
                            setShowModalRecorrencia(true);
                          } else {
                            setRecorrenciaSelecionada(val);
                          }
                        }}
                        className={styles.novaDespesaSelectTrigger}
                      >
                        <option value="">Selecione a recorrência</option>
                        {recorrencias.length > 0 && (
                          recorrencias.map((rec, index) => (
                            <option 
                              key={`${rec.id}-${index}`} 
                              value={rec.id.toString()} 
                              className={styles.novaDespesaSelectItem}
                            >
                              {`${rec.frequencia === "mensal" ? "Mensal" : rec.frequencia.charAt(0).toUpperCase() + rec.frequencia.slice(1)}: A cada ${rec.intervalo_personalizado || 1} ${rec.tipo_intervalo || "mês(es)"}, ${rec.total_parcelas || "∞"} vez(es)${rec.indeterminada ? " (indeterminada)" : ""}`}
                            </option>
                          ))
                        )}
                        <option value="personalizar" className={styles.novaDespesaSelectItem}>
                          ➕ Criar nova recorrência personalizada...
                        </option>
                      </select>
                      {recorrencias.length === 0 && (
                        <div className={styles.novaDespesaNoRecurrenceMessage}>Nenhuma recorrência personalizada encontrada</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Condição de pagamento */}
              <div className={styles.novaDespesaSection}>
                <h3 className={styles.novaDespesaSectionTitle}>
                  Condição de pagamento
                </h3>

                <div className={styles.novaDespesaGrid4Colunas}>
                  {/* Parcelamento e Vencimento lado a lado quando não recorrente */}
                  {!repetirLancamento ? (
                    <>
                      {/* Parcelamento */}
                      <div className={styles.novaDespesaField}>
                        <label className={styles.novaDespesaLabel}>Parcelamento</label>
                        <ReactSelect
                          className="react-select-container"
                          classNamePrefix="react-select"
                          placeholder="Selecione o parcelamento"
                          value={{ value: parcelamento, label: parcelamento === 'A vista' ? 'À vista' : parcelamento }}
                          onChange={(selected) => setParcelamento(selected ? selected.value : 'A vista')}
                          options={[{ value: 'A vista', label: 'À vista' }, ...Array.from({ length: 59 }, (_, i) => ({ value: `${i + 2}x`, label: `${i + 2}x` }))]}
                          isClearable
                        />
                        {parcelamento !== "A vista" && valorParcela && (
                          <div className={styles.novaDespesaParcelaInfo}>
                            Valor de cada parcela: <span className={styles.novaDespesaParcelaValor}>{valorParcela}</span>
                          </div>
                        )}
                      </div>

                      {/* Data de Vencimento */}
                      <div className={styles.novaDespesaField}>
                        <label className={styles.novaDespesaLabel}>
                          Data de vencimento <span className={styles.novaDespesaLabelRequired}>*</span>
                        </label>
                        <div className={styles.novaDespesaCalendarWrapper}>
                          <button
                            type="button"
                            className={styles.novaDespesaCalendarTrigger}
                            onClick={() => {
                              setShowCalendar(showCalendar === "vencimento" ? null : "vencimento");
                            }}
                          >
                            <CalendarIcon className={styles.novaDespesaCalendarIcon} />
                            {formData.vencimento
                              ? format(formData.vencimento, "dd/MM/yyyy", {
                                  locale: ptBR,
                                })
                              : "Selecione a data"}
                          </button>
                          
                          {showCalendar === "vencimento" && (
                            <div className={styles.novaDespesaCalendarDropdown}>
                              <input
                                type="date"
                                value={formData.vencimento.toISOString().split('T')[0]}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleInputChange("vencimento", new Date(e.target.value));
                                  }
                                  setShowCalendar(null);
                                }}
                                className={styles.novaDespesaDateInput}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* 1º vencimento */}
                      <div className={styles.novaDespesaField}>
                        <label className={styles.novaDespesaLabel}>
                          1º vencimento <span className={styles.novaDespesaLabelRequired}>*</span>
                        </label>
                        <div className={styles.novaDespesaCalendarWrapper}>
                          <button
                            type="button"
                            className={styles.novaDespesaCalendarTrigger}
                            onClick={() => {
                              setShowCalendar(showCalendar === "vencimento" ? null : "vencimento");
                            }}
                          >
                            <CalendarIcon className={styles.novaDespesaCalendarIcon} />
                            {formData.vencimento
                              ? format(formData.vencimento, "dd/MM/yyyy", {
                                  locale: ptBR,
                                })
                              : "Selecione a data"}
                          </button>
                          
                          {showCalendar === "vencimento" && (
                            <div className={styles.novaDespesaCalendarDropdown}>
                              <input
                                type="date"
                                value={formData.vencimento.toISOString().split('T')[0]}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleInputChange("vencimento", new Date(e.target.value));
                                    setVencimentoManual(true);
                                  }
                                  setShowCalendar(null);
                                }}
                                className={styles.novaDespesaDateInput}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Forma de pagamento */}
                  <div className={styles.novaDespesaField}>
                    <label className={styles.novaDespesaLabel}>Forma de pagamento</label>
                    <ReactSelect
                      className="react-select-container"
                      classNamePrefix="react-select"
                      placeholder="Selecione a forma"
                      value={formData.origem ? {
                        value: formData.origem,
                        label: formData.origem === 'dinheiro' ? 'Dinheiro' :
                               formData.origem === 'cartao' ? 'Cartão' :
                               formData.origem === 'transferencia' ? 'Transferência' :
                               formData.origem === 'pix' ? 'PIX' :
                               formData.origem === 'boleto' ? 'Boleto' : formData.origem
                      } : null}
                      onChange={(selected) => handleInputChange('origem', selected ? selected.value : '')}
                      options={[
                        { value: 'dinheiro', label: 'Dinheiro' },
                        { value: 'cartao', label: 'Cartão' },
                        { value: 'transferencia', label: 'Transferência' },
                        { value: 'pix', label: 'PIX' },
                        { value: 'boleto', label: 'Boleto' }
                      ]}
                      isClearable
                    />
                  </div>

                  {/* Conta de pagamento */}
                  <div className={styles.novaDespesaField}>
                    <label className={styles.novaDespesaLabel}>
                      Conta de pagamento <span className={styles.novaDespesaLabelRequired}>*</span>
                    </label>
                    <div className={styles.novaDespesaContaContainer}>
                      <ReactSelect
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder="Selecione a conta"
                        value={formData.contaPagamento ? {
                          value: formData.contaPagamento,
                          label: (() => {
                            const isApi = formData.contaPagamento.startsWith('api:');
                            const isErp = formData.contaPagamento.startsWith('erp:');
                            if (isErp) {
                              const contaId = parseInt(formData.contaPagamento.split(':')[1]);
                              const conta = contas.find(c => c.id === contaId);
                              return conta ? `${conta.banco} — ${conta.descricao_banco}` : formData.contaPagamento;
                            } else if (isApi) {
                              const contaId = parseInt(formData.contaPagamento.split(':')[1]);
                              const conta = contasApi.find(c => c.id === contaId);
                              return conta ? conta.descricao_banco : formData.contaPagamento;
                            }
                            return formData.contaPagamento;
                          })()
                        } : null}
                        onChange={(selected) => handleInputChange('contaPagamento', selected ? selected.value : '')}
                        options={[
                          ...contas
                            .filter((conta) => Boolean(conta.descricao_banco && String(conta.descricao_banco).trim()))
                            .map((conta) => ({ value: `erp:${conta.id}`, label: `${conta.banco} — ${conta.descricao_banco}` })),
                          ...contasApi
                            .filter((conta) => Boolean(conta.descricao_banco && String(conta.descricao_banco).trim()))
                            .map((conta) => ({ value: `api:${conta.id}`, label: `${conta.descricao_banco} (OpenFinance)` }))
                        ]}
                        noOptionsMessage={() => 'Nenhuma conta encontrada'}
                        isClearable
                      />
                      <div className={styles.novaDespesaStatusIndicator}>
                        <div className={`${styles.novaDespesaStatusDot} ${styles.novaDespesaStatusDotPrimary}`}></div>
                        <div className={`${styles.novaDespesaStatusDot} ${styles.novaDespesaStatusDotWarning}`}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs - Observações e Anexo */}
              <div className={styles.novaDespesaSection}>
                <div className={styles.novaDespesaTabs}>
                  <div className={styles.novaDespesaTabsList}>
                    <button 
                      value="observacoes" 
                      onClick={() => setActiveTab("observacoes")}
                      className={`${styles.novaDespesaTabsTrigger} ${activeTab === "observacoes" ? styles.novaDespesaTabsTriggerActive : ""}`}
                    >
                      Observações
                    </button>
                    <button 
                      value="anexo" 
                      onClick={() => setActiveTab("anexo")}
                      className={`${styles.novaDespesaTabsTrigger} ${activeTab === "anexo" ? styles.novaDespesaTabsTriggerActive : ""}`}
                    >
                      Anexo
                    </button>
                  </div>
                  {activeTab === "observacoes" && (
                    <div className={styles.novaDespesaTabsContent}>
                      <div className={styles.novaDespesaField}>
                        <label htmlFor="observacoes" className={styles.novaDespesaLabel}>Observações</label>
                        <textarea
                          id="observacoes"
                          value={formData.observacoes}
                          onChange={(e) =>
                            handleInputChange("observacoes", e.target.value)
                          }
                          placeholder="Descreva observações relevantes sobre esse lançamento financeiro"
                          className={styles.novaDespesaTextarea}
                        />
                      </div>
                    </div>
                  )}
                  {activeTab === "anexo" && (
                    <div className={styles.novaDespesaTabsContent}>
                    <div className={styles.novaDespesaField}>
                      {/* Upload de PDF */}
                      <div className={styles.novaDespesaPdfSection}>
                        <label htmlFor="fileInput" className="cursor-pointer">
                          <div className={styles.novaDespesaField}>
                            <FileText className={styles.novaDespesaPdfIcon} style={{color: '#673AB7'}} />
                            <p className={styles.novaDespesaPdfTitle}>
                              Clique para selecionar arquivo PDF
                            </p>
                            <p className={styles.novaDespesaPdfSubtitle}>
                              O valor será extraído automaticamente do boleto
                            </p>
                          </div>
                        </label>
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
                        <div className={styles.novaDespesaPdfSuccess}>
                          <div className={styles.novaDespesaPdfSuccessText}>
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="font-medium">PDF anexado com sucesso!</span>
                          </div>
                          <p className={styles.novaDespesaPdfSuccessSubtext}>
                            O valor será extraído automaticamente ao salvar
                          </p>
                        </div>
                      )}

                      {/* Visualização do PDF */}
                      {formData.anexo_base64 && (
                        <div className={styles.novaDespesaField}>
                          <label className={styles.novaDespesaLabel}>Visualização do PDF</label>
                          <div className={styles.novaDespesaPdfSection}>
                            <PDFViewer 
                              base64Data={formData.anexo_base64}
                              fileName="boleto.pdf"
                              height="h-64"
                              showControls={true}
                            />
                          </div>
                          <div className={styles.novaDespesaLabelContainer} style={{fontSize: '14px', opacity: 0.7}}>
                            <Info className="h-4 w-4" />
                            <span>O valor do boleto será extraído automaticamente do PDF</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              </div>

          {/* Footer */}
          <div className={styles.novaDespesaFooter}>
            <div className={styles.novaDespesaFooterActions}>
              <button onClick={onClose} className={styles.novaDespesaButtonSecondary}>
                Voltar
              </button>
              <button
                onClick={handleSave}
                className={styles.novaDespesaButtonPrimary}
              >
                {dadosBoleto ? 'Atualizar despesa' : 'Salvar'}
              </button>
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
    </div>
    </>
  );    
}
