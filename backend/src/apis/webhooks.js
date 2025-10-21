const express = require('express');
const axios = require('axios');
const pool = require('../config/database');
require('dotenv').config();

const router = express.Router();

const clientId = process.env.PLUGGY_CLIENT_ID || 'SEU_CLIENT_ID';
const clientSecret = process.env.PLUGGY_CLIENT_SECRET || 'SEU_CLIENT_SECRET';

// Utilitário: converte ISO para DATETIME MySQL
function formatMySQLDate(iso) {
  return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
}

// ✅ 1) Variáveis de cache e função utilitária Pluggy API KEY
let pluggyApiKey = null;
let pluggyApiKeyExpiresAt = null;

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
  console.log('[Pluggy] Nova API KEY gerada:', pluggyApiKey);
  return pluggyApiKey;
}

console.log('Pluggy clientId:', clientId);
console.log('Pluggy clientSecret:', clientSecret);

// ✅ 2) Cria webhook Pluggy se não existir e salva no banco
router.post('/', async (req, res) => {
  try {
    const { url, event } = req.body;

    const apiKey = await getPluggyApiKey();

    // Busca webhooks existentes na Pluggy
    const { data: existing } = await axios.get('https://api.pluggy.ai/webhooks', {
      headers: { 'X-API-KEY': apiKey }
    });

    const exists = existing.results.find(w => w.url === url && w.event === event);

    if (exists) {
      return res.status(200).json({
        success: true,
        message: 'Webhook já existe na Pluggy!',
        webhook: exists
      });
    }

    // Cria webhook na Pluggy
    const { data: webhook } = await axios.post(
      'https://api.pluggy.ai/webhooks',
      { url, event },
      {
        headers: {
          'X-API-KEY': apiKey,
          Accept: 'application/json',
        },
      }
    );

    // Salva no banco local
    await pool.query(
      `INSERT INTO webhooks 
       (webhook_id, url, event, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        webhook.id,
        webhook.url,
        webhook.event,
        'ACTIVE',
        formatMySQLDate(webhook.createdAt),
        formatMySQLDate(webhook.updatedAt)
      ]
    );

    res.json({ success: true, webhook });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar webhook',
      details: err?.response?.data || err.message,
    });
  }
});

// ✅ 3) Lista webhooks do banco local
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM webhooks');
    res.json({ success: true, webhooks: rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Erro ao listar webhooks', details: err.message });
  }
});

// ✅ 4) Busca webhook por ID no banco local
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM webhooks WHERE webhook_id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Webhook não encontrado' });
    }
    res.json({ success: true, webhook: rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Erro ao buscar webhook', details: err.message });
  }
});

// ✅ 5) Atualiza webhook na Pluggy e banco local
router.patch('/:id', async (req, res) => {
  try {
    const { url, event } = req.body;

    const apiKey = await getPluggyApiKey();

    const { data: webhook } = await axios.patch(
      `https://api.pluggy.ai/webhooks/${req.params.id}`,
      { url, event },
      {
        headers: {
          'X-API-KEY': apiKey,
          Accept: 'application/json',
        },
      }
    );

    await pool.query(
      `UPDATE webhooks 
       SET url = ?, event = ?, updated_at = ? 
       WHERE webhook_id = ?`,
      [
        webhook.url,
        webhook.event,
        formatMySQLDate(webhook.updatedAt),
        webhook.id
      ]
    );

    res.json({ success: true, webhook });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar webhook',
      details: err?.response?.data || err.message,
    });
  }
});

// ✅ 6) Deleta webhook na Pluggy e banco local
router.delete('/:id', async (req, res) => {
  try {
    const apiKey = await getPluggyApiKey();

    await axios.delete(`https://api.pluggy.ai/webhooks/${req.params.id}`, {
      headers: {
        'X-API-KEY': apiKey,
        Accept: 'application/json',
      },
    });

    await pool.query('DELETE FROM webhooks WHERE webhook_id = ?', [req.params.id]);

    res.json({ success: true, message: 'Webhook deletado com sucesso' });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar webhook',
      details: err?.response?.data || err.message,
    });
  }
});

module.exports = router;
