const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const authOrApiKey = require("../middlewares/authOrApiKey");

/**
 * 📌 Criar vínculo entre Time e Instância WhatsApp
 */
router.post("/", authOrApiKey, async (req, res) => {
  try {
    const { team_id, whatsapp_instance_id, access_level } = req.body;

    if (!team_id || !whatsapp_instance_id) {
      return res.status(400).json({ error: "Campos obrigatórios: team_id e whatsapp_instance_id." });
    }

    // 🔍 Verifica se já existe o vínculo
    const [existing] = await pool.query(
      `SELECT * FROM team_whatsapp_instances WHERE team_id = ? AND whatsapp_instance_id = ?`,
      [team_id, whatsapp_instance_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: "Esse time já está vinculado a essa instância." });
    }

    // ➕ Cria o vínculo
    const [result] = await pool.query(
      `INSERT INTO team_whatsapp_instances (team_id, whatsapp_instance_id, access_level)
       VALUES (?, ?, ?)`,
      [team_id, whatsapp_instance_id, access_level || "total"]
    );

    res.status(201).json({
      id: result.insertId,
      team_id,
      whatsapp_instance_id,
      access_level: access_level || "total",
    });
  } catch (err) {
    console.error("Erro ao criar vínculo:", err);
    res.status(500).json({ error: "Erro ao criar vínculo." });
  }
});

/**
 * 📌 Listar todos os vínculos
 */
router.get("/", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        twi.id,
        twi.team_id,
        t.nome AS team_name,
        twi.whatsapp_instance_id,
        wi.instance_name,
        wi.phone_number,
        twi.access_level,
        twi.created_at
      FROM team_whatsapp_instances twi
      JOIN teams t ON twi.team_id = t.id
      JOIN whatsapp_instances wi ON twi.whatsapp_instance_id = wi.id
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar vínculos:", err);
    res.status(500).json({ error: "Erro ao listar vínculos." });
  }
});

/**
 * 📌 Listar vínculos por Time
 */
router.get("/team/:team_id", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        twi.id,
        twi.team_id,
        t.nome AS team_name,
        twi.whatsapp_instance_id,
        wi.instance_name,
        wi.phone_number,
        wi.instance_id,           -- adiciona o ID da instância
        wi.token,                       -- adiciona o token da instância
        wi.client_token,
        wi.status,
        twi.access_level,
        twi.created_at
      FROM team_whatsapp_instances twi
      JOIN teams t ON twi.team_id = t.id
      JOIN whatsapp_instances wi ON twi.whatsapp_instance_id = wi.id
      WHERE twi.team_id = ?
    `, [req.params.team_id]);

    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar vínculos por time:", err);
    res.status(500).json({ error: "Erro ao listar vínculos por time." });
  }
});


/**
 * 📌 Remover vínculo
 */
router.delete("/:id", authOrApiKey, async (req, res) => {
  try {
    const [result] = await pool.query("DELETE FROM team_whatsapp_instances WHERE id = ?", [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Vínculo não encontrado." });
    }

    res.json({ success: true, message: "Vínculo removido com sucesso." });
  } catch (err) {
    console.error("Erro ao remover vínculo:", err);
    res.status(500).json({ error: "Erro ao remover vínculo." });
  }
});

module.exports = router;
