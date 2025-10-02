const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const authOrApiKey = require("../middlewares/authOrApiKey");
const ConversationHandler = require("../websocket/handlers/conversationHandler");
const MessageHandler = require("../websocket/handlers/messageHandler");
const { resolveOrCreateContact, getCompanyIdFromTeamInstance } = require("../utils/contactHelper");


/**
 * 📌 Criar uma nova conversa
 */
router.post("/", authOrApiKey, async (req, res) => {
  try {
    const { team_whatsapp_instance_id, customer_name, customer_phone, assigned_user_id } = req.body;

    if (!team_whatsapp_instance_id || !customer_phone) {
      return res.status(400).json({ error: "Campos obrigatórios: team_whatsapp_instance_id e customer_phone." });
    }

    // 🔍 Busca o company_id e resolve/cria contato
    let contactId = null;
    const companyId = await getCompanyIdFromTeamInstance(team_whatsapp_instance_id);
    
    if (companyId && customer_phone) {
      try {
        const contact = await resolveOrCreateContact({
          phone: customer_phone,
          companyId: companyId,
          customerName: customer_name
        });
        contactId = contact.id;
        console.log(`📇 Contato resolvido/criado na criação manual: ID ${contactId} - ${contact.nome}`);
      } catch (error) {
        console.error("⚠️ Erro ao resolver contato na criação manual, continuando sem contact_id:", error);
      }
    }

    const [result] = await pool.query(
      `INSERT INTO conversations (team_whatsapp_instance_id, customer_name, customer_phone, assigned_user_id, contact_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [team_whatsapp_instance_id, customer_name || null, customer_phone, assigned_user_id || null, contactId]
    );

    // Busca o company_id para notificar via WebSocket
    const [instanceRows] = await pool.query(`
      SELECT t.company_id 
      FROM team_whatsapp_instances twi 
      JOIN teams t ON twi.team_id = t.id
      WHERE twi.id = ?
    `, [team_whatsapp_instance_id]);

    const conversationData = { 
      id: result.insertId, 
      team_whatsapp_instance_id, 
      customer_name, 
      customer_phone, 
      assigned_user_id, 
      status: 'aberta',
      company_id: instanceRows[0]?.company_id
    };

    // Notifica via WebSocket
    if (conversationData.company_id) {
      ConversationHandler.notifyNewConversation(conversationData);
    }

    res.status(201).json(conversationData);
  } catch (err) {
    console.error("Erro ao criar conversa:", err);
    res.status(500).json({ error: "Erro ao criar conversa." });
  }
});

/**
 * 📌 Listar todas as conversas
 */
router.get("/", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM conversations");
    res.json(rows);
  } catch (err) {   
    res.status(500).json({ error: "Erro ao buscar conversas." });
  }
});

/**
 * 📌 Buscar conversa por ID
 */
router.get("/:id", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.*,
        t.nome AS team_name,
        t.padrao AS team_is_default,
        t.id AS team_id
      FROM conversations c
      JOIN team_whatsapp_instances twi ON c.team_whatsapp_instance_id = twi.id
      JOIN teams t ON twi.team_id = t.id
      WHERE c.id = ?
    `, [req.params.id]);
    
    if (rows.length === 0) return res.status(404).json({ error: "Conversa não encontrada." });
    
    const conversation = rows[0];
    res.json({
      id: conversation.id,
      team_whatsapp_instance_id: conversation.team_whatsapp_instance_id,
      customer_name: conversation.customer_name,
      customer_phone: conversation.customer_phone,
      contact_id: conversation.contact_id,
      status: conversation.status,
      assigned_user_id: conversation.assigned_user_id,
      avatar_url: conversation.avatar_url,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
      team: {
        id: conversation.team_id,
        nome: conversation.team_name,
        padrao: Boolean(conversation.team_is_default)
      }
    });
  } catch (err) {
    console.error("Erro ao buscar conversa:", err);
    res.status(500).json({ error: "Erro ao buscar conversa." });
  }
});

/**
 * 📌 Atualizar status ou dados da conversa
 */
router.put("/:id", authOrApiKey, async (req, res) => {
  try {
    const { status, assigned_user_id } = req.body;

    await pool.query(
      "UPDATE conversations SET status = ?, assigned_user_id = ?, updated_at = NOW() WHERE id = ?",
      [status || 'aberta', assigned_user_id || null, req.params.id]
    );

    res.json({ id: req.params.id, status, assigned_user_id });
  } catch (err) {
    console.error("Erro ao atualizar conversa:", err);
    res.status(500).json({ error: "Erro ao atualizar conversa." });
  }
});

