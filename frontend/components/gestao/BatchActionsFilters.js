import React, { useState, useEffect } from "react";
import styles from "../../styles/gestao/BatchActionsFilters.module.css";
import ClienteSelect from "./ClienteSelect";
import Select from "react-select";

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

export default function BatchActionsFilters({ onSearch, onDelete, onUpdateResponsavelExclusivo, loading = false, selectedIds = [] }) {
  const [filters, setFilters] = useState({
    tipoTarefa: "obrigacoes",
    departamento: "",
    status: "",
    data: "acao",
    periodoInicial: "",
    periodoFinal: "",
    cliente: "",
    tipoUsuario: "todos",
    usuario: "",
    time: "",
    grupo: "",
    obrigacoes: "",
    responsavelExclusivo: "",
    frequencia: "",
    publicacao: "todos",
    comUltimoAndamento: false,
    comAtividades: false,
    comResponsaveis: false,
    comConvidados: false
  });

  const [departamentos, setDepartamentos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [obrigacoes, setObrigacoes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [mostrarModalResponsavel, setMostrarModalResponsavel] = useState(false);
  const [novoResponsavelId, setNovoResponsavelId] = useState("");

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const token = getToken();
      const empresaId = getEmpresaId();

      // Carregar departamentos
      const deptRes = await fetch(`${BASE_URL}/gestao/departamentos/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const deptData = await deptRes.json().catch(() => ([]));
      setDepartamentos(deptData || []);

      // Carregar usuários
      const userRes = await fetch(`${BASE_URL}/usuarios`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userData = await userRes.json().catch(() => ([]));
      const normalizedUsers = Array.isArray(userData)
        ? userData
        : (userData?.usuarios || userData?.data || userData?.items || []);
      setUsuarios(normalizedUsers);

      // Carregar grupos da empresa
      const gruposRes = await fetch(`${BASE_URL}/gestao/clientes/grupos/todos?empresaId=${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const gruposData = await gruposRes.json().catch(() => ({}));
      setGrupos(gruposData.grupos || []);

      // Carregar obrigações ou tarefas
      if (empresaId) {
        if (filters.tipoTarefa === "tarefas") {
          const tarefasRes = await fetch(`${BASE_URL}/gestao/tarefas/todas/${empresaId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const tarefasData = await tarefasRes.json().catch(() => ([]));
          const normalizedTarefas = Array.isArray(tarefasData)
            ? tarefasData
            : (tarefasData?.tarefas || tarefasData?.data || tarefasData?.items || []);
          setObrigacoes(normalizedTarefas);
        } else {
          const obrRes = await fetch(`${BASE_URL}/gestao/obrigacoes/empresa/${empresaId}`);
          const obrData = await obrRes.json().catch(() => ([]));
          const normalizedObrigacoes = Array.isArray(obrData)
            ? obrData
            : (obrData?.obrigacoes || obrData?.data || obrData?.items || []);
          setObrigacoes(normalizedObrigacoes);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  // Atualizar obrigações/tarefas ao trocar tipoTarefa
  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.tipoTarefa]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSearch = () => {
    onSearch(filters);
  };

  const handleDelete = () => {
    if (selectedIds.length > 0) {
      onDelete(selectedIds);
    }
  };

  const handleUpdateResponsavelExclusivo = () => {
    if (selectedIds.length > 0 && novoResponsavelId) {
      onUpdateResponsavelExclusivo?.(selectedIds, parseInt(novoResponsavelId));
      setMostrarModalResponsavel(false);
      setNovoResponsavelId("");
    }
  };

  const limparFiltro = (field) => {
    setFilters(prev => ({
      ...prev,
      [field]: ""
    }));
  };

  const limparTodosFiltros = () => {
    setFilters({
      tipoTarefa: "obrigacoes",
      departamento: "",
      status: "",
      data: "acao",
      periodoInicial: "",
      periodoFinal: "",
      cliente: "",
      tipoUsuario: "todos",
      usuario: "",
      time: "",
      grupo: "",
      obrigacoes: "",
      responsavelExclusivo: "",
      frequencia: "",
      publicacao: "todos",
      comUltimoAndamento: false,
      comAtividades: false,
      comResponsaveis: false,
      comConvidados: false
    });
  };

  // Função para obter o label do campo de data baseado no tipo selecionado
  const getDataLabel = () => {
    switch (filters.data) {
      case "acao":
        return "Por Data de Ação:";
      case "meta":
        return "Por Data de Meta:";
      case "vencimento":
        return "Por Data de Vencimento:";
      case "conclusao":
        return "Por Data de Conclusão:";
      default:
        return "Por Data:";
    }
  };

  // Estilos do React Select foram migrados para classes globais (globals.css)

  return (
    <>
      <div className={styles.card}>
        <h3 className={styles.title}>
          Filtros para Ações em Lote
        </h3>

        <div className={styles.grid}>
          {/* Coluna 1 */}
          <div>
            <div className={styles.section}>
              <label className={styles.formLabelSmall}>
                Por Tipo Tarefa:
              </label>
              <Select
                value={{ value: filters.tipoTarefa, label: filters.tipoTarefa === "obrigacoes" ? "Obrigações" : "Tarefas" }}
                onChange={(option) => handleFilterChange("tipoTarefa", option?.value || "")}
                options={[
                  { value: "obrigacoes", label: "Obrigações" },
                  { value: "tarefas", label: "Tarefas" }
                ]}
                isSearchable={false}
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>

            <div className={styles.section}>
              <label className={styles.formLabelSmall}>
                Por Data:
              </label>
              <Select
                value={{ 
                  value: filters.data, 
                  label: filters.data === "acao" ? "Ação" : 
                         filters.data === "meta" ? "Meta" : 
                         filters.data === "vencimento" ? "Vencimento" : 
                         filters.data === "conclusao" ? "Conclusão" : "Ação"
                }}
                onChange={(option) => handleFilterChange("data", option?.value || "")}
                options={[
                  { value: "acao", label: "Ação" },
                  { value: "meta", label: "Meta" },
                  { value: "vencimento", label: "Vencimento" },
                  { value: "conclusao", label: "Conclusão" }
                ]}
                isSearchable={false}
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>

            <div className={styles.section}>
              <label className={styles.formLabelSmall}>
                Por Obrigações:
              </label>
              <Select
                value={filters.obrigacoes ? {
                  value: filters.obrigacoes,
                  label: obrigacoes.find(item => 
                    filters.tipoTarefa === "tarefas" ? item.id === filters.obrigacoes : item.nome === filters.obrigacoes
                  )?.assunto || obrigacoes.find(item => 
                    filters.tipoTarefa === "tarefas" ? item.id === filters.obrigacoes : item.nome === filters.obrigacoes
                  )?.nome || filters.obrigacoes
                } : null}
                onChange={(option) => handleFilterChange("obrigacoes", option?.value || "")}
                options={[
                  { value: "", label: filters.tipoTarefa === "tarefas" ? "Todas as tarefas" : "Todas as obrigações" },
                  ...obrigacoes.map(item => ({
                    value: filters.tipoTarefa === "tarefas" ? item.id : item.nome,
                    label: filters.tipoTarefa === "tarefas" ? (item.assunto || item.nome) : item.nome
                  }))
                ]}
                placeholder={filters.tipoTarefa === "tarefas" ? "Buscar tarefas..." : "Buscar obrigações..."}
                className="react-select-container"
                classNamePrefix="react-select"
                noOptionsMessage={() => "Nenhuma opção encontrada"}
              />
            </div>

            <div className={styles.section}>
              <label className={styles.formLabelSmall}>
                Por Publicação:
              </label>
              <Select
                value={{ 
                  value: filters.publicacao, 
                  label: filters.publicacao === "todos" ? "Todos" : 
                         filters.publicacao === "publica" ? "Pública" : 
                         filters.publicacao === "privada" ? "Privada" : "Todos"
                }}
                onChange={(option) => handleFilterChange("publicacao", option?.value || "")}
                options={[
                  { value: "todos", label: "Todos" },
                  { value: "publica", label: "Pública" },
                  { value: "privada", label: "Privada" }
                ]}
                isSearchable={false}
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>
          </div>

          {/* Coluna 2 */}
          <div>
            <div className={styles.section}>
              <label className={styles.formLabelSmall}>
                Por Departamento:
              </label>
              <Select
                value={filters.departamento ? {
                  value: filters.departamento,
                  label: departamentos.find(dept => dept.nome === filters.departamento)?.nome || filters.departamento
                } : null}
                onChange={(option) => handleFilterChange("departamento", option?.value || "")}
                options={[
                  { value: "", label: "Todos os departamentos" },
                  ...departamentos.map(dept => ({
                    value: dept.nome,
                    label: dept.nome
                  }))
                ]}
                placeholder="Buscar departamentos..."
                className="react-select-container"
                classNamePrefix="react-select"
                noOptionsMessage={() => "Nenhum departamento encontrado"}
              />
            </div>

            <div className={styles.section}>
              <label className={styles.formLabelSmall}>
                {getDataLabel()}
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type="date"
                  value={filters.periodoInicial}
                  onChange={(e) => handleFilterChange("periodoInicial", e.target.value)}
                  className={styles.inputDate}
                />
                {filters.periodoInicial && (
                  <button
                    onClick={() => limparFiltro("periodoInicial")}
                    className={styles.clearLink}
                  >
                    limpar
                  </button>
                )}
              </div>
            </div>

            <div className={styles.section}>
              <label className={styles.formLabelSmall}>
                Por Usuário:
              </label>
              <Select
                value={filters.usuario ? {
                  value: filters.usuario,
                  label: usuarios.find(user => user.id === filters.usuario)?.nome || filters.usuario
                } : null}
                onChange={(option) => handleFilterChange("usuario", option?.value || "")}
                options={[
                  { value: "", label: "Selecione..." },
                  ...usuarios.map(user => ({
                    value: user.id,
                    label: user.nome
                  }))
                ]}
                placeholder="Buscar usuários..."
                className="react-select-container"
                classNamePrefix="react-select"
                noOptionsMessage={() => "Nenhum usuário encontrado"}
              />
            </div>

            <div className={styles.section}>
              <label className={styles.formLabelSmall}>
                Por Grupo:
              </label>
              <Select
                value={filters.grupo ? {
                  value: filters.grupo,
                  label: grupos.find(grupo => grupo.id === filters.grupo)?.nome || filters.grupo
                } : null}
                onChange={(option) => handleFilterChange("grupo", option?.value || "")}
                options={[
                  { value: "", label: "Todos os grupos" },
                  ...grupos.map(grupo => ({
                    value: grupo.id,
                    label: grupo.nome
                  }))
                ]}
                placeholder="Buscar grupos..."
                className="react-select-container"
                classNamePrefix="react-select"
                noOptionsMessage={() => "Nenhum grupo encontrado"}
              />
            </div>

          </div>

          {/* Coluna 3 */}
          <div>
            <div className={styles.section}>
              <label className={styles.formLabelSmall}>
                Por Status:
              </label>
              <Select
                value={filters.status ? {
                  value: filters.status,
                  label: filters.status === "pendente" ? "Aberto" : 
                         filters.status === "cancelada" ? "Cancelado" : 
                         filters.status === "concluida" ? "Concluído" : filters.status
                } : null}
                onChange={(option) => handleFilterChange("status", option?.value || "")}
                options={[
                  { value: "", label: "Selecione..." },
                  { value: "pendente", label: "Aberto" },
                  { value: "cancelada", label: "Cancelado" },
                  { value: "concluida", label: "Concluído" }
                ]}
                isSearchable={false}
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>

            <div className={styles.section}>
              <label className={styles.formLabelSmall}>
                Até:
              </label>
              <div className={styles.inputWrapper}>
                <input
                  type="date"
                  value={filters.periodoFinal}
                  onChange={(e) => handleFilterChange("periodoFinal", e.target.value)}
                  className={styles.inputDateFull}
                />
                {filters.periodoFinal && (
                  <button
                    onClick={() => limparFiltro("periodoFinal")}
                    className={styles.clearLink}
                  >
                    limpar
                  </button>
                )}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabelSmall}>
                Por Cliente:
              </label>
              <ClienteSelect
                value={filters.cliente}
                onChange={(e) => handleFilterChange("cliente", e.target.value)}
                isClearable={true}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabelSmall}>
                Por Frequência:
              </label>
              <Select
                value={filters.frequencia ? {
                  value: filters.frequencia,
                  label: filters.frequencia === "mensal" ? "Mensal" : 
                         filters.frequencia === "trimestral" ? "Trimestral" : 
                         filters.frequencia === "semestral" ? "Semestral" : 
                         filters.frequencia === "anual" ? "Anual" : filters.frequencia
                } : null}
                onChange={(option) => handleFilterChange("frequencia", option?.value || "")}
                options={[
                  { value: "", label: "Selecione..." },
                  { value: "mensal", label: "Mensal" },
                  { value: "trimestral", label: "Trimestral" },
                  { value: "semestral", label: "Semestral" },
                  { value: "anual", label: "Anual" }
                ]}
                isSearchable={false}
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className={styles.actionsBar}>
          <div className={styles.actionsLeft}>
            <button
              onClick={handleSearch}
              disabled={loading}
              className={styles.buttonPrimary}
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>

            <button
              onClick={handleDelete}
              disabled={selectedIds.length === 0 || loading}
              className={styles.buttonDanger}
            >
              Excluir ({selectedIds.length})
            </button>

            <button
              onClick={() => setMostrarModalResponsavel(true)}
              disabled={selectedIds.length === 0 || loading}
              className={styles.buttonSuccess}
            >
              Responsável Exclusivo ({selectedIds.length})
            </button>
          </div>

          <button
            onClick={limparTodosFiltros}
            className={Object.values(filters).some(value => 
                value !== "" && value !== "obrigacoes" && value !== "acao" && value !== "todos" && value !== false
            ) ? styles.buttonResetActive : styles.buttonReset}
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Modal para selecionar novo responsável exclusivo */}
      {mostrarModalResponsavel && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Alterar Responsável Exclusivo</h2>
              <button
                onClick={() => {
                  setMostrarModalResponsavel(false);
                  setNovoResponsavelId("");
                }}
                className={styles.closeButton}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalDescription}>
                Selecione o novo responsável exclusivo para <strong>{selectedIds.length}</strong> item(s) selecionado(s).
              </p>

              <label className={styles.formLabelSmall}>
                Novo Responsável:
              </label>
              <Select
                value={novoResponsavelId ? {
                  value: novoResponsavelId,
                  label: usuarios.find(user => user.id === novoResponsavelId)?.nome || novoResponsavelId
                } : null}
                onChange={(option) => setNovoResponsavelId(option?.value || "")}
                options={[
                  { value: "", label: "Selecione um responsável..." },
                  ...usuarios.map(user => ({
                    value: user.id,
                    label: user.nome
                  }))
                ]}
                placeholder="Buscar responsáveis..."
                className="react-select-container"
                classNamePrefix="react-select"
                noOptionsMessage={() => "Nenhum responsável encontrado"}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                onClick={() => {
                  setMostrarModalResponsavel(false);
                  setNovoResponsavelId("");
                }}
                className={styles.buttonSecondary}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateResponsavelExclusivo}
                disabled={!novoResponsavelId}
                className={!novoResponsavelId ? styles.buttonConfirmDisabled : styles.buttonConfirm}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 