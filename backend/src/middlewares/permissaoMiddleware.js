function verificarPermissao(permissao) {
  return (req, res, next) => {
    try {
      const permissoes = req.usuario.permissoes || {};

      // Liberação total
      if (permissoes.adm && Array.isArray(permissoes.adm) && permissoes.adm.includes("admin")) {
        return next();
      }

      const [grupo, acao] = permissao.split(".");
      const grupoPermissoes = permissoes[grupo] || [];

      if (!Array.isArray(grupoPermissoes) || !grupoPermissoes.includes(acao)) {
        return res.status(403).json({ error: "Permissão negada para esta ação." });
      }

      next();
    } catch (error) {
      console.error("Erro ao verificar permissão:", error);
      res.status(500).json({ error: "Erro interno ao verificar permissão." });
    }
  };
}

module.exports = { verificarPermissao };
