const express = require("express");
const router = express.Router();
const pool = require("../../config/database");
const verifyToken = require("../../middlewares/auth");

// Todas as rotas exigem auth
router.use(verifyToken);

// GET /onety/notificacoes?limit=20&offset=0
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    const [rows] = await pool.query(
      `SELECT id, user_id, empresa_id, module, type, title, body, data_json, entity_type, entity_id, created_by, read_at, created_at
       FROM user_notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar notificações:", err);
    res.status(500).json({ error: "Erro ao listar notificações" });
  }
});

// GET /onety/notificacoes/unread-count
router.get("/unread-count", async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total FROM user_notifications WHERE user_id = ? AND read_at IS NULL`,
      [userId]
    );
    res.json({ total: rows[0]?.total || 0 });
  } catch (err) {
    console.error("Erro ao contar notificações:", err);
    res.status(500).json({ error: "Erro ao contar notificações" });
  }
});

// PATCH /onety/notificacoes/:id/lida
router.patch("/:id/lida", async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "ID inválido" });

    const [result] = await pool.query(
      `UPDATE user_notifications SET read_at = NOW() WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Notificação não encontrada" });
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao marcar notificação como lida:", err);
    res.status(500).json({ error: "Erro ao marcar como lida" });
  }
});

// PATCH /onety/notificacoes/lidas (todas)
router.patch("/lidas", async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const [result] = await pool.query(
      `UPDATE user_notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL`,
      [userId]
    );
    res.json({ success: true, updated: result.affectedRows });
  } catch (err) {
    console.error("Erro ao marcar todas como lidas:", err);
    res.status(500).json({ error: "Erro ao marcar todas como lidas" });
  }
});

module.exports = router;


