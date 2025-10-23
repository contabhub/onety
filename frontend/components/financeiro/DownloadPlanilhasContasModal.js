import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./botao";
import styles from "../../styles/financeiro/download-planilhas.module.css";
import { Card, CardContent } from "./card";
import { Download, FileText, Info } from "lucide-react";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

// Função cn para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');

export function DownloadPlanilhasContasModal({ isOpen, onClose }) {
  const handleDownload = async (filename, displayName) => {
    try {
      // Criar um link temporário para download
      const link = document.createElement('a');
      link.href = `/docs/planilhas/${filename}`;
      link.download = filename;
      link.target = '_blank';
      
      // Simular clique para iniciar download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`${displayName} baixada com sucesso!`);
    } catch (error) {
      console.error('Erro ao baixar planilha:', error);
      toast.error('Erro ao baixar planilha. Tente novamente.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(styles.downloadPlanilhasModal, "max-w-2xl max-h-[90vh] overflow-y-auto backdrop-blur-sm")}>
        <DialogHeader>
          <DialogTitle className={cn(styles.downloadPlanilhasTitle, "flex items-center gap-2")}>
            <FileText className={cn(styles.downloadPlanilhasIcon, "h-5 w-5")} />
            Download de Planilhas
          </DialogTitle>
          <DialogDescription className={styles.downloadPlanilhasDescription}>
            Escolha qual planilha você deseja baixar para importar seus lançamentos financeiros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Planilha Modelo */}
          <Card className={styles.downloadPlanilhasCardModelo}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <FileText className={cn(styles.downloadPlanilhasIconModelo, "h-5 w-5 mt-0.5")} />
                <div className="flex-1">
                  <h4 className={cn(styles.downloadPlanilhasCardTitle, "font-medium mb-2")}>
                    Planilha Modelo
                  </h4>
                  <p className={cn(styles.downloadPlanilhasCardText, "text-sm mb-3")}>
                    Template em branco com as colunas corretas para importar contas.
                    Use esta planilha como base para criar seus próprios dados.
                  </p>
                  <div className={cn(styles.downloadPlanilhasCardText, "flex items-center gap-2 text-xs")}>
                    <Info className="h-3 w-3" />
                    <span>Arquivo: planilha-modelo-contas.xlsx</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload('planilha-modelo-contas.xlsx', 'Planilha Modelo')}
                  className={styles.downloadPlanilhasBtnModelo}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Planilha Exemplo */}
          <Card className={styles.downloadPlanilhasCardExemplo}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <FileText className={cn(styles.downloadPlanilhasIconExemplo, "h-5 w-5 mt-0.5")} />
                <div className="flex-1">
                  <h4 className={cn(styles.downloadPlanilhasCardTitle, "font-medium mb-2")}>
                    Planilha Exemplo
                  </h4>
                  <p className={cn(styles.downloadPlanilhasCardText, "text-sm mb-3")}>
                    Exemplo preenchido com dados fictícios para demonstrar o formato correto.
                    Use como referência para entender como preencher a planilha modelo.
                  </p>
                  <div className={cn(styles.downloadPlanilhasCardText, "flex items-center gap-2 text-xs")}>
                    <Info className="h-3 w-3" />
                    <span>Arquivo: exemplo-planilha-contas.xlsx</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload('exemplo-planilha-contas.xlsx', 'Planilha Exemplo')}
                  className={styles.downloadPlanilhasBtnExemplo}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Informações Adicionais */}
          <Card className={styles.downloadPlanilhasCardInfo}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Info className={cn(styles.downloadPlanilhasIconInfo, "h-5 w-5 mt-0.5")} />
                <div>
                  <h4 className={cn(styles.downloadPlanilhasCardTitle, "font-medium mb-2")}>
                    Como usar as planilhas
                  </h4>
                  <ul className={cn(styles.downloadPlanilhasCardText, "text-sm space-y-1")}>
                    <li>• <strong>Planilha Modelo:</strong> Use como base para criar seus dados</li>
                    <li>• <strong>Planilha Exemplo:</strong> Consulte para ver exemplos de preenchimento</li>
                    <li>• Mantenha as colunas na ordem correta</li>
                    <li>• Use o formato de data dd/mm/yyyy</li>
                    <li>• Valores devem estar no formato brasileiro (vírgula como separador decimal)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            className={styles.downloadPlanilhasCloseBtn}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 