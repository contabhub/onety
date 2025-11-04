"use client";

import React, { useState, useEffect } from "react";
import styles from "../../styles/gestao/VisaoGeralModal.module.css";

function compareVencimento(a, b) {
  const vA = a.dataPrazo ?? a.vencimento ?? "";
  const vB = b.dataPrazo ?? b.vencimento ?? "";
  if (!vA && !vB) return 0;
  if (!vA) return 1;
  if (!vB) return -1;
  // Transforma para milissegundos pra comparar corretamente (evita bug com string)
  return new Date(vA).getTime() - new Date(vB).getTime();
}

function compareConclusao(a, b) {
  const dA = a.tipo === "tarefa" ? a.dataConclusao : a.dataBaixa;
  const dB = b.tipo === "tarefa" ? b.dataConclusao : b.dataBaixa;
  if (!dA && !dB) return 0;
  if (!dA) return 1;
  if (!dB) return -1;
  return new Date(dA).getTime() - new Date(dB).getTime();
}





export default function VisaoGeralModal({
  titulo,
  tarefas,
  visible,
  onClose,
  abaAtiva,
  setAbaAtiva,
}) {
  if (!visible) return null;

  const [paginaAtual, setPaginaAtual] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [sortConfig, setSortConfig] = useState(
    { key: "vencimento", direction: "asc" }
  );



  function requestSort(key) {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setPaginaAtual(1); // resetar página ao ordenar
  }

  function getDataAjustada(venc) {
    if (!venc) return "-";
    const dataVencimento = venc.split("T")[0];
    const [ano, mes, dia] = dataVencimento.split("-");
    return `${dia}/${mes}/${ano}`;
  }



  const filtroTexto = (t) => {
    const termo = searchTerm.toLowerCase();

    // Procura se searchTerm é id exato
    if (!isNaN(Number(searchTerm)) && String(t.id) === searchTerm) return true;

    // Função para normalizar datas para buscar em diferentes formatos
    const formatarData = (str) => {
      if (!str) return "";
      const soData = str.split("T")[0]; // pega só a parte da data
      const [ano, mes, dia] = soData.split("-");
      return `${dia}/${mes}/${ano}`;
    };

    // Pega vencimento/dataPrazo formatado e bruto
    const dataVenc =
      t.dataPrazo || t.vencimento || "";
    const dataVencFormatada = formatarData(dataVenc);
    const mesAno = dataVencFormatada.slice(3); // pega "07/2025"

    return (
      (String(t.id).includes(termo)) ||
      (t.assunto?.toLowerCase().includes(termo)) ||
      (t.nome?.toLowerCase().includes(termo)) ||
      (t.cliente_nome?.toLowerCase().includes(termo)) ||
      (t.status?.toLowerCase().includes(termo)) ||
      (t.departamento?.toLowerCase().includes(termo)) ||
      (t.responsavel?.toLowerCase().includes(termo)) || // <- Novo campo: responsável
      (dataVenc?.toLowerCase().includes(termo)) ||      // Busca no formato original "2025-07-12"
      (dataVencFormatada?.includes(termo))              // Busca "12/07/2025"
    );
  };



  const solicitacoes = tarefas.filter((t) => t.tipo === "tarefa");
  const obrigacoesListadas = tarefas.filter((t) => t.tipo === "obrigacao");


  const tarefasFiltradasBase = abaAtiva === "solicitacoes" ? solicitacoes : obrigacoesListadas;
  const tarefasFiltradas = tarefasFiltradasBase.filter(filtroTexto);




  const totalPaginas = Math.ceil(tarefasFiltradas.length / itensPorPagina);
  let tarefasOrdenadas = [...tarefasFiltradas];
  if (sortConfig.key) {
    tarefasOrdenadas.sort((a, b) => {
      let result = 0;
      if (sortConfig.key === "vencimento") {
        result = compareVencimento(a, b);
      } else if (sortConfig.key === "conclusao") {
        result = compareConclusao(a, b);
      } else {
        const aValue = sortConfig.key ? a[sortConfig.key] ?? "" : "";
        const bValue = sortConfig.key ? b[sortConfig.key] ?? "" : "";
        result =
          typeof aValue === "number" && typeof bValue === "number"
            ? aValue - bValue
            : String(aValue).localeCompare(String(bValue), "pt-BR", { numeric: true });
      }
      return sortConfig.direction === "asc" ? result : -result;
    });
  }
  const tarefasVisiveis = tarefasOrdenadas.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );


  useEffect(() => {
    setPaginaAtual(1);
  }, [searchTerm, abaAtiva]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [itensPorPagina]);

  // NOVO: Determina se deve mostrar a coluna Conclusão
  const categoriasConcluidas = [
    "Na Programação",
    "Concluída Após Meta",
    "Concluída Após Prazo",
    "Finalizada",
    "Concluída",
    "concluída",
    "concluida",
    "Concluida"
  ];
  const mostrarConclusao =
    titulo.toLowerCase().includes("realizada") ||
    tarefas.every(
      (t) =>
        categoriasConcluidas.includes(t.categoria || "") ||
        categoriasConcluidas.includes(t.status || "")
    );

  // Função utilitária para pegar a data de conclusão correta
  function getDataConclusao(t) {
    if (t.tipo === "tarefa") {
      return getDataAjustada(t.dataConclusao);
    } else {
      return getDataAjustada(t.dataBaixa);
    }
  }

  // Função utilitária para capitalizar a primeira letra
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  return (
    <div
      onClick={onClose}
      className={styles.modalOverlay}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={styles.modalContent}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Lista de Tarefas
          </h2>
          <p className={styles.modalSubtitle}>
            Progresso Atual &gt; {titulo}
          </p>
        </div>

        {/* Abas de navegação */}
        <div className={styles.tabsContainer}>
          <button
            onClick={() => setAbaAtiva("solicitacoes")}
            className={`${styles.tabButton} ${abaAtiva === "solicitacoes" ? styles.active : ""}`}
          >
            Processos
          </button>

          <button
            onClick={() => setAbaAtiva("obrigacoes")}
            className={`${styles.tabButton} ${abaAtiva === "obrigacoes" ? styles.active : ""}`}
          >
            Obrigações
          </button>
        </div>

        <input
          type="text"
          placeholder={`Buscar ${abaAtiva === "solicitacoes" ? "solicitações" : "obrigações"}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />

        {/* Tabela de tarefas */}
        <table className={styles.table}>
          <thead className={styles.tableHeader}>
            <tr>
              <th>No</th>

              <th className={styles.sortable} onClick={() => requestSort("status")}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  Status
                  {sortConfig.key === "status" && (
                    <span className={styles.sortIndicator}>
                      {sortConfig.direction === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </div>
              </th>

              <th className={styles.sortable} onClick={() => requestSort("departamento")}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  Departamento
                  {sortConfig.key === "departamento" && (
                    <span className={styles.sortIndicator}>
                      {sortConfig.direction === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </div>
              </th>

              <th className={styles.sortable} onClick={() => requestSort("id")}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  ID
                  {sortConfig.key === "id" && (
                    <span className={styles.sortIndicator}>
                      {sortConfig.direction === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </div>
              </th>

              <th className={styles.sortable} style={{ minWidth: 120, maxWidth: 180, wordBreak: "break-word" }} onClick={() => requestSort("assunto")}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  Assunto
                  {sortConfig.key === "assunto" && (
                    <span className={styles.sortIndicator}>
                      {sortConfig.direction === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </div>
              </th>

              <th className={styles.sortable} onClick={() => requestSort("cliente_nome")}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  Cliente
                  {sortConfig.key === "cliente_nome" && (
                    <span className={styles.sortIndicator}>
                      {sortConfig.direction === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </div>
              </th>

              <th className={styles.sortable} style={{ minWidth: 90, maxWidth: 120, textAlign: "center", wordBreak: "break-word" }} onClick={() => requestSort("status_cliente")}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                  <span>
                    Status<br />Cliente
                  </span>
                  {sortConfig.key === "status_cliente" && (
                    <span className={styles.sortIndicator}>
                      {sortConfig.direction === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </div>
              </th>

              <th style={{ minWidth: 90, maxWidth: 130, wordBreak: "break-word" }}>Datas</th>
              {mostrarConclusao && <th
                className={styles.sortable}
                style={{ minWidth: 110, maxWidth: 120, whiteSpace: "nowrap", wordBreak: "break-word", textAlign: "center" }}
                onClick={() => requestSort("conclusao")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                  Conclusão
                  {sortConfig.key === "conclusao" && (
                    <span className={styles.sortIndicator}>
                      {sortConfig.direction === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </div>
              </th>}


              {abaAtiva === "solicitacoes" && <th>Responsável</th>}
              <th>Atividades</th>
            </tr>
          </thead>
          <tbody className={styles.tableBody}>
            {tarefasVisiveis.length === 0 ? (
              <tr>
                <td colSpan={mostrarConclusao ? 11 : 10} className={styles.noResults}>
                  Nenhuma {abaAtiva === "solicitacoes" ? "solicitação" : "obrigação"} encontrada.
                </td>
              </tr>
            ) : (
              tarefasVisiveis.map((t, i) => (
                <tr key={i}>
                  <td className={styles.tableBody}>{i + 1}</td>
                  <td className={styles.tableBody}>
                    {capitalize(t.status)}
                    {t.baixadaAutomaticamente === 1 && (
                      <span
                        className={styles.badgeAuto}
                        title="Baixada Automaticamente"
                      >
                        Auto
                      </span>
                    )}
                  </td>
                  <td className={styles.tableBody}>{t.departamento || t.departamentoNome || t.departamento_nome || '-'}</td>
                  <td className={`${styles.tableBody} ${styles.cellId}`}>{t.id}</td>
                  <td
                    className={`${styles.tableBody} ${styles.cellAssunto}`}
                    onClick={() => {
                      if (t.tipo === "tarefa") {
                        window.open(`/tarefas/${t.id}/atividades`, "_blank");
                      } else if (t.tipo === "obrigacao") {
                        window.open(`/dashboard/obrigacoes/${t.id}/atividades`, "_blank");
                      }
                    }}
                  >
                    {t.assunto || t.nome}
                  </td>

                  <td className={`${styles.tableBody} ${styles.cellCliente}`}>{t.cliente_nome || "-"}
                    {t.cliente_cnpj && (
                      <div className={styles.cellClienteCnpj}>{t.cliente_cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</div>
                    )}
                  </td>
                  <td className={`${styles.tableBody} ${styles.cellStatusCliente}`}>{t.status_cliente || "-"}</td>
                  <td className={`${styles.tableBody} ${styles.cellDatas}`}>
                    <div>
                      <div>
                        <span>A:</span> {getDataAjustada(t.dataAcao)}
                      </div>
                      <div>
                        <span>M:</span> {getDataAjustada(t.dataMeta)}
                      </div>
                      <div>
                        <span>V:</span> {getDataAjustada(t.vencimento || t.dataPrazo)}
                      </div>
                    </div>
                  </td>
                  {mostrarConclusao && (
                    <td className={`${styles.tableBody} ${styles.cellConclusao}`}>
                      {getDataConclusao(t)}
                    </td>
                  )}



                  {abaAtiva === "solicitacoes" && <td className={`${styles.tableBody} ${styles.cellResponsavel}`}>{t.responsavel || "-"}</td>}

                  <td className={`${styles.tableBody} ${styles.cellAtividades}`}>
                    {(t.categoria === "Finalizada" ||
                      t.categoria === "Na Programação" ||
                      t.categoria === "Concluída Após Meta/Prazo" ||
                      t.status?.toLowerCase() === "concluída" ||
                      t.baixadaAutomaticamente === 1) ? (
                      "100%"
                    ) : (
                      Array.isArray(t.atividades) && t.atividades.length > 0
                        ? `${Math.round(
                          (
                            t.atividades.filter((a) => a.concluida === 1 || a.cancelada === 1).length /
                            t.atividades.length
                          ) * 100
                        )}%`
                        : "0%"
                    )
                    }
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {/* Paginação */}
        <div className={styles.paginationContainer}>
          <div className={styles.paginationInfo}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 12px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)"
            }}>
              <span style={{
                fontSize: "14px",
                color: "rgba(255, 255, 255, 0.8)",
                fontWeight: "500"
              }}>
                Itens por página:
              </span>
              <select
                value={itensPorPagina}
                onChange={(e) => setItensPorPagina(Number(e.target.value))}
                style={{
                  padding: "6px 12px",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "6px",
                  fontSize: "14px",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  color: "white",
                  cursor: "pointer",
                  outline: "none",
                  transition: "all 0.2s ease",
                  minWidth: "60px",
                  textAlign: "center"
                }}
                onMouseEnter={(e) => {
                  const target = e.target;
                  target.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
                  target.style.borderColor = "rgba(255, 255, 255, 0.4)";
                }}
                onMouseLeave={(e) => {
                  const target = e.target;
                  target.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                  target.style.borderColor = "rgba(255, 255, 255, 0.2)";
                }}
              >
                <option value={10} style={{ backgroundColor: "#2a2a2a", color: "white" }}>10</option>
                <option value={25} style={{ backgroundColor: "#2a2a2a", color: "white" }}>25</option>
                <option value={50} style={{ backgroundColor: "#2a2a2a", color: "white" }}>50</option>
                <option value={100} style={{ backgroundColor: "#2a2a2a", color: "white" }}>100</option>
              </select>
            </div>
            <div style={{
              padding: "8px 12px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              fontSize: "14px",
              color: "rgba(255, 255, 255, 0.8)",
              fontWeight: "500"
            }}>
              {`${(paginaAtual - 1) * itensPorPagina + 1} - ${Math.min(
                paginaAtual * itensPorPagina,
                tarefasFiltradas.length
              )} de ${tarefasFiltradas.length}`}
            </div>
          </div>
          <div className={styles.paginationButtons}>
            <button
              onClick={() => setPaginaAtual((prev) => Math.max(prev - 1, 1))}
              disabled={paginaAtual === 1}
              className={styles.paginationButton}
            >
              Anterior
            </button>
            <button
              onClick={() => setPaginaAtual((prev) => Math.min(prev + 1, totalPaginas))}
              disabled={paginaAtual === totalPaginas}
              className={styles.paginationButton}
            >
              Próximo
            </button>
          </div>
        </div>

        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className={styles.closeButton}
        >
          &times;
        </button>
      </div>
    </div>
  );
}