/**
 * 📌 Deletar conversa
 */
router.delete("/:id", authOrApiKey, async (req, res) => {
  try {
    await pool.query("DELETE FROM conversations WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar conversa." });
  }
});

/**
 * 📌 GET /conversations/company/:companyId - Listar todas as conversas de uma empresa
 */
router.get("/company/:companyId", authOrApiKey, async (req, res) => {
  try {
    const { companyId } = req.params;

    // 🔍 Busca todas as conversas ligadas a times da empresa via team_whatsapp_instances
    const [rows] = await pool.query(`
      SELECT 
        c.id,
        c.customer_name,
        c.customer_phone,
        c.status,
        c.assigned_user_id,
        c.contact_id,
        u.nome AS assigned_user_name,
        cont.nome AS contact_name,
        cont.email AS contact_email,
        c.created_at,
        c.updated_at,
        t.nome AS team_name,
        wi.instance_name AS whatsapp_instance_name
      FROM conversations c
      JOIN team_whatsapp_instances twi ON c.team_whatsapp_instance_id = twi.id
      JOIN teams t ON twi.team_id = t.id
      JOIN whatsapp_instances wi ON twi.whatsapp_instance_id = wi.id
      LEFT JOIN users u ON c.assigned_user_id = u.id
      LEFT JOIN contacts cont ON c.contact_id = cont.id
      WHERE t.company_id = ?
      ORDER BY c.created_at DESC
    `, [companyId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Nenhuma conversa encontrada para esta empresa." });
    }

    res.json({
      company_id: companyId,
      total_conversations: rows.length,
      conversations: rows
    });
  } catch (err) {
    console.error("Erro ao buscar conversas da empresa:", err);
    res.status(500).json({ error: "Erro ao buscar conversas da empresa." });
  }
});

/**
 * 📌 GET /conversations/company/:companyId/user/:userId
 * 🔍 Listar conversas atribuídas ao usuário OU ainda não atribuídas dentro da empresa
 * 🔍 Inclui a última mensagem (content, created_at, read)
 */
router.get("/company/:companyId/user/:userId", authOrApiKey, async (req, res) => {
  try {
    const { companyId, userId } = req.params;

    // 🔐 Verifica se o usuário pertence à empresa
    const [vinculo] = await pool.query(
      `SELECT * FROM user_company WHERE user_id = ? AND company_id = ?`,
      [userId, companyId]
    );

    if (vinculo.length === 0) {
      return res.status(403).json({ error: "Usuário não pertence a esta empresa." });
    }

    // 🔍 Buscar conversas da empresa atribuídas ao usuário OU sem assigned_user_id
    const [rows] = await pool.query(`
      SELECT 
        c.id AS conversation_id,
        c.customer_name,
        c.customer_phone,
        c.avatar_url,
        c.status,
        c.assigned_user_id,
        c.contact_id,
        u.nome AS assigned_user_name,
        cont.nome AS contact_name,
        cont.email AS contact_email,
        c.created_at,
        c.updated_at,
        t.nome AS team_name,
        wi.instance_name AS whatsapp_instance_name,
        wi.instance_id AS zapi_instance_id,
        wi.token AS zapi_token,
        
        -- Última mensagem
        m.content AS last_message_content,
        m.created_at AS last_message_time,
        m.read AS last_message_read,
        m.sender_type AS last_message_sender

      FROM conversations c
      JOIN team_whatsapp_instances twi ON c.team_whatsapp_instance_id = twi.id
      JOIN teams t ON twi.team_id = t.id
      JOIN whatsapp_instances wi ON twi.whatsapp_instance_id = wi.id
      LEFT JOIN users u ON c.assigned_user_id = u.id
      LEFT JOIN contacts cont ON c.contact_id = cont.id
      LEFT JOIN messages m ON m.id = (
        SELECT id FROM messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      )
      WHERE t.company_id = ?
        AND (c.assigned_user_id = ? OR c.assigned_user_id IS NULL)
      ORDER BY c.updated_at DESC
    `, [companyId, userId]);

    res.json({
      company_id: companyId,
      user_id: userId,
      total_conversations: rows.length,
      conversations: rows
    });

  } catch (err) {
    console.error("Erro ao buscar conversas atribuídas ao usuário:", err);
    res.status(500).json({ error: "Erro ao buscar conversas atribuídas." });
  }
});


/**
 * 📌 PUT /conversations/:conversationId/assume/:userId
 * 🔐 Permite que um usuário assuma uma conversa ainda não atribuída
 */
router.put("/:conversationId/assume/:userId", authOrApiKey, async (req, res) => {
  try {
    const { conversationId, userId } = req.params;

    // Verifica se a conversa existe e ainda não tem assigned_user_id
    const [rows] = await pool.query(
      `SELECT * FROM conversations WHERE id = ? AND assigned_user_id IS NULL`,
      [conversationId]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: "Conversa já atribuída ou inexistente." });
    }

    // Atribui a conversa ao usuário
    await pool.query(
      `UPDATE conversations SET assigned_user_id = ?, updated_at = NOW() WHERE id = ?`,
      [userId, conversationId]
    );

    console.log(`✅ Usuário ${userId} assumiu a conversa ${conversationId}`);

    res.json({ success: true, message: "Conversa assumida com sucesso." });
  } catch (err) {
    console.error("🚨 Erro ao assumir conversa:", err);
    res.status(500).json({ error: "Erro ao assumir conversa." });
  }
});


