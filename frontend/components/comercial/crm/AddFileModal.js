import React, { useState } from "react";
import styles from "../../styles/LeadContacts.module.css";
import { CloudUpload, XCircle } from "lucide-react";

const AddFileModal = ({ leadId, isOpen, onClose, onSave }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileType, setFileType] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileType(selectedFile.type.split("/")[1].toUpperCase()); // Captura o tipo de arquivo (PDF, JPEG, etc.)
    }
  };

  const handleFileUpload = async () => {
    if (!file) return;  // Se não houver arquivo selecionado, não envia nada

    setLoading(true);

    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64String = reader.result.split(',')[1]; // Remove a parte `data:image/jpeg;base64,`
      const fileName = file.name;
      const fileType = file.type;

      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/arquivos/upload/${leadId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            base64File: base64String,
            fileName,
            fileType,
          }),
        });

        const data = await response.json();
        if (response.ok) {
          console.log('Arquivo enviado com sucesso:', data);
          onClose(); // Chama onClose para fechar o modal
          onSave(); // Chama onSave para atualizar o estado ou UI no componente pai
        } else {
          console.error('Erro ao enviar arquivo:', data.error);
        }
      } catch (error) {
        console.error('Erro ao enviar arquivo:', error);
      } finally {
        setLoading(false); // Restaura o estado de loading após a operação
      }
    };

    reader.readAsDataURL(file); // Converte o arquivo em base64
  };

  return isOpen ? (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>Adicionar Arquivo</h3>
        <input type="file" onChange={handleFileChange} />
        {file && (
          <div className={styles.filePreview}>
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileType}>{fileType}</span>
            </div>
          </div>
        )}
        <div className={styles.modalButtons}>
          <button onClick={handleFileUpload} disabled={loading}>
            {loading ? "Enviando..." : "Enviar Arquivo"}
          </button>
          <button onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  ) : null;
};

export default AddFileModal;
