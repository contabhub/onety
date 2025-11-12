import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { FileText, Info, Upload, ChevronDown, Building } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import FileUploader from '../../components/auditoria/FileUploader';
import FiscalTimeline from '../../components/auditoria/FiscalTimeline';
import { processInvoiceZip } from '../../services/auditoria/fileProcessor';
import ObligationStatusPanel from '../../components/auditoria/ObligationStatusPanel';
import styles from '../../styles/auditoria/analisador-entregas.module.css';
import PrincipalSidebar from '../../components/onety/principal/PrincipalSidebar';

// Helpers para uso padrão do localStorage conforme modelo da imagem
function getUserToken() { return localStorage.getItem('token'); }
function getUserData() { try { return JSON.parse(localStorage.getItem('userData')) || {}; } catch { return {}; } }

export default function FileAnalyzer() {
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [months, setMonths] = useState([]);
  const [processing, setProcessing] = useState(false);
  const router = useRouter();
  const [icmsValues, setIcmsValues] = useState(Array(12).fill(0));
  const [icmsLoading, setIcmsLoading] = useState(false);
  const [icmsExpanded, setIcmsExpanded] = useState(false);
  const [selectedAnalysisInfo, setSelectedAnalysisInfo] = useState(null);

  const loadAvailableYears = useCallback(async () => {
    // Verificar se há cliente específico selecionado
    const selectedClientId = localStorage.getItem('selected_client_id');
    
    if (!selectedClientId) {
      console.log('Nenhum cliente específico selecionado');
      // Se não há cliente, mostrar anos padrão
      setAvailableYears([2023, 2024, 2025]);
      return;
    }

    setYearsLoading(true);
    try {
      console.log('Carregando anos disponíveis para cliente ID:', selectedClientId);

      const token = getUserToken();
      if (!token) {
        console.error('Token de autenticação não encontrado');
        setAvailableYears([2023, 2024, 2025]);
        return;
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      
      // Buscar análises do regime normal
      const regimeResponse = await fetch(`${baseUrl}/regime-normal?clientes_id=${selectedClientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Buscar análises do simples nacional
      const simplesResponse = await fetch(`${baseUrl}/simples-nacional?clientes_id=${selectedClientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      let allYears = [];

      // Processar resposta do regime normal
      if (regimeResponse.ok) {
        const regimeData = await regimeResponse.json();
        console.log('Resposta regime normal:', regimeData);
        if (regimeData.data && Array.isArray(regimeData.data)) {
          const regimeYears = regimeData.data.map((item) => item.ano).filter((ano) => ano);
          console.log('Anos do regime normal:', regimeYears);
          allYears = [...allYears, ...regimeYears];
        }
      } else {
        console.error('Erro na resposta do regime normal:', regimeResponse.status, await regimeResponse.text());
      }

      // Processar resposta do simples nacional
      if (simplesResponse.ok) {
        const simplesData = await simplesResponse.json();
        console.log('Resposta simples nacional:', simplesData);
        if (simplesData.data && Array.isArray(simplesData.data)) {
          const simplesYears = simplesData.data.map((item) => item.ano).filter((ano) => ano);
          console.log('Anos do simples nacional:', simplesYears);
          allYears = [...allYears, ...simplesYears];
        }
      } else {
        console.error('Erro na resposta do simples nacional:', simplesResponse.status, await simplesResponse.text());
      }

      if (allYears.length > 0) {
        // Extract unique years
        const uniqueYears = [...new Set(allYears)].sort((a, b) => b - a);
        console.log('Anos disponíveis:', uniqueYears);
        setAvailableYears(uniqueYears);

        // Set the most recent year as default if current year is not available
        if (uniqueYears.length > 0 && !uniqueYears.includes(selectedYear)) {
          setSelectedYear(uniqueYears[0]);
        }
      } else {
        console.log('Nenhum ano disponível encontrado, usando anos padrão');
        setAvailableYears([2023, 2024, 2025]);
      }
    } catch (error) {
      console.error('Error loading available years:', error);
      setAvailableYears([2023, 2024, 2025]);
    } finally {
      setYearsLoading(false);
    }
  }, [selectedYear]);

  const initializeEmptyTimeline = useCallback(() => {
    const emptyTimeline = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      year: selectedYear,
      status: 'missing',
      arquivos: 0,
      tipos: [],
      nome: getMonthName(index + 1),
    }));
    setMonths(emptyTimeline);
  }, [selectedYear]);

  const loadTimelineData = useCallback(async () => {
    // Sistema multi-tenant - usar clientes_id
    const clientId = localStorage.getItem('selected_client_id');
    
    if (!clientId) {
      initializeEmptyTimeline();
      return;
    }

    setTimelineLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      // Usar clientes_id em vez de CNPJ para melhor segurança multi-tenant
      const url = `${baseUrl}/regime-normal/status-obrigacoes?clientes_id=${clientId}&ano=${selectedYear}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${getUserToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }

      const data = await response.json();
      const statusData = data.data || [];

      // Processar status das obrigações do regime normal
      const timelineData = Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        year: selectedYear,
        status: 'missing',
        arquivos: 0,
        tipos: [],
        nome: getMonthName(index + 1),
      }));

      statusData.forEach((monthStatus) => {
        const monthIndex = monthStatus.mesNumero - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          const monthData = timelineData[monthIndex];
          
          // Se há análises para este mês, marcar como feito
          if (monthStatus.tipos.length > 0) {
            monthData.status = 'done';
            monthData.arquivos = monthStatus.analises.length;
            monthData.tipos = [...monthStatus.tipos];
          }
        }
      });

      setMonths(timelineData);
    } catch (err) {
      console.error('Error loading timeline:', err);
      toast.error('Erro ao carregar timeline fiscal');
      // Fallback para timeline vazia em caso de erro
      initializeEmptyTimeline();
    } finally {
      setTimelineLoading(false);
    }
  }, [selectedYear, initializeEmptyTimeline]);

  const loadSpecificAnalysis = useCallback(async (analysisId) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      const url = `${baseUrl}/regime-normal/${analysisId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${getUserToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }

      const analysisData = await response.json();
      
      // Definir o ano da análise selecionada
      if (analysisData.ano) {
        setSelectedYear(analysisData.ano);
      }
      
      // Armazenar informações da análise selecionada
      setSelectedAnalysisInfo({
        arquivo_nome: analysisData.arquivo_nome,
        tipo: analysisData.tipo,
        mes: analysisData.mes,
        ano: analysisData.ano
      });
      
      // Carregar timeline com foco na análise específica
      await loadTimelineData();
      
      // Mostrar toast com informações da análise
      toast.success(`Análise carregada: ${analysisData.arquivo_nome} (${analysisData.tipo})`);
      
    } catch (err) {
      console.error('Erro ao carregar análise específica:', err);
      toast.error('Erro ao carregar análise específica');
      // Fallback para carregar timeline normal
      loadTimelineData();
    }
  }, [loadTimelineData]);

  useEffect(() => {
    console.log('🔍 [DEBUG] FileAnalyzer useEffect executado:', {
      pathname: window.location.pathname
    });

    // Se está autenticado, carrega os dados
    setLoading(false);
    
    // Carregar anos disponíveis primeiro
    loadAvailableYears();
    
    // Verificar se há uma análise específica selecionada
    const selectedAnalysisId = localStorage.getItem('selected_analysis_id');
    console.log('🔍 [DEBUG] Análise selecionada:', selectedAnalysisId);
    
    if (selectedAnalysisId) {
      console.log('🔍 [DEBUG] Carregando análise específica:', selectedAnalysisId);
      loadSpecificAnalysis(selectedAnalysisId);
      // Limpar dados da análise específica após carregar
      localStorage.removeItem('selected_analysis_id');
      localStorage.removeItem('selected_analysis_type');
      localStorage.removeItem('selected_analysis_month');
      localStorage.removeItem('selected_analysis_year');
      localStorage.removeItem('selected_analysis_file');
    } else {
      console.log('🔍 [DEBUG] Carregando timeline normal');
      loadTimelineData();
    }
  }, [selectedYear, loadTimelineData, loadSpecificAnalysis, loadAvailableYears]);


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

  // Função para criar ou buscar cliente automaticamente
  const createOrFindClient = async (cnpj, nome) => {
    try {
      const token = getUserToken();
      const user = getUserData();
      const empresaId = user.EmpresaId;
      
      if (!token || !empresaId) {
        console.error('Token ou company_id não encontrado');
        return null;
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      const cleanCnpj = cnpj.replace(/[^\d]/g, '');

      // Primeiro, tentar buscar cliente existente por CNPJ
      console.log('🔍 [DEBUG] Buscando cliente existente por CNPJ:', cleanCnpj);
      const searchResponse = await fetch(
        `${baseUrl}/clientes/por-cnpj/${cleanCnpj}?company_id=${empresaId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (searchResponse.ok) {
        const clientes = await searchResponse.json();
        if (clientes && clientes.length > 0) {
          console.log('✅ [SUCCESS] Cliente existente encontrado:', clientes[0].id);
          return clientes[0].id;
        }
      }

      // Se não encontrou, criar novo cliente
      console.log('🔄 [INFO] Cliente não encontrado, criando novo...');
      const clienteData = {
        company_id: empresaId,
        nome: nome || 'Cliente',
        cnpj: cleanCnpj,
        uf: 'RJ',
        regime_tributario: 'regime_normal'
      };

      const createResponse = await fetch(`${baseUrl}/clientes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(clienteData)
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        
        // Se o cliente já existe (erro de duplicação), buscar novamente
        if (createResponse.status === 400 && errorData.error?.includes('já existe')) {
          console.log('🔄 [INFO] Cliente já existe, buscando novamente...');
          const retryResponse = await fetch(
            `${baseUrl}/clientes/por-cnpj/${cleanCnpj}?company_id=${empresaId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );

          if (retryResponse.ok) {
            const clientes = await retryResponse.json();
            if (clientes && clientes.length > 0) {
              console.log('✅ [SUCCESS] Cliente encontrado após retry:', clientes[0].id);
              return clientes[0].id;
            }
          }
        }
        
        throw new Error(`Erro ao criar cliente: ${errorData.error || createResponse.statusText}`);
      }

      const result = await createResponse.json();
      console.log('✅ [SUCCESS] Cliente criado com sucesso:', result.id);
      return result.id;

    } catch (error) {
      console.error('❌ [ERROR] Erro ao criar/buscar cliente:', error);
      return null;
    }
  };

  const handleFileProcessed = async (file) => {
    setProcessing(true);
    try {
      // Se for um arquivo PDF, processar como análise do regime normal
      if (
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf')
      ) {
        console.log('Processando arquivo PDF do Regime Normal:', file.name);
        
        // Upload para a rota /regime-normal/upload
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${baseUrl}/regime-normal/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getUserToken()}`,
          },
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro ${response.status}: ${errorText}`);
        }

        toast.success('Arquivo do Regime Normal processado com sucesso');
        await loadTimelineData();
      } else {
        // Para outros tipos de arquivo, usar o processamento padrão
        const { results, duplicateError } = await processInvoiceZip(file);

        // Verificar se houve erro de duplicação
        if (duplicateError) {
          toast.error(duplicateError, {
            duration: 7000,
            style: {
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              maxWidth: '500px'
            }
          });
          return;
        }

        const validResults = results.filter(
          (result) => result && result.period && result.cnpj
        );

        if (validResults.length > 0) {
          // Se não há cliente selecionado, mas temos resultados válidos, 
          // tentar criar/associar cliente automaticamente
          const clientId = localStorage.getItem('selected_client_id');
          
          if (!clientId && validResults.length > 0) {
            const firstResult = validResults[0];
            if (firstResult.cnpj) {
              console.log('🔄 [INFO] Nenhum cliente selecionado, tentando criar/associar automaticamente...');
              
              const newClientId = await createOrFindClient(
                firstResult.cnpj, 
                firstResult.nomeEmpresa || 'Cliente'
              );
              
              if (newClientId) {
                // Salvar informações do cliente no localStorage para futuras operações
                localStorage.setItem('selected_client_id', newClientId);
                localStorage.setItem('selected_client_name', firstResult.nomeEmpresa || 'Cliente');
                localStorage.setItem('selected_client_cnpj', firstResult.cnpj);
                
                toast.success(`Cliente ${firstResult.nomeEmpresa || 'Cliente'} associado automaticamente!`);
                
                // Recarregar dados com o novo cliente
                await loadAvailableYears();
                await loadTimelineData();
              }
            }
          } else {
            await loadTimelineData();
          }
          
          toast.success(
            `${validResults.length} arquivo(s) processado(s) com sucesso`
          );
        } else {
          // Verificar se houve processamento mas sem resultados válidos
          // Isso pode acontecer se o arquivo foi processado mas não tinha dados válidos
          toast.error('Arquivo processado, mas não foi possível salvar a análise.');
        }
      }
    } catch (error) {
      console.error('Error processing file:', error);
      
      // Tratar erro de duplicata especificamente (vem do backend com status 409)
      if (error instanceof Error && error.message?.includes('Já existe uma análise')) {
        toast.error(error.message.replace('Erro ao criar análise: ', ''), {
          duration: 7000,
          style: {
            background: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca',
            maxWidth: '500px'
          }
        });
      } else if (error instanceof Error && error.message?.includes('Erro ao criar análise:')) {
        // Tratar outros erros de criação de análise
        toast.error(error.message.replace('Erro ao criar análise: ', ''), {
          duration: 5000,
          style: {
            background: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca'
          }
        });
      } else {
        toast.error('Erro ao processar arquivo. Verifique o formato e tente novamente.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleMonthSelect = (monthData) => {
    const clientId = localStorage.getItem('selected_client_id');
    
    if (monthData.status === 'done' && clientId) {
      // Sistema multi-tenant - usar dados do cliente selecionado
      router.push(
        `/obligations?month=${monthData.month}&year=${monthData.year}&client_id=${clientId}`
      );
    }
  };

  const handleYearChange = (e) => {
    const year = parseInt(e.target.value);
    setSelectedYear(year);
  };

  const handleCadastrarNovaEmpresa = () => {
    // Limpar dados do cliente no localStorage
    localStorage.removeItem('selected_client_id');
    localStorage.removeItem('selected_client_name');
    localStorage.removeItem('selected_client_cnpj');
    
    // Mostrar toast de confirmação
    toast.success('Dados da empresa limpos. Recarregando dados...');
    
    // Recarregar dados sem fazer refresh completo da página
    setTimeout(() => {
      // Limpar estado atual
      setSelectedAnalysisInfo(null);
      setIcmsValues(Array(12).fill(0));
      
      // Recarregar timeline com dados limpos
      initializeEmptyTimeline();
      
      // Recarregar anos disponíveis (volta para anos padrão)
      loadAvailableYears();
      
      // Recarregar valores de ICMS
      const loadIcmsValues = async () => {
        setIcmsLoading(true);
        try {
          // Como não há cliente selecionado, definir valores como zero
          setIcmsValues(Array(12).fill(0));
        } catch (error) {
          console.error('Erro ao recarregar ICMS:', error);
        } finally {
          setIcmsLoading(false);
        }
      };
      loadIcmsValues();
    }, 1000);
  };

  // Carregar valores de ICMS usando a nova API
  useEffect(() => {
    const loadIcmsValues = async () => {
      const clientId = localStorage.getItem('selected_client_id');
      
      if (!clientId) {
        setIcmsValues(Array(12).fill(0));
        return;
      }
      
      setIcmsLoading(true);
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
        const token = getUserToken();
        
        if (!token) {
          console.error('Token de autenticação não encontrado');
          setIcmsValues(Array(12).fill(0));
          return;
        }

        // GET - Buscar registros de ICMS recolhido por cliente e ano
        const response = await fetch(
          `${baseUrl}/icms-recolhido/cliente/${clientId}?ano=${selectedYear}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Erro ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        const values = Array(12).fill(0);
        
        if (data && Array.isArray(data)) {
          data.forEach((record) => {
            if (record.mes >= 1 && record.mes <= 12) {
              values[record.mes - 1] = Number(record.valor) || 0;
            }
          });
        }
        
        setIcmsValues(values);
      } catch (error) {
        console.error('Erro ao carregar ICMS recolhido:', error);
        toast.error('Erro ao carregar ICMS recolhido');
        setIcmsValues(Array(12).fill(0));
      } finally {
        setIcmsLoading(false);
      }
    };
    loadIcmsValues();
  }, [selectedYear]);

  // Salvar valores de ICMS usando a nova API (POST/PUT)
  const handleSaveIcms = async () => {
    const clientId = localStorage.getItem('selected_client_id');
    
    if (!clientId) {
      toast.error('Nenhum cliente selecionado');
      return;
    }
    
    setIcmsLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      const token = getUserToken();
      
      if (!token) {
        toast.error('Token de autenticação não encontrado');
        return;
      }

      // Primeiro, buscar registros existentes para este cliente e ano
      const getResponse = await fetch(
        `${baseUrl}/icms-recolhido/cliente/${clientId}?ano=${selectedYear}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      let existingRecords = [];
      if (getResponse.ok) {
        existingRecords = await getResponse.json();
      }

      // Processar cada mês
      for (let mes = 1; mes <= 12; mes++) {
        const valor = icmsValues[mes - 1] || 0;
        
        // Verificar se já existe registro para este mês
        const existingRecord = existingRecords.find(record => record.mes === mes);
        
        if (existingRecord) {
          // PUT - Atualizar registro existente se o valor mudou
          if (existingRecord.valor !== valor) {
            const putResponse = await fetch(
              `${baseUrl}/icms-recolhido/${existingRecord.id}`,
              {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ valor })
              }
            );

            if (!putResponse.ok) {
              throw new Error(`Erro ao atualizar ICMS para mês ${mes}: ${await putResponse.text()}`);
            }
          }
        } else if (valor > 0) {
          // POST - Criar novo registro apenas se o valor for maior que 0
          const postResponse = await fetch(
            `${baseUrl}/icms-recolhido`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                clientes_id: clientId,
                ano: selectedYear,
                mes: mes,
                valor: valor
              })
            }
          );

          if (!postResponse.ok) {
            throw new Error(`Erro ao criar ICMS para mês ${mes}: ${await postResponse.text()}`);
          }
        }
      }

      toast.success('Valores de ICMS salvos com sucesso!');
      
      // Recarregar os dados após salvar
      const loadIcmsValues = async () => {
        try {
          const response = await fetch(
            `${baseUrl}/icms-recolhido/cliente/${clientId}?ano=${selectedYear}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            const values = Array(12).fill(0);
            
            if (data && Array.isArray(data)) {
              data.forEach((record) => {
                if (record.mes >= 1 && record.mes <= 12) {
                  values[record.mes - 1] = Number(record.valor) || 0;
                }
              });
            }
            
            setIcmsValues(values);
          }
        } catch (error) {
          console.error('Erro ao recarregar ICMS após salvar:', error);
        }
      };
      
      await loadIcmsValues();
      
    } catch (error) {
      console.error('Erro ao salvar valores de ICMS:', error);
      toast.error('Erro ao salvar valores de ICMS');
    } finally {
      setIcmsLoading(false);
    }
  };

  function renderStatusBadge(status) {
    if (!status) return '—';
    if (status === 'done') return <span className={styles.statusBadgeDone}>Entregue</span>;
    if (status === 'missing') return <span className={styles.statusBadgeMissing}>Faltando</span>;
    return <span className={styles.statusBadge}>{status}</span>;
  }

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.loadingCard}>
          <div className={styles.spinner}></div>
          <h2 className={styles.loadingTitle}>
            Carregando Analisador Fiscal
          </h2>
          <p className={styles.loadingSubtitle}>
            Aguarde enquanto verificamos sua sessão e carregamos os dados
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.layoutWrapper}>
      <PrincipalSidebar />
      <div className={styles.pageContent}>
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.sectionSpacing}>
              <div className={styles.sectionHeader}>
                <div>
                  <h1 className={styles.title}>
                    Analisador de Entregas Fiscais
                  </h1>
                  {selectedAnalysisInfo ? (
                    <div className={styles.clientCard}>
                      <div className={styles.clientCardHeader}>
                        <div>
                          <p className={styles.clientCardTitle}>
                            Análise Selecionada: {selectedAnalysisInfo.arquivo_nome}
                          </p>
                          <p className={styles.clientMeta}>
                            Tipo: {selectedAnalysisInfo.tipo} | 
                            Período: {getMonthName(selectedAnalysisInfo.mes)}/{selectedAnalysisInfo.ano}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            // setSelectedAnalysisId(null); // This variable is not defined in the original file
                            setSelectedAnalysisInfo(null);
                            setMonths([]);
                          }}
                          className={styles.clientClearButton}
                        >
                          Limpar Seleção
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={styles.subtitle}>
                      Selecione uma análise na timeline para visualizar os detalhes.
                    </p>
                  )}
                </div>
                <div className={styles.actionsRow}>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className={styles.primaryButton}
                  >
                    Voltar ao Dashboard
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  <Upload className={styles.buttonIcon} />
                  Upload de Arquivos Fiscais
                </h2>
                <div className={styles.actionsRow}>
                  <span className={styles.subtitle}>Ano:</span>
                  {yearsLoading ? (
                    <div className={styles.actionsRow}>
                      <div className={styles.spinnerSmall}></div>
                      <span className={styles.subtitle}>Carregando...</span>
                    </div>
                  ) : (
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className={styles.filterSelect}
                    >
                      {availableYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <p className={styles.subtitle}>
                  Faça upload dos arquivos ZIP contendo notas fiscais e planilhas de impostos.
                  O sistema extrairá e processará os dados automaticamente.
                </p>
              </div>
              <div className={styles.sectionBody}>
                <FileUploader onUpload={handleFileProcessed} processing={processing} />
                <div className={styles.infoSection}>
                  <h3 className={styles.clientCardTitle}>
                    <Info className={styles.buttonIcon} />
                    Informações importantes sobre o upload
                  </h3>
                  <div className={styles.infoCard}>
                    <h3 className={styles.clientCardTitle}>
                      <Info className={styles.buttonIcon} />
                      O que já está funcionando?
                    </h3>
                    <ul className={styles.infoList}>
                      <li>Upload e armazenamento dos arquivos no Supabase</li>
                      <li>Processamento zip de notas fiscais com extração automática</li>
                      <li>Integração com timeline e status das obrigações</li>
                      <li>Geração futura de relatórios analíticos (em desenvolvimento)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.sectionSpacing}>
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    Multiclientes do Simples Nacional
                  </h2>
                  <p className={styles.subtitle}>
                    Aqui está a timeline de entregas e obrigações fiscais. Clique em qualquer item para analisar em detalhes.
                  </p>
                </div>
                <div className={styles.sectionBody}>
                  <FiscalTimeline
                    year={selectedYear}
                    months={months}
                    onMonthSelect={handleMonthSelect}
                    loading={timelineLoading}
                  />
                </div>
              </div>

              <div className={styles.sectionSpacing}>
                <ObligationStatusPanel
                  selectedAnalysisInfo={selectedAnalysisInfo}
                  reloadTimeline={() => loadTimelineData()}
                />
              </div>

              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>
                    <FileText className={styles.buttonIcon} />
                    Controle de ICMS Recolhido
                  </h2>
                  <div className={styles.actionsRow}>
                    <span className={styles.subtitle}>Ano: {selectedYear}</span>
                    <button
                      onClick={() => handleToggleIcmsSection()}
                      className={styles.toggleButton}
                    >
                      {icmsExpanded ? 'Fechar' : 'Editar Valores'}
                    </button>
                  </div>
                </div>
                {icmsExpanded && (
                  <div className={styles.sectionBody}>
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead className={styles.tableHead}>
                          <tr>
                            <th className={styles.tableHeadCell}>Mês</th>
                            <th className={styles.tableHeadCell}>Valor ICMS (R$)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {icmsValues.map((value, idx) => (
                            <tr key={idx} className={styles.tableRow}>
                              <td className={styles.tableCell}>{getMonthName(idx + 1)}</td>
                              <td className={styles.tableCell}>
                                <input
                                  type="number"
                                  value={value}
                                  onChange={e => handleIcmsValueChange(idx, e.target.value)}
                                  className={styles.numberInput}
                                  placeholder="0,00"
                                  step="0.01"
                                  min="0"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={handleSaveIcms}
                      className={styles.primaryButton}
                      disabled={icmsLoading}
                    >
                      {icmsLoading ? 'Salvando...' : 'Salvar Valores'}
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.sectionCard}>
                <div className={styles.sectionBody}>
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead className={styles.tableHead}>
                        <tr>
                          <th className={styles.tableHeadCell}>Ano</th>
                          <th className={styles.tableHeadCell}>Mês</th>
                          <th className={styles.tableHeadCell}>Tipo de Análise</th>
                          <th className={styles.tableHeadCell}>Detalhes</th>
                          <th className={styles.tableHeadCell}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {months.map((item, index) => (
                          <tr
                            key={index}
                            className={styles.tableRow}
                            onClick={() => handleTimelineClick(item)}
                          >
                            <td className={styles.tableCell}>{item.ano || 'N/A'}</td>
                            <td className={styles.tableCell}>{item.mes ? getMonthName(item.mes) : 'N/A'}</td>
                            <td className={styles.tableCell}>{item.tipo || 'N/A'}</td>
                            <td className={styles.tableCellLight}>
                              <div className={styles.tableActions}>
                                <span>{item.descricao || item.periodo_documento || 'Sem descrição'}</span>
                                {item.tipo === 'SPED_CONTRIBUICOES' && (
                                  <span className={styles.statusBadge}>
                                    PGDAS-D
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className={styles.tableCell}>
                              {renderStatusBadge(item.status)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className={styles.tableWrapper}>
                <div className={styles.timelineGrid}>
                  <div></div>
                  {months.map((month) => (
                    <div key={month.month} className={styles.timelineHeaderCell}>
                      {month.month}
                    </div>
                  ))}
                  <div className={styles.timelineRowTitle}>SPED Fiscal</div>
                  {months.map((month) => (
                    <div key={`sped-${month.month}`} className={styles.timelineCell}>
                      {month.spedFiscal || '—'}
                    </div>
                  ))}
                  <div className={styles.timelineRowTitle}>SPED Contribuições</div>
                  {months.map((month) => (
                    <div key={`contrib-${month.month}`} className={styles.timelineCell}>
                      {month.spedContribuicoes || '—'}
                    </div>
                  ))}
                  <div className={styles.timelineRowTitle}>DCTF</div>
                  {months.map((month) => (
                    <div key={`dctf-${month.month}`} className={styles.timelineCell}>
                      {month.dctf || '—'}
                    </div>
                  ))}
                  <div className={styles.timelineRowTitle}>DARFs Pagas</div>
                  {months.map((month) => (
                    <div key={`darf-${month.month}`} className={styles.timelineCell}>
                      {month.darf || '—'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Toaster position="top-right" />
          </div>
        </div>
      </div>
    </div>
  );
}
