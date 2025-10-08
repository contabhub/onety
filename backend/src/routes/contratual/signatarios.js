const express = require("express");
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");
const crypto = require('crypto');

const router = express.Router();

// Rota para criar signatários
router.post("/", verifyToken, async (req, res) => {
  let signatarios = req.body;

  // Se `req.body` for um único objeto, transforma em array
  if (!Array.isArray(signatarios)) {
    signatarios = [signatarios]; // Converte para array
  }

  try {
    const createdSignatarios = [];
    
    for (let signatario of signatarios) {
      const { 
        contrato_id, 
        documento_id, 
        nome, 
        email, 
        telefone, 
        cpf, 
        data_nascimento, 
        empresa_id, 
        funcao_assinatura = 'Assinar como parte'
      } = signatario;

      if (!nome || !email || !empresa_id) {
        return res.status(400).json({ error: "Campos obrigatórios: nome, email, empresa_id" });
      }

      // Gerar token de acesso único
      const token_acesso = crypto.randomBytes(32).toString('hex');
      
      // Gerar public_id único
      const public_id = crypto.randomUUID();

      // Inserir o signatário no banco de dados
      const [result] = await pool.query(
        `INSERT INTO signatarios 
        (contrato_id, documento_id, nome, email, telefone, cpf, data_nascimento, 
         empresa_id, token_acesso, public_id, funcao_assinatura) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [contrato_id, documento_id, nome, email, telefone, cpf, data_nascimento, 
         empresa_id, token_acesso, public_id, funcao_assinatura]
      );
      
      createdSignatarios.push({
        id: result.insertId,
        public_id,
        token_acesso,
        nome,
        email
      });
    }

    res.status(201).json({ 
      message: "Signatário(s) criado(s) com sucesso!", 
      signatarios: createdSignatarios 
    });
  } catch (error) {
    console.error("Erro ao criar signatários:", error);
    res.status(500).json({ error: "Erro ao criar signatários." });
  }
});

// Rota para acessar o contrato pelo token do signatário
router.get("/acesso/:token_acesso", async (req, res) => {
  const { token_acesso } = req.params;

  try {
    // Buscar signatário pelo token de acesso
    const [signatario] = await pool.query(
      `SELECT s.id, s.contrato_id, s.documento_id, s.nome, s.email, s.telefone, 
              s.cpf, s.data_nascimento, s.funcao_assinatura, s.assinado_em, s.criado_em,
              c.nome as contrato_nome, c.conteudo as contrato_conteudo, c.status as contrato_status,
              c.data_expiracao
       FROM signatarios s 
       LEFT JOIN contratos c ON s.contrato_id = c.id 
       WHERE s.token_acesso = ?`,
      [token_acesso]
    );

    if (signatario.length === 0) {
      return res.status(404).json({ error: "Signatário não encontrado ou link inválido." });
    }

    // Verificar se o contrato expirou (se houver data de expiração)
    if (signatario[0].data_expiracao && new Date(signatario[0].data_expiracao) < new Date()) {
      return res.status(400).json({ error: "O link deste contrato expirou." });
    }

    res.json(signatario[0]);
  } catch (error) {
    console.error("Erro ao acessar contrato:", error);
    res.status(500).json({ error: "Erro ao acessar contrato." });
  }
});

// Listar todos os signatários
router.get("/", verifyToken, async (req, res) => {
  try {
    const [signatarios] = await pool.query(
      `SELECT id, contrato_id, documento_id, nome, email, telefone, cpf, 
              data_nascimento, empresa_id, public_id, funcao_assinatura, 
              assinado_em, criado_em
       FROM signatarios 
       ORDER BY criado_em DESC`
    );
    res.json(signatarios);
  } catch (error) {
    console.error("Erro ao buscar signatários:", error);
    res.status(500).json({ error: "Erro ao buscar signatários." });
  }
});

// Rota para listar signatários de uma empresa
router.get("/empresa/:empresa_id", verifyToken, async (req, res) => {
  const { empresa_id } = req.params;

  try {
    const [signatarios] = await pool.query(
      `SELECT id, contrato_id, documento_id, nome, email, telefone, cpf, 
              data_nascimento, public_id, funcao_assinatura, assinado_em, criado_em
       FROM signatarios
       WHERE empresa_id = ?
       ORDER BY criado_em DESC`,
      [empresa_id]
    );

    res.json(signatarios);
  } catch (error) {
    console.error("Erro ao buscar signatários da empresa:", error);
    res.status(500).json({ error: "Erro ao buscar signatários da empresa." });
  }
});

// Buscar signatário por ID
router.get("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [signatario] = await pool.query(
      `SELECT id, contrato_id, documento_id, nome, email, telefone, cpf, 
              data_nascimento, empresa_id, public_id, funcao_assinatura, 
              assinado_em, criado_em
       FROM signatarios 
       WHERE id = ?`,
      [id]
    );

    if (signatario.length === 0) {
      return res.status(404).json({ error: "Signatário não encontrado." });
    }

    res.json(signatario[0]);
  } catch (error) {
    console.error("Erro ao buscar signatário:", error);
    res.status(500).json({ error: "Erro ao buscar signatário." });
  }
});

// Atualizar signatário
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { 
    nome, 
    email, 
    telefone, 
    cpf, 
    data_nascimento, 
    funcao_assinatura 
  } = req.body;

  if (!nome || !email) {
    return res.status(400).json({ error: "Campos obrigatórios: nome, email" });
  }

  try {
    const [result] = await pool.query(
      `UPDATE signatarios SET 
       nome = ?, email = ?, telefone = ?, cpf = ?, data_nascimento = ?, 
       funcao_assinatura = ? 
       WHERE id = ?`,
      [nome, email, telefone, cpf, data_nascimento, funcao_assinatura, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Signatário não encontrado." });
    }

    res.json({ message: "Signatário atualizado com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar signatário:", error);
    res.status(500).json({ error: "Erro ao atualizar signatário." });
  }
});

// Marcar como assinado
router.patch("/:id/assinar", async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE signatarios SET assinado_em = NOW() WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Signatário não encontrado." });
    }

    res.json({ message: "Signatário marcado como assinado com sucesso!" });
  } catch (error) {
    console.error("Erro ao assinar:", error);
    res.status(500).json({ error: "Erro ao assinar documento." });
  }
});

// Deletar signatário
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      "DELETE FROM signatarios WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Signatário não encontrado." });
    }

    res.json({ message: "Signatário deletado com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar signatário:", error);
    res.status(500).json({ error: "Erro ao deletar signatário." });
  }
});


module.exports = router;
