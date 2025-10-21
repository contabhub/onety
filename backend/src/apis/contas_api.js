const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const verifyToken = require("../middlewares/auth");
const { makePluggyRequest } = require("../middlewares/pluggyToken");

// 🔹 Cria ou atualiza consentimento Pluggy (contas_api) com suporte Inter
router.post("/", verifyToken, async (req, res) => {
    const {
        item_id,
        client_user_id,
        connector_id,
        status,
        execution_status,
        consent_expires_at,
        company_id,
        cliente_id,
        banco,
        descricao_banco,
        tipo_conta,
        numero_conta,
        agencia,
        tipo,
        
        // 🏦 Campos Inter
        inter_enabled,
        inter_client_id,
        inter_client_secret,
        inter_cert_b64,
        inter_key_b64,
        inter_conta_corrente,
        inter_apelido,
        inter_ambiente,
        inter_is_default,
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
        company_id,
        cliente_id,
        inter_enabled,
        has_inter_client_id: !!inter_client_id
    });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Inserir/atualizar na tabela contas_api
        const [result] = await conn.query(
            `
            INSERT INTO contas_api
                (item_id, client_user_id, connector_id, status, execution_status, consent_expires_at, 
                 company_id, cliente_id, banco, descricao_banco, tipo_conta, numero_conta, agencia, tipo,
                 inter_enabled, inter_client_id, inter_client_secret, inter_cert_b64, inter_key_b64, 
                 inter_conta_corrente, inter_apelido, inter_ambiente, inter_is_default, inter_status, 
                 created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                client_user_id = VALUES(client_user_id),
                connector_id = VALUES(connector_id),
                status = VALUES(status),
                execution_status = VALUES(execution_status),
                consent_expires_at = VALUES(consent_expires_at),
                company_id = VALUES(company_id),
                cliente_id = VALUES(cliente_id),
                banco = VALUES(banco),
                descricao_banco = VALUES(descricao_banco),
                tipo_conta = VALUES(tipo_conta),
                numero_conta = VALUES(numero_conta),
                agencia = VALUES(agencia),
                tipo = VALUES(tipo),
                inter_enabled = VALUES(inter_enabled),
                inter_client_id = VALUES(inter_client_id),
                inter_client_secret = VALUES(inter_client_secret),
                inter_cert_b64 = VALUES(inter_cert_b64),
                inter_key_b64 = VALUES(inter_key_b64),
                inter_conta_corrente = VALUES(inter_conta_corrente),
                inter_apelido = VALUES(inter_apelido),
                inter_ambiente = VALUES(inter_ambiente),
                inter_is_default = VALUES(inter_is_default),
                inter_status = VALUES(inter_status),
                updated_at = NOW()
            `,
            [
                item_id,
                client_user_id || null,
                connector_id || null,
                status || null,
                execution_status || null,
                consent_expires_at || null,
                company_id || null,
                cliente_id || null,
                banco || null,
                descricao_banco || null,
                tipo_conta || null,
                numero_conta || null,
                agencia || null,
                tipo || null,
                inter_enabled || false,
                inter_client_id || null,
                inter_client_secret || null,
                inter_cert_b64 || null,
                inter_key_b64 || null,
                inter_conta_corrente || null,
                inter_apelido || null,
                inter_ambiente || 'prod',
                inter_is_default || false,
                inter_status || 'ativo'
            ]
        );

        // 2. Se Inter está habilitado e tem credenciais, criar/atualizar na tabela inter_accounts
        if (inter_enabled && inter_client_id && inter_client_secret && inter_cert_b64 && inter_key_b64) {
            console.log("[DEBUG] Criando/atualizando conta Inter...");
            
            // Buscar o ID da conta_api recém-criada/atualizada
            const [[contaApi]] = await conn.query(
                'SELECT id FROM contas_api WHERE item_id = ?',
                [item_id]
            );

            if (contaApi) {
                // Se é conta padrão, desmarcar outras da mesma empresa
                if (inter_is_default && company_id) {
                    await conn.query(
                        `UPDATE inter_accounts SET is_default = FALSE 
                         WHERE company_id = ? AND id <> (SELECT inter_account_id FROM contas_api WHERE id = ?)`,
                        [company_id, contaApi.id]
                    );
                }

                // Inserir/atualizar na tabela inter_accounts
                const [interResult] = await conn.query(
                    `
                    INSERT INTO inter_accounts 
                        (company_id, conta_corrente, client_id, client_secret, cert_b64, key_b64, 
                         apelido, ambiente, is_default, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                    ON DUPLICATE KEY UPDATE
                        client_id = VALUES(client_id),
                        client_secret = VALUES(client_secret),
                        cert_b64 = VALUES(cert_b64),
                        key_b64 = VALUES(key_b64),
                        apelido = VALUES(apelido),
                        ambiente = VALUES(ambiente),
                        is_default = VALUES(is_default),
                        status = VALUES(status),
                        updated_at = NOW()
                    `,
                    [
                        company_id,
                        inter_conta_corrente,
                        inter_client_id,
                        inter_client_secret,
                        inter_cert_b64,
                        inter_key_b64,
                        inter_apelido || `Conta ${inter_conta_corrente}`,
                        inter_ambiente || 'prod',
                        inter_is_default ? 1 : 0,
                        inter_status || 'ativo'
                    ]
                );

                // Atualizar o inter_account_id na contas_api
                const interAccountId = interResult.insertId || interResult.insertId;
                if (interAccountId) {
                    await conn.query(
                        'UPDATE contas_api SET inter_account_id = ? WHERE id = ?',
                        [interAccountId, contaApi.id]
                    );
                }
            }
        }

        await conn.commit();

        res.status(201).json({
            message: "Conta Pluggy salva/atualizada com sucesso.",
            affectedRows: result.affectedRows,
            interEnabled: inter_enabled
        });
    } catch (error) {
        await conn.rollback();
        console.error("Erro ao salvar conta_api:", error);
        res.status(500).json({ error: "Erro ao salvar conta_api." });
    } finally {
        conn.release();
    }
});

