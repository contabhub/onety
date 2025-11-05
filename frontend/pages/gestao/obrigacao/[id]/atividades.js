// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import PrincipalSidebar from "../../../../components/onety/principal/PrincipalSidebar";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Mail, Paperclip, ClipboardList, Check, X } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from "../../../../styles/gestao/ObrigacoesAtividades.module.css";
import Head from "next/head";
import EmailModal from "../../../../components/gestao/EmailModal";
import { subDays, isWeekend, addDays } from "date-fns";
import { Upload } from "lucide-react";
// Fallback simples para ambientes sem hook central
const useAuthRedirect = () => {};

// Helpers de auth e usuário
const getToken = () => {
  try {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  } catch {
    return '';
  }
};
const getUserFromStorage = () => {
  try {
    const raw = localStorage.getItem('userData');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Pequeno wrapper de API local (compatível com outras telas)
const BASE_CANDIDATE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const LOCAL_API_BASE = (typeof window !== 'undefined') ? (localStorage.getItem('apiBase') || '') : '';
const BASE_URL = (BASE_CANDIDATE || LOCAL_API_BASE || 'http://localhost:5000').replace(/\/$/, '');

// ✅ URL do serviço Onvio separado (pode ser configurado via variável de ambiente)
// Em desenvolvimento: http://localhost:3001
// Em produção: configure NEXT_PUBLIC_ONVIO_SERVICE_URL
const ONVIO_SERVICE_URL = (process.env.NEXT_PUBLIC_ONVIO_SERVICE_URL || 'http://localhost:3001').replace(/\/$/, '');

// ✅ Função para normalizar URL - detecta endpoints Onvio e direciona para serviço separado
const normalizeUrl = (u) => {
  // Verificar se é um endpoint do Onvio
  const isOnvioEndpoint = u.includes('/gestao/onvio/') || u.includes('/onvio/');
  
  // Se for endpoint Onvio, usar serviço separado
  if (isOnvioEndpoint) {
    // Garantir que a URL tenha o prefixo /api se necessário
    const onvioUrl = u.startsWith('/api/') ? u : `/api${u}`;
    return `${ONVIO_SERVICE_URL}${onvioUrl.startsWith('/') ? '' : '/'}${onvioUrl}`;
  }
  
  // Caso contrário, usar a URL base normal
  return `${BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
};
const api = {
  async get(url, opts = {}) {
    const res = await fetch(normalizeUrl(url), { ...(opts || {}) });
    if (opts && opts.responseType === 'blob') {
      const data = await res.blob();
      return { data };
    }
    const data = await res.json().catch(() => ({}));
    return { data };
  },
  async post(url, body, opts = {}) {
    const isFormData = (typeof FormData !== 'undefined') && body instanceof FormData;
    const headers = { ...(opts.headers || {}) };
    const payload = isFormData ? body : JSON.stringify(body ?? {});
    if (!isFormData && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const res = await fetch(normalizeUrl(url), { method: 'POST', headers, body: payload });
    const data = await res.json().catch(() => ({}));
    return { data };
  },
  async patch(url, body, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const res = await fetch(normalizeUrl(url), { method: 'PATCH', headers, body: JSON.stringify(body ?? {}) });
    const data = await res.json().catch(() => ({}));
    return { data };
  },
  async delete(url, opts = {}) {
    const res = await fetch(normalizeUrl(url), { method: 'DELETE', ...(opts || {}) });
    const data = await res.json().catch(() => ({}));
    return { data };
  }
};

function parseMysqlDatetime(str) {
    if (!str) return null;

    // ISO UTC (com Z) → converte para local manualmente
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(str)) {
        // remove o Z, trata como local
        str = str.replace("Z", "");
        const [date, time] = str.split('T');
        if (!date || !time) return null;
        const [year, month, day] = date.split('-').map(Number);
        const [hour, min, sec] = time.split(':').map(Number);
        return new Date(year, month - 1, day, hour, min, sec || 0);
    }

    // ISO local: "2025-06-27T14:39:00"
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(str)) {
        const [date, time] = str.split('T');
        if (!date || !time) return null;
        const [year, month, day] = date.split('-').map(Number);
        const [hour, min, sec] = time.split(':').map(Number);
        return new Date(year, month - 1, day, hour, min, sec || 0);
    }

    // MySQL normal: "2025-06-27 14:39:00"
    if (str.includes(' ')) {
        const [date, time] = str.split(' ');
        if (!date || !time) return null;
        const [year, month, day] = date.split('-').map(Number);
        const [hour, min, sec] = time.split(':').map(Number);
        return new Date(year, month - 1, day, hour, min, sec || 0);
    }

    // fallback
    return new Date(str);
}


const getIconeAtividade = (tipo) => {
    const tipoLower = tipo?.toLowerCase();

    if (tipoLower.includes("e-mail")) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path fill="#000" d="M2 20V4h20v16zm10-7L4 8v10h16V8zm0-2l8-5H4zM4 8V6v12z"/></svg>`;
    }

    if (tipoLower.includes("anexo")) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 20 20"><path fill="#000" d="M3.264 8.579a.683.683 0 0 1-.975 0a.704.704 0 0 1 0-.987L8.32 1.5C9.68.444 11.048-.063 12.41.006c1.716.088 3.052.742 4.186 1.815C17.752 2.915 18.5 4.476 18.5 6.368c0 1.452-.422 2.73-1.313 3.864l-8.503 8.76c-.86.705-1.816 1.046-2.84 1.005c-1.3-.054-2.267-.474-2.986-1.185c-.842-.831-1.358-1.852-1.358-3.225c0-1.092.377-2.1 1.155-3.046L10.139 4.9c.6-.64 1.187-1.02 1.787-1.112a2.49 2.49 0 0 1 2.2.755c.532.563.76 1.265.68 2.064c-.055.545-.278 1.047-.688 1.528l-6.88 7.048a.683.683 0 0 1-.974.006a.704.704 0 0 1-.006-.987l6.847-7.012c.2-.235.305-.472.33-.724c.04-.4-.056-.695-.305-.958a1.12 1.12 0 0 0-1-.34c-.243.037-.583.258-1.002.704l-7.453 7.607c-.537.655-.797 1.35-.797 2.109c0 .954.345 1.637.942 2.226c.475.47 1.12.75 2.08.79c.68.027 1.31-.198 1.858-.642l8.397-8.65c.645-.827.967-1.8.967-2.943c0-1.482-.577-2.684-1.468-3.528c-.91-.862-1.95-1.37-3.313-1.44c-1.008-.052-2.065.34-3.117 1.146z"/></svg>`;
    }

    if (tipoLower.includes("pdf layout") || tipoLower.includes("pdf-layout")) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path fill="#fbfbfb" d="M21.917 13.484a4.38 4.38 0 0 0-5.19-4.26a6.281 6.281 0 0 0-11.75 2.19a3.24 3.24 0 0 0-2.66 2a3.43 3.43 0 0 0 .82 3.74c1.12 1.03 2.54.89 3.94.89h10.15a4.514 4.514 0 0 0 4.69-4.32Zm-4.65 3.56c-1.19.01-2.38 0-3.56 0c-2.75 0-5.49.06-8.23 0a2.38 2.38 0 0 1-2.33-1.73a2.333 2.333 0 0 1 2.28-2.94a.515.515 0 0 0 .5-.5a5.3 5.3 0 0 1 10.11-1.81a.5.5 0 0 0 .56.23a3.366 3.366 0 0 1 4.33 3.32a3.49 3.49 0 0 1-3.66 3.43"/></svg>`;
    }

            if (tipoLower.includes("integração: econtador") || tipoLower.includes("integração: econtador")) {
            return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="#e96372"/>
                <text x="12" y="16" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="white">e</text>
            </svg>`;
        }

                 if (tipoLower.includes("integração: onvio") || tipoLower.includes("integração: onvio")) {
             return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24">
                 <circle cx="12" cy="12" r="10" fill="#3b82f6"/>
                 <text x="12" y="16" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="white">O</text>
             </svg>`;
         }

         if (tipoLower.includes("integração: drive") || tipoLower.includes("integração: drive")) {
             return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24">
                 <circle cx="12" cy="12" r="10" fill="#10b981"/>
                 <text x="12" y="16" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="white">D</text>
             </svg>`;
         }

    // default: checklist
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.2l-3.5-3.5 1.4-1.4L9 13.4l7.1-7.1 1.4 1.4z"/></svg>`;
};

const coresPorStatus = {
    "Próximos 15 dias": "#facc15",
    "Programado Hoje": "#f59e0b",
    "Fora Programado": "#888888",
    "Após Meta": "#a52a2a",
    "Vence Hoje": "#fe8320",
    "Após Prazo": "#dc2626",
    "Concluída": "#22c55e"
};


function obterStatusObrigacao(vencimento) {
    const hoje = new Date();
    const dias = differenceInDays(vencimento, hoje);

    if (dias > 15) return "Fora Programado";
    if (dias <= 15 && dias > 1) return "Próximos 15 dias";
    if (dias === 0) return "Vence Hoje";
    if (dias < 0) return "Após Prazo";

    return "Programado Hoje";
}

function somarDias(date, qtd, tipo) {
    if (tipo === "Dias corridos") return addDays(date, qtd);

    let count = 0;
    let result = new Date(date);
    while (count < qtd) {
        result = addDays(result, 1);
        if (!isWeekend(result)) count++;
    }
    return result;
}

function subtrairDias(date, qtd, tipo) {
    if (tipo === "Dias corridos") return subDays(date, qtd);

    let count = 0;
    let result = new Date(date);
    while (count < qtd) {
        result = subDays(result, 1);
        if (!isWeekend(result)) count++;
    }
    return result;
}

