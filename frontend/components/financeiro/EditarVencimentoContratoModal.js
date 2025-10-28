import { useState, useEffect } from 'react';
import { CalendarIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import styles from '../../styles/financeiro/DetalhesContratoDrawer.module.css';

export function EditarVencimentoContratoModal({
  isOpen,
  onClose,
  contratoId,
  dataAtual,
  onConfirm
}) {
  const [novaData, setNovaData] = useState('');
  const [opcaoSelecionada, setOpcaoSelecionada] = useState('apenas');

  // Função para converter data para formato YYYY-MM-DD
  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Função para converter data para formato DD/MM/YYYY
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    if (isOpen && dataAtual) {
      setNovaData(formatDateForInput(dataAtual));
      setOpcaoSelecionada('apenas');
    }
  }, [isOpen, dataAtual]);

  const handleConfirmar = () => {
    if (!novaData) {
      toast.error("Selecione uma data.");
      return;
    }

    console.log("🔍 Modal - Opção selecionada:", opcaoSelecionada);
    console.log("🔍 Modal - Nova data:", novaData);

    // Converter data string para objeto Date
    const dataObj = new Date(novaData + 'T00:00:00');
    
    // Chamar callback para abrir o drawer de edição
    onConfirm?.(contratoId, opcaoSelecionada, dataObj);
    onClose();
  };

  // Fechar modal ao clicar no overlay
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Editar contrato</h2>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.textSecondary}>
            Escolha em quais vendas as edições a serem feitas devem ser aplicadas:
          </p>

          <div className={styles.radioGroup}>
            <label className={styles.radioItem}>
              <input
                type="radio"
                name="opcao"
                value="apenas"
                checked={opcaoSelecionada === 'apenas'}
                onChange={(e) => {
                  console.log("🔍 Radio 'apenas' selecionado:", e.target.value);
                  setOpcaoSelecionada(e.target.value);
                }}
                className={styles.radioInput}
              />
              <span className={styles.radioLabel}>
                Editar apenas a venda prevista para {dataAtual ? formatDateForDisplay(formatDateForInput(dataAtual)) : ''}
              </span>
            </label>

            <label className={styles.radioItem}>
              <input
                type="radio"
                name="opcao"
                value="todas"
                checked={opcaoSelecionada === 'todas'}
                onChange={(e) => {
                  console.log("🔍 Radio 'todas' selecionado:", e.target.value);
                  setOpcaoSelecionada(e.target.value);
                }}
                className={styles.radioInput}
              />
              <span className={styles.radioLabel}>
                Editar todas as próximas vendas do contrato
              </span>
            </label>
          </div>

          <div className={styles.dateInputGroup}>
            <label className={styles.label}>Nova data de vencimento:</label>
            <input
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              className={styles.dateInput}
            />
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button 
            onClick={onClose} 
            className={`${styles.button} ${styles.buttonOutline}`}
          >
            Cancelar
          </button>
          <button 
            onClick={handleConfirmar}
            className={`${styles.button} ${styles.buttonGreen}`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
