import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Mic, Image, Video, FileText, Plus, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../utils/auth';
import { useWebSocket } from '../../../hooks/useWebSocket';
import NewChatModal from './NewChatModal';

import styles from './ChatSidebar.module.css';

// Função para obter iniciais do nome
const getInitials = (nome) => {
  if (!nome) return 'C';

  // Limpar caracteres especiais e normalizar
  const cleanName = nome.replace(/[^\w\s]/g, '').trim();
  if (!cleanName) return 'C';

  return cleanName.split(' ').map((word) => word.charAt(0)).join('').toUpperCase().substring(0, 2);
};

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

// Função para formatar o preview da última mensagem
const formatLastMessagePreview = (conversation) => {
  if (!conversation.last_message_content) return '';

  // Se tiver informação do tipo da mensagem, usar isso
  if (conversation.last_message_type) {
    switch (conversation.last_message_type) {
      case 'audio':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Mic size={14} /> Áudio
          </span>
        );
      case 'photo':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Image size={14} /> Imagem
          </span>
        );
      case 'video':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Video size={14} /> Vídeo
          </span>
        );
      case 'document':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FileText size={14} /> Documento
          </span>
        );

      case 'text':
      default:
        return conversation.last_message_content;
    }
  }

  // Fallback: detectar pelo conteúdo se não tiver o tipo
  const content = conversation.last_message_content;

  // Se começar com URL de mídia ou JSON, detectar tipo
  if (typeof content === 'string') {
    // URLs de áudio
    if (content.includes('audio') || content.includes('.ogg') || content.includes('.mp3') || content.includes('.wav')) {
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Mic size={14} /> Áudio
        </span>
      );
    }
    // URLs de imagem  
    if (content.includes('image') || content.includes('.jpg') || content.includes('.png') || content.includes('.jpeg')) {
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Image size={14} /> Imagem
        </span>
      );
    }
    // URLs de vídeo
    if (content.includes('video') || content.includes('.mp4') || content.includes('.mov')) {
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Video size={14} /> Vídeo
        </span>
      );
    }
    // JSON de áudio
    if (content.includes('audioUrl') || content.includes('"audioMessage"')) {
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Mic size={14} /> Áudio
        </span>
      );
    }
    // JSON de imagem
    if (content.includes('photoUrl') || content.includes('"imageMessage"')) {
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Image size={14} /> Imagem
        </span>
      );
    }
    // JSON de vídeo
    if (content.includes('videoUrl') || content.includes('"videoMessage"')) {
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Video size={14} /> Vídeo
        </span>
      );
    }
    // JSON de documento
    if (content.includes('documentUrl') || content.includes('"documentMessage"')) {
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <FileText size={14} /> Documento
        </span>
      );
    }
  }

  // Se não conseguir detectar, mostrar o conteúdo original (truncado se muito longo)
  return content.length > 50 ? content.substring(0, 50) + '...' : content;
};

