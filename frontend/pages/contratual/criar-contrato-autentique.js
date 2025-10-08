import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import SpaceLoader from "../../components/onety/menu/SpaceLoader";
import styles from "../../styles/contratual/CriarContrato.module.css";
import LeadsModal from "../../components/comercial/modal/LeadsModal";
import ClienteForm from "../../components/contratual/ClienteForm";
import ProdutoModal from "../../components/contratual/ProdutoModal";
import LeadToClientForm from "../../components/contratual/LeadToClientForm";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faPen, faTrash, faUser, faFileAlt, faBoxOpen, faUserPlus, faInfoCircle, faRocket, faCloudUploadAlt, faCheckCircle, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { fetchClienteById } from "../../utils/fetchClienteById";
import ListaSignatarios from "../../components/contratual/ListaSignatarios";
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ToggleSimNao from "../../components/contratual/ToggleSimNao";
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
  const [nomeDocumento, setNomeDocumento] = useState(""); // Nome do documento no Autentique
  const [uploadedFile, setUploadedFile] = useState(null); // Arquivo upado
  const [uploadFileName, setUploadFileName] = useState(""); // Nome do arquivo upado
  const [showUploadWarning, setShowUploadWarning] = useState(false); // Aviso de conflito entre modelo e upload
  const [uploadProgress, setUploadProgress] = useState(0); // Progresso do upload
  const [valorContrato, setValorContrato] = useState(""); // Valor do contrato (TCV) - NOVO
  const [valorRecorrente, setValorRecorrente] = useState(""); // MRR manual para upload


  const handleLeadSelecionado = (lead) => {
    setLeadSelecionado(lead);
    setShowLeadsModal(false);
    setShowLeadToClientForm(true); // mostrar o formulário de conversão
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


  useEffect(() => {
    const fetchUsuario = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/usuarios`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Erro ao obter dados do usuário: ${res.statusText}`);
        }

        const data = await res.json();
        setUsuario({
          full_name: data.full_name || "",
          email: data.email || "",
        });
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

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/modelos-contrato`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-equipe-id": user?.EmpresaId,

        },
      });

      if (!res.ok) throw new Error("Erro ao buscar templates.");

      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      console.error("Erro ao carregar templates:", err);
    }
  }

  const handleTemplateChange = (e) => {
    const templateId = e.target.value;
    setSelectedTemplate(templateId);

    // Encontra o template correspondente e preenche o conteúdo
    const selected = templates.find((template) => template.id.toString() === templateId);
    setContent(selected ? selected.content : "");
  };


  async function fetchClientes() {
    const token = localStorage.getItem("token"); // Obtém o token JWT do localStorage
    const userRaw = localStorage.getItem("userData");
    const user = JSON.parse(userRaw);
    const equipeId = user.EmpresaId;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/pre-clientes/empresa/${equipeId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,  // Envia o token JWT no cabeçalho
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error("Erro ao buscar clientes.");

      const data = await res.json();
      setClientes(data);
    } catch (err) {
      console.error("Erro ao carregar clientes:", err);
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
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/lista-signatarios`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...novoSignatario,
            equipe_id: equipeId,
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
      const userRaw = localStorage.getItem("userData");
      const user = userRaw ? JSON.parse(userRaw) : {};
      const equipeId = user.EmpresaId;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/lista-signatarios`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...novoSignatario,
          equipe_id: equipeId,
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
      if (selectedTemplateObj) {
        const customVarsInTemplate = customVariables.filter(v => 
          selectedTemplateObj.content.includes(`{{${v.variable}}}`)
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

    // Buscar os dados do cliente selecionado primeiro
    const cliente = clientes.find((cliente) => cliente.id.toString() === clienteSelecionado);

    // Garantir que o cliente foi encontrado
    if (!cliente) {
      toast.warning("Cliente não encontrado. Por favor, selecione um cliente válido.");
      setLoading(false);
      return;
    }

    // Verificação do nome do documento
    if (!nomeDocumento.trim() && !cliente.name) {
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

    const nomeFinal = nomeDocumento || `${cliente.name} - Contrato`;

    // Validação de conteúdo ou arquivo
    if (!uploadedFile && (!content || content.trim() === '')) {
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
        const payload = {
          name: nomeFinal,
          content: base64, // PDF em base64
          signatories: signatariosToSend.map(sig => ({
            name: sig.name,
            cpf: sig.cpf || null,
            email: sig.email || null,
            phone: sig.telefone || null
          })),
          equipe_id: equipeId,
          created_by: user.id,
          valor: uploadedFile ? parseFloat(valorContrato) : valorTotalContrato, // Usa valor do campo ou calculado dos produtos
          valor_recorrente: valorRecorrente ? parseFloat(valorRecorrente) : null,
          client_id: clienteSelecionado,
          expires_at: validade,
          start_at: vigenciaInicio,
          end_at: vigenciaFim
        };
        
        console.log("Enviando payload com PDF base64:", {
          name: payload.name,
          contentLength: payload.content.length,
          signatoriesCount: payload.signatories.length,
          equipe_id: payload.equipe_id,
          created_by: payload.created_by,
          valor: payload.valor,
          client_id: payload.client_id,
          expires_at: payload.expires_at,
          start_at: payload.start_at,
          end_at: payload.end_at
        });
        console.log("Primeiros 100 caracteres do base64:", payload.content.substring(0, 100));
        console.log("URL da API:", `${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos-autentique`);
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos-autentique`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
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

        // Envio do HTML usando a nova rota /html
        const payload = {
          template_id: selectedTemplate,
          client_id: clienteSelecionado,
          signatories: signatariosToSend,
          variables: variables,
          equipe_id: equipeId,
          valor: valorTotalContrato,
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
          end_at: vigenciaFim
        };
        
        console.log("Enviando payload com HTML para rota /html:", {
          template_id: payload.template_id,
          client_id: payload.client_id,
          signatoriesCount: payload.signatories.length,
          variablesCount: payload.variables.length,
          equipe_id: payload.equipe_id,
          valor: payload.valor,
          expires_at: payload.expires_at,
          start_at: payload.start_at,
          end_at: payload.end_at
        });
        console.log("Variáveis sendo enviadas:", payload.variables);
        console.log("Cliente selecionado:", cliente?.name);
        console.log("Produtos selecionados:", produtosSelecionados.length);
        console.log("URL da API:", `${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos-autentique/html`);
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
      
        setTimeout(() => router.push(`/contrato/${responseData.contract_id}`), 1200);
    } catch (err) {
      toast.error("Erro ao criar contrato.");
      console.error(err);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleClienteCriado = async (clientId) => {
    await fetchClientes();

    const token = localStorage.getItem("token");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/pre-clientes/${clientId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const clienteData = await res.json();

    setCliente(clienteData);
    setClienteSelecionado(clientId.toString());
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
      console.log("Dados do contrato Autentique:", data);
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
    
    setActiveTab(tab);
    setShowClienteFormModal(false);
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
      const cloneDataRaw = localStorage.getItem("cloneContratoData");
      if (cloneDataRaw) {
        try {
          const cloneData = JSON.parse(cloneDataRaw);
          // Preenche os campos principais, se ainda não preenchidos
          if (!clienteSelecionado && cloneData.client_id) setClienteSelecionado(cloneData.client_id.toString());
          if (!selectedTemplate && cloneData.template_id) setSelectedTemplate(cloneData.template_id.toString());
          if (!content && cloneData.content) setContent(cloneData.content);
          if (!validade && cloneData.expires_at) setValidade(cloneData.expires_at);
          if (!vigenciaInicio && cloneData.start_at) setVigenciaInicio(cloneData.start_at);
          if (!vigenciaFim && cloneData.end_at) setVigenciaFim(cloneData.end_at);
          if (!produtosSelecionados.length && cloneData.produtos) setProdutosSelecionados(cloneData.produtos);
          if (!signatarios.length && cloneData.signatories) setSignatarios(cloneData.signatories);
          if (!customValues || Object.keys(customValues).length === 0) {
            if (cloneData.variables) {
              const customVars = {};
              cloneData.variables.forEach(v => {
                if (v.variable_name && v.value) customVars[v.variable_name] = v.value;
              });
              setCustomValues(customVars);
            }
          }
          // Limpa o localStorage após uso
          localStorage.removeItem("cloneContratoData");
        } catch (e) {
          // Se der erro, limpa para não travar futuras criações
          localStorage.removeItem("cloneContratoData");
        }
      }
    }
  }, [router.query.clone]);

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
    <>
      <div className={styles.page}>
        <PrincipalSidebar />
        <div className={styles.pageContent}>
          <div className={styles.pageContainer}>
            {loading && (
              <div className={styles.loadingOverlay}>
                <SpaceLoader 
                  size={140} 
                  label="Criando contrato..." 
                  showText={true}
                  minHeight={400}
                />
              </div>
            )}
            <button className={styles.backButton} onClick={() => router.back()}>
              <FontAwesomeIcon icon={faArrowLeft} /> Voltar
            </button>
      <h1 className={styles.title}>Criar Novo Contrato</h1>
      <div className={styles.infoContainer}>
        <FontAwesomeIcon icon={faRocket} className={styles.infoIcon} />
        <span className={styles.infoText}>
          <strong>Contrato Autentique:</strong> Este contrato será criado diretamente no Autentique.
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
                const cliente = clientes.find(c => c.id.toString() === clienteId);
                setClienteSelecionado(clienteId);
                setCliente(cliente);
                setShowClienteFormModal(true);
              }}
              value={clienteSelecionado || ""}
            >
              <option value="">Selecione um cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <button className={styles.button} onClick={() => {
              setCliente(null);
              setShowClienteFormModal(true);
            }}>
              Criar Cliente
            </button>
          </div>
        </div>
      )}


      {activeTab === "documento" && (
        <div>
          <h2 className={styles.tituloComIcone}><FontAwesomeIcon icon={faFileAlt} style={{ marginRight: 8, color: '#2563eb' }} />Dados do Documento</h2>

                    {/* Modelo de Contrato e Upload de Arquivo - lado a lado */}
          {/* Seção de Escolha do Documento */}
          <div className={styles.documentChoiceSection}>
            <h3 className={styles.sectionTitle}>Escolha o Documento</h3>
            <p className={styles.sectionDescription}>
              Selecione um modelo de contrato existente ou faça upload de um arquivo PDF personalizado
            </p>
            
            <div className={styles.choiceContainer}>
              {/* Opção 1: Modelo de Contrato */}
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
                      <option key={t.id} value={t.id}>{t.name}</option>
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

          {/* Nome do Documento */}
          <div style={{ marginTop: "2rem" }}>
            <label className={styles.label}>Nome do Documento</label>
            <input
              className={styles.input}
              type="text"
              placeholder={`${cliente?.name || 'Cliente'} - Contrato`}
              value={nomeDocumento || ""}
              onChange={(e) => setNomeDocumento(e.target.value)}
              style={{ width: '100%', maxWidth: '500px' }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              Deixe em branco para usar o nome padrão: "{cliente?.name || 'Cliente'} - Contrato"
            </small>
          </div>


          {/* Expiração */}
          <div style={{ marginTop: "2rem", display: "flex", gap: "2rem", alignItems: "flex-end" }}>
            <div>
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

            <div>
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
          <div style={{ marginTop: "2rem", display: "flex", gap: "2rem", alignItems: "flex-end" }}>
            <div>
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

            <div>
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

            <div>
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
                          // 3. Gerar as linhas da tabela
                          const linhas = [];
                          let dataBase = dataPrimeiroVencimento ? new Date(dataPrimeiroVencimento) : new Date();
                          for (let i = 0; i < maxParcelas; i++) {
                            // Calcular data de pagamento
                            let dataPagamento = new Date(dataBase);
                            if (i > 0) {
                              dataPagamento.setMonth(dataPagamento.getMonth() + i);
                              dataPagamento.setDate(diaVencimento);
                            } else {
                              dataPagamento.setDate(diaVencimento);
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
                                <td>{dataPagamento.toLocaleDateString('pt-BR')}</td>
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
        <div>
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
                  name: (cliente.name || ""),
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
          
          {/* Aviso sobre variáveis obrigatórias */}
          <div className={styles.infoContainer}>
            <FontAwesomeIcon icon={faInfoCircle} className={styles.infoIcon} />
            <span className={styles.infoText}>
              <strong>Variáveis Personalizadas:</strong> Preencha todos os campos abaixo antes de criar o contrato.
            </span>
          </div>

          {(() => {
            // Recupera o template selecionado (caso o usuário tenha escolhido)
            const selectedTemplateObj = templates.find(
              (t) => t.id.toString() === selectedTemplate
            );
            // Função para filtrar variáveis presentes no conteúdo do template
            function getCustomVariablesInTemplate(content, customVariables) {
              if (!content || !customVariables) return [];
              return customVariables.filter((v) =>
                content.includes(`{{${v.variable}}}`)
              );
            }
            // Filtra as variáveis personalizadas presentes no template selecionado
            const customVarsToShow = getCustomVariablesInTemplate(
              selectedTemplateObj?.content,
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

            // Renderiza apenas as variáveis personalizadas realmente utilizadas no template
            return (
              <div>
                {/* Status das variáveis */}
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '16px', 
                  background: unfilledVars.length > 0 ? '#fff3cd' : '#d4edda', 
                  border: `1px solid ${unfilledVars.length > 0 ? '#ffeaa7' : '#c3e6cb'}`, 
                  borderRadius: '8px',
                  color: unfilledVars.length > 0 ? '#856404' : '#155724'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <FontAwesomeIcon 
                      icon={unfilledVars.length > 0 ? faInfoCircle : faInfoCircle} 
                      style={{ color: unfilledVars.length > 0 ? '#856404' : '#155724' }} 
                    />
                    <strong>
                      {unfilledVars.length > 0 
                        ? `${unfilledVars.length} variável(is) não preenchida(s)` 
                        : 'Todas as variáveis estão preenchidas! ✅'
                      }
                    </strong>
                  </div>
                  {unfilledVars.length > 0 && (
                    <p style={{ margin: 0, fontSize: '14px' }}>
                      Preencha as seguintes variáveis: <strong>{unfilledVars.map(v => v.label || v.variable).join(', ')}</strong>
                    </p>
                  )}
                </div>

                {/* Campos das variáveis */}
                <div className={styles.grid}>
                  {customVarsToShow.map((v) => {
                    const isFilled = customValues[v.variable] && customValues[v.variable].trim() !== '';
                    const isRequired = true; // Todas as variáveis personalizadas são obrigatórias
                    
                    return (
                      <div key={v.variable} style={{ marginBottom: "1rem" }}>
                        <label className={styles.label}>
                          {v.label} {isRequired && <span style={{color: 'red'}}>*</span>}
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
                        {!isFilled && (
                          <small style={{ color: '#dc3545', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            Este campo é obrigatório
                          </small>
                        )}
                        {isFilled && (
                          <small style={{ color: '#28a745', fontSize: '12px', marginTop: '4px', display: 'block' }}>
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
              {loading ? "Criando no Autentique..." : "Criar Contrato Autentique"}
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
              setActiveTab("documento");
            } catch (error) {
              console.error("Erro ao buscar cliente criado:", error);
            }
            await fetchClientes(); // Atualiza lista geral de clientes
          }}
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
        </div>
      </div>
    </>
  );
}