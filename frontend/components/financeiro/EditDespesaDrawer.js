import { useState, useEffect } from "react";
import styles from "../../styles/financeiro/edit-despesa.module.css";
// Componentes externos removidos - usando HTML nativo
import { X, Calendar as CalendarIcon, ChevronDown, Info, FileText, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import ReactSelect from "react-select";
import { PDFViewer } from "./pdf-viewer";

// Função cn para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');


export function EditDespesaDrawer({
  isOpen,
  onClose,
  onSave,
  transacaoId,
}) {
  const [formData, setFormData] = useState({
    fornecedor: "",
    dataCompetencia: new Date(),
    descricao: "",
    valor: "",
    habilitarRateio: false,
    categoria: "",
    centroCusto: "",
    codigoReferencia: "",
    observacoes: "",
    dataVencimento: "",
    conta: "",
    valorPago: "",
    valorEmAberto: "",
    situacao: "",
    contaPagamento: "",
    origem: "",
    anexo: null,
  });

  const [parcelas, setParcelas] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [isSupplierSelectOpen, setIsSupplierSelectOpen] = useState(false);
  const [isAccountSelectOpen, setIsAccountSelectOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("observacoes");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [subCategorias, setSubCategorias] = useState([]);
  const [contas, setContas] = useState([]);
  const [contasApi, setContasApi] = useState([]);
  const [temCliente, setTemCliente] = useState(false);
  const [centrosDeCusto, setCentrosDeCusto] = useState([]);
  const [isClosing, setIsClosing] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL;

  // Função para carregar clientes
  const fetchClientes = async () => {
    try {
      const token = localStorage.getItem("token");
      const empresaId = localStorage.getItem("empresaId");

      const res = await fetch(`${API}/clientes/company/${empresaId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Erro ao buscar clientes");

      const data = await res.json();
      setClientes(data);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
    }
  };

  // Função para carregar contas
  const fetchContas = async () => {
    try {
      const token = localStorage.getItem("token");
      const empresaId = localStorage.getItem("empresaId");

      const res = await fetch(`${API}/contas/empresa/${empresaId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Erro ao buscar contas");

      const data = await res.json();
      setContas(data);
    } catch (error) {
      console.error("Erro ao carregar contas:", error);
    }
  };

  // Função para carregar categorias
  const fetchCategorias = async () => {
    try {
      const token = localStorage.getItem("token");
      const empresaId = localStorage.getItem("empresaId");

      const res = await fetch(`${API}/companies/${empresaId}/categorias`, {
        headers: { Authorization: `Bearer ${token}` },
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

  // Função para carregar subcategorias
  const fetchSubCategorias = async () => {
    try {
      const token = localStorage.getItem("token");
      const empresaId = localStorage.getItem("empresaId");

      const res = await fetch(`${API}/sub-categorias/empresa/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSubCategorias(data);
    } catch (error) {
      console.error("Erro ao buscar subcategorias:", error);
    }
  };

  const fetchCentrosDeCusto = async () => {
    try {
      const token = localStorage.getItem("token");
      const empresaId = localStorage.getItem("empresaId");

      const res = await fetch(`${API}/centro-de-custo/empresa/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      setCentrosDeCusto(data);
    } catch (error) {
      console.error("Erro ao buscar centros de custo:", error);
    }
  };

  const fetchContasApi = async () => {
    try {
      const token = localStorage.getItem("token");
      const empresaId = localStorage.getItem("empresaId");
      const res = await fetch(`${API}/contas-api/company/${empresaId}/contas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const lista = Array.isArray(json) ? json : Array.isArray(json.contas) ? json.contas : [];
      setContasApi(lista);
    } catch (error) {
      console.error("Erro ao buscar contas API:", error);
    }
  };

  // Função para criar lista apenas de subcategorias de despesa
  const getSubCategoriasDespesa = () => {
    const items = [];

    console.log("🔍 EditDespesa - subCategorias:", subCategorias.length);
    console.log("🔍 EditDespesa - categorias:", categorias.length);

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
    const sortedItems = items.sort((a, b) => {
      // Primeiro ordena por categoria pai
      const categoriaCompare = (a.categoria_pai_nome || '').localeCompare(b.categoria_pai_nome || '');
      if (categoriaCompare !== 0) return categoriaCompare;
      
      // Se a categoria pai for igual, ordena por nome da subcategoria
      return a.nome.localeCompare(b.nome);
    });

    console.log("🔍 EditDespesa - subcategorias filtradas:", sortedItems.length);
    return sortedItems;
  };

  // Função para obter o nome da conta baseado no valor armazenado
  // Se for ERP, usamos contas. Se não existir, tenta contasApi
  const getNomeConta = (contaValor) => {
    if (!contaValor) return "";
    let id = contaValor;
    if (contaValor.includes(':')) id = contaValor.split(':')[1];

    const contaErp = contas.find(c => c.id.toString() === id);
    if (contaErp) return `${contaErp.banco} — ${contaErp.descricao_banco}`;

    const contaApi = contasApi.find(c => c.id.toString() === id);
    if (contaApi) return contaApi.descricao_banco || contaApi.banco || contaApi.institution_name || contaApi.name || "Conta";

    return "Conta";
  };

  const loadTransacao = async () => {
    if (!transacaoId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/transacoes/${transacaoId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Erro ao buscar transação.");
      const data = await res.json();
      console.log("Parcelas recebidas:", data.parcelas);

      // Verificar se há cliente na transação
      const hasCliente = !!data.cliente_id;
      setTemCliente(hasCliente);

      // Determinar qual categoria/subcategoria selecionar
      let categoriaSelecionada = "";
      if (data.sub_categoria_id) {
        categoriaSelecionada = data.sub_categoria_id.toString();
      } else if (data.categoria_id) {
        categoriaSelecionada = data.categoria_id.toString();
      }

      setFormData({
        fornecedor: data.cliente_id?.toString() || "",
        contaPagamento: data.conta_id
          ? `erp:${data.conta_id}`
          : (data.conta_api_id ? `api:${data.conta_api_id}` : ""),
        dataCompetencia: data.data_transacao
          ? new Date(data.data_transacao)
          : new Date(),
        descricao: data.descricao || "",
        valor: data.valor ? data.valor.toString() : "",
        habilitarRateio: data.habilitar_rateio || false,
        categoria: categoriaSelecionada,
        codigoReferencia: data.codigo_referencia || "",
        observacoes: data.observacoes || "",
        dataVencimento: data.data_vencimento || "",
        conta: data.conta || "",
        valorPago: data.pago ? data.pago.toString() : "",
        valorEmAberto: data.em_aberto ? data.em_aberto.toString() : "",
        situacao: data.situacao || "",
        origem: data.origem || "",
        anexo: data.anexo_base64 || null,
        centroCusto: data.centro_de_custo_id?.toString() || "",
      });

      if (data.parcelas && Array.isArray(data.parcelas)) {
        setParcelas(
          data.parcelas.map((p) => ({
            data: p.data ? new Date(p.data).toLocaleDateString() : "",
            parcela: p.parcela || "",
            conta: p.conta || "",
            valorRS: p.valor
              ? Number(p.valor).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })
              : "",
            pagoRS: p.pago
              ? Number(p.pago).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })
              : "",
            emAbertoRS: p.em_aberto
              ? Number(p.em_aberto).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })
              : "",
            situacao:
              p.situacao === "recebido" || p.situacao === "Pago"
                ? "Pago"
                : "Em Aberto",
          }))
        );
      } else {
        setParcelas([]);
      }

      // ✅ Toast de sucesso
      // toast.success('Lançamento carregado com sucesso!');
    } catch (error) {
      console.error("Erro ao carregar transação:", error);
      // ❌ Toast de erro
      toast.error(
        "Erro ao carregar lançamento. Verifique sua conexão ou tente novamente."
      );
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados da transação quando o drawer abrir
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false); // Reset do estado de fechamento
      fetchClientes();
      fetchContas();
      fetchContasApi();
      fetchCategorias();
      fetchSubCategorias();
      fetchCentrosDeCusto();
      if (transacaoId) {
        loadTransacao();
      }
    }
  }, [isOpen, transacaoId]);

  // Efeito para fechar selects quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.selectComponent')) {
        setIsSupplierSelectOpen(false);
        setIsAccountSelectOpen(false);
      }
      if (!event.target.closest('.popoverContainer')) {
        setShowCalendar(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const formatDateTime = (date) => {
    if (!date) return null;
    const d = new Date(date);
    return format(d, "yyyy-MM-dd HH:mm:ss");
  };

  const handleSave = async () => {
    if (!transacaoId) return;

    try {
      const token = localStorage.getItem("token");
      const empresaId = localStorage.getItem("empresaId");

      // console.log('[handleSave] formData.contaPagamento:', formData.contaPagamento);
      // console.log('[handleSave] empresaId:', empresaId);

      // Encontrar o item selecionado (subcategoria de despesa)
      const subCategoriasDespesa = getSubCategoriasDespesa();
      const itemSelecionado = subCategoriasDespesa.find(
        (item) => item.id.toString() === formData.categoria
      );

      // Monta conta_id/conta_api_id conforme valor
      let contaIdParsed = null;
      let contaApiIdParsed = null;
      if (formData.contaPagamento) {
        if (formData.contaPagamento.startsWith('api:')) {
          contaApiIdParsed = parseInt(formData.contaPagamento.split(':')[1]);
        } else if (formData.contaPagamento.startsWith('erp:')) {
          contaIdParsed = parseInt(formData.contaPagamento.split(':')[1]);
        } else if (!isNaN(Number(formData.contaPagamento))) {
          contaIdParsed = Number(formData.contaPagamento);
        }
      }

      const requestBody = {
        cliente_id: formData.fornecedor || null,
        conta_id: contaIdParsed,
        conta_api_id: contaApiIdParsed || null,
        company_id: empresaId ? Number(empresaId) : null,
        tipo: "saida",
        situacao: formData.situacao || "em_aberto",
        data_transacao: formatDateTime(formData.dataCompetencia),
        data_vencimento: formatDateTime(formData.dataVencimento),
        descricao: formData.descricao,
        valor: parseFloat(formData.valor) || 0,
        categoria_id: itemSelecionado?.isSubcategoria
          ? itemSelecionado.categoria_id
          : itemSelecionado?.id || null,
        sub_categoria_id: itemSelecionado?.isSubcategoria
          ? itemSelecionado.id
          : null,
        origem: formData.origem || "",
        observacoes: formData.observacoes || "",
        parcelemento: formData.habilitarRateio || false,
        intervalo_parcelas: null, // Adicionar se necessário
        anexo_base64: formData.anexo || null,
        centro_de_custo_id: formData.centroCusto
          ? Number(formData.centroCusto)
          : null,
      };

      console.log("[handleSave] Request body:", requestBody);

      const res = await fetch(`${API}/transacoes/${transacaoId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) throw new Error("Erro ao atualizar transação");

      const data = await res.json();

      // Verificar se o valor foi extraído do PDF
      if (data.valor_extraido_pdf) {
        console.log("💰 Valor extraído do PDF:", data.valor_original, "→", data.valor_novo);
        toast.success(`Transação atualizada com sucesso! Valor extraído do PDF: R$ ${data.valor_original} → R$ ${data.valor_novo}`);
      } else {
        toast.success("Transação atualizada com sucesso!");
      }

      onSave(data);
      onClose();
    } catch (error) {
      console.error("Erro ao salvar transação:", error);
      toast.error(
        "Erro ao atualizar transação. Verifique os dados e tente novamente."
      ); // ❌ Toast de erro
    }
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
        anexo: base64Data 
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

  const handleDateSelect = (day) => {
    const selectedDate = new Date(currentYear, currentMonth, day);
    handleInputChange("dataCompetencia", selectedDate);
    setShowCalendar(false);
  };

  if (!isOpen) return null;

  const subCategoriasDespesa = getSubCategoriasDespesa();

  return (
    <div className={cn(
      styles.editDespesaOverlay,
      "fixed inset-0 z-50 bg-black/50",
      isClosing && "closing"
    )}>
      <div
        className={cn(
          styles.editDespesaModal,
          "fixed inset-0 theme-bg-primary shadow-xl overflow-hidden flex flex-col",
          isClosing && "closing"
        )}
      >
        {/* Header */}
        <div className={cn(styles.editDespesaHeader, "flex items-center justify-between px-6 py-3 theme-border-primary border-b theme-bg-primary sticky top-0 z-10")}>
          <h2 className={cn(styles.editDespesaTitle, "text-xl font-semibold theme-text-white")}>
            Editar lançamento
          </h2>
          <button
            onClick={handleClose}
            className={cn(styles.buttonComponent, styles.buttonGhost, styles.buttonSmall, "theme-text-white hover:theme-text-secondary")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="h-full px-6 py-4 space-y-4">
            {loading ? (
              <div className={cn(styles.editDespesaLoading, "flex items-center justify-center py-8")}>
                <div className="theme-text-secondary">Carregando...</div>
              </div>
            ) : (
              <>
                {/* Informações do lançamento */}
                <div>
                  <h3 className={cn(styles.editDespesaSectionTitle, "text-lg font-medium theme-text-white mb-4")}>
                    Informações do lançamento
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Cliente */}
                    <div className="space-y-2">
                      <label htmlFor="fornecedor" className={cn(styles.labelComponent, "theme-text-white")}>Fornecedor</label>
                      <div className={styles.selectComponent}>
                        <button
                          type="button"
                          onClick={() => !temCliente && setIsSupplierSelectOpen(!isSupplierSelectOpen)}
                          disabled={temCliente}
                          className={cn(
                            styles.selectTriggerComponent,
                            "theme-bg-modal theme-border-primary theme-text-white",
                            temCliente ? "theme-bg-modal/50" : ""
                          )}
                        >
                          <span className={formData.fornecedor ? styles.selectValue : styles.selectPlaceholder}>
                            {formData.fornecedor
                              ? clientes.find(c => c.id.toString() === formData.fornecedor)?.nome_fantasia || "Cliente não encontrado"
                              : "Selecione o cliente"}
                          </span>
                          <ChevronDown className={cn(styles.selectIcon, isSupplierSelectOpen && styles.selectIconOpen)} />
                        </button>
                        {isSupplierSelectOpen && !temCliente && (
                          <div className={cn(styles.selectContentComponent, "theme-bg-modal theme-border-primary")}>
                            {clientes.length > 0 ? (
                              clientes.map((cliente) => (
                                <button
                                  key={cliente.id}
                                  type="button"
                                  onClick={() => {
                                    handleInputChange("fornecedor", cliente.id.toString());
                                    setIsSupplierSelectOpen(false);
                                  }}
                                  className={cn(styles.selectItemComponent, "theme-text-white hover:theme-bg-secondary")}
                                >
                                  {cliente.nome_fantasia}
                                </button>
                              ))
                            ) : (
                              <div className="theme-text-secondary px-2 py-1">
                                Nenhum cliente encontrado
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {temCliente && (
                        <p className="text-xs theme-text-secondary">
                          Cliente não pode ser alterado quando já existe na
                          transação
                        </p>
                      )}
                    </div>

                    {/* Data de competência */}
                    <div className="space-y-2">
                      <label className={cn(styles.labelComponent, "theme-text-white")}>Data de vencimento <span className="text-[#F50057]">*</span></label>
                      <div className={styles.popoverContainer}>
                        <button
                          type="button"
                          onClick={() => !temCliente && setShowCalendar(!showCalendar)}
                          disabled={temCliente}
                          className={cn(
                            styles.buttonComponent,
                            styles.buttonOutline,
                            "w-full justify-start text-left font-normal theme-bg-modal theme-border-primary theme-text-white hover:theme-bg-secondary hover:theme-text-white",
                            !formData.dataCompetencia && "theme-text-secondary",
                            temCliente && "theme-bg-modal/50"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.dataCompetencia
                            ? format(formData.dataCompetencia, "dd/MM/yyyy", {
                                locale: ptBR,
                              })
                            : "Selecione a data"}
                        </button>
                        {showCalendar && !temCliente && (
                          <>
                            <div className={styles.popoverOverlay} onClick={() => setShowCalendar(false)} />
                            <div className={cn(styles.popoverContent, "theme-bg-modal theme-border-primary edit-despesa-popover")}>
                              <div className={cn(styles.calendarComponent, "theme-bg-modal theme-text-white")}>
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
                                    const isSelected = isSameDay(date, formData.dataCompetencia);
                                    const isTodayDate = isToday(date);
                                    return (
                                      <button
                                        key={day}
                                        type="button"
                                        onClick={() => handleDateSelect(day)}
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
                          </>
                        )}
                      </div>
                      {temCliente && (
                        <p className="text-xs theme-text-secondary">
                          Data não pode ser alterada quando há cliente na
                          transação
                        </p>
                      )}
                    </div>

                    {/* Descrição */}
                    <div className="space-y-2">
                      <label htmlFor="descricao" className={cn(styles.labelComponent, "theme-text-white")}>Descrição <span className="text-[#F50057]">*</span></label>
                      <input
                        id="descricao"
                        type="text"
                        value={formData.descricao}
                        onChange={(e) =>
                          handleInputChange("descricao", e.target.value)
                        }
                        placeholder="Digite a descrição"
                        className={cn(styles.inputComponent, "theme-bg-modal theme-border-primary theme-text-white placeholder:theme-text-secondary")}
                      />
                    </div>

                    {/* Valor */}
                    <div className="space-y-2">
                      <label htmlFor="valor" className={cn(styles.labelComponent, "theme-text-white")}>Valor <span className="text-[#F50057]">*</span></label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 theme-text-secondary">
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
                          disabled={temCliente}
                          className={cn(
                            styles.inputComponent,
                            "pl-10 theme-bg-modal theme-border-primary theme-text-white placeholder:theme-text-secondary",
                            temCliente && styles.inputDisabled
                          )}
                        />
                      </div>
                      {temCliente && (
                        <p className="text-xs theme-text-secondary">
                          Valor não pode ser alterado quando há cliente na
                          transação
                        </p>
                      )}
                    </div>

                    {/* Linha Conta de pagamento, Categoria, Centro de Custo */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className={cn(styles.labelComponent, "theme-text-white")}>Conta de pagamento</label>
                        <Info className="h-4 w-4 invisible" />
                      </div>
                      <div className={styles.selectComponent}>
                        <button
                          type="button"
                          onClick={() => setIsAccountSelectOpen(!isAccountSelectOpen)}
                          className={cn(styles.selectTriggerComponent, "w-full h-10 theme-bg-modal theme-border-primary theme-text-white")}
                        >
                          <span className={formData.contaPagamento ? styles.selectValue : styles.selectPlaceholder}>
                            {formData.contaPagamento
                              ? getNomeConta(formData.contaPagamento)
                              : "Selecione a conta"}
                          </span>
                          <ChevronDown className={cn(styles.selectIcon, isAccountSelectOpen && styles.selectIconOpen)} />
                        </button>
                        {isAccountSelectOpen && (
                          <div className={cn(styles.selectContentComponent, "theme-bg-modal theme-border-primary")}>
                            {/* Contas ERP */}
                            {contas
                              .filter((c) => Boolean(c.descricao_banco && String(c.descricao_banco).trim()))
                              .map((conta) => (
                                <button
                                  key={`erp-${conta.id}`}
                                  type="button"
                                  onClick={() => {
                                    handleInputChange("contaPagamento", `erp:${conta.id}`);
                                    setIsAccountSelectOpen(false);
                                  }}
                                  className={cn(styles.selectItemComponent, "theme-text-white hover:theme-bg-secondary")}
                                >
                                  {conta.banco} — {conta.descricao_banco}
                                </button>
                              ))}

                            {/* Contas API (OpenFinance) */}
                            {contasApi
                              .filter((c) => Boolean(c.descricao_banco && String(c.descricao_banco).trim()))
                              .map((conta) => (
                                <button
                                  key={`api-${conta.id}`}
                                  type="button"
                                  onClick={() => {
                                    handleInputChange("contaPagamento", `api:${conta.id}`);
                                    setIsAccountSelectOpen(false);
                                  }}
                                  className={cn(styles.selectItemComponent, "theme-text-white hover:theme-bg-secondary flex justify-between items-center")}
                                >
                                  <span>{conta.descricao_banco}</span>
                                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40">OpenFinance</span>
                                </button>
                              ))}

                            {contas.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 &&
                             contasApi.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 && (
                              <div className="theme-text-secondary px-2 py-1">
                                Nenhuma conta encontrada
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className={cn(styles.labelComponent, "theme-text-white")}>Centro de Custo</label>
                        <Info className="h-4 w-4 invisible" />
                      </div>
                      <ReactSelect
                        className="react-select-container edit-despesa-react-select"
                        classNamePrefix="react-select"
                        placeholder="Selecione o centro de custo"
                        value={
                          centrosDeCusto
                            .map((item) => ({
                              value: item.id.toString(),
                              label: item.nome,
                            }))
                            .find(
                              (opt) => opt.value === formData.centroCusto
                            ) || null
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
                        styles={{
                          control: (provided) => ({
                            ...provided,
                            backgroundColor: '#1B1229',
                            borderColor: '#673AB7',
                            color: '#FFFFFF',
                          }),
                          menu: (provided) => ({
                            ...provided,
                            backgroundColor: '#1B1229',
                            borderColor: '#673AB7',
                          }),
                          option: (provided, state) => ({
                            ...provided,
                            backgroundColor: state.isFocused ? '#673AB7' : '#1B1229',
                            color: '#FFFFFF',
                            '&:hover': {
                              backgroundColor: '#673AB7',
                            },
                          }),
                          singleValue: (provided) => ({
                            ...provided,
                            color: '#FFFFFF',
                          }),
                          input: (provided) => ({
                            ...provided,
                            color: '#FFFFFF',
                          }),
                          placeholder: (provided) => ({
                            ...provided,
                            color: '#B0AFC1',
                          }),
                        }}
                      />
                    </div>

                    {/* Categoria */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className={cn(styles.labelComponent, "theme-text-white")}>Subcategoria Despesa <span className="text-[#F50057]">*</span></label>
                        <Info className="h-4 w-4 theme-text-secondary" />
                      </div>
                      <ReactSelect
                        className="react-select-container edit-despesa-react-select"
                        classNamePrefix="react-select"
                        placeholder="Selecione a subcategoria de despesa"
                        value={
                          subCategoriasDespesa
                            .map((item) => ({
                              value: item.id.toString(),
                              label: `${item.categoria_pai_nome} → ${item.nome}`,
                            }))
                            .find((opt) => opt.value === formData.categoria) ||
                          null
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
                        styles={{
                          control: (provided) => ({
                            ...provided,
                            backgroundColor: '#1B1229',
                            borderColor: '#673AB7',
                            color: '#FFFFFF',
                          }),
                          menu: (provided) => ({
                            ...provided,
                            backgroundColor: '#1B1229',
                            borderColor: '#673AB7',
                          }),
                          option: (provided, state) => ({
                            ...provided,
                            backgroundColor: state.isFocused ? '#673AB7' : '#1B1229',
                            color: '#FFFFFF',
                            '&:hover': {
                              backgroundColor: '#673AB7',
                            },
                          }),
                          singleValue: (provided) => ({
                            ...provided,
                            color: '#FFFFFF',
                          }),
                          input: (provided) => ({
                            ...provided,
                            color: '#FFFFFF',
                          }),
                          placeholder: (provided) => ({
                            ...provided,
                            color: '#B0AFC1',
                          }),
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Condição de pagamento */}
                <div>
                  <h3 className="text-lg font-medium theme-text-white mb-4">
                    Condição de pagamento
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border theme-border-primary rounded-lg">
                      <thead className="theme-bg-modal">
                        <tr>
                          <th className="text-left p-3 text-sm font-medium theme-text-white">
                            Data
                          </th>
                          <th className="text-left p-3 text-sm font-medium theme-text-white">
                            Parcela
                          </th>
                          <th className="text-left p-3 text-sm font-medium theme-text-white">
                            Conta
                          </th>
                          <th className="text-left p-3 text-sm font-medium theme-text-white">
                            Valor R$
                          </th>
                          <th className="text-left p-3 text-sm font-medium theme-text-white">
                            Pago R$
                          </th>
                          <th className="text-left p-3 text-sm font-medium theme-text-white">
                            Em aberto R$
                          </th>
                          <th className="text-left p-3 text-sm font-medium theme-text-white">
                            Situação
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t theme-border-primary">
                          <td className="p-3 text-sm theme-text-white">
                            {formData.dataVencimento
                              ? new Date(
                                  formData.dataVencimento
                                ).toLocaleDateString()
                              : ""}
                          </td>
                          <td className="p-3 text-sm theme-text-white">1/1</td>
                          <td className="p-3 text-sm theme-text-white">{getNomeConta(formData.contaPagamento)}</td>
                          <td className="p-3 text-sm theme-text-white">
                            {Number(formData.valor || 0).toLocaleString(
                              "pt-BR",
                              { minimumFractionDigits: 2 }
                            )}
                          </td>
                          <td className="p-3 text-sm theme-text-white">
                            {(
                              formData.situacao === 'recebido'
                                ? Number(formData.valor || 0)
                                : 0
                            ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-sm theme-text-white">
                            {(
                              formData.situacao === 'em_aberto'
                                ? Number(formData.valor || 0)
                                : 0
                            ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3">
                            <span
                              className={cn(
                                styles.badgeComponent,
                                "px-2 py-1 rounded text-xs",
                                formData.situacao === "recebido" || formData.situacao === "Pago"
                                  ? "bg-primary theme-text-white"
                                  : formData.situacao === "vencidos"
                                  ? "bg-hotPink theme-text-white"
                                  : "bg-warning text-darkPurple"
                              )}
                            >
                              {formData.situacao === "recebido" ||
                              formData.situacao === "Pago"
                                ? "Pago"
                                : formData.situacao === "vencidos"
                                ? "Vencidos"
                                : "Em Aberto"}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tabs - Observações e Anexo */}
                <div className={styles.tabsComponent}>
                  <div className={cn(styles.tabsListComponent, "theme-bg-modal theme-border-primary edit-despesa-tabs")}>
                    <button
                      type="button"
                      onClick={() => setActiveTab("observacoes")}
                      className={cn(
                        styles.tabsTriggerComponent,
                        "theme-text-white edit-despesa-tab-trigger",
                        activeTab === "observacoes" && cn(styles.tabsTriggerActive, "bg-neonPurple theme-text-white")
                      )}
                    >
                      Observações
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("anexo")}
                      className={cn(
                        styles.tabsTriggerComponent,
                        "theme-text-white edit-despesa-tab-trigger",
                        activeTab === "anexo" && cn(styles.tabsTriggerActive, "bg-neonPurple theme-text-white")
                      )}
                    >
                      Anexo
                    </button>
                  </div>
                  {activeTab === "observacoes" && (
                    <div className={cn(styles.tabsContentComponent, "space-y-4")}>
                      <div className="space-y-2">
                        <label htmlFor="observacoes" className={cn(styles.labelComponent, "theme-text-white")}>Observações</label>
                        <textarea
                          id="observacoes"
                          value={formData.observacoes}
                          onChange={(e) =>
                            handleInputChange("observacoes", e.target.value)
                          }
                          placeholder="Descreva observações relevantes sobre este lançamento financeiro"
                          className={cn(styles.textareaComponent, "min-h-[120px] theme-bg-modal theme-border-primary theme-text-white placeholder:theme-text-secondary")}
                        />
                      </div>
                    </div>
                  )}
                  {activeTab === "anexo" && (
                    <div className={cn(styles.tabsContentComponent, "space-y-4")}>
                      <div className="space-y-4">
                        {/* Upload de PDF */}
                        <div className="border-2 border-dashed theme-border-primary rounded-lg p-6 text-center edit-despesa-pdf-section">
                          <label htmlFor="fileInput" className="cursor-pointer">
                            <div className="space-y-2">
                              <FileText className="h-8 w-8 text-neonPurple mx-auto" />
                              <p className="theme-text-white font-medium">
                                Clique para selecionar arquivo PDF
                              </p>
                              <p className="theme-text-secondary text-sm">
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
                        {formData.anexo && (
                          <div className="bg-green-600/10 border border-green-600/30 rounded-lg p-4 edit-despesa-pdf-success">
                            <div className="flex items-center gap-2 text-green-400 edit-despesa-pdf-success-text">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="font-medium">PDF anexado com sucesso!</span>
                            </div>
                            <p className="theme-text-secondary text-sm mt-1">
                              O valor será extraído automaticamente ao salvar
                            </p>
                          </div>
                        )}

                        {/* PDF existente */}
                        {!formData.anexo && (
                          <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-blue-400">
                              <FileText className="h-4 w-4" />
                              <span className="font-medium">Nenhum PDF anexado</span>
                            </div>
                            <p className="theme-text-secondary text-sm mt-1">
                              Faça upload de um PDF para extrair o valor automaticamente
                            </p>
                          </div>
                        )}

                        {/* Visualização do PDF */}
                        {formData.anexo && (
                          <div className="space-y-2">
                            <label className={cn(styles.labelComponent, "theme-text-white")}>Visualização do PDF</label>
                            <PDFViewer 
                              base64Data={formData.anexo}
                              fileName="boleto.pdf"
                              height="h-64"
                              showControls={true}
                              className="edit-despesa-pdf-viewer"
                            />
                            <div className="flex items-center gap-2 text-sm theme-text-secondary">
                              <Info className="h-4 w-4" />
                              <span>O valor do boleto será extraído automaticamente do PDF</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={cn(styles.editDespesaFooter, "flex items-center justify-between px-6 py-3 theme-border-primary border-t theme-bg-primary mt-auto")}>
          <button
            type="button"
            onClick={onClose}
            className={cn(styles.editDespesaCancelBtn, "theme-border-primary theme-bg-modal theme-text-white hover:theme-bg-secondary hover:theme-text-white")}
          >
            Voltar
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className={cn(styles.editDespesaSaveBtn, "bg-[#1E88E5]/20 text-[#26a6eb] border-[#1E88E5]/30 border-[#26a6eb] hover:bg-[#1E88E5]/30 hover:text-[#26a6eb]")}
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
