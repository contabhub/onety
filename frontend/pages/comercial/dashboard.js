import { useEffect, useState } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import { useRouter } from "next/router";
import styles from "../../styles/comercial/dashboard/Dashboard.module.css";
import dashStyles from "../../styles/atendimento/dashboard.module.css";
import {
  FaUsers,
  FaExchangeAlt,
  FaDollarSign,
  FaChartLine,
  FaUserCheck,
  FaTimes,
} from "react-icons/fa";
import CountUp from "react-countup";
import LeadsPorFases from "../../components/comercial/dashboard/LeadsPorFases";
import ProjecaoFunil from "../../components/comercial/dashboard/ProjecaoFunil";
import AtividadesPorTipo from "../../components/comercial/dashboard/AtividadesPorTipo";
import LeadsFilter from "../../components/comercial/dashboard/LeadsFilter";
import RankingVendedores from "../../components/comercial/dashboard/RankingVendedores";
import SkeletonCard from "../../components/onety/skeleton/SkeletonCard";
import Select from 'react-select';

// Função para formatar números grandes de forma compacta
const formatLargeNumber = (value) => {
  const num = Number(value);
  if (num >= 1000000000) {
    return `${(num / 1000000000).toFixed(1)}B`;
  } else if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
};


export default function Dashboard() {
  const router = useRouter();

  // Estado do filtro de período (mês/ano)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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
  const [showTicketMedioModal, setShowTicketMedioModal] = useState(false);
  const [showNegociosGanhosModal, setShowNegociosGanhosModal] = useState(false);

  // Estado para modal de avisos

  // Função para filtrar contratos pelo período selecionado
  const filterContractsByPeriod = (contracts) => {
    return contracts.filter(contract => {
      const createdDate = new Date(contract.created_at || contract.criado_em);
      const contractMonth = createdDate.getMonth();
      const contractYear = createdDate.getFullYear();
      return contractMonth === selectedMonth && contractYear === selectedYear;
    });
  };

  // Função para filtrar leads pelo período selecionado
  const filterLeadsByPeriod = (leads) => {
    return leads.filter(lead => {
      const createdDate = new Date(lead.created_at || lead.criado_em);
      const leadMonth = createdDate.getMonth();
      const leadYear = createdDate.getFullYear();
      return leadMonth === selectedMonth && leadYear === selectedYear;
    });
  };

  // Gerar lista de meses
  const meses = [
    { value: 0, label: 'Janeiro' },
    { value: 1, label: 'Fevereiro' },
    { value: 2, label: 'Março' },
    { value: 3, label: 'Abril' },
    { value: 4, label: 'Maio' },
    { value: 5, label: 'Junho' },
    { value: 6, label: 'Julho' },
    { value: 7, label: 'Agosto' },
    { value: 8, label: 'Setembro' },
    { value: 9, label: 'Outubro' },
    { value: 10, label: 'Novembro' },
    { value: 11, label: 'Dezembro' },
  ];

  // Gerar lista de anos (últimos 5 anos até ano atual + 1)
  const currentYear = new Date().getFullYear();
  const anos = Array.from({ length: 6 }, (_, i) => {
    const year = currentYear - 4 + i;
    return { value: year, label: year.toString() };
  });

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

        const todosContratos = await resContracts.json();
        
        // Filtrar contratos pelo período selecionado
        const contracts = filterContractsByPeriod(todosContratos);

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
        const todosLeads = await resLeads.json();
        
        // Filtrar leads pelo período selecionado
        const leads = filterLeadsByPeriod(todosLeads);
        
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
  }, [selectedMonth, selectedYear]); // Recarregar quando mudar o período

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

            // Buscar contagem de leads por fase (agora retorna leads individuais)
            const resLeadsCount = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/funis/leads/count/${funil.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const fasesComLeadsData = await resLeadsCount.json();

            // Filtrar leads por período antes de contar
            const fasesComLeads = fasesComLeadsData.map((faseData) => {
              let leadsCount = faseData.leadsCount || 0;
              
              // Se temos leads individuais, filtrar por período
              if (faseData.leads && Array.isArray(faseData.leads)) {
                const leadsFiltrados = faseData.leads.filter(lead => {
                  const createdDate = new Date(lead.criado_em);
                  return createdDate.getMonth() === selectedMonth && createdDate.getFullYear() === selectedYear;
                });
                leadsCount = leadsFiltrados.length;
              }
              
              // Encontrar a fase correspondente para manter informações adicionais
              const faseInfo = fases.find(f => f.id === faseData.id) || {};
              
              return { 
                ...faseInfo,
                id: faseData.id,
                nome: faseData.nome,
                leadsCount 
              };
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
  }, [selectedMonth, selectedYear]);



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
        
        <div className={dashStyles.filtersWrapper}>
          {/* Filtro de Mês/Ano */}
          <div className={dashStyles.periodFilters}>
            <span className={dashStyles.periodLabel}>Período:</span>
            <Select
              classNamePrefix="react-select"
              options={meses}
              value={meses.find(m => m.value === selectedMonth)}
              onChange={(option) => setSelectedMonth(option.value)}
              placeholder="Mês"
              isClearable={false}
              isSearchable={false}
              styles={{
                container: base => ({ ...base, minWidth: 140 }),
                control: (base, state) => ({
                  ...base,
                  backgroundColor: 'var(--onity-color-surface)',
                  border: '1px solid var(--onity-color-border)',
                  borderRadius: '8px',
                  boxShadow: 'var(--onity-elev-low)',
                  minHeight: '38px',
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
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }),
                singleValue: base => ({
                  ...base,
                  color: 'var(--onity-color-text)',
                  fontSize: '14px',
                }),
                indicatorSeparator: base => ({
                  ...base,
                  backgroundColor: 'var(--onity-color-border)',
                }),
                dropdownIndicator: (base, state) => ({
                  ...base,
                  color: 'var(--onity-icon-secondary)',
                  padding: '6px',
                  '&:hover': {
                    color: 'var(--onity-color-text)',
                  },
                }),
              }}
            />
            <Select
              classNamePrefix="react-select"
              options={anos}
              value={anos.find(a => a.value === selectedYear)}
              onChange={(option) => setSelectedYear(option.value)}
              placeholder="Ano"
              isClearable={false}
              isSearchable={false}
              styles={{
                container: base => ({ ...base, minWidth: 100 }),
                control: (base, state) => ({
                  ...base,
                  backgroundColor: 'var(--onity-color-surface)',
                  border: '1px solid var(--onity-color-border)',
                  borderRadius: '8px',
                  boxShadow: 'var(--onity-elev-low)',
                  minHeight: '38px',
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
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }),
                singleValue: base => ({
                  ...base,
                  color: 'var(--onity-color-text)',
                  fontSize: '14px',
                }),
                indicatorSeparator: base => ({
                  ...base,
                  backgroundColor: 'var(--onity-color-border)',
                }),
                dropdownIndicator: (base, state) => ({
                  ...base,
                  color: 'var(--onity-icon-secondary)',
                  padding: '6px',
                  '&:hover': {
                    color: 'var(--onity-color-text)',
                  },
                }),
              }}
            />
          </div>

          {/* Seletor de Empresa (Superadmin) */}
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

            <div 
              className={styles.card}
              onClick={() => setShowNegociosGanhosModal(true)}
              style={{ cursor: 'pointer' }}
              title="Clique para ver valor completo"
            >
              <div className={styles.cardHeader}>
                <span>Valor Negócios Ganhos</span>
                <FaDollarSign className={styles.iconGreen} />
              </div>
              <h2>
                <div className={styles.fadeIn}>R$ {formatLargeNumber(kpiData.valorNegociosGanhos)}</div>
              </h2>
            </div>

            <div 
              className={styles.card}
              onClick={() => setShowTicketMedioModal(true)}
              style={{ cursor: 'pointer' }}
              title="Clique para ver valor completo"
            >
              <div className={styles.cardHeader}>
                <span>Ticket Médio</span>
                <FaChartLine className={styles.iconOrange} />
              </div>
              <h2>
                <div className={styles.fadeIn}>R$ {formatLargeNumber(kpiData.ticketMedio)}</div>
              </h2>
            </div>
          </>
        )}
      </div>

      <ProjecaoFunil 
        selectedMonth={selectedMonth} 
        selectedYear={selectedYear} 
      />

      <LeadsPorFases 
        funis={funis} 
        selectedMonth={selectedMonth} 
        selectedYear={selectedYear} 
      />

      <AtividadesPorTipo 
        selectedMonth={selectedMonth} 
        selectedYear={selectedYear} 
      />

      {/* Filtro de Negócios e Ranking de Vendedores */}
      <div className={styles.widgetsContainer}>
        <LeadsFilter 
          equipeId={user?.EmpresaId || user?.empresa_id || user?.empresa?.id} 
          selectedMonth={selectedMonth} 
          selectedYear={selectedYear} 
        />
        <RankingVendedores 
          equipeId={user?.EmpresaId || user?.empresa_id || user?.empresa?.id} 
          selectedMonth={selectedMonth} 
          selectedYear={selectedYear} 
        />
      </div>

      {/* Modal de Ticket Médio */}
      {showTicketMedioModal && (
        <div className={styles.modalOverlay} onClick={() => setShowTicketMedioModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Ticket Médio</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setShowTicketMedioModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.valueDisplay}>
                <FaChartLine className={styles.modalIcon} />
                <span className={styles.fullValue}>
                  R$ {Number(kpiData.ticketMedio).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className={styles.modalDescription}>
                Este é o ticket médio dos contratos gerados pelos leads convertidos no período selecionado.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Negócios Ganhos */}
      {showNegociosGanhosModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNegociosGanhosModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Valor Negócios Ganhos</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setShowNegociosGanhosModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.valueDisplay}>
                <FaDollarSign className={styles.modalIcon} />
                <span className={styles.fullValue}>
                  R$ {Number(kpiData.valorNegociosGanhos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className={styles.modalDescription}>
                Este é o valor total dos contratos gerados pelos leads que foram convertidos (status "Ganhou") no período selecionado.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
