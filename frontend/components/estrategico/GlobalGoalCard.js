import  { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2 } from "lucide-react";
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components/estrategico/ConfirmModal';
import styles from '../../styles/estrategico/GlobalGoalCard.module.css';

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
    throw error;
  }
};

export function GlobalGoalCard({ goal, onEdit, onDelete }) {
  const [showDetails, setShowDetails] = useState(false);
  const [month, setMonth] = useState('');
  const [achievedValue, setAchievedValue] = useState(0);
  const [monthsAdded, setMonthsAdded] = useState(0);
  const [showAddMonthForm, setShowAddMonthForm] = useState(false);
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMonthId, setEditingMonthId] = useState(null);
  const [monthlyGoalValue, setMonthlyGoalValue] = useState(0);
  const [confirmDeleteMonth, setConfirmDeleteMonth] = useState({
    open: false,
    monthData: null
  });

  const calculateTotalProgress = () => {
    let totalValueGoal = 0;
    let totalValueAchieved = 0;

    if (goal.calculation_type === 'media') {
      const monthsCount = monthlyGoals.length || 1;

      totalValueGoal = monthlyGoals.reduce((acc, month) => acc + (month.value_goal || 0), 0) / monthsCount;
      totalValueAchieved = monthlyGoals.reduce((acc, month) => acc + (month.value_achieved || 0), 0) / monthsCount;
    } else {
      totalValueGoal = monthlyGoals.reduce((acc, month) => acc + (month.value_goal || 0), 0);
      totalValueAchieved = monthlyGoals.reduce((acc, month) => acc + (month.value_achieved || 0), 0);
    }

    let progress = totalValueGoal > 0 ? (totalValueAchieved / totalValueGoal) * 100 : 0;
    
    if (goal.progress_type === 'regresso') {
      progress = Math.max(0, 100 - progress);
    }

    return {
      totalValueGoal,
      totalValueAchieved,
      progress
    };
  };

  const { totalValueGoal, totalValueAchieved, progress } = calculateTotalProgress();

  const fetchMonthlyGoals = useCallback(async () => {
    try {
      const empresaId = getEmpresaId();
      if (!empresaId) {
        return;
      }
      
      const data = await apiFetch(`/estrategico/metas-globais/${goal.id}/monthly-goals?companyId=${empresaId}`);
      setMonthlyGoals(data || []);
      setMonthsAdded(data?.length || 0);
    } catch (error) {
      toast.error("Erro ao carregar meses.");
    }
  }, [goal.id]);

  useEffect(() => {
    fetchMonthlyGoals();
  }, [fetchMonthlyGoals]);

  const getTrimestre = (startDate) => {
    // Verificar se startDate existe e é uma string válida
    if (!startDate || typeof startDate !== 'string') {
      return 'Trimestre não definido';
    }
    
    const [, monthStr] = startDate.split('-');
    const month = parseInt(monthStr, 10);

    if (month >= 1 && month <= 3) return '1º Trimestre';
    if (month >= 4 && month <= 6) return '2º Trimestre';
    if (month >= 7 && month <= 9) return '3º Trimestre';
    return '4º Trimestre';
  };

  const getMonthsForTrimestre = (startDate) => {
    // Verificar se startDate existe e é uma string válida
    if (!startDate || typeof startDate !== 'string') {
      // Retornar array vazio ou um valor padrão se startDate não existir
      return [];
    }
    
    const [, monthStr] = startDate.split('-');
    const startMonth = parseInt(monthStr, 10);
    let months = [];

    if (startMonth >= 1 && startMonth <= 3) months = ['Janeiro', 'Fevereiro', 'Março'];
    if (startMonth >= 4 && startMonth <= 6) months = ['Abril', 'Maio', 'Junho'];
    if (startMonth >= 7 && startMonth <= 9) months = ['Julho', 'Agosto', 'Setembro'];
    if (startMonth >= 10 && startMonth <= 12) months = ['Outubro', 'Novembro', 'Dezembro'];

    return months;
  };

  const handleSaveMonth = async () => {
    if (!month || monthlyGoalValue <= 0) {
      toast.error("Informe um valor de meta mensal válido");
      return;
    }

    const currentYear = new Date().getFullYear();
    
    const monthMap = {
      'Janeiro': 1, 'Fevereiro': 2, 'Março': 3, 'Abril': 4, 'Maio': 5, 'Junho': 6,
      'Julho': 7, 'Agosto': 8, 'Setembro': 9, 'Outubro': 10, 'Novembro': 11, 'Dezembro': 12
    };
    
    const monthNum = monthMap[month];
    
    if (!monthNum) {
      toast.error("Mês inválido");
      return;
    }
    
    const paddedMonth = String(monthNum).padStart(2, '0');
    const start = `${currentYear}-${paddedMonth}-01`;
    
    const lastDay = new Date(currentYear, monthNum, 0).getDate();
    const end = `${currentYear}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;

    const monthName = month;

    const empresaId = getEmpresaId();
    if (!empresaId) {
      toast.error("Empresa ID não encontrado");
      return;
    }

    const payload = {
      companyId: empresaId,
      month: monthName,
      value_goal: monthlyGoalValue,
      value_achieved: 0,
      start_date: start,
      end_date: end
    };

    try {
      await apiFetch(`/estrategico/metas-globais/${goal.id}/monthly-goals`, {
        method: 'POST',
        body: payload
      });
      fetchMonthlyGoals();

      toast.success('Mês adicionado');
      setMonth('');
      setAchievedValue(0);
      setMonthsAdded(monthsAdded + 1);
      setShowAddMonthForm(false);
    } catch (err) {
      toast.error('Erro ao adicionar mês');
    }
  };

  const saveEdits = async (monthId, payload) => {
    try {
      if (!monthId || !payload || !payload.value_goal || payload.value_achieved === undefined) {
        toast.error('Dados incompletos ou inválidos');
        return;
      }

      const empresaId = getEmpresaId();
      if (!empresaId) {
        toast.error("Empresa ID não encontrado");
        return;
      }

      const updatePayload = {
        ...payload,
        companyId: empresaId
      };

      const updatedMonth = await apiFetch(`/estrategico/metas-globais/monthly-goals/${monthId}`, {
        method: 'PUT',
        body: updatePayload
      });

      toast.success('Mês atualizado com sucesso!');
      fetchMonthlyGoals();
      setIsEditing(false);

    } catch (err) {
      toast.error('Erro ao atualizar mês');
    }
  };

  const handleDeleteMonth = async (monthData) => {
    setConfirmDeleteMonth({
      open: true,
      monthData: monthData
    });
  };

  const performDeleteMonth = async () => {
    if (!confirmDeleteMonth.monthData) return;

    try {
      const empresaId = getEmpresaId();
      if (!empresaId) {
        toast.error("Empresa ID não encontrado");
        return;
      }

      await apiFetch(`/estrategico/metas-globais/monthly-goals/${confirmDeleteMonth.monthData.id}?companyId=${empresaId}`, {
        method: 'DELETE'
      });
      toast.success('Mês excluído');
      setMonthlyGoals(monthlyGoals.filter((m) => m.id !== confirmDeleteMonth.monthData?.id));
    } catch (err) {
      toast.error('Erro ao excluir mês');
    } finally {
      setConfirmDeleteMonth({ open: false, monthData: null });
    }
  };

  const handleEditMonth = (monthData) => {
    setMonth(monthData.month);
    setAchievedValue(monthData.value_achieved);
    setMonthlyGoalValue(monthData.value_goal);
    setEditingMonthId(monthData.id);
    setIsEditing(true);
  };

  const formatDate = (date) => {
    // Verificar se date existe antes de formatar
    if (!date) {
      return 'Data não definida';
    }
    
    const formattedDate = new Date(date);
    
    // Verificar se a data é válida
    if (isNaN(formattedDate.getTime())) {
      return 'Data inválida';
    }
    
    const day = String(formattedDate.getDate()).padStart(2, '0');
    const month = String(formattedDate.getMonth() + 1).padStart(2, '0');
    const year = formattedDate.getFullYear();
    return `${day}/${month}/${year}`;
  };

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

  // Mapear número do mês para nome
  const monthNumberToName = {
    1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho',
    7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro'
  };
  
  const monthNameToNumber = {
    'Janeiro': 1, 'Fevereiro': 2, 'Março': 3, 'Abril': 4, 'Maio': 5, 'Junho': 6,
    'Julho': 7, 'Agosto': 8, 'Setembro': 9, 'Outubro': 10, 'Novembro': 11, 'Dezembro': 12
  };

  // Usar start_date ou data_inicio (backend pode retornar data_inicio)
  const startDate = goal.start_date || goal.data_inicio;
  const monthsForTrimestre = getMonthsForTrimestre(startDate);
  
  // CORRIGIDO: usar monthlyGoals do estado, não goal.monthlyGoals
  const usedMonths = monthlyGoals.map((month) => {
    // Se tem campo 'mes' (número), usar diretamente
    if (month.mes) return month.mes;
    // Se não, extrair do start_date
    if (month.start_date) return new Date(month.start_date).getMonth() + 1;
    return null;
  }).filter(m => m !== null);
  
  const availableMonths = monthsForTrimestre.filter((month) => !usedMonths.includes(monthNameToNumber[month]));

  const getProgressBarClass = () => {
    if (progress < 50) return styles.progressBarDanger;
    if (progress < 80) return styles.progressBarWarning;
    return styles.progressBarSuccess;
  };

  const getProgressPercentageClass = () => {
    if (progress <= 0) return styles.goalCardProgressPercentageDanger;
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
              {goal.description || 'Meta global da empresa'}
            </p>
          </div>
          <div className={styles.goalCardActions}>
            <button onClick={onEdit} title="Editar Meta" className={styles.goalCardActionButton}>
              <Pencil className="h-5 w-5" />
            </button>
            <button onClick={onDelete} title="Excluir Meta" className={`${styles.goalCardActionButton} ${styles.goalCardActionButtonDanger}`}>
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={styles.goalCardToggleButton}
        >
          {showDetails ? 'Ocultar Detalhes' : 'Ver Detalhes'}
          <svg 
            className={`${styles.goalCardToggleIcon} ${showDetails ? styles.goalCardToggleIconOpen : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className={styles.goalCardBody}>
        <div className={`${styles.infoGrid} ${styles.infoGrid3}`}>
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <svg className={styles.infoCardIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className={styles.infoCardTitle}>Período</h3>
            </div>
            <p className={styles.infoCardValue}>
              <strong>{getTrimestre(startDate)}</strong>
            </p>
            <p className={styles.infoCardMeta}>
              {formatDate(startDate)} - {formatDate(goal.end_date || goal.data_fim)}
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
                {goal.calculation_type === 'media' ? 'Média dos meses' : 'Acumulativa'}
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
                <span 
                  className={`${styles.goalCardProgressPercentage} ${getProgressPercentageClass()}`}
                  style={progress <= 0 ? { color: '#ef4444' } : {}}
                >
                  {progress.toFixed(1)}%
                </span>
              ) : (
                <div>
                  <div className={styles.goalCardProgressText}>
                    {formatValue(totalValueAchieved)} / {formatValue(totalValueGoal)}
                  </div>
                  <div className={progress <= 0 ? styles.goalCardProgressSubtextDanger : styles.goalCardProgressSubtext}>
                    {progress.toFixed(1)}% concluído
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className={styles.progressContainer}>
            <div
              style={{ width: `${Math.min(progress, 100)}%` }}
              className={`${styles.progressBar} ${getProgressBarClass()}`}
            />
          </div>
        </div>

        {showDetails && (
          <div className={styles.goalCardDetails}>
            <div className={styles.goalCardDetailsHeader}>
              <h4 className={styles.goalCardDetailsTitle}>Meses Cadastrados</h4>
              {monthsForTrimestre.length > 0 && availableMonths.length > 0 && (
                <button
                  onClick={() => setShowAddMonthForm(!showAddMonthForm)}
                  className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonSmall}`}
                >
                  <svg className="w-4 h-4" style={{ marginRight: '0.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Adicionar Mês
                </button>
              )}
              {monthsForTrimestre.length > 0 && availableMonths.length === 0 && (
                <span className={styles.textMuted} style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  Todos os meses do trimestre já foram cadastrados
                </span>
              )}
            </div>

            {showAddMonthForm && (
              <div className={styles.goalCardAddForm}>
                <div className={styles.goalCardAddFormGrid}>
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className={styles.formSelect}
                  >
                    <option value="">Selecione o mês</option>
                    {availableMonths.map((monthName) => (
                      <option key={monthName} value={monthName}>{monthName}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={monthlyGoalValue}
                    onChange={(e) => setMonthlyGoalValue(Number(e.target.value))}
                    placeholder="Meta do mês"
                    className={styles.formInput}
                  />
                  <button
                    onClick={handleSaveMonth}
                    className={`${styles.button} ${styles.buttonPrimary}`}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            )}

            {monthlyGoals.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {monthlyGoals
                  .slice()
                  .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                  .map((monthData) => {
                    let percentage = 0;
                    
                    if ((!monthData.value_goal || monthData.value_goal === 0) && (!monthData.value_achieved || monthData.value_achieved === 0)) {
                      percentage = goal.progress_type === 'regresso' ? 100 : 0;
                    } else {
                      percentage = monthData.value_goal > 0 ? (monthData.value_achieved / monthData.value_goal) * 100 : 0;
                    }
                    
                    if (goal.progress_type === 'regresso') {
                      percentage = Math.max(0, 100 - percentage);
                    }
                    
                    const getMonthProgressBarClass = () => {
                      if (percentage >= 80) return styles.progressBarSuccess;
                      if (percentage >= 50) return styles.progressBarWarning;
                      return styles.progressBarDanger;
                    };

                    const getMonthProgressBadgeClass = () => {
                      if (percentage >= 80) return styles.progressPercentageBadgeSuccess;
                      if (percentage >= 50) return styles.progressPercentageBadgeWarning;
                      return styles.progressPercentageBadgeDanger;
                    };

                    // Obter nome do mês
                    const monthName = monthData.mes 
                      ? monthNumberToName[monthData.mes] 
                      : (monthData.start_date 
                        ? monthNumberToName[new Date(monthData.start_date).getMonth() + 1]
                        : 'Mês não definido');

                    return (
                      <div className={styles.goalCardMonthItem} key={monthData.id}>
                        <div className={styles.goalCardMonthHeader}>
                          <div className={styles.goalCardMonthInfo}>
                            <h5 className={styles.goalCardMonthTitle}>{monthName}</h5>
                            <div className={styles.goalCardMonthMeta}>
                              <span className={styles.goalCardMonthMetaItem}>
                                Meta: <strong>{formatValue(monthData.value_goal || 0)}</strong>
                              </span>
                              <span className={styles.goalCardMonthMetaItem}>
                                Atual: <strong>{formatValue(monthData.value_achieved || 0)}</strong>
                              </span>
                            </div>
                          </div>
                          <div className={styles.goalCardMonthActions}>
                            <span className={`${styles.progressPercentageBadge} ${getMonthProgressBadgeClass()}`}>
                              {percentage.toFixed(1)}%
                            </span>
                            <button onClick={() => handleEditMonth(monthData)} title="Editar" className={styles.goalCardActionButton}>
                              <Pencil size={16} />
                            </button>
                            <button onClick={() => handleDeleteMonth(monthData)} title="Excluir" className={`${styles.goalCardActionButton} ${styles.goalCardActionButtonDanger}`}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        <div className={`${styles.progressContainer} ${styles.progressBarSmall}`}>
                          <div
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                            className={`${styles.progressBar} ${getMonthProgressBarClass()}`}
                          />
                        </div>

                        {isEditing && editingMonthId === monthData.id && (
                          <div className={styles.goalCardMonthEditForm}>
                            <div className={styles.goalCardMonthEditGrid}>
                              <input
                                type="number"
                                className={styles.formInput}
                                value={monthlyGoalValue}
                                onChange={(e) => setMonthlyGoalValue(Number(e.target.value))}
                                placeholder="Meta do Mês"
                              />
                              <input
                                type="number"
                                className={styles.formInput}
                                value={achievedValue}
                                onChange={(e) => setAchievedValue(Number(e.target.value))}
                                placeholder="Valor Alcançado"
                              />
                            </div>
                            <div className={styles.goalCardMonthEditActions}>
                              <button
                                onClick={() => saveEdits(monthData.id, { value_achieved: achievedValue, value_goal: monthlyGoalValue })}
                                className={`${styles.button} ${styles.buttonSuccess} ${styles.buttonSmall}`}
                              >
                                Salvar
                              </button>
                              <button
                                onClick={() => setIsEditing(false)}
                                className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonSmall}`}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {monthlyGoals.length === 0 && (
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

      <ConfirmModal
        isOpen={confirmDeleteMonth.open}
        title="Excluir mês da meta"
        description={
          <span>Tem certeza que deseja excluir o mês "{confirmDeleteMonth.monthData?.month}"?</span>
        }
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={performDeleteMonth}
        onCancel={() => setConfirmDeleteMonth({ open: false, monthData: null })}
      />
    </div>
  );
}

