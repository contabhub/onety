import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../../components/layout/Layout';
import styles from '../../styles/LeadDetails.module.css';
import LeadStageBar from '../../components/crm/LeadStageBar';
import LeadInfoCard from '../../components/crm/LeadInfoCard';
import NotaAtividadeCard from "../../components/crm/NotaAtividadeCard";
import LeadTimeline from '../../components/crm/LeadTimeline';
import PendentesAtividades from '../../components/crm/PendentesAtividades';
import LeadDataCard from '../../components/crm/LeadDataCard';
import { registrarHistorico } from '../../utils/registrarHistorico';
import ChangeTemperature from "../../components/crm/ChangeTemperature";
import LeadContacts from "../../components/crm/LeadContacts";
import LeadCompanies from "../../components/crm/LeadCompanies";
import LeadFiles from "../../components/crm/LeadFiles";
import LeadProducts from "../../components/crm/LeadProducts";
import Propostas from "../../components/crm/Propostas";
import Comunications from "../../components/crm/Comunications";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import meuLottieJson from '../../assets/Loading.json';
import Lottie from 'lottie-react';




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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/leads/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const leadData = await res.json();
      setLead(leadData);
      setIsLoading(false);

    } catch (error) {
      console.error('Erro ao buscar lead:', error);
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
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/funil_fases/${lead.funil_id}`, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/atividades/${id}`, {
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


  if (isLoading || !lead) {
    return (
      <div className={styles.spinnerContainer}>
          <Lottie 
            animationData={meuLottieJson} 
            loop={true}
            style={{ width: 200, height: 200 }}
          />
                  <p>Carregando lead...</p>
      </div>
    );
  }

  return (
    <Layout>
      <button className={styles.backButton} onClick={() => router.back()}>
        <FontAwesomeIcon icon={faArrowLeft} /> Voltar
      </button>
      <div className={styles.background}>
        {fasesDoFunil.length > 0 && (
          <LeadStageBar
            fases={fasesDoFunil}
            faseAtualId={lead.fase_funil_id}
            onChangeFase={async (novaFaseId) => {
              if (novaFaseId === lead.fase_funil_id) return;

              const token = localStorage.getItem('token');
              const user = JSON.parse(localStorage.getItem('user'));
              const usuario_id = user?.id;

              const faseAnterior = fasesDoFunil.find(f => f.id === lead.fase_funil_id)?.nome || "Fase anterior";
              const novaFase = fasesDoFunil.find(f => f.id === novaFaseId)?.nome || "Nova fase";

              await fetch(`${process.env.NEXT_PUBLIC_API_URL}/leads/${lead.id}/mover-fase`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ fase_funil_id: novaFaseId }),
              });

              // 🔄 Registrar no histórico
              await registrarHistorico({
                lead_id: lead.id,
                usuario_id,
                tipo: "movimentacao",
                titulo: "Lead movido de fase",
                descricao: `Lead movido de "${faseAnterior}" para "${novaFase}"`,
                token,
              });

              setLead((prev) => ({ ...prev, fase_funil_id: novaFaseId }));
              setReloadTrigger(Date.now()); // Atualiza a timeline
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

            <Comunications leadId={lead.id} />

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
    </Layout>
  );
}
