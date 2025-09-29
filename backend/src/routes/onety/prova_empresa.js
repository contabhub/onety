const express = require("express");
const pool = require("../../config/database");

const router = express.Router();

// Lista prova_empresa com paginação simples
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM prova_empresa ORDER BY id DESC LIMIT ? OFFSET ?",
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
    res.status(500).json({ error: "Erro ao listar prova_empresa." });
  }
});

// Busca prova_empresa por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM prova_empresa WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Prova_empresa não encontrado." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar prova_empresa." });
  }
});

// Cria nova prova_empresa
router.post("/", async (req, res) => {
  let conn;
  try {
    const payload = req.body || {};

    // Campos obrigatórios
    const { prova_id, empresa_id, viewer_id } = payload;
    
    // Validação básica
    if (!prova_id || !empresa_id || !viewer_id) {
      return res.status(400).json({ 
        error: "Campos obrigatórios: prova_id, empresa_id e viewer_id" 
      });
    }

    // Campos opcionais
    const { nota } = payload;

    // Inicia transação
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO prova_empresa (prova_id, empresa_id, viewer_id, nota) VALUES (?, ?, ?, ?)`,
      [prova_id, empresa_id, viewer_id, nota || null]
    );

    await conn.commit();

    const [created] = await pool.query("SELECT * FROM prova_empresa WHERE id = ?", [result.insertId]);
    res.status(201).json({ ...created[0] });
  } catch (error) {
    console.error(error);
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    res.status(500).json({ error: "Erro ao criar prova_empresa." });
  } finally {
    if (conn) conn.release();
  }
});

// Atualiza prova_empresa por ID (parcial - PATCH e também aceita PUT)
const buildUpdateQuery = (body) => {
  const allowed = [
    "prova_id",
    "empresa_id",
    "viewer_id",
    "nota"
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

    const sql = `UPDATE prova_empresa SET ${fields.join(", ")} WHERE id = ?`;
    await pool.query(sql, [...values, id]);

    const [updated] = await pool.query("SELECT * FROM prova_empresa WHERE id = ?", [id]);
    if (updated.length === 0) return res.status(404).json({ error: "Prova_empresa não encontrado." });
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar prova_empresa." });
  }
});

router.put("/:id", async (req, res) => {
  // Redireciona para a mesma lógica do PATCH
  req.method = "PATCH";
  return router.handle(req, res);
});

// Remove prova_empresa por ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query("SELECT id FROM prova_empresa WHERE id = ?", [id]);
    if (existing.length === 0) return res.status(404).json({ error: "Prova_empresa não encontrado." });

    await pool.query("DELETE FROM prova_empresa WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover prova_empresa." });
  }
});

// Rota especial: Buscar por prova_id
router.get("/prova/:prova_id", async (req, res) => {
  try {
    const { prova_id } = req.params;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM prova_empresa WHERE prova_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
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
    res.status(500).json({ error: "Erro ao buscar prova_empresa por prova." });
  }
});

// Rota especial: Buscar por empresa_id
router.get("/empresa/:empresa_id", async (req, res) => {
  try {
    const { empresa_id } = req.params;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM prova_empresa WHERE empresa_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
      [empresa_id, limit, offset]
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
    res.status(500).json({ error: "Erro ao buscar prova_empresa por empresa." });
  }
});

// Rota especial: Buscar por viewer_id
router.get("/viewer/:viewer_id", async (req, res) => {
  try {
    const { viewer_id } = req.params;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM prova_empresa WHERE viewer_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
      [viewer_id, limit, offset]
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
    res.status(500).json({ error: "Erro ao buscar prova_empresa por viewer." });
  }
});

// Rota especial: Atualizar nota
router.patch("/:id/nota", async (req, res) => {
  try {
    const { id } = req.params;
    const { nota } = req.body;

    if (nota === undefined) {
      return res.status(400).json({ error: "Campo 'nota' é obrigatório." });
    }

    await pool.query("UPDATE prova_empresa SET nota = ? WHERE id = ?", [nota, id]);

    const [updated] = await pool.query("SELECT * FROM prova_empresa WHERE id = ?", [id]);
    if (updated.length === 0) return res.status(404).json({ error: "Prova_empresa não encontrado." });
    
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar nota." });
  }
});

module.exports = router;
