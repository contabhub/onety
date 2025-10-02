const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const authOrApiKey = require("../../middlewares/authOrApiKey");

/**
 * 📌 Criar vínculo entre Time de Atendimento e Instância
 */
router.post("/", authOrApiKey, async (req, res) => {
  try {
    const { times_atendimento_id, instancia_id, nivel_acesso } = req.body;

    if (!times_atendimento_id || !instancia_id) {
      return res.status(400).json({ error: "Campos obrigatórios: times_atendimento_id e instancia_id." });
    }

    // 🔍 Verifica se já existe o vínculo
    const [existing] = await pool.query(
      `SELECT * FROM times_atendimento_instancias WHERE times_atendimento_id = ? AND instancia_id = ?`,
      [times_atendimento_id, instancia_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: "Esse time já está vinculado a essa instância." });
    }

    // ➕ Cria o vínculo
    const [result] = await pool.query(
      `INSERT INTO times_atendimento_instancias (times_atendimento_id, instancia_id, nivel_acesso)
       VALUES (?, ?, ?)`,
      [times_atendimento_id, instancia_id, nivel_acesso || "total"]
    );

    res.status(201).json({
      id: result.insertId,
      times_atendimento_id,
      instancia_id,
      nivel_acesso: nivel_acesso || "total",
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
        tai.id,
        tai.times_atendimento_id,
        t.nome AS time_nome,
        tai.instancia_id,
        i.instancia_nome,
        i.telefone,
        tai.nivel_acesso,
        tai.criado_em
      FROM times_atendimento_instancias tai
      JOIN times_atendimento t ON tai.times_atendimento_id = t.id
      JOIN instancias i ON tai.instancia_id = i.id
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
router.get("/time/:times_atendimento_id", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        tai.id,
        tai.times_atendimento_id,
        t.nome AS time_nome,
        tai.instancia_id,
        i.instancia_nome,
        i.telefone,
        i.instancia_id AS instancia_codigo,
        i.token,
        i.cliente_token,
        i.status,
        tai.nivel_acesso,
        tai.criado_em
      FROM times_atendimento_instancias tai
      JOIN times_atendimento t ON tai.times_atendimento_id = t.id
      JOIN instancias i ON tai.instancia_id = i.id
      WHERE tai.times_atendimento_id = ?
    `, [req.params.times_atendimento_id]);

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
    const [result] = await pool.query("DELETE FROM times_atendimento_instancias WHERE id = ?", [req.params.id]);

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
