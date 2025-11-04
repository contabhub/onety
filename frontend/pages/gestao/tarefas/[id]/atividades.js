// @ts-nocheck
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Download } from "lucide-react";
import { format, differenceInDays, addHours, addDays } from "date-fns";
import { ptBR } from "date-fns/locale"; // Importação correta do locale
import { Paperclip, ClipboardList, Pencil, XCircle, Upload, Mail, Check, X } from "lucide-react";
import EmailModal from "../../../../components/gestao/EmailModal.js";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Comentarios from "../../../../components/gestao/Comentarios.js"; // ajuste o path conforme onde você salvou
import styles from "../../../../styles/gestao/TarefasAtividades.module.css";
import PrincipalSidebar from "../../../../components/onety/principal/PrincipalSidebar.js";

// Fallback para projetos sem o hook
const useAuthRedirectWithReturn = () => {};

// Pequeno wrapper de API usando fetch (com token e X-Empresa-Id automáticos)
const BASE_CANDIDATE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const LOCAL_API_BASE = (typeof window !== 'undefined') ? (localStorage.getItem('apiBase') || '') : '';
const BASE_URL = (BASE_CANDIDATE || LOCAL_API_BASE || 'http://localhost:5000').replace(/\/$/, '');
const normalizeUrl = (u) => `${BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;

function resolveEmpresaIdFromStorage() {
  try {
    const raw = (typeof window !== 'undefined') ? (localStorage.getItem('userData') || sessionStorage.getItem('userData') || sessionStorage.getItem('usuario')) : null;
    const user = raw ? JSON.parse(raw) : null;
    if (user?.EmpresaId) return String(user.EmpresaId);
    const fallback = (typeof window !== 'undefined') ? (localStorage.getItem('empresaId') || sessionStorage.getItem('empresaId')) : null;
    return fallback ? String(fallback) : null;
  } catch (_) { return null; }
}

function resolveToken() {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
  } catch (_) { return null; }
}

function withAuthHeaders(opts = {}) {
  const token = resolveToken();
  const empresaId = resolveEmpresaIdFromStorage();
  const baseHeaders = { ...(opts.headers || {}) };
  if (token && !baseHeaders.Authorization) baseHeaders.Authorization = `Bearer ${token}`;
  if (empresaId && !baseHeaders['X-Empresa-Id']) baseHeaders['X-Empresa-Id'] = empresaId;
  return { ...opts, headers: baseHeaders };
}

const api = {
  async get(url, opts = {}) {
    const finalOpts = withAuthHeaders(opts);
    const fullUrl = normalizeUrl(url);
    try {
      const res = await fetch(fullUrl, { ...(finalOpts || {}) });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[API GET ERROR]', { url: fullUrl, status: res.status, text, headers: finalOpts.headers });
        throw new Error(`GET ${fullUrl} failed ${res.status}`);
      }
      if (opts && opts.responseType === 'blob') {
        const data = await res.blob();
        return { data };
      }
      const data = await res.json().catch(() => ({}));
      return { data };
    } catch (e) {
      console.error('[API GET FAILED TO FETCH]', { url: fullUrl, headers: finalOpts.headers, error: String(e) });
      throw e;
    }
  },
  async post(url, body, opts = {}) {
    const finalOpts = withAuthHeaders(opts);
    const isFormData = (typeof FormData !== 'undefined') && body instanceof FormData;
    const headers = { ...(finalOpts.headers || {}) };
    const payload = isFormData ? body : JSON.stringify(body ?? {});
    if (!isFormData && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const fullUrl = normalizeUrl(url);
    try {
      const res = await fetch(fullUrl, { method: 'POST', headers, body: payload });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[API POST ERROR]', { url: fullUrl, status: res.status, text, headers });
        throw new Error(`POST ${fullUrl} failed ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      return { data };
    } catch (e) {
      console.error('[API POST FAILED TO FETCH]', { url: fullUrl, headers, error: String(e) });
      throw e;
    }
  },
  async patch(url, body, opts = {}) {
    const finalOpts = withAuthHeaders(opts);
    const headers = { 'Content-Type': 'application/json', ...(finalOpts.headers || {}) };
    const fullUrl = normalizeUrl(url);
    try {
      const res = await fetch(fullUrl, { method: 'PATCH', headers, body: JSON.stringify(body ?? {}) });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[API PATCH ERROR]', { url: fullUrl, status: res.status, text, headers });
        throw new Error(`PATCH ${fullUrl} failed ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      return { data };
    } catch (e) {
      console.error('[API PATCH FAILED TO FETCH]', { url: fullUrl, headers, error: String(e) });
      throw e;
    }
  },
  async delete(url, opts = {}) {
    const finalOpts = withAuthHeaders(opts);
    const fullUrl = normalizeUrl(url);
    try {
      const res = await fetch(fullUrl, { method: 'DELETE', ...(finalOpts || {}) });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[API DELETE ERROR]', { url: fullUrl, status: res.status, text, headers: finalOpts.headers });
        throw new Error(`DELETE ${fullUrl} failed ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      return { data };
    } catch (e) {
      console.error('[API DELETE FAILED TO FETCH]', { url: fullUrl, headers: finalOpts.headers, error: String(e) });
      throw e;
    }
  }
};

