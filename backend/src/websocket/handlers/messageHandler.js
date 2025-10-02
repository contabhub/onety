const webSocketManager = require('../index');
const pool = require('../../config/database');
const { getCompanyIdFromTeamInstance } = require('../../utils/contactHelper');

class MessageHandler {
  /**
   * 📨 Notifica nova mensagem recebida
   */
  static notifyNewMessage(messageData) {
    const { conversation_id, sender_type, content, message_type } = messageData;
    console.log('🧩 WS notifyNewMessage -> payload resumido:', {
      conversation_id,
      sender_type,
      message_type,
      hasContent: !!content
    });
    
    // Notifica todos os usuários na conversa
    const envelope = {
      type: 'new_message',
      message: messageData,
      timestamp: new Date().toISOString()
    };

    console.log('📤 WS envelope message:new -> room', `conversation:${conversation_id}`);
    webSocketManager.emitToRoom(`conversation:${conversation_id}`, 'message:new', envelope);

    // Também emitir um evento leve para a sala da empresa, para sidebars globais
    // Evita duplicidade no ChatWindow usando um nome de evento específico da empresa
    (async () => {
      try {
        // Buscar team_whatsapp_instance_id da conversa
        const [rows] = await pool.query(
          'SELECT team_whatsapp_instance_id FROM conversations WHERE id = ? LIMIT 1',
          [conversation_id]
        );
        if (!rows.length) return;
        const twiId = rows[0].team_whatsapp_instance_id;
        const companyId = await getCompanyIdFromTeamInstance(twiId);
        if (!companyId) return;

        const companyEnvelope = {
          type: 'company_new_message',
          conversation_id,
          message: {
            conversation_id,
            sender_type,
            content,
            message_type,
            created_at: messageData.created_at || new Date().toISOString(),
            id: messageData.id || null,
            sender_id: messageData.sender_id || null,
          },
          timestamp: new Date().toISOString(),
        };
        console.log('📤 WS envelope company:message:new -> room', `company:${companyId}`);
        webSocketManager.emitToRoom(`company:${companyId}`, 'company:message:new', companyEnvelope);
      } catch (e) {
        console.warn('⚠️ Falha ao emitir company:message:new:', e?.message || e);
      }
    })();

    console.log(`📨 Nova mensagem notificada para conversa ${conversation_id}`);
  }

  /**
   * ✅ Notifica mensagem marcada como lida
   */
  static notifyMessageRead(messageId, conversationId, readByUserId) {
    webSocketManager.emitToRoom(`conversation:${conversationId}`, 'message:read', {
      type: 'message_read',
      message_id: messageId,
      conversation_id: conversationId,
      read_by_user_id: readByUserId,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Mensagem ${messageId} marcada como lida, notificando conversa ${conversationId}`);
  }

  /**
   * 📖 Notifica múltiplas mensagens marcadas como lidas
   */
  static notifyMessagesRead(payload) {
    const { conversation_id, unread_count, affected } = payload;
    
    webSocketManager.emitToRoom(`conversation:${conversation_id}`, 'messages:read', {
      type: 'messages_read',
      conversation_id: conversation_id,
      unread_count: unread_count || 0,
      affected: affected || 0,
      timestamp: new Date().toISOString()
    });

    console.log(`📖 ${affected || 0} mensagens marcadas como lidas na conversa ${conversation_id}, unread_count: ${unread_count || 0}`);
  }

  /**
   * 🗑️ Notifica mensagem deletada
   */
  static notifyMessageDeleted(messageId, conversationId) {
    webSocketManager.emitToRoom(`conversation:${conversationId}`, 'message:deleted', {
      type: 'message_deleted',
      message_id: messageId,
      conversation_id: conversationId,
      timestamp: new Date().toISOString()
    });

    console.log(`🗑️ Mensagem ${messageId} deletada, notificando conversa ${conversationId}`);
  }

  /**
   * 📱 Notifica mensagem recebida via webhook (WhatsApp)
   */
  static notifyWebhookMessage(webhookData) {
    const { instanceId, phone, chatName } = webhookData;
    
    // Busca a empresa associada à instância
    // Notifica todos os usuários da empresa
    webSocketManager.emitToRoom(`company:${webhookData.companyId}`, 'webhook:message', {
      type: 'webhook_message',
      instance_id: instanceId,
      phone: phone,
      chat_name: chatName,
      timestamp: new Date().toISOString()
    });

    console.log(`📱 Webhook de mensagem notificado para empresa ${webhookData.companyId}`);
  }

  /**
   * 🔄 Notifica sincronização de mensagens
   */
  static notifyMessageSync(conversationId, messages) {
    webSocketManager.emitToRoom(`conversation:${conversationId}`, 'message:sync', {
      type: 'message_sync',
      conversation_id: conversationId,
      messages: messages,
      timestamp: new Date().toISOString()
    });

    console.log(`🔄 Sincronização de mensagens notificada para conversa ${conversationId}`);
  }
}

module.exports = MessageHandler;

