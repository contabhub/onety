const express = require("express");
const pool = require("../../config/database");

const router = express.Router();

// Lista provas com paginação simples
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM prova ORDER BY id DESC LIMIT ? OFFSET ?",
      [limit, offset]
    );
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({
      data: rows,
      page,
      limit,
      total: countRows[0]?.total || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar provas." });
  }
});

// Busca prova por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM prova WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Prova não encontrada." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar prova." });
  }
});

// Cria nova prova
router.post("/", async (req, res) => {
  let conn;
  try {
    const payload = req.body || {};

    // Campos obrigatórios
    const { nome, conteudo_id, grupo_id } = payload;
    
    // Validação básica - deve ter nome e pelo menos um vínculo
    if (!nome || (!conteudo_id && !grupo_id)) {
      return res.status(400).json({ 
        error: "Campos obrigatórios: nome e (conteudo_id OU grupo_id)" 
      });
    }

    // Não pode ter ambos preenchidos
    if (conteudo_id && grupo_id) {
      return res.status(400).json({ 
        error: "Prova deve ser vinculada a um conteúdo OU um grupo, não ambos" 
      });
    }

    // Verificar se já existe prova para este conteúdo
    if (conteudo_id) {
      const [existingConteudo] = await pool.query(
        "SELECT id FROM prova WHERE conteudo_id = ?",
        [conteudo_id]
      );
      if (existingConteudo.length > 0) {
        return res.status(409).json({ 
          error: "Já existe uma prova para este conteúdo" 
        });
      }
    }

    // Verificar se já existe prova para este grupo
    if (grupo_id) {
      const [existingGrupo] = await pool.query(
        "SELECT id FROM prova WHERE grupo_id = ?",
        [grupo_id]
      );
      if (existingGrupo.length > 0) {
        return res.status(409).json({ 
          error: "Já existe uma prova para este grupo" 
        });
      }
    }

    // Inicia transação
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO prova (nome, conteudo_id, grupo_id) VALUES (?, ?, ?)`,
      [nome, conteudo_id || null, grupo_id || null]
    );

    await conn.commit();

    const [created] = await pool.query("SELECT * FROM prova WHERE id = ?", [result.insertId]);
    res.status(201).json({ ...created[0] });
  } catch (error) {
    console.error(error);
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    res.status(500).json({ error: "Erro ao criar prova." });
  } finally {
    if (conn) conn.release();
  }
});

// Atualiza prova por ID (parcial - PATCH e também aceita PUT)
const buildUpdateQuery = (body) => {
  const allowed = [
    "nome",
    "conteudo_id",
    "grupo_id"
  ];

  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  return { fields, values };
};

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fields, values } = buildUpdateQuery(req.body || {});
    if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar." });

    const body = req.body || {};
    const { conteudo_id, grupo_id } = body;

    // Verificar se está tentando alterar para um conteúdo/grupo que já tem prova
    if (conteudo_id !== undefined) {
      const [existingConteudo] = await pool.query(
        "SELECT id FROM prova WHERE conteudo_id = ? AND id != ?",
        [conteudo_id, id]
      );
      if (existingConteudo.length > 0) {
        return res.status(409).json({ 
          error: "Já existe uma prova para este conteúdo" 
        });
      }
    }

    if (grupo_id !== undefined) {
      const [existingGrupo] = await pool.query(
        "SELECT id FROM prova WHERE grupo_id = ? AND id != ?",
        [grupo_id, id]
      );
      if (existingGrupo.length > 0) {
        return res.status(409).json({ 
          error: "Já existe uma prova para este grupo" 
        });
      }
    }

    const sql = `UPDATE prova SET ${fields.join(", ")} WHERE id = ?`;
    await pool.query(sql, [...values, id]);

    const [updated] = await pool.query("SELECT * FROM prova WHERE id = ?", [id]);
    if (updated.length === 0) return res.status(404).json({ error: "Prova não encontrada." });
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar prova." });
  }
});

router.put("/:id", async (req, res) => {
  // Redireciona para a mesma lógica do PATCH
  req.method = "PATCH";
  return router.handle(req, res);
});

// Remove prova por ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query("SELECT id FROM prova WHERE id = ?", [id]);
    if (existing.length === 0) return res.status(404).json({ error: "Prova não encontrada." });

    await pool.query("DELETE FROM prova WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover prova." });
  }
});

// Rota especial: Buscar por conteudo_id
router.get("/conteudo/:conteudo_id", async (req, res) => {
  try {
    const { conteudo_id } = req.params;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM prova WHERE conteudo_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
      [conteudo_id, limit, offset]
    );
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({
      data: rows,
      page,
      limit,
      total: countRows[0]?.total || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar provas por conteúdo." });
  }
});

// Rota especial: Buscar por grupo_id
router.get("/grupo/:grupo_id", async (req, res) => {
  try {
    const { grupo_id } = req.params;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT SQL_CALC_FOUND_ROWS * FROM prova WHERE grupo_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
      [grupo_id, limit, offset]
    );
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({
      data: rows,
      page,
      limit,
      total: countRows[0]?.total || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar provas por grupo." });
  }
});

module.exports = router;
