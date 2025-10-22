"use client";

import { useState } from "react";
import { Button } from './botao';
import { Download, ExternalLink, FileText } from "lucide-react";
import { toast } from "react-toastify";


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
    <div className={`space-y-2 ${className || ''}`}>
      {/* Controles */}
      {showControls && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#B0AFC1]">
            <FileText className="h-4 w-4" />
            <span>{fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-8 px-3 border-[#673AB7] text-[#673AB7] hover:bg-[#673AB7]/10"
            >
              <Download className="h-3 w-3 mr-1" />
              Baixar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInNewTab}
              className="h-8 px-3 border-[#673AB7] text-[#673AB7] hover:bg-[#673AB7]/10"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Abrir
            </Button>
          </div>
        </div>
      )}

      {/* Visualizador */}
      <div className={`border border-[#673AB7]/20 rounded-lg overflow-hidden ${height}`}>
        {isLoading && (
          <div className="w-full h-full flex items-center justify-center bg-[#1B1229]/30">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E88E5] mx-auto mb-2"></div>
              <p className="text-sm text-[#B0AFC1]">Carregando PDF...</p>
            </div>
          </div>
        )}
        <iframe
          src={`data:application/pdf;base64,${base64Data}#toolbar=0&navpanes=0&scrollbar=0`}
          className="w-full h-full border-0"
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