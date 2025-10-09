import { useEffect, useState } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import SpaceLoader from "../../components/onety/menu/SpaceLoader";
import styles from "../../styles/contratual/Signatarios.module.css";
import { useAuthRedirect } from "../../utils/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faPen, faTrash, faPlus } from "@fortawesome/free-solid-svg-icons";
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';


const ITEMS_PER_PAGE = 5;

const initialForm = {
  name: "",
  email: "",
  cpf: "",
  telefone: "",
  birth_date: "",
  funcao_assinatura: "",
};

const opcoesFuncaoAssinatura = [
    'Aprovador',
    'Assinar como parte',
    'Assinar como testemunha',
    'Assinar como administrador',
    'Assinar como avalista',
    'Assinar como contador',
    'Assinar como cedente',
    'Assinar como cessionário',
    'Assinar como contratada',
    'Assinar como contratante',
    'Assinar como devedor',
    'Assinar como emitente',
    'Assinar como outorgante',
    'Assinar como locador',
    'Assinar como locatário',
    'Assinar como outorgado',
    'Assinar como endossante',
    'Assinar como endossatário',
    'Assinar como gestor',
    'Assinar como interveniente',
    'Assinar como parte compradora',
    'Assinar como parte vendedora',
    'Assinar como procurador',
    'Assinar como advogado',
    'Assinar como representante legal',
    'Assinar como responsável solidário',
    'Assinar como validador',
    'Assinar para acusar recebimento',
    'Assinar como segurado',
    'Assinar como proponente',
    'Assinar como corretor'
  ];

