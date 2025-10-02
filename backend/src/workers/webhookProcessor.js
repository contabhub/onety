const axios = require('axios');
const pool = require('../config/database');

/**
 * 🔄 Processa um evento de webhook individual
 * @param {Object} webhookEvent - Evento da tabela webhook_events
 * @param {Object} webhook - Dados do webhook da tabela webhooks
 * @returns {Promise<Object>} - Resultado do processamento
 */
async function processWebhookEvent(webhookEvent, webhook) {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 Processando webhook ${webhookEvent.id} para ${webhook.url}`);
    
    // Fazer POST para o webhook
    const response = await axios.post(webhook.url, webhookEvent.payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Aura8-Webhook/1.0',
        'X-Webhook-Event': webhookEvent.type,
        'X-Webhook-Id': webhookEvent.id.toString()
      },
      timeout: 30000, // 30 segundos timeout
      validateStatus: (status) => status >= 200 && status < 300 // Aceita 2xx como sucesso
    });
    
    const processingTime = Date.now() - startTime;
    
    console.log(`✅ Webhook ${webhookEvent.id} entregue com sucesso! Status: ${response.status} | Tempo: ${processingTime}ms`);
    
    return {
      success: true,
      status: response.status,
      processingTime,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      }
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error(`❌ Erro ao processar webhook ${webhookEvent.id}:`, {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      processingTime
    });
    
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      },
      processingTime
    };
  }
}

/**
 * 📊 Atualiza estatísticas do webhook na tabela webhooks
 * @param {number} webhookId - ID do webhook
 * @param {string} status - Status do evento (delivered/failed)
 * @param {Object} result - Resultado do processamento
 */
async function updateWebhookStats(webhookId, status, result) {
  const conn = await pool.getConnection();
  try {
    if (status === 'delivered') {
      await conn.query(
        `UPDATE webhooks 
         SET last_success_at = NOW(), failure_count = 0, updated_at = NOW()
         WHERE id = ?`,
        [webhookId]
      );
    } else if (status === 'failed') {
      await conn.query(
        `UPDATE webhooks 
         SET last_failure_at = NOW(), failure_count = failure_count + 1, updated_at = NOW()
         WHERE id = ?`,
        [webhookId]
      );
    }
  } catch (error) {
    console.error(`❌ Erro ao atualizar estatísticas do webhook ${webhookId}:`, error);
  } finally {
    conn.release();
  }
}

/**
 * 📊 Atualiza status do evento no banco
 * @param {number} eventId - ID do evento
 * @param {string} status - Novo status
 * @param {Object} result - Resultado do processamento
 * @param {number} attempts - Número de tentativas
 */
async function updateWebhookEventStatus(eventId, status, result, attempts) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const updateData = {
      status,
      attempts,
      updated_at: new Date()
    };
    
    if (status === 'delivered') {
      // Não precisa de last_success_at na webhook_events
    } else if (status === 'failed') {
      updateData.last_error = result.error ? JSON.stringify(result.error) : null;
    } else if (status === 'pending') {
      // Calcular próximo retry com backoff exponencial
      const retryDelay = Math.min(300, Math.pow(2, attempts) * 30); // Max 5 minutos
      updateData.next_retry_at = new Date(Date.now() + retryDelay * 1000);
      updateData.last_error = result.error ? JSON.stringify(result.error) : null;
    }
    
    await conn.query(
      `UPDATE webhook_events 
       SET status = ?, attempts = ?, last_error = ?, next_retry_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        updateData.status,
        updateData.attempts,
        updateData.last_error,
        updateData.next_retry_at,
        updateData.updated_at,
        eventId
      ]
    );
    
    await conn.commit();
    
  } catch (error) {
    await conn.rollback();
    console.error(`❌ Erro ao atualizar status do webhook ${eventId}:`, error);
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * 🔍 Busca eventos pendentes para processamento
 * @param {number} limit - Limite de eventos por vez
 * @returns {Promise<Array>} - Lista de eventos para processar
 */
async function getPendingWebhookEvents(limit = 10) {
  const [events] = await pool.query(
    `SELECT we.*, w.url, w.nome as webhook_name, w.status as webhook_status
     FROM webhook_events we
     JOIN webhooks w ON we.webhook_id = w.id
     WHERE we.status = 'pending' 
       AND w.status = 'ativo'
       AND (we.next_retry_at IS NULL OR we.next_retry_at <= NOW())
     ORDER BY we.created_at ASC
     LIMIT ?`,
    [limit]
  );
  
  return events;
}

/**
 * 🔄 Processa um lote de eventos de webhook
 * @param {number} batchSize - Tamanho do lote
 * @returns {Promise<Object>} - Estatísticas do processamento
 */
async function processWebhookBatch(batchSize = 10) {
  const startTime = Date.now();
  let processed = 0;
  let delivered = 0;
  let failed = 0;
  let retried = 0;
  
  try {
    console.log(`🔄 Iniciando processamento de lote de webhooks (limite: ${batchSize})`);
    
    // Buscar eventos pendentes
    const events = await getPendingWebhookEvents(batchSize);
    
    if (events.length === 0) {
      console.log('ℹ️ Nenhum evento pendente encontrado');
      return { processed, delivered, failed, retried, processingTime: 0 };
    }
    
    console.log(`📋 Encontrados ${events.length} eventos para processar`);
    
    // Processar cada evento
    for (const event of events) {
      try {
        processed++;
        
        // Verificar se webhook ainda está ativo
        if (event.webhook_status !== 'ativo') {
          console.log(`⚠️ Webhook ${event.webhook_id} inativo, pulando evento ${event.id}`);
          await updateWebhookEventStatus(event.id, 'failed', { 
            error: { message: 'Webhook inativo' } 
          }, event.attempts);
          failed++;
          continue;
        }
        
        // Processar webhook
        const result = await processWebhookEvent(event, {
          id: event.webhook_id,
          url: event.url,
          nome: event.webhook_name
        });
        
        // Atualizar status baseado no resultado
        if (result.success) {
          await updateWebhookEventStatus(event.id, 'delivered', result, event.attempts + 1);
          // Atualizar estatísticas do webhook na tabela webhooks
          await updateWebhookStats(event.webhook_id, 'delivered', result);
          delivered++;
        } else {
          const newAttempts = event.attempts + 1;
          const maxAttempts = 3;
          
          if (newAttempts >= maxAttempts) {
            await updateWebhookEventStatus(event.id, 'failed', result, newAttempts);
            // Atualizar estatísticas do webhook na tabela webhooks
            await updateWebhookStats(event.webhook_id, 'failed', result);
            failed++;
            console.log(`💀 Webhook ${event.id} falhou definitivamente após ${maxAttempts} tentativas`);
          } else {
            await updateWebhookEventStatus(event.id, 'pending', result, newAttempts);
            retried++;
            console.log(`🔄 Webhook ${event.id} agendado para retry (tentativa ${newAttempts}/${maxAttempts})`);
          }
        }
        
        // Pequena pausa entre webhooks para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Erro ao processar evento ${event.id}:`, error);
        failed++;
        
        // Marcar como falha se der erro no processamento
        try {
          await updateWebhookEventStatus(event.id, 'failed', { 
            error: { message: error.message } 
          }, event.attempts + 1);
        } catch (updateError) {
          console.error(`❌ Erro ao atualizar status do evento ${event.id}:`, updateError);
        }
      }
    }
    
    const processingTime = Date.now() - startTime;
    
    console.log(`✅ Lote processado: ${processed} eventos | Entregues: ${delivered} | Falhas: ${failed} | Retries: ${retried} | Tempo: ${processingTime}ms`);
    
    return { processed, delivered, failed, retried, processingTime };
    
  } catch (error) {
    console.error('❌ Erro no processamento do lote:', error);
    throw error;
  }
}

module.exports = {
  processWebhookEvent,
  updateWebhookEventStatus,
  updateWebhookStats,
  getPendingWebhookEvents,
  processWebhookBatch
};
