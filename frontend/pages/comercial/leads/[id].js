import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import PrincipalSidebar from '../../../components/onety/principal/PrincipalSidebar';
import SpaceLoader from '../../../components/onety/menu/SpaceLoader';
import styles from '../../../styles/comercial/crm/LeadDetails.module.css';
import LeadStageBar from '../../../components/comercial/crm/LeadStageBar';
import LeadInfoCard from '../../../components/comercial/crm/LeadInfoCard';
import NotaAtividadeCard from "../../../components/comercial/crm/NotaAtividadeCard";
import LeadTimeline from '../../../components/comercial/crm/LeadTimeline';
import PendentesAtividades from '../../../components/comercial/crm/PendentesAtividades';
import LeadDataCard from '../../../components/comercial/crm/LeadDataCard';
import { registrarHistorico } from '../../../utils/registrarHistorico';
import ChangeTemperature from "../../../components/comercial/crm/ChangeTemperature";
import LeadContacts from "../../../components/comercial/crm/LeadContacts";
import LeadCompanies from "../../../components/comercial/crm/LeadCompanies";
import LeadFiles from "../../../components/comercial/crm/LeadFiles";
import LeadProducts from "../../../components/comercial/crm/LeadProducts";
import Propostas from "../../../components/comercial/crm/Propostas";
import Comunications from "../../../components/comercial/crm/Comunications";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";




