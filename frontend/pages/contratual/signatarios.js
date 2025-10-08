import React, { useEffect, useState } from "react";
import styles from "../styles/Signatarios.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faPen, faTrash, faPlus } from "@fortawesome/free-solid-svg-icons";
import Layout from "../components/layout/Layout";
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import meuLottieJson from '../assets/Loading.json';
import Lottie from 'lottie-react';


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

const SignatariosPage = () => {
  const [signatarios, setSignatarios] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("create"); // 'create' | 'edit'
  const [form, setForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [feedback, setFeedback] = useState("");

  // Busca equipe_id do usuário logado
  const getEquipeId = () => {
    const userRaw = (typeof window !== "undefined") ? localStorage.getItem("user") : null;
    if (!userRaw) return null;
    try {
      const user = JSON.parse(userRaw);
      return user.equipe_id;
    } catch {
      return null;
    }
  };

  const fetchSignatarios = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const equipeId = getEquipeId();
      if (!token || !equipeId) throw new Error("Usuário não autenticado.");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lista-signatarios/equipe/${equipeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Erro ao buscar signatários.");
      const data = await res.json();
      setSignatarios(data);
      setFiltered(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignatarios();
  }, []);

  // Filtro/search
  useEffect(() => {
    let filteredList = signatarios.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.cpf && s.cpf.includes(search)) ||
      (s.funcao_assinatura && s.funcao_assinatura.toLowerCase().includes(search.toLowerCase()))
    );
    setFiltered(filteredList);
    setCurrentPage(1);
  }, [search, signatarios]);

  // Paginação
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIdx, endIdx);

  // Handlers CRUD
  const handleOpenModal = (type, signatario = null) => {
    setModalType(type);
    setShowModal(true);
    if (type === "edit" && signatario) {
      // Converter birth_date para YYYY-MM-DD se existir
      let birthDate = signatario.birth_date;
      if (birthDate) {
        // Pode vir como ISO ou Date
        const d = new Date(birthDate);
        birthDate = d.toISOString().slice(0, 10);
      } else {
        birthDate = "";
      }
      // Garantir que telefone começa com +55 e já mascarado
      let telefone = signatario.telefone || "";
      if (telefone) {
        telefone = telefone.replace(/\D/g, "");
        if (!telefone.startsWith("55")) telefone = "55" + telefone;
        telefone = mascararTelefoneComDDI("+" + telefone);
      } else {
        telefone = "+55 ";
      }
      // Garantir que CPF já venha formatado
      let cpf = signatario.cpf || "";
      cpf = mascararCpfInput(cpf);
      setForm({ ...signatario, birth_date: birthDate, telefone, cpf });
      setEditId(signatario.id);
    } else {
      setForm({ ...initialForm, telefone: "+55 " });
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
    if (name === "telefone") {
      // Sempre manter o +55 e aplicar máscara
      let novoValor = value;
      if (!novoValor.startsWith("+55")) {
        novoValor = "+55 " + novoValor.replace(/^\+*/, "").replace(/^55*/, "");
      }
      novoValor = mascararTelefoneComDDI(novoValor);
      setForm(f => ({ ...f, telefone: novoValor }));
    } else if (name === "cpf") {
      setForm(f => ({ ...f, cpf: mascararCpfInput(value) }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
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
      // Limpar tudo que não for número e garantir que começa com 55
      let telLimpo = (dataToSend.telefone || "").replace(/\D/g, "");
      if (!telLimpo.startsWith("55")) telLimpo = "55" + telLimpo;
      dataToSend.telefone = telLimpo;
      // Limpar tudo que não for número do CPF
      dataToSend.cpf = (dataToSend.cpf || "").replace(/\D/g, "");
      if (modalType === "create") {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lista-signatarios`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ ...dataToSend, equipe_id: equipeId })
        });
      } else {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lista-signatarios/${editId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(dataToSend)
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lista-signatarios/${id}`, {
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

  // Função para formatar telefone
  function formatarTelefone(valor) {
    if (!valor) return "-";
    let apenasNumeros = valor.replace(/\D/g, "");
    // Se começa com 55 e tem 13 dígitos, remover o DDI e mostrar com +55
    if (apenasNumeros.length === 13 && apenasNumeros.startsWith("55")) {
      const semDdi = apenasNumeros.slice(2);
      if (semDdi.length === 11) {
        return `+55 (${semDdi.slice(0,2)}) ${semDdi.slice(2,7)}-${semDdi.slice(7)}`;
      }
      if (semDdi.length === 10) {
        return `+55 (${semDdi.slice(0,2)}) ${semDdi.slice(2,6)}-${semDdi.slice(6)}`;
      }
      return `+55 ${semDdi}`;
    }
    if (apenasNumeros.length === 11) {
      return apenasNumeros.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    if (apenasNumeros.length === 10) {
      return apenasNumeros.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return valor;
  }

  // Máscara para telefone no input (com +55 fixo)
  function mascararTelefoneComDDI(valor) {
    if (!valor) return "+55 ";
    let apenasNumeros = valor.replace(/\D/g, "");
    // Remove o 55 se o usuário digitar
    if (apenasNumeros.startsWith("55")) apenasNumeros = apenasNumeros.slice(2);
    if (apenasNumeros.length > 11) apenasNumeros = apenasNumeros.slice(0, 11);
    if (apenasNumeros.length === 11) {
      return `+55 (${apenasNumeros.slice(0,2)}) ${apenasNumeros.slice(2,7)}-${apenasNumeros.slice(7)}`;
    }
    if (apenasNumeros.length >= 7) {
      return `+55 (${apenasNumeros.slice(0,2)}) ${apenasNumeros.slice(2,7)}-${apenasNumeros.slice(7)}`;
    }
    if (apenasNumeros.length >= 3) {
      return `+55 (${apenasNumeros.slice(0,2)}) ${apenasNumeros.slice(2)}`;
    }
    if (apenasNumeros.length > 0) {
      return `+55 (${apenasNumeros}`;
    }
    return "+55 ";
  }

  // Limpa e garante 55 no início
  function limparTelefone(valor) {
    if (!valor) return "";
    let apenasNumeros = valor.replace(/\D/g, "");
    if (!apenasNumeros.startsWith("55")) {
      apenasNumeros = "55" + apenasNumeros;
    }
    return apenasNumeros;
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
    <Layout>
      <div className={styles.header}>
        <span className={styles.title}>Signatários</span>
        <button className={styles.addButton} onClick={() => handleOpenModal("create")}
          style={{ marginLeft: 16 }}>
          <FontAwesomeIcon icon={faPlus} /> Novo Signatário
        </button>
      </div>
      <div className={styles.searchContainer}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Buscar por nome, e-mail, CPF ou função..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {/* Filtro futuro, pode ser expandido */}
        {/* <select className={styles.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Todas as funções</option>
        </select> */}
      </div>
      <div className={styles.container}>
        {loading ? (
          <div className={styles.loadingContainer}>
          <Lottie 
            animationData={meuLottieJson} 
            loop={true}
            style={{ width: 200, height: 200 }}
          />
            <p className={styles.loadingText}>Carregando signatários...</p>
          </div>
        ) : error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : (
          <>
            <table className={styles.tabelaProdutos}>
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
                {paginated.length === 0 ? (
                  <tr><td colSpan={7}>Nenhum signatário encontrado.</td></tr>
                ) : paginated.map(s => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.email}</td>
                    <td>{formatarCpf(s.cpf)}</td>
                    <td>{formatarTelefone(s.telefone)}</td>
                    <td>{formatDateToBR(s.birth_date)}</td>
                    <td>{s.funcao_assinatura || "-"}</td>
                    <td>
                      <button
                        className={styles.editIcon}
                        title="Editar Signatário"
                        onClick={() => handleOpenModal("edit", s)}
                      >
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                      <button
                        className={styles.deleteBtn}
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
            {/* Paginação */}
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
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>{modalType === "create" ? "Novo Signatário" : "Editar Signatário"}</h3>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                <div className={styles.formColumn}>
                  <label>Nome <span style={{color: 'red'}}>*</span>
                    <input name="name" value={form.name} onChange={handleChange} required className={styles.input} />
                  </label>
                  <label>Email <span style={{color: 'red'}}>*</span>
                    <input name="email" value={form.email} onChange={handleChange} required type="email" className={styles.input} />
                  </label>
                  <label>CPF <span style={{color: 'red'}}>*</span>
                    <input name="cpf" value={form.cpf} onChange={handleChange} required className={styles.input} maxLength={14} />
                  </label>
                </div>
                <div className={styles.formColumn}>
                  <label>Telefone <span style={{color: 'red'}}>*</span>
                    <input name="telefone" value={form.telefone} onChange={handleChange} className={styles.input} maxLength={20} />
                  </label>
                  <label>Data de Nascimento
                    <input name="birth_date" value={form.birth_date || ""} onChange={handleChange} type="date" className={styles.input} />
                  </label>
                  <label>Função <span style={{color: 'red'}}>*</span>
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
                  </label>
                </div>
              </div>
              <div className={styles.modalActions}>
                <button type="submit" className={styles.saveButton}>Salvar</button>
                <button type="button" className={styles.cancelButton} onClick={handleCloseModal}>Cancelar</button>
              </div>
              {feedback && <p style={{ color: feedback.includes("sucesso") ? "green" : "red" }}>{feedback}</p>}
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

    </Layout>
  );
};

export default SignatariosPage; 