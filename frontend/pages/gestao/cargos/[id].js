import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import PrincipalSidebar from "../../../components/onety/principal/PrincipalSidebar";
import styles from "../../../styles/gestao/CargosPage.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Função utilitária para verificar se é empresa franqueadora
function isFranqueadora() {
  if (typeof window === "undefined") return false;

  // Primeiro tenta pegar do tipoEmpresa
  let tipoEmpresa = sessionStorage.getItem("tipoEmpresa");

  // Se não tiver, tenta buscar no empresasBackup
  if (!tipoEmpresa) {
    try {
      const empresaId = sessionStorage.getItem("empresaId");
      const empresasBackup = sessionStorage.getItem("empresasBackup");

      if (empresaId && empresasBackup) {
        const empresas = JSON.parse(empresasBackup);
        const empresaAtual = empresas.find((e) => e.id.toString() === empresaId);
        tipoEmpresa = empresaAtual?.tipo_empresa || "franqueado";

        // Salva para próximas consultas
        sessionStorage.setItem("tipoEmpresa", tipoEmpresa || "");
      }
    } catch (error) {
      // Silenciar erro
    }
  }

  return tipoEmpresa === "franqueadora";
}

const PERMISSOES_GRUPOS = [
  {
    grupo: "adm",
    label: "ADM",
    acoes: ["admin"]
  },
  {
    grupo: "clientes",
    label: "Clientes",
    acoes: ["visualizar", "criar", "editar", "excluir"]
  },
  {
    grupo: "usuarios",
    label: "Usuários",
    acoes: ["visualizar", "criar", "editar", "excluir"]
  },
  {
    grupo: "cargos",
    label: "Cargos",
    acoes: ["visualizar", "criar", "editar", "excluir"]
  },
  {
    grupo: "departamentos",
    label: "Departamentos",
    acoes: ["visualizar", "criar", "editar", "excluir"]
  },
  {
    grupo: "processos",
    label: "Processos",
    acoes: ["visualizar", "criar", "editar", "excluir"]
  },
  {
    grupo: "tarefas",
    label: "Tarefas",
    acoes: ["visualizar", "criar", "editar", "excluir"]
  },
  {
    grupo: "obrigacoes",
    label: "Obrigações",
    acoes: ["visualizar", "criar", "editar", "excluir"]
  },
  {
    grupo: "certificados",
    label: "Certificados",
    acoes: ["visualizar", "criar", "download", "excluir", "substituir"]
  },
  {
    grupo: "relatorios",
    label: "Relatórios",
    acoes: ["visualizar"]
  },
  {
    grupo: "anjos",
    label: "Anjos",
    acoes: ["visualizar", "criar", "editar", "excluir"]
  }
  // Adicione outros grupos/ações conforme necessário
];

