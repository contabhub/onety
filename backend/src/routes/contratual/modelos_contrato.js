const express = require("express");
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

const router = express.Router();

router.post("/", verifyToken, async (req, res) => {
  const { nome, conteudo, global = 0, empresa_id, straton = 0, funcionario = 0 } = req.body;
  const criadoPor = req.user.nome || req.user.email || 'Sistema';
  const empresaId = global ? null : empresa_id;

  if (!nome || !conteudo) {
    return res.status(400).json({ error: "Campos obrigatórios: nome, conteudo" });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO modelos_contrato (nome, conteudo, criado_por, global, empresa_id, straton, funcionario) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [nome, conteudo, criadoPor, global, empresaId, straton, funcionario]
    );

    res.status(201).json({ message: "Modelo de contrato criado com sucesso!", id: result.insertId });
  } catch (error) {
    console.error("Erro ao criar modelo:", error);
    res.status(500).json({ error: "Erro ao criar modelo de contrato." });
  }
});


// Listar todos os modelos de contrato (versão light - apenas id e nome)
router.get("/light", verifyToken, async (req, res) => {
  const empresaId = req.headers['x-empresa-id'];
  
  try {
    let query;
    let params;
    
    if (empresaId && empresaId !== 'undefined') {
      // Buscar modelos da empresa + globais
      query = `SELECT id, nome as name, global as is_global
               FROM modelos_contrato 
               WHERE empresa_id = ? OR global = 1
               ORDER BY global DESC, criado_em DESC`;
      params = [empresaId];
    } else {
      // Buscar apenas modelos globais
      query = `SELECT id, nome as name, global as is_global
               FROM modelos_contrato 
               WHERE global = 1
               ORDER BY criado_em DESC`;
      params = [];
    }
    
    const [modelos] = await pool.query(query, params);
    res.json(modelos);
  } catch (error) {
    console.error("Erro ao buscar modelos:", error);
    res.status(500).json({ error: "Erro ao buscar modelos de contrato." });
  }
});

// Listar todos os modelos de contrato
router.get("/", verifyToken, async (req, res) => {
  try {
    const [modelos] = await pool.query(
      `SELECT id, nome, conteudo, criado_por, criado_em, atualizado_em, global, empresa_id, straton, funcionario
       FROM modelos_contrato 
       ORDER BY criado_em DESC`
    );
    res.json(modelos);
  } catch (error) {
    console.error("Erro ao buscar modelos:", error);
    res.status(500).json({ error: "Erro ao buscar modelos de contrato." });
  }
});


// Listar modelos por empresa (incluindo globais)
router.get("/empresa/:empresaId", verifyToken, async (req, res) => {
  const { empresaId } = req.params;
  
  try {
    const [modelos] = await pool.query(
      `SELECT id, nome, conteudo, criado_por, criado_em, atualizado_em, global, empresa_id, straton, funcionario
       FROM modelos_contrato 
       WHERE empresa_id = ? OR global = 1
       ORDER BY global DESC, criado_em DESC`,
      [empresaId]
    );
    res.json(modelos);
  } catch (error) {
    console.error("Erro ao buscar modelos da empresa:", error);
    res.status(500).json({ error: "Erro ao buscar modelos da empresa." });
  }
});





// Obter um modelo por ID
router.get("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [modelo] = await pool.query(
      "SELECT * FROM modelos_contrato WHERE id = ?", 
      [id]
    );

    if (modelo.length === 0) {
      return res.status(404).json({ error: "Modelo não encontrado." });
    }

    res.json(modelo[0]);
  } catch (error) {
    console.error("Erro ao buscar modelo:", error);
    res.status(500).json({ error: "Erro ao buscar modelo de contrato." });
  }
});

// Atualizar um modelo
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { nome, conteudo, global, empresa_id, straton, funcionario } = req.body;

  if (!nome || !conteudo) {
    return res.status(400).json({ error: "Campos obrigatórios: nome, conteudo" });
  }

  try {
    const [result] = await pool.query(
      "UPDATE modelos_contrato SET nome = ?, conteudo = ?, global = ?, empresa_id = ?, straton = ?, funcionario = ? WHERE id = ?",
      [nome, conteudo, global, empresa_id, straton, funcionario, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Modelo não encontrado." });
    }

    res.json({ message: "Modelo atualizado com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar modelo:", error);
    res.status(500).json({ error: "Erro ao atualizar modelo de contrato." });
  }
});

// Deletar um modelo
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query("DELETE FROM modelos_contrato WHERE id = ?", [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Modelo não encontrado." });
    }
    
    res.json({ message: "Modelo deletado com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar modelo:", error);
    res.status(500).json({ error: "Erro ao deletar modelo de contrato." });
  }
});

// Ativar/desativar modelo (straton)
router.patch('/:id/straton', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { straton } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE modelos_contrato SET straton = ? WHERE id = ?',
      [straton, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Modelo não encontrado." });
    }

    return res.status(200).json({ message: "Status Straton atualizado com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar straton:", error);
    return res.status(500).json({ error: "Erro ao atualizar status Straton." });
  }
});

// Ativar/desativar modelo (funcionario)
router.patch('/:id/funcionario', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { funcionario } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE modelos_contrato SET funcionario = ? WHERE id = ?',
      [funcionario, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Modelo não encontrado." });
    }

    return res.status(200).json({ message: "Status Funcionário atualizado com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar funcionario:", error);
    return res.status(500).json({ error: "Erro ao atualizar status Funcionário." });
  }
});


module.exports = router;
