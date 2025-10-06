import React, { useState, useEffect } from "react";
import styles from "../../styles/LeadContacts.module.css";

const VincularContatoModal = ({ leadId, onClose, onSave }) => {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);

  // Debounce: busca após 400ms sem digitar
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (query.length >= 3) {
        buscarContatos();
      } else {
        setResultados([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const buscarContatos = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contatos/search?q=${query}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
      setResultados(data);
    } catch (err) {
      console.error("Erro ao buscar contatos:", err);
    } finally {
      setLoading(false);
    }
  };

  const vincularContato = async (contatoId) => {
    const token = localStorage.getItem("token");

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contatos/${contatoId}/vincular`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lead_id: leadId }),
      });
      onSave(); // atualiza a lista no componente pai
      onClose(); // fecha o modal
    } catch (err) {
      console.error("Erro ao vincular contato:", err);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>Relacionar contato</h3>
        <input
          type="text"
          className={styles.modalInput}
          placeholder="Digite pelo menos 3 caracteres para pesquisar..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {loading && <p>Carregando...</p>}

        {!loading && query.length >= 3 && resultados.length === 0 && (
          <p>Nenhum contato encontrado.</p>
        )}

        {!loading && resultados.length > 0 && (
          <ul className={styles.resultList}>
            {resultados.map((contato) => (
              <li
                key={contato.id}
                className={styles.resultItem}
                onClick={() => vincularContato(contato.id)}
              >
                <strong>{contato.nome}</strong>
                <br />
                <small>{contato.email || "sem email"} | {contato.telefone || "sem telefone"}</small>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.modalButtons}>
          <button onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
};

export default VincularContatoModal;
