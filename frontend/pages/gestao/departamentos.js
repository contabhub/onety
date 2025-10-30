import { useEffect, useState } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import styles from "../../styles/gestao/DepartamentosPage.module.css";
import { FaSearch, FaRegBuilding } from "react-icons/fa";
import SpaceLoader from "../../components/onety/menu/SpaceLoader";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function DepartamentosPage() {
  const [departamentos, setDepartamentos] = useState([]);
  const [departamentosFiltrados, setDepartamentosFiltrados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalFechando, setModalFechando] = useState(false);
  const [nome, setNome] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [departamentoId, setDepartamentoId] = useState(null);

  const [empresaId, setEmpresaId] = useState(null);
  const [headers, setHeaders] = useState({ Authorization: "" });

  // ✅ Novos estados para paginação
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [pagina, setPagina] = useState(1);

  // ✅ Estado para detecção de tema
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const rawUser = localStorage.getItem("userData");
        const parsed = rawUser ? JSON.parse(rawUser) : null;
        const detectedEmpresaId = parsed?.EmpresaId || parsed?.empresa?.id || null;
        const token = localStorage.getItem("token");
        if (detectedEmpresaId) setEmpresaId(String(detectedEmpresaId));
        if (token) setHeaders({ Authorization: `Bearer ${token}` });
      } catch {
        // ignora erros de parse e deixa estados vazios
      }
    }
  }, []);

  // ✅ Detecção de tema
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsLight(theme === 'light');
    };

    checkTheme();
    window.addEventListener('titan-theme-change', checkTheme);
    return () => window.removeEventListener('titan-theme-change', checkTheme);
  }, []);

  // ✅ Reset da página quando mudar filtros
  useEffect(() => {
    setPagina(1);
  }, [itensPorPagina]);

  const fetchDepartamentos = async () => {
    setLoading(true); // ⬅️ Adiciona aqui
    try {
      const res = await fetch(`${BASE_URL}/gestao/departamentos/${empresaId}`, {
        headers: {
          Authorization: headers.Authorization,
        },
      });
      if (!res.ok) {
        setDepartamentos([]);
        setDepartamentosFiltrados([]);
      } else {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setDepartamentos(list);
        setDepartamentosFiltrados(list);
      }
    } catch (err) {
      console.error("Erro ao buscar departamentos:", err);
    } finally {
      setLoading(false); // ⬅️ E encerra aqui
    }
  };

  const abrirModalEdicao = (departamento) => {
    setModoEdicao(true);
    setDepartamentoId(departamento.id);
    setNome(departamento.nome);
    const responsavel = usuarios.find(u => u.nome === departamento.responsavelNome);
    // backend retorna responsavel_id (snake_case) na listagem; manter fallback por nome
    setResponsavelId(departamento.responsavel_id || responsavel?.relacaoId || "");
    setModalAberto(true);
  };

  const fetchUsuarios = async () => {
    try {
      const res = await fetch(`${BASE_URL}/gestao/departamentos/empresa/${empresaId}`, {
        headers: {
          Authorization: headers.Authorization,
        },
      });
      if (!res.ok) {
        setUsuarios([]);
        return;
      }
      const data = await res.json();
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar usuários:", err);
    }
  };

  const criarDepartamento = async () => {
    if (!nome) return;
    try {
      await fetch(`${BASE_URL}/gestao/departamentos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: headers.Authorization,
        },
        body: JSON.stringify({ empresaId, nome, responsavelId: responsavelId || null }),
      });
      setNome("");
      setResponsavelId("");
      setModalAberto(false);
      fetchDepartamentos();
    } catch (err) {
      console.error("❌ Erro ao criar departamento:", err);
    }
  };

  const salvarDepartamento = async () => {
    if (!nome) return;

    try {
      const payload = { empresaId, nome, responsavelId: responsavelId || null };

      if (modoEdicao && departamentoId) {
        await fetch(`${BASE_URL}/gestao/departamentos/${departamentoId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: headers.Authorization,
          },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`${BASE_URL}/gestao/departamentos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: headers.Authorization,
          },
          body: JSON.stringify(payload),
        });
      }

      setNome("");
      setResponsavelId("");
      setModalAberto(false);
      setModoEdicao(false);
      setDepartamentoId(null);
      fetchDepartamentos();
    } catch (err) {
      console.error("❌ Erro ao salvar departamento:", err);
    }
  };

  const fecharModal = () => {
    setModalFechando(true);
    setTimeout(() => {
      setModalFechando(false);
      setModalAberto(false);
      setNome("");
      setResponsavelId("");
      setDepartamentoId(null);
      setModoEdicao(false);
    }, 300);
  };

  useEffect(() => {
    if (empresaId && headers.Authorization) {
      fetchDepartamentos();
      fetchUsuarios();
    }
  }, [empresaId, headers]);

  // ✅ Cálculos de paginação (com guarda)
  const safeFiltrados = Array.isArray(departamentosFiltrados) ? departamentosFiltrados : [];
  const totalPaginas = Math.max(1, Math.ceil(safeFiltrados.length / itensPorPagina));
  const paginaInicio = Math.max(1, pagina - 2);
  const paginaFim = Math.min(totalPaginas, paginaInicio + 4);
  const departamentosPaginados = safeFiltrados.slice(
    (pagina - 1) * itensPorPagina,
    pagina * itensPorPagina
  );

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.container}>
        {/* Header com título e botão */}
        <div className={styles.headerRow}>
          <h1 className={styles.headerTitle}>Gestão de Departamentos</h1>
          <button className={styles.buttonNovo} onClick={() => {
            setNome("");
            setResponsavelId("");
            setDepartamentoId(null);
            setModoEdicao(false);
            setModalAberto(true);
          }}>
            <FaRegBuilding className={styles.icon} />
            Novo
          </button>
        </div>

        <div className={styles.searchWrapper}>
          <FaSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Pesquisar departamento..."
            onChange={(e) => {
              const termo = e.target.value.toLowerCase();
            const base = Array.isArray(departamentos) ? departamentos : [];
            const filtrados = base.filter((d) => String(d?.nome || "").toLowerCase().includes(termo));
              setDepartamentosFiltrados(filtrados);
              setPagina(1); // ✅ Reset da página ao pesquisar
            }}
            className={styles.filterInput}
          />
        </div>
        
        {/* Tabela + Spinner localizado após o filtro */}
        {loading && (
          <SpaceLoader size={64} label="Carregando departamentos..." showText={true} minHeight={160} />
        )}

        {!loading && (
          <>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHeaderRow}>
                  <th className={styles.th}>ID</th>
                  <th className={styles.th}>Nome</th>
                  <th className={styles.th}>Supervisor</th>
                </tr>
              </thead>
              <tbody>
                {departamentosPaginados.map((d, i) => (
                  <tr key={d.id}>
                    <td className={styles.td}>{(pagina - 1) * itensPorPagina + i + 1}</td>
                    <td 
                      className={`${styles.td} ${styles.linkTd}`}
                      onClick={() => abrirModalEdicao(d)}
                    >
                      {d.nome}
                    </td>
                    <td className={styles.td}>{d.responsavelNome || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ✅ Paginação adicionada */}
            {departamentosFiltrados.length > 0 && (
              <div className={styles.pagination}>
                <span>
                  Mostrando {(pagina - 1) * itensPorPagina + 1}
                  {" - "}
                  {Math.min(pagina * itensPorPagina, departamentosFiltrados.length)} de {departamentosFiltrados.length}
                </span>
                <div className={styles.paginationButtons}>
                  <select
                    value={itensPorPagina}
                    onChange={(e) => setItensPorPagina(Number(e.target.value))}
                    className={styles.paginationSelect}
                    style={{ marginRight: 16 }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <button
                    className={styles.paginationArrow}
                    onClick={() => setPagina(1)}
                    disabled={pagina === 1}
                    aria-label="Primeira página"
                  >
                    {"<<"}
                  </button>
                  <button
                    className={styles.paginationArrow}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={pagina === 1}
                    aria-label="Página anterior"
                  >
                    {"<"}
                  </button>
                  {Array.from({ length: paginaFim - paginaInicio + 1 }, (_, i) => paginaInicio + i).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPagina(p)}
                      className={p === pagina ? styles.paginationButtonActive : styles.paginationArrow}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    className={styles.paginationArrow}
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    disabled={pagina === totalPaginas}
                    aria-label="Próxima página"
                  >
                    {">"}
                  </button>
                  <button
                    className={styles.paginationArrow}
                    onClick={() => setPagina(totalPaginas)}
                    disabled={pagina === totalPaginas}
                    aria-label="Última página"
                  >
                    {">>"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* MODAL */}
        {modalAberto && (
          <div className={`${styles.modalOverlay} ${isLight ? styles.modalOverlayLight : styles.modalOverlayDark}`}>
            <div className={`${styles.modalContent} ${isLight ? styles.modalContentLight : styles.modalContentDark}`}>
              {/* Header */}
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>
                  {modoEdicao ? "Editar Departamento" : "Novo Departamento"}
                </h2>
                <button onClick={fecharModal} className={styles.closeButton}>
                  ×
                </button>
              </div>

              {/* Formulário */}
              <div className={styles.formGroup}>
                <div className={styles.formGroup}>
                  <label htmlFor="nome" className={styles.label}>
                    Nome <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="nome"
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className={styles.inputField}
                    placeholder="Digite o nome do departamento"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="responsavel" className={styles.label}>
                    Responsável
                  </label>
                  <select
                    id="responsavel"
                    value={responsavelId}
                    onChange={(e) => setResponsavelId(e.target.value)}
                    className={styles.selectField}
                  >
                    <option value="">Selecione...</option>
                    {usuarios.map((u) => (
                      <option key={u.relacaoId} value={u.relacaoId}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botões */}
              <div className={styles.modalActions}>
                <button onClick={fecharModal} className={styles.btnCancel}>
                  Cancelar
                </button>
                <button onClick={salvarDepartamento} className={styles.btnPrimary}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
