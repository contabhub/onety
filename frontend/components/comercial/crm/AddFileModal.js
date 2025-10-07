import React, { useState } from "react";
import styles from "../../../styles/comercial/crm/LeadContacts.module.css";
import { CloudUpload, XCircle } from "lucide-react";

const AddFileModal = ({ leadId, isOpen, onClose, onSave }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileType, setFileType] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileType(selectedFile.type.split("/")[1]?.toUpperCase() || "");
    }
  };

  const handleFileUpload = async () => {
    if (!file) return;

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("arquivo", file);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/arquivos/upload/${leadId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      let data = null;
      try { data = await response.json(); } catch (_) { /* ignore parse errors */ }

      if (response.ok) {
        onClose();
        onSave();
      } else {
        console.error('Erro ao enviar arquivo:', data?.error || response.statusText);
      }
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
    } finally {
      setLoading(false);
    }
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
