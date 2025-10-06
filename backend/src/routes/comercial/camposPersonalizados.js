const express = require('express');
const router = express.Router();
const db = require("../../config/database");

// ✅ GET: Listar campos por categoria
router.get('/:categoria_id', async (req, res) => {
  const { categoria_id } = req.params;

  if (!categoria_id) {
    return res.status(400).json({ error: 'categoria_id é obrigatório' });
  }

  try {
    const [rows] = await db.query(
      'SELECT * FROM crm_campos_personalizados WHERE categoria_id = ? ORDER BY ordem ASC',
      [categoria_id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar campos personalizados:', error);
    res.status(500).json({ error: 'Erro ao buscar campos personalizados' });
  }
});

// ✅ PUT: Atualizar campo personalizado
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, descricao, tipo } = req.body;

  if (!nome || !tipo) {
    return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });
  }

  try {
    await db.query(
      'UPDATE crm_campos_personalizados SET nome = ?, descricao = ?, tipo = ? WHERE id = ?',
      [nome, descricao, tipo, id]
    );
    res.json({ message: 'Campo atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar campo personalizado:', error);
    res.status(500).json({ error: 'Erro ao atualizar campo personalizado' });
  }
});



// ✅ POST: Criar novo campo personalizado
router.post('/', async (req, res) => {
  const { categoria_id, nome, tipo, descricao = '', opcoes = '', obrigatorio = false, ordem = 0 } = req.body;

  if (!categoria_id || !nome || !tipo) {
    return res.status(400).json({ error: 'categoria_id, nome e tipo são obrigatórios' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO crm_campos_personalizados (categoria_id, nome, tipo, descricao, opcoes, obrigatorio, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [categoria_id, nome, tipo, descricao, opcoes, obrigatorio, ordem]
    );

    const [rows] = await db.query(
      'SELECT * FROM crm_campos_personalizados WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Erro ao criar campo personalizado:', error);
    res.status(500).json({ error: 'Erro ao criar campo personalizado' });
  }
});

// ✅ DELETE: Remover campo
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM crm_campos_personalizados WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Erro ao deletar campo personalizado:', error);
    res.status(500).json({ error: 'Erro ao deletar campo personalizado' });
  }
});

module.exports = router;
