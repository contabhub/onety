import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from '../../styles/estrategico/GlobalGoalModal.module.css';

const TRIMESTERS = {
  '1': ['01', '02', '03'],
  '2': ['04', '05', '06'],
  '3': ['07', '08', '09'],
  '4': ['10', '11', '12'],
};

const getQuarterDateRange = (year, trimester) => {
  const months = TRIMESTERS[trimester];
  if (!months) {
    return { startISO: null, endISO: null };
  }

  const startMonthIndex = parseInt(months[0], 10) - 1;
  const endMonthIndex = parseInt(months[2], 10) - 1;

  const startDate = new Date(year, startMonthIndex, 1);
  const endDate = new Date(year, endMonthIndex + 1, 0);

  const toISOAtNoonUTC = (date) => new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12)).toISOString();

  return {
    startISO: toISOAtNoonUTC(startDate),
    endISO: toISOAtNoonUTC(endDate),
  };
};

const formatDateForDisplay = (isoDate) => {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleDateString('pt-BR');
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return '';
  }
};

const GlobalGoalModal = ({ isOpen, onClose, onSubmit, goalData }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [trimestre, setTrimestre] = useState(() => {
    const month = new Date().getMonth() + 1;
    if (month <= 3) return '1';
    if (month <= 6) return '2';
    if (month <= 9) return '3';
    return '4';
  });
  const [calculationType, setCalculationType] = useState('acumulativa');
  const [indicatorType, setIndicatorType] = useState('qtd');
  const [progressType, setProgressType] = useState('progresso');
  const fixedTargetValue = 1;

  useEffect(() => {
    if (goalData) {
      // Mapear campos do backend (português) para o formato do frontend
      setTitle(goalData.title || goalData.titulo || '');
      setDescription(goalData.description || goalData.descricao || '');
      setStartDate(goalData.start_date || goalData.data_inicio || '');
      setEndDate(goalData.end_date || goalData.data_fim || '');
      setTrimestre(getTrimestreFromDate(goalData.start_date || goalData.data_inicio || ''));
      setCalculationType(goalData.calculation_type || goalData.calculo_tipo || 'acumulativa');
      setIndicatorType(goalData.indicator_type || goalData.indicador_tipo || 'qtd');
      setProgressType(goalData.progress_type || goalData.progresso_tipo || 'progresso');
    } else {
      setTitle('');
      setDescription('');
      const currentTrim = (() => {
        const month = new Date().getMonth() + 1;
        if (month <= 3) return '1';
        if (month <= 6) return '2';
        if (month <= 9) return '3';
        return '4';
      })();
      const currentYear = new Date().getFullYear();
      setTrimestre(currentTrim);
      const { startISO, endISO } = getQuarterDateRange(currentYear, currentTrim);
      setStartDate(startISO || '');
      setEndDate(endISO || '');
      setCalculationType('acumulativa');
      setIndicatorType('qtd');
      setProgressType('progresso');
    }
  }, [goalData]);

  const getTrimestreFromDate = (date) => {
    const month = new Date(date).getMonth() + 1;
    if (month <= 3) return '1';
    if (month <= 6) return '2';
    if (month <= 9) return '3';
    return '4';
  };

  const setDatesBasedOnTrimestre = (trimester, referenceYear) => {
    const yearToUse = referenceYear ?? new Date().getFullYear();
    const { startISO, endISO } = getQuarterDateRange(yearToUse, trimester);

    if (!startISO || !endISO) {
      toast.error('Período selecionado é inválido');
      return;
    }

    setStartDate(startISO);
    setEndDate(endISO);
  };

  const handleSave = () => {
    if (!title || !startDate || !endDate) {
      toast.error('Preencha todos os campos corretamente');
      return;
    }

    const data = {
      id: goalData?.id,
      title,
      description,
      target_value: fixedTargetValue,
      start_date: startDate,
      end_date: endDate,
      calculation_type: calculationType,
      indicator_type: indicatorType,
      progress_type: progressType,
      status: 'in_progress'
    };

    console.log("📤 Enviando para Supabase:", data);

    onSubmit(data);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {goalData ? 'Editar Meta Global' : 'Nova Meta Global'}
          </h2>
          <button onClick={onClose} className={styles.modalCloseButton}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <input
                className={styles.formInput}
                type="text"
                placeholder="Título da Meta"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <textarea
                className={styles.formTextarea}
                placeholder="Descrição"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <select
                value={calculationType}
                onChange={(e) => setCalculationType(e.target.value)}
                className={styles.formSelect}
              >
                <option value="acumulativa">Acumulativa (Soma dos meses)</option>
                <option value="media">Média dos meses</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <select
                value={indicatorType}
                onChange={(e) => setIndicatorType(e.target.value)}
                className={styles.formSelect}
              >
                <option value="qtd">Quantitativo (Qtd)</option>
                <option value="monetario">Monetário (R$)</option>
                <option value="percentual">Percentual (%)</option>
                <option value="dias">Dias</option>
              </select>
            </div>

            <div className={styles.formGroup} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="progressType"
                checked={progressType === 'regresso'}
                onChange={(e) => setProgressType(e.target.checked ? 'regresso' : 'progresso')}
                style={{ width: '1rem', height: '1rem' }}
              />
              <label htmlFor="progressType" className={styles.formLabel} style={{ marginBottom: 0 }}>
                Meta Reversa (começa em 100% e diminui)
              </label>
            </div>

            <div className={styles.formGroup}>
              <select
                className={styles.formSelect}
                value={trimestre}
                onChange={(e) => {
                  const newTrimestre = e.target.value;
                  setTrimestre(newTrimestre);
                  const referenceDate = goalData?.start_date || goalData?.data_inicio;
                  const referenceYear = referenceDate ? new Date(referenceDate).getFullYear() : new Date().getFullYear();
                  setDatesBasedOnTrimestre(newTrimestre, referenceYear);
                }}
              >
                <option value="1">1º Trimestre (Jan-Mar)</option>
                <option value="2">2º Trimestre (Abr-Jun)</option>
                <option value="3">3º Trimestre (Jul-Set)</option>
                <option value="4">4º Trimestre (Out-Dez)</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <input
                className={styles.formInput}
                type="text"
                value={formatDateForDisplay(startDate)}
                readOnly
              />
            </div>

            <div className={styles.formGroup}>
              <input
                className={styles.formInput}
                type="text"
                value={formatDateForDisplay(endDate)}
                readOnly
              />
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            onClick={onClose}
            className={`${styles.button} ${styles.buttonSecondary}`}
          >
            Fechar
          </button>
          <button
            onClick={handleSave}
            className={`${styles.button} ${styles.buttonPrimary}`}
          >
            {goalData ? 'Atualizar Meta' : 'Salvar Meta'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalGoalModal;

