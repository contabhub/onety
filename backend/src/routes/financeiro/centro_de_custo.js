const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// 🔹 Criar Centro de Custo
router.post("/", verifyToken, async (req, res) => {
  const { codigo, nome, situacao, empresa_id } = req.body;

  if (!empresa_id) {
    return res.status(400).json({ error: "empresa_id é obrigatório." });
  }

  try {
    // Verifica unicidade do código dentro da mesma empresa
    // const [exists] = await pool.query(
    //   `SELECT id FROM centro_custo WHERE codigo = ? AND empresa_id = ?`,
    //   [codigo, empresa_id]
    // );
    // if (exists.length > 0) {
    //   return res.status(409).json({ error: "Código já cadastrado para esta empresa." });
    // }

    const [result] = await pool.query(
      `INSERT INTO centro_custo (codigo, nome, situacao, empresa_id) VALUES (?, ?, ?, ?)`,
      [codigo, nome, situacao || 'ativo', empresa_id]
    );

    res.status(201).json({
      id: result.insertId,
      message: "Centro de custo criado com sucesso."
    });
  } catch (err) {
    console.error("Erro ao criar centro de custo:", err);
    res.status(500).json({ error: "Erro ao criar centro de custo." });
  }
});

// 🔹 Listar Centros de Custo — com filtro opcional por empresa
router.get("/", verifyToken, async (req, res) => {
  const { empresa_id } = req.query;

  try {
    let query = `SELECT * FROM centro_custo`;
    const params = [];

    // Se empresa_id foi fornecido, filtra por empresa
    if (empresa_id) {
      query += ` WHERE empresa_id = ?`;
      params.push(empresa_id);
    }

    query += ` ORDER BY criado_em DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar centros de custo:", err);
    res.status(500).json({ error: "Erro ao buscar centros de custo." });
  }
});

// 🔹 Buscar Centro de Custo por ID
router.get("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { empresa_id } = req.query;

  if (!empresa_id) {
    return res.status(400).json({ error: "empresa_id é obrigatório." });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM centro_custo WHERE id = ? AND empresa_id = ?`,
      [id, empresa_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Centro de custo não encontrado." });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao buscar centro de custo:", err);
    res.status(500).json({ error: "Erro ao buscar centro de custo." });
  }
});

// 🔹 Listar Centros de Custo de uma empresa específica
router.get("/empresa/:empresaId", verifyToken, async (req, res) => {
  const { empresaId } = req.params;

  if (!empresaId) {
    return res.status(400).json({ error: "empresaId é obrigatório na URL." });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM centro_custo WHERE empresa_id = ? ORDER BY criado_em DESC`,
      [empresaId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar centros de custo da empresa:", err);
    res.status(500).json({ error: "Erro ao buscar centros de custo da empresa." });
  }
});

// 🔹 Atualizar Centro de Custo
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { codigo, nome, situacao, empresa_id } = req.body;

  if (!empresa_id) {
    return res.status(400).json({ error: "empresa_id é obrigatório." });
  }

  try {
    // Verifica unicidade do código dentro da mesma empresa
    if (codigo) {
      const [exists] = await pool.query(
        `SELECT id FROM centro_custo WHERE codigo = ? AND id <> ? AND empresa_id = ?`,
        [codigo, id, empresa_id]
      );
      if (exists.length > 0) {
        return res.status(409).json({ error: "Código já cadastrado para esta empresa." });
      }
    }

    const [result] = await pool.query(
      `UPDATE centro_custo 
       SET codigo = IFNULL(?, codigo), 
           nome = IFNULL(?, nome), 
           situacao = IFNULL(?, situacao),
           atualizado_em = NOW()
       WHERE id = ? AND empresa_id = ?`,
      [codigo, nome, situacao, id, empresa_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Centro de custo não encontrado." });
    }

    res.json({ message: "Centro de custo atualizado com sucesso." });
  } catch (err) {
    console.error("Erro ao atualizar centro de custo:", err);
    res.status(500).json({ error: "Erro ao atualizar centro de custo." });
  }
});

// 🔹 Deletar Centro de Custo
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { empresa_id } = req.query;

  if (!empresa_id) {
    return res.status(400).json({ error: "empresa_id é obrigatório." });
  }

  try {
    const [result] = await pool.query(
      `DELETE FROM centro_custo WHERE id = ? AND empresa_id = ?`,
      [id, empresa_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Centro de custo não encontrado." });
    }

    res.json({ message: "Centro de custo deletado com sucesso." });
  } catch (err) {
    console.error("Erro ao deletar centro de custo:", err);
    res.status(500).json({ error: "Erro ao deletar centro de custo." });
  }
});

module.exports = router; 