"use client";

import { useState } from "react";
import { Download, ExternalLink, FileText } from "lucide-react";
import { toast } from "react-toastify";
import styles from "../../styles/financeiro/pdf-viewer.module.css";

// Utility para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');


export function PDFViewer({ 
  base64Data, 
  fileName = "documento.pdf", 
  height = "h-64",
  showControls = true,
  className
}) {
  const [isLoading, setIsLoading] = useState(true);

  const handleDownload = () => {
    try {
      // Converter base64 para blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      // Criar link de download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Download iniciado!");
    } catch (error) {
      console.error("Erro ao baixar PDF:", error);
      toast.error("Erro ao baixar PDF");
    }
  };

  const handleOpenInNewTab = () => {
    try {
      // Abrir PDF em nova aba
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      window.open(url, '_blank');
      
      // Limpar URL após um tempo
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Erro ao abrir PDF:", error);
      toast.error("Erro ao abrir PDF");
    }
  };

  return (
    <div className={cn(styles.container, className)}>
      {/* Controles */}
      {showControls && (
        <div className={styles.controls}>
          <div className={styles.fileInfo}>
            <FileText className="h-4 w-4" />
            <span>{fileName}</span>
          </div>
          <div className={styles.controlButtons}>
            <button
              type="button"
              onClick={handleDownload}
              className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.buttonComponentSmall)}
            >
              <Download className="h-3 w-3" />
              Baixar
            </button>
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.buttonComponentSmall)}
            >
              <ExternalLink className="h-3 w-3" />
              Abrir
            </button>
          </div>
        </div>
      )}

      {/* Visualizador */}
      <div className={cn(styles.viewer, height)}>
        {isLoading && (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingContent}>
              <div className={styles.loadingSpinner}></div>
              <p className={styles.loadingText}>Carregando PDF...</p>
            </div>
          </div>
        )}
        <iframe
          src={`data:application/pdf;base64,${base64Data}#toolbar=0&navpanes=0&scrollbar=0`}
          className={styles.iframe}
          title="Visualizador de PDF"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            toast.error("Erro ao carregar PDF");
          }}
        />
      </div>
    </div>
  );
} 