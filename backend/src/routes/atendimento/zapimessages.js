const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const authOrApiKey = require("../middlewares/authOrApiKey");
const axios = require("axios");
const MessageHandler = require("../websocket/handlers/messageHandler");
const { resolveOrCreateContact, getCompanyIdFromTeamInstance } = require("../utils/contactHelper");
const { uploadImageToCloudinary, uploadAudioToCloudinary, uploadVideoToCloudinary, uploadDocumentToCloudinary } = require("../utils/imageUpload");
// Removido imports não utilizados que podem causar erro


/**
 * 🚀 POST /zapimessages/start
 * - Cria a conversa (se não existir)
 * - Envia a mensagem inicial pelo WhatsApp.
 * - Salva a mensagem no banco
 */
router.post("/start", authOrApiKey, async (req, res) => {
  try {
    const { team_whatsapp_instance_id, customer_name, customer_phone, sender_id, message } = req.body;

    if (!team_whatsapp_instance_id || !customer_phone || !sender_id || !message) {
      return res.status(400).json({ error: "Campos obrigatórios: team_whatsapp_instance_id, customer_phone, sender_id, message" });
    }

    // 🔍 1️⃣ Verifica se a conversa ATIVA já existe para esse cliente e time
    const [existingConv] = await pool.query(
      `SELECT id FROM conversations 
       WHERE customer_phone = ? AND team_whatsapp_instance_id = ?
       AND status IN ('aberta', 'em_andamento')
       ORDER BY created_at DESC LIMIT 1`,
      [customer_phone, team_whatsapp_instance_id]
    );

    let conversationId;
    if (existingConv.length > 0) {
      console.log(`✅ Conversa ativa encontrada no start: ${existingConv[0].id}`);
      conversationId = existingConv[0].id;
    } else {
      // 📥 2️⃣ Cria uma nova conversa com lógica de contatos
      let contactId = null;
      
      // 🔍 Busca o company_id para gerenciar contatos
      const companyId = await getCompanyIdFromTeamInstance(team_whatsapp_instance_id);
      
      if (companyId && customer_phone) {
        try {
          const contact = await resolveOrCreateContact({
            phone: customer_phone,
            companyId: companyId,
            customerName: customer_name
          });
          contactId = contact.id;
          console.log(`📇 Contato resolvido/criado no start: ID ${contactId} - ${contact.nome}`);
        } catch (error) {
          console.error("⚠️ Erro ao resolver contato no start, continuando sem contact_id:", error);
        }
      }
      
      const [newConv] = await pool.query(
        `INSERT INTO conversations (team_whatsapp_instance_id, customer_name, customer_phone, assigned_user_id, status, contact_id)
         VALUES (?, ?, ?, ?, 'aberta', ?)`,
        [team_whatsapp_instance_id, customer_name || null, customer_phone, sender_id, contactId]
      );
      conversationId = newConv.insertId;
    }

    // 🔍 3️⃣ Busca os dados da instância Z-API
    const [instanceData] = await pool.query(
      `SELECT wi.instance_name, wi.token 
       FROM team_whatsapp_instances twi
       JOIN whatsapp_instances wi ON twi.whatsapp_instance_id = wi.id
       WHERE twi.id = ?`,
      [team_whatsapp_instance_id]
    );

    if (instanceData.length === 0) {
      return res.status(400).json({ error: "Instância do WhatsApp não encontrada." });
    }

    const { instance_name, token } = instanceData[0];

    // 🔥 4️⃣ Envia a mensagem pela Z-API
    const zapiUrl = `https://api.z-api.io/instances/${instance_name}/token/${token}/send-text`;
    console.log("📤 Enviando mensagem inicial para:", customer_phone);

    const zapiResponse = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": token
      },
      body: JSON.stringify({
        phone: customer_phone,
        message: message
      })
    });

    const zapiData = await zapiResponse.json();
    console.log("✅ Resposta da Z-API:", zapiData);

    if (!zapiResponse.ok) {
      return res.status(500).json({ error: "Falha ao enviar mensagem para Z-API", details: zapiData });
    }

    // 📝 5️⃣ Salva a mensagem no banco
    await pool.query(
      `INSERT INTO messages (conversation_id, sender_type, sender_id, message_type, content, \`read\`)
       VALUES (?, 'user', ?, 'text', ?, 0)`,
      [conversationId, sender_id, message]
    );

    // 🎯 6️⃣ Resposta final
    res.json({
      success: true,
      conversation_id: conversationId,
      message: "Conversa iniciada e mensagem enviada com sucesso!",
      zapi_message_id: zapiData.messageId || null
    });

  } catch (err) {
    console.error("🚨 Erro ao iniciar conversa:", err);
    res.status(500).json({ error: "Erro interno ao iniciar conversa." });
  }
});




