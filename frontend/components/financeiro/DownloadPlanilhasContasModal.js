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
      <DialogContent className={styles.downloadPlanilhasModal}>
        <DialogHeader>
          <DialogTitle className={styles.downloadPlanilhasTitle}>
            <FileText className={styles.downloadPlanilhasIcon} />
            Download de Planilhas
          </DialogTitle>
          <DialogDescription className={styles.downloadPlanilhasDescription}>
            Escolha qual planilha você deseja baixar para importar seus lançamentos financeiros.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.downloadPlanilhasContainer}>
          {/* Planilha Modelo */}
          <Card className={styles.downloadPlanilhasCardModelo}>
            <CardContent className={styles.downloadPlanilhasCardContent}>
              <div className={styles.downloadPlanilhasCardInner}>
                <FileText className={styles.downloadPlanilhasCardIconModelo} />
                <div className={styles.downloadPlanilhasCardFlex1}>
                  <h4 className={styles.downloadPlanilhasCardTitle}>
                    Planilha Modelo
                  </h4>
                  <p className={styles.downloadPlanilhasCardText}>
                    Template em branco com as colunas corretas para importar contas.
                    Use esta planilha como base para criar seus próprios dados.
                  </p>
                  <div className={styles.downloadPlanilhasFileInfo}>
                    <Info className={styles.downloadPlanilhasFileInfoIcon} />
                    <span>Arquivo: planilha-modelo-contas.xlsx</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload('planilha-modelo-contas.xlsx', 'Planilha Modelo')}
                  className={styles.downloadPlanilhasBtnModelo}
                >
                  <Download className={styles.downloadPlanilhasBtnIcon} />
                  Baixar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Planilha Exemplo */}
          <Card className={styles.downloadPlanilhasCardExemplo}>
            <CardContent className={styles.downloadPlanilhasCardContent}>
              <div className={styles.downloadPlanilhasCardInner}>
                <FileText className={styles.downloadPlanilhasCardIconExemplo} />
                <div className={styles.downloadPlanilhasCardFlex1}>
                  <h4 className={styles.downloadPlanilhasCardTitle}>
                    Planilha Exemplo
                  </h4>
                  <p className={styles.downloadPlanilhasCardText}>
                    Exemplo preenchido com dados fictícios para demonstrar o formato correto.
                    Use como referência para entender como preencher a planilha modelo.
                  </p>
                  <div className={styles.downloadPlanilhasFileInfo}>
                    <Info className={styles.downloadPlanilhasFileInfoIcon} />
                    <span>Arquivo: exemplo-planilha-contas.xlsx</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload('exemplo-planilha-contas.xlsx', 'Planilha Exemplo')}
                  className={styles.downloadPlanilhasBtnExemplo}
                >
                  <Download className={styles.downloadPlanilhasBtnIcon} />
                  Baixar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Informações Adicionais */}
          <Card className={styles.downloadPlanilhasCardInfo}>
            <CardContent className={styles.downloadPlanilhasCardContent}>
              <div className={styles.downloadPlanilhasCardInner}>
                <Info className={styles.downloadPlanilhasCardIconInfo} />
                <div className={styles.downloadPlanilhasCardFlex1}>
                  <h4 className={styles.downloadPlanilhasCardTitle}>
                    Como usar as planilhas
                  </h4>
                  <ul className={styles.downloadPlanilhasCardInfoList}>
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

        <DialogFooter className={styles.downloadPlanilhasFooter}>
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