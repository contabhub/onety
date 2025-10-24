const express = require("express");
const pool = require("../../config/database");

const router = express.Router();

// Conta membros por empresa
router.get("/count/:empresa_id", async (req, res) => {
  try {
    const { empresa_id } = req.params;
    
    // Primeiro verifica se a empresa existe
    const [empresaExists] = await pool.query(
      "SELECT id FROM empresas WHERE id = ?",
      [empresa_id]
    );
    
    if (empresaExists.length === 0) {
      return res.status(404).json({ error: "Empresa não encontrada." });
    }
    
    // Se a empresa existe, conta os membros
    const [rows] = await pool.query(
      "SELECT COUNT(*) as total FROM usuarios_empresas WHERE empresa_id = ?",
      [empresa_id]
    );
    
    res.json({ 
      empresa_id: parseInt(empresa_id),
      membros: rows[0]?.total || 0 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao contar membros da empresa." });
  }
});

// Buscar membros de uma empresa específica
router.get("/empresa/:empresa_id", async (req, res) => {
  try {
    const { empresa_id } = req.params;
    
    // Busca os membros da empresa com informações completas dos usuários
    const [rows] = await pool.query(`
      SELECT 
        ue.id,
        ue.usuario_id,
        ue.empresa_id,
        ue.cargo_id,
        ue.departamento_id,
        ue.criado_em,
        u.id as user_id,
        u.nome as full_name,
        u.email,
        u.avatar_url,
        c.nome as cargo_nome,
        d.nome as departamento_nome
      FROM usuarios_empresas ue
      LEFT JOIN usuarios u ON ue.usuario_id = u.id
      LEFT JOIN cargos c ON ue.cargo_id = c.id
      LEFT JOIN departamentos d ON ue.departamento_id = d.id
      WHERE ue.empresa_id = ? AND (c.nome IS NULL OR c.nome != 'Superadmin')
      ORDER BY u.nome ASC
    `, [empresa_id]);
    
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar membros da empresa." });
  }
});

// Lista com filtros e paginação
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const { usuario_id, empresa_id } = req.query;

    const where = [];
    const params = [];
    if (usuario_id) {
      where.push("usuario_id = ?");
      params.push(usuario_id);
    }
    if (empresa_id) {
      where.push("empresa_id = ?");
      params.push(empresa_id);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS ue.id, ue.usuario_id, ue.empresa_id, ue.cargo_id, ue.departamento_id, ue.criado_em
       FROM usuarios_empresas ue
       LEFT JOIN cargos c ON ue.cargo_id = c.id
       ${whereSql} ${whereSql ? 'AND' : 'WHERE'} (c.nome IS NULL OR c.nome != 'Superadmin')
       ORDER BY ue.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({ data: rows, page, limit, total: countRows[0]?.total || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar vínculos usuário-empresa." });
  }
});

// Buscar por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      "SELECT id, usuario_id, empresa_id, cargo_id, departamento_id, criado_em FROM usuarios_empresas WHERE id = ?",
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Vínculo não encontrado." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar vínculo." });
  }
});

// Criar vínculo
router.post("/", async (req, res) => {
  try {
    const { usuario_id, empresa_id, cargo_id = null, departamento_id = null } = req.body || {};
    if (!usuario_id || !empresa_id) {
      return res.status(400).json({ error: "Campos obrigatórios: usuario_id, empresa_id." });
    }

    // Evita duplicidade do mesmo par usuario-empresa
    const [exists] = await pool.query(
      "SELECT id FROM usuarios_empresas WHERE usuario_id = ? AND empresa_id = ?",
      [usuario_id, empresa_id]
    );
    if (exists.length > 0) return res.status(409).json({ error: "Vínculo já existente." });

    const [result] = await pool.query(
      `INSERT INTO usuarios_empresas (usuario_id, empresa_id, cargo_id, departamento_id)
       VALUES (?,?,?,?)`,
      [usuario_id, empresa_id, cargo_id, departamento_id]
    );

    const [created] = await pool.query(
      "SELECT id, usuario_id, empresa_id, cargo_id, departamento_id, criado_em FROM usuarios_empresas WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json(created[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar vínculo usuário-empresa." });
  }
});

// Atualização parcial
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const allowed = ["usuario_id", "empresa_id", "cargo_id", "departamento_id"];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        fields.push(`${key} = ?`);
        values.push(body[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar." });

    const sql = `UPDATE usuarios_empresas SET ${fields.join(", ")} WHERE id = ?`;
    await pool.query(sql, [...values, id]);

    const [updated] = await pool.query(
      "SELECT id, usuario_id, empresa_id, cargo_id, departamento_id, criado_em FROM usuarios_empresas WHERE id = ?",
      [id]
    );
    if (updated.length === 0) return res.status(404).json({ error: "Vínculo não encontrado." });
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar vínculo." });
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
    const [exists] = await pool.query("SELECT id FROM usuarios_empresas WHERE id = ?", [id]);
    if (exists.length === 0) return res.status(404).json({ error: "Vínculo não encontrado." });
    await pool.query("DELETE FROM usuarios_empresas WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover vínculo." });
  }
});

module.exports = router;


