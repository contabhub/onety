import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Search, X } from 'lucide-react';
import styles from './ForwardModal.module.css';

export default function ForwardModal({
  isOpen,
  onClose,
  selectedMessageIds = [],
  currentConversationId,
  sourceMessages = [],
  onConfirm = () => {}
}) {
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setSelected([]);
  }, [isOpen]);

  // Carrega conversas disponíveis para encaminhar
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const userRole = userData.userRole;
        const companyId = userData.companyId;

        if (!token) return setConversations([]);

        // Admin/Superadmin: busca todas as conversas da empresa
        if ((userRole === 'Administrador' || userRole === 'Superadmin') && companyId) {
          const url = `${process.env.NEXT_PUBLIC_API_URL}/conversations/company/${companyId}/all`;
          const resp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
          const convs = (resp.data?.conversations || []).filter((c) => c.conversation_id !== currentConversationId);
          setConversations(convs);
          return;
        }

        // Usuário comum: busca conversas dos times
        const userId = userData.id;
        if (!userId || !companyId) {
          setConversations([]);
          return;
        }

        const teamsUrl = `${process.env.NEXT_PUBLIC_API_URL}/team-users/user/${userId}?company_id=${companyId}`;
        const teamsResp = await axios.get(teamsUrl, { headers: { Authorization: `Bearer ${token}` } });
        const teams = teamsResp.data || [];

        const allConversations = [];
        for (const team of teams) {
          try {
            const url = `${process.env.NEXT_PUBLIC_API_URL}/conversations/team/${team.team_id}/conversations`;
            const convResp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
            const convs = (convResp.data?.conversations || []).map((c) => ({ ...c, team_name: team.time }));
            allConversations.push(...convs);
          } catch (_) {
            // ignora erros por time
          }
        }
        const unique = [];
        const seen = new Set();
        for (const c of allConversations) {
          const id = c.conversation_id;
          if (id && !seen.has(id) && id !== currentConversationId) {
            seen.add(id);
            unique.push(c);
          }
        }
        setConversations(unique);
      } catch (err) {
        console.error('Erro ao carregar conversas para encaminhar:', err);
        setConversations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, currentConversationId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      return (
        (c.customer_name || '').toLowerCase().includes(q) ||
        (c.customer_phone || '').toLowerCase().includes(q) ||
        (c.team_name || '').toLowerCase().includes(q)
      );
    });
  }, [conversations, search]);

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Envia efetivamente as mensagens selecionadas para as conversas escolhidas
  const handleConfirm = async () => {
    if (selected.length === 0 || selectedMessageIds.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Token ausente');

      const userId = (JSON.parse(localStorage.getItem('userData') || '{}').id);
      const messagesToForward = sourceMessages.filter((m) => selectedMessageIds.includes(m.id));

      // Utilitários para cada tipo (baseado no MessageComposer)
      const sendText = async ({ instanceName, number, text }) => {
        return axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/zapimessages/evolution/send`,
          { instanceName, number, text, sender_id: userId, options: {} },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      };

      const sendMedia = async ({ instanceName, number, mediatype, media, caption, fileName, mimetype }) => {
        return axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/zapimessages/evolution/send-media`,
          {
            instanceName,
            number,
            mediaMessage: { mediatype, media, caption: caption || null, fileName, mimetype },
            options: { delay: 1200, presence: 'composing' },
            sender_id: userId
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      };

      const sendAudio = async ({ instanceName, number, audioDataURI }) => {
        return axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/zapimessages/evolution/send-audio`,
          {
            instanceName,
            number,
            audioMessage: { audio: audioDataURI },
            options: { delay: 1200, presence: 'recording', encoding: true },
            sender_id: userId
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      };

      // Para cada destino, precisamos das infos da conversa: instance_name e customer_phone
      const getDestinationMeta = (id) => conversations.find((c) => c.conversation_id === id);

      // Estratégia: encaminhar sequencialmente por mensagem x destino (pode ser otimizado depois)
      for (const destId of selected) {
        const dest = getDestinationMeta(destId);
        if (!dest?.instance_name || !dest?.customer_phone) continue;

        for (const msg of messagesToForward) {
          try {
            const instanceName = dest.instance_name;
            const number = dest.customer_phone;

            switch (msg.message_type) {
              case 'text': {
                const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                await sendText({ instanceName, number, text });
                break;
              }
              case 'image':
              case 'photo': {
                const caption = (() => {
                  try {
                    const obj = typeof msg.content === 'string' && msg.content.trim().startsWith('{') ? JSON.parse(msg.content) : null;
                    return obj?.caption || (typeof msg.content === 'string' && !msg.content.startsWith('{') ? msg.content : null);
                  } catch { return null; }
                })();
                const media = msg.media_url; // já é URL pública; backend aceita data URI ou URL
                await sendMedia({ instanceName, number, mediatype: 'image', media, caption, fileName: undefined, mimetype: 'image/*' });
                break;
              }
              case 'video': {
                const caption = (() => {
                  try {
                    const obj = typeof msg.content === 'string' && msg.content.trim().startsWith('{') ? JSON.parse(msg.content) : null;
                    return obj?.caption || (typeof msg.content === 'string' && !msg.content.startsWith('{') ? msg.content : null);
                  } catch { return null; }
                })();
                const media = msg.media_url;
                await sendMedia({ instanceName, number, mediatype: 'video', media, caption, fileName: undefined, mimetype: 'video/*' });
                break;
              }
              case 'document':
              case 'file': {
                const caption = (() => {
                  try {
                    const obj = typeof msg.content === 'string' && msg.content.trim().startsWith('{') ? JSON.parse(msg.content) : null;
                    return obj?.caption || (typeof msg.content === 'string' && !msg.content.startsWith('{') ? msg.content : null);
                  } catch { return null; }
                })();
                const media = msg.media_url;
                await sendMedia({ instanceName, number, mediatype: 'document', media, caption, fileName: undefined, mimetype: 'application/octet-stream' });
                break;
              }
              case 'audio': {
                // Para áudio, backend espera data URI completo. Se só houver URL pública, enviaremos a URL mesmo; backend deve aceitar.
                const audioDataURIorUrl = msg.media_url || (typeof msg.content === 'string' ? msg.content : null);
                await sendAudio({ instanceName, number, audioDataURI: audioDataURIorUrl });
                break;
              }
              default: {
                const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                await sendText({ instanceName, number, text });
              }
            }
          } catch (err) {
            console.error('Erro ao encaminhar mensagem', msg?.id, 'para', destId, err);
          }
        }
      }

      onConfirm({ destinations: selected, messageIds: selectedMessageIds });
    } catch (err) {
      console.error('Falha no encaminhamento:', err);
      alert('Erro ao encaminhar mensagens. Verifique sua conexão e tente novamente.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>Encaminhar mensagens para</h3>
          <button className={styles.closeBtn} onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className={styles.searchRow}>
          <div className={styles.searchWrapper}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar atendimento"
              className={styles.searchInput}
            />
            <Search size={16} className={styles.searchIcon} />
          </div>
        </div>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.loading}>Carregando conversas...</div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>Nenhuma conversa encontrada</div>
          ) : (
            filtered.map((c) => {
              const id = c.conversation_id;
              return (
                <label key={id} className={styles.item}>
                  <input
                    type="checkbox"
                    checked={selected.includes(id)}
                    onChange={() => toggle(id)}
                  />
                  <div className={styles.itemBody}>
                    <div className={styles.itemTitle}>{c.customer_name || c.customer_phone || 'Contato'}</div>
                    <div className={styles.itemSub}>
                      {c.team_name ? c.team_name : 'Sem equipe'}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.selectionInfo}>
            {selected.length === 0 ? 'Nenhum atendimento selecionado' : `${selected.length} selecionado(s)`}
          </div>
          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
            <button
              className={styles.confirmBtn}
              onClick={handleConfirm}
              disabled={selected.length === 0}
            >
              Encaminhar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