// 🔹 Listar todos os consentimentos Pluggy
router.get("/", verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM contas_api ORDER BY created_at DESC`);
        res.json(rows);
    } catch (error) {
        console.error("Erro ao listar contas_api:", error);
        res.status(500).json({ error: "Erro ao listar contas_api." });
    }
});

// 🔹 Buscar um consentimento Pluggy por item_id
router.get("/:item_id", verifyToken, async (req, res) => {
    const { item_id } = req.params;

    try {
        const [rows] = await pool.query(`SELECT * FROM contas_api WHERE item_id = ?`, [item_id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Conta Pluggy não encontrada." });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error("Erro ao buscar conta_api:", error);
        res.status(500).json({ error: "Erro ao buscar conta_api." });
    }
});

// 🔹 Atualizar status/execution_status se precisar
router.put("/:item_id", verifyToken, async (req, res) => {
    const { item_id } = req.params;
    const { status, execution_status } = req.body;

    try {
        const [result] = await pool.query(
            `
      UPDATE contas_api
      SET status = ?, execution_status = ?, updated_at = NOW()
      WHERE item_id = ?
      `,
            [status, execution_status, item_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Conta Pluggy não encontrada para atualizar." });
        }

        res.json({ message: "Conta Pluggy atualizada com sucesso." });
    } catch (error) {
        console.error("Erro ao atualizar conta_api:", error);
        res.status(500).json({ error: "Erro ao atualizar conta_api." });
    }
});

// 🔹 GET /company/:companyId/contas ➜ Todas as contas da empresa
router.get("/company/:companyId/contas", verifyToken, async (req, res) => {
  const { companyId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM contas_api WHERE company_id = ? ORDER BY created_at DESC`,
      [companyId]
    );
    res.json({ total: rows.length, contas: rows });
  } catch (error) {
    console.error("Erro ao buscar contas da empresa:", error);
    res.status(500).json({ error: "Erro ao buscar contas da empresa." });
  }
});

