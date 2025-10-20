import { useEffect, useState } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import { useRouter } from "next/router";
import styles from "../../styles/comercial/dashboard/Dashboard.module.css";
import dashStyles from "../../styles/atendimento/dashboard.module.css";
import {
  FaComments,
  FaCheckCircle,
  FaClock,
  FaUsers,
  FaEnvelopeOpenText,
  FaWhatsapp,
} from "react-icons/fa";
import CountUp from "react-countup";
import SkeletonCard from "../../components/onety/skeleton/SkeletonCard";
import Select from 'react-select';

export default function DashboardAtendimento() {
  const router = useRouter();

  const [kpiData, setKpiData] = useState({
    totalConversas: 0,
    conversasAbertas: 0,
    conversasFechadas: 0,
    mensagensNaoLidas: 0,
    agentesAtivos: 0,
    tempoMedioResposta: 0,
  });

  const [conversasPorStatus, setConversasPorStatus] = useState({
    aberta: 0,
    fechada: 0,
    novos: 0,
  });

  const [rankingAgentes, setRankingAgentes] = useState([]);
  const [instancias, setInstancias] = useState([]);
  const [conversasAguardando, setConversasAguardando] = useState([]);
  const [equipes, setEquipes] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedEquipe, setSelectedEquipe] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingAgentes, setLoadingAgentes] = useState(true);
  const [loadingInstancias, setLoadingInstancias] = useState(true);

  useEffect(() => {
    async function fetchAllDashboardData() {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const userRaw = localStorage.getItem("userData") || localStorage.getItem("user");
        if (!userRaw) return;
        const parsedUser = JSON.parse(userRaw);
        const empresaId = parsedUser?.EmpresaId || parsedUser?.empresa_id || parsedUser?.empresa?.id;
        if (!empresaId) return;

        // Buscar todas as conversas da empresa
        const resConversas = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/atendimento/conversas/company/${empresaId}/all`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!resConversas.ok) throw new Error("Erro ao buscar conversas.");

        const conversasData = await resConversas.json();
        const conversas = conversasData.conversations || [];

        // Processar KPIs
        const totalConversas = conversas.length;
        const conversasAbertas = conversas.filter(c => c.status === 'aberta').length;
        const conversasFechadas = conversas.filter(c => c.status === 'fechada').length;
        const conversasNovos = conversas.filter(c => !c.assigned_user_id && c.status !== 'fechada').length;
        
        // Calcular total de mensagens não lidas
        const mensagensNaoLidas = conversas.reduce((acc, conv) => {
          return acc + (conv.unread_count || 0);
        }, 0);

        // Contar agentes únicos que possuem conversas atribuídas
        const agentesUnicos = new Set(
          conversas
            .filter(c => c.assigned_user_id && c.status !== 'fechada')
            .map(c => c.assigned_user_id)
        );
        const agentesAtivos = agentesUnicos.size;

        // Calcular tempo médio de resposta (simplificado - baseado em updated_at - created_at)
        let tempoMedioResposta = 0;
        const conversasComTempo = conversas.filter(c => c.created_at && c.updated_at);
        if (conversasComTempo.length > 0) {
          const tempoTotal = conversasComTempo.reduce((acc, conv) => {
            const created = new Date(conv.created_at);
            const updated = new Date(conv.updated_at);
            const diff = (updated - created) / (1000 * 60); // em minutos
            return acc + diff;
          }, 0);
          tempoMedioResposta = Math.round(tempoTotal / conversasComTempo.length);
        }

        // Atualizar KPIs
        setKpiData({
          totalConversas,
          conversasAbertas,
          conversasFechadas,
          mensagensNaoLidas,
          agentesAtivos,
          tempoMedioResposta,
        });

        // Conversas por status para gráfico
        setConversasPorStatus({
          aberta: conversasAbertas,
          fechada: conversasFechadas,
          novos: conversasNovos,
        });

        // Conversas aguardando (sem agente há mais de 2h)
        const agora = new Date();
        const aguardando = conversas
          .filter(c => {
            if (c.assigned_user_id || c.status === 'fechada') return false;
            const created = new Date(c.created_at);
            const horasAguardando = (agora - created) / (1000 * 60 * 60);
            return horasAguardando >= 2;
          })
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          .slice(0, 5);
        
        setConversasAguardando(aguardando);

        // Ranking de agentes
        await fetchRankingAgentes(empresaId, conversas);

      } catch (err) {
        console.error("Erro ao buscar dados do dashboard:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAllDashboardData();
  }, []);

  // Buscar ranking de agentes
  const fetchRankingAgentes = async (empresaId, conversas) => {
    try {
      setLoadingAgentes(true);
      const token = localStorage.getItem("token");

      // Buscar usuários da empresa
      const resUsers = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/atendimento/usuarios/company/${empresaId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const usersData = await resUsers.json();
      const usuarios = usersData.users || [];

      // Calcular estatísticas por agente
      const ranking = usuarios.map(usuario => {
        const conversasDoAgente = conversas.filter(c => 
          c.assigned_user_id === usuario.id
        );
        
        const conversasAbertas = conversasDoAgente.filter(c => c.status === 'aberta').length;
        const conversasFechadas = conversasDoAgente.filter(c => c.status === 'fechada').length;
        const total = conversasDoAgente.length;
        const taxaFinalizacao = total > 0 ? (conversasFechadas / total) * 100 : 0;

        // Calcular tempo médio de atendimento
        const conversasComTempo = conversasDoAgente.filter(c => c.created_at && c.updated_at);
        let tma = 0;
        if (conversasComTempo.length > 0) {
          const tempoTotal = conversasComTempo.reduce((acc, conv) => {
            const created = new Date(conv.created_at);
            const updated = new Date(conv.updated_at);
            const diff = (updated - created) / (1000 * 60);
            return acc + diff;
          }, 0);
          tma = Math.round(tempoTotal / conversasComTempo.length);
        }

        return {
          id: usuario.id,
          nome: usuario.nome || usuario.full_name || 'Sem nome',
          avatar_url: usuario.avatar_url,
          conversasAbertas,
          conversasFechadas,
          total,
          taxaFinalizacao: taxaFinalizacao.toFixed(1),
          tma,
        };
      });

      // Ordenar por total de conversas (mais ativo)
      const rankingOrdenado = ranking
        .filter(r => r.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      setRankingAgentes(rankingOrdenado);
    } catch (err) {
      console.error("Erro ao buscar ranking de agentes:", err);
    } finally {
      setLoadingAgentes(false);
    }
  };

  // Buscar instâncias WhatsApp
  useEffect(() => {
    async function fetchInstancias() {
      setLoadingInstancias(true);
      const token = localStorage.getItem("token");
      const userRaw = localStorage.getItem("userData") || localStorage.getItem("user");
      if (!userRaw) return;

      const parsedUser = JSON.parse(userRaw);
      const empresaId = parsedUser?.EmpresaId || parsedUser?.empresa_id || parsedUser?.empresa?.id;
      if (!empresaId) return;

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/atendimento/instancias/empresa/${empresaId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.ok) {
          const data = await res.json();
          setInstancias(data);
        }
      } catch (err) {
        console.error("Erro ao buscar instâncias:", err);
      } finally {
        setLoadingInstancias(false);
      }
    }

    fetchInstancias();
  }, []);

  useEffect(() => {
    const userRaw = localStorage.getItem('userData') || localStorage.getItem('user');
    if (userRaw) {
      const userObj = JSON.parse(userRaw);
      setUser(userObj);

      const isSuperadmin = Array.isArray(userObj?.permissoes?.adm) && userObj.permissoes.adm.includes('superadmin');
      if (isSuperadmin) {
        fetchEquipes(userObj.id);
      }
    }
  }, []);

  const fetchEquipes = async (userId) => {
    const token = localStorage.getItem('token');
    if (!token || !userId) return;
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/usuarios/${userId}/empresas`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erro ao buscar equipes');
      const data = await res.json();
      setEquipes(data);
      
      const userRaw = localStorage.getItem('userData') || localStorage.getItem('user');
      if (userRaw) {
        const userObj = JSON.parse(userRaw);
        const empresaAtual = userObj?.EmpresaId || userObj?.empresa_id || userObj?.empresa?.id;
        const atual = data.find(eq => eq.id === empresaAtual);
        if (atual) setSelectedEquipe({
          value: atual.id,
          label: atual.nome,
          cargo_id: atual.cargo_id,
          cargo_nome: atual.cargo_nome,
          departamento_id: atual.departamento_id,
          departamento_nome: atual.departamento_nome
        });
      }
    } catch (err) {
      setEquipes([]);
    }
  };

  const handleTrocarEquipe = (option) => {
    if (!option) return;
    const userRaw = localStorage.getItem('userData') || localStorage.getItem('user');
    if (!userRaw) return;
    const userObj = JSON.parse(userRaw);
    const updatedUser = {
      ...userObj,
      EmpresaId: option.value,
      EmpresaNome: option.label,
      cargo_id: option.cargo_id,
      cargo_nome: option.cargo_nome,
      departamento_id: option.departamento_id,
      departamento_nome: option.departamento_nome
    };
    localStorage.setItem('userData', JSON.stringify(updatedUser));
    window.location.reload();
  };

  // Função para formatar tempo em minutos
  const formatarTempo = (minutos) => {
    if (minutos < 60) return `${minutos}min`;
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h ${mins}min`;
  };

  // Função para obter iniciais do nome
  const getInitials = (nome) => {
    if (!nome) return 'A';
    return nome.split(' ').map(word => word.charAt(0)).join('').toUpperCase().substring(0, 2);
  };

  // Função para formatar data/hora relativa
  const formatarTempoRelativo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) return `${diffMinutes}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} dia${diffDays > 1 ? 's' : ''} atrás`;
  };

  return (
    <div className={styles.container}>
      <PrincipalSidebar />
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard - Atendimento</h1>
        {Array.isArray(user?.permissoes?.adm) && user.permissoes.adm.includes('superadmin') && (
          <div className={styles.equipeSelectWrapper}>
            <Select
              classNamePrefix="react-select"
              options={equipes.map(eq => ({
                value: eq.id,
                label: eq.nome,
                cargo_id: eq.cargo_id,
                cargo_nome: eq.cargo_nome,
                departamento_id: eq.departamento_id,
                departamento_nome: eq.departamento_nome
              }))}
              value={selectedEquipe}
              onChange={handleTrocarEquipe}
              placeholder="Trocar de empresa..."
              isClearable={false}
              isSearchable
              styles={{
                container: base => ({ ...base, minWidth: 240, maxWidth: 320 }),
                control: (base, state) => ({
                  ...base,
                  backgroundColor: 'var(--onity-color-surface)',
                  border: '1px solid var(--onity-color-border)',
                  borderRadius: '8px',
                  boxShadow: 'var(--onity-elev-med)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'var(--onity-color-border)',
                  },
                  ...(state.isFocused && {
                    borderColor: 'var(--onity-color-primary)',
                    boxShadow: '0 0 0 2px color-mix(in srgb, var(--onity-color-primary) 20%, transparent)',
                  }),
                }),
                menu: base => ({
                  ...base,
                  backgroundColor: 'var(--onity-color-surface)',
                  border: '1px solid var(--onity-color-border)',
                  borderRadius: '8px',
                  boxShadow: 'var(--onity-elev-med)',
                  marginTop: '4px',
                }),
                option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isSelected
                    ? 'var(--onity-color-primary)'
                    : state.isFocused
                      ? 'color-mix(in srgb, var(--onity-color-primary) 12%, transparent)'
                      : 'var(--onity-color-surface)',
                  color: state.isSelected
                    ? 'var(--onity-color-primary-contrast)'
                    : 'var(--onity-color-text)',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  '&:hover': {
                    backgroundColor: state.isSelected
                      ? 'var(--onity-color-primary)'
                      : 'var(--onity-color-bg)',
                  },
                }),
                singleValue: base => ({
                  ...base,
                  color: 'var(--onity-color-text)',
                }),
                placeholder: base => ({
                  ...base,
                  color: 'var(--onity-icon-secondary)',
                }),
                input: base => ({
                  ...base,
                  color: 'var(--onity-color-text)',
                }),
                indicatorSeparator: base => ({
                  ...base,
                  backgroundColor: 'var(--onity-color-border)',
                }),
                indicatorsContainer: base => ({
                  ...base,
                  color: 'var(--onity-icon-secondary)',
                }),
                dropdownIndicator: (base, state) => ({
                  ...base,
                  color: 'var(--onity-icon-secondary)',
                  transition: 'color 0.2s ease',
                  '&:hover': {
                    color: 'var(--onity-color-text)',
                  },
                }),
              }}
            />
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className={styles.cardsContainer}>
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span>Total de Conversas</span>
                <FaComments className={styles.iconBlue} />
              </div>
              <h2>
                <div className={styles.fadeIn}>
                  <CountUp end={kpiData.totalConversas} duration={1.5} delay={0.2} />
                </div>
              </h2>
            </div>

            <div 
              className={styles.card}
              onClick={() => router.push('/atendimento/chat')}
              style={{ cursor: 'pointer' }}
              title="Ver conversas ativas"
            >
              <div className={styles.cardHeader}>
                <span>Conversas Ativas</span>
                <FaClock className={styles.iconOrange} />
              </div>
              <h2>
                <div className={styles.fadeIn}>
                  <CountUp end={kpiData.conversasAbertas} duration={1.5} delay={0.2} />
                </div>
              </h2>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span>Finalizadas</span>
                <FaCheckCircle className={styles.iconGreen} />
              </div>
              <h2>
                <div className={styles.fadeIn}>
                  <CountUp end={kpiData.conversasFechadas} duration={1.5} delay={0.2} />
                </div>
              </h2>
            </div>

            <div 
              className={styles.card}
              onClick={() => router.push('/atendimento/chat')}
              style={{ cursor: 'pointer' }}
              title="Ver mensagens não lidas"
            >
              <div className={styles.cardHeader}>
                <span>Msgs Não Lidas</span>
                <FaEnvelopeOpenText className={styles.iconBlue} />
              </div>
              <h2>
                <div className={styles.fadeIn}>
                  <CountUp end={kpiData.mensagensNaoLidas} duration={1.5} delay={0.2} />
                </div>
              </h2>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span>Agentes Ativos</span>
                <FaUsers className={styles.iconGreen} />
              </div>
              <h2>
                <div className={styles.fadeIn}>
                  <CountUp end={kpiData.agentesAtivos} duration={1.5} delay={0.2} />
                </div>
              </h2>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span>Tempo Médio</span>
                <FaClock className={styles.iconOrange} />
              </div>
              <h2>
                <div className={styles.fadeIn}>
                  {formatarTempo(kpiData.tempoMedioResposta)}
                </div>
              </h2>
            </div>
          </>
        )}
      </div>

      {/* Widgets */}
      <div className={styles.widgetsContainer}>
        {/* Ranking de Agentes */}
        <div className={styles.widget}>
          <h2 className={styles.subTitle}>
            <FaUsers className={styles.tituloIcon} />
            Ranking de Agentes
          </h2>
          {loadingAgentes ? (
            <div className={dashStyles.loading}>Carregando...</div>
          ) : rankingAgentes.length === 0 ? (
            <div className={dashStyles.emptyState}>Nenhum agente com atendimentos</div>
          ) : (
            <div className={dashStyles.rankingList}>
              {rankingAgentes.map((agente, index) => (
                <div key={agente.id} className={dashStyles.rankingItem}>
                  <div className={dashStyles.rankingPosition}>#{index + 1}</div>
                  <div className={dashStyles.agenteAvatar}>
                    {agente.avatar_url ? (
                      <img src={agente.avatar_url} alt={agente.nome} />
                    ) : (
                      <div className={dashStyles.avatarInitials}>
                        {getInitials(agente.nome)}
                      </div>
                    )}
                  </div>
                  <div className={dashStyles.agenteInfo}>
                    <div className={dashStyles.agenteNome}>{agente.nome}</div>
                    <div className={dashStyles.agenteStats}>
                      {agente.conversasAbertas} ativas • {agente.conversasFechadas} finalizadas
                    </div>
                  </div>
                  <div className={dashStyles.agenteMetrics}>
                    <div className={dashStyles.metricItem}>
                      <span className={dashStyles.metricLabel}>Taxa</span>
                      <span className={dashStyles.metricValue}>{agente.taxaFinalizacao}%</span>
                    </div>
                    <div className={dashStyles.metricItem}>
                      <span className={dashStyles.metricLabel}>TMA</span>
                      <span className={dashStyles.metricValue}>{formatarTempo(agente.tma)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status das Instâncias */}
        <div className={styles.widget}>
          <h2 className={styles.subTitle}>
            <FaWhatsapp className={styles.tituloIcon} />
            Status das Instâncias
          </h2>
          {loadingInstancias ? (
            <div className={dashStyles.loading}>Carregando...</div>
          ) : instancias.length === 0 ? (
            <div className={dashStyles.emptyState}>
              <p>Nenhuma instância configurada</p>
              <button 
                className={dashStyles.configButton}
                onClick={() => router.push('/atendimento/ajustes?section=canais')}
              >
                Configurar Instâncias
              </button>
            </div>
          ) : (
            <div className={dashStyles.instancesList}>
              {instancias.map((instancia) => {
                const isConnected = instancia.status === 'conectado';
                return (
                  <div key={instancia.id} className={dashStyles.instanceItem}>
                    <div className={dashStyles.instanceHeader}>
                      <div className={dashStyles.instanceName}>
                        {instancia.instancia_nome}
                      </div>
                      <div className={`${dashStyles.statusBadge} ${isConnected ? dashStyles.connected : dashStyles.disconnected}`}>
                        {isConnected ? 'Conectado' : 'Desconectado'}
                      </div>
                    </div>
                    <div className={dashStyles.instanceDetails}>
                      <div className={dashStyles.instancePhone}>
                        {instancia.telefone || 'Telefone não definido'}
                      </div>
                      <div className={dashStyles.instanceType}>
                        {instancia.integracao_tipo === 'evolution' ? 'Evolution API' : 'Z-API'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Conversas Aguardando Atendimento */}
      {conversasAguardando.length > 0 && (
        <div className={styles.recentContracts}>
          <h2 className={styles.subTitle}>
            <FaClock className={styles.tituloIcon} />
            Conversas Aguardando Atendimento (+2h)
          </h2>
          <div className={dashStyles.alertsList}>
            {conversasAguardando.map((conversa) => {
              const horasAguardando = Math.floor(
                (new Date() - new Date(conversa.created_at)) / (1000 * 60 * 60)
              );
              return (
                <div 
                  key={conversa.conversation_id} 
                  className={dashStyles.alertItem}
                  onClick={() => router.push('/atendimento/chat')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={dashStyles.alertIcon}>
                    <FaClock />
                  </div>
                  <div className={dashStyles.alertInfo}>
                    <div className={dashStyles.alertTitle}>
                      {conversa.customer_name || conversa.customer_phone}
                    </div>
                    <div className={dashStyles.alertDescription}>
                      {conversa.customer_phone} • {conversa.team_name || 'Sem equipe'}
                    </div>
                  </div>
                  <div className={dashStyles.alertTime}>
                    {horasAguardando}h aguardando
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

