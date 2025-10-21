const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// 🔹 Criar produto ou serviço
router.post("/", verifyToken, async (req, res) => {
  const { nome, tipo, empresa_id } = req.body;

  if (!nome || !tipo || !empresa_id) {
    return res.status(400).json({ error: "Campos obrigatórios: nome, tipo, empresa_id." });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO produtos (nome, tipo, empresa_id) VALUES (?, ?, ?)",
      [nome, tipo, empresa_id]
    );
    res.status(201).json({ id: result.insertId, message: "Produto/Serviço criado com sucesso." });
  } catch (error) {
    console.error("Erro ao criar produto/serviço:", error);
    res.status(500).json({ error: "Erro ao criar produto/serviço." });
  }
});

// 🔹 Listar produtos/serviços — com filtros opcionais por empresa e status
router.get("/", verifyToken, async (req, res) => {
  const { empresa_id, status } = req.query;

  try {
    let query = `SELECT id, nome, tipo, status FROM produtos`;
    const params = [];
    const conditions = [];

    // Se empresa_id foi fornecido, filtra por empresa
    if (empresa_id) {
      conditions.push(`empresa_id = ?`);
      params.push(empresa_id);
    }

    // Se status foi fornecido, filtra por status
    if (status && ['ativo', 'inativo'].includes(status)) {
      conditions.push(`status = ?`);
      params.push(status);
    }

    // Adiciona WHERE se houver condições
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY criado_em DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Erro ao listar produtos/serviços:", error);
    res.status(500).json({ error: "Erro ao listar produtos/serviços." });
  }
});

// 🔹 Listar todos por empresa_id (mantém compatibilidade) — com filtro opcional por status
router.get("/empresa/:empresa_id", verifyToken, async (req, res) => {
  const { empresa_id } = req.params;
  const { status } = req.query;

  try {
    let query = `SELECT id, nome, tipo, status FROM produtos WHERE empresa_id = ?`;
    const params = [empresa_id];

    // Se status foi fornecido, adiciona filtro por status
    if (status && ['ativo', 'inativo'].includes(status)) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY criado_em DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Erro ao listar produtos/serviços:", error);
    res.status(500).json({ error: "Erro ao listar produtos/serviços." });
  }
});

// 🔹 Listar apenas produtos por empresa_id — com filtro opcional por status
router.get("/empresa/:empresa_id/produtos", verifyToken, async (req, res) => {
  const { empresa_id } = req.params;
  const { status } = req.query;

  try {
    let query = `SELECT id, nome, tipo, status FROM produtos WHERE empresa_id = ? AND tipo = 'produto'`;
    const params = [empresa_id];

    // Se status foi fornecido, adiciona filtro por status
    if (status && ['ativo', 'inativo'].includes(status)) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY criado_em DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    res.status(500).json({ error: "Erro ao listar produtos." });
  }
});

// 🔹 Listar apenas serviços por empresa_id — com filtro opcional por status
router.get("/empresa/:empresa_id/servicos", verifyToken, async (req, res) => {
  const { empresa_id } = req.params;
  const { status } = req.query;

  try {
    let query = `SELECT id, nome, tipo, status FROM produtos WHERE empresa_id = ? AND tipo = 'servico'`;
    const params = [empresa_id];

    // Se status foi fornecido, adiciona filtro por status
    if (status && ['ativo', 'inativo'].includes(status)) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY criado_em DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Erro ao listar serviços:", error);
    res.status(500).json({ error: "Erro ao listar serviços." });
  }
});

// 🔹 Buscar por ID
router.get("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query("SELECT * FROM produtos WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Produto/Serviço não encontrado." });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Erro ao buscar produto/serviço:", error);
    res.status(500).json({ error: "Erro ao buscar produto/serviço." });
  }
});

// 🔹 Atualizar por ID
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { nome, tipo } = req.body;

  if (!nome || !tipo) {
    return res.status(400).json({ error: "Campos obrigatórios: nome, tipo." });
  }

  try {
    const [result] = await pool.query(
      "UPDATE produtos SET nome = ?, tipo = ? WHERE id = ?",
      [nome, tipo, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Produto/Serviço não encontrado." });
    }
    res.json({ message: "Produto/Serviço atualizado com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar produto/serviço:", error);
    res.status(500).json({ error: "Erro ao atualizar produto/serviço." });
  }
});

// 🔹 Alterar status (ativo/inativo)
router.patch("/:id/status", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['ativo', 'inativo'].includes(status)) {
    return res.status(400).json({ error: "Status deve ser 'ativo' ou 'inativo'." });
  }

  try {
    const [result] = await pool.query(
      "UPDATE produtos SET status = ? WHERE id = ?",
      [status, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Produto/Serviço não encontrado." });
    }
    
    res.json({ 
      message: `Status alterado para '${status}' com sucesso.`,
      status: status 
    });
  } catch (error) {
    console.error("Erro ao alterar status do produto/serviço:", error);
    res.status(500).json({ error: "Erro ao alterar status do produto/serviço." });
  }
});

// 🔹 Deletar por ID
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query("DELETE FROM produtos WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Produto/Serviço não encontrado." });
    }
    res.json({ message: "Produto/Serviço deletado com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar produto/serviço:", error);
    res.status(500).json({ error: "Erro ao deletar produto/serviço." });
  }
});

module.exports = router;
