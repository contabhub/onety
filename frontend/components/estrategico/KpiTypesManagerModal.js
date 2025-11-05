import { useState, useEffect } from 'react';
import { X, Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from '../../styles/estrategico/KpiTypesManagerModal.module.css';

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

export function KpiTypesManagerModal({ isOpen, onClose, companyId, onUpdate }) {
  const [kpiTypes, setKpiTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [deletingType, setDeletingType] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    unit_type: 'decimal',
    unit_symbol: ''
  });

  const getUnitTypeLabel = (unitType) => {
    const labels = {
      'decimal': 'Decimal/Quantidade',
      'currency': 'Monetário',
      'percentage': 'Percentual',
      'time': 'Tempo'
    };
    return labels[unitType] || unitType;
  };

  useEffect(() => {
    if (isOpen) {
      loadKpiTypes();
    }
  }, [isOpen, companyId]);

  const loadKpiTypes = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/estrategico/kpis/types?companyId=${companyId}`);
      setKpiTypes(data || []);
    } catch (error) {
      console.error('Erro ao carregar tipos de KPI:', error);
      toast.error('Erro ao carregar indicadores');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name || !form.unit_type || !form.unit_symbol) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setLoading(true);
      
      if (editingType) {
        await apiFetch(`/estrategico/kpis/types/${editingType.id}`, {
          method: 'PUT',
          body: {
            ...form,
            companyId
          }
        });
        toast.success('Indicador atualizado com sucesso!');
      } else {
        await apiFetch('/estrategico/kpis/types', {
          method: 'POST',
          body: {
            ...form,
            companyId
          }
        });
        toast.success('Indicador criado com sucesso!');
      }

      setForm({ name: '', description: '', unit_type: 'decimal', unit_symbol: '' });
      setEditingType(null);
      setShowForm(false);
      
      await loadKpiTypes();
      onUpdate();
    } catch (error) {
      console.error('Erro ao salvar tipo de KPI:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar indicador');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (kpiType) => {
    setEditingType(kpiType);
    setForm({
      name: kpiType.name,
      description: kpiType.description || '',
      unit_type: kpiType.unit_type,
      unit_symbol: kpiType.unit_symbol
    });
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deletingType) return;

    try {
      setLoading(true);
      await apiFetch(`/estrategico/kpis/types/${deletingType.id}`, {
        method: 'DELETE'
      });
      toast.success('Indicador excluído com sucesso!');
      setDeletingType(null);
      await loadKpiTypes();
      onUpdate();
    } catch (error) {
      console.error('Erro ao excluir tipo de KPI:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir indicador');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelForm = () => {
    setForm({ name: '', description: '', unit_type: 'decimal', unit_symbol: '' });
    setEditingType(null);
    setShowForm(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.modalOverlay}>
        <div className={styles.modalContainer}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>Gerenciar Indicadores</h3>
            <button
              onClick={onClose}
              className={styles.modalCloseButton}
            >
              <X size={20} />
            </button>
          </div>

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className={styles.addButton}
            >
              <Plus className="h-4 w-4" />
              Novo Indicador
            </button>
          )}

          {showForm && (
            <form onSubmit={handleSubmit} className={styles.formSection}>
              <h4 className={styles.formTitle}>
                {editingType ? 'Editar Indicador' : 'Novo Indicador'}
              </h4>
              
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    Nome <span className={styles.formLabelRequired}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={styles.formInput}
                    placeholder="Ex: Faturamento Mensal"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    Símbolo <span className={styles.formLabelRequired}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.unit_symbol}
                    onChange={(e) => setForm({ ...form, unit_symbol: e.target.value })}
                    className={styles.formInput}
                    placeholder="Ex: R$, %, unid"
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Tipo de Unidade <span className={styles.formLabelRequired}>*</span>
                </label>
                <select
                  value={form.unit_type}
                  onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                  className={styles.formSelect}
                  required
                >
                  <option value="decimal">Decimal/Quantidade</option>
                  <option value="currency">Monetário</option>
                  <option value="percentage">Percentual</option>
                  <option value="time">Tempo</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Descrição
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={styles.formTextarea}
                  rows={3}
                  placeholder="Descrição opcional do indicador"
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className={`${styles.button} ${styles.buttonSecondary}`}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`${styles.button} ${styles.buttonPrimary}`}
                >
                  {loading ? 'Salvando...' : editingType ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          )}

          {loading && !showForm ? (
            <div className={styles.loadingContainer}>
              <div className="loading-spinner" style={{ width: '2rem', height: '2rem', border: '2px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {kpiTypes.map((kpiType) => (
                <div
                  key={kpiType.id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', backgroundColor: '#ffffff', transition: 'border-color 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#818cf8'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h4 style={{ fontWeight: 600, color: '#111827' }}>{kpiType.name}</h4>
                    </div>
                    {kpiType.description && (
                      <p style={{ fontSize: '0.875rem', color: '#4b5563', marginTop: '0.25rem' }}>{kpiType.description}</p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <span>Tipo: <strong>{getUnitTypeLabel(kpiType.unit_type)}</strong></span>
                      <span>Símbolo: <strong>{kpiType.unit_symbol}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem' }}>
                    <button
                      onClick={() => handleEdit(kpiType)}
                      className={styles.actionButton}
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeletingType(kpiType)}
                      className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {kpiTypes.length === 0 && !loading && (
                <div className={styles.emptyState}>
                  <p className={styles.emptyStateText}>
                    Nenhum indicador encontrado
                  </p>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              className={`${styles.button} ${styles.buttonSecondary}`}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {deletingType && (
        <div className={styles.modalOverlay} style={{ zIndex: 60 }}>
          <div className={styles.modalContainer} style={{ maxWidth: '28rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ flexShrink: 0, width: '2.5rem', height: '2.5rem', backgroundColor: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle className="h-5 w-5" style={{ color: '#dc2626' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>Confirmar Exclusão</h3>
                <p style={{ fontSize: '0.875rem', color: '#4b5563' }}>Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <p style={{ color: '#374151', marginBottom: '1.5rem' }}>
              Tem certeza que deseja excluir o indicador <strong>{deletingType.name}</strong>?
            </p>

            <div className={styles.formActions}>
              <button
                onClick={() => setDeletingType(null)}
                className={`${styles.button} ${styles.buttonSecondary}`}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className={`${styles.button}`}
                style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              >
                {loading ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

