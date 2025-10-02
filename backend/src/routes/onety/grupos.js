const express = require("express");
const pool = require("../../config/database");

const router = express.Router();

// Lista grupos com paginação
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;
    const moduloId = req.query.modulo_id ? Number(req.query.modulo_id) : null;

    let query = `
      SELECT SQL_CALC_FOUND_ROWS 
        g.id, 
        g.nome, 
        g.ordem, 
        g.ativo,
        g.modulo_id,
        m.nome as modulo_nome
      FROM grupos g
      LEFT JOIN modulos m ON g.modulo_id = m.id
    `;
    let params = [];

    if (moduloId) {
      query += " WHERE g.modulo_id = ?";
      params.push(moduloId);
    }

    query += " ORDER BY g.ordem ASC, g.id ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);
    const [countRows] = await pool.query("SELECT FOUND_ROWS() as total");

    res.json({ data: rows, page, limit, total: countRows[0]?.total || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar grupos." });
  }
});

// Buscar grupo por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT 
        g.id, 
        g.nome, 
        g.ordem, 
        g.ativo,
        g.modulo_id,
        m.nome as modulo_nome
      FROM grupos g
      LEFT JOIN modulos m ON g.modulo_id = m.id
      WHERE g.id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Grupo não encontrado." });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar grupo." });
  }
});

// Criar grupo
router.post("/", async (req, res) => {
  try {
    const { nome, modulo_id, ordem = 1, ativo = 1 } = req.body || {};
    
    if (!nome || !modulo_id) {
      return res.status(400).json({ error: "Campos obrigatórios: nome e modulo_id." });
    }

    const [result] = await pool.query(
      "INSERT INTO grupos (nome, modulo_id, ordem, ativo) VALUES (?, ?, ?, ?)",
      [nome, modulo_id, ordem, ativo]
    );

    const [created] = await pool.query(
      `SELECT 
        g.id, 
        g.nome, 
        g.ordem, 
        g.ativo,
        g.modulo_id,
        m.nome as modulo_nome
      FROM grupos g
      LEFT JOIN modulos m ON g.modulo_id = m.id
      WHERE g.id = ?`,
      [result.insertId]
    );

    res.status(201).json(created[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar grupo." });
  }
});

// Atualizar grupo
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, modulo_id, ordem, ativo } = req.body || {};

    // Monta atualização dinâmica
    const fields = [];
    const values = [];
    if (nome !== undefined) { fields.push("nome = ?"); values.push(nome); }
    if (modulo_id !== undefined) { fields.push("modulo_id = ?"); values.push(modulo_id); }
    if (ordem !== undefined) { fields.push("ordem = ?"); values.push(ordem); }
    if (ativo !== undefined) { fields.push("ativo = ?"); values.push(ativo); }
    
    if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar." });

    values.push(id);
    await pool.query(`UPDATE grupos SET ${fields.join(", ")} WHERE id = ?`, values);

    const [updated] = await pool.query(
      `SELECT 
        g.id, 
        g.nome, 
        g.ordem, 
        g.ativo,
        g.modulo_id,
        m.nome as modulo_nome
      FROM grupos g
      LEFT JOIN modulos m ON g.modulo_id = m.id
      WHERE g.id = ?`,
      [id]
    );
    
    if (updated.length === 0) return res.status(404).json({ error: "Grupo não encontrado." });
    res.json(updated[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar grupo." });
  }
});

// Reordenar grupos de um módulo
router.patch("/modulo/:modulo_id/reordenar", async (req, res) => {
  try {
    const { modulo_id } = req.params;
    const { grupos } = req.body || {};
    
    if (!Array.isArray(grupos)) {
      return res.status(400).json({ error: "Campo 'grupos' deve ser um array." });
    }

    // Iniciar transação
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      // Atualizar ordem de cada grupo
      for (let i = 0; i < grupos.length; i++) {
        const { id, ordem } = grupos[i];
        if (id && ordem !== undefined) {
          await conn.query(
            "UPDATE grupos SET ordem = ? WHERE id = ? AND modulo_id = ?",
            [ordem, id, modulo_id]
          );
        }
      }

      await conn.commit();

      // Buscar grupos atualizados
      const [updated] = await pool.query(
        `SELECT 
          g.id, 
          g.nome, 
          g.ordem, 
          g.ativo,
          g.modulo_id,
          m.nome as modulo_nome
        FROM grupos g
        LEFT JOIN modulos m ON g.modulo_id = m.id
        WHERE g.modulo_id = ? 
        ORDER BY g.ordem ASC, g.id ASC`,
        [modulo_id]
      );

      res.json({ data: updated, message: "Ordem atualizada com sucesso." });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao reordenar grupos." });
  }
});

// Remover grupo
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query("DELETE FROM grupos WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Grupo não encontrado." });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao remover grupo." });
  }
});

module.exports = router;
