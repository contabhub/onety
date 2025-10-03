const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const authOrApiKey = require("../../middlewares/authOrApiKey");
const axios = require('axios');

/**
 * 📌 Criar nova instância do WhatsApp
 */
router.post("/", authOrApiKey, async (req, res) => {
  try {
    const {
      empresa_id,
      instancia_nome,
      instancia_id,
      token,
      cliente_token,
      status,
      telefone,
      integracao_tipo
    } = req.body;

    if (!empresa_id || !instancia_nome || !instancia_id || !token || !cliente_token) {
      return res.status(400).json({ error: "Campos obrigatórios: empresa_id, instancia_nome, instancia_id, token, cliente_token." });
    }

    const [result] = await pool.query(
      `INSERT INTO instancias 
      (empresa_id, instancia_nome, instancia_id, token, cliente_token, status, telefone, integracao_tipo) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresa_id, instancia_nome, instancia_id, token, cliente_token, status || 'desconectado', telefone || null, integracao_tipo || 'zapi']
    );

    res.status(201).json({
      id: result.insertId,
      empresa_id,
      instancia_nome,
      instancia_id,
      token,
      cliente_token,
      status: status || 'desconectado',
      telefone,
      integracao_tipo
    });
  } catch (err) {
    console.error("Erro ao criar instância:", err);
    res.status(500).json({ error: "Erro ao criar instância." });
  }
});

/**
 * 📌 Listar todas as instâncias
 */
router.get("/", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM instancias");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar instâncias." });
  }
});

/**
 * 📌 Buscar instância por ID
 */
router.get("/:id", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM instancias WHERE id = ?", [req.params.id]);

    if (rows.length === 0) return res.status(404).json({ error: "Instância não encontrada." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar instância." });
  }
});

/**
 * 🏢 Buscar todas as instâncias de uma empresa
 * GET /empresa/:empresaId
 */
router.get("/empresa/:empresaId", authOrApiKey, async (req, res) => {
  try {
    const { empresaId } = req.params;

    const [rows] = await pool.query(
      "SELECT * FROM instancias WHERE empresa_id = ?",
      [empresaId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar instâncias por empresa:", err);
    res.status(500).json({ error: "Erro ao buscar instâncias por empresa." });
  }
});


/**
 * 📌 Atualizar dados da instância (ex.: mudar nome, número ou tokens)
 */
router.put("/:id", authOrApiKey, async (req, res) => {
  try {
    const { instancia_nome, telefone, status } = req.body;

    await pool.query(
      "UPDATE instancias SET instancia_nome = ?, telefone = ?, status = ? WHERE id = ?",
      [instancia_nome, telefone || null, status || 'desconectado', req.params.id]
    );

    res.json({ id: req.params.id, instancia_nome, telefone, status });
  } catch (err) {
    console.error("Erro ao atualizar instância:", err);
    res.status(500).json({ error: "Erro ao atualizar instância." });
  }
});

/**
 * 📌 Atualizar QR Code (base64 + data de expiração)
 */
router.put("/:id/qr", authOrApiKey, async (req, res) => {
  try {
    const { ultimo_qr_code, qr_expira_em } = req.body;

    if (!ultimo_qr_code || !qr_expira_em) {
      return res.status(400).json({ error: "ultimo_qr_code e qr_expira_em são obrigatórios." });
    }

    await pool.query(
      "UPDATE instancias SET ultimo_qr_code = ?, qr_expira_em = ? WHERE id = ?",
      [ultimo_qr_code, qr_expira_em, req.params.id]
    );

    res.json({ id: req.params.id, ultimo_qr_code, qr_expira_em });
  } catch (err) {
    console.error("Erro ao atualizar QR Code:", err);
    res.status(500).json({ error: "Erro ao atualizar QR Code." });
  }
});

/**
 * 📌 Deletar instância
 */
router.delete("/:id", authOrApiKey, async (req, res) => {
  try {
    await pool.query("DELETE FROM whatsapp_instances WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar instância." });
  }
});



// Z-API  ROTAS


// 📌 Buscar QR Code na Z-API e devolver imagem direto
router.get('/:id/qr-code', authOrApiKey, async (req, res) => {
    try {
      // 🔍 Buscar dados da instância no banco
      const [rows] = await pool.query("SELECT * FROM instancias WHERE id = ?", [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: "Instância não encontrada." });
  
      const instance = rows[0];
  
      // 🌐 Chamar Z-API para pegar QR code em base64
      const response = await axios.get(
        `https://api.z-api.io/instances/${instance.instancia_id}/token/${instance.token}/qr-code/image`,
        {
          headers: { 'Client-Token': instance.cliente_token }
        }
      );
  
      // ✅ Pega só a string base64
      const qrCodeBase64 = response.data.value;
  
      // 📥 Atualiza QR Code no banco
      await pool.query(
        "UPDATE instancias SET ultimo_qr_code = ?, qr_expira_em = DATE_ADD(NOW(), INTERVAL 20 SECOND) WHERE id = ?",
        [qrCodeBase64, instance.id]
      );
  
      // 🔄 Converte base64 para buffer
      const imgBuffer = Buffer.from(qrCodeBase64.split(',')[1], 'base64');
  
      // 📤 Define o cabeçalho de imagem e envia
      res.setHeader('Content-Type', 'image/png');
      res.send(imgBuffer);
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao buscar QR Code na Z-API." });
    }
  });
  
  

  /**
 * 📴 Desconectar instância do WhatsApp (Z-API)
 */
