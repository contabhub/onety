"use client";

import { useState, useRef } from "react";
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Download,
  Eye
} from "lucide-react";
import { toast } from "react-toastify";
import styles from "../../styles/financeiro/ImportarMovimentacoes.module.css";

// Função cn para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');

export function ImportarMovimentacoes({ isOpen, onClose, onImportSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [previewData, setPreviewData] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [hasPreview, setHasPreview] = useState(false);
  const fileInputRef = useRef(null);

  const API = process.env.NEXT_PUBLIC_API_URL;

  const validateAndSetFile = (file) => {
    // Validar tipo de arquivo
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV (.csv)");
      return;
    }

    // Validar tamanho (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 10MB");
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setPreviewData([]);
    setTotalRows(0);
    setHasPreview(false);
    
    toast.success(`Arquivo "${file.name}" selecionado com sucesso!`);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      toast.error("Por favor, selecione um arquivo primeiro");
      return;
    }

    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      const empresaId = userData.EmpresaId;

      if (!empresaId || !token || !API) {
        toast.error("Erro de autenticação. Faça login novamente.");
        return;
      }

      const formData = new FormData();
      formData.append("arquivo", selectedFile);

      const response = await fetch(`${API}/financeiro/importar/movimentacoes/${empresaId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.erro || "Erro ao processar arquivo");
      }

      const data = await response.json();
      
      setPreviewData(data.preview || []);
      setTotalRows(data.total || 0);
      setHasPreview(true);
      
      toast.success(`Preview gerado com sucesso! ${data.total} registros encontrados.`);
      
    } catch (error) {
      console.error("Erro ao gerar preview:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao processar arquivo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Por favor, selecione um arquivo primeiro");
      return;
    }

    try {
      setIsImporting(true);
      const token = localStorage.getItem("token");
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      const empresaId = userData.EmpresaId;

      if (!empresaId || !token || !API) {
        toast.error("Erro de autenticação. Faça login novamente.");
        return;
      }

      const formData = new FormData();
      formData.append("arquivo", selectedFile);
      formData.append("save", "true");

      const response = await fetch(`${API}/financeiro/importar/movimentacoes/${empresaId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.erro || "Erro ao importar dados");
      }

      const data = await response.json();
      
      toast.success(data.mensagem || "Importação concluída com sucesso!");
      
      // Limpar estado
      setSelectedFile(null);
      setFileName("");
      setPreviewData([]);
      setTotalRows(0);
      setHasPreview(false);
      
      // Fechar modal
      onClose();
      
      // Callback de sucesso
      if (onImportSuccess) {
        onImportSuccess();
      }
      
    } catch (error) {
      console.error("Erro ao importar:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao importar dados");
    } finally {
      setIsImporting(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileName("");
    setPreviewData([]);
    setTotalRows(0);
    setHasPreview(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    handleRemoveFile();
    onClose();
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    return String(value);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            <Upload className={styles.dialogIcon} />
            Importar Movimentações
          </h3>
          <button onClick={handleClose} className={styles.closeButton}>
            <X className={styles.closeIcon} />
          </button>
        </div>
        <p className={styles.modalDescription}>
          Faça upload de uma planilha Excel ou CSV para importar movimentações financeiras.
          <br />
          <span className={styles.dialogDescriptionSmall}>
            Formatos aceitos: .xlsx, .xls, .csv (máximo 10MB)
          </span>
        </p>

        <div className={styles.formContainer}>
          {/* Upload Section */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h4 className={styles.cardTitle}>1. Selecionar Arquivo</h4>
            </div>
            <div className={styles.cardContent}>
              {!selectedFile ? (
                <div 
                  className={styles.uploadArea}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add(styles.dragOver);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove(styles.dragOver);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove(styles.dragOver);
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                      const file = files[0];
                      validateAndSetFile(file);
                    }
                  }}
                >
                  <Upload className={styles.uploadIcon} />
                  <label htmlFor="file-upload" className={styles.uploadLabel}>
                    <div className={styles.uploadLabel}>
                      Clique para selecionar um arquivo
                    </div>
                    <div className={styles.uploadDescription}>
                      ou arraste e solte aqui
                    </div>
                  </label>
                  <input
                    id="file-upload"
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className={styles.hiddenInput}
                  />
                </div>
              ) : (
                <div className={styles.fileSelected}>
                  <div className={styles.fileInfo}>
                    <FileText className={styles.fileIcon} />
                    <div className={styles.fileDetails}>
                      <p className={styles.fileName}>{fileName}</p>
                      <p className={styles.fileSize}>
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className={cn(styles.buttonComponent, styles.buttonComponentGhost, styles.removeButton)}
                  >
                    <X className={styles.removeIcon} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Preview Section */}
          {selectedFile && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h4 className={styles.cardTitle}>
                  <Eye className={styles.dialogIcon} />
                  2. Visualizar Dados
                  {hasPreview && (
                    <span className={styles.badgeCount}>
                      {totalRows} registros
                    </span>
                  )}
                </h4>
              </div>
              <div className={styles.cardContent}>
                {!hasPreview ? (
                  <div className={styles.previewSection}>
                    <p className={styles.previewDescription}>
                      Clique em &quot;Visualizar&quot; para ver os dados do arquivo antes de importar
                    </p>
                    <button 
                      type="button"
                      onClick={handlePreview} 
                      disabled={isLoading}
                      className={cn(styles.buttonComponent, styles.buttonComponentPrimary, styles.previewButton)}
                    >
                      {isLoading ? (
                        <Loader2 className={styles.loadingIcon} />
                      ) : (
                        <Eye className={styles.buttonIcon} />
                      )}
                      {isLoading ? "Processando..." : "Visualizar Dados"}
                    </button>
                  </div>
                ) : (
                  <div className={styles.formContainer}>
                    <div className={styles.previewHeader}>
                      <p className={styles.previewStats}>
                        Mostrando os primeiros 5 registros de {totalRows} total
                      </p>
                      <button 
                        type="button"
                        onClick={handlePreview}
                        disabled={isLoading}
                        className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.buttonComponentSmall, styles.refreshButton)}
                      >
                        {isLoading ? (
                          <Loader2 className={styles.loadingIcon} />
                        ) : (
                          <Eye className={styles.buttonIcon} />
                        )}
                        Atualizar Preview
                      </button>
                    </div>
                    
                    <div className={styles.tableContainer}>
                      <table className={styles.table}>
                        <thead className={styles.tableHeader}>
                          <tr>
                            <th>Tipo</th>
                            <th>Vencimento</th>
                            <th>Pagamento</th>
                            <th>Valor</th>
                            <th>Descrição</th>
                            <th>Categoria</th>
                            <th>Cliente/Fornecedor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, index) => (
                            <tr key={index} className={styles.tableRow}>
                              <td>
                                <span 
                                  className={row.Tipo?.toLowerCase() === 'entrada' ? styles.badgeDefault : styles.badgeSecondary}
                                >
                                  {row.Tipo || '-'}
                                </span>
                              </td>
                              <td className={styles.tableCell}>{formatValue(row.Vencimento)}</td>
                              <td className={styles.tableCell}>{formatValue(row.Pagamento)}</td>
                              <td className={styles.tableCellBold}>{formatValue(row.Valor)}</td>
                              <td className={styles.tableCell}>{formatValue(row.Descrição)}</td>
                              <td className={styles.tableCell}>{formatValue(row.Categoria)}</td>
                              <td className={styles.tableCell}>{formatValue(row["Cliente/Fornecedor"])}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className={styles.instructionsCard}>
            <div className={styles.cardContent}>
              <div className={styles.fileInfo}>
                <AlertCircle className={styles.instructionsIcon} />
                <div>
                  <h4 className={styles.instructionsText}>
                    Formato esperado da planilha:
                  </h4>
                  <ul className={styles.instructionsList}>
                    <li>• <strong>Tipo:</strong> "entrada" para receitas ou "saida" para despesas</li>
                    <li>• <strong>Vencimento:</strong> Data de vencimento (dd/mm/yyyy)</li>
                    <li>• <strong>Pagamento:</strong> Data de pagamento (dd/mm/yyyy) - opcional</li>
                    <li>• <strong>Valor:</strong> Valor da movimentação (R$ 1.234,56)</li>
                    <li>• <strong>Categoria:</strong> Nome da categoria</li>
                    <li>• <strong>Subcategoria:</strong> Nome da subcategoria - opcional</li>
                    <li>• <strong>Cliente/Fornecedor:</strong> Nome do cliente ou fornecedor</li>
                    <li>• <strong>Conta:</strong> Nome da conta bancária</li>
                    <li>• <strong>Centro de Custo:</strong> Nome do centro de custo - opcional</li>
                    <li>• <strong>Descrição:</strong> Descrição da movimentação</li>
                    <li>• <strong>Observações:</strong> Observações adicionais - opcional</li>
                    <li>• <strong>Origem:</strong> Origem da movimentação - opcional</li>
                    <li>• <strong>Situação:</strong> Situação da movimentação - opcional</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Download Template */}
          <div className={styles.templateCard}>
            <div className={styles.cardContent}>
              <div className={styles.fileInfo}>
                <Download className={styles.templateIcon} />
                <div>
                  <h4 className={styles.templateTitle}>
                    Modelo de planilha
                  </h4>
                  <p className={styles.templateDescription}>
                    Baixe o modelo de planilha para garantir que os dados estejam no formato correto.
                  </p>
                  <button 
                    type="button"
                    className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.buttonComponentSmall, styles.templateButton)}
                    onClick={() => {
                      // Aqui você pode implementar o download do template
                      toast.info("Funcionalidade de download do template será implementada em breve");
                    }}
                  >
                    <Download className={styles.buttonIcon} />
                    Baixar Modelo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button 
            type="button"
            onClick={handleClose} 
            disabled={isImporting} 
            className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.button, styles.buttonOutline)}
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={handleImport} 
            disabled={!selectedFile || !hasPreview || isImporting}
            className={cn(styles.buttonComponent, styles.buttonComponentPrimary, styles.button, styles.buttonPrimary)}
          >
            {isImporting ? (
              <Loader2 className={styles.loadingIcon} />
            ) : (
              <CheckCircle className={styles.buttonIcon} />
            )}
            {isImporting ? "Importando..." : "Importar Dados"}
          </button>
        </div>
      </div>
    </div>
  );
} 