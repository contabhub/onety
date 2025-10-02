const { processWebhookBatch } = require('./webhookProcessor');
const { cleanupOldEvents, getWebhookStats, forceRetryPending } = require('./webhookRetry');

class WebhookWorker {
  constructor(options = {}) {
    this.isRunning = false;
    this.intervalId = null;
    this.batchSize = options.batchSize || 10;
    this.intervalMs = options.intervalMs || 30000; // 30 segundos (não será usado como pooling fixo após auto-trigger)
    this.cleanupIntervalMs = options.cleanupIntervalMs || 3600000; // 1 hora
    this.cleanupIntervalId = null;
    this.stats = {
      totalProcessed: 0,
      totalDelivered: 0,
      totalFailed: 0,
      totalRetried: 0,
      lastRun: null,
      errors: 0
    };
    this.debounceTimer = null;
    this.nextRetryTimer = null;
  }

  /**
   * 🔍 Verifica se há webhooks ativos no sistema
   */
  async hasActiveWebhooks() {
    try {
      const pool = require('../config/database');
      const [rows] = await pool.query(
        `SELECT COUNT(*) as count FROM webhooks WHERE status = 'ativo'`
      );
      return rows[0].count > 0;
    } catch (error) {
      console.error('❌ Erro ao verificar webhooks ativos:', error);
      return false;
    }
  }

  /**
   * 🚀 Inicia o worker
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ WebhookWorker já está rodando');
      return;
    }

    console.log('🚀 Iniciando WebhookWorker...');
    
    // 🔍 Verificar se há webhooks ativos antes de iniciar
    const hasWebhooks = await this.hasActiveWebhooks();
    if (!hasWebhooks) {
      console.log('⏸️ Nenhum webhook ativo encontrado, pausando worker por 10 minutos...');
      this.pauseTemporarily(10 * 60 * 1000); // 10 minutos
      return;
    }

    console.log(`📊 Configurações: batchSize=${this.batchSize}, interval=${this.intervalMs}ms`);
    
    this.isRunning = true;

    // Processar imediatamente na primeira execução (com lock)
    await this.processWithLock();
    
    // Agendar limpeza periódica
    this.cleanupIntervalId = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);
    
    console.log('✅ WebhookWorker iniciado com sucesso!');
  }

  /**
   * 🛑 Para o worker
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ WebhookWorker já está parado');
      return;
    }

    console.log('🛑 Parando WebhookWorker...');
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.nextRetryTimer) {
      clearTimeout(this.nextRetryTimer);
      this.nextRetryTimer = null;
    }
    
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    
    console.log('✅ WebhookWorker parado com sucesso!');
  }

  /**
   * 🔍 Verifica se há eventos pendentes antes de processar
   */
  async hasPendingEvents() {
    try {
      const { getPendingWebhookEvents } = require('./webhookProcessor');
      const events = await getPendingWebhookEvents(1); // Só precisa de 1 para verificar
      return events.length > 0;
    } catch (error) {
      console.error('❌ Erro ao verificar eventos pendentes:', error);
      return false;
    }
  }

  /**
   * 🔐 Tenta adquirir lock distribuído via MySQL para evitar processamento concorrente entre instâncias
   */
  async acquireLock() {
    try {
      const pool = require('../config/database');
      const lockName = 'webhook_worker_process_lock';
      const timeoutSec = 0; // não espera
      const [[row]] = await pool.query('SELECT GET_LOCK(?, ?) AS l', [lockName, timeoutSec]);
      return row && row.l === 1;
    } catch (e) {
      console.error('❌ Erro ao adquirir lock do worker:', e);
      return false;
    }
  }

  async releaseLock() {
    try {
      const pool = require('../config/database');
      const lockName = 'webhook_worker_process_lock';
      await pool.query('SELECT RELEASE_LOCK(?)', [lockName]);
    } catch (e) {
      console.error('❌ Erro ao liberar lock do worker:', e);
    }
  }

  /**
   * ⚡ Dispara processamento imediato com debounce curto
   */
  triggerNow(debounceMs = 150) {
    if (!this.isRunning) return;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.debounceTimer = setTimeout(() => {
      this.processWithLock();
    }, debounceMs);
  }

