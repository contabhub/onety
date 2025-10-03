const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const MessageHandler = require("../../websocket/handlers/atendimento/messageHandler");
const ConversationHandler = require("../../websocket/handlers/atendimento/conversationHandler");
const { resolveOrCreateContact, getCompanyIdFromTeamInstance } = require("../../utils/atendimento/contactHelper");
const { buildMessageReceivedPayload, enqueueWebhookEvent } = require("../../services/atendimento/webhook");

// Helper: retorna o TWI do time padrão da empresa (se existir)
async function getDefaultTeamTwi(companyId) {
  if (!companyId) return null;
  const [rows] = await pool.query(
    `SELECT twi.id
       FROM times_atendimento t
       JOIN times_atendimento_instancias twi ON twi.times_atendimento_id = t.id
      WHERE t.empresa_id = ? AND t.padrao = 1
      LIMIT 1`,
    [companyId]
  );
  return rows?.[0]?.id || null;
}
const { uploadImageToCloudinary, uploadAudioToCloudinary, uploadVideoToCloudinary, uploadDocumentToCloudinary } = require("../../utils/atendimento/imageUpload");
const axios = require("axios");

// Logger básico para todas as rotas deste router (/webhook/*)
router.use((req, res, next) => {
  try {
    const bodyPreview = typeof req.body === 'object' ? JSON.stringify(req.body).slice(0, 500) : String(req.body).slice(0, 500);
    console.log(`➡️  [WEBHOOK] ${req.method} ${req.originalUrl} | headers: content-type=${req.headers['content-type']} length=${req.headers['content-length'] || 'n/a'} | body: ${bodyPreview}${bodyPreview.length === 500 ? '…' : ''}`);
  } catch (_) {
    console.log(`➡️  [WEBHOOK] ${req.method} ${req.originalUrl} (body não serializável)`);
  }
  next();
});

/**
 * 🔍 Detecta o tipo de mensagem recebida
 */
function detectMessageType(webhookData) {
  if (webhookData.text?.message) return 'text';
  if (webhookData.audio) return 'audio';
  if (webhookData.photo) return 'photo';
  if (webhookData.video) return 'video';
  if (webhookData.document) return 'file'; // Mapear 'document' para 'file' para compatibilidade com a tabela
  return 'unknown';
}

/**
 * 📝 Extrai conteúdo de mensagem de texto
 */
function extractTextContent(webhookData) {
  return webhookData.text?.message || null;
}

/**
 * 🎵 Extrai conteúdo de mensagem de áudio
 */
function extractAudioContent(webhookData) {
  if (!webhookData.audio) return null;
  
  return {
    audioUrl: webhookData.audio.audioUrl,
    mimeType: webhookData.audio.mimeType,
    seconds: webhookData.audio.seconds,
    ptt: webhookData.audio.ptt || false
  };
}

/**
 * 📸 Extrai conteúdo de mensagem de foto
 */
function extractPhotoContent(webhookData) {
  if (!webhookData.photo) return null;
  
  return {
    photoUrl: webhookData.photo,
    caption: webhookData.text?.message || null
  };
}

/**
 * 🔓 Descriptografa mídia usando Evolution API
 * @param {string} instanceName - Nome da instância Evolution (ex: "TI-teste")
 * @param {string} messageId - ID da mensagem (data.key.id)
 * @param {string} remoteJid - JID remoto (data.key.remoteJid)
 * @returns {Promise<Object>} - Dados da mídia descriptografada
 */