export default function ChatSidebar({ onSelectConversation, selectedConversation, activeTab, onTabChange, refreshTrigger, isAdmin = false }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [activeFilter, setActiveFilter] = useState(activeTab || 'novos'); // 'novos', 'meus', 'outros', 'concluidos'
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [failedImages, setFailedImages] = useState(new Set());
  const [userRole, setUserRole] = useState(null);
  const { socket } = useWebSocket();
  const [labelsByContactId, setLabelsByContactId] = useState({});

  // Função para lidar com erro de carregamento de imagem
  const handleImageError = (conversationId) => {
    setFailedImages(prev => new Set([...prev, conversationId]));
  };

  // Sincronizar aba ativa com prop externa
  useEffect(() => {
    if (activeTab && activeTab !== activeFilter) {
      console.log('🔄 ChatSidebar: Sincronizando aba externa:', activeTab, '→', activeFilter);
      setActiveFilter(activeTab);
    }
  }, [activeTab]);

  // Função para mudar aba e notificar o componente pai
  const handleTabChange = (newTab) => {
    console.log('🔄 ChatSidebar: Mudando aba:', activeFilter, '→', newTab);
    setActiveFilter(newTab);
    if (onTabChange) {
      onTabChange(newTab);
    }
  };

  // Função para filtrar conversas baseado no filtro ativo e termo de busca
  const getFilteredConversations = () => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userId = userData.id;
    const userIdNumber = parseInt(userId);

    // Primeiro aplicar filtro por categoria
    let filteredByCategory = [];
    switch (activeFilter) {
      case 'novos':
        filteredByCategory = conversations.filter(conv =>
          !conv.assigned_user_id && conv.status !== 'fechada'
        );
        break;
      case 'meus':
        filteredByCategory = conversations.filter(conv => {
          const assignedId = parseInt(conv.assigned_user_id);
          return assignedId === userIdNumber && conv.status !== 'fechada';
        });
        break;
      case 'outros':
        filteredByCategory = conversations.filter(conv => {
          const assignedId = parseInt(conv.assigned_user_id);
          // Admin/Superadmin podem ver todos, mas a aba 'outros' mantém conceito de "não meus"
          return assignedId && assignedId !== userIdNumber && conv.status !== 'fechada';
        });
        break;
      case 'concluidos':
        filteredByCategory = conversations.filter(conv =>
          conv.status === 'fechada'
        );
        break;
      default:
        filteredByCategory = conversations;
    }

    // Depois aplicar filtro de busca se houver termo
    if (!searchTerm.trim()) {
      return filteredByCategory;
    }

    const searchLower = searchTerm.toLowerCase();
    return filteredByCategory.filter(conv => {
      const customerName = (conv.customer_name || '').toLowerCase();
      const customerPhone = (conv.customer_phone || '').toLowerCase();
      const lastMessage = (conv.last_message_content || '').toLowerCase();
      const teamName = (conv.team_name || '').toLowerCase();

      return customerName.includes(searchLower) ||
        customerPhone.includes(searchLower) ||
        lastMessage.includes(searchLower) ||
        teamName.includes(searchLower);
    });
  };

  // Função para calcular contadores de cada categoria
  const getConversationCounts = () => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userId = userData.id;
    const userIdNumber = parseInt(userId);

    const novos = conversations.filter(conv =>
      !conv.assigned_user_id && conv.status !== 'fechada'
    ).length;
    const meus = conversations.filter(conv => {
      const assignedId = parseInt(conv.assigned_user_id);
      return assignedId === userIdNumber && conv.status !== 'fechada';
    }).length;
    const outros = conversations.filter(conv => {
      const assignedId = parseInt(conv.assigned_user_id);
      return assignedId && assignedId !== userIdNumber && conv.status !== 'fechada';
    }).length;
    const concluidos = conversations.filter(conv =>
      conv.status === 'fechada'
    ).length;
    return { novos, meus, outros, concluidos };
  };

  // Buscar times do usuário na empresa atual
  const fetchUserTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const userId = userData.id;
      const companyId = userData.EmpresaId;

      if (!userId) {
        console.error('❌ UserId não encontrado para buscar times');
        return [];
      }

      if (!companyId) {
        console.error('❌ CompanyId não encontrado para buscar times');
        return [];
      }

      const url = `${process.env.NEXT_PUBLIC_API_URL}/atendimento/times-atendimento-usuarios/usuario/${userId}?empresa_id=${companyId}`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const teamsData = response.data || [];
      setTeams(teamsData);
      return teamsData;
    } catch (error) {
      console.error('❌ Erro ao buscar times do usuário:', error);
      return [];
    }
  };

  // Buscar conversas de um time específico
  const fetchTeamConversations = async (teamId) => {
    try {
      const token = localStorage.getItem('token');

      if (!teamId) {
        console.error('❌ TeamId não fornecido para buscar conversas');
        return [];
      }

      const url = `${process.env.NEXT_PUBLIC_API_URL}/atendimento/conversas/team/${teamId}/conversations`;
      console.log('🔍 Buscando conversas do time:', teamId, 'URL:', url);

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const conversationsData = response.data?.conversations || [];
      console.log(`✅ ${conversationsData.length} conversas encontradas para o time ${teamId}:`, conversationsData);

      return conversationsData;
    } catch (error) {
      console.error(`❌ Erro ao buscar conversas do time ${teamId}:`, error);

      // Se for erro 404, retornar array vazio (time sem conversas)
      if (error.response?.status === 404) {
        console.log(`ℹ️ Time ${teamId} não possui conversas`);
        return [];
      }

      // Para outros erros, retornar array vazio para não quebrar o fluxo
      return [];
    }
  };


  // Buscar todas as conversas da empresa (para administradores)
  const fetchAllCompanyConversations = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem('token');
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const companyId = userData.EmpresaId;

      if (!companyId) {
        console.error('❌ CompanyId não encontrado');
        setConversations([]);
        setLoading(false);
        return;
      }

      const url = `${process.env.NEXT_PUBLIC_API_URL}/atendimento/conversas/company/${companyId}/all`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const conversationsData = response.data?.conversations || [];

      // Normalizar shape esperado pelo frontend
      const normalized = conversationsData.map((c) => ({
        conversation_id: c.conversation_id ?? c.id ?? c.conversa_id,
        customer_name: c.customer_name ?? c.nome_cliente ?? c.cliente_nome ?? null,
        customer_phone: c.customer_phone ?? c.telefone_cliente ?? c.cliente_telefone ?? null,
        avatar_url: c.avatar_url ?? c.customer_avatar_url ?? null,
        status: c.status ?? c.conversation_status ?? 'aberta',
        assigned_user_id: c.assigned_user_id ?? c.responsavel_id ?? null,
        assigned_user_name: c.assigned_user_name ?? c.responsavel_nome ?? null,
        created_at: c.created_at ?? c.criado_em ?? new Date().toISOString(),
        updated_at: c.updated_at ?? c.atualizado_em ?? c.created_at ?? new Date().toISOString(),
        team_name: c.team_name ?? c.time ?? c.equipe ?? null,
        whatsapp_instance_name: c.whatsapp_instance_name ?? c.instance_name ?? null,
        last_message_content: c.last_message_content ?? c.ultima_mensagem ?? null,
        last_message_time: c.last_message_time ?? c.ultima_mensagem_em ?? null,
        last_message_type: c.last_message_type ?? c.ultima_mensagem_tipo ?? null,
        contact_id: c.contact_id ?? c.contato_id ?? null,
        unread_count: c.unread_count ?? c.nao_lidas ?? 0
      }));

      setConversations(normalized);
      await enrichConversationsWithLabels(normalized);
    } catch (error) {
      console.error('❌ Erro ao buscar conversas da empresa:', error);
      setConversations([]);
    } finally {
      setLoading(false);
      console.log('🏁 fetchAllCompanyConversations finalizado, loading:', false);
    }
  };

  // Buscar todas as conversas dos times do usuário
  const fetchAllConversations = async () => {
    try {
      setLoading(true);

      // Primeiro buscar os times do usuário
      const userTeams = await fetchUserTeams();

      if (userTeams.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Buscar conversas de todos os times
      const allConversations = [];

      for (const team of userTeams) {
        const teamConversations = await fetchTeamConversations(team.times_atendimento_id);
        // Adicionar informações do time a cada conversa
        const conversationsWithTeam = teamConversations.map(conv => ({
          ...conv,
          team_id: team.times_atendimento_id,
          team_name: team.time,
          user_role: team.role
        }));
        allConversations.push(...conversationsWithTeam);
      }

      // Ordenar por data de atualização (mais recentes primeiro)
      const sortedConversations = allConversations.sort((a, b) =>
        new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
      );

      console.log('✅ Todas as conversas carregadas:', sortedConversations);
      setConversations(sortedConversations);
      await enrichConversationsWithLabels(sortedConversations);
    } catch (error) {
      console.error('❌ Erro ao buscar todas as conversas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carrega etiquetas para cada contato presente nas conversas e atualiza o estado
  const enrichConversationsWithLabels = async (convs) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = localStorage.getItem('token');
      const uniqueContactIds = Array.from(new Set((convs || []).map(c => c.contact_id).filter(Boolean)));

      // Pular se já carregadas
      const toFetch = uniqueContactIds.filter(id => !labelsByContactId[id]);
      if (toFetch.length === 0) return;

      const requests = toFetch.map(id =>
        fetch(`${apiUrl}/atendimento/leads-etiquetas/lead/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.ok ? res.json() : []).catch(() => [])
      );

      const results = await Promise.all(requests);
      const map = {};
      toFetch.forEach((id, idx) => {
        map[id] = Array.isArray(results[idx]) ? results[idx] : [];
      });
      setLabelsByContactId(prev => ({ ...prev, ...map }));

      // Anexar labels a cada conversa
      setConversations(prev => prev.map(conv => ({
        ...conv,
        contact_labels: labelsByContactId[conv.contact_id] || map[conv.contact_id] || conv.contact_labels || []
      })));
    } catch (err) {
      console.error('Erro ao carregar etiquetas dos contatos:', err);
    }
  };

  useEffect(() => {

    // Verificar se temos dados suficientes para buscar conversas
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userId = userData.id;
    const currentUserRole = userData.permissoes?.adm?.includes('admin') ? 'Administrador' : 'Usuário';
    setUserRole(currentUserRole);

    if (userId) {

      // Se for administrador, buscar todas as conversas da empresa
      if (isAdmin || currentUserRole === 'Administrador' || currentUserRole === 'Superadmin') {
        fetchAllCompanyConversations();
      } else {
        fetchAllConversations();
      }
    } else {
      // Se não temos dados suficientes mas ainda estamos carregando, aguardar
      if (loading) {
        console.log('⏳ Aguardando dados do usuário...');
      } else {
        console.log('⚠️ Dados insuficientes e não carregando mais');
        setLoading(false);
      }
    }
  }, [user]); // Removido loading como dependência para evitar loops

  // Recarregar conversas quando refreshTrigger mudar (quando uma conversa for finalizada)
  useEffect(() => {
    if (refreshTrigger && user?.id) {
      console.log('🔄 ChatSidebar: Refresh trigger ativado, recarregando conversas');

      // Usar a função apropriada baseada no papel do usuário
      if (isAdmin || userRole === 'Administrador' || userRole === 'Superadmin') {
        fetchAllCompanyConversations();
      } else {
        fetchAllConversations();
      }
    }
  }, [refreshTrigger, userRole]);

  // Escutar eventos do WebSocket
  useEffect(() => {


    if (!socket) {
      console.log('❌ Socket não disponível, não configurando listeners');
      return;
    }


    // Listener geral para debug - remover depois
    socket.onAny((eventName, ...args) => {
      console.log('🔍 Evento WebSocket recebido:', eventName, args);
    });

    socket.on('conversation:new', (payload) => {
      // Backend envia envelope { type, conversation, timestamp }
      const incoming = payload?.conversation ?? payload;
      console.log('🆕 Nova conversa recebida via WebSocket:', payload);
      if (!incoming) return;

      // Normaliza para o shape usado no Sidebar
      const normalized = {
        conversation_id: incoming.conversation_id ?? incoming.id,
        customer_name: incoming.customer_name ?? null,
        customer_phone: incoming.customer_phone ?? null,
        avatar_url: incoming.avatar_url ?? null,
        status: incoming.status ?? 'aberta',
        assigned_user_id: incoming.assigned_user_id ?? null,
        assigned_user_name: incoming.assigned_user_name ?? null,
        created_at: incoming.created_at ?? new Date().toISOString(),
        updated_at: incoming.updated_at ?? incoming.created_at ?? new Date().toISOString(),
        team_name: incoming.team_name ?? null,
        whatsapp_instance_name: incoming.whatsapp_instance_name ?? null,
        last_message_content: incoming.last_message_content ?? null,
        last_message_time: incoming.last_message_time ?? null,
        contact_id: incoming.contact_id ?? null
      };

      setConversations((prev) => {
        // evita duplicidade por id normalizado
        const exists = prev.some((c) => c.conversation_id === normalized.conversation_id);
        if (exists) return prev;
        return [normalized, ...prev];
      });

      // Buscar etiquetas se tiver contato
      if (normalized.contact_id) {
        enrichConversationsWithLabels([normalized]);
      }
    });

    socket.on('conversation:updated', (payload) => {
      // Backend envia { type, conversation_id, updates }
      const conversationId = payload?.conversation_id ?? payload?.id;
      const updates = payload?.updates ?? payload;
      console.log('🔄 Conversa atualizada via WebSocket:', payload);
      setConversations(prev => {
        const mapped = prev.map(conv => {
          if (conv.conversation_id === conversationId) {
            return { ...conv, ...updates, updated_at: new Date().toISOString() };
          }
          return conv;
        });
        return mapped;
      });
    });

    socket.on('message:new', (payload) => {
      console.log('💬 Nova mensagem recebida via WebSocket:', payload);
      const message = payload?.message ?? payload;

      if (!message || !message.conversation_id) {
        console.log('❌ Dados da mensagem inválidos:', payload);
        return;
      }

      const conversationId = message.conversation_id;
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const userId = userData.id;
      const userIdNumber = parseInt(userId);

      // Verificar se o usuário está atualmente visualizando esta conversa
      const isViewingThisConversation = selectedConversation?.conversation_id == conversationId;

      console.log('🔍 Debug contador:', {
        conversationId,
        selectedConversationId: selectedConversation?.conversation_id,
        isViewingThisConversation,
        senderType: message.sender_type,
        senderId: message.sender_id,
        currentUserId: userIdNumber
      });

      // Incrementar contador apenas se:
      // 1. A mensagem é de um cliente (customer)
      // 2. OU a mensagem é de outro usuário (não o atual)
      // 3. E o usuário NÃO está visualizando esta conversa
      const shouldIncrementCounter = (
        message.sender_type === 'customer' ||
        (message.sender_type === 'user' && parseInt(message.sender_id) !== userIdNumber)
      ) && !isViewingThisConversation;

      console.log('🎯 shouldIncrementCounter:', shouldIncrementCounter);

      if (shouldIncrementCounter) {
        console.log('📈 Incrementando contador de não lidas para conversa:', conversationId, '(usuário não está visualizando)');

        setConversations(prev => {
          return prev.map(conv => {
            if (conv.conversation_id == conversationId) {
              const currentUnread = conv.unread_count || 0;
              const newUnread = currentUnread + 1;
              console.log('📈 Atualizando unread_count de', currentUnread, 'para', newUnread);

              return {
                ...conv,
                unread_count: newUnread,
                last_message_content: message.content || conv.last_message_content,
                last_message_time: message.created_at || new Date().toISOString(),
                last_message_type: message.message_type || 'text',
                updated_at: message.created_at || new Date().toISOString()
              };
            }
            return conv;
          }).sort((a, b) =>
            // Reordenar para colocar conversa com nova mensagem no topo
            new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
          );
        });
      } else if (isViewingThisConversation) {
        console.log('ℹ️ Usuário está visualizando a conversa, apenas atualizando última mensagem sem incrementar contador');

        // Se o usuário está visualizando a conversa, apenas atualizar a última mensagem
        setConversations(prev => {
          return prev.map(conv => {
            if (conv.conversation_id == conversationId) {
              return {
                ...conv,
                last_message_content: message.content || conv.last_message_content,
                last_message_time: message.created_at || new Date().toISOString(),
                last_message_type: message.message_type || 'text',
                updated_at: message.created_at || new Date().toISOString()
              };
            }
            return conv;
          }).sort((a, b) =>
            new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
          );
        });
      } else {
        console.log('ℹ️ Mensagem enviada pelo usuário atual, não incrementando contador');
      }
    });

    // Evento company-wide para novas mensagens, recebido mesmo sem estar na sala da conversa
    socket.on('company:message:new', (payload) => {
      console.log('🏢 Nova mensagem (company-wide) recebida via WebSocket:', payload);
      const message = payload?.message ?? payload;
      const conversationId = payload?.conversation_id ?? message?.conversation_id;
      if (!conversationId) return;

      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const userId = userData.id;
      const userIdNumber = parseInt(userId);

      const isViewingThisConversation = selectedConversation?.conversation_id == conversationId;

      const shouldIncrementCounter = (
        message?.sender_type === 'customer' ||
        (message?.sender_type === 'user' && parseInt(message?.sender_id) !== userIdNumber)
      ) && !isViewingThisConversation;

      if (shouldIncrementCounter) {
        setConversations(prev => {
          const updated = prev.map(conv => {
            if (conv.conversation_id == conversationId) {
              const currentUnread = conv.unread_count || 0;
              const newUnread = currentUnread + 1;
              return {
                ...conv,
                unread_count: newUnread,
                last_message_content: message?.content || conv.last_message_content,
                last_message_time: message?.created_at || new Date().toISOString(),
                last_message_type: message?.message_type || 'text',
                updated_at: message?.created_at || new Date().toISOString()
              };
            }
            return conv;
          }).sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
          return updated;
        });
      }
    });

    socket.on('messages:read', (payload) => {
      console.log('📖 Mensagens marcadas como lidas via WebSocket:', payload);
      console.log('📖 Payload completo:', JSON.stringify(payload, null, 2));
      const { conversation_id, unread_count } = payload;

      console.log('📖 Atualizando conversa:', conversation_id, 'unread_count:', unread_count);

      setConversations(prev => {
        const updated = prev.map(conv => {
          if (conv.conversation_id == conversation_id) {
            console.log('📖 Conversa encontrada, atualizando unread_count de', conv.unread_count, 'para', unread_count || 0);
            return { ...conv, unread_count: unread_count || 0 };
          }
          return conv;
        });
        console.log('📖 Conversas após atualização:', updated.filter(c => c.conversation_id == conversation_id));
        return updated;
      });
    });

    return () => {
      socket.off('conversation:new');
      socket.off('conversation:updated');
      socket.off('message:new');
      socket.off('company:message:new');
      socket.off('messages:read');
    };
  }, [socket]);

  // Monitorar mudanças no localStorage para forçar nova busca
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'userData' && e.newValue) {
        console.log('🔄 userData mudou no localStorage:', e.newValue);
        const newUserData = JSON.parse(e.newValue);
        const newUserRole = newUserData.permissoes?.adm?.includes('admin') ? 'Administrador' : 'Usuário';

        // Forçar nova busca de conversas
        setLoading(true);
        setTimeout(() => {
          if (newUserRole === 'Administrador' || newUserRole === 'Superadmin') {
            fetchAllCompanyConversations();
          } else {
            fetchAllConversations();
          }
        }, 100);
      }
    };

    // Listener para mudanças no localStorage
    window.addEventListener('storage', handleStorageChange);

    // Polling para mudanças no localStorage (fallback)
    const interval = setInterval(() => {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const currentUserId = userData.id;
      const currentUserRole = userData.permissoes?.adm?.includes('admin') ? 'Administrador' : 'Usuário';
      if (currentUserId && (!user?.id || String(user.id) !== String(currentUserId))) {
        console.log('🔄 Mudança detectada via polling - userData.id:', currentUserId, 'userRole:', currentUserRole);
        setLoading(true);
        setTimeout(() => {
          if (currentUserRole === 'Administrador' || currentUserRole === 'Superadmin') {
            fetchAllCompanyConversations();
          } else {
            fetchAllConversations();
          }
        }, 100);
      }
    }, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [user?.id]);

  // Entrar na sala da conversa quando uma conversa for selecionada
  useEffect(() => {
    if (socket && selectedConversation?.conversation_id) {
      console.log('💬 ChatSidebar entrando na conversa:', selectedConversation.conversation_id);
      socket.emit('join:conversation', selectedConversation.conversation_id);
    }
  }, [socket, selectedConversation?.conversation_id]);

  // Lidar com nova conversa criada
  const handleNewConversationCreated = (newConversation) => {
    console.log('✅ Nova conversa criada no ChatSidebar:', newConversation);

    // Adicionar à lista de conversas apenas se não existir
    setConversations(prev => {
      const exists = prev.some(conv => conv.conversation_id === newConversation.conversation_id);
      if (exists) {
        console.log('⚠️ Conversa já existe na lista, não adicionando duplicata');
        return prev;
      }
      return [newConversation, ...prev];
    });

    // Selecionar automaticamente a nova conversa
    if (onSelectConversation) {
      onSelectConversation(newConversation);
    }

    // Definir filtro como "meus" para mostrar a conversa criada
    handleTabChange('meus');
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <div className={styles.loadingText}>Carregando conversas...</div>
        </div>
      </div>
    );
  }

  const filteredConversations = getFilteredConversations();
  const counts = getConversationCounts();

  return (
    <div className={styles.container}>
      {/* Botão Novo Atendimento */}
      <div className={styles.newChatContainer}>
        <button
          onClick={() => setShowNewChatModal(true)}
          className={styles.newChatButton}
        >
          <Plus size={18} />
          Novo Atendimento
        </button>
      </div>

      {/* Filtros */}
      <div className={styles.filtersContainer}>
        <div className={styles.filters}>
          <button
            className={`${styles.filterTab} ${activeFilter === 'novos' ? styles.active : ''}`}
            onClick={() => handleTabChange('novos')}
          >
            Novos
          </button>
          <button
            className={`${styles.filterTab} ${activeFilter === 'meus' ? styles.active : ''}`}
            onClick={() => handleTabChange('meus')}
          >
            Meus
          </button>
          <button
            className={`${styles.filterTab} ${activeFilter === 'outros' ? styles.active : ''}`}
            onClick={() => handleTabChange('outros')}
          >
            Outros
          </button>
          <button
            className={`${styles.filterTab} ${activeFilter === 'concluidos' ? styles.active : ''}`}
            onClick={() => handleTabChange('concluidos')}
          >
            <CheckCircle2 size={16} />
          </button>
        </div>
      </div>

      {/* Container de Busca */}
      <div className={styles.searchContainer}>
        <div className={styles.searchInputWrapper}>
          <input
            type="text"
            placeholder="Buscar conversas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          <Search className={styles.searchIcon} size={16} />
        </div>
      </div>

      {/* Lista de conversas */}
      <div className={styles.conversationsList}>
        {filteredConversations.length === 0 ? (
          <div className={styles.empty}>
            {conversations.length === 0
              ? 'Nenhuma conversa encontrada'
              : `Nenhuma conversa encontrada em "${activeFilter}"`
            }
          </div>
        ) : (
          filteredConversations.map((conversation) => {
            return (
              <div
                key={conversation.conversation_id}
                onClick={() => onSelectConversation(conversation)}
                className={`${styles.conversationItem} ${selectedConversation?.conversation_id === conversation.conversation_id ? styles.selected : ''
                  }`}
              >
                <div className={styles.conversationHeader}>
                  {/* Avatar do contato */}
                  <div className={styles.contactAvatar}>
                    {conversation.avatar_url && !failedImages.has(conversation.conversation_id) ? (
                      <img
                        src={conversation.avatar_url}
                        alt={conversation.customer_name || 'Contato'}
                        className={styles.avatarImage}
                        onError={() => handleImageError(conversation.conversation_id)}
                      />
                    ) : (
                      <div className={styles.avatarInitials}>
                        {getInitials(conversation.customer_name || conversation.customer_phone)}
                      </div>
                    )}
                  </div>

                  <div className={styles.contactInfo}>
                    <h3 className={styles.contactName}>
                      {conversation.customer_name || conversation.customer_phone || 'Contato'}
                    </h3>

                    {conversation.assigned_user_name && (
                      <div className={styles.assignedUser} title={`Responsável: ${conversation.assigned_user_name}`}>
                        {conversation.assigned_user_name}
                      </div>
                    )}
                    {/* Etiquetas do contato */}
                    {conversation.contact_id && (labelsByContactId[conversation.contact_id]?.length > 0) && (
                      <div className={styles.labelsRow}>
                        {labelsByContactId[conversation.contact_id].slice(0, 3).map((label) => {
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
                        {labelsByContactId[conversation.contact_id].length > 3 && (
                          <span className={styles.labelMore}>
                            +{labelsByContactId[conversation.contact_id].length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Time responsável (linha do cabeçalho) */}
                  {conversation.team_name && (
                    <div className={styles.teamTag}>
                      {conversation.team_name}
                    </div>
                  )}
                </div>

                {/* Linha: última mensagem (esquerda) + tempo/badge (direita) */}
                <div className={styles.messageRow}>
                  <p className={styles.lastMessage}>
                    {conversation.last_message_content ? formatLastMessagePreview(conversation) : ''}
                  </p>
                  <div className={styles.messageMeta}>
                    {conversation.last_message_time && (
                      <span className={styles.messageTime}>
                        {(() => {
                          const messageDate = new Date(conversation.last_message_time);
                          const now = new Date();
                          const diffTime = Math.abs(now - messageDate);
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          if (diffDays === 1) return 'ontem';
                          if (diffDays < 7) return `há ${diffDays} dias`;
                          if (diffDays < 30) return `há ${Math.floor(diffDays / 7)} semanas`;
                          if (diffDays < 365) return `há ${Math.floor(diffDays / 30)} meses`;
                          return `há ${diffDays / 365} anos`;
                        })()}
                      </span>
                    )}
                    {(() => {
                      const unreadCount = conversation.unread_count || 0;
                      return unreadCount > 0 ? (
                        <span className={styles.unreadBadge}>{unreadCount}</span>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Novo Atendimento */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onConversationCreated={handleNewConversationCreated}
      />
    </div>
  );
}
