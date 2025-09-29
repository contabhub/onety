const express = require("express");
const pool = require("../../config/database");

const router = express.Router();

// Lista modulos com paginação
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS id, nome, descricao, logo_url FROM modulos ORDER BY id DESC LIMIT ? OFFSET ?",
      [limit, offset]
    );
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({ data: rows, page, limit, total: countRows[0]?.total || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar módulos." });
  }
});

// Buscar por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      "SELECT id, nome, descricao, logo_url FROM modulos WHERE id = ?",
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Módulo não encontrado." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar módulo." });
  }
});

// Criar módulo
router.post("/", async (req, res) => {
  try {
    const { nome, descricao = null, logo_url = null } = req.body || {};
    if (!nome) return res.status(400).json({ error: "Campo obrigatório: nome." });

    const [result] = await pool.query(
      `INSERT INTO modulos (nome, descricao, logo_url) VALUES (?,?,?)`,
      [nome, descricao, logo_url]
    );

    const [created] = await pool.query(
      "SELECT id, nome, descricao, logo_url FROM modulos WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json(created[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar módulo." });
  }
});

// Atualização parcial
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const allowed = ["nome", "descricao", "logo_url"];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        fields.push(`${key} = ?`);
        values.push(body[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar." });

    const sql = `UPDATE modulos SET ${fields.join(", ")} WHERE id = ?`;
    await pool.query(sql, [...values, id]);

    const [updated] = await pool.query(
      "SELECT id, nome, descricao, logo_url FROM modulos WHERE id = ?",
      [id]
    );
    if (updated.length === 0) return res.status(404).json({ error: "Módulo não encontrado." });
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar módulo." });
  }
});

router.put("/:id", async (req, res) => {
  req.method = "PATCH";
  return router.handle(req, res);
});

// Remover
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [exists] = await pool.query("SELECT id FROM modulos WHERE id = ?", [id]);
    if (exists.length === 0) return res.status(404).json({ error: "Módulo não encontrado." });
    await pool.query("DELETE FROM modulos WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover módulo." });
  }
});

module.exports = router;


