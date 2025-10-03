const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const authOrApiKey = require("../../middlewares/authOrApiKey");

/**
 * 📌 Criar time
 */
router.post("/", authOrApiKey, async (req, res) => {
  try {
    const { nome, padrao, empresa_id, departamento_id } = req.body;

    if (!nome || !empresa_id) {
      return res.status(400).json({ error: "Campos obrigatórios: nome e empresa_id." });
    }

    // 🔄 Se padrao = 1, zera todos os outros times dessa empresa
    if (padrao === 1) {
      await pool.query("UPDATE times_atendimento SET padrao = 0 WHERE empresa_id = ?", [empresa_id]);
    }

    const [result] = await pool.query(
      `INSERT INTO times_atendimento (nome, padrao, empresa_id, departamento_id) VALUES (?, ?, ?, ?)`,
      [nome, padrao || 0, empresa_id, departamento_id || null]
    );

    res.status(201).json({ id: result.insertId, nome, padrao, empresa_id, departamento_id: departamento_id || null });
  } catch (err) {
    console.error("Erro ao criar time:", err);
    res.status(500).json({ error: "Erro ao criar time." });
  }
});

/**
 * 📌 Listar todos os times
 */
router.get("/", authOrApiKey, async (req, res) => {
  try {
    const { empresa_id } = req.query;
    console.log("📋 Buscando times com empresa_id:", empresa_id);
    
    let query = `
      SELECT 
        t.*,
        COUNT(tu.id) as usuarios
      FROM times_atendimento t
      LEFT JOIN times_atendimento_usuarios tu ON t.id = tu.times_atendimento_id
    `;
    
    const params = [];
    if (empresa_id) {
      query += ` WHERE t.empresa_id = ?`;
      params.push(empresa_id);
    }
    
    query += ` GROUP BY t.id ORDER BY t.nome`;
    
    console.log("🔍 Query SQL:", query);
    console.log("📊 Parâmetros:", params);
    
    const [rows] = await pool.query(query, params);
    console.log("✅ Times encontrados:", rows.length);
    
    res.json(rows);
  } catch (err) {
    console.error("❌ Erro ao listar times:", err);
    res.status(500).json({ error: "Erro ao listar times." });
  }
});

/**
 * 📌 Buscar time por ID
 */
router.get("/:id", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM times_atendimento WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Time não encontrado." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar time." });
  }
});

/**
 * 📌 Atualizar time
 */
router.put("/:id", authOrApiKey, async (req, res) => {
  try {
    const { nome, padrao, empresa_id, departamento_id } = req.body;

    if (!nome || !empresa_id) {
      return res.status(400).json({ error: "Campos obrigatórios: nome e empresa_id." });
    }

    // 🔄 Se padrao = 1, zera todos os outros times dessa empresa
    if (padrao === 1) {
      await pool.query("UPDATE times_atendimento SET padrao = 0 WHERE empresa_id = ?", [empresa_id]);
    }

    await pool.query(
      "UPDATE times_atendimento SET nome = ?, padrao = ?, empresa_id = ?, departamento_id = ? WHERE id = ?",
      [nome, padrao || 0, empresa_id, departamento_id || null, req.params.id]
    );

    res.json({ id: req.params.id, nome, padrao, empresa_id, departamento_id: departamento_id || null });
  } catch (err) {
    console.error("Erro ao atualizar time:", err);
    res.status(500).json({ error: "Erro ao atualizar time." });
  }
});

/**
 * 📌 Deletar time
 */
router.delete("/:id", authOrApiKey, async (req, res) => {
  try {
    await pool.query("DELETE FROM times_atendimento WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao deletar time." });
  }
});

module.exports = router;
