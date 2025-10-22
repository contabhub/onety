"use client";

import { useState, useEffect } from "react";
import styles from "../../styles/financeiro/nova-receita.module.css";
import { Button } from './botao';
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
import { Input } from "./input";
import { Label } from "./label";
import { Textarea } from "./textarea";
import { Switch } from "./switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Calendar } from "./calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
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
    } else {
      // Reabilita o scroll da página principal
      document.body.style.overflow = 'unset';
    }

    // Cleanup: reabilita o scroll quando o componente for desmontado
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const empresaId = localStorage.getItem("empresaId");
    const token = localStorage.getItem("token");

    if (!empresaId || !token) return;

    const fetchClientes = async () => {
      try {
        const res = await fetch(`${API}/clientes/company/${empresaId}`, {
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
        // Buscar categorias principais de receita
        const res = await fetch(`${API}/companies/${empresaId}/categorias`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();

        // Filtrar apenas categorias de receita
        const receitaData = data.find((item) => item.tipo === "Receita");
        const categoriasReceita = receitaData?.categorias || [];
        setCategorias(categoriasReceita);
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

  // Função para buscar as 5 últimas recorrências da empresa atual
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
      status: "ativo",
      company_id: parseInt(empresaId),
    };
    
    console.log("📦 Payload para criar recorrência:", payload);
    
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
      const errorData = await res.json();
      console.error("❌ Erro ao criar recorrência:", errorData);
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
      // Verificar se a categoria pai é de receita
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

  // Função principal para criar transação
  const createTransaction = async () => {
    const token = localStorage.getItem("token");
    const empresaId = localStorage.getItem("empresaId");

    if (!token || !empresaId) {
      toast.error("Token ou empresaId não encontrados.");
      return;
    }

    // Validação de campos obrigatórios
    if (!formData.descricao) {
      console.log("🔔 Exibindo toast: Descrição é obrigatória!");
      toast("Descrição é obrigatória!", { type: "error" });
      return;
    }

    if (!formData.valor) {
      console.log("🔔 Exibindo toast: Valor é obrigatório!");
      toast("Valor é obrigatório!", { type: "error" });
      return;
    }

    if (!formData.categoria) {
      console.log("🔔 Exibindo toast: Categoria é obrigatória!");
      toast("Categoria é obrigatória!", { type: "error" });
      return;
    }

    if (!formData.contaRecebimento) {
      console.log("🔔 Exibindo toast: Conta de recebimento é obrigatória!");
      toast("Conta de recebimento é obrigatória!", { type: "error" });
      return;
    }

    if (!formData.cliente) {
      console.log("🔔 Exibindo toast: Cliente é obrigatório!");
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
          company_id: parseInt(empresaId),
          tipo: "entrada",
          valor: valorPorParcela,
          descricao: formData.descricao,
          data_transacao:
            formData.recebido && formData.dataRecebimento
              ? formData.dataRecebimento.toISOString().split("T")[0]
              : null,
          origem: formData.formaPagamento,
          data_vencimento: formData.vencimento.toISOString().split("T")[0],
          situacao: formData.recebido ? "recebido" : "em_aberto",
          observacoes: formData.observacoes || null,
          parcelamento: parseInt(parcelamento.replace("x", "")),
          intervalo_parcelas: 30,
          categoria_id: itemSelecionado.isSubcategoria
            ? itemSelecionado.categoria_id
            : itemSelecionado.id,
          sub_categoria_id: itemSelecionado.isSubcategoria
            ? itemSelecionado.id
            : null,
          cliente_id: formData.cliente ? parseInt(formData.cliente) : null,
          anexo_base64: formData.anexo_base64 || null,
          centro_de_custo_id: formData.centroCusto
            ? parseInt(formData.centroCusto)
            : null,
          boleto_id: boletoId, // Sempre null, pois não há criação automática de boleto
          frequencia: "mensal",
          total_parcelas: parseInt(parcelamento.replace("x", "")),
          indeterminada: false,
          intervalo_personalizado: 1,
          tipo_intervalo: "meses",
          status: "ativo",
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

        console.log("🔄 Usando configuração de recorrência existente:", recorrencia.id);
        
        // Criar recorrência usando configuração existente (com flag para não duplicar na lista)
        const recorrenciaPayload = {
          conta_id: contaIdParsed,
          conta_api_id: contaApiIdParsed || null,
          company_id: parseInt(empresaId),
          tipo: "entrada",
          valor: valorPorParcela,
          descricao: formData.descricao,
          data_transacao:
            formData.recebido && formData.dataRecebimento
              ? formData.dataRecebimento.toISOString().split("T")[0]
              : null,
          origem: formData.formaPagamento,
          data_vencimento: formData.vencimento.toISOString().split("T")[0],
          situacao: formData.recebido ? "recebido" : "em_aberto",
          observacoes: formData.observacoes || null,
          parcelamento: 1,
          intervalo_parcelas: 30,
          categoria_id: itemSelecionado.isSubcategoria
            ? itemSelecionado.categoria_id
            : itemSelecionado.id,
          sub_categoria_id: itemSelecionado.isSubcategoria
            ? itemSelecionado.id
            : null,
          cliente_id: formData.cliente ? parseInt(formData.cliente) : null,
          anexo_base64: formData.anexo_base64 || null,
          centro_de_custo_id: formData.centroCusto
            ? parseInt(formData.centroCusto)
            : null,
          boleto_id: boletoId, // Sempre null, pois não há criação automática de boleto
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
        conta_api_id: contaApiIdParsed || null,
        company_id: parseInt(empresaId),
        tipo: "entrada",
        valor: valorPorParcela,
        descricao: formData.descricao,
        data_transacao:
          formData.recebido && formData.dataRecebimento
            ? formData.dataRecebimento.toISOString().split("T")[0]
            : null,
        origem: formData.formaPagamento,
        data_vencimento: formData.vencimento.toISOString().split("T")[0],
        situacao: formData.recebido ? "recebido" : "em_aberto",
        observacoes: formData.observacoes || null,
        parcelamento: 1,
        intervalo_parcelas: 30,
        categoria_id: itemSelecionado.isSubcategoria
          ? itemSelecionado.categoria_id
          : itemSelecionado.id,
        sub_categoria_id: itemSelecionado.isSubcategoria
          ? itemSelecionado.id
          : null,
        cliente_id: formData.cliente ? parseInt(formData.cliente) : null,
        anexo_base64: formData.anexo_base64 || null,
        centro_de_custo_id: formData.centroCusto
          ? parseInt(formData.centroCusto)
          : null,
        boleto_id: boletoId // Sempre null, pois não há criação automática de boleto
      };

      // 3️⃣ Cria a transação no backend
      const resTransacao = await fetch(`${API}/transacoes`, {
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

  const handleSave = async () => {
    await createTransaction();
  };

  // Função para buscar clientes (será reutilizada após criar novo cliente)
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
      setFormData((prev) => ({
        ...prev,
        cliente: data.id.toString(),
      }));

      // Aguardar um pouco para garantir que o estado foi atualizado
      setTimeout(() => {
        console.log("Estado atualizado, cliente selecionado:", data.id);
      }, 100);
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
    }, 400); // Duração da animação de fechamento
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
          isClosing && "closing"
        )}
        onClick={handleOverlayClick}
      >
        <div
          className={cn(
            styles.novaReceitaModal,
            isClosing && "closing"
          )}
        >
          {/* Handle para indicar que pode ser arrastado */}
          <div className={styles.novaReceitaHandle}></div>
          
          {/* Header */}
          <div className={styles.novaReceitaHeader}>
            <h2 className={styles.novaReceitaTitle}>Nova receita</h2>
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
                  <Label htmlFor="cliente" className={styles.novaReceitaLabel}>Cliente/Fornecedor <span className={styles.novaReceitaLabelRequired}>*</span></Label>
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
                      className={styles.novaReceitaAddButton}
                      title="Adicionar novo cliente"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Descrição */}
                <div>
                  <Label htmlFor="descricao" className={styles.novaReceitaLabel}>Descrição <span className={styles.novaReceitaLabelRequired}>*</span></Label>
                  <input
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) =>
                      handleInputChange("descricao", e.target.value)
                    }
                    placeholder="Digite a descrição"
                    className={styles.novaReceitaInput}
                  />
                </div>
              </div>

              {/* Resto dos campos em grid 2x2 */}
              <div className={cn(styles.novaReceitaGrid, "grid-cols-2")}>

                {/* Subcategoria Receita */}
                <div className={styles.novaReceitaField}>
                  <div className="flex items-center gap-2">
                    <Label className={styles.novaReceitaLabel}>Subcategoria Receita <span className={styles.novaReceitaLabelRequired}>*</span></Label>
                    <Info className="h-4 w-4" style={{ color: 'var(--onity-color-text)', opacity: 0.7 }} />
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
                          id: item.id,
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
                      id: item.id,
                    }))}
                    isClearable
                  />
                </div>

                {/* Centro de Custo */}
                <div className={styles.novaReceitaField}>
                  <div className="flex items-center gap-2">
                    <Label className={styles.novaReceitaLabel}>Centro de Custo</Label>
                    <Info className="h-4 w-4 invisible" />
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
                  />
                </div>

                {/* Repetir lançamento */}
                <div className={styles.novaReceitaField}>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="repetirLancamento" className={styles.novaReceitaLabel}>Repetir lançamento?</Label>
                    <Switch
                      id="repetirLancamento"
                      checked={repetirLancamento}
                      onCheckedChange={setRepetirLancamento}
                    />
                  </div>
                </div>

                {/* Valor */}
                <div className={styles.novaReceitaField}>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="valor" className={styles.novaReceitaLabel}>Valor <span className={styles.novaReceitaLabelRequired}>*</span></Label>
                    <span className="w-4" />{" "}
                    {/* Placeholder para alinhamento */}
                  </div>
                  <div className={styles.novaReceitaInputWithIcon}>
                    <span className={styles.novaReceitaInputIcon}>
                      R$
                    </span>
                    <input
                      id="valor"
                      value={formData.valor}
                      onChange={(e) =>
                        handleInputChange("valor", e.target.value)
                      }
                      placeholder="0,00"
                      className={styles.novaReceitaInput}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Configuração de recorrência */}
            {repetirLancamento && (
              <div className={styles.novaReceitaRecurrenceConfig}>
                <Label className={styles.novaReceitaRecurrenceLabel}>Configurações de repetição *</Label>
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
                        className="theme-select-item"
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
                      </SelectItem>
                    ))
                  ) : (
                    <div className="theme-text-secondary px-2 py-1">Nenhuma recorrência personalizada encontrada</div>
                  )}
                    <SelectItem value="personalizar" className="theme-select-item">
                      ➕ Criar nova recorrência personalizada...
                    </SelectItem>
                </SelectContent>
              </Select>
            </div>
            )}

            {/* Condição de Pagamento */}
            <div className={styles.novaReceitaSection}>
              <h3 className={styles.novaReceitaSectionTitle}>
                Condição de pagamento
              </h3>
              
              <div className={cn(styles.novaReceitaGrid, "grid-cols-2")}>
                {/* Parcelamento */}
                <div className={styles.novaReceitaField}>
                  <Label className={styles.novaReceitaLabel}>Parcelamento</Label>
                  <Select
                    value={parcelamento}
                    onValueChange={setParcelamento}
                  >
                    <SelectTrigger className="theme-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="theme-modal theme-border-secondary">
                      <SelectItem value="A vista" className="theme-select-item">À vista</SelectItem>
                      {Array.from({ length: 59 }, (_, i) => (
                        <SelectItem key={i + 2} value={`${i + 2}x`} className="theme-select-item">{`${i + 2}x`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {parcelamento !== "A vista" && valorParcela && (
                    <div className="text-sm mt-1" style={{ color: 'var(--onity-color-text)', opacity: 0.7 }}>
                      Valor de cada parcela: <span className="font-semibold" style={{ color: 'var(--onity-color-text)' }}>{valorParcela}</span>
                    </div>
                  )}
                </div>

                {/* Data de Vencimento */}
                <div className={styles.novaReceitaField}>
                  <Label className={styles.novaReceitaLabel}>Data de vencimento <span className={styles.novaReceitaLabelRequired}>*</span></Label>
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

                {/* Forma de pagamento */}
                <div className={styles.novaReceitaField}>
                  <Label className={styles.novaReceitaLabel}>Forma de pagamento</Label>
                  <Select
                    value={formData.formaPagamento}
                    onValueChange={(value) =>
                      handleInputChange("formaPagamento", value)
                    }
                  >
                    <SelectTrigger className="theme-input">
                      <SelectValue placeholder="Selecione a forma" />
                    </SelectTrigger>
                    <SelectContent className="theme-modal theme-border-secondary">
                      <SelectItem value="dinheiro" className="theme-select-item">Dinheiro</SelectItem>
                      <SelectItem value="cartao" className="theme-select-item">Cartão</SelectItem>
                      <SelectItem value="transferencia" className="theme-select-item">
                        Transferência
                      </SelectItem>
                      <SelectItem value="pix" className="theme-select-item">PIX</SelectItem>
                      <SelectItem value="boleto" className="theme-select-item">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Conta de recebimento */}
                <div className={styles.novaReceitaField}>
                  <Label className={styles.novaReceitaLabel}>Conta de recebimento <span className={styles.novaReceitaLabelRequired}>*</span></Label>
                  <div className="flex items-center gap-2">
                 <Select
                    value={formData.contaRecebimento}
                    onValueChange={(value) =>
                      handleInputChange("contaRecebimento", value)
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
                          className="theme-select-item flex justify-between items-center"
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
                          className="theme-select-item flex justify-between items-center"
                        >
                          <span>{conta.descricao_banco}</span>
                          <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ 
                            backgroundColor: 'var(--onity-color-info)', 
                            color: 'white', 
                            border: '1px solid var(--onity-color-info)',
                            fontSize: '10px',
                            fontWeight: '500'
                          }}>OpenFinance</span>
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
                    <div className={styles.novaReceitaStatusIndicator}>
                      <div className={cn(styles.novaReceitaStatusDot, styles.novaReceitaStatusDotPrimary)}></div>
                      <div className={cn(styles.novaReceitaStatusDot, styles.novaReceitaStatusDotWarning)}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>



              {/* Tabs - Observações e Anexo */}
              <div className={styles.novaReceitaSection}>
                <Tabs defaultValue="observacoes" className={styles.novaReceitaTabs}>
                  <TabsList className={styles.novaReceitaTabsList}>
                    <TabsTrigger value="observacoes" className={styles.novaReceitaTabsTrigger}>Observações</TabsTrigger>
                    <TabsTrigger value="anexo" className={styles.novaReceitaTabsTrigger}>Anexo</TabsTrigger>
                  </TabsList>
                  <TabsContent value="observacoes" className={styles.novaReceitaTabsContent}>
                    <div className={styles.novaReceitaField}>
                      <Label htmlFor="observacoes" className={styles.novaReceitaLabel}>Observações</Label>
                      <textarea
                        id="observacoes"
                        value={formData.observacoes}
                        onChange={(e) =>
                          handleInputChange("observacoes", e.target.value)
                        }
                        placeholder="Descreva observações relevantes sobre esse lançamento financeiro"
                        className={styles.novaReceitaTextarea}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="anexo" className={styles.novaReceitaTabsContent}>
                    <div className={styles.novaReceitaField}>
                      {/* Upload de PDF */}
                      <div className={styles.novaReceitaPdfSection}>
                        <Label htmlFor="fileInput" className="cursor-pointer">
                          <div className="space-y-2">
                            <FileText className={styles.novaReceitaPdfIcon} />
                            <p className={styles.novaReceitaPdfTitle}>
                              Clique para selecionar arquivo PDF
                            </p>
                            <p className={styles.novaReceitaPdfSubtitle}>
                              Anexe documentos relacionados ao lançamento
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
                  </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Footer */}
          <div className={styles.novaReceitaFooter}>
            <button onClick={onClose} className={cn(styles.novaReceitaButton, styles.novaReceitaButtonSecondary)}>
              Voltar
            </button>
            <div className={styles.novaReceitaFooterActions}>
              <button
                onClick={handleSave}
                className={cn(styles.novaReceitaButton, styles.novaReceitaButtonPrimary)}
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
  )
}
