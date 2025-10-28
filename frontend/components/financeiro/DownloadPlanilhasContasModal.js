import React, { useCallback, useEffect } from "react";
import styles from "../../styles/financeiro/download-planilhas.module.css";
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

  // Handler para clique fora do modal
  const handleClickOutside = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Handler para tecla ESC
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleClickOutside}>
      <div className={cn(styles.modalContent, styles.downloadPlanilhasModal)}>
        <div className={styles.modalHeader}>
          <h2 className={cn(styles.modalTitle, styles.downloadPlanilhasTitle)}>
            <FileText className={styles.downloadPlanilhasIcon} />
            Download de Planilhas
          </h2>
          <p className={cn(styles.modalDescription, styles.downloadPlanilhasDescription)}>
            Escolha qual planilha você deseja baixar para importar seus lançamentos financeiros.
          </p>
        </div>

        <div className={cn(styles.modalBody, styles.downloadPlanilhasContainer)}>
          {/* Planilha Modelo */}
          <div className={cn(styles.cardComponent, styles.cardComponentModelo, styles.downloadPlanilhasCardModelo)}>
            <div className={cn(styles.cardContentComponent, styles.downloadPlanilhasCardContent)}>
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
                <button
                  type="button"
                  onClick={() => handleDownload('planilha-modelo-contas.xlsx', 'Planilha Modelo')}
                  className={cn(styles.buttonComponent, styles.buttonComponentPrimary, styles.downloadPlanilhasBtnModelo)}
                >
                  <Download className={styles.downloadPlanilhasBtnIcon} />
                  Baixar
                </button>
              </div>
            </div>
          </div>

          {/* Planilha Exemplo */}
          <div className={cn(styles.cardComponent, styles.cardComponentExemplo, styles.downloadPlanilhasCardExemplo)}>
            <div className={cn(styles.cardContentComponent, styles.downloadPlanilhasCardContent)}>
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
                <button
                  type="button"
                  onClick={() => handleDownload('exemplo-planilha-contas.xlsx', 'Planilha Exemplo')}
                  className={cn(styles.buttonComponent, styles.buttonComponentWarning, styles.downloadPlanilhasBtnExemplo)}
                >
                  <Download className={styles.downloadPlanilhasBtnIcon} />
                  Baixar
                </button>
              </div>
            </div>
          </div>

          {/* Informações Adicionais */}
          <div className={cn(styles.cardComponent, styles.cardComponentInfo, styles.downloadPlanilhasCardInfo)}>
            <div className={cn(styles.cardContentComponent, styles.downloadPlanilhasCardContent)}>
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
            </div>
          </div>
        </div>

        <div className={cn(styles.modalFooter, styles.downloadPlanilhasFooter)}>
          <button 
            type="button"
            onClick={onClose}
            className={cn(styles.buttonComponent, styles.buttonComponentOutline, styles.downloadPlanilhasCloseBtn)}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
} 