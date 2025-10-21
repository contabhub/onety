const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

router.post("/", verifyToken, async (req, res) => {
    const {
        conta_origem_id,
        conta_destino_id,
        descricao,
        valor,
        data_transferencia,
        anexo_base64
    } = req.body;

    const company_id = req.user?.company_id || req.body.company_id;


    if (!company_id || !conta_origem_id || !conta_destino_id || !valor || !data_transferencia) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }

    if (conta_origem_id === conta_destino_id) {
        return res.status(400).json({ error: "Conta de origem e destino não podem ser iguais." });
    }

    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        // Buscar saldos atuais
        const [[contaOrigem]] = await conn.query("SELECT saldo FROM contas WHERE id = ?", [conta_origem_id]);
        const [[contaDestino]] = await conn.query("SELECT saldo FROM contas WHERE id = ?", [conta_destino_id]);

        const saldoOrigemAntes = parseFloat(contaOrigem?.saldo || 0);
        const saldoDestinoAntes = parseFloat(contaDestino?.saldo || 0);

        if (saldoOrigemAntes < valor) {
            throw new Error("Saldo insuficiente na conta de origem.");
        }

        // Inserir transferência
        const [result] = await conn.query(`
      INSERT INTO transferencias 
      (company_id, conta_origem_id, conta_destino_id, descricao, valor, data_transferencia, anexo_base64)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [company_id, conta_origem_id, conta_destino_id, descricao, valor, data_transferencia, anexo_base64 || null]
        );

        const transferencia_id = result.insertId;

        // Atualizar saldos
        const saldoOrigemNovo = saldoOrigemAntes - valor;
        const saldoDestinoNovo = saldoDestinoAntes + valor;

        await conn.query("UPDATE contas SET saldo = ? WHERE id = ?", [saldoOrigemNovo, conta_origem_id]);
        await conn.query("UPDATE contas SET saldo = ? WHERE id = ?", [saldoDestinoNovo, conta_destino_id]);

        // Registrar histórico
        await conn.query(`
      INSERT INTO historico_transferencias 
      (transferencia_id, tipo, conta_id, saldo_anterior, saldo_atual)
      VALUES 
      (?, 'saida', ?, ?, ?),
      (?, 'entrada', ?, ?, ?)
    `, [
            transferencia_id, conta_origem_id, saldoOrigemAntes, saldoOrigemNovo,
            transferencia_id, conta_destino_id, saldoDestinoAntes, saldoDestinoNovo
        ]);

        await conn.commit();
        res.status(201).json({ message: "Transferência realizada com sucesso.", transferencia_id });
    } catch (error) {
        await conn.rollback();
        console.error("Erro ao realizar transferência:", error.message);
        res.status(500).json({ error: error.message || "Erro ao registrar transferência." });
    } finally {
        conn.release();
    }
});

// 🔍 Listar todas as transferências da empresa
router.get("/empresa/:companyId", verifyToken, async (req, res) => {
    const { companyId } = req.params;

    try {
        const [transferencias] = await pool.query(`
        SELECT t.*, 
               co.descricao_banco AS origem_banco, 
               cd.descricao_banco AS destino_banco
        FROM transferencias t
        JOIN contas co ON co.id = t.conta_origem_id
        JOIN contas cd ON cd.id = t.conta_destino_id
        WHERE t.company_id = ?
        ORDER BY t.created_at DESC
      `, [companyId]);

        res.json(transferencias);
    } catch (error) {
        console.error("Erro ao buscar transferências:", error);
        res.status(500).json({ error: "Erro ao buscar transferências." });
    }
});

// 🔍 Buscar detalhes de uma transferência por ID
router.get("/:id", verifyToken, async (req, res) => {
    const { id } = req.params;

    try {
        const [[transferencia]] = await pool.query(`
        SELECT t.*, 
               co.descricao_banco AS origem_banco, 
               cd.descricao_banco AS destino_banco
        FROM transferencias t
        JOIN contas co ON co.id = t.conta_origem_id
        JOIN contas cd ON cd.id = t.conta_destino_id
        WHERE t.id = ?
      `, [id]);

        if (!transferencia) {
            return res.status(404).json({ error: "Transferência não encontrada." });
        }

        res.json(transferencia);
    } catch (error) {
        console.error("Erro ao buscar transferência:", error);
        res.status(500).json({ error: "Erro ao buscar transferência." });
    }
});

// 📄 Histórico detalhado (entradas e saídas) por empresa
router.get("/empresa/:companyId/historico", verifyToken, async (req, res) => {
    const { companyId } = req.params;

    try {
        const [historico] = await pool.query(`
        SELECT h.*, c.descricao_banco, t.valor AS valor_transferencia
        FROM historico_transferencias h
        JOIN contas c ON c.id = h.conta_id
        JOIN transferencias t ON t.id = h.transferencia_id
        WHERE t.company_id = ?
        ORDER BY h.data DESC
      `, [companyId]);

        res.json(historico);
    } catch (error) {
        console.error("Erro ao buscar histórico de transferências:", error);
        res.status(500).json({ error: "Erro ao buscar histórico de transferências." });
    }
});

//  Estornar uma transferência (reverter saldos e deletar registros)
router.delete("/:id/estornar", verifyToken, async (req, res) => {
    const { id } = req.params;

    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        // 1. Buscar dados da transferência
        const [[transferencia]] = await conn.query(
            `SELECT * FROM transferencias WHERE id = ?`,
            [id]
        );

        if (!transferencia) {
            return res.status(404).json({ error: "Transferência não encontrada." });
        }

        const { conta_origem_id, conta_destino_id, valor } = transferencia;

        // 2. Buscar saldos atuais das contas
        const [[origem]] = await conn.query("SELECT saldo FROM contas WHERE id = ?", [conta_origem_id]);
        const [[destino]] = await conn.query("SELECT saldo FROM contas WHERE id = ?", [conta_destino_id]);

        if (!origem || !destino) {
            throw new Error("Contas não encontradas.");
        }

        const novoSaldoOrigem = parseFloat(origem.saldo) + parseFloat(valor);
        const novoSaldoDestino = parseFloat(destino.saldo) - parseFloat(valor);

        if (novoSaldoDestino < 0) {
            throw new Error("Saldo da conta de destino insuficiente para estorno.");
        }

        // 3. Atualizar os saldos
        await conn.query("UPDATE contas SET saldo = ? WHERE id = ?", [novoSaldoOrigem, conta_origem_id]);
        await conn.query("UPDATE contas SET saldo = ? WHERE id = ?", [novoSaldoDestino, conta_destino_id]);

        // 4. Deletar histórico
        await conn.query("DELETE FROM historico_transferencias WHERE transferencia_id = ?", [id]);

        // 5. Deletar a transferência
        await conn.query("DELETE FROM transferencias WHERE id = ?", [id]);

        await conn.commit();
        res.json({ message: "Transferência estornada com sucesso." });
    } catch (error) {
        await conn.rollback();
        console.error("Erro ao estornar transferência:", error.message);
        res.status(500).json({ error: error.message || "Erro ao estornar transferência." });
    } finally {
        conn.release();
    }
});


module.exports = router; 