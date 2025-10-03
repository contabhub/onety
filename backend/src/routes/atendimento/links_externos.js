const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const authOrApiKey = require("../../middlewares/authOrApiKey");

/**
 * 📌 POST /links-externos - Criar link externo
 */
router.post("/", authOrApiKey, async (req, res) => {
  try {
    const { nome, link, empresa_id } = req.body;

    if (!nome || !link || !empresa_id) {
      return res.status(400).json({ error: "Campos obrigatórios: nome, link, empresa_id." });
    }

    // Validar formato da URL
    try {
      new URL(link);
    } catch (err) {
      return res.status(400).json({ error: "Formato de URL inválido." });
    }

    const [result] = await pool.query(
      `INSERT INTO links_externos (nome, link, empresa_id) VALUES (?, ?, ?)`,
      [nome, link, empresa_id]
    );

    res.status(201).json({ 
      id: result.insertId, 
      nome, 
      link, 
      empresa_id,
      message: "Link externo criado com sucesso!"
    });
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Já existe um link com esse nome nesta empresa." });
    }
    console.error("Erro ao criar link externo:", err);
    res.status(500).json({ error: "Erro ao criar link externo." });
  }
});

/**
 * 📌 GET /links-externos/company/:companyId - Listar links externos por empresa
 */
router.get("/company/:companyId", authOrApiKey, async (req, res) => {
  try {
    const { companyId } = req.params;
    const [rows] = await pool.query(
      `SELECT * FROM links_externos WHERE empresa_id = ? ORDER BY nome ASC`,
      [companyId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar links externos:", err);
    res.status(500).json({ error: "Erro ao listar links externos." });
  }
});

/**
 * 📌 GET /links-externos/:id - Buscar link externo por ID
 */
router.get("/:id", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM links_externos WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Link externo não encontrado." });
    res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao buscar link externo:", err);
    res.status(500).json({ error: "Erro ao buscar link externo." });
  }
});

/**
 * 📌 PUT /links-externos/:id - Atualizar link externo
 */
router.put("/:id", authOrApiKey, async (req, res) => {
  try {
    const { nome, link } = req.body;
    
    if (!nome && !link) {
      return res.status(400).json({ error: "Informe nome e/ou link para atualizar." });
    }

    // Validar formato da URL se fornecida
    if (link) {
      try {
        new URL(link);
      } catch (err) {
        return res.status(400).json({ error: "Formato de URL inválido." });
      }
    }

    const fields = [];
    const values = [];
    if (nome !== undefined) { fields.push("nome = ?"); values.push(nome); }
    if (link !== undefined) { fields.push("link = ?"); values.push(link); }
    values.push(req.params.id);

    await pool.query(
      `UPDATE links_externos SET ${fields.join(", ")}, atualizado_em = NOW() WHERE id = ?`,
      values
    );

    const [rows] = await pool.query(`SELECT * FROM links_externos WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Link externo não encontrado." });
    res.json(rows[0]);
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Já existe um link com esse nome nesta empresa." });
    }
    console.error("Erro ao atualizar link externo:", err);
    res.status(500).json({ error: "Erro ao atualizar link externo." });
  }
});

/**
 * 📌 DELETE /links-externos/:id - Deletar link externo
 */
router.delete("/:id", authOrApiKey, async (req, res) => {
  try {
    const [result] = await pool.query(`DELETE FROM links_externos WHERE id = ?`, [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Link externo não encontrado." });
    }
    
    res.json({ success: true, message: "Link externo deletado com sucesso!" });
  } catch (err) {
    console.error("Erro ao deletar link externo:", err);
    res.status(500).json({ error: "Erro ao deletar link externo." });
  }
});

module.exports = router;