/**
 * 📤 Enviar mensagem via Evolution API
 * POST /zapimessages/evolution/send
 * - Cria a conversa (se não existir)
 * - Envia a mensagem pela Evolution API
 * - Salva a mensagem no banco
 */
router.post("/evolution/send", authOrApiKey, async (req, res) => {
  try {
    const { 
      instanceName, 
      number, 
      text, 
      options, 
      team_whatsapp_instance_id: twiFromBody, 
      customer_name, 
      customer_phone, 
      sender_id 
    } = req.body;

    if (!instanceName || !number || !text) {
      return res.status(400).json({
        error: "Campos obrigatórios: instanceName, number e text"
      });
    }

    // --- helpers locais ---
    const normalizePhone = (raw) => {
      if (!raw) return raw;
      let n = String(raw).replace(/\D/g, "");
      if (n.startsWith("55")) return n;
      if (n.startsWith("0")) n = n.replace(/^0+/, "");
      return `55${n}`;
    };

    const getTwiByInstanceName = async (name) => {
      const [rows] = await pool.query(
        `SELECT twi.id AS id
           FROM whatsapp_instances wi
           JOIN team_whatsapp_instances twi ON twi.whatsapp_instance_id = wi.id
          WHERE wi.instance_name = ?
          LIMIT 1`,
        [name]
      );
      return rows?.[0]?.id || null;
    };

    const getDefaultTeamTwi = async (companyId) => {
      if (!companyId) return null;
      const [rows] = await pool.query(
        `SELECT twi.id
           FROM teams t
           JOIN team_whatsapp_instances twi ON twi.team_id = t.id
          WHERE t.company_id = ? AND t.padrao = 1
          LIMIT 1`,
        [companyId]
      );
      return rows?.[0]?.id || null;
    };

    const resolveOrCreateConversation = async ({ twiId, phone, custName, assignedId }) => {
      // 1) identifica empresa pelo TWI informado
      const companyId = await getCompanyIdFromTeamInstance(twiId);

      // 2) tenta achar conversa ABERTA pelo telefone dentro da empresa (independente do time)
      const [found] = await pool.query(
        `SELECT c.id, c.team_whatsapp_instance_id
           FROM conversations c
           JOIN team_whatsapp_instances twi2 ON c.team_whatsapp_instance_id = twi2.id
           JOIN teams t ON twi2.team_id = t.id
          WHERE c.customer_phone = ?
            AND t.company_id = ?
            AND c.status IN ('aberta', 'em_andamento')
          ORDER BY c.updated_at DESC
          LIMIT 1`,
        [phone, companyId]
      );
      if (found.length) {
        console.log(`✅ Conversa ativa encontrada para a empresa: ${found[0].id}`);
        return found[0].id;
      }

      // 3) se não existir, direciona para o TWI do time padrão da empresa, se houver
      const defaultTwi = await getDefaultTeamTwi(companyId);
      const twiToUse = defaultTwi || twiId;

      // 4) cria com lógica de contatos
      let contactId = null;

      if (companyId && phone) {
        try {
          const contact = await resolveOrCreateContact({
            phone: phone,
            companyId: companyId,
            customerName: custName
          });
          contactId = contact.id;
          console.log(`📇 Contato resolvido/criado no envio: ID ${contactId} - ${contact.nome}`);
        } catch (error) {
          console.error("⚠️ Erro ao resolver contato no envio, continuando sem contact_id:", error);
        }
      }
      
      const [ins] = await pool.query(
        `INSERT INTO conversations
           (team_whatsapp_instance_id, customer_name, customer_phone, assigned_user_id, status, contact_id)
         VALUES (?, ?, ?, ?, 'aberta', ?)`,
        [twiToUse, custName || null, phone, assignedId || null, contactId]
      );
      console.log(`✅ Nova conversa criada: ${ins.insertId}`);
      return ins.insertId;
    };

    // usa sender_type = 'user' e crase em `read`
    const insertAgentMessage = async ({ conversationId, senderId, content }) => {
      const [ins] = await pool.query(
        `INSERT INTO messages (conversation_id, sender_type, sender_id, message_type, content, \`read\`)
         VALUES (?, 'user', ?, 'text', ?, 0)`,
        [conversationId, senderId || null, content]
      );
      return ins.insertId;
    };
    // --- fim helpers ---

    // 0) normaliza telefone (usa customer_phone se vier, senão o number)
    const phone = normalizePhone(customer_phone || number);

    // 1) determina o TWI (do body ou por instanceName)
    let team_whatsapp_instance_id = twiFromBody || null;
    if (!team_whatsapp_instance_id) {
      team_whatsapp_instance_id = await getTwiByInstanceName(instanceName);
    }

    // 2) resolve/cria conversa (se tiver TWI + phone)
    let conversationId = null;
    if (team_whatsapp_instance_id && phone) {
      conversationId = await resolveOrCreateConversation({
        twiId: team_whatsapp_instance_id,
        phone,
        custName: customer_name,
        assignedId: sender_id
      });
      console.log(`✅ Conversa resolvida/criada: ${conversationId}`);
    } else {
      console.warn("⚠️ Não foi possível resolver conversationId (faltou team_whatsapp_instance_id ou telefone).");
    }

    // 3) envia via Evolution
    console.log("📤 Enviando mensagem Evolution para:", phone);
    const response = await axios.post(
      `https://connection-evolution-api.sf83tr.easypanel.host/message/sendText/${instanceName}`,
      { number: phone, text, options: options || {} },
      { headers: { apikey: process.env.EVOLUTION_API_KEY } }
    );

    // 4) salva SEMPRE que tiver conversationId (igual ao z-api)
    let insertedMessageId = null;
    if (conversationId) {
      insertedMessageId = await insertAgentMessage({
        conversationId,
        senderId: sender_id || null,
        content: text
      });
      console.log(`✅ Mensagem salva no banco para conversa: ${conversationId} / messageId: ${insertedMessageId}`);

      // (opcional) notificar em tempo real
      try {
        MessageHandler?.notifyNewMessage?.({
          id: insertedMessageId,
          conversation_id: conversationId,
          sender_type: 'user', // <- combina com seu ENUM
          sender_id: sender_id || null,
          message_type: 'text',
          content: text,
          media_url: null,
          created_at: new Date().toISOString(),
          read: 0
        });
      } catch (e) {
        console.warn("ℹ️ Falha ao notificar websocket (opcional):", e?.message || e);
      }
    } else {
      console.log("ℹ️ Mensagem enviada (Evolution), mas não foi possível salvar (sem conversationId).");
    }

    // 5) resposta
    res.status(200).json({
      success: true,
      conversation_id: conversationId,
      message_id: insertedMessageId,
      evolution_response: response.data,
      message: conversationId 
        ? "Mensagem enviada e salva com sucesso!"
        : "Mensagem enviada com sucesso! (sem salvar por falta de conversationId)"
    });

  } catch (error) {
    console.error("🚨 Erro ao enviar mensagem Evolution:", error.response?.data || error.message);
    res.status(500).json({
      error: "Erro ao enviar mensagem pela Evolution API",
      details: error.response?.data || error.message
    });
  }
});


