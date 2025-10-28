import React from "react";
// Componentes externos removidos - usando HTML nativo
import { Download, FileText, Info } from "lucide-react";
import { toast } from "react-toastify";
import styles from "../../styles/financeiro/DownloadPlanilhasModal.module.css";

// Função cn para combinar classes CSS
const cn = (...classes) => classes.filter(Boolean).join(' ');

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

  // Função para fechar modal ao clicar no overlay
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={cn(styles.modalContent, styles.dialogContent)}>
        <div className={cn(styles.modalHeader)}>
          <h2 className={cn(styles.modalTitle, styles.dialogTitle)}>
            <FileText className={styles.dialogIcon} />
            Download de Planilhas
          </h2>
          <p className={cn(styles.modalDescription, styles.dialogDescription)}>
            Escolha qual planilha você deseja baixar para importar movimentações financeiras.
          </p>
        </div>

        <div className={styles.formContainer}>
          {/* Planilha Modelo */}
          <div className={cn(styles.cardComponent, styles.cardModel)}>
            <div className={cn(styles.cardContentComponent, styles.cardContent)}>
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
                <button
                  type="button"
                  onClick={() => handleDownload('planilha-modelo-movimentacoes.xlsx', 'Planilha Modelo')}
                  className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.buttonComponentSmall, styles.downloadButton)}
                >
                  <Download className={styles.downloadButtonIcon} />
                  Baixar
                </button>
              </div>
            </div>
          </div>

          {/* Planilha Exemplo */}
          <div className={cn(styles.cardComponent, styles.cardExample)}>
            <div className={cn(styles.cardContentComponent, styles.cardContent)}>
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
                <button
                  type="button"
                  onClick={() => handleDownload('exemplo-planilha-movimentacoes.xlsx', 'Planilha Exemplo')}
                  className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.buttonComponentSmall, styles.downloadButton)}
                >
                  <Download className={styles.downloadButtonIcon} />
                  Baixar
                </button>
              </div>
            </div>
          </div>

          {/* Informações Adicionais */}
          <div className={cn(styles.cardComponent, styles.cardInfo)}>
            <div className={cn(styles.cardContentComponent, styles.cardContentFull)}>
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
            </div>
          </div>
        </div>

        <div className={cn(styles.modalFooter, styles.dialogFooter)}>
          <button 
            type="button"
            onClick={onClose}
            className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.button, styles.buttonOutline, styles.buttonInfo)}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
} 