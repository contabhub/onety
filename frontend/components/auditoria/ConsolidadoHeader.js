import styles from "../../styles/auditoria/ConsolidadoHeader.module.css";

// Função para formatar CNPJ
function formatCNPJ(cnpj) {
  return cnpj
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

// Função auxiliar para obter nome da empresa/cliente
const getNome = (empresa) => {
  if (!empresa) return "";
  return empresa.nome || empresa.name || "";
};

export default function ConsolidadoHeader({
  selectedCompany,
  anoSelecionado,
  onAnoChange,
  onExportPDF,
  onExportCSV,
}) {
  return (
    <div className={styles.container}>
      <div className={styles.details}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Consolidado Anual</h1>
          <span className={styles.badge}>{anoSelecionado}</span>
        </div>

        <div className={styles.companyName}>
          {getNome(selectedCompany) || "Empresa não selecionada"}
        </div>

        {selectedCompany?.cnpj && (
          <div className={styles.infoText}>
            {formatCNPJ(selectedCompany.cnpj)}
          </div>
        )}

        {selectedCompany?.uf && (
          <div className={styles.infoText}>UF: {selectedCompany.uf}</div>
        )}

        <div className={styles.subtitle}>
          Análise consolidada das obrigações fiscais do período
        </div>
      </div>

      <div className={styles.actions}>
        <select
          className={styles.yearSelect}
          value={anoSelecionado}
          onChange={(e) => onAnoChange(Number(e.target.value))}
        >
          {Array.from({ length: 5 }).map((_, idx) => {
            const year = new Date().getFullYear() - idx;
            return (
              <option key={year} value={year}>
                {year}
              </option>
            );
          })}
        </select>

        <button
          onClick={onExportPDF}
          className={`${styles.exportButton} ${styles.exportPrimary}`}
          type="button"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={styles.exportIcon}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Exportar PDF
        </button>

        <button
          onClick={onExportCSV}
          className={`${styles.exportButton} ${styles.exportSecondary}`}
          type="button"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={styles.exportIcon}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16h8M8 12h8m-8-4h8M4 6h16M4 18h16"
            />
          </svg>
          Exportar CSV
        </button>
      </div>
    </div>
  );
}
