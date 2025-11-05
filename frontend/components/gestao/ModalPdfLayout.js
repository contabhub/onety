import React from 'react';
import SpinnerGlobal from '../onety/menu/SpinnerGlobal';
import styles from '../../styles/gestao/ModalPdfLayout.module.css';

const ModalPdfLayout = ({
  open,
  onClose,
  arquivosSelecionados,
  setArquivosSelecionados,
  processandoArquivo,
  resultadoProcessamento,
  onProcessar,
  onDrag,
  onDrop,
  onFileSelect,
  dragActive
}) => {
  if (!open) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Processar PDFs em Lote
          </h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
          >
            ×
          </button>
        </div>

        {/* Área de Drop */}
        <div
          onDragEnter={onDrag}
          onDragLeave={onDrag}
          onDragOver={onDrag}
          onDrop={onDrop}
          className={`${styles.dropArea} ${dragActive ? styles.dropAreaActive : ''}`}
        >
          {arquivosSelecionados.length > 0 ? (
            <div>
              <div className={styles.filesSelected}>
                ✓ {arquivosSelecionados.length} arquivo(s) selecionado(s)
              </div>
              <div className={styles.filesList}>
                {arquivosSelecionados.map((arquivo, index) => (
                  <div key={index} className={styles.fileItem}>
                    {/* Ícone de sucesso */}
                    <div className={styles.fileIcon}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    {/* Nome do arquivo */}
                    <div className={styles.fileName}>
                      {arquivo.name}
                    </div>
                    {/* Tamanho do arquivo */}
                    <div className={styles.fileSize}>
                      {(arquivo.size / 1024 / 1024).toFixed(1)} MiB
                    </div>
                    {/* Botão excluir */}
                    <button
                      onClick={() => {
                        const novosArquivos = arquivosSelecionados.filter((_, i) => i !== index);
                        setArquivosSelecionados(novosArquivos);
                      }}
                      className={styles.deleteButton}
                    >
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.dropAreaIcon}
              >
                <path d="M21.917 13.484a4.38 4.38 0 0 0-5.19-4.26a6.281 6.281 0 0 0-11.75 2.19a3.24 3.24 0 0 0-2.66 2a3.43 3.43 0 0 0 .82 3.74c1.12 1.03 2.54.89 3.94.89h10.15a4.514 4.514 0 0 0 4.69-4.32Zm-4.65 3.56c-1.19.01-2.38 0-3.56 0c-2.75 0-5.49.06-8.23 0a2.38 2.38 0 0 1-2.33-1.73a2.333 2.333 0 0 1 2.28-2.94a.515.515 0 0 0 .5-.5a5.3 5.3 0 0 1 10.11-1.81a.5.5 0 0 0 .56.23a3.366 3.366 0 0 1 4.33 3.32" />
              </svg>
              <div className={styles.dropAreaTitle}>
                Arraste os arquivos PDF aqui
              </div>
              <div className={styles.dropAreaSubtitle}>
                ou clique para selecionar múltiplos arquivos
              </div>
              <input
                type="file"
                multiple
                accept=".pdf"
                onChange={onFileSelect}
                className={styles.fileInput}
                id="pdf-file-input"
              />
              <label
                htmlFor="pdf-file-input"
                className={styles.selectFilesButton}
              >
                Selecionar Arquivos
              </label>
            </div>
          )}
        </div>

        {/* Botão Processar */}
        {arquivosSelecionados.length > 0 && (
          <button
            onClick={onProcessar}
            disabled={processandoArquivo}
            className={styles.processButton}
          >
            {processandoArquivo ? (
              <div className={styles.processButtonContent}>
                <SpinnerGlobal size={16} variant="gradient" />
                Processando...
              </div>
            ) : (
              `Processar ${arquivosSelecionados.length} arquivo(s)`
            )}
          </button>
        )}

        {/* Resultado do Processamento */}
        {resultadoProcessamento && (
          <div className={`${styles.resultContainer} ${
            resultadoProcessamento.sucesso ? styles.resultSuccess : styles.resultError
          }`}>
            <div className={styles.resultHeader}>
              {resultadoProcessamento.sucesso ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="var(--onity-success)" />
                  <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="var(--onity-error)" />
                  <path d="M15 9l-6 6m0-6l6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span className={`${styles.resultTitle} ${
                resultadoProcessamento.sucesso ? styles.resultTitleSuccess : styles.resultTitleError
              }`}>
                {resultadoProcessamento.sucesso ? 'Sucesso!' : 'Erro'}
              </span>
            </div>

            <div className={`${styles.resultMessage} ${
              resultadoProcessamento.sucesso ? styles.resultMessageSuccess : styles.resultMessageError
            }`}>
              {resultadoProcessamento.mensagem}
            </div>

            {/* Informações detalhadas do lote */}
            {resultadoProcessamento.dados && typeof resultadoProcessamento.dados === 'object' && (
              <div className={styles.resultDetails}>
                <div className={styles.resultStats}>
                  <div className={styles.resultStat}>
                    📄 Total: {String(resultadoProcessamento.dados.total || 0)}
                  </div>
                  <div className={styles.resultStatSuccess}>
                    ✅ Sucessos: {String(resultadoProcessamento.dados.sucessos || 0)}
                  </div>
                  <div className={styles.resultStatError}>
                    ❌ Erros: {String(resultadoProcessamento.dados.erros || 0)}
                  </div>
                </div>

                {/* Lista de resultados */}
                {resultadoProcessamento.dados.resultados &&
                  Array.isArray(resultadoProcessamento.dados.resultados) &&
                  resultadoProcessamento.dados.resultados.length > 0 && (
                    <div className={styles.resultList}>
                      <div className={`${styles.resultListTitle} ${styles.resultListTitleSuccess}`}>
                        ✅ Arquivos processados:
                      </div>
                      <div className={styles.resultListItem}>
                        {resultadoProcessamento.dados.resultados.map((resultado, index) => (
                        <div key={index} className={styles.resultLine}>
                            📄 {String(resultado?.arquivo || '')} - {String(resultado?.dados?.cliente || '')} (
                            {String(resultado?.dados?.competencia || '')})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Lista de erros */}
                {resultadoProcessamento.dados.erros &&
                  Array.isArray(resultadoProcessamento.dados.erros) &&
                  resultadoProcessamento.dados.erros.length > 0 && (
                    <div className={styles.resultList}>
                      <div className={`${styles.resultListTitle} ${styles.resultListTitleError}`}>
                        ❌ Arquivos com erro:
                      </div>
                      <div className={styles.resultListItemError}>
                        {resultadoProcessamento.dados.erros.map((erro, index) => (
                          <div key={index} className={styles.resultLine}>
                            📄 {String(erro?.arquivo || '')} - {String(erro?.erro || '')}
                            {erro?.detalhes && (
                              <div className={styles.resultErrorDetails}>
                                Detalhes: {String(erro.detalhes)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
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

export default ModalPdfLayout;