/**
 * 📌 PATCH /conversations/:id/finalize
 * 🔐 Finaliza uma conversa (altera o status para "finalizada")
 */
router.patch("/:id/finalize", authOrApiKey, async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se a conversa existe
    const [rows] = await pool.query(`SELECT * FROM conversations WHERE id = ?`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Conversa não encontrada." });
    }

    // Atualiza o status para "finalizada"
    await pool.query(
      `UPDATE conversations SET status = 'fechada', updated_at = NOW() WHERE id = ?`,
      [id]
    );

    console.log(`✅ Conversa ${id} finalizada com sucesso.`);

    res.json({ success: true, message: "Conversa fechada com sucesso." });
  } catch (err) {
    console.error("🚨 Erro ao finalizar conversa:", err);
    res.status(500).json({ error: "Erro ao finalizar conversa." });
  }
});


/**
 * 📌 PATCH /conversations/:id/transfer/team
 * 🔐 Transfere uma conversa para uma equipe (remove assigned_user_id)
 */
router.patch("/:id/transfer/team", authOrApiKey, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { team_id, assign_user_id } = req.body;
    if (!team_id) return res.status(400).json({ error: "team_id é obrigatório." });

    await conn.beginTransaction();

    // 1) conversa atual
    const [convRows] = await conn.query(
      "SELECT id, team_whatsapp_instance_id FROM conversations WHERE id = ? FOR UPDATE",
      [id]
    );
    if (convRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Conversa não encontrada." });
    }

    // 2) time destino
    const [teamRows] = await conn.query("SELECT id, company_id, nome FROM teams WHERE id = ?", [team_id]);
    if (teamRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Equipe não encontrada." });
    }

    // 3) resolver TWI do time destino (se houver mais de um, pode exigir explicitamente no body)
    const [twiRows] = await conn.query(
      "SELECT id FROM team_whatsapp_instances WHERE team_id = ? LIMIT 1",
      [team_id]
    );
    if (twiRows.length === 0) {
      await conn.rollback();
      return res.status(422).json({ error: "Time sem instância WhatsApp vinculada." });
    }
    const twiTo = twiRows[0].id;

    // 4) aplicar transferência: muda o dono (TWI) e reatribui (ou zera) o agente
    await conn.query(
      `UPDATE conversations
         SET team_whatsapp_instance_id = ?, 
             assigned_user_id = ?,
             updated_at = NOW()
       WHERE id = ?`,
      [twiTo, assign_user_id || null, id]
    );

    await conn.commit();

    try {
      // Notificar frontend sobre atualização da conversa (muda equipe e possível responsável)
      const companyId = teamRows[0].company_id;
      const updates = {
        team_whatsapp_instance_id: twiTo,
        assigned_user_id: assign_user_id || null,
        team_name: teamRows[0]?.nome || null,
      };
      ConversationHandler.notifyConversationUpdated(Number(id), updates, companyId);
    } catch (e) {
      console.warn("WS notifyConversationUpdated falhou (opcional):", e?.message || e);
    }

    res.json({ success: true, message: "Conversa transferida para a equipe com sucesso." });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error("Erro ao transferir conversa para equipe:", err);
    res.status(500).json({ error: "Erro ao transferir conversa para equipe." });
  } finally {
    conn.release();
  }
});



