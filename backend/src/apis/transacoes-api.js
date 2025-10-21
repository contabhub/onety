const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const verifyToken = require("../middlewares/auth");
const { makePluggyRequest } = require("../middlewares/pluggyToken");



router.post("/sync", verifyToken, async (req, res) => {
  const { accountId, empresa_id, cliente_id, contas_id } = req.body;

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
      const parsedDate = tx.data ? tx.data.substring(0, 10) : null;

      // 🟢 Por padrão: situacao = 'recebido'
      const situacao = 'recebido';
      const anexo = null; // Aqui fica null por padrão, se não vier nada do Pluggy

      await pool.query(
        `
        INSERT INTO transacoes_api
          (pluggy_transacao_id, conta_id, descricao, valor, moeda, data, categoria, situacao, anexo, empresa_id, cliente_id, contas_id, criado_em, atualizado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          descricao = VALUES(descricao),
          valor = VALUES(valor),
          data = VALUES(data),
          categoria = VALUES(categoria),
          empresa_id = VALUES(empresa_id),
          cliente_id = VALUES(cliente_id),
          contas_id = VALUES(contas_id),
          situacao = CASE 
            WHEN situacao = 'ignorada' THEN 'ignorada'  -- ✅ Preserva transações ignoradas
            ELSE VALUES(situacao)                       -- ✅ Atualiza outras situações
          END,
          anexo = VALUES(anexo),
          atualizado_em = NOW()
      `,
        [
          tx.id,
          tx.accountId,
          tx.descricao || null,
          tx.valor || null,
          tx.currencyCode || null,
          parsedDate,
          tx.category || null,
          situacao,
          anexo,
          empresa_id || null,
          cliente_id || null,
          contas_id || null
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
        pluggy_transacao_id,
        conta_id,
        descricao,
        valor,
        moeda,
        data,
        categoria,
        situacao,
        anexo,
        empresa_id,
        cliente_id,
        contas_id,
        criado_em,
        atualizado_em
      FROM transacoes_api
      WHERE conta_id = ?
      ORDER BY data DESC
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
        conta_id,
        descricao,
        valor,
        moeda,
        data,
        situacao,
        anexo,
        empresa_id,
        cliente_id,
        criado_em,
        updatad_at
      FROM transacoes_api
      WHERE conta_id = ? AND valor > 0 AND situacao <> 'ignorada'
    `;
    const params = [accountId];

    if (empresaId) {
      query += " AND empresa_id = ?";
      params.push(empresaId);
    }

    query += " ORDER BY data DESC";

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
        conta_id,
        descricao,
        valor,
        moeda,
        data,
        situacao,
        anexo,
        empresa_id,
        cliente_id,
        criado_em,
        updatad_at
      FROM transacoes_api
      WHERE conta_id = ? AND valor < 0 AND situacao <> 'ignorada'
    `;
    const params = [accountId];

    if (empresaId) {
      query += " AND empresa_id = ?";
      params.push(empresaId);
    }

    query += " ORDER BY data DESC";

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
      `SELECT * FROM transacoes_api WHERE empresa_id = ? ORDER BY data DESC`,
      [companyId]
    );
    res.json({ total: rows.length, transactions: rows });
  } catch (error) {
    console.error("Erro ao buscar transações da empresa:", error);
    res.status(500).json({ error: "Erro ao buscar transações da empresa." });
  }
});

// 🔹 GET /company/:companyId/entradas ➜ Entradas da empresa (valor > 0)
router.get("/company/:companyId/entradas", verifyToken, async (req, res) => {
  const { companyId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM transacoes_api WHERE empresa_id = ? AND valor > 0 AND situacao <> 'ignorada' ORDER BY data DESC`,
      [companyId]
    );
    res.json({ total: rows.length, transactions: rows });
  } catch (error) {
    console.error("Erro ao buscar entradas da empresa:", error);
    res.status(500).json({ error: "Erro ao buscar entradas da empresa." });
  }
});

// 🔹 GET /company/:companyId/saidas ➜ Saídas da empresa (valor < 0)
router.get("/company/:companyId/saidas", verifyToken, async (req, res) => {
  const { companyId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM transacoes_api WHERE empresa_id = ? AND valor < 0 AND situacao <> 'ignorada' ORDER BY data DESC`,
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
  const { descricao, valor, data, situacao, anexo } = req.body;

  // ✅ Agora aceita 'ignorada'
  const allowedSituacoes = ['em_aberto', 'recebido', 'vencidos', 'ignorada'];
  if (situacao && !allowedSituacoes.includes(situacao)) {
    return res.status(400).json({ error: "Valor de 'situacao' inválido. Aceitos: em_aberto, recebido, vencidos, ignorada." });
  }

  try {
    const [result] = await pool.query(
      `UPDATE transacoes_api SET descricao = ?, valor = ?, data = ?, situacao = ?, anexo = ?, updatad_at = NOW() WHERE id = ? AND empresa_id = ?`,
      [descricao, valor, data, situacao, anexo, id, companyId]
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
      `DELETE FROM transacoes_api WHERE id = ? AND empresa_id = ?`,
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
  const { empresa_id, id, ids } = req.body;

  if (!empresa_id) return res.status(400).json({ error: "empresa_id é obrigatório." });

  const toUpdata = Array.isArray(ids) ? ids : (id ? [id] : []);
  if (toUpdata.length === 0) return res.status(400).json({ error: "Informe 'id' ou 'ids'." });

  try {
    const [result] = await pool.query(
      `UPDATE transacoes_api 
         SET situacao = 'ignorada', updatad_at = NOW()
       WHERE empresa_id = ? AND id IN (?)`,
      [empresa_id, toUpdata]
    );
    res.json({ message: "Transação(ões) ignorada(s) com sucesso.", affected: result.affectedRows, ids: toUpdata });
  } catch (error) {
    console.error("Erro ao ignorar transações:", error);
    res.status(500).json({ error: "Erro ao ignorar transações." });
  }
});

// 🔹 Designorar (trazer de volta) — volta para 'recebido'
router.post("/unignore", verifyToken, async (req, res) => {
  const { empresa_id, id, ids } = req.body;

  if (!empresa_id) return res.status(400).json({ error: "empresa_id é obrigatório." });

  const toUpdata = Array.isArray(ids) ? ids : (id ? [id] : []);
  if (toUpdata.length === 0) return res.status(400).json({ error: "Informe 'id' ou 'ids'." });

  try {
    const [result] = await pool.query(
      `UPDATE transacoes_api 
         SET situacao = 'recebido', updatad_at = NOW()
       WHERE empresa_id = ? AND id IN (?)`,
      [empresa_id, toUpdata]
    );
    res.json({ message: "Transação(ões) restaurada(s) com sucesso.", affected: result.affectedRows, ids: toUpdata });
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
        WHERE empresa_id = ? AND situacao = 'ignorada'
        ORDER BY data DESC`,
      [companyId]
    );
    res.json({ total: rows.length, transactions: rows });
  } catch (error) {
    console.error("Erro ao buscar transações ignoradas:", error);
    res.status(500).json({ error: "Erro ao buscar transações ignoradas." });
  }
});

module.exports = router;
