const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const authOrApiKey = require("../middlewares/authOrApiKey");

/**
 * 📌 Associar etiqueta a contato
 */
router.post("/", authOrApiKey, async (req, res) => {
  try {
    const { contato_id, etiqueta_id } = req.body;
    if (!contato_id || !etiqueta_id) {
      return res.status(400).json({ error: "Campos obrigatórios: contato_id, etiqueta_id." });
    }

    await pool.query(
      `INSERT IGNORE INTO contatos_etiquetas (contato_id, etiqueta_id) VALUES (?, ?)`,
      [contato_id, etiqueta_id]
    );

    res.status(201).json({ contato_id, etiqueta_id });
  } catch (err) {
    console.error("Erro ao associar etiqueta ao contato:", err);
    res.status(500).json({ error: "Erro ao associar etiqueta ao contato." });
  }
});

/**
 * 📌 Remover associação etiqueta-contato
 */
router.delete("/", authOrApiKey, async (req, res) => {
  try {
    const { contato_id, etiqueta_id } = req.body;
    if (!contato_id || !etiqueta_id) {
      return res.status(400).json({ error: "Campos obrigatórios: contato_id, etiqueta_id." });
    }

    await pool.query(
      `DELETE FROM contatos_etiquetas WHERE contato_id = ? AND etiqueta_id = ?`,
      [contato_id, etiqueta_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao remover associação:", err);
    res.status(500).json({ error: "Erro ao remover associação." });
  }
});

/**
 * 📌 Listar etiquetas de um contato
 */
router.get("/contato/:contatoId", authOrApiKey, async (req, res) => {
  try {
    const { contatoId } = req.params;
    const [rows] = await pool.query(
      `SELECT e.*
       FROM contatos_etiquetas ce
       INNER JOIN etiquetas e ON e.id = ce.etiqueta_id
       WHERE ce.contato_id = ?
       ORDER BY e.nome ASC`,
      [contatoId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar etiquetas do contato:", err);
    res.status(500).json({ error: "Erro ao listar etiquetas do contato." });
  }
});

/**
 * 📌 Listar contatos por etiqueta (e opcionalmente por company)
 */
router.get("/etiqueta/:etiquetaId", authOrApiKey, async (req, res) => {
  try {
    const { etiquetaId } = req.params;
    const { company_id } = req.query;

    const baseSql = `
      SELECT c.*
      FROM contatos_etiquetas ce
      INNER JOIN contacts c ON c.id = ce.contato_id
      WHERE ce.etiqueta_id = ?`;

    const params = [etiquetaId];
    let sql = baseSql;
    if (company_id) {
      sql += " AND c.company_id = ?";
      params.push(company_id);
    }
    sql += " ORDER BY c.created_at DESC";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar contatos por etiqueta:", err);
    res.status(500).json({ error: "Erro ao listar contatos por etiqueta." });
  }
});

module.exports = router;


