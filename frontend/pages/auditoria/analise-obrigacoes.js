import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  DollarSign,
  BarChart2,
  Download,
  ArrowLeft,
  User,
  Calendar,
  ChevronDown,
  Filter,
} from 'lucide-react';
import ComparisonTable from '../../components/auditoria/ComparisonTable';
import styles from '../../styles/auditoria/analise-obrigacoes.module.css';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar'; 


const ObligationsAnalysis = () => {
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [data, setData] = useState(null);
  const [allAnalyses, setAllAnalyses] = useState([]); // Armazenar todos os dados
  const [paymentComparisons, setPaymentComparisons] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const router = useRouter();
  const { query } = router;
  const cnpj = query.cnpj || '';
  const clientId = query.client_id || '';
  
  // Inicializar mês e ano dos query params ou usar valores padrão
  const [selectedMonth, setSelectedMonth] = useState(() => {
    if (query.month) return parseInt(query.month);
    return parseInt(new Date().getMonth() + 1);
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    if (query.year) return parseInt(query.year);
    return parseInt(new Date().getFullYear());
  });


  // Helper para pegar token e dados da empresa do localStorage
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Helper para pegar company_id, client_id, cnpj
  const getCompanyId = () => {
    try {
      // userData tem info de empresa e permissões
      const userData = JSON.parse(localStorage.getItem('userData'));
      // EmpresaId pode estar em EmpresaId, empresa_id, ou dentro do objeto EmpresaNome
      // Ajustar conforme sua estrutura real
      return userData?.EmpresaId || userData?.empresa_id || userData?.empresaId || undefined;
    } catch (err) {
      return undefined;
    }
  };

  // Função para carregar lista de clientes
  const loadClientes = useCallback(async () => {
    if (typeof window === 'undefined') return;
    
    const companyId = getCompanyId();
    console.log('[OBRIGAÇÕES] Carregando clientes, companyId:', companyId);
    
    if (!companyId) {
      console.log('[OBRIGAÇÕES] CompanyId não encontrado, não é possível carregar clientes');
      return;
    }

    try {
      setLoadingClientes(true);
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('[OBRIGAÇÕES] Token não encontrado');
        return;
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const url = `${API_URL}/auditoria/regime-normal/clientes?company_id=${companyId}`;
      console.log('[OBRIGAÇÕES] Buscando clientes em:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('[OBRIGAÇÕES] Clientes recebidos:', responseData);
        setClientes(responseData.data || []);
      } else {
        console.error('[OBRIGAÇÕES] Erro ao buscar clientes:', response.status, response.statusText);
      }
    } catch (err) {
      console.error('[OBRIGAÇÕES] Erro ao carregar clientes:', err);
    } finally {
      setLoadingClientes(false);
    }
  }, []);

  // Função para lidar com mudança de cliente selecionado
  const handleClienteChange = (selectedClientId) => {
    const newQuery = {
      ...query,
      client_id: selectedClientId || undefined,
    };
    
    // Remove client_id se for vazio
    if (!selectedClientId) {
      delete newQuery.client_id;
    }

    router.push({
      pathname: router.pathname,
      query: newQuery,
    });
  };

  const loadAllAnalyses = useCallback(async () => {
    try {
      setDataLoading(true);
      console.log('[OBRIGAÇÕES] Carregando TODOS os dados do cliente:', {
        cnpj,
        clientId,
      });

      // Construir query params - SEM mês e ano para buscar tudo
      const queryParams = new URLSearchParams();
      if (clientId) queryParams.append('clientes_id', clientId);
      if (getCompanyId()) queryParams.append('company_id', getCompanyId());
      if (cnpj) queryParams.append('cnpj', cnpj);
      // NÃO adicionar ano e mês - buscar todos os dados
      
      const url = `${process.env.NEXT_PUBLIC_API_URL}/auditoria/analyses${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const headers = getAuthHeaders();

      // Chamada manual via fetch
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (response.status === 401) {
        // Não autorizado, redireciona para login
        console.log('❌ [OBRIGAÇÕES] 401 Unauthorized, token atual é inválido');
        setData(null);
        router.push('/login');
        return;
      }

      const rawData = await response.json();
      // Suporte para formato: { data: ..., error: ... }
      if (rawData.error) {
        console.error('[OBRIGAÇÕES] Erro ao buscar análises:', rawData.error);
        setData(null);
        return;
      }

      const analyses = rawData?.data || [];
      console.log('[OBRIGAÇÕES] Dados recebidos da API (TODOS):', rawData);
      console.log('[OBRIGAÇÕES] Quantidade total de análises:', analyses.length);

      // Armazenar todos os dados - o useEffect vai processar quando mudar
      setAllAnalyses(analyses);
    } catch (error) {
      console.error('Error loading analyses data:', error);
      setData(null);
    } finally {
      setDataLoading(false);
    }
  }, [router, cnpj, clientId]);

  // Função para processar os dados quando mês/ano mudarem
  useEffect(() => {
    if (allAnalyses.length > 0) {
      // Re-processar os dados quando o período selecionado mudar
      const filteredAnalyses = allAnalyses.filter(analysis => {
        const analysisMonth = parseInt(analysis.mes);
        const analysisYear = parseInt(analysis.ano);
        return analysisMonth === selectedMonth && analysisYear === selectedYear;
      });

      if (filteredAnalyses.length > 0) {
        const periodData = {};
        filteredAnalyses.forEach((analysis) => {
          // ... mesmo processamento de antes
          let parsedResumo = analysis.resumo;
          if (typeof analysis.resumo === 'string') {
            try {
              parsedResumo = JSON.parse(analysis.resumo);
            } catch (e) {
              parsedResumo = {};
            }
          }

          if (analysis.tipo === 'SPED_FISCAL') {
            if (parsedResumo && Object.keys(parsedResumo).length > 0) {
              const resumo = parsedResumo;
              periodData.sped_fiscal = {
                summary: {
                  totalRevenue: Number(resumo.faturamento) || 0,
                  totalSaidas: Number(resumo.faturamento) || 0,
                  icms: {
                    debits: typeof resumo.icms === 'object' && resumo.icms !== null 
                      ? Number((resumo.icms).debits) || 0 
                      : Number(resumo.icms) || 0,
                    credits: typeof resumo.icms === 'object' && resumo.icms !== null 
                      ? Number((resumo.icms).credits) || 0 
                      : 0
                  }
                }
              };
            } else {
              if (!periodData.sped_fiscal) {
                periodData.sped_fiscal = {
                  summary: {
                    totalRevenue: 0,
                    totalSaidas: 0,
                    icms: { debits: 0, credits: 0 }
                  }
                };
              }
            }
          } else if (analysis.tipo === 'SPED_CONTRIBUICOES') {
            if (parsedResumo && Object.keys(parsedResumo).length > 0) {
              const resumo = parsedResumo;
              periodData.sped_contribuicoes = {
                summary: {
                  totalRevenue: Number(resumo.totalRevenue) || 0,
                  pisCofins: {
                    pis: Number((resumo.pisCofins || {}).pis) || 0,
                    cofins: Number((resumo.pisCofins || {}).cofins) || 0
                  }
                }
              };
            } else {
              if (!periodData.sped_contribuicoes) {
                periodData.sped_contribuicoes = {
                  summary: {
                    totalRevenue: 0,
                    pisCofins: { pis: 0, cofins: 0 }
                  }
                };
              }
            }
          } else if (analysis.tipo === 'DCTF') {
            if (parsedResumo && Object.keys(parsedResumo).length > 0) {
              const resumo = parsedResumo;
              if (resumo.tributos) {
                const tributos = resumo.tributos;
                periodData.dctf = {
                  summary: {
                    pis: Number(tributos.pis) || 0,
                    cofins: Number(tributos.cofins) || 0,
                    irpj: Number(tributos.irpj) || 0,
                    csll: Number(tributos.csll) || 0
                  }
                };
              }
            }
          }
        });

        if (Object.keys(periodData).length > 0) {
          setData(periodData);
        } else {
          setData({
            sped_fiscal: {
              summary: {
                totalRevenue: 0,
                totalSaidas: 0,
                icms: { debits: 0, credits: 0 }
              }
            },
            sped_contribuicoes: {
              summary: {
                totalRevenue: 0,
                pisCofins: { pis: 0, cofins: 0 }
              }
            }
          });
        }
      } else {
        setData({
          sped_fiscal: {
            summary: {
              totalRevenue: 0,
              totalSaidas: 0,
              icms: { debits: 0, credits: 0 }
            }
          },
          sped_contribuicoes: {
            summary: {
              totalRevenue: 0,
              pisCofins: { pis: 0, cofins: 0 }
            }
          }
        });
      }
    }
  }, [allAnalyses, selectedMonth, selectedYear]);

  useEffect(() => {
    // Nova lógica simplificada
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(false);
    loadClientes();
    loadAllAnalyses();
  }, [router, loadClientes, loadAllAnalyses]); // Remover user/id/authLoading/isAuthenticated

  const handleExport = async (format) => {
    if (!data) return;

    try {
      let content;
      const fileName = `analise-fiscal-${selectedMonth}-${selectedYear}.${format}`;

      if (format === 'csv') {
        content = generateCSV(data);
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
      } else if (format === 'pdf') {
        // In a real app, you would generate a PDF here
        alert('Exportação para PDF será implementada em breve');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Erro ao exportar dados');
    }
  };

  const generateCSV = (data) => {
    const headers = ['Fonte', 'Descrição', 'Valor'];
    const rows = [headers.join(',')];

    if (data.sped_fiscal) {
      rows.push(
        `SPED Fiscal,Faturamento,${data.sped_fiscal.summary.totalRevenue}`,
        `SPED Fiscal,Total Saídas,${data.sped_fiscal.summary.totalSaidas}`,
        `SPED Fiscal,ICMS Débitos,${data.sped_fiscal.summary.icms.debits}`,
        `SPED Fiscal,ICMS Créditos,${data.sped_fiscal.summary.icms.credits}`
      );
    }

    if (data.sped_contribuicoes) {
      rows.push(
        `SPED Contribuições,Faturamento,${data.sped_contribuicoes.summary.totalRevenue}`,
        `SPED Contribuições,PIS,${data.sped_contribuicoes.summary.pisCofins.pis}`,
        `SPED Contribuições,COFINS,${data.sped_contribuicoes.summary.pisCofins.cofins}`
      );
    }

    return rows.join('\n');
  };

  const getMonthName = (month) => {
    const monthNames = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    return monthNames[month - 1];
  };

  if (loading || dataLoading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.centered}>
          <div className={styles.loaderSpin}></div>
          <h2 className={`${styles.sectionTitle} ${styles.mb2}`}>
            {loading ? 'Verificando autenticação...' : 'Carregando dados fiscais...'}
          </h2>
          <p className={styles.sectionSubTitle}>
            {loading
              ? 'Aguarde enquanto verificamos sua sessão'
              : `Buscando informações para ${getMonthName(selectedMonth)}/${selectedYear}`}
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <>
      <PrincipalSidebar />
      <div className={`${styles.titleWrapper} ${styles.wrapper}`}>
        <div>
          <h1 className={`${styles.sectionTitle} ${styles.textWhite}`}>
            Análise de Obrigações: {getMonthName(selectedMonth)}/{selectedYear}
          </h1>
          <p className={styles.sectionSubTitle}>
            Análise detalhada das obrigações fiscais do período
          </p>
        </div>

        {/* Filtros: Cliente sempre visível, Mês e Ano em dropdown - embaixo do subtítulo */}
        <div className={styles.filtersRow}>
          <div className={styles.filtersContainer}>
              {/* Dropdown de seleção de cliente - sempre visível */}
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>
                  <User size={16} className={styles.filterLabelIcon} />
                  Cliente
                </label>
                <select
                  value={clientId || ''}
                  onChange={(e) => handleClienteChange(e.target.value)}
                  className={styles.filterSelect}
                  disabled={loadingClientes}
                >
                  <option value="">
                    {loadingClientes 
                      ? 'Carregando...' 
                      : clientes.length === 0 
                        ? 'Nenhum cliente' 
                        : '-- Selecione --'}
                  </option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome} - {cliente.cnpj}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botão Filtros com dropdown */}
              <div className={styles.filterDropdownWrapper}>
                <label className={styles.filterLabel} style={{ visibility: 'hidden' }}>
                  <Filter size={16} className={styles.filterLabelIcon} />
                  Filtros
                </label>
                <button
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className={styles.filterToggleButton}
                >
                  <Filter size={16} className={styles.filterLabelIcon} />
                  Filtros
                  <ChevronDown 
                    size={16} 
                    className={`${styles.filterChevron} ${filtersOpen ? styles.filterChevronOpen : ''}`}
                  />
                </button>
                
                {/* Container dos filtros de mês e ano - aparece quando aberto */}
                {filtersOpen && (
                  <div className={styles.filterDropdownContent}>
                    {/* Dropdown de seleção de mês */}
                    <div className={`${styles.filterGroup} ${styles.filterSelectMonth}`}>
                      <label className={styles.filterLabel}>
                        <Calendar size={16} className={styles.filterLabelIcon} />
                        Mês
                      </label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className={styles.filterSelect}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                          <option key={m} value={m}>
                            {getMonthName(m)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Dropdown de seleção de ano */}
                    <div className={`${styles.filterGroup} ${styles.filterSelectYear}`}>
                      <label className={styles.filterLabel}>
                        Ano
                      </label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className={styles.filterSelect}
                      >
                        {/* Gerar lista de anos dos dados disponíveis ou últimos 5 anos */}
                        {(() => {
                          const currentYear = new Date().getFullYear();
                          const availableYears = allAnalyses.length > 0
                            ? [...new Set(allAnalyses.map(a => parseInt(a.ano)))].sort((a, b) => b - a)
                            : [];
                          const yearsToShow = availableYears.length > 0 
                            ? availableYears 
                            : Array.from({ length: 5 }, (_, i) => currentYear - i);
                          
                          return yearsToShow.map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.exportButtonsContainer}>
              <button
                onClick={() => handleExport('csv')}
                className={styles.actionButtonSecondary}
              >
                <Download className={styles.mb2} />
                Exportar CSV
              </button>
            </div>
          </div>
        </div>

        <div className={`${styles.flexCol} ${styles.centered}`}>
          <div className={styles.textCenter}>
            <h2 className={`${styles.sectionTitle} ${styles.textWhite}`}>
              Nenhum dado encontrado
            </h2>
            <p className={styles.sectionSubTitle}>
              {clientId 
                ? `Não existem dados fiscais para ${getMonthName(selectedMonth)}/${selectedYear}`
                : 'Selecione um cliente para visualizar os dados fiscais'}
            </p>
          </div>
        </div>
      </>
    );
  }

  const revenueComparisonData = [
    {
      id: '1',
      source: 'SPED Fiscal',
      description: 'Faturamento Total',
      declaredValue: data.sped_fiscal?.summary.totalRevenue || 0,
      expectedValue: data.sped_fiscal?.summary.totalRevenue || 0,
      difference: 0,
      severity: 'none',
    },
    {
      id: '2',
      source: 'SPED Contribuições',
      description: 'Faturamento Total',
      declaredValue: data.sped_contribuicoes?.summary.totalRevenue || 0,
      expectedValue: data.sped_fiscal?.summary.totalRevenue || 0,
      difference:
        (data.sped_contribuicoes?.summary.totalRevenue || 0) -
        (data.sped_fiscal?.summary.totalRevenue || 0),
      severity:
        Math.abs(
          (data.sped_contribuicoes?.summary.totalRevenue || 0) -
            (data.sped_fiscal?.summary.totalRevenue || 0)
        ) > 100
          ? 'high'
          : 'none',
    },
  ];

  // Debug para verificar os valores antes de exibir
  console.log('[OBRIGAÇÕES] Debug revenueComparisonData:', {
    sped_fiscal_totalRevenue: data.sped_fiscal?.summary.totalRevenue,
    sped_contribuicoes_totalRevenue: data.sped_contribuicoes?.summary.totalRevenue,
    revenueComparisonData: revenueComparisonData
  });

  const taxComparisonData = [
    {
      id: '1',
      source: 'SPED Fiscal',
      description: 'ICMS Total',
      declaredValue: data.sped_fiscal?.summary.icms.debits || 0,
      expectedValue: data.sped_fiscal?.summary.icms.debits || 0, // Pagamento - não disponível para ICMS
      difference: 0,
      severity: 'none',
    },
    {
      id: '2',
      source: 'SPED Contribuições',
      description: 'PIS',
      declaredValue: data.sped_contribuicoes?.summary.pisCofins.pis || 0,
      // Usar dados da DCTF como valor esperado
      expectedValue: data.dctf?.summary.pis || 0,
      difference: (data.dctf?.summary.pis || 0) - (data.sped_contribuicoes?.summary.pisCofins.pis || 0),
      severity:
        Math.abs((data.dctf?.summary.pis || 0) - (data.sped_contribuicoes?.summary.pisCofins.pis || 0)) > 1
          ? 'high'
          : 'none',
    },
    {
      id: '3',
      source: 'SPED Contribuições',
      description: 'COFINS',
      declaredValue: data.sped_contribuicoes?.summary.pisCofins.cofins || 0,
      // Usar dados da DCTF como valor esperado
      expectedValue: data.dctf?.summary.cofins || 0,
      difference: (data.dctf?.summary.cofins || 0) - (data.sped_contribuicoes?.summary.pisCofins.cofins || 0),
      severity:
        Math.abs((data.dctf?.summary.cofins || 0) - (data.sped_contribuicoes?.summary.pisCofins.cofins || 0)) > 1
          ? 'high'
          : 'none',
    },
  ];

  // Debug para verificar os valores do comparativo de impostos
  console.log('[OBRIGAÇÕES] Debug taxComparisonData:', {
    sped_contribuicoes_pis: data.sped_contribuicoes?.summary.pisCofins.pis,
    sped_contribuicoes_cofins: data.sped_contribuicoes?.summary.pisCofins.cofins,
    dctf_pis: data.dctf?.summary.pis,
    dctf_cofins: data.dctf?.summary.cofins,
    taxComparisonData: taxComparisonData
  });

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.wrapper}>
        <div className={styles.titleWrapper}>
          <div>
            <h1 className={`${styles.sectionTitle} ${styles.textWhite}`}>
              Análise de Obrigações: {getMonthName(selectedMonth)}/{selectedYear}
            </h1>
            <p className={styles.sectionSubTitle}>
              Análise detalhada das obrigações fiscais do período
            </p>
          </div>

          {/* Filtros: Cliente sempre visível, Mês e Ano em dropdown - embaixo do subtítulo */}
          <div className={styles.filtersRow}>
            <div className={styles.filtersContainer}>
                {/* Dropdown de seleção de cliente - sempre visível */}
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>
                    <User size={16} className={styles.filterLabelIcon} />
                    Cliente
                  </label>
                  <select
                    value={clientId || ''}
                    onChange={(e) => handleClienteChange(e.target.value)}
                    className={styles.filterSelect}
                    disabled={loadingClientes}
                  >
                    <option value="">
                      {loadingClientes 
                        ? 'Carregando...' 
                        : clientes.length === 0 
                          ? 'Nenhum cliente' 
                          : '-- Selecione --'}
                    </option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome} - {cliente.cnpj}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Botão Filtros com dropdown */}
                <div className={styles.filterDropdownWrapper}>
                  <label className={styles.filterLabel} style={{ visibility: 'hidden' }}>
                    <Filter size={16} className={styles.filterLabelIcon} />
                    Filtros
                  </label>
                  <button
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    className={styles.filterToggleButton}
                  >
                    <Filter size={16} className={styles.filterLabelIcon} />
                    Filtros
                    <ChevronDown 
                      size={16} 
                      className={`${styles.filterChevron} ${filtersOpen ? styles.filterChevronOpen : ''}`}
                    />
                  </button>
                  
                  {/* Container dos filtros de mês e ano - aparece quando aberto */}
                  {filtersOpen && (
                    <div className={styles.filterDropdownContent}>
                      {/* Dropdown de seleção de mês */}
                      <div className={`${styles.filterGroup} ${styles.filterSelectMonth}`}>
                        <label className={styles.filterLabel}>
                          <Calendar size={16} className={styles.filterLabelIcon} />
                          Mês
                        </label>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                          className={styles.filterSelect}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                            <option key={m} value={m}>
                              {getMonthName(m)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Dropdown de seleção de ano */}
                      <div className={`${styles.filterGroup} ${styles.filterSelectYear}`}>
                        <label className={styles.filterLabel}>
                          Ano
                        </label>
                        <select
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                          className={styles.filterSelect}
                        >
                          {/* Gerar lista de anos dos dados disponíveis ou últimos 5 anos */}
                          {(() => {
                            const currentYear = new Date().getFullYear();
                            const availableYears = allAnalyses.length > 0
                              ? [...new Set(allAnalyses.map(a => parseInt(a.ano)))].sort((a, b) => b - a)
                              : [];
                            const yearsToShow = availableYears.length > 0 
                              ? availableYears 
                              : Array.from({ length: 5 }, (_, i) => currentYear - i);
                            
                            return yearsToShow.map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ));
                          })()}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.exportButtonsContainer}>
                <button
                  onClick={() => handleExport('csv')}
                  className={styles.actionButtonSecondary}
                >
                  <Download className={styles.mb2} />
                  Exportar CSV
                </button>
              </div>
            </div>
          </div>

          <div className={styles.cardsGrid}>
            <div className={styles.cardBox}>
              <div className={`${styles.inlineFlex} ${styles.mb4}`}>
                <DollarSign className={styles.textSuccess} />
                <h2 className={`${styles.sectionTitle} ${styles.textPrimary}`}>Faturamento</h2>
              </div>
              <div className={`${styles.flexCol} ${styles.gap2}`}>
                <div className={styles.boxPaddedRounded}>
                  <span className={styles.sectionSubTitle}>
                    SPED Fiscal:
                  </span>
                  <span className={`${styles.sectionTitle} ${styles.textPrimary}`}>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(data.sped_fiscal?.summary.totalRevenue || 0)}
                  </span>
                </div>
                <div className={styles.boxPaddedRounded}>
                  <span className={styles.sectionSubTitle}>
                    SPED Contribuições:
                  </span>
                  <span className={`${styles.sectionTitle} ${styles.textPrimary}`}>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(data.sped_contribuicoes?.summary.totalRevenue || 0)}
                  </span>
                </div>
                <div className={styles.boxPaddedRounded}>
                  <span className={styles.sectionSubTitle}>
                    Total Saídas (SPED):
                  </span>
                  <span className={`${styles.sectionTitle} ${styles.textPrimary}`}>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(data.sped_fiscal?.summary.totalSaidas || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.cardBox}>
              <div className={`${styles.inlineFlex} ${styles.mb4}`}>
                <BarChart2 className={styles.textSuccess} />
                <h2 className={`${styles.sectionTitle} ${styles.textPrimary}`}>ICMS</h2>
              </div>
              <div className={`${styles.flexCol} ${styles.gap2}`}>
                <div className={styles.boxPaddedRounded}>
                  <span className={styles.sectionSubTitle}>
                    Débitos:
                  </span>
                  <span className={`${styles.sectionTitle} ${styles.textPrimary}`}>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(data.sped_fiscal?.summary.icms.debits || 0)}
                  </span>
                </div>
                <div className={styles.boxPaddedRounded}>
                  <span className={styles.sectionSubTitle}>
                    Créditos:
                  </span>
                  <span className={`${styles.sectionTitle} ${styles.textPrimary}`}>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(data.sped_fiscal?.summary.icms.credits || 0)}
                  </span>
                </div>
                <div className={styles.boxPaddedRounded}>
                  <span className={styles.sectionSubTitle}>
                    Saldo:
                  </span>
                  <span
                    className={`${styles.sectionTitle} ${
                      (data.sped_fiscal?.summary.icms.debits || 0) -
                        (data.sped_fiscal?.summary.icms.credits || 0) >
                      0
                        ? styles.textDanger
                        : styles.textSuccess
                    }`}
                  >
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(
                      (data.sped_fiscal?.summary.icms.debits || 0) -
                        (data.sped_fiscal?.summary.icms.credits || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.cardBox}>
              <div className={`${styles.inlineFlex} ${styles.mb4}`}>
                <BarChart2 className={styles.textSuccess} />
                <h2 className={`${styles.sectionTitle} ${styles.textPrimary}`}>PIS/COFINS</h2>
              </div>
              <div className={`${styles.flexCol} ${styles.gap2}`}>
                <div className={styles.boxPaddedRounded}>
                  <span className={styles.sectionSubTitle}>
                    Base de Cálculo:
                  </span>
                  <span className={`${styles.sectionTitle} ${styles.textPrimary}`}>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(data.sped_contribuicoes?.summary.totalRevenue || 0)}
                  </span>
                </div>
                <div className={styles.boxPaddedRounded}>
                  <span className={styles.sectionSubTitle}>PIS:</span>

                  <span className={`${styles.sectionTitle} ${styles.textPrimary}`}>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(
                      data.sped_contribuicoes?.summary.pisCofins.pis || 0
                    )}
                  </span>
                </div>
                <div className={styles.boxPaddedRounded}>
                  <span className={styles.sectionSubTitle}>
                    COFINS:
                  </span>
                  <span className={`${styles.sectionTitle} ${styles.textPrimary}`}>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(
                      data.sped_contribuicoes?.summary.pisCofins.cofins || 0
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.spaceY8}>
            <ComparisonTable
              title="Comparativo de Faturamento"
              items={revenueComparisonData}
            />

            <ComparisonTable
              title="Comparativo de Impostos"
              items={taxComparisonData}
            />

            {/* Mensagem se não houver dados de pagamento */}
            {paymentComparisons.length === 0 && data.sped_contribuicoes && (
              <div className={styles.cardBox}>
                <div className={`${styles.boxPaddedRounded} ${styles.justifyBetween}`}>
                  <h3 className={styles.sectionTitle}>
                    Dados de Pagamento
                  </h3>
                </div>
                <div className={`${styles.boxPaddedRounded} ${styles.textCenter}`}>
                  <p className={styles.sectionSubTitle}>
                    Nenhum dado de pagamento encontrado para este período.
                  </p>
                  <p className={styles.sectionSubTitle}>
                    Faça upload do relatório de pagamentos do eCAC na página de
                    Análise de Arquivos para visualizar a comparação entre os
                    valores declarados e pagos.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
    </>
  );
};

export default ObligationsAnalysis;

