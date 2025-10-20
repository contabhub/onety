import { useEffect, useState } from "react";
import styles from "./AtividadesPorTipo.module.css";
import { FaCalendarCheck } from "react-icons/fa";

export default function AtividadesPorTipo() {
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
        setItens(Array.isArray(data) ? data : []);
      } catch (e) {
        setItens([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

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


