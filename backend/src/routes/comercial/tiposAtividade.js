const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const verifyToken = require('../../middlewares/auth');

// 🔹 Listar todos os tipos de atividade
router.get('/empresa/:id', verifyToken, async (req, res) => {
  const empresaIdParam = parseInt(req.params.id, 10);

  try {
    const [rows] = await db.query(
      'SELECT * FROM crm_tipos_atividades WHERE empresa_id = ? ORDER BY nome ASC',
      [empresaIdParam]
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
    const [rows] = await db.query('SELECT * FROM crm_tipos_atividades WHERE id = ?', [id]);

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
  const { nome, empresa_id } = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'O campo \"nome\" é obrigatório.' });
  }
  if (!empresa_id) {
    return res.status(400).json({ error: 'O campo \"empresa_id\" é obrigatório.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO crm_tipos_atividades (nome, empresa_id) VALUES (?, ?)',
      [nome, empresa_id]
    );
    res.status(201).json({ message: 'Tipo de atividade criado com sucesso.', tipoId: result.insertId });
  } catch (error) {
    console.error('Erro ao criar tipo de atividade:', error);
    res.status(500).json({ error: 'Erro ao criar tipo de atividade.' });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { nome, empresa_id } = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'O campo \"nome\" é obrigatório.' });
  }
  if (!empresa_id) {
    return res.status(400).json({ error: 'O campo \"empresa_id\" é obrigatório.' });
  }

  try {
    const [result] = await db.query(
      'UPDATE crm_tipos_atividades SET nome = ? WHERE id = ? AND empresa_id = ?',
      [nome, id, empresa_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tipo de atividade não encontrado ou não pertence à empresa informada.' });
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
    await db.query('DELETE FROM crm_tipos_atividades WHERE id = ?', [id]);
    res.json({ message: 'Tipo de atividade deletado com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar tipo de atividade:', error);
    res.status(500).json({ error: 'Erro ao deletar tipo de atividade.' });
  }
});

module.exports = router;
