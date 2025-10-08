import React, { useEffect, useState } from "react";
import styles from "./ListaSignatarios.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faTimes } from "@fortawesome/free-solid-svg-icons";

const ListaSignatarios = ({ onSelectSignatario, onClose }) => {  // onClose obrigatório
  const [signatarios, setSignatarios] = useState([]);
  const [filteredSignatarios, setFilteredSignatarios] = useState([]);
  const [searchQuery, setSearchQuery] = useState(""); // Estado para armazenar a pesquisa
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSignatarios, setSelectedSignatarios] = useState([]); // Para armazenar os selecionados
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;


  useEffect(() => {
    const fetchSignatarios = async () => {
      try {
        const token = localStorage.getItem("token");
        const userRaw = localStorage.getItem("user");
        if (!userRaw || !token) return;

        const user = JSON.parse(userRaw);
        const equipeId = user.equipe_id;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lista-signatarios/equipe/${equipeId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Erro ao buscar signatários.");

        const data = await res.json();

        // Remove duplicados por CPF
        const unicosPorCpf = Array.from(
          new Map(data.map(s => [s.cpf?.replace(/\D/g, ""), s])).values()
        );
        setSignatarios(unicosPorCpf);
        setFilteredSignatarios(unicosPorCpf); // Inicializa a lista filtrada com todos os signatários
      } catch (error) {
        setError("Erro ao carregar signatários.");
        console.error("Erro ao carregar signatários:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSignatarios();
  }, []);

  function formatDateToBR(dateStr) {
    if (!dateStr || dateStr === "0000-00-00" || dateStr === "null" || dateStr === null) return "-";
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const [y, m, d] = dateStr.slice(0,10).split("-");
      return `${d}/${m}/${y}`;
    }
    return "-";
  }

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    filterSignatarios(e.target.value);
  };

  // Função de filtro
  const filterSignatarios = (query) => {
    if (!query) {
      setFilteredSignatarios(signatarios);
    } else {
      const filtered = signatarios.filter(
        (signatario) =>
          signatario.name.toLowerCase().includes(query.toLowerCase()) ||
          signatario.email.toLowerCase().includes(query.toLowerCase()) ||
          signatario.cpf.includes(query)
      );
      setFilteredSignatarios(filtered);
    }
  };

  const handleSelectSignatario = (signatario) => {
    // Alterna a seleção do signatário
    const alreadySelected = selectedSignatarios.some(s => s.id === signatario.id);
    let updatedSignatarios;
    if (alreadySelected) {
      updatedSignatarios = selectedSignatarios.filter(s => s.id !== signatario.id);
    } else {
      updatedSignatarios = [...selectedSignatarios, signatario];
    }

    setSelectedSignatarios(updatedSignatarios);
    onSelectSignatario(updatedSignatarios);  // Envia a lista de selecionados para o componente pai
  };

  // Paginação
  const totalPages = Math.ceil(filteredSignatarios.length / itemsPerPage) || 1;
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const signatariosPaginados = filteredSignatarios.slice(startIdx, endIdx);

  // Resetar página ao filtrar/buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filteredSignatarios.length]);


  if (error) return <p>{error}</p>;

  // Função para fechar ao clicar no overlay
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Lista de Signatários</h3>
          <button className={styles.closeButton} onClick={onClose} title="Fechar">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className={styles.listaSignatariosContainer}>
          <div className={styles.searchContainer}>
            <FontAwesomeIcon icon={faSearch} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar por Nome, Email, CPF..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
          {filteredSignatarios.length === 0 ? (
            <p>Não há signatários correspondentes.</p>
          ) : (
            <table className={styles.tabelaProdutos}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>CPF</th>
                  <th>Telefone</th>
                  <th>Data de Nascimento</th>
                  <th>Função</th>
                  <th>Selecionar</th>
                </tr>
              </thead>
              <tbody>
                {signatariosPaginados.map((s, index) => (
                  <tr key={index}>
                    <td>{s.name}</td>
                    <td>{s.email}</td>
                    <td>{s.cpf}</td>
                    <td>{s.telefone || "-"}</td>
                    <td>{formatDateToBR(s.birth_date)}</td>
                    <td>{s.funcao_assinatura || "-"}</td>
                    <td>
                      <button
                        className={`${styles.selectButton} ${selectedSignatarios.some(selected => selected.id === s.id) ? styles.selected : ""
                          }`}
                        onClick={() => handleSelectSignatario(s)}
                      >
                        {selectedSignatarios.some(selected => selected.id === s.id)
                          ? "Selecionado"
                          : "Selecionar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
        </div>
      </div>
    </div>
  );
};

export default ListaSignatarios;