/**
 * 📌 PATCH /conversations/:id/transfer/user
 * 🔐 Transfere uma conversa para um usuário específico (altera assigned_user_id)
 */
router.patch("/:id/transfer/user", authOrApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const { assigned_user_id } = req.body;

    if (!assigned_user_id) {
      return res.status(400).json({ error: "assigned_user_id é obrigatório." });
    }

    // Verifica se a conversa existe
    const [conversation] = await pool.query(`SELECT * FROM conversations WHERE id = ?`, [id]);
    if (conversation.length === 0) {
      return res.status(404).json({ error: "Conversa não encontrada." });
    }

    // Verifica se o usuário existe
    const [user] = await pool.query(`SELECT id, nome, apelido FROM users WHERE id = ?`, [assigned_user_id]);
    if (user.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // Atualiza o assigned_user_id
    await pool.query(
      `UPDATE conversations SET assigned_user_id = ?, updated_at = NOW() WHERE id = ?`,
      [assigned_user_id, id]
    );

    console.log(`✅ Conversa ${id} transferida para usuário ${assigned_user_id}`);

    res.json({ 
      success: true, 
      message: "Conversa transferida para o usuário com sucesso.",
      assigned_user_name: user[0].nome || user[0].apelido
    });
  } catch (err) {
    console.error("🚨 Erro ao transferir conversa para usuário:", err);
    res.status(500).json({ error: "Erro ao transferir conversa para usuário." });
  }
});


/**
 * 📌 Listar mensagens de uma conversa messages/conversation/:conversation_id
 */
router.get("/:id/messages", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT 
        m.*,
        c.assigned_user_id,
        u.nome AS assigned_user_name,
        c.status AS conversation_status,
        sender_user.nome AS sender_user_name,
        sender_user.apelido AS sender_user_nickname
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      LEFT JOIN users u ON c.assigned_user_id = u.id
      LEFT JOIN users sender_user ON m.sender_id = sender_user.id AND m.sender_type = 'user'
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
      `,
      [req.params.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("🚨 Erro ao buscar mensagens:", err);
    res.status(500).json({ error: "Erro ao buscar mensagens." });
  }
});


/**
 * 📌 GET /conversations/team/:teamId/conversations
 * 🔍 Listar todas as conversas associadas às instâncias de um time específico
 * 🔍 Inclui informações da instância WhatsApp e última mensagem
 * 🔍 Inclui também o assigned_user_id e o nome do usuário responsável
 */
router.get("/team/:teamId/conversations", authOrApiKey, async (req, res) => {
  try {
    const { teamId } = req.params;

    const [rows] = await pool.query(`
      SELECT 
        c.id AS conversation_id,
        c.customer_name,
        c.customer_phone,
        c.avatar_url,
        c.status,
        c.assigned_user_id,
        c.contact_id,
        u.nome AS assigned_user_name,   -- nome do usuário responsável
        cont.nome AS contact_name,
        cont.email AS contact_email,
        c.created_at,
        c.updated_at,

    -- 🔔 Quantidade de mensagens não lidas (apenas do cliente)
    COALESCE((
      SELECT COUNT(*) FROM messages
       WHERE conversation_id = c.id
         AND sender_type = 'customer'
         AND \`read\` = 0
    ), 0) AS unread_count,
        
        -- Informações da instância WhatsApp
        wi.instance_name AS instance_name,
        wi.phone_number,
        wi.instance_id AS instance_id,
        wi.token AS token,
        wi.client_token,
        wi.status AS whatsapp_status,
        
    -- Última mensagem
    m.content AS last_message_content,
    m.created_at AS last_message_time,
    m.\`read\` AS last_message_read,
    m.sender_type AS last_message_sender

      FROM conversations c
      JOIN team_whatsapp_instances twi ON c.team_whatsapp_instance_id = twi.id
      JOIN whatsapp_instances wi ON twi.whatsapp_instance_id = wi.id
      LEFT JOIN users u ON c.assigned_user_id = u.id
      LEFT JOIN contacts cont ON c.contact_id = cont.id
      LEFT JOIN messages m ON m.id = (
        SELECT id FROM messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      )
      WHERE twi.team_id = ?
      ORDER BY c.updated_at DESC
    `, [teamId]);

    if (rows.length === 0) {
      return res.status(404).json({ 
        message: "Nenhuma conversa encontrada para este time.",
        team_id: teamId
      });
    }

    res.json({
      team_id: teamId,
      total_conversations: rows.length,
      conversations: rows
    });

  } catch (err) {
    console.error("🚨 Erro ao buscar conversas do time:", err);
    res.status(500).json({ error: "Erro ao buscar conversas do time." });
  }
});

