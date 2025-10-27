const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");
const { makePluggyRequest } = require("../../middlewares/pluggyToken");

// 🔹 Cria ou atualiza consentimento Pluggy (contas) com suporte Inter
router.post("/", verifyToken, async (req, res) => {
    const {
        item_id,
        conector_id,
        status,
        status_execucao,
        expiracao_consentimento,
        empresa_id,
        cliente_id,
        banco,
        descricao_banco,
        tipo_conta,
        numero_conta,
        agencia,
        tipo,
        
        // 🏦 Campos Inter
        inter_ativado,
        inter_cliente_id,
        inter_cliente_secret,
        inter_cert,
        inter_key,
        inter_conta_corrente,
        inter_apelido,
        inter_status
    } = req.body;

    // Validar se item_id foi fornecido
    if (!item_id) {
        console.log("[ERROR] item_id não fornecido na requisição");
        return res.status(400).json({
            error: "item_id é obrigatório para criar/atualizar conta."
        });
    }

    // Debug: Log dos dados recebidos
    console.log("[DEBUG] Dados recebidos na rota POST /:", {
        item_id,
        empresa_id,
        cliente_id,
        inter_ativado,
        has_inter_cliente_id: !!inter_cliente_id
    });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Inserir/atualizar na tabela contas
        const [result] = await conn.query(
            `
            INSERT INTO contas
                (api_id, conector_id, status, status_execucao, expiracao_consentimento, 
                 empresa_id, cliente_id, banco, descricao_banco, tipo_conta, numero_conta, agencia, tipo,
                 inter_ativado, inter_cliente_id, inter_cliente_secret, inter_cert, inter_key, 
                 inter_conta_corrente, inter_apelido, inter_status, 
                 criado_em, atualizado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                conector_id = VALUES(conector_id),
                status = VALUES(status),
                status_execucao = VALUES(status_execucao),
                expiracao_consentimento = VALUES(expiracao_consentimento),
                empresa_id = VALUES(empresa_id),
                cliente_id = VALUES(cliente_id),
                banco = VALUES(banco),
                descricao_banco = VALUES(descricao_banco),
                tipo_conta = VALUES(tipo_conta),
                numero_conta = VALUES(numero_conta),
                agencia = VALUES(agencia),
                tipo = VALUES(tipo),
                inter_ativado = VALUES(inter_ativado),
                inter_cliente_id = VALUES(inter_cliente_id),
                inter_cliente_secret = VALUES(inter_cliente_secret),
                inter_cert = VALUES(inter_cert),
                inter_key = VALUES(inter_key),
                inter_conta_corrente = VALUES(inter_conta_corrente),
                inter_apelido = VALUES(inter_apelido),
                inter_status = VALUES(inter_status),
                atualizado_em = NOW()
            `,
            [
                item_id,
                conector_id || null,
                status || null,
                status_execucao || null,
                expiracao_consentimento || null,
                empresa_id || null,
                cliente_id || null,
                banco || null,
                descricao_banco || null,
                tipo_conta || null,
                numero_conta || null,
                agencia || null,
                tipo || null,
                inter_ativado || false,
                inter_cliente_id || null,
                inter_cliente_secret || null,
                inter_cert || null,
                inter_key || null,
                inter_conta_corrente || null,
                inter_apelido || null,
                inter_status || 'ativo'
            ]
        );

        // 2. Se Inter está habilitado e tem credenciais, criar/atualizar na tabela inter_accounts
        if (inter_ativado && inter_cliente_id && inter_cliente_secret && inter_cert && inter_key) {
            console.log("[DEBUG] Criando/atualizando conta Inter...");
            
            // Buscar o ID da conta recém-criada/atualizada
            const [[contaApi]] = await conn.query(
                'SELECT id FROM contas WHERE api_id = ?',
                [item_id]
            );

            if (contaApi) {
                // Se é conta padrão, desmarcar outras da mesma empresa
                if (empresa_id) {
                    await conn.query(
                        `UPDATE inter_accounts SET is_default = FALSE 
                         WHERE company_id = ? AND id <> (SELECT inter_conta_id FROM contas WHERE id = ?)`,
                        [empresa_id, contaApi.id]
                    );
                }

                // Inserir/atualizar na tabela inter_accounts
                const [interResult] = await conn.query(
                    `
                    INSERT INTO inter_accounts 
                        (company_id, conta_corrente, client_id, client_secret, cert_b64, key_b64, 
                         apelido, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                    ON DUPLICATE KEY UPDATE
                        client_id = VALUES(client_id),
                        client_secret = VALUES(client_secret),
                        cert_b64 = VALUES(cert_b64),
                        key_b64 = VALUES(key_b64),
                        apelido = VALUES(apelido),
                        status = VALUES(status),
                        updated_at = NOW()
                    `,
                    [
                        empresa_id,
                        inter_conta_corrente,
                        inter_cliente_id,
                        inter_cliente_secret,
                        inter_cert,
                        inter_key,
                        inter_apelido || `Conta ${inter_conta_corrente}`,
                        inter_status || 'ativo'
                    ]
                );

                // Atualizar o inter_conta_id na contas
                const interAccountId = interResult.insertId || interResult.insertId;
                if (interAccountId) {
                    await conn.query(
                        'UPDATE contas SET inter_conta_id = ? WHERE id = ?',
                        [interAccountId, contaApi.id]
                    );
                }
            }
        }

        await conn.commit();

        res.status(201).json({
            message: "Conta Pluggy salva/atualizada com sucesso.",
            affectedRows: result.affectedRows,
            interEnabled: inter_ativado
        });
    } catch (error) {
        await conn.rollback();
        console.error("Erro ao salvar conta:", error);
        res.status(500).json({ error: "Erro ao salvar conta." });
    } finally {
        conn.release();
    }
});

