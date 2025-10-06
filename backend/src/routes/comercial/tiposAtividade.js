const express = require('express');
const router = express.Router();
const db = require('../config/database');
const verifyToken = require('../middlewares/auth');

// 🔹 Listar todos os tipos de atividade
router.get('/equipe/:id', verifyToken, async (req, res) => {
  const equipeIdParam = parseInt(req.params.id, 10);

  try {
    const [rows] = await db.query(
      'SELECT * FROM tipos_atividade WHERE equipe_id = ? ORDER BY nome ASC',
      [equipeIdParam]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar tipos de atividade:', error);
    res.status(500).json({ error: 'Erro ao buscar tipos de atividade.' });
  }
});

// 🔹 Buscar tipo de atividade específico
router.get('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM tipos_atividade WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tipo de atividade não encontrado.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar tipo de atividade:', error);
    res.status(500).json({ error: 'Erro ao buscar tipo de atividade.' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  const { nome, equipe_id } = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'O campo \"nome\" é obrigatório.' });
  }
  if (!equipe_id) {
    return res.status(400).json({ error: 'O campo \"equipe_id\" é obrigatório.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO tipos_atividade (nome, equipe_id) VALUES (?, ?)',
      [nome, equipe_id]
    );
    res.status(201).json({ message: 'Tipo de atividade criado com sucesso.', tipoId: result.insertId });
  } catch (error) {
    console.error('Erro ao criar tipo de atividade:', error);
    res.status(500).json({ error: 'Erro ao criar tipo de atividade.' });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { nome, equipe_id } = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'O campo \"nome\" é obrigatório.' });
  }
  if (!equipe_id) {
    return res.status(400).json({ error: 'O campo \"equipe_id\" é obrigatório.' });
  }

  try {
    const [result] = await db.query(
      'UPDATE tipos_atividade SET nome = ? WHERE id = ? AND equipe_id = ?',
      [nome, id, equipe_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tipo de atividade não encontrado ou não pertence à equipe informada.' });
    }
    res.json({ message: 'Tipo de atividade atualizado com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar tipo de atividade:', error);
    res.status(500).json({ error: 'Erro ao atualizar tipo de atividade.' });
  }
});


// 🔹 Deletar tipo de atividade
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM tipos_atividade WHERE id = ?', [id]);
    res.json({ message: 'Tipo de atividade deletado com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar tipo de atividade:', error);
    res.status(500).json({ error: 'Erro ao deletar tipo de atividade.' });
  }
});

module.exports = router;
