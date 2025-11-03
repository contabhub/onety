import { useEffect, useState } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import { useRouter } from "next/router";
import styles from "../../styles/gestao/ProcessosPage.module.css";
import { FaRegFileAlt, FaSearch } from "react-icons/fa";
import { hasPermissao } from "../../utils/gestao/permissoes";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Processos() {
  const [usuarios, setUsuarios] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [notificarAbertura, setNotificarAbertura] = useState(false);
  const [notificarFinalizacao, setNotificarFinalizacao] = useState(false);
  const [
    podeFinalizarAntesSubatendimentos,
    setPodeFinalizarAntesSubatendimentos,
  ] = useState(false);
  const [nome, setNome] = useState("");
  const [departamentoId, setDepartamentoId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [diasMeta, setDiasMeta] = useState(1);
  const [diasPrazo, setDiasPrazo] = useState(1);
  const [tipoDataReferencia, setTipoDataReferencia] = useState("hoje");
  const [dataReferencia, setDataReferencia] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [filtro, setFiltro] = useState("");
  const [departamentoFiltro, setDepartamentoFiltro] = useState("");
  const [responsavelFiltro, setResponsavelFiltro] = useState("");
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [pagina, setPagina] = useState(1);
  const [contadorAnimado, setContadorAnimado] = useState(0);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalFechando, setModalFechando] = useState(false);
  const [ocultarGlobais, setOcultarGlobais] = useState(false);
  const [preferenciaCarregada, setPreferenciaCarregada] = useState(false);
  const [isLight, setIsLight] = useState(false);

  const router = useRouter();

  // Busque o departamento selecionado
  const departamentoSelecionado = departamentos.find(
    (d) => String(d.id) === departamentoId
  );

  // Pegue o usuário responsável pelo departamento
  const responsavelDepartamento = departamentoSelecionado && departamentoSelecionado.responsavelUsuarioId
    ? usuarios.find((u) => String(u.usuario_id) === String(departamentoSelecionado.responsavelUsuarioId))
    : null;

  // Colaboradores do departamento (exceto o responsável, para não duplicar)
  const colaboradoresDoDepartamento = usuarios.filter(
    (u) =>
      String(u.departamento_id) === departamentoId &&
      (!responsavelDepartamento || String(u.usuario_id) !== String(responsavelDepartamento.usuario_id))
  );

  // Lista final: responsável + colaboradores (sem duplicados)
  const possiveisResponsaveis = [
    ...(responsavelDepartamento ? [responsavelDepartamento] : []),
    ...colaboradoresDoDepartamento,
  ];

  const fetchProcessos = async () => {
    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined"
        ? (localStorage.getItem("userData") || sessionStorage.getItem("userData"))
        : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const url = `${BASE_URL}/gestao/processos`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setProcessos(data);
    } catch (err) {
      console.error("Erro ao buscar processos:", err);
    }
  };

  const fetchDepartamentos = async () => {
    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined"
        ? (localStorage.getItem("userData") || sessionStorage.getItem("userData"))
        : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const url = `${BASE_URL}/gestao/departamentos/${empresaId}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setDepartamentos(data);
    } catch (err) {
      console.error("Erro ao buscar departamentos:", err);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined"
        ? (localStorage.getItem("userData") || sessionStorage.getItem("userData"))
        : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const url = `${BASE_URL}/usuarios-empresas/empresa/${empresaId}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setUsuarios(data);
    } catch (err) {
      console.error("Erro ao buscar usuários:", err);
    }
  };

  const criarProcesso = async () => {
    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined"
        ? (localStorage.getItem("userData") || sessionStorage.getItem("userData"))
        : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const novoProcesso = {
        nome,
        departamentoId: Number(departamentoId),
        responsavelId: Number(responsavelId),
        diasMeta,
        diasPrazo,
        dataReferencia,
        notificarAbertura,
        notificarFinalizacao,
        podeFinalizarAntesSubatendimentos,
        padraoFranqueadora: 0,
        processoPaiId: null,
      };

      const url = `${BASE_URL}/gestao/processos`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Empresa-Id": empresaId.toString()
        },
        body: JSON.stringify(novoProcesso),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      router.push(`/gestao/processos/${data.processId}`);
    } catch (err) {
      console.error("Erro ao criar processo:", err);
    }
  };

  useEffect(() => {
    fetchProcessos();
    fetchDepartamentos();
    fetchUsuarios();
  }, []);

  // Detectar tema atual e ouvir mudanças
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const getTheme = () => document.documentElement.getAttribute('data-theme') === 'light';
    setIsLight(getTheme());
    const handleChange = (e) => {
      const detail = e.detail;
      if (detail && (detail.theme === 'light' || detail.theme === 'dark')) {
        setIsLight(detail.theme === 'light');
      } else {
        setIsLight(getTheme());
      }
    };
    window.addEventListener('titan-theme-change', handleChange);
    return () => window.removeEventListener('titan-theme-change', handleChange);
  }, []);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setPagina(1);
  }, [filtro, departamentoFiltro, responsavelFiltro, ocultarGlobais]);

  // Carregar preferência do backend
  useEffect(() => {
    const saved = localStorage.getItem('ocultarGlobais');
    if (saved) setOcultarGlobais(saved === 'true');
    setPreferenciaCarregada(true);
  }, []);
  
  // Salvar preferência no localStorage somente após carregar
  useEffect(() => {
    if (preferenciaCarregada) {
      localStorage.setItem('ocultarGlobais', ocultarGlobais.toString());
    }
  }, [ocultarGlobais, preferenciaCarregada]);

  const processosFiltrados = processos.filter(
    (p) =>
      p.nome.toLowerCase().includes(filtro.toLowerCase()) &&
      (departamentoFiltro === "" ||
        p.departamentoId === Number(departamentoFiltro)) &&
      (responsavelFiltro === "" || p.responsavel === responsavelFiltro) &&
      (!ocultarGlobais || p.padraoFranqueadora != 1)
  );

  // Paginação
  const totalPaginas = Math.max(1, Math.ceil(processosFiltrados.length / itensPorPagina));
  const paginaInicio = Math.max(1, pagina - 2);
  const paginaFim = Math.min(totalPaginas, paginaInicio + 4);
  const processosPaginados = processosFiltrados.slice(
    (pagina - 1) * itensPorPagina,
    pagina * itensPorPagina
  );

  // Atualizar contador quando filtros mudarem
  useEffect(() => {
    setContadorAnimado(processosFiltrados.length);
  }, [processosFiltrados.length]);

  const handleItemsPerPageChange = (e) => {
    setItensPorPagina(Number(e.target.value));
  };

  const handlePageChange = (e) => {
    setPagina(Number(e.target.value));
  };

  const fecharModal = () => {
    setModalFechando(true);
    setTimeout(() => {
      setModalFechando(false);
      setModalAberto(false);
    }, 300); // Duração igual ao tempo da animação no CSS
  };

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.container}>

        <div className={styles.searchWrapper}>
          <div className={styles.searchRowInner}>
            <FaSearch className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar por Assunto"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className={`${styles.filterInput} ${styles.flex1}`}
            />
          </div>
          
          {hasPermissao("processos", "criar") && (
            <button
              className={`${styles.buttonNovo} ${styles.buttonNovoAdjust}`}
              onClick={() => setModalAberto(true)}
            >
              <FaRegFileAlt className={styles.icon} />
              <span>Novo</span>
            </button>
          )}
        </div>

        <div className={styles.inlineFiltersRow}>
          <label className={styles.filterCheckboxLabel}>
            <input
              type="checkbox"
              checked={ocultarGlobais}
              onChange={e => setOcultarGlobais(e.target.checked)}
              className={styles.checkboxInput}
            />
            Ocultar Processos Globais
          </label>
        </div>

        <div className={styles.scrollWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
              <th className={styles.th}>Nome</th>
                <th className={styles.th}>Departamento</th>
                <th className={styles.th}>Data Referência</th>
                <th className={styles.th}>Dias Meta</th>
                <th className={styles.th}>Dias Prazo</th>
                <th className={styles.th}>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {processosPaginados.map((p) => (
                <tr key={p.id}>
                  <td
                    className={`${styles.td} ${styles.linkTd}`}
                    onClick={() => router.push(`/gestao/processos/${p.id}`)}
                  >
                    {p.nome}
                  </td>

                  <td className={styles.td}>{p.departamento}</td>

                  <td className={styles.td}>
                    {p.dataReferencia === "hoje"
                      ? "Data Atual"
                      : new Date(p.dataReferencia).toLocaleDateString('pt-BR')}
                  </td>
                  <td className={styles.td}>{p.diasMeta}</td>
                  <td className={styles.td}>{p.diasPrazo}</td>
                  <td className={styles.td}>{p.responsavel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
                 {/* PAGINAÇÃO COM SETAS */}
         <div className={styles.pagination}>
           <span>
             Mostrando {(pagina - 1) * itensPorPagina + 1}
             {" - "}
             {Math.min(pagina * itensPorPagina, processosFiltrados.length)} de {processosFiltrados.length}
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
        {modalAberto && (
          <div
            className={`${styles.modalOverlay} ${isLight ? styles.modalOverlayLight : ''} ${modalFechando ? styles.fadeOutOverlay : styles.fadeInOverlay}`}
          >
            <div
              className={`${styles.modalContent} ${isLight ? styles.modalContentLight : ''} ${modalFechando ? styles.fadeOutContent : styles.fadeInContent}`}
            >
              <h2 className={styles.modalTitle}>Novo Processo</h2>
              <form className={styles.modalForm} onSubmit={e => { e.preventDefault(); criarProcesso(); }}>
                <div className={styles.inputFull}>
                  <label className={styles.formLabel}>Nome do Processo *</label>
                  <input
                    className={styles.inputGroup}
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    required
                    placeholder="Digite o nome do processo"
                  />
                </div>
                <div className={styles.inputHalf}>
                  <label className={styles.formLabel}>Departamento *</label>
                  <select
                    className={styles.inputGroup}
                    value={departamentoId}
                    onChange={e => {
                      setDepartamentoId(e.target.value);
                      setResponsavelId(""); // Limpa responsável ao trocar departamento
                    }}
                    required
                  >
                    <option value="">Selecione...</option>
                    {departamentos.map(dep => (
                      <option key={dep.id} value={dep.id}>{dep.nome}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.inputHalf}>
                  <label className={styles.formLabel}>Responsável *</label>
                  <select
                    className={styles.inputGroup}
                    value={responsavelId}
                    onChange={e => setResponsavelId(e.target.value)}
                    required
                    disabled={!departamentoId}
                  >
                    <option value="">Selecione...</option>
                    {possiveisResponsaveis.map(u => (
                      <option key={u.usuario_id} value={u.usuario_id}>{u.full_name}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.inputHalf}>
                  <label className={styles.formLabel}>Dias Meta *</label>
                  <input
                    className={styles.inputGroup}
                    type="number"
                    min={1}
                    value={diasMeta}
                    onChange={e => setDiasMeta(Number(e.target.value))}
                    required
                  />
                </div>
                <div className={styles.inputHalf}>
                  <label className={styles.formLabel}>Dias Prazo *</label>
                  <input
                    className={styles.inputGroup}
                    type="number"
                    min={1}
                    value={diasPrazo}
                    onChange={e => setDiasPrazo(Number(e.target.value))}
                    required
                  />
                </div>
                <div className={styles.inputHalf}>
                  <label className={styles.formLabel}>Data de Referência *</label>
                  <input
                    className={styles.inputGroup}
                    type="date"
                    value={dataReferencia}
                    onChange={e => setDataReferencia(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.checkboxGroup}>
                  <label className={styles.formLabel}>
                    <input
                      type="checkbox"
                      checked={notificarAbertura}
                      onChange={e => setNotificarAbertura(e.target.checked)}
                      className={styles.checkboxInput}
                    />
                    Notificar responsável na abertura
                  </label>
                  <label className={styles.formLabel}>
                    <input
                      type="checkbox"
                      checked={notificarFinalizacao}
                      onChange={e => setNotificarFinalizacao(e.target.checked)}
                      className={styles.checkboxInput}
                    />
                    Notificar responsável na finalização
                  </label>
                  <label className={styles.formLabel}>
                    <input
                      type="checkbox"
                      checked={podeFinalizarAntesSubatendimentos}
                      onChange={e => setPodeFinalizarAntesSubatendimentos(e.target.checked)}
                      className={styles.checkboxInput}
                    />
                    Permitir finalizar antes dos subatendimentos
                  </label>
                </div>
                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.buttonCancelar}
                    onClick={fecharModal}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className={styles.buttonSalvar}
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}