export default function CargoDetalhe() {
  const router = useRouter();
  const { id } = router.query;
  const [aba, setAba] = useState("info");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [permissoes, setPermissoes] = useState({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [ready, setReady] = useState(false);
  const [empresaId, setEmpresaId] = useState(null);

  // ✅ Estado para detecção de tema
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    if (id) setReady(true);
    // obter empresaId do storage
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const parsed = raw ? JSON.parse(raw) : null;
      const detected = parsed?.EmpresaId || parsed?.empresa?.id || null;
      if (detected) setEmpresaId(String(detected));
    } catch {}
  }, [id]);

  useEffect(() => {
    if (!ready || !empresaId) return;
    fetchCargo();
    // eslint-disable-next-line
  }, [ready, empresaId]);

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

  const fetchCargo = async () => {
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") : "";
      // Buscar todos os cargos da empresa e filtrar pelo ID
      const res = await fetch(`${BASE_URL}/gestao/cargos/empresa/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Erro ao buscar cargo");
      const lista = await res.json();
      const data = Array.isArray(lista) ? lista.find((c) => String(c.id) === String(id)) : null;
      if (!data) throw new Error("Erro ao buscar cargo");
      
      // ✅ Garantir que permissões básicas estejam sempre presentes
      const permissoesCarregadas = data.permissoes || {};
      const permissoesCompletas = {
        tarefas: ["visualizar", "criar"], // ✅ Sempre permitir criar tarefas
        clientes: ["visualizar"], // ✅ Sempre permitir visualizar clientes
        ...permissoesCarregadas // ✅ Permissões do banco sobrescrevem as básicas
      };
      
      setNome(data.nome);
      setDescricao(data.descricao);
      setPermissoes(permissoesCompletas);
    } catch (err) {
      console.error("Erro ao buscar cargo:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePermissaoChange = (grupo, acao, checked) => {
    setPermissoes(prev => {
      if (checked) {
        return { ...prev, [grupo]: [...(prev[grupo] || []), acao] };
      } else {
        return { ...prev, [grupo]: (prev[grupo] || []).filter(a => a !== acao) };
      }
    });
  };

  const isADM = permissoes.adm && permissoes.adm.includes("admin");

  const handleADMChange = (checked) => {
    if (checked) {
      // Marca todas as permissões
      const todasPerms = {};
      PERMISSOES_GRUPOS.forEach(g => {
        todasPerms[g.grupo] = [...g.acoes];
      });
      setPermissoes(todasPerms);
    } else {
      // ✅ Remove todas as permissões EXCETO as básicas de tarefas
      setPermissoes({
        tarefas: ["visualizar", "criar"], // ✅ Sempre manter permissão para criar tarefas
        clientes: ["visualizar"] // ✅ Sempre manter permissão para visualizar clientes
      });
    }
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") : "";
      
      // ✅ Garantir que permissões básicas estejam sempre presentes
      const permissoesCompletas = {
        tarefas: ["visualizar", "criar"], // ✅ Sempre permitir criar tarefas
        clientes: ["visualizar"], // ✅ Sempre permitir visualizar clientes
        ...permissoes // ✅ Permissões customizadas sobrescrevem as básicas
      };
      
      const res = await fetch(`${BASE_URL}/gestao/cargos/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ nome, descricao, permissoes: permissoesCompletas })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("Falha ao salvar cargo:", res.status, errText);
        return;
      }
      await fetchCargo();
    } catch (err) {
      console.error("Erro ao salvar cargo:", err);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!confirm("Tem certeza que deseja excluir este cargo?")) return;
    try {
      const token = typeof window !== "undefined" ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") : "";
      await fetch(`${BASE_URL}/gestao/cargos/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      router.push("/gestao/cargos");
    } catch (err) {
      console.error("Erro ao excluir cargo:", err);
    }
  };

  if (!ready || loading) {
    return <>
      <PrincipalSidebar />
      <div className={styles.container}>Carregando...</div>
    </>;
  }

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.pageTitle}>
            {nome}
          </h2>
        </div>
        <div className={styles.tabsRow}>
          <div className={styles.tabsInline}>
            <div
              onClick={() => setAba("info")}
              className={`${styles.tab} ${aba === "info" ? styles.tabActive : ''}`}
            >
              1. Info
            </div>
            <div
              onClick={() => setAba("permissoes")}
              className={`${styles.tab} ${aba === "permissoes" ? styles.tabActive : ''}`}
            >
              2. Permissões
            </div>
          </div>
        </div>
        {aba === "info" && (
          <div className={styles.infoCard}>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Nome <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                className={styles.inputField}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Descrição
              </label>
              <input
                type="text"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                className={styles.inputField}
              />
            </div>
            <div className={styles.actionsRow}>
              <button onClick={() => router.push("/gestao/cargos")} className={styles.btnSecondary}>
                Todos os cargos
              </button>
              <button onClick={handleSalvar} className={styles.btnPrimary}>
                {salvando ? "Salvando..." : "Salvar"}
              </button>
              <button onClick={handleExcluir} className={styles.btnDanger}>
                Excluir
              </button>
            </div>
          </div>
        )}
        {aba === "permissoes" && (
          <div className={styles.permissionsWrapper}>
            {PERMISSOES_GRUPOS
              .filter(grupo => {
                // Mostrar grupo "anjos" apenas para franqueadoras
                if (grupo.grupo === "anjos") {
                  return isFranqueadora();
                }
                return true;
              })
              .map(grupo => (
              <div key={grupo.grupo} className={styles.permGroupCard}>
                <div className={styles.permGroupHeader}>
                  <span className={styles.permGroupTitle}>
                    {grupo.label}
                  </span>
                </div>
                {grupo.grupo !== "adm" && grupo.acoes.map(acao => {
                  const checked = permissoes[grupo.grupo]?.includes(acao) || false;
                  return (
                    <label
                      key={acao}
                      className={styles.permOption}
                      data-checked={checked ? 'true' : 'false'}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => handlePermissaoChange(grupo.grupo, acao, e.target.checked)}
                      />
                      <span>{acao.charAt(0).toUpperCase() + acao.slice(1)}</span>
                    </label>
                  );
                })}
                {grupo.grupo === "adm" && (
                  <label className={styles.permOption} data-checked={isADM ? 'true' : 'false'}>
                    <input
                      type="checkbox"
                      checked={isADM}
                      onChange={e => handleADMChange(e.target.checked)}
                    />
                    <span>Admin</span>
                  </label>
                )}
              </div>
            ))}
            <div className={styles.permissionsFooter}>
              <button onClick={handleSalvar} className={styles.btnPrimary}>
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
} 