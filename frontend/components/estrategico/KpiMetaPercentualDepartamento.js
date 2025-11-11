import { useEffect, useState } from 'react';
import styles from '../../styles/estrategico/departmentDetails.module.css';
import { getKpiMetaPercentualDepartamentoProprio } from '../../utils/estrategico/goalUtils';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const normalizeUrl = (u) => `${BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;

const getToken = () => {
  try {
    return localStorage.getItem('token') || null;
  } catch {
    return null;
  }
};

const getUserData = () => {
  try {
    const stored = localStorage.getItem('userData');
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch {
    return null;
  }
};

const getEmpresaId = () => {
  const data = getUserData();
  if (!data) return null;
  return data.EmpresaId || data.empresaId || null;
};

const apiFetch = async (url, options = {}) => {
  const token = getToken();
  const empresaId = getEmpresaId();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
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

  const response = await fetch(normalizeUrl(url), config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP error! status: ${response.status}`);
  }

  return data;
};

export function KpiMetaPercentualDepartamento({ goals = [], departmentId, companyId }) {
  const [childDepartments, setChildDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [departmentTitle, setDepartmentTitle] = useState('');

  // Buscar filhos do departamento para usar a mesma lógica do organograma
  useEffect(() => {
    const loadChildren = async () => {
      if (!departmentId || !companyId) {
        setLoading(false);
        return;
      }

      try {
        // Buscar o título do departamento atual
        const departmentDetails = await apiFetch(`/estrategico/departamentos/${departmentId}?companyId=${companyId}`);
        setDepartmentTitle(departmentDetails?.title || departmentDetails?.name || '');
        
        // Buscar departamentos filhos
        const allDepartments = await apiFetch(`/estrategico/departamentos?companyId=${companyId}`);
        const children = allDepartments.filter((dept) => dept.parent_id === departmentId);
        
        // Para cada filho, buscar suas metas
        const childrenWithGoals = await Promise.all(
          children.map(async (child) => {
            const childGoalsResponse = await apiFetch(`/estrategico/metas-departamentais?departmentId=${child.id}&companyId=${companyId}`);
            const childGoals = Array.isArray(childGoalsResponse?.data)
              ? childGoalsResponse.data
              : Array.isArray(childGoalsResponse)
                ? childGoalsResponse
                : [];
            const goalsWithMonths = await Promise.all(
              childGoals.map(async (goal) => ({
                ...goal,
                monthlyGoals: await apiFetch(`/estrategico/metas-departamentais/${goal.id}/months`)
              }))
            );
            
            return {
              ...child,
              goals: goalsWithMonths
            };
          })
        );
        
        setChildDepartments(childrenWithGoals);
      } catch (error) {
        console.error('Erro ao buscar filhos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChildren();
  }, [departmentId, companyId]);

  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();
  const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
  const diaHoje = now.getDate();
  const percentualEsperado = (diaHoje / diasNoMes) * 100;
  
  // IMPORTANTE: Usar a mesma lógica do organograma
  // Buscar TODAS as metas do departamento (sem filtros) para usar a mesma lógica do organograma
const [allGoals, setAllGoals] = useState([]);
  
  useEffect(() => {
    const loadAllGoals = async () => {
      if (!departmentId || !companyId) return;
      
      try {
        // Buscar TODAS as metas do departamento (sem filtros)
        const deptGoalsResponse = await apiFetch(`/estrategico/metas-departamentais?departmentId=${departmentId}&companyId=${companyId}`);
        const deptGoals = Array.isArray(deptGoalsResponse?.data)
          ? deptGoalsResponse.data
          : Array.isArray(deptGoalsResponse)
            ? deptGoalsResponse
            : [];
        
        // Para cada meta, buscar os meses
        const goalsWithMonths = await Promise.all(
          deptGoals.map(async (goal) => {
            const monthlyGoals = await apiFetch(`/estrategico/metas-departamentais/${goal.id}/months`);
            return {
              ...goal,
              monthlyGoals
            };
          })
        );
        
        setAllGoals(goalsWithMonths);
      } catch (error) {
        console.error('Erro ao carregar todas as metas:', error);
      }
    };
    
    loadAllGoals();
  }, [departmentId, companyId]);
  
  // Criar um node com TODAS as metas (sem filtros) para usar a mesma lógica do organograma
  const tempNode = {
    id: departmentId || '',
    title: departmentTitle, // Usar o título real do departamento
    goals: allGoals, // Usar TODAS as metas, não as filtradas
    children: childDepartments.map(child => ({
      ...child,
      children: [],
      tasks: []
    })), // Converter filhos para formato DepartmentNode
    employees: [], // Array vazio para compatibilidade
    tasks: [] // Array vazio para compatibilidade
  };
  
  // IMPORTANTE: Usar getKpiMetaPercentualDepartamentoProprio para pegar o percentual do próprio departamento
  // Não usar getKpiMetaPercentualDepartamentoRecursivo que calcula a média dos filhos
  const kpi = getKpiMetaPercentualDepartamentoProprio(tempNode, anoAtual, mesAtual);
  const percentualReal = kpi.percentualReal;

  // Lógica de cor
  let cor = '#10B981'; // verde
  if (percentualReal < percentualEsperado - 10) {
    cor = '#EF4444'; // vermelho
  } else if (percentualReal < percentualEsperado) {
    cor = '#F59E42'; // amarelo
  }

  // Frase
  let frase = '';
  let fraseClasse = styles.kpiStatusSuccess;
  if (percentualReal < percentualEsperado - 10) {
    frase = 'Atenção: o departamento está abaixo do ritmo esperado!';
    fraseClasse = styles.kpiStatusDanger;
  } else if (percentualReal < percentualEsperado) {
    frase = 'Atenção: o departamento está levemente abaixo do ritmo esperado.';
    fraseClasse = styles.kpiStatusWarning;
  } else {
    frase = 'Ótimo! O departamento está no ritmo esperado.';
  }

  // Visual
  const radius = 80;
  const strokeWidth = 20;
  const center = 110;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.min(percentualReal, 100);
  const strokeLength = (percent / 100) * circumference;

  if (loading) {
    return (
      <div className={styles.kpiWrapper}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} />
          <span className={styles.loadingText}>Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.kpiWrapper}>
      <div className={styles.kpiGauge}>
        <svg className={styles.kpiGaugeSvg} width="220" height="220" viewBox="0 0 220 220">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke={cor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
            strokeDashoffset={circumference}
            transform="rotate(-90 110 110)"
            style={{ transition: 'stroke-dasharray 0.5s' }}
          />
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            alignmentBaseline="middle"
            className={styles.kpiGaugeValue}
            fill={cor}
          >
            {percentualReal.toFixed(2)}%
          </text>
        </svg>
      </div>
      <div className={styles.kpiInfo}>
        <span className={styles.kpiInfoLine}>
          Esperado até hoje: <strong>{percentualEsperado.toFixed(2)}%</strong>
        </span>
        <span className={styles.kpiInfoLine}>
          Meta do mês: <strong>{percentualReal.toFixed(2)}%</strong>
        </span>
      </div>
      {frase && (
        <div className={`${styles.kpiStatusMessage} ${fraseClasse}`}>{frase}</div>
      )}
    </div>
  );
} 