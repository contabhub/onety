const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const authOrApiKey = require("../middlewares/authOrApiKey");
const MessageHandler = require("../websocket/handlers/messageHandler");

/**
 * 📌 Criar mensagem em uma conversa
 */
router.post("/", authOrApiKey, async (req, res) => {
  try {
    const { conversation_id, sender_type, sender_id, message_type, content, media_url } = req.body;

    if (!conversation_id || !sender_type || !message_type) {
      return res.status(400).json({ error: "Campos obrigatórios: conversation_id, sender_type, message_type." });
    }

    const [result] = await pool.query(
      `INSERT INTO messages (conversation_id, sender_type, sender_id, message_type, content, media_url) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [conversation_id, sender_type, sender_id || null, message_type, content || null, media_url || null]
    );

    const messageData = { 
      id: result.insertId, 
      conversation_id, 
      sender_type, 
      sender_id, 
      message_type, 
      content, 
      media_url 
    };

    // Notifica via WebSocket
    MessageHandler.notifyNewMessage(messageData);

    res.status(201).json(messageData);
  } catch (err) {
    console.error("Erro ao criar mensagem:", err);
    res.status(500).json({ error: "Erro ao criar mensagem." });
  }
});

/**
 * 📌 Listar mensagens de uma conversa messages/conversation/:conversation_id
 */
router.get("/conversation/:conversation_id", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
      [req.params.conversation_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar mensagens." });
  }
});

/**
 * 📌 Deletar mensagem
 */
router.delete("/:id", authOrApiKey, async (req, res) => {
  try {
    // Busca o conversation_id antes de deletar
    const [messageRows] = await pool.query(`SELECT conversation_id FROM messages WHERE id = ?`, [req.params.id]);
    
    await pool.query("DELETE FROM messages WHERE id = ?", [req.params.id]);
    
    // Notifica via WebSocket se encontrou a mensagem
    if (messageRows.length > 0) {
      MessageHandler.notifyMessageDeleted(req.params.id, messageRows[0].conversation_id);
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar mensagem." });
  }
});


/**
 * 📌 PATCH /messages/:id/read - Marca uma mensagem como lida
 */
router.patch("/:id/read", authOrApiKey, async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se a mensagem existe
    const [rows] = await pool.query(`SELECT * FROM messages WHERE id = ?`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Mensagem não encontrada." });
    }

    // Atualiza o campo read para 1
    await pool.query(`UPDATE messages SET \`read\` = 1 WHERE id = ?`, [id]);

    console.log(`✅ Mensagem ${id} marcada como lida.`);

    // Busca o conversation_id para notificar via WebSocket
    const [messageRows] = await pool.query(`SELECT conversation_id FROM messages WHERE id = ?`, [id]);
    if (messageRows.length > 0) {
      MessageHandler.notifyMessageRead(id, messageRows[0].conversation_id, req.user.id);
    }

    res.json({ success: true, message_id: id, status: "lida" });
  } catch (err) {
    console.error("🚨 Erro ao marcar mensagem como lida:", err);
    res.status(500).json({ error: "Erro ao marcar mensagem como lida." });
  }
});


module.exports = router;
