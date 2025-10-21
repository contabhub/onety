// apis/contas_inter.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const verifyToken = require('../middlewares/auth');

// Criar conta do Inter
router.post('/', verifyToken, async (req, res) => {
  const {
    empresa_id, apelido, conta_corrente,
    cliente_id, cliente_secret, certificado, key,
    status = 'ativo', contas_id
  } = req.body;

  if (!empresa_id || !conta_corrente || !cliente_id || !cliente_secret || !certificado || !key) {
    return res.status(400).json({ error: 'Campos obrigatórios: empresa_id, conta_corrente, cliente_id, cliente_secret, certificado, key.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO contas_inter
       (empresa_id, apelido, conta_corrente, cliente_id, cliente_secret, certificado, key, status, contas_id, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [empresa_id, apelido || `Conta ${conta_corrente}`, conta_corrente, cliente_id, cliente_secret, certificado, key, status, contas_id || null]
    );
    const newId = result.insertId;

    await conn.commit();
    res.status(201).json({ id: newId, message: 'Conta Inter criada com sucesso.' });
  } catch (err) {
    await conn.rollback();
    console.error('Erro ao criar conta Inter:', err);
    res.status(500).json({ error: 'Erro ao criar conta Inter.' });
  } finally {
    conn.release();
  }
});

// Listar contas por empresa (sem vazar segredos)
router.get('/', verifyToken, async (req, res) => {
  const { empresa_id } = req.query;
  try {
    const [rows] = empresa_id
      ? await pool.query(
          `SELECT id, empresa_id, apelido, conta_corrente, status, contas_id, criado_em, atualizado_em
           FROM contas_inter WHERE empresa_id = ?
           ORDER BY id DESC`,
          [empresa_id]
        )
      : await pool.query(
          `SELECT id, empresa_id, apelido, conta_corrente, status, contas_id, criado_em, atualizado_em
           FROM contas_inter ORDER BY id DESC`
        );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar contas:', err);
    res.status(500).json({ error: 'Erro ao listar contas.' });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [[row]] = await pool.query(
      `SELECT id, empresa_id, apelido, conta_corrente, status, contas_id, criado_em, atualizado_em
       FROM contas_inter WHERE id = ?`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Conta não encontrada.' });
    res.json(row);
  } catch (err) {
    console.error('Erro ao buscar conta:', err);
    res.status(500).json({ error: 'Erro ao buscar conta.' });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { apelido, conta_corrente, cliente_id, cliente_secret, certificado, key, status, contas_id } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `UPDATE contas_inter
       SET apelido = COALESCE(?, apelido),
           conta_corrente = COALESCE(?, conta_corrente),
           cliente_id = COALESCE(?, cliente_id),
           cliente_secret = COALESCE(?, cliente_secret),
           certificado = COALESCE(?, certificado),
           key = COALESCE(?, key),
           status = COALESCE(?, status),
           contas_id = COALESCE(?, contas_id),
           atualizado_em = NOW()
       WHERE id = ?`,
      [apelido, conta_corrente, cliente_id, cliente_secret, certificado, key, status, contas_id, id]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Conta não encontrada.' });
    }

    await conn.commit();
    res.json({ message: 'Conta Inter atualizada com sucesso.' });
  } catch (err) {
    await conn.rollback();
    console.error('Erro ao atualizar conta Inter:', err);
    res.status(500).json({ error: 'Erro ao atualizar conta Inter.' });
  } finally {
    conn.release();
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM contas_inter WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Conta não encontrada.' });
    res.json({ message: 'Conta Inter deletada com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar conta Inter:', err);
    res.status(500).json({ error: 'Erro ao deletar conta Inter.' });
  }
});

module.exports = router;
