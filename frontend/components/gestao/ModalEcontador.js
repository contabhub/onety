import React from "react";
import SpinnerGlobal from "../onety/menu/SpinnerGlobal";
import styles from "../../styles/gestao/ModalEcontador.module.css";

const ModalEcontador = ({
  open,
  onClose,
  loading,
  onConfirm,
  resultado,
}) => {
  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            Integração eContador - Baixa Automática
          </h2>
          <button
            onClick={onClose}
            className={styles.closeBtn}
          >
            ×
          </button>
        </div>

        {/* Conteúdo */}
        <div className={styles.section}>
          <p>
            Tem certeza que deseja iniciar a <strong>baixa automática</strong> das atividades de integração eContador?
          </p>

          <div className={styles.infoBox}>
            <h3 className={styles.infoTitle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10,9 9,9 8,9" />
              </svg>
              O que será processado:
            </h3>
            <ul className={styles.infoList}>
              <li>Atividades do tipo "Integração: eContador" pendentes</li>
              <li>Busca automática de documentos no Alterdata</li>
              <li>Match por título do documento configurado</li>
              <li>Baixa automática das obrigações correspondentes</li>
            </ul>
          </div>

          <div className={styles.warningBox}>
            <p className={styles.warningText}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: "1px", flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span><strong>Atenção:</strong> Este processo pode levar alguns minutos dependendo da quantidade de atividades encontradas.</span>
            </p>
          </div>
        </div>

        {/* Botões */}
        <div className={styles.actionsRow}>
          <button
            onClick={onClose}
            className={styles.btnCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={styles.btnPrimary}
          >
            {loading ? (
              <span className={styles.btnPrimaryContent}>
                <SpinnerGlobal size={16} variant="gradient" />
                Processando...
              </span>
            ) : (
              "Iniciar Baixa Automática"
            )}
          </button>
        </div>

        {/* Resultado/Logs */}
        {resultado && (
          <div className={styles.resultBox}>
            <h4 className={styles.resultHeader}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
              </svg>
              Resultado do Processamento
            </h4>

            {resultado.error ? (
  <div className={styles.alertError}>
    <strong>Erro no Processamento</strong>
    <p style={{ margin: 0, fontSize: "var(--onity-font-size-sm)" }}>{resultado.error}</p>
  </div>
) : resultado.message && resultado.message.includes("0 atividades") ? (
  // MUDANÇA: Warning quando não há atividades
  <div className={styles.alertWarning}>
    <div style={{ display: "flex", alignItems: "center", gap: "var(--onity-spacing-sm)", marginBottom: "var(--onity-spacing-sm)" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <strong>Nenhuma Atividade Pendente</strong>
    </div>
    <p style={{ margin: 0, fontSize: "var(--onity-font-size-sm)", lineHeight: "1.5" }}>
      {resultado.message}
    </p>
    <div style={{ 
      marginTop: "var(--onity-spacing-sm)", 
      padding: "var(--onity-spacing-sm)", 
      background: "rgba(255, 255, 255, 0.1)", 
      borderRadius: "var(--onity-radius-sm)", 
      fontSize: "13px" 
    }}>
      <strong>Status:</strong> Não há atividades do tipo "Integração: eContador" pendentes para processamento.
    </div>
  </div>
) : (
  // MUDANÇA: Sucesso normal quando há atividades processadas
  <div>
    <div className={styles.alertSuccess}>
      <strong className={styles.alertSuccessText}>Processamento Concluído</strong>
      <p style={{ margin: 0, fontSize: "var(--onity-font-size-sm)", color: "var(--onity-success-text)" }}>
        {resultado.message || "Baixa automática realizada com sucesso"}
      </p>
    </div>

                {/* Detalhes do Processamento */}
                {resultado.detalhes && Array.isArray(resultado.detalhes) && (
                  <div>
                    <h5 style={{
                      margin: "0 0 var(--onity-spacing-sm) 0",
                      fontSize: "var(--onity-font-size-sm)",
                      fontWeight: "var(--onity-font-weight-semibold)",
                      color: "var(--onity-text-high)"
                    }}>
                      Detalhes por Atividade:
                    </h5>

                    {resultado.detalhes.map((detalhe, index) => (
                      <div key={index} className={styles.detailCard}>
                        <div className={styles.detailHeader}>
                          {detalhe.status === "SUCESSO" ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--onity-success)" strokeWidth="2">
                              <path d="M9 12l2 2 4-4" />
                              <circle cx="12" cy="12" r="10" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--onity-error)" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="15" y1="9" x2="9" y2="15" />
                              <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                          )}
                          <span className={`${styles.detailClient} ${detalhe.status === "SUCESSO" ? styles.detailClientSuccess : styles.detailClientError}`}>
                            {detalhe.clienteNome}
                          </span>
                          <span className={styles.detailBadge}>
                            {detalhe.status}
                          </span>
                        </div>

                        <div className={styles.detailRow}>
                          <strong>Atividade:</strong> {detalhe.tituloDocumentoEsperado}
                        </div>

                        <div className={styles.detailSubRow}>
                          <strong>ID:</strong> {detalhe.atividadeId}
                        </div>

                        <div className={styles.detailSubRow}>
                          {detalhe.mensagem}
                        </div>

                        {detalhe.documentosEncontrados && detalhe.documentosEncontrados.length > 0 && (
                          <div className={styles.detailDocs}>
                            <strong>Documentos:</strong> {detalhe.documentosEncontrados.length} encontrado(s)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalEcontador;