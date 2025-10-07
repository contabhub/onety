import React, { useState, useEffect } from "react";
import { FileText, Trash2, Plus, Download } from "lucide-react";
import styles from "../../../styles/comercial/crm/LeadContacts.module.css";
import AddFileModal from "../crm/AddFileModal"; // Importando o modal de adicionar arquivo

const LeadFiles = ({ leadId }) => {
  const [files, setFiles] = useState([]);  // Inicializando files como um array vazio
  const [loading, setLoading] = useState(false);
  const [isAddFileModalOpen, setIsAddFileModalOpen] = useState(false); // Estado para controlar o modal de adicionar arquivo

  // Função para buscar arquivos do lead
  const fetchFiles = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/arquivos/${leadId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      // Garantir que a resposta seja um array
      if (Array.isArray(data)) {
        setFiles(data);  // Armazenar os arquivos na variável de estado
      } else {
        setFiles([]);  // Se não for um array, garantir que seja um array vazio
      }
    } catch (error) {
      console.error("Erro ao buscar arquivos:", error);
      setFiles([]);  // Garantir que seja um array vazio em caso de erro
    } finally {
      setLoading(false);
    }
  };

  // Função para deletar arquivo
  const handleDeleteFile = async (fileId) => {
    const token = localStorage.getItem("token");
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/arquivos/${fileId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchFiles(); // Recarregar a lista de arquivos após excluir
    } catch (error) {
      console.error("Erro ao excluir arquivo:", error);
    }
  };

  const handleDownload = (fileId) => {
    const url = `${process.env.NEXT_PUBLIC_API_URL}/comercial/arquivos/download/${fileId}`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    fetchFiles(); // Chama a função ao montar o componente ou quando leadId mudar
  }, [leadId]);

  return (
    <div className={styles.filesContainer}>
      <div className={styles.header}>
        <h2>
          <FileText size={30} className={styles.userIcon} /> Arquivos
        </h2>
        <button
          className={styles.addContactButton}
          onClick={() => setIsAddFileModalOpen(true)} // Abre o modal de adicionar arquivo
        >
          <Plus size={20} />
        </button>
      </div>

      {files.length === 0 ? (
        <p>Nenhum arquivo encontrado</p> // Mensagem quando não houver arquivos
      ) : (
        <div className={styles.fileList}>
          {files.map((file) => (
            <div key={file.id} className={styles.fileCard}>
              <div className={styles.fileInfo}>
                {/* Exibir apenas a extensão do arquivo */}
                <span className={styles.fileType}>
                  {file.tipo?.split("/")[1]?.toUpperCase() || "ARQUIVO"}
                </span>

                {/* Link por nome com ação de download via backend */}
                <button
                  className={styles.fileUrl}
                  onClick={() => handleDownload(file.id)}
                  title="Baixar arquivo"
                >
                  {file.nome_arquivo}
                </button>
              </div>
              <div className={styles.fileActions}>
                <button
                  className={styles.deleteButton}
                  onClick={() => handleDeleteFile(file.id)} // Deletar o arquivo
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Adicionar Arquivo */}
      {isAddFileModalOpen && (
        <AddFileModal
          leadId={leadId}
          isOpen={isAddFileModalOpen}
          onClose={() => setIsAddFileModalOpen(false)} // Fecha o modal
          onSave={fetchFiles} // Atualiza a lista de arquivos após salvar
        />
      )}
    </div>
  );
};

export default LeadFiles;