router.get('/:id/disconnect', authOrApiKey, async (req, res) => {
    try {
      // 🔍 Buscar dados da instância no banco
      const [rows] = await pool.query("SELECT * FROM instancias WHERE id = ?", [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: "Instância não encontrada." });
  
      const instance = rows[0];
  
      // 🌐 Chamar Z-API para desconectar
      const response = await axios.get(
        `https://api.z-api.io/instances/${instance.instancia_id}/token/${instance.token}/disconnect`,
        {
          headers: { 'Client-Token': instance.cliente_token }
        }
      );
  
      // 🔄 Atualizar status da instância para 'desconectado'
      await pool.query(
        "UPDATE instancias SET status = 'desconectado', ultimo_qr_code = NULL, qr_expira_em = NULL WHERE id = ?",
        [instance.id]
      );
  
      res.json({ message: "Instância desconectada com sucesso", zapi_response: response.data });
    } catch (error) {
      console.error("Erro ao desconectar instância:", error.message);
      res.status(500).json({ error: "Erro ao desconectar instância do WhatsApp." });
    }
  });


  /**
 * 📊 Verificar status da instância (Z-API)
 */
router.get('/:id/status', authOrApiKey, async (req, res) => {
  try {
    // 🔍 Buscar instância no banco
    const [rows] = await pool.query("SELECT * FROM instancias WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Instância não encontrada." });

    const instance = rows[0];

    // 🌐 Chamar Z-API para verificar status
    const response = await axios.get(
      `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.token}/status`,
      {
        headers: { 'Client-Token': instance.client_token }
      }
    );

    const { connected, smartphoneConnected, error } = response.data;

    // 🔄 Definir status local baseado na resposta do Z-API
    let newStatus = 'desconectado';
    if (connected && smartphoneConnected) {
      newStatus = 'conectado';
    } else if (connected && !smartphoneConnected) {
      newStatus = 'conectando'; // exemplo de status intermediário
    }

    // 📝 Atualizar status no banco
    await pool.query(
      "UPDATE instancias SET status = ? WHERE id = ?",
      [newStatus, instance.id]
    );

    res.json({
      instance_id: instance.id,
      status: newStatus,
      zapi_response: response.data
    });
  } catch (error) {
    console.error("Erro ao consultar status da instância:", error.message);
    res.status(500).json({ error: "Erro ao consultar status da instância no Z-API." });
  }
});




// EVOLUTION ROTAS
/**
 * 🚀 Criar nova instância Evolution API
 */

