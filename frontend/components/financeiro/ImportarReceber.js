"use client";

import { useState, useRef } from "react";
import { Button } from "../../components/financeiro/botao";
import styles from "../../styles/financeiro/ImportarReceber.module.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/financeiro/dialog";
import { Label } from "../../components/financeiro/label";
import { Input } from "../../components/financeiro/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/financeiro/card";
import { Badge } from "../../components/financeiro/badge";
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

export function ImportarReceber({ isOpen, onClose, onImportSuccess }) {
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

  const handleClose = () => {
    handleRemoveFile();
    onClose();
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    return String(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={styles.modal}>
        <DialogHeader>
          <DialogTitle className={styles.title}>
            <Upload className={styles.titleIcon} />
            Importar Contas a Receber
          </DialogTitle>
          <DialogDescription className={styles.description}>
            Faça upload de uma planilha Excel ou CSV para importar contas a receber.
            <br />
            <span className={styles.descriptionSmall}>
              Formatos aceitos: .xlsx, .xls, .csv (máximo 10MB)
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className={styles.content}>
          {/* Upload Section */}
          <Card className={styles.card}>
            <CardHeader className={styles.cardHeader}>
              <CardTitle className={styles.cardTitle}>1. Selecionar Arquivo</CardTitle>
            </CardHeader>
            <CardContent className={styles.cardContent}>
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
                  <Label htmlFor="file-upload" className={styles.uploadLabel}>
                    <div className={styles.uploadLabelText}>
                      Clique para selecionar um arquivo
                    </div>
                    <div className={styles.uploadDescription}>
                      ou arraste e solte aqui
                    </div>
                  </Label>
                  <Input
                    id="file-upload"
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className={styles.fileInput}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    className={styles.removeButton}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview Section */}
          {selectedFile && (
            <Card className={styles.card}>
              <CardHeader className={styles.cardHeader}>
                <CardTitle className={styles.cardTitleWithIcon}>
                  <Eye className={styles.titleIcon} />
                  2. Visualizar Dados
                  {hasPreview && (
                    <Badge variant="secondary" className={styles.badge}>
                      {totalRows} registros
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className={styles.cardContent}>
                {!hasPreview ? (
                  <div className={styles.previewSection}>
                    <p className={styles.previewDescription}>
                      Clique em &quot;Visualizar&quot; para ver os dados do arquivo antes de importar
                    </p>
                    <Button 
                      onClick={handlePreview} 
                      disabled={isLoading}
                      className={styles.previewButton}
                    >
                      {isLoading ? (
                        <Loader2 className={styles.previewIconSpinning} />
                      ) : (
                        <Eye className={styles.previewIcon} />
                      )}
                      {isLoading ? "Processando..." : "Visualizar Dados"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className={styles.previewControls}>
                      <p className={styles.previewControlsDescription}>
                        Mostrando os primeiros 5 registros de {totalRows} total
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handlePreview}
                        disabled={isLoading}
                        className={styles.previewControlsButton}
                      >
                        {isLoading ? (
                          <Loader2 className={styles.previewIconSpinning} />
                        ) : (
                          <Eye className={styles.previewIcon} />
                        )}
                        Atualizar Preview
                      </Button>
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
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Card className={styles.instructions}>
            <CardContent className={styles.instructionsContent}>
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
            </CardContent>
          </Card>
        </div>

        <DialogFooter className={styles.footer}>
          <Button variant="outline" onClick={handleClose} disabled={isImporting} className={styles.cancelButton}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!selectedFile || !hasPreview || isImporting}
            className={styles.importButton}
          >
            {isImporting ? (
              <Loader2 className={styles.importIconSpinning} />
            ) : (
              <CheckCircle className={styles.importIcon} />
            )}
            {isImporting ? "Importando..." : "Importar Dados"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 