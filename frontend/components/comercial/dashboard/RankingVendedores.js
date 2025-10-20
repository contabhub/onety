import { useState, useEffect } from 'react';
import { FaTrophy, FaMedal, FaUserTie, FaChartBar } from 'react-icons/fa';
import styles from './RankingVendedores.module.css';

// Componente Skeleton para RankingVendedores
const SkeletonRankingVendedores = () => (
  <div className={styles.container}>
    <div className={styles.header}>
      <div className={styles.skeletonTitle}></div>
      <div className={styles.skeletonSubtitle}></div>
    </div>
    
    <div className={styles.rankingContainer}>
      {[1, 2, 3].map(i => (
        <div key={i} className={styles.skeletonVendedorCard}>
          <div className={styles.skeletonPositionContainer}>
            <div className={styles.skeletonPosition}></div>
          </div>
          
          <div className={styles.skeletonVendedorInfo}>
            <div className={styles.skeletonVendedorHeader}>
              <div className={styles.skeletonVendedorNome}></div>
              <div className={styles.skeletonPerformance}></div>
            </div>
            
            <div className={styles.skeletonStats}>
              {[1, 2, 3, 4].map(j => (
                <div key={j} className={styles.skeletonStat}>
                  <div className={styles.skeletonStatLabel}></div>
                  <div className={styles.skeletonStatValue}></div>
                </div>
              ))}
            </div>
            
            <div className={styles.skeletonProgressBar}></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const RankingVendedores = ({ equipeId, selectedMonth, selectedYear }) => {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (equipeId) {
      fetchRanking();
    }
  }, [equipeId, selectedMonth, selectedYear]);

  const fetchRanking = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/leads/ranking-vendedores?empresa_id=${equipeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        let data = await response.json();
        
        // Filtrar leads por período e recalcular estatísticas
        const rankingFiltrado = data.map(vendedor => {
          // Se temos leads individuais, filtrar por período
          if (vendedor.leads && Array.isArray(vendedor.leads)) {
            const leadsFiltrados = vendedor.leads.filter(lead => {
              const createdDate = new Date(lead.criado_em);
              return createdDate.getMonth() === selectedMonth && createdDate.getFullYear() === selectedYear;
            });
            
            // Recalcular estatísticas com os leads filtrados
            const ganhos = leadsFiltrados.filter(l => l.status === 'ganhou').length;
            const abertos = leadsFiltrados.filter(l => l.status === 'aberto').length;
            const perdidos = leadsFiltrados.filter(l => l.status === 'perdeu').length;
            const total = leadsFiltrados.length;
            
            return {
              ...vendedor,
              ganhos,
              abertos,
              perdidos,
              total
            };
          }
          
          return vendedor;
        })
        // Filtrar vendedores sem leads no período
        .filter(v => v.total > 0)
        // Reordenar por ganhos e total
        .sort((a, b) => {
          if (b.ganhos !== a.ganhos) return b.ganhos - a.ganhos;
          return b.total - a.total;
        });
        
        setRanking(rankingFiltrado);
      }
    } catch (error) {
      console.error('Erro ao buscar ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPositionIcon = (index) => {
    switch (index) {
      case 0:
        return <FaTrophy className={styles.gold} />;
      case 1:
        return <FaMedal className={styles.silver} />;
      case 2:
        return <FaMedal className={styles.bronze} />;
      default:
        return <span className={styles.position}>{index + 1}</span>;
    }
  };

  const getPerformanceColor = (ganhos, total) => {
    const taxa = total > 0 ? (ganhos / total) * 100 : 0;
    if (taxa >= 60) return styles.highPerformance;
    if (taxa >= 30) return styles.mediumPerformance;
    return styles.lowPerformance;
  };

  const formatarPercentual = (ganhos, total) => {
    if (total === 0) return '0%';
    return `${((ganhos / total) * 100).toFixed(1)}%`;
  };

  if (loading) {
    return <SkeletonRankingVendedores />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <FaChartBar /> Ranking de Vendedores
        </h3>
        <span className={styles.subtitle}>Performance por responsável</span>
      </div>

      <div className={styles.rankingContainer}>
        {ranking.length > 0 ? (
          ranking.map((vendedor, index) => (
            <div key={vendedor.usuario_id} className={styles.vendedorCard}>
              <div className={styles.positionContainer}>
                {getPositionIcon(index)}
              </div>
              
              <div className={styles.vendedorInfo}>
                <div className={styles.vendedorHeader}>
                  <h4 className={styles.vendedorNome}>
                    {vendedor.avatar_url ? (
                      <img 
                        src={vendedor.avatar_url} 
                        alt={vendedor.responsavel_nome}
                        className={styles.userAvatar}
                      />
                    ) : (
                      <FaUserTie />
                    )} {vendedor.responsavel_nome}
                  </h4>
                  <span className={`${styles.performance} ${getPerformanceColor(vendedor.ganhos, vendedor.total)}`}>
                    {formatarPercentual(vendedor.ganhos, vendedor.total)} de sucesso
                  </span>
                </div>
                
                <div className={styles.stats}>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Total:</span>
                    <span className={styles.statValue}>{vendedor.total}</span>
                  </div>
                  
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Ganhos:</span>
                    <span className={`${styles.statValue} ${styles.ganhos}`}>
                      {vendedor.ganhos}
                    </span>
                  </div>
                  
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Abertos:</span>
                    <span className={`${styles.statValue} ${styles.abertos}`}>
                      {vendedor.abertos}
                    </span>
                  </div>
                  
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Perdidos:</span>
                    <span className={`${styles.statValue} ${styles.perdidos}`}>
                      {vendedor.perdidos}
                    </span>
                  </div>
                </div>
                
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressGanhos}
                    style={{ width: `${vendedor.total > 0 ? (vendedor.ganhos / vendedor.total) * 100 : 0}%` }}
                  ></div>
                  <div 
                    className={styles.progressAbertos}
                    style={{ width: `${vendedor.total > 0 ? (vendedor.abertos / vendedor.total) * 100 : 0}%` }}
                  ></div>
                  <div 
                    className={styles.progressPerdidos}
                    style={{ width: `${vendedor.total > 0 ? (vendedor.perdidos / vendedor.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.empty}>
            <FaUserTie className={styles.emptyIcon} />
            <p>Nenhum vendedor encontrado para esta equipe.</p>
          </div>
        )}
      </div>
      
      {ranking.length > 0 && (
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ backgroundColor: '#10b981' }}></div>
            <span>Ganhos</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ backgroundColor: '#3b82f6' }}></div>
            <span>Abertos</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendColor} style={{ backgroundColor: '#ef4444' }}></div>
            <span>Perdidos</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RankingVendedores; 