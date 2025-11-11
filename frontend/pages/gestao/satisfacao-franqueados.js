"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PrincipalSidebar from "../../components/onety/principal/PrincipalSidebar";
import { BarChart3, TrendingUp, Users, MessageSquare, Star, Filter, AlertCircle } from "lucide-react";
import styles from "../../styles/gestao/SatisfacaoFranqueados.module.css";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export default function SatisfacaoFranqueadosPage() {
  const router = useRouter();
  const [estatisticas, setEstatisticas] = useState(null);
  const [pesquisasDetalhadas, setPesquisasDetalhadas] = useState([]);
  const [franqueadosSemResposta, setFranqueadosSemResposta] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroSala, setFiltroSala] = useState("todas");
  const [modalSemResposta, setModalSemResposta] = useState(false);
  const [modalRespostas, setModalRespostas] = useState(false);
  const [pesquisaSelecionada, setPesquisaSelecionada] = useState(null);
  const [franqueadosSelecionados, setFranqueadosSelecionados] = useState([]);
  const [reenviando, setReenviando] = useState(false);
  const [authContext, setAuthContext] = useState({
    token: null,
    empresaId: null,
    tipoEmpresa: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const token = localStorage.getItem("token");
    const rawUserData = localStorage.getItem("userData");

    if (!token || !rawUserData) {
      router.replace("/auth/login");
      return;
    }

    let parsedUser = null;
    try {
      parsedUser = JSON.parse(rawUserData);
    } catch (error) {
      console.error("Erro ao interpretar userData:", error);
      router.replace("/auth/login");
      return;
    }

    const tipoEmpresa =
      parsedUser?.tipoEmpresa ||
      parsedUser?.tipo_empresa ||
      parsedUser?.companyType ||
      "";

    if (tipoEmpresa !== "franqueadora") {
      router.replace("/dashboard/visao-geral");
      return;
    }

    const empresaId =
      parsedUser?.EmpresaId ||
      parsedUser?.empresaId ||
      parsedUser?.empresa_id ||
      parsedUser?.companyId ||
      parsedUser?.company_id ||
      localStorage.getItem("empresaId") ||
      null;

    if (!empresaId) {
      router.replace("/auth/login");
      return;
    }

    const contexto = {
      token,
      empresaId: String(empresaId),
      tipoEmpresa,
    };

    setAuthContext(contexto);

    const headers = { Authorization: `Bearer ${contexto.token}` };

    const carregarDados = async () => {
      try {
        setLoading(true);
        const resEstatisticas = await fetch(
          `${API_BASE}/gestao/pesquisas-franqueados/externo/estatisticas/${contexto.empresaId}`,
          { headers }
        ).then((r) => r.json());

        if (resEstatisticas?.isFranqueadora) {
          setEstatisticas(resEstatisticas);
          
          const resPesquisas = await fetch(
            `${API_BASE}/gestao/pesquisas-franqueados/externo/detalhado/${contexto.empresaId}`,
            { headers }
          ).then((r) => r.json());
          
          setPesquisasDetalhadas(resPesquisas?.pesquisas || []);

          const resSemResposta = await fetch(
            `${API_BASE}/gestao/pesquisas-franqueados/externo/sem-resposta/${contexto.empresaId}`,
            { headers }
          ).then((r) => r.json());
          
          setFranqueadosSemResposta(resSemResposta?.franqueados || []);
        } else {
          // Se não for franqueadora, redirecionar
          router.replace("/gestao/visao-geral");
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        router.replace("/gestao/visao-geral");
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, [router]);

  if (loading) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.dashboardContainer}>
          <div style={{ padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: "18px", color: "var(--titan-text-med)" }}>
              Carregando dashboard de satisfação...
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!estatisticas) {
    return (
      <>
        <PrincipalSidebar />
        <div className={styles.dashboardContainer}>
          <div style={{ padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: "18px", color: "var(--titan-text-med)" }}>
              Nenhum dado disponível
            </div>
          </div>
        </div>
      </>
    );
  }

  const CLASSIFICACAO_BADGE_CLASS = {
    sala_verde: styles.classificacaoBadgeVerde,
    sala_amarela: styles.classificacaoBadgeAmarela,
    sala_vermelha: styles.classificacaoBadgeVermelha,
  };

  const CLASSIFICACAO_COR_MAP = {
    sala_verde: 'var(--titan-success)',
    sala_amarela: 'var(--titan-warning)',
    sala_vermelha: 'var(--titan-error)',
    default: 'var(--titan-icon-secondary)',
  };

  const getClassificacaoLabel = (classificacao) => {
    switch (classificacao) {
      case 'sala_verde': return 'Sala Verde';
      case 'sala_amarela': return 'Sala Amarela';
      case 'sala_vermelha': return 'Sala Vermelha';
      default: return 'Sem Classificação';
    }
  };

  const formatarData = (data) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Filtrar pesquisas baseado na sala selecionada
  const pesquisasFiltradas = filtroSala === 'todas' 
    ? pesquisasDetalhadas 
    : pesquisasDetalhadas.filter(p => p.nps_classificacao === filtroSala);

  const totalSemResposta = Math.max(0, estatisticas.total_envios - estatisticas.total_respostas);

  const abrirModalRespostas = (pesquisa) => {
    console.log('🔍 DADOS COMPLETOS DA PESQUISA:', pesquisa);
    console.log('📝 Comentários disponíveis:');
    console.log('- Geral:', pesquisa.comentario_geral);
    console.log('- Atendimento:', pesquisa.comentario_atendimento);
    console.log('- T.I.:', pesquisa.comentario_ti);
    console.log('- Parceiros:', pesquisa.comentario_parceiros);
    console.log('- Fiscal:', pesquisa.comentario_fiscal);
    console.log('- Pessoal:', pesquisa.comentario_pessoal);
    console.log('- Contábil:', pesquisa.comentario_contabil);
    setPesquisaSelecionada(pesquisa);
    setModalRespostas(true);
  };

  const fecharModalRespostas = () => {
    setModalRespostas(false);
    setPesquisaSelecionada(null);
  };

  const fecharModalSemResposta = () => {
    setModalSemResposta(false);
    setFranqueadosSelecionados([]);
  };

  const handleSelecionarFranqueado = (franqueadoId) => {
    setFranqueadosSelecionados(prev => 
      prev.includes(franqueadoId) 
        ? prev.filter(id => id !== franqueadoId)
        : [...prev, franqueadoId]
    );
  };

  const handleSelecionarTodos = () => {
    if (franqueadosSelecionados.length === franqueadosSemResposta.length) {
      setFranqueadosSelecionados([]);
    } else {
      setFranqueadosSelecionados(franqueadosSemResposta.map(f => f.id));
    }
  };

  const reenviarPesquisas = async (todos = false, franqueadoId) => {
    const { token, empresaId } = authContext;

    if (!token || !empresaId) return;

    try {
      setReenviando(true);
      const empresaIdNumber = Number(empresaId);
      
      const payload = todos 
        ? { empresaId: empresaIdNumber, reenviarTodos: true }
        : franqueadoId 
          ? { empresaId: empresaIdNumber, franqueadoIds: [franqueadoId] }
          : { empresaId: empresaIdNumber, franqueadoIds: franqueadosSelecionados };

      const response = await fetch(
        `${API_BASE}/gestao/pesquisas-franqueados/externo/reenviar`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      ).then((r) => r.json());

      if (response.success) {
        alert(`✅ ${response.message}`);

        const headers = { Authorization: `Bearer ${token}` };
        const resEstatisticas = await fetch(
          `${API_BASE}/gestao/pesquisas-franqueados/externo/estatisticas/${empresaId}`,
          { headers }
        ).then((r) => r.json());
        setEstatisticas(resEstatisticas);

        const resSemResposta = await fetch(
          `${API_BASE}/gestao/pesquisas-franqueados/externo/sem-resposta/${empresaId}`,
          { headers }
        ).then((r) => r.json());
        setFranqueadosSemResposta(resSemResposta?.franqueados || []);
        
        setFranqueadosSelecionados([]);
      }
    } catch (error) {
      console.error('Erro ao reenviar pesquisas:', error);
      alert(`❌ Erro ao reenviar pesquisas: ${error?.error || 'Erro desconhecido'}`);
    } finally {
      setReenviando(false);
    }
  };

  return (
    <>
      <PrincipalSidebar />
      <div className={styles.dashboardContainer}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h1>Dashboard de Satisfação - Franqueados</h1>
            <p>Análise detalhada da satisfação dos franqueados</p>
          </div>
          
          <button
            onClick={() => router.push("/gestao/visao-geral")}
            className={styles.backButton}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Voltar
          </button>
        </div>

        {/* Cards de Resumo */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
          gap: "var(--titan-spacing-lg)",
          marginBottom: "var(--titan-spacing-2xl)"
        }}>
          {/* Total de Envios */}
          <div style={{
            background: "var(--titan-card-bg)",
            border: "1px solid var(--titan-stroke)",
            borderRadius: "var(--titan-radius-lg)",
            padding: "var(--titan-spacing-xl)",
            display: "flex",
            alignItems: "center",
            gap: "var(--titan-spacing-lg)"
          }}>
            <div style={{
              background: "var(--titan-primary)",
              borderRadius: "var(--titan-radius-full)",
              padding: "var(--titan-spacing-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <MessageSquare size={24} color="white" />
            </div>
            <div>
              <div style={{ 
                fontSize: "var(--titan-font-size-sm)", 
                color: "var(--titan-text-med)",
                marginBottom: "var(--titan-spacing-xs)"
              }}>
                Total de Envios
              </div>
              <div style={{ 
                fontSize: "var(--titan-font-size-2xl)", 
                fontWeight: "var(--titan-font-weight-bold)",
                color: "var(--titan-text-high)"
              }}>
                {estatisticas.total_envios}
              </div>
            </div>
          </div>

          {/* Total de Respostas */}
          <div style={{
            background: "var(--titan-card-bg)",
            border: "1px solid var(--titan-stroke)",
            borderRadius: "var(--titan-radius-lg)",
            padding: "var(--titan-spacing-xl)",
            display: "flex",
            alignItems: "center",
            gap: "var(--titan-spacing-lg)"
          }}>
            <div style={{
              background: "var(--titan-success)",
              borderRadius: "var(--titan-radius-full)",
              padding: "var(--titan-spacing-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Users size={24} color="white" />
            </div>
            <div>
              <div style={{ 
                fontSize: "var(--titan-font-size-sm)", 
                color: "var(--titan-text-med)",
                marginBottom: "var(--titan-spacing-xs)"
              }}>
                Total de Respostas
              </div>
              <div style={{ 
                fontSize: "var(--titan-font-size-2xl)", 
                fontWeight: "var(--titan-font-weight-bold)",
                color: "var(--titan-success)"
              }}>
                {estatisticas.total_respostas}
              </div>
            </div>
          </div>

          {/* Sem Resposta */}
          <div style={{
            background: "var(--titan-card-bg)",
            border: "1px solid var(--titan-stroke)",
            borderRadius: "var(--titan-radius-lg)",
            padding: "var(--titan-spacing-xl)",
            display: "flex",
            alignItems: "center",
            gap: "var(--titan-spacing-lg)",
            cursor: "pointer"
          }}
          onClick={() => setModalSemResposta(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--titan-primary)";
            e.currentTarget.style.transform = "scale(1.02)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--titan-stroke)";
            e.currentTarget.style.transform = "scale(1)";
          }}
          >
            <div style={{
              background: "var(--titan-warning)",
              borderRadius: "var(--titan-radius-full)",
              padding: "var(--titan-spacing-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <AlertCircle size={24} color="white" />
            </div>
            <div>
              <div style={{ 
                fontSize: "var(--titan-font-size-sm)", 
                color: "var(--titan-text-med)",
                marginBottom: "var(--titan-spacing-xs)"
              }}>
                Sem Resposta
              </div>
              <div style={{ 
                fontSize: "var(--titan-font-size-2xl)", 
                fontWeight: "var(--titan-font-weight-bold)",
                color: "var(--titan-warning)"
              }}>
                {totalSemResposta}
              </div>
            </div>
          </div>

          {/* Taxa de Satisfação */}
          <div style={{
            background: "var(--titan-card-bg)",
            border: "1px solid var(--titan-stroke)",
            borderRadius: "var(--titan-radius-lg)",
            padding: "var(--titan-spacing-xl)",
            display: "flex",
            alignItems: "center",
            gap: "var(--titan-spacing-lg)"
          }}>
            <div style={{
              background: "var(--titan-success)",
              borderRadius: "var(--titan-radius-full)",
              padding: "var(--titan-spacing-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <TrendingUp size={24} color="white" />
            </div>
            <div>
              <div style={{ 
                fontSize: "var(--titan-font-size-sm)", 
                color: "var(--titan-text-med)",
                marginBottom: "var(--titan-spacing-xs)"
              }}>
                Taxa de Satisfação
              </div>
              <div style={{ 
                fontSize: "var(--titan-font-size-2xl)", 
                fontWeight: "var(--titan-font-weight-bold)",
                color: "var(--titan-success)"
              }}>
                {estatisticas.taxa_satisfacao}%
              </div>
            </div>
          </div>
        </div>

        {/* Cards das Salas - Filtros Clicáveis */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
          gap: "var(--titan-spacing-lg)",
          marginBottom: "var(--titan-spacing-2xl)"
        }}>
          {/* Sala Verde - Filtro */}
          <div 
            style={{
              background: filtroSala === 'sala_verde' ? "rgba(34, 197, 94, 0.05)" : "var(--titan-card-bg)",
              border: filtroSala === 'sala_verde' ? "1px solid #22c55e" : "1px solid var(--titan-stroke)",
              borderRadius: "var(--titan-radius-lg)",
              padding: "var(--titan-spacing-xl)",
              display: "flex",
              alignItems: "center",
              gap: "var(--titan-spacing-lg)",
              cursor: "pointer",
              transition: "all var(--titan-transition-fast)"
            }}
            onClick={() => setFiltroSala('sala_verde')}
            onMouseEnter={(e) => {
              if (filtroSala !== 'sala_verde') {
                e.currentTarget.style.borderColor = "#22c55e";
                e.currentTarget.style.transform = "scale(1.01)";
              }
            }}
            onMouseLeave={(e) => {
              if (filtroSala !== 'sala_verde') {
                e.currentTarget.style.borderColor = "var(--titan-stroke)";
                e.currentTarget.style.transform = "scale(1)";
              }
            }}
          >
            <div style={{
              background: "#22c55e",
              borderRadius: "var(--titan-radius-full)",
              padding: "var(--titan-spacing-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Star size={24} color="white" />
            </div>
            <div>
              <div style={{ 
                fontSize: "var(--titan-font-size-sm)", 
                color: filtroSala === 'sala_verde' ? "#22c55e" : "var(--titan-text-med)",
                marginBottom: "var(--titan-spacing-xs)",
                fontWeight: filtroSala === 'sala_verde' ? "var(--titan-font-weight-medium)" : "var(--titan-font-weight-normal)"
              }}>
                Sala Verde
              </div>
              <div style={{ 
                fontSize: "var(--titan-font-size-2xl)", 
                fontWeight: "var(--titan-font-weight-bold)",
                color: "#22c55e"
              }}>
                {estatisticas.salas.verde}
              </div>
            </div>
          </div>

          {/* Sala Amarela - Filtro */}
          <div 
            style={{
              background: filtroSala === 'sala_amarela' ? "rgba(245, 158, 11, 0.05)" : "var(--titan-card-bg)",
              border: filtroSala === 'sala_amarela' ? "1px solid #f59e0b" : "1px solid var(--titan-stroke)",
              borderRadius: "var(--titan-radius-lg)",
              padding: "var(--titan-spacing-xl)",
              display: "flex",
              alignItems: "center",
              gap: "var(--titan-spacing-lg)",
              cursor: "pointer",
              transition: "all var(--titan-transition-fast)"
            }}
            onClick={() => setFiltroSala('sala_amarela')}
            onMouseEnter={(e) => {
              if (filtroSala !== 'sala_amarela') {
                e.currentTarget.style.borderColor = "#f59e0b";
                e.currentTarget.style.transform = "scale(1.01)";
              }
            }}
            onMouseLeave={(e) => {
              if (filtroSala !== 'sala_amarela') {
                e.currentTarget.style.borderColor = "var(--titan-stroke)";
                e.currentTarget.style.transform = "scale(1)";
              }
            }}
          >
            <div style={{
              background: "#f59e0b",
              borderRadius: "var(--titan-radius-full)",
              padding: "var(--titan-spacing-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Star size={24} color="white" />
            </div>
            <div>
              <div style={{ 
                fontSize: "var(--titan-font-size-sm)", 
                color: filtroSala === 'sala_amarela' ? "#f59e0b" : "var(--titan-text-med)",
                marginBottom: "var(--titan-spacing-xs)",
                fontWeight: filtroSala === 'sala_amarela' ? "var(--titan-font-weight-medium)" : "var(--titan-font-weight-normal)"
              }}>
                Sala Amarela
              </div>
              <div style={{ 
                fontSize: "var(--titan-font-size-2xl)", 
                fontWeight: "var(--titan-font-weight-bold)",
                color: "#f59e0b"
              }}>
                {estatisticas.salas.amarela}
              </div>
            </div>
          </div>

          {/* Sala Vermelha - Filtro */}
          <div 
            style={{
              background: filtroSala === 'sala_vermelha' ? "rgba(239, 68, 68, 0.05)" : "var(--titan-card-bg)",
              border: filtroSala === 'sala_vermelha' ? "1px solid #ef4444" : "1px solid var(--titan-stroke)",
              borderRadius: "var(--titan-radius-lg)",
              padding: "var(--titan-spacing-xl)",
              display: "flex",
              alignItems: "center",
              gap: "var(--titan-spacing-lg)",
              cursor: "pointer",
              transition: "all var(--titan-transition-fast)"
            }}
            onClick={() => setFiltroSala('sala_vermelha')}
            onMouseEnter={(e) => {
              if (filtroSala !== 'sala_vermelha') {
                e.currentTarget.style.borderColor = "#ef4444";
                e.currentTarget.style.transform = "scale(1.01)";
              }
            }}
            onMouseLeave={(e) => {
              if (filtroSala !== 'sala_vermelha') {
                e.currentTarget.style.borderColor = "var(--titan-stroke)";
                e.currentTarget.style.transform = "scale(1)";
              }
            }}
          >
            <div style={{
              background: "#ef4444",
              borderRadius: "var(--titan-radius-full)",
              padding: "var(--titan-spacing-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Star size={24} color="white" />
            </div>
            <div>
              <div style={{ 
                fontSize: "var(--titan-font-size-sm)", 
                color: filtroSala === 'sala_vermelha' ? "#ef4444" : "var(--titan-text-med)",
                marginBottom: "var(--titan-spacing-xs)",
                fontWeight: filtroSala === 'sala_vermelha' ? "var(--titan-font-weight-medium)" : "var(--titan-font-weight-normal)"
              }}>
                Sala Vermelha
              </div>
              <div style={{ 
                fontSize: "var(--titan-font-size-2xl)", 
                fontWeight: "var(--titan-font-weight-bold)",
                color: "#ef4444"
              }}>
                {estatisticas.salas.vermelha}
              </div>
            </div>
          </div>

          {/* Botão "Todas" - Reset do Filtro */}
          <div 
            style={{
              background: filtroSala === 'todas' ? "rgba(59, 130, 246, 0.05)" : "var(--titan-card-bg)",
              border: filtroSala === 'todas' ? "1px solid var(--titan-primary)" : "1px solid var(--titan-stroke)",
              borderRadius: "var(--titan-radius-lg)",
              padding: "var(--titan-spacing-xl)",
              display: "flex",
              alignItems: "center",
              gap: "var(--titan-spacing-lg)",
              cursor: "pointer",
              transition: "all var(--titan-transition-fast)"
            }}
            onClick={() => setFiltroSala('todas')}
            onMouseEnter={(e) => {
              if (filtroSala !== 'todas') {
                e.currentTarget.style.borderColor = "var(--titan-primary)";
                e.currentTarget.style.transform = "scale(1.01)";
              }
            }}
            onMouseLeave={(e) => {
              if (filtroSala !== 'todas') {
                e.currentTarget.style.borderColor = "var(--titan-stroke)";
                e.currentTarget.style.transform = "scale(1)";
              }
            }}
          >
            <div style={{
              background: "var(--titan-primary)",
              borderRadius: "var(--titan-radius-full)",
              padding: "var(--titan-spacing-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Filter size={24} color="white" />
            </div>
            <div>
              <div style={{ 
                fontSize: "var(--titan-font-size-sm)", 
                color: filtroSala === 'todas' ? "var(--titan-primary)" : "var(--titan-text-med)",
                marginBottom: "var(--titan-spacing-xs)",
                fontWeight: filtroSala === 'todas' ? "var(--titan-font-weight-medium)" : "var(--titan-font-weight-normal)"
              }}>
                Todas as Salas
              </div>
              <div style={{ 
                fontSize: "var(--titan-font-size-2xl)", 
                fontWeight: "var(--titan-font-weight-bold)",
                color: "var(--titan-primary)"
              }}>
                {pesquisasDetalhadas.length}
              </div>
            </div>
          </div>
        </div>

        {/* Overview das Notas por Departamento */}
        <div style={{
          background: "var(--titan-card-bg)",
          border: "1px solid var(--titan-stroke)",
          borderRadius: "var(--titan-radius-lg)",
          padding: "var(--titan-spacing-xl)",
          marginBottom: "var(--titan-spacing-2xl)"
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--titan-spacing-md)",
            marginBottom: "var(--titan-spacing-xl)"
          }}>
            <div style={{
              background: "var(--titan-primary)",
              borderRadius: "var(--titan-radius-full)",
              padding: "var(--titan-spacing-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <BarChart3 size={20} color="white" />
            </div>
            <h3 style={{ 
              fontSize: "var(--titan-font-size-xl)", 
              fontWeight: "var(--titan-font-weight-semibold)",
              color: "var(--titan-text-high)",
              margin: 0
            }}>
              Overview das Notas por Departamento
            </h3>
          </div>
          
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
            gap: "var(--titan-spacing-xl)" 
          }}>
            {/* Nota Fiscal */}
            <div style={{
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.02) 100%)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              borderRadius: "var(--titan-radius-lg)",
              padding: "var(--titan-spacing-xl)",
              textAlign: "center",
              transition: "all var(--titan-transition-fast)",
              cursor: "pointer"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(59, 130, 246, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
            >
              <div style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                borderRadius: "var(--titan-radius-full)",
                padding: "var(--titan-spacing-lg)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "var(--titan-spacing-lg)",
                boxShadow: "0 4px 15px rgba(59, 130, 246, 0.3)"
              }}>
                <BarChart3 size={28} color="white" />
              </div>
              <div style={{ 
                fontSize: "var(--titan-font-size-lg)", 
                color: "var(--titan-text-high)",
                marginBottom: "var(--titan-spacing-md)",
                fontWeight: "var(--titan-font-weight-semibold)"
              }}>
                Departamento Fiscal
              </div>
              <div style={{ 
                fontSize: "var(--titan-font-size-3xl)", 
                fontWeight: "var(--titan-font-weight-bold)",
                color: "#3b82f6",
                marginBottom: "var(--titan-spacing-sm)"
              }}>
                {estatisticas.notas_medias?.fiscal?.toFixed(1) || '0.0'}
              </div>
              <div style={{
                fontSize: "var(--titan-font-size-sm)",
                color: "var(--titan-text-med)",
                background: "rgba(59, 130, 246, 0.1)",
                padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                borderRadius: "var(--titan-radius-sm)",
                display: "inline-block"
              }}>
                de 10 pontos
              </div>
            </div>

            {/* Nota Pessoal */}
            <div style={{
              background: "linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(139, 92, 246, 0.02) 100%)",
              border: "1px solid rgba(139, 92, 246, 0.2)",
              borderRadius: "var(--titan-radius-lg)",
              padding: "var(--titan-spacing-xl)",
              textAlign: "center",
              transition: "all var(--titan-transition-fast)",
              cursor: "pointer"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(139, 92, 246, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
            >
              <div style={{
                background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                borderRadius: "var(--titan-radius-full)",
                padding: "var(--titan-spacing-lg)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "var(--titan-spacing-lg)",
                boxShadow: "0 4px 15px rgba(139, 92, 246, 0.3)"
              }}>
                <BarChart3 size={28} color="white" />
              </div>
              <div style={{ 
                fontSize: "var(--titan-font-size-lg)", 
                color: "var(--titan-text-high)",
                marginBottom: "var(--titan-spacing-md)",
                fontWeight: "var(--titan-font-weight-semibold)"
              }}>
                Departamento Pessoal
              </div>
              <div style={{ 
                fontSize: "var(--titan-font-size-3xl)", 
                fontWeight: "var(--titan-font-weight-bold)",
                color: "#8b5cf6",
                marginBottom: "var(--titan-spacing-sm)"
              }}>
                {estatisticas.notas_medias?.pessoal?.toFixed(1) || '0.0'}
              </div>
              <div style={{
                fontSize: "var(--titan-font-size-sm)",
                color: "var(--titan-text-med)",
                background: "rgba(139, 92, 246, 0.1)",
                padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                borderRadius: "var(--titan-radius-sm)",
                display: "inline-block"
              }}>
                de 10 pontos
              </div>
            </div>

            {/* Nota Contábil */}
            <div style={{
              background: "linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, rgba(6, 182, 212, 0.02) 100%)",
              border: "1px solid rgba(6, 182, 212, 0.2)",
              borderRadius: "var(--titan-radius-lg)",
              padding: "var(--titan-spacing-xl)",
              textAlign: "center",
              transition: "all var(--titan-transition-fast)",
              cursor: "pointer"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(6, 182, 212, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
            >
              <div style={{
                background: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                borderRadius: "var(--titan-radius-full)",
                padding: "var(--titan-spacing-lg)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "var(--titan-spacing-lg)",
                boxShadow: "0 4px 15px rgba(6, 182, 212, 0.3)"
              }}>
                <BarChart3 size={28} color="white" />
              </div>
              <div style={{ 
                fontSize: "var(--titan-font-size-lg)", 
                color: "var(--titan-text-high)",
                marginBottom: "var(--titan-spacing-md)",
                fontWeight: "var(--titan-font-weight-semibold)"
              }}>
                Departamento Contábil
              </div>
              <div style={{ 
                fontSize: "var(--titan-font-size-3xl)", 
                fontWeight: "var(--titan-font-weight-bold)",
                color: "#06b6d4",
                marginBottom: "var(--titan-spacing-sm)"
              }}>
                {estatisticas.notas_medias?.contabil?.toFixed(1) || '0.0'}
              </div>
              <div style={{
                fontSize: "var(--titan-font-size-sm)",
                color: "var(--titan-text-med)",
                background: "rgba(6, 182, 212, 0.1)",
                padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                borderRadius: "var(--titan-radius-sm)",
                display: "inline-block"
              }}>
                de 10 pontos
              </div>
            </div>
          </div>
        </div>



        {/* Gráfico de Distribuição */}
        <div style={{
          background: "var(--titan-card-bg)",
          border: "1px solid var(--titan-stroke)",
          borderRadius: "var(--titan-radius-lg)",
          padding: "var(--titan-spacing-xl)",
          marginBottom: "var(--titan-spacing-2xl)"
        }}>
          <h3 style={{ 
            fontSize: "var(--titan-font-size-lg)", 
            fontWeight: "var(--titan-font-weight-semibold)",
            color: "var(--titan-text-high)",
            margin: "0 0 var(--titan-spacing-lg) 0"
          }}>
            Distribuição por Salas
          </h3>
          
          <div style={{ display: "flex", alignItems: "center", gap: "var(--titan-spacing-lg)" }}>
            {/* Barra Verde */}
            <div style={{ flex: 1 }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: "var(--titan-spacing-sm)"
              }}>
                <span style={{ fontSize: "var(--titan-font-size-sm)", color: "var(--titan-text-med)" }}>
                  Sala Verde
                </span>
                <span style={{ fontSize: "var(--titan-font-size-sm)", fontWeight: "var(--titan-font-weight-semibold)" }}>
                  {estatisticas.salas.verde}
                </span>
              </div>
              <div style={{
                height: "8px",
                background: "#22c55e",
                borderRadius: "var(--titan-radius-full)",
                width: `${(estatisticas.salas.verde / estatisticas.total_respostas) * 100}%`
              }} />
            </div>

            {/* Barra Amarela */}
            <div style={{ flex: 1 }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: "var(--titan-spacing-sm)"
              }}>
                <span style={{ fontSize: "var(--titan-font-size-sm)", color: "var(--titan-text-med)" }}>
                  Sala Amarela
                </span>
                <span style={{ fontSize: "var(--titan-font-size-sm)", fontWeight: "var(--titan-font-weight-semibold)" }}>
                  {estatisticas.salas.amarela}
                </span>
              </div>
              <div style={{
                height: "8px",
                background: "#f59e0b",
                borderRadius: "var(--titan-radius-full)",
                width: `${(estatisticas.salas.amarela / estatisticas.total_respostas) * 100}%`
              }} />
            </div>

            {/* Barra Vermelha */}
            <div style={{ flex: 1 }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: "var(--titan-spacing-sm)"
              }}>
                <span style={{ fontSize: "var(--titan-font-size-sm)", color: "var(--titan-text-med)" }}>
                  Sala Vermelha
                </span>
                <span style={{ fontSize: "var(--titan-font-size-sm)", fontWeight: "var(--titan-font-weight-semibold)" }}>
                  {estatisticas.salas.vermelha}
                </span>
              </div>
              <div style={{
                height: "8px",
                background: "#ef4444",
                borderRadius: "var(--titan-radius-full)",
                width: `${(estatisticas.salas.vermelha / estatisticas.total_respostas) * 100}%`
              }} />
            </div>
          </div>
        </div>

        {/* Tabela de Pesquisas Detalhadas */}
        <div style={{
          background: "var(--titan-card-bg)",
          border: "1px solid var(--titan-stroke)",
          borderRadius: "var(--titan-radius-lg)",
          padding: "var(--titan-spacing-xl)"
        }}>
          <h3 style={{ 
            fontSize: "var(--titan-font-size-lg)", 
            fontWeight: "var(--titan-font-weight-semibold)",
            color: "var(--titan-text-high)",
            margin: "0 0 var(--titan-spacing-lg) 0"
          }}>
            Pesquisas Detalhadas {filtroSala !== 'todas' && `- ${getClassificacaoLabel(filtroSala)}`}
            <span style={{ 
              fontSize: "var(--titan-font-size-sm)", 
              color: "var(--titan-text-med)",
              fontWeight: "var(--titan-font-weight-normal)",
              marginLeft: "var(--titan-spacing-sm)"
            }}>
              ({pesquisasFiltradas.length} resultados)
            </span>
          </h3>

          {pesquisasFiltradas.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--titan-stroke)" }}>
                    <th style={{ 
                      padding: "var(--titan-spacing-md)", 
                      textAlign: "left",
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-semibold)",
                      color: "var(--titan-text-med)"
                    }}>
                      Franqueado
                    </th>
                    <th style={{ 
                      padding: "var(--titan-spacing-md)", 
                      textAlign: "left",
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-semibold)",
                      color: "var(--titan-text-med)"
                    }}>
                      Unidade
                    </th>
                    <th style={{ 
                      padding: "var(--titan-spacing-md)", 
                      textAlign: "center",
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-semibold)",
                      color: "var(--titan-text-med)"
                    }}>
                      Nota Geral
                    </th>
                    <th style={{ 
                      padding: "var(--titan-spacing-md)", 
                      textAlign: "center",
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-semibold)",
                      color: "var(--titan-text-med)"
                    }}>
                      Classificação
                    </th>
                    <th style={{ 
                      padding: "var(--titan-spacing-md)", 
                      textAlign: "center",
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-semibold)",
                      color: "var(--titan-text-med)"
                    }}>
                      Data Resposta
                    </th>
                    <th style={{ 
                      padding: "var(--titan-spacing-md)", 
                      textAlign: "center",
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-semibold)",
                      color: "var(--titan-text-med)"
                    }}>
                      Respostas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pesquisasFiltradas.map((pesquisa) => (
                    <tr key={pesquisa.id} style={{ borderBottom: "1px solid var(--titan-stroke)" }}>
                      <td className={styles.tableCellNome}>
                        <button
                          className={styles.nomeLink}
                          onClick={() => router.push(`/gestao/franqueado/${pesquisa.franqueado_id}`)}
                        >
                          {pesquisa.franqueado_nome}
                        </button>
                      </td>
                      <td className={styles.tableCell}>
                        {pesquisa.unidade}
                      </td>
                      <td className={`${styles.tableCell} ${styles.center} ${styles.destacado}`}>
                        {pesquisa.nota_satisfacao_geral}/10
                      </td>
                      <td style={{ 
                        padding: "var(--titan-spacing-md)",
                        textAlign: "center"
                      }}>
                        <span
                          className={`${styles.classificacaoBadge} ${
                            CLASSIFICACAO_BADGE_CLASS[pesquisa.nps_classificacao] || ""
                          }`}
                        >
                          {getClassificacaoLabel(pesquisa.nps_classificacao)}
                        </span>
                      </td>
                      <td className={`${styles.tableCell} ${styles.center} ${styles.destacado}`}>
                        {formatarData(pesquisa.data_resposta)}
                      </td>
                      <td style={{ 
                        padding: "var(--titan-spacing-md)",
                        textAlign: "center"
                      }}>
                        <button
                          style={{
                            background: "var(--titan-primary)",
                            color: "white",
                            border: "none",
                            borderRadius: "var(--titan-radius-sm)",
                            padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                            cursor: "pointer",
                            fontSize: "var(--titan-font-size-sm)",
                            fontWeight: "var(--titan-font-weight-medium)",
                            transition: "all var(--titan-transition-fast)"
                          }}
                          onClick={() => abrirModalRespostas(pesquisa)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--titan-primary-hover)";
                            e.currentTarget.style.transform = "scale(1.05)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "var(--titan-primary)";
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                        >
                          Ver respostas
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ 
              textAlign: "center", 
              padding: "var(--titan-spacing-2xl)",
              color: "var(--titan-text-med)"
            }}>
              Nenhuma pesquisa encontrada para o filtro selecionado
            </div>
          )}
        </div>
      </div>

      {/* Modal de Franqueados Sem Resposta */}
      {modalSemResposta && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999
        }}>
          <div style={{
            background: "var(--titan-card-bg)",
            border: "1px solid var(--titan-stroke)",
            borderRadius: "var(--titan-radius-lg)",
            padding: "var(--titan-spacing-xl)",
            maxWidth: "600px",
            width: "90%",
            maxHeight: "80vh",
            overflow: "auto"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--titan-spacing-lg)"
            }}>
              <h3 style={{
                fontSize: "var(--titan-font-size-lg)",
                fontWeight: "var(--titan-font-weight-semibold)",
                color: "var(--titan-text-high)",
                margin: 0
              }}>
                Franqueados Sem Resposta
              </h3>
              <div style={{ display: "flex", gap: "var(--titan-spacing-sm)", alignItems: "center" }}>
                <button
                  onClick={() => reenviarPesquisas(true)}
                  disabled={reenviando}
                  style={{
                    padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                    background: reenviando ? "var(--titan-text-low)" : "var(--titan-primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "var(--titan-radius-sm)",
                    cursor: reenviando ? "not-allowed" : "pointer",
                    fontSize: "var(--titan-font-size-sm)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    transition: "all var(--titan-transition-fast)",
                    opacity: reenviando ? 0.6 : 1
                  }}
                >
                  {reenviando ? "Reenviando..." : "Reenviar Todos"}
                </button>
                <button
                  onClick={fecharModalSemResposta}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "24px",
                    color: "var(--titan-text-med)",
                    padding: "4px"
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {franqueadosSemResposta.length > 0 ? (
              <div>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--titan-spacing-lg)"
                }}>
                  <p style={{
                    fontSize: "var(--titan-font-size-sm)",
                    color: "var(--titan-text-med)",
                    margin: 0
                  }}>
                    {franqueadosSemResposta.length} franqueado(s) ainda não responderam à pesquisa de satisfação.
                  </p>
                  
                  <div style={{ display: "flex", gap: "var(--titan-spacing-sm)", alignItems: "center" }}>
                    <button
                      onClick={handleSelecionarTodos}
                      style={{
                        padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                        background: "var(--titan-card-bg)",
                        color: "var(--titan-text-high)",
                        border: "1px solid var(--titan-stroke)",
                        borderRadius: "var(--titan-radius-sm)",
                        cursor: "pointer",
                        fontSize: "var(--titan-font-size-sm)",
                        fontWeight: "var(--titan-font-weight-medium)"
                      }}
                    >
                      {franqueadosSelecionados.length === franqueadosSemResposta.length ? "Desmarcar Todos" : "Selecionar Todos"}
                    </button>
                    
                    {franqueadosSelecionados.length > 0 && (
                      <button
                        onClick={() => reenviarPesquisas(false)}
                        disabled={reenviando}
                        style={{
                          padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                          background: reenviando ? "var(--titan-text-low)" : "var(--titan-success)",
                          color: "white",
                          border: "none",
                          borderRadius: "var(--titan-radius-sm)",
                          cursor: reenviando ? "not-allowed" : "pointer",
                          fontSize: "var(--titan-font-size-sm)",
                          fontWeight: "var(--titan-font-weight-medium)",
                          opacity: reenviando ? 0.6 : 1
                        }}
                      >
                        {reenviando ? "Reenviando..." : `Reenviar Selecionados (${franqueadosSelecionados.length})`}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--titan-stroke)" }}>
                        <th style={{
                          padding: "var(--titan-spacing-sm)",
                          textAlign: "left",
                          fontSize: "var(--titan-font-size-sm)",
                          fontWeight: "var(--titan-font-weight-semibold)",
                          color: "var(--titan-text-med)",
                          width: "40px"
                        }}>
                          <input
                            type="checkbox"
                            checked={franqueadosSelecionados.length === franqueadosSemResposta.length && franqueadosSemResposta.length > 0}
                            onChange={handleSelecionarTodos}
                            style={{
                              transform: "scale(1.2)",
                              cursor: "pointer"
                            }}
                          />
                        </th>
                        <th style={{
                          padding: "var(--titan-spacing-sm)",
                          textAlign: "left",
                          fontSize: "var(--titan-font-size-sm)",
                          fontWeight: "var(--titan-font-weight-semibold)",
                          color: "var(--titan-text-med)"
                        }}>
                          Franqueado
                        </th>
                        <th style={{
                          padding: "var(--titan-spacing-sm)",
                          textAlign: "left",
                          fontSize: "var(--titan-font-size-sm)",
                          fontWeight: "var(--titan-font-weight-semibold)",
                          color: "var(--titan-text-med)"
                        }}>
                          Unidade
                        </th>
                        <th style={{
                          padding: "var(--titan-spacing-sm)",
                          textAlign: "left",
                          fontSize: "var(--titan-font-size-sm)",
                          fontWeight: "var(--titan-font-weight-semibold)",
                          color: "var(--titan-text-med)"
                        }}>
                          Data de Envio
                        </th>
                        <th style={{
                          padding: "var(--titan-spacing-sm)",
                          textAlign: "center",
                          fontSize: "var(--titan-font-size-sm)",
                          fontWeight: "var(--titan-font-weight-semibold)",
                          color: "var(--titan-text-med)",
                          width: "120px"
                        }}>
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {franqueadosSemResposta.map((franqueado) => (
                        <tr key={franqueado.id} style={{ borderBottom: "1px solid var(--titan-stroke)" }}>
                          <td style={{
                            padding: "var(--titan-spacing-sm)",
                            textAlign: "center"
                          }}>
                            <input
                              type="checkbox"
                              checked={franqueadosSelecionados.includes(franqueado.id)}
                              onChange={() => handleSelecionarFranqueado(franqueado.id)}
                              style={{
                                transform: "scale(1.2)",
                                cursor: "pointer"
                              }}
                            />
                          </td>
                          <td style={{
                            padding: "var(--titan-spacing-sm)",
                            fontSize: "var(--titan-font-size-sm)",
                            color: "var(--titan-text-high)"
                          }}>
                            {franqueado.nome}
                          </td>
                          <td style={{
                            padding: "var(--titan-spacing-sm)",
                            fontSize: "var(--titan-font-size-sm)",
                            color: "var(--titan-text-high)"
                          }}>
                            {franqueado.unidade}
                          </td>
                          <td style={{
                            padding: "var(--titan-spacing-sm)",
                            fontSize: "var(--titan-font-size-sm)",
                            color: "var(--titan-text-med)"
                          }}>
                            {formatarData(franqueado.data_envio)}
                          </td>
                          <td style={{
                            padding: "var(--titan-spacing-sm)",
                            textAlign: "center"
                          }}>
                            <button
                              onClick={() => reenviarPesquisas(false, franqueado.id)}
                              disabled={reenviando}
                              style={{
                                padding: "var(--titan-spacing-xs) var(--titan-spacing-sm)",
                                background: reenviando ? "var(--titan-text-low)" : "var(--titan-warning)",
                                color: "white",
                                border: "none",
                                borderRadius: "var(--titan-radius-sm)",
                                cursor: reenviando ? "not-allowed" : "pointer",
                                fontSize: "var(--titan-font-size-xs)",
                                fontWeight: "var(--titan-font-weight-medium)",
                                opacity: reenviando ? 0.6 : 1,
                                transition: "all var(--titan-transition-fast)"
                              }}
                              onMouseEnter={(e) => {
                                if (!reenviando) {
                                  e.currentTarget.style.background = "var(--titan-warning-hover)";
                                  e.currentTarget.style.transform = "scale(1.05)";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!reenviando) {
                                  e.currentTarget.style.background = "var(--titan-warning)";
                                  e.currentTarget.style.transform = "scale(1)";
                                }
                              }}
                            >
                              {reenviando ? "..." : "Reenviar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{
                textAlign: "center",
                padding: "var(--titan-spacing-xl)",
                color: "var(--titan-text-med)"
              }}>
                Todos os franqueados já responderam à pesquisa!
              </div>
            )}

            <div style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "var(--titan-spacing-lg)"
            }}>
              <button
                onClick={fecharModalSemResposta}
                style={{
                  padding: "var(--titan-spacing-sm) var(--titan-spacing-md)",
                  background: "var(--titan-primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--titan-radius-sm)",
                  cursor: "pointer",
                  fontSize: "var(--titan-font-size-sm)",
                  fontWeight: "var(--titan-font-weight-medium)"
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Respostas Detalhadas */}
      {modalRespostas && pesquisaSelecionada && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(11, 11, 17, 0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: "var(--titan-z-modal)"
        }}>
          <div style={{
            background: "var(--titan-base-0)",
            border: "1px solid var(--titan-stroke)",
            borderRadius: "var(--titan-radius-xl)",
            padding: "var(--titan-spacing-2xl)",
            maxWidth: "1000px",
            width: "95%",
            maxHeight: "90vh",
            overflow: "auto",
            boxShadow: "var(--titan-shadow-lg)"
          }}>
            {/* Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--titan-spacing-2xl)",
              paddingBottom: "var(--titan-spacing-lg)",
              borderBottom: "2px solid var(--titan-stroke)"
            }}>
              <div>
                <h2 style={{
                  fontSize: "var(--titan-font-size-2xl)",
                  fontWeight: "var(--titan-font-weight-bold)",
                  color: "var(--titan-text-high)",
                  margin: 0,
                  marginBottom: "var(--titan-spacing-xs)"
                }}>
                  Respostas Completas da Pesquisa
                </h2>
                <p style={{
                  fontSize: "var(--titan-font-size-base)",
                  color: "var(--titan-text-med)",
                  margin: 0
                }}>
                  <strong style={{ color: "var(--titan-primary)" }}>{pesquisaSelecionada.franqueado_nome}</strong> - {pesquisaSelecionada.unidade}
                </p>
              </div>
              <button
                onClick={fecharModalRespostas}
                style={{
                  background: "var(--titan-card-bg)",
                  border: "1px solid var(--titan-stroke)",
                  cursor: "pointer",
                  fontSize: "20px",
                  color: "var(--titan-text-med)",
                  padding: "var(--titan-spacing-sm)",
                  borderRadius: "var(--titan-radius-md)",
                  transition: "all var(--titan-transition-fast)",
                  width: "40px",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--titan-error)";
                  e.currentTarget.style.color = "white";
                  e.currentTarget.style.borderColor = "var(--titan-error)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--titan-card-bg)";
                  e.currentTarget.style.color = "var(--titan-text-med)";
                  e.currentTarget.style.borderColor = "var(--titan-stroke)";
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gap: "var(--titan-spacing-2xl)" }}>
              {/* Nota Geral e Classificação */}
              <div style={{
                background: "var(--titan-card-bg)",
                border: "1px solid var(--titan-stroke)",
                padding: "var(--titan-spacing-xl)",
                borderRadius: "var(--titan-radius-lg)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "var(--titan-spacing-xl)"
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontSize: "var(--titan-font-size-sm)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    color: "var(--titan-text-med)",
                    marginBottom: "var(--titan-spacing-sm)"
                  }}>
                    Nota de Satisfação Geral
                  </div>
                  <div style={{
                    fontSize: "var(--titan-font-size-3xl)",
                    fontWeight: "var(--titan-font-weight-bold)",
                    color: "var(--titan-primary)"
                  }}>
                    {pesquisaSelecionada.nota_satisfacao_geral}/10
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontSize: "var(--titan-font-size-sm)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    color: "var(--titan-text-med)",
                    marginBottom: "var(--titan-spacing-sm)"
                  }}>
                    Classificação NPS
                  </div>
                <span
                  className={`${styles.classificacaoBadge} ${
                    CLASSIFICACAO_BADGE_CLASS[pesquisaSelecionada.nps_classificacao] || ""
                  }`}
                  style={{
                    fontSize: "var(--titan-font-size-base)",
                    fontWeight: "var(--titan-font-weight-semibold)",
                    display: "inline-block",
                  }}
                >
                  {getClassificacaoLabel(pesquisaSelecionada.nps_classificacao)}
                </span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontSize: "var(--titan-font-size-sm)",
                    fontWeight: "var(--titan-font-weight-medium)",
                    color: "var(--titan-text-med)",
                    marginBottom: "var(--titan-spacing-sm)"
                  }}>
                    Data da Resposta
                  </div>
                  <div style={{
                    fontSize: "var(--titan-font-size-lg)",
                    fontWeight: "var(--titan-font-weight-semibold)",
                    color: "var(--titan-text-high)"
                  }}>
                    {formatarData(pesquisaSelecionada.data_resposta)}
                  </div>
                </div>
              </div>

              {/* Todas as Notas por Área */}
              <div>
                <h3 style={{
                  fontSize: "var(--titan-font-size-lg)",
                  fontWeight: "var(--titan-font-weight-semibold)",
                  color: "var(--titan-text-high)",
                  margin: "0 0 var(--titan-spacing-lg) 0"
                }}>
                  Notas por Área de Avaliação
                </h3>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "var(--titan-spacing-lg)"
                }}>
                  {/* Atendimento */}
                  {(pesquisaSelecionada.nota_atendimento !== null && pesquisaSelecionada.nota_atendimento !== undefined) && (
                    <div style={{
                      background: "var(--titan-card-bg)",
                      border: "1px solid var(--titan-stroke)",
                      padding: "var(--titan-spacing-lg)",
                      borderRadius: "var(--titan-radius-lg)",
                      textAlign: "center",
                      transition: "all var(--titan-transition-fast)"
                    }}>
                      <div style={{
                        fontSize: "var(--titan-font-size-sm)",
                        color: "var(--titan-text-med)",
                        marginBottom: "var(--titan-spacing-sm)"
                      }}>
                        Atendimento
                      </div>
                      <div style={{
                        fontSize: "var(--titan-font-size-2xl)",
                        fontWeight: "var(--titan-font-weight-bold)",
                        color: "var(--titan-primary)"
                      }}>
                        {pesquisaSelecionada.nota_atendimento}/10
                      </div>
                    </div>
                  )}

                  {/* T.I. */}
                  {(pesquisaSelecionada.nota_ti !== null && pesquisaSelecionada.nota_ti !== undefined) && (
                    <div style={{
                      background: "var(--titan-card-bg)",
                      border: "1px solid var(--titan-stroke)",
                      padding: "var(--titan-spacing-lg)",
                      borderRadius: "var(--titan-radius-lg)",
                      textAlign: "center"
                    }}>
                      <div style={{
                        fontSize: "var(--titan-font-size-sm)",
                        color: "var(--titan-text-med)",
                        marginBottom: "var(--titan-spacing-sm)"
                      }}>
                        Tecnologia da Informação
                      </div>
                      <div style={{
                        fontSize: "var(--titan-font-size-2xl)",
                        fontWeight: "var(--titan-font-weight-bold)",
                        color: "var(--titan-secondary)"
                      }}>
                        {pesquisaSelecionada.nota_ti}/10
                      </div>
                    </div>
                  )}

                  {/* Parceiros */}
                  {(pesquisaSelecionada.nota_parceiros !== null && pesquisaSelecionada.nota_parceiros !== undefined) && (
                    <div style={{
                      background: "var(--titan-card-bg)",
                      border: "1px solid var(--titan-stroke)",
                      padding: "var(--titan-spacing-lg)",
                      borderRadius: "var(--titan-radius-lg)",
                      textAlign: "center"
                    }}>
                      <div style={{
                        fontSize: "var(--titan-font-size-sm)",
                        color: "var(--titan-text-med)",
                        marginBottom: "var(--titan-spacing-sm)"
                      }}>
                         Parceiros
                      </div>
                      <div style={{
                        fontSize: "var(--titan-font-size-2xl)",
                        fontWeight: "var(--titan-font-weight-bold)",
                        color: "var(--titan-success)"
                      }}>
                        {pesquisaSelecionada.nota_parceiros}/10
                      </div>
                    </div>
                  )}

                  {/* Departamento Fiscal */}
                  {(pesquisaSelecionada.nota_dep_fiscal !== null && pesquisaSelecionada.nota_dep_fiscal !== undefined) && (
                    <div style={{
                      background: "var(--titan-card-bg)",
                      border: "1px solid var(--titan-stroke)",
                      padding: "var(--titan-spacing-lg)",
                      borderRadius: "var(--titan-radius-lg)",
                      textAlign: "center"
                    }}>
                      <div style={{
                        fontSize: "var(--titan-font-size-sm)",
                        color: "var(--titan-text-med)",
                        marginBottom: "var(--titan-spacing-sm)"
                      }}>
                        Departamento Fiscal
                      </div>
                      <div style={{
                        fontSize: "var(--titan-font-size-2xl)",
                        fontWeight: "var(--titan-font-weight-bold)",
                        color: "#3b82f6"
                      }}>
                        {pesquisaSelecionada.nota_dep_fiscal}/10
                      </div>
                    </div>
                  )}

                  {/* Departamento Pessoal */}
                  {(pesquisaSelecionada.nota_dep_pessoal !== null && pesquisaSelecionada.nota_dep_pessoal !== undefined) && (
                    <div style={{
                      background: "var(--titan-card-bg)",
                      border: "1px solid var(--titan-stroke)",
                      padding: "var(--titan-spacing-lg)",
                      borderRadius: "var(--titan-radius-lg)",
                      textAlign: "center"
                    }}>
                      <div style={{
                        fontSize: "var(--titan-font-size-sm)",
                        color: "var(--titan-text-med)",
                        marginBottom: "var(--titan-spacing-sm)"
                      }}>
                      Departamento Pessoal
                      </div>
                      <div style={{
                        fontSize: "var(--titan-font-size-2xl)",
                        fontWeight: "var(--titan-font-weight-bold)",
                        color: "#8b5cf6"
                      }}>
                        {pesquisaSelecionada.nota_dep_pessoal}/10
                      </div>
                    </div>
                  )}

                  {/* Departamento Contábil */}
                  {(pesquisaSelecionada.nota_dep_contabil !== null && pesquisaSelecionada.nota_dep_contabil !== undefined) && (
                    <div style={{
                      background: "var(--titan-card-bg)",
                      border: "1px solid var(--titan-stroke)",
                      padding: "var(--titan-spacing-lg)",
                      borderRadius: "var(--titan-radius-lg)",
                      textAlign: "center"
                    }}>
                      <div style={{
                        fontSize: "var(--titan-font-size-sm)",
                        color: "var(--titan-text-med)",
                        marginBottom: "var(--titan-spacing-sm)"
                      }}>
                        Departamento Contábil
                      </div>
                      <div style={{
                        fontSize: "var(--titan-font-size-2xl)",
                        fontWeight: "var(--titan-font-weight-bold)",
                        color: "#06b6d4"
                      }}>
                        {pesquisaSelecionada.nota_dep_contabil}/10
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Todos os Comentários */}
              <div>
                <h3 style={{
                  fontSize: "var(--titan-font-size-lg)",
                  fontWeight: "var(--titan-font-weight-semibold)",
                  color: "var(--titan-text-high)",
                  margin: "0 0 var(--titan-spacing-lg) 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--titan-spacing-sm)"
                }}>
                  Comentários e Observações
                </h3>
                <div style={{ display: "grid", gap: "var(--titan-spacing-lg)" }}>
                  
                  {/* Comentário Geral */}
                  {pesquisaSelecionada.comentario_geral && (
                    <div style={{
                      background: "var(--titan-card-bg)",
                      border: "1px solid var(--titan-stroke)",
                      padding: "var(--titan-spacing-lg)",
                      borderRadius: "var(--titan-radius-lg)"
                    }}>
                      <div style={{
                        fontSize: "var(--titan-font-size-sm)",
                        fontWeight: "var(--titan-font-weight-semibold)",
                        color: "var(--titan-primary)",
                        marginBottom: "var(--titan-spacing-sm)",
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--titan-spacing-sm)"
                      }}>
                        Comentário Geral
                      </div>
                      <div style={{
                        fontSize: "var(--titan-font-size-sm)",
                        color: "var(--titan-text-high)",
                        lineHeight: "var(--titan-line-height-relaxed)",
                        padding: "var(--titan-spacing-md)",
                        background: "var(--titan-input-bg)",
                        border: "1px solid var(--titan-stroke)",
                        borderRadius: "var(--titan-radius-sm)"
                      }}>
                        {pesquisaSelecionada.comentario_geral}
                      </div>
                    </div>
                  )}

                  {/* Comentário Atendimento */}
                  <div style={{
                    background: "var(--titan-card-bg)",
                    border: "1px solid var(--titan-stroke)",
                    padding: "var(--titan-spacing-lg)",
                    borderRadius: "var(--titan-radius-lg)"
                  }}>
                    <div style={{
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-semibold)",
                      color: "var(--titan-primary)",
                      marginBottom: "var(--titan-spacing-sm)",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--titan-spacing-sm)"
                    }}>
                      Comentário sobre Atendimento
                    </div>
                    <div style={{
                      fontSize: "var(--titan-font-size-sm)",
                      color: "var(--titan-text-high)",
                      lineHeight: "var(--titan-line-height-relaxed)",
                      padding: "var(--titan-spacing-md)",
                      background: "var(--titan-input-bg)",
                      border: "1px solid var(--titan-stroke)",
                      borderRadius: "var(--titan-radius-sm)"
                    }}>
                      {pesquisaSelecionada.comentario_atendimento && pesquisaSelecionada.comentario_atendimento.trim() ? 
                        pesquisaSelecionada.comentario_atendimento : 
                        'Nenhum comentário fornecido sobre atendimento'
                      }
                    </div>
                  </div>

                  {/* Comentário T.I. */}
                  <div style={{
                    background: "var(--titan-card-bg)",
                    border: "1px solid var(--titan-stroke)",
                    padding: "var(--titan-spacing-lg)",
                    borderRadius: "var(--titan-radius-lg)"
                  }}>
                    <div style={{
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-semibold)",
                      color: "var(--titan-secondary)",
                      marginBottom: "var(--titan-spacing-sm)",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--titan-spacing-sm)"
                    }}>
                      Comentário sobre T.I.
                    </div>
                    <div style={{
                      fontSize: "var(--titan-font-size-sm)",
                      color: "var(--titan-text-high)",
                      lineHeight: "var(--titan-line-height-relaxed)",
                      padding: "var(--titan-spacing-md)",
                      background: "var(--titan-input-bg)",
                      border: "1px solid var(--titan-stroke)",
                      borderRadius: "var(--titan-radius-sm)"
                    }}>
                      {pesquisaSelecionada.comentario_ti && pesquisaSelecionada.comentario_ti.trim() ? 
                        pesquisaSelecionada.comentario_ti : 
                        'Nenhum comentário fornecido sobre T.I.'
                      }
                    </div>
                  </div>

                  {/* Comentário Parceiros */}
                  <div style={{
                    background: "var(--titan-card-bg)",
                    border: "1px solid var(--titan-stroke)",
                    padding: "var(--titan-spacing-lg)",
                    borderRadius: "var(--titan-radius-lg)"
                  }}>
                    <div style={{
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-semibold)",
                      color: "var(--titan-success)",
                      marginBottom: "var(--titan-spacing-sm)",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--titan-spacing-sm)"
                    }}>
                      Comentário sobre Parceiros
                    </div>
                    <div style={{
                      fontSize: "var(--titan-font-size-sm)",
                      color: "var(--titan-text-high)",
                      lineHeight: "var(--titan-line-height-relaxed)",
                      padding: "var(--titan-spacing-md)",
                      background: "var(--titan-input-bg)",
                      border: "1px solid var(--titan-stroke)",
                      borderRadius: "var(--titan-radius-sm)"
                    }}>
                      {pesquisaSelecionada.comentario_parceiros && pesquisaSelecionada.comentario_parceiros.trim() ? 
                        pesquisaSelecionada.comentario_parceiros : 
                        'Nenhum comentário fornecido sobre parceiros'
                      }
                    </div>
                  </div>

                  {/* Comentário Fiscal */}
                  <div style={{
                    background: "var(--titan-card-bg)",
                    border: "1px solid var(--titan-stroke)",
                    padding: "var(--titan-spacing-lg)",
                    borderRadius: "var(--titan-radius-lg)"
                  }}>
                    <div style={{
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-semibold)",
                      color: "#3b82f6",
                      marginBottom: "var(--titan-spacing-sm)",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--titan-spacing-sm)"
                    }}>
                      Comentário sobre Departamento Fiscal
                    </div>
                    <div style={{
                      fontSize: "var(--titan-font-size-sm)",
                      color: "var(--titan-text-high)",
                      lineHeight: "var(--titan-line-height-relaxed)",
                      padding: "var(--titan-spacing-md)",
                      background: "var(--titan-input-bg)",
                      border: "1px solid var(--titan-stroke)",
                      borderRadius: "var(--titan-radius-sm)"
                    }}>
                      {pesquisaSelecionada.comentario_fiscal && pesquisaSelecionada.comentario_fiscal.trim() ? 
                        pesquisaSelecionada.comentario_fiscal : 
                        'Nenhum comentário fornecido sobre departamento fiscal'
                      }
                    </div>
                  </div>

                  {/* Comentário Pessoal */}
                  <div style={{
                    background: "var(--titan-card-bg)",
                    border: "1px solid var(--titan-stroke)",
                    padding: "var(--titan-spacing-lg)",
                    borderRadius: "var(--titan-radius-lg)"
                  }}>
                    <div style={{
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-semibold)",
                      color: "#8b5cf6",
                      marginBottom: "var(--titan-spacing-sm)",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--titan-spacing-sm)"
                    }}>
                      Comentário sobre Departamento Pessoal
                    </div>
                    <div style={{
                      fontSize: "var(--titan-font-size-sm)",
                      color: "var(--titan-text-high)",
                      lineHeight: "var(--titan-line-height-relaxed)",
                      padding: "var(--titan-spacing-md)",
                      background: "var(--titan-input-bg)",
                      border: "1px solid var(--titan-stroke)",
                      borderRadius: "var(--titan-radius-sm)"
                    }}>
                      {pesquisaSelecionada.comentario_pessoal && pesquisaSelecionada.comentario_pessoal.trim() ? 
                        pesquisaSelecionada.comentario_pessoal : 
                        'Nenhum comentário fornecido sobre departamento pessoal'
                      }
                    </div>
                  </div>

                  {/* Comentário Contábil */}
                  <div style={{
                    background: "var(--titan-card-bg)",
                    border: "1px solid var(--titan-stroke)",
                    padding: "var(--titan-spacing-lg)",
                    borderRadius: "var(--titan-radius-lg)"
                  }}>
                    <div style={{
                      fontSize: "var(--titan-font-size-sm)",
                      fontWeight: "var(--titan-font-weight-semibold)",
                      color: "#06b6d4",
                      marginBottom: "var(--titan-spacing-sm)",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--titan-spacing-sm)"
                    }}>
                      Comentário sobre Departamento Contábil
                    </div>
                    <div style={{
                      fontSize: "var(--titan-font-size-sm)",
                      color: "var(--titan-text-high)",
                      lineHeight: "var(--titan-line-height-relaxed)",
                      padding: "var(--titan-spacing-md)",
                      background: "var(--titan-input-bg)",
                      border: "1px solid var(--titan-stroke)",
                      borderRadius: "var(--titan-radius-sm)"
                    }}>
                      {pesquisaSelecionada.comentario_contabil && pesquisaSelecionada.comentario_contabil.trim() ? 
                        pesquisaSelecionada.comentario_contabil : 
                        'Nenhum comentário fornecido sobre departamento contábil'
                      }
                    </div>
                  </div>


                </div>
              </div>

              {/* Footer com botão de fechar */}
              <div style={{
                display: "flex",
                justifyContent: "flex-end",
                paddingTop: "var(--titan-spacing-lg)",
                borderTop: "2px solid var(--titan-stroke)"
              }}>
                <button
                  onClick={fecharModalRespostas}
                  style={{
                    padding: "var(--titan-spacing-md) var(--titan-spacing-xl)",
                    background: "var(--titan-primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "var(--titan-radius-md)",
                    cursor: "pointer",
                    fontSize: "var(--titan-font-size-base)",
                    fontWeight: "var(--titan-font-weight-semibold)",
                    transition: "all var(--titan-transition-fast)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--titan-spacing-sm)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--titan-primary-hover)";
                    e.currentTarget.style.transform = "scale(1.02)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--titan-primary)";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                   Fechar Modal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
