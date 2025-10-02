const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const authOrApiKey = require("../../middlewares/authOrApiKey");

/**
 * 📌 Adicionar usuário a um time
 */
router.post("/", authOrApiKey, async (req, res) => {
  try {
    const { times_atendimento_id, usuario_id, role } = req.body;

    if (!times_atendimento_id || !usuario_id) {
      return res.status(400).json({ error: "Campos obrigatórios: times_atendimento_id, usuario_id." });
    }

    const [result] = await pool.query(
      "INSERT INTO times_atendimento_usuarios (times_atendimento_id, usuario_id, role) VALUES (?, ?, ?)",
      [times_atendimento_id, usuario_id, role || "Usuário"]
    );

    res.status(201).json({ id: result.insertId, times_atendimento_id, usuario_id, role });
  } catch (err) {
    console.error("Erro ao adicionar usuário ao time:", err);
    res.status(500).json({ error: "Erro ao adicionar usuário ao time." });
  }
});

/**
 * 📌 Listar todos os usuários de todos os times
 */
router.get("/", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        tu.id,
        tu.times_atendimento_id,
        t.nome AS time,
        u.nome AS usuario,
        u.email,
        tu.role
      FROM times_atendimento_usuarios tu
      JOIN times_atendimento t ON tu.times_atendimento_id = t.id
      JOIN users u ON tu.usuario_id = u.id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar usuários dos times." });
  }
});

/**
 * 📌 Buscar usuários de um time específico
 */
router.get("/time/:times_atendimento_id", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        tu.id,
        tu.times_atendimento_id,
        tu.usuario_id,
        t.nome AS time,
        u.nome AS usuario,
        u.email,
        tu.role
      FROM times_atendimento_usuarios tu
      JOIN times_atendimento t ON tu.times_atendimento_id = t.id
      JOIN users u ON tu.usuario_id = u.id
      WHERE tu.times_atendimento_id = ?`, 
      [req.params.times_atendimento_id]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar usuários do time." });
  }
});

/**
 * 📌 Buscar times de um usuário específico team-users/usuario/:usuario_id
 * Suporta filtro por empresa_id via query parameter
 */
router.get("/usuario/:usuario_id", authOrApiKey, async (req, res) => {
  try {
    const { empresa_id } = req.query;
    
    let query = `
      SELECT 
        tu.id,
        tu.times_atendimento_id,
        t.nome AS time,
        tu.role,
        t.criado_em,
        t.empresa_id
      FROM times_atendimento_usuarios tu
      JOIN times_atendimento t ON tu.times_atendimento_id = t.id
      WHERE tu.usuario_id = ?`;
    
    const params = [req.params.usuario_id];
    
    // Se empresa_id for fornecido, filtrar por empresa
    if (empresa_id) {
      query += ` AND t.empresa_id = ?`;
      params.push(empresa_id);
    }
    
    query += ` ORDER BY t.nome`;

    const [rows] = await pool.query(query, params);

    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar times do usuário:", err);
    res.status(500).json({ error: "Erro ao listar times do usuário." });
  }
});


/**
 * 📌 Atualizar papel de um usuário no time
 */
router.put("/:id", authOrApiKey, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: "Role é obrigatório." });

    await pool.query("UPDATE times_atendimento_usuarios SET role = ? WHERE id = ?", [role, req.params.id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar papel do usuário no time." });
  }
});

/**
 * 📌 Remover usuário do time
 */
router.delete("/:id", authOrApiKey, async (req, res) => {
  try {
    await pool.query("DELETE FROM times_atendimento_usuarios WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao remover usuário do time." });
  }
});

module.exports = router;
