import { useEffect, useState } from "react";
import styles from "./AtividadesPorTipo.module.css";
import { FaCalendarCheck } from "react-icons/fa";

export default function AtividadesPorTipo({ selectedMonth, selectedYear }) {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = localStorage.getItem('token');
        const userRaw = localStorage.getItem('userData') || localStorage.getItem('user');
        if (!token || !userRaw) return;
        const parsedUser = JSON.parse(userRaw);
        const empresaId = parsedUser?.EmpresaId || parsedUser?.empresa_id || parsedUser?.empresa?.id;
        if (!empresaId) return;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/atividades/empresa/${empresaId}/por-tipo`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        // Filtrar atividades por período e recalcular estatísticas
        let filteredData = Array.isArray(data) ? data : [];
        if (selectedMonth !== undefined && selectedYear !== undefined) {
          filteredData = filteredData.map(tipo => {
            // Se temos atividades individuais, filtrar por período
            if (tipo.atividades && Array.isArray(tipo.atividades)) {
              const atividadesFiltradas = tipo.atividades.filter(atividade => {
                const createdDate = new Date(atividade.criado_em);
                return createdDate.getMonth() === selectedMonth && createdDate.getFullYear() === selectedYear;
              });
              
              // Recalcular estatísticas com as atividades filtradas
              const total = atividadesFiltradas.length;
              const pendente = atividadesFiltradas.filter(a => a.status === 'pendente').length;
              const concluida = atividadesFiltradas.filter(a => a.status === 'concluida').length;
              
              return {
                ...tipo,
                total,
                pendente,
                concluida
              };
            }
            
            return tipo;
          })
          // Filtrar tipos sem atividades no período
          .filter(tipo => tipo.total > 0);
        }
        
        setItens(filteredData);
      } catch (e) {
        setItens([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedMonth, selectedYear]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}><FaCalendarCheck className={styles.tituloIcon} />Atividades por Tipo</h3>
      </div>
      {loading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : itens.length === 0 ? (
        <div className={styles.empty}>Nenhum tipo cadastrado.</div>
      ) : (
        <div className={styles.list}>
          {itens.map((t) => {
            const total = Number(t.total || 0);
            const pend = Number(t.pendente || 0);
            const concl = Number(t.concluida || 0);
            const pct = total > 0 ? (concl / total) * 100 : 0;
            return (
              <div key={t.tipo_id} className={styles.itemCard}>
                <div className={styles.itemRow}>
                  <span className={styles.itemName}>{t.tipo_nome}</span>
                  <span className={styles.itemTotal}>{total}</span>
                </div>
                <div className={styles.subInfo}>pendentes: {pend} • concluídas: {concl}</div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


