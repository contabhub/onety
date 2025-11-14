import { useMemo } from "react";
import styles from "../../styles/auditoria/TabelaFolhas.module.css";

export default function TabelaFolhas({
  temFolhas,
  folhasMensais,
  mostrarFolhas,
  onToggleFolhas,
  folhasAnteriores = [],
  mostrarFolhasAnteriores = false,
  onToggleFolhasAnteriores,
  folhasAnterioresPorMes = [],
}) {
  const parseValor = (valor) => {
    if (typeof valor === "number") return valor;
    if (!valor) return 0;
    const str = String(valor).replace(/\./g, "").replace(",", ".");
    const n = parseFloat(str);
    return Number.isNaN(n) ? 0 : n;
  };

  const competenciasValoresMapa = useMemo(() => {
    const mapa = new Map();
    (folhasAnterioresPorMes || []).forEach((m) => {
      (m.itens || []).forEach((it) => {
        const comp = String(it.competencia || "").trim();
        if (!comp) return;
        const val = parseValor(it.valor);
        if (!mapa.has(comp)) mapa.set(comp, new Set());
        mapa.get(comp).add(val);
      });
    });
    return mapa;
  }, [folhasAnterioresPorMes]);

  const competenciasDivergentes = useMemo(() => {
    const set = new Set();
    competenciasValoresMapa.forEach((vals, comp) => {
      if (vals.size > 1) set.add(comp);
    });
    return set;
  }, [competenciasValoresMapa]);

  const mesesPt = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.headerIconWrapper}>
            <svg
              className={styles.headerIcon}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div>
            <h2 className={styles.title}>Folhas de Salários por Mês</h2>
            <p className={styles.subtitle}>
              Valores das folhas de salários extraídos dos extratos do Simples Nacional
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            onClick={onToggleFolhas}
            className={styles.toggleButton}
            type="button"
          >
            <svg className={styles.toggleIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            {mostrarFolhas ? "Ocultar" : "Mostrar"}
          </button>

          <div className={styles.switchContainer}>
            <button
              onClick={onToggleFolhasAnteriores}
              aria-pressed={!!mostrarFolhasAnteriores}
              aria-label="Alternar exibição de Folhas de Salários Anteriores"
              className={`${styles.switch} ${
                mostrarFolhasAnteriores ? styles.switchActive : ""
              }`}
              type="button"
            >
              <span
                className={`${styles.switchKnob} ${
                  mostrarFolhasAnteriores ? styles.switchKnobActive : ""
                }`}
              />
            </button>
            <span className={styles.switchLabel}>
              {mostrarFolhasAnteriores
                ? "Ocultar Folhas Anteriores"
                : "Mostrar Folhas Anteriores"}
            </span>
          </div>
        </div>
      </div>

      {mostrarFolhas && (
        <div>
          {!temFolhas || folhasMensais.length === 0 ? (
            <div className={styles.emptyState}>
              <svg className={styles.emptyIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p className={styles.emptyTitle}>Nenhuma folha de salário encontrada para o período</p>
              <p className={styles.emptySubtitle}>
                Os dados de folhas aparecerão aqui quando disponíveis
              </p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead className={styles.tableHead}>
                  <tr>
                    <th>Mês</th>
                    <th>Valor folha de salários (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {folhasMensais.map((item, idx) => (
                    <tr key={idx} className={styles.tableRow}>
                      <td>{item.mes}</td>
                      <td>
                        R$
                        {" "}
                        {item.valor.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {mostrarFolhasAnteriores && (
        <div className={styles.previousSection}>
          <h3 className={styles.previousTitle}>Folhas de Salários Anteriores</h3>
          {(!folhasAnteriores || folhasAnteriores.length === 0) && (
            <div className={styles.previousEmpty}>
              Nenhum dado de folhas anteriores encontrado para o ano selecionado.
            </div>
          )}

          <div className={styles.previousGrid}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((mesNum) => {
              const itens =
                folhasAnterioresPorMes?.find((x) => x.mes === mesNum)?.itens || [];
              return (
                <div key={mesNum} className={styles.previousCard}>
                  <div className={styles.previousMonthTitle}>{mesesPt[mesNum - 1]}</div>
                  <div className={styles.previousList}>
                    {itens.length > 0 ? (
                      itens.map((it, idx) => {
                        const comp = String(it.competencia || "").trim();
                        const isDivergente = comp && competenciasDivergentes.has(comp);
                        const valorFormatado = Number(parseValor(it.valor)).toLocaleString(
                          "pt-BR",
                          { minimumFractionDigits: 2 }
                        );
                        return (
                          <div
                            key={idx}
                            className={`${styles.previousItem} ${
                              isDivergente ? styles.previousItemDivergent : ""
                            }`}
                          >
                            <span>{it.competencia}</span>
                            <span className={styles.previousItemValue}>R$ {valorFormatado}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className={styles.previousEmpty}>
                        {folhasAnteriores && folhasAnteriores.length > 0
                          ? "Não analisado"
                          : "Sem dados"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {competenciasDivergentes.size > 0 && (
            <div className={styles.divergenceSummary}>
              <div className={styles.divergenceTitle}>Resumo de Divergências</div>
              <div className={styles.divergenceBox}>
                <div className={styles.divergenceCount}>
                  Competências divergentes: {competenciasDivergentes.size}
                </div>
                <ul className={styles.divergenceList}>
                  {Array.from(competenciasDivergentes)
                    .sort((a, b) => {
                      const [ma, ya] = a.split("/").map(Number);
                      const [mb, yb] = b.split("/").map(Number);
                      if (ya !== yb) return ya - yb;
                      return ma - mb;
                    })
                    .map((comp) => {
                      const valores = Array.from(competenciasValoresMapa.get(comp) || [])
                        .sort((x, y) => x - y)
                        .map((v) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`)
                        .join("; ");
                      return (
                        <li key={comp}>
                          {comp}: {valores}
                        </li>
                      );
                    })}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
