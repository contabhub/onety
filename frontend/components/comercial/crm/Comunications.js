import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { createPortal } from 'react-dom';
import { useAuth } from '../../../utils/auth';
import TeamSelectionModal from '../../atendimento/Chat/TeamSelectionModal';
import InstanceSelectionModal from '../../atendimento/Chat/InstanceSelectionModal';
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
  const router = useRouter();
  const { user: authUser } = useAuth();

  const legacyUser = getUserInfo();

  useEffect(() => {
    // Desativado: endpoint legacy /leads/:id/contatos-mensagens não disponível em alguns ambientes
    // A UI agora usa a lista de "Conversas do lead" abaixo
    setContatos([]);
    setLoading(false);
  }, [leadId]);

  // Contato e mensagens selecionados
  const contato = contatos[abaAtiva] || {};
  const mensagens = contato.mensagens || [];

  // Ordena as mensagens do mais antigo para o mais novo
  const mensagensOrdenadas = [...mensagens].sort(
    (a, b) => new Date(a.hora) - new Date(b.hora)
  );

  const [imagemExpandida, setImagemExpandida] = useState(null);
  // Conversas existentes do lead
  const [leadConversations, setLeadConversations] = useState([]);
  const [selectedLeadConversation, setSelectedLeadConversation] = useState(null);
  const [leadConvMessages, setLeadConvMessages] = useState([]);
  const [loadingLeadConversations, setLoadingLeadConversations] = useState(false);
  const [loadingLeadMessages, setLoadingLeadMessages] = useState(false);
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

  // Buscar conversas do lead
  useEffect(() => {
    const fetchLeadConversations = async () => {
      try {
        setLoadingLeadConversations(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const token = localStorage.getItem('token');
        const url = `${apiUrl}/atendimento/conversas/contact/${leadId}`;
        console.log('[CRM] Buscando conversas do lead:', url);
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = res.ok ? await res.json() : [];
        console.log('[CRM] Conversas do lead → status', res.status, 'payload:', data);
        setLeadConversations(Array.isArray(data) ? data : []);
      } catch (e) {
        setLeadConversations([]);
        console.error('[CRM] Erro ao buscar conversas do lead:', e);
      } finally {
        setLoadingLeadConversations(false);
      }
    };
    if (leadId) fetchLeadConversations();
  }, [leadId]);

  // Normalizador igual ao ChatWindow
  const normalizeMessage = (m) => {
    const mapSender = (tipo) => {
      if (tipo === 'cliente') return 'customer';
      if (tipo === 'usuario') return 'user';
      if (tipo === 'agente') return 'agent';
      return tipo || 'system';
    };
    const mapType = (t) => {
      if (!t) return 'text';
      const val = String(t).toLowerCase();
      if (['text','image','audio','file','video','photo','document'].includes(val)) return val === 'photo' ? 'image' : (val === 'document' ? 'file' : val);
      return 'text';
    };
    return {
      id: m.id,
      conversation_id: m.conversas_id,
      sender_type: mapSender(m.enviador_tipo),
      sender_id: m.enviador_id,
      message_type: mapType(m.tipo_mensagem),
      content: m.conteudo,
      media_url: m.midia_url,
      created_at: m.criado_em,
      read: m.lido,
      assigned_user_id: m.assigned_user_id,
      assigned_user_name: m.assigned_user_name,
      conversation_status: m.conversation_status,
      sender_user_name: m.sender_user_name
    };
  };

  const openLeadConversation = async (conv) => {
    try {
      setSelectedLeadConversation(conv);
      setLoadingLeadMessages(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/atendimento/conversas/${conv.conversation_id || conv.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const raw = res.ok ? await res.json() : [];
      const normalized = Array.isArray(raw) ? raw.map(normalizeMessage) : [];
      setLeadConvMessages(normalized);
      // rolar para final
      setTimeout(() => {
        if (chatAreaRef.current) chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
      }, 50);
    } catch (e) {
      setLeadConvMessages([]);
    } finally {
      setLoadingLeadMessages(false);
    }
  };

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


  // ===== Fluxo interno para iniciar conversa pelo Onety (igual NewChatModal) =====
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowError, setFlowError] = useState('');
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showInstanceModal, setShowInstanceModal] = useState(false);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [instances, setInstances] = useState([]);
  const [presetPhone, setPresetPhone] = useState('');
  const [presetName, setPresetName] = useState('');
  const [leadFallback, setLeadFallback] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Fallback: buscar dados básicos do lead para recuperar telefone
  useEffect(() => {
    const fetchLeadBasics = async () => {
      if (!leadId) return;
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/comercial/leads/${leadId}` , {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        setLeadFallback(data || null);
      } catch {}
    };
    fetchLeadBasics();
  }, [leadId]);

  const normalizePhone = (phone) => {
    if (!phone) return '';
    let normalized = String(phone).replace(/\D/g, '');
    if (normalized.startsWith('0')) normalized = normalized.slice(1);
    if (!normalized.startsWith('55')) normalized = `55${normalized}`;
    return normalized;
  };

  const handleStartOnetyConversation = async (contato) => {
    console.log('[CRM] Iniciar conversa clicado', { contato });
    try {
      setFlowError('');
      let phone = normalizePhone(
        contato?.telefone || contato?.phone || leadFallback?.telefone || leadFallback?.celular || leadFallback?.whatsapp || leadFallback?.phone
      );
      if (!phone) {
        const typed = window.prompt('Informe o telefone do cliente (com DDD). Ex: 11999998888');
        const normalized = normalizePhone(typed || '');
        if (!normalized) {
          alert('Telefone inválido.');
          return;
        }
        phone = normalized;
      }
      setPresetPhone(phone);
      setPresetName(contato?.nome || contato?.name || leadFallback?.nome || leadFallback?.name || '');
      // Abre modal imediatamente com estado de loading
      setShowTeamModal(true);
      setShowInstanceModal(false);
      console.log('[CRM] Abrindo modal de times...');
      setFlowLoading(true);
      // 1) Buscar times do usuário na empresa atual
      const token = localStorage.getItem('token');
      const userId = (JSON.parse(localStorage.getItem('userData') || '{}').id);
      const companyId = (JSON.parse(localStorage.getItem('userData') || '{}').EmpresaId);
      if (!userId || !companyId) throw new Error('Usuário ou empresa não identificados');

      const teamsRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/atendimento/times-atendimento-usuarios/usuario/${userId}?empresa_id=${companyId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const mappedTeams = (teamsRes.data || []).map(t => ({ id: t.times_atendimento_id, nome: t.time, role: t.role }));
      console.log('[CRM] Times carregados', mappedTeams);
      setTeams(mappedTeams);
      if (mappedTeams.length === 0) {
        alert('Você não está vinculado a nenhum time.');
        return;
      }
      // mantém modal aberto
    } catch (err) {
      console.error('Erro ao iniciar fluxo de conversa:', err);
      setFlowError('Erro ao iniciar fluxo de conversa');
    } finally {
      setFlowLoading(false);
    }
  };

  const handleSelectTeam = async (team) => {
    console.log('[CRM] Time selecionado', team);
    try {
      setSelectedTeam(team);
      setFlowLoading(true);
      const token = localStorage.getItem('token');
      const url = `${process.env.NEXT_PUBLIC_API_URL}/atendimento/times-atendimento-instancias/time/${team.id}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      const mapped = (res.data || []).map(inst => ({
        id: inst.id,
        instance_name: inst.instancia_nome,
        phone_number: inst.telefone,
        instance_id: inst.instancia_codigo,
        instancia_whatsapp_id: inst.instancia_id,
        token: inst.token,
        client_token: inst.cliente_token,
        status: inst.status
      }));
      console.log('[CRM] Instâncias carregadas', mapped);
      setInstances(mapped);
      setShowTeamModal(false);
      console.log('[CRM] Abrindo modal de instâncias...');
      if (mapped.length === 0) {
        alert('Este time não possui instâncias configuradas.');
        return;
      }
      setShowInstanceModal(true);
    } catch (err) {
      console.error('Erro ao carregar instâncias do time:', err);
      setFlowError('Erro ao carregar instâncias');
    } finally {
      setFlowLoading(false);
    }
  };

  const createConversationAndSend = async (instance) => {
    console.log('[CRM] Instância selecionada', instance);
    try {
      setFlowLoading(true);
      const token = localStorage.getItem('token');
      const userId = (JSON.parse(localStorage.getItem('userData') || '{}').id);

      // 3) Criar conversa vinculada ao lead
      const payload = {
        team_whatsapp_instance_id: instance.id,
        customer_name: presetName || null,
        customer_phone: presetPhone,
        assigned_user_id: userId,
        contact_id: leadId // força uso do id do CRM
      };
      console.log('[CRM] Criando conversa', payload);
      const convRes = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/atendimento/conversas`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const conversationId = convRes.data?.id;
      console.log('[CRM] Conversa criada', conversationId);
      const newConv = {
        conversation_id: conversationId,
        id: conversationId,
        customer_name: presetName || null,
        customer_phone: presetPhone,
        avatar_url: convRes.data?.avatar_url || null
      };
      // adiciona à lista local e seleciona
      setLeadConversations(prev => {
        const exists = prev.some(c => (c.conversation_id || c.id) === conversationId);
        const next = exists ? prev : [newConv, ...prev];
        return next;
      });

      // 4) Perguntar mensagem inicial e enviar
      const initialText = window.prompt('Mensagem inicial para o cliente (opcional):', 'Olá! Podemos conversar?');
      if (initialText && initialText.trim()) {
        console.log('[CRM] Enviando primeira mensagem...');
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/atendimento/zapimessages/evolution/send`,
          {
            instanceName: instance.instance_name,
            number: presetPhone,
            text: initialText.trim(),
            sender_id: userId,
            options: {}
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      // Fechar modais e abrir conversa recém-criada neste card
      setShowInstanceModal(false);
      setSelectedTeam(null);
      setInstances([]);
      // Selecionar e carregar mensagens da nova conversa
      setSelectedLeadConversation(newConv);
      await openLeadConversation(newConv);
    } catch (err) {
      console.error('Erro ao criar conversa/enviar mensagem:', err);
      alert('Falha ao iniciar conversa.');
    } finally {
      setFlowLoading(false);
    }
  };


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

      {/* Lista de conversas do lead (clique para carregar mensagens) */}
      {loadingLeadConversations ? (
        <div className={styles.loading}>Carregando conversas do lead...</div>
      ) : (leadConversations?.length > 0) && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, opacity: .8, marginBottom: 6 }}>Conversas do lead</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {leadConversations.map((c) => (
              <button
                key={c.conversation_id || c.id}
                onClick={() => openLeadConversation(c)}
                className={styles.startConversation}
                style={{ background: 'transparent', color: 'var(--onity-color-text)', border: '1px solid var(--onity-color-border)' }}
                title={`Abrir conversa ${c.conversation_id || c.id}`}
              >
                #{c.conversation_id || c.id}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.chatArea} ref={chatAreaRef} onScroll={handleScroll}>
        {loading ? (
          <div className={styles.loading}>Carregando mensagens...</div>
        ) : selectedLeadConversation ? (
          loadingLeadMessages ? (
            <div className={styles.loading}>Carregando conversa...</div>
          ) : (
            <div className={styles.messagesList}>
              {leadConvMessages.map((message, i) => {
                const isSent = message.sender_type === 'user';
                const nomeRemetente = isSent ? ((authUser?.full_name || legacyUser?.full_name || legacyUser?.nome || 'Você')) : (contato.nome || 'Contato');
                const userAvatar = authUser?.avatar_url || legacyUser?.avatar_url || null;
                const customerAvatar = selectedLeadConversation?.avatar_url || null;
                const initials = getInitials(nomeRemetente);
                return (
                  <div
                    key={message.id || i}
                    className={`${styles.messageRow} ${isSent ? styles.sentRow : styles.receivedRow}`}
                  >
                    {!isSent && (
                      <div className={styles.avatarLeft}>
                        {customerAvatar ? (
                          <img src={customerAvatar} alt="Contato" className={styles.avatarImg} />
                        ) : (
                          <span className={styles.avatarBubble}>{initials}</span>
                        )}
                      </div>
                    )}
                    <div className={styles.messageBubbleWrapper}>
                      <div className={styles.remetenteInfo}>
                        <span className={styles.remetenteNome}>{nomeRemetente}</span>
                        <span className={styles.messageTime}>
                          {formatarDataHora(new Date(new Date(message.created_at).getTime() - 3 * 60 * 60 * 1000))}
                        </span>
                      </div>
                      <div className={styles.messageBubble}>
                        {message.message_type === 'image' && message.media_url ? (
                          <img src={message.media_url} alt="Imagem" className={styles.messageImage} />
                        ) : (
                          <span>{message.content}</span>
                        )}
                      </div>
                    </div>
                    {isSent && (
                      <div className={styles.avatarRight}>
                        {userAvatar ? (
                          <img src={userAvatar} alt="Você" className={styles.avatarImg} />
                        ) : (
                          <span className={styles.avatarBubble}>{initials}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
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

      <div className={styles.footer} onClick={(e) => { console.log('[CRM] footer click', e.target); }} role="region" aria-label="Comms Footer">
        <div className={styles.actionCard}>
          <div className={styles.actionCardTitle}>Nova Conversa</div>
          <div className={styles.actionCardDescription}>
            Inicie uma conversa com o lead
          </div>
          <button
            className={styles.startConversation}
            onMouseDown={() => console.log('[CRM] mousedown Iniciar conversa')}
            onClick={() => {
              console.log('[CRM] click Iniciar conversa');
              handleStartOnetyConversation(contato);
            }}
            disabled={flowLoading}
            title={contato.telefone ? "Iniciar conversa pelo Onety" : "Contato sem telefone"}
          >
            {flowLoading ? 'Carregando...' : 'Iniciar Conversa'}
          </button>
        </div>
      </div>

      {/* Modais de seleção iguais ao NewChatModal */}
      {mounted && (showTeamModal || showInstanceModal) && createPortal(
        (
          <div className={styles.flowOverlay}>
            <div className={styles.flowModal}>
              {showTeamModal && (
                <TeamSelectionModal
                  teams={teams}
                  onSelect={handleSelectTeam}
                  onBack={() => setShowTeamModal(false)}
                  loading={flowLoading}
                />
              )}
              {flowError && (
                <div style={{ color: 'var(--onity-color-error)', marginTop: 8 }}>{flowError}</div>
              )}
              {showInstanceModal && (
                <InstanceSelectionModal
                  instances={instances}
                  selectedTeam={selectedTeam}
                  onSelect={createConversationAndSend}
                  onBack={() => { setShowInstanceModal(false); setShowTeamModal(true); }}
                  loading={flowLoading}
                />
              )}
            </div>
          </div>
        ), document.body)}
    </div>
  );
};


export default Comunications;
