const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// 🔹 Criar conta
router.post("/", verifyToken, async (req, res) => {
  const {
    empresa_id,
    cliente_id,
    banco,
    descricao_banco,
    tipo_conta,
    inicio_lancamento,
    numero_conta,
    agencia,
    saldo
  } = req.body;

  const saldoFinal =
    saldo === '' || saldo === null || saldo === undefined
      ? null
      : parseFloat(saldo);

  const saldoSanitized = isNaN(saldoFinal) ? null : saldoFinal;

  try {
    const [result] = await pool.query(
      `
      INSERT INTO caixinha 
      (empresa_id, cliente_id, banco, descricao_banco, tipo_conta, inicio_lancamento, numero_conta, agencia, saldo, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
      [
        empresa_id,
        cliente_id || null,
        banco,
        descricao_banco,
        tipo_conta,
        inicio_lancamento || null,
        numero_conta || null,
        agencia || null,
        saldoSanitized
      ]
    );

    res.status(201).json({ id: result.insertId, message: "Conta criada com sucesso." });
  } catch (error) {
    console.error("Erro ao criar conta:", error);
    res.status(500).json({ error: "Erro ao criar conta." });
  }
});

// 🔹 Atualizar uma conta
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const {
    empresa_id,
    cliente_id,
    banco,
    descricao_banco,
    tipo_conta,
    inicio_lancamento,
    numero_conta,
    agencia,
    saldo
  } = req.body;

  const saldoFinal =
    saldo === '' || saldo === null || saldo === undefined
      ? null
      : parseFloat(saldo);

  const saldoSanitized = isNaN(saldoFinal) ? null : saldoFinal;

  try {
    const [result] = await pool.query(
      `
      UPDATE caixinha SET 
        empresa_id = ?, 
        cliente_id = ?, 
        banco = ?, 
        descricao_banco = ?, 
        tipo_conta = ?, 
        inicio_lancamento = ?, 
        numero_conta = ?, 
        agencia = ?, 
        saldo = ?
      WHERE id = ?
    `,
      [
        empresa_id,
        cliente_id || null,
        banco,
        descricao_banco,
        tipo_conta,
        inicio_lancamento || null,
        numero_conta || null,
        agencia || null,
        saldoSanitized,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Conta não encontrada." });
    }

    res.json({ message: "Conta atualizada com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar conta:", error);
    res.status(500).json({ error: "Erro ao atualizar conta." });
  }
});

// 🔹 Listar contas — com filtro opcional por empresa
router.get("/", verifyToken, async (req, res) => {
  const { empresa_id } = req.query;

  try {
    let query = `SELECT * FROM caixinha`;
    const params = [];

    // Se empresa_id foi fornecido, filtra por empresa
    if (empresa_id) {
      query += ` WHERE empresa_id = ?`;
      params.push(empresa_id);
    }

    query += ` ORDER BY criado_em DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar contas:", error);
    res.status(500).json({ error: "Erro ao buscar contas." });
  }
});

// 🔹 Buscar contas por empresa_id - DEVE VIR ANTES DA ROTA /:id
router.get("/empresa/:empresaId", verifyToken, async (req, res) => {
  const { empresaId } = req.params;
  
  console.log("🔍 Rota /empresa/:empresaId chamada para empresaId:", empresaId);

  try {
    const [contas] = await pool.query(
      "SELECT * FROM caixinha WHERE empresa_id = ? ORDER BY criado_em DESC",
      [empresaId]
    );

    console.log(`📊 Total de contas encontradas para empresa ${empresaId}:`, contas.length);

    // Retornar array vazio em vez de 404 quando não há contas
    res.json(contas);
  } catch (error) {
    console.error("Erro ao buscar contas por empresa_id:", error);
    res.status(500).json({ error: "Erro ao buscar contas da empresa." });
  }
});

// 🔹 Buscar uma conta por ID
router.get("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [conta] = await pool.query("SELECT * FROM caixinha WHERE id = ?", [id]);

    if (conta.length === 0) {
      return res.status(404).json({ error: "Conta não encontrada." });
    }

    res.json(conta[0]);
  } catch (error) {
    console.error("Erro ao buscar conta:", error);
    res.status(500).json({ error: "Erro ao buscar conta." });
  }
});


// 🔹 Deletar uma conta
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query("DELETE FROM caixinha WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Conta não encontrada." });
    }

    res.json({ message: "Conta deletada com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar conta:", error);
    res.status(500).json({ error: "Erro ao deletar conta." });
  }
});

module.exports = router;