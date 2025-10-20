import { useState, useEffect } from 'react';
import { FaFilter, FaCalendar, FaUser, FaSearch, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import styles from './LeadsFilter.module.css';

// Componente Skeleton para LeadsFilter
const SkeletonLeadsFilter = () => (
  <div className={styles.container}>
    <div className={styles.header}>
      <div className={styles.skeletonTitle}></div>
      <div className={styles.skeletonTotal}></div>
    </div>
    
    <div className={styles.skeletonLeads}>
      {[1, 2, 3].map(i => (
        <div key={i} className={styles.skeletonLeadCard}>
          <div className={styles.skeletonLeadHeader}>
            <div className={styles.skeletonLeadNome}></div>
            <div className={styles.skeletonStatus}></div>
          </div>
          <div className={styles.skeletonLeadInfo}>
            {[1, 2, 3, 4, 5].map(j => (
              <div key={j} className={styles.skeletonInfoItem}></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const LeadsFilter = ({ equipeId, selectedMonth, selectedYear }) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    responsavel: '',
    status: ''
  });
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    dataInicio: '',
    dataFim: '',
    responsavel: '',
    status: ''
  });
  const [responsaveis, setResponsaveis] = useState([]);

  useEffect(() => {
    if (equipeId) {
      fetchLeads();
      fetchResponsaveis();
    }
  }, [equipeId, filtrosAplicados, selectedMonth, selectedYear]);

  const fetchLeads = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL}/comercial/leads/empresa/${equipeId}`;
      const params = new URLSearchParams();
      
      if (filtrosAplicados.dataInicio) params.append('data_inicio', filtrosAplicados.dataInicio);
      if (filtrosAplicados.dataFim) params.append('data_fim', filtrosAplicados.dataFim);
      if (filtrosAplicados.responsavel) params.append('responsavel', filtrosAplicados.responsavel);
      if (filtrosAplicados.status) params.append('status', filtrosAplicados.status);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

        console.log('🔍 Filtros aplicados:', filtrosAplicados);
      console.log('🌐 URL da requisição:', url);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        let data = await response.json();
        console.log('📊 Dados recebidos:', data);
        console.log('📈 Total de leads:', data.length);
        
        // Filtro por período (mês/ano) do dashboard
        if (selectedMonth !== undefined && selectedYear !== undefined) {
          data = data.filter(lead => {
            const createdDate = new Date(lead.criado_em || lead.created_at);
            return createdDate.getMonth() === selectedMonth && createdDate.getFullYear() === selectedYear;
          });
        }
        
        // Filtro no frontend como fallback
        if (filtrosAplicados.responsavel || filtrosAplicados.status || filtrosAplicados.dataInicio || filtrosAplicados.dataFim) {
          data = data.filter(lead => {
            // Filtro por responsável
            if (filtrosAplicados.responsavel && lead.responsavel_nome !== filtrosAplicados.responsavel) {
              return false;
            }
            
            // Filtro por status
            if (filtrosAplicados.status && lead.status?.toLowerCase() !== filtrosAplicados.status.toLowerCase()) {
              return false;
            }
            
            // Filtro por data início
            if (filtrosAplicados.dataInicio) {
              const dataCriacao = new Date(lead.criado_em);
              const dataInicio = new Date(filtrosAplicados.dataInicio);
              if (dataCriacao < dataInicio) {
                return false;
              }
            }
            
            // Filtro por data fim
            if (filtrosAplicados.dataFim) {
              const dataCriacao = new Date(lead.criado_em);
              const dataFim = new Date(filtrosAplicados.dataFim);
              if (dataCriacao > dataFim) {
                return false;
              }
            }
            
            return true;
          });
          
          console.log('🎯 Leads após filtro frontend:', data);
        }
        
        setLeads(data);
      } else {
        console.error('❌ Erro na resposta:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('📄 Resposta de erro:', errorText);
      }
    } catch (error) {
      console.error('💥 Erro ao buscar leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResponsaveis = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/leads/empresa/${equipeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const responsaveisUnicos = [...new Set(data.map(lead => lead.responsavel_nome))].filter(Boolean);
        setResponsaveis(responsaveisUnicos);
      }
    } catch (error) {
      console.error('Erro ao buscar responsáveis:', error);
    }
  };

  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
  };

  const aplicarFiltros = () => {
    setFiltrosAplicados({ ...filtros });
  };

  const limparFiltros = () => {
    const filtrosLimpos = {
      dataInicio: '',
      dataFim: '',
      responsavel: '',
      status: ''
    };
    setFiltros(filtrosLimpos);
    setFiltrosAplicados(filtrosLimpos);
  };

  const toggleFiltros = () => {
    setFiltrosAbertos(!filtrosAbertos);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'ganhou': return styles.statusGanhou;
      case 'perdeu': return styles.statusPerdeu;
      case 'aberto': return styles.statusAberto;
      default: return styles.statusDefault;
    }
  };

  const formatarValor = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor || 0);
  };

  if (loading) {
    return <SkeletonLeadsFilter />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <FaSearch /> Filtro de Negócios
        </h3>
        <div className={styles.headerActions}>
          <span className={styles.total}>{leads.length} negócios encontrados</span>
          <button 
            className={styles.btnFiltros}
            onClick={toggleFiltros}
          >
            <FaFilter />
            Filtros
            {filtrosAbertos ? <FaChevronUp /> : <FaChevronDown />}
          </button>
        </div>
      </div>

      {/* Filtros - Colapsável */}
      <div className={`${styles.filtrosContainer} ${filtrosAbertos ? styles.filtrosAbertos : ''}`}>
        <div className={styles.filtros}>
          <div className={styles.filtroGrupo}>
            <label>
              <FaCalendar /> Data Início
            </label>
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => handleFiltroChange('dataInicio', e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.filtroGrupo}>
            <label>
              <FaCalendar /> Data Fim
            </label>
            <input
              type="date"
              value={filtros.dataFim}
              onChange={(e) => handleFiltroChange('dataFim', e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.filtroGrupo}>
            <label>
              <FaUser /> Responsável
            </label>
            <select
              value={filtros.responsavel}
              onChange={(e) => handleFiltroChange('responsavel', e.target.value)}
              className={styles.select}
            >
              <option value="">Todos os responsáveis</option>
              {responsaveis.map((resp, index) => (
                <option key={index} value={resp}>{resp}</option>
              ))}
            </select>
          </div>

          <div className={styles.filtroGrupo}>
            <label>Status</label>
            <select
              value={filtros.status}
              onChange={(e) => handleFiltroChange('status', e.target.value)}
              className={styles.select}
            >
              <option value="">Todos os status</option>
              <option value="aberto">Aberto</option>
              <option value="ganhou">Ganhou</option>
              <option value="perdeu">Perdeu</option>
            </select>
          </div>

          <div className={styles.filtroAcoes}>
            <button onClick={aplicarFiltros} className={styles.btnAplicar}>
              Aplicar Filtros
            </button>
            <button onClick={limparFiltros} className={styles.btnLimpar}>
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Leads */}
      <div className={styles.listaContainer}>
        <div className={styles.lista}>
          {leads.length > 0 ? (
            leads.map((lead) => (
              <div key={lead.id} className={styles.leadCard}>
                <div className={styles.leadHeader}>
                  <h4 className={styles.leadNome}>{lead.nome}</h4>
                  <span className={`${styles.status} ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </span>
                </div>
                
                <div className={styles.leadInfo}>
                  <div className={styles.infoItem}>
                    <strong>Responsável:</strong> {lead.responsavel_nome || 'Não definido'}
                  </div>
                  <div className={styles.infoItem}>
                    <strong>Valor:</strong> {formatarValor(lead.valor)}
                  </div>
                  <div className={styles.infoItem}>
                    <strong>Funil:</strong> {lead.funil_nome || 'Não definido'}
                  </div>
                  <div className={styles.infoItem}>
                    <strong>Fase:</strong> {lead.fase_nome || 'Não definido'}
                  </div>
                  <div className={styles.infoItem}>
                    <strong>Criado:</strong> {new Date(lead.criado_em).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.empty}>
              Nenhum negócio encontrado com os filtros aplicados.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadsFilter; 