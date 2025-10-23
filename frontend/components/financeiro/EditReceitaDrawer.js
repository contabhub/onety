"use client";

import { useState, useEffect } from "react";
import styles from "../../styles/financeiro/EditReceitaDrawer.module.css";
import { Button } from "../../components/financeiro/botao";
import { Input } from "../../components/financeiro/input";
import { Label } from "../../components/financeiro/label";
import { Textarea } from "../../components/financeiro/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/financeiro/select";
import { Calendar } from "../../components/financeiro/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/financeiro/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/financeiro/tabs";
import { Checkbox } from "../../components/financeiro/checkbox";
import { Badge } from "../../components/financeiro/badge";
import { X, Calendar as CalendarIcon, ChevronDown, Info } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactSelect from "react-select"; 

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

      const res = await fetch(`${API}/companies/${empresaId}/categorias`, {
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
                      <Label htmlFor="cliente" className={styles.fieldLabel}>Cliente</Label>
                      <Select
                        value={formData.cliente}
                        onValueChange={(value) =>
                          handleInputChange("cliente", value)
                        }
                        disabled={temCliente}
                      >
                        <SelectTrigger
                          className={cn(
                            styles.selectTrigger,
                            temCliente && styles.inputDisabled
                          )}
                        >
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                        <SelectContent className={styles.selectContent}>
                          {clientes.length > 0 ? (
                            clientes.map((cliente) => (
                              <SelectItem
                                key={cliente.id}
                                value={cliente.id.toString()}
                                className={styles.selectItem}
                              >
                                {cliente.nome_fantasia}
                              </SelectItem>
                            ))
                          ) : (
                            <div className={styles.selectItemDisabled}>
                              Nenhum cliente encontrado
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      {temCliente && (
                        <p className={styles.helperText}>
                          Cliente não pode ser alterado quando já existe na
                          transação
                        </p>
                      )}
                    </div>

                    {/* Data de competência */}
                    <div className={styles.field}>
                      <Label className={styles.fieldLabel}>Data de vencimento <span className={styles.fieldLabelRequired}>*</span></Label>
                      <Popover
                        open={showCalendar}
                        onOpenChange={setShowCalendar}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            disabled={temCliente}
                            className={cn(
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
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className={styles.calendarPopover}>
                          <Calendar
                            mode="single"
                            selected={formData.dataCompetencia}
                            onSelect={(date) => {
                              if (date)
                                handleInputChange("dataCompetencia", date);
                              setShowCalendar(false);
                            }}
                            initialFocus
                            className={styles.calendar}
                          />
                        </PopoverContent>
                      </Popover>
                      {temCliente && (
                        <p className={styles.helperText}>
                          Data não pode ser alterada quando há cliente na
                          transação
                        </p>
                      )}
                    </div>

                    {/* Descrição */}
                    <div className={styles.field}>
                      <Label htmlFor="descricao" className={styles.fieldLabel}>Descrição <span className={styles.fieldLabelRequired}>*</span></Label>
                      <Input
                        id="descricao"
                        value={formData.descricao}
                        onChange={(e) =>
                          handleInputChange("descricao", e.target.value)
                        }
                        placeholder="Digite a descrição"
                        className={styles.input}
                      />
                    </div>

                    {/* Valor */}
                    <div className={styles.field}>
                      <Label htmlFor="valor" className={styles.fieldLabel}>Valor <span className={styles.fieldLabelRequired}>*</span></Label>
                      <div className="relative">
                        <span className={styles.inputIcon}>
                          R$
                        </span>
                        <Input
                          id="valor"
                          value={formData.valor}
                          onChange={(e) =>
                            handleInputChange("valor", e.target.value)
                          }
                          placeholder="0,00"
                          className={cn(styles.input, styles.inputWithIcon)}
                          disabled={temCliente}
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
                        <Label className={styles.fieldLabel}>Conta de pagamento</Label>
                        <Info className={cn(styles.fieldInfoIcon, styles.invisible)} />
                      </div>
                      <Select
                        value={formData.contaPagamento}
                        onValueChange={(value) =>
                          handleInputChange("contaPagamento", value)
                        }
                      >
                        <SelectTrigger className={styles.selectTrigger}>
                          <SelectValue placeholder="Selecione a conta" />
                        </SelectTrigger>
                        <SelectContent className={styles.selectContent}>
                          {/* Contas ERP */}
                          {contas
                            .filter((c) => Boolean(c.descricao_banco && String(c.descricao_banco).trim()))
                            .map((conta) => (
                              <SelectItem
                                key={`erp-${conta.id}`}
                                value={`erp:${conta.id}`}
                                className={styles.selectItem}
                              >
                                {conta.banco} — {conta.descricao_banco}
                              </SelectItem>
                            ))}

                          {/* Contas API (OpenFinance) */}
                          {contasApi
                            .filter((c) => Boolean(c.descricao_banco && String(c.descricao_banco).trim()))
                            .map((conta) => (
                              <SelectItem
                                key={`api-${conta.id}`}
                                value={`api:${conta.id}`}
                                className={cn(styles.selectItem, "flex justify-between items-center")}
                              >
                                <span>{conta.descricao_banco}</span>
                                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40">OpenFinance</span>
                              </SelectItem>
                            ))}

                          {contas.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 &&
                           contasApi.filter(c=>c.descricao_banco && String(c.descricao_banco).trim()).length === 0 && (
                            <div className={styles.selectItemDisabled}>
                              Nenhuma conta encontrada
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className={styles.field}>
                      <div className={styles.fieldInfo}>
                        <Label className={styles.fieldLabel}>Centro de Custo </Label>
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
                        <Label className={styles.fieldLabel}>Subcategoria Receita <span className={styles.fieldLabelRequired}>*</span></Label>
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
                  <Tabs defaultValue="observacoes" className={styles.tabs}>
                    <TabsList className={styles.tabsList}>
                      <TabsTrigger value="observacoes" className={styles.tabsTrigger}>Observações</TabsTrigger>
                      <TabsTrigger value="anexo" className={styles.tabsTrigger}>Anexo</TabsTrigger>
                    </TabsList>
                    <TabsContent value="observacoes" className={styles.tabsContent}>
                      <div className={styles.field}>
                        <Label htmlFor="observacoes" className={styles.fieldLabel}>Observações</Label>
                        <Textarea
                          id="observacoes"
                          value={formData.observacoes}
                          onChange={(e) =>
                            handleInputChange("observacoes", e.target.value)
                          }
                          placeholder="Descreva observações relevantes sobre este lançamento financeiro"
                          className={styles.textarea}
                        />
                      </div>
                    </TabsContent>
                    <TabsContent value="anexo" className={styles.tabsContent}>
                      <div className={styles.fileUploadSection}>
                        <p className={styles.fileUploadText}>
                          Arraste arquivos aqui ou clique para selecionar
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Button variant="outline" onClick={onClose} className={styles.footerButton}>
            Voltar
          </Button>
          <div className={styles.footerActions}>
            <Button
              onClick={handleSave}
              className={styles.saveButton}
            >
              Salvar
            </Button>
            <Button variant="outline" className={styles.moreButton}>
              <ChevronDown className={styles.moreButtonIcon} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