router.post('/evolution/create', authOrApiKey, async (req, res) => {
  try {
    const {
      empresa_id,
      instanceName,
      integration,
      token,
      integracao_tipo
    } = req.body;

    const generatedToken = token || Math.floor(100000 + Math.random() * 900000).toString();

    console.log("📥 Recebido para criação da instância:", {
      empresa_id,
      instanceName,
      integration,
      token: generatedToken,
      integracao_tipo
    });

    // 🔗 Criar instância na Evolution
    const response = await axios.post(
      `https://evolution-evolution-api.hdolfr.easypanel.host/instance/create`,
      {
        instanceName,
        integration,
        token: generatedToken,
        integracao_tipo
      },
      {
        headers: {
          apikey: process.env.EVOLUTION_API_KEY
        }
      }
    );

    const data = response.data;

    console.log("✅ Resposta da Evolution API:", data);

    const instanceId = data.instance?.instanceId;
    const originalStatus = data.instance?.status?.toLowerCase() || 'desconectado';

    // 🔄 Corrigir status "close" → "desconectado"
    const statusConvertido = (originalStatus === 'close') ? 'desconectado' : originalStatus;

    // 🔐 Corrigir client_token nulo para string vazia
    const safeClientToken = data.instance?.accessTokenWaBusiness || "";

    // Salvar no banco
    const [result] = await pool.query(
      `INSERT INTO instancias 
        (empresa_id, instancia_nome, instancia_id, token, cliente_token, status, telefone, integracao_tipo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresa_id,
        instanceName,
        instanceId,
        generatedToken,
        safeClientToken,
        statusConvertido,
        null,
        'evolution'
      ]
    );

    console.log(`📦 Instância salva no banco com ID interno: ${result.insertId}`);

    res.status(201).json({
      id: result.insertId,
      evolution: {
        instance_id: instanceId,
        instance_name: instanceName,
        token: generatedToken,
        status: statusConvertido,
        integration_type: 'evolution'
      }
    });

  } catch (error) {
    const errMsg = error.response?.data || error.message;
    console.error("🚨 Erro ao criar instância Evolution:", errMsg);
    res.status(500).json({
      error: "Erro ao criar instância via Evolution API",
      details: errMsg
    });
  }
});


/**
 * 📸 Gerar QR Code da instância Evolution
 * GET /evolution/qr/:instanceName
 */
router.get("/evolution/qrcode/:instanceName", authOrApiKey, async (req, res) => {
  try {
    const { instanceName } = req.params;

    // 🔗 Conectar à instância e gerar QR
    const response = await axios.get(
      `https://evolution-evolution-api.hdolfr.easypanel.host/instance/connect/${instanceName}`,
      {
        headers: {
          apikey: process.env.EVOLUTION_API_KEY
        }
      }
    );

    const { base64, code, pairingCode } = response.data;

    if (!base64) {
      return res.status(404).json({
        error: "QR Code não retornado pela Evolution API.",
        response: response.data
      });
    }

    // 📤 Retorna imagem base64 direto
    const imgBuffer = Buffer.from(base64.split(",")[1], "base64");
    res.setHeader("Content-Type", "image/png");
    res.send(imgBuffer);

  } catch (error) {
    console.error("🚨 Erro ao obter QR da Evolution:", error.response?.data || error.message);
    res.status(500).json({
      error: "Erro ao obter QR Code da Evolution API",
      details: error.response?.data || error.message
    });
  }
});


/**
 * 🔍 Consultar estado de conexão da instância (Evolution)
 * GET /evolution/status/:instanceName
 */
router.get("/evolution/status/:instanceName", authOrApiKey, async (req, res) => {
  try {
    const { instanceName } = req.params;

    const response = await axios.get(
      `https://evolution-evolution-api.hdolfr.easypanel.host/instance/connectionState/${instanceName}`,
      {
        headers: {
          apikey: process.env.EVOLUTION_API_KEY
        }
      }
    );

    const { instance } = response.data;

    if (!instance) {
      return res.status(404).json({
        error: "Instância não encontrada na Evolution API"
      });
    }

    // 🔄 Mapear status Evolution → banco
    const statusMap = {
      open: 'conectado',
      connecting: 'conectando',
      close: 'desconectado',
      closed: 'desconectado'
    };

    const apiStatus = instance?.state?.toLowerCase() || 'desconectado';
    const mappedStatus = statusMap[apiStatus] || 'desconectado';

    // 📝 Atualizar status no banco apenas se for integração Evolution
    await pool.query(
      "UPDATE instancias SET status = ? WHERE instancia_nome = ? AND integracao_tipo = 'evolution'",
      [mappedStatus, instanceName]
    );

    res.status(200).json({
      instance_name: instance.instanceName,
      connection_state: mappedStatus
    });

  } catch (error) {
    console.error("Erro ao consultar estado da instância:", error.response?.data || error.message);
    res.status(500).json({
      error: "Erro ao consultar estado da instância na Evolution API",
      details: error.response?.data || error.message
    });
  }
});


