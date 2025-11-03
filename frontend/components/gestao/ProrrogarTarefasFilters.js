import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import ClienteSelect from "./ClienteSelect";
import ModalProrrogarTarefas from "./ModalProrrogarTarefas";
import styles from "../../styles/gestao/ProrrogarTarefasFilters.module.css";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

const getToken = () => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
};

const getEmpresaId = () => {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("userData");
    if (raw) {
      const u = JSON.parse(raw);
      return (
        u?.EmpresaId || u?.empresaId || u?.empresa_id || u?.companyId || u?.company_id || ""
      );
    }
  } catch {}
  return sessionStorage.getItem("empresaId") || "";
};

export default function ProrrogarTarefasFilters({ onProrrogar, onBuscar, loading = false, buscando = false }) {
  const [filters, setFilters] = useState({
    tipoTarefa: "obrigacoes",
    departamento: "",
    status: "",
    obrigacaoId: "",
    clienteId: "",
    competenciaMes: "",
    competenciaAno: "",
    competenciaFinalMes: "",
    competenciaFinalAno: ""
  });

  const [departamentos, setDepartamentos] = useState([]);
  const [obrigacoes, setObrigacoes] = useState([]);
  const [obrigacoesFiltradas, setObrigacoesFiltradas] = useState([]);
  const [modalProrrogarAberto, setModalProrrogarAberto] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  // Filtrar obrigações quando o departamento mudar
  useEffect(() => {
    if (filters.departamento) {
      const obrigacoesDoDepartamento = obrigacoes.filter(
        ob => ob.departamentoNome === filters.departamento
      );
      setObrigacoesFiltradas(obrigacoesDoDepartamento);
      // Limpar seleção de obrigação quando mudar departamento
      setFilters(prev => ({ ...prev, obrigacaoId: "" }));
    } else {
      setObrigacoesFiltradas(obrigacoes);
    }
  }, [filters.departamento, obrigacoes]);

  const carregarDados = async () => {
    try {
      const token = getToken();
      const empresaId = getEmpresaId();

      if (!empresaId) return;

      // Carregar departamentos
      const deptRes = await fetch(`${BASE_URL}/gestao/departamentos/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const deptData = await deptRes.json().catch(() => ([]));
      setDepartamentos(deptData || []);

      // Carregar obrigações
      const obrRes = await fetch(`${BASE_URL}/gestao/obrigacoes/empresa/${empresaId}`);
      const obrData = await obrRes.json().catch(() => ([]));
      setObrigacoes(obrData || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleProrrogar = () => {
    if (!filters.obrigacaoId) {
      toast.warning("Por favor, selecione uma obrigação antes de prorrogar.");
      return;
    }
    setModalProrrogarAberto(true);
  };

  const handleConfirmarProrrogar = async (dados) => {
    // Validar se pelo menos uma data foi preenchida
    if (dados.alterarAcao && !dados.novaAcao) {
      toast.error("Por favor, informe a nova data da Ação.");
      return;
    }
    if (dados.alterarMeta && !dados.novaMeta) {
      toast.error("Por favor, informe a nova data da Meta.");
      return;
    }
    if (dados.alterarVencimento && !dados.novoVencimento) {
      toast.error("Por favor, informe a nova data do Vencimento.");
      return;
    }

    // Enviar dados para prorrogação
    onProrrogar({
      ...filters,
      ...dados
    });
    
    setModalProrrogarAberto(false);
  };

  const handleBuscar = () => {
    if (!filters.obrigacaoId) {
      toast.warning("Por favor, selecione uma obrigação antes de buscar.");
      return;
    }

    // Formatar os filtros de competência para o formato esperado pelo backend
    let competenciaInicial, competenciaFinal, competenciaExata;
    
    if (filters.competenciaMes && filters.competenciaAno) {
      if (filters.competenciaFinalMes && filters.competenciaFinalAno) {
        // Range de competências
        competenciaInicial = {
          mes: parseInt(filters.competenciaMes),
          ano: parseInt(filters.competenciaAno)
        };
        competenciaFinal = {
          mes: parseInt(filters.competenciaFinalMes),
          ano: parseInt(filters.competenciaFinalAno)
        };
      } else {
        // Competência exata
        competenciaExata = {
          mes: parseInt(filters.competenciaMes),
          ano: parseInt(filters.competenciaAno)
        };
      }
    }

    const filtrosFormatados = {
      ...filters,
      competenciaInicial,
      competenciaFinal,
      competenciaExata
    };

    // Remover os campos antigos que não são mais necessários
    const { competenciaMes, competenciaAno, competenciaFinalMes, competenciaFinalAno, ...filtrosLimpos } = filtrosFormatados;

    console.log("🔍 [Frontend] Filtros formatados para busca:", filtrosLimpos);
    onBuscar(filtrosLimpos);
  };

  const limparFiltro = (field) => {
    setFilters(prev => ({
      ...prev,
              [field]: field === "tipoTarefa" ? "obrigacoes" : ""
    }));
  };

  const limparTodosFiltros = () => {
    setFilters({
      tipoTarefa: "obrigacoes",
      departamento: "",
      status: "",
      obrigacaoId: "", // Mantém vazio para forçar seleção
      clienteId: "",
      competenciaMes: "",
      competenciaAno: "",
      competenciaFinalMes: "",
      competenciaFinalAno: ""
    });
  };

  // Formatar data para exibição
  const formatarData = (data) => {
    if (!data) return "";
    const d = new Date(data);
    const meses = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    return `${meses[d.getMonth()]} de ${d.getFullYear()}`;
  };



  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Filtros para Prorrogação de Tarefas</h3>

      <div className={styles.grid3}>
        {/* Coluna 1 */}
        <div>
          <div className={styles.section}>
            <label className={styles.formLabelSmall}>
              Por Tipo Tarefa:
            </label>
            <select
              value={filters.tipoTarefa}
              onChange={(e) => handleFilterChange("tipoTarefa", e.target.value)}
              className={styles.select}
            >
              <option value="obrigacoes">Obrigações</option>
              <option value="tarefas">Tarefas</option>
            </select>
          </div>

          <div className={styles.section}>
            <label className={styles.formLabelSmall}>
              Por Departamento:
            </label>
            <select
              value={filters.departamento}
              onChange={(e) => handleFilterChange("departamento", e.target.value)}
              className={styles.select}
            >
              <option value="">Todos os departamentos</option>
              {departamentos.map(dept => (
                <option key={dept.id} value={dept.nome}>
                  {dept.nome}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.section}>
            <label className={styles.formLabelSmall}>
              Por Status:
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className={styles.select}
            >
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="concluida">Concluída</option>
            </select>
          </div>
        </div>

        {/* Coluna 2 */}
        <div>
          <div className={styles.section}>
            <label className={styles.formLabelSmall}>
              Por Obrigações: *
            </label>
            <select
              value={filters.obrigacaoId}
              onChange={(e) => handleFilterChange("obrigacaoId", e.target.value)}
              required
              className={`${styles.select} ${!filters.obrigacaoId ? styles.selectError : ""}`}
            >
              <option value="">Selecione uma obrigação *</option>
              <option value="todas">Todas</option>
              {obrigacoesFiltradas.length > 0 ? (
                obrigacoesFiltradas.map(ob => (
                  <option key={ob.id} value={ob.id}>{ob.nome}</option>
                ))
              ) : (
                <option value="" disabled>
                  {filters.departamento ? `Nenhuma obrigação encontrada para ${filters.departamento}` : "Selecione um departamento primeiro"}
                </option>
              )}
            </select>
            {!filters.obrigacaoId && (<div className={styles.helperError}></div>)}
          </div>

          <div className={styles.section}>
            <label className={styles.formLabelSmall}>
              Por Cliente:
            </label>
            <ClienteSelect
              value={filters.clienteId}
              onChange={(e) => handleFilterChange("clienteId", e.target.value)}
              isClearable={true}
            />
          </div>


        </div>

        {/* Coluna 3 */}
        <div>
          <div className={styles.section}>
            <label className={styles.formLabelSmall}>
              Por Competência: *
            </label>
            <div className={styles.grid2Compact}>
              <select
                value={filters.competenciaMes || ""}
                onChange={(e) => handleFilterChange("competenciaMes", e.target.value)}
                className={styles.select}
              >
                <option value="">Mês</option>
                <option value="1">Janeiro</option>
                <option value="2">Fevereiro</option>
                <option value="3">Março</option>
                <option value="4">Abril</option>
                <option value="5">Maio</option>
                <option value="6">Junho</option>
                <option value="7">Julho</option>
                <option value="8">Agosto</option>
                <option value="9">Setembro</option>
                <option value="10">Outubro</option>
                <option value="11">Novembro</option>
                <option value="12">Dezembro</option>
              </select>
              
              <select
                value={filters.competenciaAno || ""}
                onChange={(e) => handleFilterChange("competenciaAno", e.target.value)}
                className={styles.select}
              >
                <option value="">Ano</option>
                {(() => {
                  const anoAtual = new Date().getFullYear();
                  const anos = [];
                  for (let i = anoAtual - 2; i <= anoAtual + 3; i++) {
                    anos.push(i);
                  }
                  return anos.map(ano => (
                    <option key={ano} value={ano}>{ano}</option>
                  ));
                })()}
              </select>
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.formLabelSmall}>
              Por Competência Final:
            </label>
            <div className={styles.grid2Compact}>
              <select
                value={filters.competenciaFinalMes || ""}
                onChange={(e) => handleFilterChange("competenciaFinalMes", e.target.value)}
                className={styles.select}
              >
                <option value="">Mês</option>
                <option value="1">Janeiro</option>
                <option value="2">Fevereiro</option>
                <option value="3">Março</option>
                <option value="4">Abril</option>
                <option value="5">Maio</option>
                <option value="6">Junho</option>
                <option value="7">Julho</option>
                <option value="8">Agosto</option>
                <option value="9">Setembro</option>
                <option value="10">Outubro</option>
                <option value="11">Novembro</option>
                <option value="12">Dezembro</option>
              </select>
              
              <select
                value={filters.competenciaFinalAno || ""}
                onChange={(e) => handleFilterChange("competenciaFinalAno", e.target.value)}
                className={styles.select}
              >
                <option value="">Ano</option>
                {(() => {
                  const anoAtual = new Date().getFullYear();
                  const anos = [];
                  for (let i = anoAtual - 2; i <= anoAtual + 3; i++) {
                    anos.push(i);
                  }
                  return anos.map(ano => (
                    <option key={ano} value={ano}>{ano}</option>
                  ));
                })()}
              </select>
            </div>
          </div>
        </div>
      </div>



      {/* Botões de Ação */}
      <div className={styles.actionsBar}>
        <div className={styles.actionsLeft}>
          <button
            onClick={handleBuscar}
            disabled={buscando}
            className={styles.buttonPrimary}
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>

          <button
            onClick={handleProrrogar}
            disabled={loading}
            className={styles.buttonSuccess}
          >
            {loading ? "Prorrogando..." : "Prorrogar"}
          </button>
        </div>

        <button
          onClick={limparTodosFiltros}
          className={Object.values(filters).some(value => value !== "" && value !== "obrigacoes") ? styles.buttonResetActive : styles.buttonReset}
        >
          Limpar Filtros
        </button>
      </div>

      {/* Modal de Prorrogação */}
      <ModalProrrogarTarefas
        isOpen={modalProrrogarAberto}
        onClose={() => setModalProrrogarAberto(false)}
        onConfirm={handleConfirmarProrrogar}
        loading={loading}
      />
    </div>
  );
}
