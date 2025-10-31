import { useEffect, useState } from "react";
import DashboardLayout from "./dashboardlayout";
import { useRouter } from "next/navigation";
import api from "../../app/utils/api";
import styles from "../../styles/ProcessosPage.module.css";
import { FaRegFileAlt, FaSearch } from "react-icons/fa";
import { hasPermissao, getPermissoes } from "@/app/utils/permissoes";
import { useAuthRedirect } from "@/app/utils/useAuthRedirect";

type DepartamentoGlobal = {
  id: number;
  nome: string;
};

type Usuario = {
  id: number;
  nome: string;
  departamentoId?: number;
};

type ProcessoGlobal = {
  id: number;
  nome: string;
  diasMeta: number;
  diasPrazo: number;
  dataReferencia: string;
  departamentoGlobalId: number;
  departamentoGlobalNome: string;
  empresaId: number;
  padraoFranqueadora: number;
  responsavelId?: number;
  responsavel?: string;
};

export default function ProcessosGlobais() {
  useAuthRedirect();
  const router = useRouter();

  // Estados para listagem
  const [processosGlobais, setProcessosGlobais] = useState<ProcessoGlobal[]>([]);
  const [departamentosGlobais, setDepartamentosGlobais] = useState<DepartamentoGlobal[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filtro, setFiltro] = useState("");
  const [departamentoFiltro, setDepartamentoFiltro] = useState("");
  const [responsavelFiltro, setResponsavelFiltro] = useState("");
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [pagina, setPagina] = useState(1);
  const [contadorAnimado, setContadorAnimado] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Estado para detecção de tema
  const [isLight, setIsLight] = useState(false);
  

  // Estados para modal de cadastro
  const [modalAberto, setModalAberto] = useState(false);
  const [modalFechando, setModalFechando] = useState(false);
  const [formProcesso, setFormProcesso] = useState({
    nome: "",
    departamentoGlobalId: "",
    responsavelId: "",
    diasMeta: 1,
    diasPrazo: 1,
    dataReferencia: new Date().toISOString().split("T")[0],
  });
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Estados para modal de atividades
  const [modalAtividades, setModalAtividades] = useState(false);
  const [processoSelecionado, setProcessoSelecionado] = useState<ProcessoGlobal | null>(null);
  const [atividades, setAtividades] = useState<any[]>([]);
  const [formAtividade, setFormAtividade] = useState({
    texto: "",
    tipo: "Checklist",
    tipoCancelamento: "Com justificativa",
    ordem: 1,
  });

  const token = typeof window !== "undefined" ? sessionStorage.getItem("token") : "";
  const usuarioLogado = typeof window !== "undefined"
    ? JSON.parse(sessionStorage.getItem("usuario") || "{}")
    : {};

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

  const fetchProcessosGlobais = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/admin/processos-franqueadora", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProcessosGlobais(response.data);
    } catch (err) {
      console.error("Erro ao buscar processos globais:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartamentosGlobais = async () => {
    try {
      const response = await api.get("/api/admin/departamentos-globais", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDepartamentosGlobais(response.data);
    } catch (err) {
      console.error("Erro ao buscar departamentos globais:", err);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const response = await api.get("/api/usuarios", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsuarios(response.data);
    } catch (err) {
      console.error("Erro ao buscar usuários:", err);
    }
  };

  const fetchAtividades = async (processoId: number) => {
    try {
      const response = await api.get(`/api/admin/atividades-global/${processoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAtividades(response.data);
    } catch (err) {
      console.error("Erro ao buscar atividades:", err);
      setAtividades([]);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchProcessosGlobais();
    fetchDepartamentosGlobais();
    fetchUsuarios();
  }, [token]);

  const criarProcessoGlobal = async () => {
    if (!formProcesso.nome || !formProcesso.departamentoGlobalId || !formProcesso.responsavelId) {
      setErro("Preencha todos os campos obrigatórios.");
      return;
    }

    try {
      setLoading(true);
      setErro("");
      setSucesso("");

      const response = await api.post(
        "/api/admin/processo-global",
        {
          ...formProcesso,
          departamentoGlobalId: Number(formProcesso.departamentoGlobalId),
          responsavelId: formProcesso.responsavelId ? Number(formProcesso.responsavelId) : null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 201) {
        setSucesso("Processo global criado com sucesso!");
        setFormProcesso({
          nome: "",
          departamentoGlobalId: "",
          responsavelId: "",
          diasMeta: 1,
          diasPrazo: 1,
          dataReferencia: new Date().toISOString().split("T")[0],
        });
        fetchProcessosGlobais(); // Recarregar lista
        setTimeout(() => setSucesso(""), 3000);
      }
    } catch (error) {
      console.error("Erro ao criar processo global:", error);
      setErro("Erro ao criar processo global.");
    } finally {
      setLoading(false);
    }
  };

  const adicionarAtividade = async () => {
    if (!formAtividade.texto || !processoSelecionado) {
      setErro("Preencha o texto da atividade.");
      return;
    }

    try {
      setLoading(true);
      setErro("");

      const response = await api.post(
        "/api/admin/atividade-global",
        {
          processoId: processoSelecionado.id,
          ...formAtividade,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 201) {
        setSucesso("Atividade adicionada com sucesso!");
        setFormAtividade({
          texto: "",
          tipo: "Checklist",
          tipoCancelamento: "Com justificativa",
          ordem: atividades.length + 1,
        });
        fetchAtividades(processoSelecionado.id);
        setTimeout(() => setSucesso(""), 3000);
      }
    } catch (error) {
      console.error("Erro ao adicionar atividade:", error);
      setErro("Erro ao adicionar atividade.");
    } finally {
      setLoading(false);
    }
  };

  const abrirModalAtividades = (processo: ProcessoGlobal) => {
    setProcessoSelecionado(processo);
    setModalAtividades(true);
    fetchAtividades(processo.id);
  };

  const fecharModal = () => {
    setModalFechando(true);
    setTimeout(() => {
      setModalFechando(false);
      setModalAberto(false);
      setErro("");
      setSucesso("");
    }, 300);
  };

  const fecharModalAtividades = () => {
    setModalAtividades(false);
    setProcessoSelecionado(null);
    setAtividades([]);
    setFormAtividade({
      texto: "",
      tipo: "Checklist",
      tipoCancelamento: "Com justificativa",
      ordem: 1,
    });
  };

  // Filtros
  const processosFiltrados = processosGlobais.filter((p) => {
    const matchNome = p.nome.toLowerCase().includes(filtro.toLowerCase());
    const matchDepartamento = departamentoFiltro === "" || 
      p.departamentoGlobalId === Number(departamentoFiltro);
    const matchResponsavel = responsavelFiltro === "" || 
      p.responsavelId === Number(responsavelFiltro);
    return matchNome && matchDepartamento && matchResponsavel;
  });

  // Animação do contador
  useEffect(() => {
    let start = 0;
    const end = processosFiltrados.length;
    const duration = 800;
    const incrementTime = 20;

    if (start === end) return;

    const steps = Math.ceil(duration / incrementTime);
    const increment = end / steps;

    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= end) {
        clearInterval(interval);
        setContadorAnimado(end);
      } else {
        setContadorAnimado(Math.floor(current));
      }
    }, incrementTime);

    return () => clearInterval(interval);
  }, [processosFiltrados.length]);

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItensPorPagina(Number(e.target.value));
  };

  const handlePageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPagina(Number(e.target.value));
  };

  if (loading && processosGlobais.length === 0) {
    return (
      <DashboardLayout>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
          <div>Carregando processos globais...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.container}>
        <div className={styles.actions}>
          {hasPermissao("processos", "criar") && (
            <button
              className={styles.buttonNovo}
              onClick={() => setModalAberto(true)}
            >
              <FaRegFileAlt className={styles.icon} />
              <span>Novo Processo Global</span>
            </button>
          )}
        </div>

        <div className={styles.searchWrapper}>
          <FaSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar por Nome"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className={styles.filterInput}
          />
          <select
            value={departamentoFiltro}
            onChange={(e) => setDepartamentoFiltro(e.target.value)}
            className={styles.filterInput}
            style={{ marginLeft: 10 }}
          >
            <option value="">Todos os Departamentos</option>
            {departamentosGlobais.map((dep) => (
              <option key={dep.id} value={dep.id}>
                {dep.nome}
              </option>
            ))}
          </select>
          <select
            value={responsavelFiltro}
            onChange={(e) => setResponsavelFiltro(e.target.value)}
            className={styles.filterInput}
            style={{ marginLeft: 10 }}
          >
            <option value="">Todos os Responsáveis</option>
            {usuarios.map((user) => (
              <option key={user.id} value={user.id}>
                {user.nome}
              </option>
            ))}
          </select>
        </div>

        <table className={styles.table}>
          <thead>
            <tr className={styles.tableHeaderRow}>
              <th className={styles.th}>Departamento Global</th>
              <th className={`${styles.th} ${styles.thJustify}`}>Nome</th>
              <th className={styles.th}>Responsável</th>
              <th className={styles.th}>Data Referência</th>
              <th className={styles.th}>Dias Meta</th>
              <th className={styles.th}>Dias Prazo</th>
              <th className={styles.th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {processosFiltrados.map((p) => (
              <tr key={p.id}>
                <td className={styles.td}>{p.departamentoGlobalNome}</td>
                <td
                  className={`${styles.td} ${styles.linkTd}`}
                  onClick={() => router.push(`/dashboard/processos-globais/${p.id}`)}
                >
                  {p.nome}
                </td>
                <td className={styles.td}>{p.responsavel || "Não definido"}</td>
                <td className={styles.td}>
                  {p.dataReferencia === "hoje" ? "Data Atual" : p.dataReferencia}
                </td>
                <td className={styles.td}>{p.diasMeta}</td>
                <td className={styles.td}>{p.diasPrazo}</td>
                <td className={styles.td}>
                  <button
                    onClick={() => abrirModalAtividades(p)}
                    style={{
                      background: "#388E3C",
                      color: "white",
                      border: "none",
                      padding: "4px 8px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Atividades
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.pagination}>
          <div>
            <span>{`Total de Processos Globais: ${contadorAnimado}`}</span>
          </div>
          <div className={styles.paginationControls}>
            <select
              value={itensPorPagina}
              onChange={handleItemsPerPageChange}
              className={styles.paginationSelect}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <select
              value={pagina}
              onChange={handlePageChange}
              className={styles.paginationSelect}
            >
              {[
                ...Array(Math.ceil(processosFiltrados.length / itensPorPagina)),
              ].map((_, index) => (
                <option key={index} value={index + 1}>
                  {index + 1}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Modal de Cadastro de Processo Global */}
        {modalAberto && (
          <div
            className={`${styles.modalOverlay} ${
              modalFechando ? styles.fadeOutOverlay : styles.fadeInOverlay
            }`}
            style={{
              background: isLight ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.5)",
              zIndex: 9999
            }}
          >
            <div
              className={`${styles.modalContent} ${
                modalFechando ? styles.fadeOutContent : styles.fadeInContent
              }`}
              style={{
                background: isLight ? "rgba(255, 255, 255, 0.98)" : "var(--titan-card-bg)",
                border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid var(--titan-stroke)"
              }}
            >
              <h2 className={styles.modalTitle}>Novo Processo Global</h2>

              <div className={styles.modalForm}>
                <div className={styles.inputFull}>
                  <label>Nome *</label>
                  <input
                    type="text"
                    value={formProcesso.nome}
                    onChange={(e) => setFormProcesso({ ...formProcesso, nome: e.target.value })}
                    className={styles.inputGroup}
                  />
                </div>

                <div className={styles.inputHalf}>
                  <label>Departamento Global *</label>
                  <select
                    value={formProcesso.departamentoGlobalId}
                    onChange={(e) => setFormProcesso({ ...formProcesso, departamentoGlobalId: e.target.value })}
                    className={styles.inputGroup}
                  >
                    <option value="">Selecione...</option>
                    {departamentosGlobais.map((dep) => (
                      <option key={dep.id} value={dep.id}>
                        {dep.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.inputHalf}>
                  <label>Responsável *</label>
                  <select
                    value={formProcesso.responsavelId}
                    onChange={(e) => setFormProcesso({ ...formProcesso, responsavelId: e.target.value })}
                    className={styles.inputGroup}
                  >
                    <option value="">Selecione...</option>
                    {usuarios.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.inputHalf}>
                  <label>Dias Meta *</label>
                  <input
                    type="number"
                    value={formProcesso.diasMeta}
                    onChange={(e) => setFormProcesso({ ...formProcesso, diasMeta: Number(e.target.value) })}
                    className={styles.inputGroup}
                  />
                </div>

                <div className={styles.inputHalf}>
                  <label>Dias Prazo *</label>
                  <input
                    type="number"
                    value={formProcesso.diasPrazo}
                    onChange={(e) => setFormProcesso({ ...formProcesso, diasPrazo: Number(e.target.value) })}
                    className={styles.inputGroup}
                  />
                </div>

                <div className={styles.inputHalf}>
                  <label>Data Referência</label>
                  <input
                    type="date"
                    value={formProcesso.dataReferencia}
                    onChange={(e) => setFormProcesso({ ...formProcesso, dataReferencia: e.target.value })}
                    className={styles.inputGroup}
                  />
                </div>
              </div>

              {erro && <p style={{ color: "red", marginTop: 10 }}>{erro}</p>}
              {sucesso && <p style={{ color: "#388E3C", marginTop: 10 }}>{sucesso}</p>}

              <div className={styles.modalFooter}>
                <button onClick={fecharModal} className={styles.buttonCancelar}>
                  Cancelar
                </button>
                <button onClick={criarProcessoGlobal} className={styles.buttonSalvar} disabled={loading}>
                  {loading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Atividades */}
        {modalAtividades && processoSelecionado && (
          <div
            className={`${styles.modalOverlay} ${
              modalFechando ? styles.fadeOutOverlay : styles.fadeInOverlay
            }`}
            style={{
              background: isLight ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.5)",
              zIndex: 9999
            }}
          >
            <div
              className={`${styles.modalContent} ${
                modalFechando ? styles.fadeOutContent : styles.fadeInContent
              }`}
              style={{ 
                maxWidth: "600px", 
                maxHeight: "80vh", 
                overflow: "auto",
                background: isLight ? "rgba(255, 255, 255, 0.98)" : "var(--titan-card-bg)",
                border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid var(--titan-stroke)"
              }}
            >
              <h2 className={styles.modalTitle}>
                Atividades - {processoSelecionado.nome}
              </h2>

              <div className={styles.modalForm}>
                <div className={styles.inputFull}>
                  <label>Texto da Atividade *</label>
                  <input
                    type="text"
                    value={formAtividade.texto}
                    onChange={(e) => setFormAtividade({ ...formAtividade, texto: e.target.value })}
                    className={styles.inputGroup}
                    placeholder="Digite o texto da atividade"
                  />
                </div>

                <div className={styles.inputHalf}>
                  <label>Tipo</label>
                  <select
                    value={formAtividade.tipo}
                    onChange={(e) => setFormAtividade({ ...formAtividade, tipo: e.target.value })}
                    className={styles.inputGroup}
                  >
                    <option value="Checklist">Checklist</option>
                    <option value="Texto">Texto</option>
                    <option value="Arquivo">Arquivo</option>
                  </select>
                </div>

                <div className={styles.inputHalf}>
                  <label>Tipo de Cancelamento</label>
                  <select
                    value={formAtividade.tipoCancelamento}
                    onChange={(e) => setFormAtividade({ ...formAtividade, tipoCancelamento: e.target.value })}
                    className={styles.inputGroup}
                  >
                    <option value="Com justificativa">Com justificativa</option>
                    <option value="Sem justificativa">Sem justificativa</option>
                  </select>
                </div>

                <div className={styles.inputHalf}>
                  <label>Ordem</label>
                  <input
                    type="number"
                    value={formAtividade.ordem}
                    onChange={(e) => setFormAtividade({ ...formAtividade, ordem: Number(e.target.value) })}
                    className={styles.inputGroup}
                  />
                </div>

                <button
                  onClick={adicionarAtividade}
                  style={{
                    background: "#388E3C",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: 4,
                    cursor: "pointer",
                    marginTop: 10,
                  }}
                  disabled={loading}
                >
                  {loading ? "Adicionando..." : "Adicionar Atividade"}
                </button>

                {erro && <p style={{ color: "red", marginTop: 10 }}>{erro}</p>}
                {sucesso && <p style={{ color: "#388E3C", marginTop: 10 }}>{sucesso}</p>}

                {/* Lista de atividades existentes */}
                {atividades.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <h3>Atividades Existentes:</h3>
                    <ul style={{ listStyle: "none", padding: 0 }}>
                      {atividades.map((atividade, index) => (
                        <li
                          key={atividade.id}
                          style={{
                            padding: "8px",
                            margin: "4px 0",
                            background: "#f5f5f5",
                            borderRadius: 4,
                          }}
                        >
                          <strong>{atividade.ordem}.</strong> {atividade.texto} ({atividade.tipo})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button onClick={fecharModalAtividades} className={styles.buttonCancelar}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
} 