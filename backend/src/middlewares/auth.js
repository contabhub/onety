const jwt = require("jsonwebtoken");
const db = require("../config/database");

const verifyToken = async (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) return res.status(401).json({ error: "Acesso negado!" });

  try {
    const verified = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    // Mantém compatibilidade: alguns módulos usam req.user e outros req.usuario
    req.user = verified; // padrão atual
    // Normaliza empresaId para ambos os formatos usados no código
    let empresaId = verified?.empresaId ?? verified?.EmpresaId ?? verified?.empresa_id ?? null;
    // Se não vier no token, busca a empresa mais recente vinculada ao usuário
    if (!empresaId && verified?.id) {
      try {
        const [[row]] = await db.query(
          "SELECT empresa_id FROM usuarios_empresas WHERE usuario_id = ? ORDER BY id DESC LIMIT 1",
          [verified.id]
        );
        if (row && row.empresa_id) empresaId = row.empresa_id;
      } catch (e) {
        // silencioso para não quebrar fluxo de autenticação
      }
    }
    req.usuario = {
      ...verified,
      empresaId,
    };
    next();
  } catch (error) {
    res.status(400).json({ error: "Token inválido!" });
  }
};

module.exports = verifyToken;
