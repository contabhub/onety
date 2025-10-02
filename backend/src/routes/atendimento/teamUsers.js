const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const authOrApiKey = require("../middlewares/authOrApiKey");

/**
 * 📌 Adicionar usuário a um time
 */
router.post("/", authOrApiKey, async (req, res) => {
  try {
    const { team_id, user_id, role } = req.body;

    if (!team_id || !user_id) {
      return res.status(400).json({ error: "Campos obrigatórios: team_id, user_id." });
    }

    const [result] = await pool.query(
      "INSERT INTO team_users (team_id, user_id, role) VALUES (?, ?, ?)",
      [team_id, user_id, role || "Usuário"]
    );

    res.status(201).json({ id: result.insertId, team_id, user_id, role });
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
        tu.team_id, -- ✅ Agora trazendo o team_id
        t.nome AS time, 
        u.nome AS usuario, 
        u.email, 
        tu.role
      FROM team_users tu
      JOIN teams t ON tu.team_id = t.id
      JOIN users u ON tu.user_id = u.id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar usuários dos times." });
  }
});

/**
 * 📌 Buscar usuários de um time específico
 */
router.get("/team/:team_id", authOrApiKey, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        tu.id, 
        tu.team_id,
        tu.user_id, -- ✅ Adicionando user_id que estava faltando
        t.nome AS time, 
        u.nome AS usuario, 
        u.email, 
        tu.role
      FROM team_users tu
      JOIN teams t ON tu.team_id = t.id
      JOIN users u ON tu.user_id = u.id
      WHERE tu.team_id = ?`, 
      [req.params.team_id]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar usuários do time." });
  }
});

/**
 * 📌 Buscar times de um usuário específico team-users/user/:user_id
 * Agora suporta filtro por company_id via query parameter
 */
router.get("/user/:user_id", authOrApiKey, async (req, res) => {
  try {
    const { company_id } = req.query;
    
    let query = `
      SELECT 
        tu.id, 
        tu.team_id,
        t.nome AS time, 
        tu.role,
        t.created_at,
        t.company_id
      FROM team_users tu
      JOIN teams t ON tu.team_id = t.id
      WHERE tu.user_id = ?`;
    
    const params = [req.params.user_id];
    
    // Se company_id for fornecido, filtrar por empresa
    if (company_id) {
      query += ` AND t.company_id = ?`;
      params.push(company_id);
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

    await pool.query("UPDATE team_users SET role = ? WHERE id = ?", [role, req.params.id]);

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
    await pool.query("DELETE FROM team_users WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao remover usuário do time." });
  }
});

module.exports = router;
