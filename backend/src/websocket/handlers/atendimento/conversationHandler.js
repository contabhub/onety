const webSocketManager = require('../../index');

class ConversationHandler {
  /**
   * 🆕 Notifica nova conversa criada
   */
  static notifyNewConversation(conversationData) {
    const { id, team_whatsapp_instance_id, customer_name, customer_phone, company_id } = conversationData;
    
    // Notifica todos os usuários da empresa
    webSocketManager.emitToRoom(`company:${company_id}`, 'conversation:new', {
      type: 'new_conversation',
      conversation: conversationData,
      timestamp: new Date().toISOString()
    });

    console.log(`🆕 Nova conversa notificada para empresa ${company_id}`);
  }

  /**
   * 📝 Notifica conversa atualizada
   */
  static notifyConversationUpdated(conversationId, updateData, companyId) {
    webSocketManager.emitToRoom(`company:${companyId}`, 'conversation:updated', {
      type: 'conversation_updated',
      conversation_id: conversationId,
      updates: updateData,
      timestamp: new Date().toISOString()
    });

    console.log(`📝 Conversa ${conversationId} atualizada, notificando empresa ${companyId}`);
  }

  /**
   * 🗑️ Notifica conversa deletada
   */
  static notifyConversationDeleted(conversationId, companyId) {
    webSocketManager.emitToRoom(`company:${companyId}`, 'conversation:deleted', {
      type: 'conversation_deleted',
      conversation_id: conversationId,
      timestamp: new Date().toISOString()
    });

    console.log(`🗑️ Conversa ${conversationId} deletada, notificando empresa ${companyId}`);
  }

  /**
   * 🔄 Notifica transferência de conversa
   */
  static notifyConversationTransfer(transferData) {
    const { conversation_id, from_user_id, to_user_id, company_id } = transferData;
    
    // Notifica todos os usuários da empresa
    webSocketManager.emitToRoom(`company:${company_id}`, 'conversation:transferred', {
      type: 'conversation_transferred',
      conversation_id: conversation_id,
      from_user_id: from_user_id,
      to_user_id: to_user_id,
      timestamp: new Date().toISOString()
    });

    // Notifica especificamente o usuário que recebeu a conversa
    if (to_user_id) {
      webSocketManager.emitToUser(to_user_id, 'conversation:assigned', {
        type: 'conversation_assigned',
        conversation_id: conversation_id,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🔄 Transferência de conversa ${conversation_id} notificada`);
  }

  /**
   * 📊 Notifica mudança de status da conversa
   */
  static notifyConversationStatusChange(conversationId, newStatus, companyId) {
    webSocketManager.emitToRoom(`company:${companyId}`, 'conversation:status_changed', {
      type: 'conversation_status_changed',
      conversation_id: conversationId,
      new_status: newStatus,
      timestamp: new Date().toISOString()
    });

    console.log(`📊 Status da conversa ${conversationId} alterado para ${newStatus}`);
  }

  /**
   * 👤 Notifica mudança de usuário atribuído
   */
  static notifyConversationAssignmentChange(conversationId, newUserId, companyId) {
    webSocketManager.emitToRoom(`company:${companyId}`, 'conversation:assignment_changed', {
      type: 'conversation_assignment_changed',
      conversation_id: conversationId,
      new_user_id: newUserId,
      timestamp: new Date().toISOString()
    });

    // Notifica o novo usuário atribuído
    if (newUserId) {
      webSocketManager.emitToUser(newUserId, 'conversation:assigned', {
        type: 'conversation_assigned',
        conversation_id: conversationId,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`👤 Usuário atribuído à conversa ${conversationId} alterado para ${newUserId}`);
  }
}

module.exports = ConversationHandler;

