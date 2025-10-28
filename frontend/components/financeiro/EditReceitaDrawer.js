"use client";

import { useState, useEffect } from "react";
import styles from "../../styles/financeiro/EditReceitaDrawer.module.css";
import { X, Calendar as CalendarIcon, ChevronDown, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactSelect from "react-select";
import { toast } from "react-toastify";

// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

export function EditReceitaDrawer({
  isOpen,
  onClose,
  onSave,
  transacaoId,
}) {
  const [formData, setFormData] = useState({
    cliente: "",
    dataCompetencia: new Date(),
    descricao: "",
    valor: "",
    habilitarRateio: false,
    categoria: "",
    centroCusto: "",
    codigoReferencia: "",
    observacoes: "",
    contaPagamento: "", // para o `conta_id`
    situacao: "", // para o ENUM: 'em_aberto', 'recebido', 'vencidos'
    origem: "",
    dataVencimento: "",
    conta: "",
    valorRecebido: "",
    valorEmAberto: "",
    anexo: null,
    // Adicione outros campos conforme necessário
  });

  const [parcelas, setParcelas] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados para componentes customizados
  const [isClienteSelectOpen, setIsClienteSelectOpen] = useState(false);
  const [isContaSelectOpen, setIsContaSelectOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("observacoes");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [contas, setContas] = useState([]);
  const [contasApi, setContasApi] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [subCategorias, setSubCategorias] = useState([]);
  const [clientes, setClientes] = useState([]);
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

  // Função para carregar contas API (OpenFinance)
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
      console.error("Erro ao carregar contas API:", error);
    }
  };

  // Função para carregar categorias
  const fetchCategorias = async () => {
    try {
      const token = localStorage.getItem("token");
      const empresaId = localStorage.getItem("empresaId");

      const res = await fetch(`${API}/financeiro/categorias/empresa/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const receitaData = data.find((item) => item.tipo === "Receita");
      const categoriasReceita = receitaData?.categorias || [];
      setCategorias(categoriasReceita);
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

  // Função para criar lista apenas de subcategorias de receita
  const getSubCategoriasReceita = () => {
    const items = [];

    console.log("🔍 EditReceita - subCategorias:", subCategorias.length);
    console.log("🔍 EditReceita - categorias:", categorias.length);

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
    const sortedItems = items.sort((a, b) => {
      // Primeiro ordena por categoria pai
      const categoriaCompare = (a.categoria_pai_nome || '').localeCompare(b.categoria_pai_nome || '');
      if (categoriaCompare !== 0) return categoriaCompare;
      
      // Se a categoria pai for igual, ordena por nome da subcategoria
      return a.nome.localeCompare(b.nome);
    });

    console.log("🔍 EditReceita - subcategorias filtradas:", sortedItems.length);
    return sortedItems;
  };

  // Função para obter o nome da conta baseado no valor armazenado (ERP/API)
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
      console.log("[loadTransacao] Dados carregados:", data);
      console.log("[loadTransacao] conta_id:", data.conta_id);

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
        cliente: data.cliente_id?.toString() || "",
        contaPagamento: data.conta_id
          ? `erp:${data.conta_id}`
          : (data.conta_api_id ? `api:${data.conta_api_id}` : ""),
        dataCompetencia: new Date(data.data_transacao),
        descricao: data.descricao || "",
        valor: data.valor?.toString() || "",
        origem: data.origem || "",
        categoria: categoriaSelecionada,
        observacoes: data.observacoes || "",
        situacao: data.situacao || "",
        dataVencimento: data.data_vencimento || "",
        conta: data.conta || "",
        valorRecebido: data.recebido ? data.recebido.toString() : "",
        valorEmAberto: data.em_aberto ? data.em_aberto.toString() : "",
        habilitarRateio:
          typeof data.habilitar_rateio === "boolean"
            ? data.habilitar_rateio
            : formData.habilitarRateio || false,
        centroCusto: data.centro_de_custo_id?.toString() || "",
        codigoReferencia:
          data.codigo_referencia || formData.codigoReferencia || "",
        anexo: data.anexo_base64 || formData.anexo || null,
      });

      if (data.parcelas) {
        setParcelas(data.parcelas);
      }

      // ✅ Lançamento carregado com sucesso (sem toast)
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

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.cliente-select')) {
        setIsClienteSelectOpen(false);
      }
      if (!event.target.closest('.conta-select')) {
        setIsContaSelectOpen(false);
      }
      if (!event.target.closest('.calendar-popover')) {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Função para gerar calendário simples
  const generateCalendar = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    const endDate = new Date(lastDay);
    
    // Ajustar para começar no domingo da semana
    startDate.setDate(startDate.getDate() - startDate.getDay());
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    
    const days = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  // Navegar entre meses do calendário
  const navigateCalendar = (direction) => {
    const newDate = new Date(calendarDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCalendarDate(newDate);
  };

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

      console.log(
        "[handleSave] formData.contaPagamento:",
        formData.contaPagamento
      );
      console.log("[handleSave] empresaId:", empresaId);

      // Encontrar o item selecionado (subcategoria de receita)
      const subCategoriasReceita = getSubCategoriasReceita();
      const itemSelecionado = subCategoriasReceita.find(
        (item) => item.id.toString() === formData.categoria
      );

      // Monta conta_id/conta_api_id conforme valor escolhido no select
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
        cliente_id: formData.cliente || null,
        conta_id: contaIdParsed,
        conta_api_id: contaApiIdParsed || null,
        company_id: empresaId ? Number(empresaId) : null,
        tipo: "entrada",
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

      toast.success("Transação atualizada com sucesso!"); // ✅ Toast de sucesso

      // Chama o callback onSave com os dados atualizados
      onSave(data);
      onClose();
    } catch (error) {
      console.error("Erro ao salvar transação:", error);
      toast.error(
        "Erro ao atualizar transação. Verifique os dados e tente novamente."
      ); // ❌ Toast de erro
    }
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

  const subCategoriasReceita = getSubCategoriasReceita();

  return (
    <div className={cn(
      styles.overlay,
      isClosing && styles.closing
    )}>
      <div
        className={cn(
          styles.modal,
          isClosing && styles.closing
        )}
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            Editar lançamento
          </h2>
          <button
            onClick={handleClose}
            className={`${styles.buttonComponent} ${styles.buttonGhost} ${styles.buttonSmall} ${styles.closeButton}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.contentInner}>
            {loading ? (
              <div className={styles.loading}>
                <div className="theme-text-secondary">Carregando...</div>
              </div>
            ) : (
              <>
                {/* Informações do lançamento */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    Informações do lançamento
                  </h3>

                  <div className={styles.grid}>
                    {/* Cliente */}
                    <div className={styles.field}>
                      <label htmlFor="cliente" className={`${styles.labelComponent} ${styles.fieldLabel}`}>Cliente</label>
                      <div className={`${styles.selectComponent} cliente-select`}>
                        <button
                          onClick={() => !temCliente && setIsClienteSelectOpen(!isClienteSelectOpen)}
                          disabled={temCliente}
                          className={cn(
                            styles.selectTriggerComponent,
                            styles.selectTrigger,
                            temCliente && styles.inputDisabled
                          )}
                        >
                          <span className={formData.cliente ? styles.selectValue : styles.selectPlaceholder}>
                            {formData.cliente 
                              ? clientes.find(c => c.id.toString() === formData.cliente)?.nome_fantasia || "Cliente selecionado"
                              : "Selecione o cliente"
                            }
                          </span>
                          <ChevronDown className={cn(styles.selectIcon, isClienteSelectOpen && styles.selectIconOpen)} />
                        </button>
                        {isClienteSelectOpen && !temCliente && (
                          <div className={`${styles.selectContentComponent} ${styles.selectContent}`}>
                            {clientes.length > 0 ? (
                              clientes.map((cliente) => (
                                <button
                                  key={cliente.id}
                                  onClick={() => {
                                    handleInputChange("cliente", cliente.id.toString());
                                    setIsClienteSelectOpen(false);
                                  }}
                                  className={`${styles.selectItemComponent} ${styles.selectItem}`}
                                >
                                  {cliente.nome_fantasia}
                                </button>
                              ))
                            ) : (
                              <div className={styles.selectItemDisabled}>
                                Nenhum cliente encontrado
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {temCliente && (
                        <p className={styles.helperText}>
                          Cliente não pode ser alterado quando já existe na
                          transação
                        </p>
                      )}
                    </div>

                    {/* Data de competência */}
                    <div className={styles.field}>
                      <label className={`${styles.labelComponent} ${styles.fieldLabel}`}>Data de vencimento <span className={styles.fieldLabelRequired}>*</span></label>
                      <div className={`${styles.popoverContainer} calendar-popover`}>
                        <button
                          onClick={() => !temCliente && setIsCalendarOpen(!isCalendarOpen)}
                          disabled={temCliente}
                          className={cn(
                            styles.buttonComponent,
                            styles.buttonOutline,
                            styles.calendarButton,
                            !formData.dataCompetencia && styles.calendarButtonEmpty,
                            temCliente && styles.inputDisabled
                          )}
                        >
                          <CalendarIcon className={styles.calendarIcon} />
                          {formData.dataCompetencia
                            ? format(formData.dataCompetencia, "dd/MM/yyyy", {
                                locale: ptBR,
                              })
                            : "Selecione a data"}
                        </button>
                        {isCalendarOpen && !temCliente && (
                          <>
                            <div className={styles.popoverOverlay} onClick={() => setIsCalendarOpen(false)} />
                            <div className={`${styles.popoverContent} ${styles.calendarPopover}`}>
                              <div className={`${styles.calendarComponent} ${styles.calendar}`}>
                                <div className={styles.calendarHeader}>
                                  <button 
                                    onClick={() => navigateCalendar('prev')}
                                    className={styles.calendarNavButton}
                                  >
                                    <ChevronLeft size={16} />
                                  </button>
                                  <span className={styles.labelComponent}>
                                    {format(calendarDate, "MMMM yyyy", { locale: ptBR })}
                                  </span>
                                  <button 
                                    onClick={() => navigateCalendar('next')}
                                    className={styles.calendarNavButton}
                                  >
                                    <ChevronRight size={16} />
                                  </button>
                                </div>
                                <div className={styles.calendarGrid}>
                                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                                    <div key={day} className={styles.calendarDay} style={{fontWeight: 'bold', cursor: 'default'}}>
                                      {day}
                                    </div>
                                  ))}
                                  {generateCalendar(calendarDate).map((day, index) => {
                                    const isSelected = formData.dataCompetencia && 
                                      format(day, 'yyyy-MM-dd') === format(formData.dataCompetencia, 'yyyy-MM-dd');
                                    const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                                    const isCurrentMonth = day.getMonth() === calendarDate.getMonth();
                                    
                                    return (
                                      <button
                                        key={index}
                                        onClick={() => {
                                          handleInputChange("dataCompetencia", day);
                                          setIsCalendarOpen(false);
                                        }}
                                        className={cn(
                                          styles.calendarDay,
                                          isSelected && styles.calendarDaySelected,
                                          isToday && !isSelected && styles.calendarDayToday,
                                          !isCurrentMonth && 'opacity-50'
                                        )}
                                      >
                                        {day.getDate()}
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
                        <p className={styles.helperText}>
                          Data não pode ser alterada quando há cliente na
                          transação
                        </p>
                      )}
                    </div>

                    {/* Descrição */}
                    <div className={styles.field}>
                      <label htmlFor="descricao" className={`${styles.labelComponent} ${styles.fieldLabel}`}>Descrição <span className={styles.fieldLabelRequired}>*</span></label>
                      <input
                        id="descricao"
                        type="text"
                        value={formData.descricao}
                        onChange={(e) =>
                          handleInputChange("descricao", e.target.value)
                        }
                        placeholder="Digite a descrição"
                        className={`${styles.inputComponent} ${styles.input}`}
                      />
                    </div>

                    {/* Valor */}
                    <div className={styles.field}>
                      <label htmlFor="valor" className={`${styles.labelComponent} ${styles.fieldLabel}`}>Valor <span className={styles.fieldLabelRequired}>*</span></label>
                      <div className="relative">
                        <span className={styles.inputIcon}>
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
                          className={cn(styles.inputComponent, styles.input, styles.inputWithIcon, temCliente && styles.inputDisabled)}
                        />
                      </div>
                      {temCliente && (
                        <p className={styles.helperText}>
                          Valor não pode ser alterado quando há cliente na
                          transação
                        </p>
                      )}
                    </div>

                    <div className={styles.field}>
                      <div className={styles.fieldInfo}>
                        <label className={`${styles.labelComponent} ${styles.fieldLabel}`}>Conta de pagamento</label>
                        <Info className={cn(styles.fieldInfoIcon, styles.invisible)} />
                      </div>
                      <div className={`${styles.selectComponent} conta-select`}>
                        <button
                          onClick={() => setIsContaSelectOpen(!isContaSelectOpen)}
                          className={`${styles.selectTriggerComponent} ${styles.selectTrigger}`}
                        >
                          <span className={formData.contaPagamento ? styles.selectValue : styles.selectPlaceholder}>
                            {formData.contaPagamento 
                              ? getNomeConta(formData.contaPagamento)
                              : "Selecione a conta"
                            }
                          </span>
                          <ChevronDown className={cn(styles.selectIcon, isContaSelectOpen && styles.selectIconOpen)} />
                        </button>
                        {isContaSelectOpen && (
                          <div className={`${styles.selectContentComponent} ${styles.selectContent}`}>
                            {/* Contas ERP */}
                            {contas
                              .filter((c) => Boolean(c.descricao_banco && String(c.descricao_banco).trim()))
                              .map((conta) => (
                                <button
                                  key={`erp-${conta.id}`}
                                  onClick={() => {
                                    handleInputChange("contaPagamento", `erp:${conta.id}`);
                                    setIsContaSelectOpen(false);
                                  }}
                                  className={`${styles.selectItemComponent} ${styles.selectItem}`}
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
                                  onClick={() => {
                                    handleInputChange("contaPagamento", `api:${conta.id}`);
                                    setIsContaSelectOpen(false);
                                  }}
                                  className={cn(styles.selectItemComponent, styles.selectItem, "flex justify-between items-center")}
                                >
                                  <span>{conta.descricao_banco}</span>
                                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40">OpenFinance</span>
                                </button>
                              ))}

                            {contas.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 &&
                             contasApi.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 && (
                              <div className={styles.selectItemDisabled}>
                                Nenhuma conta encontrada
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.field}>
                      <div className={styles.fieldInfo}>
                        <label className={`${styles.labelComponent} ${styles.fieldLabel}`}>Centro de Custo </label>
                        <Info className={cn(styles.fieldInfoIcon, styles.invisible)} />
                      </div>
                      <ReactSelect
                        className={cn(styles.reactSelectContainer, "edit-receita-react-select")}
                        classNamePrefix="react-select"
                        placeholder="Selecione o centro de custo"
                        value={
                          centrosDeCusto
                            .map((item) => ({
                              value: item.id.toString(),
                              label: item.nome,
                            }))
                            .find((opt) => opt.value === formData.centroCusto) || null
                        }
                        onChange={(selected) =>
                          handleInputChange("centroCusto", selected ? selected.value : "")
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
                    <div className={styles.field}>
                      <div className={styles.fieldInfo}>
                        <label className={`${styles.labelComponent} ${styles.fieldLabel}`}>Subcategoria Receita <span className={styles.fieldLabelRequired}>*</span></label>
                        <Info className={styles.fieldInfoIcon} />
                      </div>
                      <ReactSelect
                        className={cn(styles.reactSelectContainer, "edit-receita-react-select")}
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
                          handleInputChange("categoria", selected ? selected.value : "")
                        }
                        options={subCategoriasReceita.map((item) => ({
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
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    Condição de pagamento
                  </h3>
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead className={styles.tableHeader}>
                        <tr>
                          <th className={styles.tableHeaderCell}>
                            Data
                          </th>
                          <th className={styles.tableHeaderCell}>
                            Parcela
                          </th>
                          <th className={styles.tableHeaderCell}>
                            Conta
                          </th>
                          <th className={styles.tableHeaderCell}>
                            Valor R$
                          </th>
                          <th className={styles.tableHeaderCell}>
                            Recebido R$
                          </th>
                          <th className={styles.tableHeaderCell}>
                            Em aberto R$
                          </th>
                          <th className={styles.tableHeaderCell}>
                            Situação
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className={styles.tableRow}>
                          <td className={styles.tableCell}>
                            {formData.dataVencimento
                              ? new Date(
                                  formData.dataVencimento
                                ).toLocaleDateString()
                              : ""}
                          </td>
                          <td className={styles.tableCell}>1/1</td>
                          <td className={styles.tableCell}>{getNomeConta(formData.contaPagamento)}</td>
                          <td className={styles.tableCell}>
                            {Number(formData.valor || 0).toLocaleString(
                              "pt-BR",
                              { minimumFractionDigits: 2 }
                            )}
                          </td>
                          <td className={styles.tableCell}>
                            {(
                              formData.situacao === 'recebido'
                                ? Number(formData.valor || 0)
                                : 0
                            ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={styles.tableCell}>
                            {(
                              formData.situacao === 'em_aberto'
                                ? Number(formData.valor || 0)
                                : 0
                            ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={styles.tableCell}>
                            <span
                              className={cn(
                                styles.badgeComponent,
                                styles.badge,
                                formData.situacao === "recebido" || formData.situacao === "Recebido"
                                  ? styles.badgeReceived
                                  : formData.situacao === "vencidos"
                                  ? styles.badgeOverdue
                                  : styles.badgeOpen
                              )}
                            >
                              {formData.situacao === "recebido" ||
                              formData.situacao === "Recebido"
                                ? "Recebido"
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
                <div className={styles.section}>
                  <div className={`${styles.tabsComponent} ${styles.tabs}`}>
                    <div className={`${styles.tabsListComponent} ${styles.tabsList}`}>
                      <button 
                        onClick={() => setActiveTab("observacoes")}
                        className={cn(
                          styles.tabsTriggerComponent,
                          styles.tabsTrigger,
                          activeTab === "observacoes" && styles.tabsTriggerActive
                        )}
                      >
                        Observações
                      </button>
                      <button 
                        onClick={() => setActiveTab("anexo")}
                        className={cn(
                          styles.tabsTriggerComponent,
                          styles.tabsTrigger,
                          activeTab === "anexo" && styles.tabsTriggerActive
                        )}
                      >
                        Anexo
                      </button>
                    </div>
                    {activeTab === "observacoes" && (
                      <div className={`${styles.tabsContentComponent} ${styles.tabsContent}`}>
                        <div className={styles.field}>
                          <label htmlFor="observacoes" className={`${styles.labelComponent} ${styles.fieldLabel}`}>Observações</label>
                          <textarea
                            id="observacoes"
                            value={formData.observacoes}
                            onChange={(e) =>
                              handleInputChange("observacoes", e.target.value)
                            }
                            placeholder="Descreva observações relevantes sobre este lançamento financeiro"
                            className={`${styles.textareaComponent} ${styles.textarea}`}
                          />
                        </div>
                      </div>
                    )}
                    {activeTab === "anexo" && (
                      <div className={`${styles.tabsContentComponent} ${styles.tabsContent}`}>
                        <div className={styles.fileUploadSection}>
                          <p className={styles.fileUploadText}>
                            Arraste arquivos aqui ou clique para selecionar
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
          <button 
            onClick={onClose} 
            className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.footerButton}`}
          >
            Voltar
          </button>
          <div className={styles.footerActions}>
            <button
              onClick={handleSave}
              className={`${styles.buttonComponent} ${styles.buttonPrimary} ${styles.saveButton}`}
            >
              Salvar
            </button>
            <button 
              className={`${styles.buttonComponent} ${styles.buttonOutline} ${styles.moreButton}`}
            >
              <ChevronDown className={styles.moreButtonIcon} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
