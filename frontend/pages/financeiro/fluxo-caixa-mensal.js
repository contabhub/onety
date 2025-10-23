'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/financeiro/card';
import { Button } from '../../components/financeiro/botao';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/financeiro/select';
import { 
  ChevronDown, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Calendar,
  Filter,
  FileBarChart,
  Eye,
  EyeOff,
  ExternalLink,
  Download
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ExportarFluxoCaixaMensal } from '../../components/financeiro/ExportarFluxoCaixaMensal';
import styles from '../../styles/financeiro/fluxo-caixa-mensal.module.css';

// 📊 Interfaces para tipagem dos dados da API

export default function FluxoCaixaMensalPage() {
  const router = useRouter();
  
  // 🔧 Estados para controle da interface
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedTipos, setExpandedTipos] = useState(new Set());
  const [expandedCategorias, setExpandedCategorias] = useState(new Set());
  const [isExportarOpen, setIsExportarOpen] = useState(false);
  
  // 🗓️ Estados para filtros
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedTipo, setSelectedTipo] = useState('todos');
  const [showRealizadoOnly, setShowRealizadoOnly] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [enableDayFilter, setEnableDayFilter] = useState(false);

  // 📅 Opções para filtros
  const months = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // 🔄 Função para consolidar dados mensais em estrutura anual
  const consolidateMonthlyData = useCallback((monthlyResults) => {
    const consolidatedTipos = {};
    let totalAnoPrevisto = 0;
    let totalAnoRealizado = 0;
    let totalAnoPendente = 0;
    const valoresMensaisGerais = {};

    // Processar cada mês
    monthlyResults.forEach(({ mes, data }) => {
      if (!data || !data.tipos) return;

      // Consolidar totais gerais mensais
      valoresMensaisGerais[mes] = {
        previsto: data.totais_gerais?.total_geral_previsto || 0,
        realizado: data.totais_gerais?.total_geral_realizado || 0,
        pendente: data.totais_gerais?.total_geral_pendente || 0,
        transacoes: 0
      };

      totalAnoPrevisto += data.totais_gerais?.total_geral_previsto || 0;
      totalAnoRealizado += data.totais_gerais?.total_geral_realizado || 0;
      totalAnoPendente += data.totais_gerais?.total_geral_pendente || 0;

      // Processar tipos
      data.tipos.forEach((tipo) => {
        if (!consolidatedTipos[tipo.tipo_id]) {
          consolidatedTipos[tipo.tipo_id] = {
            tipo_id: tipo.tipo_id,
            tipo_nome: tipo.tipo_nome,
            valores_mensais: {},
            total_ano_previsto: 0,
            total_ano_realizado: 0,
            total_ano_pendente: 0,
            categorias: []
          };
        }

        const tipoConsolidado = consolidatedTipos[tipo.tipo_id];
        tipoConsolidado.valores_mensais[mes] = {
          previsto: tipo.total_tipo_previsto || 0,
          realizado: tipo.total_tipo_realizado || 0,
          pendente: tipo.total_tipo_pendente || 0,
          transacoes: 0
        };

        tipoConsolidado.total_ano_previsto += tipo.total_tipo_previsto || 0;
        tipoConsolidado.total_ano_realizado += tipo.total_tipo_realizado || 0;
        tipoConsolidado.total_ano_pendente += tipo.total_tipo_pendente || 0;

        // Processar categorias
        tipo.categorias.forEach((categoria) => {
          let categoriaConsolidada = tipoConsolidado.categorias.find(c => c.categoria_id === categoria.categoria_id);
          
          if (!categoriaConsolidada) {
            categoriaConsolidada = {
              categoria_id: categoria.categoria_id,
              categoria_nome: categoria.categoria_nome,
              valores_mensais: {},
              total_ano_previsto: 0,
              total_ano_realizado: 0,
              total_ano_pendente: 0,
              subcategorias: []
            };
            tipoConsolidado.categorias.push(categoriaConsolidada);
          }

          categoriaConsolidada.valores_mensais[mes] = {
            previsto: categoria.total_categoria_previsto || 0,
            realizado: categoria.total_categoria_realizado || 0,
            pendente: categoria.total_categoria_pendente || 0,
            transacoes: 0
          };

          categoriaConsolidada.total_ano_previsto += categoria.total_categoria_previsto || 0;
          categoriaConsolidada.total_ano_realizado += categoria.total_categoria_realizado || 0;
          categoriaConsolidada.total_ano_pendente += categoria.total_categoria_pendente || 0;

          // Processar subcategorias
          categoria.subcategorias.forEach((subcategoria) => {
            let subcategoriaConsolidada = categoriaConsolidada.subcategorias.find(s => s.subcategoria_id === subcategoria.subcategoria_id);
            
            if (!subcategoriaConsolidada) {
              subcategoriaConsolidada = {
                subcategoria_id: subcategoria.subcategoria_id,
                subcategoria_nome: subcategoria.subcategoria_nome,
                valores_mensais: {},
                total_ano_previsto: 0,
                total_ano_realizado: 0,
                total_ano_pendente: 0,
                transacao_tipo: subcategoria.transacao_tipo
              };
              categoriaConsolidada.subcategorias.push(subcategoriaConsolidada);
            }

            subcategoriaConsolidada.valores_mensais[mes] = {
              previsto: subcategoria.valor_previsto || 0,
              realizado: subcategoria.valor_realizado || 0,
              pendente: subcategoria.valor_pendente || 0,
              transacoes: subcategoria.total_transacoes_previsto || 0
            };

            subcategoriaConsolidada.total_ano_previsto += subcategoria.valor_previsto || 0;
            subcategoriaConsolidada.total_ano_realizado += subcategoria.valor_realizado || 0;
            subcategoriaConsolidada.total_ano_pendente += subcategoria.valor_pendente || 0;
          });
        });
      });
    });

    return {
      filtros_aplicados: {
        company_id: localStorage.getItem('empresaId') || '',
        ano: selectedYear,
        tipo: selectedTipo
      },
      totais_gerais: {
        valores_mensais: valoresMensaisGerais,
        total_ano_previsto: totalAnoPrevisto,
        total_ano_realizado: totalAnoRealizado,
        total_ano_pendente: totalAnoPendente
      },
      tipos: Object.values(consolidatedTipos)
    };
  }, [selectedYear, selectedTipo]);

  // 🔄 Função para buscar dados anuais da API
  const fetchRelatorioData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const empresaId = localStorage.getItem('empresaId');
      if (!empresaId) {
        throw new Error('ID da empresa não encontrado');
      }

      // Buscar dados de todos os meses do ano
      const promises = [];
      
      if (enableDayFilter && selectedDay) {
        // 🔍 Filtro por dia específico: buscar apenas transações com data_vencimento no dia selecionado
        for (let mes = 1; mes <= 12; mes++) {
          const params = new URLSearchParams();
          params.append('mes', mes.toString());
          params.append('ano', selectedYear.toString());
          params.append('dia', selectedDay.toString());
          
          if (selectedTipo !== 'todos') {
            params.append('tipo', selectedTipo);
          }

          promises.push(
            fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/transacoes/relatorio/categorias/${empresaId}?${params}`,
              {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`,
                  'Content-Type': 'application/json',
                },
              }
            ).then(res => res.json()).then(data => ({ mes, data }))
          );
        }
      } else {
        // 📅 Busca normal por mês (sem filtro de dia)
        for (let mes = 1; mes <= 12; mes++) {
          const params = new URLSearchParams();
          params.append('mes', mes.toString());
          params.append('ano', selectedYear.toString());
          
          if (selectedTipo !== 'todos') {
            params.append('tipo', selectedTipo);
          }

          promises.push(
            fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/transacoes/relatorio/categorias/${empresaId}?${params}`,
              {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`,
                  'Content-Type': 'application/json',
                },
              }
            ).then(res => res.json()).then(data => ({ mes, data }))
          );
        }
      }

      const results = await Promise.all(promises);
      
      // Processar e consolidar dados de todos os meses
      const consolidatedData = consolidateMonthlyData(results);
      setData(consolidatedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedTipo, consolidateMonthlyData, enableDayFilter, selectedDay]);


  // 🎯 Carregar dados quando os filtros mudarem
  useEffect(() => {
    fetchRelatorioData();
  }, [selectedYear, selectedTipo, fetchRelatorioData]);

  // 🔧 Funções para controle de expansão
  const toggleTipo = (tipoId) => {
    const newExpanded = new Set(expandedTipos);
    if (newExpanded.has(tipoId)) {
      newExpanded.delete(tipoId);
    } else {
      newExpanded.add(tipoId);
    }
    setExpandedTipos(newExpanded);
  };

  const toggleCategoria = (categoriaId) => {
    const newExpanded = new Set(expandedCategorias);
    if (newExpanded.has(categoriaId)) {
      newExpanded.delete(categoriaId);
    } else {
      newExpanded.add(categoriaId);
    }
    setExpandedCategorias(newExpanded);
  };

  // 💰 Função para formatar valores monetários
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // 🎨 Função para determinar cor baseada no tipo
  const getTipoColor = (tipoNome) => {
    if (tipoNome.toLowerCase().includes('receita') || tipoNome.toLowerCase().includes('entrada')) {
      return styles.tipoReceita;
    }
    if (tipoNome.toLowerCase().includes('despesa') || tipoNome.toLowerCase().includes('saida')) {
      return styles.tipoDespesa;
    }
    return styles.tipoOutros;
  };

  // 🔗 Função para navegar para contas a receber/pagar com filtros
  const navigateToContas = (tipoNome, subcategoriaNome, mes) => {
    const isReceita = tipoNome.toLowerCase().includes('receita') || tipoNome.toLowerCase().includes('entrada');
    const isDespesa = tipoNome.toLowerCase().includes('despesa') || tipoNome.toLowerCase().includes('saida');
    
    // Determinar a página de destino
    let baseUrl = '';
    if (isReceita) {
      baseUrl = '/financeiro/contas-a-receber';
    } else if (isDespesa) {
      baseUrl = '/financeiro/contas-a-pagar';
    } else {
      // Se não conseguir determinar, usar receita como padrão
      baseUrl = '/financeiro/contas-a-receber';
    }

    // Construir parâmetros de filtro
    const params = new URLSearchParams();
    
    // Filtro por subcategoria (se disponível)
    if (subcategoriaNome && subcategoriaNome !== 'Sem categoria') {
      params.append('subcategoria', subcategoriaNome);
    }
    
    // Filtro por mês/ano (se especificado)
    if (mes) {
      const mesFormatado = mes.toString().padStart(2, '0');
      const dataInicio = `${selectedYear}-${mesFormatado}-01`;
      const dataFim = `${selectedYear}-${mesFormatado}-${new Date(selectedYear, mes, 0).getDate()}`;
      
      params.append('data_inicio', dataInicio);
      params.append('data_fim', dataFim);
    }
    
    // Navegar com parâmetros
    const url = `${baseUrl}?${params.toString()}`;
    router.push(url);
  };

  // 🔗 Função para navegar para contas a receber/pagar com filtro de mês (ao clicar no cabeçalho)
  const navigateToContasByMonth = (mes) => {
    // Navegar para ambas as páginas com filtro de mês
    const mesFormatado = mes.toString().padStart(2, '0');
    const dataInicio = `${selectedYear}-${mesFormatado}-01`;
    const dataFim = `${selectedYear}-${mesFormatado}-${new Date(selectedYear, mes, 0).getDate()}`;
    
    const params = new URLSearchParams();
    params.append('data_inicio', dataInicio);
    params.append('data_fim', dataFim);
    
    // Navegar para contas a receber com filtro de mês
    const urlReceber = `/financeiro/contas-a-receber?${params.toString()}`;
    router.push(urlReceber);
  };

  // 🔗 Função para navegar para contas a receber/pagar com filtro de status "pago" (ao clicar em "Realizado")
  const navigateToContasRealizado = (tipoNome, subcategoriaNome, mes) => {
    const isReceita = tipoNome.toLowerCase().includes('receita') || tipoNome.toLowerCase().includes('entrada');
    const isDespesa = tipoNome.toLowerCase().includes('despesa') || tipoNome.toLowerCase().includes('saida');
    
    // Determinar a página de destino
    let baseUrl = '';
    if (isReceita) {
      baseUrl = '/financeiro/contas-a-receber';
    } else if (isDespesa) {
      baseUrl = '/financeiro/contas-a-pagar';
    } else {
      // Se não conseguir determinar, usar receita como padrão
      baseUrl = '/financeiro/contas-a-receber';
    }

    // Construir parâmetros de filtro
    const params = new URLSearchParams();
    
    // Filtro por status "pago"
    params.append('status', 'pago');
    
    // Filtro por subcategoria (se disponível)
    if (subcategoriaNome && subcategoriaNome !== 'Sem categoria') {
      params.append('subcategoria', subcategoriaNome);
    }
    
    // Filtro por mês/ano (se especificado)
    if (mes) {
      const mesFormatado = mes.toString().padStart(2, '0');
      const dataInicio = `${selectedYear}-${mesFormatado}-01`;
      const dataFim = `${selectedYear}-${mesFormatado}-${new Date(selectedYear, mes, 0).getDate()}`;
      
      params.append('data_inicio', dataInicio);
      params.append('data_fim', dataFim);
    }
    
    // Navegar com parâmetros
    const url = `${baseUrl}?${params.toString()}`;
    router.push(url);
  };

  // 📊 Dados filtrados para exibição
  const dadosFiltrados = useMemo(() => {
    if (!data) return null;
    
    let dadosFiltrados = data;
    
    // Filtrar por tipo (entrada/saída) se não for "todos"
    if (selectedTipo !== 'todos') {
      console.log(`🔍 Filtrando por tipo: ${selectedTipo}`);
      console.log('📋 Tipos disponíveis:', data.tipos.map(t => t.tipo_nome));
      
      dadosFiltrados = {
        ...data,
        tipos: data.tipos.filter(tipo => {
          const tipoNome = tipo.tipo_nome.toLowerCase();
          let deveMostrar = false;
          
          if (selectedTipo === 'entrada') {
            // Mostrar apenas tipos que são entradas/receitas
            deveMostrar = tipoNome.includes('receita') || 
                         tipoNome.includes('entrada') || 
                         tipoNome.includes('recebimento') ||
                         tipoNome.includes('venda');
            console.log(`✅ Tipo "${tipo.tipo_nome}" é entrada? ${deveMostrar}`);
          } else if (selectedTipo === 'saida') {
            // Mostrar apenas tipos que são saídas/despesas
            deveMostrar = tipoNome.includes('despesa') || 
                         tipoNome.includes('saida') || 
                         tipoNome.includes('saída') ||
                         tipoNome.includes('pagamento');
            console.log(`✅ Tipo "${tipo.tipo_nome}" é saída? ${deveMostrar}`);
          }
          
          return deveMostrar;
        })
      };
      
      console.log('📊 Tipos filtrados:', dadosFiltrados.tipos.map(t => t.tipo_nome));
    }
    
    if (showRealizadoOnly) {
      // Filtrar apenas valores realizados
      dadosFiltrados = {
        ...dadosFiltrados,
        tipos: dadosFiltrados.tipos.map(tipo => ({
          ...tipo,
          categorias: tipo.categorias.filter(cat => cat.total_ano_realizado > 0)
        })).filter(tipo => tipo.categorias.length > 0)
      };
    }
    
    return dadosFiltrados;
  }, [data, showRealizadoOnly, selectedTipo]);

  return (
    <div className={styles.fluxoCaixaContainer}>
      {/* 📋 Header */}
      <div className={styles.headerContainer}>
        <div>
          <h1 className={styles.headerTitle}>
            <FileBarChart className={styles.headerTitleIcon} />
            Fluxo de Caixa Mensal
          </h1>
          <p className={styles.headerSubtitle}>
            Relatório detalhado de categorias e subcategorias financeiras
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportarOpen(true)}
            className={styles.filtroToggleButton}
          >
            <Download className="h-4 w-4" />
            Exportar Relatório
          </Button>
        </div>
      </div>

      {/* 🔍 Filtros */}
      <Card className={styles.filtrosCard}>
        <CardHeader className={styles.filtrosHeader}>
          <CardTitle className={styles.filtrosTitle}>
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className={styles.filtrosContent}>
          <div className={styles.filtrosGrid}>
            {/* Filtro de Ano */}
            <div className={styles.filtroGroup}>
              <label className={styles.filtroLabel}>
                Ano
              </label>
              <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(Number(v))}>
                <SelectTrigger className={styles.filtroSelect}>
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Tipo */}
            <div className={styles.filtroGroup}>
              <label className={styles.filtroLabel}>
                Tipo
              </label>
              <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                <SelectTrigger className={styles.filtroSelectWide}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Dia */}
            <div className={styles.filtroGroup}>
              <label className={styles.filtroLabel}>
                Filtro por Dia
              </label>
              <div className={styles.filtroToggleGroup}>
                <Button
                  variant={enableDayFilter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEnableDayFilter(!enableDayFilter)}
                  className={styles.filtroToggleButton}
                >
                  {enableDayFilter ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {enableDayFilter ? 'Filtro Ativo' : 'Ativar Filtro'}
                </Button>
                {enableDayFilter && (
                  <Select 
                    value={selectedDay?.toString() || ''} 
                    onValueChange={v => setSelectedDay(Number(v))}
                  >
                    <SelectTrigger className={styles.filtroSelectNarrow}>
                      <SelectValue placeholder="Dia" />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Toggle Realizado */}
            <div className={styles.filtroGroup}>
              <Button
                variant={showRealizadoOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowRealizadoOnly(!showRealizadoOnly)}
                className={styles.filtroToggleButton}
              >
                {showRealizadoOnly ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {showRealizadoOnly ? 'Mostrando Realizados' : 'Mostrar Apenas Realizados'}
              </Button>
            </div>

            {/* Botão Atualizar */}
            <div className={styles.filtroGroup}>
              <Button onClick={fetchRelatorioData} disabled={loading}>
                {loading ? 'Carregando...' : 'Atualizar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 📊 Resumo Geral Anual */}
      {dadosFiltrados && (
        <div className={styles.resumoGrid}>
          <Card className={styles.resumoCard}>
            <CardContent className={styles.resumoContent}>
              <TrendingUp className={`${styles.resumoIcon} ${styles.resumoIconPrevisto}`} />
              <div>
                <p className={styles.resumoText}>Total Anual Previsto</p>
                <p className={`${styles.resumoValue} ${styles.resumoValuePrevisto}`}>
                  {formatCurrency(dadosFiltrados.totais_gerais.total_ano_previsto)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={styles.resumoCard}>
            <CardContent className={styles.resumoContent}>
              <DollarSign className={`${styles.resumoIcon} ${styles.resumoIconRealizado}`} />
              <div>
                <p className={styles.resumoText}>Total Anual Realizado</p>
                <p className={`${styles.resumoValue} ${styles.resumoValueRealizado}`}>
                  {formatCurrency(dadosFiltrados.totais_gerais.total_ano_realizado)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={styles.resumoCard}>
            <CardContent className={styles.resumoContent}>
              <TrendingDown className={`${styles.resumoIcon} ${styles.resumoIconPendente}`} />
              <div>
                <p className={styles.resumoText}>Total Anual Pendente</p>
                <p className={`${styles.resumoValue} ${styles.resumoValuePendente}`}>
                  {formatCurrency(dadosFiltrados.totais_gerais.total_ano_pendente)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 🔄 Estados de Loading e Error */}
      {loading && (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p className={styles.loadingText}>Carregando relatório...</p>
        </div>
      )}



      {/* 📊 Tabela de Fluxo de Caixa Mensal */}
      {!loading && !error && dadosFiltrados && (
        <Card className={styles.tabelaCard}>
          <CardHeader className={styles.tabelaHeader}>
            <CardTitle className={styles.tabelaTitle}>Fluxo de Caixa Mensal - {selectedYear}</CardTitle>
          </CardHeader>
          <CardContent className={styles.tabelaContent}>
            {dadosFiltrados.tipos.length === 0 ? (
              <div className={styles.tabelaEmpty}>
                <Image
                  src="/nenhuma.png"
                  alt="Nenhum dado encontrado"
                  width={128}
                  height={128}
                  className={styles.tabelaEmptyImage}
                />
                <p className={styles.tabelaEmptyText}>
                  Nenhum dado encontrado para o ano selecionado
                </p>
              </div>
            ) : (
              <div className={styles.tabelaWrapper}>
                <table className={styles.tabela}>
                  {/* 📋 Cabeçalho da Tabela */}
                  <thead className={styles.tabelaHead}>
                    <tr className={styles.tabelaHeadRow}>
                      <th rowSpan={2} className={styles.tabelaHeadCell}>
                        Categoria
                      </th>
                      {months.map((month) => (
                        <th 
                          key={month.value} 
                          colSpan={2} 
                          className={styles.tabelaHeadCellCenter}
                          onClick={() => navigateToContasByMonth(month.value)}
                          title={`Clique para ver detalhes do mês ${month.label}`}
                        >
                          <div className={styles.tabelaHeadCellCenterGroup}>
                            <span>{month.label}</span>
                            <ExternalLink className={styles.tabelaHeadCellCenterIcon} />
                          </div>
                        </th>
                      ))}
                      <th rowSpan={2} className={styles.tabelaHeadCellTotal}>
                        Total Anual
                      </th>
                    </tr>
                    <tr>
                      {months.map((month) => (
                        <React.Fragment key={`sub-${month.value}`}>
                          <th className={`${styles.tabelaHeadCellSub} ${styles.tabelaHeadCellSubPrevisto}`}>
                            Previsto
                          </th>
                          <th className={`${styles.tabelaHeadCellSub} ${styles.tabelaHeadCellSubRealizado}`}>
                            Realizado
                          </th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dadosFiltrados.tipos.map((tipo) => (
                      <React.Fragment key={tipo.tipo_id}>
                        {/* 🏷️ Linha do Tipo */}
                        <tr 
                          className={`${styles.tabelaBodyRow} ${styles.tabelaBodyRowTipo} ${getTipoColor(tipo.tipo_nome)}`}
                          onClick={() => toggleTipo(tipo.tipo_id)}
                        >
                          <td className={styles.tabelaBodyCell}>
                            <div className={styles.tabelaBodyCellContent}>
                              {expandedTipos.has(tipo.tipo_id) ? (
                                <ChevronDown className={styles.tabelaBodyCellIcon} />
                              ) : (
                                <ChevronRight className={styles.tabelaBodyCellIcon} />
                              )}
                              <span className={styles.tabelaBodyCellText}>{tipo.tipo_nome}</span>
                            </div>
                          </td>
                          {months.map((month) => (
                            <React.Fragment key={month.value}>
                              <td 
                                className={`${styles.tabelaBodyCellValue} ${styles.tabelaBodyCellValuePrevisto}`}
                                onClick={() => navigateToContas(tipo.tipo_nome, '', month.value)}
                                title={`Clique para ver detalhes de ${tipo.tipo_nome} em ${month.label}`}
                              >
                                <div className={styles.tabelaBodyCellValueContent}>
                                  <span className={`${styles.tabelaBodyCellValueText} ${styles.tabelaBodyCellValueTextPrevisto}`}>
                                    {formatCurrency(tipo.valores_mensais[month.value]?.previsto || 0)}
                                  </span>
                                  <ExternalLink className={`${styles.tabelaBodyCellValueIcon} ${styles.tabelaBodyCellValueIconPrevisto}`} />
                                </div>
                              </td>
                              <td 
                                className={`${styles.tabelaBodyCellValue} ${styles.tabelaBodyCellValueRealizado}`}
                                onClick={() => navigateToContasRealizado(tipo.tipo_nome, '', month.value)}
                                title={`Clique para ver detalhes de ${tipo.tipo_nome} realizados em ${month.label} (apenas pagos)`}
                              >
                                <div className={styles.tabelaBodyCellValueContent}>
                                  <span className={`${styles.tabelaBodyCellValueText} ${styles.tabelaBodyCellValueTextRealizado}`}>
                                    {formatCurrency(tipo.valores_mensais[month.value]?.realizado || 0)}
                                  </span>
                                  <ExternalLink className={`${styles.tabelaBodyCellValueIcon} ${styles.tabelaBodyCellValueIconRealizado}`} />
                                </div>
                              </td>
                            </React.Fragment>
                          ))}
                          <td className={styles.tabelaBodyCellTotalAnual}>
                            <div className={styles.tabelaBodyCellTotalAnualContent}>
                              <div className={`${styles.tabelaBodyCellTotalAnualValue} ${styles.tabelaBodyCellTotalAnualValuePrevisto}`}>
                                {formatCurrency(tipo.total_ano_previsto)}
                              </div>
                              <div className={`${styles.tabelaBodyCellTotalAnualValue} ${styles.tabelaBodyCellTotalAnualValueRealizado}`}>
                                {formatCurrency(tipo.total_ano_realizado)}
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* 📂 Categorias (expandidas) */}
                        {expandedTipos.has(tipo.tipo_id) && tipo.categorias.map((categoria) => (
                          <React.Fragment key={categoria.categoria_id}>
                            {/* 📋 Linha da Categoria */}
                            <tr
                              className={`${styles.tabelaBodyRow} ${styles.tabelaBodyRowCategoria}`}
                              onClick={() => toggleCategoria(categoria.categoria_id)}
                            >
                              <td className={styles.tabelaBodyCellCategoria}>
                                <div className={styles.tabelaBodyCellContentCategoria}>
                                  {expandedCategorias.has(categoria.categoria_id) ? (
                                    <ChevronDown className={styles.tabelaBodyCellIconSmall} />
                                  ) : (
                                    <ChevronRight className={styles.tabelaBodyCellIconSmall} />
                                  )}
                                  <span className={styles.tabelaBodyCellTextCategoria}>
                                    {categoria.categoria_nome}
                                  </span>
                                </div>
                              </td>
                              {months.map((month) => (
                                <React.Fragment key={month.value}>
                                  <td 
                                    className={`${styles.tabelaBodyCellValue} ${styles.tabelaBodyCellValuePrevisto}`}
                                    onClick={() => navigateToContas(tipo.tipo_nome, categoria.categoria_nome, month.value)}
                                    title={`Clique para ver detalhes de ${categoria.categoria_nome} em ${month.label}`}
                                  >
                                    <div className={styles.tabelaBodyCellValueContent}>
                                      <span className={`${styles.tabelaBodyCellValueText} ${styles.tabelaBodyCellValueTextPrevisto}`}>
                                        {formatCurrency(categoria.valores_mensais[month.value]?.previsto || 0)}
                                      </span>
                                      <ExternalLink className={`${styles.tabelaBodyCellValueIcon} ${styles.tabelaBodyCellValueIconPrevisto}`} />
                                    </div>
                                  </td>
                                  <td 
                                    className={`${styles.tabelaBodyCellValue} ${styles.tabelaBodyCellValueRealizado}`}
                                    onClick={() => navigateToContasRealizado(tipo.tipo_nome, categoria.categoria_nome, month.value)}
                                    title={`Clique para ver detalhes de ${categoria.categoria_nome} realizados em ${month.label} (apenas pagos)`}
                                  >
                                    <div className={styles.tabelaBodyCellValueContent}>
                                      <span className={`${styles.tabelaBodyCellValueText} ${styles.tabelaBodyCellValueTextRealizado}`}>
                                        {formatCurrency(categoria.valores_mensais[month.value]?.realizado || 0)}
                                      </span>
                                      <ExternalLink className={`${styles.tabelaBodyCellValueIcon} ${styles.tabelaBodyCellValueIconRealizado}`} />
                                    </div>
                                  </td>
                                </React.Fragment>
                              ))}
                              <td className={styles.tabelaBodyCellTotalAnual}>
                                <div className={styles.tabelaBodyCellTotalAnualContent}>
                                  <div className={`${styles.tabelaBodyCellTotalAnualValue} ${styles.tabelaBodyCellTotalAnualValuePrevisto}`}>
                                    {formatCurrency(categoria.total_ano_previsto)}
                                  </div>
                                  <div className={`${styles.tabelaBodyCellTotalAnualValue} ${styles.tabelaBodyCellTotalAnualValueRealizado}`}>
                                    {formatCurrency(categoria.total_ano_realizado)}
                                  </div>
                                </div>
                              </td>
                            </tr>

                            {/* 📝 Subcategorias (expandidas) */}
                            {expandedCategorias.has(categoria.categoria_id) && categoria.subcategorias.map((subcategoria) => (
                              <tr
                                key={subcategoria.subcategoria_id}
                                className={`${styles.tabelaBodyRow} ${styles.tabelaBodyRowSubcategoria}`}
                              >
                                <td className={styles.tabelaBodyCellSubcategoria}>
                                  <div className={styles.tabelaBodyCellContentSubcategoria}>
                                    <div className={styles.tabelaBodyCellIconDot}></div>
                                    <span className={styles.tabelaBodyCellTextSubcategoria}>
                                      {subcategoria.subcategoria_nome}
                                    </span>
                                  </div>
                                </td>
                                {months.map((month) => (
                                  <React.Fragment key={month.value}>
                                    <td 
                                      className={`${styles.tabelaBodyCellValue} ${styles.tabelaBodyCellValuePrevisto}`}
                                      onClick={() => navigateToContas(tipo.tipo_nome, subcategoria.subcategoria_nome, month.value)}
                                      title={`Clique para ver detalhes de ${subcategoria.subcategoria_nome} em ${month.label}`}
                                    >
                                      <div className={styles.tabelaBodyCellValueContent}>
                                        <span className={`${styles.tabelaBodyCellValueText} ${styles.tabelaBodyCellValueTextPrevisto}`}>
                                          {formatCurrency(subcategoria.valores_mensais[month.value]?.previsto || 0)}
                                        </span>
                                        <ExternalLink className={`${styles.tabelaBodyCellValueIcon} ${styles.tabelaBodyCellValueIconPrevisto}`} />
                                      </div>
                                    </td>
                                    <td 
                                      className={`${styles.tabelaBodyCellValue} ${styles.tabelaBodyCellValueRealizado}`}
                                      onClick={() => navigateToContasRealizado(tipo.tipo_nome, subcategoria.subcategoria_nome, month.value)}
                                      title={`Clique para ver detalhes de ${subcategoria.subcategoria_nome} realizados em ${month.label} (apenas pagos)`}
                                    >
                                      <div className={styles.tabelaBodyCellValueContent}>
                                        <span className={`${styles.tabelaBodyCellValueText} ${styles.tabelaBodyCellValueTextRealizado}`}>
                                          {formatCurrency(subcategoria.valores_mensais[month.value]?.realizado || 0)}
                                        </span>
                                        <ExternalLink className={`${styles.tabelaBodyCellValueIcon} ${styles.tabelaBodyCellValueIconRealizado}`} />
                                      </div>
                                    </td>
                                  </React.Fragment>
                                ))}
                                <td className={styles.tabelaBodyCellTotalAnual}>
                                  <div className={styles.tabelaBodyCellTotalAnualContent}>
                                    <div className={`${styles.tabelaBodyCellTotalAnualValue} ${styles.tabelaBodyCellTotalAnualValueSubcategoria}`}>
                                      {formatCurrency(subcategoria.total_ano_previsto)}
                                    </div>
                                    <div className={`${styles.tabelaBodyCellTotalAnualValue} ${styles.tabelaBodyCellTotalAnualValueSubcategoriaRealizado}`}>
                                      {formatCurrency(subcategoria.total_ano_realizado)}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    ))}

                    {/* 📊 Linha de Totais */}
                    <tr className={`${styles.tabelaBodyRow} ${styles.tabelaBodyRowTotal}`}>
                      <td className={styles.tabelaBodyCellTotal}>
                        <span className={styles.tabelaBodyCellTextTotal}>TOTAL GERAL</span>
                      </td>
                      {months.map((month) => (
                        <React.Fragment key={month.value}>
                          <td 
                            className={`${styles.tabelaBodyCellValue} ${styles.tabelaBodyCellValueTotalPrevisto}`}
                            onClick={() => navigateToContas('Total Geral', '', month.value)}
                            title={`Clique para ver todas as transações de ${month.label}`}
                          >
                            <div className={styles.tabelaBodyCellValueContent}>
                              <span className={`${styles.tabelaBodyCellValueText} ${styles.tabelaBodyCellValueTextTotalPrevisto}`}>
                                {formatCurrency(dadosFiltrados.totais_gerais.valores_mensais[month.value]?.previsto || 0)}
                              </span>
                              <ExternalLink className={`${styles.tabelaBodyCellValueIcon} ${styles.tabelaBodyCellValueIconPrevisto}`} />
                            </div>
                          </td>
                          <td 
                            className={`${styles.tabelaBodyCellValue} ${styles.tabelaBodyCellValueTotalRealizado}`}
                            onClick={() => navigateToContasRealizado('Total Geral', '', month.value)}
                            title={`Clique para ver todas as transações realizadas em ${month.label} (apenas pagas)`}
                          >
                            <div className={styles.tabelaBodyCellValueContent}>
                              <span className={`${styles.tabelaBodyCellValueText} ${styles.tabelaBodyCellValueTextTotalRealizado}`}>
                                {formatCurrency(dadosFiltrados.totais_gerais.valores_mensais[month.value]?.realizado || 0)}
                              </span>
                              <ExternalLink className={`${styles.tabelaBodyCellValueIcon} ${styles.tabelaBodyCellValueIconRealizado}`} />
                            </div>
                          </td>
                        </React.Fragment>
                      ))}
                      <td className={styles.tabelaBodyCellTotalAnual}>
                        <div className={styles.tabelaBodyCellTotalAnualContent}>
                          <div className={`${styles.tabelaBodyCellTotalAnualValue} ${styles.tabelaBodyCellTotalAnualValueTotalPrevisto}`}>
                            {formatCurrency(dadosFiltrados.totais_gerais.total_ano_previsto)}
                          </div>
                          <div className={`${styles.tabelaBodyCellTotalAnualValue} ${styles.tabelaBodyCellTotalAnualValueTotalRealizado}`}>
                            {formatCurrency(dadosFiltrados.totais_gerais.total_ano_realizado)}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 📊 Legenda */}
      {!loading && !error && dadosFiltrados && dadosFiltrados.tipos.length > 0 && (
        <Card className={styles.legendaCard}>
          <CardContent className={styles.legendaContent}>
            <div className={styles.legendaItems}>
              <div className={styles.legendaItem}>
                <div className={`${styles.legendaDot} ${styles.legendaDotPrevisto}`}></div>
                <span>Valor Previsto (clicável - filtro por subcategoria)</span>
              </div>
              <div className={styles.legendaItem}>
                <div className={`${styles.legendaDot} ${styles.legendaDotRealizado}`}></div>
                <span>Valor Realizado (clicável - filtro por status "pago")</span>
              </div>
              <div className={styles.legendaItem}>
                <ExternalLink className={styles.legendaIcon} />
                <span>Cabeçalho do mês (clicável - filtro por período)</span>
              </div>
            </div>
            <div className={styles.legendaHelp}>
              <p className={styles.legendaHelpText}>
                💡 <span className={styles.legendaHelpTextStrong}>Navegação:</span> Clique nos valores "Previsto" para filtrar por subcategoria | Clique nos valores "Realizado" para filtrar por status "pago" | Clique no cabeçalho do mês para filtrar por período
              </p>
              {enableDayFilter && selectedDay && (
                <p className={styles.legendaFilterActive}>
                  📅 <span className={styles.legendaFilterActiveStrong}>Filtro Ativo:</span> Mostrando apenas transações com data de vencimento no dia {selectedDay} de cada mês
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Exportação */}
      <ExportarFluxoCaixaMensal
        isOpen={isExportarOpen}
        onClose={() => setIsExportarOpen(false)}
        selectedYear={selectedYear}
        selectedTipo={selectedTipo}
        showRealizadoOnly={showRealizadoOnly}
        dadosConsolidados={dadosFiltrados}
        enableDayFilter={enableDayFilter}
        selectedDay={selectedDay}
      />
    </div>
  );
}
