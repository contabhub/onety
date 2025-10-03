import { useState } from 'react';
import styles from './ExportContatosModal.module.css';
import { X, FileSpreadsheet, FileText, Download, CheckCircle, AlertCircle } from 'lucide-react';

export default function ExportContatosModal({ isOpen, onClose, onExportSuccess }) {
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Limpar estado quando modal fechar
  const handleClose = () => {
    setSelectedFormat(null);
    setLoading(false);
    setError(null);
    setSuccess(null);
    onClose();
  };

  const handleFormatSelect = (format) => {
    setSelectedFormat(format);
    setError(null);
    setSuccess(null);
  };

  const handleExport = async () => {
    if (!selectedFormat) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = localStorage.getItem('token');
      const companyId = JSON.parse(localStorage.getItem('userData') || '{}').EmpresaId;

      const response = await fetch(`${apiUrl}/atendimento/leads/export/${selectedFormat}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Company-ID': companyId
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao exportar contatos: ${response.statusText}`);
      }

      // Obter o nome do arquivo do header Content-Disposition
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `contatos.${selectedFormat}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
        
      }

      // Criar blob e fazer download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess(`Contatos exportados com sucesso em formato ${selectedFormat.toUpperCase()}!`);
      
      if (onExportSuccess) {
        onExportSuccess();
      }

    } catch (error) {
      console.error('Erro ao exportar contatos:', error);
      setError(error.message || 'Erro ao exportar contatos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatOptions = [
    {
      id: 'xls',
      name: 'Excel',
      description: 'Planilha Excel (.xlsx)',
      icon: FileSpreadsheet,
      color: '#10B981', // Verde
      bgColor: 'rgba(16, 185, 129, 0.1)',
      borderColor: 'rgba(16, 185, 129, 0.3)'
    },
    {
      id: 'pdf',
      name: 'PDF',
      description: 'Documento PDF (.pdf)',
      icon: FileText,
      color: '#EF4444', // Vermelho
      bgColor: 'rgba(239, 68, 68, 0.1)',
      borderColor: 'rgba(239, 68, 68, 0.3)'
    },
    {
      id: 'csv',
      name: 'CSV',
      description: 'Arquivo CSV (.csv)',
      icon: Download,
      color: '#6B7280', // Cinza
      bgColor: 'rgba(107, 114, 128, 0.1)',
      borderColor: 'rgba(107, 114, 128, 0.3)'
    }
  ];

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <Download size={24} />
            Exportar Contatos
          </h2>
          <button className={styles.closeButton} onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.description}>
            <p>Selecione o formato para exportar seus contatos:</p>
          </div>

          <div className={styles.formatGrid}>
            {formatOptions.map((format) => {
              const IconComponent = format.icon;
              const isSelected = selectedFormat === format.id;
              
              return (
                <div
                  key={format.id}
                  className={`${styles.formatOption} ${isSelected ? styles.selected : ''}`}
                  onClick={() => handleFormatSelect(format.id)}
                  style={{
                    '--format-color': format.color,
                    '--format-bg': format.bgColor,
                    '--format-border': format.borderColor
                  }}
                >
                  <div className={styles.formatIcon}>
                    <IconComponent size={24} />
                    <div 
                      className={styles.formatBadge}
                      style={{ backgroundColor: format.color }}
                    >
                      {format.name}
                    </div>
                  </div>
                  <div className={styles.formatInfo}>
                    <span className={styles.formatName}>Salvar como {format.name}</span>
                    <small className={styles.formatDescription}>{format.description}</small>
                  </div>
                  {isSelected && (
                    <div className={styles.selectedIndicator}>
                      <CheckCircle size={20} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {error && (
            <div className={styles.errorMessage}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {success && (
            <div className={styles.successMessage}>
              <CheckCircle size={16} />
              {success}
            </div>
          )}

          <div className={styles.info}>
            <h4>Informações sobre os formatos:</h4>
            <ul>
              <li><strong>Excel:</strong> Planilha completa com formatação e filtros</li>
              <li><strong>PDF:</strong> Relatório formatado para impressão</li>
              <li><strong>CSV:</strong> Dados separados por vírgula, ideal para importação</li>
            </ul>
          </div>
        </div>

        <div className={styles.footer}>
          <button 
            className={styles.cancelButton}
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button 
            className={styles.exportButton}
            onClick={handleExport}
            disabled={!selectedFormat || loading}
          >
            {loading ? (
              <>
                <div className={styles.spinner}></div>
                Exportando...
              </>
            ) : (
              <>
                <Download size={16} />
                Exportar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
