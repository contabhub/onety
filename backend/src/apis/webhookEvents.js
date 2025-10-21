const express = require('express');
const router = express.Router();
const pool = require('../config/database'); // seu pool MySQL

// 📌 POST: Recebe callback do Pluggy e salva evento
router.post('/callback', async (req, res) => {
  try {
    const { event, webhookId, itemId, timestamp, data } = req.body;

    if (!event || !webhookId || !itemId) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios faltando.',
      });
    }

    await pool.query(
      `INSERT INTO webhook_events (webhook_id, event, item_id, data, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        webhookId,
        event,
        itemId,
        JSON.stringify(data || {}),
        timestamp ? new Date(timestamp) : new Date(),
      ]
    );

    console.log(`[Pluggy Webhook] Evento salvo: ${event} para item ${itemId}`);

    res.json({ success: true, message: 'Evento recebido e salvo.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Erro ao salvar evento webhook.',
      details: err.message,
    });
  }
});

// 📌 GET: Lista todos os eventos
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM webhook_events ORDER BY created_at DESC');
    res.json({ success: true, events: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erro ao listar eventos.', details: err.message });
  }
});

// 📌 GET: Busca evento por ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM webhook_events WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Evento não encontrado.' });
    }
    res.json({ success: true, event: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erro ao buscar evento.', details: err.message });
  }
});

// 📌 DELETE: Deleta evento por ID (opcional)
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM webhook_events WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Evento não encontrado para deletar.' });
    }
    res.json({ success: true, message: 'Evento deletado com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erro ao deletar evento.', details: err.message });
  }
});

module.exports = router; 