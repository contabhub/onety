import  { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from '../../styles/estrategico/DepartmentGoalModal.module.css';

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

// Helper para obter permissões do localStorage
const getPermissoes = () => {
  try {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const parsed = JSON.parse(userData);
      return parsed.permissoes || {};
    }
    return {};
  } catch {
    return {};
  }
};

// Helper para verificar se tem permissão de admin
const hasAdminPermission = () => {
  const permissoes = getPermissoes();
  return permissoes?.adm && Array.isArray(permissoes.adm) && permissoes.adm.includes('admin');
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

const TRIMESTERS = {
  '1': ['01', '02', '03'],
  '2': ['04', '05', '06'],
  '3': ['07', '08', '09'],
  '4': ['10', '11', '12'],
};

export function DepartmentGoalModal({
  companyId,
  onClose,
  onCreated,
  goalToEdit,
}) {

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [trimestre, setTrimestre] = useState(() => {
    const currentMonth = new Date().getMonth() + 1;
    if (currentMonth <= 3) return '1';
    if (currentMonth <= 6) return '2';
    if (currentMonth <= 9) return '3';
    return '4';
  });

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculationType, setCalculationType] = useState('acumulativa');
  const fixedTargetValue = 1;
  const [indicatorType, setIndicatorType] = useState('qtd');
  const [progressType, setProgressType] = useState('progresso');
  const [user, setUser] = useState(null);
  const [permissoes, setPermissoes] = useState({});

  // Atualizar campos quando goalToEdit mudar
  useEffect(() => {
    if (goalToEdit) {
      // Mapear campos do backend (português) para o formato do frontend
      setTitle(goalToEdit.title || goalToEdit.nome || '');
      setDescription(goalToEdit.description || goalToEdit.descricao || '');
      setDepartmentId(goalToEdit.department_id || goalToEdit.departamento_id || '');
      setCalculationType(goalToEdit.calculation_type || goalToEdit.calculo_tipo || 'acumulativa');
      setIndicatorType(goalToEdit.indicator_type || goalToEdit.indicador_tipo || 'qtd');
      setProgressType(goalToEdit.progress_type || goalToEdit.progresso_tipo || 'progresso');
      
      const startDate = goalToEdit.start_date || goalToEdit.data_inicio || '';
      if (startDate) {
        const m = new Date(startDate).getMonth() + 1;
        let newTrimestre = '4';
        if (m <= 3) newTrimestre = '1';
        else if (m <= 6) newTrimestre = '2';
        else if (m <= 9) newTrimestre = '3';
        setTrimestre(newTrimestre);
      }
    } else {
      // Resetar campos quando não há goalToEdit
      setTitle('');
      setDescription('');
      setDepartmentId('');
      setCalculationType('acumulativa');
      setIndicatorType('qtd');
      setProgressType('progresso');
      const currentMonth = new Date().getMonth() + 1;
      let currentTrim = '4';
      if (currentMonth <= 3) currentTrim = '1';
      else if (currentMonth <= 6) currentTrim = '2';
      else if (currentMonth <= 9) currentTrim = '3';
      setTrimestre(currentTrim);
    }
  }, [goalToEdit]);

  useEffect(() => {
    const loadUser = () => {
      try {
        const userData = localStorage.getItem('userData');
        if (userData) {
          const parsed = JSON.parse(userData);
          setUser(parsed);
          setPermissoes(parsed.permissoes || {});
        }
      } catch (err) {
        console.error("Erro ao carregar usuário:", err);
      }
    };

    loadUser();
  }, [companyId]);

  const getLeaderDepartments = async (userId, companyId) => {
    try {
      const response = await apiFetch(`/estrategico/organograma?companyId=${companyId}`);
      const leaderDepartments = response?.filter((dept) => dept.responsavel_id === userId || dept.manager_id === userId) || [];
      return leaderDepartments;
    } catch (error) {
      console.error('Erro ao buscar departamentos onde é líder:', error);
      return [];
    }
  };

  useEffect(() => {
    const loadDepartments = async () => {
      if (!companyId || !user) return;

      try {
        const allDepartments = await apiFetch(`/estrategico/departamentos?companyId=${companyId}`);
        
        let filteredDepartments = allDepartments || [];
        
        // Verificar se não é admin (tem permissão admin)
        const isAdmin = hasAdminPermission();
        
        if (!isAdmin && user?.id) {
          const userDepartmentsResponse = await apiFetch(`/estrategico/funcionarios/${user.id}/department?companyId=${companyId}`);
          
          const leaderDepartmentsResponse = await getLeaderDepartments(user.id, companyId);
          
          let userDepartmentIds = [];
          if (Array.isArray(userDepartmentsResponse)) {
            userDepartmentIds = userDepartmentsResponse.map((d) => d.department_id);
          } else if (userDepartmentsResponse?.department_id) {
            userDepartmentIds = [userDepartmentsResponse.department_id];
          } else if (userDepartmentsResponse?.id) {
            userDepartmentIds = [userDepartmentsResponse.id];
          }
          
          const leaderDepartmentIds = leaderDepartmentsResponse?.map((d) => d.id) || [];
          const allowedDepartmentIds = Array.from(new Set([...userDepartmentIds, ...leaderDepartmentIds]));
          
          filteredDepartments = allDepartments.filter((dept) => 
            allowedDepartmentIds.includes(dept.id)
          );
        }
        
        setDepartments(filteredDepartments);
      } catch (error) {
        console.error('Erro ao carregar departamentos:', error);
        toast.error('Erro ao carregar departamentos');
      }
    };
    
    loadDepartments();
  }, [companyId, user, permissoes]);

  const handleSubmit = async () => {
    console.log('🔍 [DepartmentGoalModal] Valores do formulário:', {
      title,
      departmentId,
      trimestre,
      departments: departments.length
    });
    
    if (!title || !departmentId || !trimestre) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setLoading(true);

      const currentYear = new Date().getFullYear();
      const months = TRIMESTERS[trimestre];

      const start_date = `${currentYear}-${months[0]}-01`;
      const end_date = `${currentYear}-${months[2]}-30`;

      if (goalToEdit) {
        await apiFetch(`/estrategico/metas-departamentais/${goalToEdit.id}`, {
          method: 'PUT',
          body: {
            department_id: departmentId,
            title,
            description,
            target_value: fixedTargetValue,
            start_date,
            end_date,
            calculation_type: calculationType,
            indicator_type: indicatorType,
            progress_type: progressType,
          }
        });
        toast.success('Meta atualizada com sucesso');
      } else {
        await apiFetch('/estrategico/metas-departamentais', {
          method: 'POST',
          body: {
            company_id: companyId,
            department_id: departmentId,
            title,
            description,
            target_value: fixedTargetValue,
            current_value: 0,
            start_date,
            end_date,
            status: 'in_progress',
            calculation_type: calculationType,
            indicator_type: indicatorType,
            progress_type: progressType,
          }
        });
        toast.success('Meta criada com sucesso');
      }

      onCreated();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar meta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {goalToEdit ? 'Editar Meta Departamental' : 'Nova Meta Departamental'}
          </h2>
          <button onClick={onClose} className={styles.modalCloseButton}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <input
                type="text"
                placeholder="Título"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <textarea
                placeholder="Descrição (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={styles.formTextarea}
              />
            </div>

            <div className={styles.formGroup}>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className={styles.formSelect}
              >
                <option value="">Selecione o departamento</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.title || d.name || 'Sem nome'}</option>
                ))}
              </select>
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
                value={trimestre}
                onChange={(e) => setTrimestre(e.target.value)}
                className={styles.formSelect}
              >
                <option value="1">1º Trimestre (Jan - Mar)</option>
                <option value="2">2º Trimestre (Abr - Jun)</option>
                <option value="3">3º Trimestre (Jul - Set)</option>
                <option value="4">4º Trimestre (Out - Dez)</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            onClick={onClose}
            className={`${styles.button} ${styles.buttonSecondary}`}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`${styles.button} ${styles.buttonPrimary}`}
          >
            {loading ? 'Salvando...' : 'Salvar Meta'}
          </button>
        </div>
      </div>
    </div>
  );
}