  /**
   * 🔄 Processa lote protegido por lock distribuído
   */
  async processWithLock() {
    if (!this.isRunning) return;
    const got = await this.acquireLock();
    if (!got) {
      // Outra instância está processando agora; apenas agenda próximo retry e sai
      await this.scheduleNextBasedOnDB();
      return;
    }
    try {
      await this.processBatch();
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * ⏱️ Agenda próximo processamento com base no menor next_retry_at
   */
  async scheduleNextBasedOnDB() {
    if (!this.isRunning) return;
    try {
      const pool = require('../config/database');
      const [[row]] = await pool.query(
        `SELECT TIMESTAMPDIFF(MICROSECOND, NOW(), MIN(next_retry_at)) AS us
           FROM webhook_events
          WHERE status = 'pending' AND next_retry_at IS NOT NULL AND next_retry_at > NOW()`
      );
      const micro = row && row.us != null ? Number(row.us) : null;
      if (this.nextRetryTimer) {
        clearTimeout(this.nextRetryTimer);
        this.nextRetryTimer = null;
      }
      if (micro != null && micro > 0) {
        const delayMs = Math.min(Math.max(Math.ceil(micro / 1000), 1000), 5 * 60 * 1000); // entre 1s e 5min
        console.log(`⏱️ Agendando próximo processamento em ~${delayMs}ms com base no próximo next_retry_at`);
        this.nextRetryTimer = setTimeout(() => {
          this.processWithLock();
        }, delayMs);
      } else {
        // Sem retries agendados; nada a fazer até novo enqueue/trigger
        console.log('⏸️ Sem next_retry_at futuro; aguardando novos enqueues');
      }
    } catch (e) {
      console.error('❌ Erro ao agendar próximo processamento:', e);
    }
  }

  /**
   * 🔄 Processa um lote de webhooks
   */
  async processBatch() {
    if (!this.isRunning) {
      return;
    }

    const startTime = Date.now();
    
    try {
      // 🔍 Verificar se há eventos pendentes ANTES de processar
      const hasEvents = await this.hasPendingEvents();
      
      if (!hasEvents) {
        console.log('⏸️ Nenhum evento pendente. Agendando com base em next_retry_at...');
        await this.scheduleNextBasedOnDB();
        return;
      }

      console.log('🔄 Executando lote de processamento de webhooks...');
      
      const result = await processWebhookBatch(this.batchSize);
      
      // Atualizar estatísticas
      this.stats.totalProcessed += result.processed;
      this.stats.totalDelivered += result.delivered;
      this.stats.totalFailed += result.failed;
      this.stats.totalRetried += result.retried;
      this.stats.lastRun = new Date();
      
      const processingTime = Date.now() - startTime;
      
      if (result.processed > 0) {
        console.log(`📊 Lote concluído: ${result.processed} processados | ${result.delivered} entregues | ${result.failed} falhas | ${result.retried} retries | ${processingTime}ms`);
      } else {
        console.log('⏸️ Nenhum evento processável encontrado. Agendando com base em next_retry_at...');
        await this.scheduleNextBasedOnDB();
        return;
      }
      
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Erro no processamento do lote:', error);
    }
    // Após processamento, verificar se há próximos retries agendados
    await this.scheduleNextBasedOnDB();
  }

  /**
   * ⏸️ Pausa temporariamente o worker
   */
  pauseTemporarily(durationMs) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log(`⏸️ Worker pausado por ${Math.round(durationMs / 1000)} segundos`);
    
    setTimeout(() => {
      if (this.isRunning) {
        console.log('▶️ Retomando worker...');
        this.intervalId = setInterval(() => {
          this.processBatch();
        }, this.intervalMs);
      }
    }, durationMs);
  }

  /**
   * 🧹 Executa limpeza de eventos antigos
   */
  async cleanup() {
    try {
      console.log('🧹 Executando limpeza de eventos antigos...');
      const removed = await cleanupOldEvents(7); // Remove eventos com mais de 7 dias
      
      if (removed > 0) {
        console.log(`🧹 Limpeza concluída: ${removed} eventos antigos removidos`);
      }
    } catch (error) {
      console.error('❌ Erro na limpeza:', error);
    }
  }

  /**
   * 📊 Retorna estatísticas do worker
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      config: {
        batchSize: this.batchSize,
        intervalMs: this.intervalMs,
        cleanupIntervalMs: this.cleanupIntervalMs
      }
    };
  }

  /**
   * 📊 Retorna estatísticas detalhadas do banco
   */
  async getDetailedStats() {
    try {
      const dbStats = await getWebhookStats();
      return {
        worker: this.getStats(),
        database: dbStats
      };
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas detalhadas:', error);
      return {
        worker: this.getStats(),
        database: { byStatus: [], recent: { total_events: 0, delivered: 0, failed: 0, pending: 0 } }
      };
    }
  }

  /**
   * ⚡ Força processamento imediato
   */
  async forceProcess() {
    console.log('⚡ Forçando processamento imediato...');
    await this.processBatch();
  }

  /**
   * 🔄 Força retry de eventos pendentes
   */
  async forceRetry() {
    try {
      console.log('🔄 Forçando retry de eventos pendentes...');
      const forced = await forceRetryPending(20);
      console.log(`🔄 ${forced} eventos agendados para retry imediato`);
      return forced;
    } catch (error) {
      console.error('❌ Erro ao forçar retry:', error);
      return 0;
    }
  }

  /**
   * 🔧 Atualiza configurações do worker
   */
  updateConfig(newConfig) {
    const oldConfig = {
      batchSize: this.batchSize,
      intervalMs: this.intervalMs,
      cleanupIntervalMs: this.cleanupIntervalMs
    };

    if (newConfig.batchSize) this.batchSize = newConfig.batchSize;
    if (newConfig.intervalMs) this.intervalMs = newConfig.intervalMs;
    if (newConfig.cleanupIntervalMs) this.cleanupIntervalMs = newConfig.cleanupIntervalMs;

    console.log('🔧 Configurações atualizadas:', {
      old: oldConfig,
      new: {
        batchSize: this.batchSize,
        intervalMs: this.intervalMs,
        cleanupIntervalMs: this.cleanupIntervalMs
      }
    });

    // Se o worker está rodando, reiniciar com novas configurações
    if (this.isRunning) {
      console.log('🔄 Reiniciando worker com novas configurações...');
      this.stop();
      setTimeout(() => this.start(), 1000);
    }
  }
}

// Instância singleton do worker
const webhookWorker = new WebhookWorker({
  batchSize: 10,        // Processa 10 webhooks por vez
  intervalMs: 30000,    // Executa a cada 30 segundos
  cleanupIntervalMs: 3600000 // Limpeza a cada 1 hora
});

module.exports = webhookWorker;