export default function SignatariosPage() {
  useAuthRedirect();
  const [signatarios, setSignatarios] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("create"); // 'create' | 'edit'
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [feedback, setFeedback] = useState("");

  // Busca equipe_id do usuário logado
  const getEquipeId = () => {
    const userRaw = (typeof window !== "undefined") ? localStorage.getItem("userData") : null;
    if (!userRaw) return null;
    try {
      const user = JSON.parse(userRaw);
      // Tenta equipe_id primeiro, depois EmpresaId como fallback
      return user.equipe_id || user.EmpresaId;
    } catch {
      return null;
    }
  };

  const fetchSignatarios = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const equipeId = getEquipeId();
      
      if (!token || !equipeId) {
        throw new Error("Usuário não autenticado.");
      }
      
      const url = `${process.env.NEXT_PUBLIC_API_URL}/contratual/lista-signatarios/empresa/${equipeId}`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error(`Erro ao buscar signatários: ${res.status}`);
      }
      
      const data = await res.json();
      const signatariosArray = Array.isArray(data) ? data : [];
      setSignatarios(signatariosArray);
      setFiltered(signatariosArray);
    } catch (err) {
      setError(err.message);
      setSignatarios([]);
      setFiltered([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSignatarios();
  }, []);

  // Inicializar filtered com array vazio se undefined
  useEffect(() => {
    if (filtered === undefined) {
      setFiltered([]);
    }
  }, [filtered]);

  // Filtro/search
  useEffect(() => {
    if (!signatarios || !Array.isArray(signatarios)) {
      setFiltered([]);
      return;
    }
    
    let filteredList = signatarios.filter(s =>
      (s.nome && s.nome.toLowerCase().includes(search.toLowerCase())) ||
      (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
      (s.cpf && s.cpf.includes(search)) ||
      (s.funcao_assinatura && s.funcao_assinatura.toLowerCase().includes(search.toLowerCase()))
    );
    setFiltered(filteredList);
    setCurrentPage(1);
  }, [search, signatarios]);

  // Paginação
  const totalPages = Math.ceil((filtered || []).length / ITEMS_PER_PAGE) || 1;
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const paginated = (filtered || []).slice(startIdx, endIdx);

  // Handlers CRUD
  const handleOpenModal = (type, signatario = null) => {
    setModalType(type);
    setShowModal(true);
    if (type === "edit" && signatario) {
      // Converter data_nascimento para YYYY-MM-DD se existir
      let birthDate = signatario.data_nascimento;
      if (birthDate) {
        // Pode vir como ISO ou Date
        const d = new Date(birthDate);
        birthDate = d.toISOString().slice(0, 10);
      } else {
        birthDate = "";
      }
      // Converter telefone para formato internacional
      let telefone = signatario.telefone || "";
      if (telefone) {
        // Se não começar com +, adicionar +
        if (!telefone.startsWith("+")) {
          telefone = telefone.replace(/\D/g, "");
          // Só adiciona 55 se for um número brasileiro (11 dígitos) sem código de país
          if (telefone.length === 11 && !telefone.startsWith("55")) {
            telefone = "55" + telefone;
          }
          telefone = "+" + telefone;
        }
      } else {
        telefone = "";
      }
      // Garantir que CPF já venha formatado
      let cpf = signatario.cpf || "";
      cpf = mascararCpfInput(cpf);
      
      // Mapear campos do backend para o frontend
      setForm({ 
        name: signatario.nome, // Backend usa 'nome', frontend usa 'name'
        email: signatario.email,
        cpf: cpf,
        telefone: telefone,
        birth_date: birthDate, // Frontend usa 'birth_date'
        funcao_assinatura: signatario.funcao_assinatura
      });
      setEditId(signatario.id);
    } else {
      setForm({ ...initialForm, telefone: "" });
      setEditId(null);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setForm(initialForm);
    setEditId(null);
    setFeedback("");
  };

  const handleChange = e => {
    const { name, value } = e.target;
    if (name === "cpf") {
      setForm(f => ({ ...f, cpf: mascararCpfInput(value) }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  // Handler específico para o telefone (vem do PhoneInput)
  const handlePhoneChange = (value) => {
    setForm(f => ({ ...f, telefone: value || "" }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setFeedback("");
    const token = localStorage.getItem("token");
    const equipeId = getEquipeId();
    if (!token || !equipeId) return setFeedback("Usuário não autenticado.");
    // Validação básica
    if (!form.name || !form.email || !form.cpf || !form.funcao_assinatura) {
      toast.warning("Preencha todos os campos obrigatórios.");
      return;
    }
    try {
      let res;
      // Garantir que birth_date está no formato YYYY-MM-DD
      const dataToSend = { ...form };
      if (dataToSend.birth_date) {
        // Se já está no formato certo, mantém, senão converte
        const d = new Date(dataToSend.birth_date);
        dataToSend.birth_date = d.toISOString().slice(0, 10);
      }
      // Limpar tudo que não for número do telefone
      dataToSend.telefone = (dataToSend.telefone || "").replace(/\D/g, "");
      // Limpar tudo que não for número do CPF
      dataToSend.cpf = (dataToSend.cpf || "").replace(/\D/g, "");
      
      // Converter campos para compatibilidade com backend
      const payload = { 
        ...dataToSend, 
        nome: dataToSend.name, // Backend espera 'nome'
        data_nascimento: dataToSend.birth_date, // Backend espera 'data_nascimento'
        empresa_id: equipeId 
      };
      delete payload.name; // Remove 'name' do payload
      delete payload.birth_date; // Remove 'birth_date' do payload
      
      if (modalType === "create") {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/lista-signatarios`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/lista-signatarios/${editId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }
      if (!res.ok) throw new Error("Erro ao salvar signatário.");
      toast.success("Salvo com sucesso!");
      fetchSignatarios();
      setTimeout(handleCloseModal, 1000);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm("Tem certeza que deseja deletar este signatário?")) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contratual/lista-signatarios/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Erro ao deletar signatário.");
      fetchSignatarios();
    } catch (err) {
      setError(err.message);
    }
  };

  // Substituir a função formatDate por uma função que manipula a string, igual contratos.js
  function formatDateToBR(dateStr) {
    if (!dateStr || dateStr === "0000-00-00" || dateStr === "null" || dateStr === null) return "-";
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const [y, m, d] = dateStr.slice(0,10).split("-");
      return `${d}/${m}/${y}`;
    }
    return "-";
  }

  // Função para formatar CPF
  function formatarCpf(valor) {
    if (!valor) return "-";
    const apenasNumeros = valor.replace(/\D/g, "");
    if (apenasNumeros.length === 11) {
      return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return valor;
  }

  // Função para formatar telefone com máscara
  function formatarTelefone(valor) {
    if (!valor) return "-";
    
    let apenasNumeros = valor.replace(/\D/g, "");
    
    // Se já tem código de país (começa com 55, 43, etc.)
    if (apenasNumeros.length >= 12) {
      const codigoPais = apenasNumeros.slice(0, 2);
      const numero = apenasNumeros.slice(2);
      
      // Formatação específica por país
      if (codigoPais === "55") {
        // Brasil: +55 (XX) XXXXX-XXXX
        if (numero.length === 11) {
          return `+55 (${numero.slice(0,2)}) ${numero.slice(2,7)}-${numero.slice(7)}`;
        } else if (numero.length === 10) {
          return `+55 (${numero.slice(0,2)}) ${numero.slice(2,6)}-${numero.slice(6)}`;
        }
      } else if (codigoPais === "43") {
        // Áustria: +43 XXX XXX XXXX
        if (numero.length >= 10) {
          return `+43 ${numero.slice(0,3)} ${numero.slice(3,6)} ${numero.slice(6)}`;
        }
      } else if (codigoPais === "1") {
        // EUA/Canadá: +1 (XXX) XXX-XXXX
        if (numero.length === 10) {
          return `+1 (${numero.slice(0,3)}) ${numero.slice(3,6)}-${numero.slice(6)}`;
        }
      }
      
      // Formato genérico para outros países
      return `+${codigoPais} ${numero}`;
    }
    
    // Se é um número brasileiro sem código de país
    if (apenasNumeros.length === 11) {
      return `+55 (${apenasNumeros.slice(0,2)}) ${apenasNumeros.slice(2,7)}-${apenasNumeros.slice(7)}`;
    } else if (apenasNumeros.length === 10) {
      return `+55 (${apenasNumeros.slice(0,2)}) ${apenasNumeros.slice(2,6)}-${apenasNumeros.slice(6)}`;
    }
    
    // Se é muito curto, retorna como está
    return valor;
  }


  // Máscara para CPF no input
  function mascararCpfInput(valor) {
    if (!valor) return "";
    let apenasNumeros = valor.replace(/\D/g, "");
    if (apenasNumeros.length > 11) apenasNumeros = apenasNumeros.slice(0, 11);
    if (apenasNumeros.length === 11) {
      return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    if (apenasNumeros.length > 9) {
      return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4");
    }
    if (apenasNumeros.length > 6) {
      return apenasNumeros.replace(/(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3");
    }
    if (apenasNumeros.length > 3) {
      return apenasNumeros.replace(/(\d{3})(\d{0,3})/, "$1.$2");
    }
    return apenasNumeros;
  }

  return (
    <div className={styles.page}>
      <PrincipalSidebar />
      <div className={styles.pageContent}>
        <div className={styles.pageHeader}>
          <div className={styles.toolbarBox}>
            <div className={styles.toolbarHeader}>
              <span className={styles.title}>Signatários</span>
              <div className={styles.filtersRowBox}>
                <button onClick={() => handleOpenModal("create")} className={styles.addButton}>
                  <span style={{display:'inline-flex',gap:'8px',alignItems:'center'}}>
                    <FontAwesomeIcon icon={faPlus} />
                    Novo Signatário
                  </span>
                </button>
              </div>
            </div>
            <div className={styles.filtersRow}>
              <div className={styles.filtersRowBox}>
                <input
                  className={styles.searchInput}
                  type="text"
                  placeholder="Buscar por nome, e-mail, CPF ou função..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className={styles.contentScroll}>
          {isLoading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p className={styles.loadingText}>Carregando signatários...</p>
            </div>
          ) : (filtered || []).length === 0 ? (
            <div style={{display:'grid',placeItems:'center',height:'50vh'}}>
              <p className="p-6">Nenhum signatário encontrado.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>CPF</th>
                      <th>Telefone</th>
                      <th>Data de Nascimento</th>
                      <th>Função</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(s => (
                      <tr key={s.id} className={styles.tableCardRow}>
                        <td>{s.nome}</td>
                        <td>{s.email}</td>
                        <td>{formatarCpf(s.cpf)}</td>
                        <td>{formatarTelefone(s.telefone)}</td>
                        <td>{formatDateToBR(s.data_nascimento)}</td>
                        <td>{s.funcao_assinatura || "-"}</td>
                        <td>
                          <button
                            className={styles.actionButton}
                            title="Editar Signatário"
                            onClick={() => handleOpenModal("edit", s)}
                          >
                            <FontAwesomeIcon icon={faPen} />
                          </button>
                          <button
                            className={styles.deleteButton}
                            title="Excluir Signatário"
                            onClick={() => handleDelete(s.id)}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`${styles.pageButton} ${currentPage === 1 ? styles.disabled : ''}`}
                  >Anterior</button>
                  <span className={styles.pageInfo}>
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`${styles.pageButton} ${currentPage === totalPages ? styles.disabled : ''}`}
                  >Próxima</button>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Modal de criar/editar */}
        {showModal && (
          <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
            <div className={styles.modalContent}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
                <h3>{modalType === "create" ? "Novo Signatário" : "Editar Signatário"}</h3>
                <button onClick={handleCloseModal} className={styles.cancelButton} type="button">Fechar</button>
              </div>
              <form onSubmit={handleSubmit}>
                <h4>Dados do Signatário</h4>
                <div className={styles.formGrid}>
                  <div>
                    <label>Nome <span style={{color: 'red'}}>*</span></label>
                    <input name="name" value={form.name} onChange={handleChange} required className={styles.input} />
                  </div>
                  <div>
                    <label>Email <span style={{color: 'red'}}>*</span></label>
                    <input name="email" value={form.email} onChange={handleChange} required type="email" className={styles.input} />
                  </div>
                  <div>
                    <label>CPF <span style={{color: 'red'}}>*</span></label>
                    <input name="cpf" value={form.cpf} onChange={handleChange} required className={styles.input} maxLength={14} />
                  </div>
                  <div>
                    <label>Telefone</label>
                    <div style={{
                      width: '90%',
                      display: 'flex',
                      border: '2px solid var(--onity-color-border)',
                      borderRadius: '12px',
                      backgroundColor: 'var(--onity-color-surface)',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease',
                      boxShadow: 'var(--onity-elev-low)',
                      marginBottom: '16px',
                      padding: '7px 8px'
                    }}>
                      <PhoneInput
                        value={form.telefone}
                        onChange={handlePhoneChange}
                        defaultCountry="BR"
                        placeholder="Digite o telefone"
                        style={{
                          '--PhoneInput-color--focus': '#3b82f6',
                          '--PhoneInputCountryFlag-borderColor--focus': '#3b82f6',
                          '--PhoneInputCountrySelect-marginRight': '8px',
                          '--PhoneInputCountrySelectArrow-color': 'var(--onity-color-text)',
                          '--PhoneInputCountrySelectArrow-opacity': '0.8',
                          '--PhoneInput-color': 'var(--onity-color-text)',
                          '--PhoneInput-backgroundColor': 'transparent',
                          '--PhoneInput-borderColor': 'transparent',
                          '--PhoneInput-borderRadius': '0px',
                          '--PhoneInputCountryFlag-borderRadius': '2px',
                          '--PhoneInputCountrySelectArrow-transform': 'none'
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label>Data de Nascimento</label>
                    <input name="birth_date" value={form.birth_date || ""} onChange={handleChange} type="date" className={styles.input} />
                  </div>
                  <div>
                    <label>Função <span style={{color: 'red'}}>*</span></label>
                    <select
                      name="funcao_assinatura"
                      value={form.funcao_assinatura}
                      onChange={handleChange}
                      required
                      className={styles.selectInput}
                    >
                      <option value="" disabled>Selecione a função...</option>
                      {opcoesFuncaoAssinatura.map((opcao) => (
                        <option key={opcao} value={opcao}>{opcao}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {feedback && <p style={{ color: feedback.includes("sucesso") ? "green" : "red", marginTop: '12px' }}>{feedback}</p>}
                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelButton} onClick={handleCloseModal}>Cancelar</button>
                  <button type="submit" className={styles.saveButton}>
                    {modalType === "create" ? "Criar Signatário" : "Salvar Alterações"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
  );
} 