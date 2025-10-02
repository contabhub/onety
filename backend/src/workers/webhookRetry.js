const pool = require('../config/database');

/**
 * 🔄 Calcula delay para retry com backoff exponencial
 * @param {number} attempt - Número da tentativa (1, 2, 3...)
 * @param {number} baseDelay - Delay base em segundos (padrão: 30)
 * @param {number} maxDelay - Delay máximo em segundos (padrão: 300 = 5min)
 * @returns {number} - Delay em segundos
 */
function calculateRetryDelay(attempt, baseDelay = 30, maxDelay = 300) {
  // Backoff exponencial: baseDelay * 2^(attempt-1)
  const delay = baseDelay * Math.pow(2, attempt - 1);
  
  // Limitar ao máximo
  return Math.min(delay, maxDelay);
}

/**
 * 📊 Verifica se um evento deve ser reprocessado
 * @param {Object} event - Evento do banco
 * @returns {boolean} - Se deve reprocessar
 */
function shouldRetryEvent(event) {
  const maxAttempts = 3;
  const maxAge = 24 * 60 * 60 * 1000; // 24 horas em ms
  
  // Não reprocessar se já atingiu máximo de tentativas
  if (event.attempts >= maxAttempts) {
    return false;
  }
  
  // Não reprocessar se muito antigo (evitar processar eventos muito antigos)
  const eventAge = Date.now() - new Date(event.created_at).getTime();
  if (eventAge > maxAge) {
    return false;
  }
  
  // Verificar se é hora do retry
  if (event.next_retry_at) {
    const retryTime = new Date(event.next_retry_at).getTime();
    return Date.now() >= retryTime;
  }
  
  // Se não tem next_retry_at, pode processar
  return true;
}

/**
 * 🔍 Busca eventos que precisam de retry
 * @param {number} limit - Limite de eventos
 * @returns {Promise<Array>} - Lista de eventos para retry
 */
async function getRetryableEvents(limit = 20) {
  const [events] = await pool.query(
    `SELECT we.*, w.url, w.nome as webhook_name, w.status as webhook_status
     FROM webhook_events we
     JOIN webhooks w ON we.webhook_id = w.id
     WHERE we.status = 'pending' 
       AND w.status = 'ativo'
       AND we.attempts < 3
       AND (we.next_retry_at IS NULL OR we.next_retry_at <= NOW())
       AND we.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
     ORDER BY we.created_at ASC
     LIMIT ?`,
    [limit]
  );
  
  return events;
}

/**
 * 🧹 Limpa eventos antigos e falhos definitivamente
 * @param {number} daysOld - Dias para considerar "antigo" (padrão: 7)
 * @returns {Promise<number>} - Número de eventos removidos
 */
async function cleanupOldEvents(daysOld = 7) {
  try {
    const [result] = await pool.query(
      `DELETE FROM webhook_events 
       WHERE (status = 'failed' AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY))
          OR (status = 'delivered' AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [daysOld, daysOld]
    );
    
    if (result.affectedRows > 0) {
      console.log(`🧹 Limpeza: ${result.affectedRows} eventos antigos removidos`);
    }
    
    return result.affectedRows;
  } catch (error) {
    console.error('❌ Erro na limpeza de eventos antigos:', error);
    return 0;
  }
}

/**
 * 📊 Estatísticas de webhooks
 * @returns {Promise<Object>} - Estatísticas dos webhooks
 */
async function getWebhookStats() {
  try {
    const [stats] = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(attempts) as avg_attempts,
        MAX(created_at) as last_created
      FROM webhook_events 
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY status
    `);
    
    const [recentStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_events,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM webhook_events 
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);
    
    return {
      byStatus: stats,
      recent: recentStats[0] || { total_events: 0, delivered: 0, failed: 0, pending: 0 }
    };
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    return { byStatus: [], recent: { total_events: 0, delivered: 0, failed: 0, pending: 0 } };
  }
}

/**
 * 🔄 Reprocessa eventos falhos de uma empresa específica
 * @param {number} companyId - ID da empresa
 * @param {number} limit - Limite de eventos
 * @returns {Promise<number>} - Número de eventos reprocessados
 */
async function reprocessCompanyEvents(companyId, limit = 50) {
  try {
    const [result] = await pool.query(
      `UPDATE webhook_events 
       SET status = 'pending', 
           attempts = 0, 
           next_retry_at = NULL, 
           last_error = NULL,
           updated_at = NOW()
       WHERE company_id = ? 
         AND status = 'failed' 
         AND attempts >= 3
         AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
       LIMIT ?`,
      [companyId, limit]
    );
    
    if (result.affectedRows > 0) {
      console.log(`🔄 Reprocessamento: ${result.affectedRows} eventos da empresa ${companyId} resetados`);
    }
    
    return result.affectedRows;
  } catch (error) {
    console.error(`❌ Erro ao reprocessar eventos da empresa ${companyId}:`, error);
    return 0;
  }
}

/**
 * ⚡ Força retry imediato de eventos pendentes
 * @param {number} limit - Limite de eventos
 * @returns {Promise<number>} - Número de eventos forçados
 */
async function forceRetryPending(limit = 10) {
  try {
    const [result] = await pool.query(
      `UPDATE webhook_events 
       SET next_retry_at = NULL, 
           updated_at = NOW()
       WHERE status = 'pending' 
         AND next_retry_at > NOW()
       LIMIT ?`,
      [limit]
    );
    
    if (result.affectedRows > 0) {
      console.log(`⚡ Retry forçado: ${result.affectedRows} eventos agendados para processamento imediato`);
    }
    
    return result.affectedRows;
  } catch (error) {
    console.error('❌ Erro ao forçar retry:', error);
    return 0;
  }
}

module.exports = {
  calculateRetryDelay,
  shouldRetryEvent,
  getRetryableEvents,
  cleanupOldEvents,
  getWebhookStats,
  reprocessCompanyEvents,
  forceRetryPending
};
