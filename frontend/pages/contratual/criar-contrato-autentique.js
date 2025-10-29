import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import SpaceLoader from "../../components/onety/menu/SpaceLoader";
import styles from "../../styles/contratual/CriarContrato.module.css";
import LeadsModal from "../../components/comercial/modal/LeadsModal";
import ClienteModal from "../../components/comercial/ClienteModal";
import ClienteForm from "../../components/contratual/ClienteForm";
import ProdutoModal from "../../components/contratual/ProdutoModal";
import LeadToClientForm from "../../components/contratual/LeadToClientForm";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faPen, faTrash, faUser, faFileAlt, faBoxOpen, faUserPlus, faInfoCircle, faRocket, faCloudUploadAlt, faCheckCircle, faExclamationTriangle, faTimes } from "@fortawesome/free-solid-svg-icons";
import { fetchClienteById } from "../../utils/fetchClienteById";
import ListaSignatarios from "../../components/contratual/ListaSignatarios";
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ToggleSimNao from "../../components/contratual/ToggleSimNao";
import TiptapEditor from "../../components/contratual/TiptapEditor";
import ReactSelect from "react-select";
import { format } from "date-fns";

// Estilos customizados para o ReactSelect
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

// Adicione a função utilitária para converter arquivo em base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove o prefixo "data:application/pdf;base64,"
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

