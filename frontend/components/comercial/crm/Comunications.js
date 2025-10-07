import { useState, useEffect, useRef } from 'react';
import styles from '../../../styles/comercial/crm/Comunications.module.css';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';



function downloadFile(src, filename) {
  if (src && src.startsWith('data:')) {
    const a = document.createElement('a');
    a.href = src;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }
  if (src && src.startsWith('blob:')) {
    window.open(src, '_blank');
    return;
  }
  if (src) {
    window.open(src, '_blank');
  }
}



// Supondo que o usuário logado está em localStorage
const getUserInfo = () => {
  try {
    return JSON.parse(localStorage.getItem('user')) || {};
  } catch {
    return {};
  }
};

function formatarDataHora(str) {
  if (!str) return '';
  const data = new Date(str);
  if (isNaN(data)) return '';
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = meses[data.getMonth()];
  const hora = String(data.getHours()).padStart(2, '0');
  const min = String(data.getMinutes()).padStart(2, '0');
  return `${dia} ${mes} ${hora}:${min}`;
}

// Função para pegar as iniciais do nome
function getInitials(name = '') {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const Comunications = ({ leadId }) => {
  const [contatos, setContatos] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState(0);
  const [loading, setLoading] = useState(true);

  const user = getUserInfo();

  useEffect(() => {
    const fetchContatosEMensagens = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/leads/${leadId}/contatos-mensagens`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setContatos(Array.isArray(data) ? data : []);
      } catch (error) {
        setContatos([]);
        console.error('Erro ao buscar contatos/mensagens:', error);
      }
      setLoading(false);
    };

    if (leadId) fetchContatosEMensagens();
  }, [leadId]);

  // Contato e mensagens selecionados
  const contato = contatos[abaAtiva] || {};
  const mensagens = contato.mensagens || [];

  // Ordena as mensagens do mais antigo para o mais novo
  const mensagensOrdenadas = [...mensagens].sort(
    (a, b) => new Date(a.hora) - new Date(b.hora)
  );

  const [imagemExpandida, setImagemExpandida] = useState(null);
  // Scroll infinito invertido
  const chatAreaRef = useRef(null);
  const PAGE_SIZE = 20;
  const [mensagensVisiveis, setMensagensVisiveis] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [todasCarregadas, setTodasCarregadas] = useState(false);

  // Sempre que trocar de contato, resetar paginação
  useEffect(() => {
    setPagina(1);
    setTodasCarregadas(false);
  }, [abaAtiva]);

  // Atualiza mensagens visíveis ao trocar de contato ou página
  useEffect(() => {
    if (!mensagens.length) {
      if (mensagensVisiveis.length > 0) {
        setMensagensVisiveis([]); // só faz set se não está vazio
      }
      setTodasCarregadas(true);
      return;
    }
    const total = mensagens.length;
    const start = Math.max(0, total - pagina * PAGE_SIZE);
    const end = total;
    const nextMensagens = mensagens.slice(start, end);

    // Proteção extra: só atualiza se mudou de fato!
    const isIgual = JSON.stringify(nextMensagens) === JSON.stringify(mensagensVisiveis);
    if (!isIgual) {
      setMensagensVisiveis(nextMensagens);
    }
    setTodasCarregadas(start === 0);

    // Debug: ver quando dispara
    // console.log('Atualizou mensagensVisiveis', {pagina, total, start, end, nextMensagens});
  }, [mensagens, pagina]);


  // Scrolla para o final ao abrir/trocar contato ou quando mensagensVisiveis for atualizada por troca de contato
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [abaAtiva, loading, mensagensVisiveis.length]);

  // Ao carregar mais mensagens, manter posição do scroll
  const handleScroll = () => {
    if (!chatAreaRef.current || carregandoMais || todasCarregadas) return;
    if (chatAreaRef.current.scrollTop === 0) {
      setCarregandoMais(true);
      const prevHeight = chatAreaRef.current.scrollHeight;
      setPagina((p) => p + 1);
      setTimeout(() => {
        // Espera renderizar
        if (chatAreaRef.current) {
          const newHeight = chatAreaRef.current.scrollHeight;
          chatAreaRef.current.scrollTop = newHeight - prevHeight;
        }
        setCarregandoMais(false);
      }, 50);
    }
  };

  function handleExpandirImagem(src) {
    setImagemExpandida(src);
  }
  function handleFecharImagem() {
    setImagemExpandida(null);
  }

  function iniciarConversaWhatsApp(telefone) {
    if (!telefone) return;
    // Remove caracteres não numéricos, só pra garantir
    const numero = telefone.replace(/\D/g, "");
    // Garante o DDI +55 se não tiver (opcional, depende do padrão do seu banco)
    const link = numero.startsWith('55')
      ? `https://web.whatsapp.com/send?phone=${numero}`
      : `https://web.whatsapp.com/send?phone=55${numero}`;
    window.open(link, '_blank');
  }


  return (
    <div className={styles.container}>

      {imagemExpandida && (
        <div className={styles.modalOverlay} onClick={handleFecharImagem}>
          <img
            src={imagemExpandida}
            className={styles.modalImage}
            alt="Imagem expandida"
            onClick={e => e.stopPropagation()} // Impede fechar se clicar na imagem
          />
        </div>
      )}
      {/* ...header e tabs permanecem igual... */}
      <div className={styles.header}>
        <div className={styles.title}>
          <FontAwesomeIcon icon={faWhatsapp} color="#25D366" size="lg" className={styles.icon} />
          <span>Whatsapp</span>
        </div>
      </div>
      <div className={styles.tabBar}>
        {contatos.map((c, idx) => (
          <div
            key={c.id}
            className={`${styles.tab} ${abaAtiva === idx ? styles.tabActive : ''}`}
            onClick={() => setAbaAtiva(idx)}
            style={{ cursor: 'pointer' }}
          >
            <FontAwesomeIcon icon={faWhatsapp} color="#25D366" size="sm" className={styles.tabIcon} />
            <span>{c.nome || c.telefone || `Contato ${idx + 1}`}</span>
          </div>
        ))}
      </div>

      <div className={styles.chatArea} ref={chatAreaRef} onScroll={handleScroll}>
        {loading ? (
          <div className={styles.loading}>Carregando mensagens...</div>
        ) : !mensagensVisiveis.length ? (
          <div className={styles.noMessages}>Nenhuma mensagem encontrada.</div>
        ) : (
          <div className={styles.messagesList}>
            {carregandoMais && (
              <div className={styles.loading}>Carregando mais...</div>
            )}
            {todasCarregadas && (
              <div className={styles.noMessages}>Início da conversa</div>
            )}
            {mensagensVisiveis.map((message, i) => {
              const isSent = message.direcao === 'enviada';
              const nomeRemetente = isSent ? (user.full_name || 'Você') : (contato.nome || 'Contato');
              const initials = getInitials(nomeRemetente);

              return (
                <div
                  key={message.id || i}
                  className={`${styles.messageRow} ${isSent ? styles.sentRow : styles.receivedRow}`}
                >
                  {!isSent && (
                    <div className={styles.avatarLeft}>
                      <span className={styles.avatarBubble}>{initials}</span>
                    </div>
                  )}
                  <div className={styles.messageBubbleWrapper}>
                    <div className={styles.remetenteInfo}>
                      <span className={styles.remetenteNome}>{nomeRemetente}</span>
                      <span className={styles.messageTime}>
                        {formatarDataHora(message.hora)}
                      </span>
                    </div>
                    <div className={styles.messageBubble}>
                      {/* TIPO: IMAGEM */}
                      {message.tipo === 'imagem' && message.conteudo && (
                        <img
                          src={message.conteudo}
                          alt={message.nomeArquivo || 'Imagem'}
                          className={styles.messageImage}
                          onClick={() => handleExpandirImagem(message.conteudo)}
                          style={{ cursor: 'zoom-in' }}
                          title="Clique para expandir"
                        />
                      )}


                      {/* TIPO: ARQUIVO */}
                      {message.tipo === 'arquivo' && (
                        <div
                          className={styles.fileBubble}
                          onClick={() => message.conteudo && downloadFile(message.conteudo, message.nomeArquivo || 'arquivo')}
                          style={{ cursor: message.conteudo ? 'pointer' : 'not-allowed' }}
                          title={message.conteudo ? 'Clique para baixar' : 'Arquivo não disponível'}
                        >
                          {/* Bloco à esquerda: Ícone + tipo */}
                          <div className={styles.fileIconBox}>
                            <span className={styles.fileExtText}>{message.extensao || 'ARQ'}</span>
                          </div>
                          {/* Centro: Nome do arquivo */}
                          <div className={styles.fileNameBox}>
                            <span className={styles.fileName}>{message.nomeArquivo || 'Arquivo'}</span>
                          </div>
                        </div>
                      )}



                      {/* TIPO: TEXTO OU ÁUDIO */}
                      {(message.tipo === 'texto' || message.tipo === 'audio') && (
                        <span>{message.conteudo}</span>
                      )}
                    </div>
                  </div>
                  {isSent && (
                    <div className={styles.avatarRight}>
                      <span className={styles.avatarBubble}>{initials}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        )}
      </div>

      <div className={styles.footer}>
        <button
          className={styles.startConversation}
          onClick={() => iniciarConversaWhatsApp(contato.telefone)}
          disabled={!contato.telefone}
          title={contato.telefone ? "Abrir conversa no WhatsApp" : "Contato sem telefone"}
        >
          Iniciar conversa
        </button>

      </div>
    </div>
  );
};


export default Comunications;
