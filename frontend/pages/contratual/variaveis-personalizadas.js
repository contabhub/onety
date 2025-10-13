import { useEffect, useState } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import styles from "../../styles/contratual/Contratos.module.css";
import stylesVar from "../../styles/contratual/TemplatesVariables.module.css";
import { faArrowLeft, faPencilAlt, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/router";
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Função utilitária para gerar o nome da variável
function gerarNomeVariavel(label) {
  if (!label) return "";
  // Remove acentos
  let nome = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Troca espaços por _
  nome = nome.replace(/\s+/g, "_");
  // Remove caracteres especiais (mantém apenas letras, números e _)
  nome = nome.replace(/[^a-zA-Z0-9_]/g, "");
  // Converte para minúsculo
  nome = nome.toLowerCase();
  // Prefixa com custom.
  return `custom.${nome}`;
}

export default function CustomVariables() {
  const [variables, setVariables] = useState([]);
  const [formData, setFormData] = useState({ label: "", global: 0 });
  const [showModal, setShowModal] = useState(false);
  const [editingVariable, setEditingVariable] = useState(null); // Novo estado para edição
  const [equipeId, setEquipeId] = useState(null);
  const router = useRouter();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";

  const [userRole, setUserRole] = useState("");
  const [filtroGlobal, setFiltroGlobal] = useState("todas"); // "todas", "globais", "locais"

  useEffect(() => {
    const userRaw = localStorage.getItem("userData");
    if (userRaw) {
      const user = JSON.parse(userRaw);
      setEquipeId(user.EmpresaId);
      setUserRole(user.permissoes?.adm ? String(user.permissoes.adm[0]).toLowerCase() : "");
    }
  }, []);

  useEffect(() => {
    if (equipeId && token) loadVariables();
  }, [equipeId]);

  const loadVariables = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/variaveis-personalizadas/${equipeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setVariables(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar variáveis personalizadas:", err);
    }
  };
  
  
  const handleDeleteVariable = async (id) => {
    if (!confirm("Deseja realmente excluir essa variável?")) return;

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/variaveis-personalizadas/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      loadVariables();
    } catch (err) {
      console.error("Erro ao excluir variável:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const nomeVariavelGerado = gerarNomeVariavel(formData.label);

  const openEditModal = (variable) => {
    setEditingVariable(variable);
    setFormData({ label: variable.titulo, global: variable.global ? 1 : 0 });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVariable(null);
    setFormData({ label: "", global: 0 });
  };

  const handleCreateOrUpdateVariable = async (e) => {
    e.preventDefault();
    if (!nomeVariavelGerado.startsWith("custom.")) {
      toast.error('Erro ao gerar o nome da variável.');
      return;
    }
    
    // Garantir que o campo global seja sempre definido
    const globalValue = userRole === "superadmin" ? formData.global : 0;
    
    try {
      if (editingVariable) {
        // Atualizar variável existente
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/variaveis-personalizadas/${editingVariable.id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            variavel: nomeVariavelGerado,
            titulo: formData.label,
            global: globalValue, // Usar o valor garantido
          }),
        });
      } else {
        // Criar nova variável
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/variaveis-personalizadas`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            variavel: nomeVariavelGerado,
            titulo: formData.label,
            empresa_id: equipeId,
            global: globalValue, // Usar o valor garantido
          }),
        });
      }
      setFormData({ label: "", global: 0 });
      setShowModal(false);
      setEditingVariable(null);
      loadVariables();
    } catch (err) {
      console.error("Erro ao salvar variável:", err);
    }
  };
  

  const variablesFiltradas = variables.filter(v => {
    if (filtroGlobal === "globais") return v.global === 1 || v.global === true;
    if (filtroGlobal === "locais") return !v.global;
    return true;
  });

  return (
    <>
      <div className={styles.page}>
        <PrincipalSidebar />
        <div className={styles.pageContent}>
          <div className={styles.pageHeader}>
            <div className={styles.toolbarBox}>
              <div className={styles.toolbarHeader}>
                <span className={styles.title}>Variáveis Personalizadas</span>
                <div className={styles.headerActions}>
                  <button className={styles.button} onClick={() => setShowModal(true)}>
                    Nova Variável
                  </button>
                </div>
              </div>

              {/* Filtros */}
              <div className={styles.filtersRow}>
                <div className={styles.filtersRowBox} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="filtroGlobal"
                      value="todas"
                      checked={filtroGlobal === "todas"}
                      onChange={() => setFiltroGlobal("todas")}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Todas</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="filtroGlobal"
                      value="globais"
                      checked={filtroGlobal === "globais"}
                      onChange={() => setFiltroGlobal("globais")}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Globais</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="filtroGlobal"
                      value="locais"
                      checked={filtroGlobal === "locais"}
                      onChange={() => setFiltroGlobal("locais")}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Locais</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.contentScroll}>

        {variablesFiltradas.length > 0 ? (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome do Campo</th>
                  <th>Variável</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {variablesFiltradas.map((v) => (
                  <tr key={v.id}>
                    <td>{v.titulo}</td>
                    <td><span style={{ fontFamily: 'monospace', color: 'var(--onity-color-text)' }}>{v.variavel}</span></td>
                    <td>
                      <div className={styles.actions}>
                        {/* Mostrar botões de edição para variáveis locais OU se for superadmin */}
                        {(userRole === "superadmin" || !v.global) && (
                          <button className={styles.editIcon} onClick={() => openEditModal(v)} title="Editar Variável">
                            <FontAwesomeIcon icon={faPencilAlt} />
                          </button>
                        )}

                        {/* Mostrar botão de exclusão para variáveis locais OU se for superadmin */}
                        {(userRole === "superadmin" || !v.global) && (
                          <button className={styles.deleteBtn} onClick={() => handleDeleteVariable(v.id)} title="Excluir Variável">
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--onity-icon-secondary)' }}>
            Nenhuma variável encontrada.
          </div>
        )}

          </div>

          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick={false}
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="colored"
            transition={Bounce}
          />
        </div>
      </div>

      {/* Modal de criação */}
      {showModal && (
        <div className={stylesVar.modalOverlay}>
          <div className={stylesVar.modal}>
            <h3 className={stylesVar.subtitle}>{editingVariable ? 'Editar Variável Personalizada' : 'Nova Variável Personalizada'}</h3>
            <form onSubmit={handleCreateOrUpdateVariable} className={stylesVar.form}>
              {/* Apenas campo de rótulo */}
              <label htmlFor="label" style={{ fontWeight: 500, marginBottom: 4, display: 'block' }}>Nome do Campo</label>
              <input
                type="text"
                id="label"
                name="label"
                placeholder="Nome do Campo"
                required
                value={formData.label}
                onChange={handleInputChange}
              />
              {/* Exibe o nome gerado em tempo real */}
              {formData.label && (
                <div className={stylesVar.nomeVariavelPreview}>
                  Nome da variável: <span>{nomeVariavelGerado}</span>
                </div>
              )}

              {/* Checkbox Global apenas para superadmin */}
              {userRole === "superadmin" && (
                <label style={{ display: "block", margin: "10px 0" }}>
                  Tipo da Variável:
                  <select
                    value={formData.global}
                    onChange={e => setFormData(prev => ({ ...prev, global: Number(e.target.value) }))}
                    style={{ marginLeft: 8 }}
                  >
                    <option value={0}>Local</option>
                    <option value={1}>Global</option>
                  </select>
                </label>
              )}

              <div className={stylesVar.modalButtons}>
                <button type="button" className={stylesVar.cancelButton} onClick={closeModal}>Cancelar</button>
                <button type="submit" className={stylesVar.addButton}>{editingVariable ? 'Salvar Alterações' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
