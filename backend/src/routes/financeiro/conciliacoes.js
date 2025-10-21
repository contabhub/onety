const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// Sugestão de conciliações: valor igual e nome parecido
// Sugestão de conciliações: valor igual e nome parecido
router.get("/sugestoes/:companyId", verifyToken, async (req, res) => {
  const { companyId } = req.params;
  const { toleranciaDias = 30 } = req.query;

  // 🔹 Configuração: definir se revogada pode voltar a conciliar ou não
  const allowReconcilAfterRevoke = true; // mude para false se quiser bloquear de vez

  try {
    // --- API Transações não conciliadas ---
    const [apiTransacoes] = await pool.query(`
      SELECT ta.id, ta.descricao, ta.valor, ta.data
      FROM transacoes_api ta
      WHERE ta.empresa_id = ?
        AND ta.situacao <> 'ignorada'           -- ⬅️ novo filtro
        AND ta.id NOT IN (
          SELECT transacao_api_id 
          FROM conciliacoes 
          WHERE status = 'conciliada' 
          ${allowReconcilAfterRevoke ? "" : "OR status = 'revogada'"}
        )
    `, [companyId]);

    // --- Transações cadastradas ainda não conciliadas ---
    const [transacoes] = await pool.query(`
      SELECT t.id, t.descricao, t.valor, t.data_transacao
      FROM transacoes t
      LEFT JOIN conciliacoes c 
        ON c.transacao_id = t.id 
        AND (
          c.status = 'conciliada'
          ${allowReconcilAfterRevoke ? "" : "OR c.status = 'revogada'"}
        )
      WHERE t.empresa_id = ? 
        AND t.situacao != 'recebido' 
        AND c.id IS NULL
    `, [companyId]);

    // --- Montagem do resultado ---
    const resultado = apiTransacoes.map(apiTx => {
      const valorApi = parseFloat(apiTx.valor);
      const descricaoApi = (apiTx.descricao || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const dataApi = new Date(apiTx.data);

      const sugestoes = [];

      for (const tx of transacoes) {
        const valorTx = parseFloat(tx.valor);
        if (Math.abs(valorApi) !== Math.abs(valorTx)) continue;

        const descricaoTx = (tx.descricao || '').toLowerCase().replace(/\s+/g, ' ').trim();
        let nomesParecidos = false;
        if (descricaoApi && descricaoTx) {
          const palavrasApi = descricaoApi.split(' ');
          const palavrasTx = descricaoTx.split(' ');
          nomesParecidos = palavrasApi.some(word => word && descricaoTx.includes(word)) ||
                           palavrasTx.some(word => word && descricaoApi.includes(word));
        }
        if (!nomesParecidos) continue;

        const dataTransacao = tx.data_transacao ? new Date(tx.data_transacao) : null;
        if (!dataTransacao) continue;
        const diffDias = Math.abs((dataApi - dataTransacao) / (1000 * 60 * 60 * 24));

        if (diffDias <= toleranciaDias) {
          sugestoes.push({
            transacao_id: tx.id,
            descricao: tx.descricao,
            data: tx.data_transacao,
            data_vencimento: tx.data_vencimento
          });
        }
      }

      return {
        transacao_api_id: apiTx.id,
        descricao_api: apiTx.descricao,
        valor: apiTx.valor,
        data_api: apiTx.data,
        sugestoes
      };
    });

    res.json({ total: resultado.length, conciliacoes: resultado });
  } catch (error) {
    console.error("Erro ao sugerir conciliações:", error);
    res.status(500).json({ error: "Erro ao sugerir conciliações." });
  }
});

// Conciliação manual
router.post("/conciliar", verifyToken, async (req, res) => {
  const { transacao_api_id, transacao_id, usuario_id, observacao } = req.body;
  if (!transacao_api_id || !transacao_id) {
    return res.status(400).json({ error: "transacao_api_id e transacao_id são obrigatórios." });
  }
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    // Atualiza status da transação para conciliado
    await conn.query(
      `UPDATE transacoes SET situacao = 'conciliado' WHERE id = ?`,
      [transacao_id]
    );
    // Registra conciliação
    await conn.query(
      `INSERT INTO conciliacoes (transacao_api_id, transacao_id, status, data_conciliacao, usuario_id, observacao)
       VALUES (?, ?, 'conciliada', NOW(), ?, ?)
       ON DUPLICATE KEY UPDATE status = 'conciliada', data_conciliacao = NOW(), usuario_id = VALUES(usuario_id), observacao = VALUES(observacao)`,
      [transacao_api_id, transacao_id, usuario_id || null, observacao || null]
    );
    await conn.commit();
    res.json({ message: "Conciliação realizada com sucesso." });
  } catch (error) {
    await conn.rollback();
    console.error("Erro ao conciliar:", error);
    res.status(500).json({ error: "Erro ao conciliar." });
  } finally {
    conn.release();
  }
});