router.delete("/evolution/disconnect/:instanceName", authOrApiKey, async (req, res) => {
  const { instanceName } = req.params;

  try {
    // 🔐 Chamada para a Evolution API para logout da instância
    const response = await axios.delete(
      `https://evolution-evolution-api.hdolfr.easypanel.host/instance/logout/${instanceName}`,
      {
        headers: {
          apikey: process.env.EVOLUTION_API_KEY
        }
      }
    );

    console.log("🔌 Resposta do logout:", response.data);

    // Atualiza status no banco para "desconectado"
    await pool.query(
      `UPDATE instancias 
       SET status = 'desconectado' 
       WHERE instancia_nome = ? AND integracao_tipo = 'evolution'`,
      [instanceName]
    );

    res.status(200).json({
      message: "Instância desconectada com sucesso",
      response: response.data
    });

  } catch (error) {
    console.error("❌ Erro ao desconectar instância:", error.response?.data || error.message);
    res.status(500).json({
      error: "Erro ao desconectar instância na Evolution API",
      details: error.response?.data || error.message
    });
  }
});

router.delete("/evolution/delete/:instanceName", authOrApiKey, async (req, res) => {
  const { instanceName } = req.params;

  try {
    // 🔥 Requisição para deletar a instância via Evolution API
    const response = await axios.delete(
      `https://evolution-evolution-api.hdolfr.easypanel.host/instance/delete/${instanceName}`,
      {
        headers: {
          apikey: process.env.EVOLUTION_API_KEY
        }
      }
    );

    console.log("🧨 Resposta da exclusão na Evolution:", response.data);

    // 🗑️ Deleta do banco também (se integração_type for evolution)
    const [result] = await pool.query(
      `DELETE FROM instancias 
       WHERE instancia_nome = ? AND integracao_tipo = 'evolution'`,
      [instanceName]
    );

    res.status(200).json({
      message: "Instância deletada com sucesso",
      evolution_response: response.data,
      db_deleted: result.affectedRows > 0
    });

  } catch (error) {
    console.error("❌ Erro ao deletar instância:", error.response?.data || error.message);
    res.status(500).json({
      error: "Erro ao deletar instância na Evolution API",
      details: error.response?.data || error.message
    });
  }
});


/**
 * 🔔 Configurar/Reaplicar Webhook na Evolution API para uma instância
 * POST /evolution/webhook/:instanceName
 */
router.post("/evolution/webhook/:instanceName", authOrApiKey, async (req, res) => {
  const { instanceName } = req.params;
  try {
    await axios.post(
      `https://evolution-evolution-api.hdolfr.easypanel.host/webhook/set/${instanceName}`,
      {
        webhook: {
          enabled: true,
          url: "https://ce0bbf99515a.ngrok-free.app/webhook/evolution",
          byEvents: false,
          base64: true,
          events: [
            "APPLICATION_STARTUP","CHATS_DELETE","CHATS_SET","CHATS_UPDATE","CHATS_UPSERT",
            "CONNECTION_UPDATE","CONTACTS_SET","CONTACTS_UPDATE","CONTACTS_UPSERT",
            "GROUPS_UPSERT","LABELS_ASSOCIATION","LABELS_EDIT","LOGOUT_INSTANCE",
            "MESSAGES_DELETE","MESSAGES_SET","MESSAGES_UPDATE","MESSAGES_UPSERT",
            "PRESENCE_UPDATE","QRCODE_UPDATED","REMOVE_INSTANCE","SEND_MESSAGE"
          ]
          // headers: { Authorization: "Bearer xxx", "Content-Type": "application/json" } // (opcional)
        }
      },
      { headers: { apikey: process.env.EVOLUTION_API_KEY } }
    );    
    return res.status(200).json({ success: true, message: "Webhook configurado com sucesso" });
  } catch (error) {
    // log detalhado pra ver a mensagem do 400
    console.error("Webhook/set error:",
      JSON.stringify({
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method
      }, null, 2)
    );
    return res.status(500).json({ success: false, error: "Falha ao configurar webhook na Evolution" });
  }
});



module.exports = router;
