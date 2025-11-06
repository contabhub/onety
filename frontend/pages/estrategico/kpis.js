'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Select from 'react-select';
import { Edit, Trash2, X, AlertTriangle, Activity, Building2, Link2Off, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { KpiTypesManagerModal } from '../../components/estrategico/KpiTypesManagerModal';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';
import styles from '../../styles/estrategico/kpis.module.css';

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

// Helper para obter dados do usuário do localStorage
const getUserData = () => {
  try {
    const userData = localStorage.getItem('userData');
    if (userData) {
      return JSON.parse(userData);
    }
    return null;
  } catch {
    return null;
  }
};

// Helper para obter role do usuário (mantendo compatibilidade com o código existente)
const getUserRole = () => {
  try {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const parsed = JSON.parse(userData);
      // Verificar se tem role direto
      if (parsed.role) return parsed.role;
      // Verificar permissões
      const permissoes = parsed.permissoes || {};
      if (permissoes.adm && permissoes.adm.includes('admin')) return 'ADMIN';
      if (permissoes.rh && permissoes.rh.includes('admin')) return 'RH';
      if (permissoes.gestao && permissoes.gestao.includes('admin')) return 'GESTOR';
      return 'FUNCIONARIO';
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

const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const anoAtual = new Date().getFullYear();
const anosMock = [anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2];

// Função para converter número do formato brasileiro para número
function parsePtBrNumber(str) {
  if (!str) return 0;
  const clean = str.replace(/\./g, '').replace(/,/g, '.');
  const num = Number(clean);
  return isNaN(num) ? 0 : num;
}

// Função para formatar número no padrão brasileiro para exibição
function formatPtBrNumber(num) {
  if (num === null || num === undefined || num === '') return '';
  const numValue = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(numValue)) return '';
  
  // Converter para string e separar parte inteira e decimal
  const parts = numValue.toString().split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] || '';
  
  // Formatar parte inteira com pontos como separador de milhares
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Retornar com vírgula como separador decimal
  return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger;
}

function DeleteConfirmationModal({ isOpen, onClose, kpi, onConfirm }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Erro ao excluir KPI:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !kpi) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <div className={styles.modalIconContainer}>
            <AlertTriangle className="h-6 w-6" style={{ color: 'var(--onity-color-error)' }} />
          </div>
          <div className={styles.modalTitleContainer}>
            <h3 className={styles.modalTitle}>Confirmar Exclusão</h3>
          </div>
          <button
            onClick={onClose}
            className={styles.modalCloseButton}
          >
            <X size={20} />
          </button>
        </div>
        
        <div className={styles.modalBody}>
          <p className={styles.modalText}>
            Tem certeza que deseja excluir este KPI?
          </p>
          <div className={styles.modalInfoBox}>
            <div className={styles.modalInfoGrid}>
              <div className={styles.modalInfoItem}>
                <span className={styles.modalInfoLabel}>Indicador:</span>
                <p className={styles.modalInfoValue}>{kpi.kpi_types?.name}</p>
              </div>
              <div className={styles.modalInfoItem}>
                <span className={styles.modalInfoLabel}>Ano:</span>
                <p className={styles.modalInfoValue}>{kpi.year}</p>
              </div>
              <div className={styles.modalInfoItem}>
                <span className={styles.modalInfoLabel}>Mês:</span>
                <p className={styles.modalInfoValue}>{kpi.month}</p>
              </div>
              <div className={styles.modalInfoItem}>
                <span className={styles.modalInfoLabel}>Orçado:</span>
                <p className={styles.modalInfoValue}>{kpi.target_value}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className={styles.modalActions}>
          <button
            type="button"
            onClick={onClose}
            className={`${styles.modalButton} ${styles.modalButtonSecondary}`}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`${styles.modalButton} ${styles.modalButtonDanger}`}
          >
            {loading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateKpiModal({ isOpen, onClose, kpiTypes, departments, userRole, onSubmit, anoSelecionado }) {
  const [form, setForm] = useState({
    ano: anoSelecionado,
    mes: 'Jan',
    kpi_type_id: '',
    orcado: '',
    realizado: '',
    department_id: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm(prev => ({ ...prev, ano: anoSelecionado }));
  }, [anoSelecionado]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if ((userRole === 'GESTOR' || userRole === 'RH') && !form.department_id) {
      toast.error('Você deve selecionar um departamento');
      return;
    }
    
    setLoading(true);
    try {
      await onSubmit(form);
      onClose();
      setForm({
        ano: anoSelecionado,
        mes: 'Jan',
        kpi_type_id: '',
        orcado: '',
        realizado: '',
        department_id: '',
      });
    } catch (error) {
      console.error('Erro ao criar KPI:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContainer} ${styles.modalContainerLarge}`}>
        <div className={styles.modalHeaderFlex}>
          <h3 className={styles.modalTitleLarge}>Cadastrar Novo KPI</h3>
          <button
            onClick={onClose}
            className={styles.modalCloseButton}
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.modalFormGrid}>
            <div className={styles.modalFormGroup}>
              <label className={styles.modalFormLabel}>Ano</label>
              <Select
                name="ano"
                value={{ value: form.ano, label: form.ano.toString() }}
                onChange={(option) => setForm({ ...form, ano: Number(option?.value) })}
                options={anosMock.map(ano => ({
                  value: ano,
                  label: ano.toString()
                }))}
                className="w-full"
                classNamePrefix="select"
                styles={{
                  control: (base, state) => ({
                    ...base,
                    minHeight: '40px',
                    backgroundColor: 'var(--onity-color-surface)',
                    borderColor: state.isFocused ? 'var(--onity-color-primary)' : 'var(--onity-color-border)',
                    boxShadow: state.isFocused ? '0 0 0 3px rgba(68, 84, 100, 0.15)' : 'none',
                    '&:hover': {
                      borderColor: 'var(--onity-color-primary)',
                      boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.1)'
                    }
                  }),
                  menu: (base) => ({
                    ...base,
                    backgroundColor: 'var(--onity-color-surface)',
                    border: '1px solid var(--onity-color-border)',
                    boxShadow: 'var(--onity-elev-high)'
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected 
                      ? 'var(--onity-color-primary)' 
                      : state.isFocused 
                      ? 'var(--onity-color-bg)' 
                      : 'var(--onity-color-surface)',
                    color: state.isSelected 
                      ? 'var(--onity-color-primary-contrast)' 
                      : 'var(--onity-color-text)',
                    '&:hover': {
                      backgroundColor: state.isSelected 
                        ? 'var(--onity-color-primary-hover)' 
                        : 'var(--onity-color-bg)'
                    }
                  }),
                  singleValue: (base) => ({
                    ...base,
                    color: 'var(--onity-color-text)'
                  }),
                  placeholder: (base) => ({
                    ...base,
                    color: 'var(--onity-text-med)'
                  }),
                  input: (base) => ({
                    ...base,
                    color: 'var(--onity-color-text)'
                  })
                }}
              />
            </div>
            <div className={styles.modalFormGroup}>
              <label className={styles.modalFormLabel}>Mês</label>
              <select 
                name="mes" 
                value={form.mes} 
                onChange={handleFormChange} 
                className={styles.modalFormSelect}
              >
                {meses.map(mes => (
                  <option key={mes} value={mes}>{mes}</option>
                ))}
              </select>
            </div>
            <div className={styles.modalFormGroup}>
              <label className={styles.modalFormLabel}>Indicador</label>
              <Select
                name="kpi_type_id"
                value={kpiTypes.find(kpi => kpi.id === form.kpi_type_id) ? 
                  { value: form.kpi_type_id, label: kpiTypes.find(kpi => kpi.id === form.kpi_type_id)?.name } : 
                  null}
                onChange={(option) => setForm({ ...form, kpi_type_id: option?.value || '' })}
                options={kpiTypes.map(kpiType => ({
                  value: kpiType.id,
                  label: `${kpiType.name} (${kpiType.unit_symbol})`
                }))}
                placeholder="Selecione um indicador"
                isSearchable
                className="w-full"
                classNamePrefix="select"
                styles={{
                  control: (base, state) => ({
                    ...base,
                    minHeight: '40px',
                    backgroundColor: 'var(--onity-color-surface)',
                    borderColor: state.isFocused ? 'var(--onity-color-primary)' : 'var(--onity-color-border)',
                    boxShadow: state.isFocused ? '0 0 0 3px rgba(68, 84, 100, 0.15)' : 'none',
                    '&:hover': {
                      borderColor: 'var(--onity-color-primary)',
                      boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.1)'
                    }
                  }),
                  menu: (base) => ({
                    ...base,
                    backgroundColor: 'var(--onity-color-surface)',
                    border: '1px solid var(--onity-color-border)',
                    boxShadow: 'var(--onity-elev-high)'
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected 
                      ? 'var(--onity-color-primary)' 
                      : state.isFocused 
                      ? 'var(--onity-color-bg)' 
                      : 'var(--onity-color-surface)',
                    color: state.isSelected 
                      ? 'var(--onity-color-primary-contrast)' 
                      : 'var(--onity-color-text)',
                    '&:hover': {
                      backgroundColor: state.isSelected 
                        ? 'var(--onity-color-primary-hover)' 
                        : 'var(--onity-color-bg)'
                    }
                  }),
                  singleValue: (base) => ({
                    ...base,
                    color: 'var(--onity-color-text)'
                  }),
                  placeholder: (base) => ({
                    ...base,
                    color: 'var(--onity-text-med)'
                  }),
                  input: (base) => ({
                    ...base,
                    color: 'var(--onity-color-text)'
                  })
                }}
              />
            </div>
          </div>

          <div className={styles.modalFormGroup}>
            <label className={styles.modalFormLabel}>
              Departamento {userRole === 'GESTOR' || userRole === 'RH' ? '(obrigatório)' : '(opcional)'}
            </label>
            <Select
              name="department_id"
              value={
                form.department_id === '' 
                  ? (userRole === 'ADMIN' || userRole === 'SUPERADMIN' ? { value: '', label: '🌐 Global' } : null)
                  : departments.find(d => d.id === form.department_id) ? 
                    { value: form.department_id, label: departments.find(d => d.id === form.department_id)?.title } : 
                    null
              }
              onChange={(option) => setForm({ ...form, department_id: option?.value || '' })}
              options={[
                ...(userRole === 'ADMIN' || userRole === 'SUPERADMIN' ? [{ value: '', label: '🌐 Global' }] : []),
                ...departments.map(dept => ({
                  value: dept.id,
                  label: dept.title
                }))
              ]}
              placeholder={userRole === 'GESTOR' || userRole === 'RH' ? 'Selecione um departamento' : 'Selecione um departamento (opcional)'}
              isSearchable
              isClearable={userRole === 'ADMIN' || userRole === 'SUPERADMIN'}
              className="w-full"
              classNamePrefix="select"
              styles={{
                control: (base, state) => ({
                  ...base,
                  minHeight: '40px',
                  backgroundColor: 'var(--onity-color-surface)',
                  borderColor: state.isFocused ? 'var(--onity-color-primary)' : 'var(--onity-color-border)',
                  boxShadow: state.isFocused ? '0 0 0 3px rgba(68, 84, 100, 0.15)' : 'none',
                  '&:hover': {
                    borderColor: 'var(--onity-color-primary)',
                    boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.1)'
                  }
                }),
                menu: (base) => ({
                  ...base,
                  backgroundColor: 'var(--onity-color-surface)',
                  border: '1px solid var(--onity-color-border)',
                  boxShadow: 'var(--onity-elev-high)'
                }),
                option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isSelected 
                    ? 'var(--onity-color-primary)' 
                    : state.isFocused 
                    ? 'var(--onity-color-bg)' 
                    : 'var(--onity-color-surface)',
                  color: state.isSelected 
                    ? 'var(--onity-color-primary-contrast)' 
                    : 'var(--onity-color-text)',
                  '&:hover': {
                    backgroundColor: state.isSelected 
                      ? 'var(--onity-color-primary-hover)' 
                      : 'var(--onity-color-bg)'
                  }
                }),
                singleValue: (base) => ({
                  ...base,
                  color: 'var(--onity-color-text)'
                }),
                placeholder: (base) => ({
                  ...base,
                  color: 'var(--onity-text-med)'
                }),
                input: (base) => ({
                  ...base,
                  color: 'var(--onity-color-text)'
                })
              }}
            />
          </div>
          
          <div className={styles.modalFormGrid2}>
            <div className={styles.modalFormGroup}>
              <label className={styles.modalFormLabel}>Orçado</label>
              <input
                name="orcado"
                type="text"
                value={form.orcado}
                onChange={e => {
                  const value = e.target.value.replace(/[^0-9.,]/g, '');
                  setForm(f => ({ ...f, orcado: value }));
                }}
                className={styles.modalFormInput}
                required
                inputMode="decimal"
                pattern="[0-9.,]*"
              />
            </div>
            <div className={styles.modalFormGroup}>
              <label className={styles.modalFormLabel}>Realizado</label>
              <input
                name="realizado"
                type="text"
                value={form.realizado}
                onChange={e => {
                  const value = e.target.value.replace(/[^0-9.,]/g, '');
                  setForm(f => ({ ...f, realizado: value }));
                }}
                className={styles.modalFormInput}
                required
                inputMode="decimal"
                pattern="[0-9.,]*"
              />
            </div>
          </div>
          
          <div className={styles.modalActions}>
            <button
              type="button"
              onClick={onClose}
              className={`${styles.modalButton} ${styles.modalButtonSecondary}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`${styles.modalButton} ${styles.modalButtonPrimary}`}
            >
              {loading ? 'Salvando...' : 'Salvar Indicador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditKpiModal({ isOpen, onClose, kpi, kpiTypes, departments, onSave }) {
  const [form, setForm] = useState({
    kpi_type_id: '',
    year: anoAtual,
    month: 'Jan',
    target_value: '',
    actual_value: '',
    department_id: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (kpi) {
      setForm({
        kpi_type_id: kpi.kpi_type_id,
        year: kpi.year,
        month: kpi.month,
        target_value: formatPtBrNumber(kpi.target_value),
        actual_value: formatPtBrNumber(kpi.actual_value),
        department_id: kpi.department_id || '',
      });
    }
  }, [kpi]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!kpi) return;

    setLoading(true);
    try {
      await onSave(kpi.id, {
        kpi_type_id: form.kpi_type_id,
        year: form.year,
        month: form.month,
        target_value: parsePtBrNumber(form.target_value),
        actual_value: parsePtBrNumber(form.actual_value),
        department_id: form.department_id || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar KPI:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeaderFlex}>
          <h3 className={styles.modalTitle}>Editar KPI</h3>
          <button
            onClick={onClose}
            className={styles.modalCloseButton}
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.modalFormGroup}>
            <label className={styles.modalFormLabel}>Indicador</label>
            <Select
              value={kpiTypes.find(kpiType => kpiType.id === form.kpi_type_id) ? 
                { value: form.kpi_type_id, label: kpiTypes.find(kpiType => kpiType.id === form.kpi_type_id)?.name || '' } : 
                null}
              onChange={(option) => setForm({ ...form, kpi_type_id: option?.value || '' })}
              options={kpiTypes.map(kpiType => ({
                value: kpiType.id,
                label: `${kpiType.name} (${kpiType.unit_symbol})`
              }))}
              placeholder="Selecione um indicador"
              isSearchable
              className="w-full"
              classNamePrefix="select"
              styles={{
                control: (base, state) => ({
                  ...base,
                  minHeight: '40px',
                  backgroundColor: 'var(--onity-color-surface)',
                  borderColor: state.isFocused ? 'var(--onity-color-primary)' : 'var(--onity-color-border)',
                  boxShadow: state.isFocused ? '0 0 0 3px rgba(68, 84, 100, 0.15)' : 'none',
                  '&:hover': {
                    borderColor: 'var(--onity-color-primary)',
                    boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.1)'
                  }
                }),
                menu: (base) => ({
                  ...base,
                  backgroundColor: 'var(--onity-color-surface)',
                  border: '1px solid var(--onity-color-border)',
                  boxShadow: 'var(--onity-elev-high)'
                }),
                option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isSelected 
                    ? 'var(--onity-color-primary)' 
                    : state.isFocused 
                    ? 'var(--onity-color-bg)' 
                    : 'var(--onity-color-surface)',
                  color: state.isSelected 
                    ? 'var(--onity-color-primary-contrast)' 
                    : 'var(--onity-color-text)',
                  '&:hover': {
                    backgroundColor: state.isSelected 
                      ? 'var(--onity-color-primary-hover)' 
                      : 'var(--onity-color-bg)'
                  }
                }),
                singleValue: (base) => ({
                  ...base,
                  color: 'var(--onity-color-text)'
                }),
                placeholder: (base) => ({
                  ...base,
                  color: 'var(--onity-text-med)'
                }),
                input: (base) => ({
                  ...base,
                  color: 'var(--onity-color-text)'
                })
              }}
            />
          </div>
          
          <div className={styles.modalFormGroup}>
            <label className={styles.modalFormLabel}>Ano</label>
            <Select
              value={{ value: form.year, label: form.year.toString() }}
              onChange={(option) => setForm({ ...form, year: Number(option?.value) })}
              options={anosMock.map(ano => ({
                value: ano,
                label: ano.toString()
              }))}
              className="w-full"
              classNamePrefix="select"
              styles={{
                control: (base, state) => ({
                  ...base,
                  minHeight: '40px',
                  backgroundColor: 'var(--onity-color-surface)',
                  borderColor: state.isFocused ? 'var(--onity-color-primary)' : 'var(--onity-color-border)',
                  boxShadow: state.isFocused ? '0 0 0 3px rgba(68, 84, 100, 0.15)' : 'none',
                  '&:hover': {
                    borderColor: 'var(--onity-color-primary)',
                    boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.1)'
                  }
                }),
                menu: (base) => ({
                  ...base,
                  backgroundColor: 'var(--onity-color-surface)',
                  border: '1px solid var(--onity-color-border)',
                  boxShadow: 'var(--onity-elev-high)'
                }),
                option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isSelected 
                    ? 'var(--onity-color-primary)' 
                    : state.isFocused 
                    ? 'var(--onity-color-bg)' 
                    : 'var(--onity-color-surface)',
                  color: state.isSelected 
                    ? 'var(--onity-color-primary-contrast)' 
                    : 'var(--onity-color-text)',
                  '&:hover': {
                    backgroundColor: state.isSelected 
                      ? 'var(--onity-color-primary-hover)' 
                      : 'var(--onity-color-bg)'
                  }
                }),
                singleValue: (base) => ({
                  ...base,
                  color: 'var(--onity-color-text)'
                }),
                placeholder: (base) => ({
                  ...base,
                  color: 'var(--onity-text-med)'
                }),
                input: (base) => ({
                  ...base,
                  color: 'var(--onity-color-text)'
                })
              }}
            />
          </div>
          
          <div className={styles.modalFormGroup}>
            <label className={styles.modalFormLabel}>Mês</label>
            <select 
              value={form.month} 
              onChange={(e) => setForm({ ...form, month: e.target.value })}
              className={styles.modalFormSelect}
            >
              {meses.map(mes => (
                <option key={mes} value={mes}>{mes}</option>
              ))}
            </select>
          </div>
          
          <div className={styles.modalFormGroup}>
            <label className={styles.modalFormLabel}>Orçado</label>
            <input
              type="text"
              value={form.target_value}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.,]/g, '');
                setForm({ ...form, target_value: value });
              }}
              className={styles.modalFormInput}
              required
              inputMode="decimal"
              pattern="[0-9.,]*"
            />
          </div>
          
          <div className={styles.modalFormGroup}>
            <label className={styles.modalFormLabel}>Realizado</label>
            <input
              type="text"
              value={form.actual_value}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.,]/g, '');
                setForm({ ...form, actual_value: value });
              }}
              className={styles.modalFormInput}
              required
              inputMode="decimal"
              pattern="[0-9.,]*"
            />
          </div>

          <div className={styles.modalFormGroup}>
            <label className={styles.modalFormLabel}>Departamento</label>
            <div className={styles.modalDisabledInput}>
              {form.department_id ? 
                departments.find(d => d.id === form.department_id)?.title || 'Departamento não encontrado' :
                '🌐 Global'
              }
            </div>
          </div>
          
          <div className={styles.modalActions}>
            <button
              type="button"
              onClick={onClose}
              className={`${styles.modalButton} ${styles.modalButtonSecondary}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`${styles.modalButton} ${styles.modalButtonPrimary}`}
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LinkDepartmentModal({ isOpen, onClose, kpi, allKpisOfType, departments, onLink }) {
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!kpi || !selectedDepartment || allKpisOfType.length === 0) return;

    setLoading(true);
    try {
      const kpiIds = allKpisOfType.map(k => k.id);
      await onLink(kpiIds, selectedDepartment);
      onClose();
      setSelectedDepartment('');
    } catch (error) {
      console.error('Erro ao vincular departamento:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !kpi) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeaderFlex}>
          <h3 className={styles.modalTitle}>Vincular Departamento</h3>
          <button
            onClick={onClose}
            className={styles.modalCloseButton}
          >
            <X size={20} />
          </button>
        </div>
        
        <div className={styles.modalWarningBox}>
          <p className={styles.modalText} style={{ marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 'var(--onity-font-weight-medium)' }}>Indicador:</span> {kpi.kpi_types?.name}
          </p>
          <p className={styles.modalText} style={{ marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 'var(--onity-font-weight-medium)' }}>Ano:</span> {kpi.year}
          </p>
          <p className={styles.modalText} style={{ fontWeight: 'var(--onity-font-weight-medium)' }}>
            ℹ️ Todos os meses deste indicador serão vinculados ({allKpisOfType.length} período{allKpisOfType.length > 1 ? 's' : ''})
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.modalFormGroup}>
            <label className={styles.modalFormLabel}>
              Selecione o Departamento
            </label>
            <Select
              value={departments.find(d => d.id === selectedDepartment) ? 
                { value: selectedDepartment, label: departments.find(d => d.id === selectedDepartment)?.title } : 
                null}
              onChange={(option) => setSelectedDepartment(option?.value || '')}
              options={departments.map(dept => ({
                value: dept.id,
                label: dept.title
              }))}
              placeholder="Selecione um departamento..."
              isSearchable
              className="w-full"
              classNamePrefix="select"
              styles={{
                control: (base, state) => ({
                  ...base,
                  minHeight: '40px',
                  backgroundColor: 'var(--onity-color-surface)',
                  borderColor: state.isFocused ? 'var(--onity-color-primary)' : 'var(--onity-color-border)',
                  boxShadow: state.isFocused ? '0 0 0 3px rgba(68, 84, 100, 0.15)' : 'none',
                  '&:hover': {
                    borderColor: 'var(--onity-color-primary)',
                    boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.1)'
                  }
                }),
                menu: (base) => ({
                  ...base,
                  backgroundColor: 'var(--onity-color-surface)',
                  border: '1px solid var(--onity-color-border)',
                  boxShadow: 'var(--onity-elev-high)'
                }),
                option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isSelected 
                    ? 'var(--onity-color-primary)' 
                    : state.isFocused 
                    ? 'var(--onity-color-bg)' 
                    : 'var(--onity-color-surface)',
                  color: state.isSelected 
                    ? 'var(--onity-color-primary-contrast)' 
                    : 'var(--onity-color-text)',
                  '&:hover': {
                    backgroundColor: state.isSelected 
                      ? 'var(--onity-color-primary-hover)' 
                      : 'var(--onity-color-bg)'
                  }
                }),
                singleValue: (base) => ({
                  ...base,
                  color: 'var(--onity-color-text)'
                }),
                placeholder: (base) => ({
                  ...base,
                  color: 'var(--onity-text-med)'
                }),
                input: (base) => ({
                  ...base,
                  color: 'var(--onity-color-text)'
                })
              }}
            />
          </div>
          
          <div className={styles.modalActions}>
            <button
              type="button"
              onClick={onClose}
              className={`${styles.modalButton} ${styles.modalButtonSecondary}`}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !selectedDepartment}
              className={`${styles.modalButton} ${styles.modalButtonPrimary}`}
            >
              {loading ? 'Vinculando...' : `Vincular ${allKpisOfType.length} KPI${allKpisOfType.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function KpiDashboard() {
  const router = useRouter();
  // Tentar pegar companyId da URL primeiro, se não tiver, pegar do localStorage
  const companyIdFromUrl = router.isReady ? router.query?.companyId : null;
  const companyIdFromStorage = getEmpresaId();
  const companyId = companyIdFromUrl || companyIdFromStorage;
  
  console.log('🔍 [KpiDashboard] companyId:', {
    fromUrl: companyIdFromUrl,
    fromStorage: companyIdFromStorage,
    final: companyId,
    routerReady: router.isReady
  });
  
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [dados, setDados] = useState({});
  const [kpiTypes, setKpiTypes] = useState([]);
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual);
  const [anoComparacao, setAnoComparacao] = useState(null);
  const [dadosComparacao, setDadosComparacao] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [departments, setDepartments] = useState([]);
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('');
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState(null);
  const [allKpis, setAllKpis] = useState([]);
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingKpi, setDeletingKpi] = useState(null);
  
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [linkDepartmentModalOpen, setLinkDepartmentModalOpen] = useState(false);
  const [linkingKpi, setLinkingKpi] = useState(null);

  const [kpiTypesModalOpen, setKpiTypesModalOpen] = useState(false);

  useEffect(() => {
    const loadUser = () => {
      const userData = getUserData();
      if (userData) {
        setUser(userData);
        if (companyId) {
          const role = getUserRole();
          setUserRole(role);
        }
      }
    };
    loadUser();
    carregarTiposKPI();
  }, [companyId]);

  useEffect(() => {
    if (user && companyId) {
      carregarDepartamentos();
    }
  }, [user, companyId]);

  useEffect(() => {
    if (companyId && anoSelecionado && userRole !== null) {
      carregarKPIs();
      if (anoComparacao) {
        carregarKPIsComparacao();
      }
    }
  }, [companyId, anoSelecionado, anoComparacao, kpiTypes, selectedDepartmentFilter, departments, userRole]);

  const carregarTiposKPI = async () => {
    try {
      if (!companyId) return;
      const data = await apiFetch(`/estrategico/kpis/types?companyId=${companyId}`);
      setKpiTypes(data || []);
    } catch (err) {
      const error = err;
      setError(error.message);
    }
  };

  const carregarDepartamentos = async () => {
    try {
      if (!companyId) return;
      let data = await apiFetch(`/estrategico/departamentos?companyId=${companyId}`);
      
      if (userRole === 'GESTOR' && user) {
        console.log('🔍 [KpiDashboard] Aplicando filtro para GESTOR...');
        
        const leaderDepartmentsResponse = await getLeaderDepartments(user.id, companyId || '');
        console.log('🔍 [KpiDashboard] Departamentos onde é líder:', leaderDepartmentsResponse);
        
        const leaderDepartmentIds = leaderDepartmentsResponse?.map((d) => d.id) || [];
        console.log('🔍 [KpiDashboard] IDs dos departamentos permitidos:', leaderDepartmentIds);
        
        data = data.filter((dept) => 
          leaderDepartmentIds.includes(dept.id)
        );
        
        console.log('🔍 [KpiDashboard] Departamentos filtrados para GESTOR:', data);
      }
      
      setDepartments(data || []);
    } catch (err) {
      console.error('Erro ao carregar departamentos:', err);
    }
  };

  const getLeaderDepartments = async (userId, companyId) => {
    try {
      if (!companyId) return [];
      const data = await apiFetch(`/estrategico/departamentos/leader/${userId}?companyId=${companyId}`);
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar departamentos onde é líder:', error);
      return [];
    }
  };

  const carregarKPIs = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `/estrategico/kpis?companyId=${companyId}&year=${anoSelecionado}`;
      if (selectedDepartmentFilter) {
        if (selectedDepartmentFilter === 'global') {
        } else {
          url += `&department_id=${selectedDepartmentFilter}`;
        }
      }

      let data = await apiFetch(url);

      if (selectedDepartmentFilter === 'global') {
        data = data.filter((kpi) => !kpi.department_id);
      } else {
        if (userRole === 'GESTOR') {
          const allowedDepartmentIds = departments.map(d => d.id);
          data = data.filter((kpi) => 
            kpi.department_id !== null && kpi.department_id !== undefined && allowedDepartmentIds.includes(kpi.department_id)
          );
        } else if (userRole === 'RH') {
          data = data.filter((kpi) => kpi.department_id !== null);
        }
      }

      setAllKpis(data || []);

      const dadosOrganizados = {};
      kpiTypes.forEach((kpiType) => {
        dadosOrganizados[kpiType.id] = {
          name: kpiType.name,
          unit_type: kpiType.unit_type,
          unit_symbol: kpiType.unit_symbol,
          data: meses.map((mes) => ({ mes, orcado: 0, realizado: 0 })),
        };
      });

      (data || []).forEach((kpi) => {
        const kpiData = kpi;
        const idx = meses.indexOf(kpiData.month);
        if (idx !== -1 && dadosOrganizados[kpiData.kpi_type_id]) {
          dadosOrganizados[kpiData.kpi_type_id].data[idx] = {
            mes: kpiData.month,
            orcado: kpiData.target_value,
            realizado: kpiData.actual_value,
          };
        }
      });

      setDados(dadosOrganizados);
    } catch (err) {
      const error = err;
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const carregarKPIsComparacao = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiFetch(`/estrategico/kpis?companyId=${companyId}&year=${anoComparacao || 0}`);

      const dadosOrganizados = {};
      kpiTypes.forEach((kpiType) => {
        dadosOrganizados[kpiType.id] = {
          name: kpiType.name,
          unit_type: kpiType.unit_type,
          unit_symbol: kpiType.unit_symbol,
          data: meses.map((mes) => ({ mes, orcado: 0, realizado: 0 })),
        };
      });

      (data || []).forEach((kpi) => {
        const kpiData = kpi;
        const idx = meses.indexOf(kpiData.month);
        if (idx !== -1 && dadosOrganizados[kpiData.kpi_type_id]) {
          dadosOrganizados[kpiData.kpi_type_id].data[idx] = {
            mes: kpiData.month,
            orcado: kpiData.target_value,
            realizado: kpiData.actual_value,
          };
        }
      });

      setDadosComparacao(dadosOrganizados);
    } catch (err) {
      const error = err;
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      setError(null);
      const { ano, mes, kpi_type_id, orcado, realizado, department_id } = formData;
      if (!kpi_type_id) {
        toast.error('Selecione um indicador antes de salvar.');
        return;
      }

      if (!companyId) {
        toast.error('ID da empresa não encontrado.');
        return;
      }

      const orcadoNum = parsePtBrNumber(orcado);
      const realizadoNum = parsePtBrNumber(realizado);

      await apiFetch('/estrategico/kpis', {
        method: 'POST',
        body: {
          companyId,
          kpi_type_id,
          year: Number(ano),
          month: mes,
          target_value: orcadoNum,
          actual_value: realizadoNum,
          department_id: department_id || undefined,
        }
      });
      toast.success('KPI criado com sucesso!');
      await carregarKPIs();
    } catch (err) {
      const error = err;
      toast.error(`Erro: ${error.message}`);
    }
  };

  const handleEditKpi = (kpi) => {
    setEditingKpi(kpi);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (kpiId, data) => {
    try {
      await apiFetch(`/estrategico/kpis/${kpiId}?companyId=${companyId}`, {
        method: 'PUT',
        body: data
      });

      await carregarKPIs();
      toast.success('KPI atualizado com sucesso!');
    } catch (err) {
      const error = err;
      toast.error(`Erro ao atualizar: ${error.message}`);
    }
  };

  const handleDeleteKpi = (kpi) => {
    setDeletingKpi(kpi);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingKpi) return;

    try {
      await apiFetch(`/estrategico/kpis/${deletingKpi.id}`, {
        method: 'DELETE'
      });

      await carregarKPIs();
      toast.success('KPI excluído com sucesso!');
    } catch (err) {
      const error = err;
      toast.error(`Erro ao excluir: ${error.message}`);
    } finally {
      setDeleteModalOpen(false);
      setDeletingKpi(null);
    }
  };

  const handleLinkDepartment = (kpi) => {
    setLinkingKpi(kpi);
    setLinkDepartmentModalOpen(true);
  };

  const handleConfirmLinkDepartment = async (kpiIds, departmentId) => {
    try {
      const promises = kpiIds.map(kpiId => 
        apiFetch(`/estrategico/kpis/${kpiId}/link-department`, {
          method: 'PATCH',
          body: { department_id: departmentId }
        })
      );

      await Promise.all(promises);
      await carregarKPIs();
      
      toast.success(`${kpiIds.length} KPI${kpiIds.length > 1 ? 's' : ''} vinculado${kpiIds.length > 1 ? 's' : ''} com sucesso!`);
    } catch (err) {
      const error = err;
      toast.error(`Erro ao vincular: ${error.message}`);
    } finally {
      setLinkDepartmentModalOpen(false);
      setLinkingKpi(null);
    }
  };

  const handleUnlinkDepartment = async (kpis) => {
    try {
      const promises = kpis.map(kpi => 
        apiFetch(`/estrategico/kpis/${kpi.id}/link-department`, {
          method: 'PATCH',
          body: { department_id: null }
        })
      );

      await Promise.all(promises);
      await carregarKPIs();
      
      toast.success(`${kpis.length} KPI${kpis.length > 1 ? 's' : ''} desvinculado${kpis.length > 1 ? 's' : ''} com sucesso!`);
    } catch (err) {
      const error = err;
      toast.error(`Erro ao desvincular: ${error.message}`);
    }
  };

  const formatarValor = (valor, unitType, unitSymbol) => {
    switch (unitType) {
      case 'percentage':
        return `${valor}%`;
      case 'currency':
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
      case 'decimal':
        return `${valor}${unitSymbol}`;
      case 'time':
        return `${valor} ${unitSymbol}`;
      default:
        return `${valor}${unitSymbol}`;
    }
  };

  if (loading) {
    return <div className={styles.loadingContainer}>Carregando dados...</div>;
  }

  if (error) {
    return <div className={styles.errorContainer}>Erro: {error}</div>;
  }

  return (
    <>
      <PrincipalSidebar />
      <CreateKpiModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        kpiTypes={kpiTypes}
        departments={departments}
        userRole={userRole}
        onSubmit={handleSubmit}
        anoSelecionado={anoSelecionado}
      />
      <EditKpiModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingKpi(null);
        }}
        kpi={editingKpi}
        kpiTypes={kpiTypes}
        departments={departments}
        onSave={handleSaveEdit}
      />
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingKpi(null);
        }}
        kpi={deletingKpi}
        onConfirm={handleConfirmDelete}
      />
      <LinkDepartmentModal
        isOpen={linkDepartmentModalOpen}
        onClose={() => {
          setLinkDepartmentModalOpen(false);
          setLinkingKpi(null);
        }}
        kpi={linkingKpi}
        allKpisOfType={linkingKpi ? allKpis.filter(k => k.kpi_type_id === linkingKpi.kpi_type_id && k.year === linkingKpi.year) : []}
        departments={departments}
        onLink={handleConfirmLinkDepartment}
      />
      <KpiTypesManagerModal
        isOpen={kpiTypesModalOpen}
        onClose={() => setKpiTypesModalOpen(false)}
        companyId={companyId || ''}
        onUpdate={() => {
          carregarTiposKPI();
          carregarKPIs();
        }}
      />
      
      <div className={styles.pageContainer}>
        <div className={styles.content}>
          <div className={styles.headerCard}>
            <div className={styles.headerContent}>
              <div className={styles.headerLeft}>
                <Activity className={styles.headerIcon} />
                <h1 className={styles.headerTitle}>KPIs Empresariais</h1>
              </div>
              
              <div className={styles.headerActions}>
                <button
                  onClick={() => setKpiTypesModalOpen(true)}
                  className={`${styles.headerButton} ${styles.headerButtonSettings}`}
                >
                  <Settings className={styles.headerButtonIcon} />
                  <span>Gerenciar Indicadores</span>
                </button>
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className={`${styles.headerButton} ${styles.headerButtonPrimary}`}
                >
                  <svg className={styles.headerButtonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Novo KPI</span>
                </button>
              </div>
            </div>
          </div>

          <div className={styles.filtersCard}>
            <h2 className={styles.filtersTitle}>Filtros</h2>
            <div className={styles.filtersRow}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Ano Base</label>
                <Select
                  value={{ value: anoSelecionado, label: anoSelecionado.toString() }}
                  onChange={(option) => setAnoSelecionado(Number(option?.value))}
                  options={anosMock.map(ano => ({
                    value: ano,
                    label: ano.toString()
                  }))}
                  className="w-40"
                  classNamePrefix="select"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: '40px',
                      backgroundColor: 'var(--onity-color-surface)',
                      borderColor: state.isFocused ? 'var(--onity-color-primary)' : 'var(--onity-color-border)',
                      boxShadow: state.isFocused ? '0 0 0 3px rgba(68, 84, 100, 0.15)' : 'none',
                      '&:hover': {
                        borderColor: 'var(--onity-color-primary)',
                        boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.1)'
                      }
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: 'var(--onity-color-surface)',
                      border: '1px solid var(--onity-color-border)',
                      boxShadow: 'var(--onity-elev-high)'
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected 
                        ? 'var(--onity-color-primary)' 
                        : state.isFocused 
                        ? 'var(--onity-color-bg)' 
                        : 'var(--onity-color-surface)',
                      color: state.isSelected 
                        ? 'var(--onity-color-primary-contrast)' 
                        : 'var(--onity-color-text)',
                      '&:hover': {
                        backgroundColor: state.isSelected 
                          ? 'var(--onity-color-primary-hover)' 
                          : 'var(--onity-color-bg)'
                      }
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: 'var(--onity-text-med)'
                    }),
                    input: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    })
                  }}
                />
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Ano Comparação</label>
                <Select
                  value={anoComparacao ? { value: anoComparacao, label: anoComparacao.toString() } : null}
                  onChange={(option) => setAnoComparacao(option ? Number(option.value) : null)}
                  options={anosMock.map(ano => ({
                    value: ano,
                    label: ano.toString()
                  }))}
                  isClearable
                  placeholder="Selecione..."
                  className="w-40"
                  classNamePrefix="select"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: '40px',
                      backgroundColor: 'var(--onity-color-surface)',
                      borderColor: state.isFocused ? 'var(--onity-color-primary)' : 'var(--onity-color-border)',
                      boxShadow: state.isFocused ? '0 0 0 3px rgba(68, 84, 100, 0.15)' : 'none',
                      '&:hover': {
                        borderColor: 'var(--onity-color-primary)',
                        boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.1)'
                      }
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: 'var(--onity-color-surface)',
                      border: '1px solid var(--onity-color-border)',
                      boxShadow: 'var(--onity-elev-high)'
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected 
                        ? 'var(--onity-color-primary)' 
                        : state.isFocused 
                        ? 'var(--onity-color-bg)' 
                        : 'var(--onity-color-surface)',
                      color: state.isSelected 
                        ? 'var(--onity-color-primary-contrast)' 
                        : 'var(--onity-color-text)',
                      '&:hover': {
                        backgroundColor: state.isSelected 
                          ? 'var(--onity-color-primary-hover)' 
                          : 'var(--onity-color-bg)'
                      }
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: 'var(--onity-text-med)'
                    }),
                    input: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    })
                  }}
                />
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Departamento</label>
                <Select
                  value={selectedDepartmentFilter === 'global' ? 
                    { value: 'global', label: '🌐 Global' } :
                    selectedDepartmentFilter ? 
                    { value: selectedDepartmentFilter, label: departments.find(d => d.id === selectedDepartmentFilter)?.title } : 
                    { value: '', label: 'Todos' }}
                  onChange={(option) => setSelectedDepartmentFilter(option?.value || '')}
                  options={[
                    { value: '', label: 'Todos' },
                    ...(userRole === 'ADMIN' || userRole === 'SUPERADMIN' ? [{ value: 'global', label: '🌐 Global' }] : []),
                    ...departments.map(dept => ({
                      value: dept.id,
                      label: dept.title
                    }))
                  ]}
                  placeholder="Selecione..."
                  className="w-60"
                  classNamePrefix="select"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: '40px',
                      backgroundColor: 'var(--onity-color-surface)',
                      borderColor: state.isFocused ? 'var(--onity-color-primary)' : 'var(--onity-color-border)',
                      boxShadow: state.isFocused ? '0 0 0 3px rgba(68, 84, 100, 0.15)' : 'none',
                      '&:hover': {
                        borderColor: 'var(--onity-color-primary)',
                        boxShadow: '0 0 0 3px rgba(68, 84, 100, 0.1)'
                      }
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: 'var(--onity-color-surface)',
                      border: '1px solid var(--onity-color-border)',
                      boxShadow: 'var(--onity-elev-high)'
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected 
                        ? 'var(--onity-color-primary)' 
                        : state.isFocused 
                        ? 'var(--onity-color-bg)' 
                        : 'var(--onity-color-surface)',
                      color: state.isSelected 
                        ? 'var(--onity-color-primary-contrast)' 
                        : 'var(--onity-color-text)',
                      '&:hover': {
                        backgroundColor: state.isSelected 
                          ? 'var(--onity-color-primary-hover)' 
                          : 'var(--onity-color-bg)'
                      }
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: 'var(--onity-text-med)'
                    }),
                    input: (base) => ({
                      ...base,
                      color: 'var(--onity-color-text)'
                    })
                  }}
                />
              </div>
            </div>
          </div>

          <div className={styles.chartsContainer}>
            {(() => {
              const gruposKpi = {};
              
              allKpis.forEach(kpi => {
                const departmentId = kpi.department_id || 'sem-departamento';
                const chave = `${kpi.kpi_type_id}__${departmentId}`;
                
                if (!gruposKpi[chave]) {
                  gruposKpi[chave] = [];
                }
                gruposKpi[chave].push(kpi);
              });

              return Object.entries(gruposKpi)
                .filter(([, kpis]) => kpis.length > 0)
                .map(([chave, kpisDoGrupo]) => {
                  const primeiroKpi = kpisDoGrupo[0];
                  const kpiTypeId = primeiroKpi.kpi_type_id;
                  const kpiData = dados[kpiTypeId];
                  
                  if (!kpiData) return null;

                  const dadosGrupo = meses.map((mes) => {
                    const kpiDoMes = kpisDoGrupo.find(k => k.month === mes);
                    return {
                      mes,
                      orcado: kpiDoMes?.target_value || 0,
                      realizado: kpiDoMes?.actual_value || 0
                    };
                  });

                  const temDados = dadosGrupo.some(item => item.orcado !== 0 || item.realizado !== 0);
                  if (!temDados) return null;

                  let titulo = `${kpiData.name} - Orçado vs Realizado`;
                  if (primeiroKpi.department) {
                    titulo = `${kpiData.name} (${primeiroKpi.department.title}) - Orçado vs Realizado`;
                  }

                  const dadosComparacaoAtual = anoComparacao && dadosComparacao[kpiTypeId] 
                    ? dadosComparacao[kpiTypeId].data 
                    : undefined;

                  return (
                    <KpiBarChart
                      key={chave}
                      titulo={titulo}
                      dados={dadosGrupo}
                      dadosComparacao={dadosComparacaoAtual}
                      anoBase={anoSelecionado}
                      anoComparacao={anoComparacao}
                      unitType={kpiData.unit_type}
                      unitSymbol={kpiData.unit_symbol}
                      formatarValor={formatarValor}
                      kpisDoTipo={kpisDoGrupo}
                      onEditKpi={handleEditKpi}
                      onDeleteKpi={handleDeleteKpi}
                      onLinkDepartment={handleLinkDepartment}
                      onUnlinkDepartment={handleUnlinkDepartment}
                    />
                  );
                })
                .filter(Boolean);
            })()}
          </div>
        </div>
      </div>
    </>
  );
}

function KpiBarChart({ titulo, dados, dadosComparacao, anoBase, anoComparacao, unitType, unitSymbol, formatarValor, kpisDoTipo, onEditKpi, onDeleteKpi, onLinkDepartment, onUnlinkDepartment }) {
  const chartData = dados.map((item, index) => {
    const comparacao = dadosComparacao?.[index];
    return {
      ...item,
      orcadoComparacao: comparacao?.orcado ?? 0,
      realizadoComparacao: comparacao?.realizado ?? 0
    };
  });

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div className={styles.chartHeaderContent}>
          <h2 className={styles.chartTitle}>{titulo}</h2>
          <div className={styles.chartLegend}>
            <div className={styles.chartLegendItem}>
              <div className={`${styles.chartLegendDot} ${styles.chartLegendDotBlue}`}></div>
              <span className={styles.chartLegendText}>Orçado</span>
            </div>
            <div className={`${styles.chartLegendItem} ${styles.chartLegendSpacer}`}>
              <div className={`${styles.chartLegendDot} ${styles.chartLegendDotGreen}`}></div>
              <span className={styles.chartLegendText}>Realizado</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className={styles.chartBody}>
      
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis 
            dataKey="mes" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <Tooltip 
            formatter={(value) => formatarValor(Number(value), unitType, unitSymbol)}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Legend />
          <Bar dataKey="orcado" name={`Orçado ${anoBase}`} fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="realizado" name={`Realizado ${anoBase}`} fill="#10b981" radius={[4, 4, 0, 0]} />
          {anoComparacao && dadosComparacao && (
            <>
              <Bar dataKey="orcadoComparacao" name={`Orçado ${anoComparacao}`} fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="realizadoComparacao" name={`Realizado ${anoComparacao}`} fill="#ef4444" radius={[4, 4, 0, 0]} />
            </>
          )}
        </BarChart>
      </ResponsiveContainer>
      
      {kpisDoTipo.length > 0 && (
        <div className={styles.chartActions}>
          <div className={styles.chartActionsHeader}>
            {(() => {
              const departamentos = kpisDoTipo.map(k => k.department_id).filter(Boolean);
              const departamentoUnico = departamentos.length > 0 && departamentos.every(d => d === departamentos[0]);
              const primeiroKpi = kpisDoTipo[0];
              
              if (departamentoUnico && primeiroKpi.department) {
                return (
                  <div className={styles.chartDepartmentInfo}>
                    <h3 className={styles.chartDepartmentLabel}>Departamento:</h3>
                    <span className={styles.chartDepartmentBadge}>
                      <Building2 className={styles.chartDepartmentBadgeIcon} />
                      {primeiroKpi.department.title}
                    </span>
                    <button
                      onClick={() => onUnlinkDepartment(kpisDoTipo)}
                      className={`${styles.chartDepartmentButton} ${styles.chartDepartmentButtonUnlink}`}
                      title="Desvincular departamento de todos os meses deste KPI"
                    >
                      <Link2Off className={styles.chartDepartmentButtonIcon} />
                      Desvincular
                    </button>
                  </div>
                );
              } else if (departamentos.length > 0 && !departamentoUnico) {
                return (
                  <div className={styles.chartDepartmentInfo}>
                    <span className={styles.chartDepartmentBadgeWarning}>
                      ⚠️ Departamentos mistos
                    </span>
                  </div>
                );
              } else {
                return (
                  <div className={styles.chartDepartmentInfo}>
                    <span className={styles.chartDepartmentBadgeGlobal}>
                      🌐 KPI Global
                    </span>
                    <button
                      onClick={() => onLinkDepartment(kpisDoTipo[0])}
                      className={`${styles.chartDepartmentButton} ${styles.chartDepartmentButtonLink}`}
                      title="Vincular todos os meses deste KPI a um departamento"
                    >
                      <Building2 className={styles.chartDepartmentButtonIcon} />
                      Vincular Departamento
                    </button>
                  </div>
                );
              }
            })()}
          </div>
          
          <h3 className={styles.chartPeriodsTitle}>Ações por Período:</h3>
          <div className={styles.chartPeriodsList}>
            {kpisDoTipo.map((kpi) => (
              <div key={kpi.id} className={styles.chartPeriodItem}>
                <span className={styles.chartPeriodText}>{kpi.year} - {kpi.month}</span>
                
                <button
                  onClick={() => onEditKpi(kpi)}
                  className={`${styles.chartPeriodButton} ${styles.chartPeriodButtonEdit}`}
                  title="Editar"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => onDeleteKpi(kpi)}
                  className={`${styles.chartPeriodButton} ${styles.chartPeriodButtonDelete}`}
                  title="Excluir"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
} 

