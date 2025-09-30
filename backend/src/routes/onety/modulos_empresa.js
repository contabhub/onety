const express = require("express");
const pool = require("../../config/database");

const router = express.Router();

// Lista vínculos com filtros e paginação
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    const { empresa_id, modulo_id, status } = req.query;

    const where = [];
    const params = [];
    if (empresa_id) { where.push("empresa_id = ?"); params.push(empresa_id); }
    if (modulo_id) { where.push("modulo_id = ?"); params.push(modulo_id); }
    if (status) { where.push("status = ?"); params.push(status); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `SELECT SQL_CALC_FOUND_ROWS id, empresa_id, modulo_id, status
       FROM modulos_empresa ${whereSql}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({ data: rows, page, limit, total: countRows[0]?.total || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar módulos por empresa." });
  }
});

// Buscar por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      "SELECT id, empresa_id, modulo_id, status FROM modulos_empresa WHERE id = ?",
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
    const { empresa_id, modulo_id, status = "liberado" } = req.body || {};
    if (!empresa_id || !modulo_id) {
      return res.status(400).json({ error: "Campos obrigatórios: empresa_id, modulo_id." });
    }

    // Evitar duplicidade do par empresa-modulo
    const [exists] = await pool.query(
      "SELECT id FROM modulos_empresa WHERE empresa_id = ? AND modulo_id = ?",
      [empresa_id, modulo_id]
    );
    if (exists.length > 0) return res.status(409).json({ error: "Vínculo já existente." });

    const [result] = await pool.query(
      `INSERT INTO modulos_empresa (empresa_id, modulo_id, status) VALUES (?,?,?)`,
      [empresa_id, modulo_id, status]
    );

    const [created] = await pool.query(
      "SELECT id, empresa_id, modulo_id, status FROM modulos_empresa WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json(created[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar vínculo módulo-empresa." });
  }
});

// Atualização parcial
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const allowed = ["empresa_id", "modulo_id", "status"];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        fields.push(`${key} = ?`);
        values.push(body[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar." });

    const sql = `UPDATE modulos_empresa SET ${fields.join(", ")} WHERE id = ?`;
    await pool.query(sql, [...values, id]);

    const [updated] = await pool.query(
      "SELECT id, empresa_id, modulo_id, status FROM modulos_empresa WHERE id = ?",
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

// Iniciar módulo (mudar de 'bloqueado' para 'em_andamento')
router.patch("/:id/iniciar", async (req, res) => {
  try {
    const { id } = req.params;

    // Busca vínculo atual
    const [rows] = await pool.query(
      "SELECT id, empresa_id, modulo_id, status FROM modulos_empresa WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Vínculo não encontrado." });
    }

    const current = rows[0];
    if (current.status !== "bloqueado") {
      return res.status(409).json({
        error: "Somente vínculos com status 'bloqueado' podem ser iniciados.",
      });
    }

    // Atualiza para 'em_andamento'
    await pool.query(
      "UPDATE modulos_empresa SET status = 'em_andamento' WHERE id = ?",
      [id]
    );

    const [updated] = await pool.query(
      "SELECT id, empresa_id, modulo_id, status FROM modulos_empresa WHERE id = ?",
      [id]
    );

    return res.json(updated[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao iniciar módulo." });
  }
});

// Remover
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [exists] = await pool.query("SELECT id FROM modulos_empresa WHERE id = ?", [id]);
    if (exists.length === 0) return res.status(404).json({ error: "Vínculo não encontrado." });
    await pool.query("DELETE FROM modulos_empresa WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover vínculo." });
  }
});

module.exports = router;


