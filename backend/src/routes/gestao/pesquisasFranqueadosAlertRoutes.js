const express = require("express");
const verifyToken = require("../../middlewares/auth");
const db = require("../../config/database");

const router = express.Router();

const PUBLIC_PESQUISA_BASE =
  process.env.PESQUISA_FRANQUEADO_PUBLIC_URL ||
  process.env.PESQUISA_PUBLIC_URL ||
  "http://localhost:3000/public/pesquisa-franqueado";

router.get("/pendentes", verifyToken, async (req, res) => {
  try {
    const usuarioId = req.usuario?.id ?? req.user?.id ?? null;
    const empresaId =
      req.query?.empresaId ??
      req.usuario?.empresaId ??
      req.user?.empresaId ??
      null;

    if (!usuarioId || !empresaId) {
      return res.status(400).json({
        erro: "Usuário ou empresa não informados.",
      });
    }

    const [[empresa]] = await db.query(
      `SELECT admin_usuario_id FROM empresas WHERE id = ? LIMIT 1`,
      [empresaId]
    );

    if (!empresa || empresa.admin_usuario_id !== usuarioId) {
      return res.json({ pendencias: false });
    }

    const [[pendentes]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM pesquisas_satisfacao_franqueados
       WHERE franqueado_id = ? AND status = 'enviado'`,
      [empresaId]
    );

    if (!pendentes?.total) {
      return res.json({ pendencias: false });
    }

    const [[primeiraPesquisa]] = await db.query(
      `SELECT psf.id,
              psf.token,
              psf.data_envio,
              e.razaoSocial AS franqueadora_nome
       FROM pesquisas_satisfacao_franqueados psf
       LEFT JOIN empresas e ON e.id = psf.empresa_id
       WHERE psf.franqueado_id = ? AND psf.status = 'enviado'
       ORDER BY psf.data_envio DESC
       LIMIT 1`,
      [empresaId]
    );

    return res.json({
      pendencias: true,
      total: pendentes.total,
      mensagem:
        "Sua opinião é essencial para construirmos um ecossistema de franquias cada vez mais forte. Responda a pesquisa de satisfação e nos ajude a evoluir!",
      pesquisa: primeiraPesquisa
        ? {
            token: primeiraPesquisa.token,
            link: `${PUBLIC_PESQUISA_BASE.replace(/\/$/, "")}/${
              primeiraPesquisa.token
            }`,
            franqueadoraNome: primeiraPesquisa.franqueadora_nome || null,
            dataEnvio: primeiraPesquisa.data_envio,
          }
        : null,
    });
  } catch (error) {
    console.error("Erro ao verificar pesquisas pendentes:", error);
    return res
      .status(500)
      .json({ erro: "Erro ao verificar pesquisas pendentes." });
  }
});

module.exports = router;

