import { useEffect, useState } from "react";
import ClienteForm from "../components/assinador/ClienteForm";
import styles from "../styles/Clients.module.css";
import Layout from "../components/layout/Layout";
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash } from "@fortawesome/free-solid-svg-icons";
import meuLottieJson from '../assets/Loading.json';
import Lottie from 'lottie-react';

export default function ClientsPage() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [clienteEdit, setClienteEdit] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Busca clientes da equipe do usuário logado
  const fetchClientes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const userRaw = localStorage.getItem("user");
      if (!token || !userRaw) throw new Error("Usuário não autenticado.");
      const user = JSON.parse(userRaw);
      const equipeId = user.equipe_id;
      setIsAdmin(user.role === "admin" || user.role === "superadmin");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/clients/equipe/${equipeId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error("Erro ao buscar clientes.");
      const data = await res.json();
      setClientes(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  // Ajustar para admin OU superadmin
  useEffect(() => {
    const userRaw = localStorage.getItem("user");
    if (userRaw) {
      const user = JSON.parse(userRaw);
      setIsAdmin(user.role === "admin" || user.role === "superadmin");
    }
  }, []);

  const handleNovoCliente = () => {
    setClienteEdit(null);
    setShowForm(true);
  };

  const handleEditarCliente = (cliente) => {
    setClienteEdit(cliente);
    setShowForm(true);
  };

  const handleClienteCriado = () => {
    setShowForm(false);
    fetchClientes();
  };

  const handleClienteAtualizado = () => {
    setShowForm(false);
    fetchClientes();
  };

  const handleExcluirCliente = async (cliente) => {
    if (window.confirm(`Tem certeza que deseja excluir o cliente "${cliente.name}"? Essa ação não poderá ser desfeita.`)) {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/clients/${cliente.id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erro ao excluir cliente.");
        }
        fetchClientes();
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  // Filtro e busca
  const clientesFiltrados = clientes.filter((c) => {
    const matchSearch =
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.telefone?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType ? c.type === filterType : true;
    return matchSearch && matchType;
  });

  // Paginação baseada nos clientes filtrados
  const totalPages = Math.ceil(clientesFiltrados.length / itemsPerPage) || 1;
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const clientesPagina = clientesFiltrados.slice(startIdx, endIdx);

  // Resetar página ao filtrar/buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType]);

  // Função para formatar CPF ou CNPJ
  function formatarCpfCnpj(valor) {
    if (!valor) return "";
    const apenasNumeros = valor.replace(/\D/g, "");
    if (apenasNumeros.length === 11) {
      // CPF: 000.000.000-00
      return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    if (apenasNumeros.length === 14) {
      // CNPJ: 00.000.000/0000-00
      return apenasNumeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return valor;
  }

  return (
    <Layout>
      <div className={styles.header}>
        <span className={styles.title}>Clientes</span>
        <button className={styles.button} onClick={handleNovoCliente}>
          Novo Cliente
        </button>
      </div>
      <div className={styles.searchContainer}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Buscar por nome, e-mail ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          <option value="pessoa_fisica">Pessoa Física</option>
          <option value="empresa">Empresa</option>
        </select>
      </div>
      <div className={styles.container}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <Lottie
              animationData={meuLottieJson}
              loop={true}
              style={{ width: 200, height: 200 }}
            />
            <p className={styles.loadingText}>Carregando clientes...</p>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <p>Nenhum cliente encontrado.</p>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Nome</th>
                  <th>CPF/CNPJ</th>
                  <th>Email</th>
                  <th>Telefone</th>
                  {isAdmin && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {clientesPagina.map((c) => (
                  <tr key={c.id}>
                    <td>{c.type === "empresa" ? "Empresa" : "Pessoa Física"}</td>
                    <td>{c.name}</td>
                    <td>{formatarCpfCnpj(c.cpf_cnpj)}</td>
                    <td>{c.email}</td>
                    <td>{c.telefone}</td>
                    {isAdmin && (
                      <td>
                        <button
                          className={styles.editIcon}
                          title="Editar Cliente"
                          onClick={() => handleEditarCliente(c)}
                        >
                          <FontAwesomeIcon icon={faPen} />
                        </button>
                        <button
                          className={styles.deleteBtn}
                          title="Excluir Cliente"
                          onClick={() => handleExcluirCliente(c)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`${styles.pageButton} ${currentPage === 1 ? styles.disabled : ''}`}
                >
                  Anterior
                </button>
                <span className={styles.pageInfo}>
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`${styles.pageButton} ${currentPage === totalPages ? styles.disabled : ''}`}
                >
                  Próxima
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showForm && (
        <ClienteForm
          cliente={clienteEdit}
          onClose={() => setShowForm(false)}
          onCreate={handleClienteCriado}
          onUpdate={handleClienteAtualizado}
        />
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
} 