/**
 * 🎵 POST /zapimessages/evolution/send-audio
 * - Cria a conversa (se não existir)
 * - Envia áudio pela Evolution API
 * - Salva a mensagem no banco
 */
router.post("/evolution/send-audio", authOrApiKey, async (req, res) => {
  try {
    const {
      instanceName,
      number,
      audioMessage,
      options,
      team_whatsapp_instance_id: twiFromBody,
      customer_name,
      customer_phone,
      sender_id
    } = req.body;

    // Validações obrigatórias
    if (!instanceName || !number || !audioMessage?.audio) {
      return res.status(400).json({
        error: "Campos obrigatórios: instanceName, number e audioMessage.audio"
      });
    }

    // --- helpers locais (reutilizando do endpoint de texto) ---
    const normalizePhone = (raw) => {
      if (!raw) return raw;
      let n = String(raw).replace(/\D/g, "");
      if (n.startsWith("55")) return n;
      if (n.startsWith("0")) n = n.replace(/^0+/, "");
      return `55${n}`;
    };

    const getTwiByInstanceName = async (name) => {
      const [rows] = await pool.query(
        `SELECT twi.id AS id
           FROM whatsapp_instances wi
           JOIN team_whatsapp_instances twi ON twi.whatsapp_instance_id = wi.id
          WHERE wi.instance_name = ?
          LIMIT 1`,
        [name]
      );
      return rows?.[0]?.id || null;
    };

    const resolveOrCreateConversation = async ({ twiId, phone, custName, assignedId }) => {
      // 1) tenta achar conversa ABERTA primeiro
      const [found] = await pool.query(
        `SELECT id FROM conversations 
         WHERE customer_phone = ? AND team_whatsapp_instance_id = ? 
         AND status IN ('aberta', 'em_andamento')
         ORDER BY created_at DESC LIMIT 1`,
        [phone, twiId]
      );
      if (found.length) {
        console.log(`✅ Conversa ativa encontrada: ${found[0].id}`);
        return found[0].id;
      }

      // 2) cria com lógica de contatos
      let contactId = null;
      
      // 🔍 Busca o company_id para gerenciar contatos
      const companyId = await getCompanyIdFromTeamInstance(twiId);
      
      if (companyId && phone) {
        try {
          const contact = await resolveOrCreateContact({
            phone: phone,
            companyId: companyId,
            customerName: custName
          });
          contactId = contact.id;
          console.log(`📇 Contato resolvido/criado no envio: ID ${contactId} - ${contact.nome}`);
        } catch (error) {
          console.error("⚠️ Erro ao resolver contato no envio, continuando sem contact_id:", error);
        }
      }
      
      const [ins] = await pool.query(
        `INSERT INTO conversations
           (team_whatsapp_instance_id, customer_name, customer_phone, assigned_user_id, status, contact_id)
         VALUES (?, ?, ?, ?, 'aberta', ?)`,
        [twiId, custName || null, phone, assignedId || null, contactId]
      );
      console.log(`✅ Nova conversa criada: ${ins.insertId}`);
      return ins.insertId;
    };

    const insertAgentMessage = async ({ conversationId, senderId, content, messageType = 'audio', mediaUrl = null }) => {
      const [ins] = await pool.query(
        `INSERT INTO messages (conversation_id, sender_type, sender_id, message_type, content, media_url, \`read\`)
         VALUES (?, 'user', ?, ?, ?, ?, 0)`,
        [conversationId, senderId || null, content || 'Áudio', messageType, mediaUrl]
      );
      return ins.insertId;
    };
    // --- fim helpers ---

    // 0) normaliza telefone
    const phone = normalizePhone(customer_phone || number);

    // 1) determina o TWI
    let team_whatsapp_instance_id = twiFromBody || null;
    if (!team_whatsapp_instance_id) {
      team_whatsapp_instance_id = await getTwiByInstanceName(instanceName);
    }

    // 2) resolve/cria conversa
    let conversationId = null;
    if (team_whatsapp_instance_id && phone) {
      conversationId = await resolveOrCreateConversation({
        twiId: team_whatsapp_instance_id,
        phone,
        custName: customer_name,
        assignedId: sender_id
      });
      console.log(`✅ Conversa resolvida/criada: ${conversationId}`);
    } else {
      console.warn("⚠️ Não foi possível resolver conversationId (faltou team_whatsapp_instance_id ou telefone).");
    }

    // 3) prepara payload para Evolution API
    // A Evolution API quer APENAS base64 puro, sem prefixo data:
    let audioData = audioMessage.audio;
    
    if (audioData.startsWith('data:')) {
      // Extrair APENAS o base64, removendo o prefixo data:
      audioData = audioData.split(',')[1];
      console.log("📋 Extraindo base64 puro do data URI");
    } else {
      console.log("📋 Usando base64 puro como está");
    }

    // Validação básica do base64
    if (!audioData || audioData.length === 0) {
      return res.status(400).json({
        error: "Dados de áudio inválidos ou vazios"
      });
    }

    console.log("📊 Dados do áudio processados:", {
      originalLength: audioMessage.audio.length,
      processedLength: audioData.length,
      isBase64: /^[A-Za-z0-9+/]*={0,2}$/.test(audioData.substring(0, 100))
    });

    const evolutionPayload = {
      number: phone,
      options: {
        delay: options?.delay || 1200,
        presence: options?.presence || "recording",
        encoding: options?.encoding !== false, // default true
        ...options
      },
      audio: audioData  // Evolution API espera 'audio' diretamente, não dentro de 'audioMessage'
    };

    // 4) envia via Evolution API
    console.log("🎵 Enviando áudio Evolution para:", phone);
    console.log("📋 Payload completo:", {
      number: evolutionPayload.number,
      options: evolutionPayload.options,
      audioLength: audioData.length,
      audioPrefix: audioData.substring(0, 100) + '...',
      audioSuffix: '...' + audioData.substring(audioData.length - 20)
    });
    
    const evolutionUrl = `https://connection-evolution-api.sf83tr.easypanel.host/message/sendWhatsAppAudio/${instanceName}`;
    console.log("🔗 URL Evolution:", evolutionUrl);
    console.log("🔑 API Key presente:", !!process.env.EVOLUTION_API_KEY);
    
    const response = await axios.post(
      evolutionUrl,
      evolutionPayload,
      {
        headers: {
          'apikey': process.env.EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 segundos timeout
      }
    );

    // 5) salva no banco se tiver conversationId
    let insertedMessageId = null;
    let mediaUrl = null; // Declarar fora do bloco if
    if (conversationId) {
      
      // 🎵 Upload do áudio para Cloudinary
      try {
        console.log('🎵 Fazendo upload do áudio para Cloudinary...');
        const cloudinaryResult = await uploadAudioToCloudinary(audioMessage.audio);
        mediaUrl = cloudinaryResult.url;
        console.log('✅ URL do Cloudinary:', mediaUrl);
      } catch (uploadError) {
        console.error('❌ Erro no upload para Cloudinary:', uploadError);
        // Fallback: usar URL da Evolution
        mediaUrl = response.data?.audioMessage?.url || response.data?.message?.audioMessage?.url || null;
        console.log('⚠️ Usando URL da Evolution como fallback');
      }
      
      insertedMessageId = await insertAgentMessage({
        conversationId,
        senderId: sender_id || null,
        content: 'Áudio',
        messageType: 'audio',
        mediaUrl: mediaUrl
      });
      console.log(`✅ Mensagem de áudio salva no banco para conversa: ${conversationId} / messageId: ${insertedMessageId}`);

      // (opcional) notificar em tempo real
      try {
        MessageHandler?.notifyNewMessage?.({
          id: insertedMessageId,
          conversation_id: conversationId,
          sender_type: 'user',
          sender_id: sender_id || null,
          message_type: 'audio',
          content: 'Áudio',
          media_url: mediaUrl, // Usar URL do Cloudinary
          created_at: new Date().toISOString(),
          read: 0
        });
      } catch (e) {
        console.warn("ℹ️ Falha ao notificar websocket (opcional):", e?.message || e);
      }
    } else {
      console.log("ℹ️ Áudio enviado (Evolution), mas não foi possível salvar (sem conversationId).");
    }

    // 6) resposta
    res.status(200).json({
      success: true,
      conversation_id: conversationId,
      message_id: insertedMessageId,
      evolution_response: response.data,
      audio_info: {
        media_url: insertedMessageId ? mediaUrl : null, // URL do Cloudinary ou Evolution
        evolution_url: response.data?.audioMessage?.url || response.data?.message?.audioMessage?.url,
        duration: response.data?.audioMessage?.seconds || response.data?.message?.audioMessage?.seconds,
        file_size: response.data?.audioMessage?.fileLength || response.data?.message?.audioMessage?.fileLength
      },
      message: conversationId 
        ? "Áudio enviado e salvo com sucesso!"
        : "Áudio enviado com sucesso! (sem salvar por falta de conversationId)"
    });

  } catch (error) {
    console.error("🚨 Erro ao enviar áudio Evolution:", error.response?.data || error.message);
    console.error("📋 Stack trace:", error.stack);
    console.error("📋 Erro completo:", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    });
    
    res.status(500).json({
      error: "Erro ao enviar áudio pela Evolution API",
      details: error.response?.data || error.message,
      status: error.response?.status
    });
  }
});

