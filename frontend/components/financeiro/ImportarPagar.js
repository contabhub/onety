import { useState, useRef } from "react";
import { Button } from "./botao";
import styles from "../../styles/financeiro/importar-pagar.module.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Label } from "./label";
import { Input } from "./input";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
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

  const formatValue = (value) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    return String(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn(styles.importarPagarModal, "max-w-4xl max-h-[90vh] overflow-y-auto")}>
        <DialogHeader>
          <DialogTitle className={cn(styles.importarPagarTitle, "flex items-center gap-2")}>
            <Upload className={cn(styles.importarPagarIcon, "h-5 w-5")} />
            Importar Contas a Pagar
          </DialogTitle>
          <DialogDescription className={styles.importarPagarDescription}>
            Faça upload de uma planilha Excel ou CSV para importar contas a pagar.
            <br />
            <span className={cn(styles.importarPagarDescription, "text-xs")}>
              Formatos aceitos: .xlsx, .xls, .csv (máximo 10MB)
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Section */}
          <Card className={styles.importarPagarCard}>
            <CardHeader>
              <CardTitle className={cn(styles.importarPagarCardTitle, "text-lg")}>1. Selecionar Arquivo</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedFile ? (
                <div 
                  className={cn(styles.importarPagarUploadArea, "rounded-lg p-8 text-center transition-colors")}
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
                  <Upload className={cn(styles.importarPagarIcon, "h-12 w-12 mx-auto mb-4")} />
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <div className={cn(styles.importarPagarLabel, "text-lg font-medium mb-2")}>
                      Clique para selecionar um arquivo
                    </div>
                    <div className={cn(styles.importarPagarDescription, "text-sm")}>
                      ou arraste e solte aqui
                    </div>
                  </Label>
                  <Input
                    id="file-upload"
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className={cn(styles.importarPagarFileSelected, "flex items-center justify-between p-4 rounded-lg")}>
                  <div className="flex items-center gap-3">
                    <FileText className={cn(styles.importarPagarIcon, "h-8 w-8")} />
                    <div>
                      <p className={cn(styles.importarPagarLabel, "font-medium")}>{fileName}</p>
                      <p className={cn(styles.importarPagarDescription, "text-sm")}>
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    className="text-hotPink hover:text-hotPink/80"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview Section */}
          {selectedFile && (
            <Card className={styles.importarPagarCard}>
              <CardHeader>
                <CardTitle className={cn(styles.importarPagarCardTitle, "text-lg flex items-center gap-2")}>
                  <Eye className={cn(styles.importarPagarIcon, "h-5 w-5")} />
                  2. Visualizar Dados
                  {hasPreview && (
                    <Badge variant="secondary" className={cn(styles.importarPagarBadge, "ml-2")}>
                      {totalRows} registros
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!hasPreview ? (
                  <div className="text-center py-8">
                    <p className={cn(styles.importarPagarDescription, "mb-4")}>
                      Clique em &quot;Visualizar&quot; para ver os dados do arquivo antes de importar
                    </p>
                    <Button 
                      onClick={handlePreview} 
                      disabled={isLoading}
                      className={cn(styles.importarPagarPreviewBtn, "gap-2")}
                    >
                      {isLoading ? (
                        <Loader2 className={cn(styles.importarPagarIcon, "h-4 w-4 animate-spin")} />
                      ) : (
                        <Eye className={cn(styles.importarPagarIcon, "h-4 w-4")} />
                      )}
                      {isLoading ? "Processando..." : "Visualizar Dados"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className={cn(styles.importarPagarDescription, "text-sm")}>
                        Mostrando os primeiros 5 registros de {totalRows} total
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handlePreview}
                        disabled={isLoading}
                        className={styles.importarPagarPreviewBtn}
                      >
                        {isLoading ? (
                          <Loader2 className={cn(styles.importarPagarIcon, "h-4 w-4 animate-spin")} />
                        ) : (
                          <Eye className={cn(styles.importarPagarIcon, "h-4 w-4")} />
                        )}
                        Atualizar Preview
                      </Button>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className={cn(styles.importarPagarTable, "w-full text-sm")}>
                        <thead>
                          <tr>
                            <th className={cn(styles.importarPagarTableHeader, "text-left p-2 font-medium")}>Vencimento</th>
                            <th className={cn(styles.importarPagarTableHeader, "text-left p-2 font-medium")}>Pagamento</th>
                            <th className={cn(styles.importarPagarTableHeader, "text-left p-2 font-medium")}>Valor</th>
                            <th className={cn(styles.importarPagarTableHeader, "text-left p-2 font-medium")}>Descrição</th>
                            <th className={cn(styles.importarPagarTableHeader, "text-left p-2 font-medium")}>Categoria</th>
                            <th className={cn(styles.importarPagarTableHeader, "text-left p-2 font-medium")}>Cliente/Fornecedor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, index) => (
                            <tr key={index} className={styles.importarPagarTableRow}>
                              <td className={cn(styles.importarPagarTableCell, "p-2")}>{formatValue(row.Vencimento)}</td>
                              <td className={cn(styles.importarPagarTableCell, "p-2")}>{formatValue(row.Pagamento)}</td>
                              <td className={cn(styles.importarPagarTableCell, "p-2 font-medium")}>{formatValue(row.Valor)}</td>
                              <td className={cn(styles.importarPagarTableCell, "p-2")}>{formatValue(row.Descrição)}</td>
                              <td className={cn(styles.importarPagarTableCell, "p-2")}>{formatValue(row.Categoria)}</td>
                              <td className={cn(styles.importarPagarTableCell, "p-2")}>{formatValue(row["Cliente/Fornecedor"])}</td>
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
          <Card className={styles.importarPagarInstructions}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className={cn(styles.importarPagarIcon, "h-5 w-5 mt-0.5")} />
                <div>
                  <h4 className={cn(styles.importarPagarInstructionsText, "font-medium mb-2")}>
                    Formato esperado da planilha:
                  </h4>
                  <ul className={cn(styles.importarPagarInstructionsSecondary, "text-sm space-y-1")}>
                    <li>• <strong>Vencimento:</strong> Data de vencimento (dd/mm/yyyy)</li>
                    <li>• <strong>Pagamento:</strong> Data de pagamento (dd/mm/yyyy) - opcional</li>
                    <li>• <strong>Valor:</strong> Valor da conta (R$ 1.234,56)</li>
                    <li>• <strong>Categoria:</strong> Nome da categoria</li>
                    <li>• <strong>Subcategoria:</strong> Nome da subcategoria - opcional</li>
                    <li>• <strong>Cliente/Fornecedor:</strong> Nome do fornecedor</li>
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

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isImporting} className={styles.importarPagarCancelBtn}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!selectedFile || !hasPreview || isImporting}
            className={cn(styles.importarPagarImportBtn, "gap-2")}
          >
            {isImporting ? (
              <Loader2 className={cn(styles.importarPagarIcon, "h-4 w-4 animate-spin")} />
            ) : (
              <CheckCircle className={cn(styles.importarPagarIcon, "h-4 w-4")} />
            )}
            {isImporting ? "Importando..." : "Importar Dados"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 