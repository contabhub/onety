const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// 🔹 Criar Centro de Custo
router.post("/", verifyToken, async (req, res) => {
  const { codigo, nome, situacao, company_id } = req.body;

  if (!company_id) {
    return res.status(400).json({ error: "company_id é obrigatório." });
  }

  try {
    // Verifica unicidade do código dentro da mesma empresa
    // const [exists] = await pool.query(
    //   `SELECT id FROM centro_de_custo WHERE codigo = ? AND company_id = ?`,
    //   [codigo, company_id]
    // );
    // if (exists.length > 0) {
    //   return res.status(409).json({ error: "Código já cadastrado para esta empresa." });
    // }

    const [result] = await pool.query(
      `INSERT INTO centro_de_custo (codigo, nome, situacao, company_id) VALUES (?, ?, ?, ?)`,
      [codigo, nome, situacao || 'ativo', company_id]
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
  const { company_id } = req.query;

  try {
    let query = `SELECT * FROM centro_de_custo`;
    const params = [];

    // Se company_id foi fornecido, filtra por empresa
    if (company_id) {
      query += ` WHERE company_id = ?`;
      params.push(company_id);
    }

    query += ` ORDER BY created_at DESC`;

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
  const { company_id } = req.query;

  if (!company_id) {
    return res.status(400).json({ error: "company_id é obrigatório." });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM centro_de_custo WHERE id = ? AND company_id = ?`,
      [id, company_id]
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
router.get("/empresa/:companyId", verifyToken, async (req, res) => {
  const { companyId } = req.params;

  if (!companyId) {
    return res.status(400).json({ error: "companyId é obrigatório na URL." });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM centro_de_custo WHERE company_id = ? ORDER BY created_at DESC`,
      [companyId]
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
  const { codigo, nome, situacao, company_id } = req.body;

  if (!company_id) {
    return res.status(400).json({ error: "company_id é obrigatório." });
  }

  try {
    // Verifica unicidade do código dentro da mesma empresa
    if (codigo) {
      const [exists] = await pool.query(
        `SELECT id FROM centro_de_custo WHERE codigo = ? AND id <> ? AND company_id = ?`,
        [codigo, id, company_id]
      );
      if (exists.length > 0) {
        return res.status(409).json({ error: "Código já cadastrado para esta empresa." });
      }
    }

    const [result] = await pool.query(
      `UPDATE centro_de_custo 
       SET codigo = IFNULL(?, codigo), 
           nome = IFNULL(?, nome), 
           situacao = IFNULL(?, situacao)
       WHERE id = ? AND company_id = ?`,
      [codigo, nome, situacao, id, company_id]
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
  const { company_id } = req.query;

  if (!company_id) {
    return res.status(400).json({ error: "company_id é obrigatório." });
  }

  try {
    const [result] = await pool.query(
      `DELETE FROM centro_de_custo WHERE id = ? AND company_id = ?`,
      [id, company_id]
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