// 🔹 Listar todos os consentimentos Pluggy
router.get("/", verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM contas ORDER BY criado_em DESC`);
        res.json(rows);
    } catch (error) {
        console.error("Erro ao listar contas:", error);
        res.status(500).json({ error: "Erro ao listar contas." });
    }
});

// 🔹 Buscar um consentimento Pluggy por api_id
router.get("/:api_id", verifyToken, async (req, res) => {
    const { api_id } = req.params;

    try {
        const [rows] = await pool.query(`SELECT * FROM contas WHERE api_id = ?`, [api_id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Conta Pluggy não encontrada." });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error("Erro ao buscar conta:", error);
        res.status(500).json({ error: "Erro ao buscar conta." });
    }
});

// 🔹 Atualizar status/status_execucao se precisar
router.put("/:api_id", verifyToken, async (req, res) => {
    const { api_id } = req.params;
    const { status, status_execucao } = req.body;

    try {
        const [result] = await pool.query(
            `
      UPDATE contas
      SET status = ?, status_execucao = ?, atualizado_em = NOW()
      WHERE api_id = ?
      `,
            [status, status_execucao, api_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Conta Pluggy não encontrada para atualizar." });
        }

        res.json({ message: "Conta Pluggy atualizada com sucesso." });
    } catch (error) {
        console.error("Erro ao atualizar conta:", error);
        res.status(500).json({ error: "Erro ao atualizar conta." });
    }
});

// 🔹 GET /company/:empresaId/contas ➜ Todas as contas da empresa
router.get("/company/:empresaId/contas", verifyToken, async (req, res) => {
  const { empresaId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM contas WHERE empresa_id = ? ORDER BY criado_em DESC`,
      [empresaId]
    );
    res.json({ total: rows.length, contas: rows });
  } catch (error) {
    console.error("Erro ao buscar contas da empresa:", error);
    res.status(500).json({ error: "Erro ao buscar contas da empresa." });
  }
});

