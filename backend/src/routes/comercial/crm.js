// routes/crm.js
const router = require("express").Router();
const db = require("../config/database");
const verifyToken = require("../middlewares/auth");


router.get("/:equipeId/:funilId", verifyToken, async (req, res) => {
  try {
    const { equipeId, funilId } = req.params;
    const userId = req.user.id;

    // 0) Segurança: o usuário pertence à equipe?
    const [vinculo] = await db.query(
      "SELECT 1 FROM user_equipes WHERE user_id = ? AND equipe_id = ? LIMIT 1",
      [userId, equipeId]
    );
    if (vinculo.length === 0) {
      return res.status(403).json({ error: "Você não tem acesso a essa equipe." });
    }

    // 1) Funil dessa equipe
    const [[funil]] = await db.query(
      "SELECT id, equipe_id, nome, is_default FROM funis WHERE id = ? AND equipe_id = ?",
      [funilId, equipeId]
    );
    if (!funil) {
      return res.status(404).json({ error: "Funil não encontrado para esta equipe." });
    }

    // 2) Fases do funil (ordenadas)
    const [fases] = await db.query(
      "SELECT id, funil_id, nome, descricao, ordem FROM funil_fases WHERE funil_id = ? ORDER BY ordem ASC",
      [funilId]
    );

    // 3) Leads do funil na equipe (leve) + responsável (sem N+1)
    const [leads] = await db.query(
      `
      SELECT
        l.id,
        l.name,
        l.email,
        l.telefone,
        l.valor,
        l.data_prevista,
        l.temperatura,
        l.status,
        l.created_at,
        l.fase_funil_id,
        l.user_id,
        u.full_name  AS responsavel_nome,
        u.avatar_url AS responsavel_avatar
      FROM leads l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE l.team_id = ? AND l.funil_id = ?
      ORDER BY l.created_at DESC
      `,
      [equipeId, funilId]
    );

    // 4) Agrupa os leads por fase
    const mapaFases = new Map(fases.map(f => [f.id, { ...f, leads: [] }]));
    for (const lead of leads) {
      if (!mapaFases.has(lead.fase_funil_id)) {
        // Se houver lead em fase inexistente, evita quebrar o front
        mapaFases.set(lead.fase_funil_id, {
          id: lead.fase_funil_id,
          funil_id: Number(funilId),
          nome: "(Fase não encontrada)",
          descricao: null,
          ordem: 9999,
          leads: []
        });
      }
      mapaFases.get(lead.fase_funil_id).leads.push(lead);
    }

    // 5) Contagem por fase e total
    const contagemPorFase = {};
    for (const fase of mapaFases.values()) {
      contagemPorFase[fase.id] = fase.leads.length;
    }

    return res.json({
      funil,
      fases: Array.from(mapaFases.values()).sort((a, b) => a.ordem - b.ordem),
      contagem: {
        total: leads.length,
        por_fase: contagemPorFase
      }
    });
  } catch (error) {
    console.error("Erro ao montar board do CRM:", error);
    return res.status(500).json({ error: "Erro ao montar board do CRM." });
  }
});

module.exports = router;
