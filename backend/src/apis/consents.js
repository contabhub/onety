const express = require('express');
const axios = require('axios');
const pool = require('../config/database'); // Se quiser salvar expiresAt no banco
require('dotenv').config();

const router = express.Router();

const clientId = process.env.PLUGGY_CLIENT_ID;
const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

// 🔐 Função utilitária para obter API KEY Pluggy
async function getPluggyApiKey() {
  const { data } = await axios.post('https://api.pluggy.ai/auth', { clientId, clientSecret });
  return data.apiKey;
}

// ✅ GET /:itemId - Consulta consentimentos de um Item Pluggy
router.get('/:itemId', async (req, res) => {
  const { itemId } = req.params;

  if (!itemId) {
    return res.status(400).json({ success: false, message: 'ItemId é obrigatório.' });
  }

  try {
    const apiKey = await getPluggyApiKey();

    const { data } = await axios.get(
      `https://api.pluggy.ai/consents?itemId=${itemId}`,
      { headers: { 'X-API-KEY': apiKey } }
    );

    console.log('✅ Consentimentos encontrados:', JSON.stringify(data, null, 2));

    const expiresAt = data.results?.[0]?.expiresAt || null;

    if (expiresAt) {
      console.log(`🔑 Consentimento expira em: ${expiresAt}`);

      // Exemplo: atualizar sua tabela, se quiser
      await pool.query(
        `UPDATE contas_api SET consent_expires_at = ? WHERE item_id = ?`,
        [ expiresAt, itemId ]
      );

      console.log(`📝 consent_expires_at atualizado na contas_api para itemId ${itemId}`);
    } else {
      console.log('⚠️ Nenhum consentimento ativo encontrado para este itemId.');
    }

    return res.json({
      success: true,
      consents: data.results,
      expiresAt: expiresAt
    });

  } catch (err) {
    console.error('❌ Erro ao buscar consents:', err?.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar consents.',
      details: err?.response?.data || err.message
    });
  }
});

module.exports = router; 