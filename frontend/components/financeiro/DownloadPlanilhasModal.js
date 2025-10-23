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
import { Card, CardContent } from "./card";
import { Download, FileText, Info } from "lucide-react";
import { toast } from "react-toastify";
import styles from "../../styles/financeiro/DownloadPlanilhasModal.module.css";

export function DownloadPlanilhasModal({ isOpen, onClose }) {
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
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle className={styles.dialogTitle}>
            <FileText className={styles.dialogIcon} />
            Download de Planilhas
          </DialogTitle>
          <DialogDescription className={styles.dialogDescription}>
            Escolha qual planilha você deseja baixar para importar movimentações financeiras.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.formContainer}>
          {/* Planilha Modelo */}
          <Card className={styles.cardModel}>
            <CardContent className={styles.cardContent}>
              <div className={styles.cardInfo}>
                <FileText className={styles.cardIcon} />
                <div className={styles.cardDetails}>
                  <h4 className={styles.cardTitle}>
                    Planilha Modelo
                  </h4>
                  <p className={styles.cardDescription}>
                    Template em branco com as colunas corretas para importar movimentações financeiras.
                    Use esta planilha como base para criar seus próprios dados.
                  </p>
                  <div className={styles.cardMeta}>
                    <Info className={styles.cardMetaIcon} />
                    <span>Arquivo: planilha-modelo-movimentacoes.xlsx</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload('planilha-modelo-movimentacoes.xlsx', 'Planilha Modelo')}
                  className={styles.downloadButton}
                >
                  <Download className={styles.downloadButtonIcon} />
                  Baixar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Planilha Exemplo */}
          <Card className={styles.cardExample}>
            <CardContent className={styles.cardContent}>
              <div className={styles.cardInfo}>
                <FileText className={styles.cardIcon} />
                <div className={styles.cardDetails}>
                  <h4 className={styles.cardTitle}>
                    Planilha Exemplo
                  </h4>
                  <p className={styles.cardDescription}>
                    Exemplo preenchido com dados fictícios para demonstrar o formato correto.
                    Use como referência para entender como preencher a planilha modelo.
                  </p>
                  <div className={styles.cardMeta}>
                    <Info className={styles.cardMetaIcon} />
                    <span>Arquivo: exemplo-planilha-movimentacoes.xlsx</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload('exemplo-planilha-movimentacoes.xlsx', 'Planilha Exemplo')}
                  className={styles.downloadButton}
                >
                  <Download className={styles.downloadButtonIcon} />
                  Baixar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Informações Adicionais */}
          <Card className={styles.cardInfo}>
            <CardContent className={styles.cardContentFull}>
              <div className={styles.cardInfo}>
                <Info className={styles.cardIcon} />
                <div>
                  <h4 className={styles.cardTitle}>
                    Como usar as planilhas
                  </h4>
                  <ul className={styles.cardDescription}>
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

        <DialogFooter className={styles.dialogFooter}>
          <Button 
            variant="outline" 
            onClick={onClose}
            className={`${styles.button} ${styles.buttonInfo}`}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 