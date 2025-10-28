"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import styles from "../../styles/financeiro/ImportarReceber.module.css";
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

// Utility para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');

export function ImportarReceber({ isOpen, onClose, onImportSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [previewData, setPreviewData] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [hasPreview, setHasPreview] = useState(false);
  
  const fileInputRef = useRef(null);
  const modalRef = useRef(null);

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
      const empresaId = localStorage.getItem("empresaId");
      const token = localStorage.getItem("token");

      if (!empresaId || !token || !API) {
        toast.error("Erro de autenticação. Faça login novamente.");
        return;
      }

      const formData = new FormData();
      formData.append("arquivo", selectedFile);

      const response = await fetch(`${API}/import/contas-a-receber/${empresaId}`, {
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
      const empresaId = localStorage.getItem("empresaId");
      const token = localStorage.getItem("token");

      if (!empresaId || !token || !API) {
        toast.error("Erro de autenticação. Faça login novamente.");
        return;
      }

      const formData = new FormData();
      formData.append("arquivo", selectedFile);
      formData.append("save", "true");

      const response = await fetch(`${API}/import/contas-a-receber/${empresaId}`, {
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

  // Handlers para modal
  const handleClickOutside = useCallback((event) => {
    if (modalRef.current && !modalRef.current.contains(event.target)) {
      handleClose();
    }
  }, []);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      handleClose();
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClickOutside, handleKeyDown]);

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
    <div className={styles.modalOverlay} onClick={handleClickOutside}>
      <div className={cn(styles.modalContent, styles.modal)} ref={modalRef}>
        <div className={styles.modalHeader}>
          <h2 className={cn(styles.modalTitle, styles.title)}>
            <Upload className={styles.titleIcon} />
            Importar Contas a Receber
          </h2>
          <p className={cn(styles.modalDescription, styles.description)}>
            Faça upload de uma planilha Excel ou CSV para importar contas a receber.
            <br />
            <span className={styles.descriptionSmall}>
              Formatos aceitos: .xlsx, .xls, .csv (máximo 10MB)
            </span>
          </p>
        </div>

        <div className={cn(styles.modalBody, styles.content)}>
          {/* Upload Section */}
          <div className={cn(styles.cardComponent, styles.card)}>
            <div className={cn(styles.cardHeaderComponent, styles.cardHeader)}>
              <h3 className={cn(styles.cardTitleComponent, styles.cardTitle)}>1. Selecionar Arquivo</h3>
            </div>
            <div className={cn(styles.cardContentComponent, styles.cardContent)}>
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
                  <label htmlFor="file-upload" className={cn(styles.labelComponent, styles.uploadLabel)}>
                    <div className={styles.uploadLabelText}>
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
                    className={cn(styles.inputComponent, styles.fileInput)}
                  />
                </div>
              ) : (
                <div className={styles.fileSelected}>
                  <div className={styles.fileInfo}>
                    <FileText className={styles.fileIcon} />
                    <div>
                      <p className={styles.fileName}>{fileName}</p>
                      <p className={styles.fileSize}>
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className={cn(styles.buttonComponent, styles.buttonComponentGhost, styles.buttonComponentSmall, styles.removeButton)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Preview Section */}
          {selectedFile && (
            <div className={cn(styles.cardComponent, styles.card)}>
              <div className={cn(styles.cardHeaderComponent, styles.cardHeader)}>
                <h3 className={cn(styles.cardTitleComponent, styles.cardTitleWithIcon)}>
                  <Eye className={styles.titleIcon} />
                  2. Visualizar Dados
                  {hasPreview && (
                    <span className={cn(styles.badgeComponent, styles.badgeComponentSecondary, styles.badge)}>
                      {totalRows} registros
                    </span>
                  )}
                </h3>
              </div>
              <div className={cn(styles.cardContentComponent, styles.cardContent)}>
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
                        <Loader2 className={styles.previewIconSpinning} />
                      ) : (
                        <Eye className={styles.previewIcon} />
                      )}
                      {isLoading ? "Processando..." : "Visualizar Dados"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className={styles.previewControls}>
                      <p className={styles.previewControlsDescription}>
                        Mostrando os primeiros 5 registros de {totalRows} total
                      </p>
                      <button 
                        type="button"
                        onClick={handlePreview}
                        disabled={isLoading}
                        className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.buttonComponentSmall, styles.previewControlsButton)}
                      >
                        {isLoading ? (
                          <Loader2 className={styles.previewIconSpinning} />
                        ) : (
                          <Eye className={styles.previewIcon} />
                        )}
                        Atualizar Preview
                      </button>
                    </div>
                    
                    <div className={styles.tableContainer}>
                      <table className={styles.table}>
                        <thead className={styles.tableHeader}>
                          <tr>
                            <th className={styles.tableHeaderCell}>Vencimento</th>
                            <th className={styles.tableHeaderCell}>Pagamento</th>
                            <th className={styles.tableHeaderCell}>Valor</th>
                            <th className={styles.tableHeaderCell}>Descrição</th>
                            <th className={styles.tableHeaderCell}>Categoria</th>
                            <th className={styles.tableHeaderCell}>Cliente/Fornecedor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, index) => (
                            <tr key={index} className={styles.tableRow}>
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
          <div className={cn(styles.cardComponent, styles.instructions)}>
            <div className={cn(styles.cardContentComponent, styles.instructionsContent)}>
              <div className={styles.instructionsHeader}>
                <AlertCircle className={styles.instructionsIcon} />
                <div>
                  <h4 className={styles.instructionsText}>
                    Formato esperado da planilha:
                  </h4>
                  <ul className={styles.instructionsSecondary}>
                    <li>• <strong>Vencimento:</strong> Data de vencimento (dd/mm/yyyy)</li>
                    <li>• <strong>Pagamento:</strong> Data de pagamento (dd/mm/yyyy) - opcional</li>
                    <li>• <strong>Valor:</strong> Valor da conta (R$ 1.234,56)</li>
                    <li>• <strong>Categoria:</strong> Nome da categoria</li>
                    <li>• <strong>Subcategoria:</strong> Nome da subcategoria - opcional</li>
                    <li>• <strong>Cliente/Fornecedor:</strong> Nome do cliente</li>
                    <li>• <strong>Conta:</strong> Nome da conta bancária</li>
                    <li>• <strong>Centro de Custo:</strong> Nome do centro de custo - opcional</li>
                    <li>• <strong>Descrição:</strong> Descrição da conta</li>
                    <li>• <strong>Observações:</strong> Observações adicionais - opcional</li>
                    <li>• <strong>Origem:</strong> Origem da conta - opcional</li>
                    <li>• <strong>Situação:</strong> Situação da conta - opcional</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={cn(styles.modalFooter, styles.footer)}>
          <button
            type="button"
            onClick={handleClose}
            disabled={isImporting}
            className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.cancelButton)}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!selectedFile || !hasPreview || isImporting}
            className={cn(styles.buttonComponent, styles.buttonComponentPrimary, styles.importButton)}
          >
            {isImporting ? (
              <Loader2 className={styles.importIconSpinning} />
            ) : (
              <CheckCircle className={styles.importIcon} />
            )}
            {isImporting ? "Importando..." : "Importar Dados"}
          </button>
        </div>
      </div>
    </div>
  );
} 