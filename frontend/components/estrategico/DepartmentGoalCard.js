import { useState, useEffect } from 'react';
import { MonthlyGoalRow } from '../../components/estrategico/MonthlyGoalRow';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { DepartmentGoalModal } from '../../components/estrategico/DepartmentGoalModal';
import { ConfirmModal } from '../../components/estrategico/ConfirmModal';
import {
  Pencil,
  Trash2,
} from 'lucide-react';
import { calcularProgressoMeta } from '../../utils/estrategico/goalUtils';
import styles from '../../styles/estrategico/DepartmentGoalCard.module.css';

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

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function DepartmentGoalCard({ goal, onUpdated, selectedMonth }) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [month, setMonth] = useState('');
  const [value, setValue] = useState(0);
  const [editingGoal, setEditingGoal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, goalId: null });
  const [departmentName, setDepartmentName] = useState('');

  useEffect(() => {
    const fetchDepartmentName = async () => {
      if (goal.department?.title) {
        setDepartmentName(goal.department.title);
      } else if (goal.department_id) {
        try {
          console.log('🔍 [DepartmentGoalCard] Buscando nome do departamento:', goal.department_id);
          const department = await apiFetch(`/estrategico/departamentos/${goal.department_id}`);
          if (department && department.title) {
            setDepartmentName(department.title);
            console.log('✅ [DepartmentGoalCard] Nome do departamento encontrado:', department.title);
          } else {
            setDepartmentName('Departamento não encontrado');
            console.log('⚠️ [DepartmentGoalCard] Departamento não encontrado');
          }
        } catch (error) {
          console.error('❌ [DepartmentGoalCard] Erro ao buscar departamento:', error);
          setDepartmentName('Erro ao carregar');
        }
      } else {
        setDepartmentName('Não definido');
      }
    };

    fetchDepartmentName();
  }, [goal.department_id, goal.department?.title]);

  if (!goal) {
    console.error('DepartmentGoalCard: goal é undefined ou null');
    return null;
  }

  if (!goal.monthlyGoals) {
    goal.monthlyGoals = [];
  }

  let totalGoal = 0;
  let totalAchieved = 0;

  if (!goal.monthlyGoals || goal.monthlyGoals.length === 0) {
    totalGoal = 0;
    totalAchieved = 0;
  } else if (goal.calculation_type === 'media') {
    const monthsCount = (goal.monthlyGoals || []).length || 1;
    totalGoal = (goal.monthlyGoals || []).reduce((sum, m) => sum + m.value_goal, 0) / monthsCount;
    totalAchieved = (goal.monthlyGoals || []).reduce((sum, m) => sum + m.value_achieved, 0) / monthsCount;
  } else if (goal.calculation_type === 'inverso') {
    totalGoal = (goal.monthlyGoals || []).reduce((max, m) => Math.max(max, m.value_goal), 0);
    totalAchieved = (goal.monthlyGoals || []).reduce((max, m) => Math.max(max, m.value_achieved), 0);
  } else {
    totalGoal = (goal.monthlyGoals || []).reduce((sum, m) => sum + m.value_goal, 0);
    totalAchieved = (goal.monthlyGoals || []).reduce((sum, m) => sum + m.value_achieved, 0);
  }

  const percentage = calcularProgressoMeta(goal.monthlyGoals || [], goal.calculation_type, goal.progress_type);

  const handleAddMonth = async () => {
    if (!month || value <= 0) return;
    const currentYear = new Date().getFullYear();
    const start = new Date(currentYear, parseInt(month) - 1, 1);
    const end = new Date(currentYear, parseInt(month), 0);

    try {
      await apiFetch(`/estrategico/metas-departamentais/${goal.id}/months`, {
        method: 'POST',
        body: {
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          value_goal: value,
          value_achieved: 0,
          status: false,
        },
      });
      
      toast.success('Mês adicionado');
      setMonth('');
      setValue(0);
      setAdding(false);
      onUpdated();
    } catch (err) {
      toast.error('Erro ao adicionar mês');
      console.error(err);
    }
  };

  const TRIMESTERS = {
    '1': ['01', '02', '03'],
    '2': ['04', '05', '06'],
    '3': ['07', '08', '09'],
    '4': ['10', '11', '12'],
  };

  const trimestre = (() => {
    const month = new Date(goal.start_date).getMonth() + 1;
    if (month >= 1 && month <= 3) return '1';
    if (month >= 4 && month <= 6) return '2';
    if (month >= 7 && month <= 9) return '3';
    return '4';
  })();
  const allowedMonths = TRIMESTERS[trimestre];

  const usedMonths = (goal.monthlyGoals || []).map(m => {
    const month = new Date(m.start_date).getMonth() + 1;
    return month.toString().padStart(2, '0');
  });

  const getTrimestreFromDate = (date) => {
    const month = new Date(date).getMonth() + 1;
    if (month >= 1 && month <= 3) return '1º Trimestre';
    if (month >= 4 && month <= 6) return '2º Trimestre';
    if (month >= 7 && month <= 9) return '3º Trimestre';
    return '4º Trimestre';
  };

  const availableMonths = allowedMonths.filter(m => !usedMonths.includes(m));

  const formatValue = (value) => {
    if (!goal?.indicator_type || goal.indicator_type === 'qtd') {
      return value.toLocaleString('pt-BR');
    }
    if (goal.indicator_type === 'monetario') {
      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    if (goal.indicator_type === 'percentual') {
      return `${value.toFixed(1)}%`;
    }
    if (goal.indicator_type === 'dias') {
      return `${value.toFixed(0)} dias`;
    }
    return value.toString();
  };

  const sortedMonths = (goal.monthlyGoals || []).slice().sort((a, b) => new Date(a.start_date).getMonth() - new Date(b.start_date).getMonth());

  let filteredGoal = 0;
  let filteredAchieved = 0;
  let filteredPercentage = 0;
  if (selectedMonth) {
    const monthObj = (goal.monthlyGoals || []).find(m => m.id === selectedMonth);
    if (monthObj) {
      filteredGoal = monthObj.value_goal;
      filteredAchieved = monthObj.value_achieved;
      if (goal.calculation_type === 'inverso') {
        if (filteredAchieved <= filteredGoal) {
          filteredPercentage = 100;
        } else {
          filteredPercentage = filteredGoal > 0 ? Math.min((filteredGoal / filteredAchieved) * 100, 100) : 0;
        }
      } else if (goal.calculation_type === 'media') {
        filteredPercentage = filteredGoal > 0 ? (filteredAchieved / filteredGoal) * 100 : 0;
      } else {
        filteredPercentage = filteredGoal > 0 ? (filteredAchieved / filteredGoal) * 100 : 0;
      }
    }
  } else if (goal.calculation_type === 'media') {
    const validMonths = (goal.monthlyGoals || []).filter(m => m.value_goal > 0);
    const percentList = validMonths.map(m => (m.value_achieved / m.value_goal) * 100);
    filteredPercentage = percentList.length > 0 ? percentList.reduce((a, b) => a + b, 0) / percentList.length : 0;
    filteredGoal = validMonths.length > 0 ? validMonths.reduce((a, b) => a + b.value_goal, 0) / validMonths.length : 0;
    filteredAchieved = validMonths.length > 0 ? validMonths.reduce((a, b) => a + b.value_achieved, 0) / validMonths.length : 0;
  } else {
    filteredGoal = (goal.monthlyGoals || []).reduce((sum, m) => sum + m.value_goal, 0);
    filteredAchieved = (goal.monthlyGoals || []).reduce((sum, m) => sum + m.value_achieved, 0);
    filteredPercentage = filteredGoal > 0 ? (filteredAchieved / filteredGoal) * 100 : 0;
  }

  const getProgressBarClass = () => {
    if (percentage >= 100) return styles.progressBarSuccess;
    return styles.progressBarDanger;
  };

  const getProgressPercentageClass = () => {
    if (percentage <= 0) return styles.goalCardProgressPercentageDanger;
    return styles.goalCardProgressPercentageSuccess;
  };

  return (
    <div className={styles.goalCard}>
      <div className={styles.goalCardHeader}>
        <div className={styles.goalCardHeaderRow}>
          <div className={styles.goalCardTitleSection}>
            <div className={styles.goalCardTitleRow}>
              <h2 className={styles.goalCardTitle}>{goal.title}</h2>
              {goal.progress_type === 'regresso' && (
                <span className={`${styles.badge} ${styles.badgeWarning}`}>
                  🔄 Reversa
                </span>
              )}
            </div>
            <p className={styles.goalCardDescription}>
              {goal.description || 'Meta departamental'}
            </p>
          </div>
          <div className={styles.goalCardActions}>
            <button
              onClick={() => setEditingGoal(true)}
              title="Editar Meta"
              className={styles.goalCardActionButton}
            >
              <Pencil className="h-5 w-5" />
            </button>
            <button
              onClick={() => setConfirmDelete({ open: true, goalId: goal.id })}
              title="Excluir Meta"
              className={`${styles.goalCardActionButton} ${styles.goalCardActionButtonDanger}`}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={styles.goalCardToggleButton}
        >
          {expanded ? 'Ocultar Detalhes' : 'Ver Detalhes'}
          <svg 
            className={`${styles.goalCardToggleIcon} ${expanded ? styles.goalCardToggleIconOpen : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className={styles.goalCardBody}>
        <div className={`${styles.infoGrid} ${styles.infoGrid4}`}>
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <svg className={styles.infoCardIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 className={styles.infoCardTitle}>Departamento</h3>
            </div>
            <p className={styles.infoCardValue}>
              <strong>{departmentName}</strong>
            </p>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <svg className={styles.infoCardIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className={styles.infoCardTitle}>Período</h3>
            </div>
            <p className={styles.infoCardValue}>
              <strong>{getTrimestreFromDate(goal.start_date)}</strong>
            </p>
            <p className={styles.infoCardMeta}>
              {new Date(goal.start_date).toLocaleDateString()} - {new Date(goal.end_date).toLocaleDateString()}
            </p>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <svg className={styles.infoCardIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className={styles.infoCardTitle}>Cálculo</h3>
            </div>
            <p className={styles.infoCardValue}>
              <strong>
                {goal.calculation_type === 'media' ? 'Média dos meses' : 
                 goal.calculation_type === 'inverso' ? 'Inverso' : 'Acumulativa'}
              </strong>
            </p>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <svg className={styles.infoCardIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h3 className={styles.infoCardTitle}>Indicador</h3>
            </div>
            <p className={styles.infoCardValue}>
              <strong>
                {goal.indicator_type === 'qtd' && 'Quantitativo (Qtd)'}
                {goal.indicator_type === 'monetario' && 'Monetário (R$)'}
                {goal.indicator_type === 'percentual' && 'Percentual (%)'}
                {goal.indicator_type === 'dias' && 'Dias'}
                {!goal.indicator_type && 'Não definido'}
              </strong>
            </p>
          </div>
        </div>

        <div className={styles.goalCardProgressSection}>
          <div className={styles.goalCardProgressHeader}>
            <h3 className={styles.goalCardProgressTitle}>Progresso Geral</h3>
            <div className={styles.goalCardProgressValue}>
              {goal.indicator_type === 'percentual' ? (
                <span className={`${styles.goalCardProgressPercentage} ${getProgressPercentageClass()}`}>
                  {percentage.toFixed(1)}%
                </span>
              ) : (
                <div>
                  <div className={styles.goalCardProgressText}>
                    {formatValue(totalAchieved)} / {formatValue(totalGoal)}
                  </div>
                  <div className={percentage <= 0 ? styles.goalCardProgressSubtextDanger : styles.goalCardProgressSubtext}>
                    {percentage.toFixed(1)}% concluído
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className={styles.progressContainer}>
            <div
              style={{ width: `${Math.min(percentage, 100)}%` }}
              className={`${styles.progressBar} ${getProgressBarClass()}`}
            />
          </div>
        </div>

        {expanded && (
          <div className={styles.goalCardDetails}>
            <div className={styles.goalCardDetailsHeader}>
              <h4 className={styles.goalCardDetailsTitle}>Meses Cadastrados</h4>
              {availableMonths.length > 0 && !adding && (
                <button
                  onClick={() => setAdding(true)}
                  className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonSmall}`}
                >
                  <Plus className="w-4 h-4" style={{ marginRight: '0.25rem' }} />
                  Adicionar Mês
                </button>
              )}
            </div>

            {adding && (
              <div className={styles.goalCardAddForm}>
                <div className={styles.goalCardAddFormGrid}>
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className={styles.formSelect}
                  >
                    <option value="">Selecione o mês</option>
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {new Date(2025, parseInt(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                    placeholder="Meta do mês"
                    className={styles.formInput}
                  />

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={handleAddMonth}
                      className={`${styles.button} ${styles.buttonPrimary}`}
                    >
                      Salvar
                    </button>
                    <button 
                      onClick={() => setAdding(false)} 
                      className={`${styles.button} ${styles.buttonSecondary}`}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {sortedMonths.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {sortedMonths.map((month) => {
                  const monthName = new Date(month.start_date).toLocaleDateString('pt-BR', { month: 'long' });
                  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                  return (
                    <MonthlyGoalRow 
                      key={month.id} 
                      goal={{ ...month, month: monthLabel }} 
                      onUpdated={onUpdated} 
                      calculationType={goal.calculation_type}
                      progressType={goal.progress_type}
                    />
                  );
                })}
              </div>
            )}

            {sortedMonths.length === 0 && (
              <div className={styles.emptyState}>
                <svg className={styles.emptyStateIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className={styles.emptyStateTitle}>Nenhum mês cadastrado</h3>
                <p className={styles.emptyStateDescription}>Adicione meses para começar a acompanhar o progresso.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {editingGoal && (
        <DepartmentGoalModal
          companyId={goal.company_id ?? ''}
          onClose={() => setEditingGoal(false)}
          onCreated={onUpdated}
          goalToEdit={goal}
        />
      )}

      <ConfirmModal
        isOpen={confirmDelete.open}
        title="Excluir meta departamental"
        description={
          <span>Tem certeza que deseja excluir a meta departamental "{goal.title}"?</span>
        }
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={async () => {
          try {
            await apiFetch(`/estrategico/metas-departamentais/${confirmDelete.goalId}`, { method: 'DELETE' });
            toast.success('Meta excluída com sucesso');
            onUpdated();
          } catch (err) {
            toast.error('Erro ao excluir meta');
            console.error(err);
          } finally {
            setConfirmDelete({ open: false, goalId: null });
          }
        }}
        onCancel={() => setConfirmDelete({ open: false, goalId: null })}
      />
    </div>
  );
}

