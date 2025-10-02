const express = require("express");
const pool = require("../../config/database");

const router = express.Router();

// Lista prova_grupo com paginação
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;
    const grupo_id = req.query.grupo_id;
    const prova_id = req.query.prova_id;

    let query = `
      SELECT SQL_CALC_FOUND_ROWS 
        pg.id,
        pg.prova_id,
        pg.grupo_id,
        pg.obrigatorio,
        pg.ordem,
        pg.ativo,
        pg.criado_em,
        pg.atualizado_em,
        p.nome as prova_nome,
        g.nome as grupo_nome,
        m.nome as modulo_nome
      FROM prova_grupo pg
      JOIN prova p ON pg.prova_id = p.id
      JOIN grupos g ON pg.grupo_id = g.id
      JOIN modulos m ON g.modulo_id = m.id
    `;
    
    let params = [];

    if (grupo_id) {
      query += " WHERE pg.grupo_id = ?";
      params.push(grupo_id);
    }

    if (prova_id) {
      query += grupo_id ? " AND pg.prova_id = ?" : " WHERE pg.prova_id = ?";
      params.push(prova_id);
    }

    query += " ORDER BY pg.ordem ASC, pg.id ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({
      data: rows,
      page,
      limit,
      total: countRows[0]?.total || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar prova_grupo." });
  }
});

// Busca prova_grupo por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT 
        pg.id,
        pg.prova_id,
        pg.grupo_id,
        pg.obrigatorio,
        pg.ordem,
        pg.ativo,
        pg.criado_em,
        pg.atualizado_em,
        p.nome as prova_nome,
        g.nome as grupo_nome,
        m.nome as modulo_nome
      FROM prova_grupo pg
      JOIN prova p ON pg.prova_id = p.id
      JOIN grupos g ON pg.grupo_id = g.id
      JOIN modulos m ON g.modulo_id = m.id
      WHERE pg.id = ?`,
      [id]
    );
    
    if (rows.length === 0) return res.status(404).json({ error: "Prova_grupo não encontrado." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar prova_grupo." });
  }
});

// Cria nova prova_grupo
router.post("/", async (req, res) => {
  let conn;
  try {
    const payload = req.body || {};

    // Campos obrigatórios
    const { prova_id, grupo_id, obrigatorio = false, ordem = 1, ativo = true } = payload;
    
    // Validação básica
    if (!prova_id || !grupo_id) {
      return res.status(400).json({ 
        error: "Campos obrigatórios: prova_id e grupo_id" 
      });
    }

    // Inicia transação
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Verificar se já existe vínculo
    const [existe] = await conn.query(
      "SELECT id FROM prova_grupo WHERE prova_id = ? AND grupo_id = ?",
      [prova_id, grupo_id]
    );

    if (existe.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: "Esta prova já está vinculada a este grupo." });
    }

    const [result] = await conn.query(
      `INSERT INTO prova_grupo (prova_id, grupo_id, obrigatorio, ordem, ativo) VALUES (?, ?, ?, ?, ?)`,
      [prova_id, grupo_id, obrigatorio, ordem, ativo]
    );

    await conn.commit();

    const [created] = await pool.query(
      `SELECT 
        pg.id,
        pg.prova_id,
        pg.grupo_id,
        pg.obrigatorio,
        pg.ordem,
        pg.ativo,
        pg.criado_em,
        pg.atualizado_em,
        p.nome as prova_nome,
        g.nome as grupo_nome,
        m.nome as modulo_nome
      FROM prova_grupo pg
      JOIN prova p ON pg.prova_id = p.id
      JOIN grupos g ON pg.grupo_id = g.id
      JOIN modulos m ON g.modulo_id = m.id
      WHERE pg.id = ?`,
      [result.insertId]
    );

    res.status(201).json(created[0]);
  } catch (error) {
    console.error(error);
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    res.status(500).json({ error: "Erro ao criar prova_grupo." });
  } finally {
    if (conn) conn.release();
  }
});

// Atualiza prova_grupo por ID
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { obrigatorio, ordem, ativo } = req.body || {};

    const fields = [];
    const values = [];
    
    if (obrigatorio !== undefined) { 
      fields.push("obrigatorio = ?"); 
      values.push(obrigatorio); 
    }
    if (ordem !== undefined) { 
      fields.push("ordem = ?"); 
      values.push(ordem); 
    }
    if (ativo !== undefined) { 
      fields.push("ativo = ?"); 
      values.push(ativo); 
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar." });
    }

    const sql = `UPDATE prova_grupo SET ${fields.join(", ")} WHERE id = ?`;
    await pool.query(sql, [...values, id]);

    const [updated] = await pool.query(
      `SELECT 
        pg.id,
        pg.prova_id,
        pg.grupo_id,
        pg.obrigatorio,
        pg.ordem,
        pg.ativo,
        pg.criado_em,
        pg.atualizado_em,
        p.nome as prova_nome,
        g.nome as grupo_nome,
        m.nome as modulo_nome
      FROM prova_grupo pg
      JOIN prova p ON pg.prova_id = p.id
      JOIN grupos g ON pg.grupo_id = g.id
      JOIN modulos m ON g.modulo_id = m.id
      WHERE pg.id = ?`,
      [id]
    );

    if (updated.length === 0) return res.status(404).json({ error: "Prova_grupo não encontrado." });
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar prova_grupo." });
  }
});

// Remove prova_grupo por ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query("SELECT id FROM prova_grupo WHERE id = ?", [id]);
    if (existing.length === 0) return res.status(404).json({ error: "Prova_grupo não encontrado." });

    await pool.query("DELETE FROM prova_grupo WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover prova_grupo." });
  }
});

// Rota especial: Buscar provas de um grupo
router.get("/grupo/:grupo_id", async (req, res) => {
  try {
    const { grupo_id } = req.params;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS 
        pg.id,
        pg.prova_id,
        pg.grupo_id,
        pg.obrigatorio,
        pg.ordem,
        pg.ativo,
        p.nome as prova_nome,
        g.nome as grupo_nome
      FROM prova_grupo pg
      JOIN prova p ON pg.prova_id = p.id
      JOIN grupos g ON pg.grupo_id = g.id
      WHERE pg.grupo_id = ? AND pg.ativo = 1
      ORDER BY pg.obrigatorio DESC, pg.ordem ASC, pg.id ASC
      LIMIT ? OFFSET ?`,
      [grupo_id, limit, offset]
    );
    
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({
      data: rows,
      page,
      limit,
      total: countRows[0]?.total || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar provas do grupo." });
  }
});

// Rota especial: Buscar grupos de uma prova
router.get("/prova/:prova_id", async (req, res) => {
  try {
    const { prova_id } = req.params;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS 
        pg.id,
        pg.prova_id,
        pg.grupo_id,
        pg.obrigatorio,
        pg.ordem,
        pg.ativo,
        p.nome as prova_nome,
        g.nome as grupo_nome,
        m.nome as modulo_nome
      FROM prova_grupo pg
      JOIN prova p ON pg.prova_id = p.id
      JOIN grupos g ON pg.grupo_id = g.id
      JOIN modulos m ON g.modulo_id = m.id
      WHERE pg.prova_id = ? AND pg.ativo = 1
      ORDER BY pg.ordem ASC, pg.id ASC
      LIMIT ? OFFSET ?`,
      [prova_id, limit, offset]
    );
    
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({
      data: rows,
      page,
      limit,
      total: countRows[0]?.total || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar grupos da prova." });
  }
});

module.exports = router;
