const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const verifyToken = require("../middlewares/auth");
const { makePluggyRequest } = require("../middlewares/pluggyToken");



router.post("/sync", verifyToken, async (req, res) => {
  const { accountId, company_id, cliente_id } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: "accountId é obrigatório." });
  }

  try {
    console.log("[Pluggy] Usando UUID informado:", accountId);

    // Usar a nova função com retry automático
    const response = await makePluggyRequest(
      `https://api.pluggy.ai/transactions?accountId=${accountId}`
    );

    const transactions = response.data.results || [];
    let inserted = 0;

    for (const tx of transactions) {
      const parsedDate = tx.date ? tx.date.substring(0, 10) : null;

      // 🟢 Por padrão: situacao = 'recebido'
      const situacao = 'recebido';
      const anexo_base64 = null; // Aqui fica null por padrão, se não vier nada do Pluggy

      await pool.query(
        `
        INSERT INTO transacoes_api
          (pluggy_transaction_id, account_id, description, amount, currency_code, date, company_id, cliente_id, situacao, anexo_base64, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          description = VALUES(description),
          amount = VALUES(amount),
          date = VALUES(date),
          company_id = VALUES(company_id),
          cliente_id = VALUES(cliente_id),
          situacao = CASE 
            WHEN situacao = 'ignorada' THEN 'ignorada'  -- ✅ Preserva transações ignoradas
            ELSE VALUES(situacao)                       -- ✅ Atualiza outras situações
          END,
          anexo_base64 = VALUES(anexo_base64),
          updated_at = NOW()
      `,
        [
          tx.id,
          tx.accountId,
          tx.description || null,
          tx.amount || null,
          tx.currencyCode || null,
          parsedDate,
          company_id || null,
          cliente_id || null,
          situacao,
          anexo_base64
        ]
      );

      inserted++;
    }

    res.json({ message: "Sincronização concluída.", total: inserted });

  } catch (error) {
    console.error(error?.response?.data || error);
    res.status(500).json({ error: "Erro ao sincronizar transações Pluggy." });
  }
});

// 🔹 GET /:accountId ➜ Todas as transações para um UUID Pluggy
router.get("/:accountId", verifyToken, async (req, res) => {
  const { accountId } = req.params;

  if (!accountId) {
    return res.status(400).json({ error: "accountId é obrigatório." });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        id,
        pluggy_transaction_id,
        account_id,
        description,
        amount,
        currency_code,
        date,
        situacao,
        anexo_base64,
        company_id,
        cliente_id,
        created_at,
        updated_at
      FROM transacoes_api
      WHERE account_id = ?
      ORDER BY date DESC
    `,
      [accountId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Nenhuma transação encontrada para esta conta." });
    }

    return res.json({ total: rows.length, transactions: rows });

  } catch (error) {
    console.error("❌ Erro ao listar transações:", error);
    res.status(500).json({ error: "Erro ao listar transações." });
  }
});

// 🔹 GET /:accountId/entradas ➜ Entradas (sempre situacao = 'recebido')

router.get("/:accountId/entradas", verifyToken, async (req, res) => {
  const { accountId } = req.params;
  const { empresaId } = req.query;

  try {
    let query = `
      SELECT 
        id,
        pluggy_transaction_id,
        account_id,
        description,
        amount,
        currency_code,
        date,
        situacao,
        anexo_base64,
        company_id,
        cliente_id,
        created_at,
        updated_at
      FROM transacoes_api
      WHERE account_id = ? AND amount > 0 AND situacao <> 'ignorada'
    `;
    const params = [accountId];

    if (empresaId) {
      query += " AND company_id = ?";
      params.push(empresaId);
    }

    query += " ORDER BY date DESC";

    const [rows] = await pool.query(query, params);

    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar transações de entrada:", error);
    res.status(500).json({ error: "Erro ao buscar transações de entrada." });
  }
});

// 🔹 GET /:accountId/saidas ➜ Saídas (sempre situacao = 'recebido')
router.get("/:accountId/saidas", verifyToken, async (req, res) => {
  const { accountId } = req.params;
  const { empresaId } = req.query;

  try {
    let query = `
      SELECT 
        id,
        pluggy_transaction_id,
        account_id,
        description,
        amount,
        currency_code,
        date,
        situacao,
        anexo_base64,
        company_id,
        cliente_id,
        created_at,
        updated_at
      FROM transacoes_api
      WHERE account_id = ? AND amount < 0 AND situacao <> 'ignorada'
    `;
    const params = [accountId];

    if (empresaId) {
      query += " AND company_id = ?";
      params.push(empresaId);
    }

    query += " ORDER BY date DESC";

    const [rows] = await pool.query(query, params);

    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar transações de saída:", error);
    res.status(500).json({ error: "Erro ao buscar transações de saída." });
  }
});

// 🔹 GET /company/:companyId/transacoes ➜ Todas as transações da empresa
router.get("/company/:companyId/transacoes", verifyToken, async (req, res) => {
  const { companyId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM transacoes_api WHERE company_id = ? ORDER BY date DESC`,
      [companyId]
    );
    res.json({ total: rows.length, transactions: rows });
  } catch (error) {
    console.error("Erro ao buscar transações da empresa:", error);
    res.status(500).json({ error: "Erro ao buscar transações da empresa." });
  }
});

