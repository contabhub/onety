const express = require('express');
const router = express.Router();
const db = require("../config/database");

// ✅ GET: Listar categorias por equipe
router.get('/:equipe_id', async (req, res) => {
  const { equipe_id } = req.params;

  if (!equipe_id) {
    return res.status(400).json({ error: 'equipe_id é obrigatório' });
  }

  try {
    const [rows] = await db.query(
      'SELECT * FROM categorias_personalizadas WHERE equipe_id = ? ORDER BY id DESC',
      [equipe_id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});


// ✅ POST: Criar nova categoria
router.post('/', async (req, res) => {
  const { equipe_id, nome, is_default = false } = req.body;

  if (!equipe_id || !nome) {
    return res.status(400).json({ error: 'equipe_id e nome são obrigatórios' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO categorias_personalizadas (equipe_id, nome, is_default) VALUES (?, ?, ?)',
      [equipe_id, nome, is_default]
    );

    const [rows] = await db.query(
      'SELECT * FROM categorias_personalizadas WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

// ✅ PUT: Atualizar nome da categoria
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  try {
    await db.query(
      'UPDATE categorias_personalizadas SET nome = ? WHERE id = ?',
      [nome, id]
    );
    res.json({ message: 'Categoria atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar categoria:', error);
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
});


// ✅ DELETE: Remover categoria
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM categorias_personalizadas WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Erro ao deletar categoria:', error);
    res.status(500).json({ error: 'Erro ao deletar categoria' });
  }
});

module.exports = router;
