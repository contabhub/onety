// routes/historicoLeads.js
const express = require("express");
const router = express.Router();
const db = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// 🔹 Buscar histórico por lead
router.get("/:leadId", verifyToken, async (req, res) => {
  const { leadId } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT h.*, u.full_name, u.avatar_url 
       FROM historico_leads h
       LEFT JOIN users u ON h.usuario_id = u.id
       WHERE h.lead_id = ?
       ORDER BY h.criado_em DESC`,
      [leadId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar histórico:", err);
    res.status(500).json({ error: "Erro ao buscar histórico do lead." });
  }
});



// 🔹 Criar entrada no histórico (uso interno)
router.post("/", verifyToken, async (req, res) => {
  const { lead_id, usuario_id, tipo, titulo, descricao, referencia_id } = req.body;

  if (!lead_id || !tipo || !titulo) {
    return res.status(400).json({ error: "Campos obrigatórios: lead_id, tipo, titulo" });
  }

  try {
    await db.query(
      `INSERT INTO historico_leads (lead_id, usuario_id, tipo, titulo, descricao, referencia_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [lead_id, usuario_id || null, tipo, titulo, descricao || null, referencia_id || null]
    );

    res.status(201).json({ message: "Evento registrado no histórico com sucesso." });
  } catch (err) {
    console.error("Erro ao criar histórico:", err);
    res.status(500).json({ error: "Erro ao registrar no histórico." });
  }
});

router.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(`DELETE FROM historico_leads WHERE id = ?`, [id]);
    res.json({ message: "Histórico removido com sucesso." });
  } catch (err) {
    console.error("Erro ao excluir histórico:", err);
    res.status(500).json({ error: "Erro ao excluir histórico." });
  }
});


module.exports = router;