async function decryptMediaFromEvolution(instanceName, messageId, remoteJid) {
  try {
    console.log('🔓 Descriptografando mídia via Evolution API...');
    console.log('🔓 Parâmetros:', { instanceName, messageId, remoteJid });
    
    const evolutionUrl = `https://evolution-evolution-api.hdolfr.easypanel.host/chat/getBase64FromMediaMessage/${instanceName}`;
    
    const response = await axios.post(
      evolutionUrl,
      {
        message: {
          key: {
            id: messageId,
            remoteJid: remoteJid
          }
        }
      },
      {
        headers: {
          'apikey': process.env.EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 segundos timeout
      }
    );
    
    console.log('✅ Mídia descriptografada com sucesso!');
    console.log('✅ Dados recebidos:', {
      hasBase64: !!response.data?.base64,
      mimeType: response.data?.mimetype,
      fileName: response.data?.fileName,
      size: response.data?.size
    });
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Erro ao descriptografar mídia:', error.message);
    if (error.response) {
      console.error('❌ Status:', error.response.status);
      console.error('❌ Data:', error.response.data);
    }
    throw error;
  }
}

/**
 * 💬 Insere mensagem no banco de dados
 */
async function insertMessage(conversationId, messageType, content, mediaUrl = null) {
  const query = `
    INSERT INTO mensagens (conversas_id, enviador_tipo, enviador_id, tipo_mensagem, conteudo, midia_url)
    VALUES (?, 'cliente', NULL, ?, ?, ?)
  `;
  
  const [result] = await pool.query(query, [
    conversationId, 
    messageType, 
    typeof content === 'string' ? content : JSON.stringify(content),
    mediaUrl
  ]);
  
  return result.insertId;
}

/**
 * 📥 Webhook Z-API - Recebe mensagens enviadas pelo WhatsApp
 */
router.post("/zapi", async (req, res) => {
  try {
    console.log("📩 Webhook recebido:", req.body);

    const { instanceId, phone, chatName, photo } = req.body;

    // Validação básica - precisa ter instanceId e phone
    if (!instanceId || !phone) {
      console.warn("⚠️ Dados básicos incompletos no webhook:", req.body);
      return res.status(400).json({ error: "InstanceId e phone são obrigatórios." });
    }

    // Detecta o tipo de mensagem
    const messageType = detectMessageType(req.body);
    
    if (messageType === 'unknown') {
      console.warn("⚠️ Tipo de mensagem não suportado:", req.body);
      return res.status(400).json({ error: "Tipo de mensagem não suportado." });
    }

    console.log(`📋 Tipo de mensagem detectado: ${messageType}`);

    const customerPhone = phone;
    const customerName = chatName || null;
    const avatarUrl = photo || null;

    // Extrai conteúdo baseado no tipo
    let content, mediaUrl;
    
    switch (messageType) {
      case 'text':
        content = extractTextContent(req.body);
        break;
      case 'audio':
        content = extractAudioContent(req.body);
        mediaUrl = content?.audioUrl || null;
        break;
      case 'photo':
        content = extractPhotoContent(req.body);
        mediaUrl = content?.photoUrl || null;
        break;
      default:
        content = null;
    }

    if (!content) {
      console.warn("⚠️ Conteúdo da mensagem não pôde ser extraído:", req.body);
      return res.status(400).json({ error: "Conteúdo da mensagem não pôde ser extraído." });
    }

    console.log(`🔍 Buscando whatsapp_instance com instance_id = ${instanceId}`);
    const [instanceRows] = await pool.query(
      `SELECT wi.id as whatsapp_instance_id, twi.id as team_whatsapp_instance_id, twi.times_atendimento_id
       FROM instancias wi
       JOIN times_atendimento_instancias twi ON wi.id = twi.instancia_id
       WHERE wi.instancia_id = ?`,
      [instanceId]
    );

    if (instanceRows.length === 0) {
      console.error(`❌ Instância não encontrada para instanceId ${instanceId}`);
      return res.status(404).json({ error: "Instância não encontrada." });
    }

    let { team_whatsapp_instance_id } = instanceRows[0];
    console.log(`✅ Instância encontrada! team_whatsapp_instance_id: ${team_whatsapp_instance_id}`);

    console.log(`🔍 Verificando conversa aberta por telefone a nível de empresa para ${customerPhone}`);
    // Buscar company_id a partir do TWI para evitar duplicidades entre times da mesma empresa
    const companyIdForSearch = await getCompanyIdFromTeamInstance(team_whatsapp_instance_id);
    const [convRows] = await pool.query(
      `SELECT c.id
         FROM conversas c
         JOIN times_atendimento_instancias twi2 ON c.times_atendimento_instancia_id = twi2.id
         JOIN times_atendimento tt ON twi2.times_atendimento_id = tt.id
        WHERE c.telefone = ?
          AND tt.empresa_id = ?
          AND c.status != 'fechada'
        ORDER BY c.atualizado_em DESC
        LIMIT 1`,
      [customerPhone, companyIdForSearch]
    );

    let conversationId;
    let isNewConversation = false;
    let contactId = null;

    if (convRows.length > 0) {
      conversationId = convRows[0].id;
      console.log(`🔁 Conversa já existente encontrada! ID: ${conversationId}`);
    } else {
      console.log("🆕 Criando nova conversa...");
      
      // 🔍 Busca o company_id para gerenciar contatos
      const companyId = companyIdForSearch || await getCompanyIdFromTeamInstance(team_whatsapp_instance_id);

      // Redireciona a conversa para o TWI do time padrão, se existir
      const defaultTwi = await getDefaultTeamTwi(companyId);
      if (defaultTwi) {
        console.log(`🏷️ Direcionando primeira conversa para TWI do time padrão: ${defaultTwi}`);
        team_whatsapp_instance_id = defaultTwi;
      }
      
      if (companyId) {
        // 📞 Resolve ou cria o contato
        try {
          const contact = await resolveOrCreateContact({
            phone: customerPhone,
            companyId: companyId,
            customerName: customerName
          });
          contactId = contact.id;
          console.log(`📇 Contato resolvido/criado: ID ${contactId} - ${contact.nome}`);
        } catch (error) {
          console.error("⚠️ Erro ao resolver contato, continuando sem contact_id:", error);
        }
      }
      
      const [insertConv] = await pool.query(
        `INSERT INTO conversas (times_atendimento_instancia_id, nome, telefone, avatar_url, status, lead_id)
         VALUES (?, ?, ?, ?, 'aberta', ?)`,
        [team_whatsapp_instance_id, customerName, customerPhone, avatarUrl, contactId]
      );
      conversationId = insertConv.insertId;
      isNewConversation = true;
      console.log(`✅ Nova conversa criada com ID: ${conversationId} ${contactId ? `vinculada ao contato ${contactId}` : 'sem contato vinculado'}`);
    }

    console.log(`💬 Inserindo mensagem ${messageType} na conversa ${conversationId}`);
    const messageId = await insertMessage(conversationId, messageType, content, mediaUrl);

    console.log(`✅ Mensagem ${messageType} registrada com sucesso! ID: ${messageId}`);

    // 🔥 NOTIFICAÇÃO WEBSOCKET - Nova mensagem
    const messageData = {
      id: messageId,
      conversation_id: conversationId,
      sender_type: 'customer',
      message_type: messageType,
      content: content,
      media_url: mediaUrl,
      created_at: new Date().toISOString()
    };
    
    MessageHandler.notifyNewMessage(messageData);
    console.log(`🚀 Notificação WebSocket enviada para mensagem ${messageId}`);

    // 🔥 NOTIFICAÇÃO WEBSOCKET - Nova conversa (se for o caso)
    if (isNewConversation) {
      // Busca dados completos da conversa para notificação
      const [convData] = await pool.query(
        `SELECT c.*, twi.times_atendimento_id, t.empresa_id 
         FROM conversas c
         JOIN times_atendimento_instancias twi ON c.times_atendimento_instancia_id = twi.id
         JOIN times_atendimento t ON twi.times_atendimento_id = t.id
         WHERE c.id = ?`,
        [conversationId]
      );
      
      if (convData.length > 0) {
        const conversationData = {
          id: conversationId,
          team_whatsapp_instance_id: team_whatsapp_instance_id,
          customer_name: customerName,
          customer_phone: customerPhone,
          company_id: convData[0].empresa_id,
          status: 'aberta',
          created_at: new Date().toISOString()
        };
        
        ConversationHandler.notifyNewConversation(conversationData);
        console.log(`🚀 Notificação WebSocket enviada para nova conversa ${conversationId}`);
      }
    }

    res.json({ 
      success: true, 
      conversationId, 
      messageId, 
      messageType,
      content: typeof content === 'string' ? content : 'media_content'
    });
  } catch (err) {
    console.error("🚨 Erro ao processar webhook Z-API:", err);
    res.status(500).json({ error: "Erro ao processar webhook." });
  }
});

/**
 * 📥 Webhook Evolution - Recebe mensagens do WhatsApp via Evolution API
 */
router.post("/evolution", async (req, res) => {
  try {
    console.log("📩 Webhook Evolution recebido:", req.body);

    const { event, data } = req.body;
    console.log("🧾 Evolution event:", event, "| keys(data):", data ? Object.keys(data) : null);

    // Ignorar eventos irrelevantes ou sem mensagem
    if (event !== "messages.upsert" || !data?.message) {
      console.log(`ℹ️ Evento '${event}' ignorado ou sem conteúdo de mensagem.`);
      return res.status(200).json({ ignored: true, event });
    }

    // Pega o nome da instância (não o UUID) para usar na Evolution API
    const instanceName = req.body?.instance; // Nome da instância (ex: "TI-teste")
    const instanceId = data?.instanceId; // UUID da instância (para buscar no banco)
    const customerPhone = data?.key?.remoteJid?.replace(/@s\.whatsapp\.net$/, "") || null;
    const customerName = data?.pushName || null;
    const avatarUrl = null; // Evolution não envia avatar

    console.log("🔖 Evolution derivado:", { instanceName, instanceId, customerPhone, customerName });

    if (!instanceId || !customerPhone) {
      console.warn("⚠️ Dados básicos incompletos no webhook Evolution:", req.body);
      return res.status(400).json({ error: "InstanceId e customerPhone são obrigatórios." });
    }

    // Detecta o tipo de mensagem para Evolution
    let messageType, content, mediaUrl;
    
    if (data.message.conversation) {
      messageType = 'text';
      content = data.message.conversation;
    } else if (data.message.audioMessage) {
      messageType = 'audio';
      const audio = data.message.audioMessage;
      
      console.log('🎵 === DADOS DO ÁUDIO EVOLUTION ===');
      console.log('🎵 audioMessage completo:', JSON.stringify(audio, null, 2));
      console.log('🎵 Base64 direto disponível:', audio.base64 ? 'Sim' : 'Não');
      console.log('🎵 === FIM DOS DADOS DO ÁUDIO ===');
      
      let audioUrl = null;
      
      // 🎯 ESTRATÉGIA ROBUSTA PARA ÁUDIO: Priorizar base64 direto, depois descriptografar via API
      if (audio.base64) {
        try {
          console.log('🎯 Usando base64 direto do áudio (Webhook Base64 habilitado)');
          const mimeType = audio.mimetype || 'audio/ogg';
          const base64DataUrl = `data:${mimeType};base64,${audio.base64}`;
          
          // Upload do base64 direto para Cloudinary
          const cloudinaryResult = await uploadAudioToCloudinary(base64DataUrl);
          audioUrl = cloudinaryResult.url;
          console.log('✅ Base64 direto do áudio enviado para Cloudinary:', audioUrl);
          
        } catch (error) {
          console.warn('⚠️ Erro no upload do base64 direto para Cloudinary:', error.message);
          // Fallback: tentar descriptografar via API
          try {
            const decryptedMedia = await decryptMediaFromEvolution(
              instanceName, 
              data.key.id, 
              data.key.remoteJid
            );
            
            if (decryptedMedia?.base64) {
              const mimeType = decryptedMedia.mimetype || audio.mimetype || 'audio/ogg';
              const base64DataUrl = `data:${mimeType};base64,${decryptedMedia.base64}`;
              
              const cloudinaryResult = await uploadAudioToCloudinary(base64DataUrl);
              audioUrl = cloudinaryResult.url;
              console.log('✅ Áudio descriptografado enviado para Cloudinary:', audioUrl);
            }
          } catch (decryptError) {
            console.error('❌ Erro na descriptografia do áudio via API:', decryptError.message);
            // Último fallback: base64 direto
            const mimeType = audio.mimetype || 'audio/ogg';
            audioUrl = `data:${mimeType};base64,${audio.base64}`;
          }
        }
      } else {
        // 🔓 SEM BASE64 DIRETO: Descriptografar via Evolution API
        try {
          console.log('🔓 Base64 direto não disponível, descriptografando áudio via Evolution API...');
          const decryptedMedia = await decryptMediaFromEvolution(
            instanceName, 
            data.key.id, 
            data.key.remoteJid
          );
          
          if (decryptedMedia?.base64) {
            const mimeType = decryptedMedia.mimetype || audio.mimetype || 'audio/ogg';
            const base64DataUrl = `data:${mimeType};base64,${decryptedMedia.base64}`;
            
            console.log('🔓 Áudio descriptografado:', {
              mimeType: mimeType,
              base64Length: decryptedMedia.base64.length,
              fileName: decryptedMedia.fileName,
              size: decryptedMedia.size
            });
            
            // Upload para Cloudinary
            const cloudinaryResult = await uploadAudioToCloudinary(base64DataUrl);
            audioUrl = cloudinaryResult.url;
            console.log('✅ Áudio descriptografado enviado para Cloudinary:', audioUrl);
            console.log('✅ Resultado completo do Cloudinary:', JSON.stringify(cloudinaryResult, null, 2));
            
          } else {
            console.warn('⚠️ Áudio descriptografado sem base64 válido');
            audioUrl = audio.url || null;
          }
          
        } catch (error) {
          console.error('❌ Erro na descriptografia do áudio via Evolution API:', error.message);
          console.error('❌ Stack trace completo:', error.stack);
          audioUrl = audio.url || null;
        }
      }
      
      content = {
        audioUrl: audioUrl,
        mimeType: audio.mimetype || 'audio/ogg',
        seconds: audio.seconds || 0,
        ptt: audio.ptt || false
      };
      mediaUrl = audioUrl;
    } else if (data.message.imageMessage) {
      messageType = 'image';
      const image = data.message.imageMessage;
      
      // 🔍 LOG DETALHADO DA IMAGEM RECEBIDA
      console.log('📸 === DADOS DA IMAGEM EVOLUTION ===');
      console.log('📸 imageMessage completo:', JSON.stringify(image, null, 2));
      console.log('📸 URL da imagem:', image.url);
      console.log('📸 Mime type:', image.mimetype);
      console.log('📸 Caption:', image.caption);
      console.log('📸 File size:', image.fileLength);
      console.log('📸 Height:', image.height);
      console.log('📸 Width:', image.width);
      console.log('📸 Thumbnail:', image.jpegThumbnail ? 'Sim' : 'Não');
      
      // 🔍 VERIFICAR SE TEM BASE64 DIRETO
      console.log('📸 Base64 direto disponível:', image.base64 ? 'Sim' : 'Não');
      if (image.base64) {
        console.log('📸 Tamanho do base64 direto:', image.base64.length, 'caracteres');
        console.log('📸 Primeiros 100 chars do base64:', image.base64.substring(0, 100) + '...');
      }
      
      console.log('📸 === FIM DOS DADOS DA IMAGEM ===');
      
      let imageUrl = null;
      
      // 🎯 ESTRATÉGIA ROBUSTA: Priorizar base64 direto, depois descriptografar via API
      if (image.base64) {
        try {
          console.log('🎯 Usando base64 direto do Evolution (Webhook Base64 habilitado)');
          const mimeType = image.mimetype || 'image/jpeg';
          const base64DataUrl = `data:${mimeType};base64,${image.base64}`;
          
          console.log('🎯 Mime type para upload:', mimeType);
          console.log('🎯 Tamanho do base64 direto:', image.base64.length, 'caracteres');
          
          // Upload do base64 direto para Cloudinary
          const cloudinaryResult = await uploadImageToCloudinary(base64DataUrl);
          imageUrl = cloudinaryResult.url;
          console.log('✅ Base64 direto enviado para Cloudinary:', imageUrl);
          console.log('✅ Resultado completo do Cloudinary:', JSON.stringify(cloudinaryResult, null, 2));
          
        } catch (error) {
          console.warn('⚠️ Erro no upload do base64 direto para Cloudinary:', error.message);
          console.warn('⚠️ Stack trace completo:', error.stack);
          // Fallback: tentar descriptografar via API
          console.log('🔄 Fallback: tentando descriptografar via Evolution API...');
          try {
            const decryptedMedia = await decryptMediaFromEvolution(
              instanceName, 
              data.key.id, 
              data.key.remoteJid
            );
            
            if (decryptedMedia?.base64) {
              const mimeType = decryptedMedia.mimetype || image.mimetype || 'image/jpeg';
              const base64DataUrl = `data:${mimeType};base64,${decryptedMedia.base64}`;
              
              const cloudinaryResult = await uploadImageToCloudinary(base64DataUrl);
              imageUrl = cloudinaryResult.url;
              console.log('✅ Mídia descriptografada enviada para Cloudinary:', imageUrl);
            }
          } catch (decryptError) {
            console.error('❌ Erro na descriptografia via API:', decryptError.message);
            // Último fallback: URL original (pode falhar)
            if (image.url) {
              console.log('🔄 Último fallback: usando URL original...');
              imageUrl = image.url;
            }
          }
        }
      } else {
        // 🔓 SEM BASE64 DIRETO: Descriptografar via Evolution API
        try {
          console.log('🔓 Base64 direto não disponível, descriptografando via Evolution API...');
          const decryptedMedia = await decryptMediaFromEvolution(
            instanceName, 
            data.key.id, 
            data.key.remoteJid
          );
          
          if (decryptedMedia?.base64) {
            const mimeType = decryptedMedia.mimetype || image.mimetype || 'image/jpeg';
            const base64DataUrl = `data:${mimeType};base64,${decryptedMedia.base64}`;
            
            console.log('🔓 Mídia descriptografada:', {
              mimeType: mimeType,
              base64Length: decryptedMedia.base64.length,
              fileName: decryptedMedia.fileName,
              size: decryptedMedia.size
            });
            
            // Upload para Cloudinary
            const cloudinaryResult = await uploadImageToCloudinary(base64DataUrl);
            imageUrl = cloudinaryResult.url;
            console.log('✅ Mídia descriptografada enviada para Cloudinary:', imageUrl);
            console.log('✅ Resultado completo do Cloudinary:', JSON.stringify(cloudinaryResult, null, 2));
            
          } else {
            console.warn('⚠️ Mídia descriptografada sem base64 válido');
            // Fallback para URL original (pode falhar)
            if (image.url) {
              console.log('🔄 Fallback: usando URL original...');
              imageUrl = image.url;
            }
          }
          
        } catch (error) {
          console.error('❌ Erro na descriptografia via Evolution API:', error.message);
          console.error('❌ Stack trace completo:', error.stack);
          
          // Último fallback: tentar baixar URL original (pode falhar com arquivos .enc)
          if (image.url) {
            try {
              console.log('🔄 Último fallback: tentando baixar URL original...');
              console.log('☁️ URL de origem:', image.url);
              
              const response = await fetch(image.url);
              console.log('☁️ Status da resposta:', response.status);
              
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                console.log('☁️ Tamanho do arquivo baixado:', arrayBuffer.byteLength, 'bytes');
                
                const base64 = Buffer.from(arrayBuffer).toString('base64');
                const mimeType = image.mimetype || 'image/jpeg';
                const base64DataUrl = `data:${mimeType};base64,${base64}`;
                
                const cloudinaryResult = await uploadImageToCloudinary(base64DataUrl);
                imageUrl = cloudinaryResult.url;
                console.log('✅ URL original baixada e enviada para Cloudinary:', imageUrl);
              } else {
                console.warn('⚠️ URL original retornou erro:', response.status);
                imageUrl = image.url; // Manter URL mesmo que falhe
              }
              
            } catch (fetchError) {
              console.warn('⚠️ Erro ao baixar URL original:', fetchError.message);
              imageUrl = image.url; // Manter URL mesmo que falhe
            }
          } else {
            console.warn('⚠️ Imagem sem URL disponível');
          }
        }
      }
      
      content = image.caption || 'Imagem';
      mediaUrl = imageUrl;
      
      console.log('📸 Resumo final da imagem:');
      console.log('📸 - Tipo de mensagem:', messageType);
      console.log('📸 - Conteúdo:', content);
      console.log('📸 - URL da mídia:', mediaUrl);
    } else if (data.message.videoMessage) {
      messageType = 'video';
      const video = data.message.videoMessage;
      
      console.log('🎥 === DADOS DO VÍDEO EVOLUTION ===');
      console.log('🎥 videoMessage completo:', JSON.stringify(video, null, 2));
      console.log('🎥 Base64 direto disponível:', video.base64 ? 'Sim' : 'Não');
      console.log('🎥 === FIM DOS DADOS DO VÍDEO ===');
      
      let videoUrl = null;
      
      // 🎯 ESTRATÉGIA ROBUSTA PARA VÍDEO: Priorizar base64 direto, depois descriptografar via API
      if (video.base64) {
        try {
          console.log('🎯 Usando base64 direto do vídeo (Webhook Base64 habilitado)');
          const mimeType = video.mimetype || 'video/mp4';
          const base64DataUrl = `data:${mimeType};base64,${video.base64}`;
          
          // Upload do base64 direto para Cloudinary
          const cloudinaryResult = await uploadVideoToCloudinary(base64DataUrl);
          videoUrl = cloudinaryResult.url;
          console.log('✅ Base64 direto do vídeo enviado para Cloudinary:', videoUrl);
          
        } catch (error) {
          console.warn('⚠️ Erro no upload do base64 direto para Cloudinary:', error.message);
          // Fallback: tentar descriptografar via API
          try {
            const decryptedMedia = await decryptMediaFromEvolution(
              instanceName, 
              data.key.id, 
              data.key.remoteJid
            );
            
            if (decryptedMedia?.base64) {
              const mimeType = decryptedMedia.mimetype || video.mimetype || 'video/mp4';
              const base64DataUrl = `data:${mimeType};base64,${decryptedMedia.base64}`;
              
              const cloudinaryResult = await uploadVideoToCloudinary(base64DataUrl);
              videoUrl = cloudinaryResult.url;
              console.log('✅ Vídeo descriptografado enviado para Cloudinary:', videoUrl);
            }
          } catch (decryptError) {
            console.error('❌ Erro na descriptografia do vídeo via API:', decryptError.message);
            // Último fallback: base64 direto
            const mimeType = video.mimetype || 'video/mp4';
            videoUrl = `data:${mimeType};base64,${video.base64}`;
          }
        }
      } else {
        // 🔓 SEM BASE64 DIRETO: Descriptografar via Evolution API
        try {
          console.log('🔓 Base64 direto não disponível, descriptografando vídeo via Evolution API...');
          const decryptedMedia = await decryptMediaFromEvolution(
            instanceName, 
            data.key.id, 
            data.key.remoteJid
          );
          
          if (decryptedMedia?.base64) {
            const mimeType = decryptedMedia.mimetype || video.mimetype || 'video/mp4';
            const base64DataUrl = `data:${mimeType};base64,${decryptedMedia.base64}`;
            
            console.log('🔓 Vídeo descriptografado:', {
              mimeType: mimeType,
              base64Length: decryptedMedia.base64.length,
              fileName: decryptedMedia.fileName,
              size: decryptedMedia.size
            });
            
            // Upload para Cloudinary
            const cloudinaryResult = await uploadVideoToCloudinary(base64DataUrl);
            videoUrl = cloudinaryResult.url;
            console.log('✅ Vídeo descriptografado enviado para Cloudinary:', videoUrl);
            console.log('✅ Resultado completo do Cloudinary:', JSON.stringify(cloudinaryResult, null, 2));
            
          } else {
            console.warn('⚠️ Vídeo descriptografado sem base64 válido');
            videoUrl = video.url || null;
          }
          
        } catch (error) {
          console.error('❌ Erro na descriptografia do vídeo via Evolution API:', error.message);
          console.error('❌ Stack trace completo:', error.stack);
          videoUrl = video.url || null;
        }
      }
      
      content = {
        videoUrl: videoUrl,
        caption: video.caption || null
      };
      mediaUrl = videoUrl;
      
    } else if (data.message.documentMessage) {
      messageType = 'file'; // Mapear para 'file' para compatibilidade com a tabela
      const doc = data.message.documentMessage;
      
      console.log('📄 === DADOS DO DOCUMENTO EVOLUTION ===');
      console.log('📄 documentMessage completo:', JSON.stringify(doc, null, 2));
      console.log('📄 Base64 direto disponível:', doc.base64 ? 'Sim' : 'Não');
      console.log('📄 === FIM DOS DADOS DO DOCUMENTO ===');
      
      let documentUrl = null;
      
      // 🎯 ESTRATÉGIA ROBUSTA PARA DOCUMENTO: Priorizar base64 direto, depois descriptografar via API, depois upload para Cloudinary
      if (doc.base64) {
        try {
          console.log('🎯 Usando base64 direto do documento (Webhook Base64 habilitado)');
          const mimeType = doc.mimetype || 'application/octet-stream';
          const fileName = doc.fileName || 'documento';
          const base64DataUrl = `data:${mimeType};base64,${doc.base64}`;
          
          // 📄 Upload para Cloudinary
          try {
            const cloudinaryResult = await uploadDocumentToCloudinary(
              base64DataUrl,
              fileName,
              mimeType,
              'aura8-documents'
            );
            documentUrl = cloudinaryResult.url;
            console.log('✅ Documento enviado para Cloudinary:', cloudinaryResult.url);
          } catch (cloudinaryError) {
            console.warn('⚠️ Erro no upload para Cloudinary, usando base64:', cloudinaryError.message);
            documentUrl = base64DataUrl;
          }
          
        } catch (error) {
          console.warn('⚠️ Erro no processamento do base64 direto do documento:', error.message);
          // Fallback: tentar descriptografar via API
          try {
            const decryptedMedia = await decryptMediaFromEvolution(
              instanceName, 
              data.key.id, 
              data.key.remoteJid
            );
            
            if (decryptedMedia?.base64) {
              const mimeType = decryptedMedia.mimetype || doc.mimetype || 'application/octet-stream';
              const fileName = decryptedMedia.fileName || doc.fileName || 'documento';
              const base64DataUrl = `data:${mimeType};base64,${decryptedMedia.base64}`;
              
              // 📄 Upload para Cloudinary
              try {
                const cloudinaryResult = await uploadDocumentToCloudinary(
                  base64DataUrl,
                  fileName,
                  mimeType,
                  'aura8-documents'
                );
                documentUrl = cloudinaryResult.url;
                console.log('✅ Documento descriptografado e enviado para Cloudinary:', cloudinaryResult.url);
              } catch (cloudinaryError) {
                console.warn('⚠️ Erro no upload para Cloudinary, usando base64:', cloudinaryError.message);
                documentUrl = base64DataUrl;
              }
            }
          } catch (decryptError) {
            console.error('❌ Erro na descriptografia do documento via API:', decryptError.message);
            documentUrl = doc.url || null;
          }
        }
      } else {
        // 🔓 SEM BASE64 DIRETO: Descriptografar via Evolution API
        try {
          console.log('🔓 Base64 direto não disponível, descriptografando documento via Evolution API...');
          const decryptedMedia = await decryptMediaFromEvolution(
            instanceName, 
            data.key.id, 
            data.key.remoteJid
          );
          
          if (decryptedMedia?.base64) {
            const mimeType = decryptedMedia.mimetype || doc.mimetype || 'application/octet-stream';
            const fileName = decryptedMedia.fileName || doc.fileName || 'documento';
            const base64DataUrl = `data:${mimeType};base64,${decryptedMedia.base64}`;
            
            // 📄 Upload para Cloudinary
            try {
              const cloudinaryResult = await uploadDocumentToCloudinary(
                base64DataUrl,
                fileName,
                mimeType,
                'aura8-documents'
              );
              documentUrl = cloudinaryResult.url;
              console.log('✅ Documento descriptografado e enviado para Cloudinary:', cloudinaryResult.url);
            } catch (cloudinaryError) {
              console.warn('⚠️ Erro no upload para Cloudinary, usando base64:', cloudinaryError.message);
              documentUrl = base64DataUrl;
            }
          } else {
            documentUrl = doc.url || null;
          }
          
        } catch (error) {
          console.error('❌ Erro na descriptografia do documento via Evolution API:', error.message);
          documentUrl = doc.url || null;
        }
      }
      
      content = {
        documentUrl: documentUrl,
        fileName: doc.fileName || null,
        mimeType: doc.mimetype || null
      };
      mediaUrl = documentUrl;
    } else {
      console.warn("⚠️ Tipo de mensagem Evolution não suportado:", data.message);
      return res.status(400).json({ error: "Tipo de mensagem não suportado." });
    }

    console.log(`📋 Tipo de mensagem Evolution detectado: ${messageType}`);
    console.log("🧱 Evolution conteúdo resumido:", {
      hasContent: !!content,
      mediaUrl: mediaUrl || null,
      caption: typeof content === 'object' ? (content.caption || null) : null,
      length: typeof content === 'string' ? content.length : null
    });

    if (!content) {
      console.warn("⚠️ Conteúdo da mensagem Evolution não pôde ser extraído:", req.body);
      return res.status(400).json({ error: "Conteúdo da mensagem não pôde ser extraído." });
    }

    // 🔍 Busca a instância correta pela coluna `instancias.instancia_id`
    const [instanceRows] = await pool.query(
      `SELECT wi.id AS whatsapp_instance_id, twi.id AS team_whatsapp_instance_id
       FROM instancias wi
       JOIN times_atendimento_instancias twi ON wi.id = twi.instancia_id
       WHERE wi.instancia_id = ?`,
      [instanceId]
    );

    if (instanceRows.length === 0) {
      console.error(`❌ Instância não encontrada para instance_id: ${instanceId}`);
      return res.status(404).json({ error: "Instância não encontrada." });
    }

    let { team_whatsapp_instance_id } = instanceRows[0];
    console.log(`✅ Instância encontrada! team_whatsapp_instance_id: ${team_whatsapp_instance_id} | rows: ${instanceRows.length}`);

    // 🔁 Verifica se já existe uma conversa em aberto com o número na mesma empresa
    const companyIdForSearch = await getCompanyIdFromTeamInstance(team_whatsapp_instance_id);
    const [convRows] = await pool.query(
      `SELECT c.id
         FROM conversas c
         JOIN times_atendimento_instancias twi2 ON c.times_atendimento_instancia_id = twi2.id
         JOIN times_atendimento tt ON twi2.times_atendimento_id = tt.id
        WHERE c.telefone = ?
          AND tt.empresa_id = ?
          AND c.status != 'fechada'
        ORDER BY c.atualizado_em DESC
        LIMIT 1`,
      [customerPhone, companyIdForSearch]
    );

    let conversationId;
    let isNewConversation = false;
    let contactId = null;

    if (convRows.length > 0) {
      conversationId = convRows[0].id;
      console.log(`🔁 Conversa já existente encontrada! ID: ${conversationId} | matches: ${convRows.length}`);
    } else {
      console.log("🆕 Criando nova conversa Evolution...");
      
      // 🔍 Busca o company_id para gerenciar contatos
      const companyId = companyIdForSearch || await getCompanyIdFromTeamInstance(team_whatsapp_instance_id);

      // Redireciona a conversa para o TWI do time padrão, se existir
      const defaultTwi = await getDefaultTeamTwi(companyId);
      if (defaultTwi) {
        console.log(`🏷️ Direcionando primeira conversa para TWI do time padrão: ${defaultTwi}`);
        team_whatsapp_instance_id = defaultTwi;
      }
      
      if (companyId) {
        // 📞 Resolve ou cria o contato
        try {
          const contact = await resolveOrCreateContact({
            phone: customerPhone,
            companyId: companyId,
            customerName: customerName
          });
          contactId = contact.id;
          console.log(`📇 Contato Evolution resolvido/criado: ID ${contactId} - ${contact.nome}`);
        } catch (error) {
          console.error("⚠️ Erro ao resolver contato Evolution, continuando sem contact_id:", error);
        }
      }
      
      const [insertConv] = await pool.query(
        `INSERT INTO conversas (times_atendimento_instancia_id, nome, telefone, avatar_url, status, lead_id)
         VALUES (?, ?, ?, ?, 'aberta', ?)`,
        [team_whatsapp_instance_id, customerName, customerPhone, avatarUrl, contactId]
      );
      conversationId = insertConv.insertId;
      isNewConversation = true;
      console.log(`✅ Nova conversa Evolution criada com ID: ${conversationId} ${contactId ? `vinculada ao contato ${contactId}` : 'sem contato vinculado'}`);
    }

    // 💬 Insere a nova mensagem
    console.log(`💬 Inserindo mensagem ${messageType} na conversa ${conversationId}`);
    const messageId = await insertMessage(conversationId, messageType, content, mediaUrl);

    console.log(`✅ Mensagem ${messageType} registrada com sucesso! ID: ${messageId}`);

    // 🔗 WEBHOOK - Enfileirar evento MESSAGE_RECEIVED
    try {
      console.log('🔗 Processando webhook para mensagem recebida...');
      
      // Buscar dados completos da mensagem e conversa para o webhook
      const [messageRows] = await pool.query(
        `SELECT id, tipo_mensagem, conteudo, midia_url, criado_em 
         FROM mensagens 
         WHERE id = ?`,
        [messageId]
      );
      
      const [conversationRows] = await pool.query(
        `SELECT id, times_atendimento_instancia_id, telefone, nome 
         FROM conversas 
         WHERE id = ?`,
        [conversationId]
      );
      
      if (messageRows.length > 0 && conversationRows.length > 0) {
        const messageRow = messageRows[0];
        const conversationRow = conversationRows[0];
        
        // Montar payload do webhook
        const { companyId, payload } = await buildMessageReceivedPayload(messageRow, conversationRow);
        
        // Enfileirar evento para todos os webhooks da empresa
        const result = await enqueueWebhookEvent({
          companyId,
          eventType: "MESSAGE_RECEIVED",
          payload
        });
        
        console.log(`🔗 Webhook enfileirado: ${result.enqueued} eventos para empresa ${companyId}`);
      } else {
        console.warn('⚠️ Dados da mensagem ou conversa não encontrados para webhook');
      }
    } catch (webhookError) {
      console.error('❌ Erro ao processar webhook (não crítico):', webhookError.message);
      // Não quebra o fluxo principal - apenas loga o erro
    }

    // 🔥 NOTIFICAÇÃO WEBSOCKET - Nova mensagem
    const messageData = {
      id: messageId,
      conversation_id: conversationId,
      sender_type: 'customer',
      message_type: messageType,
      content: content,
      media_url: mediaUrl,
      created_at: new Date().toISOString()
    };

    messageData.conversationId = conversationId;
    console.log('🧮 messageData resumido (pré-WS):', {
      id: messageData.id,
      conversation_id: messageData.conversation_id,
      message_type: messageData.message_type,
      hasContent: !!messageData.content,
      media_url: messageData.media_url || null
    });

    MessageHandler.notifyNewMessage(messageData);
    console.log(`🚀 Notificação WebSocket enviada para mensagem ${messageId}`);

    // 🔥 NOTIFICAÇÃO WEBSOCKET - Nova conversa (se for o caso)
    if (isNewConversation) {
      // Busca dados completos da conversa para notificação
      const [convData] = await pool.query(
        `SELECT c.*, twi.times_atendimento_id, t.empresa_id 
         FROM conversas c
         JOIN times_atendimento_instancias twi ON c.times_atendimento_instancia_id = twi.id
         JOIN times_atendimento t ON twi.times_atendimento_id = t.id
         WHERE c.id = ?`,
        [conversationId]
      );
      
      if (convData.length > 0) {
        const conversationData = {
          id: conversationId,
          team_whatsapp_instance_id: team_whatsapp_instance_id,
          customer_name: customerName,
          customer_phone: customerPhone,
          company_id: convData[0].empresa_id,
          status: 'aberta',
          created_at: new Date().toISOString()
        };
        
        ConversationHandler.notifyNewConversation(conversationData);
        console.log(`🚀 Notificação WebSocket enviada para nova conversa ${conversationId}`);
      }
    }

    res.json({ 
      success: true, 
      conversationId, 
      messageId, 
      messageType,
      content: typeof content === 'string' ? content : 'media_content'
    });

  } catch (err) {
    console.error("🚨 Erro ao processar webhook Evolution:", err);
    res.status(500).json({ error: "Erro ao processar webhook." });
  }
});

module.exports = router;
