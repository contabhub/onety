const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// 🔹 Criar conta
router.post("/", verifyToken, async (req, res) => {
  const {
    company_id,
    cliente_id,
    banco,
    descricao_banco,
    tipo_conta,
    inicio_lancamento,
    tipo,
    numero_conta,
    agencia,
    saldo,
    pluggy_account_id // ✅ Novo campo
  } = req.body;

  const saldoFinal =
    saldo === '' || saldo === null || saldo === undefined
      ? null
      : parseFloat(saldo);

  const saldoSanitized = isNaN(saldoFinal) ? null : saldoFinal;

  try {
    const [result] = await pool.query(
      `
      INSERT INTO contas 
      (company_id, cliente_id, banco, descricao_banco, tipo_conta, inicio_lancamento, tipo, numero_conta, agencia, saldo, pluggy_account_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
      [
        company_id,
        cliente_id || null,
        banco,
        descricao_banco,
        tipo_conta,
        inicio_lancamento || null,
        tipo,
        numero_conta || null,
        agencia || null,
        saldoSanitized,
        pluggy_account_id || null // ✅ Inserir se vier, senão NULL
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
    company_id,
    cliente_id,
    banco,
    descricao_banco,
    tipo_conta,
    inicio_lancamento,
    tipo,
    numero_conta,
    agencia,
    saldo,
    pluggy_account_id // ✅ Novo campo
  } = req.body;

  const saldoFinal =
    saldo === '' || saldo === null || saldo === undefined
      ? null
      : parseFloat(saldo);

  const saldoSanitized = isNaN(saldoFinal) ? null : saldoFinal;

  try {
    const [result] = await pool.query(
      `
      UPDATE contas SET 
        company_id = ?, 
        cliente_id = ?, 
        banco = ?, 
        descricao_banco = ?, 
        tipo_conta = ?, 
        inicio_lancamento = ?, 
        tipo = ?, 
        numero_conta = ?, 
        agencia = ?, 
        saldo = ?,
        pluggy_account_id = ?
      WHERE id = ?
    `,
      [
        company_id,
        cliente_id || null,
        banco,
        descricao_banco,
        tipo_conta,
        inicio_lancamento || null,
        tipo,
        numero_conta || null,
        agencia || null,
        saldoSanitized,
        pluggy_account_id || null, // ✅ Atualiza se vier, senão NULL
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
  const { company_id } = req.query;

  try {
    let query = `SELECT * FROM contas`;
    const params = [];

    // Se company_id foi fornecido, filtra por empresa
    if (company_id) {
      query += ` WHERE company_id = ?`;
      params.push(company_id);
    }

    query += ` ORDER BY created_at DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar contas:", error);
    res.status(500).json({ error: "Erro ao buscar contas." });
  }
});

// 🔹 Buscar uma conta por ID
router.get("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [conta] = await pool.query("SELECT * FROM contas WHERE id = ?", [id]);

    if (conta.length === 0) {
      return res.status(404).json({ error: "Conta não encontrada." });
    }

    res.json(conta[0]);
  } catch (error) {
    console.error("Erro ao buscar conta:", error);
    res.status(500).json({ error: "Erro ao buscar conta." });
  }
});

// 🔹 Buscar contas por company_id
router.get("/empresa/:companyId", verifyToken, async (req, res) => {
  const { companyId } = req.params;

  try {
    const [contas] = await pool.query(
      "SELECT * FROM contas WHERE company_id = ? ORDER BY created_at DESC",
      [companyId]
    );

    if (contas.length === 0) {
      return res.status(404).json({ error: "Nenhuma conta encontrada para esta empresa." });
    }

    res.json(contas);
  } catch (error) {
    console.error("Erro ao buscar contas por company_id:", error);
    res.status(500).json({ error: "Erro ao buscar contas da empresa." });
  }
});

// 🔹 Atualizar uma conta
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const {
    company_id,
    cliente_id,
    banco,
    descricao_banco,
    tipo_conta,
    inicio_lancamento,
    tipo,
    numero_conta,
    agencia,
    saldo
  } = req.body;

  // 🧹 Sanitizar saldo também no update
  const saldoFinal =
    saldo === '' || saldo === null || saldo === undefined
      ? null
      : parseFloat(saldo);

  const saldoSanitized = isNaN(saldoFinal) ? null : saldoFinal;

  try {
    const [result] = await pool.query(
      `
      UPDATE contas SET 
        company_id = ?, 
        cliente_id = ?, 
        banco = ?, 
        descricao_banco = ?, 
        tipo_conta = ?, 
        inicio_lancamento = ?, 
        tipo = ?, 
        numero_conta = ?, 
        agencia = ?, 
        saldo = ?
      WHERE id = ?
    `,
      [
        company_id,
        cliente_id || null,
        banco,
        descricao_banco,
        tipo_conta,
        inicio_lancamento || null,
        tipo,
        numero_conta || null,
        agencia || null,
        saldoSanitized, // 👈 sempre número ou NULL
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

// 🔹 Deletar uma conta
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query("DELETE FROM contas WHERE id = ?", [id]);

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