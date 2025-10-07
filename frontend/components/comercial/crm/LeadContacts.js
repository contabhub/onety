import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import styles from "../../../styles/comercial/crm/LeadContacts.module.css";
import { Pencil, Plus, User, Trash, UserPlus } from "lucide-react"; // Importando o ícone de mais opções
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEllipsisV } from "@fortawesome/free-solid-svg-icons";
import AddContactModal from "../crm/AddContactModal";
import EditContactModal from "../crm/EditContactModal";
import VincularContatoModal from "../crm/VincularContatoModal"; // certifique-se do caminho


const LeadContacts = ({ leadId }) => {
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState(null);
  const [showDropdown, setShowDropdown] = useState(null); // Estado para controlar a visibilidade do dropdown
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  const router = useRouter();

  const fetchContatos = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/contatos/${leadId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (res.status === 404) {
      setContatos([]); // Nenhum contato encontrado
      return;
    }

    const data = await res.json();
    setContatos(Array.isArray(data) ? data : []);
    setLoading(false);

  };

  const handleEditContact = (contact) => {
    setContactToEdit(contact);
    setIsEditModalOpen(true);
  };

  const handleDeleteContact = async (contactId) => {
    const token = localStorage.getItem("token");
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contatos/${contactId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchContatos(); // Recarregar os contatos após a exclusão
    } catch (error) {
      console.error("Erro ao excluir contato:", error);
    }
  };

  const desvincularContato = async (contatoId) => {
    const token = localStorage.getItem("token");

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contatos/${contatoId}/desvincular`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchContatos(); // Atualiza a lista
    } catch (err) {
      console.error("Erro ao desvincular contato:", err);
    }
  };


  const toggleDropdown = (contactId) => {
    if (showDropdown === contactId) {
      setShowDropdown(null); // Fecha o dropdown se já estiver aberto
    } else {
      setShowDropdown(contactId); // Abre o dropdown para o contato selecionado
    }
  };

  useEffect(() => {
    fetchContatos();
  }, [leadId]);

  return (
    <div className={styles.contactsContainer}>
      <div className={styles.header}>
        <h2>
          <User className={styles.userIcon} size={30} /> Contatos
        </h2>
        <div className={styles.actionButtons}>

          <button
            className={styles.addContactButton}
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={20} />
          </button>
          <button
            className={styles.linkContactButton}
            onClick={() => setIsLinkModalOpen(true)}
            title="Relacionar contato existente"
          >
            <UserPlus size={20} />
          </button>
        </div>
      </div>

      {contatos.length === 0 ? (
        <p>Nenhum contato encontrado.</p>
      ) : (
        <div className={styles.contactList}>
          {contatos.map((contato) => (
            <div key={contato.id} className={styles.contactCard}>
              <div className={styles.contactInfo}>
                <span className={styles.contactName}>{contato.nome}</span>
                <span className={styles.contactEmail}>{contato.email}</span>
                <span className={styles.contactPhone}>{contato.telefone}</span>
              </div>

              {/* Botão de três bolinhas (Menu) */}
              <div className={styles.menuButtonContainer}>
                <button
                  className={styles.menuButton}
                  onClick={() => toggleDropdown(contato.id)} // Toggle do dropdown
                >
                  <FontAwesomeIcon icon={faEllipsisV} size={20} />
                </button>

                {/* Dropdown para Editar e Excluir */}
                {showDropdown === contato.id && (
                  <div className={styles.dropdownMenu}>
                    <button
                      className={styles.editButton}
                      onClick={() => handleEditContact(contato)}
                    >
                      <Pencil size={16} className={styles.icon} /> Editar
                    </button>
                    <button
                      className={styles.deleteButton}
                      onClick={() => desvincularContato(contato.id)}
                    >
                      <span>
                        <Trash size={16} className={styles.icon} />
                      </span>{" "}
                      Desvincular
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Criação */}
      {isAddModalOpen && (
        <AddContactModal
          leadId={leadId}
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSave={fetchContatos}
        />
      )}

      {/* Modal de Edição */}
      {contactToEdit && isEditModalOpen && (
        <EditContactModal
          leadId={leadId}
          contactId={contactToEdit.id}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={fetchContatos}
        />
      )}


      {/* Modal de Vincular Contato */}
      {isLinkModalOpen && (
        <VincularContatoModal
          leadId={leadId}
          onClose={() => setIsLinkModalOpen(false)}
          onSave={fetchContatos}
        />
      )}

    </div>
  );
};

export default LeadContacts;