export default function CriarContratoAutentique() {
  const router = useRouter();
  const { lead_id } = router.query;

  const [activeTab, setActiveTab] = useState("cliente"); // Controle das abas
  const [clientes, setClientes] = useState([]);
  const [clienteSelecionado, setClienteSelecionado] = useState("");
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [validade, setValidade] = useState("");
  const [content, setContent] = useState("");
  const [signatarios, setSignatarios] = useState([]); // Agora começa vazio
  const [novoSignatario, setNovoSignatario] = useState({ name: "", email: "", cpf: "", birth_date: "", telefone: "", funcao_assinatura: "" });
  const [editIndex, setEditIndex] = useState(null); // Para saber se está editando
  const [showSignatariosList, setShowSignatariosList] = useState(false); // Controla a exibição da lista

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showLeadsModal, setShowLeadsModal] = useState(false);
  const [showClienteModal, setShowClienteModal] = useState(false); // Para criar novo cliente
  const [usuario, setUsuario] = useState({ full_name: "", email: "" });
  const [showCliente, setShowCliente] = useState(false);
  const [loadingClientes, setLoadingClientes] = useState(false); // Estado de carregamento dos clientes
  const [cliente, setCliente] = useState({});
  const [produtos, setProdutos] = useState([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState([]);
  const [showProdutoModal, setShowProdutoModal] = useState(false);
  const [expiraEmDias, setExpiraEmDias] = useState(15);
  const [vigenciaMeses, setVigenciaMeses] = useState(12);
  const [vigenciaInicio, setVigenciaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [vigenciaFim, setVigenciaFim] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 12);
    return d.toISOString().slice(0, 10);
  });
  const [empresaEquipe, setEmpresaEquipe] = useState({});
  const [empresasAtivas, setEmpresasAtivas] = useState([]); // Novo estado para múltiplas empresas
  const [customVariables, setCustomVariables] = useState([]);
  const [customValues, setCustomValues] = useState({});
  const [showClienteFormModal, setShowClienteFormModal] = useState(false); // Novo controle
  const [leadSelecionado, setLeadSelecionado] = useState({});
  const [showLeadToClientForm, setShowLeadToClientForm] = useState(false);
  const [createdContractId, setCreatedContractId] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [contratoHtml, setContratoHtml] = useState("");
  const [contatos, setContatos] = useState([]);
  const [salvarNaLista, setSalvarNaLista] = useState(false);
  const [diaVencimento, setDiaVencimento] = useState(1); // Dia do vencimento padrão
  const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState(new Date().toISOString().slice(0, 10)); // Data do 1º vencimento padrão
  const [datasPersonalizadas, setDatasPersonalizadas] = useState({}); // Datas editadas manualmente para parcelas personalizadas (índice parcela -> data)
  const [showAdjustDatesModal, setShowAdjustDatesModal] = useState(false);
  const [pendingAdjustContext, setPendingAdjustContext] = useState(null); // { index, newDate, deltaDays }
  const [nomeDocumento, setNomeDocumento] = useState(""); // Nome do documento no Autentique
  const [uploadedFile, setUploadedFile] = useState(null); // Arquivo upado
  const [uploadFileName, setUploadFileName] = useState(""); // Nome do arquivo upado
  const [showUploadWarning, setShowUploadWarning] = useState(false); // Aviso de conflito entre modelo e upload
  const [uploadProgress, setUploadProgress] = useState(0); // Progresso do upload
  const [valorContrato, setValorContrato] = useState(""); // Valor do contrato (TCV) - NOVO
  const [valorRecorrente, setValorRecorrente] = useState(""); // MRR manual para upload
  const [rascunhoId, setRascunhoId] = useState(null); // ID do rascunho se existir
  const [salvandoRascunho, setSalvandoRascunho] = useState(false); // Estado de salvamento do rascunho
  const [showExitModal, setShowExitModal] = useState(false); // Modal de confirmação para sair
  const [rascunhoCarregado, setRascunhoCarregado] = useState(false); // Evita carregar rascunho múltiplas vezes
  
  // Estados para configuração financeira (Straton)
  const [financeiroData, setFinanceiroData] = useState({
    categorias: [],
    subCategorias: [],
    centrosCusto: [],
    users: [],
    contas: [],
    contasApi: [],
  });
  const [loadingFinanceiro, setLoadingFinanceiro] = useState(false);
  const [financeiroForm, setFinanceiroForm] = useState({
    dataInicio: null,
    dataPrimeiraVenda: null,
    categoria: "",
    centroCusto: "",
    vendedorResponsavel: "",
    tipoIntervalo: "meses",
    intervalo: "1",
    terminoRecorrencia: "indeterminado",
    indeterminado: true,
    totalCiclos: "",
    dataTermino: null,
    formaPagamento: "",
    contaRecebimento: "",
    vencimento: null,
    observacoesPagamento: "",
    observacoesFiscais: "",
    descontoTipo: "reais",
    descontoValor: "0",
  });


  const handleLeadSelecionado = (payload) => {
    // payload pode ser { lead, clientId }
    const lead = payload?.lead || payload;
    const createdClientId = payload?.clientId || null;
    setLeadSelecionado(lead);
    setShowLeadsModal(false);

    if (createdClientId) {
      // Se já criamos o pré-cliente, buscar dados completos e selecionar automaticamente
      const idStr = String(createdClientId);
      setClienteSelecionado(idStr);
      (async () => {
        try {
          const clienteData = await fetchClienteById(createdClientId);
          setCliente(clienteData);
        } catch {
          // fallback: preenche com dados do lead
          setCliente({
            id: createdClientId,
            nome: lead?.name || lead?.nome || '',
            email: lead?.email || '',
            telefone: lead?.telefone || ''
          });
        }
      })();
      setShowLeadToClientForm(false);
    } else {
      // Caso contrário, abre conversão manual
      setShowLeadToClientForm(true);
    }
  };

  // Função para salvar rascunho
  const salvarRascunho = async (silencioso = false) => {
    // Só salva se tem dados mínimos
    if (!clienteSelecionado && !selectedTemplate && !uploadedFile && signatarios.length === 0) {
      return;
    }

    setSalvandoRascunho(true);
    
    try {
      const token = localStorage.getItem("token");
      const userRaw = localStorage.getItem("userData");
      const user = userRaw ? JSON.parse(userRaw) : {};
      const equipeId = user.EmpresaId;

      if (!token || !equipeId) {
        if (!silencioso) toast.warning("Erro de autenticação ao salvar rascunho.");
        return;
      }

      const dadosRascunho = {
        client_id: clienteSelecionado || null,
        template_id: selectedTemplate || null,
        content: content || "",
        signatories: signatarios,
        empresa_id: equipeId,
        produto_id: produtosSelecionados.length > 0 ? produtosSelecionados[0].id : null, // Mantém para compatibilidade
        produtos_dados: produtosSelecionados, // Array completo de produtos como JSON
        valor: produtosSelecionados.reduce((total, p) => {
          const quantidade = parseFloat(p.quantidade) || 0;
          const valorUnitario = parseFloat(p.valor_de_venda) || 0;
          return total + quantidade * valorUnitario;
        }, 0),
        valor_recorrente: (() => {
          const produtosMensais = produtosSelecionados.filter(p => p.tipo === 'mensal');
          if (produtosMensais.length === 0) return 0;
          const mrr = produtosMensais.reduce((total, p) => {
            const quantidade = parseFloat(p.quantidade) || 0;
            const valorUnitario = parseFloat(p.valor_de_venda) || 0;
            const parcelas = parseInt(p.parcelas) || 1;
            return total + ((quantidade * valorUnitario) / parcelas);
          }, 0);
          return Number(mrr.toFixed(2));
        })(),
        expires_at: validade ? new Date(validade).toISOString() : null,
        start_at: vigenciaInicio ? new Date(vigenciaInicio).toISOString() : null,
        end_at: vigenciaFim ? new Date(vigenciaFim).toISOString() : null
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/rascunhos`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dadosRascunho),
      });

      if (!response.ok) {
        throw new Error("Erro ao salvar rascunho");
      }

      const data = await response.json();
      setRascunhoId(data.contract_id);
      
      if (!silencioso) {
        toast.success(data.is_update ? "Rascunho atualizado!" : "Rascunho salvo!");
      }
    } catch (error) {
      console.error("Erro ao salvar rascunho:", error);
      if (!silencioso) {
        toast.error("Erro ao salvar rascunho.");
      }
    } finally {
      setSalvandoRascunho(false);
    }
  };

  // Função para verificar se há mudanças não salvas
  const verificarMudancas = useCallback(() => {
    return (
      clienteSelecionado || 
      selectedTemplate || 
      uploadedFile || 
      signatarios.length > 0 || 
      content.trim() || 
      produtosSelecionados.length > 0 ||
      Object.keys(customValues).length > 0 ||
      nomeDocumento.trim() ||
      valorContrato.trim() ||
      valorRecorrente.trim()
    );
  }, [clienteSelecionado, selectedTemplate, uploadedFile, signatarios, content, produtosSelecionados, customValues, nomeDocumento, valorContrato, valorRecorrente]);

  // Função para lidar com tentativa de sair da página
  const handleExitAttempt = () => {
    if (verificarMudancas()) {
      setShowExitModal(true);
    } else {
      router.push('/contratual/contratos');
    }
  };

  // Função para cancelar saída (chamada pelo modal)
  const cancelExit = () => {
    setShowExitModal(false);
  };

  // Função para sair da página (chamada pelo modal)
  const confirmExit = async (saveBeforeExit = false) => {
    setShowExitModal(false);
    
    if (saveBeforeExit) {
      try {
        await salvarRascunho(false);
        toast.success("Rascunho salvo com sucesso!");
      } catch (error) {
        toast.error("Erro ao salvar rascunho. Tente novamente.");
        return; // Não sai da página se der erro
      }
    }
    
    // Sempre navegar para contratos
    router.push('/contratual/contratos');
  };

  // Função para carregar rascunho
  const carregarRascunho = async (contractId) => {
    try {
      const token = localStorage.getItem("token");
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/rascunhos/${contractId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar rascunho");
      }

      const data = await response.json();
      const { contract, signatories } = data;

      // Preenche os estados com os dados do rascunho - apenas campos que existem na tabela
      if (contract.client_id) setClienteSelecionado(contract.client_id.toString());
      if (contract.template_id) setSelectedTemplate(contract.template_id.toString());
      if (contract.content) setContent(contract.content);
      if (contract.produtos_dados && Array.isArray(contract.produtos_dados)) {
        setProdutosSelecionados(contract.produtos_dados);
      }
      if (contract.valor) setValorContrato(contract.valor.toString());
      if (contract.valor_recorrente) setValorRecorrente(contract.valor_recorrente.toString());
      
      
      if (contract.expires_at) {
        const formattedExpires = formatDateTimeToInput(contract.expires_at);
        setValidade(formattedExpires);
      }
      if (contract.start_at) {
        const formattedStart = formatDateToInput(contract.start_at);
        setVigenciaInicio(formattedStart);
      }
      if (contract.end_at) {
        const formattedEnd = formatDateToInput(contract.end_at);
        setVigenciaFim(formattedEnd);
      }
      
      if (signatories && Array.isArray(signatories)) {
        const mappedSignatories = signatories.map(s => ({
          name: s.name,  // Backend já retorna como 'name'
          email: s.email,
          cpf: s.cpf,
          birth_date: s.birth_date,
          telefone: s.telefone,
          funcao_assinatura: s.funcao_assinatura
        }));
        setSignatarios(mappedSignatories);
      }

      setRascunhoId(contractId);
      
      // Não mostra toast para carregamento automático
    } catch (error) {
      console.error("Erro ao carregar rascunho:", error);
      toast.error("Erro ao carregar rascunho.");
    }
  };

  // Função para lidar com upload de arquivo
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Verificar se é um arquivo PDF
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são aceitos para upload.');
      return;
    }

    // Verificar se já há template selecionado
    if (selectedTemplate) {
      setShowUploadWarning(true);
      return;
    }

    setUploadedFile(file);
    setUploadFileName(file.name);
    setContent(''); // Limpar conteúdo do editor
    setSelectedTemplate(''); // Limpar template selecionado
    setValorContrato(''); // Limpar valor do contrato
    setValorRecorrente('');
    setShowUploadWarning(false);
  };

  // Função para lidar com drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = '#e3f2fd';
    e.currentTarget.style.borderColor = '#2196f3';
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = uploadedFile ? '#f0f8ff' : '#fafafa';
    e.currentTarget.style.borderColor = '#ddd';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = uploadedFile ? '#f0f8ff' : '#fafafa';
    e.currentTarget.style.borderColor = '#ddd';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      
      // Verificar se é um arquivo PDF
      if (file.type !== 'application/pdf') {
        toast.error('Apenas arquivos PDF são aceitos para upload.');
        return;
      }

      // Verificar se já há template selecionado
      if (selectedTemplate) {
        setShowUploadWarning(true);
        return;
      }

      setUploadedFile(file);
      setUploadFileName(file.name);
      setContent(''); // Limpar conteúdo do editor
      setSelectedTemplate(''); // Limpar template selecionado
      setValorContrato(''); // Limpar valor do contrato
      setValorRecorrente('');
      setShowUploadWarning(false);
    }
  };

  // Função para remover arquivo upado
  const handleRemoveFile = () => {
    setUploadedFile(null);
    setUploadFileName('');
    setUploadProgress(0);
    setValorContrato(''); // Limpa o valor do contrato também
    setValorRecorrente('');
  };

  // Função para lidar com mudança no template
  const handleTemplateChangeWithWarning = (e) => {
    const templateId = e.target.value;
    
    // Se há arquivo upado e está tentando selecionar template
    if (uploadedFile && templateId) {
      setShowUploadWarning(true);
      return;
    }

    handleTemplateChange(e);
    setUploadedFile(null); // Limpar arquivo upado
    setUploadFileName(''); // Limpar nome do arquivo
    setUploadProgress(0); // Limpar progresso
    setValorContrato(''); // Limpar valor do contrato
    setValorRecorrente('');
    setShowUploadWarning(false);
  };

  // Função para lidar com mudança no conteúdo do editor
  const handleContentChange = (newContent) => {
    // Se há arquivo upado e está tentando editar conteúdo
    if (uploadedFile && newContent.trim() !== '') {
      setShowUploadWarning(true);
      return;
    }

    setContent(newContent);
    setUploadedFile(null); // Limpar arquivo upado
    setUploadFileName(''); // Limpar nome do arquivo
    setUploadProgress(0); // Limpar progresso
    setValorContrato(''); // Limpar valor do contrato
    setValorRecorrente('');
    setShowUploadWarning(false);
  };

  // Exemplo: função chamada ao selecionar cliente
  const handleSelecionarCliente = (cliente) => {
    setCliente(cliente);
    setShowCliente(true);
  };

  // Exemplo: função para atualizar o cliente localmente após edição
  const handleAtualizarCliente = async (clienteAtualizado) => {
    setCliente(clienteAtualizado); // atualiza os dados no modal
    setClienteSelecionado(clienteAtualizado.id); // mantém ID atualizado

    await fetchClientes(); // recarrega todos os clientes para refletir a atualização no <select>
  };


  const fetchEmpresaEquipe = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const userRaw = localStorage.getItem("userData");
      if (!userRaw) return;

      const user = JSON.parse(userRaw);
      const equipeId = user.EmpresaId;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratada/empresa/${equipeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Erro ao buscar empresa da equipe");

      const data = await res.json();
      // Pega todas as empresas ativas
      let empresas = [];
      if (Array.isArray(data)) {
        empresas = data.filter(e => e.ativo);
      } else if (data && data.ativo) {
        empresas = [data];
      }
      setEmpresasAtivas(empresas);
      // Pega apenas a empresa ativa (primeira)
      const empresaAtiva = Array.isArray(data) ? data.find(e => e.ativo) : data;
      setEmpresaEquipe(empresaAtiva || null);
    } catch (error) {
      console.error("Erro ao carregar empresa da equipe:", error);
    }
  };

  // Função para buscar dados financeiros (quando straton = 1)
  const fetchFinanceiroData = async () => {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("userData");
    if (!token || !userRaw) return;

    const user = JSON.parse(userRaw);
    const empresaId = user?.EmpresaId;
    if (!empresaId) return;

    setLoadingFinanceiro(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL;

      // Buscar todas as informações em paralelo
      // IMPORTANTE: Buscar TODAS as categorias da empresa (via tipos) para fazer match com subcategorias
      // Depois vamos filtrar apenas as subcategorias de receita no getSubCategoriasReceita
      const [categoriasRes, subCategoriasRes, centrosCustoRes, usersRes, contasRes, tiposRes] = await Promise.all([
        fetch(`${API}/financeiro/categorias/empresa/${empresaId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/financeiro/sub-categorias/empresa/${empresaId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/financeiro/centro-de-custo/empresa/${empresaId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/usuarios`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/financeiro/contas/company/${empresaId}/contas`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/financeiro/tipos/empresa/${empresaId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const categoriasData = categoriasRes.ok ? await categoriasRes.json() : [];
      const subCategoriasRaw = subCategoriasRes.ok ? await subCategoriasRes.json() : [];
      const centrosCusto = centrosCustoRes.ok ? await centrosCustoRes.json() : [];
      const usersData = usersRes.ok ? await usersRes.json() : {};
      const contasData = contasRes.ok ? await contasRes.json() : {};
      const tiposData = tiposRes.ok ? await tiposRes.json() : [];

      console.log('🔍 [fetchFinanceiroData] Categorias recebidas (estrutura):', categoriasData);
      console.log('🔍 [fetchFinanceiroData] SubCategorias recebidas (raw):', subCategoriasRaw);
      console.log('🔍 [fetchFinanceiroData] CategoriasRes.ok:', categoriasRes.ok, 'Status:', categoriasRes.status);
      console.log('🔍 [fetchFinanceiroData] SubCategoriasRes.ok:', subCategoriasRes.ok, 'Status:', subCategoriasRes.status);
      console.log('🔍 [fetchFinanceiroData] Tipos recebidos:', tiposData);

      // Descobrir o ID do tipo "Receita" para ESTA empresa
      const receitaTipo = Array.isArray(tiposData)
        ? tiposData.find(t => String(t.nome).toLowerCase() === 'receita' && Number(t.company_id ?? t.empresa_id) === Number(empresaId))
        : null;
      const receitaTipoId = receitaTipo?.id ?? null;
      console.log('🔍 [fetchFinanceiroData] ReceitaTipo encontrado:', receitaTipo);
      if (!receitaTipoId) {
        console.warn('⚠️ [fetchFinanceiroData] Tipo "Receita" não encontrado para a empresa. As listas ficarão vazias.');
      }

      // Processar categorias: a rota /empresa retorna array de { tipo, tipo_id, categorias: [...] }
      // Precisamos extrair todas as categorias e manter o tipo_id delas
      let todasCategorias = [];
      if (Array.isArray(categoriasData)) {
        categoriasData.forEach(grupo => {
          if (Array.isArray(grupo.categorias)) {
            grupo.categorias.forEach(cat => {
              todasCategorias.push({
                ...cat,
                tipo_id: grupo.tipo_id // Adicionar tipo_id à categoria
              });
            });
          }
        });
      }
      console.log('🔍 [fetchFinanceiroData] Todas categorias extraídas:', todasCategorias);
      console.log('🔍 [fetchFinanceiroData] Categorias de receita pelo tipo_id da empresa:', todasCategorias.filter(c => c.tipo_id === receitaTipoId));

      // Filtrar subcategorias apenas de receita (usando o tipo_id da empresa)
      const subCategoriasReceita = Array.isArray(subCategoriasRaw) 
        ? subCategoriasRaw.filter(sub => {
            const temTipoId = sub.tipo_id !== undefined && sub.tipo_id !== null;
            const isReceita = receitaTipoId ? sub.tipo_id === receitaTipoId : false;
            console.log(`🔍 [fetchFinanceiroData] Subcategoria ${sub.id} - tipo_id: ${sub.tipo_id}, é receita? ${isReceita}`);
            return isReceita;
          })
        : [];
      
      console.log('🔍 [fetchFinanceiroData] SubCategorias de receita filtradas:', subCategoriasReceita);
      console.log('🔍 [fetchFinanceiroData] Total subcategorias receita:', subCategoriasReceita.length);

      const users = Array.isArray(usersData) ? usersData : (usersData.data || []);
      const contas = (contasData.contas || []).filter(c => !c.account);
      const contasApi = (contasData.contas || []).filter(c => c.account && String(c.account).trim() !== "");

      const financeiroDataToSet = {
        categorias: receitaTipoId ? todasCategorias.filter(c => c.tipo_id === receitaTipoId) : [],
        subCategorias: subCategoriasReceita,
        centrosCusto: Array.isArray(centrosCusto) ? centrosCusto : [],
        users,
        contas,
        contasApi,
      };

      console.log('🔍 [fetchFinanceiroData] Dados finais a serem setados:', financeiroDataToSet);
      console.log('🔍 [fetchFinanceiroData] Quantidade de categorias (receita):', financeiroDataToSet.categorias.length);
      console.log('🔍 [fetchFinanceiroData] Quantidade de subCategorias (receita):', financeiroDataToSet.subCategorias.length);

      setFinanceiroData(financeiroDataToSet);
    } catch (error) {
      console.error("Erro ao carregar dados financeiros:", error);
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoadingFinanceiro(false);
    }
  };

  // Função para obter subcategorias de receita (similar ao NovoContratoDrawer)
  // Agora já recebemos apenas subcategorias de receita filtradas, só precisamos fazer o match com categorias
  const getSubCategoriasReceita = () => {
    console.log('🔍 [getSubCategoriasReceita] Chamada. financeiroData:', financeiroData);
    const items = [];
    
    if (!financeiroData.subCategorias || !financeiroData.categorias) {
      console.log('🔍 [getSubCategoriasReceita] Retornando vazio - dados não disponíveis');
      console.log('🔍 [getSubCategoriasReceita] subCategorias existe?', !!financeiroData.subCategorias);
      console.log('🔍 [getSubCategoriasReceita] categorias existe?', !!financeiroData.categorias);
      return items;
    }
    
    console.log('🔍 [getSubCategoriasReceita] Processando subCategorias:', financeiroData.subCategorias.length);
    console.log('🔍 [getSubCategoriasReceita] Categorias disponíveis (já filtradas para receita):', financeiroData.categorias.length);
    
    financeiroData.subCategorias.forEach((subCategoria, index) => {
      console.log(`🔍 [getSubCategoriasReceita] Processando subCategoria ${index + 1}:`, subCategoria);
      
      // Tentar encontrar categoria pai pelo ID
      const categoriaPai = financeiroData.categorias.find(cat => cat.id === subCategoria.categoria_id);
      
      // Se não encontrou pela lista de categorias, usar o nome da categoria que já vem na subcategoria
      if (!categoriaPai && subCategoria.categoria_nome) {
        console.log(`🔍 [getSubCategoriasReceita] Categoria pai não encontrada por ID, mas tem categoria_nome: ${subCategoria.categoria_nome}`);
        items.push({
          id: subCategoria.id,
          nome: subCategoria.nome,
          isSubcategoria: true,
          categoria_id: subCategoria.categoria_id,
          categoria_pai_nome: subCategoria.categoria_nome, // Usar o nome que já vem da query
        });
        console.log(`🔍 [getSubCategoriasReceita] Item adicionado (usando categoria_nome):`, items[items.length - 1]);
      } else if (categoriaPai) {
        items.push({
          id: subCategoria.id,
          nome: subCategoria.nome,
          isSubcategoria: true,
          categoria_id: subCategoria.categoria_id,
          categoria_pai_nome: categoriaPai.nome,
        });
        console.log(`🔍 [getSubCategoriasReceita] Item adicionado (usando categoria pai encontrada):`, items[items.length - 1]);
      } else {
        console.log(`🔍 [getSubCategoriasReceita] Categoria pai NÃO encontrada para subCategoria com categoria_id: ${subCategoria.categoria_id}, categoria_nome: ${subCategoria.categoria_nome}`);
      }
    });

    const sorted = items.sort((a, b) => {
      const categoriaCompare = (a.categoria_pai_nome || '').localeCompare(b.categoria_pai_nome || '');
      if (categoriaCompare !== 0) return categoriaCompare;
      return a.nome.localeCompare(b.nome);
    });

    console.log('🔍 [getSubCategoriasReceita] Items finais ordenados:', sorted);
    console.log('🔍 [getSubCategoriasReceita] Quantidade de items retornados:', sorted.length);
    
    return sorted;
  };


  useEffect(() => {
    const fetchUsuario = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const userDataRaw = localStorage.getItem("userData");
        const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
        
        if (userData) {
          setUsuario({
            full_name: userData.nome || "",
            email: userData.email || "",
          });
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchUsuario();
  }, []);


  useEffect(() => {
    fetchTemplates();
    fetchClientes();
    fetchProdutos();
    fetchEmpresaEquipe();
    fetchContatos();

    // Inicializa validade com base nos 15 dias
    const hoje = new Date();
    hoje.setDate(hoje.getDate() + 15);
    const isoDate = hoje.toISOString().slice(0, 16);
    setValidade(isoDate);
  }, []);

  // Limpar datas personalizadas quando produtos personalizados forem removidos
  useEffect(() => {
    const temPersonalizado = produtosSelecionados.some(p => p.tipo === 'personalizado');
    if (!temPersonalizado) {
      setDatasPersonalizadas({});
    }
  }, [produtosSelecionados]);

  // Detectar quando um template com straton = 1 é selecionado
  useEffect(() => {
    const selectedTemplateObj = templates.find(
      (t) => t.id.toString() === selectedTemplate
    );
    
    if (selectedTemplateObj && selectedTemplateObj.straton === 1) {
      // Se o template tem straton = 1, buscar dados financeiros
      fetchFinanceiroData();
      // Preencher data de início com vigenciaInicio se não estiver preenchida
      if (!financeiroForm.dataInicio && vigenciaInicio) {
        setFinanceiroForm(prev => ({
          ...prev,
          dataInicio: new Date(vigenciaInicio + 'T00:00:00'),
          dataPrimeiraVenda: new Date(vigenciaInicio + 'T00:00:00'),
        }));
      }
      // Preencher vencimento com vigenciaInicio se não estiver preenchido
      if (!financeiroForm.vencimento && vigenciaInicio) {
        setFinanceiroForm(prev => ({
          ...prev,
          vencimento: new Date(vigenciaInicio + 'T00:00:00'),
        }));
      }
    }
  }, [selectedTemplate, templates]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincroniza os dados do cliente quando clienteSelecionado mudar
  useEffect(() => {
    if (clienteSelecionado && clientes.length > 0) {
      const clienteEncontrado = clientes.find(c => c.id.toString() === clienteSelecionado);
      if (clienteEncontrado) {
        setCliente(clienteEncontrado);
        // Preenche automaticamente o nome do documento com o padrão "Nome do Cliente - Contrato"
        setNomeDocumento(`${clienteEncontrado.nome || 'Cliente'} - Contrato`);
      }
    }
  }, [clienteSelecionado, clientes]);

  useEffect(() => {
    async function loadCustomVariables() {
      try {
        const token = localStorage.getItem("token");
        const userRaw = localStorage.getItem("userData");
        if (!userRaw || !token) return;

        const user = JSON.parse(userRaw);
        const equipeId = user.EmpresaId;
        if (!equipeId) return;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/variaveis-personalizadas/${equipeId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        setCustomVariables(data || []);
      } catch (error) {
        console.error("Erro ao carregar variáveis personalizadas:", error);
      }
    }

    loadCustomVariables();
  }, []);


  const handleLeadConvertido = async (clienteId) => {
    // Atualiza a lista de clientes após conversão
    await fetchClientes();
    setClienteSelecionado(clienteId.toString());
  };


  async function fetchTemplates() {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("userData");

    if (!token) {
      toast.warning("Token não encontrado.");
      return;
    }
    const user = JSON.parse(userRaw);

    try {
      // Buscar apenas modelos da empresa atual + globais (rota light)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/modelos-contrato/light`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          // Backend espera este header para filtrar por empresa OU globais
          "x-empresa-id": String(user?.EmpresaId || ''),
        },
      });

      if (!res.ok) throw new Error("Erro ao buscar templates.");

      const data = await res.json();
      // Filtrar templates que NÃO são de funcionário (funcionario = 0 ou null)
      const templatesContrato = (Array.isArray(data) ? data : [])
        .filter(template => template.funcionario !== 1);
      setTemplates(templatesContrato);
    } catch (err) {
      console.error("Erro ao carregar templates:", err);
    }
  }

  const handleTemplateChange = (e) => {
    const templateId = e.target.value;
    setSelectedTemplate(templateId);

    // Encontra o template correspondente e preenche o conteúdo
    const selected = templates.find((template) => template.id.toString() === templateId);
    setContent(selected ? (selected.conteudo || selected.content || "") : "");
  };


  async function fetchClientes() {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("userData");
    
    if (!userRaw) {
      console.error("userData não encontrado");
      return;
    }
    
    const user = JSON.parse(userRaw);
    const equipeId = user.EmpresaId;

    if (!equipeId) {
      console.error("EmpresaId não encontrado");
      return;
    }

    setLoadingClientes(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/pre-clientes/empresa/${equipeId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error("Erro ao buscar clientes.");

      const data = await res.json();
      setClientes(data);
    } catch (err) {
      console.error("Erro ao carregar clientes:", err);
      toast.error("Erro ao carregar lista de clientes!");
    } finally {
      setLoadingClientes(false);
    }
  }



  const fetchProdutos = async () => {
    try {
      const userRaw = localStorage.getItem("userData");
      const token = localStorage.getItem("token");

      if (!userRaw || !token) return;

      const user = JSON.parse(userRaw);
      const equipeId = user.EmpresaId;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/comercial/produtos/empresa/${equipeId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      setProdutos(data);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      toast.error("Erro ao carregar produtos!");
    }
  };


  const fetchContatos = async () => {
    try {
      const userRaw = localStorage.getItem("userData");
      const token = localStorage.getItem("token");
      
      if (!userRaw || !token) return;
      
      const user = JSON.parse(userRaw);
      const equipeId = user.EmpresaId;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/atendimento/leads/empresa/${equipeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Erro ao buscar contatos.");

      const data = await res.json();
      setContatos(data);
    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
      setContatos([]);
    }
  };


  const handleNovoSignatarioChange = (field, value) => {
    setNovoSignatario((prev) => ({ ...prev, [field]: value }));
  };

  // Nova função para adicionar ou atualizar signatário
  const handleAddOrUpdateSignatario = async () => {
    // Validação simples
    if (!novoSignatario.name.trim() || !novoSignatario.email.trim() || !novoSignatario.cpf.trim() || !novoSignatario.telefone.trim() || !novoSignatario.funcao_assinatura.trim()) {
      toast.warning("Todos os campos obrigatórios devem ser preenchidos.");
      return;
    }

    // Verificação de duplicidade por email/CPF/telefone
    if (isDuplicateSignatario(novoSignatario, editIndex)) {
      toast.warning("Já existe um signatário com o mesmo email, CPF ou telefone.");
      return;
    }
    // Se toggle ativado, salva na lista global
    if (salvarNaLista) {
      try {
        const token = localStorage.getItem("token");
        const userRaw = localStorage.getItem("userData");
        const user = userRaw ? JSON.parse(userRaw) : {};
        const equipeId = user.EmpresaId;
        
        // Mapear campos do frontend para o backend
        const dadosParaBackend = {
          nome: novoSignatario.name,
          email: novoSignatario.email,
          cpf: novoSignatario.cpf,
          data_nascimento: novoSignatario.birth_date,
          telefone: novoSignatario.telefone,
          funcao_assinatura: novoSignatario.funcao_assinatura,
          empresa_id: equipeId,
        };
        
        
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/lista-signatarios`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dadosParaBackend),
        });
        if (!res.ok) throw new Error("Erro ao salvar signatário na lista global.");
        toast.success("Signatário salvo na lista com sucesso!");
      } catch (err) {
        toast.error("Erro ao salvar signatário na lista.");
        console.error(err);
      }
    }
    if (editIndex !== null) {
      // Atualizar
      const atualizados = [...signatarios];
      atualizados[editIndex] = { ...novoSignatario };
      setSignatarios(atualizados);
      setEditIndex(null);
    } else {
      // Adicionar
      setSignatarios([...signatarios, { ...novoSignatario }]);
    }
    setNovoSignatario({ name: "", email: "", cpf: "", birth_date: "", telefone: "", funcao_assinatura: "" });
  };

  // Nova função para editar
  const handleEditSignatario = (index) => {
    setNovoSignatario({ ...signatarios[index] });
    setEditIndex(index);
  };
  // Nova função para excluir
  const handleRemoveSignatario = (index) => {
    const updated = [...signatarios];
    updated.splice(index, 1);
    setSignatarios(updated);
    // Se estava editando esse, limpa
    if (editIndex === index) {
      setNovoSignatario({ name: "", email: "", cpf: "", birth_date: "", telefone: "", funcao_assinatura: "" });
      setEditIndex(null);
    }
  };

  // Nova função para salvar signatário na lista global
  const handleSalvarSignatarioNaLista = async () => {
    if (!novoSignatario.name.trim() || !novoSignatario.email.trim() || !novoSignatario.cpf.trim() || !novoSignatario.telefone.trim() || !novoSignatario.funcao_assinatura.trim()) {
      toast.warning("Todos os campos obrigatórios devem ser preenchidos.");
      return;
    }
    if (!salvarNaLista) {
      toast.info("Ative o toggle para salvar na lista global.");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const userRaw = localStorage.getItem("userData");
      const user = userRaw ? JSON.parse(userRaw) : {};
      const equipeId = user.EmpresaId;
      
      // Mapear campos do frontend para o backend
      const dadosParaBackend = {
        nome: novoSignatario.name,
        email: novoSignatario.email,
        cpf: novoSignatario.cpf,
        data_nascimento: novoSignatario.birth_date,
        telefone: novoSignatario.telefone,
        funcao_assinatura: novoSignatario.funcao_assinatura,
        empresa_id: equipeId,
      };
      
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/lista-signatarios`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dadosParaBackend),
      });
      if (!res.ok) throw new Error("Erro ao salvar signatário na lista global.");
      toast.success("Signatário salvo na lista com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar signatário na lista.");
      console.error(err);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const token = localStorage.getItem("token");
    if (!token) {
      toast.warning("Token não encontrado.");
      setError("Você precisa estar logado para criar um contrato.");
      setLoading(false);
      return;
    }

    // NOVA VALIDAÇÃO: Não permitir criar contrato sem cliente selecionado
    if (!clienteSelecionado) {
      toast.warning("Selecione um cliente antes de criar o contrato.");
      setLoading(false);
      return;
    }

    // Verificação do modelo de contrato ou arquivo
    if (!selectedTemplate && !uploadedFile) {
      toast.warning("Por favor, selecione um modelo de contrato ou faça upload de um arquivo PDF.");
      setLoading(false);
      return;
    }

    // Verificar se não está tentando usar modelo e arquivo ao mesmo tempo
    if (selectedTemplate && uploadedFile) {
      toast.warning("Você não pode usar um modelo e fazer upload de arquivo ao mesmo tempo. Escolha apenas uma opção.");
      setLoading(false);
      return;
    }

    // Verificação específica para HTML - precisa ter template_id
    if (!uploadedFile && !selectedTemplate) {
      toast.warning("Para criar contrato HTML, é necessário selecionar um modelo de contrato.");
      setLoading(false);
      return;
    }

    // NOVA VALIDAÇÃO: Verificar se o valor do contrato foi informado quando há arquivo upado
    if (uploadedFile && (!valorContrato || parseFloat(valorContrato) <= 0)) {
      toast.warning("Informe um valor válido para o contrato antes de continuar.");
      setLoading(false);
      return;
    }

    // NOVA VALIDAÇÃO: Verificar se há variáveis personalizadas não preenchidas quando há template
    if (selectedTemplate && !uploadedFile) {
      const selectedTemplateObj = templates.find(t => t.id.toString() === selectedTemplate);
      if (selectedTemplateObj && Array.isArray(customVariables)) {
        const templateContent = selectedTemplateObj.content || selectedTemplateObj.conteudo || "";
        const customVarsInTemplate = customVariables.filter(v => 
          templateContent.includes(`{{${v.variable}}}`)
        );
        
        const unfilledVars = customVarsInTemplate.filter(v => 
          !customValues[v.variable] || customValues[v.variable].trim() === ''
        );
        
        if (unfilledVars.length > 0) {
          const varNames = unfilledVars.map(v => v.label || v.variable).join(', ');
          toast.warning(`Preencha as seguintes variáveis personalizadas antes de criar o contrato: ${varNames}`);
          setLoading(false);
          return;
        }
      }
      
      // VALIDAÇÃO: Se é Straton (straton = 1), validar campos financeiros
      if (selectedTemplateObj?.straton === 1) {
        if (!financeiroForm.categoria) {
          toast.warning("Por favor, selecione uma subcategoria de receita.");
          setLoading(false);
          return;
        }
        if (!financeiroForm.vencimento) {
          toast.warning("Por favor, selecione a data de vencimento.");
          setLoading(false);
          return;
        }
        if (!financeiroForm.contaRecebimento) {
          toast.warning("Por favor, selecione a conta de recebimento.");
          setLoading(false);
          return;
        }
      }
    }

    // Usar o estado do cliente que já foi sincronizado
    if (!cliente || Object.keys(cliente).length === 0) {
      toast.warning("Cliente não encontrado. Por favor, selecione um cliente válido.");
      setLoading(false);
      return;
    }

    // Verificação do nome do documento
    if (!nomeDocumento.trim() && !clienteSelecionado) {
      toast.warning("Por favor, informe o nome do documento ou selecione um cliente.");
      setLoading(false);
      return;
    }

    // NOVA VALIDAÇÃO: Não permitir criar contrato sem signatário
    if (signatarios.length === 0) {
      toast.warning("Adicione pelo menos um signatário antes de criar o contrato.");
      setLoading(false);
      return;
    }

    // Verificar se todos os campos obrigatórios dos signatários estão preenchidos
    const camposInvalidos = signatarios.some(s =>
      !(s.name || '').trim() ||
      !(s.email || '').trim() ||
      !(s.cpf || '').trim() ||
      !(s.telefone || '').trim() ||
      !(s.funcao_assinatura || '').trim()
    );

    if (camposInvalidos) {
      toast.warning("Todos os signatários precisam ter nome, email, CPF, telefone e função da assinatura preenchidos.");
      setLoading(false);
      return;
    }

    // Verificação específica para Autentique - CPF obrigatório
    const signatariosSemCpf = signatarios.filter(s => !s.cpf || s.cpf.trim() === '');
    if (signatariosSemCpf.length > 0) {
      toast.warning("O Autentique requer CPF válido para todos os signatários. Por favor, preencha o CPF de todos os signatários.");
      setLoading(false);
      return;
    }

    // Verificação de duplicidade entre os signatários (email/CPF/telefone)
    const seenEmails = new Set();
    const seenCpfs = new Set();
    const seenPhones = new Set();
    let hasDup = false;
    for (const s of signatarios) {
      const e = normalizeEmail(s.email);
      const c = normalizedCpf(s.cpf);
      const p = normalizedPhone(s.telefone);
      if ((e && seenEmails.has(e)) || (c && seenCpfs.has(c)) || (p && seenPhones.has(p))) {
        hasDup = true;
        break;
      }
      if (e) seenEmails.add(e);
      if (c) seenCpfs.add(c);
      if (p) seenPhones.add(p);
    }
    if (hasDup) {
      toast.warning("Existem signatários duplicados por email, CPF ou telefone. Remova as duplicidades antes de emitir.");
      setLoading(false);
      return;
    }

    // Obter o equipe_id do usuário logado
    const userRaw = localStorage.getItem("userData");
    const user = userRaw ? JSON.parse(userRaw) : {};
    const equipeId = user.EmpresaId;  // Obtendo o EmpresaId do usuário logado

    const signatariosToSend = signatarios.map(s => ({
      ...s,
      telefone: cleanPhone(s.telefone || ""),
      cpf: cleanCpf(s.cpf || "") // Limpa o CPF antes de enviar
    }));

    const valorTotalContrato = produtosSelecionados
      .reduce((total, p) => {
        const quantidade = parseFloat(p.quantidade) || 0;
        const valorUnitario = parseFloat(p.valor_de_venda) || 0;
        return total + quantidade * valorUnitario;
      }, 0);

    const nomeFinal = nomeDocumento || `${cliente.nome} - Contrato`;

    // Validação de conteúdo ou arquivo
    if (!uploadedFile && !selectedTemplate && (!content || content.trim() === '')) {
      toast.warning("Por favor, adicione conteúdo ao documento ou faça upload de um arquivo PDF antes de criar o contrato.");
      setLoading(false);
      return;
    }

    // Se há arquivo upado, validar o arquivo e enviar como base64
    try {
      let res;
      if (uploadedFile) {
        // Validar tamanho do arquivo (máximo 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (uploadedFile.size > maxSize) {
          toast.error("O arquivo é muito grande. Tamanho máximo permitido: 10MB");
          setLoading(false);
          return;
        }
        if (uploadedFile.type !== 'application/pdf') {
          toast.error("Apenas arquivos PDF são aceitos para upload.");
          setLoading(false);
          return;
        }
        // Converter PDF para base64
        const base64 = await fileToBase64(uploadedFile);
        
        // Verificar se é Straton para upload também
        const selectedTemplateObj = templates.find(t => t.id.toString() === selectedTemplate);
        const isStraton = selectedTemplateObj?.straton === 1;
        
        // Processar conta de recebimento (apenas API)
        const isApi = financeiroForm.contaRecebimento?.startsWith('api:');
        const contaApiIdParsed = isApi ? parseInt(financeiroForm.contaRecebimento.split(':')[1]) : null;
        
        // Encontrar item selecionado (categoria ou subcategoria)
        let categoriaIdFinal = null;
        let subCategoriaIdFinal = null;
        if (isStraton && financeiroForm.categoria) {
          const itemSelecionado = getSubCategoriasReceita().find(
            (item) => item.id.toString() === financeiroForm.categoria
          );
          if (itemSelecionado) {
            categoriaIdFinal = itemSelecionado.isSubcategoria
              ? itemSelecionado.categoria_id
              : itemSelecionado.id;
            subCategoriaIdFinal = itemSelecionado.isSubcategoria
              ? itemSelecionado.id
              : null;
          }
        }
        
        const payload = {
          name: nomeFinal,
          content: base64, // PDF em base64
          signatories: signatariosToSend.map(sig => ({
            name: sig.name,
            cpf: sig.cpf || null,
            email: sig.email || null,
            phone: sig.telefone || null
          })),
          empresa_id: equipeId,
          created_by: user.id,
          valor: uploadedFile ? parseFloat(valorContrato) : valorTotalContrato, // Usa valor do campo ou calculado dos produtos
          valor_recorrente: valorRecorrente ? parseFloat(valorRecorrente) : null,
          client_id: clienteSelecionado,
          expires_at: validade,
          start_at: vigenciaInicio,
          end_at: vigenciaFim,
          // Dados financeiros (Straton) - mesmo para upload
          ...(isStraton ? {
            categoria_id: categoriaIdFinal,
            sub_categoria_id: subCategoriaIdFinal,
            centro_de_custo_id: financeiroForm.centroCusto ? parseInt(financeiroForm.centroCusto) : null,
            conta_api_id: contaApiIdParsed
          } : {})
        };
        
     
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos-autentique`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } else {
        // Se há template selecionado, buscar o conteúdo do template
        let finalContent = content;
        if (selectedTemplate && !finalContent) {
          const selectedTemplateObj = templates.find(t => t.id.toString() === selectedTemplate);
          if (selectedTemplateObj) {
            finalContent = selectedTemplateObj.conteudo || selectedTemplateObj.content || "";
          }
        }
        
        // Se há template selecionado, não precisa validar o conteúdo (o template já tem)
        if (!selectedTemplate) {
          // Verifica se o conteúdo tem pelo menos algum texto significativo (não apenas tags HTML)
          const contentWithoutTags = (finalContent || "").replace(/<[^>]*>/g, '').trim();
          if (contentWithoutTags.length < 10) {
            toast.warning("Por favor, adicione mais conteúdo ao documento. O texto deve ter pelo menos 10 caracteres.");
            setLoading(false);
            return;
          }
        }
        
        // Usar o estado do cliente que já foi sincronizado
        // O cliente já está disponível no estado
        
        // Criar array de variáveis incluindo dados do cliente e contrato
        const variables = [
          // Variáveis do cliente
          { variable_name: "client.type", value: cliente?.type || "" },
          { variable_name: "client.name", value: cliente?.nome || "" },
          { variable_name: "client.cpf_cnpj", value: cliente?.cpf_cnpj || "" },
          { variable_name: "client.email", value: cliente?.email || "" },
          { variable_name: "client.telefone", value: cliente?.telefone || "" },
          { variable_name: "client.endereco", value: cliente?.endereco || "" },
          { variable_name: "client.numero", value: cliente?.numero || "" },
          { variable_name: "client.complemento", value: cliente?.complemento || "" },
          { variable_name: "client.bairro", value: cliente?.bairro || "" },
          { variable_name: "client.cidade", value: cliente?.cidade || "" },
          { variable_name: "client.estado", value: cliente?.estado || "" },
          { variable_name: "client.cep", value: cliente?.cep || "" },
          { variable_name: "client.rg", value: cliente?.rg || "" },
          { variable_name: "client.estado_civil", value: cliente?.estado_civil || "" },
          { variable_name: "client.profissao", value: cliente?.profissao || "" },
          { variable_name: "client.sexo", value: cliente?.sexo || "" },
          { variable_name: "client.nacionalidade", value: cliente?.nacionalidade || "" },
          { variable_name: "client.representante", value: cliente?.representante || "" },
          { variable_name: "client.funcao", value: cliente?.funcao || "" },
          { variable_name: "client.empresa_id", value: cliente?.empresa_id || "" },
          { variable_name: "client.created_at", value: cliente?.created_at || "" },
          // Tipo do contrato
          { variable_name: "contract.type", value: (() => {
            if (produtosSelecionados.length === 0) return "";
            const tiposUnicos = [...new Set(produtosSelecionados.map(p => p.tipo))];
            return tiposUnicos.length === 1 ? tiposUnicos[0] : "múltiplos";
          })() },
          // MRR
          { variable_name: "contract.mrr", value: (() => {
            const produtosMensais = produtosSelecionados.filter(p => p.tipo === 'mensal');
            if (produtosMensais.length === 0) return "0.00";
            const mrr = produtosMensais.reduce((total, p) => {
              const quantidade = parseFloat(p.quantidade) || 0;
              const valorUnitario = parseFloat(p.valor_de_venda) || 0;
              const parcelas = parseInt(p.parcelas) || 1;
              return total + ((quantidade * valorUnitario) / parcelas);
            }, 0);
            return mrr.toFixed(2);
          })() },
          // Dia do vencimento
          { variable_name: "contract.dia_vencimento", value: diaVencimento.toString() },
          // Data do 1º vencimento
          { variable_name: "contract.data_primeiro_vencimento", value: formatDateToBR(dataPrimeiroVencimento) },
        ];

        // Variáveis dos signatários
        if (signatariosToSend.length > 0) {
          const formattedList = signatariosToSend.map((s, i) =>
            `${i + 1}. ${s.name} - ${s.email} - CPF: ${s.cpf} - Nascimento: ${s.birth_date}`
          ).join("\n");

          const nameList = signatariosToSend.map(s => s.name).join(", ");
          const emailList = signatariosToSend.map(s => s.email).join(", ");
          const cpfList = signatariosToSend.map(s => s.cpf).join(", ");
          const birthList = signatariosToSend.map(s => formatDateToBR(s.birth_date)).join(", ");

          variables.push(
            { variable_name: "signatory.list", value: formattedList },
            { variable_name: "signatory.nameList", value: nameList },
            { variable_name: "signatory.emailList", value: emailList },
            { variable_name: "signatory.cpfList", value: cpfList },
            { variable_name: "signatory.birthList", value: birthList }
          );
        }

        // Variáveis do usuário
        variables.push(
          { variable_name: "user.full_name", value: usuario.full_name },
          { variable_name: "user.email", value: usuario.email }
        );

        // Variáveis dos produtos
        if (produtosSelecionados.length > 0) {
          const productList = produtosSelecionados.map((p, i) =>
            `${i + 1}. ${p.nome} - Quantidade: ${p.quantidade} - Descrição: ${p.descricao} - Valor de Venda: ${p.valor_de_venda}`
          ).join("\n");

          const nomeList = produtosSelecionados.map(p => p.nome).join(", ");
          const valorList = produtosSelecionados.map(p => p.valor).join(", ");
          const quantidadeList = produtosSelecionados.map(p => p.quantidade).join(", ");
          const vendaList = produtosSelecionados.map(p => p.valor_de_venda).join(", ");
          const descricaoList = produtosSelecionados
            .map(p => `${p.nome}: ${p.descricao}`)
            .join("\n\n");

          variables.push(
            { variable_name: "product.list", value: productList },
            { variable_name: "product.nomeList", value: nomeList },
            { variable_name: "product.valorList", value: valorList },
            { variable_name: "product.descricaoList", value: descricaoList },
            { variable_name: "product.valor_de_vendaList", value: vendaList }
          );
        }

        // Variáveis dos contatos
        if (contatos && contatos.length > 0) {
          const nomeList = contatos.map(c => c.nome).join(", ");
          const emailList = contatos.map(c => c.email).join(", ");
          const telefoneList = contatos.map(c => c.telefone).join(", ");
          const cpfList = contatos.map(c => c.cpf).join(", ");

          variables.push(
            { variable_name: "contact.nomeList", value: nomeList },
            { variable_name: "contact.emailList", value: emailList },
            { variable_name: "contact.telefoneList", value: telefoneList },
            { variable_name: "contact.cpfList", value: cpfList }
          );
        }

        // Valor total do contrato
        variables.push({
          variable_name: "contract.total_value",
          value: produtosSelecionados
            .reduce((total, p) => {
              const quantidade = parseFloat(p.quantidade) || 0;
              const valorUnitario = parseFloat(p.valor_de_venda) || 0;
              return total + quantidade * valorUnitario;
            }, 0)
            .toFixed(2),
        });

        // Variáveis de datas do contrato
        variables.push(
          { variable_name: "contract.expires_at", value: formatDateToBR(validade.slice(0, 10)) },
          { variable_name: "contract.start_at", value: formatDateToBR(vigenciaInicio) },
          { variable_name: "contract.end_at", value: formatDateToBR(vigenciaFim) },
          { variable_name: "contract.expira_em_dias", value: expiraEmDias.toString() },
          { variable_name: "contract.vigencia_meses", value: vigenciaMeses.toString() },
        );

        // Data de criação do contrato
        const hoje = new Date();
        const formatado = hoje.toLocaleDateString("pt-BR");
        variables.push({ variable_name: "contract.created_at", value: formatado });

        // Variáveis de empresa
        if (empresasAtivas && empresasAtivas.length > 0) {
          const nameList = empresasAtivas.map(e => e.name || '').join(', ');
          const cnpjList = empresasAtivas.map(e => e.cnpj || '').join(', ');
          const razaoSocialList = empresasAtivas.map(e => e.razao_social || '').join(', ');
          const enderecoList = empresasAtivas.map(e => e.endereco || '').join(', ');
          const numeroList = empresasAtivas.map(e => e.numero || '').join(', ');
          const complementoList = empresasAtivas.map(e => e.complemento || '').join(', ');
          const bairroList = empresasAtivas.map(e => e.bairro || '').join(', ');
          const cidadeList = empresasAtivas.map(e => e.cidade || '').join(', ');
          const estadoList = empresasAtivas.map(e => e.estado || '').join(', ');
          const cepList = empresasAtivas.map(e => e.cep || '').join(', ');
          const telefoneList = empresasAtivas.map(e => e.telefone || '').join(', ');
          
          variables.push(
            { variable_name: "company.nameList", value: nameList },
            { variable_name: "company.cnpjList", value: cnpjList },
            { variable_name: "company.razao_socialList", value: razaoSocialList },
            { variable_name: "company.enderecoList", value: enderecoList },
            { variable_name: "company.numeroList", value: numeroList },
            { variable_name: "company.complementoList", value: complementoList },
            { variable_name: "company.bairroList", value: bairroList },
            { variable_name: "company.cidadeList", value: cidadeList },
            { variable_name: "company.estadoList", value: estadoList },
            { variable_name: "company.cepList", value: cepList },
            { variable_name: "company.telefoneList", value: telefoneList }
          );
          
          // company.list geral
          const companyList = empresasAtivas.map((e, i) => `${i + 1}. ${e.name || ''} | ${e.cnpj || ''} | ${e.endereco || ''}, ${e.numero || ''} - ${e.cidade || ''}/${e.estado || ''}`).join("\n");
          variables.push({ variable_name: "company.list", value: companyList });
        }

        // Variáveis personalizadas
        Object.entries(customValues).forEach(([key, value]) => {
          variables.push({ variable_name: key, value });
        });

        // Verificar se é Straton para incluir dados financeiros
        const selectedTemplateObj = templates.find(t => t.id.toString() === selectedTemplate);
        const isStraton = selectedTemplateObj?.straton === 1;
        
        // Processar conta de recebimento (apenas API)
        const isApi = financeiroForm.contaRecebimento?.startsWith('api:');
        const contaApiIdParsed = isApi ? parseInt(financeiroForm.contaRecebimento.split(':')[1]) : null;
        
        // Encontrar item selecionado (categoria ou subcategoria)
        let categoriaIdFinal = null;
        let subCategoriaIdFinal = null;
        if (isStraton && financeiroForm.categoria) {
          const itemSelecionado = getSubCategoriasReceita().find(
            (item) => item.id.toString() === financeiroForm.categoria
          );
          if (itemSelecionado) {
            categoriaIdFinal = itemSelecionado.isSubcategoria
              ? itemSelecionado.categoria_id
              : itemSelecionado.id;
            subCategoriaIdFinal = itemSelecionado.isSubcategoria
              ? itemSelecionado.id
              : null;
          }
        }
        
        // Sem desconto: usar valor total calculado diretamente
        const valorFinal = valorTotalContrato;
        
        // Função para calcular parcelas de um produto
        // produtoIndex: índice do produto na lista produtosSelecionados
        const calcularParcelasProduto = (produto, produtoIndex) => {
          const parcelas = [];
          const quantidadeParcelas = parseInt(produto.parcelas) || 1;
          const quantidade = parseFloat(produto.quantidade) || 0;
          const valorUnitario = parseFloat(produto.valor_de_venda) || 0;
          const valorTotalProduto = quantidade * valorUnitario;
          const valorPorParcela = valorTotalProduto / quantidadeParcelas;
          const isPersonalizado = produto.tipo === 'personalizado';
          
          // Calcular índice global base: quantas parcelas há antes deste produto?
          // Considerar que a tabela mostra todas as parcelas agrupadas por tipo
          // Na prática, para mapear datasPersonalizadas, vou usar a ordem sequencial global
          // que corresponde à ordem das linhas na tabela (parcela 1, 2, 3...)
          
          // Data base inicial
          const dataBaseInicial = dataPrimeiroVencimento 
            ? new Date(dataPrimeiroVencimento + 'T00:00:00') 
            : new Date();
          
          // Função auxiliar para calcular índice global da parcela
          const calcularIndiceGlobalParcela = (parcelaLocalIndex) => {
            if (!isPersonalizado) return null;
            let indiceGlobal = 0;
            const produtosPersonalizados = produtosSelecionados.filter(p => p.tipo === 'personalizado');
            const produtosAntes = produtosPersonalizados.slice(0, produtosPersonalizados.indexOf(produto));
            produtosAntes.forEach(p => {
              indiceGlobal += parseInt(p.parcelas) || 1;
            });
            return indiceGlobal + parcelaLocalIndex;
          };

          // Função auxiliar para obter data da parcela
          // parcelaLocalIndex: índice da parcela dentro deste produto (0, 1, 2...)
          const obterDataParcela = (parcelaLocalIndex) => {
            // Calcular índice global primeiro
            const indiceGlobal = calcularIndiceGlobalParcela(parcelaLocalIndex);
            
            // Se for personalizado e tem data personalizada, usar ela
            if (isPersonalizado && indiceGlobal !== null && datasPersonalizadas[indiceGlobal]) {
              return datasPersonalizadas[indiceGlobal];
            }
            
            // Caso contrário, calcular baseado no tipo ou na parcela anterior
            let dataCalculada;
            
            if (parcelaLocalIndex === 0) {
              // Primeira parcela sempre usa a data base inicial
              dataCalculada = new Date(dataBaseInicial);
            } else {
              // Para parcelas subsequentes, tentar usar a parcela anterior como base
              // (que pode ter sido personalizada)
              const indiceGlobalAnterior = calcularIndiceGlobalParcela(parcelaLocalIndex - 1);
              let dataBase = null;
              
              // Se é personalizado e a parcela anterior tem data personalizada, usar ela como base
              if (isPersonalizado && indiceGlobalAnterior !== null && datasPersonalizadas[indiceGlobalAnterior]) {
                dataBase = new Date(datasPersonalizadas[indiceGlobalAnterior] + 'T00:00:00');
              } else if (parcelaLocalIndex > 0) {
                // Senão, calcular a parcela anterior recursivamente e usar como base
                const dataAnterior = obterDataParcela(parcelaLocalIndex - 1);
                dataBase = new Date(dataAnterior + 'T00:00:00');
              }
              
              // Se não conseguiu base, usar dataBaseInicial
              if (!dataBase) {
                dataBase = new Date(dataBaseInicial);
              }
              
              dataCalculada = new Date(dataBase);
              
              // Ajustar mês baseado no tipo
              if (produto.tipo === 'mensal') {
                dataCalculada.setMonth(dataCalculada.getMonth() + 1);
              } else if (produto.tipo === 'bimestral') {
                dataCalculada.setMonth(dataCalculada.getMonth() + 2);
              } else if (produto.tipo === 'trimestral') {
                dataCalculada.setMonth(dataCalculada.getMonth() + 3);
              } else if (produto.tipo === 'semestral') {
                dataCalculada.setMonth(dataCalculada.getMonth() + 6);
              } else if (produto.tipo === 'anual') {
                dataCalculada.setFullYear(dataCalculada.getFullYear() + 1);
              } else if (produto.tipo === 'personalizado') {
                // Para personalizado sem data personalizada, adicionar 1 mês da parcela anterior
                dataCalculada.setMonth(dataCalculada.getMonth() + 1);
              }
              
              // Ajustar para o dia de vencimento
              dataCalculada.setDate(diaVencimento);
            }
            
            return formatDateForInput(dataCalculada);
          };
          
          // Calcular índice global para verificar se é personalizado
          const calcularIndiceGlobal = (parcelaLocalIndex) => {
            const produtosPersonalizados = produtosSelecionados.filter(p => p.tipo === 'personalizado');
            const produtosAntes = produtosPersonalizados.slice(0, produtosPersonalizados.indexOf(produto));
            let indiceGlobal = 0;
            produtosAntes.forEach(p => {
              indiceGlobal += parseInt(p.parcelas) || 1;
            });
            return indiceGlobal + parcelaLocalIndex;
          };
          
          for (let i = 0; i < quantidadeParcelas; i++) {
            const dataVencimento = obterDataParcela(i);
            const indiceGlobal = isPersonalizado ? calcularIndiceGlobal(i) : null;
            const temDataPersonalizada = isPersonalizado && indiceGlobal !== null && !!datasPersonalizadas[indiceGlobal];
            
            parcelas.push({
              numero: i + 1,
              data_vencimento: dataVencimento,
              valor: Number(valorPorParcela.toFixed(2)),
              personalizado: isPersonalizado && temDataPersonalizada
            });
          }
          
          return parcelas;
        };
        
        // Preparar produtos com parcelas
        const produtosComParcelas = produtosSelecionados.map((produto, produtoIndex) => {
          const quantidade = parseFloat(produto.quantidade) || 0;
          const valorUnitario = parseFloat(produto.valor_de_venda) || 0;
          const valorTotal = quantidade * valorUnitario;
          const parcelas = calcularParcelasProduto(produto, produtoIndex);
          
          return {
            id: produto.id,
            nome: produto.nome || produto.name || 'Produto sem nome',
            codigo: produto.codigo || null,
            descricao: produto.descricao || null,
            tipo: produto.tipo,
            quantidade: produto.quantidade || 1,
            valor_de_venda: produto.valor_de_venda || produto.valor || 0,
            valor_total: Number(valorTotal.toFixed(2)),
            parcelas: produto.parcelas || 1,
            parcelas_detalhadas: parcelas,
            total_parcelas: parcelas.length,
            tipo_produto: produto.tipo
          };
        });
        
        console.log('🔍 [Frontend] produtosComParcelas preparados:', produtosComParcelas);
        console.log('🔍 [Frontend] produtosComParcelas length:', produtosComParcelas.length);
        console.log('🔍 [Frontend] produtosComParcelas JSON:', JSON.stringify(produtosComParcelas));

        // Envio do HTML usando a nova rota /html
        const payload = {
          template_id: selectedTemplate,
          client_id: clienteSelecionado,
          signatories: signatariosToSend,
          variables: variables,
          empresa_id: equipeId,
          valor: valorFinal,
          valor_recorrente: (() => {
            const produtosMensais = produtosSelecionados.filter(p => p.tipo === 'mensal');
            if (produtosMensais.length === 0) return 0;
            const mrr = produtosMensais.reduce((total, p) => {
              const quantidade = parseFloat(p.quantidade) || 0;
              const valorUnitario = parseFloat(p.valor_de_venda) || 0;
              const parcelas = parseInt(p.parcelas) || 1;
              return total + ((quantidade * valorUnitario) / parcelas);
            }, 0);
            return Number(mrr.toFixed(2));
          })(),
          expires_at: validade,
          start_at: vigenciaInicio,
          end_at: vigenciaFim,
          produtos_dados: produtosComParcelas,
          // Dados financeiros (Straton)
          ...(isStraton ? {
            categoria_id: categoriaIdFinal,
            sub_categoria_id: subCategoriaIdFinal,
            centro_de_custo_id: financeiroForm.centroCusto ? parseInt(financeiroForm.centroCusto) : null,
            conta_api_id: contaApiIdParsed
          } : {})
        };
        
  

        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos-autentique/html`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

              if (!res.ok) {
          const errorText = await res.text();
          console.error("Erro ao criar contrato (detalhe):", errorText);
          console.error("Status da resposta:", res.status);
          console.error("Headers da resposta:", Object.fromEntries(res.headers.entries()));
          
          // Tenta parsear como JSON para mostrar erro mais específico
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error) {
              throw new Error(`Erro do backend: ${errorJson.error}`);
            } else if (errorJson.message) {
              throw new Error(`Erro do backend: ${errorJson.message}`);
            }
          } catch (e) {
            // Se não conseguir parsear como JSON, usa o texto original
            console.error("Erro ao parsear resposta como JSON:", e);
          }
          
          throw new Error(`Erro ao criar contrato no Autentique (Status: ${res.status}). Verifique se o arquivo é válido e tente novamente.`);
        }

      const responseData = await res.json();
      
      // Trata resposta diferente baseado na rota
      if (uploadedFile) {
        // Rota original para PDF
        const { autentique_id } = responseData;
      setCreatedContractId(autentique_id);
      toast.success("Contrato criado no Autentique com sucesso!");
      } else {
        // Nova rota /html
        const { contract_id, autentique_id } = responseData;
        setCreatedContractId(autentique_id);
        toast.success("Contrato HTML criado, convertido para PDF e enviado para Autentique!");
      }
      
        setTimeout(() => router.push(`/contratual/contrato/${responseData.contract_id}`), 1200);
    } catch (err) {
      toast.error("Erro ao criar contrato.");
      console.error(err);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleClienteCriado = async (clientId) => {
    
    if (!clientId) {
      console.error("ClientId não fornecido");
      toast.error("Erro ao criar cliente: ID não encontrado");
      return;
    }

    // Garantir que clientId seja uma string ou número
    const clientIdStr = String(clientId);

    await fetchClientes();

    const token = localStorage.getItem("token");
    const url = `${process.env.NEXT_PUBLIC_API_URL}/comercial/pre-clientes/${clientIdStr}`;
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) {
      console.error("Erro ao buscar cliente criado:", res.status, res.statusText);
      toast.error("Cliente criado, mas erro ao carregar dados");
      setShowClienteModal(false);
      setShowClienteFormModal(false);
      setActiveTab("documento");
      return;
    }
    
    const clienteData = await res.json();

    setCliente(clienteData);
    setClienteSelecionado(clientIdStr);
    // Preenche automaticamente o nome do documento com o padrão "Nome do Cliente - Contrato"
    setNomeDocumento(`${clienteData.nome || 'Cliente'} - Contrato`);
    setShowClienteModal(false);
    setShowClienteFormModal(false);
    setActiveTab("documento");
  };

  useEffect(() => {
    const fetchLead = async () => {
      if (!lead_id) return;
      const token = localStorage.getItem("token");

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/leads/${lead_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Erro ao buscar lead");

        const lead = await res.json();
        setLeadSelecionado(lead);
        setShowLeadToClientForm(true); // abrir automaticamente o modal
      } catch (error) {
        console.error("Erro ao buscar lead:", error);
      }
    };

    fetchLead();
  }, [lead_id]);




  const handleAddSignatarios = (novosSelecionados) => {
    const atualizados = [...signatarios];

    novosSelecionados.forEach((novo, index) => {
      // Verifica se já existe um signatário com mesmo CPF ou email
      const jaExiste = atualizados.some(
        (s) => s.cpf === novo.cpf
      );
      if (jaExiste) {
        return;
      }

      // Normaliza a data se necessário
      let dataConvertida = "";
      if (novo.birth_date) {
        const data = new Date(novo.birth_date);
        if (!isNaN(data)) {
          dataConvertida = data.toISOString().split("T")[0]; // yyyy-mm-dd
        } else {
          console.warn("Data inválida detectada:", novo.birth_date);
        }
      }

      const signatarioFormatado = {
        ...novo,
        birth_date: dataConvertida,
      };

      // Procura um campo completamente vazio
      const campoVazioIndex = atualizados.findIndex(
        (s) => !s.name && !s.email && !s.cpf && !s.birth_date
      );

      if (campoVazioIndex !== -1) {
        atualizados[campoVazioIndex] = signatarioFormatado;
      } else {
        atualizados.push(signatarioFormatado);
      }
    });

    setSignatarios(atualizados);
  };


  const buscarContratoGerado = async () => {
    const token = localStorage.getItem("token");
    if (!createdContractId || !token) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos-autentique/${createdContractId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Erro ao buscar contrato no Autentique");

      const data = await res.json();
      // O Autentique retorna dados diferentes, então vamos apenas logar por enquanto
    } catch (err) {
      console.error("Erro ao buscar contrato no Autentique:", err);
    }
  };

  useEffect(() => {
    if (createdContractId) {
      buscarContratoGerado();
    }
  }, [createdContractId]);


  function maskPhoneBR(value) {
    // Remove tudo que não for número, exceto o 55 inicial
    let v = (value || "").replace(/\D/g, "");

    // Garante que começa com 55
    if (!v.startsWith("55")) v = "55" + v;

    // Remove o 55 apenas para mascarar o resto
    let rest = v.slice(2);

    // Aplica máscara para o restante
    if (rest.length > 11) rest = rest.slice(0, 11);

    let masked;
    if (rest.length <= 10)
      masked = rest.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
    else
      masked = rest.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");

    return "+55 " + masked;
  }



  function cleanPhone(value) {
    let v = (value || "").replace(/\D/g, "");
    if (!v.startsWith("55")) v = "55" + v;
    return v;
  }


  // Função para aplicar máscara de CPF (000.000.000-00)
  function maskCpfBR(value) {
    let v = (value || "").replace(/\D/g, "");
    v = v.slice(0, 11); // Limita a 11 dígitos
    if (v.length <= 3) return v;
    if (v.length <= 6) return v.replace(/(\d{3})(\d+)/, "$1.$2");
    if (v.length <= 9) return v.replace(/(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4");
  }

  // Função para limpar CPF (deixar só números)
  function cleanCpf(value) {
    return (value || "").replace(/\D/g, "");
  }

  // Normalização para comparação de duplicidade
  function normalizeEmail(value) {
    return (value || "").trim().toLowerCase();
  }
  function normalizedCpf(value) {
    return cleanCpf(value || "");
  }
  function normalizedPhone(value) {
    return cleanPhone(value || "");
  }

  function isDuplicateSignatario(candidate, indexToIgnore = null) {
    const candEmail = normalizeEmail(candidate.email);
    const candCpf = normalizedCpf(candidate.cpf);
    const candPhone = normalizedPhone(candidate.telefone);
    return signatarios.some((s, idx) => {
      if (indexToIgnore !== null && idx === indexToIgnore) return false;
      const sEmail = normalizeEmail(s.email);
      const sCpf = normalizedCpf(s.cpf);
      const sPhone = normalizedPhone(s.telefone);
      return (
        (candEmail && sEmail && candEmail === sEmail) ||
        (candCpf && sCpf && candCpf === sCpf) ||
        (candPhone && sPhone && candPhone === sPhone)
      );
    });
  }


  const opcoesFuncaoAssinatura = [
    'Aprovador',
    'Assinar como parte',
    'Assinar como testemunha',
    'Assinar como administrador',
    'Assinar como avalista',
    'Assinar como contador',
    'Assinar como cedente',
    'Assinar como cessionário',
    'Assinar como contratada',
    'Assinar como contratante',
    'Assinar como devedor',
    'Assinar como emitente',
    'Assinar como outorgante',
    'Assinar como locador',
    'Assinar como locatário',
    'Assinar como outorgado',
    'Assinar como endossante',
    'Assinar como endossatário',
    'Assinar como gestor',
    'Assinar como interveniente',
    'Assinar como parte compradora',
    'Assinar como parte vendedora',
    'Assinar como procurador',
    'Assinar como advogado',
    'Assinar como representante legal',
    'Assinar como responsável solidário',
    'Assinar como validador',
    'Assinar para acusar recebimento',
    'Assinar como segurado',
    'Assinar como proponente',
    'Assinar como corretor'
  ];


  const etapas = ["cliente", "documento", "servicos", "signatarios", "outras", "gerar"];

  // Função para determinar quais abas devem ser mostradas baseado na seleção
  const getVisibleEtapas = () => {
    const etapasBase = ["cliente", "documento"];
    
    if (uploadedFile) {
      // Se há arquivo upado, mostra aba de valor (sem "outras" pois não há variáveis personalizadas)
      return [...etapasBase, "valor", "signatarios", "gerar"];
    } else if (selectedTemplate) {
      // Se há template selecionado, mostra aba de serviços e outras informações
      return [...etapasBase, "servicos", "signatarios", "outras", "gerar"];
    } else {
      // Se não há nenhum, mostra apenas as básicas
      return [...etapasBase, "signatarios", "outras", "gerar"];
    }
  };

  const etapasVisiveis = getVisibleEtapas();

  // Função para navegar entre abas, pulando as ocultas
  const changeTab = (tab) => {
    // Se está tentando ir para uma aba que não está visível, pula para a próxima visível
    if (!etapasVisiveis.includes(tab)) {
      const currentIndex = etapasVisiveis.indexOf(activeTab);
      const nextTab = etapasVisiveis[currentIndex + 1] || etapasVisiveis[0];
      setActiveTab(nextTab);
      return;
    }
    
    // Validação para aba "cliente" - não pode avançar sem selecionar cliente
    if (activeTab === "cliente" && !clienteSelecionado) {
      toast.warning("Selecione um cliente antes de continuar.");
      return;
    }
    
    // Validação para aba "documento" - não pode avançar sem selecionar modelo ou fazer upload
    if (activeTab === "documento" && !selectedTemplate && !uploadedFile) {
      toast.warning("Selecione um modelo de contrato ou faça upload de um arquivo PDF antes de continuar.");
      return;
    }
    
    // Validação para aba "servicos" - não pode avançar sem produtos
    if (tab === "signatarios" && activeTab === "servicos" && produtosSelecionados.length === 0) {
      toast.warning("Adicione pelo menos um produto/serviço antes de continuar para os signatários.");
      return;
    }
    
    // Validação para aba "signatarios" - não pode avançar sem signatários
    if (activeTab === "signatarios" && signatarios.length === 0) {
      toast.warning("Adicione pelo menos um signatário antes de continuar.");
      return;
    }
    
    setActiveTab(tab);
    setShowClienteModal(false);
    setShowClienteFormModal(false);
  };

  // Função para ir para a próxima aba visível
  const nextTab = () => {
    const currentIndex = etapasVisiveis.indexOf(activeTab);
    const nextTab = etapasVisiveis[currentIndex + 1];
    
    // Validação para aba "cliente" - não pode avançar sem selecionar cliente
    if (activeTab === "cliente" && !clienteSelecionado) {
      toast.warning("Selecione um cliente antes de continuar.");
      return;
    }
    
    // Validação para aba "documento" - não pode avançar sem selecionar modelo ou fazer upload
    if (activeTab === "documento" && !selectedTemplate && !uploadedFile) {
      toast.warning("Selecione um modelo de contrato ou faça upload de um arquivo PDF antes de continuar.");
      return;
    }
    
    // Validação para aba "servicos" - não pode avançar sem produtos
    if (activeTab === "servicos" && nextTab === "signatarios" && produtosSelecionados.length === 0) {
      toast.warning("Adicione pelo menos um produto/serviço antes de continuar para os signatários.");
      return;
    }
    
    // Validação para aba "signatarios" - não pode avançar sem signatários
    if (activeTab === "signatarios" && signatarios.length === 0) {
      toast.warning("Adicione pelo menos um signatário antes de continuar.");
      return;
    }
    
    if (nextTab) {
      setActiveTab(nextTab);
    }
  };

  // Função para ir para a aba anterior visível
  const prevTab = () => {
    const currentIndex = etapasVisiveis.indexOf(activeTab);
    const prevTab = etapasVisiveis[currentIndex - 1];
    if (prevTab) {
      setActiveTab(prevTab);
    }
  };

  useEffect(() => {
    // Detecta se é clonagem
    if (router.query.clone === "1") {
      const cloneDataRaw = localStorage.getItem("cloneContratoData");
      
      if (cloneDataRaw) {
        try {
          const cloneData = JSON.parse(cloneDataRaw);
          
          // Preenche os campos principais usando os nomes CORRETOS da API
          if (!clienteSelecionado && cloneData.pre_cliente_id) {
            setClienteSelecionado(cloneData.pre_cliente_id.toString());
          }
          
          if (!selectedTemplate && cloneData.modelos_contrato_id) {
            setSelectedTemplate(cloneData.modelos_contrato_id.toString());
          }
          
          if (!content && cloneData.conteudo) {
            setContent(cloneData.conteudo);
          }
          
          if (cloneData.expirado_em) {
            const dataFormatada = formatDateToInput(cloneData.expirado_em);
            setValidade(dataFormatada);
          }
          
          if (cloneData.comeca_em) {
            const dataFormatada = formatDateToInput(cloneData.comeca_em);
            setVigenciaInicio(dataFormatada);
          }
          
          if (cloneData.termina_em) {
            const dataFormatada = formatDateToInput(cloneData.termina_em);
            setVigenciaFim(dataFormatada);
          }
          
          // Clone valor do contrato se existir
          if (cloneData.valor) {
            setValorContrato(cloneData.valor.toString());
          }
          
          // Clone valor recorrente se existir
          if (cloneData.valor_recorrente) {
            setValorRecorrente(cloneData.valor_recorrente.toString());
          }
          
          // Clona signatários (transforma de signatarios para o formato esperado)
          if (!signatarios.length && cloneData.signatories && cloneData.signatories.length > 0) {
            // Remove campos desnecessários e ajusta formato
            const signatoriesCloned = cloneData.signatories.map(sig => ({
              name: sig.nome,
              email: sig.email,
              cpf: sig.cpf || '',
              birth_date: sig.data_nascimento || '',
              telefone: sig.telefone || '',
              funcao_assinatura: sig.funcao_assinatura || ''
            }));
            setSignatarios(signatoriesCloned);
          }
          
          toast.success("Contrato carregado! Revise os dados antes de salvar.");
          
          // Limpa o localStorage após uso
          localStorage.removeItem("cloneContratoData");
        } catch (e) {
          toast.error("Erro ao processar dados do contrato clonado.");
          // Se der erro, limpa para não travar futuras criações
          localStorage.removeItem("cloneContratoData");
        }
      } else {
      }
    }
    // Detecta se é carregamento de rascunho
    else if (router.query.rascunho && !rascunhoCarregado) {
      setRascunhoCarregado(true); // Marca como carregado para evitar múltiplas chamadas
      carregarRascunho(router.query.rascunho);
    }
  }, [router.query.clone, router.query.rascunho, router.isReady, rascunhoCarregado]);


  // Remover interceptação de rotas - usar apenas botão Voltar

  // Adicionar função utilitária para formatar datas
  function formatDateToInput(dateStr) {
    if (!dateStr) return "";
    // Se já está no formato yyyy-MM-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // Se está no formato ISO
    const d = new Date(dateStr);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
    // Se está no formato dd/MM/yyyy
    const parts = dateStr.split("/");
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    return "";
  }

  function formatDateTimeToInput(dateStr) {
    if (!dateStr) return "";
    // Se está no formato ISO com hora
    const d = new Date(dateStr);
    if (!isNaN(d)) {
      // Formatar para datetime-local (YYYY-MM-DDTHH:MM)
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    return "";
  }
  function formatDateToBR(dateStr) {
    if (!dateStr) return "";
    // yyyy-MM-dd para dd/MM/yyyy
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-");
      return `${d}/${m}/${y}`;
    }
    // ISO
    const d = new Date(dateStr);
    if (!isNaN(d)) {
      return d.toLocaleDateString("pt-BR");
    }
    // Se já está em dd/MM/yyyy
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
    return "";
  }

  // Utilitário simples para adicionar dias
  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  // Função para formatar Date para input
  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d)) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Função para converter valor brasileiro para número (para desconto)
  const parseValorBrasileiro = (valor) => {
    if (!valor) return 0;
    let valorLimpo = valor.replace(/[^\d.,]/g, '');
    if (valorLimpo.includes(',') && valorLimpo.includes('.')) {
      const ultimaVirgula = valorLimpo.lastIndexOf(',');
      const ultimoPonto = valorLimpo.lastIndexOf('.');
      if (ultimaVirgula > ultimoPonto) {
        valorLimpo = valorLimpo.replace(/\./g, '').replace(',', '.');
      } else {
        valorLimpo = valorLimpo.replace(/,/g, '');
      }
    } else if (valorLimpo.includes(',')) {
      const partes = valorLimpo.split(',');
      if (partes.length === 2 && partes[1].length <= 2) {
        valorLimpo = valorLimpo.replace(',', '.');
      } else {
        valorLimpo = valorLimpo.replace(/,/g, '');
      }
    }
    return parseFloat(valorLimpo) || 0;
  };

  const renderLabel = (text, obrigatorio = false) => (
    <label>
      {text} {obrigatorio && <span style={{color: 'red'}}>*</span>}
    </label>
  );

  return (
    <div className={styles.page}>
      <PrincipalSidebar />
      <div className={styles.pageContent}>
        <div className={styles.headerLine}>
          <h1 className={styles.title}>Criar Novo Contrato</h1>
          <div className={styles.headerActions}>
            {/* Botão de voltar */}
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                if (verificarMudancas()) {
                  setShowExitModal(true);
                } else {
                  router.push('/contratual/contratos');
                }
              }}
              style={{ 
                background: "#6b7280", 
                marginRight: "10px"
              }}
            >
              <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: '6px' }} />
              Voltar
            </button>
            
            {/* Botão de salvar rascunho */}
            <button
              type="button"
              className={styles.button}
              onClick={() => salvarRascunho(false)}
              disabled={salvandoRascunho}
              style={{ 
                background: "#10b981", 
                marginRight: "10px",
                opacity: salvandoRascunho ? 0.6 : 1 
              }}
            >
              <FontAwesomeIcon icon={faCheckCircle} style={{ marginRight: '6px' }} />
              {salvandoRascunho ? "Salvando..." : "Salvar Rascunho"}
            </button>
          </div>
        </div>
        

        {/* Indicador de mudanças não salvas */}
        {verificarMudancas() && !rascunhoId && (
          <div className={styles.infoContainer} style={{ background: '#fef3c7', border: '1px solid #f59e0b' }}>
            <FontAwesomeIcon icon={faExclamationTriangle} className={styles.infoIcon} style={{ color: '#f59e0b' }} />
            <span className={styles.infoText} style={{ color: '#92400e' }}>
              <strong>Alterações não salvas:</strong> Você tem alterações que ainda não foram salvas. Use o botão "Salvar Rascunho" para salvar seu progresso.
            </span>
          </div>
        )}
        
      {error && <p className={styles.error}>{error}</p>}
      {successMessage && <p className={styles.success}>{successMessage}</p>}

      <div className={styles.tabsWrapper}>
        <div className={styles.tabs}>
          {etapasVisiveis.map((etapa) => (
            <button 
              key={etapa}
              className={activeTab === etapa ? styles.active : ""} 
              onClick={() => changeTab(etapa)}
            >
              {etapa === "cliente" && "Cliente"}
              {etapa === "documento" && "Dados do Documento"}
              {etapa === "servicos" && "Serviços e Produtos"}
              {etapa === "valor" && "Valor do Contrato"}
              {etapa === "signatarios" && "Signatários"}
              {etapa === "outras" && "Outras Informações"}
              {etapa === "gerar" && "Gerar Contrato"}
            </button>
          ))}
        </div>

        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${((etapasVisiveis.indexOf(activeTab) + 1) / etapasVisiveis.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {activeTab === "cliente" && (
        <div>
          <div className={styles.headerLine}>
            <h2 className={styles.tituloComIcone}><FontAwesomeIcon icon={faUser} style={{ marginRight: 8, color: '#2563eb' }} />Selecionar Cliente</h2>
            <button
              className={styles.button}
              style={{ background: "#0070f3", marginLeft: "10px" }}
              onClick={() => setShowLeadsModal(true)}
            >
              Buscar no CRM
            </button>
          </div>

          <div className={styles.clientSelection}>
            <select
              className={styles.select}
              onChange={(e) => {
                const clienteId = e.target.value;
                const clienteEncontrado = clientes.find(c => c.id.toString() === clienteId);
                setClienteSelecionado(clienteId);
                
                // Se cliente existe, define os dados do cliente
                if (clienteEncontrado) {
                  setCliente(clienteEncontrado);
                  // Preenche automaticamente o nome do documento com o padrão "Nome do Cliente - Contrato"
                  setNomeDocumento(`${clienteEncontrado.nome || clienteEncontrado.name || clienteEncontrado.razao_social || 'Cliente'} - Contrato`);
                  setShowClienteFormModal(true);
                } else {
                  setCliente({}); // Objeto vazio para evitar undefined
                  setShowClienteModal(true);
                }
              }}
              value={clienteSelecionado || ""}
              disabled={loadingClientes}
            >
              <option value="" disabled>
                {loadingClientes ? "Carregando clientes..." : "Selecione um cliente..."}
              </option>
              {clientes && clientes.length > 0 ? (
                clientes.map((c) => {
                  // Debug: verificar campos disponíveis
                  const nomeCliente = c.nome || c.name || c.razao_social || `Cliente ${c.id}`;
                  return (
                    <option key={c.id} value={c.id}>
                      {nomeCliente}
                    </option>
                  );
                })
              ) : (
                !loadingClientes && <option value="" disabled>Nenhum cliente encontrado</option>
              )}
            </select>
          </div>
        </div>
      )}


      {activeTab === "documento" && (
        <div>
          <h2 className={styles.tituloComIcone}><FontAwesomeIcon icon={faFileAlt} style={{ marginRight: 8, color: '#2563eb' }} />Dados do Documento</h2>

          <div className={styles.documentCardsContainer}>
            {/* Card 1: Escolha do Documento */}
            <div className={styles.documentCard}>
              <h3>Escolha o Documento</h3>
              <div className={styles.documentCardContent}>
            
                {/* Opção 1: Modelo de contrato */}
                <div className={`${styles.choiceOption} ${selectedTemplate ? styles.choiceOptionActive : ''}`}>
                  <div className={styles.choiceHeader}>
                    <div className={styles.choiceIcon}>
                      <FontAwesomeIcon icon={faFileAlt} />
                    </div>
                    <div className={styles.choiceTitle}>
                      <h4>Modelo de Contrato</h4>
                      <p>Use um template pré-configurado</p>
                    </div>
                  </div>
                  
                  <div className={styles.choiceContent}>
                    <select 
                      className={styles.templateSelect} 
                      onChange={handleTemplateChangeWithWarning} 
                      value={selectedTemplate || ""}
                    >
                      <option value="">Selecione um modelo...</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.nome || t.name}</option>
                      ))}
                    </select>
                    
                    {selectedTemplate && (
                      <div className={styles.selectedTemplateInfo}>
                        <FontAwesomeIcon icon={faCheckCircle} style={{ color: '#10b981', marginRight: '8px' }} />
                        <span>Modelo selecionado</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Separador Visual */}
                <div className={styles.choiceDivider}>
                  <div className={styles.dividerLine}></div>
                  <div className={styles.dividerText}>OU</div>
                  <div className={styles.dividerLine}></div>
                </div>

                {/* Opção 2: Upload de Arquivo */}
                <div className={`${styles.choiceOption} ${uploadedFile ? styles.choiceOptionActive : ''}`}>
                  <div className={styles.choiceHeader}>
                    <div className={styles.choiceIcon}>
                      <FontAwesomeIcon icon={faCloudUploadAlt} />
                    </div>
                    <div className={styles.choiceTitle}>
                      <h4>Upload de Arquivo</h4>
                      <p>Envie um PDF personalizado</p>
                    </div>
                  </div>
                  
                  <div className={styles.choiceContent}>
                    <div 
                      className={`${styles.uploadArea} ${uploadedFile ? styles.uploadAreaActive : ''}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      {!uploadedFile ? (
                        <div className={styles.uploadPlaceholder}>
                          <FontAwesomeIcon 
                            icon={faCloudUploadAlt} 
                            className={styles.uploadIcon}
                          />
                          <p className={styles.uploadText}>
                            Arraste e solte um PDF aqui
                          </p>
                          <p className={styles.uploadSubtext}>
                            ou clique para selecionar
                          </p>
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileUpload}
                            className={styles.fileInput}
                            id="file-upload"
                          />
                          <label 
                            htmlFor="file-upload"
                            className={styles.uploadButton}
                          >
                            Selecionar PDF
                          </label>
                        </div>
                      ) : (
                        <div className={styles.uploadedFileInfo}>
                          <FontAwesomeIcon 
                            icon={faFileAlt} 
                            className={styles.fileIcon}
                          />
                          <div className={styles.fileDetails}>
                            <p className={styles.fileName}>
                              {uploadFileName.length > 25 ? uploadFileName.substring(0, 25) + '...' : uploadFileName}
                            </p>
                            <p className={styles.fileSize}>
                              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button
                            onClick={handleRemoveFile}
                            className={styles.removeFileButton}
                            title="Remover arquivo"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className={styles.uploadInfo}>
                      <FontAwesomeIcon icon={faInfoCircle} style={{ marginRight: '6px', color: '#6b7280' }} />
                      <span>Apenas arquivos PDF.</span>
                    </div>
                  </div>
                </div>

                {/* Aviso de Conflito */}
                {showUploadWarning && (
                  <div className={styles.warningMessage}>
                    <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: '8px' }} />
                    <span>
                      <strong>Atenção:</strong> Você selecionou um modelo E fez upload de um arquivo. 
                      O arquivo enviado terá prioridade sobre o modelo selecionado.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Dados do Documento */}
            <div className={styles.documentCard}>
              <h3>Dados do Documento</h3>
              <div className={styles.documentCardContent}>
                
                {/* Nome do Documento */}
                <div>
                  <label className={styles.label}>Nome do Documento</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder={`${cliente?.nome || 'Cliente'} - Contrato`}
                    value={nomeDocumento || ""}
                    onChange={(e) => setNomeDocumento(e.target.value)}
                    style={{ width: '100%' }}
                  />
                  <small style={{ color: '#666', fontSize: '12px' }}>
                    Deixe em branco para usar o nome padrão: "{cliente?.nome || 'Cliente'} - Contrato"
                  </small>
                </div>

                {/* Expiração */}
                <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <label className={styles.label}>Expira em</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input
                        className={styles.input}
                        type="number"
                        value={expiraEmDias || 15}
                        onChange={(e) => {
                          const dias = parseInt(e.target.value) || 0;
                          setExpiraEmDias(dias);
                          const novaData = new Date();
                          novaData.setDate(novaData.getDate() + dias);
                          setValidade(novaData.toISOString().slice(0, 16));
                        }}
                      />
                      <span>Dias</span>
                    </div>
                  </div>

                  <div style={{ flex: 2 }}>
                    <label className={styles.label}>Data da Expiração</label>
                    <input
                      className={styles.input}
                      type="datetime-local"
                      value={validade || ""}
                      onChange={(e) => {
                        const novaValidade = e.target.value;
                        setValidade(novaValidade);

                        const hoje = new Date();
                        const dataSelecionada = new Date(novaValidade);
                        const diffMs = dataSelecionada - hoje;
                        const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                        setExpiraEmDias(diffDias);
                      }}
                    />
                  </div>
                </div>

                {/* Vigência */}
                <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <label className={styles.label}>Data de Início da Vigência</label>
                    <input
                      className={styles.input}
                      type="date"
                      value={vigenciaInicio || ""}
                      onChange={(e) => {
                        const novaDataInicio = e.target.value;
                        setVigenciaInicio(novaDataInicio);

                        const inicio = new Date(novaDataInicio);
                        const fim = new Date(inicio);
                        fim.setMonth(fim.getMonth() + vigenciaMeses);
                        setVigenciaFim(fim.toISOString().slice(0, 10));
                      }}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label className={styles.label}>Vigência em Meses</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input
                        className={styles.input}
                        type="number"
                        value={vigenciaMeses || 12}
                        onChange={(e) => {
                          const meses = parseInt(e.target.value) || 0;
                          setVigenciaMeses(meses);

                          const inicio = new Date(vigenciaInicio);
                          const fim = new Date(inicio);
                          fim.setMonth(fim.getMonth() + meses);
                          setVigenciaFim(fim.toISOString().slice(0, 10));
                        }}
                      />
                      <span>Meses</span>
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label className={styles.label}>Data Final da Vigência</label>
                    <input
                      className={styles.input}
                      type="date"
                      value={vigenciaFim || ""}
                      readOnly
                    />
                  </div>
                </div>
                
              </div>
            </div>
          </div>

        </div>
      )}


      {activeTab === "valor" && (
        <div>
          <h2 className={styles.tituloComIcone}><FontAwesomeIcon icon={faRocket} style={{ marginRight: 8, color: '#2563eb' }} />Valor do Contrato</h2>
          
          {/* Aviso sobre usar o gerador de documentos */}
          <div style={{ 
            background: '#fef3c7', 
            border: '1px solid #f59e0b', 
            borderRadius: '8px', 
            padding: '16px', 
            marginBottom: '24px',
            color: '#92400e'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <FontAwesomeIcon icon={faInfoCircle} style={{ color: '#f59e0b' }} />
              <strong>Atenção</strong>
            </div>
            <p style={{ margin: 0, fontSize: '14px' }}>
              <strong>Aconselhamos usar o gerador de documentos</strong> pois ele tem mais vínculos com o sistema. 
              O upload de arquivos é mais um recurso complementar.
            </p>
          </div>

          <div className={styles.grid}>
            <div>
              {renderLabel('Valor do Contrato (TCV)', true)}
              <input
                className={styles.input}
                type="text"
                placeholder="R$ 0,00"
                value={valorContrato}
                onChange={(e) => {
                  // Remove tudo que não for número, vírgula ou ponto
                  let value = e.target.value.replace(/[^\d,.]/g, '');
                  
                  // Converte vírgula para ponto para cálculos
                  value = value.replace(',', '.');
                  
                  // Permite apenas um ponto decimal
                  const parts = value.split('.');
                  if (parts.length > 2) {
                    value = parts[0] + '.' + parts.slice(1).join('');
                  }
                  
                  // Limita a 2 casas decimais
                  if (parts.length === 2 && parts[1].length > 2) {
                    value = parts[0] + '.' + parts[1].substring(0, 2);
                  }
                  
                  setValorContrato(value);
                }}
                style={{ fontFamily: 'monospace' }}
              />
              <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Digite apenas números. Use ponto ou vírgula para decimais (ex: 1500.50 ou 1500,50)
              </small>
            </div>
          </div>

          {/* Exibição formatada do valor */}
          {valorContrato && (
            <div className={styles.contractValueDisplay}>
              <strong>Valor do Contrato:</strong> R$ {parseFloat(valorContrato || 0).toLocaleString('pt-BR', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}
            </div>
          )}

          {/* Campo de MRR quando for upload de PDF */}
          {uploadedFile && (
            <div style={{ marginTop: '1rem' }}>
              {renderLabel('MRR (Valor Recorrente Mensal)', false)}
              <input
                className={styles.input}
                type="text"
                placeholder="R$ 0,00"
                value={valorRecorrente}
                onChange={(e) => {
                  let value = e.target.value.replace(/[^\d,.]/g, '');
                  value = value.replace(',', '.');
                  const parts = value.split('.');
                  if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
                  if (parts.length === 2 && parts[1].length > 2) value = parts[0] + '.' + parts[1].substring(0, 2);
                  setValorRecorrente(value);
                }}
                style={{ fontFamily: 'monospace' }}
              />
              <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Opcional. Preencha se for cobrança recorrente mensal.
              </small>
            </div>
          )}
        </div>
      )}


      {activeTab === "servicos" && (
        <div>
          <div className={styles.headerLine}>
            <h2 className={styles.tituloComIcone}><FontAwesomeIcon icon={faBoxOpen} style={{ marginRight: 8, color: '#2563eb' }} />Serviços e Produtos</h2>
            <button className={styles.button} onClick={() => setShowProdutoModal(true)}>
              + Adicionar Item
            </button>
          </div>
          {produtosSelecionados.length === 0 ? (
            <p style={{ marginTop: "1rem" }}>Nenhum produto adicionado.</p>
          ) : (
            <div style={{ marginTop: "1rem" }}>
              <table className={styles.tabelaProdutos}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Quantidade</th>
                    <th>Valor de Venda</th>
                    <th>Tipo</th>
                    <th>Nº Parcelas</th>
                    <th>Subtotal</th>
                    <th>Total</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosSelecionados.map((p, index) => {
                    const quantidade = parseFloat(p.quantidade) || 0;
                    const valorUnitario = parseFloat(p.valor_de_venda) || 0;
                    const totalProduto = (quantidade * valorUnitario).toFixed(2);
                    const parcelas = parseInt(p.parcelas) || 0;
                    const subtotal = parcelas > 0 ? (quantidade * valorUnitario / parcelas).toFixed(2) : null;

                    return (
                      <tr key={index}>
                        <td>{p.nome}</td>
                        <td>{p.quantidade}</td>
                        <td>R$ {valorUnitario.toFixed(2)}</td>
                        <td>{p.tipo ? p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1) : '-'}</td>
                        <td>{p.parcelas || '-'}</td>
                        <td>{parcelas > 0 ? `R$ ${subtotal}` : '-'}</td>
                        <td>R$ {totalProduto}</td>
                        <td>
                          <button
                            onClick={() => {
                              const novaLista = produtosSelecionados.filter((_, i) => i !== index);
                              setProdutosSelecionados(novaLista);
                            }}
                            className={styles.removeButton}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Valor total de todos os produtos */}
              <div style={{ marginTop: "1rem", textAlign: "right", fontWeight: "bold" }}>
                TCV: R${" "}
                {produtosSelecionados
                  .reduce((total, p) => {
                    const quantidade = parseFloat(p.quantidade) || 0;
                    const valorUnitario = parseFloat(p.valor_de_venda) || 0;
                    return total + quantidade * valorUnitario;
                  }, 0)
                  .toFixed(2)}
                {/* MRR ao lado do TCV */}
                {(() => {
                  // Calcula o MRR apenas para produtos do tipo mensal
                  const produtosMensais = produtosSelecionados.filter(p => p.tipo === 'mensal');
                  if (produtosMensais.length === 0) return null;
                  // Soma o valor de cada produto mensal dividido pelo número de parcelas
                  const mrr = produtosMensais.reduce((total, p) => {
                    const quantidade = parseFloat(p.quantidade) || 0;
                    const valorUnitario = parseFloat(p.valor_de_venda) || 0;
                    const parcelas = parseInt(p.parcelas) || 1;
                    return total + ((quantidade * valorUnitario) / parcelas);
                  }, 0);
                  return (
                    <span style={{ marginLeft: 24 }}>
                      MRR: R$ {mrr.toFixed(2)}
                    </span>
                  );
                })()}
              </div>

              {produtosSelecionados.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <h3 style={{ marginBottom: 8 }}>Condições comerciais</h3>
                  <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                    <div>
                      <label style={{ fontSize: 14 }}>Dia do vencimento</label><br />
                      <select
                        value={diaVencimento || 1}
                        onChange={e => setDiaVencimento(Number(e.target.value))}
                        style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', minWidth: 80 }}
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(dia => (
                          <option key={dia} value={dia}>{dia}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 14 }}>Data do 1º vencimento</label><br />
                      <input
                        type="date"
                        value={dataPrimeiroVencimento || ""}
                        onChange={e => setDataPrimeiroVencimento(e.target.value)}
                        style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', minWidth: 140 }}
                      />
                    </div>
                  </div>
                  <h3 style={{ marginBottom: 8 }}>Resumo do Documento</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table className={styles.tabelaProdutos} style={{ minWidth: 800 }}>
                      <thead>
                        <tr>
                          <th>Parcela</th>
                          <th>Pagamento</th>
                          <th>Pontual</th>
                          <th>Mensal</th>
                          <th>Bimestral</th>
                          <th>Trimestral</th>
                          <th>Semestral</th>
                          <th>Anual</th>
                          <th>Personalizado</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // 1. Agrupar produtos por tipo
                          const tipos = ['pontual', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual', 'personalizado'];
                          const produtosPorTipo = {};
                          tipos.forEach(tipo => {
                            produtosPorTipo[tipo] = produtosSelecionados.filter(p => p.tipo === tipo);
                          });
                          // 2. Descobrir o maior número de parcelas
                          const maxParcelas = Math.max(
                            ...tipos.map(tipo => produtosPorTipo[tipo].reduce((max, p) => Math.max(max, parseInt(p.parcelas) || 1), 0)),
                            1
                          );
                          // Verificar se há produtos personalizados
                          const temPersonalizado = produtosPorTipo['personalizado'] && produtosPorTipo['personalizado'].length > 0;
                          
                          // 3. Gerar as linhas da tabela
                          const linhas = [];
                          // Usar dataPrimeiroVencimento como base, ou hoje se não houver
                          const dataBaseInicial = dataPrimeiroVencimento 
                            ? new Date(dataPrimeiroVencimento + 'T00:00:00') 
                            : new Date();
                          
                          // Função para obter a data da parcela (editada ou calculada)
                          const obterDataParcela = (indiceParcela) => {
                            // Se tem data personalizada para esta parcela, usar ela
                            if (datasPersonalizadas[indiceParcela]) {
                              return datasPersonalizadas[indiceParcela];
                            }
                            // Caso contrário, calcular normalmente
                            let dataCalculada;
                            if (indiceParcela === 0) {
                              dataCalculada = new Date(dataBaseInicial);
                            } else {
                              dataCalculada = new Date(dataBaseInicial);
                              dataCalculada.setMonth(dataCalculada.getMonth() + indiceParcela);
                              dataCalculada.setDate(diaVencimento);
                            }
                            return formatDateForInput(dataCalculada);
                          };
                          
                          // Função para atualizar data personalizada com validação e sugestão de ajuste subsequente
                          const atualizarDataPersonalizada = (indiceParcela, novaData) => {
                            // Se não há data selecionada, permitir (input pode estar sendo limpo)
                            if (!novaData) {
                              setDatasPersonalizadas(prev => {
                                const novo = { ...prev };
                                delete novo[indiceParcela];
                                return novo;
                              });
                              return;
                            }

                            const novaDataObj = new Date(novaData + 'T00:00:00');
                            
                            // Validar com parcela anterior (se existir)
                            if (indiceParcela > 0) {
                              const dataParcelaAnterior = obterDataParcela(indiceParcela - 1);
                              const dataAnteriorObj = new Date(dataParcelaAnterior + 'T00:00:00');
                              
                              if (novaDataObj <= dataAnteriorObj) {
                                toast.warning(`A data da parcela ${indiceParcela + 1} deve ser posterior à parcela ${indiceParcela}. Data mínima: ${dataAnteriorObj.toLocaleDateString('pt-BR')}`);
                                return; // Não atualiza se for inválida
                              }

                              // Sugestão de ajuste: se o salto for muito grande (> 45 dias), perguntar se deseja ajustar as subsequentes
                              const diffMs = Math.abs(novaDataObj - dataAnteriorObj);
                              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                              if (diffDays > 45) {
                                setPendingAdjustContext({ index: indiceParcela, newDate: novaData, deltaDays: diffDays });
                                setShowAdjustDatesModal(true);
                                // Ainda assim aplica a mudança na parcela atual para refletir no UI imediatamente
                                setDatasPersonalizadas(prev => ({
                                  ...prev,
                                  [indiceParcela]: novaData
                                }));
                                return;
                              }
                            }
                            
                            // Validar com parcelas subsequentes (se existirem)
                            for (let j = indiceParcela + 1; j < maxParcelas; j++) {
                              const dataSubsequente = obterDataParcela(j);
                              const dataSubsequenteObj = new Date(dataSubsequente + 'T00:00:00');
                              
                              if (novaDataObj >= dataSubsequenteObj) {
                                toast.warning(`A data da parcela ${indiceParcela + 1} deve ser anterior à parcela ${j + 1}. Data máxima: ${dataSubsequenteObj.toLocaleDateString('pt-BR')}`);
                                return; // Não atualiza se for inválida
                              }
                            }
                            
                            // Se passou todas as validações, atualiza
                            setDatasPersonalizadas(prev => ({
                              ...prev,
                              [indiceParcela]: novaData
                            }));
                          };
                          
                          for (let i = 0; i < maxParcelas; i++) {
                            const dataParcela = obterDataParcela(i);
                            const dataDate = new Date(dataParcela + 'T00:00:00');
                            
                            // Calcular data mínima para esta parcela (data da parcela anterior + 1 dia)
                            let dataMinima = null;
                            if (i > 0) {
                              const dataParcelaAnterior = obterDataParcela(i - 1);
                              const dataAnteriorObj = new Date(dataParcelaAnterior + 'T00:00:00');
                              dataAnteriorObj.setDate(dataAnteriorObj.getDate() + 1); // Próximo dia após a parcela anterior
                              dataMinima = formatDateForInput(dataAnteriorObj);
                            }
                            
                            // 4. Calcular valores por tipo
                            const valoresPorTipo = tipos.map(tipo => {
                              return produtosPorTipo[tipo].reduce((soma, p) => {
                                const parcelas = parseInt(p.parcelas) || 1;
                                if (i < parcelas) {
                                  const quantidade = parseFloat(p.quantidade) || 0;
                                  const valorUnitario = parseFloat(p.valor_de_venda) || 0;
                                  return soma + (quantidade * valorUnitario) / parcelas;
                                }
                                return soma;
                              }, 0);
                            });
                            const totalLinha = valoresPorTipo.reduce((a, b) => a + b, 0);
                            linhas.push(
                              <tr key={i}>
                                <td>{i + 1}</td>
                                <td>
                                  {temPersonalizado ? (
                                    <input
                                      type="date"
                                      value={dataParcela}
                                      onChange={(e) => atualizarDataPersonalizada(i, e.target.value)}
                                      min={dataMinima || undefined}
                                      onKeyDown={(e) => e.preventDefault()}
                                      onPaste={(e) => e.preventDefault()}
                                      onWheel={(e) => e.preventDefault()}
                                      className={styles.dataTableInput}
                                      title={dataMinima ? `Data mínima: ${new Date(dataMinima + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                                    />
                                  ) : (
                                    dataDate.toLocaleDateString('pt-BR')
                                  )}
                                </td>
                                {valoresPorTipo.map((v, idx) => (
                                  <td key={idx}>{v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                ))}
                                <td style={{ fontWeight: 'bold' }}>{totalLinha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              </tr>
                            );
                          }
                          // 5. Totais por coluna
                          const totaisPorTipo = tipos.map((tipo, idx) =>
                            linhas.reduce((soma, _, i) => {
                              return soma + (produtosPorTipo[tipo].reduce((s, p) => {
                                const parcelas = parseInt(p.parcelas) || 1;
                                if (i < parcelas) {
                                  const quantidade = parseFloat(p.quantidade) || 0;
                                  const valorUnitario = parseFloat(p.valor_de_venda) || 0;
                                  return s + (quantidade * valorUnitario) / parcelas;
                                }
                                return s;
                              }, 0));
                            }, 0)
                          );
                          const totalGeral = totaisPorTipo.reduce((a, b) => a + b, 0);
                          // 6. Renderizar linhas + total
                          return [
                            ...linhas,
                            <tr key="total">
                              <td colSpan={2} style={{ fontWeight: 'bold' }}>Total</td>
                              {totaisPorTipo.map((v, idx) => (
                                <td key={idx} style={{ fontWeight: 'bold' }}>{v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              ))}
                              <td style={{ fontWeight: 'bold' }}>{totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          ];
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {activeTab === "signatarios" && (
        <div className={styles.signatariosContainer}>
          <div className={styles.header}>
            <h2 className={styles.tituloComIcone}><FontAwesomeIcon icon={faUserPlus} style={{ marginRight: 8, color: '#2563eb' }} />Adicionar Signatários</h2>
            <button
              className={styles.button}
              onClick={() => setShowSignatariosList(!showSignatariosList)}
            >
              {showSignatariosList ? "Ocultar Lista de Signatários" : "Ver Lista de Signatários"}
            </button>
          </div>
          <div className={styles.grid}>
            <div>
              {renderLabel('Nome', true)}
              <input
                className={styles.input}
                type="text"
                placeholder="Nome"
                value={novoSignatario.name || ""}
                onChange={(e) => handleNovoSignatarioChange("name", e.target.value)}
              />
            </div>
            <div>
              {renderLabel('Email', true)}
              <input
                className={styles.input}
                type="email"
                placeholder="Email"
                value={novoSignatario.email || ""}
                onChange={(e) => handleNovoSignatarioChange("email", e.target.value.toLocaleLowerCase())}
              />
            </div>
            <div>
              {renderLabel('CPF', true)}
              <input
                className={styles.input}
                type="text"
                placeholder="CPF"
                value={maskCpfBR(novoSignatario.cpf || "")}
                onChange={(e) => handleNovoSignatarioChange("cpf", cleanCpf(e.target.value))}
              />
            </div>
            <div>
              {renderLabel('Telefone', true)}
              <input
                className={styles.input}
                type="text"
                placeholder="Telefone"
                value={maskPhoneBR(novoSignatario.telefone || "")}
                onChange={e => handleNovoSignatarioChange("telefone", maskPhoneBR(e.target.value))}
              />
            </div>
            <div>
              {renderLabel('Data de Nascimento', false)}
              <input
                className={styles.input}
                type="date"
                value={novoSignatario.birth_date || ""}
                onChange={(e) => handleNovoSignatarioChange("birth_date", e.target.value)}
              />
            </div>
            <div>
              {renderLabel('Assina como', true)}
              <select
                className={styles.input}
                value={novoSignatario.funcao_assinatura || ""}
                onChange={e => handleNovoSignatarioChange("funcao_assinatura", e.target.value)}
                required
              >
                <option value="">Selecione a sua função</option>
                {opcoesFuncaoAssinatura.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.signatarioActions}>
            <div className={styles.toggleGroup}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>Salvar Signatário na Lista</span>
              <ToggleSimNao checked={salvarNaLista} onChange={setSalvarNaLista} />
            </div>
            <button
              className={styles.button}
              type="button"
              onClick={handleAddOrUpdateSignatario}
            >
              {editIndex !== null ? "Atualizar" : "Adicionar Signatário"}
            </button>

            <button
              className={styles.button}
              type="button"
              onClick={() => {
                setNovoSignatario((prev) => ({
                  ...prev,
                  name: usuario.full_name || "",
                  email: usuario.email || ""
                }));
              }}
            >
              Me adicione
            </button>

            <button
              className={styles.button}
              type="button"
              onClick={() => {
                if (!clienteSelecionado || !cliente) {
                  toast.warning("Selecione um cliente primeiro.");
                  return;
                }
                setNovoSignatario((prev) => ({
                  ...prev,
                  name: (cliente.nome || ""),
                  email: (cliente.email || "").toLowerCase(),
                  cpf: cleanCpf(cliente.cpf_cnpj || ""),
                  telefone: maskPhoneBR(cliente.telefone || ""),
                }));
              }}
            >
              Adicionar cliente
            </button>

            <button
              className={styles.button}
              type="button"
              onClick={() => {
                setNovoSignatario({ name: "", email: "", cpf: "", birth_date: "", telefone: "", funcao_assinatura: "" });
                setEditIndex(null);
              }}
            >
              Limpar
            </button>
          </div>
          {/* Tabela de signatários adicionados */}
          {signatarios.length > 0 && (
            <table className={styles.tabelaProdutos} style={{ marginTop: "2rem" }}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>CPF</th>
                  <th>Telefone</th>
                  <th>Data Nasc.</th>
                  <th>Função</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {signatarios.map((s, index) => (
                  <tr key={index}>
                    <td>{s.name}</td>
                    <td>{s.email}</td>
                    <td>{maskCpfBR(s.cpf)}</td>
                    <td>{maskPhoneBR(s.telefone)}</td>
                    <td>{formatDateToBR(s.birth_date)}</td>
                    <td>{s.funcao_assinatura}</td>
                    <td>
                      <button className={styles.editIcon} onClick={() => handleEditSignatario(index)} title="Editar">
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                      <button className={styles.removeIcon} onClick={() => handleRemoveSignatario(index)} title="Excluir">
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* Exibir a lista de signatários se o estado for true */}
          {showSignatariosList && (
            <ListaSignatarios
              onSelectSignatario={(novosSelecionados) => {
                // Adiciona selecionados evitando duplicidade por email/CPF/telefone
                const duplicados = [];
                const processados = [];
                novosSelecionados.forEach(novo => {
                  const candidato = {
                    ...novo,
                    birth_date: formatDateToInput(novo.birth_date),
                  };
                  if (isDuplicateSignatario(candidato)) {
                    duplicados.push(candidato);
                  } else {
                    processados.push(candidato);
                  }
                });
                if (duplicados.length > 0) {
                  toast.warning("Alguns signatários já existem (email, CPF ou telefone duplicado) e foram ignorados.");
                }
                if (processados.length > 0) setSignatarios([...signatarios, ...processados]);
              }}
              onClose={() => setShowSignatariosList(false)}
            />
          )}
        </div>
      )}


      {activeTab === "outras" && (
        <div>
          <h2 className={styles.tituloComIcone}><FontAwesomeIcon icon={faInfoCircle} style={{ marginRight: 8, color: '#2563eb' }} />Outras Informações</h2>
          
          {(() => {
            // Recupera o template selecionado (caso o usuário tenha escolhido)
            const selectedTemplateObj = templates.find(
              (t) => t.id.toString() === selectedTemplate
            );
            
            const templateContent = selectedTemplateObj?.content || selectedTemplateObj?.conteudo || "";
            const isStraton = selectedTemplateObj?.straton === 1;
            
            // Função para filtrar variáveis presentes no conteúdo do template
            function getCustomVariablesInTemplate(content, customVariables) {
              if (!content || !customVariables || !Array.isArray(customVariables)) {
                return [];
              }
              const vars = customVariables.filter((v) => {
                const found = content.includes(`{{${v.variable}}}`);
                return found;
              });
              return vars;
            }
            // Filtra as variáveis personalizadas presentes no template selecionado
            const customVarsToShow = getCustomVariablesInTemplate(
              templateContent,
              customVariables
            );

            // Verifica quais variáveis estão preenchidas
            const unfilledVars = customVarsToShow.filter(v => 
              !customValues[v.variable] || customValues[v.variable].trim() === ''
            );

            // Caso não tenha selecionado template
            if (!selectedTemplateObj)
              return (
                <>
                  <div className={styles.infoContainer}>
                    <FontAwesomeIcon icon={faInfoCircle} className={styles.infoIcon} />
                    <span className={styles.infoText}>
                      <strong>Variáveis Personalizadas:</strong> Selecione um modelo de contrato para exibir as variáveis personalizadas.
                    </span>
                  </div>
                </>
              );

            // Se for Straton (straton = 1), mostrar campos financeiros
            if (isStraton) {
              return (
                <div>
                  <div className={styles.infoContainer}>
                    <FontAwesomeIcon icon={faInfoCircle} className={styles.infoIcon} />
                    <span className={styles.infoText}>
                      <strong>Configuração Financeira:</strong> Este modelo está vinculado ao módulo financeiro. Configure as informações abaixo para gerar parcelas automaticamente.
                    </span>
                  </div>

                  {loadingFinanceiro && (
                    <div className={styles.loadingBox}>
                      <span>Carregando dados financeiros...</span>
                    </div>
                  )}

                  {!loadingFinanceiro && (
                    <div className={styles.outrasSectionWrapper}>
                      {/* Seção Informações */}
                      <div className={styles.sectionBlock}>
                        <h3>Informações</h3>
                        <div className={styles.gridTwoCols}>
                          {/* Subcategoria de Receita */}
                          <div>
                            {renderLabel('Subcategoria de Receita', true)}
                            {(() => {
                              const subCategorias = getSubCategoriasReceita();
                              console.log('🔍 [Render] Subcategorias obtidas:', subCategorias);
                              const options = subCategorias.map((item) => ({
                                value: item.id.toString(),
                                label: `${item.categoria_pai_nome} → ${item.nome}`,
                              }));
                              console.log('🔍 [Render] Options para ReactSelect:', options);
                              return (
                                <ReactSelect
                                  options={options}
                                  value={subCategorias.find((item) => item.id.toString() === financeiroForm.categoria) 
                                    ? { 
                                        value: financeiroForm.categoria, 
                                        label: subCategorias.find((item) => item.id.toString() === financeiroForm.categoria)?.categoria_pai_nome + ' → ' + subCategorias.find((item) => item.id.toString() === financeiroForm.categoria)?.nome 
                                      }
                                    : null}
                                  onChange={(option) => {
                                    console.log('🔍 [ReactSelect] onChange chamado com:', option);
                                    setFinanceiroForm(prev => ({ ...prev, categoria: option ? option.value : '' }));
                                  }}
                                  placeholder="Pesquisar subcategoria..."
                                  styles={customSelectStyles}
                                  isClearable
                                  isSearchable
                                  menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                  menuPosition="fixed"
                                />
                              );
                            })()}
                          </div>

                          {/* Centro de custo */}
                          <div>
                            {renderLabel('Centro de custo', false)}
                            <ReactSelect
                              options={(financeiroData.centrosCusto || []).map((centro) => ({
                                value: centro.id.toString(),
                                label: centro.nome,
                              }))}
                              value={financeiroData.centrosCusto.find((centro) => centro.id.toString() === financeiroForm.centroCusto) 
                                ? { value: financeiroForm.centroCusto, label: financeiroData.centrosCusto.find((centro) => centro.id.toString() === financeiroForm.centroCusto)?.nome }
                                : null}
                              onChange={(option) => setFinanceiroForm(prev => ({ ...prev, centroCusto: option ? option.value : '' }))}
                              placeholder="Pesquisar centro de custo..."
                              styles={customSelectStyles}
                              isClearable
                              isSearchable
                              menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                              menuPosition="fixed"
                            />
                          </div>

                          {/* Vendedor responsável */}
                          <div>
                            {renderLabel('Vendedor responsável', false)}
                            <ReactSelect
                              options={(financeiroData.users || []).map((user) => ({
                                value: user.id.toString(),
                                label: user.nome,
                              }))}
                              value={financeiroData.users.find((user) => user.id.toString() === financeiroForm.vendedorResponsavel) 
                                ? { value: financeiroForm.vendedorResponsavel, label: financeiroData.users.find((user) => user.id.toString() === financeiroForm.vendedorResponsavel)?.nome }
                                : null}
                              onChange={(option) => setFinanceiroForm(prev => ({ ...prev, vendedorResponsavel: option ? option.value : '' }))}
                              placeholder="Pesquisar vendedor..."
                              styles={customSelectStyles}
                              isClearable
                              isSearchable
                              menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                              menuPosition="fixed"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Seção Informações de pagamento */}
                      <div className={styles.sectionBlock}>
                        <h3>Informações de pagamento</h3>
                        <div className={styles.gridTwoCols}>
                          {/* Forma de pagamento */}
                          <div>
                            {renderLabel('Forma de pagamento', false)}
                            <select
                              value={financeiroForm.formaPagamento}
                              onChange={(e) => setFinanceiroForm(prev => ({ ...prev, formaPagamento: e.target.value }))}
                              className={styles.input}
                            >
                              <option value="">Selecione</option>
                              <option value="dinheiro">Dinheiro</option>
                              <option value="pix">PIX</option>
                              <option value="cartao">Cartão</option>
                              <option value="boleto">Boleto</option>
                            </select>
                          </div>

                          {/* Conta de recebimento */}
                          <div>
                            {renderLabel('Conta de recebimento', true)}
                            <select
                              value={financeiroForm.contaRecebimento}
                              onChange={(e) => setFinanceiroForm(prev => ({ ...prev, contaRecebimento: e.target.value }))}
                              className={styles.input}
                            >
                              <option value="">Selecione a conta</option>
                              {/* Contas ERP */}
                              {financeiroData.contas
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
                                    <option key={`erp-${conta.id}`} value={`erp:${conta.id}`}>
                                      {bancoConta} — {nomeConta}
                                    </option>
                                  );
                                })}
                              {/* Contas API (OpenFinance) */}
                              {financeiroData.contasApi
                                .filter((conta) => {
                                  const temBanco = conta.banco && String(conta.banco).trim();
                                  const temDescricao = conta.descricao_banco && String(conta.descricao_banco).trim();
                                  const temAccount = conta.account && String(conta.account).trim();
                                  return temBanco || temDescricao || temAccount;
                                })
                                .map((conta) => {
                                  const nomeConta = conta.descricao_banco || conta.banco || `Conta ${conta.account}`;
                                  return (
                                    <option key={`api-${conta.id}`} value={`api:${conta.id}`}>
                                      {nomeConta} (OpenFinance)
                                    </option>
                                  );
                                })}
                            </select>
                          </div>

                          {/* Vencimento */}
                          <div>
                            {renderLabel('Vencimento', true)}
                            <input
                              type="date"
                              value={formatDateForInput(financeiroForm.vencimento)}
                              onChange={(e) => setFinanceiroForm(prev => ({ ...prev, vencimento: e.target.value ? new Date(e.target.value + 'T00:00:00') : null }))}
                              className={styles.input}
                            />
                          </div>

                          
                        </div>
                      </div>

                      {/* Variáveis personalizadas (se houver) */}
                      {customVarsToShow.length > 0 && (
                        <div style={{ marginTop: '32px' }}>
                          <div className={styles.infoContainer}>
                            <FontAwesomeIcon icon={faInfoCircle} className={styles.infoIcon} />
                            <span className={styles.infoText}>
                              <strong>Variáveis Personalizadas:</strong> {unfilledVars.length > 0 
                                ? `${unfilledVars.length} variável(is) não preenchida(s).` 
                                : 'Todas as variáveis estão preenchidas! ✅'
                              }
                            </span>
                          </div>
                          <div className={styles.grid} style={{ marginTop: '16px' }}>
                            {customVarsToShow.map((v) => {
                              const isFilled = customValues[v.variable] && customValues[v.variable].trim() !== '';
                              return (
                                <div key={v.variable} style={{ marginBottom: "1rem" }}>
                                  <label className={styles.label}>
                                    {v.label} <span style={{color: 'red'}}>*</span>
                                  </label>
                                  <input
                                    className={styles.input}
                                    type="text"
                                    placeholder={`Preencha: ${v.label}`}
                                    value={customValues[v.variable] || ""}
                                    onChange={(e) =>
                                      setCustomValues((prev) => ({
                                        ...prev,
                                        [v.variable]: e.target.value,
                                      }))
                                    }
                                    style={{
                                      borderColor: isFilled ? '#28a745' : '#dc3545',
                                      borderWidth: '2px'
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // Se não for Straton, mostrar apenas variáveis personalizadas
            if (customVarsToShow.length === 0)
              return (
                <>
                  <div className={styles.infoContainer}>
                    <FontAwesomeIcon icon={faInfoCircle} className={styles.infoIcon} />
                    <span className={styles.infoText}>
                      <strong>Variáveis Personalizadas:</strong> Nenhuma variável personalizada presente neste modelo de contrato.
                    </span>
                  </div>
                </>
              );

            // Renderiza apenas as variáveis personalizadas realmente utilizadas no template
            return (
              <div>
                <div className={styles.infoContainer}>
                  <FontAwesomeIcon icon={faInfoCircle} className={styles.infoIcon} />
                  <span className={styles.infoText}>
                    <strong>Variáveis Personalizadas:</strong> {unfilledVars.length > 0 
                      ? `${unfilledVars.length} variável(is) não preenchida(s). Preencha todos os campos abaixo antes de criar o contrato.` 
                      : 'Todas as variáveis estão preenchidas! ✅'
                    }
                  </span>
                </div>

                <div className={styles.grid}>
                  {customVarsToShow.map((v) => {
                    const isFilled = customValues[v.variable] && customValues[v.variable].trim() !== '';
                    return (
                      <div key={v.variable} style={{ marginBottom: "1rem" }}>
                        <label className={styles.label}>
                          {v.label} <span style={{color: 'red'}}>*</span>
                        </label>
                        <input
                          className={styles.input}
                          type="text"
                          placeholder={`Preencha: ${v.label}`}
                          value={customValues[v.variable] || ""}
                          onChange={(e) =>
                            setCustomValues((prev) => ({
                              ...prev,
                              [v.variable]: e.target.value,
                            }))
                          }
                          style={{
                            borderColor: isFilled ? '#28a745' : '#dc3545',
                            borderWidth: '2px'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}




      {activeTab === "gerar" && (
        <>
          <div className={styles.criarButtonWrapper}>
            <button className={styles.button} onClick={handleSubmit} disabled={loading}>
              {loading ? "Criando no Autentique..." : "Criar Contrato Autentique"}
            </button>
          </div>

        </>
      )}

      {/* Modal: ajustar datas subsequentes */}
      {showAdjustDatesModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAdjustDatesModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: '8px', color: '#f59e0b' }} />
                Ajustar parcelas subsequentes?
              </h3>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalText}>
                Você alterou a data da parcela {pendingAdjustContext?.index + 1} para
                {' '}
                {pendingAdjustContext ? new Date(pendingAdjustContext.newDate + 'T00:00:00').toLocaleDateString('pt-BR') : ''}.
              </p>
              <p className={styles.modalText}>
                Deseja ajustar automaticamente as datas das parcelas seguintes mantendo o mesmo intervalo?
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.modalButton}
                onClick={() => {
                  setShowAdjustDatesModal(false);
                  setPendingAdjustContext(null);
                }}
                style={{ background: '#6b7280', color: 'white' }}
              >
                Não ajustar
              </button>
              <button
                className={styles.modalButton}
                onClick={() => {
                  // Aplicar ajuste nas subsequentes
                  if (!pendingAdjustContext) return;
                  const { index, newDate } = pendingAdjustContext;
                  
                  // Calcular número máximo de parcelas
                  const tipos = ['pontual', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual', 'personalizado'];
                  const maxParcelas = Math.max(
                    ...tipos.map(tipo => {
                      const produtosTipo = produtosSelecionados.filter(p => p.tipo === tipo);
                      return produtosTipo.reduce((max, p) => Math.max(max, parseInt(p.parcelas) || 1), 0);
                    }),
                    1
                  );
                  
                  // Função auxiliar para obter data de uma parcela (sem dados personalizados)
                  const obterDataCalculada = (indice) => {
                    if (datasPersonalizadas[indice]) {
                      return datasPersonalizadas[indice];
                    }
                    const dataBaseInicial = dataPrimeiroVencimento 
                      ? new Date(dataPrimeiroVencimento + 'T00:00:00') 
                      : new Date();
                    let dataCalculada;
                    if (indice === 0) {
                      dataCalculada = new Date(dataBaseInicial);
                    } else {
                      dataCalculada = new Date(dataBaseInicial);
                      dataCalculada.setMonth(dataCalculada.getMonth() + indice);
                      dataCalculada.setDate(diaVencimento);
                    }
                    return formatDateForInput(dataCalculada);
                  };
                  
                  setDatasPersonalizadas(prev => {
                    const novo = { ...prev, [index]: newDate };
                    
                    // Ajustar todas as parcelas subsequentes até maxParcelas
                    // Sempre adiciona 1 mês por vez, respeitando o dia de vencimento
                    for (let j = index + 1; j < maxParcelas; j++) {
                      // Obter a parcela anterior (já ajustada ou calculada)
                      const prevStr = novo[j - 1] || obterDataCalculada(j - 1);
                      const prevDate = new Date(prevStr + 'T00:00:00');
                      
                      // Adicionar 1 mês
                      let novaDataParcela = new Date(prevDate);
                      novaDataParcela.setMonth(novaDataParcela.getMonth() + 1);
                      
                      // Ajustar para o dia de vencimento
                      novaDataParcela.setDate(diaVencimento);
                      
                      novo[j] = formatDateForInput(novaDataParcela);
                    }
                    return novo;
                  });

                  setShowAdjustDatesModal(false);
                  setPendingAdjustContext(null);
                }}
                style={{ background: '#10b981', color: 'white' }}
              >
                Ajustar subsequentes
              </button>
            </div>
          </div>
        </div>
      )}



      {showLeadsModal && (
        <LeadsModal
          onClose={() => setShowLeadsModal(false)}
          onSelect={handleLeadSelecionado}
        />
      )}

      {showLeadToClientForm && leadSelecionado && (
        <LeadToClientForm
          lead={leadSelecionado}
          onClose={() => setShowLeadToClientForm(false)}
          onCreate={async (clientId) => {
            setShowLeadToClientForm(false);
            try {
              const clienteData = await fetchClienteById(clientId);  // <-- Passa o clientId e espera resposta
              setCliente(clienteData);
              setClienteSelecionado(clientId.toString());
              // Preenche automaticamente o nome do documento com o padrão "Nome do Cliente - Contrato"
              setNomeDocumento(`${clienteData.nome || 'Cliente'} - Contrato`);
              setActiveTab("documento");
            } catch (error) {
              console.error("Erro ao buscar cliente criado:", error);
            }
            await fetchClientes(); // Atualiza lista geral de clientes
          }}
        />
      )}


      {showClienteModal && (
        <ClienteModal
          cliente={cliente}
          onClose={() => setShowClienteModal(false)}
          onCreate={handleClienteCriado}
          onUpdate={handleAtualizarCliente}
        />
      )}

      {showClienteFormModal && (
        <ClienteForm
          cliente={cliente}
          onClose={() => setShowClienteFormModal(false)}
          onCreate={handleClienteCriado}
          onUpdate={handleAtualizarCliente}
        />
      )}


      {showProdutoModal && (
        <ProdutoModal
          produtos={produtos}
          onClose={() => setShowProdutoModal(false)}
          onAdd={(produto) => setProdutosSelecionados([...produtosSelecionados, produto])}
        />
      )}

      {/* Modal de confirmação para sair */}
      {showExitModal && (
        <div className={styles.modalOverlay} onClick={cancelExit}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: '8px', color: '#f59e0b' }} />
                Você tem alterações não salvas
              </h3>
            </div>
            
            <div className={styles.modalBody}>
              <p className={styles.modalText}>
                Você fez alterações no contrato que ainda não foram salvas. 
                O que gostaria de fazer?
              </p>
            </div>
            
            <div className={styles.modalFooter}>
              <button
                className={styles.modalButton}
                onClick={() => confirmExit(true)}
                style={{ background: '#10b981', color: 'white' }}
              >
                <FontAwesomeIcon icon={faCheckCircle} style={{ marginRight: '6px' }} />
                Salvar e Sair
              </button>
              
              <button
                className={styles.modalButton}
                onClick={() => confirmExit(false)}
                style={{ background: '#6b7280', color: 'white' }}
              >
                <FontAwesomeIcon icon={faTimes} style={{ marginRight: '6px' }} />
                Sair sem Salvar
              </button>
              
              <button
                className={styles.modalButton}
                onClick={cancelExit}
                style={{ background: '#e5e7eb', color: '#374151' }}
              >
                <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: '6px' }} />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
        transition={Bounce}
      />
      </div>
      
      {/* Overlay de Loading sobre toda a página */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <SpaceLoader size={120} label="Criando contrato..." showText={true} minHeight={300} />
        </div>
      )}
    </div>
  );
}