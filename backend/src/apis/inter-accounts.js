// apis/inter-accounts.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const verifyToken = require('../middlewares/auth');

// Criar conta do Inter
router.post('/', verifyToken, async (req, res) => {
  const {
    company_id, apelido, conta_corrente,
    client_id, client_secret, cert_b64, key_b64,
    ambiente = 'prod', is_default = 0, status = 'ativo'
  } = req.body;

  if (!company_id || !conta_corrente || !client_id || !client_secret || !cert_b64 || !key_b64) {
    return res.status(400).json({ error: 'Campos obrigatórios: company_id, conta_corrente, client_id, client_secret, cert_b64, key_b64.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO inter_accounts
       (company_id, apelido, conta_corrente, client_id, client_secret, cert_b64, key_b64, ambiente, is_default, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [company_id, apelido || `Conta ${conta_corrente}`, conta_corrente, client_id, client_secret, cert_b64, key_b64, ambiente, is_default ? 1 : 0, status]
    );
    const newId = result.insertId;

    if (is_default) {
      await conn.query(
        `UPDATE inter_accounts SET is_default = 0 WHERE company_id = ? AND id <> ?`,
        [company_id, newId]
      );
    }

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
  const { company_id } = req.query;
  try {
    const [rows] = company_id
      ? await pool.query(
          `SELECT id, company_id, apelido, conta_corrente, ambiente, is_default, status, created_at
           FROM inter_accounts WHERE company_id = ?
           ORDER BY is_default DESC, id DESC`,
          [company_id]
        )
      : await pool.query(
          `SELECT id, company_id, apelido, conta_corrente, ambiente, is_default, status, created_at
           FROM inter_accounts ORDER BY id DESC`
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
      `SELECT id, company_id, apelido, conta_corrente, ambiente, is_default, status, created_at
       FROM inter_accounts WHERE id = ?`,
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
  const { apelido, conta_corrente, client_id, client_secret, cert_b64, key_b64, ambiente, is_default, status } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `UPDATE inter_accounts
       SET apelido = COALESCE(?, apelido),
           conta_corrente = COALESCE(?, conta_corrente),
           client_id = COALESCE(?, client_id),
           client_secret = COALESCE(?, client_secret),
           cert_b64 = COALESCE(?, cert_b64),
           key_b64 = COALESCE(?, key_b64),
           ambiente = COALESCE(?, ambiente),
           is_default = COALESCE(?, is_default),
           status = COALESCE(?, status)
       WHERE id = ?`,
      [apelido, conta_corrente, client_id, client_secret, cert_b64, key_b64, ambiente, typeof is_default === 'number' ? is_default : null, status, id]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Conta não encontrada.' });
    }

    if (is_default === 1) {
      const [[acc]] = await conn.query('SELECT company_id FROM inter_accounts WHERE id = ?', [id]);
      if (acc?.company_id) {
        await conn.query('UPDATE inter_accounts SET is_default = 0 WHERE company_id = ? AND id <> ?', [acc.company_id, id]);
      }
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
    const [result] = await pool.query('DELETE FROM inter_accounts WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Conta não encontrada.' });
    res.json({ message: 'Conta Inter deletada com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar conta Inter:', err);
    res.status(500).json({ error: 'Erro ao deletar conta Inter.' });
  }
});

module.exports = router;
