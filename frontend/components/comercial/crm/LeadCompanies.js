import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import styles from "../../../styles/comercial/crm/LeadContacts.module.css";
import { Pencil, Plus, Building2 , Trash } from "lucide-react"; // Importando ícones necessários
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEllipsisV } from "@fortawesome/free-solid-svg-icons";
import AddCompanyModal from "../crm/AddCompanyModal";
import EditCompanyModal from "../crm/EditCompanyModal";

const LeadCompanies = ({ leadId }) => {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState(null);
  const [showDropdown, setShowDropdown] = useState(null); // Controla a visibilidade do dropdown
  const router = useRouter();

  const fetchCompanies = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
  
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/empresas/${leadId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
  
      if (res.status === 404) {
        setEmpresas([]); // Nenhuma empresa encontrada
        return;
      }
  
      const data = await res.json();
      setEmpresas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar empresas:", err);
      setEmpresas([]); // Garante que a tela não quebre
    } finally {
      setLoading(false);
    }
  };
  

  const handleEditCompany = (company) => {
    setCompanyToEdit(company);
    setIsEditModalOpen(true);
  };

  const handleDeleteCompany = async (companyId) => {
    const token = localStorage.getItem("token");
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/empresas/${companyId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchCompanies(); // Recarregar as empresas após a exclusão
    } catch (error) {
      console.error("Erro ao excluir empresa:", error);
    }
  };

  const toggleDropdown = (companyId) => {
    if (showDropdown === companyId) {
      setShowDropdown(null); // Fecha o dropdown se já estiver aberto
    } else {
      setShowDropdown(companyId); // Abre o dropdown para a empresa selecionada
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [leadId]);

  return (
    <div className={styles.contactsContainer}>
      <div className={styles.header}>
        <h2>
          <Building2  className={styles.userIcon} size={30} /> Empresas
        </h2>
        <button
          className={styles.addContactButton}
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus size={20} />
        </button>
      </div>

      {empresas.length === 0 ? (
        <p>Nenhuma empresa vinculada.</p>
      ) : (
        <div className={styles.contactList}>
          {empresas.map((empresa) => (
            <div key={empresa.id} className={styles.contactCard}>
              <div className={styles.contactInfo}>
                <span className={styles.contactName}>{empresa.nome}</span>
                <span className={styles.contactEmail}>{empresa.cnpj}</span>
                <span className={styles.contactPhone}>{empresa.endereco}</span>
              </div>

              {/* Menu com três bolinhas (Editar e Excluir) */}
              <div className={styles.menuButtonContainer}>
                <button
                  className={styles.menuButton}
                  onClick={() => toggleDropdown(empresa.id)} // Toggle do dropdown
                >
                  <FontAwesomeIcon icon={faEllipsisV} size={20} />
                </button>

                {/* Dropdown para Editar e Excluir */}
                {showDropdown === empresa.id && (
                  <div className={styles.dropdownMenu}>
                    <button
                      className={styles.editButton}
                      onClick={() => handleEditCompany(empresa)}
                    >
                      <Pencil size={16} className={styles.icon} /> Editar
                    </button>
                    <button
                      className={styles.deleteButton}
                      onClick={() => handleDeleteCompany(empresa.id)}
                    >
                      <span>
                        <Trash size={16} className={styles.icon} />
                      </span>{" "}
                      Excluir
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
        <AddCompanyModal
          leadId={leadId}
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSave={fetchCompanies}
        />
      )}

      {/* Modal de Edição */}
      {companyToEdit && isEditModalOpen && (
        <EditCompanyModal
          leadId={leadId}
          companyId={companyToEdit.id}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={fetchCompanies}
        />
      )}
    </div>
  );
};

export default LeadCompanies;
