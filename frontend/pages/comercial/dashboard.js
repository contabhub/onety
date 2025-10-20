import { useEffect, useState } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import { useRouter } from "next/router";
import styles from "../../styles/comercial/dashboard/Dashboard.module.css";
import {
  FaUsers,
  FaExchangeAlt,
  FaDollarSign,
  FaChartLine,
  FaUserCheck,
} from "react-icons/fa";
import CountUp from "react-countup";
import LeadsPorFases from "../../components/comercial/dashboard/LeadsPorFases";
import ProjecaoFunil from "../../components/comercial/dashboard/ProjecaoFunil";
import AtividadesPorTipo from "../../components/comercial/dashboard/AtividadesPorTipo";
import LeadsFilter from "../../components/comercial/dashboard/LeadsFilter";
import RankingVendedores from "../../components/comercial/dashboard/RankingVendedores";
import SkeletonCard from "../../components/onety/skeleton/SkeletonCard";
import Select from 'react-select';




export default function Dashboard() {
  const router = useRouter();

  const [dashboardData, setDashboardData] = useState({
    total: 0,
    assinados: 0,
    pendentes: 0,
    expirados: 0,
  });

  const [contratosRecentes, setContratosRecentes] = useState([]);
  const [loadingRecentes, setLoadingRecentes] = useState(true);
  const [funis, setFunis] = useState([]);
  const [kpiData, setKpiData] = useState({
    totalLeads: 0,
    taxaConversao: 0,
    ticketMedio: 0,
    valorTotal: 0,
    totalConvertidos: 0,
    valorNegociosGanhos: 0,

  });
  const [equipes, setEquipes] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedEquipe, setSelectedEquipe] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Estado para modal de avisos

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

        // Buscar contratos da equipe
        const resContracts = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/contratual/contratos/empresa/${empresaId}/light`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!resContracts.ok) throw new Error("Erro ao buscar contratos.");

        const contracts = await resContracts.json();

        // Processar dados dos contratos
        const total = contracts.length;
        const assinados = contracts.filter((c) => c.status === "assinado").length;
        const pendentes = contracts.filter((c) => c.status === "pendente").length;
        const expirados = contracts.filter((c) => c.status === "expirado").length;
        const valorTotal = contracts.reduce((acc, cur) => acc + Number(cur.valor || 0), 0);
        const ticketMedio = contracts.length > 0 ? valorTotal / contracts.length : 0;

        // Buscar leads da empresa
        const resLeads = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/leads/empresa/${empresaId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const leads = await resLeads.json();
        const totalLeads = leads.length;
        const leadsGanhou = leads.filter(l => l.status?.toLowerCase() === "ganhou");
        const totalConvertidos = leadsGanhou.length;

        // Buscar contratos dos leads que viraram clientes
        const resGanhos = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/leads/contratos-ganhos/${empresaId}/light`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const contratosGanhos = await resGanhos.json();
        const valorNegociosGanhos = contratosGanhos.reduce((acc, cur) => acc + Number(cur.valor || 0), 0);

        const taxaConversao = totalLeads > 0 ? (totalConvertidos / totalLeads) * 100 : 0;

        // Atualizar todos os estados de uma vez
        setDashboardData({ total, assinados, pendentes, expirados });

        setKpiData({
          totalLeads,
          totalConvertidos,
          taxaConversao: taxaConversao.toFixed(1),
          ticketMedio: ticketMedio.toFixed(2),
          valorTotal: valorTotal.toFixed(2),
          valorNegociosGanhos: valorNegociosGanhos.toFixed(2),
        });

        // Contratos recentes
        const recentes = contracts
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5);
        setContratosRecentes(recentes);
        setLoadingRecentes(false);

        // Dados carregados com sucesso

        // Modal de avisos será controlado por outro efeito que valida se há avisos
      } catch (err) {
        console.error("Erro ao buscar dados do dashboard:", err);
        // Aqui você poderia adicionar um popup de erro se quiser
        // setShowErrorPopup(true);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAllDashboardData();
  }, []);

  useEffect(() => {
    async function fetchFunisAndFases() {
      const token = localStorage.getItem("token");
      const userRaw = localStorage.getItem("userData") || localStorage.getItem("user");
      if (!userRaw) return;

      const parsedUser = JSON.parse(userRaw);
      const empresaId = parsedUser?.EmpresaId || parsedUser?.empresa_id || parsedUser?.empresa?.id;
      if (!empresaId) return;

      try {
        // Buscar funis da empresa
        const resFunis = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funis/${empresaId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const funis = await resFunis.json();

        // Buscar fases de cada funil e contar os leads por fase
        const funisComFases = await Promise.all(
          funis.map(async (funil) => {
            const resFases = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funil-fases/${funil.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const fases = await resFases.json();

            // Buscar contagem de leads por fase
            const resLeadsCount = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funis/leads/count/${funil.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const leadsCount = await resLeadsCount.json();

            // Associar a contagem de leads a cada fase
            const fasesComLeads = fases.map((fase) => {
              const faseLeads = leadsCount.find((lead) => lead.id === fase.id);
              return { ...fase, leadsCount: faseLeads ? faseLeads.leadsCount : 0 };
            });

            return { ...funil, fases: fasesComLeads };
          })
        );

        setFunis(funisComFases);
      } catch (error) {
        console.error("Erro ao buscar funis e fases:", error);
      }
    }

    fetchFunisAndFases();
  }, []);



  useEffect(() => {
    const userRaw = localStorage.getItem('userData') || localStorage.getItem('user');
    if (userRaw) {
      const userObj = JSON.parse(userRaw);
      setUser(userObj);

      // Popup de manutenção já está ativo por padrão

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
      // Seleciona a equipe atual
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

    // Recarregar página imediatamente
    window.location.reload();
  };


  return (
    <div className={styles.container}>
      <PrincipalSidebar />
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard - Comercial</h1>
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
          </>
        ) : (
          <>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span>Total de Leads</span>
                <FaUsers className={styles.iconBlue} />
              </div>
              <h2>
                <div className={styles.fadeIn}>
                  <CountUp end={kpiData.totalLeads} duration={1.5} delay={0.2} />
                </div>
              </h2>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span>Leads Convertidos</span>
                <FaUserCheck className={styles.iconGreen} />
              </div>
              <h2>
                <div className={styles.fadeIn}>
                  <CountUp end={kpiData.totalConvertidos} duration={1.5} delay={0.2} />
                </div>
              </h2>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span>Taxa de Conversão</span>
                <FaExchangeAlt className={styles.iconGreen} />
              </div>
              <h2>
                <div className={styles.fadeIn}>{kpiData.taxaConversao}%</div>
              </h2>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span>Valor Negócios Ganhos</span>
                <FaDollarSign className={styles.iconGreen} />
              </div>
              <h2>
                <div className={styles.fadeIn}>R$ {kpiData.valorNegociosGanhos}</div>
              </h2>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span>Ticket Médio</span>
                <FaChartLine className={styles.iconOrange} />
              </div>
              <h2>
                <div className={styles.fadeIn}>R$ {kpiData.ticketMedio}</div>
              </h2>
            </div>
          </>
        )}
      </div>

      <ProjecaoFunil />

      <LeadsPorFases funis={funis} />

      <AtividadesPorTipo />

      {/* Filtro de Negócios e Ranking de Vendedores */}
      <div className={styles.widgetsContainer}>
        <LeadsFilter equipeId={user?.EmpresaId || user?.empresa_id || user?.empresa?.id} />
        <RankingVendedores equipeId={user?.EmpresaId || user?.empresa_id || user?.empresa?.id} />
      </div>
    </div>
  );
}
