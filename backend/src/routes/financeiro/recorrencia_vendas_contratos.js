const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// ✅ CREATE - Criar nova recorrência (contrato ou venda)
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      tipo_origem, // 'contrato' ou 'venda'
      contrato_id,
      venda_id,
      tipo_intervalo,
      intervalo,
      indeterminado,
      total_ciclos,
      status
    } = req.body;

    if (!tipo_origem || !["contrato", "venda"].includes(tipo_origem)) {
      return res.status(400).json({ error: "tipo_origem deve ser 'contrato' ou 'venda'." });
    }

    if (tipo_origem === "contrato" && !contrato_id) {
      return res.status(400).json({ error: "contrato_id é obrigatório para tipo_origem 'contrato'." });
    }

    if (tipo_origem === "venda" && !venda_id) {
      return res.status(400).json({ error: "venda_id é obrigatório para tipo_origem 'venda'." });
    }

    if (indeterminado && total_ciclos) {
      return res.status(400).json({ error: "Recorrência indeterminada não deve ter total_ciclos." });
    }

    const [result] = await pool.query(
      `INSERT INTO recorrencia_vendas_contratos 
        (tipo_origem, contrato_id, venda_id, tipo_intervalo, intervalo, indeterminado, total_ciclos, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tipo_origem,
        tipo_origem === "contrato" ? contrato_id : null,
        tipo_origem === "venda" ? venda_id : null,
        tipo_intervalo || "meses",
        intervalo || 1,
        indeterminado ?? true,
        indeterminado ? null : total_ciclos,
        status || "ativo"
      ]
    );

    res.status(201).json({ id: result.insertId, message: "Recorrência criada com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao criar recorrência:", error);
    res.status(500).json({ error: "Erro ao criar recorrência." });
  }
});

// ✅ READ - Listar todas as recorrências
router.get("/", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        rvc.*,
        c.valor AS contrato_valor,
        c.status AS contrato_status,
        v.valor_venda AS venda_valor,
        v.situacao AS venda_status
      FROM recorrencia_vendas_contratos rvc
      LEFT JOIN contratos c ON rvc.contrato_id = c.id
      LEFT JOIN vendas v ON rvc.venda_id = v.id
      ORDER BY rvc.created_at DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("❌ Erro ao listar recorrências:", error);
    res.status(500).json({ error: "Erro ao listar recorrências." });
  }
});

// ✅ READ ONE - Buscar recorrência por ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT 
        rvc.*, 
        c.valor AS contrato_valor,
        c.status AS contrato_status,
        v.valor_venda AS venda_valor,
        v.situacao AS venda_status
      FROM recorrencia_vendas_contratos rvc
      LEFT JOIN contratos c ON rvc.contrato_id = c.id
      LEFT JOIN vendas v ON rvc.venda_id = v.id
      WHERE rvc.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Recorrência não encontrada." });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("❌ Erro ao buscar recorrência:", error);
    res.status(500).json({ error: "Erro ao buscar recorrência." });
  }
});

// ✅ UPDATE - Atualizar recorrência
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tipo_origem,
      contrato_id,
      venda_id,
      tipo_intervalo,
      intervalo,
      indeterminado,
      total_ciclos,
      status
    } = req.body;

    const [result] = await pool.query(
      `UPDATE recorrencia_vendas_contratos 
       SET tipo_origem = ?, 
           contrato_id = ?, 
           venda_id = ?, 
           tipo_intervalo = ?, 
           intervalo = ?, 
           indeterminado = ?, 
           total_ciclos = ?, 
           status = ?, 
           updated_at = NOW()
       WHERE id = ?`,
      [
        tipo_origem,
        tipo_origem === "contrato" ? contrato_id : null,
        tipo_origem === "venda" ? venda_id : null,
        tipo_intervalo || "meses",
        intervalo || 1,
        indeterminado ?? true,
        indeterminado ? null : total_ciclos,
        status,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Recorrência não encontrada." });
    }

    res.json({ message: "Recorrência atualizada com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao atualizar recorrência:", error);
    res.status(500).json({ error: "Erro ao atualizar recorrência." });
  }
});

// ✅ DELETE - Excluir recorrência
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query("DELETE FROM recorrencia_vendas_contratos WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Recorrência não encontrada." });
    }

    res.json({ message: "Recorrência deletada com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao deletar recorrência:", error);
    res.status(500).json({ error: "Erro ao deletar recorrência." });
  }
});

module.exports = router;
