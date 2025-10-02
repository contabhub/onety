const jwt = require("jsonwebtoken");
const db = require("../config/database");

module.exports = async function authOrApiKey(req, res, next) {
  const authHeader = req.header("Authorization");
  const apiKey = req.header("x-api-key");

  // 1. Tentar JWT primeiro
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    try {
      const verified = jwt.verify(token, process.env.JWT_SECRET);
      req.user = verified;
      return next(); // Se JWT válido, segue
    } catch (err) {
      // Continua tentando API Key se JWT inválido
    }
  }

  // 2. Tentar API Key
  if (apiKey) {
    try {
      const [rows] = await db.query(
        "SELECT * FROM api_keys WHERE chave = ? AND ativo = 1 LIMIT 1",
        [apiKey]
      );
      if (rows.length > 0) {
        req.apiKeyInfo = rows[0];
        return next(); // Se API Key válida, segue
      }
    } catch (err) {
      return res.status(500).json({ error: "Erro interno ao validar API Key" });
    }
  }

  // Nenhum autenticador válido
  return res.status(401).json({ error: "Token ou API Key obrigatórios e válidos!" });
};
