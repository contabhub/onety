const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// 🔹 Criar Subcategoria
router.post("/", verifyToken, async (req, res) => {
  const { nome, categoria_id, ordem, padrao = 0 } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO straton_subcategorias (nome, categoria_id, ordem, padrao) VALUES (?, ?, ?, ?)`,
      [nome, categoria_id, ordem || 0, padrao]
    );
    res.status(201).json({ id: result.insertId, message: "Subcategoria criada com sucesso." });
  } catch (err) {
    console.error("Erro ao criar subcategoria:", err);
    res.status(500).json({ error: "Erro ao criar subcategoria." });
  }
});

// 🔹 Listar Subcategorias por categoria
router.get("/categoria/:categoriaId", verifyToken, async (req, res) => {
  const { categoriaId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM straton_subcategorias WHERE categoria_id = ? ORDER BY ordem ASC`,
      [categoriaId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar subcategorias:", err);
    res.status(500).json({ error: "Erro ao buscar subcategorias." });
  }
});

// 🔹 Listar todas as Subcategorias
router.get("/", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM straton_subcategorias ORDER BY ordem ASC`);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar todas subcategorias:", err);
    res.status(500).json({ error: "Erro ao buscar subcategorias." });
  }
});

// 🔹 Listar Subcategorias por empresaId via relacionamento
router.get("/empresa/:empresaId", verifyToken, async (req, res) => {
  const { empresaId } = req.params;

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        sc.id,
        sc.nome,
        sc.categoria_id,
        sc.ordem,
        sc.padrao,
        sc.criado_em,
        c.nome as categoria_nome
      FROM straton_subcategorias sc
      INNER JOIN straton_categorias c ON sc.categoria_id = c.id AND sc.empresa_id = c.empresa_id
      WHERE sc.empresa_id = ?
      ORDER BY c.nome ASC, sc.ordem ASC
      `,
      [empresaId]
    );

    console.log("📊 Total de subcategorias encontradas:", rows.length);
    if (rows.length > 0) {
      console.log("📋 Primeira subcategoria:", rows[0]);
    }

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar subcategorias por empresa:", err);
    res.status(500).json({ error: "Erro ao buscar subcategorias por empresa." });
  }
});

// 🔹 Atualizar Subcategoria
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { nome, categoria_id, ordem } = req.body;
  try {
    const [result] = await pool.query(
      `UPDATE straton_subcategorias SET nome = ?, categoria_id = ?, ordem = ? WHERE id = ?`,
      [nome, categoria_id, ordem || 0, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Subcategoria não encontrada." });
    }

    res.json({ message: "Subcategoria atualizada com sucesso." });
  } catch (err) {
    console.error("Erro ao atualizar subcategoria:", err);
    res.status(500).json({ error: "Erro ao atualizar subcategoria." });
  }
});

// 🔹 Deletar Subcategoria
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Verifica se é subcategoria padrão
    const [check] = await pool.query(`SELECT padrao FROM straton_subcategorias WHERE id = ?`, [id]);

    if (check.length === 0) {
      return res.status(404).json({ error: "Subcategoria não encontrada." });
    }

    if (check[0].padrao) {
      return res.status(403).json({ error: "Subcategoria padrão não pode ser excluída." });
    }

    const [result] = await pool.query(`DELETE FROM straton_subcategorias WHERE id = ?`, [id]);

    res.json({ message: "Subcategoria deletada com sucesso." });
  } catch (err) {
    console.error("Erro ao deletar subcategoria:", err);
    res.status(500).json({ error: "Erro ao deletar subcategoria." });
  }
});

// 🔹 Atualizar ordem das subcategorias
router.put("/ordenar", verifyToken, async (req, res) => {
  const { novaOrdem } = req.body; // Ex: [{ id: 3, ordem: 1 }, { id: 5, ordem: 2 }]

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const item of novaOrdem) {
      await connection.query(`UPDATE straton_subcategorias SET ordem = ? WHERE id = ?`, [item.ordem, item.id]);
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