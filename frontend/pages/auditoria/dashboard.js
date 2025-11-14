import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { 
  Building2, 
  FileText, 
  BarChart3, 
  Calculator, 
  Upload, 
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';
import styles from '../../styles/auditoria/dashboard.module.css';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalAnalyses: 0,
    totalNotasFiscais: 0,
    totalSimplesNacional: 0,
    totalEcac: 0,
    totalRctSn: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [EmpresaId, setEmpresaId] = useState(null);
  const [EmpresaNome, setEmpresaNome] = useState(null);
  const router = useRouter();

  // Carregar dados do usuário do localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const userDataStr = localStorage.getItem('userData');
        if (userDataStr) {
          const parsed = JSON.parse(userDataStr);
          setUserData(parsed);
          setEmpresaId(parsed.EmpresaId);
          setEmpresaNome(parsed.EmpresaNome);
        } else {
          router.push('/empresa');
        }
      } catch (err) {
        console.error('[DASHBOARD] Erro ao carregar dados do usuário:', err);
        router.push('/login');
      }
    }
  }, [router]);

  const loadDashboardStats = useCallback(async () => {
    if (!EmpresaId) return;

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Carregar estatísticas em paralelo
      const [analysesRes, notasRes, ecacRes, simplesRes] = await Promise.all([
        fetch(`${API_URL}/auditoria/regime-normal?company_id=${EmpresaId}`, { headers }),
        fetch(`${API_URL}/auditoria/notas-fiscais?company_id=${EmpresaId}`, { headers }),
        fetch(`${API_URL}/auditoria/ecac?company_id=${EmpresaId}`, { headers }),
        fetch(`${API_URL}/auditoria/simples-nacional?company_id=${EmpresaId}`, { headers })
      ]);

      let totalAnalyses = 0;
      if (analysesRes.ok) {
        const analysesData = await analysesRes.json();
        totalAnalyses = analysesData.data?.length || 0;
      }

      let totalNotasFiscais = 0;
      if (notasRes.ok) {
        const notasData = await notasRes.json();
        totalNotasFiscais = notasData.data?.length || 0;
      }

      let totalEcac = 0;
      if (ecacRes.ok) {
        const ecacData = await ecacRes.json();
        totalEcac = ecacData.data?.length || 0;
      }

      let totalSimplesNacional = 0;
      if (simplesRes.ok) {
        const simplesData = await simplesRes.json();
        totalSimplesNacional = simplesData.data?.length || 0;
      }

      // Buscar RCT SN (se a rota existir)
      let totalRctSn = 0;
      try {
        const rctRes = await fetch(`${API_URL}/auditoria/rct-sn?company_id=${EmpresaId}`, { headers });
        if (rctRes.ok) {
          const rctData = await rctRes.json();
          totalRctSn = rctData.data?.length || 0;
        }
      } catch (rctError) {
        console.error('[DASHBOARD] Erro ao carregar RCT SN:', rctError);
        // Continuar sem falhar o dashboard inteiro
      }

      setStats({
        totalAnalyses,
        totalNotasFiscais,
        totalSimplesNacional,
        totalEcac,
        totalRctSn
      });
    } catch (err) {
      console.error('[DASHBOARD] Erro ao carregar estatísticas:', err);
      setError('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  }, [EmpresaId, router]);

  useEffect(() => {
    if (EmpresaId) {
      loadDashboardStats();
    }
  }, [EmpresaId, loadDashboardStats]);


  if (!EmpresaId) {
    return (
      <div className={styles.layoutWrapper}>
        <PrincipalSidebar />
        <div className={styles.pageContent}>
          <div className={styles.emptyStateWrapper}>
            <div className={styles.emptyStateContainer}>
              <div className={styles.textCenter}>
                <Building2 className={styles.emptyStateIcon} />
                <h1 className={styles.emptyStateTitle}>Selecione uma Empresa</h1>
                <p className={styles.emptyStateText}>
                  Para acessar o dashboard, você precisa selecionar uma empresa primeiro.
                </p>
                <button
                  onClick={() => router.push('/empresa')}
                  className={styles.emptyStateButton}
                >
                  Selecionar Empresa
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.layoutWrapper}>
        <PrincipalSidebar />
        <div className={styles.pageContent}>
          <div className={styles.loadingWrapper}>
            <div className={styles.loadingContainer}>
              <div className={`${styles.skeletonSpacing} ${styles.skeletonPulse}`}>
                <div className={styles.skeletonBar}></div>
                <div className={styles.skeletonGrid}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={styles.skeletonCard}></div>
                  ))}
                </div>
                <div className={styles.skeletonGridLarge}>
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className={styles.skeletonCardLarge}></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.layoutWrapper}>
      <PrincipalSidebar />
      <div className={styles.pageContent}>
        <div className={styles.container}>
          <h1 className={styles.pageTitle}>Dashboard</h1>
          
          {error && (
            <div className={styles.errorAlert}>
              <AlertCircle className={styles.errorIcon} />
              <span>{error}</span>
            </div>
          )}

        {/* Cards de Estatísticas */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statCardContent}>
              <div className={`${styles.statIconWrapper} ${styles.statIconWrapperBlue}`}>
                <BarChart3 className={styles.statIcon} />
              </div>
              <div className={styles.statInfo}>
                <p className={styles.statLabel}>Análises</p>
                <p className={styles.statValue}>{stats?.totalAnalyses || 0}</p>
              </div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardContent}>
              <div className={`${styles.statIconWrapper} ${styles.statIconWrapperGreen}`}>
                <FileText className={styles.statIcon} />
              </div>
              <div className={styles.statInfo}>
                <p className={styles.statLabel}>Notas Fiscais</p>
                <p className={styles.statValue}>{stats?.totalNotasFiscais || 0}</p>
              </div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardContent}>
              <div className={`${styles.statIconWrapper} ${styles.statIconWrapperPurple}`}>
                <Calculator className={styles.statIcon} />
              </div>
              <div className={styles.statInfo}>
                <p className={styles.statLabel}>Simples Nacional</p>
                <p className={styles.statValue}>{stats?.totalSimplesNacional || 0}</p>
              </div>
            </div>
          </div>

          {/* <div className={styles.statCard}>
            <div className={styles.statCardContent}>
              <div className={`${styles.statIconWrapper} ${styles.statIconWrapperYellow}`}>
                <TrendingUp className={styles.statIcon} />
              </div>
              <div className={styles.statInfo}>
                <p className={styles.statLabel}>eCAC</p>
                <p className={styles.statValue}>{stats?.totalEcac || 0}</p>
              </div>
            </div>
          </div> */}

        </div>

        {/* Funcionalidades Principais */}
        <div className={styles.featuresGrid}>
          {/* Análises e Processamento */}
          <div className={styles.featureCard}>
            <h2 className={`${styles.featureCardTitle}`}>
              <BarChart3 className={`${styles.featureCardTitleIcon} ${styles.featureCardTitleIconBlue}`} />
              Análises e Processamento
            </h2>
            <div className={styles.featureButtonsList}>
              <button
                onClick={() => router.push('/auditoria/analisador-entregas')}
                className={styles.featureButton}
              >
                <div className={styles.featureButtonContent}>
                  <Upload className={`${styles.featureButtonIcon} ${styles.featureButtonIconBlue}`} />
                  <span className={styles.featureButtonText}>Análise de Arquivos</span>
                </div>
                <span className={styles.featureButtonSubtext}>Processar XMLs e PDFs</span>
              </button>
              
              <button
                onClick={() => router.push('/auditoria/leitor-xml')}
                className={styles.featureButton}
              >
                <div className={styles.featureButtonContent}>
                  <FileText className={`${styles.featureButtonIcon} ${styles.featureButtonIconGreen}`} />
                  <span className={styles.featureButtonText}>Leitor XML</span>
                </div>
                <span className={styles.featureButtonSubtext}>Análise detalhada de NFes</span>
              </button>
              
              <button
                onClick={() => router.push('/auditoria/consolidado')}
                className={styles.featureButton}
              >
                <div className={styles.featureButtonContent}>
                  <BarChart3 className={`${styles.featureButtonIcon} ${styles.featureButtonIconPurple}`} />
                  <span className={styles.featureButtonText}>Consolidado</span>
                </div>
                <span className={styles.featureButtonSubtext}>Visão geral consolidada</span>
              </button>
            </div>
          </div>

          {/* Especializações */}
          <div className={styles.featureCard}>
            <h2 className={styles.featureCardTitle}>
              <Calculator className={`${styles.featureCardTitleIcon} ${styles.featureCardTitleIconPurple}`} />
              Especializações
            </h2>
            <div className={styles.featureButtonsList}>
              <button
                onClick={() => router.push('/auditoria/dashboard-simples')}
                className={styles.featureButton}
              >
                <div className={styles.featureButtonContent}>
                  <Calculator className={`${styles.featureButtonIcon} ${styles.featureButtonIconGreen}`} />
                  <span className={styles.featureButtonText}>Simples Nacional</span>
                </div>
                <span className={styles.featureButtonSubtext}>Análises específicas</span>
              </button>
              
              {/* <button
                onClick={() => router.push('/auditoria/ecac')}
                className={styles.featureButton}
              >
                <div className={styles.featureButtonContent}>
                  <TrendingUp className={`${styles.featureButtonIcon} ${styles.featureButtonIconYellow}`} />
                  <span className={styles.featureButtonText}>eCAC</span>
                </div>
                <span className={styles.featureButtonSubtext}>Pagamentos e análise</span>
              </button> */}
              
              <button
                onClick={() => router.push('/auditoria/rct-sn')}
                className={styles.featureButton}
              >
                <div className={styles.featureButtonContent}>
                  <FileText className={`${styles.featureButtonIcon} ${styles.featureButtonIconBlue}`} />
                  <span className={styles.featureButtonText}>RCT Simples Nacional</span>
                </div>
                <span className={styles.featureButtonSubtext}>Relatórios e análises</span>
              </button>
            </div>
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className={styles.quickActionsCard}>
          <h2 className={styles.quickActionsTitle}>Ações Rápidas - Simples Nacional</h2>
          <div className={styles.quickActionsGrid}>
            <button
              onClick={() => router.push('/auditoria/rct-sn')}
              className={`${styles.quickActionButton} ${styles.quickActionButtonGreen}`}
            >
              <Upload className={styles.quickActionButtonIcon} />
              <span>Importar Extratos</span>
            </button>
            
            <button
              onClick={() => router.push('/auditoria/leitor-xml')}
              className={`${styles.quickActionButton} ${styles.quickActionButtonPurple}`}
            >
              <Upload className={styles.quickActionButtonIcon} />
              <span>Importar Notas Fiscais</span>
            </button>

          </div>
        </div>
        <div className={`${styles.quickActionsCard} ${styles.quickActionsCardMargin}`}>
          <h2 className={styles.quickActionsTitle}>Ações Rápidas - Regime Normal</h2>
          <div className={styles.quickActionsGrid}>
            <button
              onClick={() => router.push('/auditoria/analisador-entregas')}
              className={`${styles.quickActionButton} ${styles.quickActionButtonOrange}`}
            >
              <Upload className={styles.quickActionButtonIcon} />
              <span>Analisador de Entregas</span>
            </button>
            <button
              onClick={() => router.push('/auditoria/dashboard-normal')}
              className={`${styles.quickActionButton} ${styles.quickActionButtonLime}`}
            >
              <Upload className={styles.quickActionButtonIcon} />
              <span>Empresas do Regime Normal</span>
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}