// 🔹 PUT /company/:empresaId/conta/:conta ➜ Editar conta da empresa
router.put("/company/:empresaId/conta/:conta", verifyToken, async (req, res) => {
  const { empresaId, conta } = req.params;
  const {
    banco,
    descricao_banco,
    tipo_conta,
    numero_conta,
    agencia,
    tipo,
    status,
    status_execucao
  } = req.body;
  try {
    const [result] = await pool.query(
      `UPDATE contas SET banco = ?, descricao_banco = ?, tipo_conta = ?, numero_conta = ?, agencia = ?, tipo = ?, status = ?, status_execucao = ?, atualizado_em = NOW() WHERE conta = ? AND empresa_id = ?`,
      [banco, descricao_banco, tipo_conta, numero_conta, agencia, tipo, status, status_execucao, conta, empresaId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Conta não encontrada para esta empresa." });
    }
    res.json({ message: "Conta atualizada com sucesso." });
  } catch (error) {
    console.error("Erro ao editar conta:", error);
    res.status(500).json({ error: "Erro ao editar conta." });
  }
});

// 🔹 DELETE /company/:empresaId/conta/:conta ➜ Excluir conta da empresa
router.delete("/company/:empresaId/conta/:conta", verifyToken, async (req, res) => {
  const { empresaId, conta } = req.params;
  try {
    const [result] = await pool.query(
      `DELETE FROM contas WHERE conta = ? AND empresa_id = ?`,
      [conta, empresaId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Conta não encontrada para esta empresa." });
    }
    res.json({ message: "Conta excluída com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir conta:", error);
    res.status(500).json({ error: "Erro ao excluir conta." });
  }
});

// 🔹 GET /inter/:empresaId ➜ Listar contas com Inter habilitado
router.get("/inter/:empresaId", verifyToken, async (req, res) => {
  const { empresaId } = req.params;
  try {
    const [rows] = await pool.query(
      `       SELECT 
         id,
         api_id,
         banco,
         descricao_banco,
         tipo_conta,
         numero_conta,
         agencia,
         tipo,
         inter_ativado,
         inter_apelido,
         inter_conta_corrente,
         inter_status,
         inter_conta_id,
         criado_em,
         atualizado_em
       FROM contas 
       WHERE empresa_id = ? AND inter_ativado = TRUE
       ORDER BY criado_em DESC`,
      [empresaId]
    );
    res.json({ total: rows.length, contas: rows });
  } catch (error) {
    console.error("Erro ao buscar contas Inter:", error);
    res.status(500).json({ error: "Erro ao buscar contas Inter." });
  }
});

// 🔹 Nova rota: sincronizar contas Pluggy com a tabela contas
router.post("/sync", verifyToken, async (req, res) => {
    const { itemId, empresa_id, cliente_id } = req.body;
  
    console.log("[DEBUG] empresa_id recebido na sync:", empresa_id);
    console.log("[DEBUG] cliente_id recebido na sync:", cliente_id);
  
    if (!itemId) {
      console.log("❌ itemId não enviado no body!");
      return res.status(400).json({ error: "itemId é obrigatório." });
    }
  
    try {
      console.log("🚀 Chamando Pluggy com itemId:", itemId);
  
      // Usar a nova função com retry automático
      const response = await makePluggyRequest(
        `https://api.pluggy.ai/accounts?itemId=${itemId}`
      );
  
      const data = response.data;
      console.log("👉 Resposta Pluggy:", JSON.stringify(data, null, 2));
  
      let accounts = [];
  
      if (data.results && Array.isArray(data.results)) {
        accounts = data.results;
      } else if (Array.isArray(data)) {
        accounts = data;
      } else if (data.id) {
        accounts = [data];
      } else {
        console.log("⚠️ Formato inesperado:", data);
      }
  
      if (accounts.length === 0) {
        console.log("❌ Nenhuma conta encontrada na resposta!");
        return res.status(404).json({ message: "Nenhuma conta Pluggy encontrada." });
      }
  
      let inserted = 0;
  
      for (const acc of accounts) {
        console.log("🔄 Salvando conta:", acc.id);

        // Função utilitária para priorizar valor do frontend se definido
        function prioridade(front, pluggy) {
          return front !== undefined && front !== null && front !== '' ? front : pluggy;
        }

        const banco = prioridade(req.body.banco, acc.bankName || null);
        const descricao_banco = prioridade(req.body.descricao_banco, acc.description || null);
        const tipo_conta = prioridade(req.body.tipo_conta, acc.type === 'BUSINESS' ? 'pj' : 'pf');
        const numero_conta = prioridade(req.body.numero_conta, acc.number || null);
        const agencia = prioridade(req.body.agencia, acc.branchNumber || null);
        const tipo = prioridade(req.body.tipo, acc.subtype || null);

        await pool.query(
          `
          INSERT INTO contas
            (api_id, conta, conector_id, status, status_execucao, empresa_id, cliente_id, banco, descricao_banco, tipo_conta, numero_conta, agencia, tipo, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            conta = VALUES(conta),
            conector_id = VALUES(conector_id),
            status = VALUES(status),
            status_execucao = VALUES(status_execucao),
            empresa_id = VALUES(empresa_id),
            cliente_id = VALUES(cliente_id),
            banco = VALUES(banco),
            descricao_banco = VALUES(descricao_banco),
            tipo_conta = VALUES(tipo_conta),
            numero_conta = VALUES(numero_conta),
            agencia = VALUES(agencia),
            tipo = VALUES(tipo),
            atualizado_em = NOW()
          `,
          [
            itemId,
            acc.id,
            acc.connectorId || null,
            acc.status || null,
            acc.execution_status || null,
            empresa_id || null,
            cliente_id || null,
            banco,
            descricao_banco,
            tipo_conta,
            numero_conta,
            agencia,
            tipo
          ]
        );
  
        inserted++;
      }
  
      console.log(`✅ Sincronização finalizada. Total inseridas/atualizadas: ${inserted}`);
  
      // Retorna todos os dados, incluindo os novos campos
      const [accountsRows] = await pool.query(
        `SELECT conta, conector_id, status, status_execucao, banco, descricao_banco, tipo_conta, numero_conta, agencia, tipo
         FROM contas WHERE api_id = ? ORDER BY atualizado_em DESC`,
        [itemId]
      );
  
      const accountsList = accountsRows.map(row => ({
        conta: row.conta,
        conector_id: row.conector_id,
        status: row.status,
        status_execucao: row.status_execucao,
        banco: row.banco,
        descricao_banco: row.descricao_banco,
        tipo_conta: row.tipo_conta,
        numero_conta: row.numero_conta,
        agencia: row.agencia,
        tipo: row.tipo
      }));
  
      return res.json({
        message: "Sincronização concluída.",
        total: inserted,
        contas: accountsList
      });
  
    } catch (error) {
      console.error("❌ Erro ao sincronizar contas Pluggy:", error);
      res.status(500).json({ error: "Erro ao sincronizar contas Pluggy." });
    }
  });  


module.exports = router;
