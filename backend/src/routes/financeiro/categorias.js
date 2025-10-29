const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// 🔹 Criar categoria
router.post("/", verifyToken, async (req, res) => {
  const { nome, tipo_id, ordem, padrao = 0 } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO straton_categorias (nome, tipo_id, ordem, padrao) VALUES (?, ?, ?, ?)`,
      [nome, tipo_id, ordem || 0, padrao]
    );
    res.status(201).json({ id: result.insertId, message: "Categoria criada com sucesso." });
  } catch (err) {
    console.error("Erro ao criar categoria:", err);
    res.status(500).json({ error: "Erro ao criar categoria." });
  }
});


// 🔹 Listar todas as categorias
router.get("/", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM straton_categorias ORDER BY criado_em DESC`);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar categorias:", err);
    res.status(500).json({ error: "Erro ao buscar categorias." });
  }
});

// 🔹 Listar categorias por tipo
router.get("/tipo/:tipoId", verifyToken, async (req, res) => {
  const { tipoId } = req.params;
  console.log(`🔍 [Backend] Buscando categorias com tipo_id = ${tipoId}`);
  try {
    const [rows] = await pool.query(`SELECT * FROM straton_categorias WHERE tipo_id = ?`, [tipoId]);
    console.log(`📊 [Backend] Total de categorias encontradas (tipo ${tipoId}): ${rows.length}`);
    if (rows.length > 0) {
      console.log(`📋 [Backend] Primeiras categorias:`, rows.slice(0, 5).map(c => ({ id: c.id, nome: c.nome, tipo_id: c.tipo_id })));
    }
    res.json(rows);
  } catch (err) {
    console.error("❌ [Backend] Erro ao buscar categorias por tipo:", err);
    res.status(500).json({ error: "Erro ao buscar categorias." });
  }
});

// 🔹 Atualizar categoria
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { nome, tipo_id, ordem } = req.body;
  try {
    const [result] = await pool.query(
      `UPDATE straton_categorias SET nome = ?, tipo_id = ?, ordem = ? WHERE id = ?`,
      [nome, tipo_id, ordem || 0, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Categoria não encontrada." });
    }
    res.json({ message: "Categoria atualizada com sucesso." });
  } catch (err) {
    console.error("Erro ao atualizar categoria:", err);
    res.status(500).json({ error: "Erro ao atualizar categoria." });
  }
});

// 🔹 Deletar categoria
// 🔹 Deletar categoria
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Verifica se a categoria é padrão
    const [check] = await pool.query(`SELECT padrao FROM straton_categorias WHERE id = ?`, [id]);

    if (check.length === 0) {
      return res.status(404).json({ error: "Categoria não encontrada." });
    }

    if (check[0].padrao) {
      return res.status(403).json({ error: "Categoria padrão não pode ser excluída." });
    }

    const [result] = await pool.query(`DELETE FROM straton_categorias WHERE id = ?`, [id]);

    res.json({ message: "Categoria deletada com sucesso." });
  } catch (err) {
    console.error("Erro ao deletar categoria:", err);
    res.status(500).json({ error: "Erro ao deletar categoria." });
  }
});


// 🔹 Atualizar ordenação das categorias (drag and drop)
router.put("/reordenar", verifyToken, async (req, res) => {
  const { ordenacao } = req.body; // Array de objetos: [{ id: 1, ordem: 0 }, { id: 2, ordem: 1 }, ...]

  if (!Array.isArray(ordenacao)) {
    return res.status(400).json({ error: "Formato de ordenação inválido." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const item of ordenacao) {
      await connection.query(
        `UPDATE straton_categorias SET ordem = ? WHERE id = ?`,
        [item.ordem, item.id]
      );
    }

    await connection.commit();
    res.json({ message: "Ordenação atualizada com sucesso." });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao atualizar ordenação:", err);
    res.status(500).json({ error: "Erro ao atualizar ordenação." });
  } finally {
    connection.release();
  }
});

router.get("/empresa/:companyId", verifyToken, async (req, res) => {

  const { companyId } = req.params;

  try {
    // Busca todos os tipos da empresa
    const [tipos] = await pool.query(
      `SELECT * FROM tipos WHERE empresa_id = ?`,
      [companyId]
    );

    const resultado = [];

    for (const tipo of tipos) {
      const [categorias] = await pool.query(
        `SELECT * FROM straton_categorias WHERE tipo_id = ? ORDER BY ordem ASC`,
        [tipo.id]
      );

      for (const categoria of categorias) {
        const [subcategorias] = await pool.query(
          `SELECT * FROM straton_subcategorias WHERE categoria_id = ? ORDER BY ordem ASC`,
          [categoria.id]
        );

        categoria.subcategorias = subcategorias;
      }

      resultado.push({
        tipo: tipo.nome,
        tipo_id: tipo.id,
        categorias
      });
    }

    res.json(resultado);
  } catch (err) {
    console.error("Erro ao buscar categorias da empresa:", err);
    res.status(500).json({ error: "Erro ao buscar categorias." });
  }
});
module.exports = router;
