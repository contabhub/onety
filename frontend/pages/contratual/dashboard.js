import { useEffect, useState } from "react";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import { useRouter } from "next/router";
import styles from "../../styles/comercial/dashboard/Dashboard.module.css";
import contractsStyles from "../../styles/contratual/Contratos.module.css";
import {
  FaFileAlt,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaEye
} from "react-icons/fa";
import { FaMoneyBills } from "react-icons/fa6";
import CountUp from "react-countup";
import SkeletonCard from "../../components/onety/skeleton/SkeletonCard";
import SkeletonTable from "../../components/onety/skeleton/SkeletonTable";
import Select from 'react-select';
import { FaTimes } from "react-icons/fa";

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
  const [showValueModal, setShowValueModal] = useState(false);

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

        // Buscar contratos da empresa
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


        // Atualizar todos os estados de uma vez
        setDashboardData({ total, assinados, pendentes, expirados });

        setKpiData({
          totalLeads: 0,
          totalConvertidos: 0,
          taxaConversao: 0,
          ticketMedio: ticketMedio.toFixed(2),
          valorTotal: valorTotal.toFixed(2),
          valorNegociosGanhos: 0,
        });

        // Contratos recentes
        const recentes = contracts
          .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
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
            <h1 className={styles.title}>Dashboard</h1>
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
              placeholder="Trocar de equipe..."
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

      {/* Cards de Resumo */}
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
                <span>Total de Contratos</span>
                <FaFileAlt className={styles.iconBlue} />
              </div>
              <h2>
                <div className={styles.fadeIn}>
                  <CountUp end={dashboardData.total} duration={1.5} delay={0.2} />
                </div>
              </h2>
            </div>

            <div 
              className={styles.card}
              onClick={() => setShowValueModal(true)}
              style={{ cursor: 'pointer' }}
              title="Clique para ver valor completo"
            >
              <div className={styles.cardHeader}>
                <span>Valor Total Contratos</span>
                <FaMoneyBills className={styles.iconBlue} />
              </div>
              <h2>
                <div className={styles.fadeIn}>
                  R$ {formatLargeNumber(kpiData.valorTotal)}
                </div>
              </h2>
            </div>

            <div
              className={styles.card}
              onClick={() => router.push(`/contratual/contratos?status=assinado`)}
              style={{ cursor: 'pointer' }}
            >
              <div className={styles.cardHeader}>
                <span>Assinados</span>
                <FaCheckCircle className={styles.iconGreen} />
              </div>
              <h2>
                <div className={styles.fadeIn}>
                  <CountUp end={dashboardData.assinados} duration={1.5} delay={0.2} />
                </div>
              </h2>
            </div>

            <div
              className={styles.card}
              onClick={() => router.push(`/contratual/contratos?status=pendente`)}
              style={{ cursor: 'pointer' }}
            >
              <div className={styles.cardHeader}>
                <span>Pendentes</span>
                <FaClock className={styles.iconOrange} />
              </div>
              <h2>
                <div className={styles.fadeIn}>
                  <CountUp end={dashboardData.pendentes} duration={1.5} delay={0.2} />
                </div>
              </h2>
            </div>

            <div
              className={styles.card}
              onClick={() => router.push(`/contratual/contratos?status=expirado`)}
              style={{ cursor: 'pointer' }}
            >
              <div className={styles.cardHeader}>
                <span>Expirados</span>
                <FaTimesCircle className={styles.iconGray} />
              </div>
              <h2>
                <div className={styles.fadeIn}>
                  <CountUp end={dashboardData.expirados} duration={1.5} delay={0.2} />
                </div>
              </h2>
            </div>
          </>
        )}
      </div>


      {/* Contratos Recentes */}
      <div className={styles.recentContracts}>
        <h2 className={styles.subTitle}>
          <FaFileAlt className={styles.tituloIcon} />
          Contratos Recentes
        </h2>

        {/* Tabela - Desktop */}
        {loadingRecentes ? (
          <SkeletonTable rows={5} />
        ) : (
          <div className={contractsStyles.tableContainer}>
            <table className={contractsStyles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>Responsável</th>
                  <th>Status</th>
                  <th>Expira em</th>
                  <th>Valor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {contratosRecentes.length > 0 ? (
                  contratosRecentes.map((contrato) => (
                    <tr key={contrato.id}>
                      <td>{contrato.id}</td>
                      <td>{contrato.client_name || "Contrato sem cliente"}</td>
                      <td>{contrato.created_by}</td>
                      <td>
                        <span className={contractsStyles[contrato.status?.toLowerCase?.() || ""]}>
                          {contrato.status}
                        </span>
                      </td>
                      <td>{contrato.expirado_em ? contrato.expirado_em.slice(0, 10).split('-').reverse().join('/') : '-'}</td>
                      <td>{contrato.valor !== undefined && contrato.valor !== null ? `R$ ${Number(contrato.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</td>
                      <td>
                        <button
                          className={styles.viewIcon}
                          onClick={() => router.push(`/contratual/contrato/${contrato.id}`)}
                          title="Visualizar contrato"
                        >
                          <FaEye />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7">Nenhum contrato recente encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Modal de Valor Completo */}
      {showValueModal && (
        <div className={styles.modalOverlay} onClick={() => setShowValueModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Valor Total dos Contratos</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setShowValueModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.valueDisplay}>
                <FaMoneyBills className={styles.modalIcon} />
                <span className={styles.fullValue}>
                  R$ {Number(kpiData.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className={styles.modalDescription}>
                Este é o valor total de todos os contratos da empresa.
              </p>
            </div>
          </div>
        </div>
      )}
        </div>
  );
}
