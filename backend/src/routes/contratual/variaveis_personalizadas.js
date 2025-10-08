const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// 🔹 Criar nova variável personalizada
router.post("/", verifyToken, async (req, res) => {
  const { variavel, titulo, empresa_id, global = 0 } = req.body;

  if (!variavel || !titulo || !empresa_id) {
    return res.status(400).json({ error: "Campos obrigatórios: variavel, titulo, empresa_id" });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO variaveis_personalizadas (variavel, titulo, empresa_id, global) VALUES (?, ?, ?, ?)`,
      [variavel, titulo, empresa_id, global]
    );
    res.status(201).json({ message: "Variável personalizada criada com sucesso!", id: result.insertId });
  } catch (error) {
    console.error("Erro ao criar variável:", error);
    res.status(500).json({ error: "Erro ao criar variável personalizada." });
  }
});

// 🔹 Listar todas as variáveis personalizadas
router.get("/", verifyToken, async (req, res) => {
  try {
    const [variables] = await db.query(
      `SELECT id, variavel, titulo, empresa_id, global, criado_em
       FROM variaveis_personalizadas 
       ORDER BY id DESC`
    );
    res.json(variables);
  } catch (error) {
    console.error("Erro ao listar variáveis:", error);
    res.status(500).json({ error: "Erro ao buscar variáveis personalizadas." });
  }
});

// 🔹 Listar variáveis por empresa (incluindo globais)
router.get("/empresa/:empresaId", verifyToken, async (req, res) => {
  const { empresaId } = req.params;
  
  try {
    const [variables] = await db.query(
      `SELECT id, variavel, titulo, empresa_id, global, criado_em
       FROM variaveis_personalizadas 
       WHERE empresa_id = ? OR global = 1
       ORDER BY global DESC, id DESC`,
      [empresaId]
    );
    res.json(variables);
  } catch (error) {
    console.error("Erro ao listar variáveis da empresa:", error);
    res.status(500).json({ error: "Erro ao buscar variáveis da empresa." });
  }
});

// 🔹 Buscar variável por ID
router.get("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const [rows] = await db.query(
      `SELECT id, variavel, titulo, empresa_id, global, criado_em
       FROM variaveis_personalizadas 
       WHERE id = ?`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Variável não encontrada." });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error("Erro ao buscar variável:", error);
    res.status(500).json({ error: "Erro ao buscar variável personalizada." });
  }
});



// 🔹 Atualizar variável personalizada
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { variavel, titulo, global } = req.body;

  if (!variavel || !titulo || global === undefined) {
    return res.status(400).json({ error: "Campos obrigatórios: variavel, titulo, global" });
  }

  try {
    const [rows] = await db.query(
      `SELECT * FROM variaveis_personalizadas WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Variável não encontrada." });
    }
    await db.query(
      `UPDATE variaveis_personalizadas SET variavel = ?, titulo = ?, global = ? WHERE id = ?`,
      [variavel, titulo, global, id]
    );
    res.json({ message: "Variável personalizada atualizada com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar variável:", error);
    res.status(500).json({ error: "Erro ao atualizar variável personalizada." });
  }
});


// 🔹 Remover variável personalizada
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    // Verifica se existe
    const [rows] = await db.query(
      `SELECT * FROM variaveis_personalizadas WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Variável não encontrada." });
    }
    // Remove
    await db.query(
      `DELETE FROM variaveis_personalizadas WHERE id = ?`,
      [id]
    );
    res.json({ message: "Variável personalizada removida com sucesso!" });
  } catch (error) {
    console.error("Erro ao remover variável:", error);
    res.status(500).json({ error: "Erro ao remover variável personalizada." });
  }
});
// ... existing code ...

module.exports = router;
