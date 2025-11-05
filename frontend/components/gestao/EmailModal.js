// @ts-nocheck
"use client";

import React, { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
// API wrapper local com fetch (evita dependência de utils)
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const normalizeUrl = (u) => `${BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
const resolveToken = () => {
  try { return localStorage.getItem('token') || sessionStorage.getItem('token') || null; } catch { return null; }
};
const api = {
  async get(url, opts = {}) {
    const res = await fetch(normalizeUrl(url), { ...(opts || {}) });
    if (opts && opts.responseType === 'blob') {
      const data = await res.blob();
      return { data };
    }
    const data = await res.json();
    return { data };
  },
  async post(url, body, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    const isFormData = (typeof FormData !== 'undefined') && body instanceof FormData;
    const payload = isFormData ? body : JSON.stringify(body ?? {});
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const res = await fetch(normalizeUrl(url), { method: 'POST', headers, body: payload });
    const data = await res.json().catch(() => ({}));
    return { data };
  },
  async patch(url, body, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const res = await fetch(normalizeUrl(url), { method: 'PATCH', headers, body: JSON.stringify(body ?? {}) });
    const data = await res.json().catch(() => ({}));
    return { data };
  }
};
import Select from "react-select/creatable";
import { components } from "react-select";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Paperclip } from "lucide-react";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import styles from "../../styles/gestao/EmailModal.module.css";


const customSelectComponents = {
  DropdownIndicator: () => null,
  ClearIndicator: () => null,
  IndicatorSeparator: () => null,
  NoOptionsMessage: () => null,
  MultiValueLabel: ({ data }) => (
    <span style={{ color: '#E6E9F0' }}>{data.nome || data.label}</span>
  ),
};

const createOption = (value) => ({ label: value, value });
export default function EmailModal({
  isOpen,
  onClose,
  onSend,
  assuntoPadrao = "",
  corpoPadrao = "",
  processoId,
  atividadeId,
  tipo = "processo",
}) {

  const [paraCliente, setParaCliente] = useState("");
  const [paraFuncionario, setParaFuncionario] = useState([]);
  const [cc, setCc] = useState("");
  const [co, setCo] = useState("");
  const [assunto, setAssunto] = useState("");
  const [anexo, setAnexo] = useState([]);
  const [nomeUsuario, setNomeUsuario] = useState("Usuário");
  const [empresa, setEmpresa] = useState("Empresa");
  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [template, setTemplate] = useState(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [anexosAtividades, setAnexosAtividades] = useState([]);
  const [loadingAnexos, setLoadingAnexos] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const clienteOptions = Array.isArray(clientes) ? clientes.map((c) => ({ value: c.email, label: `${c.nome} - ${c.email}` })) : [];
  const funcionarioOptions = Array.isArray(usuarios) ? usuarios.map((u) => ({ 
    value: u.email, 
    label: `${u.nome} - ${u.email}`,
    nome: u.nome 
  })) : [];
  const empresaId = typeof window !== "undefined"
    ? (sessionStorage.getItem("empresaId") || (() => {
        try {
          const raw = localStorage.getItem('userData') || sessionStorage.getItem('userData') || sessionStorage.getItem('usuario');
          const user = raw ? JSON.parse(raw) : null;
          return user?.EmpresaId ? String(user.EmpresaId) : null;
        } catch { return null; }
      })())
    : null;

  // Função para converter anexo base64 em File
  const converterAnexoBase64ParaFile = async (anexo) => {
    const base64Data = anexo?.base64;
    const nomeArquivo = anexo?.nome_arquivo || anexo?.nomeArquivo || 'arquivo';

    try {
      if (base64Data && typeof base64Data === 'string') {
        const response = await fetch(`data:application/octet-stream;base64,${base64Data}`);
        const blob = await response.blob();
        return new File([blob], nomeArquivo, { type: blob.type || 'application/octet-stream' });
      }

      // Fallback: quando o anexo vem como BLOB no backend e temos apenas o id
      if (anexo?.id) {
        const token = resolveToken();
        const { data: blob } = await api.get(`/gestao/tarefas/anexo/${anexo.id}/download`, {
          responseType: 'blob',
          headers: { Authorization: `Bearer ${token}` }
        });
        return new File([blob], nomeArquivo, { type: blob.type || 'application/octet-stream' });
      }
    } catch (e) {
      console.warn('[EmailModal] Falha ao obter blob/base64 do anexo', { nomeArquivo, id: anexo?.id, error: String(e) });
    }

    console.warn('[EmailModal] Anexo inválido, ignorando', { nomeArquivo, id: anexo?.id });
    return null;
  };

  // Função para carregar anexos das atividades da tarefa ou obrigação
  const carregarAnexosAtividades = async () => {
    if (!processoId) {
      return;
    }
    
    setLoadingAnexos(true);
    try {
      const token = resolveToken();
      
      if (tipo === "processo") {
        // Buscar todas as atividades da tarefa
        const atividadesResponse = await api.get(`/gestao/tarefas/${processoId}/atividades-com-status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const atividades = atividadesResponse.data;
        
        // Para cada atividade, buscar os anexos
        const anexosPromises = atividades.map(async (atividade) => {
          if (atividade.tipo === "Anexos sem validação") {
            try {
              const anexosResponse = await api.get(`/gestao/tarefas/atividade/${atividade.atividadeTarefaId}/anexos`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              
              const anexos = anexosResponse.data || [];
              
              // Adicionar informações da atividade aos anexos
              return anexos.map((anexo) => ({
                ...anexo,
                atividadeTexto: atividade.texto,
                atividadeTarefaId: atividade.atividadeTarefaId,
                atividadeOrdem: atividade.ordem
              }));
            } catch (error) {
              console.error(`Erro ao buscar anexos da atividade ${atividade.atividadeTarefaId}:`, error);
              return [];
            }
          }
          return [];
        });
        
        const anexosArrays = await Promise.all(anexosPromises);
        const todosAnexos = anexosArrays.flat();
        
        setAnexosAtividades(todosAnexos);
        
        // Automatically add all activity attachments to email attachments
        if (todosAnexos.length > 0) {
          try {
            const filesPromises = todosAnexos.map((anexo) => converterAnexoBase64ParaFile(anexo));
            const results = await Promise.all(filesPromises);
            const files = results.filter(Boolean);
            setAnexo(files);
          } catch (error) {
            console.error("Erro ao converter anexos para File objects:", error);
          }
        }
        
      } else if (tipo === "obrigacao") {
        // Para obrigações, buscar anexos da tabela obrigacoes_atividades_clientes
        console.log("🔍 [EmailModal] Carregando anexos de obrigação para processoId:", processoId);
        
        const atividadesResponse = await api.get(`/gestao/obrigacoes/atividades-cliente/${processoId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const atividades = atividadesResponse.data || [];
        console.log("🔍 [EmailModal] Atividades da obrigação encontradas:", atividades);
        
        // Filtrar apenas atividades que têm anexos (anexo não é null e nomeArquivo não é null)
        const atividadesComAnexos = atividades.filter((atividade) => 
          atividade.anexo && atividade.nomeArquivo
        );
        
        console.log("🔍 [EmailModal] Atividades com anexos:", atividadesComAnexos);
        
        // Converter anexos para o formato esperado
        const anexos = atividadesComAnexos.map((atividade) => ({
          base64: atividade.anexo,
          nome_arquivo: atividade.nomeArquivo,
          nomeArquivo: atividade.nomeArquivo,
          atividadeTexto: atividade.texto,
          atividadeId: atividade.id,
          atividadeOrdem: atividade.ordem,
          tipo: atividade.tipo
        }));
        
        console.log("🔍 [EmailModal] Anexos processados:", anexos);
        
        setAnexosAtividades(anexos);
        
        // Automatically add all activity attachments to email attachments
        if (anexos.length > 0) {
          try {
            const filesPromises = anexos.map((anexo) => converterAnexoBase64ParaFile(anexo));
            const files = await Promise.all(filesPromises);
            setAnexo(files);
            console.log("✅ [EmailModal] Anexos adicionados automaticamente:", files.length);
          } catch (error) {
            console.error("Erro ao converter anexos para File objects:", error);
          }
        }
      }
      
    } catch (error) {
      console.error("Erro ao carregar anexos das atividades:", error);
      setAnexosAtividades([]);
    } finally {
      setLoadingAnexos(false);
    }
  };

  // Função para carregar template da atividade
  const carregarTemplate = async () => {
    console.log("🔍 [EmailModal] carregarTemplate iniciado");
    console.log("🔍 [EmailModal] atividadeId:", atividadeId);
    console.log("🔍 [EmailModal] empresaId:", empresaId);
    console.log("🔍 [EmailModal] tipo:", tipo);
    
    if (!atividadeId || !empresaId) {
      console.log("❌ [EmailModal] Falta atividadeId ou empresaId");
      return;
    }
    
    setLoadingTemplate(true);
    try {
      const token = resolveToken();
      
      if (tipo === "processo") {
        // Para processos, o atividadeId que recebemos é o atividadeTarefaId (ID da tabela atividades_tarefas)
        // Precisamos buscar o atividadeId real (ID da tabela atividades_processo) através da tabela atividades_tarefas
        
        // Buscar a atividade da tarefa para obter o atividadeId real
        const atividadesTarefaResponse = await api.get(`/gestao/tarefas/${processoId}/atividades-com-status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const atividadesTarefa = atividadesTarefaResponse.data;
        
        // Encontrar a atividade que corresponde ao atividadeTarefaId recebido
        const atividadeCorrespondente = atividadesTarefa.find((atv) => atv.atividadeTarefaId === atividadeId);
        
        if (!atividadeCorrespondente) {
          setTemplate(null);
          return;
        }
        
        const atividadeBaseId = atividadeCorrespondente.atividadeId;
        
        // Agora buscar o template usando o atividadeId correto
        const url = `/gestao/processos/email-template/${atividadeBaseId}`;
        
        const response = await api.get(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        
        // Verificar se o template tem conteúdo real (não apenas campos vazios)
        const hasContent = response.data && (
          (response.data.assunto && response.data.assunto.trim() !== '') ||
          (response.data.corpo && response.data.corpo.trim() !== '') ||
          (response.data.destinatario && response.data.destinatario.trim() !== '')
        );
        
        if (hasContent) {
          setTemplate(response.data);
        } else {
          setTemplate(null);
        }
        
      } else {
        // Para obrigações, usar o fluxo original
        const url = `/gestao/obrigacoes/atividades/${atividadeId}/email-template`;
        console.log("🔍 [EmailModal] Buscando template em:", url);
        
        const response = await api.get(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("🔍 [EmailModal] Resposta da API:", response.data);
        
        // Verificar se o template tem conteúdo real (não apenas campos vazios)
        const hasContent = response.data && (
          (response.data.assunto && response.data.assunto.trim() !== '') ||
          (response.data.corpo && response.data.corpo.trim() !== '') ||
          (response.data.destinatario && response.data.destinatario.trim() !== '')
        );
        
        console.log("🔍 [EmailModal] Template tem conteúdo:", hasContent);
        
        if (hasContent) {
          console.log("✅ [EmailModal] Template carregado com sucesso");
          setTemplate(response.data);
        } else {
          console.log("❌ [EmailModal] Template vazio ou sem conteúdo");
          setTemplate(null);
        }
      }
    } catch (error) {
      console.error("❌ [EmailModal] Erro ao carregar template:", error);
      console.error("❌ [EmailModal] Status:", error.response?.status);
      console.error("❌ [EmailModal] Dados do erro:", error.response?.data);
      setTemplate(null);
    } finally {
      setLoadingTemplate(false);
    }
  };

  useEffect(() => {
    if (empresaId) {
      const token = resolveToken();
      api.get(`/gestao/clientes?empresaId=${empresaId}`, { headers: { Authorization: `Bearer ${token}` } }).then((res) => setClientes(Array.isArray(res.data?.clientes) ? res.data.clientes : []));
      api.get(`/usuarios`, { headers: { Authorization: `Bearer ${token}` } }).then((res) => setUsuarios(Array.isArray(res.data) ? res.data : []));
    }
  }, [empresaId]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Bold,
      Italic,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Digite o corpo do e-mail aqui..." }),
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: true }),
    ],
    content: "",
    editable: true, // ✅ Sempre editável
    immediatelyRender: false, // ✅ Resolve erro de SSR
  });

  useEffect(() => {
    if (editor) {
      setEditorReady(true);
      
      if (editor.isEmpty) {
        editor.commands.setContent("<p><br></p>");
      }
    }
  }, [editor]);

  // Carregar template e anexos quando modal abrir
  useEffect(() => {
    if (isOpen && atividadeId) {
      // Limpar template anterior antes de carregar novo
      setTemplate(null);
      setAssunto("");
      setParaCliente("");
      setParaFuncionario([]);
      setCc("");
      setCo("");
      setAnexosAtividades([]);
      if (editor) {
        editor.commands.setContent("");
      }
      carregarTemplate();
      carregarAnexosAtividades();
    }
  }, [isOpen, atividadeId]);

  // Limpar tudo quando modal fechar
  useEffect(() => {
    if (!isOpen) {
      setTemplate(null);
      setAssunto("");
      setParaCliente("");
      setParaFuncionario([]);
      setCc("");
      setCo("");
      setAnexosAtividades([]);
      setEnviando(false); // ✅ Resetar estado de envio
      if (editor) {
        editor.commands.setContent("");
      }
    }
  }, [isOpen, editor]);

  // ✅ Garantir que o editor receba foco quando o modal abrir
  useEffect(() => {
    if (isOpen && editor && editorReady) {
      // Pequeno delay para garantir que o DOM esteja pronto
      setTimeout(() => {
        editor.commands.focus();
      }, 100);
    }
  }, [isOpen, editor, editorReady]);

  // Função para substituir variáveis no texto
  const substituirVariaveis = async (texto, atividadeId) => {
    if (!texto) return texto;
    
    
    let resultado = texto;
    
    // Buscar dados da obrigação/processo se tivermos atividadeId
    let dadosObrigacao = null;
    let dadosProcesso = null;
    if (atividadeId && processoId) {
      try {
      const token = resolveToken();
        if (tipo === "processo") {
          // Para processo, usamos os dados da tarefa/processo
          const resProc = await api.get(`/gestao/tarefas/${processoId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          dadosProcesso = resProc.data;
        } else {
          // Obrigação: usa cadeia atual
          const res = await api.get(`/gestao/obrigacoes/atividades-cliente/${processoId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.data?.[0]) {
            const obrigacaoClienteId = res.data[0].obrigacaoClienteId;
            const obrigacaoRes = await api.get(`/gestao/obrigacoes/cliente-obrigacao/${obrigacaoClienteId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            dadosObrigacao = obrigacaoRes.data;
            console.log("🔍 [FRONTEND] Dados da obrigação:", JSON.stringify(dadosObrigacao, null, 2));
          }
        }
      } catch (error) {
        console.error("🔍 [FRONTEND] Erro ao buscar dados:", error);
      }
    }
    
    // Substituir variáveis comuns
    const variaveis = {
      // Comuns
      '[empresa.nome]': empresa || 'Empresa',
      '[empresa.razaoSocial]': empresa || 'Empresa',
      '[datas.hoje]': new Date().toLocaleDateString('pt-BR'),
      
      // Cliente (prioriza fonte disponível)
      '[cliente.nome]': dadosObrigacao?.clienteNome || dadosProcesso?.cliente?.nome || clientes.find(c => c.email === template?.destinatario)?.nome || 'Cliente',
      '[cliente.email]': dadosObrigacao?.clienteEmail || dadosProcesso?.cliente?.email || template?.destinatario || '',
      '[cliente.cnpjCpf]': dadosObrigacao?.clienteCnpj || dadosProcesso?.cliente?.cnpjCpf || '',
      
      // Obrigação
      '[obrigacao.nome]': dadosObrigacao?.nomeObrigacao || template?.assunto?.split(' - ')[2] || 'Obrigação',
      '[datas.vencimento]': dadosObrigacao?.vencimento ? new Date(dadosObrigacao.vencimento).toLocaleDateString('pt-BR') : '',
      '[tarefa.competencia]': dadosObrigacao ? `${String(dadosObrigacao.mes_referencia || '').padStart(2, '0')}/${dadosObrigacao.ano_referencia || ''}` : '',
      '[tarefa.vencimento]': dadosObrigacao?.vencimento ? new Date(dadosObrigacao.vencimento).toLocaleDateString('pt-BR') : '',
      
      // Processo
      '[processo.nome]': dadosProcesso?.assunto || '',
      '[processo.departamento]': dadosProcesso?.departamentoId ? String(dadosProcesso.departamentoId) : '',
      '[processo.responsavel]': dadosProcesso?.responsavel?.nome || '',
      '[processo.responsavel.email]': dadosProcesso?.responsavel?.email || '',
      '[processo.diasMeta]': dadosProcesso?.dataMeta ? '' + Math.max(0, Math.ceil((new Date(dadosProcesso.dataMeta).getTime() - new Date(dadosProcesso.criadoEm).getTime())/86400000)) : '',
      '[processo.diasPrazo]': dadosProcesso?.dataPrazo ? '' + Math.max(0, Math.ceil((new Date(dadosProcesso.dataPrazo).getTime() - new Date(dadosProcesso.criadoEm).getTime())/86400000)) : '',
      '[processo.dataReferencia]': dadosProcesso?.dataAcao ? new Date(dadosProcesso.dataAcao).toLocaleDateString('pt-BR') : '',
      
      // Responsável (fallbacks)
      '[responsavel.nome]': dadosObrigacao?.responsavelNome || dadosProcesso?.responsavel?.nome || usuarios.find(u => u.email === template?.cc)?.nome || 'Responsável',
      '[responsavel.email]': dadosObrigacao?.responsavelEmail || dadosProcesso?.responsavel?.email || template?.cc || '',
    };
    
    
    // ✅ Função para substituir variáveis preservando formatação HTML
    const substituirVariaveisPreservandoHTML = (html, variaveis) => {
      if (!html) return html;
      
      let resultado = html;
      
      // ✅ Substituir variáveis de forma mais cuidadosa
      Object.entries(variaveis).forEach(([variavel, valor]) => {
        // Usar regex que não quebra tags HTML
        const regex = new RegExp(`\\[${variavel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g');
        resultado = resultado.replace(regex, valor);
      });
      
      return resultado;
    };
    
    // ✅ Função alternativa usando DOM para preservar melhor a formatação
    const substituirVariaveisComDOM = (html, variaveis) => {
      if (!html) return html;
      
      try {
        // Criar um elemento temporário para manipular o HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Função recursiva para processar nós de texto
        const processarNo = (node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            // Processar apenas nós de texto
            let texto = node.textContent || '';
            
            // Substituir variáveis no texto
            Object.entries(variaveis).forEach(([variavel, valor]) => {
              const regex = new RegExp(variavel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
              texto = texto.replace(regex, valor);
            });
            
            node.textContent = texto;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Processar filhos recursivamente
            Array.from(node.childNodes).forEach(processarNo);
          }
        };
        
        // Processar todo o documento
        processarNo(tempDiv);
        
        // Retornar o HTML processado
        return tempDiv.innerHTML;
      } catch (error) {
        console.error('Erro ao processar HTML com DOM:', error);
        // Fallback para o método simples
        return substituirVariaveisPreservandoHTML(html, variaveis);
      }
    };
    
    // ✅ Usar a função DOM que preserva melhor a formatação HTML
    resultado = substituirVariaveisComDOM(resultado, variaveis);
    
    // ✅ Log para debug da preservação de formatação
    
    return resultado;
  };

  // ✅ Carregar email do cliente assim que o modal abrir
  useEffect(() => {
    if (!isOpen || !processoId || tipo !== "processo") return;

    const token = resolveToken();
    if (!token) return;

    // Carregar dados da tarefa para obter email do cliente
    api.get(`/gestao/tarefas/${processoId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        const tarefa = res.data;
        if (!tarefa?.cliente?.email) return;

        // ✅ Definir email do cliente imediatamente se disponível
        setParaCliente(tarefa.cliente.email);
      })
      .catch((err) => {
        console.error("Erro ao carregar dados da tarefa:", err);
      });
  }, [isOpen, processoId, tipo]);

  // ✅ Carregar email do cliente para obrigações
  useEffect(() => {
    if (!isOpen || !processoId || tipo !== "obrigacao") return;

    const token = resolveToken();
    if (!token) return;

    // Carregar dados da obrigação para obter email do cliente
    api.get(`/gestao/obrigacoes/atividades-cliente/${processoId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        const atividade = res.data?.[0];
        const obrigacaoClienteId = atividade?.obrigacaoClienteId;

        if (!obrigacaoClienteId) return;

        return api.get(`/gestao/obrigacoes/cliente-obrigacao/${obrigacaoClienteId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then((res) => {
        if (!res?.data?.clienteEmail) return;

        // ✅ Definir email do cliente imediatamente se disponível
        setParaCliente(res.data.clienteEmail);
      })
      .catch((err) => {
        console.error("Erro ao carregar dados da obrigação:", err);
      });
  }, [isOpen, processoId, tipo]);

  // Aplicar template quando carregado
  useEffect(() => {
    // ✅ Verificação mais rigorosa: só aplicar se template existe E tem id
    if (template && template.id && editor && editorReady) {
      // Aplicar template com prioridade sobre outros valores
      if (template.assunto) {
        // Substituir variáveis no assunto antes de aplicar
        substituirVariaveis(template.assunto, atividadeId).then((assuntoComVariaveis) => {
          setAssunto(assuntoComVariaveis);
        });
      }
      
      if (template.corpo) {
        // Substituir variáveis no corpo antes de aplicar
        substituirVariaveis(template.corpo, atividadeId).then((corpoComVariaveis) => {
          editor.commands.setContent(corpoComVariaveis);
        });
      }
      
      // ✅ Só aplicar destinatário do template se não houver email do cliente já definido
      if (template.destinatario && !paraCliente) {
        setParaCliente(template.destinatario);
      }
      
      if (template.cc) {
        setCc(template.cc);
      }
    }
  }, [template, editor, editorReady, clientes, usuarios, empresa, atividadeId, processoId, paraCliente]);

  useEffect(() => {
    const user = sessionStorage.getItem("usuario");
    if (user) setNomeUsuario(JSON.parse(user).nome);
    const token = resolveToken();
    api.get("/gestao/escritorio", { headers: { Authorization: `Bearer ${token}` } }).then((res) => setEmpresa(res.data.razaoSocial));
  }, []);

  useEffect(() => {
    if (!empresa || !clientes.length || !processoId || tipo !== "obrigacao") return;

    const token = resolveToken();

    // Passo 1: buscar a atividade
    api.get(`/gestao/obrigacoes/atividades-cliente/${processoId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        const atividade = res.data?.[0];
        const obrigacaoClienteId = atividade?.obrigacaoClienteId;

        if (!obrigacaoClienteId) throw new Error("Sem obrigacaoClienteId");

        // Passo 2: buscar a obrigação gerada com base no ID certo
        return api.get(`/gestao/obrigacoes/cliente-obrigacao/${obrigacaoClienteId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then((res) => {
        const cliente = res.data?.clienteNome || "Cliente";
        const nome = res.data?.nomeObrigacao || "Obrigação";
        const emailCliente = res.data?.clienteEmail;
        
        // Só definir assunto padrão se não houver template E se o assunto estiver vazio
        if (!template && !assunto) {
          setAssunto(`${empresa} - ${cliente} - ${nome}`);
        }
        
        // ✅ SEMPRE definir email do cliente como padrão se disponível, independente de template
        if (emailCliente && !paraCliente) {
          setParaCliente(emailCliente);
        }
      })
      .catch(() => {
        // Só definir assunto padrão se não houver template E se o assunto estiver vazio
        if (!template && !assunto) {
          setAssunto(`${empresa} - Cliente - NOME DA OBRIGAÇÃO`);
        }
      });
  }, [empresa, clientes, processoId, tipo, template, assunto, paraCliente]);


  useEffect(() => {
    if (!empresa || !clientes.length || !processoId || tipo !== "processo") return;

    const token = sessionStorage.getItem("token");
    if (!token) return;

    api.get(`/gestao/tarefas/${processoId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        const tarefa = res.data;
        if (!tarefa) return;

        const cliente = tarefa.cliente?.nome || "Cliente";
        const nome = tarefa.assunto || "Tarefa";
        const emailCliente = tarefa.cliente?.email;

        // Só definir assunto padrão se não houver template E se o assunto estiver vazio
        if (!template && !assunto) {
          setAssunto(`${empresa} - ${cliente} - ${nome}`);
        }
        
        // ✅ SEMPRE definir email do cliente como padrão se disponível, independente de template
        if (emailCliente && !paraCliente) {
          setParaCliente(emailCliente);
        }

        // Se desejar, pode também setar corpoPadrao baseado em tarefa.descricao
        if (editor && editor.isEmpty && !template) {
          editor.commands.setContent(tarefa.descricao || "");
        }
      })
      .catch(() => {
        // Só definir assunto padrão se não houver template E se o assunto estiver vazio
        if (!template && !assunto) {
          setAssunto(`${empresa} - Cliente - NOME DO PROCESSO`);
        }
      });
  }, [empresa, clientes, processoId, tipo, editor, template, assunto, paraCliente]);



  const handleSubmit = async () => {
    if (enviando) return; // Previne múltiplos envios
    
    console.log("🚀 [EmailModal] handleSubmit iniciado");
    const user = sessionStorage.getItem("usuario");
    console.log("🔍 [FRONTEND DEBUG] Campo 'usuario' do sessionStorage:", user);
    
    let nome = "Titan App", email = "";
    if (user) {
      try {
        const obj = JSON.parse(user);
        nome = obj.nome || "Titan App";
        email = obj.email || ""; // ✅ Buscar email do sessionStorage
        console.log("🔍 [FRONTEND DEBUG] Objeto parseado:", obj);
        console.log("🔍 [FRONTEND DEBUG] Email encontrado no objeto:", obj.email);
      } catch (error) {
        console.error("Erro ao parsear usuário do sessionStorage:", error);
      }
    } else {
      console.log("🔍 [FRONTEND DEBUG] Campo 'usuario' não encontrado no sessionStorage");
    }

    console.log("🔍 [FRONTEND DEBUG] Nome extraído:", nome);
    console.log("🔍 [FRONTEND DEBUG] Email extraído:", email);

    const destinatarios = [
      paraCliente, 
      ...paraFuncionario.map(item => item.value)
    ].filter(Boolean).join(", ");
    const mensagemHtml = editor?.getHTML() || "";
    
    // ✅ Log para debug da formatação HTML
    console.log('🔍 [DEBUG] HTML do editor:', mensagemHtml);
    console.log('🔍 [DEBUG] HTML contém cores:', mensagemHtml.includes('color:'));
    console.log('🔍 [DEBUG] HTML contém highlight:', mensagemHtml.includes('background-color:'));
    
    const mensagemLimpa = mensagemHtml
      .replace(/<\/?[^>]+(>|$)/g, "") // remove todas as tags HTML
      .replace(/&nbsp;|\s|\u200B/g, "") // remove espaços, nbsp e caracteres invisíveis
      .trim();


    if (!destinatarios && !cc.trim()) {
      toast.error("Informe pelo menos um destinatário (campo 'Para' ou 'CC').");
      return;
    }

    if (!destinatarios && cc.trim()) {
      toast.error("O campo 'CC' não substitui o destinatário principal. Preencha o campo 'Para' também.");
      return;
    }

    if (!mensagemLimpa) {
      toast.error("Escreva uma mensagem para enviar o e-mail.");
      return;
    }

    const emailData = {
      para: destinatarios,
      cc: cc.split(/[,;]\s*/).filter(Boolean).join(", "),
      co,
      assunto,
      corpo: mensagemHtml,
      anexo,
      nomeUsuario: nome,
      emailUsuario: email, // ✅ E-mail do usuário que está enviando
      tarefaId: tipo === "processo" ? processoId : undefined,
      obrigacaoId: tipo === "obrigacao" ? processoId : undefined,
      atividadeId, // ✅ inclui a atividade
    };

    console.log("🔍 [FRONTEND DEBUG] emailUsuario enviado:", email);
    console.log("🔍 [FRONTEND DEBUG] nomeUsuario enviado:", nome);
    console.log("🔍 [FRONTEND DEBUG] Dados completos enviados:", emailData);

    setEnviando(true); // ✅ Evitar cliques duplos
    
    try {
      console.log("📤 [EmailModal] Chamando onSend com dados:", emailData);
      onSend(emailData);
      console.log("✅ [EmailModal] onSend executado com sucesso");
      
      // ✅ Fechar modal imediatamente para evitar gap de UX
      onClose();
      
    } catch (error) {
      console.error("❌ [EmailModal] Erro ao enviar:", error);
      toast.error("Erro ao enviar e-mail. Tente novamente.");
      setEnviando(false);
    }
  };

  // ✅ MOVER O RETURN NULL PARA DEPOIS DE TODOS OS HOOKS
  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <ToastContainer />
        <div className={styles.header}>
          <h2 className={styles.title}>E-mail</h2>
          {loadingTemplate && (
            <div className={styles.loadingTemplate}>
              <div className={styles.spinner} />
              Carregando template...
            </div>
          )}
          {loadingAnexos && (
            <div className={styles.loadingTemplate}>
              <div className={styles.spinner} />
              Carregando anexos das atividades...
            </div>
          )}
        </div>

        <div className={styles.row}>
          <span className={styles.fieldLabel}>para:</span>
          <div className={styles.selectContainer}>
            <input
              className={styles.input}
              style={{ flex: 1 }}
              placeholder="Digite o e-mail do cliente..."
              value={paraCliente}
              onChange={(e) => setParaCliente(e.target.value)}
              type="email"
            />
             <Select
               isMulti
               components={customSelectComponents}
               options={funcionarioOptions}
               onChange={(selected) => setParaFuncionario(Array.from(selected || []))}
               value={paraFuncionario}
               placeholder="Digite ou selecione e-mails..."
               isClearable={false}
               isSearchable
               styles={{
                 control: (base, state) => ({
                   ...base,
                   backgroundColor: 'rgba(255, 255, 255, 0.08)',
                   borderColor: 'rgba(255, 255, 255, 0.08)',
                   color: '#E6E9F0',
                   minHeight: '40px',
                   maxHeight: '120px',
                   overflow: 'auto',
                   '&:hover': { borderColor: 'rgba(255, 255, 255, 0.08)' }
                 }),
                 valueContainer: (base) => ({
                   ...base,
                   maxHeight: '80px',
                   overflow: 'auto',
                   flexWrap: 'wrap'
                 }),
                 input: (base) => ({
                   ...base,
                   color: '#E6E9F0'
                 }),
                 placeholder: (base) => ({
                   ...base,
                   color: '#6F7384'
                 }),
                 multiValue: (base) => ({
                   ...base,
                   backgroundColor: 'rgba(255, 255, 255, 0.1)',
                   color: '#E6E9F0',
                   borderRadius: '4px',
                   margin: '1px',
                   fontSize: '12px'
                 }),
                 multiValueLabel: (base) => ({
                   ...base,
                   color: '#E6E9F0',
                   fontSize: '12px',
                   padding: '1px 4px'
                 }),
                 multiValueRemove: (base) => ({
                   ...base,
                   color: '#E6E9F0',
                   borderRadius: '0 6px 6px 0',
                   '&:hover': {
                     backgroundColor: 'rgba(255, 255, 255, 0.2)',
                     color: '#E6E9F0'
                   }
                 }),
                 menu: (base) => ({
                   ...base,
                   backgroundColor: '#0B0B11',
                   border: '1px solid rgba(255, 255, 255, 0.08)'
                 }),
                 option: (base, state) => ({
                   ...base,
                   backgroundColor: state.isFocused ? '#000024' : '#0B0B11',
                   color: '#E6E9F0',
                   '&:hover': { backgroundColor: '#000024' }
                 })
               }}
             />
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.fieldLabel}>cc:</span>
          <input
            className={styles.input}
            style={{ flex: 1 }}
            placeholder="separe os e-mails com ; ou ,"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
          />
        </div>



        <div className={styles.row}>
          <span className={styles.fieldLabel}>assunto:</span>
          <input
            className={styles.input}
            style={{ flex: 1 }}
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Digite o assunto do e-mail..."
          />
        </div>

        <div className={styles.row}>
          <span className={styles.fieldLabel}>anexo:</span>
          <div className={styles.selectContainer}>
            <label className={styles.anexoButton}>
              Escolher arquivos
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setAnexo((prev) => {
                    const all = [...prev, ...files];
                    const unique = Array.from(new Map(all.map(file => [file.name, file])).values());
                    return unique;
                  });
                }}
              />
            </label>
            {anexo.length > 0 && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
                gap: '8px', 
                marginTop: '12px',
                maxHeight: '160px',
                overflowY: 'auto'
              }}>
                {anexo.map((file, i) => {
                  // Buscar informações da atividade para este anexo
                  const anexoOrigem = anexosAtividades.find(anexoAtividade => 
                    anexoAtividade.nome_arquivo === file.name || anexoAtividade.nomeArquivo === file.name
                  );
                  
                  return (
                    <div key={i} style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      padding: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    }}>
                      <div style={{ 
                        background: 'rgba(255, 255, 255, 0.1)', 
                        borderRadius: '4px', 
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Paperclip size={14} color="#E6E9F0" />
                      </div>
                      <div style={{ 
                        flex: 1, 
                        minWidth: 0,
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '4px'
                      }}>
                        <span style={{ 
                          color: '#E6E9F0', 
                          fontSize: '12px', 
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {file.name}
                        </span>
                        {anexoOrigem && (
                          <span style={{ 
                            fontSize: '9px', 
                            color: '#6F7384', 
                            fontStyle: 'italic',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            📎 {tipo === "obrigacao" ? "Obrigação" : "Atv."} {anexoOrigem.atividadeOrdem}: {anexoOrigem.atividadeTexto?.substring(0, 25) || anexoOrigem.tipo || 'Anexo'}{anexoOrigem.atividadeTexto && anexoOrigem.atividadeTexto.length > 25 ? '...' : ''}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          setAnexo((prev) => prev.filter((_, index) => index !== i))
                        }
                        style={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          border: 'none',
                          borderRadius: '3px',
                          padding: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#E6E9F0',
                          transition: 'all 0.2s ease',
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                          e.currentTarget.style.color = '#ef4444';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                          e.currentTarget.style.color = '#E6E9F0';
                        }}
                        title="Remover arquivo"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>



        <div style={{ marginBottom: 16 }}>
          {editor && (
            <div className={styles.toolbarContainer}>
              <button 
                onClick={() => editor.chain().focus().toggleBold().run()} 
                className={`${styles.toolbarBtn} ${editor.isActive("bold") ? styles.active : ""}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 1024 1024"><path fill="currentColor" d="M697.8 481.4c33.6-35 54.2-82.3 54.2-134.3v-10.2C752 229.3 663.9 142 555.3 142H259.4c-15.1 0-27.4 12.3-27.4 27.4v679.1c0 16.3 13.2 29.5 29.5 29.5h318.7c117 0 211.8-94.2 211.8-210.5v-11c0-73-37.4-137.3-94.2-175.1M328 238h224.7c57.1 0 103.3 44.4 103.3 99.3v9.5c0 54.8-46.3 99.3-103.3 99.3H328zm366.6 429.4c0 62.9-51.7 113.9-115.5 113.9H328V542.7h251.1c63.8 0 115.5 51 115.5 113.9z" /></svg>
              </button>
              <button 
                onClick={() => editor.chain().focus().toggleItalic().run()} 
                className={`${styles.toolbarBtn} ${editor.isActive("italic") ? styles.active : ""}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M10 4v3h2.21l-3.42 10H6v3h8v-3h-2.21l3.42-10H18V4z" /></svg>
              </button>
              <button 
                onClick={() => editor.chain().focus().toggleUnderline().run()} 
                className={`${styles.toolbarBtn} ${editor.isActive("underline") ? styles.active : ""}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M12 17a5 5 0 0 0 5-5V4h-2v8a3 3 0 0 1-6 0V4H7v8a5 5 0 0 0 5 5m-7 2v2h14v-2z" /></svg>
              </button>
              <button 
                onClick={() => editor.chain().focus().setTextAlign("left").run()} 
                className={`${styles.toolbarBtn} ${editor.isActive({ textAlign: "left" }) ? styles.active : ""}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M3 3h18v2H3zm0 4h12v2H3zm0 4h18v2H3zm0 4h12v2H3zm0 4h18v2H3z" /></svg>
              </button>
              <button 
                onClick={() => editor.chain().focus().setTextAlign("center").run()} 
                className={`${styles.toolbarBtn} ${editor.isActive({ textAlign: "center" }) ? styles.active : ""}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M4 3h16v2H4zm2 4h12v2H6zm-2 4h16v2H4zm2 4h12v2H6zm-2 4h16v2H4z" /></svg>
              </button>
              <button 
                onClick={() => editor.chain().focus().setTextAlign("right").run()} 
                className={`${styles.toolbarBtn} ${editor.isActive({ textAlign: "right" }) ? styles.active : ""}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M3 3h18v2H3zm6 4h12v2H9zm-6 4h18v2H3zm6 4h12v2H9zm-6 4h18v2H3z" /></svg>
              </button>
            </div>
          )}
          <div className={`tiptap-editor ${styles.editorWrapper}`}>
            <EditorContent
              editor={editor}
              className={styles.editorContent}
            />
          </div>
        </div>


        <div className={styles.footer}>
          <button 
            className={styles.cancelButton} 
            onClick={onClose}
            disabled={enviando}
          >
            Cancelar
          </button>
          <button 
            className={`${styles.sendButton} ${enviando ? styles.sendButtonDisabled : ''}`}
            onClick={handleSubmit}
            disabled={enviando}
          >
            {enviando ? (
              <>
                <div className={styles.spinner} style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                Enviando...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 24 15">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 2v.01L12 13 4 6.01V6h16zM4 18V8.83l8 6.99 8-6.99V18H4z" />
                </svg>
                Enviar
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}






