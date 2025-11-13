import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';
import styles from '../../styles/auditoria/dashboard-normal.module.css';
import { 
  Building2, 
  FileText, 
  BarChart3, 
  Upload, 
  AlertCircle,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';

const DashboardNormal = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUF, setSelectedUF] = useState('');
  const [userData, setUserData] = useState({});
  const [empresaReady, setEmpresaReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Buscar userData do localStorage
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      try {
        const raw = localStorage.getItem('userData');
        const parsed = raw ? JSON.parse(raw) : {};
        setUserData(parsed);
        if (!parsed?.EmpresaId) {
          setLoading(false);
        }
      } catch {
        setUserData({});
        setLoading(false);
      }
      setEmpresaReady(true);
    }
  }, [router]);

  const EmpresaId = userData?.EmpresaId;

  const loadClientesRegimeNormal = useCallback(async () => {
    // Garantir que pegamos o EmpresaId do localStorage novamente para ter certeza
    if (typeof window === 'undefined') return;
    
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Pegar userData diretamente do localStorage para garantir que temos o valor mais atual
    let currentEmpresaId = EmpresaId;
    if (!currentEmpresaId) {
      try {
        const raw = localStorage.getItem('userData');
        if (raw) {
          const parsed = JSON.parse(raw);
          currentEmpresaId = parsed?.EmpresaId;
        }
      } catch (err) {
        console.error('Erro ao ler userData do localStorage:', err);
      }
    }

    if (!currentEmpresaId) {
      setError('EmpresaId não encontrado no localStorage');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      // Usar a rota que aceita ID numérico: /auditoria/regime-normal/clientes
      const url = `${API_URL}/auditoria/regime-normal/clientes?company_id=${currentEmpresaId}`;

      if (typeof window === 'undefined') return;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Resposta não é JSON válido');
      }

      const data = await response.json();
      setClientes(data.data || []);
    } catch (err) {
      console.error('Erro ao carregar clientes do regime normal:', err);
      setError(`Erro ao carregar clientes: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  }, [EmpresaId, router]);

  useEffect(() => {
    if (empresaReady && EmpresaId) {
      loadClientesRegimeNormal();
    }
  }, [empresaReady, EmpresaId, loadClientesRegimeNormal]);

  const handleRefresh = () => {
    if (EmpresaId) {
      loadClientesRegimeNormal();
    }
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
  };

  const handleUFChange = (uf) => {
    setSelectedUF(uf);
  };

  // Filtrar clientes baseado na busca e UF selecionada
  const filteredClientes = clientes.filter(cliente => {
    const matchesSearch = cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cliente.cnpj.includes(searchTerm);
    const matchesUF = !selectedUF || cliente.uf === selectedUF;
    return matchesSearch && matchesUF;
  });

  // Obter lista única de UFs para o filtro
  const ufs = [...new Set(clientes.map(cliente => cliente.uf))].sort();

  if (loading) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.loadingPage}>
          <div className={styles.loadingContent}>
            <div className={styles.skeletonLayout}>
              <div className={styles.skeletonBar}></div>
              <div className={styles.skeletonCard}></div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Verificar se há empresa no userData
  if (!EmpresaId && empresaReady) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.errorWrapper}>
          <div className={styles.errorCard}>
            <AlertCircle className={styles.errorIcon} />
            <h2 className={styles.errorTitle}>Nenhuma empresa selecionada</h2>
            <p className={styles.errorMessage}>
              Por favor, selecione uma empresa primeiro para visualizar os clientes.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className={`${styles.actionButton} ${styles.actionButtonBlue}`}
            >
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.errorWrapper}>
          <div className={styles.errorCard}>
            <AlertCircle className={styles.errorIcon} />
            <h2 className={styles.errorTitle}>Erro ao Carregar</h2>
            <p className={styles.errorMessage}>{error}</p>
            <button
              onClick={() => EmpresaId && loadClientesRegimeNormal()}
              className={`${styles.actionButton} ${styles.actionButtonBlue}`}
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.pageWrapper}>
        {/* Header */}
        <div className={styles.headerBar}>
          <div className={styles.headerInner}>
            <div className={styles.headerLeft}>
              <Building2 className={styles.headerIcon} />
              <div>
                <h1 className={styles.headerTitle}>
                  Clientes do Regime Normal
                </h1>
                <p className={styles.headerSubtitle}>
                  Lista de clientes cadastrados no regime normal
                </p>
              </div>
            </div>
            
            <div className={styles.headerRight}>
              <button
                onClick={() => router.push('/dashboard')}
                className={styles.headerButton}
              >
                Voltar ao Dashboard
              </button>
            </div>
          </div>
        </div>

        <div className={styles.mainContent}>
          {/* Filtros e Busca */}
          <div className={styles.filtersCard}>
            <div className={styles.filtersHeader}>
              <h2 className={styles.filterTitle}>
                <Filter className={styles.filterIcon} />
                Filtros e Busca
              </h2>
              <button
                onClick={handleRefresh}
                className={styles.refreshButton}
              >
                <RefreshCw className={styles.refreshIcon} />
                <span>Atualizar</span>
              </button>
            </div>

            <div className={styles.filterGrid}>
              {/* Busca por nome ou CNPJ */}
              <div className={styles.searchWrapper}>
                <Search className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Buscar por nome ou CNPJ..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              {/* Filtro por UF */}
              <div>
                <select
                  value={selectedUF}
                  onChange={(e) => handleUFChange(e.target.value)}
                  className={styles.selectField}
                >
                  <option value="">Todas as UFs</option>
                  {ufs.map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Estatísticas */}
            <div className={styles.statsRow}>
              <span className={styles.statItem}>
                Total de clientes: <span className={styles.statHighlight}>{clientes.length}</span>
              </span>
              <span className={styles.statItem}>
                Filtrados: <span className={styles.statHighlight}>{filteredClientes.length}</span>
              </span>
              {selectedUF && (
                <span className={styles.statItem}>
                  UF selecionada: <span className={styles.statHighlight}>{selectedUF}</span>
                </span>
              )}
            </div>
          </div>

          {/* Lista de Clientes */}
          <div className={styles.listCard}>
            <div className={styles.listHeader}>
              <h2 className={styles.listTitle}>
                <Building2 className={styles.listIcon} />
                Clientes do Regime Normal
              </h2>
            </div>

            {filteredClientes.length === 0 ? (
              <div className={styles.emptyState}>
                <Building2 className={styles.emptyIconLarge} />
                <h3 className={styles.emptyTitle}>
                  {clientes.length === 0 ? 'Nenhum cliente encontrado' : 'Nenhum cliente corresponde aos filtros'}
                </h3>
                <p className={styles.emptySubtitle}>
                  {clientes.length === 0 
                    ? 'Não há clientes do regime normal cadastrados para esta empresa.'
                    : 'Tente ajustar os filtros de busca ou UF selecionada.'
                  }
                </p>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHeadRow}>
                      <th className={styles.tableHeadCell}>Nome</th>
                      <th className={styles.tableHeadCell}>CNPJ</th>
                      <th className={styles.tableHeadCell}>UF</th>
                      <th className={styles.tableHeadCell}>Regime</th>
                      <th className={styles.tableHeadCell}>Cadastrado em</th>
                      <th className={styles.tableHeadCell}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClientes.map((cliente) => (
                      <tr key={cliente.id} className={styles.tableRow}>
                        <td className={styles.tableCellPrimary}>{cliente.nome}</td>
                        <td className={styles.tableCellMono}>{cliente.cnpj}</td>
                        <td className={styles.tableCell}>
                          <span className={styles.badgeBlue}>
                            {cliente.uf}
                          </span>
                        </td>
                        <td className={styles.tableCell}>
                          <span className={styles.badgeGreen}>
                            Regime Normal
                          </span>
                        </td>
                        <td className={styles.tableCellMuted}>
                          {new Date(cliente.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className={styles.actionCell}>
                          <button
                            onClick={() => {
                              // Redirecionar para file-analyzer com parâmetros na URL
                              router.push({
                                pathname: '/file-analyzer',
                                query: {
                                  client_id: cliente.id,
                                  cnpj: cliente.cnpj,
                                  nome: cliente.nome
                                }
                              });
                            }}
                            className={styles.actionLink}
                          >
                            Ver Detalhes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ações Rápidas */}
          <div className={styles.secondaryActionsCard}>
            <h2 className={styles.secondaryActionsTitle}>Ações Rápidas - Regime Normal</h2>
            <div className={styles.secondaryActionsGrid}>
              <button
                onClick={() => router.push('/file-analyzer')}
                className={`${styles.actionButton} ${styles.actionButtonOrange}`}
              >
                <Upload className={styles.actionIcon} />
                <span>Analisador de Entregas</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardNormal;

