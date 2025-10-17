import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import styles from "../../styles/contratual/CriarContrato.module.css";
import LeadsModal from "../../components/comercial/modal/LeadsModal";
import ClienteModal from "../../components/comercial/ClienteModal";
import ProdutoModal from "../../components/contratual/ProdutoModal";
import ClienteForm from "../../components/contratual/ClienteForm";
import LeadToClientForm from "../../components/contratual/LeadToClientForm";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faPen, faTrash, faUser, faFileAlt, faBoxOpen, faUserPlus, faInfoCircle, faRocket, faCloudUploadAlt, faCheckCircle, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { fetchClienteById } from "../../utils/fetchClienteById";
import ListaSignatarios from "../../components/contratual/ListaSignatarios";
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ToggleSimNao from "../../components/contratual/ToggleSimNao";
import SpaceLoader from '../../components/onety/menu/SpaceLoader';
import TiptapEditor from "../../components/contratual/TiptapEditor";

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

export default function CriarDocumentoAutentique() {
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
  
  // Estados para rascunho
  const [rascunhoId, setRascunhoId] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showLeadsModal, setShowLeadsModal] = useState(false);
  const [showNovoClienteModal, setShowNovoClienteModal] = useState(false);
  const [usuario, setUsuario] = useState({ full_name: "", email: "" });
  const [showCliente, setShowCliente] = useState(false);
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
  const [showClienteModal, setShowClienteModal] = useState(false); // Para criar cliente

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
  const [nomeDocumento, setNomeDocumento] = useState(""); // Nome do documento no Autentique
  const [uploadedFile, setUploadedFile] = useState(null); // Arquivo upado
  const [uploadFileName, setUploadFileName] = useState(""); // Nome do arquivo upado
  const [showUploadWarning, setShowUploadWarning] = useState(false); // Aviso de conflito entre modelo e upload
  const [uploadProgress, setUploadProgress] = useState(0); // Progresso do upload
  const [valorContrato, setValorContrato] = useState(""); // Valor do contrato (TCV) - NOVO
  const [loadingClientes, setLoadingClientes] = useState(false); // Estado de carregamento dos clientes
  
  // Estados para funcionário
  const [isFuncionarioTemplate, setIsFuncionarioTemplate] = useState(false);
  const [departamentos, setDepartamentos] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [funcionarioData, setFuncionarioData] = useState({
    nome: "",
    email: "",
    departamento_id: "",
    cargo_id: ""
  });


  const handleLeadSelecionado = (lead) => {
    setLeadSelecionado(lead);
    setShowLeadsModal(false);
    setShowLeadToClientForm(true); // mostrar o formulário de conversão
  };

  // Função para salvar rascunho
  const salvarRascunho = async (silencioso = false) => {
    try {
      const token = localStorage.getItem("token");
      const userRaw = localStorage.getItem("userData");
      const user = userRaw ? JSON.parse(userRaw) : null;
      const empresaId = user?.EmpresaId ?? user?.empresa?.id;

      if (!token || !empresaId) {
        if (!silencioso) toast.error("Erro de autenticação");
        return;
      }

      const rascunhoData = {
        empresa_id: empresaId,
        template_id: selectedTemplate,
        cliente_id: clienteSelecionado,
        content: content,
        signatarios: signatarios,
        // Para rascunho, não enviamos expiracao para não mudar status
        // expira_em: validade,
        // vigencia_inicio: vigenciaInicio,
        // vigencia_fim: vigenciaFim,
        // vigencia_meses: vigenciaMeses,
        // expira_em_dias: expiraEmDias,
        // Documento não possui valor/valor_recorrente no front
        nome_documento: nomeDocumento,
        funcionario: isFuncionarioTemplate ? 1 : 0,
        funcionario_data: isFuncionarioTemplate ? funcionarioData : null
      };

      const url = rascunhoId 
        ? `${process.env.NEXT_PUBLIC_API_URL}/contratual/rascunhos-documentos/${rascunhoId}`
        : `${process.env.NEXT_PUBLIC_API_URL}/contratual/rascunhos-documentos`;
      
      const method = rascunhoId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rascunhoData),
      });

      if (!response.ok) {
        throw new Error(`Erro ao salvar rascunho: ${response.status}`);
      }

      const result = await response.json();
      
      if (!rascunhoId) {
        setRascunhoId(result.id);
      }
      
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      
      if (!silencioso) {
        toast.success("Rascunho salvo com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao salvar rascunho:", error);
      if (!silencioso) {
        toast.error("Erro ao salvar rascunho");
      }
    }
  };

  // Função para lidar com tentativa de saída
  const handleExitAttempt = () => {
    if (hasUnsavedChanges) {
      setShowExitModal(true);
    } else {
      router.back();
    }
  };

  const cancelExit = () => {
    setShowExitModal(false);
  };

  const confirmExit = async (saveBeforeExit = false) => {
    if (saveBeforeExit) {
      await salvarRascunho(true);
    }
    setShowExitModal(false);
    router.back();
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
      setShowUploadWarning(false);
    }
  };

  // Função para remover arquivo upado
  const handleRemoveFile = () => {
    setUploadedFile(null);
    setUploadFileName('');
    setUploadProgress(0);
    setValorContrato(''); // Limpa o valor do contrato também
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

      const userDataRaw = localStorage.getItem("userData");
      const userRaw = localStorage.getItem("user");

      const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
      const user = userRaw ? JSON.parse(userRaw) : null;
      const empresaId = userData?.EmpresaId || user?.EmpresaId || user?.equipe_id;

      if (!empresaId) return;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratada/empresa/${empresaId}`, {
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
    fetchDepartamentos();
    fetchCargos();

    // Inicializa validade com base nos 15 dias
    const hoje = new Date();
    hoje.setDate(hoje.getDate() + 15);
    const isoDate = hoje.toISOString().slice(0, 16);
    setValidade(isoDate);
  }, []);

  // Função para buscar detalhes do template e definir isFuncionarioTemplate
  const fetchTemplateDetailsAndSetFuncionario = async (templateId) => {
    if (!templateId) {
      setIsFuncionarioTemplate(false);
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contratual/modelos-contrato/${templateId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error("Erro ao buscar detalhes do modelo");
      }
      
      const templateDetails = await response.json();
      const isFuncionario = templateDetails.funcionario === 1;
      setIsFuncionarioTemplate(isFuncionario);
    } catch (error) {
      console.error("Erro ao carregar detalhes do modelo para funcionario:", error);
      toast.error("Erro ao carregar detalhes do modelo.");
      setIsFuncionarioTemplate(false); // Default to false on error
    }
  };

  // Função para carregar rascunho existente
  const carregarRascunho = async (contractId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/rascunhos-documentos/${contractId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao carregar rascunho: ${response.status}`);
      }

      const rascunho = await response.json();
      
  
      
      // Preenche os campos com os dados do rascunho
      setRascunhoId(rascunho.id);
      setSelectedTemplate(rascunho.template_id || "");
      setClienteSelecionado(rascunho.cliente_id || "");
      setContent(rascunho.content || "");
      setSignatarios(rascunho.signatarios || []);
      setValidade(rascunho.expires_at || "");
      setVigenciaInicio(rascunho.start_at || "");
      setVigenciaFim(rascunho.end_at || "");
      setVigenciaMeses(12); // Default para documentos
      setExpiraEmDias(15); // Default para documentos
      setValorContrato(""); // Documentos não têm valor
      setNomeDocumento(rascunho.nome_documento || "");
      // isFuncionarioTemplate será definido pelo template selecionado, não pelo pre_cliente
      
      // Preenche dados do funcionário se existirem no rascunho
      if (rascunho.funcionario_data) {
        setFuncionarioData(rascunho.funcionario_data);
      } else {
        setFuncionarioData({
          nome: "",
          email: "",
          departamento_id: "",
          cargo_id: ""
        });
      }
      
      // Busca detalhes do template para definir isFuncionarioTemplate corretamente
      await fetchTemplateDetailsAndSetFuncionario(rascunho.template_id);
      
      // Garante que os templates estão carregados para exibir as variáveis
      await fetchTemplates();
      
      // Recarrega clientes com o isFuncionarioTemplate correto
      await fetchClientes();
      
      // Força a sincronização do cliente após carregar tudo
      if (rascunho.cliente_id) {
    
        
        const clienteEncontrado = clientes.find(c => c.id.toString() === rascunho.cliente_id);
        if (clienteEncontrado) {
          setCliente(clienteEncontrado);

        } else {
  
        }
      }
      
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      
      toast.success("Rascunho carregado com sucesso!");
    } catch (error) {
      console.error("Erro ao carregar rascunho:", error);
      toast.error("Erro ao carregar rascunho");
    }
  };

  // Carrega rascunho se houver ID na URL
  useEffect(() => {
    const { rascunho } = router.query;
    if (rascunho && typeof rascunho === 'string') {
      carregarRascunho(rascunho);
    }
  }, [router.query]);

  // Removido autosave: agora só salva ao clicar no botão ou ao confirmar saída

  // Detecta mudanças nos campos para marcar como não salvo
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [selectedTemplate, clienteSelecionado, content, signatarios, validade, vigenciaInicio, vigenciaFim, vigenciaMeses, expiraEmDias, valorContrato, nomeDocumento, isFuncionarioTemplate, funcionarioData]);

    // Recarrega clientes quando o tipo de template mudar
  useEffect(() => {
    if (isFuncionarioTemplate !== undefined) {
      fetchClientes();
    }
  }, [isFuncionarioTemplate]);

  // Sincroniza os dados do cliente quando clienteSelecionado mudar
  useEffect(() => {
    if (clienteSelecionado && clientes.length > 0) {
      const clienteEncontrado = clientes.find(c => {
        const match = c.id === clienteSelecionado;
        return match;
      });
      
      if (clienteEncontrado) {
        setCliente(clienteEncontrado);
        // Preenche automaticamente o nome do documento com o padrão "Nome do Cliente - Documento"
        setNomeDocumento(`${clienteEncontrado.name || clienteEncontrado.nome || 'Cliente'} - Documento`);
        
        // Preenche automaticamente as datas
        const hoje = new Date();
        
        // Data de expiração: 15 dias a partir de hoje
        const dataExpiracao = new Date(hoje);
        dataExpiracao.setDate(hoje.getDate() + 15);
        const dataExpiracaoISO = dataExpiracao.toISOString().slice(0, 16);
        setValidade(dataExpiracaoISO);
        
        // Data de início da vigência: hoje
        const dataInicioVigencia = hoje.toISOString().slice(0, 16);
        setVigenciaInicio(dataInicioVigencia);
        
        // Data final da vigência: início + 12 meses (vigência padrão)
        const dataFinalVigencia = new Date(hoje);
        dataFinalVigencia.setMonth(hoje.getMonth() + 12);
        const dataFinalVigenciaISO = dataFinalVigencia.toISOString().slice(0, 16);
        setVigenciaFim(dataFinalVigenciaISO);
        
        // Se for template de funcionário, preenche automaticamente os dados do funcionário
        if (isFuncionarioTemplate && (clienteEncontrado.name || clienteEncontrado.nome)) {
          setFuncionarioData(prev => ({
            ...prev,
            nome: clienteEncontrado.name || clienteEncontrado.nome || "",
            email: clienteEncontrado.email || "",
            departamento_id: clienteEncontrado.departamento_id || "",
            cargo_id: clienteEncontrado.cargo_id || ""
          }));
        }
      }
    }
  }, [clienteSelecionado, clientes, isFuncionarioTemplate]);

  useEffect(() => {
    async function loadCustomVariables() {
      try {
        const token = localStorage.getItem("token");
        const userDataRaw = localStorage.getItem("userData");
        const userRaw = localStorage.getItem("user");
        if (!token) return;

        const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
        const user = userRaw ? JSON.parse(userRaw) : null;
        const equipeId = userData?.EmpresaId || user?.EmpresaId || user?.equipe_id;
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
    const userRaw = localStorage.getItem("user");

    if (!token) {
      toast.warning("Token não encontrado.");
      return;
    }
    const user = JSON.parse(userRaw);

    try {
      const userData = JSON.parse(localStorage.getItem("userData") || "null");
      const empresaId = userData?.EmpresaId || user?.EmpresaId || user?.equipe_id;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/modelos-contrato/empresa/${empresaId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error("Erro ao buscar templates.");

      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      console.error("Erro ao carregar templates:", err);
    }
  }

  const handleTemplateChange = async (e) => {
    const templateId = e.target.value;
    setSelectedTemplate(templateId);

    // Encontra o template correspondente e preenche o conteúdo
    const selected = templates.find((template) => template.id.toString() === templateId);
    setContent(selected ? (selected.conteudo || selected.content || "") : "");

    // Busca detalhes do template para definir isFuncionarioTemplate corretamente
    await fetchTemplateDetailsAndSetFuncionario(templateId);

    // Se for template de funcionário e houver cliente selecionado, preenche automaticamente
    if (isFuncionarioTemplate && cliente && (cliente.name || cliente.nome)) {
      setFuncionarioData({
        nome: cliente.name || cliente.nome || "",
        email: cliente.email || "",
        departamento_id: "",
        cargo_id: ""
      });
    } else if (!isFuncionarioTemplate) {
      // Limpa dados do funcionário se não for template de funcionário
      setFuncionarioData({
        nome: "",
        email: "",
        departamento_id: "",
        cargo_id: ""
      });
    }
  };


  async function fetchClientes() {
    const token = localStorage.getItem("token");
    const userDataRaw = localStorage.getItem("userData");
    const userRaw = localStorage.getItem("user");
    
    const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
    const user = userRaw ? JSON.parse(userRaw) : null;
    const empresaId = userData?.EmpresaId || user?.EmpresaId || user?.equipe_id;

    if (!empresaId) {
      console.error("EmpresaId não encontrado");
      return [];
    }

    setLoadingClientes(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/pre-clientes/empresa/${empresaId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error("Erro ao buscar clientes.");

      const data = await res.json();

      
      // Se for template de funcionário, filtrar apenas funcionários (funcionario = 1)
      if (isFuncionarioTemplate) {
        const funcionarios = data.filter(cliente => cliente.funcionario === 1);
        setClientes(funcionarios);
        return funcionarios;
      } else {
        // Se for template normal, filtrar apenas clientes (funcionario = 0 ou null)
        const clientesNormais = data.filter(cliente => !cliente.funcionario || cliente.funcionario === 0);
        setClientes(clientesNormais);
        return clientesNormais;
      }
    } catch (err) {
      console.error("Erro ao carregar clientes:", err);
      toast.error("Erro ao carregar lista de clientes!");
      return [];
    } finally {
      setLoadingClientes(false);
    }
  }



  const fetchProdutos = async () => {
    try {
      const userDataRaw = localStorage.getItem("userData");
      const userRaw = localStorage.getItem("user");
      const token = localStorage.getItem("token");

      if (!token) return;

      const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
      const user = userRaw ? JSON.parse(userRaw) : null;
      const empresaId = userData?.EmpresaId || user?.EmpresaId || user?.equipe_id;

      if (!empresaId) return;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/comercial/produtos/empresa/${empresaId}`,
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
      const userDataRaw = localStorage.getItem("userData");
      const userRaw = localStorage.getItem("user");
      const token = localStorage.getItem("token");
      
      if (!token) return;
      
      const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
      const user = userRaw ? JSON.parse(userRaw) : null;
      const empresaId = userData?.EmpresaId || user?.EmpresaId || user?.equipe_id;

      if (!empresaId) return;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/contatos/equipe/${empresaId}`, {
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

  // Função para buscar departamentos da empresa
  const fetchDepartamentos = async () => {
    try {
      const userDataRaw = localStorage.getItem("userData");
      const userRaw = localStorage.getItem("user");
      const token = localStorage.getItem("token");
      
      if (!token) return;
      
      const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
      const user = userRaw ? JSON.parse(userRaw) : null;
      const empresaId = userData?.EmpresaId || user?.EmpresaId || user?.equipe_id;

      if (!empresaId) return;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/departamentos/empresa/${empresaId}?status=ativo`, {
        method: "GET",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Erro ao buscar departamentos:", res.status, errorText);
        throw new Error(`Erro ao buscar departamentos: ${res.status}`);
      }

      const data = await res.json();
      setDepartamentos(data);
    } catch (error) {
      console.error("Erro ao carregar departamentos:", error);
      setDepartamentos([]);
    }
  };

  // Função para buscar cargos da empresa
  const fetchCargos = async () => {
    try {
      const userDataRaw = localStorage.getItem("userData");
      const userRaw = localStorage.getItem("user");
      const token = localStorage.getItem("token");
      
      if (!token) return;
      
      const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
      const user = userRaw ? JSON.parse(userRaw) : null;
      const empresaId = userData?.EmpresaId || user?.EmpresaId || user?.equipe_id;

      if (!empresaId) return;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cargos`, {
        method: "GET",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-empresa-id": empresaId.toString()
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Erro ao buscar cargos:", res.status, errorText);
        throw new Error(`Erro ao buscar cargos: ${res.status}`);
      }

      const data = await res.json();
      setCargos(data);
    } catch (error) {
      console.error("Erro ao carregar cargos:", error);
      setCargos([]);
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
        const userDataRaw = localStorage.getItem("userData");
        const userRaw = localStorage.getItem("user");
        const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
        const user = userRaw ? JSON.parse(userRaw) : null;
        const equipeId = userData?.EmpresaId || user?.EmpresaId || user?.equipe_id;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/lista-signatarios`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...novoSignatario,
            empresa_id: equipeId,
          }),
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
      const userDataRaw = localStorage.getItem("userData");
      const userRaw = localStorage.getItem("user");
      const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
      const user = userRaw ? JSON.parse(userRaw) : null;
      const equipeId = userData?.EmpresaId || user?.EmpresaId || user?.equipe_id;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/lista-signatarios`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...novoSignatario,
          empresa_id: equipeId,
        }),
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
      toast.warning(`Selecione um ${isFuncionarioTemplate ? 'funcionário' : 'cliente'} antes de criar o contrato.`);
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

    // Removida validação de valor para upload de PDF (rota não exige)

    // NOVA VALIDAÇÃO: Verificar se há variáveis personalizadas não preenchidas quando há template
    if (selectedTemplate && !uploadedFile) {
      const selectedTemplateObj = templates.find(t => t.id.toString() === selectedTemplate);
      if (selectedTemplateObj) {
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
    }

    // NOVA VALIDAÇÃO: Verificar campos de funcionário se template for de funcionário
    if (isFuncionarioTemplate) {
      if (!funcionarioData.nome.trim() || !funcionarioData.email.trim() || !funcionarioData.departamento_id || !funcionarioData.cargo_id) {
        toast.warning("Preencha todos os campos de funcionário: nome, email, departamento e cargo.");
        setLoading(false);
        return;
      }
    }

    // Buscar os dados do cliente selecionado primeiro
    let cliente = clientes.find((cliente) => {
      const match = cliente.id === clienteSelecionado;
      return match;
    });

    // Se não encontrou e isFuncionarioTemplate é true, forçar recarregamento
    if (!cliente && isFuncionarioTemplate) {
      const clientesAtualizados = await fetchClientes();
      
      // Tentar novamente com a lista atualizada
      cliente = clientesAtualizados.find((cliente) => cliente.id === clienteSelecionado);
    }

    // Garantir que o cliente foi encontrado
    if (!cliente) {
      toast.warning(`${isFuncionarioTemplate ? 'Funcionário' : 'Cliente'} não encontrado. Por favor, selecione um ${isFuncionarioTemplate ? 'funcionário' : 'cliente'} válido.`);
      setLoading(false);
      return;
    }
    

    // Verificação do nome do documento
    // Aceita quando houver nome manual OU quando houver cliente selecionado válido
    if (!nomeDocumento.trim() && !clienteSelecionado) {
      toast.warning(`Por favor, informe o nome do documento ou selecione um ${isFuncionarioTemplate ? 'funcionário' : 'cliente'}.`);
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

    // Obter empresaId do usuário logado (prioriza userData.EmpresaId)
    const userRaw = localStorage.getItem("user");
    const userDataRaw = localStorage.getItem("userData");
    const user = userRaw ? JSON.parse(userRaw) : {};
    const userData = userDataRaw ? JSON.parse(userDataRaw) : {};
    const equipeId = userData?.EmpresaId || user?.EmpresaId || user?.equipe_id;
    const createdById = userData?.id || user?.id || "";

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

    const nomeFinal = nomeDocumento || `${cliente.name} - Contrato`;

    // Validação de conteúdo ou arquivo (com fallback ao template selecionado)
    if (!uploadedFile && (!content || content.trim() === '')) {
      const selectedTemplateObj = templates.find((t) => t.id.toString() === selectedTemplate);
      if (selectedTemplateObj?.conteudo) {
        setContent(selectedTemplateObj.conteudo);
      } else if (selectedTemplateObj?.content) {
        setContent(selectedTemplateObj.content);
      } else {
        toast.warning("Por favor, adicione conteúdo ao documento ou faça upload de um arquivo PDF antes de criar o contrato.");
        setLoading(false);
        return;
      }
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
        // Enviar como multipart/form-data, sem base64
        const formData = new FormData();
        formData.append("arquivo", uploadedFile);
        formData.append("name", nomeFinal);
        formData.append("empresa_id", equipeId);
        formData.append("created_by", createdById);
        formData.append("client_id", clienteSelecionado);
        formData.append("expires_at", validade);
        formData.append("start_at", vigenciaInicio);
        formData.append("end_at", vigenciaFim);
        formData.append("signatories", JSON.stringify(signatariosToSend.map(sig => ({
          name: sig.name,
          cpf: sig.cpf || null,
          email: sig.email || null,
          phone: sig.telefone || null
        }))));

      
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/documentos-autentique`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        body: formData,
        });
      } else {
        // Verifica se o conteúdo tem pelo menos algum texto significativo (não apenas tags HTML)
        const contentWithoutTags = content.replace(/<[^>]*>/g, '').trim();
        if (contentWithoutTags.length < 10) {
          toast.warning("Por favor, adicione mais conteúdo ao documento. O texto deve ter pelo menos 10 caracteres.");
          setLoading(false);
          return;
        }
        
        // Buscar dados do cliente selecionado
        const cliente = clientes.find((c) => c.id.toString() === clienteSelecionado);
        
        // Criar array de variáveis incluindo dados do cliente e contrato
        const variables = [
          // Variáveis do cliente
          { variable_name: "client.type", value: cliente?.type || "" },
          { variable_name: "client.name", value: cliente?.name || "" },
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
          { variable_name: "client.equipe_id", value: cliente?.equipe_id || "" },
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

        // Variáveis de funcionário (se template for de funcionário)
        if (isFuncionarioTemplate) {
          const departamentoSelecionado = departamentos.find(d => d.id.toString() === funcionarioData.departamento_id);
          const cargoSelecionado = cargos.find(c => c.id.toString() === funcionarioData.cargo_id);
          
          variables.push(
            { variable_name: "funcionario.nome", value: funcionarioData.nome },
            { variable_name: "funcionario.email", value: funcionarioData.email },
            { variable_name: "funcionario.departamento", value: departamentoSelecionado?.nome || "" },
            { variable_name: "funcionario.cargo", value: cargoSelecionado?.nome || "" }
          );
        }

        // Envio do HTML usando a nova rota /html
        const payload = {
          template_id: selectedTemplate,
          client_id: clienteSelecionado,
          signatories: signatariosToSend,
          variables: variables,
          empresa_id: equipeId,
          expires_at: validade,
          start_at: vigenciaInicio,
          end_at: vigenciaFim
        };
        
     
    
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/documentos-autentique/html`, {
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
      
      setTimeout(() => router.push(`/contratual/documento/${responseData.document_id}`), 1200);
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
      toast.error("Cliente criado, mas erro ao carregar dados");
      setShowClienteModal(false);
      setActiveTab("documento");
      return;
    }
    
    const clienteData = await res.json();

    setCliente(clienteData);
    setClienteSelecionado(clientIdStr);
    // Preenche automaticamente o nome do documento com o padrão "Nome do Cliente - Documento"
    setNomeDocumento(`${clienteData.name || clienteData.nome || 'Cliente'} - Documento`);
    setShowClienteModal(false);
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/documentos-autentique/${createdContractId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Erro ao buscar documento no Autentique");

      const data = await res.json();
      // O Autentique retorna dados diferentes, então vamos apenas logar por enquanto
    } catch (err) {
      console.error("Erro ao buscar documento no Autentique:", err);
    }
  };

  useEffect(() => {
    if (createdContractId) {
      buscarContratoGerado();
    }
  }, [createdContractId]);


  function maskPhoneBR(value) {
    // Remove tudo que não for número, exceto o 55 inicial
    let v = value.replace(/\D/g, "");

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
    let v = value.replace(/\D/g, "");
    if (!v.startsWith("55")) v = "55" + v;
    return v;
  }


  // Função para aplicar máscara de CPF (000.000.000-00)
  function maskCpfBR(value) {
    let v = value.replace(/\D/g, "");
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


  const etapas = ["cliente", "documento", "signatarios", "outras", "gerar"];
  
  // Função para obter o nome da primeira etapa baseado no template
  const getFirstTabName = () => {
    return isFuncionarioTemplate ? "funcionário" : "cliente";
  };

  // Função para determinar quais abas devem ser mostradas baseado na seleção
  const getVisibleEtapas = () => {
    const etapasBase = ["cliente", "documento"];
    
    if (uploadedFile) {
      // Arquivo upado: seguir direto para signatários e gerar
      return [...etapasBase, "signatarios", "gerar"];
    } else if (selectedTemplate) {
      // Template: manter outras informações (variáveis), sem serviços
      return [...etapasBase, "signatarios", "outras", "gerar"];
    } else {
      // Básicas
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
    
    setActiveTab(tab);
    setShowClienteModal(false);
  };

  // Função para ir para a próxima aba visível
  const nextTab = () => {
    const currentIndex = etapasVisiveis.indexOf(activeTab);
    const nextTab = etapasVisiveis[currentIndex + 1];
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
      const cloneDataRaw = localStorage.getItem("clonedocumentoData");
      
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
          
          // Clona signatários (transforma de signatarios para o formato esperado)
          if (!signatarios.length && cloneData.signatories && cloneData.signatories.length > 0) {
            // Remove campos desnecessários e ajusta formato
            const signatoriesCloned = cloneData.signatories.map(sig => ({
              name: sig.nome || sig.name,
              email: sig.email,
              cpf: sig.cpf || '',
              birth_date: sig.data_nascimento || sig.birth_date || '',
              telefone: sig.telefone || '',
              funcao_assinatura: sig.funcao_assinatura || ''
            }));
            setSignatarios(signatoriesCloned);
          }
          
          toast.success("Documento carregado! Revise os dados antes de salvar.");
          
          // Limpa o localStorage após uso
          localStorage.removeItem("clonedocumentoData");
        } catch (e) {
          console.error("❌ [DEBUG] Erro ao processar dados clonados:", e);
          toast.error("Erro ao processar dados do documento clonado.");
          // Se der erro, limpa para não travar futuras criações
          localStorage.removeItem("clonedocumentoData");
        }
      } else {
      }
    }
  }, [router.query.clone, router.isReady]);

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

  const renderLabel = (text, obrigatorio = false) => (
    <label>
      {text} {obrigatorio && <span style={{color: 'red'}}>*</span>}
    </label>
  );

  return (
    <div className={styles.page}>
      <PrincipalSidebar />
      <div className={styles.pageContent}>
        <div className={styles.header}>
          <h1 className={styles.title}>Criar Novo documento</h1>
          <div className={styles.headerActions}>
            {hasUnsavedChanges && (
              <span className={styles.unsavedIndicator}>
                <FontAwesomeIcon icon={faExclamationTriangle} />
                Alterações não salvas
              </span>
            )}
            {lastSaved && (
              <span className={styles.lastSaved}>
                Último salvamento: {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <button 
              className={styles.saveButton} 
              onClick={() => salvarRascunho()}
              disabled={!hasUnsavedChanges}
            >
              <FontAwesomeIcon icon={faCheckCircle} />
              Salvar Rascunho
            </button>
            <button 
              className={styles.backButton} 
              onClick={handleExitAttempt}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              Voltar
            </button>
          </div>
        </div>
      <div className={styles.infoContainer}>
        <FontAwesomeIcon icon={faRocket} className={styles.infoIcon} />
        <span className={styles.infoText}>
          <strong>Documento Autentique:</strong> Este documento será criado diretamente no Autentique.
        </span>
      </div>
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
              {etapa === "cliente" && (isFuncionarioTemplate ? "Funcionário" : "Cliente")}
              {etapa === "documento" && "Dados do Documento"}
              
              {etapa === "signatarios" && "Signatários"}
              {etapa === "outras" && "Outras Informações"}
              {etapa === "gerar" && "Gerar documento"}
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
            <h2 className={styles.tituloComIcone}>
              <FontAwesomeIcon icon={faUser} style={{ marginRight: 8, color: '#2563eb' }} />
              {isFuncionarioTemplate ? "Selecionar Funcionário" : "Selecionar Cliente"}
            </h2>
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
                
                // Se cliente existe, define como selecionado; se não, abre modal de criação
                if (clienteEncontrado) {
                  setCliente(clienteEncontrado);
                  // Preenche automaticamente o nome do documento com o padrão "Nome do Cliente - Documento"
                  setNomeDocumento(`${clienteEncontrado.name || clienteEncontrado.nome || clienteEncontrado.razao_social || 'Cliente'} - Documento`);
                } else {
                  setCliente(null); // null para criar novo
                  setShowClienteModal(true);
                }
              }}
              value={clienteSelecionado || ""}
              disabled={loadingClientes}
            >
              <option value="" disabled>
                {loadingClientes ? `Carregando ${isFuncionarioTemplate ? 'funcionários' : 'clientes'}...` : `Selecione um ${isFuncionarioTemplate ? 'funcionário' : 'cliente'}...`}
              </option>
              {clientes && clientes.length > 0 ? (
                clientes.map((c) => {
                  // Debug: verificar campos disponíveis
                  const nomeCliente = c.name || c.nome || c.razao_social || `Cliente ${c.id}`;
                  return (
                    <option key={c.id} value={c.id}>
                      {nomeCliente}
                    </option>
                  );
                })
              ) : (
                !loadingClientes && <option value="" disabled>Nenhum {isFuncionarioTemplate ? 'funcionário' : 'cliente'} encontrado</option>
              )}
            </select>

            <button className={styles.button} onClick={() => {
              // Sempre abre modal de criação de novo cliente
              setCliente(null); // null para criar novo
              setShowClienteModal(true);
            }}>
              {isFuncionarioTemplate ? "Novo Funcionário" : "Novo Cliente"}
            </button>
          </div>
        </div>
      )}

      {/* Formulário inline de edição de cliente - aparece sempre que há cliente selecionado */}
      {activeTab === "cliente" && cliente && (
        <div className={styles.clientFormContainer}>
          <ClienteForm
            cliente={cliente}
            onClose={() => {
              setCliente({});
              setClienteSelecionado("");
            }}
            onCreate={handleClienteCriado}
            onUpdate={handleAtualizarCliente}
            isFuncionario={isFuncionarioTemplate}
          />
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
            
                {/* Opção 1: Modelo de documento */}
                <div className={`${styles.choiceOption} ${selectedTemplate ? styles.choiceOptionActive : ''}`}>
                  <div className={styles.choiceHeader}>
                    <div className={styles.choiceIcon}>
                      <FontAwesomeIcon icon={faFileAlt} />
                    </div>
                    <div className={styles.choiceTitle}>
                      <h4>Modelo de documento</h4>
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
                    placeholder={`${cliente?.name || 'Cliente'} - documento`}
                    value={nomeDocumento || ""}
                    onChange={(e) => setNomeDocumento(e.target.value)}
                    style={{ width: '100%' }}
                  />
                  <small style={{ color: '#666', fontSize: '12px' }}>
                    Deixe em branco para usar o nome padrão: "{cliente?.name || 'Cliente'} - documento"
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
                  toast.warning(`Selecione um ${isFuncionarioTemplate ? 'funcionário' : 'cliente'} primeiro.`);
                  return;
                }
                setNovoSignatario((prev) => ({
                  ...prev,
                  name: (cliente.name || cliente.nome || ""),
                  email: (cliente.email || "").toLowerCase(),
                  cpf: cleanCpf(cliente.cpf_cnpj || ""),
                  telefone: maskPhoneBR(cliente.telefone || ""),
                }));
              }}
            >
              {isFuncionarioTemplate ? "Adicionar funcionário" : "Adicionar cliente"}
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
          
          {/* Aviso sobre variáveis obrigatórias */}
          <div className={styles.infoContainer}>
            <FontAwesomeIcon icon={faInfoCircle} className={styles.infoIcon} />
            <span className={styles.infoText}>
              <strong>Variáveis Personalizadas:</strong> Preencha todos os campos abaixo antes de criar o contrato.
              {isFuncionarioTemplate && " Incluindo os dados do funcionário que será cadastrado automaticamente."}
            </span>
          </div>

          {(() => {
            // Recupera o template selecionado (caso o usuário tenha escolhido)
            const selectedTemplateObj = templates.find(
              (t) => String(t.id) === String(selectedTemplate)
            );
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
            const templateContent = selectedTemplateObj?.content || selectedTemplateObj?.conteudo || "";
          
            const customVarsToShow = getCustomVariablesInTemplate(
              templateContent,
              customVariables
            );

            // Caso não tenha selecionado template ou não tenha variável no template
            if (!selectedTemplateObj)
              return (
                <p style={{ marginTop: "1rem" }}>
                  Selecione um modelo de contrato para exibir as variáveis personalizadas.
                </p>
              );
            if (customVarsToShow.length === 0)
              return (
                <p style={{ marginTop: "1rem" }}>
                  Nenhuma variável personalizada presente neste modelo de contrato.
                </p>
              );

            // Verifica quais variáveis estão preenchidas
            const filledVars = customVarsToShow.filter(v => 
              customValues[v.variable] && customValues[v.variable].trim() !== ''
            );
            const unfilledVars = customVarsToShow.filter(v => 
              !customValues[v.variable] || customValues[v.variable].trim() === ''
            );

            // Adiciona campos de funcionário na contagem se template for de funcionário
            const funcionarioUnfilled = isFuncionarioTemplate ? [
              ...(!funcionarioData.nome.trim() ? ['Nome do Funcionário'] : []),
              ...(!funcionarioData.email.trim() ? ['Email do Funcionário'] : []),
              ...(!funcionarioData.departamento_id ? ['Departamento'] : []),
              ...(!funcionarioData.cargo_id ? ['Cargo'] : [])
            ] : [];
            
            const totalUnfilledVars = unfilledVars.length + funcionarioUnfilled.length;

            // Renderiza apenas as variáveis personalizadas realmente utilizadas no template
            return (
              <div>

                {/* Campos das variáveis */}
                <div className={styles.grid}>
                  {/* Campos de funcionário (se template for de funcionário) */}
                  {isFuncionarioTemplate && (
                    <>
                      <div style={{ marginBottom: "1rem" }}>
                        <label className={styles.label}>
                          Nome do Funcionário <span style={{color: 'var(--onity-color-error)'}}>*</span>
                        </label>
                        <input
                          className={styles.input}
                          type="text"
                          placeholder="Nome completo do funcionário"
                          value={funcionarioData.nome}
                          onChange={(e) => setFuncionarioData(prev => ({ ...prev, nome: e.target.value }))}
                          style={{
                            borderColor: funcionarioData.nome.trim() ? 'var(--onity-color-success)' : 'var(--onity-color-error)',
                            borderWidth: '2px'
                          }}
                          required
                        />
                        {!funcionarioData.nome.trim() && (
                          <small style={{ color: 'var(--onity-color-error)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            Este campo é obrigatório
                          </small>
                        )}
                        {funcionarioData.nome.trim() && (
                          <small style={{ color: 'var(--onity-color-success)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            ✓ Preenchido
                          </small>
                        )}
                      </div>
                      
                      <div style={{ marginBottom: "1rem" }}>
                        <label className={styles.label}>
                          Email do Funcionário <span style={{color: 'var(--onity-color-error)'}}>*</span>
                        </label>
                        <input
                          className={styles.input}
                          type="email"
                          placeholder="email@exemplo.com"
                          value={funcionarioData.email}
                          onChange={(e) => setFuncionarioData(prev => ({ ...prev, email: e.target.value.toLowerCase() }))}
                          style={{
                            borderColor: funcionarioData.email.trim() ? 'var(--onity-color-success)' : 'var(--onity-color-error)',
                            borderWidth: '2px'
                          }}
                          required
                        />
                        {!funcionarioData.email.trim() && (
                          <small style={{ color: 'var(--onity-color-error)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            Este campo é obrigatório
                          </small>
                        )}
                        {funcionarioData.email.trim() && (
                          <small style={{ color: 'var(--onity-color-success)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            ✓ Preenchido
                          </small>
                        )}
                      </div>
                      
                      <div style={{ marginBottom: "1rem" }}>
                        <label className={styles.label}>
                          Departamento <span style={{color: 'var(--onity-color-error)'}}>*</span>
                        </label>
                        <select
                          className={styles.input}
                          value={funcionarioData.departamento_id}
                          onChange={(e) => setFuncionarioData(prev => ({ ...prev, departamento_id: e.target.value }))}
                          style={{
                            borderColor: funcionarioData.departamento_id ? 'var(--onity-color-success)' : 'var(--onity-color-error)',
                            borderWidth: '2px'
                          }}
                          required
                        >
                          <option value="">Selecione um departamento</option>
                          {departamentos.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.nome}
                            </option>
                          ))}
                        </select>
                        {!funcionarioData.departamento_id && (
                          <small style={{ color: 'var(--onity-color-error)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            Este campo é obrigatório
                          </small>
                        )}
                        {funcionarioData.departamento_id && (
                          <small style={{ color: 'var(--onity-color-success)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            ✓ Preenchido
                          </small>
                        )}
                      </div>
                      
                      <div style={{ marginBottom: "1rem" }}>
                        <label className={styles.label}>
                          Cargo <span style={{color: 'var(--onity-color-error)'}}>*</span>
                        </label>
                        <select
                          className={styles.input}
                          value={funcionarioData.cargo_id}
                          onChange={(e) => setFuncionarioData(prev => ({ ...prev, cargo_id: e.target.value }))}
                          style={{
                            borderColor: funcionarioData.cargo_id ? 'var(--onity-color-success)' : 'var(--onity-color-error)',
                            borderWidth: '2px'
                          }}
                          required
                        >
                          <option value="">Selecione um cargo</option>
                          {cargos.map((cargo) => (
                            <option key={cargo.id} value={cargo.id}>
                              {cargo.nome}
                            </option>
                          ))}
                        </select>
                        {!funcionarioData.cargo_id && (
                          <small style={{ color: 'var(--onity-color-error)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            Este campo é obrigatório
                          </small>
                        )}
                        {funcionarioData.cargo_id && (
                          <small style={{ color: 'var(--onity-color-success)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            ✓ Preenchido
                          </small>
                        )}
                      </div>
                    </>
                  )}
                  
                  {customVarsToShow.map((v) => {
                    const isFilled = customValues[v.variable] && customValues[v.variable].trim() !== '';
                    const isRequired = true; // Todas as variáveis personalizadas são obrigatórias
                    
                    return (
                      <div key={v.variable} style={{ marginBottom: "1rem" }}>
                        <label className={styles.label}>
                          {v.label} {isRequired && <span style={{color: 'var(--onity-color-error)'}}>*</span>}
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
                            borderColor: isFilled ? 'var(--onity-color-success)' : 'var(--onity-color-error)',
                            borderWidth: '2px'
                          }}
                        />
                        {!isFilled && (
                          <small style={{ color: 'var(--onity-color-error)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            Este campo é obrigatório
                          </small>
                        )}
                        {isFilled && (
                          <small style={{ color: 'var(--onity-color-success)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            ✓ Preenchido
                          </small>
                        )}
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
              {loading ? "Criando no Autentique..." : "Criar Documento Autentique"}
            </button>
          </div>

        </>
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
              // Preenche automaticamente o nome do documento com o padrão "Nome do Cliente - Documento"
              setNomeDocumento(`${clienteData.name || clienteData.nome || 'Cliente'} - Documento`);
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
          cliente={clienteSelecionado && cliente ? cliente : null}
          onClose={() => setShowClienteModal(false)}
          onCreate={handleClienteCriado}
          onUpdate={handleAtualizarCliente}
          isFuncionario={isFuncionarioTemplate}
        />
      )}


      {showProdutoModal && (
        <ProdutoModal
          produtos={produtos}
          onClose={() => setShowProdutoModal(false)}
          onAdd={(produto) => setProdutosSelecionados([...produtosSelecionados, produto])}
        />
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
      
      {/* Modal de confirmação de saída */}
      {showExitModal && (
        <div className={styles.modalOverlay} onClick={cancelExit}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: '8px', color: '#f59e0b' }} />
                Alterações não salvas
              </h3>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalText}>
                Você tem alterações não salvas. O que deseja fazer?
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
                style={{ background: '#ef4444', color: 'white' }}
              >
                <FontAwesomeIcon icon={faTrash} style={{ marginRight: '6px' }} />
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
          <SpaceLoader size={120} label="Criando documento..." showText={true} minHeight={300} />
        </div>
      )}
    </div>
  );
}