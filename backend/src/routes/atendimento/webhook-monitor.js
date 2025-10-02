const express = require("express");
const router = express.Router();
const webhookWorker = require("../workers/webhookWorker");
const authMiddleware = require("../middlewares/auth");

// Aplicar middleware de autenticação em todas as rotas
router.use(authMiddleware);

/**
 * 📊 GET /webhook-monitor/stats - Estatísticas do worker
 */
router.get("/stats", async (req, res) => {
  try {
    const stats = await webhookWorker.getDetailedStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("❌ Erro ao buscar estatísticas:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

/**
 * 🔄 POST /webhook-monitor/force-process - Força processamento imediato
 */
router.post("/force-process", async (req, res) => {
  try {
    await webhookWorker.forceProcess();
    
    res.json({
      success: true,
      message: "Processamento forçado executado com sucesso!"
    });
  } catch (error) {
    console.error("❌ Erro ao forçar processamento:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

/**
 * 🔄 POST /webhook-monitor/force-retry - Força retry de eventos pendentes
 */
router.post("/force-retry", async (req, res) => {
  try {
    const forced = await webhookWorker.forceRetry();
    
    res.json({
      success: true,
      message: `${forced} eventos agendados para retry imediato!`
    });
  } catch (error) {
    console.error("❌ Erro ao forçar retry:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

/**
 * 🔧 PUT /webhook-monitor/config - Atualiza configurações do worker
 */
router.put("/config", async (req, res) => {
  try {
    const { batchSize, intervalMs, cleanupIntervalMs } = req.body;
    
    // Validações
    if (batchSize && (batchSize < 1 || batchSize > 100)) {
      return res.status(400).json({ 
        error: "batchSize deve estar entre 1 e 100" 
      });
    }
    
    if (intervalMs && (intervalMs < 5000 || intervalMs > 300000)) {
      return res.status(400).json({ 
        error: "intervalMs deve estar entre 5000 e 300000 (5s a 5min)" 
      });
    }
    
    if (cleanupIntervalMs && (cleanupIntervalMs < 300000 || cleanupIntervalMs > 86400000)) {
      return res.status(400).json({ 
        error: "cleanupIntervalMs deve estar entre 300000 e 86400000 (5min a 24h)" 
      });
    }
    
    const newConfig = {};
    if (batchSize !== undefined) newConfig.batchSize = batchSize;
    if (intervalMs !== undefined) newConfig.intervalMs = intervalMs;
    if (cleanupIntervalMs !== undefined) newConfig.cleanupIntervalMs = cleanupIntervalMs;
    
    webhookWorker.updateConfig(newConfig);
    
    res.json({
      success: true,
      message: "Configurações atualizadas com sucesso!",
      data: webhookWorker.getStats().config
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar configurações:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

/**
 * 🛑 POST /webhook-monitor/stop - Para o worker
 */
router.post("/stop", async (req, res) => {
  try {
    webhookWorker.stop();
    
    res.json({
      success: true,
      message: "WebhookWorker parado com sucesso!"
    });
  } catch (error) {
    console.error("❌ Erro ao parar worker:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

/**
 * 🚀 POST /webhook-monitor/start - Inicia o worker
 */
router.post("/start", async (req, res) => {
  try {
    webhookWorker.start();
    
    res.json({
      success: true,
      message: "WebhookWorker iniciado com sucesso!"
    });
  } catch (error) {
    console.error("❌ Erro ao iniciar worker:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

/**
 * 🔄 POST /webhook-monitor/restart - Reinicia o worker
 */
router.post("/restart", async (req, res) => {
  try {
    webhookWorker.stop();
    setTimeout(() => {
      webhookWorker.start();
    }, 1000);
    
    res.json({
      success: true,
      message: "WebhookWorker reiniciado com sucesso!"
    });
  } catch (error) {
    console.error("❌ Erro ao reiniciar worker:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

module.exports = router;
