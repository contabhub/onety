const webSocketManager = require('../index');

class UserHandler {
  /**
   * 🟢 Notifica usuário online
   */
  static notifyUserOnline(userId, userData) {
    // Notifica todos os usuários da empresa
    webSocketManager.emitToRoom(`company:${userData.company_id}`, 'user:online', {
      type: 'user_online',
      user_id: userId,
      user: userData,
      timestamp: new Date().toISOString()
    });

    console.log(`🟢 Usuário ${userData.name} (ID: ${userId}) está online`);
  }

  /**
   * 🔴 Notifica usuário offline
   */
  static notifyUserOffline(userId, userData) {
    // Notifica todos os usuários da empresa
    webSocketManager.emitToRoom(`company:${userData.company_id}`, 'user:offline', {
      type: 'user_offline',
      user_id: userId,
      user: userData,
      timestamp: new Date().toISOString()
    });

    console.log(`🔴 Usuário ${userData.name} (ID: ${userId}) está offline`);
  }

  /**
   * 👥 Notifica usuário entrou em equipe
   */
  static notifyUserJoinedTeam(userId, teamId, userData) {
    webSocketManager.emitToRoom(`team:${teamId}`, 'user:joined_team', {
      type: 'user_joined_team',
      user_id: userId,
      team_id: teamId,
      user: userData,
      timestamp: new Date().toISOString()
    });

    console.log(`👥 Usuário ${userData.name} entrou na equipe ${teamId}`);
  }

  /**
   * 🚪 Notifica usuário saiu de equipe
   */
  static notifyUserLeftTeam(userId, teamId, userData) {
    webSocketManager.emitToRoom(`team:${teamId}`, 'user:left_team', {
      type: 'user_left_team',
      user_id: userId,
      team_id: teamId,
      user: userData,
      timestamp: new Date().toISOString()
    });

    console.log(`🚪 Usuário ${userData.name} saiu da equipe ${teamId}`);
  }

  /**
   * 📱 Notifica usuário digitando em conversa
   */
  static notifyUserTyping(userId, conversationId, userData) {
    webSocketManager.emitToRoom(`conversation:${conversationId}`, 'user:typing', {
      type: 'user_typing',
      user_id: userId,
      conversation_id: conversationId,
      user: userData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 🛑 Notifica usuário parou de digitar
   */
  static notifyUserStoppedTyping(userId, conversationId, userData) {
    webSocketManager.emitToRoom(`conversation:${conversationId}`, 'user:stopped_typing', {
      type: 'user_stopped_typing',
      user_id: userId,
      conversation_id: conversationId,
      user: userData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 🔔 Notifica usuário sobre nova atribuição
   */
  static notifyUserAssignment(userId, assignmentData) {
    webSocketManager.emitToUser(userId, 'user:assigned', {
      type: 'user_assigned',
      assignment: assignmentData,
      timestamp: new Date().toISOString()
    });

    console.log(`🔔 Usuário ${userId} notificado sobre nova atribuição`);
  }

  /**
   * 📊 Notifica mudança de status do usuário
   */
  static notifyUserStatusChange(userId, newStatus, companyId) {
    webSocketManager.emitToRoom(`company:${companyId}`, 'user:status_changed', {
      type: 'user_status_changed',
      user_id: userId,
      new_status: newStatus,
      timestamp: new Date().toISOString()
    });

    console.log(`📊 Status do usuário ${userId} alterado para ${newStatus}`);
  }
}

module.exports = UserHandler;

