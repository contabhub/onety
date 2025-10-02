const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const authOrApiKey = require("../middlewares/authOrApiKey");

/**
 * 📌 Transferir conversa para outro usuário conversation-transfers/:conversation_id/transfer
 */
router.put("/:conversation_id/transfer", authOrApiKey, async (req, res) => {
  try {
    const { new_assigned_user_id } = req.body;
    const conversationId = req.params.conversation_id;
    const currentUserId = req.user.id; // quem está logado (vem do JWT)

    if (!new_assigned_user_id) {
      return res.status(400).json({ error: "É necessário informar o novo usuário responsável." });
    }

    // 🔍 Verificar se a conversa existe
    const [convRows] = await pool.query("SELECT assigned_user_id FROM conversations WHERE id = ?", [conversationId]);
    if (convRows.length === 0) {
      return res.status(404).json({ error: "Conversa não encontrada." });
    }

    const oldUserId = convRows[0].assigned_user_id;

    // 🔄 Atualizar assigned_user_id na tabela conversations
    await pool.query(
      "UPDATE conversations SET assigned_user_id = ?, updated_at = NOW() WHERE id = ?",
      [new_assigned_user_id, conversationId]
    );

    // 📝 Registrar histórico de transferência
    await pool.query(
      `INSERT INTO conversation_transfers (conversation_id, from_user_id, to_user_id, transferred_by) VALUES (?, ?, ?, ?)`,
      [conversationId, oldUserId, new_assigned_user_id, currentUserId]
    );

    res.json({
      success: true,
      message: "Conversa transferida com sucesso.",
      from_user_id: oldUserId,
      to_user_id: new_assigned_user_id
    });
  } catch (err) {
    console.error("Erro ao transferir conversa:", err);
    res.status(500).json({ error: "Erro ao transferir conversa." });
  }
});

/**
 * 📌 Listar histórico de transferências de uma conversa
 */
router.get("/:conversation_id/history", authOrApiKey, async (req, res) => {
  try {
    const conversationId = req.params.conversation_id;

    const [rows] = await pool.query(
        `SELECT 
           ct.id,
           ct.conversation_id,
           ct.from_user_id,
           u1.nome AS from_user_name,
           ct.to_user_id,
           u2.nome AS to_user_name,
           ct.transferred_by,
           u3.nome AS transferred_by_name,
           ct.transferred_at
         FROM conversation_transfers ct
         LEFT JOIN users u1 ON ct.from_user_id = u1.id
         LEFT JOIN users u2 ON ct.to_user_id = u2.id
         LEFT JOIN users u3 ON ct.transferred_by = u3.id
         WHERE ct.conversation_id = ?
         ORDER BY ct.transferred_at ASC`,
        [conversationId]
      );
      

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar histórico de transferências:", err);
    res.status(500).json({ error: "Erro ao buscar histórico de transferências." });
  }
});

module.exports = router;
