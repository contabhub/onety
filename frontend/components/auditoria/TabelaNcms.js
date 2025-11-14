import { useState } from "react";
import styles from "../../styles/auditoria/TabelaNcms.module.css";

const Tooltip = ({ children, content, position = "top" }) => {
  const [open, setOpen] = useState(false);

  const getPositionClass = () => {
    switch (position) {
      case "left":
        return styles.tooltipLeft;
      case "right":
        return styles.tooltipRight;
      case "bottom":
        return styles.tooltipBottom;
      default:
        return styles.tooltipTop;
    }
  };

  return (
    <span
      className={styles.tooltipWrapper}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span className={`${styles.tooltipBox} ${getPositionClass()}`}>
          {content}
        </span>
      )}
    </span>
  );
};

export default function TabelaNcms({
  anoSelecionado,
  mesSelecionado,
  onMesChange,
  mostrarTabelaNcms,
  onToggleTabelaNcms,
  ncmResumoMes,
  carregandoST,
  informacoesST,
}) {
  const meses = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Período:</label>
            <span className={styles.filterValue}>{anoSelecionado}</span>
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Mês:</label>
            <select
              className={styles.monthSelect}
              value={mesSelecionado}
              onChange={(e) => onMesChange(Number(e.target.value))}
            >
              {meses.map((mes, idx) => (
                <option key={mes} value={idx}>
                  {mes}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={onToggleTabelaNcms}
          className={styles.toggleButton}
          type="button"
        >
          <svg
            className={styles.toggleIcon}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 15l7-7 7 7"
            />
          </svg>
          {mostrarTabelaNcms ? "Ocultar" : "Mostrar"}
        </button>
      </div>

      {mostrarTabelaNcms && (
        <div className={styles.tableWrapper}>
          {carregandoST && (
            <div className={styles.loadingBadge}>
              <span className={styles.spinner} />
              <span>
                Carregando informações de ST Interestadual...
              </span>
            </div>
          )}

          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th>NCM</th>
                <th>Descrição</th>
                <th>Quantidade vendida</th>
                <th>Valor total (R$)</th>
                <th>ICMS (R$)</th>
                <th>ICMS (%)</th>
                <th>PIS (R$)</th>
                <th>PIS (%)</th>
                <th>COFINS (R$)</th>
                <th>COFINS (%)</th>
                <th>ST Interestadual</th>
              </tr>
            </thead>

            <tbody className={styles.tableBody}>
              {ncmResumoMes.length === 0 ? (
                <tr>
                  <td colSpan={11} className={styles.emptyRow}>
                    Nenhum NCM encontrado para o mês selecionado.
                  </td>
                </tr>
              ) : (
                ncmResumoMes.map((item) => {
                  const infoST = informacoesST[item.ncm];

                  return (
                    <tr key={item.ncm} className={styles.tableRow}>
                      <td>{item.ncm}</td>

                      <td>
                        {infoST ? (
                          <Tooltip
                            content={
                              <div className={styles.tooltipCard}>
                                <div className={styles.tooltipDescription}>{infoST.descricao}</div>
                                {infoST.cest && (
                                  <div className={styles.tooltipMeta}>
                                    <span className="font-semibold">CEST:</span> {infoST.cest}
                                  </div>
                                )}
                              </div>
                            }
                            position="top"
                          >
                            <div className={styles.tooltipCard}>
                              <div className={styles.tooltipDescription}>{infoST.descricao}</div>
                              {infoST.cest && (
                                <div className={styles.tooltipMeta}>
                                  <span className="font-semibold">CEST:</span> {infoST.cest}
                                </div>
                              )}
                              <div className={styles.tooltipInfo}>i</div>
                            </div>
                          </Tooltip>
                        ) : (
                          <span className={styles.filterValue}>-</span>
                        )}
                      </td>

                      <td>
                        {item.totalQuantidade.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>

                      <td>
                        {item.totalValor.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>

                      <td>
                        {item.totalIcms.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>

                      <td>{item.icmsPercentage}%</td>

                      <td>
                        {item.totalPis.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>

                      <td>{item.pisPercentage}%</td>

                      <td>
                        {item.totalCofins.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>

                      <td>{item.cofinsPercentage}%</td>

                      <td>
                        {infoST ? (
                          <Tooltip
                            content={
                              <div className={styles.tooltipCard}>
                                {infoST.descricao && (
                                  <div className={styles.tooltipDescription}>{infoST.descricao}</div>
                                )}
                                {infoST.cest && (
                                  <div className={styles.tooltipMeta}>
                                    <span className="font-semibold">CEST:</span> {infoST.cest}
                                  </div>
                                )}
                                {infoST.sigla_estado_origem && infoST.sigla_estado_destino && (
                                  <div className={styles.tooltipMeta}>
                                    <span className="font-semibold">Estados:</span> {" "}
                                    {infoST.sigla_estado_origem} → {infoST.sigla_estado_destino}
                                  </div>
                                )}
                                {(infoST.aliquota_interna || infoST.aliquota_interestadual) && (
                                  <div className={styles.tooltipMeta}>
                                    <span className="font-semibold">Alíquotas:</span> {" "}
                                    {infoST.aliquota_interna && `Interna: ${infoST.aliquota_interna}%`}
                                    {infoST.aliquota_interna && infoST.aliquota_interestadual && " | "}
                                    {infoST.aliquota_interestadual && `Interestadual: ${infoST.aliquota_interestadual}%`}
                                  </div>
                                )}
                                {infoST.mva && (
                                  <div className={styles.tooltipMeta}>
                                    <span className="font-semibold">MVA:</span> {infoST.mva}%
                                  </div>
                                )}
                                {infoST.segmento && (
                                  <div className={styles.tooltipMeta}>
                                    <span className="font-semibold">Segmento:</span> {infoST.segmento}
                                  </div>
                                )}
                                {infoST.vigencia_inicial && (
                                  <div className={styles.tooltipMeta}>
                                    <span className="font-semibold">Vigência:</span> {infoST.vigencia_inicial}
                                  </div>
                                )}
                              </div>
                            }
                            position="left"
                          >
                            <div className={styles.tooltipCard}>
                              {infoST.aliquota_interna && (
                                <div className={styles.tooltipMeta}>
                                  <span className="font-semibold">Alíquota Interna:</span> {infoST.aliquota_interna}%
                                </div>
                              )}
                              {infoST.mva && (
                                <div className={styles.tooltipMeta}>
                                  <span className="font-semibold">MVA:</span> {infoST.mva}%
                                </div>
                              )}
                              {infoST.segmento && (
                                <div className={styles.tooltipDescription}>{infoST.segmento}</div>
                              )}
                              {infoST.sigla_estado_origem && infoST.sigla_estado_destino && (
                                <div className={styles.tooltipInfo}>
                                  {infoST.sigla_estado_origem} → {infoST.sigla_estado_destino}
                                </div>
                              )}
                            </div>
                          </Tooltip>
                        ) : (
                          <span className={styles.filterValue}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
