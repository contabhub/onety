import { useEffect, useState } from 'react';
import styles from '../../../styles/comercial/crm/LeadTimeline.module.css';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, CheckCircle, MoveRight, MoreVertical } from 'lucide-react';
import SpaceLoader from '../../onety/menu/SpaceLoader';




export default function LeadTimeline({ leadId, reloadTrigger }) {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/historico-leads/${leadId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setHistorico(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erro ao carregar histórico:", err);
        setLoading(false);
      });
  }, [leadId, reloadTrigger]);

  return (
    <div className={styles.timelineContainer}>
      <h3 className={styles.headerWithIcon}>
        <span className={styles.iconContainer}>
          <MoreVertical size={20} />
        </span>
        Linha do Tempo
      </h3>

      {loading ? (
        <SpaceLoader label="Carregando histórico..." size={100} minHeight={150} />
      ) : (
<>
      {historico.map((item) => (
        <div key={item.id} className={styles.timelineItem}>
          <div className={`${styles.iconWrapper} 
  ${item.tipo === 'nota' ? styles.notaIcon :
              item.tipo === 'atividade' ? styles.atividadeIcon :
                item.tipo === 'movimentacao' ? styles.movimentacaoIcon : ''
            }`}
          >
            {item.tipo === 'nota' && <FileText size={18} />}
            {item.tipo === 'atividade' && <CheckCircle size={18} />}
            {item.tipo === 'movimentacao' && <MoveRight size={18} />}
          </div>



          <div className={styles.content}>
            <div className={styles.header}>
              <strong>{item.titulo}</strong>
              <span>
                {item.criado_em
                  ? format(new Date(item.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : null}
              </span>
            </div>
            <p>{item.descricao}</p>
            {item.full_name && (
              <div className={styles.usuario}>
                {item.avatar_url && (
                  <img src={item.avatar_url} alt="avatar" className={styles.avatar} />
                )}
                <span>{item.full_name}</span>
              </div>
            )}
          </div>
        </div>
      ))}
      </>
      )}
      
    </div>
  );
}
