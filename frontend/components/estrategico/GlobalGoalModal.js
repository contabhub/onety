import  { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from '../../styles/estrategico/GlobalGoalModal.module.css';

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
      setTitle(goalData.title || '');
      setDescription(goalData.description || '');
      setStartDate(goalData.start_date || '');
      setEndDate(goalData.end_date || '');
      setTrimestre(getTrimestreFromDate(goalData.start_date || ''));
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
      setTrimestre(currentTrim);
      setDatesBasedOnTrimestre(currentTrim);
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

  const setDatesBasedOnTrimestre = (trimestre) => {
    const currentYear = new Date().getFullYear();
    let start = '';
    let end = '';

    switch (trimestre) {
      case '1':
        start = `${currentYear}-01-01`;
        end = `${currentYear}-03-31`;
        break;
      case '2':
        start = `${currentYear}-04-01`;
        end = `${currentYear}-06-30`;
        break;
      case '3':
        start = `${currentYear}-07-01`;
        end = `${currentYear}-09-30`;
        break;
      case '4':
        start = `${currentYear}-10-01`;
        end = `${currentYear}-12-31`;
        break;
    }

    setStartDate(start);
    setEndDate(end);
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
                  setDatesBasedOnTrimestre(newTrimestre);
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
                value={startDate}
                readOnly
              />
            </div>

            <div className={styles.formGroup}>
              <input
                className={styles.formInput}
                type="text"
                value={endDate}
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

