import { useState, useRef, useCallback, useEffect } from "react";
import styles from "../../styles/financeiro/importar-pagar.module.css";
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
import 'react-toastify/dist/ReactToastify.css';

// Função cn para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');

export function ImportarPagar({ isOpen, onClose, onImportSuccess }) {
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
      const empresaId = localStorage.getItem("empresaId");
      const token = localStorage.getItem("token");

      if (!empresaId || !token || !API) {
        toast.error("Erro de autenticação. Faça login novamente.");
        return;
      }

      const formData = new FormData();
      formData.append("arquivo", selectedFile);

      const response = await fetch(`${API}/import/contas-a-pagar/${empresaId}`, {
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

      const response = await fetch(`${API}/import/contas-a-pagar/${empresaId}`, {
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

  // Handler para clique fora do modal
  const handleClickOutside = useCallback((e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, []);

  // Handler para tecla ESC
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const formatValue = (value) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    return String(value);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleClickOutside}>
      <div className={cn(styles.modalContent, styles.importarPagarModal)}>
        <div className={styles.modalHeader}>
          <h2 className={cn(styles.modalTitle, styles.importarPagarTitle)}>
            <Upload className={styles.importarPagarIcon} />
            Importar Contas a Pagar
          </h2>
          <p className={cn(styles.modalDescription, styles.importarPagarDescription)}>
            Faça upload de uma planilha Excel ou CSV para importar contas a pagar.
            <br />
            <span className={styles.importarPagarDescription}>
              Formatos aceitos: .xlsx, .xls, .csv (máximo 10MB)
            </span>
          </p>
        </div>

        <div className={cn(styles.modalBody, styles.importarPagarSpaceY)}>
          {/* Upload Section */}
          <div className={cn(styles.cardComponent, styles.importarPagarCard)}>
            <div className={styles.cardHeaderComponent}>
              <h3 className={cn(styles.cardTitleComponent, styles.importarPagarCardTitle)}>1. Selecionar Arquivo</h3>
            </div>
            <div className={styles.cardContentComponent}>
              {!selectedFile ? (
                <div 
                  className={styles.importarPagarUploadArea}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-primary', 'bg-neonPurple/20');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-primary', 'bg-neonPurple/20');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-primary', 'bg-neonPurple/20');
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                      const file = files[0];
                      validateAndSetFile(file);
                    }
                  }}
                >
                  <Upload className={styles.importarPagarIcon} />
                  <label htmlFor="file-upload" className={cn(styles.labelComponent, "cursor-pointer")}>
                    <div className={styles.importarPagarLabel}>
                      Clique para selecionar um arquivo
                    </div>
                    <div className={styles.importarPagarDescription}>
                      ou arraste e solte aqui
                    </div>
                  </label>
                  <input
                    id="file-upload"
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className={styles.importarPagarHidden}
                  />
                </div>
              ) : (
                <div className={styles.importarPagarFileSelected}>
                  <div className={styles.importarPagarFlex}>
                    <FileText className={styles.importarPagarIcon} />
                    <div>
                      <p className={styles.importarPagarLabel}>{fileName}</p>
                      <p className={styles.importarPagarDescription}>
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className={cn(styles.buttonComponent, styles.buttonComponentGhost, styles.buttonComponentSmall, styles.importarPagarCancelBtn)}
                  >
                    <X className={styles.importarPagarIcon} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Preview Section */}
          {selectedFile && (
            <div className={cn(styles.cardComponent, styles.importarPagarCard)}>
              <div className={styles.cardHeaderComponent}>
                <h3 className={cn(styles.cardTitleComponent, styles.importarPagarCardTitle)}>
                  <Eye className={styles.importarPagarIcon} />
                  2. Visualizar Dados
                  {hasPreview && (
                    <span className={cn(styles.badgeComponent, styles.badgeComponentSecondary, styles.importarPagarBadge)}>
                      {totalRows} registros
                    </span>
                  )}
                </h3>
              </div>
              <div className={styles.cardContentComponent}>
                {!hasPreview ? (
                  <div className={styles.importarPagarTextCenter}>
                    <p className={styles.importarPagarDescription}>
                      Clique em &quot;Visualizar&quot; para ver os dados do arquivo antes de importar
                    </p>
                    <button 
                      type="button"
                      onClick={handlePreview} 
                      disabled={isLoading}
                      className={cn(styles.buttonComponent, styles.buttonComponentPrimary, styles.importarPagarPreviewBtn)}
                    >
                      {isLoading ? (
                        <Loader2 className={styles.importarPagarIcon} />
                      ) : (
                        <Eye className={styles.importarPagarIcon} />
                      )}
                      {isLoading ? "Processando..." : "Visualizar Dados"}
                    </button>
                  </div>
                ) : (
                  <div className={styles.importarPagarSpaceY}>
                    <div className={styles.importarPagarFlexBetween}>
                      <p className={styles.importarPagarDescription}>
                        Mostrando os primeiros 5 registros de {totalRows} total
                      </p>
                      <button 
                        type="button"
                        onClick={handlePreview}
                        disabled={isLoading}
                        className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.buttonComponentSmall, styles.importarPagarPreviewBtn)}
                      >
                        {isLoading ? (
                          <Loader2 className={styles.importarPagarIcon} />
                        ) : (
                          <Eye className={styles.importarPagarIcon} />
                        )}
                        Atualizar Preview
                      </button>
                    </div>
                    
                    <div className={styles.importarPagarOverflowX}>
                      <table className={styles.importarPagarTable}>
                        <thead>
                          <tr>
                            <th className={styles.importarPagarTableHeader}>Vencimento</th>
                            <th className={styles.importarPagarTableHeader}>Pagamento</th>
                            <th className={styles.importarPagarTableHeader}>Valor</th>
                            <th className={styles.importarPagarTableHeader}>Descrição</th>
                            <th className={styles.importarPagarTableHeader}>Categoria</th>
                            <th className={styles.importarPagarTableHeader}>Cliente/Fornecedor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, index) => (
                            <tr key={index} className={styles.importarPagarTableRow}>
                              <td className={styles.importarPagarTableCell}>{formatValue(row.Vencimento)}</td>
                              <td className={styles.importarPagarTableCell}>{formatValue(row.Pagamento)}</td>
                              <td className={styles.importarPagarTableCell}>{formatValue(row.Valor)}</td>
                              <td className={styles.importarPagarTableCell}>{formatValue(row.Descrição)}</td>
                              <td className={styles.importarPagarTableCell}>{formatValue(row.Categoria)}</td>
                              <td className={styles.importarPagarTableCell}>{formatValue(row["Cliente/Fornecedor"])}</td>
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
          <div className={cn(styles.cardComponent, styles.importarPagarInstructions)}>
            <div className={styles.cardContentComponent}>
              <div className={styles.importarPagarFlexStart}>
                <div>
                  <h4 className={styles.importarPagarInstructionsText}>
                    Formato esperado da planilha:
                  </h4>
                  <ul className={styles.importarPagarInstructionsSecondary}>
                    <li><strong>Vencimento:</strong> Data de vencimento (dd/mm/yyyy)</li>
                    <li><strong>Pagamento:</strong> Data de pagamento (dd/mm/yyyy) - opcional</li>
                    <li><strong>Valor:</strong> Valor da conta (R$ 1.234,56)</li>
                    <li><strong>Categoria:</strong> Nome da categoria</li>
                    <li><strong>Subcategoria:</strong> Nome da subcategoria - opcional</li>
                    <li><strong>Cliente/Fornecedor:</strong> Nome do fornecedor</li>
                    <li><strong>Conta:</strong> Nome da conta bancária</li>
                    <li><strong>Centro de Custo:</strong> Nome do centro de custo - opcional</li>
                    <li><strong>Descrição:</strong> Descrição da conta</li>
                    <li><strong>Observações:</strong> Observações adicionais - opcional</li>
                    <li><strong>Origem:</strong> Origem da conta - opcional</li>
                    <li><strong>Situação:</strong> Situação da conta - opcional</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={cn(styles.modalFooter, styles.importarPagarFlex)}>
          <button 
            type="button"
            onClick={handleClose} 
            disabled={isImporting} 
            className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.importarPagarCancelBtn)}
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={handleImport} 
            disabled={!selectedFile || !hasPreview || isImporting}
            className={cn(styles.buttonComponent, styles.buttonComponentPrimary, styles.importarPagarImportBtn)}
          >
            {isImporting ? (
              <Loader2 className={styles.importarPagarIcon} />
            ) : (
              <CheckCircle className={styles.importarPagarIcon} />
            )}
            {isImporting ? "Importando..." : "Importar Dados"}
          </button>
        </div>
      </div>
    </div>
  );
} 