// 🔹 PUT /company/:companyId/conta/:account ➜ Editar conta da empresa
router.put("/company/:companyId/conta/:account", verifyToken, async (req, res) => {
  const { companyId, account } = req.params;
  const {
    banco,
    descricao_banco,
    tipo_conta,
    numero_conta,
    agencia,
    tipo,
    status,
    execution_status
  } = req.body;
  try {
    const [result] = await pool.query(
      `UPDATE contas_api SET banco = ?, descricao_banco = ?, tipo_conta = ?, numero_conta = ?, agencia = ?, tipo = ?, status = ?, execution_status = ?, updated_at = NOW() WHERE account = ? AND company_id = ?`,
      [banco, descricao_banco, tipo_conta, numero_conta, agencia, tipo, status, execution_status, account, companyId]
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

// 🔹 DELETE /company/:companyId/conta/:account ➜ Excluir conta da empresa
router.delete("/company/:companyId/conta/:account", verifyToken, async (req, res) => {
  const { companyId, account } = req.params;
  try {
    const [result] = await pool.query(
      `DELETE FROM contas_api WHERE account = ? AND company_id = ?`,
      [account, companyId]
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

// 🔹 GET /inter/:companyId ➜ Listar contas com Inter habilitado
router.get("/inter/:companyId", verifyToken, async (req, res) => {
  const { companyId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT 
         id,
         item_id,
         banco,
         descricao_banco,
         tipo_conta,
         numero_conta,
         agencia,
         tipo,
         inter_enabled,
         inter_apelido,
         inter_conta_corrente,
         inter_ambiente,
         inter_is_default,
         inter_status,
         inter_account_id,
         created_at,
         updated_at
       FROM contas_api 
       WHERE company_id = ? AND inter_enabled = TRUE
       ORDER BY inter_is_default DESC, created_at DESC`,
      [companyId]
    );
    res.json({ total: rows.length, contas: rows });
  } catch (error) {
    console.error("Erro ao buscar contas Inter:", error);
    res.status(500).json({ error: "Erro ao buscar contas Inter." });
  }
});

// 🔹 Nova rota: sincronizar contas Pluggy com a tabela contas_api
router.post("/sync", verifyToken, async (req, res) => {
    const { itemId, company_id, cliente_id } = req.body;
  
    console.log("[DEBUG] company_id recebido na sync:", company_id);
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
          INSERT INTO contas_api
            (item_id, account, connector_id, status, execution_status, company_id, cliente_id, banco, descricao_banco, tipo_conta, numero_conta, agencia, tipo, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            account = VALUES(account),
            connector_id = VALUES(connector_id),
            status = VALUES(status),
            execution_status = VALUES(execution_status),
            company_id = VALUES(company_id),
            cliente_id = VALUES(cliente_id),
            banco = VALUES(banco),
            descricao_banco = VALUES(descricao_banco),
            tipo_conta = VALUES(tipo_conta),
            numero_conta = VALUES(numero_conta),
            agencia = VALUES(agencia),
            tipo = VALUES(tipo),
            updated_at = NOW()
          `,
          [
            itemId,
            acc.id,
            acc.connectorId || null,
            acc.status || null,
            acc.execution_status || null,
            company_id || null,
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
        `SELECT account, connector_id, status, execution_status, banco, descricao_banco, tipo_conta, numero_conta, agencia, tipo
         FROM contas_api WHERE item_id = ? ORDER BY updated_at DESC`,
        [itemId]
      );
  
      const accountsList = accountsRows.map(row => ({
        account: row.account,
        connector_id: row.connector_id,
        status: row.status,
        execution_status: row.execution_status,
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
        accounts: accountsList
      });
  
    } catch (error) {
      console.error("❌ Erro ao sincronizar contas Pluggy:", error);
      res.status(500).json({ error: "Erro ao sincronizar contas Pluggy." });
    }
  });  


module.exports = router;
