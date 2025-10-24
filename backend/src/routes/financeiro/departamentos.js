const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const verifyToken = require('../../middlewares/auth');

// ✅ Criar departamento
router.post('/', verifyToken, async (req, res) => {
  try {
    const { nome, codigo, descricao, empresa_id } = req.body;

    if (!nome || !empresa_id) {
      return res.status(400).json({ error: 'Nome e empresa_id são obrigatórios' });
    }

    const [result] = await pool.query(
      `INSERT INTO departamentos (empresa_id, nome, descricao, status)
       VALUES (?, ?, ?, 'ativo')`,
      [empresa_id, nome, descricao || null]
    );

    res.status(201).json({ id: result.insertId, nome, descricao, empresa_id, status: 'ativo' });
  } catch (err) {
    console.error('❌ Erro ao criar departamento:', err);
    res.status(500).json({ error: 'Erro ao criar departamento' });
  }
});

// ✅ Listar departamentos por empresa
router.get('/', verifyToken, async (req, res) => {
  try {
    const { empresa_id } = req.query;

    if (!empresa_id) {
      return res.status(400).json({ error: 'empresa_id é obrigatório' });
    }

    const [rows] = await pool.query(
      `SELECT id, nome, descricao, status
       FROM departamentos
       WHERE empresa_id = ? AND status = 'ativo'
       ORDER BY nome ASC`,
      [empresa_id]
    );

    res.json(rows);
  } catch (err) {
    console.error('❌ Erro ao listar departamentos:', err);
    res.status(500).json({ error: 'Erro ao listar departamentos' });
  }
});

// ✅ Atualizar departamento
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, codigo, descricao, status } = req.body;

    const [result] = await pool.query(
      `UPDATE departamentos
       SET nome = ?, descricao = ?, status = ?
       WHERE id = ?`,
      [nome, descricao || null, status || 'ativo', id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    res.json({ id, nome, descricao, status });
  } catch (err) {
    console.error('❌ Erro ao atualizar departamento:', err);
    res.status(500).json({ error: 'Erro ao atualizar departamento' });
  }
});

// ✅ Remover departamento (soft delete → status = 'inativo')
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `UPDATE departamentos SET status = 'inativo' WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    res.json({ message: 'Departamento desativado com sucesso' });
  } catch (err) {
    console.error('❌ Erro ao excluir departamento:', err);
    res.status(500).json({ error: 'Erro ao excluir departamento' });
  }
});

module.exports = router;
