const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { ensureValidToken } = require("../services/financeiro/inter");

router.post("/token", async (req, res) => {
  try {
    const { inter_account_id } = req.body;
    if (!inter_account_id) return res.status(400).json({ error: "inter_account_id é obrigatório." });

    const scope = "boleto-cobranca.read boleto-cobranca.write";
    const access_token = await ensureValidToken(inter_account_id, scope);

    const [[row]] = await pool.query(
      `SELECT token_type, expires_in, created_at, expires_at
       FROM inter_tokens_validate_cache WHERE inter_account_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [inter_account_id]
    );

    res.json({
      inter_account_id,
      access_token,
      token_type: row?.token_type || "Bearer",
      expires_in: row?.expires_in,
      created_at: row?.created_at,
      expires_at: row?.expires_at
    });
  } catch (error) {
    console.error("Erro ao gerar token Inter:", error.message);
    res.status(500).json({ error: "Erro ao gerar token Inter", details: error.message });
  }
});

router.get("/token/:interAccountId", async (req, res) => {
  try {
    const interAccountId = Number(req.params.interAccountId);
    if (!interAccountId) return res.status(400).json({ error: "interAccountId inválido." });

    const [[row]] = await pool.query(
      `SELECT access_token, token_type, scope, expires_in, created_at, expires_at
       FROM inter_tokens_validate_cache WHERE inter_account_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [interAccountId]
    );
    if (!row) return res.status(404).json({ error: "Nenhum token encontrado para esta conta." });
    res.json(row);
  } catch (error) {
    console.error("Erro ao buscar token Inter:", error.message);
    res.status(500).json({ error: "Erro ao buscar token Inter" });
  }
});

module.exports = router; 