const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const verifyToken = require('../../middlewares/auth');

// ✅ Criar departamento
router.post('/', verifyToken, async (req, res) => {
  try {
    const { nome, codigo, descricao, company_id } = req.body;

    if (!nome || !company_id) {
      return res.status(400).json({ error: 'Nome e company_id são obrigatórios' });
    }

    const [result] = await pool.query(
      `INSERT INTO departamentos (company_id, nome, codigo, descricao, ativo)
       VALUES (?, ?, ?, ?, 1)`,
      [company_id, nome, codigo || null, descricao || null]
    );

    res.status(201).json({ id: result.insertId, nome, codigo, descricao, company_id, ativo: 1 });
  } catch (err) {
    console.error('❌ Erro ao criar departamento:', err);
    res.status(500).json({ error: 'Erro ao criar departamento' });
  }
});

// ✅ Listar departamentos por empresa
router.get('/', verifyToken, async (req, res) => {
  try {
    const { company_id } = req.query;

    if (!company_id) {
      return res.status(400).json({ error: 'company_id é obrigatório' });
    }

    const [rows] = await pool.query(
      `SELECT id, nome, codigo, descricao, ativo
       FROM departamentos
       WHERE company_id = ? AND ativo = 1
       ORDER BY nome ASC`,
      [company_id]
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
    const { nome, codigo, descricao, ativo } = req.body;

    const [result] = await pool.query(
      `UPDATE departamentos
       SET nome = ?, codigo = ?, descricao = ?, ativo = ?
       WHERE id = ?`,
      [nome, codigo || null, descricao || null, ativo ?? 1, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Departamento não encontrado' });
    }

    res.json({ id, nome, codigo, descricao, ativo });
  } catch (err) {
    console.error('❌ Erro ao atualizar departamento:', err);
    res.status(500).json({ error: 'Erro ao atualizar departamento' });
  }
});

// ✅ Remover departamento (soft delete → ativo = 0)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `UPDATE departamentos SET ativo = 0 WHERE id = ?`,
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
