const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const authOrApiKey = require("../../middlewares/authOrApiKey");

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
    const [convRows] = await pool.query("SELECT usuario_responsavel_id FROM conversas WHERE id = ?", [conversationId]);
    if (convRows.length === 0) {
      return res.status(404).json({ error: "Conversa não encontrada." });
    }

    const oldUserId = convRows[0].usuario_responsavel_id;

    // 🔄 Atualizar usuario_responsavel_id na tabela conversas
    await pool.query(
      "UPDATE conversas SET usuario_responsavel_id = ?, atualizado_em = NOW() WHERE id = ?",
      [new_assigned_user_id, conversationId]
    );

    // 📝 Registrar histórico de transferência
    await pool.query(
      `INSERT INTO conversas_transferencias (conversas_id, de_usuario_id, para_usuario_id, transferido_por) VALUES (?, ?, ?, ?)`,
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
           ct.conversas_id AS conversation_id,
           ct.de_usuario_id AS from_user_id,
           u1.nome AS from_user_name,
           ct.para_usuario_id AS to_user_id,
           u2.nome AS to_user_name,
           ct.transferido_por AS transferred_by,
           u3.nome AS transferred_by_name,
           ct.criado_em AS transferred_at
         FROM conversas_transferencias ct
         LEFT JOIN usuarios u1 ON ct.de_usuario_id = u1.id
         LEFT JOIN usuarios u2 ON ct.para_usuario_id = u2.id
         LEFT JOIN usuarios u3 ON ct.transferido_por = u3.id
         WHERE ct.conversas_id = ?
         ORDER BY ct.criado_em ASC`,
        [conversationId]
      );
      

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar histórico de transferências:", err);
    res.status(500).json({ error: "Erro ao buscar histórico de transferências." });
  }
});

module.exports = router;
