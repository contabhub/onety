const express = require("express");
const pool = require("../../config/database");

const router = express.Router();

// Lista conteúdos com paginação simples
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM conteudo ORDER BY id DESC LIMIT ? OFFSET ?",
      [limit, offset]
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
    res.status(500).json({ error: "Erro ao listar conteúdos." });
  }
});

// Busca conteúdo por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM conteudo WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Conteúdo não encontrado." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar conteúdo." });
  }
});

// Cria novo conteúdo
router.post("/", async (req, res) => {
  let conn;
  try {
    const payload = req.body || {};

    // Campos obrigatórios
    const { nome, modulo_id } = payload;
    
    // Validação básica
    if (!nome || !modulo_id) {
      return res.status(400).json({ 
        error: "Campos obrigatórios: nome e modulo_id" 
      });
    }

    // Campos opcionais
    const { link, descricao } = payload;

    // Inicia transação
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO conteudo (nome, link, descricao, modulo_id) VALUES (?, ?, ?, ?)`,
      [nome, link || null, descricao || null, modulo_id]
    );

    await conn.commit();

    const [created] = await pool.query("SELECT * FROM conteudo WHERE id = ?", [result.insertId]);
    res.status(201).json({ ...created[0] });
  } catch (error) {
    console.error(error);
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    res.status(500).json({ error: "Erro ao criar conteúdo." });
  } finally {
    if (conn) conn.release();
  }
});

// Atualiza conteúdo por ID (parcial - PATCH e também aceita PUT)
const buildUpdateQuery = (body) => {
  const allowed = [
    "nome",
    "link", 
    "descricao",
    "modulo_id"
  ];

  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  return { fields, values };
};

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fields, values } = buildUpdateQuery(req.body || {});
    if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar." });

    const sql = `UPDATE conteudo SET ${fields.join(", ")} WHERE id = ?`;
    await pool.query(sql, [...values, id]);

    const [updated] = await pool.query("SELECT * FROM conteudo WHERE id = ?", [id]);
    if (updated.length === 0) return res.status(404).json({ error: "Conteúdo não encontrado." });
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar conteúdo." });
  }
});

router.put("/:id", async (req, res) => {
  // Redireciona para a mesma lógica do PATCH
  req.method = "PATCH";
  return router.handle(req, res);
});

// Remove conteúdo por ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query("SELECT id FROM conteudo WHERE id = ?", [id]);
    if (existing.length === 0) return res.status(404).json({ error: "Conteúdo não encontrado." });

    await pool.query("DELETE FROM conteudo WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover conteúdo." });
  }
});

module.exports = router;
