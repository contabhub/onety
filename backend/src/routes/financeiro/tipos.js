const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// 🔹 Criar Tipo
router.post("/", verifyToken, async (req, res) => {
  const { nome, company_id } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO tipos (nome, company_id) VALUES (?, ?)`,
      [nome, company_id]
    );
    res.status(201).json({ id: result.insertId, message: "Tipo criado com sucesso." });
  } catch (err) {
    console.error("Erro ao criar tipo:", err);
    res.status(500).json({ error: "Erro ao criar tipo." });
  }
});

// 🔹 Listar todos os Tipos
router.get("/", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM tipos ORDER BY created_at DESC`);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar todos os tipos:", err);
    res.status(500).json({ error: "Erro ao buscar todos os tipos." });
  }
});

// 🔹 Listar Tipos por empresa
router.get("/empresa/:companyId", verifyToken, async (req, res) => {
  const { companyId } = req.params;
  try {
    const [rows] = await pool.query(`SELECT * FROM tipos WHERE company_id = ?`, [companyId]);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar tipos:", err);
    res.status(500).json({ error: "Erro ao buscar tipos." });
  }
});

// 🔹 Atualizar Tipo
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;

  try {
    const [result] = await pool.query(`UPDATE tipos SET nome = ? WHERE id = ?`, [nome, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Tipo não encontrado." });
    }

    res.json({ message: "Tipo atualizado com sucesso." });
  } catch (err) {
    console.error("Erro ao atualizar tipo:", err);
    res.status(500).json({ error: "Erro ao atualizar tipo." });
  }
});

// 🔹 Deletar Tipo
// 🔹 Deletar Tipo
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Verifica se o tipo é padrão
    const [check] = await pool.query(`SELECT is_default FROM tipos WHERE id = ?`, [id]);

    if (check.length === 0) {
      return res.status(404).json({ error: "Tipo não encontrado." });
    }

    if (check[0].is_default) {
      return res.status(403).json({ error: "Tipo padrão não pode ser excluído." });
    }

    const [result] = await pool.query(`DELETE FROM tipos WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Tipo não encontrado." });
    }

    res.json({ message: "Tipo deletado com sucesso." });
  } catch (err) {
    console.error("Erro ao deletar tipo:", err);
    res.status(500).json({ error: "Erro ao deletar tipo." });
  }
});


// 🔹 Atualizar ordem das subcategorias
router.put("/ordenar", verifyToken, async (req, res) => {
  const { novaOrdem } = req.body; // Ex: [{ id: 3, ordem: 1 }, { id: 5, ordem: 2 }]

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const item of novaOrdem) {
      await connection.query(`UPDATE sub_categorias SET ordem = ? WHERE id = ?`, [item.ordem, item.id]);
    }

    await connection.commit();
    res.json({ message: "Ordem atualizada com sucesso!" });
  } catch (error) {
    await connection.rollback();
    console.error("Erro ao atualizar ordem:", error);
    res.status(500).json({ error: "Erro ao atualizar ordem." });
  } finally {
    connection.release();
  }
});


module.exports = router;