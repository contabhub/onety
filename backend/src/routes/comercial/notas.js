const express = require('express');
const router = express.Router();
const db = require('../config/database');
const verifyToken = require('../middlewares/auth');

// 🔹 Criar nova nota
router.post('/', verifyToken, async (req, res) => {
  const { lead_id, usuario_id, conteudo } = req.body;

  if (!lead_id || !usuario_id || !conteudo) {
    return res.status(400).json({ error: 'Campos obrigatórios: lead_id, usuario_id, conteudo' });
  }

  try {
    const [result] = await db.query(`
      INSERT INTO notas (lead_id, usuario_id, conteudo)
      VALUES (?, ?, ?)
    `, [lead_id, usuario_id, conteudo]);

    res.status(201).json({ message: 'Nota criada com sucesso', notaId: result.insertId });
  } catch (error) {
    console.error('Erro ao criar nota:', error);
    res.status(500).json({ error: 'Erro ao criar nota.' });
  }
});

// 🔹 Listar todas as notas de um lead
router.get('/:leadId', verifyToken, async (req, res) => {
  const { leadId } = req.params;

  try {
    const [notas] = await db.query(`
      SELECT 
        notas.id,
        notas.conteudo,
        notas.created_at,
        users.full_name AS autor_nome,
        users.avatar_url
      FROM notas
      JOIN users ON users.id = notas.usuario_id
      WHERE notas.lead_id = ?
      ORDER BY notas.created_at DESC
    `, [leadId]);

    res.json(notas);
  } catch (error) {
    console.error('Erro ao buscar notas:', error);
    res.status(500).json({ error: 'Erro ao buscar notas.' });
  }
});

// 🔹 Deletar nota por ID
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM notas WHERE id = ?', [id]);
    res.json({ message: 'Nota deletada com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar nota:', error);
    res.status(500).json({ error: 'Erro ao deletar nota.' });
  }
});

module.exports = router;
