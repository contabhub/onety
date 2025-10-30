import { useEffect, useState } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import styles from "../../styles/gestao/CargosPage.module.css";
import { hasPermissao } from "../../utils/gestao/permissoes";
import { FaUserTie } from "react-icons/fa";
import SpaceLoader from "../../components/onety/menu/SpaceLoader";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Cargos() {
  const [cargos, setCargos] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [permissoes, setPermissoes] = useState({});
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState(null);
  const [canView, setCanView] = useState(null); // null = pendente, true/false = decidido

  // ✅ Estado para detecção de tema
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // calcula permissão no client para evitar mismatch de hidratação
    const allowed = hasPermissao("cargos", "visualizar") || hasPermissao("cargos", "criar") || hasPermissao("adm", "admin");
    setCanView(allowed);
    if (!allowed) return;
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const parsed = raw ? JSON.parse(raw) : null;
      const detected = parsed?.EmpresaId || parsed?.empresa?.id || null;
      if (detected) setEmpresaId(String(detected));
    } catch {}
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

  const fetchCargos = async () => {
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") : "";
      const url = `${BASE_URL}/gestao/cargos/empresa/${empresaId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        setCargos([]);
      } else {
        const data = await res.json();
        setCargos(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Erro ao buscar cargos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView && empresaId) {
      fetchCargos();
    }
  }, [canView, empresaId]);

  const criarCargo = async () => {
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") : "";
      
      // ✅ Garantir que permissões básicas estejam sempre presentes
      const permissoesCompletas = {
        tarefas: ["visualizar", "criar"], // ✅ Sempre permitir criar tarefas
        clientes: ["visualizar"], // ✅ Sempre permitir visualizar clientes
        ...permissoes // ✅ Permissões customizadas sobrescrevem as básicas
      };
      
      await fetch(`${BASE_URL}/gestao/cargos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ nome, descricao, permissoes: permissoesCompletas })
      });
      
      setModalAberto(false);
      setNome("");
      setDescricao("");
      setPermissoes({});
      fetchCargos();
    } catch (err) {
      console.error("Erro ao criar cargo:", err);
    }
  };

  if (canView === null) {
    return <></>;
  }

  if (!canView) {
    return <>
      <PrincipalSidebar />
      <div className={styles.container}><h2>Acesso negado.</h2></div>
    </>;
  }

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.container}>
        {/* Header com título e botão */}
        <div className={styles.headerRow}>
          <h1 className={styles.headerTitle}>Gestão de Cargos</h1>
          {(hasPermissao("cargos", "criar") || hasPermissao("adm", "admin")) && (
            <button className={styles.buttonNovo} onClick={() => setModalAberto(true)}>
              <FaUserTie className={styles.icon} />
              Novo
            </button>
          )}
        </div>

        <div className={styles.searchWrapper}>
          <input
            type="text"
            placeholder="Buscar por Nome"
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            className={styles.filterInput}
          />
        </div>
        <table className={styles.table}>
          <thead>
            <tr className={styles.tableHeaderRow}>
              <th className={styles.th}>ID</th>
              <th className={styles.th}>Nome</th>
              <th className={styles.th}>Descrição</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className={styles.tableLoadingCell}>
                  <SpaceLoader size={64} label="Carregando cargos..." showText={true} minHeight={120} />
                </td>
              </tr>
            ) : (
              cargos.filter(c => c.nome.toLowerCase().includes(filtro.toLowerCase())).map((cargo, idx) => (
                <tr key={cargo.id}>
                  <td className={styles.td}>{idx + 1}</td>
                  <td 
                    className={`${styles.td} ${styles.linkTd}`} 
                    onClick={() => window.location.href = `/gestao/cargos/${cargo.id}`}
                  >
                    {cargo.nome}
                  </td>
                  <td className={styles.td}>{cargo.descricao}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {modalAberto && (
          <div className={`${styles.modalOverlay} ${isLight ? styles.modalOverlayLight : styles.modalOverlayDark}`}>
            <div className={`${styles.modalContent} ${isLight ? styles.modalContentLight : styles.modalContentDark}`}>
              {/* Header */}
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>
                  Novo Cargo
                </h2>
                <button onClick={() => setModalAberto(false)} className={styles.closeButton}>
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
                    onChange={e => setNome(e.target.value)}
                    className={styles.inputField}
                    placeholder="Digite o nome do cargo"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="descricao" className={styles.label}>
                    Descrição
                  </label>
                  <input
                    id="descricao"
                    type="text"
                    value={descricao}
                    onChange={e => setDescricao(e.target.value)}
                    className={styles.inputField}
                    placeholder="Digite a descrição do cargo"
                  />
                </div>
              </div>

              {/* Botões */}
              <div className={styles.modalActions}>
                <button onClick={() => setModalAberto(false)} className={styles.btnCancel}>
                  Cancelar
                </button>
                <button onClick={criarCargo} className={styles.btnPrimary}>
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