// Adicione antes do componente principal:
function renderComentarioAmigavel(comentario) {
    // Regex para pegar links do Onvio
    const regex = /(https?:\/\/onvio\.com\.br\/[\w\-\/?#=&%.]+)/g;
    // Substitui o link por um texto amigável clicável
    return comentario.replace(regex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#3b82f6;text-decoration:underline;">Documento baixado pelo Onvio</a>`;
    });
}

export default function AtividadesObrigacao() {
    useAuthRedirect();
    const router = useRouter();
    const { id } = router.query;
    const [obrigacao, setObrigacao] = useState(null);
    const [atividades, setAtividades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalEmailAberto, setModalEmailAberto] = useState(false);
    const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
    const [justificativa, setJustificativa] = useState("");
    const [modalJustificativaAberto, setModalJustificativaAberto] = useState(false);
    const [atividadeCancelar, setAtividadeCancelar] = useState(null);
    const [comentarios, setComentarios] = useState([]);
    const [responsaveis, setResponsaveis] = useState([]);
    const [modalComentariosAberto, setModalComentariosAberto] = useState(false);
    const [pdfLayoutModalAberto, setPdfLayoutModalAberto] = useState(false);
    const [pdfLayoutSelecionado, setPdfLayoutSelecionado] = useState(null);
    const [pdfLayouts, setPdfLayouts] = useState([]);
    const [loadingPdfLayouts, setLoadingPdfLayouts] = useState(false);
    const [validandoPdf, setValidandoPdf] = useState(false);
    const [modalPdfValidationAberto, setModalPdfValidationAberto] = useState(false);
    const [pdfValidationResult, setPdfValidationResult] = useState(null);
    const [emailAssunto, setEmailAssunto] = useState("");
    const [emailCorpo, setEmailCorpo] = useState("");
    const [emailModalAberto, setEmailModalAberto] = useState(false);
    const [modalUploadAberto, setModalUploadAberto] = useState(false);
    const [anexosExpandidos, setAnexosExpandidos] = useState({});
    const [descricaoExpandida, setDescricaoExpandida] = useState({});
    const [sidebarColapsada, setSidebarColapsada] = useState(false);
    const [abaAtiva, setAbaAtiva] = useState("usuario");
    const [comentarioTexto, setComentarioTexto] = useState("");
    const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
    const [erro, setErro] = useState(null);
    
    // ✅ NOVO: Estados para navegação entre competências
    const [obrigacaoAnterior, setObrigacaoAnterior] = useState(null);
    const [obrigacaoProxima, setObrigacaoProxima] = useState(null);
    const [loadingNavegacao, setLoadingNavegacao] = useState(false);

    // ✅ Função para buscar obrigações adjacentes (anterior e próxima)
    const buscarObrigacoesAdjacentes = async (obrigacaoAtual) => {
        if (!obrigacaoAtual || !obrigacaoAtual.clienteId || !obrigacaoAtual.obrigacaoId) return;
        
        const token = getToken();
        if (!token) return;

        try {
            setLoadingNavegacao(true);
            
            // Buscar obrigações do mesmo cliente e mesma obrigação base
            const { data: obrigacoesAdjacentes } = await api.get(
                `/gestao/obrigacoes/cliente/${obrigacaoAtual.clienteId}/obrigacao/${obrigacaoAtual.obrigacaoId}/competencias`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (obrigacoesAdjacentes && obrigacoesAdjacentes.length > 0) {
                // Encontrar a posição atual
                const posicaoAtual = obrigacoesAdjacentes.findIndex(
                    (ob) => ob.id === obrigacaoAtual.id
                );

                if (posicaoAtual > 0) {
                    setObrigacaoAnterior(obrigacoesAdjacentes[posicaoAtual - 1]);
                } else {
                    setObrigacaoAnterior(null);
                }

                if (posicaoAtual < obrigacoesAdjacentes.length - 1) {
                    setObrigacaoProxima(obrigacoesAdjacentes[posicaoAtual + 1]);
                } else {
                    setObrigacaoProxima(null);
                }
            }
        } catch (err) {
            console.error("Erro ao buscar obrigações adjacentes:", err);
        } finally {
            setLoadingNavegacao(false);
        }
    };

    // ✅ Função para navegar para obrigação anterior/próxima
    const navegarParaObrigacao = (obrigacaoDestino) => {
        if (!obrigacaoDestino) return;
        router.push(`/gestao/obrigacao/${obrigacaoDestino.id}/atividades`);
    };

    // ✅ Função carregarDados extraída para reutilização
    const carregarDados = async () => {
        const token = getToken();
        if (!token || !id) return { atividades: [], obrigacao: null };

        try {
            setLoading(true);
            setErro(null);
            const headers = { Authorization: `Bearer ${token}` };

            const [{ data: obrigacao }, { data: atividadesCliente }, { data: comentarios }, { data: responsaveis }] = await Promise.all([
                api.get(`/gestao/obrigacoes/cliente-obrigacao/${id}`, { headers }),
                api.get(`/gestao/obrigacoes/atividades-cliente/${id}`, { headers }),
                api.get(`/gestao/obrigacoes/${id}/comentarios`, { headers }),
                api.get(`/gestao/obrigacoes/obrigacoes-clientes/${id}/responsaveis`, { headers }),
            ]);

            // Carregar dados adicionais simulados (se backend não retornar ainda)
            obrigacao.emails = obrigacao.emails || [];
            obrigacao.logs = obrigacao.logs || [];
            obrigacao.atendimentos = obrigacao.atendimentos || [];

            setObrigacao(obrigacao);
            console.log("📦 Dados da obrigação recebida:", {
                vencimento: obrigacao.vencimento,
                metaQtdDias: obrigacao.metaQtdDias,
                metaTipoDias: obrigacao.metaTipoDias,
                acaoQtdDias: obrigacao.acaoQtdDias,
                acaoTipoDias: obrigacao.acaoTipoDias,
                metaDiretaDoBanco: obrigacao.meta, // se vier do banco
            });
            setAtividades(Array.isArray(atividadesCliente) ? atividadesCliente : []);
            setComentarios(Array.isArray(comentarios) ? comentarios : []);
            setResponsaveis(Array.isArray(responsaveis) ? responsaveis : []);

            // ✅ Buscar obrigações adjacentes após carregar a obrigação atual
            await buscarObrigacoesAdjacentes(obrigacao);

            return { atividades: atividadesCliente, obrigacao };
        } catch (err) {
            console.error("Erro ao carregar dados da obrigação:", err);
            setErro("Erro ao carregar dados da obrigação. Tente novamente.");
            toast.error("Erro ao carregar dados da obrigação.");
            return { atividades: [], obrigacao: null };
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarDados();
    }, [id]);

    // ✅ Funções de formatação
    function formatarData(data) {
        if (!data) return "--/--/----";
        const d = typeof data === "string" ? parseMysqlDatetime(data) : data;
        if (!d || isNaN(d.getTime())) return "--/--/----";
        return d.toLocaleDateString('pt-BR');
    }

    function formatarHoraBrasilia(data) {
        if (!data) return "--:--";
        const d = typeof data === "string" ? parseMysqlDatetime(data) : data;
        if (!d || isNaN(d.getTime())) return "--:--";
        return format(d, "HH:mm");
    }

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

    const concluirAtividade = async (atividadeId, tipo) => {
        const token = getToken();
        if (!token) return;
        try {
            await api.patch(`/gestao/obrigacoes/atividade/${atividadeId}/concluir`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setAtividades((prev) =>
                prev.map((a) =>
                    a.id === atividadeId ? { ...a, concluida: 1 } : a
                )
            );

            // ✅ Recarregar dados
            await carregarDados();

        } catch (err) {
            console.error(`Erro ao concluir atividade tipo ${tipo}:`, err);
            toast.error("Erro ao concluir atividade.");
        }
    };

    const cancelarAtividade = async (atividadeId) => {
        const token = getToken();
        if (!token) return;
        try {
            await api.patch(`/gestao/obrigacoes/atividade/${atividadeId}/cancelar`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });

            toast.success("Atividade cancelada com sucesso.");
            
            // ✅ Recarregar dados
            await carregarDados();
        } catch (err) {
            console.error("Erro ao cancelar atividade:", err);
            toast.error("Erro ao cancelar atividade.");
        }
    };

    const enviarJustificativa = async () => {
        const token = getToken();
        if (!token || !atividadeSelecionada || !justificativa.trim()) return;

        try {
            // 1. Cancelar a atividade com justificativa
            await api.patch(`/gestao/obrigacoes/atividade/${atividadeSelecionada.id}/cancelar`, {
                justificativa: justificativa,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            // 2. Adicionar justificativa como comentário do tipo "sistema"
            await api.post(`/gestao/obrigacoes/${id}/comentario`, {
                comentario: `Motivo Cancelamento Atividade ${atividadeSelecionada.id}: ${justificativa}`,
                tipo: "sistema"
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            toast.success("Atividade cancelada com justificativa.");
            setJustificativa("");
            setModalJustificativaAberto(false);
            setAtividadeSelecionada(null);
            await carregarComentarios();
            
            // ✅ Recarregar dados
            await carregarDados();
        } catch (err) {
            console.error("Erro ao cancelar com justificativa:", err);
            toast.error("Erro ao cancelar atividade.");
        }
    };

    const atividadesList = Array.isArray(atividades) ? atividades : [];
    const todasAtividadesFinalizadas = atividadesList.every((a) => a.concluida === 1 || a.cancelada === 1);
    const obrigacaoCancelada = obrigacao?.status === "cancelada";
    const obrigacaoConcluida = obrigacao?.status === "concluida";
    
    // Contar atividades pendentes para validação
    const atividadesPendentes = atividadesList.filter((a) => a.concluida !== 1 && a.cancelada !== 1).length;

    const concluirObrigacao = async () => {
        // Validação: verificar se todas as atividades foram finalizadas
        if (!todasAtividadesFinalizadas) {
            toast.error(`Não é possível concluir a obrigação. Existem ${atividadesPendentes} atividade(s) pendente(s).`);
            return;
        }
        
        if (!id) return;
        
        const token = getToken();
        try {
            await api.patch(`/gestao/obrigacoes/${id}/concluir`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success("Obrigação concluída com sucesso.");

            // ✅ Usar carregarDados em vez de router.reload()
            await carregarDados();
        } catch (err) {
            console.error("Erro ao concluir obrigação:", err);
            toast.error("Erro ao concluir obrigação.");
        }
    };



    const carregarComentarios = async () => {
        const token = getToken();
        if (!token || !id) return;

        try {
            const { data } = await api.get(`/gestao/obrigacoes/${id}/comentarios`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setComentarios(data);
        } catch (err) {
            console.error("Erro ao carregar comentários:", err);
        }
    };

    const cancelarObrigacao = async () => {
        const token = getToken();
        if (!token || !id) return;

        try {
            await api.patch(`/gestao/obrigacoes/${id}/cancelar`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Obrigação cancelada com sucesso!");
            // ✅ Usar carregarDados em vez de router.reload()
            await carregarDados();
        } catch (err) {
            const msg = err?.response?.data?.error || "Erro ao cancelar a obrigação.";
            toast.error(msg);
        }
    };

    const reabrirObrigacao = async () => {
        const token = getToken();
        if (!token || !id) return;

        try {
            await api.patch(`/gestao/obrigacoes/${id}/reabrir`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Obrigação reaberta com sucesso!");
            // ✅ Usar carregarDados em vez de router.reload()
            await carregarDados();
        } catch (err) {
            const msg = err?.response?.data?.error || "Erro ao reabrir a obrigação.";
            toast.error(msg);
        }
    };

    const validarPdfLayout = async (atividade) => {
        const token = getToken();
        if (!token || !atividade) return;

        setValidandoPdf(true);
        setModalPdfValidationAberto(true);
        
        try {
            // Buscar informações do cliente e competência
            const clienteInfo = {
                clienteId: obrigacao?.clienteId,
                clienteNome: obrigacao?.clienteNome,
                clienteCnpjCpf: obrigacao?.clienteCnpjCpf,
                competencia: obrigacao?.vencimento ? new Date(obrigacao.vencimento).toISOString().split('T')[0].substring(0, 7) : null, // YYYY-MM
                obrigacaoNome: obrigacao?.nomeObrigacao || obrigacao?.nome
            };

            console.log("🔍 Validando PDF Layout para:", clienteInfo);

            // Chamar API para validar se o arquivo foi processado
            const response = await api.post('/gestao/pdf-layouts/validar-processamento', {
                clienteId: clienteInfo.clienteId,
                competencia: clienteInfo.competencia,
                obrigacaoNome: clienteInfo.obrigacaoNome
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setPdfValidationResult(response.data);
            
            if (response.data.processado) {
                toast.success("Arquivo já foi processado no PDF Layout!");
                
                // Concluir atividade automaticamente se foi processado
                await api.patch(`/gestao/obrigacoes/atividade/${atividade.id}/concluir`, {}, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                // ✅ Recarregar dados
                await carregarDados();
            } else {
                toast.error("❌ Arquivo ainda não foi processado no PDF Layout.");
            }

        } catch (err) {
            console.error("Erro ao validar PDF Layout:", err);
            toast.error("Erro ao validar processamento do PDF.");
            setPdfValidationResult({ processado: false, erro: "Erro na validação" });
        } finally {
            setValidandoPdf(false);
        }
    };

    const [buscandoMatches, setBuscandoMatches] = useState(null);
    const [anexosEcontadorExpandidos, setAnexosEcontadorExpandidos] = useState({});

    const buscarMatchesEcontador = async (atividade) => {
        const token = getToken() || sessionStorage.getItem("token");
        if (!token || !atividade) {
            console.error("❌ [Frontend] Token ou atividade não encontrado", { token: !!token, atividade: !!atividade });
            toast.error("Token ou atividade não encontrado");
            return;
        }

        try {
            setBuscandoMatches(atividade.id);
            
            // Determinar qual API chamar baseado no tipo de integração
            const tipoIntegracao = atividade.tipo.toLowerCase();
            let endpoint = '';
            let mensagemInicial = '';
            
            if (tipoIntegracao.includes("integração: econtador") || tipoIntegracao.includes("integração: econtador")) {
                endpoint = '/gestao/integracao-econtador/buscar-automatico-por-cnpj';
                mensagemInicial = "Iniciando busca automática no eContador...";
            } else if (tipoIntegracao.includes("integração: onvio") || tipoIntegracao.includes("integração: onvio")) {
                endpoint = '/gestao/onvio/buscar-automatico-por-cnpj';
                mensagemInicial = "Iniciando busca automática no Onvio...";
            } else {
                toast.error("Tipo de integração não reconhecido");
                return;
            }
            
            console.log("🔍 [Frontend] Endpoint detectado:", endpoint);
            console.log("🔍 [Frontend] URL normalizada será:", normalizeUrl(endpoint));
            
            toast.info(mensagemInicial);
            
            // Chamar API para busca automática por CNPJ
            // ✅ CORREÇÃO: usar id da obrigação (da URL) como obrigacaoClienteId se não vier na atividade
            const obrigacaoClienteId = atividade.obrigacaoClienteId || atividade.obrigacao_cliente_id || obrigacao?.id || id;
            
            const urlFinal = normalizeUrl(endpoint);
            console.log("🌐 [Frontend] Fazendo requisição POST para:", urlFinal);
            console.log("📦 [Frontend] Dados enviados:", {
                clienteId: obrigacao.clienteId,
                obrigacaoClienteId: obrigacaoClienteId,
                atividadeId: atividade.id,
                atividadeTexto: atividade.texto || atividade.tipo || null
            });
            
            const response = await api.post(endpoint, {
                clienteId: obrigacao.clienteId,
                obrigacaoClienteId: obrigacaoClienteId,
                atividadeId: atividade.id, // garante que buscamos exatamente o item clicado
                atividadeTexto: atividade.texto || atividade.tipo || null // ajuda o backend a distinguir Recibo vs Extrato
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log("✅ [Frontend] Resposta recebida:", response.data);

            if (response.data.success) {
                toast.success("Documento encontrado e atividade concluída com sucesso!");
                
                // ✅ Recarregar dados
                await carregarDados();
            } else {
                const mensagem = response.data.message || "Nenhum documento válido encontrado";
                toast.error(`${mensagem}`);
            }

        } catch (err) {
            console.error("❌ [Frontend] Erro ao buscar matches:", err);
            console.error("❌ [Frontend] Detalhes do erro:", {
                message: err.message,
                stack: err.stack,
                response: err.response?.data
            });
            const mensagemErro = err.response?.data?.message || err.message || "Erro ao buscar matches";
            toast.error(`Erro: ${mensagemErro}`);
        } finally {
            setBuscandoMatches(null);
        }
    };


    if (!obrigacao || loading)
        return (
                <div className={styles.loadingOverlay}>
                    <div className={styles.loadingContainer}>
                        <div className={styles.spinner}></div>
                        <p className={styles.loadingText}>Carregando atividades...</p>
                    </div>
                </div>
        );

    if (erro) {
        return (
                <div className="p-6 text-gray-600 flex items-center justify-center min-h-screen">
                    <div style={{ textAlign: "center" }}>
                        <div style={{ marginBottom: "16px", color: "#ef4444" }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="15" y1="9" x2="9" y2="15"/>
                                <line x1="9" y1="9" x2="15" y2="15"/>
                            </svg>
                        </div>
                        <h2 style={{ marginBottom: "12px", color: "#1e293b" }}>Erro ao carregar dados</h2>
                        <p style={{ marginBottom: "20px", color: "#64748b" }}>{erro}</p>
                        <button
                            onClick={carregarDados}
                            style={{
                                padding: "8px 16px",
                                background: "#2563eb",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer"
                            }}
                        >
                            Tentar Novamente
                        </button>
                    </div>
                </div>
        );
    }

    // ✅ USAR DATAS REAIS DO BANCO ao invés de calcular
    const vencimentoDate = obrigacao.vencimento ? new Date(obrigacao.vencimento) : null;
    const dataMeta = obrigacao.meta ? new Date(obrigacao.meta) : null;
    const dataAcao = obrigacao.acao ? new Date(obrigacao.acao) : null;



    const getBotaoAcao = (a) => {
        const tipo = a.tipo.toLowerCase();
        const concluida = a.concluida === 1;

        if (a.cancelada) {
            return (
                <div style={{ display: "flex", flexDirection: "column", fontSize: "11px", color: "#475569" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <X size={16} color="#ef4444" />
                        <span>
                            {a.canceladoPorNome && `${a.canceladoPorNome} - `}
                            {a.dataCancelamento && `${formatarData(a.dataCancelamento)} ${formatarHoraBrasilia(a.dataCancelamento)}`}
                        </span>
                        
                        {/* Lixeirinha ao lado da hora */}
                        {!obrigacaoCancelada && (
                            <span
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                title="Reativar atividade"
                                onClick={async () => {
                                    const confirmar = confirm("Deseja reativar esta atividade?");
                                    if (!confirmar) return;
                                    const token = getToken();
                                    try {
                                        await api.patch(`/gestao/obrigacoes/atividade/${a.id}/descancelar`, {}, {
                                            headers: { Authorization: `Bearer ${token}` }
                                        });
                                        // ✅ Se a obrigação estiver concluída, desconcluí-la
                                        if (obrigacao?.dataBaixa) {
                                            await api.patch(`/gestao/obrigacoes/${id}/desconcluir`, {}, {
                                                headers: { Authorization: `Bearer ${token}` },
                                            });
                                        }
                                        toast.success("Atividade reativada com sucesso.");
                                        // ✅ Usar carregarDados em vez de router.reload()
                                        await carregarDados();
                                    } catch (err) {
                                        console.error("Erro ao descancelar atividade:", err);
                                        toast.error("Erro ao reativar atividade.");
                                    }
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                            </span>
                        )}
                    </div>
                </div>
            );
        }
        // Botão já concluído — mostra ✅ nome + data + lixeirinha
        if (concluida) {
            return (
                <div style={{ display: "flex", flexDirection: "column", fontSize: "11px", color: "#475569" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Check size={16} color="#22c55e" />
                        <span>
                            {a.concluidoPorNome && `${a.concluidoPorNome} - `}
                            {a.dataConclusao && `${formatarData(a.dataConclusao)} ${formatarHoraBrasilia(a.dataConclusao)}`}
                        </span>
                        
                        {/* Lixeirinha ao lado da hora (exceto e-mail e integração eContador/Onvio) */}
                        {!tipo.includes("e-mail") && !tipo.includes("integração: econtador") && !tipo.includes("integração: onvio") && !obrigacaoCancelada && (
                            <span
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                title="Reabrir atividade"
                                onClick={async () => {
                                    const confirmar = confirm("Deseja reabrir esta atividade?");
                                    if (!confirmar) return;
                                    const token = getToken();
                                    try {
                                        await api.patch(`/gestao/obrigacoes/atividade/${a.id}/disconcluir`, {}, {
                                            headers: { Authorization: `Bearer ${token}` }
                                        });
                                        toast.success("Atividade reaberta com sucesso.");
                                        // ✅ Usar carregarDados em vez de router.reload()
                                        await carregarDados();
                                    } catch (err) {
                                        console.error(err);
                                        toast.error("Erro ao reabrir atividade.");
                                    }
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                            </span>
                        )}
                    </div>
                </div>
            );
        }


        const handleClick = () => {
            // Se obrigação cancelada, não permite ações
            if (obrigacaoCancelada) {
                toast.error("Obrigação cancelada. Reabra para realizar ações.");
                return;
            }

            console.log("🔍 [FRONTEND] Atividade selecionada:", a);
            console.log("🔍 [FRONTEND] ID da atividade:", a.id);
            setAtividadeSelecionada(a);

            if (tipo.includes("e-mail")) {
                console.log("🔍 [FRONTEND] Abrindo modal de e-mail para atividade:", a.id);
                setEmailAssunto(a.texto || "");
                setEmailCorpo(a.descricao || "");
                setEmailModalAberto(true);
                return;
            }

            if (tipo.includes("pdf layout") || tipo.includes("pdf-layout")) {
                console.log("🔍 [FRONTEND] Validando PDF Layout para atividade:", a.id);
                validarPdfLayout(a);
                return;
            }

            if (tipo.includes("anexo")) {
                setModalUploadAberto(true);
                return;
            }

            // checklist sem anexo → conclui direto
            concluirAtividade(a.id, a.tipo);
        };

        const iconePrincipal = tipo.includes("e-mail") ? (
            <Mail size={16} color="white" strokeWidth={1.5} />
        ) : tipo.includes("anexo") ? (
            <Paperclip size={16} color="white" strokeWidth={1.5} />
        ) : tipo.includes("pdf layout") || tipo.includes("pdf-layout") ? (
            <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="white" d="M21.917 13.484a4.38 4.38 0 0 0-5.19-4.26a6.281 6.281 0 0 0-11.75 2.19a3.24 3.24 0 0 0-2.66 2a3.43 3.43 0 0 0 .82 3.74c1.12 1.03 2.54.89 3.94.89h10.15a4.514 4.514 0 0 0 4.69-4.32Zm-4.65 3.56c-1.19.01-2.38 0-3.56 0c-2.75 0-5.49.06-8.23 0a2.38 2.38 0 0 1-2.33-1.73a2.333 2.333 0 0 1 2.28-2.94a.515.515 0 0 0 .5-.5a5.3 5.3 0 0 1 10.11-1.81a.5.5 0 0 0 .56.23a3.366 3.366 0 0 1 4.33 3.32a3.49 3.49 0 0 1-3.66 3.43"/>
            </svg>
        ) : tipo.includes("integração: econtador") || tipo.includes("integração: econtador") ? (
            <svg width="16" height="16" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="#dc2626" stroke="#dc2626" strokeWidth="2"/>
                <path fill="white" d="M12 6c-3.314 0-6 2.686-6 6s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6zm0 10c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4z"/>
                <path fill="white" d="M12 8c-2.209 0-4 1.791-4 4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4z"/>
            </svg>
        ) : tipo.includes("integração: onvio") || tipo.includes("integração: onvio") ? (
            <svg width="16" height="16" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="#3b82f6" strokeWidth="2"/>
                <path fill="white" d="M12 6c-3.314 0-6 2.686-6 6s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6zm0 10c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4z"/>
                <path fill="white" d="M12 8c-2.209 0-4 1.791-4 4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4z"/>
            </svg>
        ) : (
            <Check size={16} color="white" strokeWidth={1.5} />
        );

        const tipoClasse =
            tipo.includes("e-mail")
                ? styles.email
                : tipo.includes("anexo")
                    ? styles.anexo
                    : tipo.includes("pdf layout") || tipo.includes("pdf-layout")
                        ? styles.pdfLayout
                        : tipo.includes("integração: econtador") || tipo.includes("integração: econtador")
                            ? styles.econtador
                            : tipo.includes("integração: onvio") || tipo.includes("integração: onvio")
                                ? styles.econtador
                                : styles.checklist;

        return (
            <div className={styles.botoesAcoes}>
                {/* Botão de check apenas para atividades que não são eContador/Onvio */}
                {!(tipo.includes("integração: econtador") || tipo.includes("integração: econtador") || tipo.includes("integração: onvio")) && (
                    <button onClick={handleClick} className={`${styles.botaoCheck} ${tipoClasse}`}>
                        {iconePrincipal}
                    </button>
                )}

                {/* Botão de transferência para eContador/Onvio */}
                {(tipo.includes("integração: econtador") || tipo.includes("integração: econtador") || tipo.includes("integração: onvio")) && !obrigacaoCancelada && (
                    <button
                        className={styles.botaoTransferir}
                        onClick={() => buscarMatchesEcontador(a)}
                        title={buscandoMatches === a.id ? "Buscando..." : tipo.includes("integração: onvio") ? "Buscar matches no Onvio" : "Buscar matches no eContador"}
                        disabled={buscandoMatches === a.id}
                        style={{
                            width: "22px",
                            height: "22px",
                            padding: "4px",
                            margin: "0 2px",
                            background: buscandoMatches === a.id ? "#94a3b8" : "#1976d2",
                            border: "none",
                            borderRadius: "4px",
                            cursor: buscandoMatches === a.id ? "not-allowed" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}
                    >
                        {buscandoMatches === a.id ? (
                            <div
                                style={{
                                    width: "12px",
                                    height: "12px",
                                    borderRadius: "50%",
                                    border: "2px solid white",
                                    borderTop: "2px solid transparent",
                                    animation: "spin 1s linear infinite",
                                }}
                            />
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7 16V4m0 0L3 8m4-4l4 4"/>
                                <path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
                            </svg>
                        )}
                    </button>
                )}

                <button
                    className={styles.botaoCancelar}
                    onClick={() => {
                        // Se obrigação cancelada, não permite cancelar atividades
                        if (obrigacaoCancelada) {
                            toast.error("Obrigação cancelada. Reabra para realizar ações.");
                            return;
                        }

                        const tipo = a.tipoCancelamento?.toLowerCase();
                        if (tipo === "sem cancelamento") {
                            toast.error("Esta atividade não pode ser cancelada.");
                            return;
                        }
                        if (tipo === "com justificativa") {
                            setAtividadeSelecionada(a);
                            setModalJustificativaAberto(true);
                        } else {
                            cancelarAtividade(a.id);
                        }
                    }}
                >
                    <X size={16} color="white" strokeWidth={1.5} />
                </button>
            </div>
        );

    };

    const statusObrigacao = vencimentoDate ? obterStatusObrigacao(vencimentoDate) : "Fora Programado";
    const corDoHeader = obrigacaoConcluida ? "#22c55e" : (coresPorStatus[statusObrigacao] || "#facc15");

    return (
        <>
            <PrincipalSidebar />
            <ToastContainer 
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                limit={3}
            />
            <Head>
                <title>Atividades da Obrigação</title>
                <style jsx>{`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </Head>

            <div className={styles.container}>
                <div
                    className={styles.tituloStatus}
                    style={{
                        backgroundColor: obrigacaoCancelada ? "var(--titan-text-low)" : corDoHeader,
                        borderLeft: `5px solid ${obrigacaoCancelada ? "var(--titan-text-low)" : corDoHeader}`,
                        boxShadow: `inset 0 -1px 0 ${obrigacaoCancelada ? "var(--titan-text-low)" : corDoHeader}`,
                    }}
                >
                                            <h1>
                            Atividades da Obrigação:{" "}
                            {obrigacao.nomeObrigacao || obrigacao.nome}
                            {obrigacaoCancelada && (
                                <span style={{ 
                                    fontSize: "14px", 
                                    fontWeight: "normal", 
                                    marginLeft: "10px",
                                    color: "#475569"
                                }}>
                                    (Cancelada)
                                </span>
                            )}
                        </h1>
                </div>



                <div className={styles.conteudoWrapper}>
                    <div className={styles.gridContainer}>
                        <div className={styles.infoBox}>
                            <div>
                                <div className={styles.itemTitulo}>Ação</div>
                                <div className={styles.itemInfo}>
                                    {formatarData(dataAcao)}
                                </div>
                            </div>
                            <div>
                                <div className={styles.itemTitulo}>Meta</div>
                                <div className={styles.itemInfo}>
                                    {formatarData(dataMeta)}
                                </div>
                            </div>
                            <div>
                                <div className={styles.itemTitulo}>Vencimento</div>
                                <div className={styles.itemInfo}>
                                    {formatarData(obrigacao.vencimento)}
                                </div>
                            </div>
                            <div>
                                <div className={styles.itemTitulo}>Criado em</div>
                                <div className={styles.itemInfo}>
                                    {formatarData(obrigacao.dataCriacao)}
                                </div>
                            </div>
                            <div>
                                <div className={styles.itemTitulo}>Cliente</div>
                                <div className={styles.itemInfo}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                        <button
                                            onClick={() => window.open(`/gestao/clientes/${obrigacao.clienteId}`, '_blank')}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                padding: 0,
                                                margin: 0,
                                                cursor: "pointer",
                                                color: "#2563eb",
                                                fontSize: "inherit",
                                                fontWeight: "inherit",
                                                textAlign: "left",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px"
                                            }}
                                            title="Editar perfil do cliente"
                                        >
                                            <span>{obrigacao.clienteNome}</span>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 0 1 0 2.828l-7 7a2 2 0 0 1-2.828 0l-7-7A1.994 1.994 0 0 1 3 12V7a4 4 0 0 1 4-4z"/>
                                            </svg>
                                        </button>
                                        {obrigacao.clienteCnpjCpf && (
                                            <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: "400" }}>
                                                {formatarCnpjCpf(obrigacao.clienteCnpjCpf)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className={styles.itemTitulo}>Departamento</div>
                                <div className={styles.itemInfo}>
                                    {obrigacao.departamentoNome}
                                </div>
                            </div>
                            <div className={styles.linhaDuasColunas}>
                                <div>
                                    <div className={styles.itemTitulo}>Data Entrega</div>
                                    <div className={styles.itemInfo}>
                                        {formatarData(obrigacao.dataBaixa)}
                                    </div>
                                </div>
                                <div>
                                    <div className={styles.itemTitulo}>Hora Entrega</div>
                                    <div className={styles.itemInfo}>
                                        {formatarHoraBrasilia(obrigacao.dataBaixa)}
                                    </div>
                                </div>
                            </div>
                            {/* ✅ NOVO: Quem concluiu a obrigação */}
                            {obrigacao?.dataBaixa && obrigacao?.concluidoPorNome && (
                                <div>
                                    <div className={styles.itemTitulo}>Concluído por</div>
                                    <div className={styles.itemInfo}>
                                        <div style={{ 
                                            display: 'inline-block',
                                            background: '#e8f5e8', 
                                            color: '#166534',
                                            padding: '4px 8px', 
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: '500',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {obrigacao.concluidoPorNome}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div>
                                <div className={styles.itemTitulo}>Responsável exclusivo</div>
                                <div className={styles.itemInfo}>---</div>
                            </div>
                            <div>
                                <div className={styles.itemTitulo}>Responsáveis</div>
                                <div className={styles.itemInfo}>
                                  {responsaveis.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                                      {responsaveis
                                        // ✅ NOVO: Filtrar duplicatas baseado em usuarioId
                                        .filter((resp, index, array) => 
                                          array.findIndex(r => r.usuarioId === resp.usuarioId) === index
                                        )
                                        .map((resp, idx) => (
                                        <div key={`${resp.usuarioId}-${idx}`} style={{ 
                                          display: 'inline-block',
                                          background: '#e3f2fd', 
                                          color: '#1976d2',
                                          padding: '4px 8px', 
                                          borderRadius: '12px',
                                          fontSize: '12px',
                                          fontWeight: '500',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {resp.nome}{resp.departamentoNome ? ` - ${resp.departamentoNome}` : ""}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span style={{ color: '#9ca3af' }}>Sem responsável</span>
                                  )}
                                </div>
                            </div>
                        </div>

                        <div className={styles.atividadesBox}>
                            <div className={styles.quadroTabelaCompleta}>
                                <div className={styles.atividadesHeader}>
                                    <span>Atividades para realização da Tarefa</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        
                                        {/* ✅ NOVO: Setas de navegação elegantes */}
                                        <div className={styles.navegacaoCompetencias}>
                                            <button
                                                onClick={() => navegarParaObrigacao(obrigacaoAnterior)}
                                                disabled={!obrigacaoAnterior || loadingNavegacao}
                                                className={`${styles.botaoNavegacao} ${!obrigacaoAnterior || loadingNavegacao ? styles.botaoNavegacaoDisabled : ''}`}
                                                title={obrigacaoAnterior ? (() => {
                                                    const freqAnterior = (obrigacaoAnterior.frequencia || '').toLowerCase();
                                                    const isDiariaOuSemanalAnterior = freqAnterior.includes('diário') || freqAnterior.includes('semanal');
                                                    
                                                    if (isDiariaOuSemanalAnterior && obrigacaoAnterior.vencimento) {
                                                        return `Vencimento anterior: ${formatarData(new Date(obrigacaoAnterior.vencimento))}`;
                                                    } else if (obrigacaoAnterior.anoReferencia && obrigacaoAnterior.mesReferencia) {
                                                        return `Competência anterior: ${obrigacaoAnterior.anoReferencia}/${String(obrigacaoAnterior.mesReferencia).padStart(2, '0')}`;
                                                    }
                                                    return "Não há competência anterior";
                                                })() : "Não há competência anterior"}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="m11 17-5-5 5-5"/>
                                                    <path d="m18 17-5-5 5-5"/>
                                                </svg>
                                            </button>
                                            
                                            <span className={styles.competenciaAtual}>
                                                {(() => {
                                                    // ✅ Verificar frequência para determinar se é diária/semanal
                                                    const frequencia = (obrigacao?.frequencia || '').toLowerCase();
                                                    const isDiariaOuSemanal = frequencia.includes('diário') || frequencia.includes('semanal');
                                                    
                                                    if (isDiariaOuSemanal && obrigacao?.vencimento) {
                                                        // Se é diária/semanal, usar vencimento
                                                        const vencimentoDate = new Date(obrigacao.vencimento);
                                                        return formatarData(vencimentoDate);
                                                    } else if (obrigacao?.anoReferencia && obrigacao?.mesReferencia) {
                                                        // Se tem competência, mostrar mês/ano
                                                        const meses = [
                                                            "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
                                                            "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"
                                                        ];
                                                        const ano = obrigacao.anoReferencia || obrigacao.ano_referencia;
                                                        const mes = obrigacao.mesReferencia || obrigacao.mes_referencia;
                                                        const mesIndex = mes - 1;
                                                        if (mesIndex >= 0 && mesIndex < 12) {
                                                            return `${meses[mesIndex]}/${ano}`;
                                                        }
                                                        return `${String(mes).padStart(2, '0')}/${ano}`;
                                                    }
                                                    return "Competência";
                                                })()}
                                            </span>
                                            
                                            <button
                                                onClick={() => navegarParaObrigacao(obrigacaoProxima)}
                                                disabled={!obrigacaoProxima || loadingNavegacao}
                                                className={`${styles.botaoNavegacao} ${!obrigacaoProxima || loadingNavegacao ? styles.botaoNavegacaoDisabled : ''}`}
                                                title={obrigacaoProxima ? (() => {
                                                    const freqProxima = (obrigacaoProxima.frequencia || '').toLowerCase();
                                                    const isDiariaOuSemanalProxima = freqProxima.includes('diário') || freqProxima.includes('semanal');
                                                    
                                                    if (isDiariaOuSemanalProxima && obrigacaoProxima.vencimento) {
                                                        return `Próximo vencimento: ${formatarData(new Date(obrigacaoProxima.vencimento))}`;
                                                    } else if (obrigacaoProxima.anoReferencia && obrigacaoProxima.mesReferencia) {
                                                        return `Próxima competência: ${obrigacaoProxima.anoReferencia}/${String(obrigacaoProxima.mesReferencia).padStart(2, '0')}`;
                                                    }
                                                    return "Não há próxima competência";
                                                })() : "Não há próxima competência"}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="m6 17 5-5-5-5"/>
                                                    <path d="m13 17 5-5-5-5"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.scrollAtividades}>
                                    <div className={styles.tabelaCustom}>
                                        {atividadesList.map((a, i) => (
                                            <div key={a.id} className={styles.tabelaLinha}>
                                                <div className={styles.tabelaCell}>{i + 1}</div>
                                                {/* Ícone de tipo da atividade SEMPRE aparece */}
                                                <div className={styles.tabelaCell}>
                                                    <span
                                                        className={`${styles.tipoIcone} ${
                                                            (a.tipo.toLowerCase().includes("pdf layout") || a.tipo.toLowerCase().includes("pdf-layout")) 
                                                                ? styles.pdfLayout 
                                                                : ""
                                                        }`}
                                                        style={{ 
                                                            cursor: (a.tipo.toLowerCase().includes("anexo") && a.anexo && !obrigacaoCancelada) || 
                                                                   (a.tipo.toLowerCase().includes("pdf layout") && !obrigacaoCancelada) ||
                                                                   (a.tipo.toLowerCase().includes("integração: econtador") && a.anexo && a.concluida && !obrigacaoCancelada) ||
                                                                   (a.tipo.toLowerCase().includes("integração: onvio") && a.anexo && a.concluida && !obrigacaoCancelada) ? 'pointer' : 'default' 
                                                        }}
                                                        onClick={() => {
                                                            if (!obrigacaoCancelada && a.tipo.toLowerCase().includes("anexo") && a.anexo) {
                                                                setAnexosExpandidos(prev => ({
                                                                    ...prev,
                                                                    [a.id]: !prev[a.id]
                                                                }));
                                                            } else if (!obrigacaoCancelada && (a.tipo.toLowerCase().includes("pdf layout") || a.tipo.toLowerCase().includes("pdf-layout"))) {
                                                                validarPdfLayout(a);
                                                            } else if (!obrigacaoCancelada && a.tipo.toLowerCase().includes("integração: econtador") && a.anexo && a.concluida) {
                                                                setAnexosEcontadorExpandidos(prev => ({
                                                                    ...prev,
                                                                    [a.id]: !prev[a.id]
                                                                }));
                                                            } else if (!obrigacaoCancelada && a.tipo.toLowerCase().includes("integração: onvio") && a.anexo && a.concluida) {
                                                                setAnexosEcontadorExpandidos(prev => ({
                                                                    ...prev,
                                                                    [a.id]: !prev[a.id]
                                                                }));
                                                            }
                                                        }}
                                                        title={
                                                            a.tipo.toLowerCase().includes("anexo") && a.anexo && !obrigacaoCancelada ? "Mostrar/ocultar anexo" :
                                                            (a.tipo.toLowerCase().includes("pdf layout") || a.tipo.toLowerCase().includes("pdf-layout")) && !obrigacaoCancelada ? 
                                                            "PDF Layout" :
                                                            a.tipo.toLowerCase().includes("integração: econtador") && a.anexo && a.concluida && !obrigacaoCancelada ? 
                                                            "Mostrar/ocultar documento do eContador" :
                                                            a.tipo.toLowerCase().includes("integração: onvio") && a.anexo && a.concluida && !obrigacaoCancelada ? 
                                                            "Mostrar/ocultar documento do Onvio" : undefined
                                                        }
                                                        dangerouslySetInnerHTML={{
                                                            __html: getIconeAtividade(a.tipo),
                                                        }}
                                                    />
                                                </div>
                                                <div className={`${styles.tabelaCell} ${styles.textoAtividade}`}>
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                            <strong style={{ flex: 1 }}>
                                                                {(() => {
                                                                    const txt = typeof a.texto === "string" ? a.texto.trim() : "";
                                                                    return txt !== "" && txt !== "0" ? a.texto : "---";
                                                                })()}
                                                            </strong>
                                                            {/* Botão de expandir descrição só se não estiver cancelada */}
                                                            {!obrigacaoCancelada && typeof a.descricao === "string" && a.descricao.trim() !== "" && (
                                                                <button
                                                                    onClick={() =>
                                                                        setDescricaoExpandida((prev) => ({ ...prev, [a.id]: !prev[a.id] }))
                                                                    }
                                                                    style={{
                                                                        border: "none",
                                                                        background: "transparent",
                                                                        cursor: "pointer",
                                                                        padding: 0,
                                                                        marginLeft: "auto",
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                    }}

                                                                >
                                                                    {descricaoExpandida[a.id] ? (
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
                                                                            <path d="M7 14l5-5 5 5z" />
                                                                        </svg>
                                                                    ) : (
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
                                                                            <path d="M7 10l5 5 5-5z" />
                                                                        </svg>
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                        {(() => {
                                                            const desc = typeof a.descricao === "string" ? a.descricao.trim() : "";
                                                            return descricaoExpandida[a.id] && desc !== "";
                                                        })() && (
                                                                <span style={{ fontSize: "12px", color: "#475569" }}>{a.descricao}</span>
                                                            )}
                                                        {(() => {
                                                            const j = typeof a.justificativa === "string" ? a.justificativa.trim() : "";
                                                            return a.cancelada && j !== "" && j !== "0";
                                                        })() ? (
                                                            <div style={{ 
                                                                fontSize: "12px", 
                                                                color: "#475569", 
                                                                marginTop: "4px",
                                                                wordWrap: "break-word",
                                                                wordBreak: "break-word",
                                                                whiteSpace: "pre-wrap",
                                                                lineHeight: "1.4"
                                                            }}>
                                                                <strong>Motivo:</strong> {a.justificativa}
                                                            </div>
                                                        ) : null}
                                                        {/* Link de download só se não estiver cancelada */}
                                                        {!obrigacaoCancelada && a.tipo.toLowerCase().includes("anexo") && a.anexo && anexosExpandidos[a.id] && (
                                                            <a
                                                                href={`data:application/octet-stream;base64,${a.anexo}`}
                                                                download={a.nomeArquivo || "anexo.bin"}
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: "4px",
                                                                    color: "#2563eb",
                                                                    fontSize: "11px",
                                                                    marginTop: "6px",
                                                                    textDecoration: "none",
                                                                    cursor: "pointer"
                                                                }}
                                                                title="Baixar anexo"
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                                    <polyline points="7,10 12,15 17,10"/>
                                                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                                                </svg>
                                                                {a.nomeArquivo || "Baixar anexo"}
                                                            </a>
                                                        )}
                                                        
                                                        {/* Link de download do documento do eContador */}
                                                        {!obrigacaoCancelada && a.tipo.toLowerCase().includes("integração: econtador") && a.anexo && a.concluida && anexosEcontadorExpandidos[a.id] && (
                                                            <a
                                                                href={`data:application/pdf;base64,${a.anexo}`}
                                                                download={a.nomeArquivo || "documento_econtador.pdf"}
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: "4px",
                                                                    color: "#e96372",
                                                                    fontSize: "11px",
                                                                    marginTop: "6px",
                                                                    textDecoration: "none",
                                                                    cursor: "pointer"
                                                                }}
                                                                title="Baixar documento do eContador"
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                                    <polyline points="7,10 12,15 17,10"/>
                                                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                                                </svg>
                                                                {a.nomeArquivo || "Baixar documento do eContador"}
                                                            </a>
                                                        )}

                                                        {/* Link de download do documento do Onvio */}
                                                        {!obrigacaoCancelada && a.tipo.toLowerCase().includes("integração: onvio") && a.anexo && a.concluida && anexosEcontadorExpandidos[a.id] && (
                                                            <a
                                                                href={`data:application/pdf;base64,${a.anexo}`}
                                                                download={a.nomeArquivo || "documento_onvio.pdf"}
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: "4px",
                                                                    color: "#3b82f6",
                                                                    fontSize: "11px",
                                                                    marginTop: "6px",
                                                                    textDecoration: "none",
                                                                    cursor: "pointer"
                                                                }}
                                                                title="Baixar documento do Onvio"
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                                    <polyline points="7,10 12,15 17,10"/>
                                                                    <line x1="12" y="15" x2="12" y2="3"/>
                                                                </svg>
                                                                {a.nomeArquivo || "Baixar documento do Onvio"}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Botões de ação só se não estiver cancelada */}
                                                <div className={styles.tabelaCell}>
                                                    {!obrigacaoCancelada && getBotaoAcao(a)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.footerConcluir}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
                                    {/* Informação sobre atividades pendentes */}
                                    {!obrigacao?.dataBaixa && obrigacao?.status !== "cancelada" && atividadesPendentes > 0 && (
                                        <div className={styles.atividadesPendentes}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10"/>
                                                <line x1="12" y1="8" x2="12" y2="12"/>
                                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                                            </svg>
                                            {atividadesPendentes} atividade(s) pendente(s)
                                        </div>
                                    )}
                                    
                                    <div className={styles.botoesAcoesObrigacao}>
                                        {obrigacao?.status === "concluída" ? (
                                            <button
                                                disabled
                                                className={`${styles.botaoAcao} ${styles.botaoFinalizada}`}
                                            >
                                                Finalizada
                                            </button>
                                        ) : obrigacao?.status === "cancelada" ? (
                                            <button
                                                onClick={reabrirObrigacao}
                                                className={`${styles.botaoAcao} ${styles.botaoReabrir}`}
                                            >
                                                Reabrir
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    disabled={!todasAtividadesFinalizadas || obrigacao?.dataBaixa}
                                                    onClick={concluirObrigacao}
                                                    className={`${styles.botaoAcao} ${styles.botaoConcluir} ${(!todasAtividadesFinalizadas || obrigacao?.dataBaixa) ? styles.botaoDesabilitado : ''}`}
                                                    title={!todasAtividadesFinalizadas ? `Complete as ${atividadesPendentes} atividade(s) pendente(s) primeiro` : ""}
                                                >
                                                    {obrigacao?.dataBaixa
                                                        ? "Obrigação Concluída"
                                                        : "Concluir Obrigação"}
                                                </button>
                                                {/* Botão Cancelar só aparece se não estiver concluída */}
                                                {!obrigacao?.dataBaixa && (
                                                    <button
                                                        onClick={cancelarObrigacao}
                                                        className={`${styles.botaoAcao} ${styles.botaoCancelarObrigacao}`}
                                                    >
                                                        Cancelar
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.quadroTabelaCompleta}>
                                <div className={styles.atividadesHeader}>
                                    <span>Comentários e Interações</span>
                                </div>

                                <div style={{ padding: "20px" }}>
                                    <div style={{ display: "flex", gap: "24px" }}>
                                        {/* Sidebar de Abas (Colapsável Total) */}
                                        <div className={styles.sidebarContainer}>
                                            {!sidebarColapsada ? (
                                                <div className={styles.sidebarExpandida}>
                                                    <button
                                                        onClick={() => setSidebarColapsada(true)}
                                                        className={styles.botaoColapsar}
                                                        title="Recolher"
                                                    >
                                                        «
                                                    </button>

                                                    {["usuario", "atendimento", "email", "arquivo", "sistema"].map((aba) => (
                                                        <button
                                                            key={aba}
                                                            onClick={() => setAbaAtiva(aba)}
                                                            className={`${styles.botaoAba} ${abaAtiva === aba ? styles.botaoAbaAtiva : ''}`}
                                                        >
                                                            {aba.charAt(0).toUpperCase() + aba.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setSidebarColapsada(false)}
                                                    className={styles.botaoExpandir}
                                                    title="Expandir"
                                                >
                                                    »
                                                </button>
                                            )}
                                        </div>


                                        {/* Comentários dentro da caixa */}
                                        <div className={styles.quadroTabelaCompleta} style={{ flex: 1, margin: 0 }}>
                                            <div className={styles.atividadesHeader}>
                                                <span>{`Interações - ${abaAtiva.charAt(0).toUpperCase() + abaAtiva.slice(1)}`}</span>
                                            </div>

                                            <div style={{ padding: "20px" }}>
                                                {comentarios.filter(c => (c.tipo || "usuario") === abaAtiva).length === 0 && (
                                                    <p style={{ fontSize: 13, color: "#94a3b8" }}>Nenhum comentário ainda.</p>
                                                )}

                                                <div style={{ maxHeight: "260px", overflowY: "auto", paddingRight: "8px" }}>
                                                    {comentarios
                                                        .filter(c => (c.tipo || "usuario") === abaAtiva)
                                                        .map((c) => {
                                                            const isEmailHtml = c.tipo === "email" && typeof c.comentario === "string" && c.comentario.includes("<b>De:</b>");

                                                            // Remove o corpo do comentário se for tipo email
                                                            const emailSemCorpo = isEmailHtml
                                                                ? c.comentario.replace(/<b>Corpo:<\/b><br\/?>[\s\S]*$/i, "").trim()
                                                                : "";

                                                            return (
                                                                <div
                                                                    key={c.id}
                                                                    className={styles.comentarioItem}
                                                                >
                                                                    <img
                                                                        src={c.avatar || "/default-avatar.png"}
                                        alt={c.autor}
                                        className={styles.avatarComentario}
                                                                    />
                                                                    <div className={styles.conteudoComentario}>
                                                                        <div className={styles.autor}>{c.autor}</div>
                                                                        <div className={styles.data}>
                                                                            {`${formatarData(c.criadoEm)} ${formatarHoraBrasilia(c.criadoEm)}`}
                                                                        </div>

                                                                        {isEmailHtml ? (
                                                                            <div className={styles.emailComentario}>
                                                                                {/* Ícone de abrir/fechar */}
                                                                                <button
                                                                                    onClick={() =>
                                                                                        setDescricaoExpandida((prev) => ({ ...prev, [c.id]: !prev[c.id] }))
                                                                                    }
                                                                                    className={styles.botaoExpandirEmail}
                                                                                    title={descricaoExpandida[c.id] ? "Ocultar detalhes" : "Ver detalhes"}
                                                                                >
                                                                                    <Mail size={16} />
                                                                                </button>

                                                                                {/* Conteúdo colapsável */}
                                                                                <div
                                                                                    className={styles.emailHeader}
                                                                                    dangerouslySetInnerHTML={{
                                                                                        __html: c.comentario.replace(/<b>Corpo:<\/b><br\/?>[\s\S]*$/i, "").trim()
                                                                                    }}
                                                                                />

                                                                                {descricaoExpandida[c.id] && (
                                                                                    <div
                                                                                        className={styles.emailCorpo}
                                                                                        dangerouslySetInnerHTML={{
                                                                                            __html: c.comentario.match(/<b>Corpo:<\/b><br\/?>[\s\S]*$/i)?.[0] || ""
                                                                                        }}
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <div className={styles.conteudo}
                                                                                dangerouslySetInnerHTML={{ __html: renderComentarioAmigavel(c.comentario) }}
                                                                            />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                </div>



                                                <div className={styles.caixaComentario}>
                                                    <textarea
                                                        placeholder="Escreva um comentário..."
                                                        value={comentarioTexto}
                                                        onChange={(e) => setComentarioTexto(e.target.value)}
                                                    />
                                                    <div style={{ display: "flex", gap: "8px" }}>
                                                        <button
                                                            onClick={async () => {
                                                                if (!comentarioTexto.trim()) return;
                                                                const token = getToken();
                                                                try {
                                                                    await api.post(
                                                                        `/gestao/obrigacoes/${id}/comentario`,
                                                                        { comentario: comentarioTexto, tipo: abaAtiva },
                                                                        { headers: { Authorization: `Bearer ${token}` } }
                                                                    );
                                                                    setComentarioTexto("");
                                                                    await carregarComentarios();
                                                                    toast.success("Comentário enviado!");
                                                                } catch (err) {
                                                                    console.error("Erro ao enviar comentário:", err);
                                                                    toast.error("Erro ao enviar comentário.");
                                                                }
                                                            }}
                                                            style={{
                                                                padding: "8px 16px",
                                                                background: "#2563eb",
                                                                color: "white",
                                                                border: "none",
                                                                borderRadius: "6px",
                                                                fontSize: "13px",
                                                                cursor: "pointer"
                                                            }}
                                                        >
                                                            Enviar
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEmailAssunto(`${obrigacao?.clienteNome || 'Cliente'} - ${obrigacao?.nomeObrigacao || obrigacao?.nome || 'Obrigação'}`);
                                                                setEmailCorpo("");
                                                                setEmailModalAberto(true);
                                                            }}
                                                            style={{
                                                                padding: "8px 16px",
                                                                background: "#3b82f6",
                                                                color: "white",
                                                                border: "none",
                                                                borderRadius: "6px",
                                                                fontSize: "13px",
                                                                cursor: "pointer",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: "6px"
                                                            }}
                                                            title="Enviar email para o cliente"
                                                        >
                                                            <Mail size={14} />
                                                            Enviar Email
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {modalUploadAberto && atividadeSelecionada && !obrigacaoCancelada && (
                <div
                    style={{
                        position: "fixed",
                        top: 0, left: 0,
                        width: "100%", height: "100%",
                        background: typeof document !== "undefined" &&
                            document.documentElement.getAttribute("data-theme") === "light"
                            ? "rgba(255,255,255,0.55)"
                            : "rgba(0,0,0,0.5)",
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
                            background: typeof document !== "undefined" &&
                                document.documentElement.getAttribute("data-theme") === "light"
                                ? "#ffffff"
                                : "rgba(11, 11, 17, 0.6)",
                            padding: "var(--titan-spacing-lg)",
                            borderRadius: "var(--titan-radius-lg)",
                            width: "400px",
                            boxShadow: typeof document !== "undefined" &&
                                document.documentElement.getAttribute("data-theme") === "light"
                                ? "var(--titan-shadow-md)"
                                : "var(--titan-shadow-lg)",
                            border: typeof document !== "undefined" &&
                                document.documentElement.getAttribute("data-theme") === "light"
                                ? "1px solid var(--titan-stroke)"
                                : "1px solid rgba(255, 255, 255, 0.1)"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{ 
                            fontSize: "var(--titan-font-size-xl)", 
                            marginBottom: "var(--titan-spacing-lg)", 
                            color: "var(--titan-text-high)",
                            fontWeight: "var(--titan-font-weight-semibold)",
                            margin: 0
                        }}>
                            Anexando Arquivo
                        </h2>

                        <div style={{
                            border: `2px dashed ${typeof document !== "undefined" &&
                                document.documentElement.getAttribute("data-theme") === "light"
                                ? "#cbd5e1"
                                : "rgba(255, 255, 255, 0.2)"}`,
                            padding: "var(--titan-spacing-lg)",
                            borderRadius: "var(--titan-radius-md)",
                            textAlign: "center",
                            marginBottom: "var(--titan-spacing-lg)",
                            cursor: "pointer",
                            background: typeof document !== "undefined" &&
                                document.documentElement.getAttribute("data-theme") === "light"
                                ? "var(--titan-base-10)"
                                : "rgba(255, 255, 255, 0.05)",
                            transition: "all var(--titan-transition-fast)"
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "var(--titan-primary)";
                            e.currentTarget.style.background = typeof document !== "undefined" &&
                                document.documentElement.getAttribute("data-theme") === "light"
                                ? "var(--titan-base-20)"
                                : "rgba(255, 255, 255, 0.08)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = typeof document !== "undefined" &&
                                document.documentElement.getAttribute("data-theme") === "light"
                                ? "#cbd5e1"
                                : "rgba(255, 255, 255, 0.2)";
                            e.currentTarget.style.background = typeof document !== "undefined" &&
                                document.documentElement.getAttribute("data-theme") === "light"
                                ? "var(--titan-base-10)"
                                : "rgba(255, 255, 255, 0.05)";
                        }}>
                            <Upload size={28} color="var(--titan-text-med)" />
                            <p style={{ 
                                fontSize: "var(--titan-font-size-sm)", 
                                color: "var(--titan-text-med)", 
                                marginTop: "var(--titan-spacing-sm)" 
                            }}>
                                Selecione um arquivo
                            </p>
                            <input
                                type="file"
                                style={{ 
                                    marginTop: "var(--titan-spacing-sm)",
                                    color: "var(--titan-text-high)"
                                }}
                                onChange={(e) => setArquivoSelecionado(e.target.files?.[0] || null)}
                            />
                        </div>

                        <div style={{ 
                            display: "flex", 
                            justifyContent: "flex-end", 
                            gap: "var(--titan-spacing-sm)" 
                        }}>
                            <button
                                onClick={() => setModalUploadAberto(false)}
                                style={{
                                    padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                                    background: typeof document !== "undefined" &&
                                        document.documentElement.getAttribute("data-theme") === "light"
                                        ? "var(--titan-card-bg)"
                                        : "rgba(255, 255, 255, 0.15)",
                                    borderRadius: "var(--titan-radius-sm)",
                                    fontSize: "var(--titan-font-size-sm)",
                                    fontWeight: "var(--titan-font-weight-medium)",
                                    border: typeof document !== "undefined" &&
                                        document.documentElement.getAttribute("data-theme") === "light"
                                        ? "1px solid var(--titan-stroke)"
                                        : "1px solid rgba(255, 255, 255, 0.2)",
                                    color: "var(--titan-text-high)",
                                    cursor: "pointer",
                                    transition: "all var(--titan-transition-fast)"
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "var(--titan-input-bg)";
                                    e.currentTarget.style.borderColor = "var(--titan-primary)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = typeof document !== "undefined" &&
                                        document.documentElement.getAttribute("data-theme") === "light"
                                        ? "var(--titan-card-bg)"
                                        : "rgba(255, 255, 255, 0.15)";
                                    e.currentTarget.style.borderColor = typeof document !== "undefined" &&
                                        document.documentElement.getAttribute("data-theme") === "light"
                                        ? "var(--titan-stroke)"
                                        : "rgba(255, 255, 255, 0.2)";
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    if (!arquivoSelecionado || !atividadeSelecionada) return;
                                    const reader = new FileReader();
                                    reader.onloadend = async () => {
                                        const base64 = reader.result?.toString().split(',')[1];
                                        const token = getToken();
                                        try {
                                            // ⬇⬇⬇ Adapte os endpoints para OBRIGAÇÕES
                                            await api.patch(
                                                `/gestao/obrigacoes/atividade/${atividadeSelecionada.id}/anexo`,
                                                { base64, nomeArquivo: arquivoSelecionado.name },
                                                { headers: { Authorization: `Bearer ${token}` } }
                                            );

                                            await api.patch(
                                                `/gestao/obrigacoes/atividade/${atividadeSelecionada.id}/concluir`,
                                                {},
                                                { headers: { Authorization: `Bearer ${token}` } }
                                            );

                                            // ✅ Usar carregarDados em vez de router.reload()
                                            await carregarDados();
                                        } catch (err) {
                                            toast.error("❌ Erro ao salvar anexo.");
                                        }
                                    };
                                    reader.readAsDataURL(arquivoSelecionado);
                                }}
                                style={{
                                    padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                                    background: "var(--titan-primary)",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "var(--titan-radius-sm)",
                                    fontSize: "var(--titan-font-size-sm)",
                                    fontWeight: "var(--titan-font-weight-medium)",
                                    cursor: "pointer",
                                    transition: "all var(--titan-transition-fast)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "var(--titan-spacing-xs)"
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "var(--titan-primary-hover)";
                                    e.currentTarget.style.transform = "scale(1.02)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "var(--titan-primary)";
                                    e.currentTarget.style.transform = "scale(1)";
                                }}
                            >
                                <Paperclip size={16} />
                                Anexar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalJustificativaAberto && atividadeSelecionada && !obrigacaoCancelada && (
                <div style={{
                    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                    background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
                }}
                    onClick={() => setModalJustificativaAberto(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ background: "#fff", padding: 24, borderRadius: 10, width: 420, boxShadow: "0 2px 10px rgba(0,0,0,0.2)" }}
                    >
                        <h2 style={{ fontSize: 16, marginBottom: 12, color: "#1e293b" }}>
                            Justificativa para Cancelamento
                        </h2>
                        <textarea
                            rows={4}
                            placeholder="Descreva o motivo do cancelamento..."
                            value={justificativa}
                            onChange={(e) => setJustificativa(e.target.value)}
                            style={{
                                width: "100%", borderRadius: 6, border: "1px solid #cbd5e1", padding: 10,
                                fontSize: 13, resize: "none", marginBottom: 16
                            }}
                        />
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                            <button
                                onClick={() => setModalJustificativaAberto(false)}
                                style={{ padding: "6px 12px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={enviarJustificativa}
                                style={{ padding: "6px 12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, fontSize: 13 }}
                            >
                                Enviar
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {!obrigacaoCancelada && emailModalAberto && (
                <EmailModal
                    isOpen={emailModalAberto}
                    onClose={() => setEmailModalAberto(false)}
                    assuntoPadrao={emailAssunto}
                    corpoPadrao={emailCorpo}
                    processoId={typeof id === "string" ? id : id?.[0]}
                    atividadeId={atividadeSelecionada?.id}
                    tipo="obrigacao"
                onSend={async ({ para, cc, co, assunto, corpo, anexo }) => {
                    const token = getToken();
                    try {
                        const formData = new FormData();
                        formData.append("para", para);
                        formData.append("cc", cc);
                        formData.append("co", co);
                        formData.append("assunto", assunto);
                        formData.append("corpo", corpo);
                        // ✅ Extrair email do usuário do sessionStorage
                        const userObj = getUserFromStorage();
                        let nomeUsuario = userObj?.nome || "Titan App";
                        let emailUsuario = userObj?.email || "";
                        const empresaIdUser = userObj?.EmpresaId || userObj?.empresa?.id || null;
                        if (!emailUsuario) console.warn("[AtividadesObrigacao] userData.email ausente no localStorage");
                        
                        formData.append("nomeUsuario", nomeUsuario);
                        formData.append("emailUsuario", emailUsuario);

                        formData.append("obrigacaoId", String(id)); // ✅ CERTO
                        if (empresaIdUser) formData.append("empresaId", String(empresaIdUser));

                        if (anexo && anexo.length > 0) {
                            anexo.forEach((file) => {
                                formData.append("anexo", file);
                            });
                        }

                        await api.post("/gestao/email/enviar", formData, {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                "Content-Type": "multipart/form-data",
                            },
                        });

                        if (atividadeSelecionada) {
                            await api.patch(
                                `/gestao/obrigacoes/atividade/${atividadeSelecionada.id}/concluir`,
                                {},
                                {
                                    headers: { Authorization: `Bearer ${token}` },
                                }
                            );
                        }

                        toast.success("E-mail enviado com sucesso!");
                        setEmailModalAberto(false);
                        // ✅ Usar carregarDados em vez de router.reload()
                        await carregarDados();
                    } catch (err) {
                        console.error("Erro ao enviar e-mail:", err);
                        toast.error("Erro ao enviar e-mail.");
                    }
                }}
            />
            )}

            {/* Modal de Validação PDF Layout */}
            {modalPdfValidationAberto && (
                <div style={{
                    position: "fixed",
                    top: 0, left: 0,
                    width: "100%", height: "100%",
                    background: "rgba(0,0,0,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000
                }}
                    onClick={() => setModalPdfValidationAberto(false)}
                >
                    <div
                        style={{
                            background: "white",
                            padding: "30px",
                            borderRadius: "10px",
                            width: "500px",
                            maxWidth: "90%",
                            boxShadow: "0 2px 10px rgba(0,0,0,0.2)"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1976d2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                                <polyline points="10 9 9 9 8 9"/>
                            </svg>
                            <h2 style={{ fontSize: "18px", margin: 0, color: "#1e293b" }}>
                                Validação PDF Layout
                            </h2>
                        </div>

                        {validandoPdf ? (
                            <div style={{ textAlign: "center", padding: "40px" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "12px" }}>
                                    <div
                                        style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: "50%",
                                            border: "2px solid #1976D2",
                                            borderTop: "2px solid transparent",
                                            animation: "spin 1s linear infinite",
                                        }}
                                    />
                                    Validando processamento do PDF...
                                </div>
                            </div>
                        ) : pdfValidationResult ? (
                            <div>
                                <div style={{ marginBottom: "20px" }}>
                                    <h3 style={{ fontSize: "16px", marginBottom: "12px", color: "#374151" }}>
                                        Informações da Validação
                                    </h3>
                                    <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "8px", fontSize: "14px" }}>
                                        <div style={{ marginBottom: "8px" }}>
                                            <strong>Cliente:</strong> {obrigacao?.clienteNome}
                                        </div>
                                        <div style={{ marginBottom: "8px" }}>
                                            <strong>CNPJ/CPF:</strong> {formatarCnpjCpf(obrigacao?.clienteCnpjCpf)}
                                        </div>
                                        <div style={{ marginBottom: "8px" }}>
                                            <strong>Competência:</strong> {obrigacao?.vencimento ? new Date(obrigacao.vencimento).toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit' }) : 'N/A'}
                                        </div>
                                        <div>
                                            <strong>Obrigação:</strong> {obrigacao?.nomeObrigacao || obrigacao?.nome}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ 
                                    background: pdfValidationResult.processado ? "#f0fdf4" : "#fef2f2", 
                                    border: `1px solid ${pdfValidationResult.processado ? "#bbf7d0" : "#fecaca"}`, 
                                    borderRadius: "8px", 
                                    padding: "16px",
                                    marginBottom: "20px"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                        {pdfValidationResult.processado ? (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                                                <path d="M9 12l2 2 4-4"/>
                                                <circle cx="12" cy="12" r="10"/>
                                            </svg>
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10"/>
                                                <line x1="15" y1="9" x2="9" y2="15"/>
                                                <line x1="9" y1="9" x2="15" y2="15"/>
                                            </svg>
                                        )}
                                        <strong style={{ color: pdfValidationResult.processado ? "#166534" : "#991b1b" }}>
                                            {pdfValidationResult.processado ? "Processado" : "Não Processado"}
                                        </strong>
                                    </div>
                                    <p style={{ 
                                        margin: 0, 
                                        fontSize: "14px", 
                                        color: pdfValidationResult.processado ? "#166534" : "#991b1b" 
                                    }}>
                                        {pdfValidationResult.processado 
                                            ? "O arquivo foi processado no PDF Layout e pode ser concluído automaticamente."
                                            : "O arquivo ainda não foi processado no PDF Layout. Processe primeiro antes de concluir a atividade."
                                        }
                                    </p>
                                </div>

                                {pdfValidationResult.erro && (
                                    <div style={{ 
                                        background: "#fef2f2", 
                                        border: "1px solid #fecaca", 
                                        borderRadius: "8px", 
                                        padding: "12px",
                                        marginBottom: "16px"
                                    }}>
                                        <p style={{ margin: 0, fontSize: "13px", color: "#991b1b" }}>
                                            <strong>Erro:</strong> {pdfValidationResult.erro}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : null}

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                            <button
                                onClick={() => setModalPdfValidationAberto(false)}
                                style={{
                                    padding: "8px 16px",
                                    background: "#f3f4f6",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    border: "1px solid #e5e7eb",
                                    color: "#374151",
                                    cursor: "pointer"
                                }}
                            >
                                Fechar
                            </button>
                            {pdfValidationResult?.processado && (
                                <button
                                    onClick={async () => {
                                        if (atividadeSelecionada) {
                                            await concluirAtividade(atividadeSelecionada.id, atividadeSelecionada.tipo);
                                            setModalPdfValidationAberto(false);
                                        }
                                    }}
                                    style={{
                                        padding: "8px 16px",
                                        background: "#22c55e",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "6px",
                                        fontSize: "14px",
                                        cursor: "pointer"
                                    }}
                                >
                                    Concluir Atividade
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
