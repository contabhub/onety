import { useState, useEffect } from "react";
import { FaCloudUploadAlt } from "react-icons/fa";
import styles from "../../styles/gestao/CertificadosPage.module.css";

export default function ModalSubstituirCertificado({ certificado, onClose, onSubstituir }) {
  const [arquivo, setArquivo] = useState(null);
  const [dataVencimento, setDataVencimento] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!arquivo || !dataVencimento) {
      setMensagem("❌ Selecione um arquivo e informe a data de vencimento.");
      return;
    }

    setLoading(true);
    setMensagem("");
    try {
      await onSubstituir(certificado.id, arquivo, dataVencimento);
    } catch (error) {
      console.error("[ModalSubstituirCertificado] Erro:", error);
      setMensagem("❌ Erro ao substituir certificado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitulo}>Substituir Certificado</h2>
          <button
            onClick={onClose}
            className={styles.modalCloseButton}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <div className={styles.modalInfo}>
          <p><strong>Cliente:</strong> {certificado.cliente_nome}</p>
          <p><strong>Certificado atual:</strong> {certificado.nomeArquivo}</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div>
            <label htmlFor="arquivoUpload" className={styles.modalUploadArea}>
              <FaCloudUploadAlt size={24} className={styles.modalUploadIcon} />
              <span className={styles.modalUploadSpan}>
                {arquivo ? arquivo.name : "Clique aqui para selecionar o novo certificado"}
              </span>
              <input
                type="file"
                accept=".pfx"
                id="arquivoUpload"
                onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                className={styles.modalFileInput}
                required
              />
            </label>
          </div>

          <div>
            <label htmlFor="dataVencimento" className={styles.modalLabel}>
              Data de Vencimento *
            </label>
            <input
              type="date"
              id="dataVencimento"
              value={dataVencimento}
              onChange={(e) => setDataVencimento(e.target.value)}
              required
              className={styles.modalInput}
            />
          </div>

          {mensagem && <p className={styles.modalMensagem}>{mensagem}</p>}

          <div className={styles.modalButtonsContainer}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={styles.modalBotaoCancelar}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !arquivo || !dataVencimento}
              className={styles.modalBotaoSalvar}
            >
              {loading ? "Substituindo..." : "Substituir"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}