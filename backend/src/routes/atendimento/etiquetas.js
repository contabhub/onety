const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const authOrApiKey = require("../middlewares/authOrApiKey");

/**
 * 📌 Criar etiqueta
 */
router.post("/", authOrApiKey, async (req, res) => {
  try {
    const { company_id, nome, cor } = req.body;

    if (!company_id || !nome || !cor) {
      return res.status(400).json({ error: "Campos obrigatórios: company_id, nome, cor." });
    }

    const [result] = await pool.query(
      `INSERT INTO etiquetas (company_id, nome, cor) VALUES (?, ?, ?)`,
      [company_id, nome, cor]
    );

    res.status(201).json({ id: result.insertId, company_id, nome, cor });
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Já existe uma etiqueta com esse nome nesta empresa." });
    }
    console.error("Erro ao criar etiqueta:", err);
    res.status(500).json({ error: "Erro ao criar etiqueta." });
  }
});

/**
 * 📌 Listar etiquetas por empresa
 */
router.get("/company/:companyId", authOrApiKey, async (req, res) => {
  try {
    const { companyId } = req.params;
    const [rows] = await pool.query(
      `SELECT * FROM etiquetas WHERE company_id = ? ORDER BY nome ASC`,
      [companyId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar etiquetas:", err);
    res.status(500).json({ error: "Erro ao listar etiquetas." });
  }
});

/**
 * 📌 Buscar etiqueta por ID
 */
router.get("/:id", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM etiquetas WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Etiqueta não encontrada." });
    res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao buscar etiqueta:", err);
    res.status(500).json({ error: "Erro ao buscar etiqueta." });
  }
});

/**
 * 📌 Atualizar etiqueta
 */
router.put("/:id", authOrApiKey, async (req, res) => {
  try {
    const { nome, cor } = req.body;
    if (!nome && !cor) {
      return res.status(400).json({ error: "Informe nome e/ou cor para atualizar." });
    }

    const fields = [];
    const values = [];
    if (nome !== undefined) { fields.push("nome = ?"); values.push(nome); }
    if (cor !== undefined) { fields.push("cor = ?"); values.push(cor); }
    values.push(req.params.id);

    await pool.query(
      `UPDATE etiquetas SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`,
      values
    );

    const [rows] = await pool.query(`SELECT * FROM etiquetas WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Etiqueta não encontrada." });
    res.json(rows[0]);
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Já existe uma etiqueta com esse nome nesta empresa." });
    }
    console.error("Erro ao atualizar etiqueta:", err);
    res.status(500).json({ error: "Erro ao atualizar etiqueta." });
  }
});

/**
 * 📌 Deletar etiqueta
 */
router.delete("/:id", authOrApiKey, async (req, res) => {
  try {
    await pool.query(`DELETE FROM etiquetas WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao deletar etiqueta:", err);
    res.status(500).json({ error: "Erro ao deletar etiqueta." });
  }
});

module.exports = router;


