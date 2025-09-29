const express = require("express");
const pool = require("../../config/database");

const router = express.Router();

// Lista empresa_conteudo com paginação simples
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM empresa_conteudo ORDER BY id DESC LIMIT ? OFFSET ?",
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
    res.status(500).json({ error: "Erro ao listar empresa_conteudo." });
  }
});

// Busca empresa_conteudo por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM empresa_conteudo WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Empresa_conteudo não encontrado." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar empresa_conteudo." });
  }
});

// Cria novo empresa_conteudo
router.post("/", async (req, res) => {
  let conn;
  try {
    const payload = req.body || {};

    // Campos obrigatórios
    const { conteudo_id, empresa_id, viewer_id } = payload;
    
    // Validação básica
    if (!conteudo_id || !empresa_id || !viewer_id) {
      return res.status(400).json({ 
        error: "Campos obrigatórios: conteudo_id, empresa_id e viewer_id" 
      });
    }

    // Campos opcionais
    const { prova_id, concluido, prova } = payload;

    // Inicia transação
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO empresa_conteudo (conteudo_id, empresa_id, viewer_id, prova_id, concluido, prova) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        conteudo_id, 
        empresa_id, 
        viewer_id, 
        prova_id || null, 
        concluido || 0, 
        prova || 0
      ]
    );

    await conn.commit();

    const [created] = await pool.query("SELECT * FROM empresa_conteudo WHERE id = ?", [result.insertId]);
    res.status(201).json({ ...created[0] });
  } catch (error) {
    console.error(error);
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    res.status(500).json({ error: "Erro ao criar empresa_conteudo." });
  } finally {
    if (conn) conn.release();
  }
});

// Atualiza empresa_conteudo por ID (parcial - PATCH e também aceita PUT)
const buildUpdateQuery = (body) => {
  const allowed = [
    "conteudo_id",
    "empresa_id", 
    "viewer_id",
    "prova_id",
    "concluido",
    "prova"
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

    const sql = `UPDATE empresa_conteudo SET ${fields.join(", ")} WHERE id = ?`;
    await pool.query(sql, [...values, id]);

    const [updated] = await pool.query("SELECT * FROM empresa_conteudo WHERE id = ?", [id]);
    if (updated.length === 0) return res.status(404).json({ error: "Empresa_conteudo não encontrado." });
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar empresa_conteudo." });
  }
});

router.put("/:id", async (req, res) => {
  // Redireciona para a mesma lógica do PATCH
  req.method = "PATCH";
  return router.handle(req, res);
});

// Remove empresa_conteudo por ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query("SELECT id FROM empresa_conteudo WHERE id = ?", [id]);
    if (existing.length === 0) return res.status(404).json({ error: "Empresa_conteudo não encontrado." });

    await pool.query("DELETE FROM empresa_conteudo WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover empresa_conteudo." });
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
      "SELECT SQL_CALC_FOUND_ROWS * FROM empresa_conteudo WHERE empresa_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
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
    res.status(500).json({ error: "Erro ao buscar empresa_conteudo por empresa." });
  }
});

// Rota especial: Buscar por conteudo_id
router.get("/conteudo/:conteudo_id", async (req, res) => {
  try {
    const { conteudo_id } = req.params;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM empresa_conteudo WHERE conteudo_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
      [conteudo_id, limit, offset]
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
    res.status(500).json({ error: "Erro ao buscar empresa_conteudo por conteúdo." });
  }
});

module.exports = router;