function formatarCnpjCpf(cnpjCpf) {
    if (!cnpjCpf) return "";
    
    // Remove todos os caracteres não numéricos
    const numeros = cnpjCpf.replace(/\D/g, "");
    
    // Verifica se é CPF (11 dígitos) ou CNPJ (14 dígitos)
    if (numeros.length === 11) {
        // Formata CPF: 000.000.000-00
        return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (numeros.length === 14) {
        // Formata CNPJ: 00.000.000/0000-00
        return numeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    
    // Se não for nem CPF nem CNPJ, retorna o valor original
    return cnpjCpf;
}

export default function AtividadesTarefa() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  
  // Usar o hook de redirecionamento com retorno
  useAuthRedirectWithReturn();

  const [tarefasInfo, setTarefasInfo] = useState(null);
  const [tarefaPai, setTarefaPai] = useState(null);
  const [atividades, setAtividades] = useState([]);
  const [subprocessos, setSubprocessos] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('atividades');
  const [mostrarSubprocessos, setMostrarSubprocessos] = useState(false);
  const [modalUploadAberto, setModalUploadAberto] = useState(false);
  const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
  const [arquivosSelecionados, setArquivosSelecionados] = useState([]);
  const [emailModalAberto, setEmailModalAberto] = useState(false);
  const [emailAssunto, setEmailAssunto] = useState("");
  const [emailCorpo, setEmailCorpo] = useState("");
  const [departamentos, setDepartamentos] = useState({});
  const [descricaoVisivel, setDescricaoVisivel] = useState({});
  const [justificativaModalAberto, setJustificativaModalAberto] = useState(false);
  const [justificativaTexto, setJustificativaTexto] = useState("");
  const [comentarios, setComentarios] = useState([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [descricaoEditando, setDescricaoEditando] = useState(false);
  const [descricaoEditada, setDescricaoEditada] = useState("");
  const [editandoData, setEditandoData] = useState({ campo: null });
  const [valorData, setValorData] = useState({
    acao: "",
    prazo: "",
    meta: ""
  });
  const [anexoExpandido, setAnexoExpandido] = useState(null);


  useEffect(() => {
    if (tarefasInfo) {
      const acaoSrc = tarefasInfo.dataAcao || tarefasInfo.data_acao || "";
      const prazoSrc = tarefasInfo.dataPrazo || tarefasInfo.data_prazo || "";
      const metaSrc = tarefasInfo.dataMeta || tarefasInfo.data_meta || "";
      setValorData({
        acao: acaoSrc ? String(acaoSrc).slice(0, 10) : "",
        prazo: prazoSrc ? String(prazoSrc).slice(0, 10) : "",
        meta: metaSrc ? String(metaSrc).slice(0, 10) : ""
      });
    }
  }, [tarefasInfo]);


  const atualizarData = async (campo) => {
  const token = resolveToken();
    const patchObj = {};
    if (campo === "acao") patchObj.dataAcao = valorData.acao;
    if (campo === "prazo") patchObj.dataPrazo = valorData.prazo;
    if (campo === "meta") patchObj.dataMeta = valorData.meta;
    try {
      await api.patch(`/gestao/tarefas/${id}/datas`, patchObj, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Data atualizada!");
      setEditandoData({ campo: null });

      // Busca os dados ATUALIZADOS e atualiza só o state!
      const { data: tarefaAtualizada } = await api.get(`/gestao/tarefas/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTarefasInfo(tarefaAtualizada); // Atualiza os campos na tela!

    } catch (err) {
      toast.error("Erro ao atualizar data.");
      setEditandoData({ campo: null });
    }
  };


  useEffect(() => {
    const token = resolveToken();
    if (token && id) {
      api.get(`/gestao/tarefas/${id}/comentarios`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => setComentarios(res.data));
    }
  }, [id]);

  const enviarComentarioComAnexo = async () => {
    const token = resolveToken();
    if (!novoComentario.trim() && !arquivosSelecionados) return;

    let base64 = null;
    let nomeArquivo = null;

    try {
      if (arquivosSelecionados) {
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result?.toString().split(',')[1];
            if (result) resolve(result);
            else reject("Falha ao converter arquivo em base64");
          };
          reader.onerror = () => reject("Erro ao ler arquivo");
          arquivosSelecionados.forEach((file) => {
            const reader = new FileReader();
            reader.onload = async () => {
              const base64 = reader.result?.toString().split(',')[1];
              const nomeArquivo = file.name;

              await api.post(
                `/gestao/tarefas/atividade/${atividadeSelecionada.atividadeTarefaId}/anexos`,
                { anexos: [{ base64, nomeArquivo }] },
                { headers: { Authorization: `Bearer ${token}` } }
              );
            };
            reader.readAsDataURL(file); // aqui vai um único File, não o array
          });
        });

        const nomesArquivos = arquivosSelecionados.map(file => file.name);
      }

      await api.post(`/gestao/tarefas/${id}/comentarios`, {
        comentario: novoComentario,
        base64,
        nomeArquivo
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNovoComentario("");
      setArquivosSelecionados([]);

      const res = await api.get(`/gestao/tarefas/${id}/comentarios`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setComentarios(res.data);
    } catch (err) {
      console.error("❌ Erro ao enviar comentário com anexo:", err);
    }
  };




  const toggleDescricao = (index) => {
    setDescricaoVisivel((prev) => ({
      ...prev,
      [index]: !prev[index]
    }));
  };


  useEffect(() => {
    if (!router.isReady || !id) return;
    
    const token = resolveToken();
    if (!token) return;

    const fetchData = async () => {
      try {
        const { data: tarefa } = await api.get(`/gestao/tarefas/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setTarefasInfo(tarefa);
        setDescricaoEditada(tarefa.descricao || "");

        const tarefaPaiIdValor = tarefa.tarefaPaiId ?? tarefa.tarefa_pai_id;
        if (tarefaPaiIdValor) {
          const { data: tarefaPaiData } = await api.get(`/gestao/tarefas/${tarefaPaiIdValor}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setTarefaPai(tarefaPaiData);
        }


        const { data: atividadesComStatus } = await api.get(
          `/gestao/tarefas/${id}/atividades-com-status`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setAtividades(atividadesComStatus);

        const atividadesComAnexos = await Promise.all(
          atividadesComStatus.map(async (atividade) => {
            if (atividade.tipo === "Anexos sem validação") {
              try {
                console.log(`🔵 Buscando anexos para atividade ${atividade.atividadeTarefaId}`);
                const { data: anexos } = await api.get(`/gestao/tarefas/atividade/${atividade.atividadeTarefaId}/anexos`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                console.log(`✅ Anexos encontrados para atividade ${atividade.atividadeTarefaId}:`, anexos);
                return { ...atividade, anexos: anexos || [] };
              } catch (err) {
                console.error(`❌ Erro ao buscar anexos da atividade ${atividade.atividadeTarefaId}:`, err);
                return { ...atividade, anexos: [] };
              }
            } else {
              return atividade;
            }
          })
        );

        console.log("🔵 Atividades com anexos processadas:", atividadesComAnexos);
        setAtividades(atividadesComAnexos);


        // ✅ Buscar subprocessos aqui dentro!
        const { data: subprocessosData } = await api.get(
          `/gestao/tarefas/${id}/subprocessos`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setSubprocessos(subprocessosData);
        const empresaIdFetch = tarefa.empresaId || tarefa.empresa_id || resolveEmpresaIdFromStorage();
        const { data: departamentosData } = await api.get(`/gestao/departamentos/${empresaIdFetch}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Subprocessos recebidos:", subprocessosData);


        // Transforma em map para acesso rápido (aceita variações de schema)
        const mapa = {};
        for (const dep of departamentosData) {
          const depId = Number(dep.id ?? dep.departamento_id ?? dep.departamentoId);
          const depNome = dep.nome ?? dep.nome_departamento ?? dep.nomeDepartamento ?? dep.descricao ?? '-';
          if (!Number.isNaN(depId)) mapa[depId] = depNome;
        }
        setDepartamentos(mapa);


      } catch (err) {
        console.error("Erro ao carregar dados da tarefa:", err);
      }
    };


    fetchData(); // ✅ chamada aqui
  }, [router.isReady, id]);

  if (!tarefasInfo) {
    return (
      <>
        <PrincipalSidebar />
      </>
    );
  }

  // Adiciona flag para tarefa fechada
  const tarefaFechada = tarefasInfo.status === "concluída";
  const tarefaCancelada = tarefasInfo.status === "cancelada";



  const todasAtividadesConcluidas = atividades.every((a) => a.concluida === 1 || a.cancelada === 1);


  const parseDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };
  const criadoEm = parseDate(tarefasInfo.criadoEm || tarefasInfo.criado_em || tarefasInfo.createdAt || tarefasInfo.criadoAt);
  const prazo = parseDate(tarefasInfo.dataPrazo || tarefasInfo.data_prazo);
  const diasEmAberto = (prazo && criadoEm) ? differenceInDays(prazo, criadoEm) : null;

  const toggleConclusaoAtividade = async (atividadeTarefaId) => {
    const token = resolveToken();
    if (!token) return;

    try {
      // ✅ Atualizar estado local imediatamente para feedback visual
      setAtividades((prev) =>
        prev.map((a) =>
          a.atividadeTarefaId === atividadeTarefaId
            ? { ...a, concluida: 1, dataConclusao: new Date().toISOString() }
            : a
        )
      );

      await api.patch(`/gestao/tarefas/atividade/${atividadeTarefaId}/concluir`, {}, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      // ✅ Não precisa mais buscar dados do servidor, já atualizamos o estado local
      toast.success("Atividade concluída com sucesso!");
    } catch (error) {
      // ✅ Em caso de erro, reverter o estado local
      setAtividades((prev) =>
        prev.map((a) =>
          a.atividadeTarefaId === atividadeTarefaId
            ? { ...a, concluida: 0, dataConclusao: null }
            : a
        )
      );
      toast.error("Erro ao concluir atividade.");
    }
  };


  const handleConcluirTarefa = async () => {
    const token = resolveToken();
    if (!token || !id) return;

    // Verificação: todas as atividades precisam estar concluídas ou canceladas
    const atividadesPendentes = atividades.filter(
      (a) => !a.concluida && !a.cancelada
    );
    if (atividadesPendentes.length > 0) {
      toast.error("Conclua ou cancele todas as atividades antes de finalizar a tarefa.");
      return;
    }

    try {
      // ✅ Aqui geramos a data atual
      const agora = new Date().toISOString().slice(0, 19).replace("T", " ");

      // ✅ Agora usando o api.patch!
      await api.patch(
        `/gestao/tarefas/${id}/concluir`,
        { dataConclusao: agora },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Tarefa concluída com sucesso!");

      await new Promise((resolve) => setTimeout(resolve, 400));

      router.reload();
    } catch (err) {
      // ✅ Tratamento silencioso de erros - sem console.error que causa o erro vermelho
      let mensagem = "Erro ao concluir a tarefa.";

      // Capturar mensagem específica do backend (axios-like)
      if (err?.response?.data?.error) {
        mensagem = err.response.data.error;
      } else if (err?.response?.status === 400) {
        mensagem = "Existem subtarefas ainda não concluídas.";
      } else if (typeof err?.message === 'string' && err.message.includes('failed 400')) {
        // Nosso wrapper de fetch usa Error com status no message
        mensagem = "Existem subtarefas ainda não concluídas.";
      } else if (err?.response?.status === 401) {
        mensagem = "Sessão expirada. Faça login novamente.";
      } else if (err?.response?.status === 403) {
        mensagem = "Você não tem permissão para concluir esta tarefa.";
      } else if (err?.response?.status >= 500) {
        mensagem = "Erro interno do servidor. Tente novamente.";
      }

      toast.error(mensagem);
    }
  };

  async function cancelarAtividade(id, justificativa) {
    const token = resolveToken();
    if (!token) return;

    try {
      // Cancela a atividade no backend
      await api.patch(`/gestao/tarefas/atividade/${id}/cancelar`, { justificativa }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // ✅ Busca o tarefaId para inserir comentário
      const { data } = await api.get(`/gestao/tarefas/atividades/${id}/tarefa`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const tarefaId = data.tarefaId;

      // ✅ Insere comentário com motivo de cancelamento
      await api.post(`/gestao/tarefas/${tarefaId}/comentarios`, {
        comentario: `Motivo Cancelamento Atividade ${id}: ${justificativa}`,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success("Atividade cancelada e comentário registrado.");
      
      // ✅ Retornar dados para atualização do estado
      return { tarefaId, justificativa };
    } catch (err) {
      // ✅ Tratamento silencioso de erro
      toast.error("Erro ao cancelar atividade.");
      throw err; // Re-throw para tratamento no componente
    }
  }


  // Handler para ação da lixeira em anexos sem validação
  async function handleLixeiraAnexo(atividade) {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    let confirmMsg = "Deseja remover os anexos desta atividade?";
    if (atividade.concluida) confirmMsg = "Deseja reabrir e remover os anexos desta atividade concluída?";
    if (atividade.cancelada) confirmMsg = "Deseja reativar e remover os anexos desta atividade cancelada?";

    if (!confirm(confirmMsg)) return;

    try {
      if (atividade.concluida) {
        await api.patch(`/gestao/tarefas/atividade/${atividade.atividadeTarefaId}/disconcluir`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else if (atividade.cancelada) {
        await api.patch(`/gestao/tarefas/atividade/${atividade.atividadeTarefaId}/descancelar`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      await api.delete(`/gestao/tarefas/atividade/${atividade.atividadeTarefaId}/anexo`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Anexos removidos e status atualizado.");
      
      // ✅ Buscar os anexos atualizados do backend
      const { data: anexosAtualizados } = await api.get(
        `/gestao/tarefas/atividade/${atividade.atividadeTarefaId}/anexos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // ✅ Atualizar o estado local da atividade com os anexos reais e status
      setAtividades(prev => prev.map(a => 
        a.atividadeTarefaId === atividade.atividadeTarefaId 
          ? { 
              ...a, 
              anexos: anexosAtualizados || [], 
              concluida: 0, 
              dataConclusao: null, 
              concluidoPorNome: null,
              cancelada: 0,
              justificativa: null,
              dataCancelamento: null
            }
          : a
      ));
    } catch (err) {
      toast.error("Erro ao atualizar atividade.");
    }
  }

  const baixarAnexo = async (anexo) => {
    try {
      console.log("🔵 Tentando baixar anexo:", anexo);
      
      // Verifica se o anexo tem ID válido
      if (!anexo.id) {
        console.error("❌ Anexo sem ID:", anexo);
        toast.error('Arquivo inválido');
        return;
      }

      const response = await api.get(`/gestao/tarefas/anexo/${anexo.id}/download`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${resolveToken()}` }
      });
      
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Melhora a extração do nome do arquivo
      const nomeArquivo = anexo.nome_arquivo || anexo.nomeArquivo || anexo.nome || anexo.originalname || 'Arquivo';
      a.download = nomeArquivo;
      
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Arquivo baixado com sucesso!');
    } catch (err) {
      console.error("❌ Erro ao baixar anexo:", err);
      toast.error('Erro ao baixar arquivo');
    }
  };

  return (
    <>
      <PrincipalSidebar />
      <ToastContainer 
        position="top-right" 
        autoClose={3000} 
        hideProgressBar={false} 
        newestOnTop 
        closeOnClick 
        rtl={false} 
        pauseOnFocusLoss 
        draggable 
        pauseOnHover
        theme="dark"
        toastStyle={{
          backgroundColor: 'var(--onity-color-surface)',
          color: 'var(--onity-color-text)',
          border: '1px solid var(--onity-color-border)',
          borderRadius: '12px',
          boxShadow: 'var(--onity-elev-high)',
          fontFamily: "var(--onity-font-family-sans)",
          fontSize: '14px',
          fontWeight: '500',
        }}
      />
      <style jsx global>{`
        .Toastify__progress-bar {
          background: linear-gradient(135deg, #000080 0%, #004CFF 100%) !important;
        }
        .Toastify__toast--success { background: var(--onity-color-surface) !important; border-left: 4px solid var(--onity-color-success) !important; }
        .Toastify__toast--error { background: var(--onity-color-surface) !important; border-left: 4px solid var(--onity-color-error) !important; }
        .Toastify__toast--info { background: var(--onity-color-surface) !important; border-left: 4px solid var(--onity-color-primary) !important; }
        .Toastify__toast--warning { background: var(--onity-color-surface) !important; border-left: 4px solid var(--onity-color-warning) !important; }
        .Toastify__close-button {
          color: #B5B9C6 !important;
          opacity: 0.7;
        }
        .Toastify__close-button:hover {
          opacity: 1;
        }
      `}</style>
      <div className={styles.container}>
        <div className={styles.cardTarefa}>
          <div className={`${styles.headerTarefa} ${tarefasInfo.status === "cancelada" ? styles.statusCancelada : ""}`}>
            <h1>{tarefasInfo.id} - {tarefasInfo.assunto}</h1>
          </div>


          <div className={styles.grid}>

            <div className={styles.colunaEsquerda}>
              {/* AÇÃO */}
              <div className={`${styles.caixa} ${styles.dataCaixa}`}>
                <div className={styles.dataLabel}>Ação:</div>
                <div className={styles.dataConteudo}>
                  {editandoData.campo === "acao" && !tarefaFechada ? (
                    <>
                      <input
                        type="date"
                        value={valorData.acao}
                        onChange={e => setValorData(d => ({ ...d, acao: e.target.value }))}
                        style={{ fontSize: 13, padding: "3px 7px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                        <Check
                          size={17}
                          color="#2563eb"
                          style={{ cursor: "pointer", marginRight: 2 }} // Deixe bem coladinho!
                          onClick={() => atualizarData("acao")}
                        />
                        <XCircle
                          size={17}
                          color="#94a3b8"
                          style={{ cursor: "pointer" }}
                          onClick={() => setEditandoData({ campo: null })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <span className={styles.dataValor}>{(() => { const d = parseDate(tarefasInfo.dataAcao || tarefasInfo.data_acao); return d ? format(d, "dd/MM/yyyy") : '-'; })()}</span>
                      <Pencil
                        size={16}
                        color="#64748b"
                        style={{
                          cursor: "pointer",
                          marginLeft: "auto",
                          marginTop: "-6px"   // <-- aqui está o segredo!
                        }}
                        onClick={() => setEditandoData({ campo: "acao" })}
                      />
                    </>
                  )}
                </div>
              </div>
              {criadoEm && (
                <div className={styles.diasEmAbertoWrapper}>
                  <span className={styles.diasEmAberto}>
                    Criado em {format(criadoEm, "dd/MM/yyyy")} com {differenceInDays(new Date(), criadoEm)} dias em aberto
                  </span>
                </div>
              )}

              {/* PRAZO */}
              <div className={`${styles.caixa} ${styles.dataCaixa}`}>
                <div className={styles.dataLabel}>Prazo:</div>
                <div className={styles.dataConteudo}>
                  {editandoData.campo === "prazo" && !tarefaFechada ? (
                    <>
                      <input
                        type="date"
                        value={valorData.prazo}
                        onChange={e => setValorData(d => ({ ...d, prazo: e.target.value }))}
                        style={{ fontSize: 13, padding: "3px 7px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                        <Check
                          size={17}
                          color="#2563eb"
                          style={{ cursor: "pointer", marginRight: 2 }}
                          onClick={() => atualizarData("prazo")}
                        />
                        <XCircle
                          size={17}
                          color="#94a3b8"
                          style={{ cursor: "pointer" }}
                          onClick={() => setEditandoData({ campo: null })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <span className={styles.dataValor}>{(() => { const d = parseDate(tarefasInfo.dataPrazo || tarefasInfo.data_prazo); return d ? format(d, "dd/MM/yyyy") : '-'; })()}</span>
                      <Pencil
                        size={16}
                        color="#64748b"
                        style={{
                          cursor: "pointer",
                          marginLeft: "auto",
                          marginTop: "-6px"   // <-- aqui está o segredo!
                        }}
                        onClick={() => setEditandoData({ campo: "prazo" })}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* META */}
              <div className={`${styles.caixa} ${styles.dataCaixa}`}>
                <div className={styles.dataLabel}>Meta:</div>
                <div className={styles.dataConteudo}>
                  {editandoData.campo === "meta" && !tarefaFechada ? (
                    <>
                      <input
                        type="date"
                        value={valorData.meta}
                        onChange={e => setValorData(d => ({ ...d, meta: e.target.value }))}
                        style={{ fontSize: 13, padding: "3px 7px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                      />
                      <Check size={17} color="#2563eb" style={{ cursor: "pointer", marginLeft: 8 }} onClick={() => atualizarData("meta")} />
                      <XCircle size={17} color="#94a3b8" style={{ cursor: "pointer", marginLeft: 2 }} onClick={() => setEditandoData({ campo: null })} />
                    </>
                  ) : (
                    <>
                      <span className={styles.dataValor}>{(() => { const d = parseDate(tarefasInfo.dataMeta || tarefasInfo.data_meta); return d ? format(d, "dd/MM/yyyy") : '-'; })()}</span>
                      <Pencil
                        size={16}
                        color="#64748b"
                        style={{
                          cursor: "pointer",
                          marginLeft: "auto",
                          marginTop: "-6px"   // <-- aqui está o segredo!
                        }}
                        onClick={() => setEditandoData({ campo: "meta" })}
                      />
                    </>
                  )}
                </div>
              </div>

              <div className={styles.caixa}>
                <strong>Cliente:</strong><br />
                <div className={styles.clienteInfo}>
                  <span>{tarefasInfo.cliente?.nome || '-'}</span>
                  {tarefasInfo.cliente?.cnpjCpf && (
                    <span className={styles.clienteCnpj}>
                      {formatarCnpjCpf(tarefasInfo.cliente.cnpjCpf)}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.caixa}>
                <strong>Responsável:</strong><br />{tarefasInfo.responsavel?.nome || '-'}
              </div>

              <div className={styles.caixa}>
                <strong>Descrição:</strong><br />
                {descricaoEditando && !tarefaFechada ? (
                  <>
                    <textarea
                      value={descricaoEditada}
                      onChange={(e) => setDescricaoEditada(e.target.value)}
                      style={{
                        width: "90%",
                        fontSize: "12.5px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        padding: "6px",
                        marginTop: "6px",
                      }}
                      rows={4}
                    />
                    <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                      <button
                        style={{ background: "#2563eb", color: "white", padding: "4px 8px", borderRadius: "4px" }}
                        onClick={async () => {
                          try {
                            const token = resolveToken();
                            await api.patch(`/gestao/tarefas/${id}/descricao`, { descricao: descricaoEditada }, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            toast.success("Descrição atualizada!");
                            setDescricaoEditando(false);
                            router.reload(); // ou router.reload() dependendo da versão
                          } catch (err) {
                            toast.error("Erro ao atualizar descrição.");
                            // ✅ Tratamento silencioso de erro
                          }
                        }}
                      >
                        Salvar
                      </button>
                      <button
                        style={{ background: "#e5e7eb", padding: "4px 8px", borderRadius: "4px" }}
                        onClick={() => {
                          setDescricaoEditando(false);
                          setDescricaoEditada(tarefasInfo.descricao || "");
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div
                    style={{ color: "var(--onity-color-text)", marginTop: "4px", whiteSpace: "pre-wrap", flex: 1 }}
                  >
                      {tarefasInfo.descricao || <em style={{ color: "#9ca3af" }}>(Sem descrição)</em>}
                    </div>
                    {!tarefaFechada && (
                      <Pencil
                        size={16}
                        color="#64748b"
                        style={{
                          cursor: "pointer",
                          marginLeft: "8px",
                          marginTop: "4px"
                        }}
                        onClick={() => setDescricaoEditando(true)}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className={styles.colunaDireita}>
              <div className={styles.navTabs}>
                <button
                  onClick={() => setAbaAtiva("atividades")}
                  className={`${styles.tabButton} ${abaAtiva === "atividades" ? styles.tabButtonActive : ""}`}
                >
                  Atividades para realização do trabalho
                </button>

                {(tarefaPai || tarefasInfo.tarefaPaiId || tarefasInfo.tarefa_pai_id) && (
                  <button
                    onClick={() => setAbaAtiva("vinculada")}
                    className={`${styles.tabButton} ${abaAtiva === "vinculada" ? styles.tabButtonActive : ""}`}
                  >
                    Solicitação vinculada
                  </button>
                )}

                {!(tarefasInfo.tarefaPaiId || tarefasInfo.tarefa_pai_id) && (
                  <button
                    onClick={() => setAbaAtiva("sub")}
                    className={`${styles.tabButton} ${abaAtiva === "sub" ? styles.tabButtonActive : ""}`}
                  >
                    Sub Atendimentos ({subprocessos.length})
                  </button>
                )}
              </div>


              {abaAtiva === "atividades" && (
                <div className={styles.tabelaContainer}>
                  <table className={styles.tabela}>
                    <tbody>
                      {atividades.map((a, index) =>
                        a.cancelada ? (
                          <tr key={a.atividadeTarefaId} className={styles.linhaCancelada}>
                            <td className={styles.numeroAtividade}>
                              {index + 1}
                            </td>
                            <td className={styles.iconeAtividade}>
                              {a.tipo === "Checklist" && <ClipboardList size={16} color="white" />}
                              {a.tipo === "Enviar e-mail" && <Mail size={16} color="white" />}
                              {a.tipo === "Anexos sem validação" && <Paperclip size={16} color="white" />}
                            </td>
                            <td className={styles.textoAtividade}>
                              <span className={styles.nomeAtividadeHover} onClick={() => toggleDescricao(index)}>
                                {descricaoVisivel[index] ? "▴" : "▾"} {a.texto || "Sem título"}
                              </span>
                              {/* Motivo só aparece aqui se descrição não estiver expandida */}
                              {!descricaoVisivel[index] && (
                                <div style={{ fontSize: "12px", marginTop: "4px", color: "white", fontWeight: 400 }}>
                                  <strong>Motivo:</strong> {a.justificativa || "Atividade cancelada"}
                                </div>
                              )}
                              {/* Descrição expandida + motivo embaixo */}
                              {descricaoVisivel[index] && (
                                <div className={styles.descricaoAtividadeExpandida}>
                                  {a.descricao || "Sem descrição"}
                                  <div style={{ fontSize: "12px", marginTop: "8px", color: "white", fontWeight: 500 }}>
                                    <strong>Motivo:</strong> {a.justificativa || "Atividade cancelada"}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td style={{ verticalAlign: "top", height: "100%", width: "120px" }}>
                              {/* Apenas datas e informações estáticas se tarefaFechada */}
                              {tarefaFechada ? (
                                                                  <span style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: 'white' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
                                      <circle cx="12" cy="12" r="12" fill="#ef4444" />
                                      <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2" fill="none" />
                                    </svg>
                                    {a.canceladoPorNome && `${a.canceladoPorNome} • `}
                                    {a.dataCancelamento ? format(new Date(a.dataCancelamento), "dd/MM/yyyy HH:mm") : ''}
                                  </span>
                                                              ) : tarefaCancelada ? (
                                  <span style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: 'white' }}>
                                    {/* Para tarefas canceladas, não mostra data/hora do cancelamento */}
                                  </span>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', width: '100%' }}>
                                  {/* X vermelho e data/hora */}
                                  <span style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: 'white' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
                                      <circle cx="12" cy="12" r="12" fill="#ef4444" />
                                      <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2" fill="none" />
                                    </svg>
                                    {a.canceladoPorNome && `${a.canceladoPorNome} • `}
                                    {a.dataCancelamento ? format(new Date(a.dataCancelamento), "dd/MM/yyyy HH:mm") : ''}
                                  </span>
                                  {/* Lixeira à direita */}
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span
                                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                      title="Reativar atividade"
                                      onClick={async () => {
                                        const confirmar = confirm("Deseja reativar esta atividade?");
                                        if (!confirmar) return;
                                        const token = resolveToken();
                                        try {
                                          await api.patch(`/gestao/tarefas/atividade/${a.atividadeTarefaId}/descancelar`, {}, {
                                            headers: { Authorization: `Bearer ${token}` }
                                          });
                                          toast.success("Atividade reativada com sucesso.");
                                          
                                          // ✅ Atualizar o estado local da atividade reativando
                                          setAtividades(prev => prev.map(atividade => 
                                            atividade.atividadeTarefaId === a.atividadeTarefaId 
                                              ? { 
                                                  ...atividade, 
                                                  cancelada: 0, 
                                                  justificativa: null, 
                                                  dataCancelamento: null,
                                                  // ✅ Garantir que os anexos sejam preservados se existirem
                                                  anexos: atividade.anexos || []
                                                }
                                              : atividade
                                          ));
                                        } catch (err) {
                                          // ✅ Tratamento silencioso de erro
                                          toast.error("Erro ao reativar atividade.");
                                        }
                                      }}
                                    >
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                    </span>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        ) : (
                          <tr key={a.atividadeTarefaId}>
                            <td className={styles.numeroAtividade}>
                              {index + 1}
                            </td>
                            <td className={styles.iconeAtividade}>
                              {a.tipo === "Checklist" && (
                                <span dangerouslySetInnerHTML={{ __html: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><g fill="none" fill-rule="evenodd"><path d="m12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z"/><path fill="white" d="M21.546 5.111a1.5 1.5 0 0 1 0 2.121L10.303 18.475a1.6 1.6 0 0 1-2.263 0L2.454 12.89a1.5 1.5 0 1 1 2.121-2.121l4.596 4.596L19.424 5.111a1.5 1.5 0 1 1 2.122 0"/></g></svg>` }} />
                              )}
                              {a.tipo === "Enviar e-mail" && (
                                <span dangerouslySetInnerHTML={{ __html: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="white" d="M4 20q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h16q.825 0 1.413.588T22 6v12q0 .825-.587 1.413T20 20zm8-7l8-5V6l-8 5l-8-5v2z"/></svg>` }} />
                              )}
                              {a.tipo === "Anexos sem validação" && (
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                  <span
                                    style={{ 
                                      cursor: 'pointer',
                                      opacity: a.anexos && Array.isArray(a.anexos) && a.anexos.length > 0 ? 1 : 0.5
                                    }}
                                    onClick={() => {
                                      console.log("🔵 Clique no clipe da atividade:", a.atividadeTarefaId);
                                      console.log("🔵 Anexos disponíveis:", a.anexos);
                                      
                                      if (a.anexos && Array.isArray(a.anexos) && a.anexos.length > 0) {
                                        const novoEstado = anexoExpandido === a.atividadeTarefaId ? null : a.atividadeTarefaId;
                                        console.log("🔵 Alterando estado de anexoExpandido para:", novoEstado);
                                        setAnexoExpandido(novoEstado);
                                      } else {
                                        console.log("⚠️ Nenhum anexo disponível para esta atividade");
                                        toast.info("Esta atividade não possui anexos");
                                      }
                                    }}
                                    title={a.anexos && Array.isArray(a.anexos) && a.anexos.length > 0 ? 
                                      `Clique para ${anexoExpandido === a.atividadeTarefaId ? 'ocultar' : 'mostrar'} anexos (${a.anexos.length})` : 
                                      "Nenhum anexo disponível"
                                    }
                                  >
                                    <Paperclip size={16} color="white" />
                                  </span>
                                  
                                  {/* Badge com número de anexos - também clicável */}
                                  {a.anexos && Array.isArray(a.anexos) && a.anexos.length > 0 && (
                                    <span 
                                      style={{
                                        position: 'absolute',
                                        top: '-8px',
                                        right: '-8px',
                                        background: '#ef4444',
                                        color: 'white',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        borderRadius: '50%',
                                        width: '18px',
                                        height: '18px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '2px solid white',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                      }}
                                      onClick={() => {
                                        console.log("🔵 Clique no badge da atividade:", a.atividadeTarefaId);
                                        const novoEstado = anexoExpandido === a.atividadeTarefaId ? null : a.atividadeTarefaId;
                                        console.log("🔵 Alterando estado de anexoExpandido para:", novoEstado);
                                        setAnexoExpandido(novoEstado);
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                        e.currentTarget.style.background = '#dc2626';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.background = '#ef4444';
                                      }}
                                      title={`Clique para ${anexoExpandido === a.atividadeTarefaId ? 'ocultar' : 'mostrar'} anexos (${a.anexos.length})`}
                                    >
                                      {a.anexos.length > 9 ? '9+' : a.anexos.length}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className={styles.textoAtividade}>
                              <span className={styles.nomeAtividadeHover} onClick={() => toggleDescricao(index)}>
                                {descricaoVisivel[index] ? "▴" : "▾"} {a.texto || "Sem título"}
                              </span>
                              {/* Logo abaixo do nome da atividade, ainda dentro da célula <td> do nome, adicione: */}
                              {a.tipo === "Anexos sem validação" && anexoExpandido === a.atividadeTarefaId && a.anexos && Array.isArray(a.anexos) && a.anexos.length > 0 && (
                                <div style={{ 
                                  marginTop: 8, 
                                  marginLeft: 8, 
                                  padding: "8px 12px",
                                  background: "rgba(255, 255, 255, 0.1)",
                                  borderRadius: "6px",
                                  border: "1px solid rgba(255, 255, 255, 0.2)"
                                }}>
                                  <div style={{ 
                                    fontSize: "11px", 
                                    color: "rgba(255, 255, 255, 0.8)", 
                                    marginBottom: "6px",
                                    fontWeight: "500"
                                  }}>
                                    📎 Anexos ({a.anexos.length}):
                                  </div>
                                  {a.anexos.map((anexo, idx) => (
                                    <div key={idx} style={{ marginBottom: "4px" }}>
                                      <span
                                        style={{ 
                                          color: 'white', 
                                          fontSize: 12, 
                                          display: 'block', 
                                          cursor: 'pointer',
                                          padding: "4px 8px",
                                          borderRadius: "4px",
                                          background: "rgba(255, 255, 255, 0.1)",
                                          transition: "all 0.2s ease"
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                                          e.currentTarget.style.transform = "translateX(2px)";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                                          e.currentTarget.style.transform = "translateX(0)";
                                        }}
                                        onClick={() => baixarAnexo(anexo)}
                                        title={`Clique para baixar: ${anexo.nome_arquivo || anexo.nomeArquivo || anexo.nome || anexo.originalname || 'Arquivo'}`}
                                      >
                                        <Paperclip size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} /> 
                                        {(anexo.nome_arquivo || anexo.nomeArquivo || anexo.nome || anexo.originalname || 'Arquivo')
                                          .replace(/_/g, ' ')
                                          .substring(0, 40) + 
                                          ((anexo.nome_arquivo || anexo.nomeArquivo || anexo.nome || anexo.originalname || 'Arquivo').length > 40 ? '...' : '')
                                        }
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {descricaoVisivel[index] && (
                                <div className={styles.descricaoAtividadeExpandida}>
                                  {a.descricao || "Sem descrição"}
                                </div>
                              )}
                            </td>
                            <td style={{ verticalAlign: "top", height: "100%", width: a.tipo === "Anexos sem validação" ? "120px" : "1%" }}>
                              {/* Se tarefaFechada, só mostra datas/concluído/cancelado, sem ações */}
                              {tarefaFechada ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                  {/* Apenas datas/concluído/cancelado, SEM lixeira */}
                                  <span style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: 'white' }}>
                                    {a.concluida === 1 ? (
                                      <>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
                                          <circle cx="12" cy="12" r="12" fill="#22c55e" />
                                          <path d="M8 12l2.5 2.5L16 9" stroke="#fff" strokeWidth="2" fill="none" />
                                        </svg>
                                        {a.concluidoPorNome && `${a.concluidoPorNome} • `}
                                        {a.dataConclusao ? format(addHours(new Date(a.dataConclusao), -3), "dd/MM/yyyy HH:mm") : ''}
                                      </>
                                    ) : a.cancelada === 1 ? (
                                      <>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
                                          <circle cx="12" cy="12" r="12" fill="#ef4444" />
                                          <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2" fill="none" />
                                        </svg>
                                        {a.canceladoPorNome && `${a.canceladoPorNome} • `}
                                        {a.dataCancelamento ? format(addHours(new Date(a.dataCancelamento), -3), "dd/MM/yyyy HH:mm") : ''}
                                      </>
                                    ) : null}
                                  </span>
                                </div>
                              ) : (
                                <div style={{ display: "flex", gap: "6px", alignItems: "flex-start", justifyContent: "center", height: "100%", minHeight: "24px" }}>
                                  {tarefasInfo.status !== "cancelada" ? (
                                    <>
                                      {a.tipo === "Checklist" && !a.concluida && (
                                        <div className={`${styles.iconeAcao} ${styles.iconeVerde}`} onClick={() => toggleConclusaoAtividade(a.atividadeTarefaId)} title="Marcar como concluída">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
                                            <path fill="#fff" d="m9.55 18l-5.7-5.7l1.425-1.425L9.55 15.15l9.175-9.175L20.15 7.4z" />
                                          </svg>
                                        </div>
                                      )}
                                      {a.tipo === "Enviar e-mail" && !a.concluida && (
                                        <div className={`${styles.iconeAcao} ${styles.iconeAzul}`} onClick={() => {
                                          setAtividadeSelecionada(a);
                                          setEmailAssunto(a.texto || "Sem assunto");
                                          setEmailCorpo(a.descricao || "Sem descrição");
                                          setEmailModalAberto(true);
                                        }} title="Abrir e-mail">
                                          <Mail size={14} color="white" />
                                        </div>
                                      )}
                                      {a.tipo === "Anexos sem validação" && !a.concluida && !a.cancelada && (
                                        <div className={`${styles.iconeAcao} ${styles.iconeAzul}`} onClick={() => {
                                          setAtividadeSelecionada(a);
                                          setModalUploadAberto(true);
                                        }} title="Anexar arquivos">
                                          <Paperclip size={14} color="white" />
                                        </div>
                                      )}

                                      <div style={{ display: "flex", alignItems: "center", gap: "6px", minHeight: "24px" }}>
                                        {a.concluida === 1 ? (
                                          <>
                                            <span style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: 'white' }}>
                                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
                                                <circle cx="12" cy="12" r="12" fill="#22c55e" />
                                                <path d="M8 12l2.5 2.5L16 9" stroke="#fff" strokeWidth="2" fill="none" />
                                              </svg>
                                              {a.concluidoPorNome && `${a.concluidoPorNome} • `}
                                              {a.dataConclusao ? format(addHours(new Date(a.dataConclusao), -3), "dd/MM/yyyy HH:mm") : ''}
                                            </span>
                                            {a.tipo === "Checklist" && (
                                              <span
                                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: 6 }}
                                                title="Reabrir atividade"
                                                                                              onClick={async () => {
                                                const confirmar = confirm("Deseja reabrir esta atividade?");
                                                if (!confirmar) return;
                                                   const token = resolveToken();
                                                try {
                                                  await api.patch(`/gestao/tarefas/atividade/${a.atividadeTarefaId}/disconcluir`, {}, {
                                                    headers: { Authorization: `Bearer ${token}` }
                                                  });
                                                  toast.success("Atividade reaberta com sucesso.");
                                                  
                                                  // ✅ Atualizar apenas o estado local da atividade
                                                  setAtividades(prev => prev.map(atividade => 
                                                    atividade.atividadeTarefaId === a.atividadeTarefaId 
                                                      ? { ...atividade, concluida: 0, dataConclusao: null, concluidoPorNome: null }
                                                      : atividade
                                                  ));
                                                } catch (err) {
                                                  // ✅ Tratamento silencioso de erro
                                                  toast.error("Erro ao reabrir atividade.");
                                                }
                                              }}
                                              >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                              </span>
                                            )}
                                            {/* Lixeira para Anexos sem validação concluídos */}
                                            {a.tipo === "Anexos sem validação" && a.anexos && Array.isArray(a.anexos) && a.anexos.length > 0 && (
                                              <span
                                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: 6 }}
                                                title="Reabrir e remover anexos"
                                                onClick={() => handleLixeiraAnexo(a)}
                                              >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                              </span>
                                            )}
                                          </>
                                        ) : a.cancelada === 1 ? (
                                          <>
                                            <span style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: 'white' }}>
                                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
                                                <circle cx="12" cy="12" r="12" fill="#ef4444" />
                                                <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2" fill="none" />
                                              </svg>
                                              {a.canceladoPorNome && `${a.canceladoPorNome} • `}
                                                                                             {a.dataCancelamento ? format(addHours(new Date(a.dataCancelamento), -3), "dd/MM/yyyy HH:mm") : ''}
                                            </span>
                                            {/* Lixeira para Anexos sem validação cancelados */}
                                            {a.tipo === "Anexos sem validação" && a.anexos && Array.isArray(a.anexos) && a.anexos.length > 0 && (
                                              <span
                                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: 6 }}
                                                title="Reativar e remover anexos"
                                                onClick={() => handleLixeiraAnexo(a)}
                                              >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                              </span>
                                            )}
                                          </>
                                        ) : (
                                          <>
                                            <div className={`${styles.iconeAcao} ${styles.iconeVermelho}`}                                             onClick={async () => {
                                              if (a.tipoCancelamento && a.tipoCancelamento.toLowerCase() === "com justificativa") {
                                                setAtividadeSelecionada(a);
                                                setJustificativaModalAberto(true);
                                                return;
                                              }
                                              const confirmar = confirm("Tem certeza que deseja cancelar esta atividade?");
                                              if (!confirmar) return;
                                              
                                              try {
                                                const resultado = await cancelarAtividade(a.atividadeTarefaId, "Atividade cancelada");
                                                
                                                // ✅ Atualizar apenas o estado local da atividade
                                                setAtividades(prev => prev.map(atividade => 
                                                  atividade.atividadeTarefaId === a.atividadeTarefaId 
                                                    ? { ...atividade, cancelada: 1, justificativa: "Atividade cancelada", dataCancelamento: new Date().toISOString() }
                                                    : atividade
                                                ));
                                              } catch (err) {
                                                toast.error("Erro ao cancelar atividade.");
                                              }
                                            }} title="Cancelar atividade">
                                              <span dangerouslySetInnerHTML={{
                                                __html: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="#fff" d="M20 6.91L17.09 4L12 9.09L6.91 4L4 6.91L9.09 12L4 17.09L6.91 20L12 14.91L17.09 20L20 17.09L14.91 12z"/></svg>`
                                              }} />
                                            </div>
                                            {/* Lixeira para Anexos sem validação abertos */}
                                            {a.tipo === "Anexos sem validação" && a.anexos && Array.isArray(a.anexos) && a.anexos.length > 0 && (
                                              <span
                                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: 6 }}
                                                title="Remover anexos"
                                                onClick={() => handleLixeiraAnexo(a)}
                                              >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <div style={{ width: "24px", height: "24px" }}></div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {abaAtiva === "sub" && (
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th>Datas</th>
                      <th>Assunto</th>
                      <th>Departamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subprocessos.map((sub) => {
                      // Define classe baseada no status
                      let statusClass = styles.linhaAmarela;
                      if (sub.status === "concluída") statusClass = styles.linhaVerde;
                      if (sub.status === "cancelada") statusClass = styles.linhaCinza;

                      return (
                        <tr
                          key={sub.id}
                          className={`${statusClass} ${styles.linhaSubprocesso}`}
                          onClick={() => window.open(`/gestao/${sub.id}/atividades`, "_blank")}
                          style={{
                            cursor: "pointer",
                          }}
                          title={`Status: ${sub.status || "-"}`}
                        >
                          <td style={{ whiteSpace: "pre-line", fontSize: "12.5px" }}>
                            <span style={{ fontWeight: 600 }}>A:</span> {format(new Date(sub.dataAcao), "dd/MM/yyyy")}{"\n"}
                            <span style={{ fontWeight: 600 }}>M:</span> {format(new Date(sub.dataMeta), "dd/MM/yyyy")}{"\n"}
                            <span style={{ fontWeight: 600 }}>V:</span> {format(new Date(sub.dataPrazo), "dd/MM/yyyy")}
                          </td>
                          <td>
                            <span style={{ color: '#64748b', fontSize: '12px', marginRight: 6 }}>{sub.id} -</span> {sub.assunto}
                          </td>
                          <td>{(() => { const depId = Number(sub.departamentoId ?? sub.departamento_id); return departamentos[depId] || "-"; })()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}



              {abaAtiva === "vinculada" && tarefaPai && (
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th>Datas</th>
                      <th>Assunto</th>
                      <th>Departamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ whiteSpace: "pre-line", color: "#64748b", fontSize: "12.5px" }}>
                        <span style={{ fontWeight: 600 }}>A:</span> {(() => { const d = parseDate(tarefaPai.dataAcao || tarefaPai.data_acao); return d ? format(d, "dd/MM/yyyy") : '-'; })()}{"\n"}
                        <span style={{ fontWeight: 600 }}>M:</span> {(() => { const d = parseDate(tarefaPai.dataMeta || tarefaPai.data_meta); return d ? format(d, "dd/MM/yyyy") : '-'; })()}{"\n"}
                        <span style={{ fontWeight: 600 }}>V:</span> {(() => { const d = parseDate(tarefaPai.dataPrazo || tarefaPai.data_prazo); return d ? format(d, "dd/MM/yyyy") : '-'; })()}
                      </td>
                      <td
                        style={{
                          color: "#23527C",
                          cursor: "pointer"
                        }}
                        onClick={() => window.open(`/gestao/${tarefaPai.id}/atividades`, "_blank")}
                      >
                        {tarefaPai.assunto}
                      </td>
                      <td>{(() => { const depId = Number(tarefaPai.departamentoId ?? tarefaPai.departamento_id); return departamentos[depId] || "-"; })()}</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* ⬇️ Botão "Concluir Tarefa" abaixo da caixa de comentários */}
              <div className={styles.botoesAcoesTarefa}>
                {tarefaFechada ? (
                  <button
                    disabled
                    className={`${styles.botaoAcao} ${styles.botaoDisabled}`}
                  >
                    Finalizado
                  </button>
                ) : tarefaCancelada ? (
                  <button
                    onClick={async () => {
                      const token = resolveToken();
                      if (!token || !id) return;
                      try {
                        await api.patch(`/gestao/tarefas/${id}/reabrir`, {}, {
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        toast.success("Tarefa reaberta com sucesso!");
                        await new Promise((resolve) => setTimeout(resolve, 400));
                        router.reload();
                      } catch (err) {
                        const msg = err?.response?.data?.error || "Erro ao reabrir a tarefa.";
                        toast.error(msg);
                      }
                    }}
                    className={`${styles.botaoAcao} ${styles.botaoReabrir}`}
                  >
                    Reabrir
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleConcluirTarefa}
                      className={`${styles.botaoAcao} ${styles.botaoFinalizar}`}
                    >
                      Finalizar
                    </button>
                    <button
                      onClick={async () => {
                        const token = resolveToken();
                        if (!token || !id) return;
                        try {
                          await api.patch(`/gestao/tarefas/${id}/cancelar`, {}, {
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          toast.success("Tarefa cancelada com sucesso!");
                          await new Promise((resolve) => setTimeout(resolve, 400));
                          router.reload();
                        } catch (err) {
                          const msg = err?.response?.data?.error || "Erro ao cancelar a tarefa.";
                          toast.error(msg);
                        }
                      }}
                      className={`${styles.botaoAcao} ${styles.botaoCancelar}`}
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>

              {/* ⬇️ Comentários abaixo da tabela */}
              <Comentarios
                comentarios={comentarios}
                setComentarios={setComentarios}
                novoComentario={novoComentario}
                setNovoComentario={setNovoComentario}
                id={id}
              />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
  .pagina-tarefa {
    padding: 4px 24px 24px 24px;
    background: #f9fafb;
    font-family: 'Roboto', sans-serif;
  }

   .linha-subprocesso {
    transition: background 0.25s, box-shadow 0.2s, border-left 0.2s, transform 0.15s;
    border-left: 6px solid transparent;
  }
  .linha-subprocesso:hover {
    background: #f3f4f6 !important;
    box-shadow: 0 2px 8px 0 rgba(0,0,0,0.04);
    filter: none;
    transform: scale(1.01);
    position: relative;
    z-index: 2;
  }
  .linha-amarela {
    background: #fef9c3; /* amarelo claro */
    color: #b45309;
    border-left: 6px solid #fde047; /* amarelo mais forte */
  }
  .linha-verde {
    background: #d1fae5; /* verde claro */
    color: #15803d;
    border-left: 6px solid #22c55e; /* verde mais forte */
  }
  .linha-subprocesso:hover {
    /* Removido o efeito de hover verde */
    box-shadow: none;
    background: inherit !important;
    filter: none;
    position: relative;
    z-index: 2;
  }
  .linha-cinza {
    background: #e5e7eb;
    color: #374151;
    border-left: 6px solid #94a3b8;
  }

  .card-processo {
    background: white;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
  }

  .header-processo {
    background-color: #2563eb;
    padding: 10px 16px;
  }

  .header-processo h1 {
    color: white;
    font-size: 14px;
    font-weight: 500;
    margin: 0;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 32px;
    padding: 20px;
  }

  .coluna-esquerda {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 12.5px;
  color: #334155;
}

.data-caixa {
  background: #f1f5f9;
  border-radius: 6px;
  padding: 2px 10px;
  font-size: 12px;
  border: 1px solid #e2e8f0;
  line-height: 1.3;
}

.data-label {
  font-weight: bold;
  color: #334155;
  font-size: 12px;
  margin-bottom: 2px;
}

.data-conteudo {
  display: flex;
  align-items: flex-start; /* era center */
  justify-content: space-between;
  gap: 8px;
}


.data-valor {
  font-size: 12.3px;
  color: #2563eb;
  margin-left: 0;
}


.caixa {
  background: #f1f5f9;
  border-radius: 6px;
  padding: 2px 10px;
  font-size: 12px;
  border: 1px solid #e2e8f0;
  line-height: 1.3;
}

.dias-em-aberto-wrapper {
  display: flex;
  justify-content: flex-end;
  padding-right: 2px;
  margin-top: -6px;
  margin-bottom: -4px;
}

.dias-em-aberto {
  font-size: 11px;
  color: #475569;
  font-weight: 400;
}

.dias-em-aberto-wrapper span {
  color: #4b5563;
  font-size: 12px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 32px;
  padding: 20px;
}

.dias-em-aberto {
  font-size: 11px;
  color: #475569;
  font-weight: 400;
}

  .subtitulo {
    font-size: 13.5px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #1e293b;
  }

.tabela {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12.5px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.tabela th, .tabela td {
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  background: #fff;
}


  .tabela thead {
    background: #f3f4f6;
  }

  .check {
    width: 14px;
    height: 14px;
    accent-color: #2563eb;
  }

  .check:disabled {
  accent-color: #cbd5e1;
  cursor: not-allowed;
}

.icone-acao {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 4px;
  cursor: pointer;
}

.icone-verde {
  background-color: #10b981;
}

.icone-vermelho {
  background-color: #ef4444;
}

.icone-azul {
  background-color: #2563eb;
}

.icone-disabled {
  background-color: #d1fae5;
  cursor: not-allowed;
}

  .nome-atividade-hover {
    color: #1A7BB9;
    cursor: pointer;
    transition: color 0.18s;
  }
  .nome-atividade-hover:hover {
    color: #23527C;
  }

  .descricao-atividade-expandida {
    font-size: 12px;
    color: #6b7280;
    font-weight: 400;
    margin-top: 4px;
    white-space: pre-line;
  }

`}</style>


      {modalUploadAberto && !tarefaFechada && (
        <div
          style={{
            position: "fixed",
            top: 0, left: 0,
            width: "100%", height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)"
          }}
          onClick={() => setModalUploadAberto(false)}
        >
          <div
            style={{
              background: "rgba(11, 11, 17, 0.6)",
              borderRadius: "var(--onity-radius-l)",
              maxWidth: "500px",
              width: "90%",
              padding: "var(--onity-space-l)",
              boxShadow: "var(--onity-elev-high)",
              maxHeight: "90vh",
              overflowY: "auto",
              border: "1px solid rgba(255, 255, 255, 0.1)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--onity-space-l)"
            }}>
              <h2 style={{
                margin: 0,
                fontSize: "var(--onity-type-h3-size)",
                fontWeight: 600,
                color: "var(--onity-color-text)"
              }}>
                Anexando Arquivos
              </h2>
              <button
                onClick={() => setModalUploadAberto(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "var(--onity-color-text)",
                  padding: "4px",
                  borderRadius: "var(--onity-radius-xs)",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--onity-color-surface)";
                  e.currentTarget.style.color = "var(--onity-color-text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                  e.currentTarget.style.color = "var(--onity-color-text)";
                }}
              >
                ×
              </button>
            </div>

            {/* Área de Upload */}
            <div style={{
              border: "2px dashed rgba(255, 255, 255, 0.3)",
              padding: "var(--onity-space-xl)",
              borderRadius: "var(--onity-radius-m)",
              textAlign: "center",
              marginBottom: "var(--onity-space-l)",
              cursor: "pointer",
              background: "rgba(255, 255, 255, 0.05)",
              transition: "all 0.2s ease",
              position: "relative"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--onity-color-primary)";
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
            }}
            onClick={() => {
              // ✅ Tornar toda a área clicável
              const fileInput = document.getElementById('file-upload-input');
              if (fileInput) {
                fileInput.click();
              }
            }}
            // ✅ Drag and Drop events
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.style.borderColor = "var(--onity-color-primary)";
              e.currentTarget.style.background = "rgba(37, 99, 235, 0.15)";
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              
              // ✅ Reset visual
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
              
              // ✅ Processar arquivos soltos
              const files = Array.from(e.dataTransfer.files);
              if (files.length > 0) {
                setArquivosSelecionados((prev) => [...prev, ...files]);
                toast.success(`✅ ${files.length} arquivo(s) adicionado(s) via drag & drop!`);
              }
            }}
            >
      <Upload size={32} color="var(--onity-color-text)" />
              <p style={{ 
                fontSize: "var(--onity-type-body-size)", 
                color: "var(--onity-color-text)", 
                marginTop: "var(--onity-space-s)",
                fontWeight: 500
              }}>
                Clique aqui para selecionar arquivos
              </p>
              <p style={{ 
                fontSize: "var(--onity-type-caption-size)", 
                color: "var(--onity-color-text)", 
                marginTop: "var(--onity-space-xs)",
                fontWeight: 400
              }}>
                ou arraste e solte arquivos aqui
              </p>
              
              {/* ✅ Input file invisível */}
              <input
                id="file-upload-input"
                type="file"
                multiple
                style={{ 
                  display: "none" // Esconde o input
                }}
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setArquivosSelecionados((prev) => [...prev, ...files]);
                }}
              />

              {/* Lista dos arquivos selecionados */}
              {arquivosSelecionados.length > 0 && (
                <div style={{ 
                  display: "flex", 
                  flexWrap: "wrap", 
                  gap: "var(--onity-space-s)", 
                  justifyContent: "center", 
                  marginTop: "var(--onity-space-m)"
                }}>
                  {arquivosSelecionados.map((file, index) => {
                    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
                    return (
                      <div key={index} style={{
                        position: "relative",
                        width: "120px",
                        minHeight: "140px",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "var(--onity-radius-xs)",
                        background: "rgba(255, 255, 255, 0.1)",
                        padding: "var(--onity-space-s)",
                        boxShadow: "var(--onity-elev-low)",
                        textAlign: "center",
                        backdropFilter: "blur(10px)"
                      }}>
                        <div style={{
                          position: "absolute",
                          top: "-8px",
                          right: "-8px",
                          background: "var(--onity-color-success)",
                          borderRadius: "50%",
                          padding: "2px",
                          boxShadow: "var(--onity-elev-low)"
                        }}>
                          <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                            <path d="M8 12l2.5 2.5L16 9" stroke="white" strokeWidth="2" fill="none" />
                          </svg>
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: 500, wordBreak: "break-word", marginBottom: "6px" }}>{file.name}</div>
                        <div style={{ 
                          fontSize: "var(--onity-type-caption-size)", 
                          color: "var(--onity-color-text)" 
                        }}>
                          {fileSizeMB} MiB
                        </div>
                        <button
                          onClick={() =>
                            setArquivosSelecionados(prev => prev.filter((_, i) => i !== index))
                          }
                          style={{
                            marginTop: "var(--onity-space-s)",
                            background: "var(--onity-color-error)",
                            color: "white",
                            border: "none",
                            borderRadius: "var(--onity-radius-xs)",
                            fontSize: "var(--onity-type-caption-size)",
                            padding: "4px 8px",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.05)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Botões */}
            <div style={{ 
              display: "flex", 
              gap: "var(--onity-space-s)", 
              justifyContent: "flex-end" 
            }}>
              <button
                onClick={() => setModalUploadAberto(false)}
                style={{
                  padding: "var(--onity-space-s) var(--onity-space-m)",
                  background: "rgba(255, 255, 255, 0.15)",
                  color: "var(--onity-color-text)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "var(--onity-radius-xs)",
                  fontSize: "var(--onity-type-body-size)",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--onity-color-surface)";
                  e.currentTarget.style.borderColor = "var(--onity-color-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!arquivosSelecionados.length || !atividadeSelecionada) return;

                  const token = resolveToken();

                  try {
                    // Converter todos os arquivos em base64
                    const anexos = await Promise.all(
                      arquivosSelecionados.map((file) => {
                        return new Promise((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => {
                            const base64 = reader.result?.toString().split(",")[1];
                            if (base64) {
                              resolve({ base64, nomeArquivo: file.name });
                            } else {
                              reject("Falha ao converter o arquivo.");
                            }
                          };
                          reader.onerror = () => reject("Erro ao ler o arquivo.");
                          reader.readAsDataURL(file);
                        });
                      })
                    );

                    // Enviar todos os anexos de uma vez
                    await api.post(
                      `/gestao/tarefas/atividade/${atividadeSelecionada.atividadeTarefaId}/anexos`,
                      { anexos },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );

                    // Marcar como concluída
                    await api.patch(
                      `/gestao/tarefas/atividade/${atividadeSelecionada.atividadeTarefaId}/concluir`,
                      {},
                      { headers: { Authorization: `Bearer ${token}` } }
                    );

                    toast.success("Arquivos enviados com sucesso!");
                    setModalUploadAberto(false);
                    setArquivosSelecionados([]);
                    
                    // ✅ Buscar os anexos reais do backend para ter os IDs corretos
                    const { data: anexosReais } = await api.get(
                      `/gestao/tarefas/atividade/${atividadeSelecionada.atividadeTarefaId}/anexos`,
                      { headers: { Authorization: `Bearer ${token}` } }
                    );

                    // ✅ Atualizar o estado local da atividade com os anexos reais e status
                    setAtividades(prev => prev.map(a => 
                      a.atividadeTarefaId === atividadeSelecionada.atividadeTarefaId 
                        ? { 
                            ...a, 
                            concluida: 1, 
                            dataConclusao: new Date().toISOString(),
                            anexos: anexosReais || []
                          }
                        : a
                    ));
                  } catch (error) {
                    // ✅ Tratamento silencioso de erro
                    toast.error("Erro ao anexar arquivos.");
                  }
                }}
                style={{
                  padding: "var(--onity-space-s) var(--onity-space-m)",
                  background: "var(--onity-color-primary)",
                  color: "var(--onity-color-primary-contrast)",
                  border: "none",
                  borderRadius: "var(--onity-radius-xs)",
                  fontSize: "var(--onity-type-body-size)",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--onity-color-primary-hover)";
                  e.currentTarget.style.transform = "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--onity-color-primary)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <Paperclip size={16} style={{ marginRight: "6px", verticalAlign: "middle" }} />
                Anexar
              </button>
            </div>
          </div>
        </div>
      )}

      <EmailModal
        isOpen={emailModalAberto && !tarefaFechada}
        onClose={() => setEmailModalAberto(false)}
        assuntoPadrao={emailAssunto}
        corpoPadrao={emailCorpo}
        processoId={id || ""}
        atividadeId={atividadeSelecionada?.atividadeTarefaId || ""}
        tipo="processo"
        onSend={async (emailData) => {
          const token = resolveToken();
          
          // ✅ Atualizar estado local IMEDIATAMENTE para feedback visual
          if (atividadeSelecionada) {
            setAtividades(prev => prev.map(atividade => 
              atividade.atividadeTarefaId === atividadeSelecionada.atividadeTarefaId 
                ? { ...atividade, concluida: 1, dataConclusao: new Date().toISOString() }
                : atividade
            ));
          }
          
          try {
            const formData = new FormData();
            formData.append("para", emailData.para);
            formData.append("cc", emailData.cc);
            formData.append("co", emailData.co);
            formData.append("assunto", emailData.assunto);
            formData.append("corpo", emailData.corpo);
            formData.append("nomeUsuario", emailData.nomeUsuario || "");
            formData.append("emailUsuario", emailData.emailUsuario || "");
            formData.append("tarefaId", id);
            formData.append("atividadeId", atividadeSelecionada?.atividadeTarefaId);
            if (emailData.anexo && emailData.anexo.length > 0) {
              emailData.anexo.forEach((file) => {
                formData.append("anexo", file);
              });
            }
            
            // ✅ Executar envio e conclusão em paralelo para ser mais rápido
            const [emailResponse] = await Promise.all([
              api.post("/gestao/email/enviar", formData, {
                headers: {
                  Authorization: `Bearer ${token}`
                  // Não definir Content-Type aqui; o navegador define com boundary
                },
              }),
              // Concluir atividade em paralelo
              atividadeSelecionada ? api.patch(
                `/gestao/tarefas/atividade/${atividadeSelecionada.atividadeTarefaId}/concluir`,
                {},
                { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
              ) : Promise.resolve()
            ]);
            
            toast.success("E-mail enviado e atividade concluída!");
            setEmailModalAberto(false);
            
            // ✅ Reload da página após 1 segundo para garantir sincronização
            setTimeout(() => {
              router.reload();
            }, 1000);
            
          } catch (err) {
            // ✅ Em caso de erro, reverter o estado local
            if (atividadeSelecionada) {
              setAtividades(prev => prev.map(atividade => 
                atividade.atividadeTarefaId === atividadeSelecionada.atividadeTarefaId 
                  ? { ...atividade, concluida: 0, dataConclusao: null }
                  : atividade
              ));
            }
            toast.error("Erro ao enviar o e-mail.");
          }
        }}
      />

      {justificativaModalAberto && !tarefaFechada && (
        <div style={{
          position: "fixed",
          top: 0, left: 0,
          width: "100%", height: "100%",
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)"
        }}
          onClick={() => setJustificativaModalAberto(false)}
        >
          <div
            style={{
              background: "rgba(11, 11, 17, 0.6)",
              borderRadius: "var(--titan-radius-lg)",
              maxWidth: "500px",
              width: "90%",
              padding: "var(--titan-spacing-lg)",
              boxShadow: "var(--titan-shadow-lg)",
              maxHeight: "90vh",
              overflowY: "auto",
              border: "1px solid rgba(255, 255, 255, 0.1)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--titan-spacing-lg)"
            }}>
              <h2 style={{
                margin: 0,
                fontSize: "var(--titan-font-size-xl)",
                fontWeight: "var(--titan-font-weight-semibold)",
                color: "var(--titan-text-high)"
              }}>
                Justificativa para Cancelamento
              </h2>
              <button
                onClick={() => setJustificativaModalAberto(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "var(--titan-text-med)",
                  padding: "4px",
                  borderRadius: "var(--titan-radius-sm)",
                  transition: "all var(--titan-transition-fast)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--titan-input-bg)";
                  e.currentTarget.style.color = "var(--titan-text-high)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                  e.currentTarget.style.color = "var(--titan-text-med)";
                }}
              >
                ×
              </button>
            </div>
            <textarea
              rows={4}
              value={justificativaTexto}
              onChange={(e) => setJustificativaTexto(e.target.value)}
              placeholder="Descreva o motivo"
              style={{
                width: "100%",
                padding: "var(--titan-spacing-sm)",
                fontSize: "var(--titan-font-size-sm)",
                borderRadius: "var(--titan-radius-sm)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                marginBottom: "var(--titan-spacing-lg)",
                resize: "none",
                background: "rgba(255, 255, 255, 0.1)",
                color: "var(--titan-text-high)",
                fontFamily: "var(--titan-font-family)"
              }}
            />

            {/* Botões */}
            <div style={{ 
              display: "flex", 
              gap: "var(--titan-spacing-sm)", 
              justifyContent: "flex-end" 
            }}>
              <button
                onClick={() => setJustificativaModalAberto(false)}
                style={{
                  padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                  background: "rgba(255, 255, 255, 0.15)",
                  color: "var(--titan-text-high)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "var(--titan-radius-sm)",
                  fontSize: "var(--titan-font-size-sm)",
                  fontWeight: "var(--titan-font-weight-medium)",
                  cursor: "pointer",
                  transition: "all var(--titan-transition-fast)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--titan-input-bg)";
                  e.currentTarget.style.borderColor = "var(--titan-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!justificativaTexto.trim()) {
                    toast.error("Justificativa obrigatória.");
                    return;
                  }

                                                                                  const resultado = await cancelarAtividade(atividadeSelecionada.atividadeTarefaId, justificativaTexto);
                  setJustificativaModalAberto(false);
                  
                  // ✅ Atualizar apenas o estado local da atividade
                  setAtividades(prev => prev.map(atividade => 
                    atividade.atividadeTarefaId === atividadeSelecionada.atividadeTarefaId 
                      ? { ...atividade, cancelada: 1, justificativa: justificativaTexto, dataCancelamento: new Date().toISOString() }
                      : atividade
                  ));
                }}
                style={{
                  padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                  background: "var(--titan-error)",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--titan-radius-sm)",
                  fontSize: "var(--titan-font-size-sm)",
                  fontWeight: "var(--titan-font-weight-medium)",
                  cursor: "pointer",
                  transition: "all var(--titan-transition-fast)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--titan-error-hover)";
                  e.currentTarget.style.transform = "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--titan-error)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

    </>

  );
}
