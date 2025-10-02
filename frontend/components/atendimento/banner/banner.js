import styles from './Banner.module.css';

export default function BillingStatusBanner({ status, supportUrl }) {
  if (!status) return null;

  const s = String(status).toLowerCase();
  if (s.includes('produ')) return null;

  let bgClass = styles.bgBlack;
  let text = 'Informação da assinatura.';
  let showButton = false;

  if (s.includes('implanta')) {
    bgClass = styles.bgBlue;
    text = 'Sua conta está em implantação.';
    showButton = false;
  } else if (s.includes('atras')) {
    bgClass = styles.bgBrown;
    text = 'Sua assinatura venceu e sua conta no AURA 8 pode ser suspensa em 10 dias a partir do vencimento da fatura. Entre em contato com nossa equipe.';
    showButton = true;
  } else if (s.includes('cancel')) {
    bgClass = styles.bgBlack;
    text = 'Esta assinatura está cancelada. Para reativar entre em contato com nossa equipe.';
    showButton = true;
  } else if (s.includes('susp')) {
    bgClass = styles.bgRed;
    text = 'Sua assinatura está suspensa, em 10 dias sua conta será cancelada. Entre em contato com nossa equipe para regularizar sua assinatura.';
    showButton = true;
  }

  return (
    <div className={`${styles.banner} ${bgClass}`}>
      <div className={styles.inner}>
        <div className={styles.text}>
          {text}
          {showButton && (
            <>
              {' '}
              <a
                className={styles.button}
                href={supportUrl || 'https://wa.me/5521971083656?text=Olá, preciso de ajuda com minha assinatura do AURA 8'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!supportUrl) {
                    // Se não há supportUrl definido, usa o WhatsApp padrão
                    e.preventDefault();
                    window.open('https://wa.me/5521971083656?text=Olá, preciso de ajuda com minha assinatura do AURA 8', '_blank');
                  }
                }}
              >
                Falar com o AURA 8
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


