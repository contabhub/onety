function verificarPermissao(permissao) {
  return (req, res, next) => {
    try {
      const permissoes = (req.user && req.user.permissoes) || {};

      if (
        permissoes.adm &&
        Array.isArray(permissoes.adm) &&
        (permissoes.adm.includes("admin") || permissoes.adm.includes("superadmin"))
      ) {
        return next();
      }

      if (!permissao) return next();
      const [grupo, acao] = String(permissao).split(".");
      const grupoPerms = permissoes[grupo] || [];
      if (!Array.isArray(grupoPerms) || !grupoPerms.includes(acao)) {
        return res.status(403).json({ error: "Permissão negada para esta ação." });
      }

      return next();
    } catch (error) {
      console.error("Erro ao verificar permissão:", error);
      return res.status(500).json({ error: "Erro interno ao verificar permissão." });
    }
  };
}

module.exports = { verificarPermissao };


