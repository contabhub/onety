import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Download, ArrowLeft, Calendar, User } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ComparisonTable from '../../components/auditoria/ComparisonTable';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';
import styles from '../../styles/auditoria/consolidado.module.css';

// Função auxiliar para obter o nome do mês
const getMonthName = (month) => {
  const monthNames = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  return monthNames[month - 1];
};

export default function ConsolidadoPage() {
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear()
  );
  const [consolidatedData, setConsolidatedData] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [showPisComparisonChart, setShowPisComparisonChart] = useState(true);
  const [showCofinsComparisonChart, setShowCofinsComparisonChart] = useState(true);
  const [showIrpjComparisonChart, setShowIrpjComparisonChart] = useState(true);
  const [showCsllComparisonChart, setShowCsllComparisonChart] = useState(true);
  const [showIpiComparisonChart, setShowIpiComparisonChart] = useState(true);
  const [issRetidoMensal, setIssRetidoMensal] = useState([]);
  const [temIssRetido, setTemIssRetido] = useState(false);
  const [userData, setUserData] = useState({});
  const [empresaReady, setEmpresaReady] = useState(false); // true quando userData carregado
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const router = useRouter();
  const { query } = router;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }
      try {
        const raw = localStorage.getItem('userData');
        setUserData(raw ? JSON.parse(raw) : {});
      } catch {
        setUserData({});
      }
      setEmpresaReady(true);
    }
  }, [router]);

  const EmpresaId = userData?.EmpresaId;
  const EmpresaNome = userData?.EmpresaNome;
  // const EmpresaCnpj = userData.EmpresaCnpj; // Descomente se o backend já inserir isso no login

  // Inicializar cliente selecionado dos query params
  useEffect(() => {
    if (query.client_id) {
      setSelectedClientId(query.client_id);
    }
  }, [query.client_id]);

  // Função para carregar lista de clientes
  const loadClientes = useCallback(async () => {
    if (typeof window === 'undefined' || !EmpresaId) return;
    
    try {
      setLoadingClientes(true);
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const url = `${API_URL}/auditoria/regime-normal/clientes?company_id=${EmpresaId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const responseData = await response.json();
        setClientes(responseData.data || []);
      } else {
        console.error('[CONSOLIDADO] Erro ao buscar clientes:', response.status, response.statusText);
      }
    } catch (err) {
      console.error('[CONSOLIDADO] Erro ao carregar clientes:', err);
    } finally {
      setLoadingClientes(false);
    }
  }, [EmpresaId, router]);

  // Função para lidar com mudança de cliente selecionado
  const handleClienteChange = (clientId) => {
    setSelectedClientId(clientId);
    const newQuery = {
      ...query,
      client_id: clientId || undefined,
    };
    
    if (!clientId) {
      delete newQuery.client_id;
    }

    router.push({
      pathname: router.pathname,
      query: newQuery,
    });
  };

  // --- NOVA BUSCA DOS ANOS ---
  const loadAvailableYears = useCallback(async () => {
    if (!selectedClientId) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const regimeResponse = await fetch(`${API_URL}/auditoria/regime-normal?clientes_id=${selectedClientId}`, { headers: { Authorization: `Bearer ${token}` } });
      const simplesResponse = await fetch(`${API_URL}/auditoria/simples-nacional?clientes_id=${selectedClientId}`, { headers: { Authorization: `Bearer ${token}` } });
      let allYears = [];
      if (regimeResponse.ok) {
        const regimeData = await regimeResponse.json();
        if (regimeData.data && Array.isArray(regimeData.data)) {
          allYears = [...allYears, ...regimeData.data.map((item) => item.ano).filter(Boolean)];
        }
      }
      if (simplesResponse.ok) {
        const simplesData = await simplesResponse.json();
        if (simplesData.data && Array.isArray(simplesData.data)) {
          allYears = [...allYears, ...simplesData.data.map((item) => item.ano).filter(Boolean)];
        }
      }
      if (allYears.length > 0) {
        const uniqueYears = [...new Set(allYears)].sort((a, b) => b - a);
        setYears(uniqueYears);
        if (uniqueYears.length > 0) setSelectedYear(uniqueYears[0]);
      }
    } catch {}
  }, [selectedClientId, router]);

  const loadConsolidatedData = useCallback(async () => {
    if (!selectedClientId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const regimeResponse = await fetch(`${API_URL}/auditoria/regime-normal?clientes_id=${selectedClientId}&ano=${selectedYear}`, { headers: { Authorization: `Bearer ${token}` } });
      const simplesResponse = await fetch(`${API_URL}/auditoria/simples-nacional?clientes_id=${selectedClientId}&ano=${selectedYear}`, { headers: { Authorization: `Bearer ${token}` } });
      // Obs: CNPJ não foi encontrado em userData. Se necessário, buscar via API de empresas no futuro.
      // let EmpresaCnpj = userData.EmpresaCnpj; // Descomente/ajuste caso adicione isso no backend.
      let monthlyPayments = [];
      // if (EmpresaCnpj) {
      //   const pagamentosResponse = await fetch(`${API_URL}/auditoria/pagamentos-ecac?empresa_id=${EmpresaId}&ano=${selectedYear}`, { headers: { Authorization: `Bearer ${token}` } });
      //   if (pagamentosResponse.ok) {
      //     const pagamentosData = await pagamentosResponse.json();
      //     monthlyPayments = pagamentosData.data || [];
      //   }
      // }
      // Sem CNPJ, só segue com os dados das análises!
      let allAnalyses = [];
      if (regimeResponse.ok) {
        const regimeData = await regimeResponse.json();
        if (regimeData.data && Array.isArray(regimeData.data)) allAnalyses = [...allAnalyses, ...regimeData.data];
      }
      if (simplesResponse.ok) {
        const simplesData = await simplesResponse.json();
        if (simplesData.data && Array.isArray(simplesData.data)) allAnalyses = [...allAnalyses, ...simplesData.data];
      }

      // Processar dados mensais
      const monthlyDataMap = {};
      let totalFaturamentoSpedFiscal = 0;
      let totalFaturamentoSpedContribuicoes = 0;
      let totalPisDeclarado = 0;
      let totalCofinsDeclarado = 0;
      let totalIpi = 0;

      allAnalyses.forEach((analysis) => {
        // Filtrar apenas análises do ano selecionado
        const analysisYear = parseInt(analysis.ano);
        if (analysisYear !== selectedYear) return;
        
        const mes = parseInt(analysis.mes) || 1;
        const mesKey = mes.toString().padStart(2, '0');
        
        if (!monthlyDataMap[mesKey]) {
          monthlyDataMap[mesKey] = {
            month: getMonthName(mes),
            mes: mesKey,
            pis: 0,
            cofins: 0,
            dctf_pis: 0,
            dctf_cofins: 0,
            dctf_irpj: 0,
            dctf_csll: 0,
            darf_pis: 0,
            darf_cofins: 0,
            darf_irpj: 0,
            darf_csll: 0,
            ipi: 0,
            dctf_ipi: 0,
            darf_ipi: 0,
            blocoH: 0,
            blocoK: 0,
            faturamento_sped_fiscal: 0,
            faturamento_sped_contribuicoes: 0,
          };
        }

        // Parse do resumo se for string
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
            const faturamento = Number(resumo.faturamento) || 0;
            monthlyDataMap[mesKey].faturamento_sped_fiscal += faturamento;
            totalFaturamentoSpedFiscal += faturamento;
            
            if (resumo.ipi) {
              const ipiValue = Number(resumo.ipi) || 0;
              monthlyDataMap[mesKey].ipi += ipiValue;
              totalIpi += ipiValue;
            }
            
            if (resumo.blocoH) {
              monthlyDataMap[mesKey].blocoH += Number(resumo.blocoH) || 0;
            }
            
            if (resumo.blocoK) {
              monthlyDataMap[mesKey].blocoK += Number(resumo.blocoK) || 0;
            }
          }
        } else if (analysis.tipo === 'SPED_CONTRIBUICOES') {
          if (parsedResumo && Object.keys(parsedResumo).length > 0) {
            const resumo = parsedResumo;
            const faturamento = Number(resumo.totalRevenue) || 0;
            monthlyDataMap[mesKey].faturamento_sped_contribuicoes += faturamento;
            totalFaturamentoSpedContribuicoes += faturamento;
            
            if (resumo.pisCofins) {
              const pis = Number(resumo.pisCofins.pis) || 0;
              const cofins = Number(resumo.pisCofins.cofins) || 0;
              monthlyDataMap[mesKey].pis += pis;
              monthlyDataMap[mesKey].cofins += cofins;
              totalPisDeclarado += pis;
              totalCofinsDeclarado += cofins;
            }
          }
        } else if (analysis.tipo === 'DCTF') {
          if (parsedResumo && Object.keys(parsedResumo).length > 0) {
            const resumo = parsedResumo;
            if (resumo.tributos) {
              const tributos = resumo.tributos;
              monthlyDataMap[mesKey].dctf_pis += Number(tributos.pis) || 0;
              monthlyDataMap[mesKey].dctf_cofins += Number(tributos.cofins) || 0;
              monthlyDataMap[mesKey].dctf_irpj += Number(tributos.irpj) || 0;
              monthlyDataMap[mesKey].dctf_csll += Number(tributos.csll) || 0;
              if (tributos.ipi) {
                monthlyDataMap[mesKey].dctf_ipi += Number(tributos.ipi) || 0;
              }
            }
          }
        }
      });

      // Processar pagamentos DARF dos monthlyPayments
      monthlyPayments.forEach((payment) => {
        // Filtrar apenas pagamentos do ano selecionado
        const paymentYear = parseInt(payment.ano);
        if (paymentYear !== selectedYear) return;
        
        const mes = parseInt(payment.mes) || 1;
        const mesKey = mes.toString().padStart(2, '0');
        
        if (!monthlyDataMap[mesKey]) {
          monthlyDataMap[mesKey] = {
            month: getMonthName(mes),
            mes: mesKey,
            pis: 0,
            cofins: 0,
            dctf_pis: 0,
            dctf_cofins: 0,
            dctf_irpj: 0,
            dctf_csll: 0,
            darf_pis: 0,
            darf_cofins: 0,
            darf_irpj: 0,
            darf_csll: 0,
            ipi: 0,
            dctf_ipi: 0,
            darf_ipi: 0,
            blocoH: 0,
            blocoK: 0,
            faturamento_sped_fiscal: 0,
            faturamento_sped_contribuicoes: 0,
          };
        }

        if (payment.pis) monthlyDataMap[mesKey].darf_pis += Number(payment.pis) || 0;
        if (payment.cofins) monthlyDataMap[mesKey].darf_cofins += Number(payment.cofins) || 0;
        if (payment.irpj) monthlyDataMap[mesKey].darf_irpj += Number(payment.irpj) || 0;
        if (payment.csll) monthlyDataMap[mesKey].darf_csll += Number(payment.csll) || 0;
        if (payment.ipi) monthlyDataMap[mesKey].darf_ipi += Number(payment.ipi) || 0;
      });

      // Converter monthlyDataMap para array ordenado
      const monthlyDataArray = Object.keys(monthlyDataMap)
        .sort()
        .map(key => monthlyDataMap[key]);
      
      setMonthlyData(monthlyDataArray);

      // Calcular dados consolidados
      const totalPisPago = monthlyDataArray.reduce((sum, m) => sum + (m.darf_pis || 0), 0);
      const totalCofinsPago = monthlyDataArray.reduce((sum, m) => sum + (m.darf_cofins || 0), 0);

      const consolidated = {
        faturamento: {
          sped_fiscal: totalFaturamentoSpedFiscal,
          sped_contribuicoes: totalFaturamentoSpedContribuicoes,
          diferenca: totalFaturamentoSpedContribuicoes - totalFaturamentoSpedFiscal,
        },
        pis: {
          declarado: totalPisDeclarado,
          pago: totalPisPago,
          diferenca: totalPisPago - totalPisDeclarado,
        },
        cofins: {
          declarado: totalCofinsDeclarado,
          pago: totalCofinsPago,
          diferenca: totalCofinsPago - totalCofinsDeclarado,
        },
        ipi: totalIpi,
      };

      setConsolidatedData(consolidated);
    } catch (error) {
      console.error('[CONSOLIDADO] Erro ao carregar dados consolidados:', error);
      setConsolidatedData(null);
      setMonthlyData([]);
    } finally { 
      setLoading(false); 
    }
  }, [selectedClientId, selectedYear, router]);

  const loadIssRetidoMensal = useCallback(async () => {
    if (!selectedClientId) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${API_URL}/auditoria/pagamentos-ecac-iss?clientes_id=${selectedClientId}&ano=${selectedYear}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { setIssRetidoMensal([]); setTemIssRetido(false); return; }
      const responseData = await response.json();
      const dadosIss = responseData.data || [];
      setIssRetidoMensal(dadosIss);
      setTemIssRetido(dadosIss.length > 0);
    } catch {
      setIssRetidoMensal([]);
      setTemIssRetido(false);
    }
  }, [selectedClientId, selectedYear, router]);

  useEffect(() => {
    if (empresaReady && EmpresaId) {
      setLoading(false);
      loadClientes();
    }
  }, [empresaReady, EmpresaId, loadClientes]);

  useEffect(() => {
    if (empresaReady && EmpresaId && selectedClientId) {
      loadAvailableYears();
    }
  }, [empresaReady, EmpresaId, selectedClientId, loadAvailableYears]);

  useEffect(() => {
    if (empresaReady && EmpresaId && selectedClientId) {
      loadConsolidatedData();
      loadIssRetidoMensal();
    }
  }, [empresaReady, EmpresaId, selectedClientId, selectedYear, loadConsolidatedData, loadIssRetidoMensal]);

  const handleExport = async (format) => {
    if (!consolidatedData) return;

    try {
      let content;
      const fileName = `consolidado-fiscal-${selectedYear}.${format}`;

      if (format === 'csv') {
        content = generateCSV(consolidatedData);
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
      } else if (format === 'pdf') {
        if (typeof window !== 'undefined') {
          const html2pdf = (await import('html2pdf.js')).default;
          const element = document.getElementById('pdf-content');
          if (element) {
            element.classList.add('pdf-export-content');
            html2pdf()
              .set({
                margin: 1,
                filename: fileName,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
              })
              .from(element)
              .save()
              .then(() => {
                element.classList.remove('pdf-export-content');
              });
          }
        } else {
          console.warn('Exportação PDF só pode ser feita no client/browser');
        }
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Erro ao exportar dados');
    }
  };

  const generateCSV = (data) => {
    const headers = ['Tipo', 'Valor Declarado', 'Valor Pago', 'Diferença'];
    const rows = [headers.join(',')];

    rows.push(
      `Faturamento SPED Fiscal,${data.faturamento.sped_fiscal},,-`,
      `Faturamento SPED Contribuições,${data.faturamento.sped_contribuicoes},,-`,
      `Diferença Faturamento,${data.faturamento.diferenca},,-`,
      `PIS,${data.pis.declarado},${data.pis.pago},${data.pis.diferenca}`,
      `COFINS,${data.cofins.declarado},${data.cofins.pago},${data.cofins.diferenca}`,
      `IPI,${data.ipi},,-`
    );

    // Dados de ISS retido por mês
    if (temIssRetido && issRetidoMensal.length > 0) {
      rows.push(''); // Linha em branco
      rows.push('ISS Retido por Mês');
      rows.push('Mês,Ano,Valor ISS Retido (R$),Quantidade de Notas');
      
      issRetidoMensal.forEach(item => {
        rows.push(`${item.mes},${item.ano},${item.valor_iss_retido.toFixed(2)},${item.quantidade_notas}`);
      });
      
      // Adicionar total
      const totalValor = issRetidoMensal.reduce((sum, item) => sum + item.valor_iss_retido, 0);
      const totalNotas = issRetidoMensal.reduce((sum, item) => sum + item.quantidade_notas, 0);
      rows.push(`TOTAL,,${totalValor.toFixed(2)},${totalNotas}`);
    }

    return rows.join('\n');
  };

  if (loading) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.loadingPage}>
          <div className={styles.loadingCard}>
            <div className={styles.spinner}></div>
            <h2 className={styles.loadingTitle}>
              {loading ? 'Verificando autenticação...' : 'Carregando dados fiscais...'}
            </h2>
            <p className={styles.loadingSubtitle}>
              Aguarde enquanto carregamos os dados consolidados
            </p>
          </div>
        </div>
      </>
    );
  }

  // Verificar se há empresa no userData
  if (!EmpresaId) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.emptyCompanyWrapper}>
          <div className={styles.emptyCompanyCard}>
            <h2 className={styles.emptyCompanyTitle}>
              Selecione uma empresa primeiro
            </h2>
            <p className={styles.emptyCompanyText}>
              Acesse o menu de empresas para selecionar uma empresa e visualizar os dados consolidados.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className={styles.emptyCompanyButton}
            >
              Selecionar Empresa
            </button>
          </div>
        </div>
      </>
    );
  }

  // Obter nome do cliente selecionado
  const selectedCliente = clientes.find(c => c.id.toString() === selectedClientId?.toString());
  const clienteNome = selectedCliente?.nome || selectedCliente?.nome_fantasia || selectedCliente?.razao_social || '';

  const revenueComparisonData = [
    {
      id: '1',
      source: 'SPED Fiscal',
      description: 'Faturamento Total',
      declaredValue: consolidatedData?.faturamento.sped_fiscal || 0,
      expectedValue: consolidatedData?.faturamento.sped_fiscal || 0,
      difference: 0,
      severity: 'none',
    },
    {
      id: '2',
      source: 'SPED Contribuições',
      description: 'Faturamento Total',
      declaredValue: consolidatedData?.faturamento.sped_contribuicoes || 0,
      expectedValue: consolidatedData?.faturamento.sped_fiscal || 0,
      difference: consolidatedData?.faturamento.diferenca || 0,
      severity: Math.abs(consolidatedData?.faturamento.diferenca || 0) > 100 ? 'high' : 'none',
    },
  ];

  // Calcular totais da DCTF a partir dos dados mensais
  const totalPisDctf = monthlyData.reduce((sum, month) => sum + (month.dctf_pis || 0), 0);
  const totalCofinsDctf = monthlyData.reduce((sum, month) => sum + (month.dctf_cofins || 0), 0);

  const taxComparisonData = [
    {
      id: '1',
      source: 'SPED Contribuições',
      description: 'PIS',
      declaredValue: consolidatedData?.pis.declarado || 0,
      expectedValue: totalPisDctf,
      difference: totalPisDctf - (consolidatedData?.pis.declarado || 0),
      severity: Math.abs(totalPisDctf - (consolidatedData?.pis.declarado || 0)) > 1 ? 'high' : 'none',
    },
    {
      id: '2',
      source: 'SPED Contribuições',
      description: 'COFINS',
      declaredValue: consolidatedData?.cofins.declarado || 0,
      expectedValue: totalCofinsDctf,
      difference: totalCofinsDctf - (consolidatedData?.cofins.declarado || 0),
      severity: Math.abs(totalCofinsDctf - (consolidatedData?.cofins.declarado || 0)) > 1 ? 'high' : 'none',
    },
  ];

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.page}>
        <div className={styles.container}>
          <div id="pdf-content" className={styles.pdfContent}>
            <div className={styles.headerRow}>
              <div>
                <div className={styles.headerTitle}>
                  <h1 className={styles.pageTitle}>
                    Consolidado Anual
                    <span className={styles.yearBadge}>
                      {selectedYear}
                    </span>
                  </h1>
                  
                  <p className={styles.companyName}>
                    {clienteNome || EmpresaNome || 'Empresa'}
                  </p>
                  {selectedCliente && (
                    <p className={styles.companyMeta}>
                      CNPJ: {selectedCliente.cnpj || selectedCliente.cpf_cnpj || 'N/A'}
                    </p>
                  )}
                </div>
                <p className={styles.sectionSubtitle}>
                  Análise consolidada das obrigações fiscais do período
                </p>
              </div>

              <div className={styles.headerActions}>
                {/* Dropdown de seleção de cliente */}
                <div className={styles.selectWrapper} style={{ minWidth: '250px', marginRight: '1rem' }}>
                  <label htmlFor="cliente" className={styles.srOnly}>
                    Cliente
                  </label>
                  <div className={styles.selectIcon}>
                    <User className={styles.buttonIcon} />
                  </div>
                  <select
                    id="cliente"
                    name="cliente"
                    className={styles.yearSelect}
                    value={selectedClientId || ''}
                    onChange={(e) => handleClienteChange(e.target.value)}
                    disabled={loadingClientes}
                  >
                    <option value="">
                      {loadingClientes 
                        ? 'Carregando...' 
                        : clientes.length === 0 
                          ? 'Nenhum cliente' 
                          : '-- Selecione um cliente --'}
                    </option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome || cliente.nome_fantasia || cliente.razao_social} - {cliente.cnpj || cliente.cpf_cnpj}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.selectWrapper}>
                  <label htmlFor="year" className={styles.srOnly}>
                    Ano
                  </label>
                  <div className={styles.selectIcon}>
                    <Calendar className={styles.buttonIcon} />
                  </div>
                  <select
                    id="year"
                    name="year"
                    className={styles.yearSelect}
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    disabled={!selectedClientId}
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => handleExport('pdf')}
                  className={styles.primaryButton}
                >
                  <Download className={styles.buttonIcon} />
                  Exportar PDF
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className={styles.secondaryButton}
                >
                  <Download className={styles.buttonIcon} />
                  Exportar CSV
                </button>
              </div>
            </div>

            {consolidatedData ? (
              <div className={styles.sectionStack}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      Resumo Anual {selectedYear}
                    </h3>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.summaryGrid}>
                      <div className={styles.summaryCard}>
                        <h4 className={styles.summaryLabel}>
                          Faturamento Total
                        </h4>
                        <p className={styles.summaryValue}>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(consolidatedData.faturamento.sped_contribuicoes)}
                        </p>
                      </div>
                      <div className={styles.summaryCard}>
                        <h4 className={styles.summaryLabel}>
                          PIS Total
                        </h4>
                        <p className={styles.summaryValue}>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(consolidatedData.pis.declarado)}
                        </p>
                      </div>
                      <div className={styles.summaryCard}>
                        <h4 className={styles.summaryLabel}>
                          COFINS Total
                        </h4>
                        <p className={styles.summaryValue}>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(consolidatedData.cofins.declarado)}
                        </p>
                      </div>
                      <div className={styles.summaryCard}>
                        <h4 className={styles.summaryLabel}>
                          IPI do SPED Fiscal
                        </h4>
                        <p className={styles.summaryValue}>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(consolidatedData.ipi)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <ComparisonTable
                  title="Comparativo de Faturamento Anual"
                  items={revenueComparisonData}
                />

                <ComparisonTable
                  title="Comparativo de Impostos Anual"
                  items={taxComparisonData}
                />

                {/* Gráfico de Comparação de PIS */}
                {monthlyData.length > 0 && (
                  <div className={`${styles.chartCard} ${styles.sectionSpacing}`}>
                    <div className={styles.chartHeader}>
                      <h3 className={styles.chartTitle}>
                        Comparativo Mensal de PIS: SPED vs DCTF vs DARF ({selectedYear})
                      </h3>
                      <button
                        onClick={() => setShowPisComparisonChart(!showPisComparisonChart)}
                        className={styles.toggleButton}
                      >
                        {showPisComparisonChart ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                    {showPisComparisonChart && (
                      <div className={styles.chartBody}>
                        <div className={styles.chartContainer}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={monthlyData}
                              margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis
                                tickFormatter={(value) =>
                                  new Intl.NumberFormat('pt-BR', {
                                    notation: 'compact',
                                    compactDisplay: 'short',
                                    currency: 'BRL',
                                  }).format(value)
                                }
                              />
                              <Tooltip
                                formatter={(value) =>
                                  new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  }).format(Number(value))
                                }
                              />
                              <Legend />
                              <Bar
                                name="PIS SPED"
                                dataKey="pis"
                                fill="#4CAF50"
                              />
                              <Bar 
                                name="PIS DCTF" 
                                dataKey="dctf_pis" 
                                fill="#FF9800" 
                              />
                              <Bar 
                                name="PIS DARF" 
                                dataKey="darf_pis" 
                                fill="#E91E63" 
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Gráfico de Comparação de COFINS */}
                {monthlyData.length > 0 && (
                  <div className={`${styles.chartCard} ${styles.sectionSpacing}`}>
                    <div className={styles.chartHeader}>
                      <h3 className={styles.chartTitle}>
                        Comparativo Mensal de COFINS: SPED vs DCTF vs DARF ({selectedYear})
                      </h3>
                      <button
                        onClick={() => setShowCofinsComparisonChart(!showCofinsComparisonChart)}
                        className={styles.toggleButton}
                      >
                        {showCofinsComparisonChart ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                    {showCofinsComparisonChart && (
                      <div className={styles.chartBody}>
                        <div className={styles.chartContainer}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={monthlyData}
                              margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis
                                tickFormatter={(value) =>
                                  new Intl.NumberFormat('pt-BR', {
                                    notation: 'compact',
                                    compactDisplay: 'short',
                                    currency: 'BRL',
                                  }).format(value)
                                }
                              />
                              <Tooltip
                                formatter={(value) =>
                                  new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  }).format(Number(value))
                                }
                              />
                              <Legend />
                              <Bar
                                name="COFINS SPED"
                                dataKey="cofins"
                                fill="#2196F3"
                              />
                              <Bar 
                                name="COFINS DCTF" 
                                dataKey="dctf_cofins" 
                                fill="#FF9800" 
                              />
                              <Bar 
                                name="COFINS DARF" 
                                dataKey="darf_cofins" 
                                fill="#E91E63" 
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Gráfico de Comparação de IRPJ */}
                {monthlyData.length > 0 && (
                  <div className={`${styles.chartCard} ${styles.sectionSpacing}`}>
                    <div className={styles.chartHeader}>
                      <h3 className={styles.chartTitle}>
                        Comparativo Mensal de IRPJ: DCTF vs DARF ({selectedYear})
                      </h3>
                      <button
                        onClick={() => setShowIrpjComparisonChart(!showIrpjComparisonChart)}
                        className={styles.toggleButton}
                      >
                        {showIrpjComparisonChart ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                    {showIrpjComparisonChart && (
                      <div className={styles.chartBody}>
                        <div className={styles.chartContainer}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={monthlyData}
                              margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis
                                tickFormatter={(value) =>
                                  new Intl.NumberFormat('pt-BR', {
                                    notation: 'compact',
                                    compactDisplay: 'short',
                                    currency: 'BRL',
                                  }).format(value)
                                }
                              />
                              <Tooltip
                                formatter={(value) =>
                                  new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  }).format(Number(value))
                                }
                              />
                              <Legend />
                              <Bar
                                name="IRPJ DCTF"
                                dataKey="dctf_irpj"
                                fill="#9C27B0"
                              />
                              <Bar 
                                name="IRPJ DARF" 
                                dataKey="darf_irpj" 
                                fill="#E91E63" 
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Gráfico de Comparação de CSLL */}
                {monthlyData.length > 0 && (
                  <div className={`${styles.chartCard} ${styles.sectionSpacing}`}>
                    <div className={styles.chartHeader}>
                      <h3 className={styles.chartTitle}>
                        Comparativo Mensal de CSLL: DCTF vs DARF ({selectedYear})
                      </h3>
                      <button
                        onClick={() => setShowCsllComparisonChart(!showCsllComparisonChart)}
                        className={styles.toggleButton}
                      >
                        {showCsllComparisonChart ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                    {showCsllComparisonChart && (
                      <div className={styles.chartBody}>
                        <div className={styles.chartContainer}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={monthlyData}
                              margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis
                                tickFormatter={(value) =>
                                  new Intl.NumberFormat('pt-BR', {
                                    notation: 'compact',
                                    compactDisplay: 'short',
                                    currency: 'BRL',
                                  }).format(value)
                                }
                              />
                              <Tooltip
                                formatter={(value) =>
                                  new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  }).format(Number(value))
                                }
                              />
                              <Legend />
                              <Bar
                                name="CSLL DCTF"
                                dataKey="dctf_csll"
                                fill="#673AB7"
                              />
                              <Bar 
                                name="CSLL DARF" 
                                dataKey="darf_csll" 
                                fill="#E91E63" 
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Gráfico de Comparação de IPI */}
                {monthlyData.length > 0 && (
                  <div className={`${styles.chartCard} ${styles.sectionSpacing}`}>
                    <div className={styles.chartHeader}>
                      <h3 className={styles.chartTitle}>
                        Comparativo Mensal de IPI: SPED vs DCTF vs DARF ({selectedYear})
                      </h3>
                      <button
                        onClick={() => setShowIpiComparisonChart(!showIpiComparisonChart)}
                        className={styles.toggleButton}
                      >
                        {showIpiComparisonChart ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                    {showIpiComparisonChart && (
                      <div className={styles.chartBody}>
                        <div className={styles.chartContainer}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={monthlyData}
                              margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis
                                tickFormatter={(value) =>
                                  new Intl.NumberFormat('pt-BR', {
                                    notation: 'compact',
                                    compactDisplay: 'short',
                                    currency: 'BRL',
                                  }).format(value)
                                }
                              />
                              <Tooltip
                                formatter={(value) =>
                                  new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  }).format(Number(value))
                                }
                              />
                              <Legend />
                              <Bar
                                name="IPI SPED"
                                dataKey="ipi"
                                fill="#607D8B"
                              />
                              <Bar 
                                name="IPI DCTF" 
                                dataKey="dctf_ipi" 
                                fill="#FF9800" 
                              />
                              <Bar 
                                name="IPI DARF" 
                                dataKey="darf_ipi" 
                                fill="#E91E63" 
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tabela de ISS Retido por Mês */}
                {temIssRetido && issRetidoMensal.length > 0 && (
                  <div className={`${styles.tableCard} ${styles.sectionSpacing}`}>
                    <div className={styles.tableHeader}>
                      <div className={styles.tableHeaderInfo}>
                        <div className={styles.tableHeaderIcon}>
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className={styles.tableHeaderTitle}>
                          <h3>ISS Retido por Mês ({selectedYear})</h3>
                          <p>Valores de ISS retido nas notas fiscais de serviço</p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr className={styles.tableHeadRow}>
                            <th className={styles.tableHeadCell}>Mês</th>
                            <th className={styles.tableHeadCell}>Ano</th>
                            <th className={styles.tableHeadCell}>Valor ISS Retido (R$)</th>
                            <th className={styles.tableHeadCell}>Quantidade de Notas</th>
                          </tr>
                        </thead>
                        <tbody className={styles.tableBody}>
                          {issRetidoMensal.map((item, idx) => (
                            <tr key={idx} className={styles.tableRow}>
                              <td className={`${styles.tableCell} ${styles.tableCellStrong}`}>{item.mes}</td>
                              <td className={styles.tableCell}>{item.ano}</td>
                              <td className={`${styles.tableCell} ${styles.tableCellStrong}`}>
                                R$ {item.valor_iss_retido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className={styles.tableCell}>{item.quantidade_notas}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className={styles.tableFooter}>
                          <tr>
                            <td colSpan={2} className={`${styles.tableCell} ${styles.tableCellStrong}`}>Total</td>
                            <td className={styles.tableFooterCell}>
                              R$ {issRetidoMensal.reduce((sum, item) => sum + item.valor_iss_retido, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className={`${styles.tableCell} ${styles.tableCellStrong}`}>
                              {issRetidoMensal.reduce((sum, item) => sum + item.quantidade_notas, 0)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Gráfico de Comparação do Bloco H do SPED Fiscal */}
                {monthlyData.length > 0 && (
                  <div className={`${styles.chartCard} ${styles.sectionSpacing}`}>
                    <div className={styles.chartHeader}>
                      <h3 className={styles.chartTitle}>
                        Valores Mensais do Bloco H do SPED Fiscal ({selectedYear})
                      </h3>
                    </div>
                    <div className={styles.chartBody}>
                      <div className={styles.chartContainer}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={monthlyData}
                            margin={{
                              top: 20,
                              right: 30,
                              left: 20,
                              bottom: 5,
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis
                              tickFormatter={(value) =>
                                new Intl.NumberFormat('pt-BR', {
                                  notation: 'compact',
                                  compactDisplay: 'short',
                                  currency: 'BRL',
                                }).format(value)
                              }
                            />
                            <Tooltip
                              formatter={(value) =>
                                new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                }).format(Number(value))
                              }
                            />
                            <Legend />
                            <Bar
                              name="Bloco H"
                              dataKey="blocoH"
                              fill="#00BCD4"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {/* Gráfico de Comparação do Bloco K do SPED Fiscal */}
                {monthlyData.length > 0 && (
                  <div className={`${styles.chartCard} ${styles.sectionSpacing}`}>
                    <div className={styles.chartHeader}>
                      <h3 className={styles.chartTitle}>
                        Valores Mensais do Bloco K do SPED Fiscal ({selectedYear})
                      </h3>
                    </div>
                    <div className={styles.chartBody}>
                      <div className={styles.chartContainer}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={monthlyData}
                            margin={{
                              top: 20,
                              right: 30,
                              left: 20,
                              bottom: 5,
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis
                              tickFormatter={(value) =>
                                new Intl.NumberFormat('pt-BR', {
                                  notation: 'compact',
                                  compactDisplay: 'short',
                                  currency: 'BRL',
                                }).format(value)
                              }
                            />
                            <Tooltip
                              formatter={(value) =>
                                new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                }).format(Number(value))
                              }
                            />
                            <Legend />
                            <Bar
                              name="Bloco K"
                              dataKey="blocoK"
                              fill="#FF5722"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.emptyCard}>
                <p className={styles.emptyTitle}>
                  {!selectedClientId 
                    ? 'Selecione um cliente para visualizar os dados consolidados'
                    : `Nenhum dado encontrado para o ano ${selectedYear}.`}
                </p>
                {selectedClientId && (
                  <p className={styles.emptyText}>
                    Faça upload dos arquivos fiscais na página de Análise de Arquivos
                    para visualizar os dados consolidados.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

