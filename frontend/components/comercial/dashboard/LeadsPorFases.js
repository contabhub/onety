// components/dashboard/LeadsPorFases.js
import React, { useState, useEffect } from "react";
import { FaFunnelDollar } from "react-icons/fa";
import styles from "./LeadsPorFases.module.css";

const LeadsPorFases = ({ funis = [], selectedMonth, selectedYear }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [funilSelecionado, setFunilSelecionado] = useState(funis[0] || null);
  const [dados, setDados] = useState([]);

  useEffect(() => {
    setIsLoading(true);
    if (funilSelecionado && funilSelecionado.fases) {
      setDados(funilSelecionado.fases);
    } else {
      setDados([]);
    }
    setTimeout(() => setIsLoading(false), 700);
  }, [funilSelecionado, selectedMonth, selectedYear]);

  // Atualiza o funil selecionado se a lista de funis mudar
  useEffect(() => {
    if (funis.length > 0) {
      // Se não há funil selecionado ou o funil selecionado não existe mais na lista
      if (!funilSelecionado || !funis.find(f => f.id === funilSelecionado.id)) {
        setFunilSelecionado(funis[0]);
      } else {
        // Atualiza o funil selecionado com os novos dados filtrados
        const funilAtualizado = funis.find(f => f.id === funilSelecionado.id);
        if (funilAtualizado) {
          setFunilSelecionado(funilAtualizado);
        }
      }
    }
  }, [funis, selectedMonth, selectedYear]);

  // Função para definir cores das fases
  const getFaseColor = (faseNome) => {
    const nome = faseNome.toLowerCase();
    if (nome.includes('ganhou') || nome.includes('won')) return '#00b894';
    if (nome.includes('perdeu') || nome.includes('lost')) return '#d63031';
    if (nome.includes('proposta')) return '#f1c40f';
    if (nome.includes('negociação')) return '#3498db';
    if (nome.includes('contato')) return '#9b59b6';
    return '#95a5a6'; // cor padrão
  };

  if (isLoading) {
    return (
      <div className={styles.funnelChart}>
        <div className={styles.skeletonHeader}>
          <div className={styles.skeletonTitle}></div>
          <div className={styles.skeletonSelect}></div>
        </div>
        <div className={styles.skeletonFases}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={styles.skeletonFaseCard}>
              <div className={styles.skeletonFaseInfo}>
                <div className={styles.skeletonFaseNome}></div>
                <div className={styles.skeletonLeadsCount}></div>
              </div>
              <div className={styles.skeletonProgressBar}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!isLoading && (!dados || dados.length === 0)) {
    return (
      <div className={styles.funnelChart}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>
            {funilSelecionado ? funilSelecionado.nome : 'Selecione um funil'}
          </h3>
          <select
            className={styles.funnelSelect}
            value={funilSelecionado ? funilSelecionado.id : ''}
            onChange={e => {
              const novo = funis.find(f => String(f.id) === e.target.value);
              setFunilSelecionado(novo);
            }}
          >
            {funis.map(f => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </div>
        <div className={styles.noDataMessage}>
          <p>Nenhum lead encontrado neste funil.</p>
          <p>Adicione leads às fases para visualizar o gráfico.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.funnelChart}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>
          <FaFunnelDollar className={styles.tituloIcon} />
          {funilSelecionado ? funilSelecionado.nome : 'Selecione um funil'}
        </h3>
        <select
          className={styles.funnelSelect}
          value={funilSelecionado ? funilSelecionado.id : ''}
          onChange={e => {
            const novo = funis.find(f => String(f.id) === e.target.value);
            setFunilSelecionado(novo);
          }}
        >
          {funis.map(f => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </select>
      </div>
      
             <div className={styles.fasesContainer}>
         {dados.map((fase, index) => (
           <div key={fase.id} className={styles.faseCard}>
             <div className={styles.faseInfo}>
               <span className={styles.faseNome}>{fase.nome}</span>
               <span className={styles.leadsCount}>{fase.leadsCount} leads</span>
             </div>
             {fase.leadsCount > 0 && (
               <div className={styles.progressBar}>
                 <div 
                   className={styles.progressFill} 
                   style={{ 
                     width: `${(fase.leadsCount / Math.max(...dados.map(f => f.leadsCount))) * 100}%`,
                     backgroundColor: getFaseColor(fase.nome)
                   }}
                 ></div>
               </div>
             )}
           </div>
         ))}
       </div>
    </div>
  );
};

export default LeadsPorFases;
