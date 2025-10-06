import { useState, useEffect } from 'react';
import { Eye, ArrowRight, CheckCircle2, Phone, User as UserIcon, BadgeCheck, MessageSquare, Edit3 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../../utils/auth';
import { useWebSocket } from '../../../hooks/useWebSocket';
import MessageList from './MessageList';
import MessageComposer from './MessageComposer';
import ForwardModal from './ForwardModal';
import ContatoDetailsModal from '../ajustes/ContatoDetailsModal';
import TransferModal from './TransferModal';
import ContatoModal from '../ajustes/ContatoModal';
import styles from './ChatWindow.module.css';

// Escolhe preto ou branco conforme o contraste com a cor de fundo
const getReadableTextColor = (hexColor) => {
  try {
    if (!hexColor) return '#fff';
    const hex = hexColor.replace('#', '');
    const bigint = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    // luminância relativa
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#111' : '#fff';
  } catch (_) {
    return '#fff';
  }
};

export default function ChatWindow({ conversation, onConversationUpdate, onTabChange, isAdmin = false }) {
  const { user } = useAuth();
  const { socket } = useWebSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [contactLabels, setContactLabels] = useState([]);
  const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);
  const [contactData, setContactData] = useState(null);
  
  // Estados para seleção de mensagens
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);

  // Funções para gerenciar seleção de mensagens
  const handleSelectionModeChange = (enabled) => {
    setSelectionMode(enabled);
    if (!enabled) {
      setSelectedMessages([]);
    }
  };

  const handleToggleMessageSelection = (messageId) => {
    setSelectedMessages(prev => {
      if (prev.includes(messageId)) {
        return prev.filter(id => id !== messageId);
      } else {
        return [...prev, messageId];
      }
    });
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedMessages([]);
  };

  const handleForwardMessages = (messageIds) => {
    console.log('Encaminhar mensagens:', messageIds);
    setIsForwardModalOpen(true);
  };

  const handleDeleteMessages = (messageIds) => {
    console.log('Excluir mensagens:', messageIds);
    // TODO: Implementar lógica de exclusão
    alert(`Excluir ${messageIds.length} mensagem(ns) - Funcionalidade em desenvolvimento`);
  };

  // Buscar etiquetas do contato
  const fetchContactLabels = async (contactId) => {
    if (!contactId) {
      setContactLabels([]);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const response = await axios.get(
        `${apiUrl}/atendimento/leads-etiquetas/lead/${contactId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const labels = response.data || [];
      console.log('🏷️ Etiquetas do contato carregadas:', labels);
      setContactLabels(labels);
    } catch (error) {
      console.error('❌ Erro ao buscar etiquetas do contato:', error);
      setContactLabels([]);
    }
  };

  // Buscar dados do contato
  const fetchContactData = async (contactId) => {
    if (!contactId) {
      setContactData(null);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const response = await axios.get(
        `${apiUrl}/atendimento/leads/${contactId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const contact = response.data;
      console.log('👤 Dados do contato carregados:', contact);
      setContactData(contact);
      return contact;
    } catch (error) {
      console.error('❌ Erro ao buscar dados do contato:', error);
      setContactData(null);
      return null;
    }
  };

  // Função para abrir modal de edição do contato
  const handleEditContact = async () => {
    if (!conversation?.contact_id) {
      alert('Contato não encontrado para edição');
      return;
    }

    try {
      const contact = await fetchContactData(conversation.contact_id);
      if (contact) {
        setIsEditContactModalOpen(true);
      } else {
        alert('Erro ao carregar dados do contato');
      }
    } catch (error) {
      console.error('Erro ao abrir modal de edição:', error);
      alert('Erro ao carregar dados do contato');
    }
  };

  // Função para lidar com sucesso na edição do contato
  const handleContactEditSuccess = (updatedContact) => {
    console.log('✅ Contato atualizado:', updatedContact);
    // Recarregar etiquetas após edição
    if (conversation?.contact_id) {
      fetchContactLabels(conversation.contact_id);
    }
    setIsEditContactModalOpen(false);
  };

  // Quando a conversa for atualizada (ex.: transferência), atualizar aba automaticamente
  const handleConversationUpdated = (updatedConversation) => {
    try {
      onConversationUpdate && onConversationUpdate(updatedConversation);
      if (!onTabChange) return;

      const currentUserId = (user?.id || (JSON.parse(localStorage.getItem('userData') || '{}').id))?.toString();
      const assignedId = updatedConversation?.assigned_user_id != null
        ? updatedConversation.assigned_user_id.toString()
        : null;

      if (!assignedId) {
        onTabChange('novos');
      } else if (assignedId === currentUserId) {
        onTabChange('meus');
      } else {
        onTabChange('outros');
      }
    } catch (e) {
      console.warn('Falha ao ajustar aba após atualização da conversa:', e?.message || e);
    }
  };


  // Marcar mensagens como lidas (somente se estiver atribuída ao usuário atual)
  const markMessagesAsRead = async () => {
    if (!conversation?.conversation_id) return;
    const currentUserId = user?.id || (JSON.parse(localStorage.getItem('userData') || '{}').id);
    const assignedUserId = conversation?.assigned_user_id;

    if (!assignedUserId || String(assignedUserId) !== String(currentUserId)) {
      console.log('ℹ️ Visualizando conversa, mas não é o responsável. Não marcar como lida.');
      return;
    }

    console.log('✅ Marcando como lida por visualização ativa (responsável)');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/atendimento/conversas/${conversation.conversation_id}/read-all`,
        { onlyCustomer: true },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      console.log('✅ Mensagens marcadas como lidas:', response.data);
    } catch (error) {
      console.error('❌ Erro ao marcar mensagens como lidas:', error);
    }
  };

  // Buscar mensagens da conversa
  const fetchMessages = async () => {
    if (!conversation?.conversation_id) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/atendimento/conversas/${conversation.conversation_id}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      // Normalizar mensagens para o formato esperado pelo frontend
      const normalized = (response.data || []).map((m) => {
        const mapSender = (tipo) => {
          if (tipo === 'cliente') return 'customer';
          if (tipo === 'usuario') return 'user';
          if (tipo === 'agente') return 'agent';
          return tipo || 'system';
        };
        const mapType = (t) => {
          // tipos no banco: 'text','image','audio','file','video'
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
      });
      console.log('📨 Mensagens carregadas:', normalized);
      setMessages(normalized);
      
      // Marcar mensagens como lidas após carregar
      await markMessagesAsRead();
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (conversation?.conversation_id) {
      console.log('🔄 Nova conversa selecionada:', conversation);
      fetchMessages();
      
      // Buscar etiquetas do contato
      if (conversation.contact_id) {
        fetchContactLabels(conversation.contact_id);
      } else {
        setContactLabels([]);
      }
      
      // Entrar na sala da conversa
      if (socket) {
        socket.emit('join:conversation', conversation.conversation_id);
      }
    }
  }, [conversation?.conversation_id, conversation?.contact_id, socket]);

  // Escutar novas mensagens
  useEffect(() => {
    if (!socket || !conversation?.conversation_id) return;

    const messageHandler = (payload) => {
      // Evolution envia { type, message, timestamp }; fallback para payload direto
      const newMessage = payload?.message ?? payload;

      // pega conversationId em camelCase OU snake_case
      const wsConvId = newMessage?.conversationId ?? newMessage?.conversation_id;

      console.log('[WS] message:new recebido', {
        wsConvId,
        selected: conversation.conversation_id,
        payload
      });

      if (wsConvId === conversation.conversation_id) {
        console.log('[WS] message:new aplicado na conversa aberta');
        setMessages((prev) => [...prev, newMessage]);
        // Ao receber mensagem enquanto está visualizando, marcar como lida
        markMessagesAsRead();
      } else {
        console.log('[WS] message:new ignorado (outra conversa)');
      }
    };

    const messagesReadHandler = (payload) => {
      const wsConvId = payload?.conversation_id ?? payload?.conversationId;
      
      console.log('[WS] messages:read recebido', {
        wsConvId,
        selected: conversation.conversation_id,
        payload
      });

      if (wsConvId === conversation.conversation_id) {
        console.log('[WS] messages:read aplicado na conversa aberta');
        // As mensagens já foram marcadas como lidas no backend
        // O contador será atualizado automaticamente via WebSocket no ChatSidebar
      }
    };

    socket.on('message:new', messageHandler);
    socket.on('messages:read', messagesReadHandler);

    return () => {
      socket.off('message:new', messageHandler);
      socket.off('messages:read', messagesReadHandler);
    };
  }, [socket, conversation?.conversation_id]);
  

  // Assumir conversa
  const handleAssumeConversation = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/atendimento/conversas/${conversation.conversation_id}/assume/${user.id}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Atualizar conversa local
      const updatedConversation = { ...conversation, assigned_user_id: user.id };
      // Reutiliza a lógica central que também ajusta a aba correta (novos/meus/outros)
      handleConversationUpdated(updatedConversation);
    } catch (error) {
      console.error('Erro ao assumir conversa:', error);
    }
  };

  // Finalizar conversa
  const handleFinalizeConversation = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/atendimento/conversas/${conversation.conversation_id}/finalize`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Atualizar conversa local
      const updatedConversation = { ...conversation, status: 'fechada' };
      onConversationUpdate(updatedConversation);
      
      // Mudar automaticamente para a aba "Concluídos" com pequeno delay para garantir sincronização
      console.log('✅ Conversa finalizada, mudando para aba Concluídos');
      setTimeout(() => {
        if (onTabChange) {
          console.log('🔄 Executando mudança de aba para: concluidos');
          onTabChange('concluidos');
          
          // Não precisa mais recarregar - o refreshTrigger vai atualizar o sidebar
        } else {
          console.error('❌ onTabChange não está disponível');
        }
      }, 100);
    } catch (error) {
      console.error('Erro ao finalizar conversa:', error);
    }
  };

  if (!conversation) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateContent}>
          <h3>Selecione uma conversa</h3>
          <p>Escolha uma conversa da lista para começar a conversar</p>
        </div>
      </div>
    );
  }

  // Função para formatar status
  const formatStatus = (status) => {
    const statusMap = {
      'open': 'Aberta',
      'closed': 'Fechada',
      'pending': 'Pendente',
      'assigned': 'Atendida'
    };
    return statusMap[status] || status;
  };

  // Função para formatar data/hora
  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Função para formatar status do WhatsApp
  const formatWhatsAppStatus = (status) => {
    const statusMap = {
      'connected': 'Conectado',
      'disconnected': 'Desconectado',
      'connecting': 'Conectando...',
      'error': 'Erro'
    };
    return statusMap[status] || status;
  };

  // Verificar se o usuário atual é responsável pela conversa
  const isUserResponsible = () => {
    const currentUserId = user?.id || (JSON.parse(localStorage.getItem('userData') || '{}').id);
    const assignedUserId = conversation?.assigned_user_id;
    
    if (!assignedUserId || !currentUserId) return false;
    return parseInt(assignedUserId) === parseInt(currentUserId);
  };

  // Verificar se o usuário pode transferir a conversa
  const canTransferConversation = () => {
    const currentUserId = user?.id || (JSON.parse(localStorage.getItem('userData') || '{}').id);
    const assignedUserId = conversation?.assigned_user_id;
    
    // Se a conversa não tem responsável, qualquer usuário pode transferir
    if (!assignedUserId) return true;
    
    // Se é o dono da conversa, pode transferir
    if (String(currentUserId) === String(assignedUserId)) return true;
    
    // Admin/Superadmin sempre podem transferir
    if (isAdmin) return true;
    
    return false;
  };

  // Verificar se o usuário pode concluir a conversa
  const canFinalizeConversation = () => {
    const currentUserId = user?.id || (JSON.parse(localStorage.getItem('userData') || '{}').id);
    const assignedUserId = conversation?.assigned_user_id;
    
    // Admin/Superadmin sempre podem concluir
    if (isAdmin) return true;
    
    // Se a conversa não tem responsável, apenas admin pode concluir
    if (!assignedUserId) return false;
    
    // Se é o dono da conversa, pode concluir
    if (String(currentUserId) === String(assignedUserId)) return true;
    
    return false;
  };

  // Log para debug
  console.log('🔍 Dados da conversa no ChatWindow:', {
    conversation_id: conversation?.conversation_id,
    assigned_user_id: conversation?.assigned_user_id,
    hasAssignedUser: !!conversation?.assigned_user_id,
    isUserResponsible: isUserResponsible(),
    canTransfer: canTransferConversation(),
    canFinalize: canFinalizeConversation(),
    currentUserId: user?.id || (JSON.parse(localStorage.getItem('userData') || '{}').id),
    userRole: (JSON.parse(localStorage.getItem('userData') || '{}').userRole)
  });

  return (
    <div className={styles.container}>
      {/* Cabeçalho da conversa */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.contactHeader}>
            <div className={styles.avatar}>
              <span className={styles.avatarText}>
                {(conversation.customer_name || conversation.customer_phone || 'C')[0]}
              </span>
            </div>
            <div className={styles.contactInfo}>
              <h2 className={styles.contactName}>
                {conversation.customer_name || conversation.customer_phone || 'Contato'}
              </h2>
              {/* Etiquetas do contato */}
              {contactLabels.length > 0 && (
                <div className={styles.labelsRow}>
                  {contactLabels.slice(0, 3).map((label) => {
                    const bg = label.cor || label.color || '#3B82F6';
                    const fg = getReadableTextColor(bg);
                    return (
                      <span
                        key={label.id || label.nome}
                        className={styles.labelTag}
                        title={label.nome}
                        style={{ backgroundColor: bg, color: fg }}
                      >
                        {label.nome}
                      </span>
                    );
                  })}
                  {contactLabels.length > 3 && (
                    <span className={styles.labelMore}>
                      +{contactLabels.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className={styles.headerActions}>
              <button
                className={styles.eyeButton}
                aria-label="Ver detalhes do contato"
                onClick={async () => {
                  if (conversation?.contact_id) {
                    await fetchContactData(conversation.contact_id);
                    setIsModalOpen(true);
                  } else {
                    alert('Contato não encontrado');
                  }
                }}
              >
                <Eye size={20} />
              </button>
              {/* Ícone de editar */}
              {conversation?.contact_id && (
                <button
                  className={styles.editContactButton}
                  onClick={handleEditContact}
                  title="Editar contato"
                  type="button"
                >
                  <Edit3 size={20} />
                </button>
              )}
            </div>
          </div>
          <div className={styles.actions}>
            {conversation.status === 'fechada' ? (
              <div className={styles.transferButton} style={{ cursor: 'default', opacity: 0.8 }}>
                <CheckCircle2 size={18} />
                <span>Concluído</span>
              </div>
            ) : (
              <>
                {/* Botão de transferir - apenas para dono da conversa ou admin */}
                {canTransferConversation() && (
                  <button 
                    className={styles.transferButton} 
                    title="Transferir"
                    onClick={() => setIsTransferModalOpen(true)}
                  >
                    <ArrowRight size={18} />
                    <span>Transferir</span>
                  </button>
                )}
                {conversation.status === 'aberta' && canFinalizeConversation() && (
                  <button
                    onClick={handleFinalizeConversation}
                    className={styles.finalizeButton}
                  >
                    <CheckCircle2 size={18} />
                    <span>Concluir</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      {/* Lista de mensagens */}
      <div className={styles.messagesContainer}>
        <MessageList 
          messages={messages} 
          loading={loading}
          currentUserId={user?.id}
          currentUserName={(() => {
            try {
              const userData = JSON.parse(localStorage.getItem('user') || '{}');
              return userData.nome || userData.apelido || user?.name || user?.username || 'Usuário';
            } catch {
              return user?.name || user?.username || 'Usuário';
            }
          })()}
          currentUserAvatarUrl={(() => {
            try {
              const userData = JSON.parse(localStorage.getItem('user') || '{}');
              return userData.avatar_url || user?.avatar_url || null;
            } catch {
              return user?.avatar_url || null;
            }
          })()}
          customerAvatarUrl={conversation?.avatar_url || null}
          selectionMode={selectionMode}
          selectedMessages={selectedMessages}
          onSelectionChange={handleSelectionModeChange}
          onToggleSelection={handleToggleMessageSelection}
        />
      </div>

      {/* Composer para enviar mensagens */}
      <MessageComposer 
        conversationId={conversation.conversation_id}
        onMessageSent={(newMessage) => {
          setMessages(prev => [...prev, newMessage]);
        }}
        selectedConversation={conversation}
        hasAssignedUser={!!conversation.assigned_user_id}
        onAssumeConversation={handleAssumeConversation}
        selectionMode={selectionMode}
        selectedMessages={selectedMessages}
        onExitSelectionMode={handleExitSelectionMode}
        onForwardMessages={handleForwardMessages}
        onDeleteMessages={handleDeleteMessages}
      />

      {/* Modal de detalhes do contato */}
      <ContatoDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        contato={contactData}
        onEdit={handleEditContact}
        onEtiquetasChanged={() => {
          // Recarregar etiquetas quando mudarem
          if (conversation?.contact_id) {
            fetchContactLabels(conversation.contact_id);
          }
        }}
      />

      {/* Modal de transferência */}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        conversation={conversation}
        onTransferSuccess={handleConversationUpdated}
      />

      {/* Modal de encaminhamento */}
      <ForwardModal
        isOpen={isForwardModalOpen}
        onClose={() => setIsForwardModalOpen(false)}
        selectedMessageIds={selectedMessages}
        currentConversationId={conversation?.conversation_id}
        sourceMessages={messages}
        onConfirm={({ destinations, messageIds }) => {
          console.log('Confirmar encaminhamento', { destinations, messageIds });
          // Aqui implementaremos a chamada de API de encaminhamento quando o endpoint estiver disponível.
          setIsForwardModalOpen(false);
          // Sair do modo de seleção após confirmar
          setSelectionMode(false);
          setSelectedMessages([]);
        }}
      />

      {/* Modal de edição do contato */}
      <ContatoModal
        isOpen={isEditContactModalOpen}
        onClose={() => setIsEditContactModalOpen(false)}
        onSuccess={handleContactEditSuccess}
        contato={contactData}
        isEdit={true}
      />
    </div>
  );
}
