"use client";

import { useState, useEffect } from "react";
import styles from "../../styles/financeiro/nova-receita.module.css";
// Componentes externos removidos - usando HTML nativo
import {
  X,
  Calendar as CalendarIcon,
  ChevronDown,
  Info,
  Search,
  DollarSign,
  Plus,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import ReactSelect from "react-select";
import { NovoClienteDrawer } from "./NovoClienteDrawer";
import ModalRecorrenciaPersonalizada from "./ModalRecorrenciaPersonalizada";

// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

export default function NovaReceitaDrawer({
  isOpen,
  onClose,
  onSave,
  dataCompetencia,
  dadosParaDuplicacao,
  transacaoId,
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
    parcelamento: "A vista",
    vencimento: new Date(),
    formaPagamento: "",
    contaRecebimento: "", // "erp:{id}" para contas tradicionais, "api:{id}" para contas OpenFinance
    recebido: false,
    dataRecebimento: null,
    informarNSU: false,
    observacoes: "",
    anexo_base64: "",
  });
  const API = process.env.NEXT_PUBLIC_API_URL;
  const [showCalendar, setShowCalendar] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [subCategorias, setSubCategorias] = useState([]);
  const [contas, setContas] = useState([]);
  const [contasApi, setContasApi] = useState([]);
  const [centrosDeCusto, setCentrosDeCusto] = useState([]);
  const [showNovoClienteDrawer, setShowNovoClienteDrawer] = useState(false);
  // Estado para modal de recorrência personalizada
  const [repetirLancamento, setRepetirLancamento] = useState(false);
  const [recorrencias, setRecorrencias] = useState([]);
  const [recorrenciaSelecionada, setRecorrenciaSelecionada] = useState("");
  const [showModalRecorrencia, setShowModalRecorrencia] = useState(false);
  // Estados para controlar componentes customizados
  const [isRecurrenceSelectOpen, setIsRecurrenceSelectOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("observacoes");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  // Estado para dia de cobrança recorrente
  const [diaCobranca, setDiaCobranca] = useState("1");
  // Estado para parcelamento
  const [parcelamento, setParcelamento] = useState("A vista");
  const [valorParcela, setValorParcela] = useState("");
  // Estado para aviso de conflito
  const [avisoConflito, setAvisoConflito] = useState(false);
  // Estado para controlar se a data de vencimento foi definida manualmente
  const [vencimentoManual, setVencimentoManual] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoadingTransacao, setIsLoadingTransacao] = useState(false);

  // Funções auxiliares para o calendário
  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  const isSameDay = (date1, date2) => {
    if (!date1 || !date2) return false;
    return date1.toDateString() === date2.toDateString();
  };

  const isToday = (date) => {
    return isSameDay(date, new Date());
  };

  const handleDateSelect = (day, field) => {
    const selectedDate = new Date(currentYear, currentMonth, day);
    handleInputChange(field, selectedDate);
    setShowCalendar(null);
  };

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
      const novaData = calcularProximoVencimento(
        diaCobranca,
        formData.vencimento || new Date()
      );
      setFormData((prev) => ({ ...prev, vencimento: novaData }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diaCobranca, repetirLancamento, vencimentoManual]);

  // Atualiza valor da parcela ao mudar parcelamento ou valor
  useEffect(() => {
    if (parcelamento !== "A vista" && formData.valor) {
      const numParcelas = parseInt(parcelamento.replace("x", ""));
      if (!isNaN(numParcelas) && numParcelas > 0) {
        const valor = parseFloat(formData.valor.replace(",", "."));
        if (!isNaN(valor)) {
          setValorParcela(
            (valor / numParcelas).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })
          );
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

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false); // Reset do estado de fechamento
      // Desabilita o scroll da página principal
      document.body.style.overflow = 'hidden';
      
      // Se há transacaoId, carregar dados para edição
      if (transacaoId) {
        loadTransacaoForEdit();
      } else {
        setIsEditMode(false);
      }
    } else {
      // Reabilita o scroll da página principal
      document.body.style.overflow = 'unset';
      // Resetar estado de edição ao fechar
      setIsEditMode(false);
    }

    // Cleanup: reabilita o scroll quando o componente for desmontado
    return () => {
      document.body.style.overflow = 'unset';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, transacaoId]);

  // Efeito para fechar selects quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.selectComponent')) {
        setIsRecurrenceSelectOpen(false);
      }
      if (!event.target.closest('.novaReceitaCalendarWrapper')) {
        setShowCalendar(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    // Buscar empresaId do userData (padrão correto do sistema)
    const userData = localStorage.getItem("userData");
    const user = userData ? JSON.parse(userData) : null;
    const empresaId = user?.EmpresaId || user?.empresa?.id || null;
    const token = localStorage.getItem("token");

    if (!empresaId || !token) return;

    const fetchClientes = async () => {
      try {
        const res = await fetch(`${API}/financeiro/clientes/empresa/${empresaId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        setClientes(data);
      } catch (error) {
        console.error("Erro ao buscar clientes:", error);
      }
    };

    const fetchCategorias = async () => {
      try {
        // Buscar categorias principais (já vêm com subcategorias aninhadas)
        const res = await fetch(`${API}/financeiro/categorias/empresa/${empresaId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        
        // A API retorna um array com objetos que têm tipo_id, tipo e categorias
        // Vamos pegar TODAS as categorias (independente do tipo)
        const todasCategorias = [];
        
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item.categorias && Array.isArray(item.categorias)) {
              // Adicionar o tipo_id e tipo a cada categoria
              item.categorias.forEach(categoria => {
                todasCategorias.push({
                  ...categoria,
                  tipo_id: item.tipo_id,
                  tipo_nome: item.tipo
                });
              });
            }
          });
        }
        
        setCategorias(todasCategorias);
        
        // Extrair todas as subcategorias das categorias
        const todasSubCategorias = [];
        todasCategorias.forEach(categoria => {
          if (categoria.subcategorias && Array.isArray(categoria.subcategorias)) {
            todasSubCategorias.push(...categoria.subcategorias);
          }
        });
        
        setSubCategorias(todasSubCategorias);
      } catch (error) {
        console.error("❌ Erro ao buscar categorias:", error);
      }
    };

    const fetchContas = async () => {
      try {
        const res = await fetch(`${API}/financeiro/caixinha/empresa/${empresaId}`, {
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
        const res = await fetch(`${API}/financeiro/contas/company/${empresaId}/contas`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await res.json();
        const lista = Array.isArray(json)
          ? json
          : Array.isArray(json.contas)
          ? json.contas
          : [];
        setContasApi(lista);
      } catch (error) {
        console.error("Erro ao buscar contas API:", error);
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
    fetchContas();
    fetchContasApi();
    fetchCentrosDeCusto();
  }, [API]);

  // Função para buscar as 5 últimas recorrências da empresa atual
  const fetchUltimasRecorrencias = async () => {
    // Buscar empresaId do userData (padrão correto do sistema)
    const userData = localStorage.getItem("userData");
    const user = userData ? JSON.parse(userData) : null;
    const empresaId = user?.EmpresaId || user?.empresa?.id || null;
    const token = localStorage.getItem("token");
    if (!empresaId || !token) return [];
    
    try {
      const res = await fetch(`${API}/financeiro/recorrencias`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        console.error("Erro ao buscar recorrências:", res.status);
        return [];
      }
      
      const data = await res.json();
      
      // Filtrar apenas recorrências da empresa atual (dupla verificação)
      const recorrenciasEmpresa = (data || []).filter((rec) => 
        (rec.empresa_id || rec.company_id) && (rec.empresa_id || rec.company_id).toString() === empresaId.toString()
      );
      
      // Ordena por created_at desc e pega só as 5 mais recentes
      return recorrenciasEmpresa
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
    } catch (error) {
      console.error("Erro ao buscar recorrências:", error);
      return [];
    }
  };

  // Atualiza recorrências ao abrir drawer ou criar nova
  useEffect(() => {
    if (repetirLancamento) {
      fetchUltimasRecorrencias().then(setRecorrencias);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repetirLancamento]);

  // Preenche formulário quando dados de duplicação são fornecidos
  useEffect(() => {
    if (dadosParaDuplicacao && isOpen) {
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
        parcelamento: dadosParaDuplicacao.duplicacao?.parcela ? `${dadosParaDuplicacao.duplicacao.parcela}x` : "A vista",
        vencimento: dadosParaDuplicacao.vencimento || new Date(),
        formaPagamento: String(dadosParaDuplicacao.formaPagamento || ""),
        contaRecebimento: String(dadosParaDuplicacao.contaRecebimento || ""),
        recebido: Boolean(dadosParaDuplicacao.duplicacao?.recebido || false),
        dataRecebimento: dadosParaDuplicacao.duplicacao?.dataRecebimento || null,
        informarNSU: false,
        observacoes: String(dadosParaDuplicacao.observacoes || ""),
        anexo_base64: "",
      });
      
      // Configura parcelamento se disponível
      if (dadosParaDuplicacao.duplicacao?.parcela > 1) {
        setParcelamento(`${dadosParaDuplicacao.duplicacao.parcela}x`);
      } else {
        setParcelamento("A vista");
      }
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
    // Buscar empresaId do userData (padrão correto do sistema)
    const userData = localStorage.getItem("userData");
    const user = userData ? JSON.parse(userData) : null;
    const empresaId = user?.EmpresaId || user?.empresa?.id || null;
    const token = localStorage.getItem("token");
    if (!empresaId || !token) return;
    
    const payload = {
      frequencia: mapTipoParaFrequencia(dados.tipo, dados.intervalo),
      total_parcelas: dados.total,
      indeterminada: false,
      intervalo_personalizado: dados.intervalo,
      tipo_intervalo: dados.tipo,
      status: "ativo",
      empresa_id: parseInt(empresaId),
    };
    
    const res = await fetch(`${API}/financeiro/recorrencias`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    
    if (res.ok) {
      const nova = await res.json();
      // Atualiza lista e seleciona a nova recorrência
      const novas = await fetchUltimasRecorrencias();
      setRecorrencias(novas);
      // Usa recorrencia_id se id não estiver disponível
      const idRecorrencia = nova.recorrencia_id || nova.id;
      if (idRecorrencia) {
        setRecorrenciaSelecionada(idRecorrencia.toString());
      }
      toast.success("Recorrência personalizada criada com sucesso!");
      setShowModalRecorrencia(false);
    } else {
      toast.error("Erro ao criar recorrência personalizada.");
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      setFormData((prev) => ({ ...prev, anexo_base64: base64 }));
    };
    reader.readAsDataURL(file);
  };

  // Função para criar lista apenas de subcategorias de receita
  const getSubCategoriasReceita = () => {
    const items = [];

    // Filtrar apenas subcategorias de receita
    subCategorias.forEach((subCategoria) => {
      // Verificar se a categoria pai existe e é de receita
      const categoriaPai = categorias.find(cat => cat.id === subCategoria.categoria_id);
      
      // Se encontrou a categoria pai E ela é de receita, adiciona à lista
      if (categoriaPai && categoriaPai.tipo_nome === "Receita") {
        items.push({
          id: subCategoria.id,
          
          nome: subCategoria.nome,
          isSubcategoria: true,
          categoria_id: subCategoria.categoria_id,
          categoria_pai_nome: categoriaPai.nome,
          tipo_id: categoriaPai.tipo_id
          
          
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

  // Função principal para criar transação
  const createTransaction = async () => {
    const token = localStorage.getItem("token");
    // Buscar empresaId do userData (padrão correto do sistema)
    const userData = localStorage.getItem("userData");
    const user = userData ? JSON.parse(userData) : null;
    const empresaId = user?.EmpresaId || user?.empresa?.id || null;

    if (!token || !empresaId) {
      toast.error("Token ou empresaId não encontrados.");
      return;
    }

    // Validação de campos obrigatórios
    if (!formData.descricao) {
      toast("Descrição é obrigatória!", { type: "error" });
      return;
    }

    if (!formData.valor) {
      toast("Valor é obrigatório!", { type: "error" });
      return;
    }

    if (!formData.categoria) {
      toast("Categoria é obrigatória!", { type: "error" });
      return;
    }

    if (!formData.contaRecebimento) {
      toast("Conta de recebimento é obrigatória!", { type: "error" });
      return;
    }

    if (!formData.cliente) {
      toast("Cliente é obrigatório!", { type: "error" });
      return;
    }

    // Encontrar o item selecionado (categoria ou subcategoria)
    const itemSelecionado = getSubCategoriasReceita().find(
      (item) => item.id.toString() === formData.categoria
    );

    if (!itemSelecionado) {
      toast.error("Por favor, selecione uma categoria.");
      return;
    }

    // Validação para data de recebimento quando já recebido
    if (formData.recebido && !formData.dataRecebimento) {
      toast.error("Por favor, selecione a data de recebimento.");
      return;
    }

    const numParcelas =
      parcelamento !== "A vista" ? parseInt(parcelamento.replace("x", "")) : 1;
    const valorTotal = parseFloat(formData.valor.replace(",", "."));
    const valorPorParcela =
      numParcelas > 1 ? valorTotal / numParcelas : valorTotal;

    try {
      // Impede envio se ambos selecionados
      if (parcelamento !== "A vista" && repetirLancamento) {
        toast.error("Não é possível usar Parcelamento e Repetir lançamento ao mesmo tempo. Escolha apenas um.");
        return;
      }
      // Removida a lógica de criação automática de boleto
      // Agora a forma de pagamento "boleto" apenas indica o tipo de transação, sem criar boleto automaticamente
      let boletoId = null;

      // Parcelamento: cria recorrência mensal determinada
      if (parcelamento !== "A vista") {
        const isApi = formData.contaRecebimento?.startsWith('api:');
        const isErp = formData.contaRecebimento?.startsWith('erp:');
        const contaIdParsed = isErp ? parseInt(formData.contaRecebimento.split(':')[1]) : null;
        const contaApiIdParsed = isApi ? parseInt(formData.contaRecebimento.split(':')[1]) : null;

        const recorrenciaPayload = {
          conta_id: contaIdParsed,
          conta_api_id: contaApiIdParsed || null,
          empresa_id: parseInt(empresaId),
          tipo: "entrada",
          valor: valorPorParcela,
          descricao: formData.descricao,
          data_transacao:
            formData.recebido && formData.dataRecebimento
              ? formData.dataRecebimento.toISOString().split("T")[0]
              : null,
          origem: formData.formaPagamento,
          data_vencimento: formData.vencimento.toISOString().split("T")[0],
          situacao: formData.recebido ? "recebido" : "em aberto",
          observacao: formData.observacoes || null,
          parcelamento: parseInt(parcelamento.replace("x", "")),
          intervalo_parcelas: 30,
          categoria_id: itemSelecionado.isSubcategoria
            ? itemSelecionado.categoria_id
            : itemSelecionado.id,
          subcategoria_id: itemSelecionado.isSubcategoria
            ? itemSelecionado.id
            : null,
          cliente_id: formData.cliente ? parseInt(formData.cliente) : null,
          anexo_base64: formData.anexo_base64 || null,
          centro_custo_id: formData.centroCusto
            ? parseInt(formData.centroCusto)
            : null,
          boleto_id: boletoId,
          frequencia: "mensal",
          total_parcelas: parseInt(parcelamento.replace("x", "")),
          indeterminada: false,
          intervalo_personalizado: 1,
          tipo_intervalo: "meses",
          status: "ativo",
        };
        const response = await fetch(`${API}/financeiro/recorrencias`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(recorrenciaPayload),
        });
        if (!response.ok) {
          toast.error("Erro ao criar receita parcelada.");
          return;
        }
        const data = await response.json();
        toast.success("Receita parcelada criada com sucesso!");
        resetForm();
        onClose();
        onSave(data);
        return;
      }
      // Recorrência personalizada
      if (repetirLancamento && recorrenciaSelecionada) {
        const recorrencia = recorrencias.find(
          (r) => r.id.toString() === recorrenciaSelecionada
        );
        if (!recorrencia) {
          toast.error("Selecione uma configuração de recorrência válida.");
          return;
        }
        const isApi = formData.contaRecebimento?.startsWith('api:');
        const isErp = formData.contaRecebimento?.startsWith('erp:');
        const contaIdParsed = isErp ? parseInt(formData.contaRecebimento.split(':')[1]) : null;
        const contaApiIdParsed = isApi ? parseInt(formData.contaRecebimento.split(':')[1]) : null;

        // Criar recorrência usando configuração existente (com flag para não duplicar na lista)
        const recorrenciaPayload = {
          conta_id: contaIdParsed,
          conta_api_id: contaApiIdParsed || null,
          empresa_id: parseInt(empresaId),
          tipo: "entrada",
          valor: valorPorParcela,
          descricao: formData.descricao,
          data_transacao:
            formData.recebido && formData.dataRecebimento
              ? formData.dataRecebimento.toISOString().split("T")[0]
              : null,
          origem: formData.formaPagamento,
          data_vencimento: formData.vencimento.toISOString().split("T")[0],
          situacao: formData.recebido ? "recebido" : "em aberto",
          observacao: formData.observacoes || null,
          parcelamento: 1,
          intervalo_parcelas: 30,
          categoria_id: itemSelecionado.isSubcategoria
            ? itemSelecionado.categoria_id
            : itemSelecionado.id,
          subcategoria_id: itemSelecionado.isSubcategoria
            ? itemSelecionado.id
            : null,
          cliente_id: formData.cliente ? parseInt(formData.cliente) : null,
          anexo_base64: formData.anexo_base64 || null,
          centro_custo_id: formData.centroCusto
            ? parseInt(formData.centroCusto)
            : null,
          boleto_id: boletoId,
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
        
        const response = await fetch(`${API}/financeiro/recorrencias`, {
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
        toast.success("Recorrência criada com sucesso!");
        resetForm();
        onClose();
        onSave(data);
        return;
      }
      // Fluxo normal (não recorrente) - cria transação única
      // 2️⃣ Monta o payload da transação
      const isApi = formData.contaRecebimento?.startsWith('api:');
      const isErp = formData.contaRecebimento?.startsWith('erp:');
      const contaIdParsed = isErp ? parseInt(formData.contaRecebimento.split(':')[1]) : null;
      const contaApiIdParsed = isApi ? parseInt(formData.contaRecebimento.split(':')[1]) : null;

      const transacaoPayload = {
        conta_id: contaIdParsed,
        empresa_id: parseInt(empresaId),
        tipo: "entrada",
        valor: valorPorParcela,
        descricao: formData.descricao,
        data_transacao:
          formData.recebido && formData.dataRecebimento
            ? formData.dataRecebimento.toISOString().split("T")[0]
            : null,
        origem: formData.formaPagamento,
        data_vencimento: formData.vencimento.toISOString().split("T")[0],
        situacao: formData.recebido ? "recebido" : "em aberto",
        observacao: formData.observacoes || null,
        parcelamento: 1,
        intervalo_parcelas: 30,
        categoria_id: itemSelecionado.isSubcategoria
          ? itemSelecionado.categoria_id
          : itemSelecionado.id,
        subcategoria_id: itemSelecionado.isSubcategoria
          ? itemSelecionado.id
          : null,
        cliente_id: formData.cliente ? parseInt(formData.cliente) : null,
        anexo: formData.anexo_base64 || null,
        centro_custo_id: formData.centroCusto
          ? parseInt(formData.centroCusto)
          : null,
        boleto_id: boletoId
      };

      // 3️⃣ Cria a transação no backend
      const resTransacao = await fetch(`${API}/financeiro/transacoes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(transacaoPayload),
      });

      if (!resTransacao.ok) {
        toast.error("Erro ao criar transação.");
        return;
      }

      const transacaoData = await resTransacao.json();
      toast.success("Transação criada com sucesso!");
      resetForm();
      onSave(transacaoData);
      onClose();
    } catch (error) {
      console.error("Erro ao criar transação:", error);
      toast.error("Erro ao criar transação.");
    }
  };

  // Função para atualizar transação existente
  const updateTransaction = async () => {
    const token = localStorage.getItem("token");
    // Buscar empresaId do userData (padrão correto do sistema)
    const userData = localStorage.getItem("userData");
    const user = userData ? JSON.parse(userData) : null;
    const empresaId = user?.EmpresaId || user?.empresa?.id || null;

    if (!token || !empresaId || !transacaoId) {
      toast.error("Token, empresaId ou transacaoId não encontrados.");
      return;
    }

    // Validação de campos obrigatórios
    if (!formData.descricao) {
      toast("Descrição é obrigatória!", { type: "error" });
      return;
    }

    if (!formData.valor) {
      toast("Valor é obrigatório!", { type: "error" });
      return;
    }

    if (!formData.categoria) {
      toast("Categoria é obrigatória!", { type: "error" });
      return;
    }

    if (!formData.contaRecebimento) {
      toast("Conta de recebimento é obrigatória!", { type: "error" });
      return;
    }

    // Encontrar o item selecionado (categoria ou subcategoria)
    const itemSelecionado = getSubCategoriasReceita().find(
      (item) => item.id.toString() === formData.categoria
    );

    if (!itemSelecionado) {
      toast.error("Por favor, selecione uma categoria.");
      return;
    }

    // Monta conta_id/conta_api_id conforme valor escolhido
    const isApi = formData.contaRecebimento?.startsWith('api:');
    const isErp = formData.contaRecebimento?.startsWith('erp:');
    const contaIdParsed = isErp ? parseInt(formData.contaRecebimento.split(':')[1]) : null;
    const contaApiIdParsed = isApi ? parseInt(formData.contaRecebimento.split(':')[1]) : null;

    const transacaoPayload = {
      conta_id: contaIdParsed,
      conta_api_id: contaApiIdParsed || null,
      empresa_id: parseInt(empresaId),
      tipo: "entrada",
      valor: parseFloat(formData.valor.replace(",", ".")),
      descricao: formData.descricao,
      data_transacao:
        formData.recebido && formData.dataRecebimento
          ? formData.dataRecebimento.toISOString().split("T")[0]
          : null,
      origem: formData.formaPagamento,
      data_vencimento: formData.vencimento.toISOString().split("T")[0],
      situacao: formData.recebido ? "recebido" : "em aberto",
      observacoes: formData.observacoes || null,
      categoria_id: itemSelecionado.isSubcategoria
        ? itemSelecionado.categoria_id
        : itemSelecionado.id,
      sub_categoria_id: itemSelecionado.isSubcategoria
        ? itemSelecionado.id
        : null,
      cliente_id: formData.cliente ? parseInt(formData.cliente) : null,
      anexo_base64: formData.anexo_base64 || null,
      centro_custo_id: formData.centroCusto
        ? parseInt(formData.centroCusto)
        : null,
    };

    const resTransacao = await fetch(`${API}/financeiro/transacoes/${transacaoId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(transacaoPayload),
    });

    if (!resTransacao.ok) {
      toast.error("Erro ao atualizar transação.");
      return;
    }

    const transacaoData = await resTransacao.json();
    toast.success("Transação atualizada com sucesso!");
    resetForm();
    setIsEditMode(false);
    onSave(transacaoData);
    onClose();
  };

  // Função para resetar o formulário
  const resetForm = () => {
    setFormData({
      cliente: "",
      dataCompetencia: dataCompetencia || new Date(),
      descricao: "",
      valor: "",
      habilitarRateio: false,
      categoria: "",
      centroCusto: "",
      codigoReferencia: "",
      repetirLancamento: false,
      parcelamento: "A vista",
      vencimento: new Date(),
      formaPagamento: "",
      contaRecebimento: "",
      recebido: false,
      dataRecebimento: null,
      informarNSU: false,
      observacoes: "",
      anexo_base64: "",
    });
    setRepetirLancamento(false);
    setRecorrenciaSelecionada("");
    setParcelamento("A vista");
    setDiaCobranca("1");
    setVencimentoManual(false);
    setAvisoConflito(false);
  };

  // Função para carregar dados da transação para edição
  const loadTransacaoForEdit = async () => {
    if (!transacaoId) return;

    setIsLoadingTransacao(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/financeiro/transacoes/${transacaoId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Erro ao buscar transação.");

      const data = await res.json();

      // Determinar qual categoria/subcategoria selecionar
      let categoriaSelecionada = "";
      if (data.sub_categoria_id) {
        categoriaSelecionada = data.sub_categoria_id.toString();
      } else if (data.categoria_id) {
        categoriaSelecionada = data.categoria_id.toString();
      }

      // Determinar conta
      let contaRecebimento = "";
      if (data.conta_id) {
        contaRecebimento = `erp:${data.conta_id}`;
      } else if (data.conta_api_id) {
        contaRecebimento = `api:${data.conta_api_id}`;
      }

      setFormData((prev) => ({
        ...prev,
        cliente: data.cliente_id?.toString() || "",
        dataCompetencia: data.data_transacao ? new Date(data.data_transacao) : new Date(),
        descricao: data.descricao || "",
        valor: data.valor?.toString() || "",
        habilitarRateio: false,
        categoria: categoriaSelecionada,
        centroCusto: data.centro_custo_id?.toString() || "",
        codigoReferencia: "",
        repetirLancamento: false,
        parcelamento: "A vista",
        vencimento: data.data_vencimento ? new Date(data.data_vencimento) : new Date(),
        formaPagamento: data.origem || "",
        contaRecebimento: contaRecebimento,
        recebido: data.situacao === "recebido",
        dataRecebimento: data.data_transacao ? new Date(data.data_transacao) : null,
        informarNSU: false,
        observacoes: data.observacoes || "",
        anexo_base64: data.anexo_base64 || data.anexo || "",
      }));

      setIsEditMode(true);
    } catch (error) {
      console.error("Erro ao carregar transação:", error);
      toast.error("Erro ao carregar dados para edição.");
    } finally {
      setIsLoadingTransacao(false);
    }
  };

  const handleSave = async () => {
    if (isEditMode && transacaoId) {
      await updateTransaction();
    } else {
      await createTransaction();
    }
  };

  // Função para buscar clientes (será reutilizada após criar novo cliente)
  const fetchClientes = async () => {
    // Buscar empresaId do userData (padrão correto do sistema)
    const userData = localStorage.getItem("userData");
    const user = userData ? JSON.parse(userData) : null;
    const empresaId = user?.EmpresaId || user?.empresa?.id || null;
    const token = localStorage.getItem("token");

    if (!empresaId || !token) return;

    try {
      const res = await fetch(`${API}/financeiro/clientes/empresa/${empresaId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      setClientes(data);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
    }
  };

  // Função para lidar com o salvamento de novo cliente
  const handleNovoClienteSave = async (data) => {
    // Atualizar a lista de clientes
    await fetchClientes();

    // Se o novo cliente foi criado com sucesso, selecioná-lo automaticamente
    if (data && data.id) {
      setFormData((prev) => ({
        ...prev,
        cliente: data.id.toString(),
      }));
    }

    setShowNovoClienteDrawer(false);
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
    }, 600); // Duração da animação de fechamento
  };

  // Função para fechar ao clicar no overlay
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  const subCategoriasReceita = getSubCategoriasReceita();

  return (
    <>
      <div 
        className={cn(
          styles.novaReceitaOverlay,
          isClosing && styles.closing
        )}
        onClick={handleOverlayClick}
      >
        <div
          className={cn(
            styles.novaReceitaModal,
            isClosing && styles.closing
          )}
        >
          {/* Handle para indicar que pode ser arrastado */}
          <div className={styles.novaReceitaHandle}></div>
          
          {/* Header */}
          <div className={styles.novaReceitaHeader}>
            <h2 className={styles.novaReceitaTitle}>{isEditMode ? "Editar receita" : "Nova receita"}</h2>
            <button
              onClick={handleClose}
              className={styles.novaReceitaCloseButton}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className={styles.novaReceitaContent}>
            {/* Informações do lançamento */}
            <div className={styles.novaReceitaSection}>
              <h3 className={styles.novaReceitaSectionTitle}>
                Informações do lançamento
              </h3>
              
              {/* Primeira linha: Cliente e Descrição lado a lado */}
              <div className={styles.novaReceitaFlexRow}>
                {/* Cliente */}
                <div>
                  <label htmlFor="cliente" className={cn(styles.labelComponent, styles.novaReceitaLabel)}>Cliente/Fornecedor <span className={styles.novaReceitaLabelRequired}>*</span></label>
                  <div className={styles.novaReceitaClientContainer}>
                    <div className={styles.novaReceitaClientField} style={{ transform: 'translateY(0px)' }}>
                      <ReactSelect
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder="Selecione o cliente"
                        value={
                          clientes.find(
                            (opt) => opt.id.toString() === formData.cliente
                          )
                            ? {
                                value: formData.cliente,
                                label: clientes.find(
                                  (opt) =>
                                    opt.id.toString() === formData.cliente
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
                        options={clientes.map((item) => ({
                          value: item.id.toString(),
                          label: item.nome_fantasia,
                        }))}
                        isClearable
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        menuPosition="fixed"
                        styles={{
                          menuPortal: (base) => ({ ...base, zIndex: 9999 })
                        }}
                      />
                    </div>
                    <button
                      onClick={() => setShowNovoClienteDrawer(true)}
                      className={styles.novaReceitaAddButton}
                      title="Adicionar novo cliente"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Descrição */}
                <div>
                  <label htmlFor="descricao" className={cn(styles.labelComponent, styles.novaReceitaLabel)}>Descrição <span className={styles.novaReceitaLabelRequired}>*</span></label>
                  <input
                    id="descricao"
                    type="text"
                    value={formData.descricao}
                    onChange={(e) =>
                      handleInputChange("descricao", e.target.value)
                    }
                    placeholder="Digite a descrição"
                    className={cn(styles.inputComponent, styles.novaReceitaInput)}
                  />
                </div>
              </div>

              {/* Campos principais em grid 3 colunas */}
              <div className={styles.novaReceitaGrid}>

                {/* Subcategoria Receita */}
                <div className={styles.novaReceitaField}>
                  <div className={styles.novaReceitaLabelContainer}>
                    <label className={cn(styles.labelComponent, styles.novaReceitaLabel)}>Subcategoria Receita <span className={styles.novaReceitaLabelRequired}>*</span></label>
                    <Info className={styles.novaReceitaInfoIcon} />
                  </div>
                  <ReactSelect
                    className="react-select-container"
                    classNamePrefix="react-select"
                    placeholder="Selecione a subcategoria de receita"
                    value={
                      subCategoriasReceita
                        .map((item) => ({
                          value: item.id.toString(),
                          label: `${item.categoria_pai_nome} → ${item.nome}`,
                        }))
                        .find((opt) => opt.value === formData.categoria) || null
                    }
                    onChange={(selected) =>
                      handleInputChange(
                        "categoria",
                        selected ? selected.value : ""
                      )
                    }
                    options={subCategoriasReceita.map((item) => ({
                      value: item.id.toString(),
                      label: `${item.categoria_pai_nome} → ${item.nome}`,
                    }))}
                    isClearable
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    menuPosition="fixed"
                    styles={{
                      menuPortal: (base) => ({ ...base, zIndex: 9999 })
                    }}
                  />
                </div>

                {/* Centro de Custo */}
                <div className={styles.novaReceitaField}>
                  <div className={styles.novaReceitaLabelContainer}>
                    <label className={cn(styles.labelComponent, styles.novaReceitaLabel)}>Centro de Custo</label>
                    <Info className={styles.novaReceitaInfoIconInvisible} />
                  </div>
                  <ReactSelect
                    className="react-select-container"
                    classNamePrefix="react-select"
                    placeholder="Selecione o centro de custo"
                    value={
                      centrosDeCusto
                        .map((item) => ({
                          value: item.id.toString(),
                          label: item.nome,
                          id: item.id,
                        }))
                        .find((opt) => opt.value === formData.centroCusto) ||
                      null
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
                      id: item.id,
                    }))}
                    isClearable
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    menuPosition="fixed"
                    styles={{
                      menuPortal: (base) => ({ ...base, zIndex: 9999 })
                    }}
                  />
                </div>

                {/* Valor */}
                <div className={styles.novaReceitaField}>
                  <div className={styles.novaReceitaLabelContainer}>
                    <label htmlFor="valor" className={cn(styles.labelComponent, styles.novaReceitaLabel)}>Valor <span className={styles.novaReceitaLabelRequired}>*</span></label>
                    <span className={styles.novaReceitaSpacer} />
                  </div>
                  <div className={styles.novaReceitaInputWithIcon}>
                    <span className={styles.novaReceitaInputIcon}>
                      R$
                    </span>
                    <input
                      id="valor"
                      type="text"
                      value={formData.valor}
                      onChange={(e) =>
                        handleInputChange("valor", e.target.value)
                      }
                      placeholder="0,00"
                      className={cn(styles.inputComponent, styles.novaReceitaInput)}
                    />
                  </div>
                </div>
              </div>

              {/* Repetir lançamento - linha separada */}
              <div className={styles.novaReceitaField}>
                <div className={styles.novaReceitaSwitchContainer}>
                  <label htmlFor="repetirLancamento" className={cn(styles.labelComponent, styles.novaReceitaLabel)}>Repetir lançamento?</label>
                  <button
                    id="repetirLancamento"
                    type="button"
                    onClick={() => setRepetirLancamento(!repetirLancamento)}
                    className={cn(
                      styles.switchComponent,
                      repetirLancamento ? styles.switchChecked : styles.switchUnchecked
                    )}
                  >
                    <div className={cn(
                      styles.switchThumb,
                      repetirLancamento ? styles.switchThumbChecked : styles.switchThumbUnchecked
                    )} />
                  </button>
                  {repetirLancamento && (
                    <div className={styles.novaReceitaRecurrenceSelect}>
                      <div className={styles.selectComponent}>
                        <button
                          type="button"
                          onClick={() => setIsRecurrenceSelectOpen(!isRecurrenceSelectOpen)}
                          className={cn(styles.selectTriggerComponent, styles.novaReceitaSelectTrigger)}
                        >
                          <span className={recorrenciaSelecionada ? styles.selectValue : styles.selectPlaceholder}>
                            {recorrenciaSelecionada
                              ? (() => {
                                  const rec = recorrencias.find(r => r.id.toString() === recorrenciaSelecionada);
                                  return rec ? `${
                                    rec.frequencia === "mensal"
                                      ? "Mensal"
                                      : rec.frequencia.charAt(0).toUpperCase() +
                                        rec.frequencia.slice(1)
                                  }: A cada ${rec.intervalo_personalizado || 1} ${
                                    rec.tipo_intervalo || "mês(es)"
                                  }, ${rec.total_parcelas || "∞"} vez(es)${
                                    rec.indeterminada ? " (indeterminada)" : ""
                                  }` : "Recorrência não encontrada";
                                })()
                              : "Selecione a recorrência"}
                          </span>
                          <ChevronDown className={cn(styles.selectIcon, isRecurrenceSelectOpen && styles.selectIconOpen)} />
                        </button>
                        {isRecurrenceSelectOpen && (
                          <div className={cn(styles.selectContentComponent, styles.novaReceitaSelectContent)}>
                            {recorrencias.length > 0 ? (
                              recorrencias.map((rec, index) => (
                                <button
                                  key={`${rec.id}-${index}`}
                                  type="button"
                                  onClick={() => {
                                    setRecorrenciaSelecionada(rec.id.toString());
                                    setIsRecurrenceSelectOpen(false);
                                  }}
                                  className={cn(styles.selectItemComponent, styles.novaReceitaSelectItem)}
                                >
                                  {`${
                                    rec.frequencia === "mensal"
                                      ? "Mensal"
                                      : rec.frequencia.charAt(0).toUpperCase() +
                                        rec.frequencia.slice(1)
                                  }: A cada ${rec.intervalo_personalizado || 1} ${
                                    rec.tipo_intervalo || "mês(es)"
                                  }, ${rec.total_parcelas || "∞"} vez(es)${
                                    rec.indeterminada ? " (indeterminada)" : ""
                                  }`}
                                </button>
                              ))
                            ) : (
                              <div className={styles.novaReceitaNoRecurrenceMessage}>Nenhuma recorrência personalizada encontrada</div>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setShowModalRecorrencia(true);
                                setIsRecurrenceSelectOpen(false);
                              }}
                              className={cn(styles.selectItemComponent, styles.novaReceitaSelectItem)}
                            >
                              ➕ Criar nova recorrência personalizada...
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Condição de Pagamento */}
            <div className={styles.novaReceitaSection}>
              <h3 className={styles.novaReceitaSectionTitle}>
                Condição de pagamento
              </h3>
              
              <div className={styles.novaReceitaGrid4Colunas}>
                {/* Parcelamento */}
                <div className={styles.novaReceitaField}>
                  <label className={cn(styles.labelComponent, styles.novaReceitaLabel)}>Parcelamento</label>
                  <ReactSelect
                    className="react-select-container"
                    classNamePrefix="react-select"
                    placeholder="Selecione o parcelamento"
                    value={{
                      value: parcelamento,
                      label: parcelamento
                    }}
                    onChange={(selected) => setParcelamento(selected ? selected.value : "A vista")}
                    options={[
                      { value: "A vista", label: "À vista" },
                      ...Array.from({ length: 59 }, (_, i) => ({
                        value: `${i + 2}x`,
                        label: `${i + 2}x`
                      }))
                    ]}
                    isClearable
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    menuPosition="fixed"
                    styles={{
                      menuPortal: (base) => ({ ...base, zIndex: 9999 })
                    }}
                  />
                  {parcelamento !== "A vista" && valorParcela && (
                    <div className={styles.novaReceitaParcelaInfo}>
                      Valor de cada parcela: <span className={styles.novaReceitaParcelaValor}>{valorParcela}</span>
                    </div>
                  )}
                </div>

                {/* Data de Vencimento */}
                <div className={styles.novaReceitaField}>
                  <label className={cn(styles.labelComponent, styles.novaReceitaLabel)}>Data de vencimento <span className={styles.novaReceitaLabelRequired}>*</span></label>
                  <div className={styles.novaReceitaCalendarWrapper}>
                    <button
                      type="button"
                      className={styles.novaReceitaCalendarTrigger}
                      onClick={() => {
                        setShowCalendar(showCalendar === "vencimento" ? null : "vencimento");
                      }}
                    >
                      <CalendarIcon className={styles.novaReceitaCalendarIcon} />
                      {formData.vencimento
                        ? format(formData.vencimento, "dd/MM/yyyy", {
                            locale: ptBR,
                          })
                        : "Selecione a data"}
                    </button>
                    
                    {showCalendar === "vencimento" && (
                      <div className={styles.novaReceitaCalendarDropdown}>
                        <div className={cn(styles.calendarComponent)}>
                          <div className={styles.calendarHeader}>
                            <button
                              type="button"
                              onClick={() => {
                                if (currentMonth === 0) {
                                  setCurrentMonth(11);
                                  setCurrentYear(currentYear - 1);
                                } else {
                                  setCurrentMonth(currentMonth - 1);
                                }
                              }}
                              className={styles.calendarNavButton}
                            >
                              ‹
                            </button>
                            <span>
                              {new Date(currentYear, currentMonth).toLocaleDateString('pt-BR', {
                                month: 'long',
                                year: 'numeric',
                              })}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (currentMonth === 11) {
                                  setCurrentMonth(0);
                                  setCurrentYear(currentYear + 1);
                                } else {
                                  setCurrentMonth(currentMonth + 1);
                                }
                              }}
                              className={styles.calendarNavButton}
                            >
                              ›
                            </button>
                          </div>
                          <div className={styles.calendarGrid}>
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                              <div key={day} className="text-center text-sm font-medium p-2">{day}</div>
                            ))}
                            {Array.from({ length: getFirstDayOfMonth(currentMonth, currentYear) }).map((_, i) => (
                              <div key={`empty-${i}`} />
                            ))}
                            {Array.from({ length: getDaysInMonth(currentMonth, currentYear) }).map((_, i) => {
                              const day = i + 1;
                              const date = new Date(currentYear, currentMonth, day);
                              const isSelected = isSameDay(date, formData.vencimento);
                              const isTodayDate = isToday(date);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => handleDateSelect(day, "vencimento")}
                                  className={cn(
                                    styles.calendarDay,
                                    isSelected && styles.calendarDaySelected,
                                    isTodayDate && !isSelected && styles.calendarDayToday
                                  )}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Forma de pagamento */}
                <div className={styles.novaReceitaField}>
                  <label className={cn(styles.labelComponent, styles.novaReceitaLabel)}>Forma de pagamento</label>
                  <ReactSelect
                    className="react-select-container"
                    classNamePrefix="react-select"
                    placeholder="Selecione a forma"
                    value={formData.formaPagamento ? {
                      value: formData.formaPagamento,
                      label: formData.formaPagamento === 'dinheiro' ? 'Dinheiro' :
                             formData.formaPagamento === 'cartao' ? 'Cartão' :
                             formData.formaPagamento === 'transferencia' ? 'Transferência' :
                             formData.formaPagamento === 'pix' ? 'PIX' :
                             formData.formaPagamento === 'boleto' ? 'Boleto' : formData.formaPagamento
                    } : null}
                    onChange={(selected) => handleInputChange("formaPagamento", selected ? selected.value : "")}
                    options={[
                      { value: "dinheiro", label: "Dinheiro" },
                      { value: "cartao", label: "Cartão" },
                      { value: "transferencia", label: "Transferência" },
                      { value: "pix", label: "PIX" },
                      { value: "boleto", label: "Boleto" }
                    ]}
                    isClearable
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    menuPosition="fixed"
                    styles={{
                      menuPortal: (base) => ({ ...base, zIndex: 9999 })
                    }}
                  />
                </div>

                {/* Conta de recebimento */}
                <div className={styles.novaReceitaField}>
                  <label className={cn(styles.labelComponent, styles.novaReceitaLabel)}>Conta de recebimento <span className={styles.novaReceitaLabelRequired}>*</span></label>
                  <ReactSelect
                    className="react-select-container"
                    classNamePrefix="react-select"
                    placeholder="Selecione a conta"
                    value={formData.contaRecebimento ? {
                      value: formData.contaRecebimento,
                      label: (() => {
                        const isApi = formData.contaRecebimento.startsWith('api:');
                        const isErp = formData.contaRecebimento.startsWith('erp:');
                        if (isErp) {
                          const contaId = parseInt(formData.contaRecebimento.split(':')[1]);
                          const conta = contas.find(c => c.id === contaId);
                          return conta ? `${conta.banco} — ${conta.descricao_banco}` : formData.contaRecebimento;
                        } else if (isApi) {
                          const contaId = parseInt(formData.contaRecebimento.split(':')[1]);
                          const conta = contasApi.find(c => c.id === contaId);
                          return conta ? conta.descricao_banco : formData.contaRecebimento;
                        }
                        return formData.contaRecebimento;
                      })()
                    } : null}
                    onChange={(selected) => handleInputChange("contaRecebimento", selected ? selected.value : "")}
                    options={[
                      // Contas ERP
                      ...contas
                        .filter((conta) => Boolean(conta.descricao_banco && String(conta.descricao_banco).trim()))
                        .map((conta) => ({
                          value: `erp:${conta.id}`,
                          label: `${conta.banco} — ${conta.descricao_banco}`
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
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    menuPosition="fixed"
                    styles={{
                      menuPortal: (base) => ({ ...base, zIndex: 9999 })
                    }}
                  />
                </div>
              </div>
            </div>



              {/* Tabs - Observações e Anexo */}
              <div className={styles.novaReceitaSection}>
                <div className={cn(styles.tabsComponentNative, styles.novaReceitaTabs)}>
                  <div className={cn(styles.tabsListComponentNative, styles.novaReceitaTabsList)}>
                    <button
                      type="button"
                      onClick={() => setActiveTab("observacoes")}
                      className={cn(
                        styles.tabsTriggerComponentNative,
                        styles.novaReceitaTabsTrigger,
                        activeTab === "observacoes" && styles.tabsTriggerActive
                      )}
                    >
                      Observações
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("anexo")}
                      className={cn(
                        styles.tabsTriggerComponentNative,
                        styles.novaReceitaTabsTrigger,
                        activeTab === "anexo" && styles.tabsTriggerActive
                      )}
                    >
                      Anexo
                    </button>
                  </div>
                  {activeTab === "observacoes" && (
                    <div className={cn(styles.tabsContentComponentNative, styles.novaReceitaTabsContent)}>
                      <div className={styles.novaReceitaField}>
                        <label htmlFor="observacoes" className={cn(styles.labelComponent, styles.novaReceitaLabel)}>Observações</label>
                        <textarea
                          id="observacoes"
                          value={formData.observacoes}
                          onChange={(e) =>
                            handleInputChange("observacoes", e.target.value)
                          }
                          placeholder="Descreva observações relevantes sobre esse lançamento financeiro"
                          className={cn(styles.textareaComponent, styles.novaReceitaTextarea)}
                        />
                      </div>
                    </div>
                  )}
                  {activeTab === "anexo" && (
                    <div className={cn(styles.tabsContentComponentNative, styles.novaReceitaTabsContent)}>
                      <div className={styles.novaReceitaField}>
                        {/* Upload de PDF */}
                        <div className={styles.novaReceitaPdfSection}>
                          <label htmlFor="fileInput" className="cursor-pointer">
                            <div className="space-y-2">
                              <FileText className={styles.novaReceitaPdfIcon} />
                              <p className={styles.novaReceitaPdfTitle}>
                                Clique para selecionar arquivo PDF
                              </p>
                              <p className={styles.novaReceitaPdfSubtitle}>
                                Anexe documentos relacionados ao lançamento
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
                          <div className={styles.novaReceitaPdfSuccess}>
                            <div className={styles.novaReceitaPdfSuccessText}>
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="font-medium">PDF anexado com sucesso!</span>
                            </div>
                            <p className={styles.novaReceitaPdfSuccessSubtext}>
                              O arquivo foi anexado ao lançamento
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </div>

          {/* Footer */}
          <div className={styles.novaReceitaFooter}>
            <button 
              type="button"
              onClick={handleClose} 
              className={cn(styles.buttonComponent, styles.buttonSecondary, styles.novaReceitaButtonSecondary)}
            >
              Voltar
            </button>
            <div className={styles.novaReceitaFooterActions}>
              <button
                type="button"
                onClick={handleSave}
                className={cn(styles.buttonComponent, styles.buttonPrimary, styles.novaReceitaButtonPrimary)}
              >
                Salvar
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
    </>
  );
}
