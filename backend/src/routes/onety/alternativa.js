const express = require("express");
const pool = require("../../config/database");

const router = express.Router();

// Lista alternativas com paginação simples
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM alternativa ORDER BY id DESC LIMIT ? OFFSET ?",
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
    res.status(500).json({ error: "Erro ao listar alternativas." });
  }
});

// Busca alternativa por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM alternativa WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Alternativa não encontrada." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar alternativa." });
  }
});

// Cria nova alternativa
router.post("/", async (req, res) => {
  let conn;
  try {
    const payload = req.body || {};

    // Campos obrigatórios
    const { questao_id, opcao } = payload;
    
    // Validação básica
    if (!questao_id || !opcao) {
      return res.status(400).json({ 
        error: "Campos obrigatórios: questao_id e opcao" 
      });
    }

    // Campos opcionais
    const { correto } = payload;

    // Inicia transação
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO alternativa (questao_id, opcao, correto) VALUES (?, ?, ?)`,
      [questao_id, opcao, correto || 0]
    );

    await conn.commit();

    const [created] = await pool.query("SELECT * FROM alternativa WHERE id = ?", [result.insertId]);
    res.status(201).json({ ...created[0] });
  } catch (error) {
    console.error(error);
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    res.status(500).json({ error: "Erro ao criar alternativa." });
  } finally {
    if (conn) conn.release();
  }
});

// Atualiza alternativa por ID (parcial - PATCH e também aceita PUT)
const buildUpdateQuery = (body) => {
  const allowed = [
    "questao_id",
    "opcao",
    "correto"
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

    const sql = `UPDATE alternativa SET ${fields.join(", ")} WHERE id = ?`;
    await pool.query(sql, [...values, id]);

    const [updated] = await pool.query("SELECT * FROM alternativa WHERE id = ?", [id]);
    if (updated.length === 0) return res.status(404).json({ error: "Alternativa não encontrada." });
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar alternativa." });
  }
});

router.put("/:id", async (req, res) => {
  // Redireciona para a mesma lógica do PATCH
  req.method = "PATCH";
  return router.handle(req, res);
});

// Remove alternativa por ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query("SELECT id FROM alternativa WHERE id = ?", [id]);
    if (existing.length === 0) return res.status(404).json({ error: "Alternativa não encontrada." });

    await pool.query("DELETE FROM alternativa WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover alternativa." });
  }
});

// Rota especial: Buscar por questao_id
router.get("/questao/:questao_id", async (req, res) => {
  try {
    const { questao_id } = req.params;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM alternativa WHERE questao_id = ? ORDER BY id ASC LIMIT ? OFFSET ?",
      [questao_id, limit, offset]
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
    res.status(500).json({ error: "Erro ao buscar alternativas por questão." });
  }
});

// Rota especial: Buscar alternativa correta por questao_id
router.get("/questao/:questao_id/correta", async (req, res) => {
  try {
    const { questao_id } = req.params;
    const [rows] = await pool.query(
      "SELECT * FROM alternativa WHERE questao_id = ? AND correto = 1",
      [questao_id]
    );
    
    res.json({
      data: rows,
      total: rows.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar alternativa correta." });
  }
});

module.exports = router;