export default function LeadDetails() {
  const router = useRouter();
  const { id } = router.query;

  const [lead, setLead] = useState(null);
  const [fasesDoFunil, setFasesDoFunil] = useState([]);
  const [atividadesPendentes, setAtividadesPendentes] = useState([]);
  const [reloadTrigger, setReloadTrigger] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);

  const fetchLead = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/leads/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Verificar se a resposta é válida antes de tentar fazer parse do JSON
      if (!res.ok) {
        console.error('Erro na resposta da API:', res.status, res.statusText);
        alert(`Erro ao carregar lead: ${res.status} - ${res.statusText}`);
        setIsLoading(false);
        return;
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Resposta não é JSON:', contentType);
        alert('Erro: Resposta inválida do servidor');
        setIsLoading(false);
        return;
      }

      const leadData = await res.json();
      setLead(leadData);
      setIsLoading(false);

    } catch (error) {
      console.error('Erro ao buscar lead:', error);
      alert(`Erro ao carregar lead: ${error.message}`);
      setIsLoading(false);
    }
  };

  // 🔄 useEffect para carregar o lead
  useEffect(() => {
    if (id) {
      fetchLead();
      fetchAtividadesPendentes();
      setReloadTrigger(Date.now());
    }
  }, [id]);


  useEffect(() => {
    if (!lead || !lead.funil_id) return;

    const fetchFases = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funil-fases/${lead.funil_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const fases = await res.json();
        setFasesDoFunil(fases);
      } catch (error) {
        console.error('Erro ao buscar fases do funil:', error);
      }
    };

    fetchFases();
  }, [lead]);

  // Buscar as atividades pendentes para o lead
  const fetchAtividadesPendentes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/atividades/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const atividades = await res.json();

      if (!Array.isArray(atividades)) {
        console.error('A resposta não é um array:', atividades);
        setAtividadesPendentes([]); // Evita travar a página
        return;
      }

      const pendentes = atividades.filter(atividade => atividade.status === "pendente");
      setAtividadesPendentes(pendentes);
    } catch (error) {
      console.error('Erro ao buscar atividades pendentes:', error);
      setAtividadesPendentes([]);
    }
  };

  const handleUpdateTemperatura = (novaTemperatura) => {
    // Atualiza o lead com a nova temperatura
    console.log(`Temperatura do lead atualizada para: ${novaTemperatura}`);
  };


  return (
    <>
      <div className={styles.page}>
        <PrincipalSidebar />
        <div className={styles.pageContent}>
      {isLoading || !lead ? (
        <SpaceLoader label="Carregando lead..." />
      ) : (
      <>
      {/* <button className={styles.backButton} onClick={() => router.back()}>
        <FontAwesomeIcon icon={faArrowLeft} /> Voltar
      </button> */}
      <div className={styles.background}>
        {fasesDoFunil.length > 0 && (
          <LeadStageBar
            fases={fasesDoFunil}
            faseAtualId={lead.funil_fase_id}
            onChangeFase={async (novaFaseId) => {
              if (!novaFaseId || novaFaseId === undefined || novaFaseId === null) {
                alert('Erro: ID da fase inválido. Tente novamente.');
                return;
              }

              const faseIdNumerico = parseInt(novaFaseId, 10);
              if (isNaN(faseIdNumerico)) {
                alert('Erro: ID da fase deve ser um número válido.');
                return;
              }
              
              if (faseIdNumerico === lead.funil_fase_id) {
                return;
              }

              try {
                const token = localStorage.getItem('token');
                const userRaw = localStorage.getItem('userData');
                const user = userRaw ? JSON.parse(userRaw) : null;
                const usuario_id = user?.id;

                const faseAnterior = fasesDoFunil.find(f => f.id === lead.funil_fase_id)?.nome || "Fase anterior";
                const novaFase = fasesDoFunil.find(f => f.id === faseIdNumerico)?.nome || "Nova fase";

                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/leads/${lead.id}/mover-fase`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ fase_funil_id: faseIdNumerico }),
                });

                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(`Erro ${response.status}: ${errorData.error || response.statusText}`);
                }

                // 🔄 Registrar no histórico
                await registrarHistorico({
                  lead_id: lead.id,
                  usuario_id,
                  tipo: "movimentacao",
                  titulo: "Lead movido de fase",
                  descricao: `Lead movido de "${faseAnterior}" para "${novaFase}"`,
                  token,
                });

                setLead((prev) => ({ ...prev, funil_fase_id: faseIdNumerico }));
                setReloadTrigger(Date.now());
                
              } catch (error) {
                console.error('Erro ao mover lead de fase:', error);
                alert(`Erro ao mover lead de fase: ${error.message}`);
              }
            }}
          />
        )}
        <div className={styles.leadDetailsGrid}>
          {/* 🟦 Coluna da esquerda */}
          <div className={styles.leftColumn}>
            <LeadInfoCard lead={lead} onUpdated={fetchLead} />

            <LeadDataCard leadDetails={lead} />
          </div>

          {/* 🟩 Coluna central */}
          <div className={styles.centerColumn}>


            <div className={styles.placeholderCard}>
              <NotaAtividadeCard leadId={lead.id} onCreated={() => {
                fetchLead();
                fetchAtividadesPendentes();
                setReloadTrigger(Date.now());
              }} />
            </div>
            <PendentesAtividades
              atividadesPendentes={atividadesPendentes}
              leadId={lead.id}
              onUpdated={() => {
                fetchLead();
                fetchAtividadesPendentes();
                setReloadTrigger(Date.now());
              }} />

            <div className={styles.placeholderCard}>
              <Comunications leadId={lead.id} />
            </div>

            <div className={styles.timelineScroll}>
              <LeadTimeline leadId={lead.id} reloadTrigger={reloadTrigger} />
            </div>
          </div>

          {/* 🟥 Coluna da direita */}
          <div className={styles.rightColumn}>
            <div className={styles.placeholderCard}>
              <LeadContacts leadId={lead.id} />
            </div>

            <div className={styles.placeholderCard}>
              <LeadCompanies leadId={lead.id} />
            </div>

            <div className={styles.placeholderCard}>
              <ChangeTemperature
                leadId={lead.id}
                temperaturaAtual={lead.temperatura}
                onUpdate={handleUpdateTemperatura}
              />
            </div>
            <div className={styles.placeholderCard}>
              <LeadProducts leadId={lead.id} />
            </div>

            <div className={styles.placeholderCard}>
              <Propostas leadId={lead.id} />
            </div>

            <div className={styles.placeholderCard}>
              <LeadFiles leadId={lead.id} />
            </div>
          </div>
        </div>
      </div>
      </>
      )}
        </div>
      </div>
    </>
  );
}
