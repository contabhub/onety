import { useState } from 'react';
import { useComparacaoAnexos } from '../../utils/auditoria/useComparacaoAnexos';
import { comparacaoService } from '../../services/auditoria/comparacaoService';
import styles from '../../styles/auditoria/ComparacaoAnexos.module.css';

function ComparacaoItem({ item }) {
  const statusClass =
    item.status === 'incorreto'
      ? `${styles.itemCard} ${styles.itemCardError}`
      : item.status === 'aviso'
      ? `${styles.itemCard} ${styles.itemCardWarning}`
      : `${styles.itemCard} ${styles.itemCardSuccess}`;

  const statusLabel = (() => {
    switch (item.status) {
      case 'incorreto':
        return <span className={`${styles.statusLabel} ${styles.statusError}`}>✗ Incorreto</span>;
      case 'aviso':
        return <span className={`${styles.statusLabel} ${styles.statusWarning}`}>⚠ Atenção</span>;
      default:
        return <span className={`${styles.statusLabel} ${styles.statusSuccess}`}>✓ Correto</span>;
    }
  })();

  const differenceClass =
    item.status === 'incorreto' ? styles.differenceError : styles.differenceWarning;

  const recommendationClass =
    item.status === 'incorreto' ? styles.recommendationError : styles.recommendationWarning;

  return (
    <div className={statusClass}>
      <div className={styles.itemHeader}>
        <h4 className={styles.itemTitle}>
          {comparacaoService.obterNomeMes(item.mes)} de {item.ano}
        </h4>
        {statusLabel}
      </div>

      <div className={styles.itemGrid}>
        <div className={styles.itemField}>
          <span className={styles.fieldLabel}>Anexo do Extrato:</span>
          <p className={styles.fieldValue}>{item.anexoExtrato}</p>
        </div>
        <div className={styles.itemField}>
          <span className={styles.fieldLabel}>Anexo baseado no CNAE:</span>
          <p className={styles.fieldValue}>{item.anexoCnae}</p>
        </div>
      </div>

      {(item.status === 'incorreto' || item.status === 'aviso') && (
        <div className={styles.differenceBox}>
          <p className={`${styles.differenceText} ${differenceClass}`}>
            <span className={styles.strong}>Diferença:</span> {item.diferenca}
          </p>
          <p className={`${styles.recommendation} ${recommendationClass}`}>
            <span className={styles.strong}>Recomendação:</span> {item.recomendacao}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ComparacaoAnexos({ selectedCompany, anoSelecionado }) {
  const [mostrarComparacao, setMostrarComparacao] = useState(false);

  const {
    comparacaoAnexos,
    cnaesEmpresa,
    cliente,
    loading,
    error,
    carregarComparacao,
  } = useComparacaoAnexos({ selectedCompany, anoSelecionado });

  const inconsistencias = comparacaoAnexos.filter((item) => item.status === 'incorreto').length;
  const avisos = comparacaoAnexos.filter((item) => item.status === 'aviso').length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Comparação de Anexos - Simples Nacional</h2>
        <div className={styles.badges}>
          {inconsistencias > 0 && (
            <span className={`${styles.badge} ${styles.badgeError}`}>
              {inconsistencias} Inconsistência{inconsistencias > 1 ? 's' : ''}
            </span>
          )}
          {avisos > 0 && (
            <span className={`${styles.badge} ${styles.badgeWarning}`}>
              {avisos} Atenção{avisos > 1 ? 'es' : ''}
            </span>
          )}
          <button
            onClick={() => setMostrarComparacao(!mostrarComparacao)}
            className={styles.toggleButton}
            disabled={loading}
            type="button"
          >
            <svg className={styles.toggleIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            {mostrarComparacao ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>

      {loading && (
        <div className={styles.loadingState}>
          <span className={styles.loadingSpinner} />
          <p>Carregando comparação...</p>
        </div>
      )}

      {error && (
        <div className={styles.errorBox}>
          <p>{error}</p>
          <button onClick={carregarComparacao} className={styles.errorRetry} type="button">
            Tentar novamente
          </button>
        </div>
      )}

      {mostrarComparacao && !loading && !error && (
        <div className={styles.comparisonList}>
          {cliente && (
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Informações do Cliente:</h3>
              <div className={styles.sectionBody}>
                <p>
                  <strong>Nome:</strong> {cliente.nome}
                </p>
                <p>
                  <strong>CNPJ:</strong> {comparacaoService.formatarCNPJ(cliente.cnpj)}
                </p>
                <p>
                  <strong>UF:</strong> {cliente.uf}
                </p>
              </div>
            </div>
          )}

          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>CNAEs da Empresa:</h3>
            {cnaesEmpresa && cnaesEmpresa.length > 0 ? (
              <div className={styles.sectionBody}>
                {cnaesEmpresa.map((cnae, index) => (
                  <div key={index} className={styles.cnaeItem}>
                    <div className={styles.cnaeContent}>
                      <div className={styles.strong}>
                        {cnae.cnae} - {cnae.descricao}
                      </div>
                      {cnae.anexo && (
                        <div className={styles.cnaeMeta}>
                          Anexo: {cnae.anexo} | Fator R: {cnae.fator_r}
                        </div>
                      )}
                    </div>
                    {index === 0 && <span className={styles.cnaeBadge}>Principal</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.sectionBody}>Nenhum CNAE cadastrado</div>
            )}
          </div>

          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>
              Comparação por Mês ({anoSelecionado}):
            </h3>
            {comparacaoAnexos.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Nenhum dado de comparação encontrado.</p>
                <p className={styles.emptyStateText}>
                  Verifique se há análises do Simples Nacional para o ano {anoSelecionado}.
                </p>
                <p className={styles.emptyStateText}>
                  CNPJ: {selectedCompany?.cnpj ? comparacaoService.formatarCNPJ(selectedCompany.cnpj) : 'Não informado'}
                </p>
              </div>
            ) : (
              <div className={styles.comparisonList}>
                {comparacaoAnexos.map((item, index) => (
                  <ComparacaoItem key={index} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