// 🔹 GET /company/:companyId/entradas ➜ Entradas da empresa (amount > 0)
router.get("/company/:companyId/entradas", verifyToken, async (req, res) => {
  const { companyId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM transacoes_api WHERE company_id = ? AND amount > 0 AND situacao <> 'ignorada' ORDER BY date DESC`,
      [companyId]
    );
    res.json({ total: rows.length, transactions: rows });
  } catch (error) {
    console.error("Erro ao buscar entradas da empresa:", error);
    res.status(500).json({ error: "Erro ao buscar entradas da empresa." });
  }
});

// 🔹 GET /company/:companyId/saidas ➜ Saídas da empresa (amount < 0)
router.get("/company/:companyId/saidas", verifyToken, async (req, res) => {
  const { companyId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM transacoes_api WHERE company_id = ? AND amount < 0 AND situacao <> 'ignorada' ORDER BY date DESC`,
      [companyId]
    );
    res.json({ total: rows.length, transactions: rows });
  } catch (error) {
    console.error("Erro ao buscar saídas da empresa:", error);
    res.status(500).json({ error: "Erro ao buscar saídas da empresa." });
  }
});

// 🔹 PUT /company/:companyId/transacao/:id ➜ Editar transação da empresa
router.put("/company/:companyId/transacao/:id", verifyToken, async (req, res) => {
  const { companyId, id } = req.params;
  const { description, amount, date, situacao, anexo_base64 } = req.body;

  // ✅ Agora aceita 'ignorada'
  const allowedSituacoes = ['em_aberto', 'recebido', 'vencidos', 'ignorada'];
  if (situacao && !allowedSituacoes.includes(situacao)) {
    return res.status(400).json({ error: "Valor de 'situacao' inválido. Aceitos: em_aberto, recebido, vencidos, ignorada." });
  }

  try {
    const [result] = await pool.query(
      `UPDATE transacoes_api SET description = ?, amount = ?, date = ?, situacao = ?, anexo_base64 = ?, updated_at = NOW() WHERE id = ? AND company_id = ?`,
      [description, amount, date, situacao, anexo_base64, id, companyId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Transação não encontrada para esta empresa." });
    }
    res.json({ message: "Transação atualizada com sucesso." });
  } catch (error) {
    console.error("Erro ao editar transação:", error);
    res.status(500).json({ error: "Erro ao editar transação." });
  }
});

// 🔹 DELETE /company/:companyId/transacao/:id ➜ Excluir transação da empresa
router.delete("/company/:companyId/transacao/:id", verifyToken, async (req, res) => {
  const { companyId, id } = req.params;
  try {
    const [result] = await pool.query(
      `DELETE FROM transacoes_api WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Transação não encontrada para esta empresa." });
    }
    res.json({ message: "Transação excluída com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir transação:", error);
    res.status(500).json({ error: "Erro ao excluir transação." });
  }
});

// 🔹 Ignorar transações da transacoes_api (1 ou várias)
router.post("/ignore", verifyToken, async (req, res) => {
  const { company_id, id, ids } = req.body;

  if (!company_id) return res.status(400).json({ error: "company_id é obrigatório." });

  const toUpdate = Array.isArray(ids) ? ids : (id ? [id] : []);
  if (toUpdate.length === 0) return res.status(400).json({ error: "Informe 'id' ou 'ids'." });

  try {
    const [result] = await pool.query(
      `UPDATE transacoes_api 
         SET situacao = 'ignorada', updated_at = NOW()
       WHERE company_id = ? AND id IN (?)`,
      [company_id, toUpdate]
    );
    res.json({ message: "Transação(ões) ignorada(s) com sucesso.", affected: result.affectedRows, ids: toUpdate });
  } catch (error) {
    console.error("Erro ao ignorar transações:", error);
    res.status(500).json({ error: "Erro ao ignorar transações." });
  }
});

// 🔹 Designorar (trazer de volta) — volta para 'recebido'
router.post("/unignore", verifyToken, async (req, res) => {
  const { company_id, id, ids } = req.body;

  if (!company_id) return res.status(400).json({ error: "company_id é obrigatório." });

  const toUpdate = Array.isArray(ids) ? ids : (id ? [id] : []);
  if (toUpdate.length === 0) return res.status(400).json({ error: "Informe 'id' ou 'ids'." });

  try {
    const [result] = await pool.query(
      `UPDATE transacoes_api 
         SET situacao = 'recebido', updated_at = NOW()
       WHERE company_id = ? AND id IN (?)`,
      [company_id, toUpdate]
    );
    res.json({ message: "Transação(ões) restaurada(s) com sucesso.", affected: result.affectedRows, ids: toUpdate });
  } catch (error) {
    console.error("Erro ao restaurar transações:", error);
    res.status(500).json({ error: "Erro ao restaurar transações." });
  }
});

// 🔹 Listar apenas as ignoradas da empresa
router.get("/company/:companyId/ignoradas", verifyToken, async (req, res) => {
  const { companyId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM transacoes_api 
        WHERE company_id = ? AND situacao = 'ignorada'
        ORDER BY date DESC`,
      [companyId]
    );
    res.json({ total: rows.length, transactions: rows });
  } catch (error) {
    console.error("Erro ao buscar transações ignoradas:", error);
    res.status(500).json({ error: "Erro ao buscar transações ignoradas." });
  }
});

module.exports = router;
