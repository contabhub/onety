const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

router.post("/", verifyToken, async (req, res) => {
    const {
        caixinha_id,
        transferencia_caixinha_id,
        descricao,
        valor,
        data_transferencia,
        anexo
    } = req.body;

    const empresa_id = req.user?.company_id || req.body.company_id;


    if (!empresa_id || !caixinha_id || !transferencia_caixinha_id || !valor || !data_transferencia) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes." });
    }

    if (caixinha_id === transferencia_caixinha_id) {
        return res.status(400).json({ error: "Caixinha de origem e destino não podem ser iguais." });
    }

    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        // Buscar saldos atuais
        const [[caixinhaOrigem]] = await conn.query("SELECT saldo FROM caixinha WHERE id = ?", [caixinha_id]);
        const [[caixinhaDestino]] = await conn.query("SELECT saldo FROM caixinha WHERE id = ?", [transferencia_caixinha_id]);

        const saldoOrigemAntes = parseFloat(caixinhaOrigem?.saldo || 0);
        const saldoDestinoAntes = parseFloat(caixinhaDestino?.saldo || 0);

        if (saldoOrigemAntes < valor) {
            throw new Error("Saldo insuficiente na caixinha de origem.");
        }

        // Inserir transferência
        const [result] = await conn.query(`
      INSERT INTO transferencias_caixinha 
      (empresa_id, caixinha_id, transferencia_caixinha_id, descricao, valor, data_transferencia, anexo)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [empresa_id, caixinha_id, transferencia_caixinha_id, descricao, valor, data_transferencia, anexo || null]
        );

        const transferencia_id = result.insertId;

        // Atualizar saldos
        const saldoOrigemNovo = saldoOrigemAntes - valor;
        const saldoDestinoNovo = saldoDestinoAntes + valor;

        await conn.query("UPDATE caixinha SET saldo = ? WHERE id = ?", [saldoOrigemNovo, caixinha_id]);
        await conn.query("UPDATE caixinha SET saldo = ? WHERE id = ?", [saldoDestinoNovo, transferencia_caixinha_id]);

        // Registrar histórico
        await conn.query(`
      INSERT INTO historico_transferencias 
      (transferencia_id, tipo, caixinha_id, saldo_anterior, saldo_atual)
      VALUES 
      (?, 'saida', ?, ?, ?),
      (?, 'entrada', ?, ?, ?)
    `, [
            transferencia_id, caixinha_id, saldoOrigemAntes, saldoOrigemNovo,
            transferencia_id, transferencia_caixinha_id, saldoDestinoAntes, saldoDestinoNovo
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
router.get("/empresa/:empresaId", verifyToken, async (req, res) => {
    const { empresaId } = req.params;

    try {
        const [transferencias] = await pool.query(`
        SELECT t.*, 
               co.descricao_banco AS origem_banco, 
               cd.descricao_banco AS destino_banco
        FROM transferencias_caixinha t
        JOIN caixinha co ON co.id = t.caixinha_id
        JOIN caixinha cd ON cd.id = t.transferencia_caixinha_id
        WHERE t.empresa_id = ?
        ORDER BY t.criado_em DESC
      `, [empresaId]);

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
        FROM transferencias_caixinha t
        JOIN caixinha co ON co.id = t.caixinha_id
        JOIN caixinha cd ON cd.id = t.transferencia_caixinha_id
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
router.get("/empresa/:empresaId/historico", verifyToken, async (req, res) => {
    const { empresaId } = req.params;

    try {
        const [historico] = await pool.query(`
        SELECT h.*, c.descricao_banco, t.valor AS valor_transferencia
        FROM historico_transferencias h
        JOIN caixinha c ON c.id = h.caixinha_id
        JOIN transferencias_caixinha t ON t.id = h.transferencia_id
        WHERE t.empresa_id = ?
        ORDER BY h.data DESC
      `, [empresaId]);

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
            `SELECT * FROM transferencias_caixinha WHERE id = ?`,
            [id]
        );

        if (!transferencia) {
            return res.status(404).json({ error: "Transferência não encontrada." });
        }

        const { caixinha_id, transferencia_caixinha_id, valor } = transferencia;

        // 2. Buscar saldos atuais das caixinhas
        const [[origem]] = await conn.query("SELECT saldo FROM caixinha WHERE id = ?", [caixinha_id]);
        const [[destino]] = await conn.query("SELECT saldo FROM caixinha WHERE id = ?", [transferencia_caixinha_id]);

        if (!origem || !destino) {
            throw new Error("Caixinhas não encontradas.");
        }

        const novoSaldoOrigem = parseFloat(origem.saldo) + parseFloat(valor);
        const novoSaldoDestino = parseFloat(destino.saldo) - parseFloat(valor);

        if (novoSaldoDestino < 0) {
            throw new Error("Saldo da caixinha de destino insuficiente para estorno.");
        }

        // 3. Atualizar os saldos
        await conn.query("UPDATE caixinha SET saldo = ? WHERE id = ?", [novoSaldoOrigem, caixinha_id]);
        await conn.query("UPDATE caixinha SET saldo = ? WHERE id = ?", [novoSaldoDestino, transferencia_caixinha_id]);

        // 4. Deletar histórico
        await conn.query("DELETE FROM historico_transferencias WHERE transferencia_id = ?", [id]);

        // 5. Deletar a transferência
        await conn.query("DELETE FROM transferencias_caixinha WHERE id = ?", [id]);

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