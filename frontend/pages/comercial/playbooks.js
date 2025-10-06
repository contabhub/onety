import { useEffect, useState } from "react";
import styles from "../../styles/comercial/crm/Playbooks.module.css";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import SpaceLoader from "../../components/onety/menu/SpaceLoader";
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faPlus, 
  faTrash, 
  faEdit, 
  faDownload, 
  faSearch, 
  faFileAlt,
  faUsers,
  faCalendar
} from "@fortawesome/free-solid-svg-icons";
// Loader padrão substituído por SpaceLoader

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [playbookEdit, setPlaybookEdit] = useState(null);
  const [search, setSearch] = useState("");
  const [equipeId, setEquipeId] = useState(null);

  // Estados do formulário
  const [formData, setFormData] = useState({
    nome: "",
    equipe_id: "",
    arquivo: null
  });

  // Busca playbooks
  const fetchPlaybooks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const userRaw = localStorage.getItem("user");
      if (!token || !userRaw) throw new Error("Usuário não autenticado.");

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/playbooks`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      if (!res.ok) throw new Error("Erro ao buscar playbooks.");
      const data = await res.json();
      setPlaybooks(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Define o equipeId primeiro
    const userRaw = localStorage.getItem("user");
    if (userRaw) {
      const user = JSON.parse(userRaw);
      setEquipeId(user.equipe_id);
    }
    
    fetchPlaybooks();
  }, []);

  // Filtra por busca
  const searchResults = search ? 
    playbooks.filter(p => 
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.equipe_nome.toLowerCase().includes(search.toLowerCase())
    ) : 
    playbooks;

  // Reset do formulário
  const resetForm = () => {
    setFormData({
      nome: "",
      equipe_id: equipeId || "",
      arquivo: null
    });
    setPlaybookEdit(null);
    setShowForm(false);
  };

  // Submit do formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    // Busca o equipe_id do localStorage se não estiver definido
    const currentEquipeId = equipeId || (() => {
      const userRaw = localStorage.getItem("user");
      if (userRaw) {
        const user = JSON.parse(userRaw);
        return user.equipe_id;
      }
      return null;
    })();

    if (!currentEquipeId) {
      toast.error("Erro: Usuário não tem equipe definida");
      return;
    }

    if (!playbookEdit && !formData.arquivo) {
      toast.error("Arquivo é obrigatório");
      return;
    }

    // Validar se é PDF
    if (formData.arquivo && !formData.arquivo.name.toLowerCase().endsWith('.pdf')) {
      toast.error("Apenas arquivos PDF são permitidos");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const formDataToSend = new FormData();
      formDataToSend.append("nome", formData.nome);
      formDataToSend.append("equipe_id", currentEquipeId);
      
      if (formData.arquivo) {
        formDataToSend.append("arquivo", formData.arquivo);
      }

      const url = playbookEdit ? 
        `${process.env.NEXT_PUBLIC_API_URL}/playbooks/${playbookEdit.id}` :
        `${process.env.NEXT_PUBLIC_API_URL}/playbooks`;

      const method = playbookEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataToSend,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao salvar playbook");
      }

      const data = await res.json();
      toast.success(playbookEdit ? "Playbook atualizado com sucesso!" : "Playbook criado com sucesso!");
      
      resetForm();
      fetchPlaybooks();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Editar playbook
  const handleEdit = (playbook) => {
    setPlaybookEdit(playbook);
    setFormData({
      nome: playbook.nome,
      equipe_id: playbook.equipe_id,
      arquivo: null
    });
    setShowForm(true);
  };

  // Deletar playbook
  const handleDelete = async (id) => {
    if (!confirm("Tem certeza que deseja deletar este playbook?")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/playbooks/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Erro ao deletar playbook");

      toast.success("Playbook deletado com sucesso!");
      fetchPlaybooks();
    } catch (err) {
      toast.error(err.message);
    }
  };


  // Download do arquivo
  const handleDownload = async (playbookId, nome) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Usar o endpoint de download do backend
      const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL}/playbooks/${playbookId}/download`;
      
      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao fazer download do arquivo");
      }

      // Criar blob e fazer download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${nome.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpar o URL do blob
      window.URL.revokeObjectURL(url);
      
      toast.success("Download iniciado com sucesso!");
    } catch (error) {
      console.error("Erro no download:", error);
      toast.error("Erro ao fazer download do arquivo");
    }
  };

  // Formatar data
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <div className={styles.page}>
        <PrincipalSidebar />
        <div className={styles.pageContent}>
      <div className={styles.container}>
        {loading ? (
          <SpaceLoader label="Carregando playbooks..." />
        ) : (
        <>
        <div className={styles.header}>
          <h1>
            <FontAwesomeIcon icon={faFileAlt} /> Playbooks
          </h1>
          <button 
            className={styles.addButton}
            onClick={() => setShowForm(true)}
          >
            <FontAwesomeIcon icon={faPlus} /> Novo Playbook
          </button>
        </div>

        {/* Filtros */}
        <div className={styles.filters}>
          <div className={styles.searchContainer}>
            <FontAwesomeIcon icon={faSearch} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar playbooks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        {/* Lista de Playbooks */}
        <div className={styles.playbooksGrid}>
          {searchResults.length === 0 ? (
            <div className={styles.emptyState}>
              <FontAwesomeIcon icon={faFileAlt} />
              <h3>Nenhum playbook encontrado</h3>
              <p>Clique em "Novo Playbook" para criar o primeiro.</p>
            </div>
          ) : (
            searchResults.map((playbook) => (
              <div key={playbook.id} className={styles.playbookCard}>
                <div className={styles.cardHeader}>
                  <h3>{playbook.nome}</h3>
                  <div className={styles.cardActions}>
                    <button
                      onClick={() => handleEdit(playbook)}
                      className={styles.actionButton}
                      title="Editar"
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button
                      onClick={() => handleDelete(playbook.id)}
                      className={styles.actionButton}
                      title="Deletar"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>

                <div className={styles.cardContent}>
                  <div className={styles.equipeInfo}>
                    <FontAwesomeIcon icon={faUsers} />
                    <span>{playbook.equipe_nome}</span>
                  </div>
                  
                  <div className={styles.dateInfo}>
                    <FontAwesomeIcon icon={faCalendar} />
                    <span>Criado em: {formatDate(playbook.created_at)}</span>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <button
                    onClick={() => handleDownload(playbook.id, playbook.nome)}
                    className={styles.downloadButton}
                    title="Baixar PDF"
                  >
                    <FontAwesomeIcon icon={faDownload} />
                    Baixar Arquivo
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal do Formulário */}
        {showForm && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h2>
                  {playbookEdit ? "Editar Playbook" : "Novo Playbook"}
                </h2>
                <button 
                  className={styles.closeButton}
                  onClick={resetForm}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="nome">Nome do Playbook</label>
                  <input
                    type="text"
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    placeholder="Ex: Playbook de Vendas"
                    required
                  />
                </div>


                <div className={styles.formGroup}>
                  <label htmlFor="arquivo">
                    Arquivo {playbookEdit && "(opcional - deixe vazio para manter o atual)"}
                  </label>
                  <input
                    type="file"
                    id="arquivo"
                    onChange={(e) => setFormData({...formData, arquivo: e.target.files[0]})}
                    accept=".pdf"
                    required={!playbookEdit}
                  />
                </div>

                <div className={styles.formActions}>
                  <button type="button" onClick={resetForm} className={styles.cancelButton}>
                    Cancelar
                  </button>
                  <button type="submit" className={styles.saveButton}>
                    {playbookEdit ? "Atualizar" : "Criar"} Playbook
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        </>
        )}
      </div>

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        transition={Bounce}
      />
        </div>
      </div>
    </>
  );
}