/**
 * 📌 GET /conversations/company/:companyId/all
 * 🔍 Listar todas as conversas da empresa (apenas para administradores)
 * 🔍 Inclui informações da instância WhatsApp e última mensagem
 * 🔍 Inclui também o assigned_user_id e o nome do usuário responsável
 */
router.get("/company/:companyId/all", authOrApiKey, async (req, res) => {
  try {
    const { companyId } = req.params;

    const [rows] = await pool.query(`
      SELECT 
        c.id AS conversation_id,
        c.customer_name,
        c.customer_phone,
        c.avatar_url,
        c.status,
        c.assigned_user_id,
        c.contact_id,
        u.nome AS assigned_user_name,   -- nome do usuário responsável
        cont.nome AS contact_name,
        cont.email AS contact_email,
        c.created_at,
        c.updated_at,

    -- 🔔 Quantidade de mensagens não lidas (apenas do cliente)
    COALESCE((
      SELECT COUNT(*) FROM messages
       WHERE conversation_id = c.id
         AND sender_type = 'customer'
         AND \`read\` = 0
    ), 0) AS unread_count,
        
        -- Informações da instância WhatsApp
        wi.instance_name AS instance_name,
        wi.phone_number,
        wi.instance_id AS instance_id,
        wi.token AS token,
        wi.client_token,
        wi.status AS whatsapp_status,
        
        -- Informações do time
        t.nome AS team_name,
        t.id AS team_id,
        
    -- Última mensagem
    m.content AS last_message_content,
    m.created_at AS last_message_time,
    m.\`read\` AS last_message_read,
    m.sender_type AS last_message_sender

      FROM conversations c
      JOIN team_whatsapp_instances twi ON c.team_whatsapp_instance_id = twi.id
      JOIN whatsapp_instances wi ON twi.whatsapp_instance_id = wi.id
      JOIN teams t ON twi.team_id = t.id
      LEFT JOIN users u ON c.assigned_user_id = u.id
      LEFT JOIN contacts cont ON c.contact_id = cont.id
      LEFT JOIN messages m ON m.id = (
        SELECT id FROM messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      )
      WHERE t.company_id = ?
      ORDER BY c.updated_at DESC
    `, [companyId]);

    res.json({
      company_id: companyId,
      total_conversations: rows.length,
      conversations: rows
    });

  } catch (err) {
    console.error("🚨 Erro ao buscar todas as conversas da empresa:", err);
    res.status(500).json({ error: "Erro ao buscar conversas da empresa." });
  }
});

/**
 * 📌 PATCH /conversations/:id/read-all
 * 🔕 Marca como lidas as mensagens não lidas de uma conversa
 * body opcional: { onlyCustomer: true|false }  (default true)
 */
router.patch("/:id/read-all", authOrApiKey, async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const onlyCustomer = req.body?.onlyCustomer ?? true;

    // 1) Atualiza mensagens
    const sql = onlyCustomer
      ? `UPDATE messages
           SET \`read\` = 1
         WHERE conversation_id = ?
           AND \`read\` = 0
           AND sender_type = 'customer'`
      : `UPDATE messages
           SET \`read\` = 1
         WHERE conversation_id = ?
           AND \`read\` = 0`;

    const [upd] = await pool.query(sql, [conversationId]);

    // 2) Atualiza updated_at da conversa
    await pool.query(
      `UPDATE conversations SET updated_at = NOW() WHERE id = ?`,
      [conversationId]
    );

    // 3) Recalcula o unread_count para responder e (opcional) emitir WS
    const [[{ unread_count }]] = await pool.query(
      `SELECT COUNT(*) AS unread_count
         FROM messages
        WHERE conversation_id = ?
          AND sender_type = 'customer'
          AND \`read\` = 0`,
      [conversationId]
    );

    // 4) (opcional) Notificar front para atualizar badge/estado
    try {
      MessageHandler?.notifyMessagesRead?.({
        conversation_id: conversationId,
        conversationId: conversationId,
        affected: upd.affectedRows || 0,
        unread_count,
        read_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn("WS notifyMessagesRead falhou (opcional):", e?.message || e);
    }

    res.json({
      success: true,
      conversation_id: conversationId,
      only_customer: !!onlyCustomer,
      updated: upd.affectedRows || 0,
      unread_count
    });
  } catch (err) {
    console.error("🚨 Erro ao marcar mensagens como lidas:", err);
    res.status(500).json({ error: "Erro ao marcar mensagens como lidas." });
  }
});


