const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const authOrApiKey = require("../../middlewares/authOrApiKey");
const MessageHandler = require("../../websocket/handlers/atendimento/messageHandler");
const webSocketManager = require("../../websocket");

/**
 * 📌 Criar mensagem em uma conversa
 */
router.post("/", authOrApiKey, async (req, res) => {
  try {
    const { conversation_id, sender_type, sender_id, message_type, content, media_url } = req.body;

    console.log('🟢 [MSG] POST /atendimento/mensagens - payload:', {
      conversation_id, sender_type, sender_id, message_type,
      hasContent: Boolean(content), hasMedia: Boolean(media_url)
    });

    if (!conversation_id || !sender_type || !message_type) {
      return res.status(400).json({ error: "Campos obrigatórios: conversation_id, sender_type, message_type." });
    }

    const [result] = await pool.query(
      `INSERT INTO mensagens (conversas_id, enviador_tipo, enviador_id, tipo_mensagem, conteudo, midia_url) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [conversation_id, sender_type, sender_id || null, message_type, content || null, media_url || null]
    );

    console.log('🟢 [MSG] Mensagem inserida com sucesso:', { insertId: result.insertId, affectedRows: result.affectedRows });

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
    console.log('📡 [WS] Notificado newMessage para conversa', conversation_id);

    // 🔔 Notificação in-app para mensagens recebidas do cliente
    try {
      if (String(sender_type).toLowerCase() !== 'usuario') {
        // Descobrir usuário responsável e empresa
        console.log('🔔 [NOTIF] Mensagem recebida do cliente. Buscando responsável/empresa...');
        const [convRows] = await pool.query(`
          SELECT c.usuario_responsavel_id AS assigned_user_id,
                 t.empresa_id AS empresa_id
            FROM conversas c
            JOIN times_atendimento_instancias twi ON c.times_atendimento_instancia_id = twi.id
            JOIN times_atendimento t ON twi.times_atendimento_id = t.id
           WHERE c.id = ?
        `, [conversation_id]);

        const assignedUserId = convRows?.[0]?.assigned_user_id || null;
        const empresaId = convRows?.[0]?.empresa_id || null;
        console.log('🔔 [NOTIF] Resolved destinatário:', { assignedUserId, empresaId });

        if (assignedUserId) {
          const title = 'Nova mensagem recebida';
          const body = content ? String(content).slice(0, 160) : (message_type || 'mensagem');
          const dataJson = JSON.stringify({ conversation_id, message_id: result.insertId, rota: `/atendimento/chat?conv=${conversation_id}` });

          console.log('🔔 [NOTIF] Inserindo em user_notifications...');
          const [ins] = await pool.query(`
            INSERT INTO user_notifications
              (user_id, empresa_id, module, type, title, body, data_json, entity_type, entity_id, created_by)
            VALUES
              (?, ?, 'atendimento', 'lead.message', ?, ?, ?, 'conversa', ?, NULL)
          `, [assignedUserId, empresaId, title, body, dataJson, conversation_id]);
          console.log('🔔 [NOTIF] Inserção concluída:', { insertId: ins?.insertId, affectedRows: ins?.affectedRows });

          // Emite em tempo real para o usuário (se conectado)
          try {
            console.log('📡 [WS] Emitindo notification:new para user', assignedUserId);
            webSocketManager.emitToUser(assignedUserId, 'notification:new', {
              module: 'atendimento',
              type: 'lead.message',
              title,
              body,
              created_at: new Date().toISOString()
            });
            console.log('📡 [WS] notification:new emitido');
          } catch {}
        }
      }
    } catch (notifyErr) {
      console.warn('⚠️ Falha ao registrar/emitter notificação de mensagem:', notifyErr?.message || notifyErr);
    }

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
      "SELECT * FROM mensagens WHERE conversas_id = ? ORDER BY criado_em ASC",
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
    const [messageRows] = await pool.query(`SELECT conversas_id FROM mensagens WHERE id = ?`, [req.params.id]);
    
    await pool.query("DELETE FROM mensagens WHERE id = ?", [req.params.id]);
    
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
    const [rows] = await pool.query(`SELECT * FROM mensagens WHERE id = ?`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Mensagem não encontrada." });
    }

    // Atualiza o campo lido para 1
    await pool.query(`UPDATE mensagens SET lido = 1 WHERE id = ?`, [id]);

    console.log(`✅ Mensagem ${id} marcada como lida.`);

    // Busca o conversation_id para notificar via WebSocket
    const [messageRows] = await pool.query(`SELECT conversas_id FROM mensagens WHERE id = ?`, [id]);
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