// Criar transação a partir de uma transação_api
router.post("/criar-transacao", verifyToken, async (req, res) => {
  const { transacao_api_id, categoria_id, cliente_id, centro_de_custo_id, descricao } = req.body;
  if (!transacao_api_id || !categoria_id) {
    return res.status(400).json({ error: "transacao_api_id e categoria_id são obrigatórios." });
  }
  try {
    // Buscar dados da transacao_api
    const [[apiTx]] = await pool.query(
      `SELECT * FROM transacoes_api WHERE id = ?`,
      [transacao_api_id]
    );
    if (!apiTx) {
      return res.status(404).json({ error: "Transação API não encontrada." });
    }
    // Montar dados para nova transação
    const tipo = parseFloat(apiTx.valor) > 0 ? 'entrada' : 'saida';
    const valor = Math.abs(parseFloat(apiTx.valor));
    const data_transacao = apiTx.data
      ? (typeof apiTx.data === 'string'
          ? apiTx.data.substring(0, 10)
          : apiTx.data.toISOString().substring(0, 10))
      : null;
    const empresa_id = apiTx.empresa_id;
    // Inserir na tabela transacoes
    const [result] = await pool.query(
      `INSERT INTO transacoes (
        conta_id, empresa_id, tipo, valor, descricao, data_transacao, situacao, categoria_id, cliente_id, centro_custo_id, pluggy_transacao_id, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        null, // conta_id (opcional, pode ser null)
        empresa_id,
        tipo,
        valor,
        descricao || apiTx.descricao,
        data_transacao,
        'em_aberto',
        categoria_id,
        cliente_id || null,
        centro_custo_id || null,
        apiTx.pluggy_transacao_id || null
      ]
    );
    res.status(201).json({ transacao_id: result.insertId, message: "Transação criada com sucesso." });
  } catch (error) {
    console.error("Erro ao criar transação a partir da API:", error);
    res.status(500).json({ error: "Erro ao criar transação a partir da API." });
  }
});

// Configuração global (ajuste aqui conforme sua regra de negócio)
const allowReconcilAfterRevoke = true; 
// true  = revogada volta para pendentes
// false = revogada não pode mais ser conciliada

// 🔹 Revogar conciliação
router.post("/revogar", verifyToken, async (req, res) => {
  const { transacao_api_id, transacao_id, usuario_id, observacao } = req.body;

  if (!transacao_api_id || !transacao_id) {
    return res.status(400).json({ error: "transacao_api_id e transacao_id são obrigatórios." });
  }

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    // Se a regra for "revogada volta a ser pendente", então restauramos a transação
    if (allowReconcilAfterRevoke) {
      await conn.query(
        `UPDATE transacoes SET situacao = 'em_aberto' WHERE id = ?`,
        [transacao_id]
      );
    } else {
      // Se não permitir reconcialiação após revogação, marca como cancelado
      await conn.query(
        `UPDATE transacoes SET situacao = 'cancelado' WHERE id = ?`,
        [transacao_id]
      );
    }

    // Atualizar a conciliação
    await conn.query(
      `UPDATE conciliacoes
       SET status = 'revogada',
           data_revogacao = NOW(),
           usuario_id = ?,
           observacao = ?
       WHERE transacao_api_id = ? 
         AND transacao_id = ? 
         AND status = 'conciliada'`,
      [usuario_id || null, observacao || null, transacao_api_id, transacao_id]
    );

    await conn.commit();
    res.json({
      message: "Conciliação revogada com sucesso.",
      allowReconcilAfterRevoke
    });
  } catch (error) {
    await conn.rollback();
    console.error("Erro ao revogar conciliação:", error);
    res.status(500).json({ error: "Erro ao revogar conciliação." });
  } finally {
    conn.release();
  }
});


module.exports = router;