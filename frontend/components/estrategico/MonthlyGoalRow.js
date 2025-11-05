import  { useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/estrategico/ConfirmModal';
import {
  Pencil,
  Trash2,
} from 'lucide-react';
import styles from '../../styles/estrategico/MonthlyGoalRow.module.css';

// Configuração da API
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const normalizeUrl = (u) => `${BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;

// Helper para obter token do localStorage
const getToken = () => {
  try {
    return localStorage.getItem('token') || null;
  } catch {
    return null;
  }
};

// Helper para obter EmpresaId do localStorage
const getEmpresaId = () => {
  try {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const parsed = JSON.parse(userData);
      return parsed.EmpresaId || parsed.empresaId || null;
    }
    return null;
  } catch {
    return null;
  }
};

// Helper para fazer requisições fetch
const apiFetch = async (url, options = {}) => {
  const token = getToken();
  const empresaId = getEmpresaId();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (empresaId) {
    headers['X-Empresa-Id'] = empresaId.toString();
  }

  const config = {
    ...options,
    headers
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(normalizeUrl(url), config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

export function MonthlyGoalRow({ goal, onUpdated, calculationType, progressType }) {
  const [editing, setEditing] = useState(false);
  const [goalValue, setGoalValue] = useState(goal.value_goal ?? '');
  const [achievedValue, setAchievedValue] = useState(goal.value_achieved ?? '');
  const [showConfirm, setShowConfirm] = useState(false);

  let percentage = 0;
  
  if ((!goal.value_goal || goal.value_goal === 0) && (!goal.value_achieved || goal.value_achieved === 0)) {
    percentage = progressType === 'regresso' ? 100 : 0;
  } else if (calculationType === 'inverso') {
    if (goal.value_achieved <= goal.value_goal) {
      percentage = 100;
    } else {
      percentage = goal.value_goal > 0 ? Math.min((goal.value_goal / goal.value_achieved) * 100, 100) : 0;
    }
  } else {
    percentage = goal.value_goal > 0 ? (goal.value_achieved / goal.value_goal) * 100 : 0;
  }
  
  if (progressType === 'regresso') {
    percentage = Math.max(0, 100 - percentage);
  }
  
  const getProgressBarClass = () => {
    if (percentage >= 80) return styles.progressBarSuccess;
    if (percentage >= 50) return styles.progressBarWarning;
    return styles.progressBarDanger;
  };

  const getProgressBadgeClass = () => {
    if (percentage >= 80) return styles.progressPercentageBadgeSuccess;
    if (percentage >= 50) return styles.progressPercentageBadgeWarning;
    return styles.progressPercentageBadgeDanger;
  };
  
  const isSaveDisabled =
    goalValue === '' || achievedValue === '' || Number(goalValue) <= 0 || Number(achievedValue) < 0;

  const handleSave = async () => {
    try {
      const empresaId = getEmpresaId();
      if (!empresaId) {
        toast.error('Empresa ID não encontrado');
        return;
      }

      await apiFetch(`/estrategico/metas-departamentais/monthly-goals/${goal.id}`, {
        method: 'PUT',
        body: {
          companyId: empresaId,
          value_goal: goalValue,
          value_achieved: achievedValue
        }
      });
      toast.success('Meta atualizada');
      setEditing(false);
      onUpdated();

    } catch (err) {
      toast.error('Erro ao salvar');
      console.error(err);
    }
  };

  const handleDeleteMonth = async (monthId) => {
    try {
      const empresaId = getEmpresaId();
      if (!empresaId) {
        toast.error('Empresa ID não encontrado');
        return;
      }

      await apiFetch(`/estrategico/metas-departamentais/monthly-goals/${monthId}?companyId=${empresaId}`, {
        method: 'DELETE'
      });
      toast.success('Mês excluído com sucesso!');
      onUpdated();
    } catch (error) {
      toast.error('Erro ao excluir mês');
      console.error(error);
    }
  };

  const goalNum = typeof goalValue === 'number' ? goalValue : 0;
  const achievedNum = typeof achievedValue === 'number' ? achievedValue : 0;

  let livePercentage = 0;
  
  if ((!goalNum || goalNum === 0) && (!achievedNum || achievedNum === 0)) {
    livePercentage = progressType === 'regresso' ? 100 : 0;
  } else if (calculationType === 'inverso') {
    if (achievedNum <= goalNum) {
      livePercentage = 100;
    } else {
      livePercentage = goalNum > 0 ? Math.min((goalNum / achievedNum) * 100, 100) : 0;
    }
  } else {
    livePercentage = goalNum > 0 ? (achievedNum / goalNum) * 100 : 0;
  }
  
  if (progressType === 'regresso') {
    livePercentage = Math.max(0, 100 - livePercentage);
  }
  
  const monthName = new Date(goal.start_date).toLocaleDateString('pt-BR', { month: 'long' });
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  return (
    <div className={styles.goalCardMonthItem}>
      <div className={styles.goalCardMonthHeader}>
        <div className={styles.goalCardMonthInfo}>
          <h5 className={styles.goalCardMonthTitle}>{monthLabel}</h5>
          <div className={styles.goalCardMonthMeta}>
            <span className={styles.goalCardMonthMetaItem}>
              Meta: <strong>{goal.value_goal || 0}</strong>
            </span>
            <span className={styles.goalCardMonthMetaItem}>
              Atual: <strong>{goal.value_achieved || 0}</strong>
            </span>
          </div>
        </div>
        <div className={styles.goalCardMonthActions}>
          <span className={`${styles.progressPercentageBadge} ${getProgressBadgeClass()}`}>
            {Math.round(percentage)}%
          </span>
          <button onClick={() => setEditing(true)} title="Editar" className={styles.goalCardActionButton}>
            <Pencil size={16} />
          </button>
          <button onClick={() => setShowConfirm(true)} title="Excluir" className={`${styles.goalCardActionButton} ${styles.goalCardActionButtonDanger}`}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className={`${styles.progressContainer} ${styles.progressBarSmall}`}>
        <div
          style={{ width: `${Math.min(percentage, 100)}%` }}
          className={`${styles.progressBar} ${getProgressBarClass()}`}
        />
      </div>

      {editing && (
        <div className={styles.goalCardMonthEditForm}>
          <div className={styles.goalCardMonthEditGrid}>
            <input
              type="number"
              className={styles.formInput}
              value={goalValue}
              onChange={(e) => setGoalValue(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Meta do Mês"
            />
            <input
              type="number"
              className={styles.formInput}
              value={achievedValue}
              onChange={(e) => setAchievedValue(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Valor Alcançado"
            />
          </div>
          <div className={styles.goalCardMonthEditActions}>
            <button
              onClick={handleSave}
              disabled={isSaveDisabled}
              className={`${styles.button} ${styles.buttonSuccess} ${styles.buttonSmall}`}
            >
              Salvar
            </button>
            <button
              onClick={() => setEditing(false)}
              className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonSmall}`}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Excluir mês"
        description={
          <span>
            Tem certeza que deseja excluir este mês da meta? Essa ação não poderá ser desfeita.
          </span>
        }
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={async () => {
          setShowConfirm(false);
          await handleDeleteMonth(goal.id);
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