/**
 * 📸 POST /zapimessages/evolution/send-media
 * - Cria a conversa (se não existir)
 * - Envia mídia (imagem, vídeo, documento) pela Evolution API
 * - Salva a mensagem no banco
 */
router.post("/evolution/send-media", authOrApiKey, async (req, res) => {
  try {
    const {
      instanceName,
      number,
      mediaMessage,
      options,
      team_whatsapp_instance_id: twiFromBody,
      customer_name,
      customer_phone,
      sender_id
    } = req.body;

    // Validações obrigatórias
    if (!instanceName || !number || !mediaMessage) {
      return res.status(400).json({
        error: "Campos obrigatórios: instanceName, number e mediaMessage"
      });
    }

    if (!mediaMessage.mediatype || !mediaMessage.media) {
      return res.status(400).json({
        error: "mediaMessage deve conter mediatype e media"
      });
    }

    // --- helpers locais (reutilizando do endpoint de texto) ---
    const normalizePhone = (raw) => {
      if (!raw) return raw;
      let n = String(raw).replace(/\D/g, "");
      if (n.startsWith("55")) return n;
      if (n.startsWith("0")) n = n.replace(/^0+/, "");
      return `55${n}`;
    };

    const getTwiByInstanceName = async (name) => {
      const [rows] = await pool.query(
        `SELECT twi.id AS id
           FROM whatsapp_instances wi
           JOIN team_whatsapp_instances twi ON twi.whatsapp_instance_id = wi.id
          WHERE wi.instance_name = ?
          LIMIT 1`,
        [name]
      );
      return rows?.[0]?.id || null;
    };

    const resolveOrCreateConversation = async ({ twiId, phone, custName, assignedId }) => {
      try {
        // 1) tentar encontrar conversa ATIVA primeiro
        const [existingRows] = await pool.query(
          `SELECT id FROM conversations 
           WHERE team_whatsapp_instance_id = ? AND customer_phone = ?
           AND status IN ('aberta', 'em_andamento')
           ORDER BY created_at DESC LIMIT 1`,
          [twiId, phone]
        );

        if (existingRows.length > 0) {
          console.log(`✅ Conversa ativa encontrada: ${existingRows[0].id}`);
          return existingRows[0].id;
        }

        // 2) criar nova conversa
        const [result] = await pool.query(
          `INSERT INTO conversations 
           (team_whatsapp_instance_id, customer_name, customer_phone, assigned_user_id, status)
           VALUES (?, ?, ?, ?, 'aberta')`,
          [twiId, custName || null, phone, assignedId || null]
        );

        console.log(`✅ Nova conversa criada: ${result.insertId}`);
        return result.insertId;
      } catch (error) {
        console.error("❌ Erro ao resolver/criar conversa:", error);
        return null;
      }
    };

    const insertAgentMessage = async ({ conversationId, senderId, content, messageType, mediaUrl }) => {
      try {
        const [result] = await pool.query(
          `INSERT INTO messages 
           (conversation_id, sender_type, sender_id, message_type, content, media_url)
           VALUES (?, 'user', ?, ?, ?, ?)`,
          [conversationId, senderId, messageType, content, mediaUrl]
        );
        return result.insertId;
      } catch (error) {
        console.error("❌ Erro ao inserir mensagem:", error);
        return null;
      }
    };

    // --- lógica principal ---
    const phone = normalizePhone(customer_phone || number);

    // 1) determina o TWI (do body ou por instanceName)
    let team_whatsapp_instance_id = twiFromBody || null;
    if (!team_whatsapp_instance_id) {
      team_whatsapp_instance_id = await getTwiByInstanceName(instanceName);
    }

    // 2) resolve/cria conversa (se tiver TWI + phone)
    let conversationId = null;
    if (team_whatsapp_instance_id && phone) {
      conversationId = await resolveOrCreateConversation({
        twiId: team_whatsapp_instance_id,
        phone,
        custName: customer_name,
        assignedId: sender_id
      });
      console.log(`✅ Conversa resolvida/criada: ${conversationId}`);
    } else {
      console.warn("⚠️ Não foi possível resolver conversationId (faltou team_whatsapp_instance_id ou telefone).");
    }

    // 3) prepara payload para Evolution
    // Extrair apenas o base64 do data URI
    let mediaData = mediaMessage.media;
    if (mediaData.startsWith('data:')) {
      mediaData = mediaData.split(',')[1];
    }
    
    // Formatar telefone para Evolution API (adicionar @s.whatsapp.net)
    const formattedPhone = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    
    const evolutionPayload = {
      number: formattedPhone,
      mediatype: mediaMessage.mediatype,
      media: mediaData,
      ...(mediaMessage.caption && { caption: mediaMessage.caption }),
      ...(mediaMessage.fileName && { fileName: mediaMessage.fileName }),
      ...(mediaMessage.mimetype && { mimetype: mediaMessage.mimetype })
    };

    // 4) envia via Evolution API
    console.log("📸 Enviando mídia Evolution para:", phone);
    console.log("📋 Tipo de mídia:", mediaMessage.mediatype);
    console.log("📋 Payload resumido:", {
      number: evolutionPayload.number,
      mediatype: evolutionPayload.mediatype,
      hasCaption: !!evolutionPayload.caption,
      hasFileName: !!evolutionPayload.fileName,
      mediaLength: evolutionPayload.media.length,
      mediaPrefix: evolutionPayload.media.substring(0, 50) + '...'
    });
    
    const evolutionUrl = `https://connection-evolution-api.sf83tr.easypanel.host/message/sendMedia/${instanceName}`;
    console.log("🔗 URL Evolution:", evolutionUrl);
    console.log("🔑 API Key presente:", !!process.env.EVOLUTION_API_KEY);
    
    const response = await axios.post(
      evolutionUrl,
      evolutionPayload,
      {
        headers: {
          'apikey': process.env.EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 segundos timeout
      }
    );

    // 5) salva no banco se tiver conversationId
    let insertedMessageId = null;
    let mediaUrl = null; // Declarar mediaUrl fora do bloco if para evitar erro de escopo
    
    if (conversationId) {
      const messageContent = mediaMessage.caption || `${mediaMessage.mediatype.charAt(0).toUpperCase() + mediaMessage.mediatype.slice(1)}`;
      
      // Upload para Cloudinary baseado no tipo de mídia
      if (mediaMessage.mediatype === 'image') {
        try {
          console.log('☁️ Fazendo upload da imagem para Cloudinary...');
          const cloudinaryResult = await uploadImageToCloudinary(mediaMessage.media);
          mediaUrl = cloudinaryResult.url;
          console.log('✅ URL do Cloudinary:', mediaUrl);
        } catch (uploadError) {
          console.error('❌ Erro no upload para Cloudinary:', uploadError);
          // Fallback: salvar base64 temporariamente
          const base64DataUrl = `data:${mediaMessage.mimetype || 'image/jpeg'};base64,${mediaData}`;
          mediaUrl = base64DataUrl;
          console.log('⚠️ Usando base64 como fallback');
        }
      } else if (mediaMessage.mediatype === 'video') {
        try {
          console.log('🎥 Fazendo upload do vídeo para Cloudinary...');
          const cloudinaryResult = await uploadVideoToCloudinary(mediaMessage.media);
          mediaUrl = cloudinaryResult.url;
          console.log('✅ URL do Cloudinary:', mediaUrl);
        } catch (uploadError) {
          console.error('❌ Erro no upload para Cloudinary:', uploadError);
          // Fallback: salvar base64 temporariamente
          const base64DataUrl = `data:${mediaMessage.mimetype || 'video/mp4'};base64,${mediaData}`;
          mediaUrl = base64DataUrl;
          console.log('⚠️ Usando base64 como fallback');
        }
      } else if (mediaMessage.mediatype === 'document') {
        try {
          console.log('📄 Fazendo upload do documento para Cloudinary...');
          const fileName = mediaMessage.fileName || 'documento';
          const mimeType = mediaMessage.mimetype || 'application/octet-stream';
          const cloudinaryResult = await uploadDocumentToCloudinary(
            mediaMessage.media,
            fileName,
            mimeType,
            'aura8-documents'
          );
          mediaUrl = cloudinaryResult.url;
          console.log('✅ URL do Cloudinary:', mediaUrl);
        } catch (uploadError) {
          console.error('❌ Erro no upload para Cloudinary:', uploadError);
          // Fallback: salvar base64 temporariamente
          const base64DataUrl = `data:${mediaMessage.mimetype || 'application/octet-stream'};base64,${mediaData}`;
          mediaUrl = base64DataUrl;
          console.log('⚠️ Usando base64 como fallback');
        }
      } else {
        // Para outros tipos de mídia (áudio), manter base64 por enquanto
        const base64DataUrl = `data:${mediaMessage.mimetype || 'application/octet-stream'};base64,${mediaData}`;
        mediaUrl = base64DataUrl;
      }
      
      // Mapear tipos de mídia para os tipos aceitos pela tabela
      const mapMediaType = (mediatype) => {
        switch (mediatype) {
          case 'document':
          case 'application':
            return 'file';
          case 'image':
          case 'jpeg':
          case 'png':
          case 'gif':
            return 'image';
          case 'audio':
          case 'ogg':
          case 'mp3':
            return 'audio';
          case 'video':
          case 'mp4':
            return 'video';
          default:
            return 'file'; // fallback para documentos
        }
      };

      insertedMessageId = await insertAgentMessage({
        conversationId,
        senderId: sender_id || null,
        content: messageContent,
        messageType: mapMediaType(mediaMessage.mediatype),
        mediaUrl: mediaUrl
      });
      console.log(`✅ Mensagem de mídia salva no banco para conversa: ${conversationId} / messageId: ${insertedMessageId}`);

      // (opcional) notificar em tempo real
      try {
        MessageHandler?.notifyNewMessage?.({
          id: insertedMessageId,
          conversation_id: conversationId,
          sender_type: 'user',
          sender_id: sender_id || null,
          message_type: mapMediaType(mediaMessage.mediatype),
          content: messageContent,
          media_url: mediaUrl,
          created_at: new Date().toISOString(),
          read: 0
        });
      } catch (e) {
        console.warn("ℹ️ Falha ao notificar websocket (opcional):", e?.message || e);
      }
    } else {
      console.log("ℹ️ Mídia enviada (Evolution), mas não foi possível salvar (sem conversationId).");
    }

    // 6) resposta
    res.status(200).json({
      success: true,
      conversation_id: conversationId,
      message_id: insertedMessageId,
      evolution_response: response.data,
      media_info: {
        type: mediaMessage.mediatype,
        url: mediaUrl || `data:${mediaMessage.mimetype || 'image/jpeg'};base64,${mediaData}`,
        caption: mediaMessage.caption,
        file_name: mediaMessage.fileName
      },
      message: conversationId 
        ? "Mídia enviada e salva com sucesso!"
        : "Mídia enviada com sucesso! (sem salvar por falta de conversationId)"
    });

  } catch (error) {
    console.error("🚨 Erro ao enviar mídia Evolution:", error.response?.data || error.message);
    console.error("📋 Stack trace:", error.stack);
    console.error("📋 Erro completo:", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    });
    
    res.status(500).json({
      error: "Erro ao enviar mídia pela Evolution API",
      details: error.response?.data || error.message,
      status: error.response?.status
    });
  }
});

module.exports = router;
