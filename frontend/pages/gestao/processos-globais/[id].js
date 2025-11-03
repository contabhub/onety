import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import PrincipalSidebar from "../../../components/onety/principal/PrincipalSidebar";
import { getPermissoes } from "../../../utils/gestao/permissoes";
import { FaArrowLeft, FaTrash, FaPlus, FaEdit, FaArrowUp, FaArrowDown } from "react-icons/fa";
import ProcessosEmailTemplateModal from '../../../components/gestao/ProcessosEmailTemplateModal';
import { Settings as LucideSettings } from 'lucide-react';
import styles from "../../../styles/gestao/ProcessosGlobaisDetalhes.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ProcessoGlobalDetalhes() {
  const router = useRouter();
  const params = useParams() || {};
  const processoId = params.id || "";
  const [processo, setProcesso] = useState(null);
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [modalAtividade, setModalAtividade] = useState(false);
  const [formAtividade, setFormAtividade] = useState({
    texto: "",
    descricao: "",
    tipo: "Checklist",
    tipoCancelamento: "Com justificativa",
    ordem: 1,
  });
  const [atividadeEditando, setAtividadeEditando] = useState(null);
  const [modalEmailTemplate, setModalEmailTemplate] = useState(null);
  const [subprocessos, setSubprocessos] = useState([]);
  const [todosProcessos, setTodosProcessos] = useState([]);
  const [mostrarModalSub, setMostrarModalSub] = useState(false);
  const [selecionados, setSelecionados] = useState([]);

  // Estado para detecção de tema
  const [isLight, setIsLight] = useState(false);

  const token = typeof window !== "undefined" ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") : "";

  const getEmpresaIdFromStorage = () => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const parsed = raw ? JSON.parse(raw) : null;
      const id = parsed?.EmpresaId || localStorage.getItem("empresaId") || sessionStorage.getItem("empresaId");
      return id ? Number(id) : null;
    } catch {
      return null;
    }
  };

  // Verificar permissão de superadmin
  useEffect(() => {
    const permissoes = getPermissoes();
    if (!permissoes.adm || !permissoes.adm.includes("superadmin")) {
      router.replace("/auth/login");
    }
  }, [router]);

  // Detectar tema
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsLight(theme === 'light');
    };

    checkTheme();
    window.addEventListener('titan-theme-change', checkTheme);
    return () => window.removeEventListener('titan-theme-change', checkTheme);
  }, []);

  const fetchProcessoGlobal = async () => {
    try {
      setLoading(true);
      const empresaId = getEmpresaIdFromStorage();
      if (!empresaId) throw new Error("EmpresaId não encontrado no storage");
      const response = await fetch(`${BASE_URL}/gestao/admin/processos-franqueadora/${processoId}`, {
        headers: { Authorization: `Bearer ${token}`, "X-Empresa-Id": empresaId.toString() },
      });
      if (!response.ok) throw new Error("Falha ao buscar processo global");
      const data = await response.json();
      const normalizado = data ? {
        ...data,
        diasMeta: data.diasMeta ?? data.dias_meta ?? null,
        diasPrazo: data.diasPrazo ?? data.dias_prazo ?? null,
        dataReferencia: data.dataReferencia ?? data.data_referencia ?? null,
      } : null;
      setProcesso(normalizado);
    } catch (err) {
      setErro("Erro ao carregar processo global.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAtividades = async () => {
    try {
      const empresaId = getEmpresaIdFromStorage();
      if (!empresaId) throw new Error("EmpresaId não encontrado no storage");
      const response = await fetch(`${BASE_URL}/gestao/admin/atividades-global/${processoId}`, {
        headers: { Authorization: `Bearer ${token}`, "X-Empresa-Id": empresaId.toString() },
      });
      if (!response.ok) throw new Error("Falha ao buscar atividades");
      const data = await response.json();
      setAtividades(Array.isArray(data) ? data : []);
    } catch (err) {
      setAtividades([]);
    }
  };

  const adicionarAtividade = async () => {
    if (!formAtividade.texto) {
      setErro("Preencha o texto da atividade.");
      return;
    }
    try {
      setLoading(true);
      setErro("");
      const empresaId = getEmpresaIdFromStorage();
      if (!empresaId) throw new Error("EmpresaId não encontrado no storage");
      await fetch(`${BASE_URL}/gestao/admin/atividade-global`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Empresa-Id": empresaId.toString() },
        body: JSON.stringify({ processoId: Number(processoId), ...formAtividade }),
      });
      setFormAtividade({
        texto: "",
        descricao: "",
        tipo: "Checklist",
        tipoCancelamento: "Com justificativa",
        ordem: atividades.length + 1,
      });
      fetchAtividades();
      setModalAtividade(false);
    } catch (error) {
      setErro("Erro ao adicionar atividade.");
    } finally {
      setLoading(false);
    }
  };

  const excluirAtividade = async (atividadeId) => {
    if (!confirm("Tem certeza que deseja excluir esta atividade?")) return;
    try {
      setLoading(true);
      const empresaId = getEmpresaIdFromStorage();
      if (!empresaId) throw new Error("EmpresaId não encontrado no storage");
      await fetch(`${BASE_URL}/gestao/admin/atividade-global/${atividadeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "X-Empresa-Id": empresaId.toString() },
      });
      fetchAtividades();
    } catch (error) {
      setErro("Erro ao excluir atividade.");
    } finally {
      setLoading(false);
    }
  };

  const editarAtividade = async () => {
    if (!atividadeEditando) return;
    setLoading(true);
    setErro("");
    try {
      const empresaId = getEmpresaIdFromStorage();
      if (!empresaId) throw new Error("EmpresaId não encontrado no storage");
      await fetch(`${BASE_URL}/gestao/admin/atividade-global/${atividadeEditando.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Empresa-Id": empresaId.toString() },
        body: JSON.stringify({
          texto: atividadeEditando.texto,
          descricao: atividadeEditando.descricao,
          tipo: atividadeEditando.tipo,
          tipoCancelamento: atividadeEditando.tipoCancelamento,
        }),
      });
      setAtividadeEditando(null);
      fetchAtividades();
    } catch (error) {
      setErro("Erro ao editar atividade.");
    } finally {
      setLoading(false);
    }
  };

  const trocarOrdem = async (atividadeId, direcao) => {
    const indexAtual = atividades.findIndex((a) => a.id === atividadeId);
    const novoIndex = direcao === "up" ? indexAtual - 1 : indexAtual + 1;
    if (novoIndex < 0 || novoIndex >= atividades.length) return;
    const atividadeAtual = atividades[indexAtual];
    const atividadeAlvo = atividades[novoIndex];
    try {
      const empresaId = getEmpresaIdFromStorage();
      if (!empresaId) throw new Error("EmpresaId não encontrado no storage");
      await Promise.all([
        fetch(`${BASE_URL}/gestao/admin/atividade-global/${atividadeAtual.id}/ordem`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Empresa-Id": empresaId.toString() },
          body: JSON.stringify({ novaOrdem: atividadeAlvo.ordem }),
        }),
        fetch(`${BASE_URL}/gestao/admin/atividade-global/${atividadeAlvo.id}/ordem`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Empresa-Id": empresaId.toString() },
          body: JSON.stringify({ novaOrdem: atividadeAtual.ordem }),
        }),
      ]);
      fetchAtividades();
    } catch (error) {
      setErro("Erro ao reordenar atividade.");
    }
  };

  // Buscar subprocessos e todos os processos globais
  useEffect(() => {
    if (!token || !processoId) return;
    fetchProcessoGlobal();
    fetchAtividades();
    fetchSubprocessos();
    fetchTodosProcessos();
  }, [token, processoId]);

  const fetchSubprocessos = async () => {
    try {
      const empresaId = getEmpresaIdFromStorage();
      if (!empresaId) throw new Error("EmpresaId não encontrado no storage");
      const res = await fetch(`${BASE_URL}/gestao/processos/${processoId}/subprocessos`, {
        headers: { Authorization: `Bearer ${token}`, "X-Empresa-Id": empresaId.toString() },
      });
      const lista = (await res.json()) || [];
      // Anexa atividades de cada subprocesso, sem filtrar por empresa
      const completos = await Promise.all(
        lista.map(async (sub) => {
          try {
            const atividadesRes = await fetch(`${BASE_URL}/gestao/processos/atividades/${sub.id}`, {
              headers: { Authorization: `Bearer ${token}`, "X-Empresa-Id": empresaId.toString() },
            });
            const atividadesData = await atividadesRes.json();
            return { ...sub, atividades: atividadesData };
          } catch (_) {
            return { ...sub, atividades: [] };
          }
        })
      );

      setSubprocessos(completos);
    } catch (err) {
      setSubprocessos([]);
    }
  };

  // Atualizar fetchTodosProcessos para garantir filtro correto
  const fetchTodosProcessos = async () => {
    try {
      const empresaId = getEmpresaIdFromStorage();
      if (!empresaId) throw new Error("EmpresaId não encontrado no storage");
      const res = await fetch(`${BASE_URL}/gestao/processos/globais`, {
        headers: { Authorization: `Bearer ${token}`, "X-Empresa-Id": empresaId.toString() },
      });
      const all = await res.json();
      const subprocessosIds = subprocessos.map((sub) => sub.id);
      setTodosProcessos(
        (Array.isArray(all) ? all : []).filter((p) =>
          p.id !== Number(processoId) &&
          !subprocessosIds.includes(p.id)
        )
      );
    } catch (err) {
      setTodosProcessos([]);
    }
  };

  // Chamar fetchTodosProcessos sempre que subprocessos mudar
  useEffect(() => {
    fetchTodosProcessos();
    // eslint-disable-next-line
  }, [subprocessos]);

  const adicionarSubprocessos = async () => {
    try {
      const empresaId = getEmpresaIdFromStorage();
      if (!empresaId) throw new Error("EmpresaId não encontrado no storage");
      for (const subId of selecionados) {
        await fetch(`${BASE_URL}/gestao/processos/vincular-subprocesso`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Empresa-Id": empresaId.toString() },
          body: JSON.stringify({ processoPaiId: Number(processoId), processoFilhoId: subId })
        });
      }
      setMostrarModalSub(false);
      setSelecionados([]);
      fetchSubprocessos();
      fetchTodosProcessos();
    } catch (err) {
      // erro
    }
  };

  const removerSubprocesso = async (subId) => {
    try {
      const empresaId = getEmpresaIdFromStorage();
      if (!empresaId) throw new Error("EmpresaId não encontrado no storage");
      await fetch(`${BASE_URL}/gestao/processos/vincular-subprocesso/${processoId}/${subId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "X-Empresa-Id": empresaId.toString() },
      });
      setSubprocessos((prev) => prev.filter((s) => s.id !== subId));
      fetchTodosProcessos();
    } catch (err) { }
  };

  if (loading) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.centerFill}>
          <div>Carregando...</div>
        </div>
      </>
    );
  }

  if (!processo) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.centerFill}>
          <div>Processo global não encontrado.</div>
        </div>
      </>
    );
  }

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <button
            onClick={() => router.back()}
            className={styles.backButton}
          >
            <FaArrowLeft />
          </button>
          <h1 className={styles.title}>
            {processo.nome}
          </h1>
        </div>

        {/* Informações do Processo */}
        <div className={styles.infoCard}>
          <h2 className={styles.infoTitle}>
            Informações do Processo Global
          </h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <strong>Departamento:</strong> {processo.departamentoGlobalNome}
            </div>
            <div className={styles.infoItem}>
              <strong>Dias Meta:</strong> {processo.diasMeta}
            </div>
            <div className={styles.infoItem}>
              <strong>Dias Prazo:</strong> {processo.diasPrazo}
            </div>
            <div className={styles.infoItem}>
              <strong>Data Referência:</strong> {(() => {
                const v = processo.dataReferencia;
                if (!v) return "—";
                if (v === "hoje") return "Data Atual";
                const dt = new Date(v);
                return isNaN(dt) ? String(v) : dt.toLocaleDateString('pt-BR');
              })()}
            </div>
          </div>
        </div>

        {/* Seção de Atividades */}
        <div className={styles.atividadesCard}>
          <div className={styles.atividadesHeader}>
            <h2 className={styles.atividadesTitle}>Atividades</h2>
            <button
              onClick={() => setModalAtividade(true)}
              className={styles.addButton}
            >
              <FaPlus size={12} />
              Adicionar Atividade
            </button>
          </div>

          {atividades.length === 0 ? (
            <p className={styles.emptyMessage}>
              Nenhuma atividade cadastrada para este processo.
            </p>
          ) : (
            <div className={styles.atividadesList}>
              {atividades.map((atividade, idx) => (
                <div
                  key={atividade.id}
                  className={styles.atividadeItem}
                >
                  <div className={styles.atividadeHeader}>
                    <div className={styles.atividadeLeft}>
                      <div className={styles.atividadeTopRow}>
                        <span className={styles.ordemBadge}>
                          {atividade.ordem}
                        </span>
                        <span className={styles.atividadeTexto}>{atividade.texto}</span>
                        {atividade.tipo === 'Enviar e-mail' && (
                          <button onClick={() => setModalEmailTemplate({ atividadeId: atividade.id })} className={styles.actionButton} title="Configurar e-mail">
                            <LucideSettings size={16} />
                          </button>
                        )}
                        <button onClick={() => setAtividadeEditando(atividade)} className={styles.actionButton} title="Editar atividade">
                          <FaEdit size={14} />
                        </button>
                        <button onClick={() => trocarOrdem(atividade.id, "up")} disabled={idx === 0} className={styles.actionButton} title="Subir atividade">
                          <FaArrowUp size={14} />
                        </button>
                        <button onClick={() => trocarOrdem(atividade.id, "down")} disabled={idx === atividades.length - 1} className={styles.actionButton} title="Descer atividade">
                          <FaArrowDown size={14} />
                        </button>
                      </div>
                      {atividade.descricao && (
                        <div className={styles.atividadeDescricao}>
                          {atividade.descricao}
                        </div>
                      )}
                      <div className={styles.atividadeMeta}>
                        Tipo: {atividade.tipo} | Cancelamento: {atividade.tipoCancelamento}
                      </div>
                    </div>
                    <button
                      onClick={() => excluirAtividade(atividade.id)}
                      className={styles.deleteButton}
                    >
                      <FaTrash size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* UI de Subprocessos */}
        <div className={styles.subprocessosSection}>
          <button
            onClick={() => setMostrarModalSub(true)}
            className={styles.subprocessosButton}
          >
            + Subprocesso
          </button>
          {subprocessos.map((sub) => (
            <div
              key={sub.id}
              className={styles.subprocessoItem}
            >
              <div className={styles.subprocessoHeader}>
                <p className={styles.subprocessoNome}>{sub.nome}</p>
                <button
                  onClick={() => removerSubprocesso(sub.id)}
                  className={styles.unlinkButton}
                >
                  Desvincular
                </button>
              </div>
              <ul className={styles.subprocessoAtividades}>
                {sub.atividades?.map((a) => (
                  <li key={a.id}>{a.texto}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {erro && (
          <div className={styles.errorMessage}>
            {erro}
          </div>
        )}

        {/* Modal de Adicionar Atividade */}
        {modalAtividade && (
          <div
            className={`${styles.modalOverlay} ${isLight ? styles.modalOverlayLight : ''}`}
          >
            <div
              className={`${styles.modalContent} ${isLight ? styles.modalContentLight : ''}`}
            >
              <h3 className={styles.modalTitle}>Adicionar Atividade</h3>
              <form className={styles.modalForm} onSubmit={(e) => { e.preventDefault(); adicionarAtividade(); }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    Texto da Atividade *
                  </label>
                  <input
                    type="text"
                    value={formAtividade.texto}
                    onChange={(e) => setFormAtividade({ ...formAtividade, texto: e.target.value })}
                    className={styles.formInput}
                    placeholder="Digite o texto da atividade"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    Descrição
                  </label>
                  <textarea
                    value={formAtividade.descricao}
                    onChange={(e) => setFormAtividade({ ...formAtividade, descricao: e.target.value })}
                    className={styles.formTextarea}
                    placeholder="Descreva a atividade (opcional)"
                  />
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Tipo
                    </label>
                    <select
                      value={formAtividade.tipo}
                      onChange={(e) => setFormAtividade({ ...formAtividade, tipo: e.target.value })}
                      className={styles.formSelect}
                    >
                      <option value="Checklist">Checklist</option>
                      <option value="Enviar e-mail">Enviar e-mail</option>
                      <option value="Anexos sem validação">Anexos sem validação</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Tipo de Cancelamento
                    </label>
                    <select
                      value={formAtividade.tipoCancelamento}
                      onChange={(e) => setFormAtividade({ ...formAtividade, tipoCancelamento: e.target.value })}
                      className={styles.formSelect}
                    >
                      <option value="Com justificativa">Com justificativa</option>
                      <option value="Sem justificativa">Sem justificativa</option>
                    </select>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    Ordem
                  </label>
                  <input
                    type="number"
                    value={formAtividade.ordem}
                    onChange={(e) => setFormAtividade({ ...formAtividade, ordem: Number(e.target.value) })}
                    className={styles.formInput}
                    required
                  />
                </div>
                <div className={styles.modalButtons}>
                  <button
                    type="button"
                    onClick={() => setModalAtividade(false)}
                    className={styles.cancelButton}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={styles.saveButton}
                  >
                    {loading ? "Adicionando..." : "Adicionar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Editar Atividade */}
        {atividadeEditando && (
          <div
            className={`${styles.modalOverlay} ${isLight ? styles.modalOverlayLight : ''}`}
          >
            <div
              className={`${styles.modalContent} ${isLight ? styles.modalContentLight : ''}`}
            >
              <h3 className={styles.modalTitle}>Editar Atividade</h3>
              <form className={styles.modalForm} onSubmit={(e) => { e.preventDefault(); editarAtividade(); }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    Texto da Atividade *
                  </label>
                  <input
                    type="text"
                    value={atividadeEditando.texto}
                    onChange={(e) => setAtividadeEditando({ ...atividadeEditando, texto: e.target.value })}
                    className={styles.formInput}
                    placeholder="Digite o texto da atividade"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    Descrição
                  </label>
                  <textarea
                    value={atividadeEditando.descricao}
                    onChange={(e) => setAtividadeEditando({ ...atividadeEditando, descricao: e.target.value })}
                    className={styles.formTextarea}
                    placeholder="Descreva a atividade (opcional)"
                  />
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Tipo
                    </label>
                    <select
                      value={atividadeEditando.tipo}
                      onChange={(e) => setAtividadeEditando({ ...atividadeEditando, tipo: e.target.value })}
                      className={styles.formSelect}
                    >
                      <option value="Checklist">Checklist</option>
                      <option value="Enviar e-mail">Enviar e-mail</option>
                      <option value="Anexos sem validação">Anexos sem validação</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Tipo de Cancelamento
                    </label>
                    <select
                      value={atividadeEditando.tipoCancelamento}
                      onChange={(e) => setAtividadeEditando({ ...atividadeEditando, tipoCancelamento: e.target.value })}
                      className={styles.formSelect}
                    >
                      <option value="Com justificativa">Com justificativa</option>
                      <option value="Sem justificativa">Sem justificativa</option>
                    </select>
                  </div>
                </div>
                <div className={styles.modalButtons}>
                  <button
                    type="button"
                    onClick={() => setAtividadeEditando(null)}
                    className={styles.cancelButton}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={styles.saveButton}
                  >
                    {loading ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {modalEmailTemplate && (
          <ProcessosEmailTemplateModal
            isOpen={!!modalEmailTemplate}
            onClose={() => setModalEmailTemplate(null)}
            atividadeId={modalEmailTemplate.atividadeId}
          />
        )}

        {mostrarModalSub && (
          <div
            className={`${styles.modalOverlay} ${isLight ? styles.modalOverlayLight : ''}`}
          >
            <div
              className={`${styles.modalContent} ${isLight ? styles.modalContentLight : ''}`}
            >
              <h3 className={styles.modalTitle}>Selecionar Subprocessos</h3>
              <div className={styles.modalForm}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Selecione um processo:</label>
                  <select
                    onChange={e => {
                      const selectedId = parseInt(e.target.value);
                      if (!selecionados.includes(selectedId)) {
                        setSelecionados((prev) => [...prev, selectedId]);
                      }
                      e.target.value = "";
                    }}
                    className={styles.formSelect}
                  >
                    <option value="">Selecione um processo</option>
                    {todosProcessos.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <ul className={styles.subprocessoAtividades}>
                  {selecionados.map((id) => {
                    const processo = todosProcessos.find((p) => p.id === id);
                    return processo ? (
                      <li key={id}>
                        {processo.nome}
                        <button
                          onClick={() => setSelecionados((prev) => prev.filter((pid) => pid !== id))}
                          className={`${styles.unlinkButton} ${styles.unlinkButtonSmall}`}
                        >
                          Remover
                        </button>
                      </li>
                    ) : null;
                  })}
                </ul>

                <div className={styles.modalButtons}>
                  <button onClick={() => setMostrarModalSub(false)} className={styles.cancelButton}>
                    Cancelar
                  </button>
                  <button onClick={adicionarSubprocessos} className={styles.saveButton}>
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
} 