const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const authOrApiKey = require("../../middlewares/authOrApiKey");

/**
 * 📌 Associar etiqueta a lead
 */
router.post("/", authOrApiKey, async (req, res) => {
  try {
    const { lead_id, etiqueta_id } = req.body;
    if (!lead_id || !etiqueta_id) {
      return res.status(400).json({ error: "Campos obrigatórios: lead_id, etiqueta_id." });
    }

    await pool.query(
      `INSERT IGNORE INTO leads_etiquetas (lead_id, etiqueta_id) VALUES (?, ?)`,
      [lead_id, etiqueta_id]
    );

    res.status(201).json({ lead_id, etiqueta_id });
  } catch (err) {
    console.error("Erro ao associar etiqueta ao lead:", err);
    res.status(500).json({ error: "Erro ao associar etiqueta ao lead." });
  }
});

/**
 * 📌 Remover associação etiqueta-lead
 */
router.delete("/", authOrApiKey, async (req, res) => {
  try {
    const { lead_id, etiqueta_id } = req.body;
    if (!lead_id || !etiqueta_id) {
      return res.status(400).json({ error: "Campos obrigatórios: lead_id, etiqueta_id." });
    }

    await pool.query(
      `DELETE FROM leads_etiquetas WHERE lead_id = ? AND etiqueta_id = ?`,
      [lead_id, etiqueta_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao remover associação:", err);
    res.status(500).json({ error: "Erro ao remover associação." });
  }
});

/**
 * 📌 Listar etiquetas de um lead
 */
router.get("/lead/:leadId", authOrApiKey, async (req, res) => {
  try {
    const { leadId } = req.params;
    const [rows] = await pool.query(
      `SELECT e.*
       FROM leads_etiquetas le
       INNER JOIN etiquetas e ON e.id = le.etiqueta_id
       WHERE le.lead_id = ?
       ORDER BY e.nome ASC`,
      [leadId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar etiquetas do lead:", err);
    res.status(500).json({ error: "Erro ao listar etiquetas do lead." });
  }
});

/**
 * 📌 Listar leads por etiqueta (e opcionalmente por empresa)
 */
router.get("/etiqueta/:etiquetaId", authOrApiKey, async (req, res) => {
  try {
    const { etiquetaId } = req.params;
    const { empresa_id } = req.query;

    const baseSql = `
      SELECT l.*
      FROM leads_etiquetas le
      INNER JOIN leads l ON l.id = le.lead_id
      WHERE le.etiqueta_id = ?`;

    const params = [etiquetaId];
    let sql = baseSql;
    if (empresa_id) {
      sql += " AND l.empresa_id = ?";
      params.push(empresa_id);
    }
    sql += " ORDER BY l.criado_em DESC";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar leads por etiqueta:", err);
    res.status(500).json({ error: "Erro ao listar leads por etiqueta." });
  }
});

module.exports = router;


