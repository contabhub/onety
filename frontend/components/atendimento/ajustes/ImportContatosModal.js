import { useState, useRef } from 'react';
import styles from './ImportContatosModal.module.css';
import { X, Upload, FileSpreadsheet, FileText, Download, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

export default function ImportContatosModal({ isOpen, onClose, onImportSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  // Limpar estado quando modal fechar
  const handleClose = () => {
    setSelectedFile(null);
    setLoading(false);
    setError(null);
    setSuccess(null);
    setPreviewData(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  // Validar tipo de arquivo
  const isValidFileType = (file) => {
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const validExtensions = ['.csv', '.xls', '.xlsx'];
    
    const hasValidType = validTypes.includes(file.type);
    const hasValidExtension = validExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    
    return hasValidType || hasValidExtension;
  };

  // Manipular seleção de arquivo
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    
    if (!file) {
      setSelectedFile(null);
      setPreviewData(null);
      setError(null);
      return;
    }

    if (!isValidFileType(file)) {
      setError('Por favor, selecione um arquivo CSV ou XLS válido.');
      setSelectedFile(null);
      setPreviewData(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      setError('O arquivo deve ter no máximo 5MB.');
      setSelectedFile(null);
      setPreviewData(null);
      return;
    }

    setSelectedFile(file);
    setError(null);
    setSuccess(null);
    
    // Fazer preview dos dados
    previewFileData(file);
  };

  // Fazer preview dos dados do arquivo
  const previewFileData = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('preview', 'true');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = localStorage.getItem('token');
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').EmpresaId;

      const response = await fetch(`${apiUrl}/atendimento/leads/import/preview`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Company-ID': companyId
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao fazer preview do arquivo');
      }

      const data = await response.json();
      setPreviewData(data);
    } catch (err) {
      console.error('Erro ao fazer preview:', err);
      setError(err.message || 'Erro ao processar arquivo para preview');
    }
  };

  // Executar importação
  const handleImport = async () => {
    if (!selectedFile) {
      setError('Por favor, selecione um arquivo.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append('file', selectedFile);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = localStorage.getItem('token');
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').EmpresaId;

      const response = await fetch(`${apiUrl}/atendimento/leads/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Company-ID': companyId
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao importar contatos');
      }

      const result = await response.json();
      setImportResult(result);
      setSuccess(`Importação concluída! ${result.imported} contatos importados com sucesso.`);
      
      // Chamar callback de sucesso
      if (onImportSuccess) {
        onImportSuccess(result);
      }

    } catch (err) {
      console.error('Erro na importação:', err);
      setError(err.message || 'Erro ao importar contatos');
    } finally {
      setLoading(false);
    }
  };

  // Download do template CSV
  const downloadCSVTemplate = () => {
    const csvContent = "nome,email,telefone\nJoão Silva,joao@exemplo.com,11999999999\nMaria Santos,maria@exemplo.com,11888888888";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_contatos.csv';
    link.click();
  };

  // Download do template XLS
  const downloadXLSTemplate = () => {
    // Para XLS, vamos usar uma biblioteca como SheetJS ou criar um CSV com extensão .xlsx
    const csvContent = "nome,email,telefone\nJoão Silva,joao@exemplo.com,11999999999\nMaria Santos,maria@exemplo.com,11888888888";
    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_contatos.xlsx';
    link.click();
  };

  // Renderizar preview dos dados
  const renderPreview = () => {
    if (!previewData) return null;

    return (
      <div className={styles.previewSection}>
        <h4 className={styles.previewTitle}>
          <FileSpreadsheet size={16} />
          Preview dos Dados ({previewData.totalRows} linhas)
        </h4>
        
        {previewData.errors && previewData.errors.length > 0 && (
          <div className={styles.warningSection}>
            <AlertCircle size={16} />
            <span>Encontrados {previewData.errors.length} erros que serão ignorados:</span>
            <ul>
              {previewData.errors.slice(0, 3).map((error, index) => (
                <li key={index}>{error}</li>
              ))}
              {previewData.errors.length > 3 && (
                <li>... e mais {previewData.errors.length - 3} erros</li>
              )}
            </ul>
          </div>
        )}

        <div className={styles.previewTable}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Telefone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {previewData.validRows.slice(0, 5).map((row, index) => (
                <tr key={index}>
                  <td>{row.nome || '-'}</td>
                  <td>{row.email || '-'}</td>
                  <td>{row.telefone || '-'}</td>
                  <td>
                    <span className={styles.validBadge}>
                      <CheckCircle size={12} />
                      Válido
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {previewData.validRows.length > 5 && (
            <p className={styles.moreRows}>
              ... e mais {previewData.validRows.length - 5} contatos
            </p>
          )}
        </div>
      </div>
    );
  };

  // Renderizar resultado da importação
  const renderImportResult = () => {
    if (!importResult) return null;

    return (
      <div className={styles.resultSection}>
        <h4 className={styles.resultTitle}>
          <CheckCircle size={16} />
          Resultado da Importação
        </h4>
        
        <div className={styles.resultStats}>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{importResult.imported}</span>
            <span className={styles.statLabel}>Importados</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{importResult.errors || 0}</span>
            <span className={styles.statLabel}>Erros</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{importResult.skipped || 0}</span>
            <span className={styles.statLabel}>Ignorados</span>
          </div>
        </div>

        {importResult.errors > 0 && (
          <div className={styles.errorDetails}>
            <AlertCircle size={16} />
            <span>Alguns contatos não puderam ser importados. Verifique os dados no arquivo.</span>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <Upload size={20} />
            Importar Contatos
          </h2>
          <button className={styles.closeButton} onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {/* Seção de Templates */}
          <div className={styles.templateSection}>
            <h4 className={styles.sectionTitle}>Baixar Templates</h4>
            <p className={styles.sectionDescription}>
              Baixe um modelo para ver o formato correto dos dados:
            </p>
            
            <div className={styles.templateButtons}>
              <button 
                className={styles.templateButton}
                onClick={downloadCSVTemplate}
                type="button"
              >
                <FileText size={16} />
                <div>
                  <span>Arquivo CSV</span>
                  <small>Formato simples</small>
                </div>
                <Download size={16} />
              </button>
              
              <button 
                className={styles.templateButton}
                onClick={downloadXLSTemplate}
                type="button"
              >
                <FileSpreadsheet size={16} />
                <div>
                  <span>Arquivo Excel</span>
                  <small>Formato avançado</small>
                </div>
                <Download size={16} />
              </button>
            </div>
          </div>

          {/* Seção de Upload */}
          <div className={styles.uploadSection}>
            <h4 className={styles.sectionTitle}>Selecionar Arquivo</h4>
            
            <div className={styles.fileUploadArea}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileSelect}
                className={styles.fileInput}
                id="file-upload"
              />
              
              <label htmlFor="file-upload" className={styles.fileUploadLabel}>
                <Upload size={24} />
                <div>
                  <span>Clique para selecionar ou arraste o arquivo aqui</span>
                  <small>Formatos aceitos: CSV, XLS, XLSX (máx. 5MB)</small>
                </div>
              </label>
            </div>

            {selectedFile && (
              <div className={styles.selectedFile}>
                <FileSpreadsheet size={16} />
                <span>{selectedFile.name}</span>
                <span className={styles.fileSize}>
                  ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
            )}
          </div>

          {/* Preview dos dados */}
          {renderPreview()}

          {/* Resultado da importação */}
          {renderImportResult()}

          {/* Mensagens de erro e sucesso */}
          {error && (
            <div className={styles.errorMessage}>
              <XCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className={styles.successMessage}>
              <CheckCircle size={16} />
              <span>{success}</span>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={handleClose}
            disabled={loading}
          >
            {success ? 'Fechar' : 'Cancelar'}
          </button>
          
          {!success && (
            <button
              type="button"
              className={styles.importButton}
              onClick={handleImport}
              disabled={loading || !selectedFile || !previewData?.validRows?.length}
            >
              {loading ? (
                <>
                  <div className={styles.spinner}></div>
                  Importando...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Importar Contatos
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
