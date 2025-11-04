"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addDays } from "date-fns";
import ClienteSelectMulti from "./ClienteSelectMulti";
import CriacaoProgressoModal from "./CriacaoProgressoModal";
import NovoClienteModal from "./NovoClienteModal";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from "../../styles/gestao/NovaTarefaModal.module.css";
export default function NovaTarefaModal({
  onClose,
  tarefaPaiId,
}) {
  const router = useRouter();

  const [departamentos, setDepartamentos] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [ocultarGlobais, setOcultarGlobais] = useState(false);

  // ✅ NOVO: Estado para subatendimentos
  const [subatendimentos, setSubatendimentos] = useState([]);
  const [subatendimentosSelecionados, setSubatendimentosSelecionados] = useState([]);
  const [modalSubatendimentosAberto, setModalSubatendimentosAberto] = useState(false);
  const [carregandoSubatendimentos, setCarregandoSubatendimentos] = useState(false);

  // ✅ NOVO: Estado para modal de novo cliente
  const [modalNovoClienteAberto, setModalNovoClienteAberto] = useState(false);

  const [form, setForm] = useState({
    departamentoId: "",
    processoId: "",
    assunto: "",
    clienteId: [],
    dataAcao: new Date().toISOString().substring(0, 10),
    dataMeta: new Date().toISOString().substring(0, 10),
    dataPrazo: new Date().toISOString().substring(0, 10),
    descricao: "",
    responsavelId: "",
    podeFinalizarAntesSubatendimentos: false,
    tarefaPaiId: null,
    subatendimentosIds: [],
  });

  useEffect(() => {
    const token = (typeof window !== 'undefined') ? (localStorage.getItem('token') || sessionStorage.getItem("token")) : null;
    let empresaId = (typeof window !== 'undefined') ? (localStorage.getItem("empresaId") || sessionStorage.getItem("empresaId")) : null;
    const rawUser = (typeof window !== 'undefined') ? (localStorage.getItem('userData') || sessionStorage.getItem('usuario')) : null;
    const usuario = rawUser;

    if (usuario) {
      const obj = JSON.parse(usuario);
      setUsuarioLogado(obj);
      if (!empresaId) empresaId = obj?.EmpresaId ? String(obj.EmpresaId) : null;
    }

    const BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    const buildUrl = (p) => `${BASE}${p.startsWith('/') ? '' : '/'}${p}`;
    console.log('[NovaTarefaModal] deps useEffect', { BASE, empresaId, hasToken: !!token });
    if (empresaId && token) {
      const depUrl = buildUrl(`/gestao/departamentos/${empresaId}`);
      console.log('[NovaTarefaModal] fetching departamentos', depUrl);
      fetch(depUrl, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { 
          console.log('[NovaTarefaModal] GET gestao/departamentos', data); 
          const list = Array.isArray(data) ? data : (data?.data || data?.departamentos || []);
          setDepartamentos(Array.isArray(list) ? list : []);
        })
        .catch((e) => { console.error('[NovaTarefaModal] GET gestao/departamentos error', e); setDepartamentos([]); });
      const usersUrl = buildUrl('/usuarios');
      console.log('[NovaTarefaModal] fetching usuarios', usersUrl);
      fetch(usersUrl, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { const list = Array.isArray(data) ? data : (data?.data || []); console.log('[NovaTarefaModal] GET gestao/usuarios', list); setUsuarios(list); })
        .catch((e) => { console.error('[NovaTarefaModal] GET gestao/usuarios error', e); setUsuarios([]); });
    } else {
      console.warn('[NovaTarefaModal] skipping deps fetch - missing empresaId or token', { empresaId, hasToken: !!token });
    }
  }, []);

  useEffect(() => {
    if (tarefaPaiId) {
      setForm((prev) => ({ ...prev, tarefaPaiId }));
    }
  }, [tarefaPaiId]);

  useEffect(() => {
    const token = (typeof window !== 'undefined') ? (localStorage.getItem('token') || sessionStorage.getItem("token")) : null;
    const BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    const buildUrl = (p) => `${BASE}${p.startsWith('/') ? '' : '/'}${p}`;

    // Resolve empresaId prioritariamente do userData (localStorage || sessionStorage)
    let empresaIdHeader = null;
    try {
      const rawUserData = (typeof window !== 'undefined') ? (localStorage.getItem('userData') || sessionStorage.getItem('userData') || sessionStorage.getItem('usuario')) : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : null;
      if (userData?.EmpresaId) empresaIdHeader = String(userData.EmpresaId);
    } catch (_) {}

    if (form.departamentoId && token) {
      const url = buildUrl(`/gestao/processos/disponiveis/${form.departamentoId}`);
      console.log('[NovaTarefaModal] fetching processos disponiveis', { url, departamentoId: form.departamentoId, empresaIdHeader });
      fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(empresaIdHeader ? { 'X-Empresa-Id': empresaIdHeader } : {}),
        },
      })
        .then(r => r.json())
        .then(data => { const list = Array.isArray(data) ? data : (data?.data || []); console.log('[NovaTarefaModal] GET gestao/processos/disponiveis', list); setProcessos(list); })
        .catch(err => { console.error('[NovaTarefaModal] GET gestao/processos/disponiveis error', err); setProcessos([]); });
    } else {
      if (!form.departamentoId) console.warn('[NovaTarefaModal] departamentoId vazio - não buscar processos');
      if (!token) console.warn('[NovaTarefaModal] token ausente - não buscar processos');
      setProcessos([]);
    }
  }, [form.departamentoId]);

  useEffect(() => {
          const processoSelecionado = processos.find(p => p.id === Number(form.processoId));
      if (processoSelecionado) {
        const diasMeta = processoSelecionado.diasMeta || 0;
        const diasPrazo = processoSelecionado.diasPrazo || 0;

        const dataAcao = new Date();
        const dataMeta = addDays(dataAcao, diasMeta);
        // ✅ CORRIGIDO: Prazo = Hoje + diasMeta + diasPrazo (sempre maior que a meta)
        const dataPrazo = addDays(dataAcao, diasMeta + diasPrazo);

        setForm(prev => ({
          ...prev,
          assunto: processoSelecionado.nome,
          dataMeta: dataMeta.toISOString().substring(0, 10),
          dataPrazo: dataPrazo.toISOString().substring(0, 10),
        }));

      // ✅ NOVO: Buscar subatendimentos do processo selecionado
      buscarSubatendimentos(processoSelecionado.id);
    } else {
      // ✅ Limpar subatendimentos se nenhum processo estiver selecionado
      setSubatendimentos([]);
      setSubatendimentosSelecionados([]);
      setForm(prev => ({ ...prev, subatendimentosIds: [] }));
    }
  }, [form.processoId]);

  // useEffect(() => {
  //   const BASE = process.env.NEXT_PUBLIC_API_URL || '';
  //   fetch(`${BASE}/gestao/admin/usuarios/preferencias`)
  //     .then(r => r.json())
  //     .then(data => {
  //       const prefs = data?.data || data;
  //       console.log('[NovaTarefaModal] GET gestao/admin/usuarios/preferencias', prefs);
  //       if (prefs && typeof prefs.ocultarGlobais !== 'undefined') {
  //         setOcultarGlobais(prefs.ocultarGlobais);
  //       }
  //     })
  //     .catch((e) => { console.error('[NovaTarefaModal] GET gestao/admin/usuarios/preferencias error', e); });
  // }, []);

  // ✅ NOVO: Validação em tempo real das datas
  useEffect(() => {
    if (form.dataAcao && form.dataMeta) {
      const dataAcao = new Date(form.dataAcao);
      const dataMeta = new Date(form.dataMeta);
      
      if (dataAcao > dataMeta) {
        toast.error("A data de ação não pode ser maior que a data de meta!");
      }
    }
  }, [form.dataAcao, form.dataMeta]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressoAberto, setProgressoAberto] = useState(false);
  const [tarefasCriadasProgresso, setTarefasCriadasProgresso] = useState([]);
  const [totalParaCriar, setTotalParaCriar] = useState(0);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const errors = [];
    
    if (!form.assunto.trim()) {
      errors.push("Assunto");
    }
    
    if (!form.departamentoId) {
      errors.push("Departamento");
    }
    
    if (!form.processoId) {
      errors.push("Processo");
    }
    
    // ✅ SIMPLIFICADO: Validar clientes selecionados
    if (form.clienteId.length === 0 || form.clienteId.every(id => !id)) {
      errors.push("Cliente");
    }
    
    if (!form.responsavelId && !usuarioLogado) {
      errors.push("Responsável");
    }

    // ✅ NOVO: Validar se data de ação é maior que data de meta
    const dataAcao = new Date(form.dataAcao);
    const dataMeta = new Date(form.dataMeta);
    
    if (dataAcao > dataMeta) {
      toast.error("A data de ação não pode ser maior que a data de meta!");
      return;
    }
    
    if (errors.length > 0) {
      const errorMessage = `Por favor, preencha: ${errors.join(", ")}.`;
      toast.error(errorMessage);
      return;
    }

    setIsSubmitting(true);
    const token = (typeof window !== 'undefined') ? (localStorage.getItem('token') || sessionStorage.getItem("token")) : null;
    let empresaId = (typeof window !== 'undefined') ? (localStorage.getItem("empresaId") || sessionStorage.getItem("empresaId")) : null;
    try {
      if (!empresaId) {
        const rawUser = (typeof window !== 'undefined') ? (localStorage.getItem('userData') || sessionStorage.getItem('usuario')) : null;
        const user = rawUser ? JSON.parse(rawUser) : null;
        if (user?.EmpresaId) empresaId = String(user.EmpresaId);
      }
    } catch {}
    const BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    const responsavelFinal = form.responsavelId || (usuarioLogado ? usuarioLogado.id.toString() : "");

    try {
      // ✅ SIMPLIFICADO: Filtrar clientes válidos
      const clientesValidos = form.clienteId.filter(id => id && id.trim() !== "");

      if (clientesValidos.length === 0) {
        toast.error("Nenhum cliente válido selecionado.");
        return;
      }

      // Abrir modal de progresso
      setProgressoAberto(true);
      setTarefasCriadasProgresso([]);
      setTotalParaCriar(clientesValidos.length);

      // ✅ NOVO: Dados base da tarefa (sem clienteId)
      const dadosBaseTarefa = {
        departamentoId: form.departamentoId,
        processoId: form.processoId,
        assunto: form.assunto,
        dataAcao: form.dataAcao,
        dataPrazo: form.dataPrazo,
        dataMeta: form.dataMeta,
        descricao: form.descricao,
        responsavelId: responsavelFinal,
        empresaId: Number(empresaId),
        tarefaPaiId: form.tarefaPaiId,
        subatendimentosIds: form.subatendimentosIds || [],
        podeFinalizarAntesSubatendimentos: form.podeFinalizarAntesSubatendimentos,
      };
      console.log('[NovaTarefaModal] POST gestao/tarefas base', { total: clientesValidos.length, dadosBaseTarefa });

      // ✅ NOVO: Criar tarefas para cada cliente
      const tarefasCriadas = [];
      for (const clienteId of clientesValidos) {
        try {
          // Obter nome do cliente para exibir no progresso
          let clienteNome = null;
          try {
            const r = await fetch(`${BASE}/gestao/clientes/${clienteId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const json = await r.json();
            console.log('[NovaTarefaModal] GET gestao/clientes/:id', { id: clienteId, json });
            clienteNome = json?.nome || json?.data?.nome || null;
          } catch (_) {}

          const resp = await fetch(`${BASE}/gestao/tarefas`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              ...dadosBaseTarefa,
              clienteId: Number(clienteId),
            }),
          });
          const createdJson = await resp.json();
          const created = createdJson?.data || createdJson;
          console.log('[NovaTarefaModal] POST gestao/tarefas response', created);
          tarefasCriadas.push(created);
          setTarefasCriadasProgresso(prev => [
            ...prev,
            { id: created.id, titulo: clienteNome || created.clienteNome || created.assunto || `Tarefa ${created.id}` }
          ]);
        } catch (err) {
          console.error('[NovaTarefaModal] POST gestao/tarefas error', { clienteId, err });
          // Continuar criando para outros clientes mesmo se um falhar
        }
      }

      if (tarefasCriadas.length === 0) {
        toast.error("Erro ao criar tarefas. Tente novamente.");
        return;
      }

      // ✅ NOVO: Feedback baseado na quantidade de tarefas criadas
      if (tarefasCriadas.length === 1) {
        toast.success("Tarefa criada com sucesso!");
        // manter modal para permitir abrir/concluir
      } else {
        toast.success(`${tarefasCriadas.length} tarefas criadas com sucesso!`);
        // manter modal para permitir abrir/concluir
      }

    } catch (err) {
      console.error('[NovaTarefaModal] handleSubmit error', err);
      toast.error("Erro ao criar tarefas. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ NOVO: Função para buscar subatendimentos do processo
  const buscarSubatendimentos = async (processoId) => {
    if (!processoId) return;
    
    setCarregandoSubatendimentos(true);
    const token = (typeof window !== 'undefined') ? (localStorage.getItem('token') || sessionStorage.getItem("token")) : null;
    const BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    
    try {
      const url = `${BASE}/gestao/processos/${processoId}/subprocessos`;
      console.log('[NovaTarefaModal] fetching subprocessos', { url, processoId });
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await r.json();
      console.log('[NovaTarefaModal] GET gestao/processos/:id/subprocessos', { processoId, json });
      setSubatendimentos(Array.isArray(json) ? json : (json?.data || []));
      // ✅ Selecionar todos os subatendimentos por padrão
      const todosIds = (Array.isArray(json) ? json : (json?.data || [])).map((s) => s.id);
      setSubatendimentosSelecionados(todosIds);
      setForm(prev => ({ ...prev, subatendimentosIds: todosIds }));
    } catch (error) {
      console.error('[NovaTarefaModal] GET gestao/processos/:id/subprocessos error', { processoId, error });
      setSubatendimentos([]);
      setSubatendimentosSelecionados([]);
      setForm(prev => ({ ...prev, subatendimentosIds: [] }));
    } finally {
      setCarregandoSubatendimentos(false);
    }
  };

  // ✅ NOVO: Função para abrir modal de subatendimentos
  const abrirModalSubatendimentos = () => {
    setModalSubatendimentosAberto(true);
  };

  // ✅ NOVO: Função para fechar modal de subatendimentos
  const fecharModalSubatendimentos = () => {
    setModalSubatendimentosAberto(false);
  };

  // ✅ NOVO: Função para abrir modal de novo cliente
  const abrirModalNovoCliente = () => {
    setModalNovoClienteAberto(true);
  };

  // ✅ NOVO: Função para fechar modal de novo cliente
  const fecharModalNovoCliente = () => {
    setModalNovoClienteAberto(false);
  };

  // ✅ NOVO: Função para quando um novo cliente for criado com sucesso
  const handleNovoClienteCriado = () => {
    // Recarregar a lista de clientes
    const token = (typeof window !== 'undefined') ? (localStorage.getItem('token') || sessionStorage.getItem("token")) : null;
    const BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    if (token) {
      fetch(`${BASE}/gestao/clientes`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { const list = Array.isArray(data) ? data : (data?.data || []); console.log('[NovaTarefaModal] GET gestao/clientes (reload)', list); setClientes(list); })
        .catch(err => console.error('[NovaTarefaModal] GET gestao/clientes (reload) error', err));
    }
    fecharModalNovoCliente();
    toast.success("Cliente criado com sucesso! Agora você pode selecioná-lo.");
  };


  // ✅ NOVO: Função para alternar seleção de subatendimento
  const alternarSubatendimento = (subatendimentoId) => {
    setSubatendimentosSelecionados(prev => {
      const novos = prev.includes(subatendimentoId)
        ? prev.filter(id => id !== subatendimentoId)
        : [...prev, subatendimentoId];
      
      // ✅ Atualizar form com os IDs selecionados
      setForm(prevForm => ({ ...prevForm, subatendimentosIds: novos }));
      return novos;
    });
  };

  // ✅ NOVO: Função para selecionar/desmarcar todos
  const alternarTodosSubatendimentos = () => {
    if (subatendimentosSelecionados.length === subatendimentos.length) {
      // ✅ Desmarcar todos
      setSubatendimentosSelecionados([]);
      setForm(prev => ({ ...prev, subatendimentosIds: [] }));
    } else {
      // ✅ Selecionar todos
      const todosIds = subatendimentos.map(s => s.id);
      setSubatendimentosSelecionados(todosIds);
      setForm(prev => ({ ...prev, subatendimentosIds: todosIds }));
    }
  };

  const processosFiltrados = ocultarGlobais
    ? processos.filter(p => !p.padraoFranqueadora || p.padraoFranqueadora !== 1)
    : processos;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} style={{ display: progressoAberto ? "none" : undefined }}>
        {isSubmitting && (
          <div className={styles.loadingOverlay} />
        )}

        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Novo Processo</h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Fechar modal"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className={styles.form}>
          <div className={styles.formRow}>
            <select 
              name="departamentoId" 
              value={form.departamentoId} 
              onChange={handleChange} 
              className={styles.select}
            >
              <option value="">Selecione o Departamento</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </select>

            <select 
              name="processoId" 
              value={form.processoId} 
              onChange={handleChange} 
              className={styles.select}
            >
              <option value="">Selecione o Processo</option>
              {processosFiltrados.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          <div className={styles.formRow}>
            <input
              type="text"
              name="assunto"
              value={form.assunto}
              placeholder="Assunto"
              readOnly
              className={`${styles.input} ${styles.readOnly}`}
            />
          </div>

          <div className={styles.formRow}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
              <div style={{ width: "100%", maxWidth: "720px" }}>
                <ClienteSelectMulti
                  value={form.clienteId}
                  onChange={handleChange}
                  isMulti={true}
                  placeholder="Selecione um ou mais clientes..."
                />
              </div>
              
              {/* ✅ NOVO: Botão para adicionar novo cliente */}
              <button
                type="button"
                onClick={abrirModalNovoCliente}
                style={{
                  padding: "var(--onity-space-s)",
                  background: "var(--onity-color-primary)",
                  color: "var(--onity-color-primary-contrast)",
                  border: "none",
                  borderRadius: "var(--onity-radius-xs)",
                  fontSize: "var(--onity-type-body-size)",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background-color 120ms ease, transform 120ms ease, box-shadow 120ms ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "36px",
                  height: "36px",
                  boxShadow: "var(--onity-elev-low)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--onity-color-primary-hover)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "var(--onity-elev-med)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--onity-color-primary)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                title="Adicionar novo cliente"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          </div>

          <div className={styles.formRow}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", width: "100%" }}>
              <label className={styles.checkboxLabel}>
                <input 
                  type="checkbox" 
                  name="podeFinalizarAntesSubatendimentos" 
                  checked={form.podeFinalizarAntesSubatendimentos} 
                  onChange={handleChange} 
                  className={styles.checkbox}
                />
                <span>Pode finalizar antes dos subatendimentos</span>
              </label>
              
              {/* ✅ NOVO: Botão para editar subatendimentos */}
              {form.processoId && subatendimentos.length > 0 && (
                <button
                  type="button"
                  onClick={abrirModalSubatendimentos}
                  style={{
                    padding: "var(--onity-space-s) var(--onity-space-m)",
                    background: "var(--onity-color-primary)",
                    color: "var(--onity-color-primary-contrast)",
                    border: "none",
                    borderRadius: "var(--onity-radius-xs)",
                    fontSize: "var(--onity-type-body-size)",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "background-color 120ms ease, transform 120ms ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    minWidth: "fit-content"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--onity-color-primary-hover)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--onity-color-primary)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Editar Subatendimentos ({subatendimentosSelecionados.length}/{subatendimentos.length})
                </button>
              )}
            </div>
          </div>

          <div className={styles.dateGrid}>
            <div className={styles.dateField}>
              <label className={styles.label}>Ação</label>
              <input 
                type="date" 
                name="dataAcao" 
                value={form.dataAcao} 
                onChange={handleChange} 
                className={styles.input} 
              />
            </div>
            <div className={styles.dateField}>
              <label className={styles.label}>Prazo</label>
              <input 
                type="date" 
                name="dataPrazo" 
                value={form.dataPrazo} 
                onChange={handleChange} 
                className={`${styles.input} ${styles.disabled}`} 
                disabled 
              />
            </div>
            <div className={styles.dateField}>
              <label className={styles.label}>Meta</label>
              <input
                type="date"
                name="dataMeta"
                value={form.dataMeta}
                onChange={handleChange}
                className={`${styles.input} ${styles.disabled}`}
                disabled
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <label className={styles.label}>Responsável</label>
            <select 
              name="responsavelId" 
              value={form.responsavelId} 
              onChange={handleChange} 
              className={styles.select}
            >
              <option value="">Selecione...</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>

          <div className={styles.formRow}>
            <textarea
              name="descricao"
              value={form.descricao}
              onChange={handleChange}
              placeholder="Descrição..."
              className={`${styles.textarea} ${styles.input}`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button onClick={onClose} className={styles.cancelButton}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className={`${styles.confirmButton} ${isSubmitting ? styles.disabled : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? "Criando..." 
              : form.clienteId.length > 1
                ? `Criar ${form.clienteId.length} Tarefas`
                : form.clienteId.length === 1
                  ? "Criar Tarefa"
                  : "Confirmar"
            }
          </button>
        </div>
      </div>

      {/* Modal de Progresso de Criação */}
      <CriacaoProgressoModal
        isOpen={progressoAberto}
        total={totalParaCriar}
        criadas={tarefasCriadasProgresso}
        onClose={() => setProgressoAberto(false)}
        onConcluir={() => {
          // Atualiza a visão atual (visão geral) e fecha os modais
          try {
            router.refresh();
          } catch (_) {}
          setProgressoAberto(false);
          onClose();
        }}
        onAbrirTarefa={(id) => {
          window.open(`/tarefas/${id}/atividades`, "_blank");
        }}
      />

      {/* ✅ NOVO: Modal de Subatendimentos */}
      {modalSubatendimentosAberto && (
        <div className={styles.overlay} style={{ zIndex: 1001 }}>
          <div className={styles.modal} style={{ maxWidth: "600px", maxHeight: "80vh" }}>
            {/* Header do Modal */}
            <div className={styles.header}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
                Selecionar Subatendimentos
              </h3>
              <button
                onClick={fecharModalSubatendimentos}
                className={styles.closeButton}
                aria-label="Fechar modal"
              >
                ×
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div style={{ padding: "var(--onity-space-l)", overflowY: "auto", maxHeight: "60vh" }}>
              {carregandoSubatendimentos ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ fontSize: "var(--onity-type-body-size)", color: "var(--onity-color-text)", opacity: 0.7 }}>
                    Carregando subatendimentos...
                  </div>
                </div>
              ) : subatendimentos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ fontSize: "var(--onity-type-body-size)", color: "var(--onity-color-text)", opacity: 0.7 }}>
                    Este processo não possui subatendimentos configurados.
                  </div>
                </div>
              ) : (
                <>
                  {/* ✅ Botão Selecionar/Desmarcar Todos */}
                  <div style={{ marginBottom: "20px", textAlign: "center" }}>
                                         <button
                       type="button"
                       onClick={alternarTodosSubatendimentos}
                       style={{
                        padding: "var(--onity-space-s) var(--onity-space-l)",
                        background: subatendimentosSelecionados.length === subatendimentos.length 
                          ? "#EA5455" 
                          : "#28C76F",
                        color: "#fff",
                         border: "none",
                        borderRadius: "var(--onity-radius-xs)",
                        fontSize: "var(--onity-type-body-size)",
                        fontWeight: 500,
                         cursor: "pointer",
                        transition: "transform 120ms ease, box-shadow 120ms ease",
                         display: "flex",
                         alignItems: "center",
                         justifyContent: "center",
                         gap: "10px",
                         margin: "0 auto"
                       }}
                       onMouseEnter={(e) => {
                         e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "var(--onity-elev-med)";
                       }}
                       onMouseLeave={(e) => {
                         e.currentTarget.style.transform = "translateY(0)";
                         e.currentTarget.style.boxShadow = "none";
                       }}
                     >
                       {subatendimentosSelecionados.length === subatendimentos.length ? (
                         <>
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                             <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                           </svg>
                           Desmarcar Todos
                         </>
                       ) : (
                         <>
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                             <polyline points="9,11 12,14 22,4" />
                             <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                           </svg>
                           Selecionar Todos
                         </>
                       )}
                     </button>
                  </div>

                  {/* ✅ Lista de Subatendimentos */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {subatendimentos.map((subatendimento) => (
                      <div
                        key={subatendimento.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "16px",
                          background: "var(--onity-color-surface)",
                          border: "1px solid var(--onity-color-border)",
                          borderRadius: "var(--onity-radius-m)",
                          cursor: "pointer",
                          transition: "all 0.2s ease"
                        }}
                        onClick={() => alternarSubatendimento(subatendimento.id)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--onity-color-bg)";
                          e.currentTarget.style.borderColor = "var(--onity-color-primary)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "var(--onity-color-surface)";
                          e.currentTarget.style.borderColor = "var(--onity-color-border)";
                        }}
                      >
                        {/* ✅ Checkbox */}
                        <input
                          type="checkbox"
                          checked={subatendimentosSelecionados.includes(subatendimento.id)}
                          onChange={() => alternarSubatendimento(subatendimento.id)}
                          style={{
                            width: "18px",
                            height: "18px",
                            cursor: "pointer",
                            accentColor: "var(--onity-color-primary)"
                          }}
                        />
                        
                        {/* ✅ Informações do Subatendimento */}
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontWeight: "600",
                            fontSize: "14px",
                            color: "var(--onity-color-text)",
                            marginBottom: "4px"
                          }}>
                            {subatendimento.nome || subatendimento.assunto || `Subatendimento ${subatendimento.id}`}
                          </div>
                          
                          {subatendimento.descricao && (
                            <div style={{
                              fontSize: "12px",
                              color: "var(--onity-color-text)",
                              opacity: 0.7,
                              lineHeight: "1.4"
                            }}>
                              {subatendimento.descricao}
                            </div>
                          )}
                        </div>

                        {/* ✅ Indicador de seleção */}
                        <div style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: subatendimentosSelecionados.includes(subatendimento.id)
                            ? "var(--onity-color-success)"
                            : "var(--onity-color-border)"
                        }} />
                      </div>
                    ))}
                  </div>

                                     {/* ✅ Resumo da seleção */}
                   <div style={{
                     marginTop: "20px",
                     padding: "16px",
                    background: "var(--onity-color-surface)",
                    borderRadius: "var(--onity-radius-m)",
                     textAlign: "center",
                    border: "1px solid var(--onity-color-border)",
                     display: "flex",
                     flexDirection: "column",
                     alignItems: "center",
                     gap: "8px"
                   }}>
                     <div style={{
                      fontSize: "var(--onity-type-body-size)",
                      color: "var(--onity-color-text)",
                      fontWeight: 500
                     }}>
                       {subatendimentosSelecionados.length} de {subatendimentos.length} subatendimentos selecionados
                     </div>
                     <div style={{
                      fontSize: "12px",
                      color: "var(--onity-color-text)",
                      opacity: 0.7,
                       marginTop: "4px",
                       display: "flex",
                       alignItems: "center",
                       justifyContent: "center",
                       gap: "8px"
                     }}>
                       {subatendimentosSelecionados.length === 0 ? (
                         <>
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                             <circle cx="12" cy="12" r="10" />
                             <line x1="15" y1="9" x2="9" y2="15" />
                             <line x1="9" y1="9" x2="15" y2="15" />
                           </svg>
                           Nenhum subatendimento selecionado
                         </>
                       ) : subatendimentosSelecionados.length === subatendimentos.length ? (
                         <>
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                             <polyline points="9,11 12,14 22,4" />
                             <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                           </svg>
                           Todos os subatendimentos selecionados
                         </>
                       ) : (
                         <>
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                             <circle cx="12" cy="12" r="10" />
                             <path d="M8 12h8" />
                             <path d="M12 8v8" />
                           </svg>
                           Apenas alguns subatendimentos selecionados
                         </>
                       )}
                     </div>
                  </div>
                </>
              )}
            </div>

                         {/* ✅ Footer do Modal */}
             <div style={{
               padding: "20px",
               borderTop: "1px solid var(--titan-stroke)",
               display: "flex",
               justifyContent: "flex-end",
               gap: "12px"
             }}>
               <button
                 onClick={fecharModalSubatendimentos}
                 style={{
                   padding: "10px 20px",
                   background: "var(--titan-base-10)",
                   color: "var(--titan-text-high)",
                   border: "1px solid var(--titan-stroke)",
                   borderRadius: "6px",
                   fontSize: "14px",
                   fontWeight: "500",
                   cursor: "pointer",
                   transition: "all 0.2s ease"
                 }}
                 onMouseEnter={(e) => {
                   e.currentTarget.style.background = "var(--titan-base-15)";
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.style.background = "var(--titan-base-10)";
                 }}
               >
                 Fechar
               </button>
               
               {/* ✅ NOVO: Botão Confirmar */}
               <button
                 onClick={fecharModalSubatendimentos}
                 style={{
                   padding: "10px 20px",
                   background: "var(--titan-primary)",
                   color: "white",
                   border: "none",
                   borderRadius: "6px",
                   fontSize: "14px",
                   fontWeight: "500",
                   cursor: "pointer",
                   transition: "all 0.2s ease",
                   display: "flex",
                   alignItems: "center",
                   gap: "8px"
                 }}
                 onMouseEnter={(e) => {
                   e.currentTarget.style.background = "var(--titan-primary-hover)";
                   e.currentTarget.style.transform = "translateY(-1px)";
                   e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.style.background = "var(--titan-primary)";
                   e.currentTarget.style.transform = "translateY(0)";
                   e.currentTarget.style.boxShadow = "none";
                 }}
               >
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                   <polyline points="9,11 12,14 22,4" />
                   <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                 </svg>
                 Confirmar
               </button>
             </div>
          </div>
        </div>
      )}

      {/* ✅ NOVO: Modal de Novo Cliente */}
      {modalNovoClienteAberto && (
        <NovoClienteModal
          onClose={fecharModalNovoCliente}
          onSuccess={handleNovoClienteCriado}
        />
      )}
      
      {/* ToastContainer global em _app.js */}
    </div>
  );
}
