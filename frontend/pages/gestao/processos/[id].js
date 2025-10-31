import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import PrincipalSidebar from "../../../components/onety/principal/PrincipalSidebar";
import { FaEnvelope, FaFileAlt } from "react-icons/fa";
import styles from "../../../styles/gestao/ProcessosDetalhes.module.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import EmailTemplateModal from "../../../components/gestao/EmailTemplateModal";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const IconLixeira = ({ size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
    <path fill="#F44336" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z" />
  </svg>
);


const IconChecklist = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconEmail = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const IconFile = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

const tipoIcone = (tipo) => {
  switch (tipo) {
    case "Checklist":
      return <IconChecklist />;
    case "Enviar e-mail":
      return <IconEmail />;
    default:
      return <IconFile />;
  }
};

export default function ProcessoDetalhes() {
  const router = useRouter();
  const id = router.query?.id;

  const [processo, setProcesso] = useState(null);
  const [atividades, setAtividades] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [atividadeEditando, setAtividadeEditando] = useState(null);

  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("Checklist");
  const [tipoCancelamento, setTipoCancelamento] = useState("Com justificativa");

  const [mostrarModalSub, setMostrarModalSub] = useState(false);
  const [selecionados, setSelecionados] = useState([]);
  const [todosProcessos, setTodosProcessos] = useState([]);
  const [subprocessos, setSubprocessos] = useState([]);
  const [descricao, setDescricao] = useState("");
  const [modalEditarProcessoAberto, setModalEditarProcessoAberto] = useState(false);
  const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
  const [emailTemplateModalAberto, setEmailTemplateModalAberto] = useState(false);
  
  const fetchAtividades = async () => {
    if (!id) return;
    
    const token = typeof window !== "undefined" 
      ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
      : "";
    const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
    const userData = rawUserData ? JSON.parse(rawUserData) : {};
    const empresaId = userData?.EmpresaId;
    
    if (!empresaId) {
      console.error("EmpresaId não encontrado no storage");
      return;
    }
    
    try {
      const url = `${BASE_URL}/gestao/processos/atividades/${id}`;
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
      setAtividades(data);
    } catch (err) {
      console.error("Erro ao buscar atividades:", err);
    }
  };

  useEffect(() => {
    if (!id) return;

    const token = typeof window !== "undefined" 
      ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
      : "";
    const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
    const userData = rawUserData ? JSON.parse(rawUserData) : {};
    const empresaId = userData?.EmpresaId;
    
    if (!empresaId || !token) return;

    const fetchProcesso = async () => {
      try {
        const url = `${BASE_URL}/gestao/processos/${id}`;
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
        setProcesso(data);
      } catch (err) {
        console.error("Erro ao buscar processo:", err);
      }
    };

    fetchProcesso();
    fetchAtividades();

    const fetchTodosProcessos = async () => {
      try {
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
        const filtrados = data.filter(
          (p) => !p.processo_pai_id && p.id !== Number(id)
        );
        setTodosProcessos(filtrados);
      } catch (err) {
        console.error("Erro ao carregar processos:", err);
      }
    };

    fetchTodosProcessos();

    const fetchSubprocessos = async () => {
      try {
        const url = `${BASE_URL}/gestao/processos/${id}/subprocessos`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Empresa-Id": empresaId.toString()
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const lista = await response.json();

        const completos = await Promise.all(
          lista.map(async (sub) => {
            const atividadesUrl = `${BASE_URL}/gestao/processos/atividades/${sub.id}`;
            const atividadesResponse = await fetch(atividadesUrl, {
              headers: {
                Authorization: `Bearer ${token}`,
                "X-Empresa-Id": empresaId.toString()
              },
            });
            
            if (!atividadesResponse.ok) {
              throw new Error(`HTTP error! status: ${atividadesResponse.status}`);
            }
            
            const atividadesData = await atividadesResponse.json();
            return {
              ...sub,
              atividades: atividadesData,
            };
          })
        );

        setSubprocessos(completos);
      } catch (err) {
        console.error("Erro ao buscar subprocessos:", err);
      }
    };

    fetchSubprocessos();

  }, [id]);

  const [departamentos, setDepartamentos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    const token = typeof window !== "undefined" 
      ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
      : "";
    const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
    const userData = rawUserData ? JSON.parse(rawUserData) : {};
    const empresaId = userData?.EmpresaId;

    if (!empresaId || !token) return;

    const fetchDepartamentos = async () => {
      try {
        const url = `${BASE_URL}/gestao/departamentos/empresa/${empresaId}/nomes`;
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

    fetchDepartamentos();
    fetchUsuarios();
  }, []);


  const normalizarOrdem = async () => {
    const novaOrdem = atividades
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((atividade, index) => ({
        ...atividade,
        ordem: index + 1,
      }));

    setAtividades(novaOrdem);

    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      await Promise.all(
        novaOrdem.map((a) =>
          fetch(`${BASE_URL}/gestao/processos/atividades/${a.id}/ordem`, {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
              "X-Empresa-Id": empresaId.toString()
            },
            body: JSON.stringify({ novaOrdem: a.ordem }),
          })
        )
      );

      await fetchAtividades();
    } catch (error) {
      console.error("Erro ao normalizar ordem:", error);
    }
  };

  const adicionarAtividade = async () => {
    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const novaAtividade = {
        processoId: id,
        ordem: atividades.length + 1,
        tipo,
        texto,
        tipoCancelamento,
        descricao,
      };

      const url = `${BASE_URL}/gestao/processos/atividades`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Empresa-Id": empresaId.toString()
        },
        body: JSON.stringify(novaAtividade),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setModalAberto(false);
      setTexto("");
      setTipo("Checklist");
      setTipoCancelamento("Com justificativa");

      await fetchAtividades();
    } catch (err) {
      console.error("Erro ao adicionar atividade:", err);
    }
  };

  const excluirAtividade = async (atividadeId) => {
    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const url = `${BASE_URL}/gestao/processos/atividades/${atividadeId}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Empresa-Id": empresaId.toString()
        },
      });
      
      if (!response.ok) {
        const data = await response.json();
        if (data.message?.includes("vinculada a tarefas")) {
          toast.error("Esta atividade está vinculada a tarefas e não pode ser excluída.");
        } else {
          toast.error("Erro ao excluir atividade.");
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      setAtividades((prev) => prev.filter((a) => a.id !== atividadeId));
      toast.success("Atividade excluída com sucesso!");
    } catch (err) {
      console.error("Erro ao excluir atividade:", err);
    }
  };


  const trocarOrdem = async (atividadeId, direcao) => {
    const indexAtual = atividades.findIndex((a) => a.id === atividadeId);
    const novoIndex = direcao === "up" ? indexAtual - 1 : indexAtual + 1;

    if (novoIndex < 0 || novoIndex >= atividades.length) return;

    const atividadeAtual = atividades[indexAtual];
    const atividadeAlvo = atividades[novoIndex];

    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      // Swapping ordens
      await Promise.all([
        fetch(`${BASE_URL}/gestao/processos/atividades/${atividadeAtual.id}/ordem`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Empresa-Id": empresaId.toString()
          },
          body: JSON.stringify({ novaOrdem: atividadeAlvo.ordem }),
        }),
        fetch(`${BASE_URL}/gestao/processos/atividades/${atividadeAlvo.id}/ordem`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Empresa-Id": empresaId.toString()
          },
          body: JSON.stringify({ novaOrdem: atividadeAtual.ordem }),
        }),
      ]);

      await fetchAtividades();
    } catch (error) {
      console.error("Erro ao trocar ordem:", error);
    }
  };


  const atualizarOrdem = async (atividadeId, novaOrdem) => {
    try {
      const token = typeof window !== "undefined" 
        ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
        : "";
      const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
      const userData = rawUserData ? JSON.parse(rawUserData) : {};
      const empresaId = userData?.EmpresaId;
      
      if (!empresaId) {
        console.error("EmpresaId não encontrado no storage");
        return;
      }
      
      const url = `${BASE_URL}/gestao/processos/atividades/${atividadeId}/ordem`;
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Empresa-Id": empresaId.toString()
        },
        body: JSON.stringify({ novaOrdem }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const atualizada = atividades.map((a) =>
        a.id === atividadeId ? { ...a, ordem: novaOrdem } : a
      );
      setAtividades(atualizada);

      await normalizarOrdem();
    } catch (error) {
      console.error("Erro ao atualizar ordem:", error);
    }
  };

  // Tema light/dark compartilhado pelos modais
  const [isLight, setIsLight] = useState(false);
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

  const subatendimentoModal = mostrarModalSub && (
    <div className={`${styles.modalOverlay} ${isLight ? styles.modalOverlayLight : ''}`} style={{ zIndex: 2000 }}>
      <div className={`${styles.modalBox} ${styles.modalSubprocesso} ${isLight ? styles.modalBoxLight : ''}`}>
        <h3>Selecionar Subatendimentos</h3>
        <p>Escolha processos existentes:</p>

        <select
          onChange={(e) => {
            const selectedId = parseInt(e.target.value);
            if (!selecionados.includes(selectedId)) {
              setSelecionados((prev) => [...prev, selectedId]);
            }
            e.target.value = ""; // limpa o select
          }}
          className={styles.input}
        >
          <option value="">Selecione um processo</option>
          {todosProcessos
            .filter(
              (p) =>
                !selecionados.includes(p.id) &&
                !subprocessos.some((sub) => sub.id === p.id) // filtro para excluir subprocessos já vinculados
            )
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.departamento}: {p.nome}
              </option>
            ))}
        </select>


        {/* Lista os já selecionados */}
        <ul className={styles.listSubprocessos}>
          {selecionados.length > 0 &&
            selecionados.map((id) => {
              const processo = todosProcessos.find((p) => p.id === id);
              return (
                <li key={id}>
                  {processo?.departamento}: {processo?.nome}
                  <button
                    onClick={() =>
                      setSelecionados((prev) => prev.filter((pid) => pid !== id))
                    }
                    className={styles.buttonDanger}
                  >
                    Remover
                  </button>
                </li>
              );
            })}
        </ul>

        <div className={styles.modalActions}>
          <button
            onClick={() => setMostrarModalSub(false)}
            className={`${styles.modalButton} ${styles.modalButtonCancel}`}
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              try {
                const token = typeof window !== "undefined" 
                  ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
                  : "";
                const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
                const userData = rawUserData ? JSON.parse(rawUserData) : {};
                const empresaId = userData?.EmpresaId;
                
                if (!empresaId) {
                  console.error("EmpresaId não encontrado no storage");
                  return;
                }
                
                for (const subId of selecionados) {
                  await fetch(`${BASE_URL}/gestao/processos/vincular-subprocesso`, {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${token}`,
                      "Content-Type": "application/json",
                      "X-Empresa-Id": empresaId.toString()
                    },
                    body: JSON.stringify({
                      processoPaiId: Number(id),
                      processoFilhoId: subId,
                    }),
                  });
                }
                setMostrarModalSub(false);
                setSelecionados([]);
                router.reload();
              } catch (err) {
                console.error("Erro ao adicionar subprocessos:", err);
              }
            }}
            className={`${styles.modalButton} ${styles.modalButtonSave}`}
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );

  const modalAtividade = (
    <div className={`${styles.modalOverlay} ${isLight ? styles.modalOverlayLight : ''}`} style={{ zIndex: 2000 }}>
      <div className={`${styles.modalBox} ${isLight ? styles.modalBoxLight : ''}`}>
        <h3>Nova Atividade</h3>

        <label>Tipo:</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={styles.input}>
          <option value="Checklist">Checklist</option>
          <option value="Enviar e-mail">Enviar e-mail</option>
          <option value="Anexos sem validação">Anexos sem validação</option>
        </select>

        <label>Texto:</label>
        <input type="text" value={texto} onChange={(e) => setTexto(e.target.value)} className={styles.input} />

        <label>Descrição:</label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className={`${styles.input} ${styles.textareaSmall}`}
          placeholder="Descreva mais detalhadamente essa atividade..."
        />

        <label>Tipo de cancelamento:</label>
        <select value={tipoCancelamento} onChange={(e) => setTipoCancelamento(e.target.value)} className={styles.input}>
          <option>Com justificativa</option>
          <option>Sem justificativa</option>
          <option>Sem cancelamento</option>
        </select>

        <div className={styles.modalActions}>
          <button onClick={() => setModalAberto(false)} className={`${styles.modalButton} ${styles.modalButtonCancel}`}>Cancelar</button>
          <button onClick={adicionarAtividade} className={`${styles.modalButton} ${styles.modalButtonSave}`}>Salvar</button>
        </div>
      </div>
    </div>
  );

  const modalEditarAtividade = atividadeEditando && (
    <div className={`${styles.modalOverlay} ${isLight ? styles.modalOverlayLight : ''}`} style={{ zIndex: 2000 }}>
      <div className={`${styles.modalBox} ${isLight ? styles.modalBoxLight : ''}`}>
        <h3>Editar Atividade</h3>

        <label>Texto:</label>
        <input
          type="text"
          value={atividadeEditando.texto}
          onChange={(e) =>
            setAtividadeEditando({ ...atividadeEditando, texto: e.target.value })
          }
          className={styles.input}
        />

        <label>Descrição:</label>
        <textarea
          value={atividadeEditando.descricao}
          onChange={(e) =>
            setAtividadeEditando({ ...atividadeEditando, descricao: e.target.value })
          }
          className={`${styles.input} ${styles.textareaSmall}`}
        />

        <label>Tipo Cancelamento:</label>
        <select
          value={atividadeEditando.tipoCancelamento}
          onChange={(e) =>
            setAtividadeEditando({
              ...atividadeEditando,
              tipoCancelamento: e.target.value,
            })
          }
          className={styles.input}
        >
          <option>Com justificativa</option>
          <option>Sem justificativa</option>
          <option>Sem cancelamento</option>
        </select>

        <div className={styles.modalActions}>
          <button
            onClick={() => setAtividadeEditando(null)}
            className={`${styles.modalButton} ${styles.modalButtonCancel}`}
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              try {
                const token = typeof window !== "undefined" 
                  ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
                  : "";
                const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
                const userData = rawUserData ? JSON.parse(rawUserData) : {};
                const empresaId = userData?.EmpresaId;
                
                if (!empresaId) {
                  console.error("EmpresaId não encontrado no storage");
                  return;
                }
                
                const url = `${BASE_URL}/gestao/processos/atividades/${atividadeEditando.id}`;
                const response = await fetch(url, {
                  method: "PUT",
                  headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                    "X-Empresa-Id": empresaId.toString()
                  },
                  body: JSON.stringify({
                    texto: atividadeEditando.texto,
                    descricao: atividadeEditando.descricao,
                    tipoCancelamento: atividadeEditando.tipoCancelamento,
                  }),
                });
                
                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                setAtividades((prev) => prev.map(a => 
                  a.id === atividadeEditando.id 
                    ? { ...a, ...atividadeEditando } 
                    : a
                ));
                setAtividadeEditando(null);
              } catch (err) {
                console.error("Erro ao editar atividade:", err);
              }
            }}
            className={`${styles.modalButton} ${styles.modalButtonSave}`}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );

  // Tema light/dark para o modal de edição (usa o mesmo estado acima)

  const modalEditarProcesso = modalEditarProcessoAberto && (
    <div className={`${styles.modalOverlay} ${isLight ? styles.modalOverlayLight : ''}`} style={{ zIndex: 2000 }}>
      <div className={`${styles.modalBox} ${isLight ? styles.modalBoxLight : ''}`}>
        <h3>Alterar Processo</h3>

        <label>Nome:</label>
        <input type="text" value={processo.nome} onChange={(e) => setProcesso({ ...processo, nome: e.target.value })} className={styles.input} />

        <label>Dias Meta:</label>
        <input type="number" value={processo.diasMeta} onChange={(e) => setProcesso({ ...processo, diasMeta: e.target.value })} className={styles.input} />

        <label>Dias Prazo:</label>
        <input type="number" value={processo.diasPrazo} onChange={(e) => setProcesso({ ...processo, diasPrazo: e.target.value })} className={styles.input} />

        <label>Departamento:</label>
        <select value={processo.departamentoId} onChange={(e) => setProcesso({ ...processo, departamentoId: e.target.value })} className={styles.input}>
          <option value="">Selecione</option>
          {departamentos.map(dep => (
            <option key={dep.id} value={dep.id}>{dep.nome}</option>
          ))}
        </select>

        <label>Responsável:</label>
        <select value={processo.responsavelId} onChange={(e) => setProcesso({ ...processo, responsavelId: e.target.value })} className={styles.input}>
          <option value="">Selecione</option>
          {usuarios.map(u => (
            <option key={u.usuario_id} value={u.usuario_id}>{u.full_name}</option>
          ))}
        </select>

        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxItem}>
            <input
              type="checkbox"
              checked={processo.notificarAbertura}
              onChange={(e) => setProcesso({ ...processo, notificarAbertura: e.target.checked })}
            />
            &nbsp; Notificar ao Abrir
          </label>
          <label className={styles.checkboxItem}>
            <input
              type="checkbox"
              checked={processo.notificarFinalizacao}
              onChange={(e) => setProcesso({ ...processo, notificarFinalizacao: e.target.checked })}
            />
            &nbsp; Notificar ao Finalizar
          </label>
        </div>

        <label className={styles.checkboxItem}>
          <input
            type="checkbox"
            checked={processo.finalizaAntesSub}
            onChange={(e) => setProcesso({ ...processo, finalizaAntesSub: e.target.checked })}
          />
          &nbsp; Pode finalizar antes dos subatendimentos
        </label>

        <label className={styles.checkboxItem}>
          <input
            type="checkbox"
            checked={processo.finalizaAoConcluirAtividades}
            onChange={(e) => setProcesso({ ...processo, finalizaAoConcluirAtividades: e.target.checked })}
          />
          &nbsp; Finalizar ao concluir todas as atividades
        </label>


        <div className={styles.modalActions}>
          <button
            onClick={() => setModalEditarProcessoAberto(false)}
            className={`${styles.modalButton} ${styles.modalButtonCancel}`}
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              try {
                const token = typeof window !== "undefined" 
                  ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
                  : "";
                const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
                const userData = rawUserData ? JSON.parse(rawUserData) : {};
                const empresaId = userData?.EmpresaId;
                
                if (!empresaId) {
                  console.error("EmpresaId não encontrado no storage");
                  toast.error("Erro ao atualizar processo.");
                  return;
                }
                
                const url = `${BASE_URL}/gestao/processos/${processo.id}`;
                const response = await fetch(url, {
                  method: "PUT",
                  headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                    "X-Empresa-Id": empresaId.toString()
                  },
                  body: JSON.stringify(processo),
                });
                
                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                toast.success("Processo atualizado com sucesso!");
                setModalEditarProcessoAberto(false);
              } catch (err) {
                console.error("Erro ao salvar processo:", err);
                toast.error("Erro ao atualizar processo.");
              }
            }}
            className={`${styles.modalButton} ${styles.modalButtonSave}`}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );



  return (
    <>
      <PrincipalSidebar />
      <div className={styles.container}>

        {/* COLUNA 1: ATENDIMENTO PRINCIPAL (à esquerda) */}
        <div className={styles.colLeft}>
          <div className={styles.processoPrincipal}>
             <div className={styles.processoNome}>
              <strong>Atendimento Principal:</strong>{" "}
              <span
                onClick={!processo?.padraoFranqueadora ? () => setModalEditarProcessoAberto(true) : undefined}
                className={!processo?.padraoFranqueadora ? styles.editavel : styles.naoEditavel}
              >
                {processo?.nome}
              </span>
              {!processo?.padraoFranqueadora && (
                <button
                  title="Excluir processo"
                  onClick={async () => {
                    if (window.confirm("Tem certeza que deseja excluir esse processo? Os subprocessos ficarão órfãos.")) {
                      try {
                        const token = typeof window !== "undefined" 
                          ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
                          : "";
                        const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
                        const userData = rawUserData ? JSON.parse(rawUserData) : {};
                        const empresaId = userData?.EmpresaId;
                        
                        if (!empresaId) {
                          console.error("EmpresaId não encontrado no storage");
                          toast.error("Erro ao excluir processo.");
                          return;
                        }
                        
                        const url = `${BASE_URL}/gestao/processos/${processo.id}`;
                        const response = await fetch(url, {
                          method: "DELETE",
                          headers: {
                            Authorization: `Bearer ${token}`,
                            "X-Empresa-Id": empresaId.toString()
                          },
                        });
                        
                        if (!response.ok) {
                          throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        
                        toast.success("Processo excluído com sucesso!");
                        router.push("/gestao/processos");
                      } catch (err) {
                        toast.error("Erro ao excluir processo.");
                        console.error("Erro ao excluir processo:", err);
                      }
                    }
                  }}
                  className={styles.iconeLixeira}
                >
                  <IconLixeira />
                </button>
              )}
            </div>
            <div className={styles.processoInfo}><strong>Data Referência:</strong> Data Atual &nbsp; | &nbsp; <strong>Meta:</strong> {processo?.diasMeta} &nbsp; | &nbsp; <strong>Prazo:</strong> {processo?.diasPrazo}</div>
            <div className={styles.processoInfo}><strong>Departamento:</strong> {processo?.departamento} &nbsp; | &nbsp; <strong>Responsável:</strong> {processo?.responsavel}</div>
          </div>
          <div className={styles.botoesAcao}>
              {!processo?.padraoFranqueadora && (
                <button
                  onClick={() => setModalAberto(true)}
                  className={styles.botaoAtividade}
                >
                  + Atividade
                </button>
              )}
              {!processo?.padraoFranqueadora && (
                <button
                  onClick={normalizarOrdem}
                  className={styles.botaoNormalizar}
                >
                  Normalizar Ordem
                </button>
              )}
            </div>


            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Texto</th>
                  <th>Tipo Cancelamento</th>
                  {!processo?.padraoFranqueadora && (
                    <>
                      <th>Mover</th>
                      <th>Ações</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {atividades.map((a) => (
                  <tr key={a.id}>
                    <td className={styles.iconCell}>
                      <div className={styles.iconCellCol}>
                        {tipoIcone(a.tipo)}
                        <span className={styles.ordemBadge}>#{a.ordem}</span>
                      </div>
                    </td>
                    <td className={styles.textoCell}>
                      <div className={styles.textoTitulo}>{a.texto}</div>
                      {a.descricao && (
                        <div className={styles.textoDescricao}>
                          {a.descricao}
                        </div>
                      )}
                    </td>
                    <td>{a.tipoCancelamento}</td>
                    {!processo?.padraoFranqueadora && (
                      <td className={styles.iconCell}>
                        <button onClick={() => trocarOrdem(a.id, "up")} title="Subir" className={`${styles.iconeAcao} ${styles.strokeLow}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48"><path fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="m13 30l12-12l12 12" /></svg>
                        </button>
                        <button onClick={() => trocarOrdem(a.id, "down")} title="Descer" className={`${styles.iconeAcao} ${styles.strokeLow}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48"><path fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M36 18L24 30L12 18" /></svg>
                        </button>
                      </td>
                    )}
                    {!processo?.padraoFranqueadora && (
                      <td className={styles.iconCell}>
                        <div className={styles.iconesAcaoContainer}>
                          {a.tipo === "Enviar e-mail" && (
                            <button
                              title="Configurar Template de E-mail"
                              onClick={() => {
                                setAtividadeSelecionada(a);
                                setEmailTemplateModalAberto(true);
                              }}
                              className={`${styles.iconeAcao} ${styles.iconEmailAccent}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </button>
                          )}
                          <button
                            title="Editar"
                            onClick={() => setAtividadeEditando(a)}
                            className={styles.iconeAcao}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="none" stroke="var(--titan-text-low)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m14.304 4.844l2.852 2.852M7 7H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4.5m2.409-9.91a2.017 2.017 0 0 1 0 2.853l-6.844 6.844L8 14l.713-3.565l6.844-6.844a2.015 2.015 0 0 1 2.852 0Z" /></svg>
                          </button>
                          <button onClick={() => excluirAtividade(a.id)} title="Excluir" className={`${styles.iconeAcao} ${styles.fillError}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z" /></svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
        </div>

        {/* COLUNA 2: SUBATENDIMENTOS (à direita) */}
        <div className={styles.colRight}>
              {!processo?.padraoFranqueadora && (
                <button
                  onClick={() => setMostrarModalSub(true)}
                  className={styles.botaoSubprocesso}
                >
                  + Subatendimento
                </button>
              )}

          {subprocessos.map((sub) => (
            <div
              key={sub.id}
              className={styles.subprocessoCard}
            >
              <div className={styles.subprocessoHeader}>
                <div className={styles.subprocessoNome}>{sub.nome}</div>
                {!processo?.padraoFranqueadora && (
                  <button
                    onClick={async () => {
                      try {
                        const token = typeof window !== "undefined" 
                          ? (localStorage.getItem("token") || sessionStorage.getItem("token") || "") 
                          : "";
                        const rawUserData = typeof window !== "undefined" ? localStorage.getItem("userData") : null;
                        const userData = rawUserData ? JSON.parse(rawUserData) : {};
                        const empresaId = userData?.EmpresaId;
                        
                        if (!empresaId) {
                          console.error("EmpresaId não encontrado no storage");
                          return;
                        }
                        
                        const url = `${BASE_URL}/gestao/processos/vincular-subprocesso/${id}/${sub.id}`;
                        const response = await fetch(url, {
                          method: "DELETE",
                          headers: {
                            Authorization: `Bearer ${token}`,
                            "X-Empresa-Id": empresaId.toString()
                          },
                        });
                        
                        if (!response.ok) {
                          throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        
                        setSubprocessos((prev) => prev.filter((s) => s.id !== sub.id));
                      } catch (err) {
                        console.error("Erro ao desvincular subprocesso:", err);
                      }
                    }}
                    className={styles.buttonDanger}
                  >
                    Desvincular
                  </button>
                )}
              </div>

              <ul className={styles.subprocessoAtividades}>
                {sub.atividades.map((a) => (
                  <li key={a.id}>
                    {tipoIcone(a.tipo)} &nbsp; {a.texto}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {subatendimentoModal}
        {modalAberto && modalAtividade}
        {modalEditarAtividade}
        {modalEditarProcesso}
        
        {/* Modal de Template de E-mail */}
        {emailTemplateModalAberto && atividadeSelecionada && (
          <EmailTemplateModal
            isOpen={emailTemplateModalAberto}
            onClose={() => {
              setEmailTemplateModalAberto(false);
              setAtividadeSelecionada(null);
            }}
            atividadeId={atividadeSelecionada.id}
            processoId={id}
            tipo="processo"
          />
        )}
      </div>
      <ToastContainer />
    </>
  );
}