// src/apis/openfinance.js

const express = require('express');
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

// 🗝️ Variáveis Pluggy
const clientId = process.env.PLUGGY_CLIENT_ID || 'SEU_CLIENT_ID';
const clientSecret = process.env.PLUGGY_CLIENT_SECRET || 'SEU_CLIENT_SECRET';

console.log('Pluggy clientId:', clientId);
console.log('Pluggy clientSecret:', clientSecret);

// 🔐 Cache da API KEY Pluggy
let pluggyApiKey = null;
let pluggyApiKeyExpiresAt = null;

// 🔑 Função para obter/renovar API KEY Pluggy
async function getPluggyApiKey() {
  const now = new Date();

  if (pluggyApiKey && pluggyApiKeyExpiresAt > now) {
    console.log('[Pluggy] Usando API KEY em cache');
    return pluggyApiKey;
  }

  console.log('[Pluggy] Gerando nova API KEY');

  const { data } = await axios.post('https://api.pluggy.ai/auth', {
    clientId,
    clientSecret,
  });

  pluggyApiKey = data.apiKey;
  pluggyApiKeyExpiresAt = new Date(now.getTime() + 23 * 60 * 60 * 1000);

  console.log('[Pluggy] Nova API KEY gerada');
  return pluggyApiKey;
}

// ✅ GET /api/openfinance/auth
router.get('/auth', async (req, res) => {
  try {
    const apiKey = await getPluggyApiKey();
    res.json({ success: true, apiKey });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar API KEY Pluggy',
      details: err?.response?.data || err.message,
    });
  }
});

// ✅ GET /api/openfinance/connectors
router.get('/connectors', async (req, res) => {
  try {
    const apiKey = await getPluggyApiKey();
    const connectors = await axios.get('https://api.pluggy.ai/connectors', {
      headers: { 'X-API-KEY': apiKey },
    });
    res.json({ success: true, connectors: connectors.data });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar Connectors Pluggy',
      details: err?.response?.data || err.message,
    });
  }
});

// ✅ GET /api/openfinance/connectors/:id
router.get('/connectors/:id', async (req, res) => {
  try {
    const apiKey = await getPluggyApiKey();
    const connectorId = req.params.id;

    const response = await axios.get(`https://api.pluggy.ai/connectors/${connectorId}`, {
      headers: { 'X-API-KEY': apiKey },
    });

    res.json({ success: true, connector: response.data });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar Connector Pluggy',
      details: err?.response?.data || err.message,
    });
  }
});

// ✅ POST /api/openfinance/connectors/:id/validate
router.post('/connectors/:id/validate', async (req, res) => {
  try {
    const apiKey = await getPluggyApiKey();
    const connectorId = req.params.id;

    const response = await axios.post(
      `https://api.pluggy.ai/connectors/${connectorId}/validate`,
      req.body,
      {
        headers: { 'X-API-KEY': apiKey },
      }
    );

    res.json({ success: true, result: response.data });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao validar dados no Connector Pluggy',
      details: err?.response?.data || err.message,
    });
  }
});


// ✅ POST /api/openfinance/connect ➜ Gera Connect Token Pluggy
router.post('/connect', async (req, res) => {
  try {
    const apiKey = await getPluggyApiKey();

    const payload = {
      clientUserId: req.body.clientUserId || 'user-id-demo',
      oauthRedirectUri: 'https://straton-frontend.vercel.app/api/openfinance/callback', // ✅ Agora público e HTTPS
      webhookUrl: 'https://straton-frontend.vercel.app/api/openfinance/webhook',        // ✅ Também público e HTTPS
    };

    console.log('➡️ Payload:', payload);

    const { data } = await axios.post(
      'https://api.pluggy.ai/connect_token',
      payload,
      { headers: { 'X-API-KEY': apiKey } }
    );

    console.log('✅ Connect Token:', data.accessToken);

    res.json({ connectToken: data.accessToken });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: 'Erro criando connect_token',
      details: err?.response?.data || err.message,
    });
  }
});


// ✅ GET /api/openfinance/callback - Captura o OAuth Redirect
router.get('/callback', (req, res) => {
  console.log('[Pluggy] Callback OAuth recebido!');
  console.log('Query params:', req.query);
  res.send('✅ Callback Pluggy recebido! Verifique o console.');
});

// ✅ POST /api/openfinance/webhook - Opcional, mas recomendado
router.post('/webhook', (req, res) => {
  console.log('[Pluggy] Webhook recebido!');
  console.log(req.body);
  res.status(200).send('OK');
});


// ✅ GET /api/openfinance/callback - Captura o OAuth Redirect
router.get('/callback', (req, res) => {
  console.log('[Pluggy] Callback OAuth recebido!');
  console.log('Query params:', req.query);

  res.send('✅ Callback Pluggy recebido! Verifique o console.');
});



module.exports = router;
