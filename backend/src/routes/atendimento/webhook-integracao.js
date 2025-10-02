const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const authOrApiKey = require("../middlewares/authOrApiKey");


/**
 * 📋 GET /webhooks - Lista todos os webhooks da empresa do usuário
 */
router.get("/", authOrApiKey, async (req, res) => {
  try {
    const { company_id } = req.body;
    
    if (!company_id) {
      return res.status(400).json({ error: "company_id é obrigatório no body." });
    }
    
    // Retorna todos os webhooks da empresa especificada
    const [webhooks] = await pool.query(
      `SELECT id, nome, url, event_types, status, last_success_at, last_failure_at, failure_count, created_at, updated_at
       FROM webhooks 
       WHERE company_id = ?
       ORDER BY created_at DESC`,
      [company_id]
    );

    res.json({
      success: true,
      data: webhooks
    });
  } catch (error) {
    console.error("❌ Erro ao listar webhooks:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

/**
 * 📋 GET /webhooks/company - Lista webhooks da empresa do usuário
 */
router.get("/company", authOrApiKey, async (req, res) => {
  try {
    const { company_id } = req.body;
    
    if (!company_id) {
      return res.status(400).json({ error: "company_id é obrigatório no body." });
    }
    
    const [webhooks] = await pool.query(
      `SELECT id, nome, url, event_types, status, last_success_at, last_failure_at, failure_count, created_at, updated_at
       FROM webhooks 
       WHERE company_id = ? 
       ORDER BY created_at DESC`,
      [company_id]
    );

    res.json({
      success: true,
      data: webhooks
    });
  } catch (error) {
    console.error("❌ Erro ao listar webhooks da empresa:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

/**
 * 📋 POST /webhooks/company - Lista webhooks da empresa do usuário (com body)
 */
router.post("/company", authOrApiKey, async (req, res) => {
  try {
    const { company_id } = req.body;
    
    if (!company_id) {
      return res.status(400).json({ error: "company_id é obrigatório no body." });
    }
    
    const [webhooks] = await pool.query(
      `SELECT id, nome, url, event_types, status, last_success_at, last_failure_at, failure_count, created_at, updated_at
       FROM webhooks 
       WHERE company_id = ? 
       ORDER BY created_at DESC`,
      [company_id]
    );

    res.json({
      success: true,
      data: webhooks
    });
  } catch (error) {
    console.error("❌ Erro ao listar webhooks da empresa:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

/**
 * 📋 GET /webhooks/:id - Busca um webhook específico
 */
router.get("/:id", authOrApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id } = req.body;
    
    if (!company_id) {
      return res.status(400).json({ error: "company_id é obrigatório no body." });
    }

    const [webhooks] = await pool.query(
      `SELECT id, nome, url, event_types, status, last_success_at, last_failure_at, failure_count, created_at, updated_at
       FROM webhooks 
       WHERE id = ? AND company_id = ?`,
      [id, company_id]
    );

    if (webhooks.length === 0) {
      return res.status(404).json({ error: "Webhook não encontrado." });
    }

    res.json({
      success: true,
      data: webhooks[0]
    });
  } catch (error) {
    console.error("❌ Erro ao buscar webhook:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

/**
 * ➕ POST /webhooks - Cria um novo webhook
 */
router.post("/", authOrApiKey, async (req, res) => {
  try {
    const { nome, url, event_types, status = 'ativo', company_id } = req.body;
    
    if (!company_id) {
      return res.status(400).json({ error: "company_id é obrigatório no body." });
    }

    // Validações
    if (!nome || !url || !event_types) {
      return res.status(400).json({ 
        error: "Campos obrigatórios: nome, url, event_types, company_id" 
      });
    }

    if (!Array.isArray(event_types) || event_types.length === 0) {
      return res.status(400).json({ 
        error: "event_types deve ser um array não vazio" 
      });
    }

    // Validar URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: "URL inválida." });
    }

    // Validar status
    if (!['ativo', 'inativo'].includes(status)) {
      return res.status(400).json({ 
        error: "Status deve ser 'ativo' ou 'inativo'" 
      });
    }

    // Verificar se já existe webhook com mesmo nome na empresa
    const [existing] = await pool.query(
      `SELECT id FROM webhooks WHERE company_id = ? AND nome = ?`,
      [company_id, nome]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        error: "Já existe um webhook com este nome na empresa." 
      });
    }

    // Inserir webhook
    const [result] = await pool.query(
      `INSERT INTO webhooks (company_id, nome, url, event_types, status)
       VALUES (?, ?, ?, ?, ?)`,
      [company_id, nome, url, JSON.stringify(event_types), status]
    );

    // Buscar webhook criado
    const [newWebhook] = await pool.query(
      `SELECT id, nome, url, event_types, status, last_success_at, last_failure_at, failure_count, created_at, updated_at
       FROM webhooks WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: "Webhook criado com sucesso!",
      data: newWebhook[0]
    });
  } catch (error) {
    console.error("❌ Erro ao criar webhook:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

/**
 * ✏️ PUT /webhooks/:id - Atualiza um webhook
 */
router.put("/:id", authOrApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, url, event_types, status, company_id } = req.body;
    
    if (!company_id) {
      return res.status(400).json({ error: "company_id é obrigatório no body." });
    }

    // Verificar se webhook existe e pertence à empresa
    const [existing] = await pool.query(
      `SELECT id FROM webhooks WHERE id = ? AND company_id = ?`,
      [id, company_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Webhook não encontrado." });
    }

    // Validações condicionais (só valida se o campo foi enviado)
    if (url) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: "URL inválida." });
      }
    }

    if (event_types && (!Array.isArray(event_types) || event_types.length === 0)) {
      return res.status(400).json({ 
        error: "event_types deve ser um array não vazio" 
      });
    }

    if (status && !['ativo', 'inativo'].includes(status)) {
      return res.status(400).json({ 
        error: "Status deve ser 'ativo' ou 'inativo'" 
      });
    }

    // Verificar nome duplicado (se nome foi alterado)
    if (nome) {
      const [duplicate] = await pool.query(
        `SELECT id FROM webhooks WHERE company_id = ? AND nome = ? AND id != ?`,
        [company_id, nome, id]
      );

      if (duplicate.length > 0) {
        return res.status(400).json({ 
          error: "Já existe um webhook com este nome na empresa." 
        });
      }
    }

    // Montar query de atualização dinamicamente
    const updates = [];
    const values = [];

    if (nome !== undefined) {
      updates.push("nome = ?");
      values.push(nome);
    }
    if (url !== undefined) {
      updates.push("url = ?");
      values.push(url);
    }
    if (event_types !== undefined) {
      updates.push("event_types = ?");
      values.push(JSON.stringify(event_types));
    }
    if (status !== undefined) {
      updates.push("status = ?");
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar." });
    }

    values.push(id, company_id);

    await pool.query(
      `UPDATE webhooks SET ${updates.join(", ")} WHERE id = ? AND company_id = ?`,
      values
    );

    // Buscar webhook atualizado
    const [updatedWebhook] = await pool.query(
      `SELECT id, nome, url, event_types, status, last_success_at, last_failure_at, failure_count, created_at, updated_at
       FROM webhooks WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: "Webhook atualizado com sucesso!",
      data: updatedWebhook[0]
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar webhook:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

/**
 * 🗑️ DELETE /webhooks/:id - Deleta um webhook
 */
router.delete("/:id", authOrApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id } = req.body;
    
    if (!company_id) {
      return res.status(400).json({ error: "company_id é obrigatório no body." });
    }

    // Verificar se webhook existe e pertence à empresa
    const [existing] = await pool.query(
      `SELECT id FROM webhooks WHERE id = ? AND company_id = ?`,
      [id, company_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Webhook não encontrado." });
    }

    // Deletar webhook
    await pool.query(
      `DELETE FROM webhooks WHERE id = ? AND company_id = ?`,
      [id, company_id]
    );

    res.json({
      success: true,
      message: "Webhook deletado com sucesso!"
    });
  } catch (error) {
    console.error("❌ Erro ao deletar webhook:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

/**
 * 🔄 PATCH /webhooks/:id/status - Alterna status do webhook (ativo/inativo)
 */
router.patch("/:id/status", authOrApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id } = req.body;
    
    if (!company_id) {
      return res.status(400).json({ error: "company_id é obrigatório no body." });
    }

    // Buscar webhook atual
    const [webhooks] = await pool.query(
      `SELECT id, status FROM webhooks WHERE id = ? AND company_id = ?`,
      [id, company_id]
    );

    if (webhooks.length === 0) {
      return res.status(404).json({ error: "Webhook não encontrado." });
    }

    const currentStatus = webhooks[0].status;
    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';

    // Atualizar status
    await pool.query(
      `UPDATE webhooks SET status = ? WHERE id = ? AND company_id = ?`,
      [newStatus, id, company_id]
    );

    res.json({
      success: true,
      message: `Webhook ${newStatus === 'ativo' ? 'ativado' : 'desativado'} com sucesso!`,
      data: {
        id: parseInt(id),
        status: newStatus
      }
    });
  } catch (error) {
    console.error("❌ Erro ao alternar status do webhook:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

module.exports = router;
