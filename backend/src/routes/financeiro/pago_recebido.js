const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// 🔹 Criar um registro em pago_recebido
router.post("/", verifyToken, async (req, res) => {
  const {
    tipo, empresa_id, descricao, observacoes, valor, vencimento,
    pago_recebido, data_recebimento, categoria_id, transacoes_id
  } = req.body;

  try {
    const [result] = await pool.query(`
      INSERT INTO pago_recebido 
        (tipo, empresa_id, descricao, observacoes, valor, vencimento, pago_recebido, data_recebimento, categoria_id, transacoes_id, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      tipo, empresa_id, descricao, observacoes, valor, vencimento,
      pago_recebido, data_recebimento, categoria_id, transacoes_id
    ]);

    res.status(201).json({ id: result.insertId, message: "Registro criado com sucesso!" });
  } catch (error) {
    console.error("Erro ao criar registro:", error);
    res.status(500).json({ error: "Erro ao criar registro." });
  }
});

// 🔹 Listar todos
router.get("/", verifyToken, async (req, res) => {
  try {
    const [result] = await pool.query(`
      SELECT * FROM pago_recebido ORDER BY criado_em DESC
    `);
    res.json(result);
  } catch (error) {
    console.error("Erro ao listar registros:", error);
    res.status(500).json({ error: "Erro ao buscar registros." });
  }
});

// 🔹 Buscar por ID
router.get("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query("SELECT * FROM pago_recebido WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Registro não encontrado." });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Erro ao buscar registro:", error);
    res.status(500).json({ error: "Erro ao buscar registro." });
  }
});

// 🔹 Atualizar
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const {
    tipo, empresa_id, descricao, observacoes, valor, vencimento,
    pago_recebido, data_recebimento, categoria_id, transacoes_id
  } = req.body;

  try {
    const [result] = await pool.query(`
      UPDATE pago_recebido SET
        tipo = ?, empresa_id = ?, descricao = ?, observacoes = ?, valor = ?, vencimento = ?,
        pago_recebido = ?, data_recebimento = ?, categoria_id = ?, transacoes_id = ?
      WHERE id = ?
    `, [
      tipo, empresa_id, descricao, observacoes, valor, vencimento,
      pago_recebido, data_recebimento, categoria_id, transacoes_id, id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Registro não encontrado." });
    }

    res.json({ message: "Registro atualizado com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar:", error);
    res.status(500).json({ error: "Erro ao atualizar registro." });
  }
});

// 🔹 Deletar
router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query("DELETE FROM pago_recebido WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Registro não encontrado." });
    }

    res.json({ message: "Registro deletado com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar registro:", error);
    res.status(500).json({ error: "Erro ao deletar registro." });
  }
});

module.exports = router;