/**
 * 📌 PATCH /conversations/:id/reopen
 * 🔐 Reabre uma conversa fechada (altera o status para "aberta")
 */
router.patch("/:id/reopen", authOrApiKey, async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se a conversa existe e está fechada
    const [rows] = await pool.query(`SELECT * FROM conversations WHERE id = ?`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Conversa não encontrada." });
    }

    if (rows[0].status !== 'fechada') {
      return res.status(400).json({ error: "Esta conversa não está fechada." });
    }

    // Atualiza o status para "aberta"
    await pool.query(
      `UPDATE conversations SET status = 'aberta', updated_at = NOW() WHERE id = ?`,
      [id]
    );

    console.log(`✅ Conversa ${id} reaberta com sucesso.`);

    res.json({ success: true, message: "Conversa reaberta com sucesso.", status: 'aberta' });
  } catch (err) {
    console.error("🚨 Erro ao reabrir conversa:", err);
    res.status(500).json({ error: "Erro ao reabrir conversa." });
  }
});


/**
 * 📌 GET /conversations/:id/contact
 * 🔍 Busca o contato vinculado à conversa
 */
router.get("/:id/contact", authOrApiKey, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(`
      SELECT 
        c.id AS conversation_id,
        c.customer_name,
        c.customer_phone,
        cont.id AS contact_id,
        cont.nome AS contact_name,
        cont.email AS contact_email,
        cont.telefone AS contact_phone,
        cont.notas_internas,
        cont.created_at AS contact_created_at,
        cont.updated_at AS contact_updated_at
      FROM conversations c
      LEFT JOIN contacts cont ON c.contact_id = cont.id
      WHERE c.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Conversa não encontrada." });
    }

    const conversation = rows[0];
    
    if (!conversation.contact_id) {
      return res.json({
        conversation_id: conversation.conversation_id,
        customer_name: conversation.customer_name,
        customer_phone: conversation.customer_phone,
        contact: null,
        message: "Nenhum contato vinculado a esta conversa."
      });
    }

    res.json({
      conversation_id: conversation.conversation_id,
      customer_name: conversation.customer_name,
      customer_phone: conversation.customer_phone,
      contact: {
        id: conversation.contact_id,
        nome: conversation.contact_name,
        email: conversation.contact_email,
        telefone: conversation.contact_phone,
        notas_internas: conversation.notas_internas ? JSON.parse(conversation.notas_internas) : [],
        created_at: conversation.contact_created_at,
        updated_at: conversation.contact_updated_at
      }
    });
  } catch (err) {
    console.error("🚨 Erro ao buscar contato da conversa:", err);
    res.status(500).json({ error: "Erro ao buscar contato da conversa." });
  }
});

/**
 * 📌 GET /conversations/contact/:contactId
 * 🔍 Busca conversas vinculadas a um contato específico
 */
router.get("/contact/:contactId", authOrApiKey, async (req, res) => {
  try {
    const { contactId } = req.params;

    const [rows] = await pool.query(`
      SELECT 
        c.id,
        c.customer_name,
        c.customer_phone,
        c.status,
        c.assigned_user_id,
        c.contact_id,
        c.created_at,
        c.updated_at,
        u.nome AS assigned_user_name,
        t.nome AS team_name,
        wi.instance_name AS whatsapp_instance_name
      FROM conversations c
      LEFT JOIN users u ON c.assigned_user_id = u.id
      LEFT JOIN team_whatsapp_instances twi ON c.team_whatsapp_instance_id = twi.id
      LEFT JOIN teams t ON twi.team_id = t.id
      LEFT JOIN whatsapp_instances wi ON twi.whatsapp_instance_id = wi.id
      WHERE c.contact_id = ?
      ORDER BY c.created_at DESC
    `, [contactId]);

    res.json(rows);
  } catch (err) {
    console.error("🚨 Erro ao buscar conversas do contato:", err);
    res.status(500).json({ error: "Erro ao buscar conversas do contato." });
  }
});

module.exports = router;
